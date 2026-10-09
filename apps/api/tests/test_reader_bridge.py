import copy
import io
import zipfile
from email.message import Message

import pytest
from PIL import Image

from app.services.archive_service import ArchiveService
from app.services.job_service import JobService
from app.services.library_scan_job_service import LibraryScanJobService
from app.services.reader_bridge_service import ReaderBridgeService
from test_library_index import create_archive, setup_index
from test_archive_cache import wait_for_cache


class MediaResponse(io.BytesIO):
    def __init__(self, body):
        super().__init__(body)
        self.headers = Message(); self.headers['Content-Type'] = 'image/jpeg'


class RemoteClient:
    def __init__(self, bodies):
        self.bodies = bodies
        self.payload = {'id': 10, 'num_pages': len(bodies), 'pages': [f'/pages/{i}.jpg' for i in range(1, len(bodies) + 1)]}
    def gallery(self, gallery_id, **kwargs):
        return copy.deepcopy(self.payload)
    def open_media(self, path, **kwargs):
        return MediaResponse(self.bodies[int(path.split('/')[-1].split('.')[0]) - 1])


def setup_bridge(tmp_path):
    settings, db, libraries, index, root, library = setup_index(tmp_path)
    path = root / 'one.cbz'; create_archive(path)
    with zipfile.ZipFile(path) as cbz:
        members = {name: cbz.read(name) for name in cbz.namelist()}
    image = io.BytesIO(); Image.new('RGB', (1200, 1600), 'white').save(image, format='JPEG')
    members['nested/Cover.jpg'] = image.getvalue()
    with zipfile.ZipFile(path, 'w') as cbz:
        for name, body in members.items(): cbz.writestr(name, body)
    index.scan(library['id'])
    work_id = db.fetchone('SELECT id FROM works')['id']
    db.execute('UPDATE works SET remote_gallery_id=10 WHERE id=?', (work_id,))
    with zipfile.ZipFile(path) as cbz:
        bodies = [cbz.read(name) for name in ['nested/001.jpg', 'nested/Cover.jpg']]
    archive = ArchiveService(db, settings); jobs = JobService(db); client = RemoteClient(bodies)
    bridge = ReaderBridgeService(db, archive, client, jobs)
    runner = LibraryScanJobService(settings, jobs, index, libraries); runner.bridge = bridge
    runner._start_worker = lambda job_id: None
    return db, index, library, work_id, client, bridge, runner, jobs


def test_verified_bridge_checks_every_page_and_invalidates_changed_response_and_binding(tmp_path):
    db, index, library, work_id, client, bridge, runner, jobs = setup_bridge(tmp_path)
    assert not bridge.status(work_id)['eligible']
    job = runner.enqueue_verification(work_id)
    bridge.run(job['id'], lambda: jobs.checkpoint(job['id']))
    assert jobs.get(job['id'])['status'] == 'completed'
    status = bridge.status(work_id, fresh=True)
    assert status['eligible'] and len(status['pages']) == 2
    assert bridge.page(work_id, 1, status['version'])[0] == client.bodies[0]
    assert not bridge.enable(work_id, False)['eligible']
    bridge.enable(work_id, True)
    client.bodies[0] += b'changed'
    with pytest.raises(ValueError, match='内容已变化'):
        bridge.page(work_id, 1, status['version'])
    assert not bridge.status(work_id)['eligible']
    db.execute('UPDATE works SET remote_gallery_id=11 WHERE id=?', (work_id,))
    assert not bridge.status(work_id)['eligible']
    assert not db.fetchall('PRAGMA foreign_key_check')


def test_mismatch_and_source_change_never_enable_bridge(tmp_path):
    db, index, library, work_id, client, bridge, runner, jobs = setup_bridge(tmp_path)
    client.payload['num_pages'] = 3; client.payload['pages'].append('/pages/3.jpg')
    job = runner.enqueue_verification(work_id)
    bridge.run(job['id'], lambda: jobs.checkpoint(job['id']))
    assert jobs.get(job['id'])['status'] == 'failed' and '远端3页' in jobs.get(job['id'])['error']
    assert not bridge.status(work_id)['eligible']
    client.payload['num_pages'] = 2; client.payload['pages'].pop()
    original = client.bodies[1]
    client.bodies[1] += b'different'
    job = runner.enqueue_verification(work_id)
    bridge.run(job['id'], lambda: jobs.checkpoint(job['id']))
    assert jobs.get(job['id'])['status'] == 'failed' and '第2页' in jobs.get(job['id'])['error']
    client.bodies[1] = original
    job = runner.enqueue_verification(work_id)
    db.execute('UPDATE library_items SET mtime_ns=mtime_ns+1 WHERE library_id=?', (library['id'],))
    bridge.run(job['id'], lambda: jobs.checkpoint(job['id']))
    assert jobs.get(job['id'])['status'] == 'failed' and not bridge.status(work_id)['eligible']


def test_reordered_pages_and_remote_catalog_changes_fail_closed(tmp_path):
    db, index, library, work_id, client, bridge, runner, jobs = setup_bridge(tmp_path)
    assert client.bodies[0] != client.bodies[1]
    client.payload['pages'].reverse()
    job = runner.enqueue_verification(work_id)
    bridge.run(job['id'], lambda: jobs.checkpoint(job['id']))
    assert jobs.get(job['id'])['status'] == 'failed'
    assert not bridge.status(work_id)['eligible']
    client.payload['pages'].reverse()
    job = runner.enqueue_verification(work_id)
    bridge.run(job['id'], lambda: jobs.checkpoint(job['id']))
    assert bridge.status(work_id)['eligible']
    client.payload['pages'].pop(); client.payload['num_pages'] = 1
    assert not bridge.status(work_id, fresh=True)['eligible']


def test_physical_source_change_invalidates_bridge_before_rescan(tmp_path):
    db, index, library, work_id, client, bridge, runner, jobs = setup_bridge(tmp_path)
    job = runner.enqueue_verification(work_id)
    bridge.run(job['id'], lambda: jobs.checkpoint(job['id']))
    assert bridge.status(work_id)['eligible']
    bridge.archive.libraries.update(library['id'], {'config': {'cache_mode': 'always'}})
    source = bridge.archive.libraries.source_file(work_id)
    path = bridge.archive.libraries.resolve_file(source)
    path.write_bytes(path.read_bytes() + b'changed-before-scan')
    result = wait_for_cache(bridge.archive.cache, bridge.archive.cache.prepare(work_id))
    assert result['status'] == 'failed'
    assert not bridge.status(work_id)['eligible']
    bridge.archive.cache.close()
