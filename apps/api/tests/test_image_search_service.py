import io

import httpx
import pytest
from PIL import Image

from app.services.image_search_service import ImageSearchError, ImageSearchService, parse_results, prepare_image
from test_cover_similarity_service import cover_image


def response_for(gallery_id='123', score=48, **segment):
    return {'schema_version': '2.2', 'results': [{'score': score, 'path_segments': [
        {'source_key': 'nhentai', 'external_id': gallery_id, 'page_no': 4,
         'source_url': f'https://nhentai.net/g/{gallery_id}/', **segment}]}]}


def transport(monkeypatch, handler):
    client = httpx.Client
    monkeypatch.setattr('app.services.image_search_service.httpx.Client', lambda **kwargs: client(transport=httpx.MockTransport(handler), **kwargs))


def test_parser_accepts_only_valid_nhentai_ids_and_deduplicates():
    payload = response_for()
    payload['results'] += response_for(score=52)['results']
    payload['results'] += response_for('124', source_key='ehentai')['results']
    payload['results'] += response_for('125', source_url='https://evil.example/g/125/')['results']
    payload['results'] += response_for('9' * 30)['results']
    payload['results'] += response_for('126', score=float('nan'))['results']
    assert parse_results(payload) == [{'gallery_id': 123, 'score': 52, 'page': 4}]
    with pytest.raises(ImageSearchError, match='格式'):
        parse_results({'data': []})


def test_upload_strips_metadata_resizes_and_uses_generic_filename(tmp_path, monkeypatch):
    original = io.BytesIO()
    image = cover_image().resize((2000, 3000))
    exif = Image.Exif()
    exif[270] = str(tmp_path / 'private-source.cbz')
    image.save(original, 'JPEG', exif=exif)
    upload = prepare_image(original.getvalue())
    with Image.open(io.BytesIO(upload)) as decoded:
        assert max(decoded.size) <= 1200 and not decoded.getexif()
    calls = []
    def handle(request):
        calls.append(request)
        body = request.read()
        assert request.url == 'https://soutubot.moe/api/search'
        assert b'filename="image.jpg"' in body and b'name="metadata_mode"' in body
        assert 'Authorization' not in request.headers and 'Cookie' not in request.headers
        assert str(tmp_path).encode() not in body
        return httpx.Response(200, json=response_for())
    transport(monkeypatch, handle)
    service = ImageSearchService(None, tmp_path)
    assert service.search(upload)[0]['gallery_id'] == 123
    assert service.search(upload)[0]['score'] == 48 and len(calls) == 1


@pytest.mark.parametrize('status', [403, 429, 503])
def test_provider_rejection_cools_down_without_uploading_again(tmp_path, monkeypatch, status):
    calls = []
    def handle(request):
        calls.append(request)
        return httpx.Response(status, headers={'Retry-After': '120'})
    transport(monkeypatch, handle)
    service = ImageSearchService(None, tmp_path)
    for _ in range(2):
        with pytest.raises(ImageSearchError) as error:
            service.search(b'jpeg')
        assert 119 <= error.value.retry_after <= 120 if status == 429 else error.value.retry_after == 0
    assert len(calls) == 1


def test_response_size_limit_and_cancel_prevent_more_network_io(tmp_path, monkeypatch):
    transport(monkeypatch, lambda request: httpx.Response(200, content=b'x' * (2 * 1024**2 + 1)))
    service = ImageSearchService(None, tmp_path)
    with pytest.raises(ImageSearchError, match='过大'):
        service.search(b'jpeg')
    with pytest.raises(InterruptedError):
        ImageSearchService(None, tmp_path).search(b'jpeg', lambda: True)


def test_daily_quota_cools_down_for_a_day_without_another_upload(tmp_path, monkeypatch):
    calls = []
    def handle(request):
        calls.append(request)
        return httpx.Response(429, json={'detail': '今日搜索次数已用完，请稍后再试'})
    transport(monkeypatch, handle)
    service = ImageSearchService(None, tmp_path)
    with pytest.raises(ImageSearchError, match='今日搜图额度已用完') as first:
        service.search(b'jpeg')
    assert first.value.retry_after == 86400
    with pytest.raises(ImageSearchError) as again:
        service.lookup({}, 'cover')
    assert 86399 <= again.value.retry_after <= 86400 and len(calls) == 1


def test_random_page_reads_one_versioned_page_without_copying_archive(tmp_path):
    class Cache:
        def direct_source(self, work_id):
            assert work_id == 1
            return {'id': 7}
        def revision(self, source):
            return 'version'
    class Archive:
        cache = Cache()
        def list_pages(self, work_id):
            return [{'page_index': value} for value in range(1, 8)]
        def read_page(self, work_id, page, source_revision):
            assert work_id == 1 and page in {2, 3, 4, 5, 6} and source_revision == 'version'
            body = io.BytesIO()
            cover_image().save(body, 'JPEG')
            return body.getvalue(), 'image/jpeg'
    service = ImageSearchService(Archive(), tmp_path)
    body, page = service.sample({'work': {'id': 1, 'page_count': 7}, 'file': {'id': 7}}, 'page', exclude=(2, 3, 4, 5))
    assert page == 6 and body.startswith(b'\xff\xd8')


def test_large_jpeg_search_scales_at_decode_before_pixel_limit(monkeypatch):
    body = io.BytesIO()
    cover_image().resize((2400, 3600)).save(body, 'JPEG')
    monkeypatch.setattr('app.services.image_search_service.MAX_IMAGE_PIXELS', 3_000_000)
    prepared = prepare_image(body.getvalue())
    with Image.open(io.BytesIO(prepared)) as image:
        assert max(image.size) <= 1200
