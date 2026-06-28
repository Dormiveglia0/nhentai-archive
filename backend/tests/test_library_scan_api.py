import zipfile
from pathlib import Path

from fastapi.testclient import TestClient

from app import main


def _png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def test_scan_preview_lists_new_local(tmp_path, monkeypatch):
    lib = tmp_path / "library"
    lib.mkdir()
    object.__setattr__(main.settings, "data_dir", tmp_path)
    with zipfile.ZipFile(lib / "fresh.cbz", "w") as archive:
        archive.writestr("001.png", _png())
    client = TestClient(main.app)
    resp = client.post("/api/library/scan/preview")
    assert resp.status_code == 200
    assert resp.json()["counts"]["new_local"] >= 1
