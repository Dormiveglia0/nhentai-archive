import json
import io
import threading
import time
import zipfile

import pytest
from PIL import ImageDraw

from app.services.archive_service import ArchiveService
from app.services.cover_similarity_service import CoverSimilarityService, fingerprint
from app.services.image_search_service import ImageSearchError, ImageSearchService
from app.services.metadata_refresh_service import MetadataRefreshService
from app.services.nhentai_client import NhentaiApiError
from test_cover_similarity_service import cover_image

from test_metadata_refresh_service import _indexed_service


def staged(tmp_path, monkeypatch):
    db, libraries, index, root, library, item, gallery, service = _indexed_service(tmp_path, auto_scrape=False)
    db.execute("UPDATE works SET language='chinese',favorite=1 WHERE id=?", (item['work_id'],))
    gallery['thumbnail'] = '/cover.jpg'
    monkeypatch.setattr(service, '_cover', lambda *args: {'status': 'compared', 'score': 99.2, 'similar': True, 'ratio_match': True})
    return db, item, gallery, service


def test_cover_mismatch_blocks_automatic_match_even_with_exact_title(tmp_path, monkeypatch):
    db, item, gallery, service = staged(tmp_path, monkeypatch)
    monkeypatch.setattr(service, '_cover', lambda *args: {'status': 'compared', 'score': 55, 'similar': False, 'ratio_match': True})
    row = service.preview([item['work_id']])['result'][0]['match']
    assert row['confidence'] == 100 and not row['automatic_eligible'] and '封面' in row['reason']


def test_image_evidence_cannot_override_language_or_manual_creator_conflicts(tmp_path, monkeypatch):
    db, item, gallery, service = staged(tmp_path, monkeypatch)
    snapshot = service._snapshot(item['work_id'])
    proof = {'verified': True, 'pages': [{'page': 3, 'score': 99}, {'page': 8, 'score': 99}]}
    different = {**gallery, 'tags': [{'id': 70, 'type': 'language', 'name': 'japanese', 'slug': 'japanese'}]}
    row = service._candidate(snapshot, different, 'image', 20, 0, page_proof=proof)
    assert not row['automatic_eligible'] and '语言' in row['reason']
    db.execute("INSERT OR REPLACE INTO work_metadata(work_id,field,value,source) VALUES (?,'artist','Protected Author','manual')", (item['work_id'],))
    row = service._candidate(service._snapshot(item['work_id']), gallery, 'image', 20, 0, page_proof=proof)
    assert not row['automatic_eligible'] and '作者' in row['reason']


def test_partial_tag_cache_is_refreshed_instead_of_losing_languages(tmp_path, monkeypatch):
    db, item, gallery, service = staged(tmp_path, monkeypatch)
    db.execute("INSERT INTO remote_tags(remote_id,type,name,slug,payload_json) VALUES (99,'language','chinese','chinese','{}')")
    tag = {'id': 99, 'type': 'language', 'name': 'chinese', 'slug': 'chinese'}
    calls = []
    monkeypatch.setattr(service.client, 'tags_by_ids', lambda ids: calls.append(ids) or [tag])
    payload = {'tag_ids': [99]}
    service._hydrate_tags([payload])
    assert payload['tags'] == [tag] and calls == [[99]]
    service._hydrate_tags([{'tag_ids': [99]}])
    assert len(calls) == 1


def test_batch_binds_clear_match_and_preserves_manual_metadata_and_source(tmp_path, monkeypatch):
    db, item, gallery, service = staged(tmp_path, monkeypatch)
    db.execute("INSERT INTO work_metadata(work_id,field,value,source) VALUES (?,'pretty_title','人工标题','manual')", (item['work_id'],))
    before = db.fetchall('SELECT * FROM work_files WHERE work_id=?', (item['work_id'],))
    job = service.enqueue_batch([item['work_id']])
    service.tick()
    done = service.jobs.get(job['id'])
    assert done['status'] == 'completed' and done['target']['updated'] == 1
    work = db.fetchone('SELECT * FROM works WHERE id=?', (item['work_id'],))
    assert work['remote_gallery_id'] == gallery['id'] and work['favorite'] == 1
    assert db.fetchall('SELECT * FROM work_files WHERE work_id=?', (item['work_id'],)) == before
    assert db.fetchone("SELECT value FROM work_metadata WHERE work_id=? AND field='pretty_title'", (item['work_id'],))['value'] == '人工标题'
    assert db.fetchone('SELECT scrape_status FROM library_items WHERE id=?', (item['id'],))['scrape_status'] == 'completed'
    service.run_batch(job['id'])
    assert service.jobs.get(job['id'])['target']['updated'] == 1


