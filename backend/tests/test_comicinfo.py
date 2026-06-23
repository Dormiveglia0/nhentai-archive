import io
import zipfile
from pathlib import Path

from app.services import comicinfo


def _png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _make_cbz(path: Path) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("001.png", _png())
        archive.writestr("002.png", _png())
        archive.writestr("meta.json", '{"source":"real"}')
        archive.writestr("ComicInfo.xml", "<ComicInfo><Title>Old</Title></ComicInfo>")


def test_build_fields_and_to_xml_from_aggregate():
    aggregate = {
        "work": {"id": 1, "page_count": 2},
        "metadata": {"fields": [
            {"field": "title", "working_value": "New Title", "current_value": None, "source_value": None},
            {"field": "artist", "working_value": "tonari", "current_value": None, "source_value": None},
        ]},
        "tags": {"groups": [
            {"tags": [{"display": "雨", "name": "rain", "slug": "rain"}]},
        ]},
    }
    fields = comicinfo.build_fields(aggregate)
    assert fields["Title"] == "New Title"
    assert fields["Writer"] == "tonari"
    assert fields["Tags"] == "雨"
    assert fields["PageCount"] == "2"

    xml = comicinfo.to_xml(fields)
    assert "<Title>New Title</Title>" in xml
    assert "<Tags>雨</Tags>" in xml


def test_reseal_cbz_replaces_comicinfo_and_preserves_pages(tmp_path):
    source = tmp_path / "src.cbz"
    _make_cbz(source)
    with zipfile.ZipFile(source) as original:
        original_pages = {n: original.read(n) for n in ("001.png", "002.png", "meta.json")}

    data = comicinfo.reseal_cbz(source, "<ComicInfo><Title>New</Title></ComicInfo>")

    with zipfile.ZipFile(io.BytesIO(data)) as resealed:
        names = resealed.namelist()
        assert names.count("ComicInfo.xml") == 1
        assert resealed.read("ComicInfo.xml").decode() == "<ComicInfo><Title>New</Title></ComicInfo>"
        for name, body in original_pages.items():
            assert resealed.read(name) == body


def _aggregate(remote_gallery_id):
    return {
        "work": {"page_count": 3, "remote_gallery_id": remote_gallery_id},
        "metadata": {"fields": [{"field": "title", "working_value": "T", "current_value": None, "source_value": None}]},
        "tags": {"groups": []},
    }


def test_build_fields_injects_web_for_remote_work():
    fields = comicinfo.build_fields(_aggregate(177013))
    assert fields["Web"] == "https://nhentai.net/g/177013/"


def test_build_fields_omits_web_for_local_work():
    fields = comicinfo.build_fields(_aggregate(None))
    assert "Web" not in fields


def test_web_round_trips_through_xml():
    xml = comicinfo.to_xml(comicinfo.build_fields(_aggregate(177013)))
    assert "<Web>https://nhentai.net/g/177013/</Web>" in xml
    assert comicinfo.gallery_id_from_xml(xml) == 177013


def test_gallery_id_from_xml_returns_none_without_web():
    xml = comicinfo.to_xml({"Title": "T"})
    assert comicinfo.gallery_id_from_xml(xml) is None
