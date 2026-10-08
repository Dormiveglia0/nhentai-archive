from __future__ import annotations

import hashlib
import json
import mimetypes
import multiprocessing
import time
import zipfile
import zlib
from io import BytesIO
from pathlib import Path, PurePosixPath
from typing import Any
from xml.etree import ElementTree

from PIL import Image, ImageOps

from app.services.archive_service import IMAGE_EXTENSIONS, _natural_key
from app.services.comicinfo import MAX_XML_BYTES, gallery_id_from_xml
from app.services.media_library_service import MediaLibraryService


MAX_ENTRIES = 50000
MAX_COVER_BYTES = 64 * 1024 * 1024
MAX_MANIFEST_BYTES = 32 * 1024 * 1024


class MountUnavailable(OSError):
    pass


def _probe_archive(connection, root: str, follow_symlinks: bool) -> None:
    try:
        try:
            import resource
            resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
        except ImportError:
            pass
        while True:
            relative = connection.recv()
            try:
                path = MediaLibraryService.source_path(Path(root), relative, follow_symlinks)
                before = path.stat()
                result = inspect_archive(path)
                after = path.stat()
                result["before"] = (before.st_size, before.st_mtime_ns, before.st_dev, before.st_ino)
                result["after"] = (after.st_size, after.st_mtime_ns, after.st_dev, after.st_ino)
                connection.send((True, result))
            except Exception as exc:
                connection.send((False, str(exc)[:500] or type(exc).__name__))
    except (EOFError, BrokenPipeError):
        pass
    finally:
        connection.close()


class MountedArchiveProbe:
    """Reuse one bounded process per scan; stuck FUSE reads can be terminated."""
    def __init__(self, root: Path, follow_symlinks: bool, timeout: float):
        self.root, self.follow_symlinks, self.timeout = root, follow_symlinks, timeout
        self.process = None
        self.connection = None

    def inspect(self, relative: str, checkpoint) -> dict[str, Any]:
        checkpoint()
        if self.process is not None and self.connection is None:
            if not self.close():
                raise MountUnavailable("挂载读取仍被系统阻塞，暂不启动更多读取进程")
        if self.process is None:
            context = multiprocessing.get_context("spawn")
            self.connection, child = context.Pipe()
            self.process = context.Process(target=_probe_archive, args=(child, str(self.root), self.follow_symlinks), daemon=True)
            self.process.start()
            child.close()
        deadline = time.monotonic() + self.timeout
        try:
            self.connection.send(relative)
            while True:
                before_checkpoint = time.monotonic()
                checkpoint()
                deadline += time.monotonic() - before_checkpoint
                if self.connection.poll(0.2):
                    ok, result = self.connection.recv()
                    if not ok:
                        raise OSError(result)
                    return result
                if time.monotonic() > deadline:
                    raise TimeoutError(f"源文件读取超过{self.timeout}秒，将稍后重试")
        except (EOFError, BrokenPipeError) as exc:
            self.close()
            raise OSError("源文件检查进程已中断") from exc
        except BaseException:
            self.close()
            raise

    def close(self) -> bool:
        if self.connection is not None:
            self.connection.close()
            self.connection = None
        if self.process is not None:
            if self.process.is_alive():
                self.process.terminate()
            self.process.join(1)
            if self.process.is_alive():
                self.process.kill()
                self.process.join(1)
            if self.process.is_alive():
                return False
            self.process = None
        return True


def inspect_mounted_archive(root: Path, relative: str, follow_symlinks: bool, timeout: float, checkpoint) -> dict[str, Any]:
    probe = MountedArchiveProbe(root, follow_symlinks, timeout)
    try:
        return probe.inspect(relative, checkpoint)
    finally:
        probe.close()


def unpack_manifest(body: bytes) -> list[dict[str, Any]]:
    decoder = zlib.decompressobj()
    text = decoder.decompress(body, MAX_MANIFEST_BYTES + 1)
    if len(text) > MAX_MANIFEST_BYTES or not decoder.eof:
        raise ValueError("页面索引过大或已损坏")
    return json.loads(text)


