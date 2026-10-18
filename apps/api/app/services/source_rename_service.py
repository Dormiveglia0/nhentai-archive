from __future__ import annotations

import ctypes
import errno
import json
import os
import stat
from pathlib import Path
from contextlib import contextmanager, nullcontext

from app.services.file_identity import sqlite_file_id


def rename_without_replace(source: Path, target: Path) -> None:
    """Linux renameat2 preserves the target even if another process creates it."""
    libc = ctypes.CDLL(None, use_errno=True)
    rename = getattr(libc, 'renameat2', None)
    if rename is None:
        raise OSError('当前系统不支持安全重命名')
    rename.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    rename.restype = ctypes.c_int
    parent = os.open(source.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        if rename(parent, os.fsencode(source.name), parent, os.fsencode(target.name), 1):
            code = ctypes.get_errno()
            if code == errno.EEXIST:
                raise FileExistsError('目标文件已存在，未覆盖')
            raise OSError(code, os.strerror(code))
        os.fsync(parent)
    finally:
        os.close(parent)


def stamp(path):
    info = path.stat()
    if not stat.S_ISREG(info.st_mode) or path.is_symlink():
        raise ValueError('只能重命名普通归档文件')
    return [info.st_size, info.st_mtime_ns, sqlite_file_id(info.st_dev), sqlite_file_id(info.st_ino)]


class SourceRenameService:
    def __init__(self, db, libraries, files, cache):
        self.db, self.libraries, self.files, self.cache = db, libraries, files, cache

    @contextmanager
    def _locked(self):
        with self.cache._lock:
            if not self.libraries._source_lock.acquire(blocking=False):
                raise ValueError('媒体库正在扫描或写入，请结束后再重命名')
            try:
                yield
            finally:
                self.libraries._source_lock.release()

    def rename(self, work_id, file_id, name, expected_path):
        if not name or name != name.strip() or name in {'.', '..'} or any(c in name for c in '/\\\x00\r\n') or len(os.fsencode(name)) > 255:
            raise ValueError('请输入不含路径的文件名，长度不能超过255字节')
        with self._locked():
            self.files._work_files(work_id, keep_sources=True)
            row = next((row for row in self.libraries.files(work_id) if row['id'] == file_id and row['kind'] == 'source_cbz'), None)
            if not row or row['path'] != expected_path:
                raise ValueError('源文件关联已变化，请刷新后重试')
            source = self.libraries.resolve_file(row, for_write=True, action='rename')
            if Path(row['path']) != source:
                raise ValueError('符号链接来源不能直接重命名，请先使用真实文件路径')
            library_id = row['library_id'] or self.db.fetchone("SELECT id FROM media_libraries WHERE kind='managed'")['id']
            self.libraries._require_idle(library_id)
            if self.db.fetchone("SELECT 1 FROM source_renames WHERE library_id=? AND state IN ('prepared','blocked')", (library_id,)):
                raise ValueError('此库有未完成的重命名，请先处理恢复记录')
            if self.db.fetchone("SELECT 1 FROM work_files WHERE work_id<>? AND path IN (?,?)", (work_id, str(source), self.db.managed_path(source))):
                raise ValueError('文件被其他作品共享引用，不能重命名')
            if Path(name).suffix.lower() != source.suffix.lower():
                raise ValueError('重命名不能改变归档扩展名')
            if name == source.name:
                return {'renamed': False, 'path': str(source)}
            library = self.libraries.get(library_id)
            if name.startswith('.') and not library['config']['include_hidden']:
                raise ValueError('此库不扫描隐藏文件，不能使用点开头的文件名')
            import fnmatch
            target = source.with_name(name)
            relative = target.relative_to(Path(library['root_path']).resolve()).as_posix()
            if any(fnmatch.fnmatch(name, pattern) or fnmatch.fnmatch(relative, pattern) for pattern in library['config']['exclude_patterns']):
                raise ValueError('新文件名会被媒体库排除规则忽略')
            if self.db.fetchone('SELECT 1 FROM library_items WHERE library_id=? AND relative_path=?', (library_id, relative)):
                raise ValueError('新文件名已有扫描记录，请先处理该记录')
            version = stamp(source)
            if row['library_item_id'] and version != [row['size_bytes'], row['mtime_ns'], row['device'], row['inode']]:
                raise ValueError('源文件已变化，请先重新扫描')
            if target.exists() or target.is_symlink():
                raise ValueError('目标文件已存在，未覆盖')
            with self.db.connect() as conn:
                conn.execute('PRAGMA synchronous=FULL')
                record_id = conn.execute('''INSERT INTO source_renames(work_id,file_id,item_id,library_id,old_path,new_path,version_json)
                    VALUES (?,?,?,?,?,?,?)''', (work_id, file_id, row['library_item_id'], library_id, str(source), str(target), json.dumps(version))).lastrowid
            moved = False
            try:
                with self.db.connect() as conn:
                    conn.execute('PRAGMA synchronous=FULL')
                    conn.execute('BEGIN IMMEDIATE')
                    self.files._work_files(work_id, keep_sources=True, except_rename_id=record_id)
                    current = next((value for value in self.libraries.files(work_id) if value['id'] == file_id), None)
                    if not current or self.libraries.resolve_file(current, for_write=True, action='rename') != source or stamp(source) != version:
                        raise ValueError('源文件或权限已变化，请刷新后重试')
                    rename_without_replace(source, target)
                    moved = True
                    record = dict(conn.execute('SELECT * FROM source_renames WHERE id=?', (record_id,)).fetchone())
                    self._commit(record, conn)
            except Exception as exc:
                # If fsync failed, the rename may already have taken effect.
                if moved or (not source.exists() and target.exists() and stamp(target) == version):
                    try:
                        rename_without_replace(target, source)
                    except OSError as rollback:
                        self.db.execute("UPDATE source_renames SET state='blocked', error=? WHERE id=?", (f'{exc}; 回滚失败: {rollback}', record_id))
                        raise ValueError(f'重命名恢复未完成，记录 #{record_id}；原文件内容已保留') from exc
                self.db.execute("UPDATE source_renames SET state='cancelled',error=? WHERE id=?", (str(exc), record_id))
                raise
            return {'renamed': True, 'path': str(target), 'file_id': file_id, 'work_id': work_id}

    def _commit(self, record, connection=None):
        target, source = Path(record['new_path']), Path(record['old_path'])
        library = self.libraries.get(record['library_id'])
        root = self.libraries.validate_root(Path(library['root_path']), self.libraries.root_boundaries(library['id']))
        if target.parent != source.parent or root not in target.resolve().parents or source.exists() or stamp(target) != json.loads(record['version_json']):
            raise ValueError('文件状态与重命名记录不一致，保留文件等待人工处理')
        location = self.db.managed_path(target) if library['kind'] == 'managed' else str(target)
        with nullcontext(connection) if connection is not None else self.db.connect() as conn:
            if not conn.in_transaction:
                conn.execute('PRAGMA synchronous=FULL')
                conn.execute('BEGIN IMMEDIATE')
            row = conn.execute('SELECT work_id,path,library_item_id FROM work_files WHERE id=?', (record['file_id'],)).fetchone()
            if not row or row['work_id'] != record['work_id'] or row['library_item_id'] != record['item_id'] or row['path'] not in {str(source), self.db.managed_path(source)}:
                raise ValueError('重命名前的文件关联已变化')
            if record['item_id']:
                conn.execute('UPDATE library_items SET relative_path=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', (target.relative_to(root).as_posix(), record['item_id']))
            conn.execute('UPDATE work_files SET path=? WHERE work_id=? AND path IN (?,?)', (location, record['work_id'], str(source), self.db.managed_path(source)))
            conn.execute('DELETE FROM library_changes WHERE library_id=? AND relative_path=?', (library['id'], source.relative_to(root).as_posix()))
            conn.execute('UPDATE works SET updated_at=CURRENT_TIMESTAMP WHERE id=?', (record['work_id'],))
            conn.execute("UPDATE source_renames SET state='completed',error=NULL,completed_at=CURRENT_TIMESTAMP WHERE id=?", (record['id'],))

    def recover(self):
        with self.cache._lock, self.libraries._source_lock:
            for record in self.db.fetchall("SELECT * FROM source_renames WHERE state IN ('prepared','blocked') ORDER BY id"):
                try:
                    source, target = Path(record['old_path']), Path(record['new_path'])
                    if source.exists() and not target.exists() and stamp(source) == json.loads(record['version_json']):
                        self.db.execute("UPDATE source_renames SET state='cancelled',error='重命名未执行，保留原路径' WHERE id=?", (record['id'],))
                    else:
                        self._commit(record)
                except (OSError, ValueError) as exc:
                    self.db.execute("UPDATE source_renames SET state='blocked',error=? WHERE id=?", (str(exc), record['id']))
