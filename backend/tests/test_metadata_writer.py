from pathlib import Path

from app.db import Database
from app.services.metadata_writer import comic_info_xml, translated_metadata
from app.services.translation_service import TranslationService


def test_comic_info_uses_dictionary():
    db_path = Path("work/test-metadata.db")
    if db_path.exists():
        db_path.unlink()
    db = Database(db_path)
    db.init()
    translations = TranslationService(db)
    translations.upsert_dictionary(
        {"source_type": "tag", "source_text": "full color", "translated_text": "全彩", "enabled": True}
    )
    gallery = {
        "id": 123,
        "title": {"display": "Sample"},
        "pages": [{"path": "galleries/1/1.jpg"}],
        "tags": [{"type": "tag", "name": "full color"}, {"type": "artist", "name": "alice"}],
    }

    meta = translated_metadata(gallery, translations)
    xml = comic_info_xml(gallery, translations)

    assert meta["translated_tags"][0]["translated_name"] == "全彩"
    assert "<Tags>全彩</Tags>" in xml
    assert "<Writer>alice</Writer>" in xml
