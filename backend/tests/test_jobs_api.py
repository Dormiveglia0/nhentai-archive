from fastapi.testclient import TestClient

from app import main
from app.services.job_service import JobActive


class StubJobs:
    def __init__(self):
        self.active_delete = False
        self.missing_delete = False

    def list(self):
        return [
            {
                "id": 1,
                "type": "remote_import",
                "status": "failed",
                "stage": "failed",
                "progress": {"current": 3, "total": 5, "percent": 60},
                "target": {"gallery_id": 123456},
                "error": "remote limited",
                "retry_after": 60,
                "created_at": "2026-06-20 09:00:00",
                "updated_at": "2026-06-20 09:01:00",
            }
        ]

    def get(self, job_id):
        return self.list()[0] | {"id": job_id}

    def pause(self, job_id):
        return self.get(job_id) | {"status": "paused"}

    def resume(self, job_id):
        return self.get(job_id) | {"status": "running"}

    def cancel(self, job_id):
        return self.get(job_id) | {"status": "cancelled", "stage": "cancelled"}

    def delete(self, job_id):
        if self.missing_delete:
            raise ValueError(f"Job {job_id} does not exist")
        if self.active_delete:
            raise JobActive("仅可删除已结束的任务，请先取消进行中的任务")
        return {"deleted": job_id}

    def clear_finished(self):
        return {"deleted": 3}

    def logs(self, job_id):
        return {
            "result": [
                {
                    "id": 1,
                    "job_id": job_id,
                    "level": "info",
                    "message": "任务已创建",
                    "created_at": "2026-06-20 09:00:00",
                }
            ]
        }


class StubImports:
    def __init__(self):
        self.reject_retry = False

    def retry_job(self, job_id):
        if self.reject_retry:
            raise ValueError("Only failed remote import jobs with a gallery_id can be retried")
        return {
            "id": job_id,
            "type": "remote_import",
            "status": "queued",
            "stage": "queued",
            "progress": {"current": 0, "total": 0, "percent": 0},
            "target": {"gallery_id": 123456},
            "error": None,
            "retry_after": None,
            "created_at": "2026-06-20 09:00:00",
            "updated_at": "2026-06-20 09:02:00",
        }

    def resume_job(self, job_id):
        return {
            "id": job_id,
            "type": "remote_import",
            "status": "running",
            "stage": "downloading_cbz",
            "progress": {"current": 3, "total": 5, "percent": 60},
            "target": {"gallery_id": 123456},
            "error": None,
            "retry_after": None,
            "created_at": "2026-06-20 09:00:00",
            "updated_at": "2026-06-20 09:03:00",
        }

    def cancel_job(self, job_id):
        return {
            "id": job_id,
            "type": "remote_import",
            "status": "cancelled",
            "stage": "cancelled",
            "progress": {"current": 3, "total": 5, "percent": 60},
            "target": {"gallery_id": 123456},
            "error": None,
            "retry_after": None,
            "created_at": "2026-06-20 09:00:00",
            "updated_at": "2026-06-20 09:04:00",
        }


def test_jobs_routes_include_created_at_and_retry_payload(monkeypatch):
    monkeypatch.setattr(main, "jobs", StubJobs())
    monkeypatch.setattr(main, "imports", StubImports())
    client = TestClient(main.app)

    listed = client.get("/api/jobs").json()["result"][0]
    assert listed["created_at"] == "2026-06-20 09:00:00"
    assert listed["updated_at"] == "2026-06-20 09:01:00"

    retried = client.post("/api/jobs/1/retry").json()
    assert retried["status"] == "queued"
    assert retried["created_at"] == "2026-06-20 09:00:00"


def test_retry_route_rejects_invalid_retry(monkeypatch):
    stub_imports = StubImports()
    stub_imports.reject_retry = True
    monkeypatch.setattr(main, "imports", stub_imports)
    client = TestClient(main.app)

    response = client.post("/api/jobs/1/retry")

    assert response.status_code == 404
    assert "Only failed remote import jobs" in response.json()["detail"]


def test_jobs_control_and_log_routes(monkeypatch):
    monkeypatch.setattr(main, "jobs", StubJobs())
    monkeypatch.setattr(main, "imports", StubImports())
    client = TestClient(main.app)

    assert client.post("/api/jobs/1/pause").json()["status"] == "paused"
    assert client.post("/api/jobs/1/resume").json()["status"] == "running"
    assert client.post("/api/jobs/1/cancel").json()["status"] == "cancelled"
    assert client.get("/api/jobs/1/logs").json()["result"][0]["message"] == "任务已创建"


def test_delete_and_clear_routes(monkeypatch):
    stub = StubJobs()
    monkeypatch.setattr(main, "jobs", stub)
    client = TestClient(main.app)

    assert client.delete("/api/jobs/1").json() == {"deleted": 1}
    assert client.post("/api/jobs/clear").json() == {"deleted": 3}


def test_delete_active_job_returns_conflict(monkeypatch):
    stub = StubJobs()
    stub.active_delete = True
    monkeypatch.setattr(main, "jobs", stub)
    client = TestClient(main.app)

    response = client.delete("/api/jobs/1")

    assert response.status_code == 409
    assert "已结束" in response.json()["detail"]


def test_delete_missing_job_returns_not_found(monkeypatch):
    stub = StubJobs()
    stub.missing_delete = True
    monkeypatch.setattr(main, "jobs", stub)
    client = TestClient(main.app)

    assert client.delete("/api/jobs/1").status_code == 404
