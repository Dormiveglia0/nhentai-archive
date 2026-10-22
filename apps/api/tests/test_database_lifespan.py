import asyncio
from unittest.mock import Mock

from app import main
from app.database import Database


def test_lifespan_keeps_wal_open_without_blocking_writes_or_checkpoints(tmp_path, monkeypatch):
    db = Database(tmp_path / "archive.db")
    db.init_schema()
    monkeypatch.setattr(main, "services", Mock(db=db))
    wal = tmp_path / "archive.db-wal"

    async def exercise():
        async with main.lifespan(main.app):
            db.execute("INSERT INTO works(title,source) VALUES ('Book','local')")
            inode = wal.stat().st_ino
            for _ in range(5):
                db.execute("UPDATE works SET favorite=1-favorite")
                assert db.fetchone("SELECT COUNT(*) n FROM works")["n"] == 1
                assert wal.stat().st_ino == inode
            with db.connect() as conn:
                assert tuple(conn.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()) == (0, 0, 0)
            assert wal.exists()

    asyncio.run(exercise())
    assert not wal.exists()
