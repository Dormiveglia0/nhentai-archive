from __future__ import annotations

import fnmatch
import json
import logging
import threading
import time
from pathlib import Path

from watchfiles import Change, watch

from app.services.job_service import JobCancelled
from app.services.library_index_service import ARCHIVES, UNSUPPORTED, LibraryIndexService
from app.services.media_library_service import LIBRARY_DEFAULTS, MediaLibraryService


class LibraryMonitorService:
    def __init__(self, index: LibraryIndexService, libraries: MediaLibraryService):
        self.index, self.libraries, self.db = index, libraries, libraries.db
        self._closing = threading.Event()
        self._thread = None
        self._watchers = {}
        self._snapshots = {}

    def _active(self):
        rows = self.db.fetchall("SELECT * FROM media_libraries WHERE enabled = 1 AND removed_at IS NULL")
        return [{**row, "config": {**LIBRARY_DEFAULTS, **json.loads(row["config_json"])}} for row in rows
                if json.loads(row["config_json"]).get("watch", True)]

    def changed(self, library_id: int, paths: list[str] | None, root: str | None = None):
        due_at = time.time() + 1
        with self.db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            library = conn.execute("SELECT * FROM media_libraries WHERE id = ?", (library_id,)).fetchone()
            if not library or not library["enabled"] or library["removed_at"] or not json.loads(library["config_json"]).get("watch", True):
                return
            if root and root != library["root_path"]:
                return
            full = paths is None or conn.execute("SELECT 1 FROM library_changes WHERE library_id = ? AND relative_path = ''", (library_id,)).fetchone()
            if not full:
                conn.executemany("INSERT INTO library_changes VALUES (?, ?, ?) ON CONFLICT(library_id, relative_path) "
                                 "DO UPDATE SET due_at = excluded.due_at", ((library_id, path, due_at) for path in paths))
                full = conn.execute("SELECT COUNT(*) FROM library_changes WHERE library_id = ?", (library_id,)).fetchone()[0] > 5000
            if full:
                conn.execute("DELETE FROM library_changes WHERE library_id = ?", (library_id,))
                conn.execute("INSERT INTO library_changes VALUES (?, '', ?)", (library_id, due_at))
            conn.execute("UPDATE media_libraries SET scan_failures = 0 WHERE id = ?", (library_id,))

    def _watch(self, library, stop):
        library_id, root, config = library["id"], Path(library["root_path"]), library["config"]
        try:
            canonical = self.libraries.validate_root(root, self.libraries.root_boundaries(library_id))
            # Mounted roots only use the bounded scanner; native events are for local filesystems.
            for changes in watch(root, watch_filter=None, stop_event=stop, debounce=250, step=50,
                                 rust_timeout=500, yield_on_timeout=True, force_polling=False,
                                 poll_delay_ms=config["scan_interval_seconds"] * 1000, recursive=config["recursive"]):
                self.db.execute("UPDATE media_libraries SET watch_error = NULL WHERE id = ? AND watch_error IS NOT NULL", (library_id,))
                paths, full = [], False
                for change, value in changes:
                    path = Path(value)
                    try:
                        relative = path.relative_to(root) if path.is_relative_to(root) else path.relative_to(canonical)
                    except ValueError:
                        continue
                    if (not config["include_hidden"] and any(part.startswith(".") for part in relative.parts)) or any(
                        fnmatch.fnmatch(part, pattern) or fnmatch.fnmatch(relative.as_posix(), pattern)
                        for part in relative.parts for pattern in config["exclude_patterns"]
                    ):
                        continue
                    if change == Change.deleted:
                        full = full or relative == Path(".") or path.suffix.lower() in ARCHIVES | UNSUPPORTED or bool(self.db.fetchone(
                            "SELECT 1 FROM library_items WHERE library_id = ? AND (relative_path = ? OR relative_path GLOB ?) LIMIT 1",
                            (library_id, relative.as_posix(), relative.as_posix().replace("[", "[[]").replace("*", "[*]").replace("?", "[?]") + "/*")))
                    elif path.is_dir():
                        full = True
                    elif path.suffix.lower() in ARCHIVES | UNSUPPORTED:
                        paths.append(relative.as_posix())
                if full or paths:
                    self.changed(library_id, None if full else paths, str(root))
        except (OSError, ValueError, RuntimeError) as exc:
            if not stop.is_set():
                self.db.execute("UPDATE media_libraries SET watch_error = ? WHERE id = ?", (str(exc)[:500], library_id))

    def _sync_watchers(self, libraries):
        local = {row["id"]: row for row in libraries if row["kind"] != "mounted"}
        for library_id, (signature, stop, thread, _retry) in list(self._watchers.items()):
            row = local.get(library_id)
            if not row or stop.is_set() or signature != (row["root_path"], row["config_json"]):
                stop.set()
                if not thread.is_alive():
                    self._watchers.pop(library_id)
        for library_id, row in local.items():
            existing = self._watchers.get(library_id)
            if existing and (existing[2].is_alive() or existing[3] > time.monotonic()):
                continue
            stop = threading.Event()
            thread = threading.Thread(target=self._watch, args=(row, stop), daemon=True)
            self._watchers[library_id] = ((row["root_path"], row["config_json"]), stop, thread, time.monotonic() + 60)
            thread.start()

    def tick(self):
        libraries = self._active()
        active_ids = {library["id"] for library in libraries}
        self._snapshots = {key: value for key, value in self._snapshots.items() if key in active_ids}
        self._sync_watchers(libraries)
        now = time.time()
        for library in libraries:
            library_id, config = library["id"], library["config"]
            if library["scan_failures"] and library["next_scan_at"] > now:
                continue
            events = self.db.fetchall("SELECT relative_path, due_at FROM library_changes WHERE library_id = ? AND due_at <= ?", (library_id, now))
            due = bool(events)
            periodic = library["next_scan_at"] <= now
            if self.db.fetchone("""SELECT 1 FROM jobs j, json_each(j.target_json, '$.plan') p
                WHERE j.type='library_migration' AND j.status IN ('queued','running','paused','cancelling')
                AND (json_extract(j.target_json, '$.library_id')=? OR json_extract(p.value, '$.source_library_id')=?) LIMIT 1""", (library_id, library_id)):
                continue
            if not (due or periodic) or self.db.fetchone("""SELECT 1 FROM jobs WHERE type = 'library_scan'
                AND status IN ('queued', 'running', 'paused', 'cancelling')
                AND json_extract(target_json, '$.library_id') = ? LIMIT 1""", (library_id,)):
                continue
            paths = None if any(row["relative_path"] == "" for row in events) else [row["relative_path"] for row in events]
            claimed_at = now
            self.db.execute("UPDATE media_libraries SET next_scan_at = ? WHERE id = ?", (now + config["scan_interval_seconds"], library_id))
            def checkpoint():
                current = self.db.fetchone("SELECT enabled, removed_at, config_json FROM media_libraries WHERE id = ?", (library_id,))
                if self._closing.is_set() or not current or not current["enabled"] or current["removed_at"] or current["config_json"] != library["config_json"]:
                    raise JobCancelled()
            try:
                snapshot, refresh_paths = None, []
                if periodic:
                    snapshot, changed_paths, refresh_paths = self.index.changes(library_id, self._snapshots.get(library_id), checkpoint)
                    paths = None if changed_paths is None or paths is None else sorted(set(paths) | set(changed_paths))
                    if paths == []:
                        self._snapshots[library_id] = snapshot
                        self.db.execute("UPDATE media_libraries SET scan_failures=0,next_scan_at=? WHERE id=?", (time.time() + config["scan_interval_seconds"], library_id))
                        continue
                result = self.index.scan(library_id, checkpoint, paths=paths, refresh_paths=refresh_paths)
                if result["status"] != "completed":
                    raise OSError(library["last_error"] or "目录暂时不可用，稍后重试")
                if snapshot is not None:
                    self._snapshots[library_id] = snapshot
                with self.db.connect() as conn:
                    conn.execute("DELETE FROM library_changes WHERE library_id = ? AND due_at <= ?", (library_id, claimed_at))
                    conn.execute("UPDATE media_libraries SET scan_failures = 0, next_scan_at = ? WHERE id = ?", (time.time() + config["scan_interval_seconds"], library_id))
                    retries = conn.execute("""SELECT relative_path,
                        CASE WHEN status = 'pending' THEN stable_since + ? ELSE retry_at END AS due_at
                        FROM library_items WHERE library_id = ? AND last_seen_run_id = ? AND status IN ('pending', 'error') LIMIT 5001""",
                        (config["stable_seconds"], library_id, result["run_id"])).fetchall()
                    if len(retries) > 5000:
                        conn.execute("INSERT INTO library_changes VALUES (?, '', ?) ON CONFLICT(library_id, relative_path) DO UPDATE SET due_at = MIN(due_at, excluded.due_at)",
                                     (library_id, time.time() + max(1, config["stable_seconds"])))
                    else:
                        conn.executemany("INSERT INTO library_changes VALUES (?, ?, ?) ON CONFLICT(library_id, relative_path) DO NOTHING",
                                         ((library_id, row["relative_path"], max(time.time() + 1, row["due_at"] or time.time() + config["scan_interval_seconds"])) for row in retries))
                    backlog = conn.execute("SELECT COUNT(*), MIN(due_at) FROM library_changes WHERE library_id = ?", (library_id,)).fetchone()
                    if backlog[0] > 5000:
                        conn.execute("DELETE FROM library_changes WHERE library_id = ?", (library_id,))
                        conn.execute("INSERT INTO library_changes VALUES (?, '', ?)", (library_id, backlog[1]))
                # ponytail: automatic checks stay out of the job queue and retain 100 runs per library.
                self.db.execute("DELETE FROM library_scan_runs WHERE library_id = ? AND job_id IS NULL AND status <> 'running' "
                                "AND id NOT IN (SELECT id FROM library_scan_runs WHERE library_id = ? ORDER BY id DESC LIMIT 100)", (library_id, library_id))
            except JobCancelled:
                self._snapshots.pop(library_id, None)
            except Exception:
                self._snapshots.pop(library_id, None)
                failures = min(library["scan_failures"] + 1, 8)
                delay = min(3600, config["scan_interval_seconds"] * 2**failures)
                self.db.execute("UPDATE media_libraries SET scan_failures = ?, next_scan_at = ? WHERE id = ?", (failures, time.time() + delay, library_id))
            return

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._closing.clear()
        def run():
            while not self._closing.is_set():
                try:
                    self.tick()
                except Exception:
                    logging.getLogger(__name__).exception("目录监控检查失败")
                self._closing.wait(.5)
        self._thread = threading.Thread(target=run, daemon=True)
        self._thread.start()

    def close(self):
        self._closing.set()
        for _signature, stop, _thread, _retry in list(self._watchers.values()):
            stop.set()
        deadline = time.monotonic() + 2
        if self._thread:
            self._thread.join(max(0, deadline - time.monotonic()))
        for _signature, _stop, thread, _retry in list(self._watchers.values()):
            thread.join(max(0, deadline - time.monotonic()))
