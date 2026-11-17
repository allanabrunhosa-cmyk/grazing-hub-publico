#!/usr/bin/env python3
"""Manutenção restrita de cache; biblioteca padrão, sem leitura de dados de negócio."""
import argparse
import contextlib
import datetime as dt
import hashlib
import http.client
import json
import logging
import logging.handlers
import os
from pathlib import Path
import re
import socket
import subprocess
import time
from urllib.parse import quote

STATE = Path('/var/lib/grazing-storage-maintenance')
CONFIG = Path('/etc/grazing-storage-maintenance/config.json')
LOGGER = logging.getLogger('storage')


def now():
    return dt.datetime.now(dt.timezone.utc)


def emit(event, **fields):
    entry = dict(time=now().isoformat(), event=event)
    entry.update(fields)
    line = json.dumps(entry, sort_keys=True)
    LOGGER.info(line)
    print(line, flush=True)


def run(args, timeout=40, input_text=None):
    result = subprocess.run(args, input=input_text, text=True, capture_output=True, timeout=timeout)
    if result.returncode:
        # Commands using psql/environment never appear in exception/log messages.
        raise RuntimeError('command failed: ' + args[0] + ' exit=' + str(result.returncode))
    return result.stdout


class DockerConnection(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(60)
        self.sock.connect('/var/run/docker.sock')


def api(path):
    conn = DockerConnection('localhost')
    try:
        conn.request('GET', path)
        response = conn.getresponse()
        if response.status != 200:
            raise RuntimeError('Docker read API unavailable: ' + str(response.status))
        return json.loads(response.read())
    finally:
        conn.close()


def disk():
    v = os.statvfs('/')
    total = v.f_blocks * v.f_frsize
    used = (v.f_blocks - v.f_bfree) * v.f_frsize
    return dict(total_bytes=total, used_bytes=used, available_bytes=v.f_bavail * v.f_frsize,
                used_percent=100 * used / total,
                inode_percent=100 * (v.f_files - v.f_ffree) / v.f_files)


def severity(measurement):
    worst = max(measurement['used_percent'], measurement['inode_percent'])
    return 'critical' if worst >= 85 else 'warning' if worst >= 75 else 'ok'


def wait_io():
    # Only pause this maintenance; never signal/stop production services or builders.
    for attempt in range(24):
        content = Path('/proc/pressure/io').read_text()
        pressure = float(re.search(r'^some avg10=([\d.]+)', content, re.M)[1])
        if pressure <= 15:
            return
        if attempt == 0:
            emit('io_pause', avg10=pressure)
        time.sleep(5)
    raise RuntimeError('I/O pressure remains high; defer subsequent batches')


def cache_summary(records):
    return dict(total_bytes=sum(r['Size'] for r in records),
                exclusive_bytes=sum(r['Size'] for r in records if not r['Shared']),
                shared_bytes=sum(r['Size'] for r in records if r['Shared']),
                in_use_records=sum(bool(r['InUse']) for r in records), records=len(records))


def cache_records():
    rows = api('/system/df')['BuildCache']
    for r in rows:
        if not all(k in r for k in ('ID', 'Size', 'Shared', 'InUse', 'CreatedAt')):
            raise RuntimeError('Incomplete cache inventory')
        if not re.fullmatch(r'[a-z0-9]+', r['ID']):
            raise RuntimeError('Invalid cache identifier')
    return rows


def timestamp(value):
    return dt.datetime.fromisoformat(value.replace('Z', '+00:00'))


def select_cache(records, hours, at=None):
    at = at or now()
    return sorted((r for r in records if not r['Shared'] and not r['InUse']
                   and r.get('Type') not in ('internal', 'frontend')
                   and timestamp(r.get('LastUsedAt') or r['CreatedAt']) < at - dt.timedelta(hours=hours)),
                  key=lambda r: timestamp(r.get('LastUsedAt') or r['CreatedAt']))


def prune_args(ids, hours, builder):
    if not ids or any(not re.fullmatch(r'[a-z0-9]+', x) for x in ids):
        raise ValueError('Invalid/empty cache selection')
    # No --all: BuildKit natively excludes shared/frontend/internal records and live refs.
    # Boolean presence filters are NOT represented as shared=false by this CLI/version.
    return ['docker', 'buildx', 'prune', '--builder', builder, '--force',
            '--filter', 'id~=^(' + '|'.join(ids) + ')$', '--filter', 'until=' + str(hours) + 'h']


def atomic_json(path, data):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, indent=2) + '\n')
    temporary.chmod(0o600)
    temporary.replace(path)


