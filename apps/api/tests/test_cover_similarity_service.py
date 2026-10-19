import io
import json
from pathlib import Path

from PIL import Image, ImageDraw

from app.services.cover_similarity_service import CoverSimilarityService


def cover_image(different=False):
    image = Image.new('RGB', (480, 720), '#eee6d5')
    draw = ImageDraw.Draw(image)
    if different:
        for x in range(0, 480, 60):
            draw.rectangle((x, 0, x + 24, 720), fill='#273b58')
        draw.ellipse((40, 80, 440, 650), fill='#c85d32')
    else:
        draw.rectangle((40, 55, 420, 150), fill='#b32a24')
        draw.polygon([(25, 650), (175, 220), (290, 470), (430, 300), (470, 650)], fill='#32445b')
        draw.ellipse((310, 180, 400, 270), fill='#d79537')
    return image


def service(tmp_path, image):
    body = io.BytesIO()
    image.resize((160, 240)).save(body, format='JPEG', quality=75)
    class Client:
        calls = 0
        def open_media(self, path, thumbnail, timeout):
            self.calls += 1
            assert path == '/cover.jpg' and thumbnail and timeout <= 10
            return io.BytesIO(body.getvalue())
    root = tmp_path / 'covers'
    root.mkdir()
    local = root / 'local.jpg'
    cover_image().save(local)
    client = Client()
    return CoverSimilarityService(client, root), local, client


def test_resized_compressed_cover_matches_and_reuses_remote_fingerprint(tmp_path):
    matcher, local, client = service(tmp_path, cover_image())
    payload = {'thumbnail': {'path': 'https://cdn.example/cover.jpg'}}
    first = matcher.compare(str(local), payload)
    assert first['status'] == 'compared' and first['similar'] and first['score'] >= 92
    assert first['ratio_match']
    assert json.loads(json.dumps(first)) == first
    assert matcher.compare(str(local), payload) == first and client.calls == 1
    cover_image(different=True).save(local)
    assert not matcher.compare(str(local), payload)['similar']
    assert client.calls == 1


def test_different_cover_is_not_similar(tmp_path):
    matcher, local, _client = service(tmp_path, cover_image(different=True))
    result = matcher.compare(str(local), {'thumbnail': '/cover.jpg'})
    assert result['status'] == 'compared' and result['score'] < 92 and not result['similar']
    json.dumps(result)


def test_cover_matching_rejects_unsafe_paths_and_low_detail_images(tmp_path):
    matcher, local, client = service(tmp_path, cover_image())
    outside = tmp_path / 'outside.jpg'
    cover_image().save(outside)
    link = local.with_name('linked.jpg')
    link.symlink_to(outside)
    for path in (outside, link, Path('/missing/cover.jpg')):
        assert matcher.compare(str(path), {'thumbnail': '/cover.jpg'})['status'] == 'unavailable'
    Image.new('RGB', (480, 720), 'white').save(local)
    assert matcher.compare(str(local), {'thumbnail': '/cover.jpg'})['status'] == 'unavailable'
    assert client.calls == 0


def test_cover_matching_caps_decode_pixels(tmp_path, monkeypatch):
    matcher, local, client = service(tmp_path, cover_image())
    monkeypatch.setattr('app.services.cover_similarity_service.MAX_IMAGE_PIXELS', 100)
    assert matcher.compare(str(local), {'thumbnail': '/cover.jpg'})['status'] == 'unavailable'
    assert client.calls == 0


def test_large_jpeg_fingerprint_uses_bounded_decoder_scaling(tmp_path, monkeypatch):
    matcher, local, _client = service(tmp_path, cover_image())
    cover_image().resize((2400, 3600)).save(local, 'JPEG')
    monkeypatch.setattr('app.services.cover_similarity_service.MAX_IMAGE_PIXELS', 3_000_000)
    result = matcher.compare(str(local), {'thumbnail': '/cover.jpg'})
    assert result['status'] == 'compared' and result['similar']
