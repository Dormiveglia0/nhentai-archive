from __future__ import annotations

import hashlib
import json
import math
import random
import re
import threading
import time
from collections import OrderedDict
from io import BytesIO
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from PIL import Image, ImageOps

from app.services.cover_similarity_service import MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS


class ImageSearchError(ValueError):
    pass


def prepare_image(body):
    if len(body) > 64 * 1024**2:
        raise ValueError('图片超过64MB，无法搜图')
    try:
        original = Image.open(BytesIO(body))
    except Image.DecompressionBombError as exc:
        raise ValueError('图片像素超过3000万，无法搜图') from exc
    with original:
        if original.width * original.height > MAX_IMAGE_PIXELS:
            raise ValueError('图片像素超过3000万，无法搜图')
        image = ImageOps.exif_transpose(original).convert('RGB')
        image.thumbnail((1200, 1200))
        result = BytesIO()
        image.save(result, 'JPEG', quality=85)
        return result.getvalue()


def parse_results(payload):
    if not isinstance(payload, dict) or not str(payload.get('schema_version', '')).startswith('2.') or not isinstance(payload.get('results'), list):
        raise ImageSearchError('SoutuBot 接口格式已变化，请稍后重试或手动搜索')
    hits = {}
    for row in payload['results'][:100]:
        if not isinstance(row, dict):
            continue
        score = row.get('score')
        if isinstance(score, bool) or not isinstance(score, (int, float)) or not math.isfinite(score) or not 25 <= score <= 100:
            continue
        segments = row.get('path_segments')
        for segment in segments[:100] if isinstance(segments, list) else []:
            if not isinstance(segment, dict) or segment.get('source_key') != 'nhentai':
                continue
            external_id = str(segment.get('external_id', ''))
            if not re.fullmatch(r'[1-9][0-9]{0,17}', external_id):
                continue
            gallery_id = int(external_id)
            if segment.get('source_url'):
                url = urlsplit(str(segment['source_url']))
                if url.scheme != 'https' or url.hostname != 'nhentai.net' or url.path.rstrip('/') != f'/g/{gallery_id}':
                    continue
            page = segment.get('page_no')
            page = int(page) if re.fullmatch(r'[1-9][0-9]{0,5}', str(page)) else None
            if gallery_id not in hits or hits[gallery_id]['score'] < score:
                hits[gallery_id] = {'gallery_id': gallery_id, 'score': round(score, 2), 'page': page}
    return sorted(hits.values(), key=lambda row: row['score'], reverse=True)[:5]


class ImageSearchService:
    def __init__(self, archive, covers_dir):
        self.archive, self.covers_dir = archive, Path(covers_dir).resolve()
        self._condition = threading.Condition()
        self._next_at = self._blocked_until = 0.0
        self._blocked_reason = ''
        self._cache = OrderedDict()

    def sample(self, snapshot, mode, exclude=()):
        if mode == 'cover':
            source = Path(snapshot['work'].get('cover_path') or '')
            path = source.resolve()
            if source.is_symlink() or self.covers_dir not in path.parents or path.stat().st_size > MAX_IMAGE_BYTES:
                raise ValueError('本地封面不可用')
            return prepare_image(path.read_bytes()), None
        if mode != 'page' or not self.archive:
            raise ValueError('内页搜图暂不可用')
        source = self.archive.cache.direct_source(snapshot['work']['id'])
        if not snapshot['file'] or source['id'] != snapshot['file']['id']:
            raise ValueError('当前来源已变化，请刷新后搜图')
        pages = [row['page_index'] for row in self.archive.list_pages(snapshot['work']['id'])
                 if 1 < row['page_index'] < snapshot['work']['page_count'] and row['page_index'] not in exclude]
        if not pages:
            raise ValueError('没有可抽取的独立内页')
        page = random.SystemRandom().choice(pages)
        body, _ = self.archive.read_page(snapshot['work']['id'], page, source_revision=self.archive.cache.revision(source))
        return prepare_image(body), page

    def lookup(self, snapshot, mode, cancelled=lambda: False):
        with self._condition:
            if self._blocked_until > time.monotonic():
                raise ImageSearchError(self._blocked_reason)
        body, page = self.sample(snapshot, mode)
        return self.search(body, cancelled), body, page

    def _block(self, message, seconds):
        with self._condition:
            self._blocked_until, self._blocked_reason = time.monotonic() + seconds, message
        raise ImageSearchError(message)

    def search(self, body, cancelled=lambda: False):
        key = hashlib.sha256(body).digest()
        with self._condition:
            if key in self._cache:
                self._cache.move_to_end(key)
                return self._cache[key]
            while True:
                if cancelled():
                    raise InterruptedError('搜图已暂停')
                if self._blocked_until > time.monotonic():
                    raise ImageSearchError(self._blocked_reason)
                delay = self._next_at - time.monotonic()
                if delay <= 0:
                    self._next_at = time.monotonic() + 5
                    break
                self._condition.wait(min(.2, delay))
        try:
            with httpx.Client(timeout=httpx.Timeout(30, connect=10), follow_redirects=False) as client:
                with client.stream('POST', 'https://soutubot.moe/api/search',
                                   files={'file': ('image.jpg', body, 'image/jpeg')},
                                   data={'factor': '1.2', 'metadata_mode': 'display', 'top_k': '10'},
                                   headers={'Accept': 'application/json', 'User-Agent': 'NH-Archive image-index/1.0',
                                            'Origin': 'https://soutubot.moe', 'Referer': 'https://soutubot.moe/'}) as response:
                    if response.status_code in {401, 403}:
                        self._block('SoutuBot 拒绝访问，已暂停搜图；请稍后重试或手动搜索', 3600)
                    if response.status_code == 429:
                        retry = response.headers.get('Retry-After', '')
                        self._block('SoutuBot 请求限流，已暂停搜图，请稍后重试', max(60, min(86400, int(retry))) if retry.isdecimal() else 300)
                    if response.status_code != 200:
                        self._block(f'SoutuBot 暂不可用（HTTP {response.status_code}），请稍后重试', 60)
                    content = bytearray()
                    for chunk in response.iter_bytes():
                        content.extend(chunk)
                        if len(content) > 2 * 1024**2:
                            self._block('SoutuBot 返回结果过大，已停止读取', 60)
                    hits = parse_results(json.loads(content))
        except (httpx.HTTPError, OSError, ValueError) as exc:
            if isinstance(exc, ImageSearchError):
                raise
            self._block('SoutuBot 请求失败或响应无效，请稍后重试', 60)
        with self._condition:
            self._cache[key] = hits
            while len(self._cache) > 128:
                self._cache.popitem(last=False)
        return hits
