from __future__ import annotations

import fnmatch
import json
import multiprocessing
import os
import re
import sqlite3
import stat
import threading
import time
from collections.abc import Callable, Iterator
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from app.config import Settings
from app.database import Database
from app.services.archive_manifest import inspect_archive, MountedArchiveProbe, MountUnavailable
from app.services.media_library_service import MediaLibraryService
from app.services.archive_service import clear_direct_thumbnails
from app.services.dictionary_service import normalize_key


ARCHIVES = {".cbz", ".zip"}
UNSUPPORTED = {".cbr", ".rar", ".7z", ".cb7", ".pdf"}
LANGUAGES = {"zh": "chinese", "zh-cn": "chinese", "zh-tw": "chinese", "ja": "japanese", "en": "english"}


def _mount_walk(connection, root: str, config: dict[str, Any], paths: list[str] | None) -> None:
    try:
        path = Path(root)
        canonical = MediaLibraryService.validate_root(path, config.get("_root_boundaries", []))
        connection.send(("root", (path.stat(), str(canonical))))
        for entry, info, error in LibraryIndexService._walk(path, config, paths):
            connection.send(("file", (str(entry), info, error)))
        connection.send(("done", None))
    except Exception as exc:
        connection.send(("error", (getattr(exc, "errno", None), str(exc)[:500])))
    finally:
        connection.close()