def test_batch_leaves_uncertain_results_with_candidates_for_review(tmp_path, monkeypatch):
    db, item, gallery, service = staged(tmp_path, monkeypatch)
    service.client.search_results = [gallery, {**gallery, 'id': 601}]
    service.tick()  # Automatic scraping is disabled; explicit jobs still work.
    job = service.enqueue_batch([item['work_id']])
    service.tick()
    row = db.fetchone('SELECT scrape_status,scrape_result_json FROM library_items WHERE id=?', (item['id'],))
    assert row['scrape_status'] == 'review' and len(json.loads(row['scrape_result_json'])['candidates']) == 2
    assert service.jobs.get(job['id'])['target']['review'] == 1
    assert db.fetchone('SELECT remote_gallery_id FROM works WHERE id=?', (item['work_id'],))['remote_gallery_id'] is None


def test_batch_cancel_before_commit_never_binds_and_releases_claim(tmp_path, monkeypatch):
    db, item, gallery, service = staged(tmp_path, monkeypatch)
    job = service.enqueue_batch([item['work_id']])
    original = service.client.gallery
    def cancel(gallery_id, **kwargs):
        service.cancel_job(job['id'])
        return original(gallery_id, **kwargs)
    monkeypatch.setattr(service.client, 'gallery', cancel)
    service.tick()
    assert service.jobs.get(job['id'])['status'] == 'cancelled'
    assert db.fetchone('SELECT remote_gallery_id FROM works WHERE id=?', (item['work_id'],))['remote_gallery_id'] is None
    assert db.fetchone('SELECT scrape_status FROM library_items WHERE id=?', (item['id'],))['scrape_status'] == 'pending'


def test_batch_pause_blocks_commit_then_resumes_from_same_work(tmp_path, monkeypatch):
    db, item, gallery, service = staged(tmp_path, monkeypatch)
    job = service.enqueue_batch([item['work_id']])
    paused = threading.Event()
    original = service.client.gallery
    def pause(gallery_id, **kwargs):
        service.jobs.pause(job['id'])
        paused.set()
        return original(gallery_id, **kwargs)
    monkeypatch.setattr(service.client, 'gallery', pause)
    thread = threading.Thread(target=service.tick)
    thread.start()
    try:
        assert paused.wait(3)
        assert db.fetchone('SELECT remote_gallery_id FROM works WHERE id=?', (item['work_id'],))['remote_gallery_id'] is None
        service.resume_job(job['id'])
        thread.join(3)
        assert not thread.is_alive() and service.jobs.get(job['id'])['status'] == 'completed'
    finally:
        service._closing.set()
        thread.join(3)


def test_batch_rejects_changed_remote_id_and_concurrent_manual_edit(tmp_path, monkeypatch):
    db, item, gallery, service = staged(tmp_path, monkeypatch)
    original = service.client.gallery
    monkeypatch.setattr(service.client, 'gallery', lambda *args, **kwargs: {**gallery, 'id': 901})
    job = service.enqueue_batch([item['work_id']])
    service.tick()
    assert service.jobs.get(job['id'])['target']['review'] == 1
    assert db.fetchone('SELECT remote_gallery_id FROM works WHERE id=?', (item['work_id'],))['remote_gallery_id'] is None
    def changed(*args, **kwargs):
        db.execute("INSERT OR REPLACE INTO work_metadata(work_id,field,value,source) VALUES (?,'pretty_title','编辑中的标题','manual')", (item['work_id'],))
        return original(*args, **kwargs)
    monkeypatch.setattr(service.client, 'gallery', changed)
    job = service.enqueue_batch([item['work_id']])
    service.tick()
    row = db.fetchone('SELECT scrape_status,scrape_result_json FROM library_items WHERE id=?', (item['id'],))
    assert row['scrape_status'] == 'review' and '变化' in json.loads(row['scrape_result_json'])['reason']
    assert service.jobs.get(job['id'])['target']['updated'] == 0


