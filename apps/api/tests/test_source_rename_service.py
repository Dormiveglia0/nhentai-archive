import hashlib
import errno
import json
from pathlib import Path

import pytest

from app.services.archive_service import ArchiveService
from app.services.archive_cache_service import _version
from app.services.file_service import FileMaintenanceService
from app.services.reader_service import ReaderService
from app.services.source_rename_service import SourceRenameService, rename_without_replace, stamp
from test_library_index import setup_index, create_archive


def setup_rename(tmp_path):
    settings, db, libraries, index, root, library = setup_index(tmp_path)
    libraries.update(library['id'], {'read_only': False})
    source = root / 'book.cbz'
    create_archive(source)
    index.scan(library['id'])
    archive = ArchiveService(db, settings)
    files = FileMaintenanceService(db, settings, archive.cache)
    service = SourceRenameService(db, libraries, files, archive.cache)
    file = libraries.files(db.fetchone('SELECT id FROM works')['id'])[0]
    return db, libraries, index, root, library, source, service, file


def test_rename_keeps_identity_progress_and_scan_associations(tmp_path):
    db, libraries, index, root, library, source, service, file = setup_rename(tmp_path)
    before = hashlib.sha256(source.read_bytes()).hexdigest()
    db.execute('UPDATE works SET favorite=1 WHERE id=?', (file['work_id'],))
    db.execute("INSERT INTO work_metadata(work_id,field,value,source) VALUES (?,'summary','kept','manual')", (file['work_id'],))
    ReaderService(db).update_state(file['work_id'], page_index=1)
    progress = db.fetchone('SELECT * FROM reader_progress WHERE work_id=?', (file['work_id'],))
    cached_source = service.cache.direct_source(file['work_id'])
    assert service.rename(file['work_id'], file['id'], 'renamed.cbz', file['path'])['renamed']
    target = root / 'renamed.cbz'
    assert not source.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == before
    assert db.fetchone('SELECT * FROM library_items')['relative_path'] == 'renamed.cbz'
    assert libraries.files(file['work_id'])[0]['id'] == file['id']
    assert index.scan(library['id'])['counts']['unchanged'] == 1
    assert db.fetchone('SELECT COUNT(*) AS n FROM works')['n'] == 1
    assert db.fetchone('SELECT COUNT(*) AS n FROM library_items')['n'] == 1
    assert db.fetchone('SELECT favorite FROM works')['favorite'] == 1
    assert db.fetchone("SELECT value FROM work_metadata WHERE field='summary'")['value'] == 'kept'
    assert db.fetchone('SELECT * FROM reader_progress WHERE work_id=?', (file['work_id'],)) == progress
    current_source = service.cache.direct_source(file['work_id'])
    assert _version(current_source) == _version(cached_source)
    assert service.cache.revision(current_source) == service.cache.revision(cached_source)
    assert db.fetchone('SELECT state FROM source_renames')['state'] == 'completed'


@pytest.mark.parametrize('name', ['../out.cbz', 'other.zip', '.hidden.cbz', 'sub/next.cbz', '   '])
def test_rename_rejects_unsafe_names_and_preserves_source(tmp_path, name):
    db, libraries, index, root, library, source, service, file = setup_rename(tmp_path)
    original = source.read_bytes()
    with pytest.raises(ValueError):
        service.rename(file['work_id'], file['id'], name, file['path'])
    assert source.read_bytes() == original
    assert libraries.files(file['work_id'])[0]['path'] == file['path']


def test_rename_refuses_existing_target_and_read_only_library(tmp_path):
    db, libraries, index, root, library, source, service, file = setup_rename(tmp_path)
    target = root / 'existing.cbz'
    target.write_bytes(b'external file')
    with pytest.raises(ValueError, match='已存在'):
        service.rename(file['work_id'], file['id'], target.name, file['path'])
    assert target.read_bytes() == b'external file' and source.exists()
    libraries.update(library['id'], {'read_only': True})
    with pytest.raises((ValueError, OSError)):
        service.rename(file['work_id'], file['id'], 'next.cbz', file['path'])
    assert source.exists()