class LibraryIndexService:
    def __init__(self, settings: Settings, db: Database, libraries: MediaLibraryService):
        self.settings, self.db, self.libraries = settings, db, libraries
        self._scan_lock = threading.Lock()
        self._mount_probe: MountedArchiveProbe | None = None
        self._walk_process = None

    def recover_interrupted(self) -> int:
        with self.db.connect() as conn:
            conn.execute("""UPDATE media_libraries SET health = 'unknown' WHERE id IN
                         (SELECT library_id FROM library_scan_runs WHERE status = 'running')""")
            result = conn.execute("""UPDATE library_scan_runs SET status = 'interrupted', completed_at = CURRENT_TIMESTAMP,
                                  errors_json = '[{"path":"","reason":"应用重启，保留已完成索引，可重新扫描"}]'
                                  WHERE status = 'running'""")
        return result.rowcount

    def scan(self, library_id: int, checkpoint: Callable[[], None] | None = None,
             progress: Callable[[dict[str, int]], None] | None = None, job_id: int | None = None,
             paths: list[str] | None = None) -> dict[str, Any]:
        checkpoint = checkpoint or (lambda: None)
        # ponytail: one scanner bounds mount IO; add per-library locks if scans need parallelism.
        while not self._scan_lock.acquire(timeout=0.2):
            checkpoint()
        try:
            return self._scan(library_id, checkpoint, progress or (lambda counts: None), job_id, paths)
        finally:
            self._scan_lock.release()

    def _scan(self, library_id: int, checkpoint: Callable[[], None], progress: Callable[[dict[str, int]], None],
              job_id: int | None, paths: list[str] | None) -> dict[str, Any]:
        library = self.libraries.get(library_id)
        root, config = Path(library["root_path"]), library["config"]
        config["_root_boundaries"] = self.libraries.root_boundaries(library_id)
        counts = dict.fromkeys(("files", "indexed", "unchanged", "pending", "errors", "unsupported", "ignored", "missing"), 0)
        errors: list[dict[str, str]] = []
        run_id = self.db.execute("INSERT INTO library_scan_runs(library_id, job_id) VALUES (?, ?)", (library_id, job_id)).lastrowid
        completed_walk = True
        walker = None
        probe = None
        lookup = self.db.connect()
        seen: list[int] = []
        consecutive_timeouts = 0
        try:
            checkpoint()
            if library["kind"] == "mounted":
                if self._mount_probe is not None and not self._mount_probe.close():
                    raise MountUnavailable("挂载读取仍被系统阻塞，请恢复挂载后重试")
                probe = MountedArchiveProbe(root, config["follow_symlinks"], config["io_timeout_seconds"])
                self._mount_probe = probe
                walker = self._walk_mounted(root, config, checkpoint, paths)
                root_stat, canonical_root = next(walker)
            else:
                canonical_root = str(self.libraries.validate_root(root, config["_root_boundaries"]))
                root_stat = root.stat()
            if not stat.S_ISDIR(root_stat.st_mode):
                raise OSError("库根路径不是目录")
            root_changed = library["root_device"] is not None and (
                library["root_device"] != root_stat.st_dev or library["root_inode"] != root_stat.st_ino
            )
            entries = walker if walker is not None else self._walk(root, config, paths)
            selected = set(paths) if paths is not None else None
            checked_at = 0.0
            for path, info, error in entries:
                if time.monotonic() - checked_at >= 0.2:
                    checkpoint()
                    checked_at = time.monotonic()
                if error:
                    completed_walk = False
                    counts["errors"] += 1
                    if len(errors) < 30:
                        errors.append({"path": str(path.relative_to(root)), "reason": error})
                    continue
                if selected is not None and path.relative_to(root).as_posix() not in selected:
                    continue
                counts["files"] += 1
                suffix = path.suffix.lower()
                if suffix not in ARCHIVES | UNSUPPORTED:
                    counts["ignored"] += 1
                    continue
                try:
                    status = self._index_file(library, path, info, int(run_id), checkpoint, lookup, seen, probe)
                    counts[status] += 1
                    consecutive_timeouts = 0
                    if len(seen) >= 500:
                        self._mark_seen(seen, int(run_id))
                except Exception as exc:
                    # Cancellation is a whole-job control action, not a corrupt file.
                    from app.services.job_service import JobCancelled
                    if isinstance(exc, (JobCancelled, MountUnavailable)):
                        raise
                    counts["errors"] += 1
                    reason = str(exc)[:500]
                    self._error_item(library_id, path.relative_to(root).as_posix(), reason)
                    if len(errors) < 30:
                        errors.append({"path": str(path.relative_to(root)), "reason": reason})
                    consecutive_timeouts = consecutive_timeouts + 1 if isinstance(exc, TimeoutError) else 0
                    if consecutive_timeouts >= 3:
                        raise TimeoutError("挂载源连续三次读取超时，已停止本轮扫描并保留索引") from exc
                progress(dict(counts))
            self._mark_seen(seen, int(run_id))
            previous_count = self.db.fetchone("SELECT COUNT(*) AS n FROM library_items WHERE library_id = ? AND work_id IS NOT NULL", (library_id,))["n"]
            # A vanished mount often looks like a valid empty directory. Never purge it.
            if selected is None and library["kind"] == "mounted" and previous_count and counts["files"] == counts["ignored"] + counts["unsupported"]:
                completed_walk = False
                errors.append({"path": "", "reason": "挂载目录暂时为空，保留已有作品"})
            if selected is None and completed_walk and not root_changed:
                now = time.time()
                cursor = self.db.execute(
                    """UPDATE library_items SET status = 'missing', missing_since = COALESCE(missing_since, ?),
                    updated_at = CURRENT_TIMESTAMP WHERE library_id = ? AND COALESCE(last_seen_run_id, 0) <> ?
                    AND status NOT IN ('missing', 'detached')""", (now, library_id, run_id),
                )
                counts["missing"] = cursor.rowcount
            health = "online" if completed_walk else ("offline" if not counts["files"] else "partial")
            self.db.execute(
                """UPDATE media_libraries SET health = ?, last_error = ?, root_device = ?, root_inode = ?, resolved_root_path = ?,
                last_scan_at = CURRENT_TIMESTAMP WHERE id = ?""",
                (health, errors[0]["reason"] if errors else None, root_stat.st_dev, root_stat.st_ino, canonical_root, library_id),
            )
            status = "completed" if completed_walk else "partial"
        except Exception as exc:
            from app.services.job_service import JobCancelled
            status = "cancelled" if isinstance(exc, JobCancelled) else "failed"
            if len(errors) < 30:
                errors.append({"path": "", "reason": str(exc)[:500]})
            self.db.execute("UPDATE media_libraries SET health = ?, last_error = ? WHERE id = ?",
                            ("unknown" if status == "cancelled" else "offline", str(exc)[:500], library_id))
            raise
        finally:
            lookup.close()
            if probe is not None:
                probe.close()
            if walker is not None:
                walker.close()
            self.db.execute(
                """UPDATE library_scan_runs SET status = ?, counts_json = ?, errors_json = ?,
                completed_at = CURRENT_TIMESTAMP WHERE id = ?""",
                (status, json.dumps(counts), json.dumps(errors, ensure_ascii=False), run_id),
            )
        return {"run_id": run_id, "library_id": library_id, "status": status, "counts": counts, "errors": errors}

    def _mark_seen(self, seen: list[int], run_id: int) -> None:
        if seen:
            with self.db.connect() as conn:
                conn.executemany("UPDATE library_items SET last_seen_run_id = ?, missing_since = NULL WHERE id = ?",
                                 ((run_id, item_id) for item_id in seen))
            seen.clear()

    def _walk_mounted(self, root: Path, config: dict[str, Any], checkpoint, paths: list[str] | None):
        if self._walk_process is not None and self._walk_process.is_alive():
            raise MountUnavailable("挂载目录仍被系统阻塞，请恢复挂载后重试")
        context = multiprocessing.get_context("spawn")
        receive, send = context.Pipe(duplex=False)
        process = context.Process(target=_mount_walk, args=(send, str(root), config, paths), daemon=True)
        process.start()
        self._walk_process = process
        send.close()
        try:
            while True:
                deadline = time.monotonic() + config["io_timeout_seconds"]
                while not receive.poll(0.2):
                    before_checkpoint = time.monotonic()
                    checkpoint()
                    deadline += time.monotonic() - before_checkpoint
                    if time.monotonic() > deadline:
                        raise TimeoutError("挂载目录读取超时，保留已有索引")
                try:
                    kind, value = receive.recv()
                except EOFError as exc:
                    raise OSError("挂载目录扫描进程已中断") from exc
                if kind == "done":
                    return
                if kind == "error":
                    raise OSError(*value)
                if kind == "root":
                    yield value
                else:
                    path, info, error = value
                    yield Path(path), info, error
        finally:
            receive.close()
            if process.is_alive():
                process.terminate()
            process.join(1)
            if process.is_alive():
                process.kill()
                process.join(1)
            if not process.is_alive():
                self._walk_process = None

    @staticmethod
    def _walk(root: Path, config: dict[str, Any], paths: list[str] | None = None) -> Iterator[tuple[Path, Any, str | None]]:
        if paths is not None:
            for relative in paths:
                path = root / relative
                try:
                    source = MediaLibraryService.source_path(root, relative, config["follow_symlinks"])
                    info = source.stat()
                    if stat.S_ISREG(info.st_mode):
                        yield path, info, None
                except (OSError, ValueError) as exc:
                    yield path, None, str(exc)[:500]
            return
        directories, visited = [root], set()
        while directories:
            directory = directories.pop()
            try:
                info = directory.stat()
                canonical = (info.st_dev, info.st_ino) if info.st_ino else str(directory.resolve())
                if canonical in visited:
                    continue
                visited.add(canonical)
                with os.scandir(directory) as entries:
                    for entry in entries:
                        relative = Path(entry.path).relative_to(root).as_posix()
                        if (not config["include_hidden"] and entry.name.startswith(".")) or any(
                            fnmatch.fnmatch(entry.name, pattern) or fnmatch.fnmatch(relative, pattern)
                            for pattern in config["exclude_patterns"]
                        ):
                            continue
                        try:
                            if entry.is_symlink():
                                if not config["follow_symlinks"]:
                                    continue
                                target = Path(entry.path).resolve()
                                if target != root.resolve() and root.resolve() not in target.parents:
                                    yield Path(entry.path), None, "符号链接指向目录库外，已跳过"
                                    continue
                            info = entry.stat(follow_symlinks=config["follow_symlinks"])
                            if stat.S_ISDIR(info.st_mode) and config["recursive"]:
                                directories.append(Path(entry.path))
                            elif stat.S_ISREG(info.st_mode):
                                yield Path(entry.path), info, None
                        except OSError as exc:
                            yield Path(entry.path), None, str(exc)[:500]
            except OSError as exc:
                yield directory, None, str(exc)[:500]

    def _index_file(self, library: dict[str, Any], path: Path, info: os.stat_result, run_id: int,
                    checkpoint: Callable[[], None], lookup: sqlite3.Connection, seen: list[int], probe: MountedArchiveProbe | None) -> str:
        relative = path.relative_to(library["root_path"]).as_posix()
        row = lookup.execute("""SELECT id, work_id, size_bytes, mtime_ns, device, inode, stable_since, status, retry_at
                              FROM library_items WHERE library_id = ? AND relative_path = ?""", (library["id"], relative)).fetchone()
        existing = dict(row) if row else None
        if existing is None and info.st_ino and library["kind"] != "mounted":
            previous = lookup.execute(
                """SELECT * FROM library_items WHERE library_id = ? AND device = ? AND inode = ?
                AND size_bytes = ? AND mtime_ns = ? AND status = 'ready' AND work_id IS NOT NULL LIMIT 1""",
                (library["id"], info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns),
            ).fetchone()
            if previous:
                previous = dict(previous)
                try:
                    (Path(library["root_path"]) / previous["relative_path"]).stat()
                except FileNotFoundError:
                    location = f"library/{relative}" if library["kind"] == "managed" else str(path)
                    with self.db.connect() as conn:
                        conn.execute("UPDATE library_items SET relative_path = ? WHERE id = ?", (relative, previous["id"]))
                        conn.execute("UPDATE work_files SET path = ? WHERE library_item_id = ?", (location, previous["id"]))
                    existing = previous
        now = time.time()
        same = existing and (existing["size_bytes"], existing["mtime_ns"], existing["device"], existing["inode"]) == (info.st_size, info.st_mtime_ns, info.st_dev, info.st_ino)
        if same and (existing["status"] == "ready" and existing["work_id"] is not None or existing["status"] == "unsupported" or
                     existing["status"] == "error" and (existing["retry_at"] or 0) > now):
            seen.append(existing["id"])
            return {"ready": "unchanged", "unsupported": "unsupported", "error": "errors"}[existing["status"]]
        stable_since = existing["stable_since"] if same else now
        with self.db.connect() as conn:
            row = conn.execute(
                """INSERT INTO library_items(library_id, relative_path, size_bytes, mtime_ns, device, inode, stable_since, last_seen_run_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(library_id, relative_path) DO UPDATE SET
                size_bytes = excluded.size_bytes, mtime_ns = excluded.mtime_ns, device = excluded.device, inode = excluded.inode,
                stable_since = excluded.stable_since, last_seen_run_id = excluded.last_seen_run_id, status = 'pending',
                missing_since = NULL, updated_at = CURRENT_TIMESTAMP RETURNING id""",
                (library["id"], relative, info.st_size, info.st_mtime_ns, info.st_dev, info.st_ino, stable_since, run_id),
            ).fetchone()
            item_id = int(row["id"])
        if path.suffix.lower() in UNSUPPORTED:
            self.db.execute("UPDATE library_items SET status = 'unsupported', last_error = ? WHERE id = ?",
                            ("暂不支持该归档格式", item_id))
            return "unsupported"
        if now - stable_since < library["config"]["stable_seconds"]:
            return "pending"
        checkpoint()
        expected = (info.st_size, info.st_mtime_ns, info.st_dev, info.st_ino)
        if library["kind"] == "mounted":
            source = path
            data = probe.inspect(relative, checkpoint)
            after_version = data.pop("after")
            before_version = data.pop("before")
        else:
            source = self.libraries.source_path(Path(library["root_path"]), relative, library["config"]["follow_symlinks"])
            before_version = expected
            data = inspect_archive(source)
            after = source.stat()
            after_version = (after.st_size, after.st_mtime_ns, after.st_dev, after.st_ino)
        checkpoint()
        if before_version != expected or after_version != expected:
            self.db.execute("UPDATE library_items SET status = 'pending', stable_since = ? WHERE id = ?", (time.time(), item_id))
            return "pending"
        work_id = self._persist(library, item_id, source, info, data, existing.get("work_id") if existing else None)
        return "indexed" if work_id else "errors"

    def _persist(self, library: dict[str, Any], item_id: int, source: Path, info: os.stat_result,
                 data: dict[str, Any], work_id: int | None) -> int:
        metadata = data["metadata"]
        title = metadata.get("Title") or source.stem
        language = LANGUAGES.get(str(metadata.get("LanguageISO", "")).lower())
        gallery_id = metadata.get("gallery_id") if library["config"]["auto_bind"] else None
        # Strict binding needs verified remote language, not just the CBZ language.
        if library["config"]["language_mode"] == "strict":
            gallery_id = None
        owned = f"library/{source.relative_to(library['root_path']).as_posix()}" if library["kind"] == "managed" else str(source)
        legacy = self.db.fetchone("SELECT * FROM work_files WHERE kind = 'source_cbz' AND path IN (?, ?) LIMIT 1", (str(source), owned))
        if not work_id and legacy:
            work_id = int(legacy["work_id"])
        if not work_id and gallery_id:
            linked = self.db.fetchone("SELECT id, page_count, language FROM works WHERE remote_gallery_id = ?", (gallery_id,))
            if linked:
                if (linked["page_count"] and linked["page_count"] != data["page_count"]) or (
                    language and linked["language"] and language != linked["language"]
                ):
                    data["warnings"].append("已有远端绑定作品的页数或语言不符，未自动合并")
                    gallery_id = None
                else:
                    work_id = int(linked["id"])
        if not work_id and metadata.get("Title"):
            # Header identity avoids full-CBZ hashing; ambiguous matches stay separate.
            matches = self.db.fetchall(
                """SELECT DISTINCT w.id FROM library_items i JOIN works w ON w.id = i.work_id
                WHERE i.fingerprint = ? AND i.status = 'ready' AND json_extract(i.metadata_json, '$.Title') = ?
                AND w.remote_gallery_id IS ? AND COALESCE(w.language, '') = ? LIMIT 2""",
                (data["fingerprint"], metadata["Title"], gallery_id, language or ""),
            )
            if len(matches) == 1:
                work_id = int(matches[0]["id"])
        cover_tmp = None
        try:
            with NamedTemporaryFile(dir=self.settings.covers_dir, prefix=".index-", suffix=".jpg", delete=False) as temporary:
                temporary.write(data["cover"])
                cover_tmp = Path(temporary.name)
            with self.db.connect() as conn:
                conn.execute("BEGIN IMMEDIATE")
                current = conn.execute("SELECT size_bytes, mtime_ns, device, inode FROM library_items WHERE id = ?", (item_id,)).fetchone()
                if not current or tuple(current) != (info.st_size, info.st_mtime_ns, info.st_dev, info.st_ino):
                    raise ValueError("源文件版本在索引写入前变化，将稍后重试")
                if not work_id:
                    work_id = int(conn.execute(
                        """INSERT INTO works(title, title_japanese, pretty_title, source, remote, remote_gallery_id, language, page_count)
                        VALUES (?, ?, ?, 'local', ?, ?, ?, ?) RETURNING id""",
                        (title, metadata.get("AlternateSeries"), metadata.get("LocalizedSeries"),
                         "nhentai" if gallery_id else None, gallery_id, language, data["page_count"]),
                    ).fetchone()["id"])
                destination = self.settings.covers_dir / f"{work_id}-indexed.jpg"
                cover_tmp.replace(destination)
                conn.execute(
                    """UPDATE library_items SET work_id = ?, status = 'ready', fingerprint = ?, manifest = ?, metadata_json = ?, archive_info_json = ?,
                    retry_count = 0, retry_at = NULL, last_error = ?, indexed_at = CURRENT_TIMESTAMP,
                    scrape_status = 'pending', scrape_retry_at = 0, scrape_attempts = 0, scrape_result_json = NULL WHERE id = ?""",
                    (work_id, data["fingerprint"], data["manifest"], json.dumps(metadata, ensure_ascii=False), json.dumps(data["archive_info"], ensure_ascii=False),
                     "; ".join(data.get("warnings", []))[:500] or None, item_id),
                )
                if legacy and legacy.get("library_item_id") is None:
                    conn.execute("UPDATE work_files SET library_item_id = ? WHERE id = ?", (item_id, legacy["id"]))
                else:
                    conn.execute(
                        """INSERT INTO work_files(work_id, kind, path, size_bytes, library_item_id)
                        VALUES (?, 'source_cbz', ?, ?, ?) ON CONFLICT(library_item_id) WHERE library_item_id IS NOT NULL
                        DO UPDATE SET path = excluded.path, size_bytes = excluded.size_bytes""",
                        (work_id, owned, info.st_size, item_id),
                    )
                conn.execute(
                    "UPDATE works SET cover_path = ?, page_count = ?, language = COALESCE(language, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (self.db.managed_path(destination), data["page_count"], language, work_id),
                )
                for field, key in (("title", "Title"), ("artist", "Writer"), ("group", "Publisher"), ("language", "LanguageISO"), ("summary", "Summary")):
                    if metadata.get(key):
                        conn.execute(
                            """INSERT INTO work_metadata(work_id, field, value, source, source_value) VALUES (?, ?, ?, 'comicinfo', ?)
                            ON CONFLICT(work_id, field) DO UPDATE SET source_value = excluded.source_value,
                            value = CASE WHEN work_metadata.source = 'comicinfo' THEN excluded.value ELSE work_metadata.value END""",
                            (work_id, field, metadata[key], metadata[key]),
                        )
                    else:
                        conn.execute(
                            """UPDATE work_metadata SET source_value = NULL,
                            value = CASE WHEN source = 'comicinfo' THEN NULL ELSE value END
                            WHERE work_id = ? AND field = ?""", (work_id, field),
                        )
                conn.execute(
                    """UPDATE works SET title = ? WHERE id = ? AND remote_gallery_id IS NULL AND NOT EXISTS
                    (SELECT 1 FROM work_metadata WHERE work_id = works.id AND field = 'title' AND source <> 'comicinfo')""",
                    (title, work_id),
                )
                conn.execute("DELETE FROM work_tags WHERE work_id = ? AND source = 'comicinfo'", (work_id,))
                for tag_type, key in (("artist", "Writer"), ("group", "Publisher"), ("tag", "Tags")):
                    names = list(dict.fromkeys(value.strip() for value in re.split(r"[,，;；]", metadata.get(key) or "") if value.strip()))[:200]
                    for name in names:
                        mapped = conn.execute(
                            "SELECT id, remote_tag_id FROM local_tag_dictionary WHERE normalized_key = ? AND tag_type = ? AND ignored = 0",
                            (normalize_key(name), tag_type),
                        ).fetchone()
                        conn.execute(
                            """INSERT OR IGNORE INTO work_tags(work_id, remote_tag_id, dictionary_id, tag_type, remote_name, remote_slug, source)
                            VALUES (?, ?, ?, ?, ?, ?, 'comicinfo')""",
                            (work_id, mapped["remote_tag_id"] if mapped else None, mapped["id"] if mapped else None, tag_type, name, normalize_key(name)),
                        )
            clear_direct_thumbnails(self.settings, work_id)
            return work_id
        finally:
            if cover_tmp:
                cover_tmp.unlink(missing_ok=True)

    def _error_item(self, library_id: int, relative: str, reason: str) -> None:
        self.db.execute(
            """UPDATE library_items SET status = 'error', last_error = ?, retry_count = retry_count + 1,
            retry_at = ? + MIN(3600, 30 * (1 << MIN(retry_count, 6))) WHERE library_id = ? AND relative_path = ?""",
            (reason, time.time(), library_id, relative),
        )
