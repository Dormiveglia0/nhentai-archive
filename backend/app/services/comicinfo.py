from __future__ import annotations

import io
import zipfile
from pathlib import Path
from typing import Any
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
    return comic_info


def to_xml(fields: dict[str, str]) -> str:
    root = ElementTree.Element("ComicInfo")
    for key in COMICINFO_KEYS.values():
        value = _stringify(fields.get(key))
        if value:
            child = ElementTree.SubElement(root, key)
            child.text = value
    return ElementTree.tostring(root, encoding="unicode", short_empty_elements=False)


def reseal_cbz(
    source_path: Path, comic_info_xml: str | None, keep_json: bool = True, compress: bool = True
) -> bytes:
    compression = zipfile.ZIP_DEFLATED if compress else zipfile.ZIP_STORED
    buffer = io.BytesIO()
    with zipfile.ZipFile(source_path) as source, zipfile.ZipFile(
        buffer, "w", compression=compression
    ) as target:
        for info in source.infolist():
            if info.is_dir():
                continue
            name = Path(info.filename).name.lower()
            if name == "comicinfo.xml":
                continue
            if not keep_json and name.endswith(".json"):
                continue
            target.writestr(info.filename, source.read(info.filename))
        if comic_info_xml is not None:
            target.writestr("ComicInfo.xml", comic_info_xml)
    return buffer.getvalue()
