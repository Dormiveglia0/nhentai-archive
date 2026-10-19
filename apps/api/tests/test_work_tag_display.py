from copy import deepcopy

from app.services.work_tag_display import visible_work_tags


def test_display_merge_preserves_work_type_remote_link_and_source_records():
    rows = [
        {"id": 1, "work_id": 1, "tag_type": "tag", "remote_name": "  WINTER  ", "source": "comicinfo"},
        {"id": 2, "work_id": 1, "tag_type": "tag", "remote_name": "winter", "remote_tag_id": 40,
         "dictionary_id": 3, "zh_name": "冬季", "source": "remote"},
        {"id": 3, "work_id": 1, "tag_type": "tag", "remote_name": "冬季", "source": "comicinfo"},
        {"id": 4, "work_id": 1, "tag_type": "group", "remote_name": "冬季"},
        {"id": 5, "work_id": 2, "tag_type": "tag", "remote_name": "winter"},
    ]
    before = deepcopy(rows)
    result = visible_work_tags(rows)
    assert len(result) == 3
    assert [(row["work_id"], row["tag_type"], row["display"]) for row in result] == [
        (1, "tag", "冬季"), (1, "group", "冬季"), (2, "tag", "winter")]
    assert result[0]["id"] == 2 and result[0]["remote_tag_id"] == 40
    assert visible_work_tags([rows[-1]])[0] == result[-1]
    assert rows == before


def test_display_merge_keeps_dictionary_conflict_visible():
    rows = [
        {"id": 1, "work_id": 1, "tag_type": "tag", "remote_name": "winter", "remote_tag_id": 40,
         "dictionary_id": 3, "zh_name": "冬季", "dictionary_status": "configured"},
        {"id": 2, "work_id": 1, "tag_type": "tag", "remote_name": "冬季",
         "dictionary_id": 4, "zh_name": "冬季", "dictionary_status": "conflict"},
    ]
    result = visible_work_tags(rows)
    assert len(result) == 1 and result[0]["remote_tag_id"] == 40
    assert result[0]["dictionary_status"] == "conflict" and result[0]["dictionary_id"] == 4