def inspect_archive(path: Path) -> dict[str, Any]:
    """Only read ZIP headers, ComicInfo and one cover; never hash/copy the archive."""
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        if len(entries) > MAX_ENTRIES:
            raise ValueError("归档条目超过50000项")
        images, metadata, warnings = [], {}, []
        for position, info in enumerate(entries):
            if info.is_dir():
                continue
            name = PurePosixPath(info.filename.replace("\\", "/"))
            if name.is_absolute() or ".." in name.parts or "\x00" in info.filename:
                raise ValueError("归档包含不安全的成员路径")
            if info.flag_bits & 1:
                raise ValueError("暂不支持加密归档")
            if name.name.lower() == "comicinfo.xml":
                if info.file_size > MAX_XML_BYTES:
                    warnings.append("ComicInfo超过1MB，已跳过元数据")
                    continue
                xml = archive.read(info).decode("utf-8-sig", "replace")
                if "<!DOCTYPE" in xml.upper() or "<!ENTITY" in xml.upper():
                    warnings.append("ComicInfo包含不支持的XML声明，已跳过元数据")
                    continue
                try:
                    root = ElementTree.fromstring(xml)
                    metadata = {child.tag.split("}")[-1]: (child.text or "").strip() for child in root}
                    metadata["gallery_id"] = gallery_id_from_xml(xml)
                except ElementTree.ParseError:
                    warnings.append("ComicInfo格式错误，已使用文件名")
            if name.suffix.lower() in IMAGE_EXTENSIONS:
                images.append((position, info))
        if not images:
            raise ValueError("归档中没有可阅读图片")
        images.sort(key=lambda item: _natural_key(item[1].filename))
        dimensions = {}
        # ponytail: try at most three covers to bound remote reads; more failures remain a reported error.
        for cover_index, (_, cover) in enumerate(images[:3], 1):
            try:
                if cover.file_size > MAX_COVER_BYTES:
                    raise ValueError("封面图片超过64MB")
                with Image.open(BytesIO(archive.read(cover))) as image:
                    width, height = image.size
                    if width * height > 30000000:
                        raise ValueError("封面图片像素超过3000万")
                    image.draft("RGB", (512, 768))
                    image = ImageOps.exif_transpose(image)
                    image.thumbnail((512, 768), Image.Resampling.LANCZOS)
                    image = image.convert("RGB")
                    output = BytesIO()
                    image.save(output, format="JPEG", quality=78, optimize=True)
                dimensions[cover_index] = (width, height)
                break
            except (OSError, ValueError, Image.DecompressionBombError, zipfile.BadZipFile) as exc:
                warnings.append(f"第{cover_index}页封面不可用：{str(exc)[:100]}")
        else:
            raise ValueError("前几页均无法生成封面：" + "; ".join(warnings[-3:]))
        pages = [
            {"page_index": index, "archive_member": info.filename, "archive_position": position,
             "media_type": mimetypes.guess_type(info.filename)[0] or "application/octet-stream",
             "size_bytes": info.file_size, "crc": info.CRC,
             "width": dimensions.get(index, (None, None))[0], "height": dimensions.get(index, (None, None))[1]}
            for index, (position, info) in enumerate(images, 1)
        ]
        encoded = json.dumps(pages, ensure_ascii=False, separators=(",", ":")).encode()
        if len(encoded) > MAX_MANIFEST_BYTES:
            raise ValueError("页面索引超过32MB")
        identity = [(info.filename, info.file_size, info.CRC) for _, info in images]
        fingerprint = hashlib.sha256(json.dumps(identity, ensure_ascii=False).encode()).hexdigest()
        return {"manifest": zlib.compress(encoded), "page_count": len(pages),
                "metadata": metadata, "cover": output.getvalue(), "fingerprint": fingerprint, "warnings": warnings}
