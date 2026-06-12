import pytest

from app.services.nhentai_client import NhentaiApiError, map_gallery_summary, normalize_remote_error


def test_map_gallery_summary_preserves_remote_identity_and_titles():
    payload = {
        "id": 123456,
        "media_id": "98765",
        "english_title": "After School Room",
        "japanese_title": "放課後のふたり",
        "thumbnail": "/galleries/98765/thumb.jpg",
        "thumbnail_width": 350,
        "thumbnail_height": 500,
        "num_pages": 32,
        "num_favorites": 40,
        "tag_ids": [1, 2],
        "blacklisted": False,
    }

    summary = map_gallery_summary(payload)

    assert summary["gallery_id"] == 123456
    assert summary["media_id"] == "98765"
    assert summary["title"] == "After School Room"
    assert summary["title_japanese"] == "放課後のふたり"
    assert summary["page_count"] == 32
    assert summary["thumbnail"]["path"] == "/galleries/98765/thumb.jpg"
    assert summary["remote"] == "nhentai"


def test_normalize_remote_error_marks_429_as_rate_limited():
    error = normalize_remote_error(429, '{"error":"too many requests"}')

    assert isinstance(error, NhentaiApiError)
    assert error.status_code == 429
    assert error.code == "rate_limited"
    assert "too many requests" in error.message