def test_rename_respects_relative_path_exclusions(tmp_path):
    db, libraries, index, root, library, source, service, file = setup_rename(tmp_path)
    (root / 'nested').mkdir()
    nested = root / 'nested' / source.name
    source.rename(nested)
    db.execute("UPDATE library_items SET relative_path='nested/book.cbz'")
    db.execute('UPDATE work_files SET path=? WHERE id=?', (str(nested), file['id']))
    libraries.update(library['id'], {'config': {'exclude_patterns': ['nested/next*']}})
    with pytest.raises(ValueError, match='排除规则'):
        service.rename(file['work_id'], file['id'], 'next.cbz', str(nested))
    assert nested.exists() and not (root / 'nested/next.cbz').exists()


def test_rename_database_failure_rolls_file_back(tmp_path, monkeypatch):
    db, libraries, index, root, library, source, service, file = setup_rename(tmp_path)
    def fail(record, connection=None):
        raise ValueError('simulated database failure')
    monkeypatch.setattr(service, '_commit', fail)
    with pytest.raises(ValueError, match='database failure'):
        service.rename(file['work_id'], file['id'], 'next.cbz', file['path'])
    assert source.exists() and not (root / 'next.cbz').exists()
    assert db.fetchone('SELECT state FROM source_renames')['state'] == 'cancelled'
    assert index.scan(library['id'])['counts']['unchanged'] == 1


@pytest.mark.parametrize('code', [errno.EINVAL, errno.EOPNOTSUPP, errno.ENOSYS])
def test_rename_commits_when_mount_does_not_support_directory_sync(tmp_path, monkeypatch, code):
    db, libraries, index, root, library, source, service, file = setup_rename(tmp_path)
    original = source.read_bytes()
    def unsupported(fd):
        raise OSError(code, 'directory sync unsupported')
    monkeypatch.setattr('app.services.source_rename_service.os.fsync', unsupported)
    service.rename(file['work_id'], file['id'], 'next.cbz', file['path'])
    assert not source.exists() and (root / 'next.cbz').read_bytes() == original
    assert db.fetchone('SELECT state FROM source_renames')['state'] == 'completed'
    assert libraries.files(file['work_id'])[0]['path'] == str(root / 'next.cbz')
    assert index.scan(library['id'])['counts']['unchanged'] == 1


def test_directory_sync_io_error_is_not_ignored(tmp_path, monkeypatch):
    db, libraries, index, root, library, source, service, file = setup_rename(tmp_path)
    def io_error(fd):
        raise OSError(errno.EIO, 'directory IO failure')
    monkeypatch.setattr('app.services.source_rename_service.os.fsync', io_error)
    with pytest.raises(ValueError, match='恢复未完成'):
        service.rename(file['work_id'], file['id'], 'next.cbz', file['path'])
    assert source.exists() and not (root / 'next.cbz').exists()
    assert db.fetchone('SELECT state FROM source_renames')['state'] == 'blocked'


def test_interrupted_rename_recovery_finishes_index_before_scanning(tmp_path):
    db, libraries, index, root, library, source, service, file = setup_rename(tmp_path)
    target = root / 'recovered.cbz'
    db.execute('INSERT INTO source_renames(work_id,file_id,item_id,library_id,old_path,new_path,version_json) VALUES (?,?,?,?,?,?,?)',
               (file['work_id'], file['id'], file['library_item_id'], library['id'], str(source), str(target), json.dumps(stamp(source))))
    rename_without_replace(source, target)
    with pytest.raises(OSError, match='未完成'):
        index.scan(library['id'])
    service.recover()
    service.recover()
    assert libraries.files(file['work_id'])[0]['path'] == str(target)
    assert index.scan(library['id'])['counts']['unchanged'] == 1
    assert db.fetchone('SELECT COUNT(*) AS n FROM library_items')['n'] == 1


