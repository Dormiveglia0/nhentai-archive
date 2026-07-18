from app.database import Database


def test_database_enables_concurrency_pragmas_and_query_indexes(tmp_path):
    db = Database(tmp_path / "archive.db")
    db.init_schema()

    with db.connect() as conn:
        journal_mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
        foreign_keys = conn.execute("PRAGMA foreign_keys").fetchone()[0]
        busy_timeout = conn.execute("PRAGMA busy_timeout").fetchone()[0]
        index_names = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'index'"
            ).fetchall()
        }

    assert journal_mode == "wal"
    assert foreign_keys == 1
    assert busy_timeout == 5000
    assert {
        "idx_work_files_work_kind_created",
        "idx_works_favorite_updated",
        "idx_reading_sessions_work_started",
        "idx_jobs_status_updated",
        "idx_jobs_updated",
    } <= index_names


def test_database_rebases_missing_managed_paths_after_repo_move(tmp_path):
    data_dir = tmp_path / ".local-data"
    library = data_dir / "library"
    covers = data_dir / "covers"
    library.mkdir(parents=True)
    covers.mkdir()
    (library / "work.cbz").write_bytes(b"cbz")
    (covers / "1.jpg").write_bytes(b"cover")
    db = Database(data_dir / "archive.db")
    db.init_schema()
    work_id = db.execute(
        "INSERT INTO works (title, source, cover_path) VALUES ('Work', 'local', ?)",
        ("/old/repo/backend/.local-data/covers/1.jpg",),
    ).lastrowid
    db.execute(
        "INSERT INTO work_files (work_id, kind, path) VALUES (?, 'source_cbz', ?)",
        (work_id, "/old/repo/backend/.local-data/library/work.cbz"),
    )
    container_work_id = db.execute(
        "INSERT INTO works (title, source, cover_path) VALUES ('Container work', 'remote', ?)",
        ("/data/covers/1.jpg",),
    ).lastrowid
    db.execute(
        "INSERT INTO work_files (work_id, kind, path) VALUES (?, 'source_cbz', ?)",
        (container_work_id, "/data/library/work.cbz"),
    )

    db.rebase_managed_paths(data_dir)

    assert db.fetchone("SELECT cover_path FROM works WHERE id = ?", (work_id,))["cover_path"] == str(covers / "1.jpg")
    assert db.fetchone("SELECT path FROM work_files WHERE work_id = ?", (work_id,))["path"] == str(library / "work.cbz")
    assert db.fetchone("SELECT cover_path FROM works WHERE id = ?", (container_work_id,))["cover_path"] == str(covers / "1.jpg")
    assert db.fetchone("SELECT path FROM work_files WHERE work_id = ?", (container_work_id,))["path"] == str(library / "work.cbz")

    with db.connect() as conn:
        assert conn.execute("SELECT cover_path FROM works WHERE id = ?", (work_id,)).fetchone()[0] == "covers/1.jpg"
        assert conn.execute("SELECT path FROM work_files WHERE work_id = ?", (work_id,)).fetchone()[0] == "library/work.cbz"

    container_data = tmp_path / "container-data"
    (container_data / "library").mkdir(parents=True)
    (container_data / "covers").mkdir()
    (container_data / "library" / "work.cbz").write_bytes(b"cbz")
    (container_data / "covers" / "1.jpg").write_bytes(b"cover")
    db.rebase_managed_paths(container_data)

    assert db.fetchone("SELECT cover_path FROM works WHERE id = ?", (work_id,))["cover_path"] == str(container_data / "covers" / "1.jpg")
    assert db.fetchone("SELECT path FROM work_files WHERE work_id = ?", (work_id,))["path"] == str(container_data / "library" / "work.cbz")
    with db.connect() as conn:
        assert conn.execute("SELECT cover_path FROM works WHERE id = ?", (work_id,)).fetchone()[0] == "covers/1.jpg"
        assert conn.execute("SELECT path FROM work_files WHERE work_id = ?", (work_id,)).fetchone()[0] == "library/work.cbz"
