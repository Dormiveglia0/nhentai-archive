import hashlib
from pathlib import Path

import pytest

from app.services.archive_service import ArchiveService
from app.services.file_service import FileMaintenanceService
from app.services.job_service import JobCancelled, JobService
from app.services.library_migration_service import LibraryMigrationService
from app.services.library_service import LibraryService
from test_library_index import create_archive, setup_index


def setup_migration(tmp_path):
    settings, db, libraries, index, root, target = setup_index(tmp_path)
    libraries.update(target['id'], {'read_only': False})
    managed = db.fetchone("SELECT id FROM media_libraries WHERE kind='managed'")['id']
    libraries.update(managed, {'config': {'stable_seconds': 0}})
    source = settings.library_dir / 'one.cbz'
    create_archive(source, title='Original')
    index.scan(managed)
    work_id = db.fetchone('SELECT id FROM works')['id']
    db.execute("UPDATE works SET title='Manual', favorite=1 WHERE id=?", (work_id,))
    db.execute("UPDATE work_metadata SET value='Manual', source='manual' WHERE work_id=? AND field='title'", (work_id,))
    db.execute("INSERT INTO reader_progress(work_id,page_index,page_count,progress_percent) VALUES (?,1,2,50)", (work_id,))
    archive = ArchiveService(db, settings)
    jobs = JobService(db)
    files = FileMaintenanceService(db, settings, archive.cache)
    migration = LibraryMigrationService(settings, db, libraries, index, files, jobs)
    return db, libraries, index, source, root, target, work_id, jobs, migration


def test_copy_preserves_identity_and_manual_records_and_scan_does_not_duplicate(tmp_path):
    db, libraries, index, source, root, target, work_id, jobs, migration = setup_migration(tmp_path)
    expected = source.read_bytes()
    plan = migration.preview([work_id], target['id'])
    job = jobs.create('library_migration', plan)
    migration.run(job['id'], lambda: jobs.checkpoint(job['id']))
    assert jobs.get(job['id'])['status'] == 'completed'
    assert (root / 'one.cbz').read_bytes() == expected == source.read_bytes()
    assert db.fetchone('SELECT title,favorite FROM works WHERE id=?', (work_id,)) == {'title': 'Manual', 'favorite': 1}
    assert db.fetchone('SELECT page_index FROM reader_progress WHERE work_id=?', (work_id,))['page_index'] == 1
    assert len(libraries.files(work_id)) == 2
    search = LibraryService(db)
    managed = db.fetchone("SELECT id FROM media_libraries WHERE kind='managed'")['id']
    assert search.search(library_id=managed)['total'] == 1
    assert search.search(library_id=target['id'])['total'] == 1
    assert search.search(library_id=-1)['total'] == 0
    index.scan(target['id'])
    assert db.fetchone('SELECT COUNT(*) AS n FROM works')['n'] == 1
    assert db.fetchone('SELECT title FROM works WHERE id=?', (work_id,))['title'] == 'Manual'
    assert not db.fetchall('PRAGMA foreign_key_check')
    db.execute("UPDATE library_items SET status='missing' WHERE work_id=?", (work_id,))
    assert search.search(library_id=-1)['total'] == 1


def test_move_conflict_renames_and_preserves_existing_file(tmp_path):
    db, libraries, index, source, root, target, work_id, jobs, migration = setup_migration(tmp_path)
    existing = root / 'one.cbz'
    existing.write_bytes(b'keep existing')
    plan = migration.preview([work_id], target['id'], True)
    name = plan['plan'][0]['name']
    assert name != 'one.cbz'
    job = jobs.create('library_migration', plan)
    migration.run(job['id'], lambda: jobs.checkpoint(job['id']))
    assert jobs.get(job['id'])['status'] == 'completed'
    assert not source.exists() and (root / name).is_file()
    assert existing.read_bytes() == b'keep existing'
    assert len(libraries.files(work_id)) == 1
    assert libraries.files(work_id)[0]['library_id'] == target['id']


def test_cancel_and_source_change_never_remove_original(tmp_path):
    db, libraries, index, source, root, target, work_id, jobs, migration = setup_migration(tmp_path)
    expected = source.read_bytes()
    plan = migration.preview([work_id], target['id'], True)
    job = jobs.create('library_migration', plan)
    checks = 0
    def cancel():
        nonlocal checks
        checks += 1
        if checks == 3:
            raise JobCancelled()
    with pytest.raises(JobCancelled):
        migration.run(job['id'], cancel)
    assert source.read_bytes() == expected and not list(root.glob('*.part'))
    jobs.mark_cancelled(job['id'])
    changed = jobs.create('library_migration', plan)
    source.write_bytes(expected + b'changed')
    migration.run(changed['id'], lambda: jobs.checkpoint(changed['id']))
    assert jobs.get(changed['id'])['status'] == 'failed'
    assert source.exists() and not list(root.glob('*.cbz'))


def test_restart_recovers_published_copy_and_refuses_readonly_and_active_move(tmp_path):
    db, libraries, index, source, root, target, work_id, jobs, migration = setup_migration(tmp_path)
    plan = migration.preview([work_id], target['id'], True)
    entry = plan['plan'][0]
    copied = root / entry['name']
    copied.write_bytes(source.read_bytes())
    entry['sha256'] = hashlib.sha256(copied.read_bytes()).hexdigest()
    job = jobs.create('library_migration', plan)
    with pytest.raises(ValueError, match='迁移'):
        libraries.remove(target['id'])
    migration.run(job['id'], lambda: jobs.checkpoint(job['id']))
    assert jobs.get(job['id'])['status'] == 'completed' and not source.exists()
    libraries.update(target['id'], {'read_only': True})
    with pytest.raises(ValueError, match='可写'):
        migration.preview([work_id], target['id'])
