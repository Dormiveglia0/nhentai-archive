import pytest

from app.database import Database
from app.services.library_service import LibraryService
from app.services.dictionary_service import DictionaryService


@pytest.fixture
def library(tmp_path):
    db = Database(tmp_path / 'archive.db')
    db.init_schema()
    return LibraryService(db)


def work(library, title, authors=()):
    work_id = library.db.execute("INSERT INTO works(title,source) VALUES (?,'local')", (title,)).lastrowid
    for name in authors:
        library.db.execute("INSERT INTO work_tags(work_id,tag_type,remote_name,remote_slug,source) VALUES (?,'artist',?,?,'manual')", (work_id, name, name.casefold()))
    return work_id


def test_manual_groups_merge_across_pages_and_keep_selection_scoped_to_filters(library):
    a, b, c = [work(library, title) for title in ('Alpha', 'Middle', 'Zulu')]
    group = library.groups.create('Series', [a, c])
    first = library.search(sort='title', per_page=1, group_by='manual')
    second = library.search(sort='title', page=2, per_page=1, group_by='manual')
    assert first['total'] == 2 and first['work_total'] == 3 and first['num_pages'] == 2
    assert first['result'][0]['group']['member_ids'] == [a, c]
    assert second['result'][0]['id'] == b and 'group' not in second['result'][0]
    assert library.search()['total'] == 3
    assert {row['id'] for row in library.search(group_key=group['key'])['result']} == {a, c}
    library.set_favorite(c, True)
    filtered = library.search(favorite_only=True, group_by='manual')
    assert filtered['total'] == filtered['work_total'] == 1
    assert filtered['result'][0]['group']['member_ids'] == [c]
    assert filtered['result'][0]['group']['total_count'] == 2


def test_membership_conflicts_are_atomic_and_stale_edits_are_rejected(library):
    a, b, c, d = [work(library, title) for title in ('A', 'B', 'C', 'D')]
    first = library.groups.create('First', [a, b])
    second = library.groups.create('Second', [c, d])
    revision = library.revision()
    with pytest.raises(ValueError, match='其他分组'):
        library.groups.update(first['id'], first['version'], name='Lost change', add_ids=[c])
    assert library.groups.get(first['id'])['name'] == 'First'
    assert library.revision() == revision
    updated = library.groups.update(first['id'], first['version'], name='Renamed', remove_ids=[b])
    assert updated['member_ids'] == [a]
    with pytest.raises(ValueError, match='已变化'):
        library.groups.update(first['id'], first['version'], name='Stale')
    with pytest.raises(ValueError, match='已变化'):
        library.groups.dissolve(first['id'], first['version'])
    updated = library.groups.update(first['id'], updated['version'], add_ids=[b])
    assert updated['member_ids'] == [a, b]
    library.groups.dissolve(first['id'], updated['version'])
    assert library.search()['total'] == 4
    assert library.groups.get(second['id'])['member_ids'] == [c, d]


def test_work_deletion_updates_membership_version_and_cleans_empty_group(library):
    a, b = work(library, 'A'), work(library, 'B')
    group = library.groups.create('Group', [a, b])
    library.db.execute('DELETE FROM works WHERE id=?', (a,))
    current = library.groups.get(group['id'])
    assert current['member_ids'] == [b] and current['version'] > group['version']
    library.db.execute('DELETE FROM works WHERE id=?', (b,))
    assert not library.db.fetchone('SELECT 1 FROM work_groups')
    assert not library.db.fetchone('SELECT 1 FROM work_group_members')