def test_rename_does_not_wait_behind_scan_or_change_stale_source(tmp_path):
    db, libraries, index, root, library, source, service, file = setup_rename(tmp_path)
    with libraries._source_lock:
        with pytest.raises(ValueError, match='扫描或写入'):
            service.rename(file['work_id'], file['id'], 'next.cbz', file['path'])
    source.write_bytes(source.read_bytes() + b'changed')
    with pytest.raises(ValueError, match='变化'):
        service.rename(file['work_id'], file['id'], 'next.cbz', file['path'])
    assert source.exists()


def test_rename_rejects_active_reader_and_preserves_progress(tmp_path):
    db, libraries, index, root, library, source, service, file = setup_rename(tmp_path)
    db.execute("INSERT INTO reading_sessions(client_key,work_id) VALUES ('active-reader',?)", (file['work_id'],))
    with pytest.raises(PermissionError, match='阅读'):
        service.rename(file['work_id'], file['id'], 'next.cbz', file['path'])
    assert source.exists() and not (root / 'next.cbz').exists()
    assert db.fetchone('SELECT COUNT(*) AS n FROM source_renames')['n'] == 0


def test_reader_starting_after_initial_check_still_prevents_rename(tmp_path, monkeypatch):
    db, libraries, index, root, library, source, service, file = setup_rename(tmp_path)
    original = service.files._work_files
    def check(*args, **kwargs):
        result = original(*args, **kwargs)
        db.execute("INSERT INTO reading_sessions(client_key,work_id) VALUES ('new-reader',?)", (file['work_id'],))
        return result
    monkeypatch.setattr(service.files, '_work_files', check)
    with pytest.raises(PermissionError, match='阅读'):
        service.rename(file['work_id'], file['id'], 'next.cbz', file['path'])
    assert source.exists() and not (root / 'next.cbz').exists()
    assert db.fetchone('SELECT state FROM source_renames')['state'] == 'cancelled'


def test_rename_external_target_race_never_overwrites(tmp_path, monkeypatch):
    db, libraries, index, root, library, source, service, file = setup_rename(tmp_path)
    target = root / 'next.cbz'
    def collide(old, new):
        new.write_bytes(b'external file')
        rename_without_replace(old, new)
    monkeypatch.setattr('app.services.source_rename_service.rename_without_replace', collide)
    with pytest.raises(FileExistsError):
        service.rename(file['work_id'], file['id'], target.name, file['path'])
    assert source.exists() and target.read_bytes() == b'external file'
    assert libraries.files(file['work_id'])[0]['path'] == file['path']
    assert db.fetchone('SELECT state FROM source_renames')['state'] == 'cancelled'


def test_failed_rollback_blocks_scan_until_recovery(tmp_path, monkeypatch):
    db, libraries, index, root, library, source, service, file = setup_rename(tmp_path)
    target = root / 'next.cbz'
    def fail(record, connection=None):
        raise ValueError('database failure')
    def move_but_cannot_rollback(old, new):
        if old == target:
            raise OSError('mount unavailable')
        rename_without_replace(old, new)
    with monkeypatch.context() as patch:
        patch.setattr(service, '_commit', fail)
        patch.setattr('app.services.source_rename_service.rename_without_replace', move_but_cannot_rollback)
        with pytest.raises(ValueError, match='恢复未完成'):
            service.rename(file['work_id'], file['id'], target.name, file['path'])
    assert target.exists() and not source.exists()
    assert db.fetchone('SELECT state FROM source_renames')['state'] == 'blocked'
    with pytest.raises(OSError, match='未完成'):
        index.scan(library['id'])
    service.recover()
    assert libraries.files(file['work_id'])[0]['path'] == str(target)
    assert index.scan(library['id'])['counts']['unchanged'] == 1


def no_mount_rename(*args):
    raise OSError(errno.EINVAL, 'mount does not support RENAME_NOREPLACE')


