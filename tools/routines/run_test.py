#!/usr/bin/env python3
"""Tests for tools/routines/run.py: due nights and catch-up, network wait, clean clones, results, health.
Run: python3 tools/routines/run_test.py   (no network: clones come from a local bare repository)"""
import datetime as dt
import json
import os
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run  # noqa: E402


def sh(*a, cwd=None):
    subprocess.run(list(a), cwd=cwd, check=True, capture_output=True)


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ['DA_HOME'] = self.tmp.name
        self.at('2026-11-19T00:10')   # night of Wed 18 Nov

    def tearDown(self):
        for k in ('DA_HOME', 'DA_NOW', 'DA_REPO_URL'):
            os.environ.pop(k, None)
        self.tmp.cleanup()

    def at(self, t):
        os.environ['DA_NOW'] = t

    def due(self):
        s = run.load()
        return [j['id'] for j in run.jobs() if run.is_due(j, s, run.night())]


class Schedule(Base):
    def test_night_belongs_to_day_before(self):
        self.assertEqual(run.night(), dt.date(2026, 11, 18))
        self.at('2026-11-18T21:00')
        self.assertEqual(run.night(), dt.date(2026, 11, 18))

    def test_first_night_runs_daily_jobs_only(self):
        self.assertEqual(self.due(), ['coach', 'refresh', 'reels'])

    def test_weekly_jobs_on_their_night(self):
        run.save(run.load())
        self.at('2026-11-21T00:07')   # night of Fri 20 Nov
        self.assertIn('review', self.due())
        self.assertNotIn('sim', self.due())
        self.at('2026-11-23T00:07')   # night of Sun 22 Nov
        self.assertIn('sim', self.due())

    def test_done_job_not_due_again_tonight(self):
        run.done('coach', 'ok')
        run.done('refresh', 'nothing')
        self.assertEqual(self.due(), ['reels'])

    def test_failed_job_catches_up_next_night(self):
        run.save(run.load())
        self.at('2026-11-21T00:07')
        run.done('review', 'failed', 'network down')
        self.assertIn('review', self.due())
        self.at('2026-11-22T00:07')   # Saturday night: Friday's review is still owed
        self.assertIn('review', self.due())
        run.done('review', 'ok')
        self.at('2026-11-23T00:07')
        self.assertNotIn('review', self.due())

    def test_mac_closed_for_days_catches_up_once(self):
        run.save(run.load())
        self.at('2026-11-25T00:07')   # nothing ran from 18 to 24 Nov
        self.assertEqual(self.due(), ['coach', 'refresh', 'reels', 'sim', 'review'])


class Network(Base):
    def test_waits_then_succeeds(self):
        calls, slept = [], []

        def resolve(u):
            calls.append(u)
            if len(calls) < 3:
                raise OSError('ENOTFOUND')
        self.assertTrue(run.wait_for_network(resolve, slept.append, [1, 2, 3]))
        self.assertEqual(slept, [1, 2])

    def test_gives_up(self):
        def resolve(u):
            raise OSError('ENOTFOUND')
        slept = []
        self.assertFalse(run.wait_for_network(resolve, slept.append, [1, 2]))
        self.assertEqual(slept, [1, 2])


class Results(Base):
    def test_history_and_fail_count(self):
        run.done('reels', 'failed', 'x')
        e = run.done('reels', 'failed', 'y')
        self.assertEqual(e['fails'], 2)
        e = run.done('reels', 'ok', pr='https://github.com/x/y/pull/1')
        self.assertEqual(e['fails'], 0)
        self.assertEqual(e['last_ok'], '2026-11-18')
        self.assertEqual(len(e['history']), 3)

    def test_history_is_capped(self):
        for _ in range(run.HISTORY + 5):
            run.done('coach', 'ok')
        self.assertEqual(len(run.load()['jobs']['coach']['history']), run.HISTORY)

    def test_inbox_line_written_when_scratch_exists(self):
        sc = os.path.join(self.tmp.name, 'scratch')
        os.makedirs(os.path.join(sc, 'qa'))
        open(os.path.join(sc, 'qa', 'LEADER-INBOX.md'), 'w').close()
        with open(os.path.join(self.tmp.name, 'routines.json'), 'w') as f:
            json.dump({'scratch': sc}, f)
        run.done('refresh', 'ok', 'six news items', 'https://github.com/x/y/pull/2')
        with open(os.path.join(sc, 'qa', 'LEADER-INBOX.md')) as f:
            line = f.read()
        self.assertIn('daily refresh (nightly runner): shipped https://github.com/x/y/pull/2: six news items', line)

    def test_bad_result_refused(self):
        with self.assertRaises(SystemExit):
            run.done('coach', 'maybe')