def test_author_grouping_uses_complete_author_sets_dictionary_aliases_and_manual_priority(library):
    dictionary = DictionaryService(library.db, None)
    dictionary.apply({'original_text': 'Writer', 'tag_type': 'artist', 'zh_name': '作者', 'aliases': ['Alias'], 'status': 'configured'})
    a, b, c = work(library, 'A', ['Writer']), work(library, 'B', ['Alias']), work(library, 'C', ['作者'])
    collab = work(library, 'Collaboration', ['Writer', 'Other'])
    other_collab = work(library, 'Other collaboration', ['Other', 'Alias'])
    unknown, unknown2 = work(library, 'Unknown'), work(library, 'Unknown two', ['unknown'])
    result = library.search(group_by='author', sort='title')
    groups = [row['group'] for row in result['result'] if row.get('group')]
    assert {frozenset(group['member_ids']) for group in groups} == {frozenset([a, b, c]), frozenset([collab, other_collab])}
    assert {row['id'] for row in result['result'] if not row.get('group')} == {unknown, unknown2}
    author_key = next(group['key'] for group in groups if a in group['member_ids'])
    members = library.search(group_by='author', group_key=author_key, per_page=1, page=2, sort='title')
    assert members['total'] == 3 and members['result'][0]['id'] == b
    manual = library.groups.create('Chosen', [a, collab])
    result = library.search(group_by='author')
    occurrences = [work_id for row in result['result'] for work_id in (row.get('group', {}).get('member_ids') or [row['id']])]
    assert sorted(occurrences) == sorted([a,b,c,collab,other_collab,unknown,unknown2])
    assert next(row['group'] for row in result['result'] if row.get('group', {}).get('id') == manual['id'])['member_ids'] == [collab, a]


def test_manual_author_overrides_old_tags_when_grouping(library):
    a, b, c = work(library, 'A', ['Old']), work(library, 'B', ['New']), work(library, 'C', ['Old'])
    library.db.execute("INSERT INTO work_metadata(work_id,field,value,source) VALUES (?,'artist','New','manual')", (a,))
    result = library.search(group_by='author')
    assert next(row['group'] for row in result['result'] if row.get('group'))['member_ids'] == [b, a]
    assert any(row['id'] == c and not row.get('group') for row in result['result'])


def test_author_identity_unifies_comicinfo_and_remote_tags_without_duplicate_names(library):
    a, b, c = work(library, 'A', ['Writer']), work(library, 'B'), work(library, 'C', ['Writer'])
    library.db.execute("INSERT INTO remote_tags(remote_id,type,name,slug,payload_json) VALUES (501,'artist','Writer','writer','{}')")
    for work_id in (a, b):
        library.db.execute("INSERT INTO work_tags(work_id,remote_tag_id,tag_type,remote_name,source) VALUES (?,501,'artist','Writer','remote')", (work_id,))
    result = library.search(group_by='author')['result']
    assert len(result) == 1 and set(result[0]['group']['member_ids']) == {a,b,c}
    assert result[0]['group']['name'] == 'Writer'


@pytest.mark.parametrize('ids', [[1], [1, 999999], [1, -1], [1, 2**64]])
def test_invalid_group_members_do_not_leave_partial_records(library, ids):
    work(library, 'A')
    with pytest.raises(ValueError):
        library.groups.create('Invalid', ids)
    assert not library.db.fetchone('SELECT 1 FROM work_groups')


def test_group_http_lifecycle_uses_real_members_and_version_guards(library, monkeypatch):
    from fastapi.testclient import TestClient
    from app import main
    monkeypatch.setattr(main.services, 'library', library)
    a, b, c = [work(library, title) for title in ('A', 'B', 'C')]
    client = TestClient(main.app)
    created = client.post('/api/library/groups', json={'name': 'Reading set', 'work_ids': [a, b]})
    assert created.status_code == 201
    group = created.json()
    detail = client.get(f"/api/library/groups/{group['id']}").json()
    assert {row['id'] for row in detail['result']} == {a, b}
    assert client.get('/api/library/search?group_by=manual').json()['total'] == 2
    updated = client.patch(f"/api/library/groups/{group['id']}", json={'version': group['version'], 'add_ids': [c]}).json()
    assert updated['count'] == 3
    assert client.delete(f"/api/library/groups/{group['id']}?version={group['version']}").status_code == 409
    assert client.delete(f"/api/library/groups/{group['id']}?version={updated['version']}").status_code == 200
    assert client.get('/api/library/search').json()['total'] == 3
    assert client.post('/api/library/groups', json={'name': 'No', 'work_ids': [a, 2**64]}).status_code == 409
    assert client.get('/api/library/groups/18446744073709551616').status_code == 404