def test_mount_rename_fallback_verifies_content_and_keeps_scan_identity(tmp_path, monkeypatch):
    db, libraries, index, root, library, source, service, file = setup_rename(tmp_path)
    original = source.read_bytes()
    item_id = file['library_item_id']
    ReaderService(db).update_state(file['work_id'], page_index=1)
    progress = db.fetchone('SELECT * FROM reader_progress')
    monkeypatch.setattr('app.services.source_rename_service.rename_without_replace', no_mount_rename)
    service.rename(file['work_id'], file['id'], 'mounted.cbz', file['path'])
    target = root / 'mounted.cbz'
    assert not source.exists() and target.read_bytes() == original
    assert libraries.files(file['work_id'])[0]['id'] == file['id']
    item = db.fetchone('SELECT * FROM library_items WHERE id=?', (item_id,))
    assert item['relative_path'] == target.name
    assert [item['size_bytes'], item['mtime_ns'], item['device'], item['inode']] == stamp(target)
    assert index.scan(library['id'])['counts']['unchanged'] == 1
    assert db.fetchone('SELECT COUNT(*) AS n FROM works')['n'] == 1
    assert db.fetchone('SELECT COUNT(*) AS n FROM library_items')['n'] == 1
    assert db.fetchone('SELECT * FROM reader_progress') == progress
    assert db.fetchone('SELECT state FROM source_renames')['state'] == 'completed'


def test_mount_rename_fallback_never_overwrites_a_racing_target(tmp_path, monkeypatch):
    import app.services.source_rename_service as module
    db, libraries, index, root, library, source, service, file = setup_rename(tmp_path)
    target = root / 'mounted.cbz'
    original = source.read_bytes()
    original_digest = module.digest
    def collide(path):
        value = original_digest(path)
        target.write_bytes(b'external file')
        return value
    monkeypatch.setattr(module, 'rename_without_replace', no_mount_rename)
    monkeypatch.setattr(module, 'digest', collide)
    with pytest.raises(FileExistsError):
        service.rename(file['work_id'], file['id'], target.name, file['path'])
    assert target.read_bytes() == b'external file' and source.read_bytes() == original
    assert libraries.files(file['work_id'])[0]['path'] == file['path']
    assert db.fetchone('SELECT state FROM source_renames')['state'] == 'cancelled'


def test_interrupted_mount_copy_keeps_original_and_blocks_unverified_target(tmp_path, monkeypatch):
    import app.services.source_rename_service as module
    db, libraries, index, root, library, source, service, file = setup_rename(tmp_path)
    original = source.read_bytes()
    def fail(src, dst, length):
        dst.write(b'incomplete copy')
        raise OSError(errno.EIO, 'copy interrupted')
    monkeypatch.setattr(module, 'rename_without_replace', no_mount_rename)
    monkeypatch.setattr(module.shutil, 'copyfileobj', fail)
    with pytest.raises(ValueError, match='恢复未完成'):
        service.rename(file['work_id'], file['id'], 'mounted.cbz', file['path'])
    assert source.read_bytes() == original
    assert (root / 'mounted.cbz').read_bytes() == b'incomplete copy'
    service.recover()
    assert source.read_bytes() == original
    assert db.fetchone('SELECT state FROM source_renames')['state'] == 'blocked'
    with pytest.raises(OSError, match='未完成'):
        index.scan(library['id'])


@pytest.mark.parametrize('after_unlink', [False, True])
def test_mount_copy_recovery_finishes_verified_move(tmp_path, monkeypatch, after_unlink):
    db, libraries, index, root, library, source, service, file = setup_rename(tmp_path)
    original = source.read_bytes()
    def fail(*args):
        raise OSError(errno.EIO, 'interrupted before index commit')
    with monkeypatch.context() as patch:
        patch.setattr('app.services.source_rename_service.rename_without_replace', no_mount_rename)
        patch.setattr(service, '_commit' if after_unlink else '_finish_copy', fail)
        with pytest.raises(ValueError, match='恢复未完成'):
            service.rename(file['work_id'], file['id'], 'mounted.cbz', file['path'])
    assert source.exists() is not after_unlink
    assert (root / 'mounted.cbz').read_bytes() == original
    service.recover()
    assert not source.exists()
    assert libraries.files(file['work_id'])[0]['path'] == str(root / 'mounted.cbz')
    assert db.fetchone('SELECT state FROM source_renames')['state'] == 'completed'
    assert index.scan(library['id'])['counts']['unchanged'] == 1
