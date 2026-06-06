from __future__ import annotations

from typing import Any
from xml.etree import ElementTree as ET

from .translation_service import TranslationService


TAG_TO_COMICINFO = {
    "artist": "Writer",
    "group": "Publisher",
    "character": "Characters",
    "parody": "Series",
    "language": "LanguageISO",
    "category": "Genre",
    "tag": "Tags",
}


def _title(data: dict[str, Any]) -> str:
    title = data.get("title") or {}
    return title.get("display") or title.get("english") or title.get("japanese") or str(data.get("id", "untitled"))


def translated_metadata(data: dict[str, Any], translations: TranslationService) -> dict[str, Any]:
    prefs = translations.settings()
    mapping = translations.translation_map()
    title = _title(data)
    translated_title = mapping.get(("title", title), title) if prefs["translate_titles"] else title
    tags: list[dict[str, Any]] = []
    for tag in data.get("tags", []):
        source_type = tag.get("type", "tag")
        source_name = tag.get("name", "")
        tags.append(
            {
                **tag,
                "translated_name": mapping.get((source_type, source_name), source_name)
                if prefs["translate_tags"]
                else source_name,
            }
        )
    return {**data, "translated_title": translated_title, "translated_tags": tags}


def comic_info_xml(data: dict[str, Any], translations: TranslationService) -> str:
    meta = translated_metadata(data, translations)
    root = ET.Element("ComicInfo")
    ET.SubElement(root, "Title").text = meta["translated_title"]
    ET.SubElement(root, "Number").text = str(data.get("id", ""))
    ET.SubElement(root, "PageCount").text = str(len(data.get("pages", [])))
    ET.SubElement(root, "Web").text = f"https://nhentai.net/g/{data.get('id')}/"
    ET.SubElement(root, "Summary").text = f"Original gallery id: {data.get('id')}"

    grouped: dict[str, list[str]] = {}
    for tag in meta.get("translated_tags", []):
        grouped.setdefault(tag.get("type", "tag"), []).append(tag.get("translated_name", tag.get("name", "")))

    for tag_type, element_name in TAG_TO_COMICINFO.items():
        names = [name for name in grouped.get(tag_type, []) if name]
        if names:
            ET.SubElement(root, element_name).text = ", ".join(sorted(set(names)))

    ET.indent(root, space="  ")
    return ET.tostring(root, encoding="unicode", xml_declaration=True)