class Health(Base):
    def test_quiet_when_all_good(self):
        for j in ('coach', 'refresh', 'reels'):
            run.done(j, 'ok')
        self.assertEqual(run.health([]), [])

    def test_one_failure_stays_quiet(self):
        run.done('refresh', 'failed', 'network down')
        self.assertEqual(run.health([]), [])

    def test_two_failures_need_you(self):
        run.done('refresh', 'failed', 'a')
        self.at('2026-11-20T00:10')
        run.done('refresh', 'failed', 'gh refused')
        out = run.health([])
        self.assertEqual(len(out), 1)
        self.assertIn('daily refresh failed 2 nights in a row: gh refused', out[0])

    def test_stalled_job_needs_you(self):
        run.done('coach', 'ok')
        self.at('2026-11-22T00:10')   # three nights later, never finished since
        self.assertTrue(any('nightly coach has not finished for 3 days' in x for x in run.health([])))

    def test_new_runner_no_false_alarm_for_weekly(self):
        run.save(run.load())
        self.at('2026-11-21T00:10')
        self.assertFalse(any('weekly' in x for x in run.health([])))

    def test_stale_bot_pr_needs_you(self):
        prs = [{'number': 9, 'headRefName': 'refresh/2026-11-16', 'createdAt': '2026-11-16T16:00:00Z', 'url': 'u9'},
               {'number': 10, 'headRefName': 'my-feature', 'createdAt': '2026-11-01T16:00:00Z', 'url': 'u10'},
               {'number': 11, 'headRefName': 'sim/2026-11-18', 'createdAt': '2026-11-18T18:30:00Z', 'url': 'u11'}]
        for j in ('coach', 'refresh', 'reels'):
            run.done(j, 'ok')
        out = run.health(prs)
        self.assertEqual(len(out), 1)
        self.assertIn('u9', out[0])


class Prep(Base):
    def setUp(self):
        super().setUp()
        src = os.path.join(self.tmp.name, 'src')
        self.bare = os.path.join(self.tmp.name, 'origin.git')
        os.makedirs(src)
        sh('git', 'init', '-q', '-b', 'main', cwd=src)
        sh('git', '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'a', cwd=src)
        sh('git', 'clone', '-q', '--bare', src, self.bare)
        os.environ['DA_REPO_URL'] = self.bare

    def test_clone_and_branch(self):
        d, br, notes = run.prep('refresh')
        self.assertEqual(br, 'refresh/2026-11-18')
        self.assertEqual(run.git(d, 'branch', '--show-current'), br)
        self.assertIn('cloned', notes)

    def test_coach_has_no_branch(self):
        d, br, _ = run.prep('coach')
        self.assertEqual(br, '')
        self.assertEqual(run.git(d, 'branch', '--show-current'), 'main')

    def test_leftovers_are_stashed_not_lost(self):
        d, _, _ = run.prep('reels')
        with open(os.path.join(d, 'half.txt'), 'w') as f:
            f.write('work in progress')
        d, br, notes = run.prep('reels')
        self.assertEqual(br, 'reels-review/2026-11-18-2')   # tonight's first branch already exists
        self.assertTrue(any('stash' in n for n in notes))
        self.assertIn('routines reels', run.git(d, 'stash', 'list'))
        self.assertFalse(os.path.exists(os.path.join(d, 'half.txt')))

    def test_diverged_main_refused(self):
        d, _, _ = run.prep('coach')
        sh('git', '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'local', cwd=d)
        with self.assertRaises(RuntimeError):
            run.prep('coach')


class Config(unittest.TestCase):
    def test_every_job_has_a_brief_and_valid_fields(self):
        ids = set()
        for j in run.jobs():
            self.assertNotIn(j['id'], ids)
            ids.add(j['id'])
            self.assertTrue(os.path.isfile(os.path.join(run.HERE, j['brief'])), j['brief'])
            self.assertIn(j['every'], ('day', 'week'))
            if j['every'] == 'week':
                self.assertIn(j['day'], run.DAYS)
            self.assertFalse(j['clone'].startswith('/'))
            if j.get('branch'):
                self.assertTrue(j['branch'].startswith(run.SHIP_PREFIXES), j['branch'])

    def test_clones_are_not_shared(self):
        clones = [j['clone'] for j in run.jobs()]
        self.assertEqual(len(clones), len(set(clones)))


if __name__ == '__main__':
    unittest.main(verbosity=1)
