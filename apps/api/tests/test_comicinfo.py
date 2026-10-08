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
            {"tags": [
                {"type": "artist", "display": "tonari", "name": "tonari", "slug": "tonari"},
                {"type": "language", "display": "日本語", "name": "japanese", "slug": "japanese"},
                {"type": "tag", "display": "雨", "name": "rain", "slug": "rain"},
            ]},
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


def test_reseal_cbz_preserves_duplicate_member_bytes(tmp_path):
    source = tmp_path / "src.cbz"
    with zipfile.ZipFile(source, "w") as archive:
        archive.writestr("001.png", b"first")
        archive.writestr("001.png", b"second")

    data = comicinfo.reseal_cbz(source, None)

    with zipfile.ZipFile(io.BytesIO(data)) as resealed:
        entries = [info for info in resealed.infolist() if info.filename == "001.png"]
        assert [resealed.read(info) for info in entries] == [b"first", b"second"]


def test_streamed_reseal_never_reads_a_whole_member(tmp_path, monkeypatch):
    source = tmp_path / "source.cbz"
    destination = tmp_path / "export.cbz"
    _make_cbz(source)
    read = zipfile.ZipExtFile.read
    calls = []

    def bounded_read(handle, size=-1):
        assert 0 <= size <= 1024 * 1024
        calls.append(size)
        return read(handle, size)

    with monkeypatch.context() as patch:
        patch.setattr(zipfile.ZipExtFile, "read", bounded_read)
        comicinfo.reseal_cbz_to(source, destination, "<ComicInfo><Title>New</Title></ComicInfo>")
    assert calls
    with zipfile.ZipFile(destination) as handle:
        assert handle.read("001.png") == _png()
        assert "New" in handle.read("ComicInfo.xml").decode()


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


def test_gallery_link_rejects_spoofed_hosts_and_malformed_urls():
    for url in ("https://evilnhentai.net/g/123/", "https://nhentai.net.evil.test/g/123/", "https://[bad/g/123/", "file://nhentai.net/g/123/", "https://nhentai.net/g/0/", "https://nhentai.net/g/9223372036854775808/", "https://nhentai.net/g/" + "1" * 5000):
        assert comicinfo.gallery_id_from_xml(comicinfo.to_xml({"Web": url})) is None
    assert comicinfo.gallery_id_from_xml(comicinfo.to_xml({"Web": "https://www.nhentai.net/g/123/?x=1"})) == 123
    assert comicinfo.gallery_id_from_xml('<ComicInfo xmlns="test"><Web>https://nhentai.net/g/123/</Web></ComicInfo>') == 123
