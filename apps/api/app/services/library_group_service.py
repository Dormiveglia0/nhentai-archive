from __future__ import annotations

import hashlib
import json
import re
from contextlib import nullcontext

from app.services.dictionary_service import normalize_key
from app.services.work_tag_display import visible_work_tags


class LibraryGroupService:
    def __init__(self, db):
        self.db = db

    @staticmethod
    def _name(value):
        name = (value or '').strip()
        if not name or len(name) > 120 or any(ord(char) < 32 for char in name):
            raise ValueError('分组名称需要1至120个字符，不能包含控制字符')
        return name

    @staticmethod
    def _ids(values):
        if any(isinstance(value, bool) or not isinstance(value, int) or not 0 < value < 2**63 for value in values):
            raise ValueError('作品ID无效')
        return list(dict.fromkeys(values))

    def get(self, group_id, conn=None):
        if not isinstance(group_id, int) or not 0 < group_id < 2**63:
            raise ValueError('分组ID无效')
        with self.db.connect() if conn is None else nullcontext(conn) as connection:
            row = connection.execute('SELECT * FROM work_groups WHERE id=?', (group_id,)).fetchone()
            if not row:
                raise ValueError('分组不存在或已解散')
            ids = [row['work_id'] for row in connection.execute('SELECT work_id FROM work_group_members WHERE group_id=? ORDER BY work_id', (group_id,))]
        return {**dict(row), 'key': f'manual:{group_id}', 'kind': 'manual', 'member_ids': ids, 'count': len(ids)}

    def _validate_members(self, conn, ids, group_id=None):
        if not ids:
            return
        encoded = json.dumps(ids)
        if conn.execute('SELECT COUNT(*) FROM works WHERE id IN (SELECT value FROM json_each(?))', (encoded,)).fetchone()[0] != len(ids):
            raise ValueError('部分作品已不存在，请刷新后重试')
        if conn.execute('SELECT 1 FROM work_group_members WHERE work_id IN (SELECT value FROM json_each(?)) AND group_id<>? LIMIT 1', (encoded, group_id or -1)).fetchone():
            raise ValueError('部分作品已在其他分组中，请先从原分组移出')

    def create(self, name, work_ids):
        name, ids = self._name(name), self._ids(work_ids)
        if len(ids) < 2:
            raise ValueError('请选择至少两部作品创建分组')
        with self.db.connect() as conn:
            conn.execute('BEGIN IMMEDIATE')
            self._validate_members(conn, ids)
            group_id = conn.execute('INSERT INTO work_groups(name) VALUES (?)', (name,)).lastrowid
            conn.executemany('INSERT INTO work_group_members(work_id,group_id) VALUES (?,?)', [(work_id, group_id) for work_id in ids])
            return self.get(group_id, conn)

    def update(self, group_id, version, name=None, add_ids=None, remove_ids=None):
        add, remove = self._ids(add_ids or []), self._ids(remove_ids or [])
        if set(add) & set(remove):
            raise ValueError('同一作品不能同时添加和移出')
        with self.db.connect() as conn:
            conn.execute('BEGIN IMMEDIATE')
            group = self.get(group_id, conn)
            if group['version'] != version:
                raise ValueError('分组已变化，请刷新后重试')
            self._validate_members(conn, add, group_id)
            if not (set(group['member_ids']) | set(add)) - set(remove):
                raise ValueError('分组不能没有作品；请使用解散分组')
            if not set(remove).issubset(group['member_ids']):
                raise ValueError('移出的作品不在当前分组中')
            conn.executemany('INSERT OR IGNORE INTO work_group_members(work_id,group_id) VALUES (?,?)', [(work_id, group_id) for work_id in add])
            conn.executemany('DELETE FROM work_group_members WHERE group_id=? AND work_id=?', [(group_id, work_id) for work_id in remove])
            conn.execute('UPDATE work_groups SET name=?,version=version+1 WHERE id=?', (self._name(name) if name is not None else group['name'], group_id))
            return self.get(group_id, conn)

    def dissolve(self, group_id, version):
        with self.db.connect() as conn:
            conn.execute('BEGIN IMMEDIATE')
            if self.get(group_id, conn)['version'] != version:
                raise ValueError('分组已变化，请刷新后重试')
            conn.execute('DELETE FROM work_groups WHERE id=?', (group_id,))
        return {'dissolved': True}

    def buckets(self, rows, mode):
        # shortcut: group the filtered ID index in memory; use SQL aggregation for libraries approaching a million works.
        encoded = json.dumps([row['id'] for row in rows])
        memberships = {row['work_id']: row for row in self.db.fetchall('''SELECT m.work_id,m.group_id,g.name,g.version
            FROM work_group_members m JOIN work_groups g ON g.id=m.group_id
            WHERE m.work_id IN (SELECT value FROM json_each(?))''', (encoded,))}
        counts = {row['group_id']: row['n'] for row in self.db.fetchall('SELECT group_id,COUNT(*) AS n FROM work_group_members GROUP BY group_id')}
        authors = self._authors(encoded) if mode == 'author' else {}
        buckets = {}
        for row in rows:
            work_id = row['id']
            manual, author = memberships.get(work_id), authors.get(work_id)
            if manual:
                key = f"manual:{manual['group_id']}"
                group = {'id': manual['group_id'], 'version': manual['version'], 'name': manual['name'], 'kind': 'manual', 'total_count': counts[manual['group_id']]}
            elif author:
                key = 'author:' + hashlib.sha256(json.dumps(sorted(author), ensure_ascii=False).encode()).hexdigest()
                group = {'name': ' / '.join(dict.fromkeys(author[key] for key in sorted(author))), 'kind': 'author'}
            else:
                key, group = f'work:{work_id}', None
            bucket = buckets.setdefault(key, {'key': key, 'ids': [], 'group': group})
            bucket['ids'].append(work_id)
        return list(buckets.values())

    def tags(self, buckets):
        membership = {work_id: bucket['key'] for bucket in buckets if bucket['group'] for work_id in bucket['ids']}
        if not membership:
            return {}
        rows = self.db.fetchall('''SELECT wt.work_id,wt.tag_key,wt.tag_type,wt.remote_tag_id,wt.remote_name,wt.remote_slug,
                d.id AS dictionary_id,d.zh_name
            FROM work_tags wt LEFT JOIN local_tag_dictionary d ON d.id=wt.dictionary_id AND d.ignored=0
            WHERE wt.tag_type='tag' AND wt.work_id IN (SELECT value FROM json_each(?))
            ORDER BY wt.remote_tag_id IS NULL,wt.id''', (json.dumps(list(membership)),))
        identities = {row['tag_key']: f"dictionary:{row['dictionary_id']}" for row in rows if row['dictionary_id']}
        result = {}
        for row in visible_work_tags(rows):
            key = identities.get(row['tag_key'], row['tag_key'])
            if not key:
                continue
            tags = result.setdefault(membership[row['work_id']], {})
            tag = tags.setdefault(normalize_key(row['display']), {'key': key, 'display': row['display'], 'count': 0})
            tag['count'] += 1
        return {key: sorted(tags.values(), key=lambda tag: (-tag['count'], normalize_key(tag['display']), tag['key'])) for key, tags in result.items()}

    def _authors(self, encoded):
        entries = self.db.fetchall("SELECT id,remote_tag_id,normalized_key,original_text,zh_name,ignored FROM local_tag_dictionary WHERE tag_type='artist'")
        by_id, by_remote, by_text = {}, {}, {}
        for entry in entries:
            by_id[entry['id']] = entry
            if entry['remote_tag_id']:
                by_remote[entry['remote_tag_id']] = entry
            for text in (entry['normalized_key'], entry['zh_name']):
                if text:
                    by_text.setdefault(normalize_key(text), set()).add(entry['id'])
        for alias in self.db.fetchall("SELECT a.dictionary_id,a.normalized_key FROM tag_aliases a JOIN local_tag_dictionary d ON d.id=a.dictionary_id WHERE d.tag_type='artist'"):
            by_text.setdefault(alias['normalized_key'], set()).add(alias['dictionary_id'])
        manual = {row['work_id']: row['value'] for row in self.db.fetchall("SELECT work_id,value FROM work_metadata WHERE field='artist' AND source IN ('manual','current') AND work_id IN (SELECT value FROM json_each(?))", (encoded,))}
        tags = self.db.fetchall("SELECT work_id,dictionary_id,remote_tag_id,remote_name,remote_slug FROM work_tags WHERE tag_type='artist' AND work_id IN (SELECT value FROM json_each(?))", (encoded,))
        remote_names = {}
        for tag in self.db.fetchall("SELECT remote_id, name, slug FROM remote_tags WHERE type='artist'"):
            for text in (tag['name'], tag['slug']):
                if text:
                    remote_names.setdefault(normalize_key(text), set()).add(tag['remote_id'])
        for tag in tags:
            if tag['remote_tag_id'] and tag['remote_name']:
                remote_names.setdefault(normalize_key(tag['remote_name']), set()).add(tag['remote_tag_id'])
        tags = [tag for tag in tags if tag['work_id'] not in manual]
        for work_id, value in manual.items():
            tags.extend({'work_id': work_id, 'remote_name': part.strip()} for part in re.split(r'\s+/\s+|[,，;；\n]', value or '') if part.strip())
        result = {}
        for tag in tags:
            name = tag.get('remote_name') or tag.get('remote_slug') or ''
            normalized = normalize_key(name)
            if not normalized or normalized in {'unknown', 'unknown artist', '未知', '未知作者', '佚名', '不详'}:
                continue
            remote_id = tag.get('remote_tag_id')
            known_ids = remote_names.get(normalized, set())
            if not remote_id and len(known_ids) == 1:
                remote_id = next(iter(known_ids))
            match = by_id.get(tag.get('dictionary_id')) or by_remote.get(remote_id)
            candidates = by_text.get(normalized, set())
            if not match and len(candidates) == 1:
                match = by_id[next(iter(candidates))]
            key = f"dictionary:{match['id']}" if match else f"remote:{remote_id}" if remote_id else f'name:{normalized}'
            label = (match['zh_name'] if not match['ignored'] else None) or match['original_text'] if match else name
            result.setdefault(tag['work_id'], {})[key] = label
        return result