def inventory():
    containers = api('/containers/json?all=1')
    services = api('/services')
    images = api('/images/json?all=1')
    refs = {c['ImageID'] for c in containers}
    unresolved = []
    service_rows = []
    for s in services:
        row = dict(name=s['Spec']['Name'], id=s['ID'], version=s['Version']['Index'])
        for source, label in [('Spec', 'current'), ('PreviousSpec', 'previous')]:
            image = s.get(source, {}).get('TaskTemplate', {}).get('ContainerSpec', {}).get('Image')
            if not image:
                continue
            row[label] = image
            try:
                iid = run(['docker', 'image', 'inspect', '--format', '{{.Id}}', image]).strip()
                refs.add(iid)
                row[label + '_id'] = iid
            except RuntimeError:
                unresolved.append(dict(service=row['name'], reference=image))
        service_rows.append(row)
    return dict(images=images, refs=sorted(refs), unresolved=unresolved, services=service_rows,
                container_ids=sorted(c['Id'] for c in containers))


def refresh_protection(inv):
    path = STATE / 'protected-images.json'
    previous = json.loads(path.read_text())
    if previous.get('schema') != 1 or not isinstance(previous.get('protected'), dict):
        raise RuntimeError('Invalid protection manifest; image operations closed')
    for image in inv['images']:
        previous['protected'].setdefault(image['Id'], ['Unclassified inventory: preserve'])
    for iid in inv['refs']:
        previous['protected'].setdefault(iid, []).append('Live reference ' + now().date().isoformat())
        previous['protected'][iid] = sorted(set(previous['protected'][iid]))
    previous['unresolved'] = inv['unresolved']
    previous['updated'] = now().isoformat()
    previous['services'] = inv['services']
    atomic_json(path, previous)
    history_path = STATE / 'recovery-history.json'
    history = json.loads(history_path.read_text()) if history_path.exists() else {'schema': 1, 'services': {}}
    for service in inv['services']:
        entries = history['services'].setdefault(service['name'], [])
        for label in ('current', 'previous'):
            iid = service.get(label + '_id')
            if iid and not any(e['image_id'] == iid for e in entries):
                entries.append(dict(image_id=iid, first_observed=now().isoformat(), source=label,
                                    verification='observed reference; functional/schema compatibility unproven'))
    atomic_json(history_path, history)
    return previous


def image_candidates(inv, protected, approved):
    if not protected or protected.get('schema') != 1 or protected.get('unresolved'):
        raise RuntimeError('Image protection unavailable/unresolved; delete nothing')
    known = {x['Id'] for x in inv['images']}
    # Images require an explicit reviewed ID, never a name/age heuristic. Empty by default.
    return sorted(set(approved) & known - set(protected['protected']) - set(inv['refs']))