@pytest.mark.parametrize('provider', ['soutubot', 'nhentai'])
def test_rate_limit_keeps_cursor_and_cooldown_across_pause_and_restart(tmp_path, monkeypatch, provider):
    db, item, gallery, service = staged(tmp_path, monkeypatch)
    candidates, _ = service._candidates(service._snapshot(item['work_id']), bind=True)
    assert candidates[0]['automatic_eligible']
    monkeypatch.setattr(service, '_candidates', lambda *args, **kwargs: ([], ''))
    def limited(*args):
        if provider == 'soutubot':
            raise ImageSearchError('SoutuBot 请求限流', retry_after=120)
        raise NhentaiApiError(429, 'rate_limited', 'Remote API cooldown active', retry_after=120)
    monkeypatch.setattr(service, '_image_candidates', limited)
    job = service.enqueue_batch([item['work_id']], reverse_images=True)
    def shutdown(_):
        assert service.jobs.get(job['id'])['stage'] == 'remote_cooldown'
        service.jobs.pause(job['id'])
        service._closing.set()
    monkeypatch.setattr(service._closing, 'wait', shutdown)
    service.tick()
    paused = service.jobs.get(job['id'])
    assert paused['status'] == 'paused' and paused['target']['cursor'] == 0
    assert paused['target']['review'] == paused['target']['updated'] == 0
    assert paused['target']['retry_at'] >= time.time() + 119
    assert db.fetchone('SELECT scrape_status FROM library_items WHERE id=?', (item['id'],))['scrape_status'] == 'pending'

    restarted = MetadataRefreshService(db, service.client, service.discover, service.dictionary, service.libraries)
    clock = [time.time()]
    monkeypatch.setattr('app.services.metadata_refresh_service.time.time', lambda: clock[0])
    monkeypatch.setattr(restarted, '_cover', service._cover)
    monkeypatch.setattr(restarted, '_candidates', lambda *args, **kwargs: ([], ''))
    def images(*args):
        assert clock[0] >= paused['target']['retry_at']
        return candidates, ''
    monkeypatch.setattr(restarted, '_image_candidates', images)
    monkeypatch.setattr(restarted._closing, 'wait', lambda _: clock.__setitem__(0, paused['target']['retry_at']))
    restarted.resume_job(job['id'])
    restarted.tick()
    done = restarted.jobs.get(job['id'])
    assert done['status'] == 'completed' and done['target']['cursor'] == done['target']['updated'] == 1
    assert done['target']['review'] == 0 and 'retry_at' not in done['target']
    assert db.fetchone('SELECT remote_gallery_id FROM works WHERE id=?', (item['work_id'],))['remote_gallery_id'] == gallery['id']


def test_two_independent_interior_images_verify_source_and_reject_repeated_art(tmp_path, monkeypatch):
    db, libraries, index, root, library, item, gallery, service = _indexed_service(tmp_path, auto_scrape=False)
    pages = {}
    with zipfile.ZipFile(root / 'book.cbz', 'w') as archive:
        for number in range(1, 9):
            image = cover_image()
            draw = ImageDraw.Draw(image)
            draw.rectangle((number * 35, number * 50, number * 35 + 100, number * 50 + 200), fill='black')
            body = io.BytesIO()
            image.save(body, 'JPEG')
            pages[f'/page-{number}.jpg'] = body.getvalue()
            archive.writestr(f'{number:03}.jpg', body.getvalue())
    index.scan(library['id'])
    item = db.fetchone('SELECT * FROM library_items WHERE id=?', (item['id'],))
    archive = ArchiveService(db, libraries.settings)
    service.images = ImageSearchService(archive, libraries.settings.covers_dir)
    service.covers = CoverSimilarityService(service.client, libraries.settings.covers_dir)
    monkeypatch.setattr(service.client, 'open_media', lambda path, **kwargs: io.BytesIO(pages[path]))
    payload = {**gallery, 'num_pages': 8, 'pages': list(pages)}
    snapshot = service._snapshot(item['work_id'])
    before = (root / 'book.cbz').read_bytes()
    proof = service._page_proof(snapshot, payload)
    assert proof['verified'] and len(proof['pages']) == 2
    assert abs(proof['pages'][0]['page'] - proof['pages'][1]['page']) > 1
    assert (root / 'book.cbz').read_bytes() == before
    assert not db.fetchone('SELECT 1 FROM archive_cache')
    repeated = pages['/page-3.jpg']
    monkeypatch.setattr(service.images, 'sample', lambda *args: (repeated, 3 if not args[2] else 6))
    monkeypatch.setattr(service.covers, 'remote_fingerprint', lambda *args: fingerprint(io.BytesIO(repeated)))
    assert not service._page_proof(snapshot, payload)['verified']
    archive.cache.close()
