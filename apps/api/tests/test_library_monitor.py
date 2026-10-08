import time
import pytest

from app.services.archive_manifest import inspect_archive
from app.services.archive_service import ArchiveService
from app.services.file_service import FileMaintenanceService
from app.services.governance_service import GovernanceService
from app.services.library_monitor_service import LibraryMonitorService
from test_library_index import create_archive, setup_index


def wait_for(check, timeout=8):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if check():
            return
        time.sleep(.05)
    assert check()


def test_native_changes_index_stable_nested_work_and_reconcile_delete_without_job_flood(tmp_path):
    _, db, libraries, index, root, library = setup_index(tmp_path, stable_seconds=1, scan_interval_seconds=600)
    db.execute("UPDATE media_libraries SET enabled = 0 WHERE kind = 'managed'")
    monitor = LibraryMonitorService(index, libraries)
    monitor.start()
    try:
        wait_for(lambda: libraries.get(library['id'])['health'] == 'online')
        time.sleep(.6)  # Let the native watcher finish initialization.
        source = root / 'nested/book.cbz'
        create_archive(source)
        wait_for(lambda: bool(db.fetchone("SELECT id FROM library_items WHERE status = 'ready'")))
        work_id = db.fetchone('SELECT id FROM works')['id']
        original = source.read_bytes()
        assert source.read_bytes() == original and not db.fetchone('SELECT id FROM jobs')
        source.unlink()
        wait_for(lambda: db.fetchone('SELECT status FROM library_items')['status'] == 'missing')
        assert db.fetchone('SELECT id FROM works')['id'] == work_id
        assert not db.fetchone('SELECT id FROM jobs')
    finally:
        monitor.close()
    assert not monitor._thread.is_alive() and all(not row[2].is_alive() for row in monitor._watchers.values())
    monitor.start()
    try:
        time.sleep(.6)
        create_archive(root / 'restarted.cbz')
        wait_for(lambda: bool(db.fetchone("SELECT 1 FROM library_items WHERE relative_path = 'restarted.cbz' AND status = 'ready'")))
    finally:
        monitor.close()


def test_mount_compensation_backoff_and_changed_paths_survive_restart(tmp_path):
    _, db, libraries, index, root, library = setup_index(tmp_path, scan_interval_seconds=10)
    db.execute("UPDATE media_libraries SET enabled = 0 WHERE kind = 'managed'")
    libraries.update(library['id'], {'kind': 'mounted'})
    source = root / 'book.cbz'
    create_archive(source)
    monitor = LibraryMonitorService(index, libraries)
    monitor.tick()
    assert db.fetchone('SELECT status FROM library_items')['status'] == 'ready'
    assert not monitor._watchers and not db.fetchone('SELECT id FROM jobs')
    monitor.changed(library['id'], ['book.cbz'])
    monitor.close()
    restarted = LibraryMonitorService(index, libraries)
    db.execute('UPDATE library_changes SET due_at = 0')
    root.rename(root.with_name('offline'))
    restarted.tick()
    failed = libraries.get(library['id'])
    assert failed['scan_failures'] == 1 and failed['next_scan_at'] > time.time() + 15
    count = db.fetchone('SELECT COUNT(*) AS n FROM library_scan_runs')['n']
    restarted.tick()
    assert db.fetchone('SELECT COUNT(*) AS n FROM library_scan_runs')['n'] == count
    assert db.fetchone('SELECT relative_path FROM library_changes')['relative_path'] == 'book.cbz'
    assert db.fetchone('SELECT id FROM works')
    root.with_name('offline').rename(root)
    db.execute('UPDATE media_libraries SET next_scan_at = 0')
    restarted.tick()
    assert libraries.get(library['id'])['scan_failures'] == 0 and not db.fetchone('SELECT 1 FROM library_changes')
    restarted.close()


def test_changes_during_scan_survive_commit_and_automatic_scan_protects_sources(tmp_path, monkeypatch):
    settings, db, libraries, index, root, library = setup_index(tmp_path)
    db.execute("UPDATE media_libraries SET enabled = 0 WHERE kind = 'managed'")
    libraries.update(library['id'], {'read_only': False})
    source = root / 'book.cbz'
    create_archive(source)
    index.scan(library['id'])
    work_id = db.fetchone('SELECT id FROM works')['id']
    archive = ArchiveService(db, settings)
    files = FileMaintenanceService(db, settings, archive.cache)
    governance = GovernanceService(db, settings=settings, cache=archive.cache)
    monitor = LibraryMonitorService(index, libraries)
    create_archive(source, title='New title')
    def inspect_during_scan(path):
        monitor.changed(library['id'], ['book.cbz'])
        with pytest.raises(ValueError, match='正在扫描'):
            libraries.remove(library['id'])
        preview = files.preview_delete([{'kind': 'work', 'work_id': work_id}])['items'][0]
        assert preview['status'] == 'forbidden' and '扫描' in preview['warnings'][0]
        assert '扫描' in governance._write_back_readiness(work_id)[1][0]
        return inspect_archive(path)
    monkeypatch.setattr('app.services.library_index_service.inspect_archive', inspect_during_scan)
    try:
        monitor.tick()
        assert db.fetchone('SELECT relative_path FROM library_changes')['relative_path'] == 'book.cbz'
        assert db.fetchone('SELECT status FROM library_items')['status'] == 'ready'
        assert not db.fetchone('SELECT id FROM jobs')
    finally:
        monitor.close()
        archive.cache.close()


def test_event_overflow_coalesces_and_disabled_libraries_ignore_events(tmp_path):
    _, db, libraries, index, _, library = setup_index(tmp_path)
    monitor = LibraryMonitorService(index, libraries)
    monitor.changed(library['id'], [f'{i}.cbz' for i in range(5001)])
    rows = db.fetchall('SELECT * FROM library_changes')
    assert len(rows) == 1 and rows[0]['relative_path'] == ''
    libraries.update(library['id'], {'enabled': False})
    monitor.changed(library['id'], ['new.cbz'])
    assert db.fetchall('SELECT * FROM library_changes') == rows