def gate(config):
    if socket.gethostname() != config['hostname']:
        raise RuntimeError('Unexpected host')
    if (STATE / 'publication-active').exists():
        raise RuntimeError('Publication marker active; defer')
    builder = run(['docker', 'buildx', 'inspect', config['builder']])
    if 'Driver:        docker' not in builder or 'Endpoint:         default' not in builder:
        raise RuntimeError('Unexpected builder; defer')
    history = [json.loads(l) for l in run(['docker', 'buildx', 'history', 'ls', '--builder',
                                          config['builder'], '--format', 'json']).splitlines() if l]
    for r in history:
        if r['status'].lower() not in ('completed', 'error', 'canceled', 'cancelled'):
            raise RuntimeError('Build active; defer')
        if not r.get('completed_at') or timestamp(r['completed_at']) > now() - dt.timedelta(minutes=5):
            raise RuntimeError('Recent/unverified build; defer')
    for p in Path('/proc').iterdir():
        if not p.name.isdigit():
            continue
        try:
            command = (p / 'cmdline').read_bytes().replace(b'\0', b' ')
            if re.search(rb'(?:docker (?:build |buildx build|image prune|builder prune|buildx prune)|buildctl build)', command):
                raise RuntimeError('Concurrent build/prune process; defer')
        except (FileNotFoundError, PermissionError, ProcessLookupError):
            continue
    dbs = [c for c in api('/containers/json') if any('/dokploy-postgres.' in n for n in c['Names'])]
    if len(dbs) != 1:
        raise RuntimeError('Dokploy status unavailable; defer')
    sql = "SELECT count(*) FROM deployment WHERE status::text NOT IN ('done','error','failed','cancelled','canceled');"
    shell = 'export PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=5000"; exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At'
    if run(['docker', 'exec', '-i', dbs[0]['Id'], 'sh', '-c', shell], input_text=sql).strip() != '0':
        raise RuntimeError('Publication queued/active; defer')
    for s in api('/services'):
        if s.get('UpdateStatus', {}).get('State') not in (None, 'completed', 'rollback_completed'):
            raise RuntimeError('Service update active/uncertain; defer')
        tasks = api('/tasks?filters=' + quote(json.dumps({'service': [s['ID']], 'desired-state': ['running']})))
        desired = s['Spec'].get('Mode', {}).get('Replicated', {}).get('Replicas')
        if desired is not None and len([t for t in tasks if t['Status']['State'] == 'running']) != desired:
            raise RuntimeError('Replica health mismatch; defer')
    inv = inventory()
    for container in api('/containers/json'):
        raw = api('/containers/' + container['Id'] + '/json')
        if raw['State'].get('Health', {}).get('Status') not in (None, 'healthy'):
            raise RuntimeError('Container unhealthy/starting; defer')
    fingerprint = hashlib.sha256(json.dumps(inv, sort_keys=True).encode()).hexdigest()
    return inv, fingerprint


@contextlib.contextmanager
def lock():
    import fcntl
    with open('/run/lock/grazing-storage-maintenance.lock', 'a') as handle:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def health():
    rows = []
    for c in api('/containers/json'):
        raw = api('/containers/' + c['Id'] + '/json')
        rows.append(dict(id=raw['Id'], image=raw['Image'], started=raw['State']['StartedAt'],
                         restarts=raw['RestartCount'], health=raw['State'].get('Health', {}).get('Status')))
    return sorted(rows, key=lambda r: r['id'])


