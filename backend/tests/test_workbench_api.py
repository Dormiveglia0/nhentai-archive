from fastapi.testclient import TestClient

from app import main


class StubWorkbench:
    def overview(self):
        return {
            "library": {
                "total": 2, "reading": 1, "completed": 0, "unread": 1,
                "untagged": 1, "total_pages": 40, "total_size_bytes": 1024,
            },
            "governance": {
                "total": 1, "missing_metadata": 1, "untagged": 1,
                "dictionary_review": 0, "dictionary_conflict": 0,
                "missing_comicinfo": 1, "missing_cover": 0,
            },
            "files": {
                "work_count": 2, "source_bytes": 1024, "cover_ok": 2,
                "missing_source": 0, "missing_cover": 0,
                "orphan_count": 0, "stale_count": 0, "reclaimable_bytes": 0,
            },
            "exports": {"total": 2, "ready": 1, "blocked": 1, "warnings": 0},
            "jobs": {
                "running": 0, "queued": 0, "paused": 0, "failed": 1, "completed": 1,
                "failed_recent": [
                    {"id": 5, "type": "remote_import", "target": {"gallery_id": 123},
                     "error": "remote limited", "updated_at": "2026-06-20 09:00:00"}
                ],
            },
            "continue_reading": [],
            "recent_added": [],
        }


def test_workbench_overview_route_returns_aggregate(monkeypatch):
    monkeypatch.setattr(main, "workbench", StubWorkbench())
    client = TestClient(main.app)

    body = client.get("/api/workbench/overview").json()

    assert body["library"]["total"] == 2
    assert body["jobs"]["failed"] == 1
    assert body["jobs"]["failed_recent"][0]["id"] == 5
    assert body["exports"]["ready"] == 1
