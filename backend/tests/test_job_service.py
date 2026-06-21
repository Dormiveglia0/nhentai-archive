import json

import pytest

from app.config import Settings
from app.database import Database
from app.services.import_service import ImportService
from app.services.job_service import JobActive, JobCancelled, JobService


def _service(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    return JobService(db)


def test_job_meta_uses_imported_work_cover_and_title(tmp_path):
    jobs = _service(tmp_path)
    jobs.db.execute(
        """
        INSERT INTO works (id, remote_gallery_id, title, pretty_title, source, page_count, cover_path)
        VALUES (7, 100005, 'Rainy Classroom', 'Pretty Rainy', 'remote', 36, '/data/covers/7.jpg')
        """
    )
    job = jobs.create("remote_import", {"gallery_id": 100005, "work_id": 7, "already_imported": True})

    meta = jobs.get(job["id"])["meta"]
    assert meta["title"] == "Pretty Rainy"
    assert meta["page_count"] == 36
    assert meta["cover_url"] == "/api/works/7/cover"


def test_job_meta_falls_back_to_cached_gallery_for_in_progress(tmp_path):
    jobs = _service(tmp_path)
    payload = {"id": 200010, "title": {"english": "Cached Title", "pretty": "Cached Pretty"}, "num_pages": 21}
    jobs.db.execute(
        "INSERT INTO remote_galleries (gallery_id, media_id, payload_json) VALUES (?, ?, ?)",
        (200010, "m200010", json.dumps(payload)),
    )
    job = jobs.create("remote_import", {"gallery_id": 200010})

    meta = jobs.get(job["id"])["meta"]
    assert meta["title"] == "Cached Pretty"
    assert meta["page_count"] == 21
    assert meta["cover_url"] is None


def test_job_meta_is_none_without_any_metadata(tmp_path):
    jobs = _service(tmp_path)
    job = jobs.create("remote_import", {"gallery_id": 999999})
    assert jobs.get(job["id"])["meta"] is None


def test_delete_removes_finished_job_and_its_logs(tmp_path):
    jobs = _service(tmp_path)
    job = jobs.create("remote_import", {"gallery_id": 123456})
    jobs.complete(job["id"], {"work_id": 5})

    result = jobs.delete(job["id"])

    assert result == {"deleted": job["id"]}
    with pytest.raises(ValueError):
        jobs.get(job["id"])
    remaining_logs = jobs.db.fetchall("SELECT id FROM job_logs WHERE job_id = ?", (job["id"],))
    assert remaining_logs == []


def test_delete_rejects_active_job(tmp_path):
    jobs = _service(tmp_path)
    job = jobs.create("remote_import", {"gallery_id": 123456})
    jobs.mark_running(job["id"], "downloading_cbz", 1, 5)

    with pytest.raises(JobActive):
        jobs.delete(job["id"])
    assert jobs.get(job["id"])["status"] == "running"


def test_cancelled_job_is_active_until_worker_acknowledges(tmp_path):
    jobs = _service(tmp_path)
    job = jobs.create("remote_import", {"gallery_id": 123456})
    jobs.mark_running(job["id"], "downloading_cbz", 1, 5)

    cancelling = jobs.cancel(job["id"])

    assert cancelling["status"] == "cancelling"
    with pytest.raises(JobActive):
        jobs.delete(job["id"])
    assert jobs.clear_finished() == {"deleted": 0}

    jobs.mark_cancelled(job["id"])
    assert jobs.delete(job["id"]) == {"deleted": job["id"]}


def test_delete_missing_job_raises_value_error(tmp_path):
    jobs = _service(tmp_path)
    with pytest.raises(ValueError):
        jobs.delete(999)


def test_clear_finished_keeps_active_jobs(tmp_path):
    jobs = _service(tmp_path)
    done = jobs.create("remote_import", {"gallery_id": 1})
    jobs.complete(done["id"])
    failed = jobs.create("remote_import", {"gallery_id": 2})
    jobs.fail(failed["id"], "boom")
    cancelled = jobs.create("remote_import", {"gallery_id": 3})
    jobs.cancel(cancelled["id"])
    jobs.mark_cancelled(cancelled["id"])
    running = jobs.create("remote_import", {"gallery_id": 4})
    jobs.mark_running(running["id"], "downloading_cbz", 1, 5)

    result = jobs.clear_finished()

    assert result == {"deleted": 3}
    remaining = [job["id"] for job in jobs.list()]
    assert remaining == [running["id"]]


def test_job_service_records_logs_and_controls_running_job(tmp_path):
    jobs = _service(tmp_path)
    job = jobs.create("remote_import", {"gallery_id": 123456})

    jobs.mark_running(job["id"], "downloading_cbz", 3, 5)
    paused = jobs.pause(job["id"])
    assert paused["status"] == "paused"
    assert paused["stage"] == "downloading_cbz"
    assert paused["target"]["_paused_from"] == "running"

    resumed = jobs.resume(job["id"])
    assert resumed["status"] == "running"
    assert resumed["stage"] == "downloading_cbz"
    assert "_paused_from" not in resumed["target"]

    cancelled = jobs.cancel(job["id"])
    assert cancelled["status"] == "cancelling"
    assert cancelled["stage"] == "cancelling"

    logs = jobs.logs(job["id"])
    messages = [entry["message"] for entry in logs["result"]]
    assert messages == [
        "任务已创建",
        "进入阶段: downloading_cbz",
        "任务已暂停",
        "任务已恢复",
        "任务已取消",
    ]


def test_job_service_cancelled_job_raises_at_checkpoint(tmp_path):
    jobs = _service(tmp_path)
    job = jobs.create("remote_import", {"gallery_id": 123456})
    jobs.cancel(job["id"])

    try:
        jobs.checkpoint(job["id"])
    except JobCancelled:
        pass
    else:
        raise AssertionError("checkpoint should raise JobCancelled for cancelled jobs")


def test_job_service_retry_failed_job_resets_progress_and_logs(tmp_path):
    jobs = _service(tmp_path)
    job = jobs.create("remote_import", {"gallery_id": 123456})
    jobs.fail(job["id"], "remote limited", retry_after=60)

    retried = jobs.retry(job["id"])

    assert retried["status"] == "queued"
    assert retried["stage"] == "queued"
    assert retried["progress"] == {"current": 0, "total": 0, "percent": 0}
    assert retried["error"] is None
    assert retried["retry_after"] is None
    assert jobs.logs(job["id"])["result"][-1]["message"] == "任务已重新加入队列"


def test_resume_orphaned_paused_remote_import_restarts_worker(tmp_path, monkeypatch):
    jobs = _service(tmp_path)
    job = jobs.create("remote_import", {"gallery_id": 123456})
    jobs.mark_running(job["id"], "downloading_cbz", 3, 5)
    jobs.pause(job["id"])
    imports = ImportService(None, None, jobs, None, None)
    started: list[tuple[int, int]] = []
    monkeypatch.setattr(imports, "_start_remote_import", lambda job_id, gallery_id: started.append((job_id, gallery_id)))

    resumed = imports.resume_job(job["id"])

    assert resumed["status"] == "running"
    assert started == [(job["id"], 123456)]


def test_cancel_orphaned_job_marks_terminal_without_worker(tmp_path):
    jobs = _service(tmp_path)
    job = jobs.create("remote_import", {"gallery_id": 123456})
    jobs.mark_running(job["id"], "downloading_cbz", 3, 5)
    imports = ImportService(None, None, jobs, None, None)

    cancelled = imports.cancel_job(job["id"])

    assert cancelled["status"] == "cancelled"
    assert jobs.delete(job["id"]) == {"deleted": job["id"]}


def test_cancel_running_job_with_live_worker_stays_active_until_ack(tmp_path, monkeypatch):
    jobs = _service(tmp_path)
    job = jobs.create("remote_import", {"gallery_id": 123456})
    jobs.mark_running(job["id"], "downloading_cbz", 3, 5)
    imports = ImportService(None, None, jobs, None, None)
    monkeypatch.setattr(imports, "_worker_alive", lambda job_id: True)

    cancelling = imports.cancel_job(job["id"])

    assert cancelling["status"] == "cancelling"
    with pytest.raises(JobActive):
        jobs.delete(job["id"])