def maintain(config, apply=False, hours=24, limited=False):
    with lock():
        inv, fingerprint = gate(config)
        protection = refresh_protection(inv)
        before_health = health()
        before = disk()
        records = cache_records()
        before_cache = cache_summary(records)
        atomic_json(STATE / 'last-before.json', dict(time=now().isoformat(), disk=before, cache=before_cache))
        candidates = select_cache(records, hours)
        emit('selection', apply=apply, hours=hours, disk=before, cache=before_cache,
             candidate_count=len(candidates), candidate_bytes=sum(r['Size'] for r in candidates))
        if not apply:
            return
        if limited and before_cache['total_bytes'] <= config['cache_target_bytes'] and before['available_bytes'] >= config['free_target_bytes']:
            emit('goals_already_met', disk=before, cache=before_cache)
            return
        time.sleep(config.get('quiet_seconds', 15))
        _, second = gate(config)
        if second != fingerprint:
            raise RuntimeError('Inventory changed during quiet window; defer')
        original = {r['ID'] for r in candidates}
        for batch_number in range(config.get('max_batches', 40)):
            wait_io()
            current_inv, _ = gate(config)
            refresh_protection(current_inv)
            records = cache_records()
            summary = cache_summary(records)
            current_disk = disk()
            if limited and summary['total_bytes'] <= config['cache_target_bytes'] and current_disk['available_bytes'] >= config['free_target_bytes']:
                break
            eligible = [r for r in select_cache(records, hours) if r['ID'] in original]
            if not eligible:
                break
            batch = []
            for r in eligible:
                batch.append(r['ID'])
                if len(batch) >= 25 or sum(x['Size'] for x in eligible[:len(batch)]) >= 5_000_000_000:
                    break
            # Verify exact selection against the live builder. No formatted descriptions logged.
            preview = run(['docker', 'buildx', 'du', '--builder', config['builder'], '--format', 'json',
                           '--filter', 'id~=^(' + '|'.join(batch) + ')$'])
            live = [json.loads(l) for l in preview.splitlines() if l]
            if not live or any(x['ID'] not in batch or x['Shared'] or not x['Reclaimable'] for x in live):
                raise RuntimeError('Selection became shared/in-use/unknown; defer')
            output = run(prune_args(batch, hours, config['builder']), timeout=900)
            reported_ids = re.findall(r'^([a-z0-9]+)\*?\s+true\s', output, re.M)
            ids_after = {r['ID'] for r in cache_records()}
            removed = sorted(set(batch) - ids_after)
            emit('cache_batch', batch=batch_number, selected_ids=batch, removed_ids=removed,
                 native_reported_ids=reported_ids,
                 native_report=output.strip(), disk=disk(), cache=cache_summary(cache_records()))
            if health() != before_health:
                raise RuntimeError('Container health/version/start changed; stop subsequent batches')
            if not removed:
                break
            time.sleep(2)
        after = disk()
        after_cache = cache_summary(cache_records())
        report = dict(time=now().isoformat(), before_disk=before, after_disk=after,
                      physical_gain_bytes=before['used_bytes'] - after['used_bytes'],
                      before_cache=before_cache, after_cache=after_cache,
                      logical_cache_delta_bytes=before_cache['total_bytes'] - after_cache['total_bytes'],
                      health_unchanged=health() == before_health,
                      protected_ids=len(protection['protected']))
        atomic_json(STATE / 'last-result.json', report)
        emit('result', **report)


def monitor(config):
    with lock():
        inv = inventory()
        refresh_protection(inv)
        measurement = disk()
        level = severity(measurement)
        atomic_json(STATE / 'monitor.json', dict(time=now().isoformat(), level=level, disk=measurement,
                                               notifications='not configured'))
        emit('monitor', level=level, disk=measurement, notifications='not configured')


def images(config):
    with lock():
        inv, _ = gate(config)
        protection = json.loads((STATE / 'protected-images.json').read_text())
        approved = json.loads((STATE / 'approved-excess-images.json').read_text())
        candidates = image_candidates(inv, protection, approved)
        emit('image_review', candidates=candidates, protected=len(protection['protected']),
             action='preserve all; deletion requires a separately reviewed implementation')
        refresh_protection(inv)


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['cache', 'monitor', 'images'])
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--hours', type=int, choices=[24, 12, 6, 2], default=24)
    parser.add_argument('--limited', action='store_true')
    args = parser.parse_args()
    config = json.loads(CONFIG.read_text())
    if config['hostname'] != socket.gethostname():
        raise RuntimeError('Unexpected host')
    STATE.mkdir(mode=0o700, exist_ok=True)
    handler = logging.handlers.RotatingFileHandler(STATE / 'maintenance.log', maxBytes=4_000_000, backupCount=4)
    LOGGER.addHandler(handler)
    LOGGER.setLevel(logging.INFO)
    start = time.monotonic()
    try:
        if args.mode == 'cache':
            maintain(config, args.apply, args.hours, args.limited)
        elif args.mode == 'monitor':
            monitor(config)
        else:
            images(config)
        emit('finished', mode=args.mode, duration_seconds=round(time.monotonic() - start, 3))
    except Exception as error:
        emit('deferred_or_failed', mode=args.mode, error=str(error),
             duration_seconds=round(time.monotonic() - start, 3))
        raise SystemExit(1)


if __name__ == '__main__':
    main()
