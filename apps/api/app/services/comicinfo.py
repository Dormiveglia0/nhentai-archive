from __future__ import annotations

import io
import re
import zipfile
from urllib.parse import urlsplit
from pathlib import Path, PurePosixPath
from typing import Any, BinaryIO, Callable
from xml.etree import ElementTree


COMICINFO_KEYS = {
    "title": "Title",
    "title_japanese": "AlternateSeries",
    "pretty_title": "LocalizedSeries",
    "artist": "Writer",
    "group": "Publisher",
    "language": "LanguageISO",
    "tags": "Tags",
    "summary": "Summary",
    "published_at": "Year",
    "pages": "PageCount",
}
MAX_XML_BYTES = 1024 * 1024


def _stringify(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _field_value(field: dict[str, Any] | None) -> str | None:
    if not field:
        return None
    for key in ("working_value", "current_value", "source_value"):
        value = _stringify(field.get(key))
        if value:
            return value
    return None


def _tag_output(aggregate: dict[str, Any]) -> str | None:
    values: list[str] = []
    for group in aggregate["tags"]["groups"]:
        for tag in group["tags"]:
            if tag.get("type") != "tag":
                continue
            display = _stringify(tag.get("display") or tag.get("name") or tag.get("slug"))
            if display and display not in values:
                values.append(display)
    return ", ".join(values) if values else None


def build_fields(aggregate: dict[str, Any]) -> dict[str, str]:
    fields = {field["field"]: field for field in aggregate["metadata"]["fields"]}
    comic_info: dict[str, str] = {}
    for field, key in COMICINFO_KEYS.items():
        value = _field_value(fields.get(field))
        if value:
            comic_info[key] = value
    if "PageCount" not in comic_info:
        comic_info["PageCount"] = str(aggregate["work"].get("page_count") or 0)
    tags = _tag_output(aggregate)
    if tags:
        comic_info["Tags"] = tags
    gallery_id = aggregate.get("work", {}).get("remote_gallery_id")
    if gallery_id:
        comic_info["Web"] = f"https://nhentai.net/g/{int(gallery_id)}/"
    return comic_info


def to_xml(fields: dict[str, str]) -> str:
    root = ElementTree.Element("ComicInfo")
    for key in COMICINFO_KEYS.values():
        value = _stringify(fields.get(key))
        if value:
            child = ElementTree.SubElement(root, key)
            child.text = value
    web = _stringify(fields.get("Web"))
    if web:
        child = ElementTree.SubElement(root, "Web")
        child.text = web
    return ElementTree.tostring(root, encoding="unicode", short_empty_elements=False)


def gallery_id_from_xml(xml_text: str) -> int | None:
    if len(xml_text.encode("utf-8")) > MAX_XML_BYTES or "<!DOCTYPE" in xml_text.upper() or "<!ENTITY" in xml_text.upper():
        return None
    try:
        root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError:
        return None
    web = next((child.text for child in root if child.tag.split("}")[-1] == "Web"), None)
    if not web:
        return None
    try:
        parsed = urlsplit(web.strip())
    except ValueError:
        return None
    if parsed.scheme not in {"http", "https"} or parsed.hostname not in {"nhentai.net", "www.nhentai.net"}:
        return None
    match = re.fullmatch(r"/g/([0-9]{1,19})/?", parsed.path)
    value = int(match.group(1)) if match else None
    return value if value and 0 < value <= 9223372036854775807 else None


def gallery_id_from_cbz(path: Path) -> int | None:
    try:
        with zipfile.ZipFile(path) as archive:
            member = next((info for info in archive.infolist() if Path(info.filename).name.lower() == "comicinfo.xml"), None)
            if member is None or member.file_size > MAX_XML_BYTES or member.flag_bits & 1:
                return None
            return gallery_id_from_xml(archive.read(member).decode("utf-8", errors="replace"))
    except (OSError, RuntimeError, zipfile.BadZipFile):
        return None


def reseal_cbz(
    source_path: Path, comic_info_xml: str | None, keep_json: bool = True, compress: bool = True
) -> bytes:
    buffer = io.BytesIO()
    reseal_cbz_to(source_path, buffer, comic_info_xml, keep_json, compress)
    return buffer.getvalue()


def reseal_cbz_to(
    source_path: Path, destination: Path | BinaryIO, comic_info_xml: str | None,
    keep_json: bool = True, compress: bool = True, checkpoint: Callable[[], None] | None = None,
) -> None:
    from app.services.archive_manifest import MAX_COVER_BYTES, open_archive
    compression = zipfile.ZIP_DEFLATED if compress else zipfile.ZIP_STORED
    with open_archive(source_path) as source, zipfile.ZipFile(
        destination, "w", compression=compression
    ) as target:
        for info in source.infolist():
            if info.is_dir():
                continue
            member = PurePosixPath(info.filename.replace("\\", "/"))
            if member.is_absolute() or ".." in member.parts or "\x00" in info.filename:
                raise ValueError("归档包含不安全的成员路径")
            name = Path(info.filename).name.lower()
            if name == "comicinfo.xml":
                continue
            if not keep_json and name.endswith(".json"):
                continue
            if info.file_size > MAX_COVER_BYTES or info.flag_bits & 1:
                raise ValueError("归档成员超过64MB或已加密，无法打包")
            with source.open(info) as reader, target.open(info.filename, "w", force_zip64=True) as writer:
                while True:
                    if checkpoint:
                        checkpoint()
                    chunk = reader.read(1024 * 1024)
                    if not chunk:
                        break
                    writer.write(chunk)
        if comic_info_xml is not None:
            target.writestr("ComicInfo.xml", comic_info_xml)
