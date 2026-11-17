import datetime as dt
import importlib.util
from pathlib import Path
import unittest
from unittest import mock
import contextlib

spec = importlib.util.spec_from_file_location('storage', Path(__file__).with_name('grazing-storage-maintenance.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
AT = dt.datetime(2026, 10, 7, tzinfo=dt.timezone.utc)


def record(i, hours=48, shared=False, inuse=False, kind='regular'):
    return dict(ID=i, Size=100, Shared=shared, InUse=inuse, Type=kind,
                CreatedAt=(AT-dt.timedelta(hours=hours)).isoformat(),
                LastUsedAt=(AT-dt.timedelta(hours=hours)).isoformat())


class SelectionTests(unittest.TestCase):
    def test_monitor_thresholds_include_inodes(self):
        self.assertEqual(m.severity(dict(used_percent=74.99,inode_percent=10)), 'ok')
        self.assertEqual(m.severity(dict(used_percent=75,inode_percent=10)), 'warning')
        self.assertEqual(m.severity(dict(used_percent=10,inode_percent=85)), 'critical')

    def test_recent_shared_live_and_helpers_are_preserved(self):
        rows = [record('old'), record('new', 1), record('shared', shared=True),
                record('busy', inuse=True), record('helper', kind='internal')]
        self.assertEqual([r['ID'] for r in m.select_cache(rows, 24, AT)], ['old'])

    def test_lru_and_24h_boundary(self):
        self.assertEqual([r['ID'] for r in m.select_cache([record('b', 30), record('a', 60), record('edge', 24)], 24, AT)], ['a', 'b'])

    def test_shared_not_double_counted(self):
        s = m.cache_summary([record('a'), record('b', shared=True)])
        self.assertEqual((s['total_bytes'], s['exclusive_bytes'], s['shared_bytes']), (200, 100, 100))

    def test_prune_is_exact_and_never_all_or_system(self):
        a = m.prune_args(['abc', 'def'], 24, 'default')
        self.assertIn('id~=^(abc|def)$', a)
        self.assertIn('until=24h', a)
        self.assertNotIn('--all', a)
        self.assertNotIn('system', a)
        self.assertNotIn('volume', a)

    def test_invalid_selection_is_closed(self):
        for ids in [[], ['.*'], ['abc|def']]:
            with self.assertRaises(ValueError): m.prune_args(ids, 24, 'default')

    def test_images_need_explicit_review_and_no_live_or_protected_refs(self):
        inv = dict(images=[dict(Id=x) for x in ['current','previous','unknown','excess']], refs=['current'])
        p = dict(schema=1, protected={'previous': []}, unresolved=[])
        self.assertEqual(m.image_candidates(inv, p, ['current','previous','excess']), ['excess'])
        self.assertEqual(m.image_candidates(inv, p, []), [])

    def test_missing_protection_never_deletes(self):
        for p in [None, {}, dict(schema=1, protected={}, unresolved=['missing'])]:
            with self.assertRaises(RuntimeError): m.image_candidates(dict(images=[], refs=[]), p, ['a'])

    def test_incomplete_or_unparseable_time_fails_closed(self):
        r=record('a'); r['LastUsedAt']='unknown'
        with self.assertRaises(ValueError): m.select_cache([r], 24, AT)

    def test_inventory_change_defers_without_prune(self):
        cfg=dict(cache_target_bytes=50, free_target_bytes=60, quiet_seconds=0, max_batches=1)
        with mock.patch.object(m, 'lock', return_value=contextlib.nullcontext()), \
             mock.patch.object(m, 'gate', side_effect=[({}, 'before'), ({}, 'changed')]), \
             mock.patch.object(m, 'refresh_protection', return_value={'protected': {}}), \
             mock.patch.object(m, 'health', return_value=[]), \
             mock.patch.object(m, 'disk', return_value={'used_bytes': 100}), \
             mock.patch.object(m, 'cache_records', return_value=[record('old', 100)]), \
             mock.patch.object(m, 'atomic_json'), mock.patch.object(m, 'emit'), \
             mock.patch.object(m, 'run') as run:
            with self.assertRaisesRegex(RuntimeError, 'Inventory changed'):
                m.maintain(cfg, apply=True)
            run.assert_not_called()

    def test_dry_run_never_prunes(self):
        cfg=dict(cache_target_bytes=50, free_target_bytes=60)
        with mock.patch.object(m, 'lock', return_value=contextlib.nullcontext()), \
             mock.patch.object(m, 'gate', return_value=({}, 'same')), \
             mock.patch.object(m, 'refresh_protection', return_value={}), \
             mock.patch.object(m, 'health', return_value=[]), \
             mock.patch.object(m, 'disk', return_value={'used_bytes': 100}), \
             mock.patch.object(m, 'cache_records', return_value=[record('old', 100)]), \
             mock.patch.object(m, 'atomic_json'), mock.patch.object(m, 'emit'), \
             mock.patch.object(m, 'run') as run:
            m.maintain(cfg, apply=False)
            run.assert_not_called()

    def test_met_goals_never_prune_recent_cache(self):
        cfg=dict(cache_target_bytes=500, free_target_bytes=600)
        with mock.patch.object(m, 'lock', return_value=contextlib.nullcontext()), \
             mock.patch.object(m, 'gate', return_value=({}, 'same')), \
             mock.patch.object(m, 'refresh_protection', return_value={}), \
             mock.patch.object(m, 'health', return_value=[]), \
             mock.patch.object(m, 'disk', return_value={'used_bytes': 100, 'available_bytes': 700}), \
             mock.patch.object(m, 'cache_records', return_value=[record('old', 100)]), \
             mock.patch.object(m, 'atomic_json'), mock.patch.object(m, 'emit'), \
             mock.patch.object(m, 'run') as run:
            m.maintain(cfg, apply=True, limited=True)
            run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
