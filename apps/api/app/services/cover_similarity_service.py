from __future__ import annotations

from functools import lru_cache
from io import BytesIO
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import imagehash
from PIL import Image, ImageOps, ImageStat

from app.services.nhentai_client import NhentaiApiError


MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_IMAGE_PIXELS = 30_000_000
MIN_COVER_SCORE = 92


def fingerprint(stream):
    with Image.open(stream) as original:
        original.draft('RGB', (512, 768))
        if original.width * original.height > MAX_IMAGE_PIXELS:
            raise ValueError('封面像素超过限制')
        image = ImageOps.exif_transpose(original).convert('RGB')
        if ImageStat.Stat(image.convert('L').resize((64, 64))).stddev[0] < 8:
            raise ValueError('封面缺少可识别细节')
        return {'phash': str(imagehash.phash(image, hash_size=16)),
                'dhash': str(imagehash.dhash(image, hash_size=16)),
                'ratio': image.width / image.height}


@lru_cache(maxsize=2048)
def local_fingerprint(path, size, mtime):
    if size > MAX_IMAGE_BYTES:
        raise ValueError('封面文件过大')
    with Path(path).open('rb') as stream:
        return fingerprint(stream)


def compare_fingerprints(left, right):
    phash_distance = int(imagehash.hex_to_hash(left['phash']) - imagehash.hex_to_hash(right['phash']))
    dhash_distance = int(imagehash.hex_to_hash(left['dhash']) - imagehash.hex_to_hash(right['dhash']))
    score = round(100 * (1 - max(phash_distance, dhash_distance) / 256), 1)
    ratio_match = abs(left['ratio'] - right['ratio']) / max(left['ratio'], right['ratio']) <= .08
    return {'status': 'compared', 'score': score, 'phash_distance': phash_distance,
            'dhash_distance': dhash_distance, 'ratio_match': ratio_match,
            'similar': score >= MIN_COVER_SCORE and ratio_match,
            'algorithm': 'ImageHash pHash/dHash 256'}


class CoverSimilarityService:
    def __init__(self, client, covers_dir):
        self.client, self.covers_dir = client, Path(covers_dir).resolve()
        self.remote_fingerprint = lru_cache(maxsize=4096)(self._remote_fingerprint)

    def _remote_fingerprint(self, path, thumbnail):
        parsed = urlsplit(path)
        if parsed.scheme and parsed.scheme not in {'http', 'https'}:
            raise ValueError('无效的图片地址')
        path = urlunsplit(('', '', parsed.path, parsed.query, ''))
        with self.client.open_media(path, thumbnail=thumbnail, timeout=10) as response:
            body = response.read(MAX_IMAGE_BYTES + 1)
        if len(body) > MAX_IMAGE_BYTES:
            raise ValueError('远端封面文件过大')
        return fingerprint(BytesIO(body))

    def compare(self, cover_path, payload):
        remote = payload.get('thumbnail') or payload.get('cover')
        path = remote.get('path') if isinstance(remote, dict) else remote if isinstance(remote, str) else None
        if not path:
            return {'status': 'unavailable', 'score': None, 'reason': '远端没有可用封面'}
        try:
            parsed = urlsplit(path)
            if parsed.scheme and parsed.scheme not in {'http', 'https'}:
                raise ValueError('无效的封面地址')
            path = urlunsplit(('', '', parsed.path, parsed.query, ''))
            source = Path(cover_path or '')
            local = source.resolve()
            if self.covers_dir not in local.parents or source.is_symlink():
                raise ValueError('本地封面不可用')
            info = local.stat()
            left = local_fingerprint(str(local), info.st_size, info.st_mtime_ns)
            right = self.remote_fingerprint(path, bool(payload.get('thumbnail')))
            return compare_fingerprints(left, right)
        except NhentaiApiError as exc:
            if exc.status_code == 429:
                raise
            return {'status': 'unavailable', 'score': None, 'reason': '远端封面暂时无法比对'}
        except (OSError, ValueError, Image.DecompressionBombError):
            return {'status': 'unavailable', 'score': None, 'reason': '封面不可用或无法安全解码'}
