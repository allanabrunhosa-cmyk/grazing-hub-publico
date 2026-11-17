#!/usr/bin/env python3
"""Instalador explícito de manutenção. Não reinicia aplicações/Docker nem executa limpeza."""
import datetime
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess

os.umask(0o077)
SOURCE = Path(__file__).resolve().parent
if os.geteuid() != 0:
    raise SystemExit('Execute como root no servidor conferido.')
config = json.loads((SOURCE / 'grazing-storage-config.json').read_text())
import socket
if socket.gethostname() != config['hostname']:
    raise SystemExit('Servidor inesperado; nenhuma alteração aplicada.')
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup = Path('/root/backups/storage-maintenance') / stamp
backup.mkdir(parents=True, mode=0o700)
units = [f'grazing-storage-{kind}.{suffix}' for kind in ('cache', 'monitor', 'images') for suffix in ('service', 'timer')]
originals = ['/etc/cron.d/docker-image-prune', '/etc/cron.d/docker-builder-prune',
             '/etc/grazing-storage-maintenance/config.json'] + ['/etc/systemd/system/' + x for x in units]
manifest = []
for index, path in enumerate(originals):
    p = Path(path)
    if p.exists():
        dest = backup / str(index)
        shutil.copy2(p, dest)
        dest.chmod(0o600)
    manifest.append(dict(path=path, existed=p.exists(), copy=str(index)))
(backup / 'manifest.json').write_text(json.dumps(manifest, indent=2))
target = Path('/usr/local/lib/grazing-storage-maintenance')
target.mkdir(parents=True, exist_ok=True, mode=0o700)
for name in ('grazing-storage-maintenance.py', 'grazing-publication-lock.sh'):
    shutil.copy2(SOURCE / name, target / name)
    (target / name).chmod(0o700)
cfg = Path('/etc/grazing-storage-maintenance')
cfg.mkdir(exist_ok=True, mode=0o700)
shutil.copy2(SOURCE / 'grazing-storage-config.json', cfg / 'config.json')
(cfg / 'config.json').chmod(0o600)
spec = importlib.util.spec_from_file_location('storage', target / 'grazing-storage-maintenance.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
m.STATE.mkdir(exist_ok=True, mode=0o700)
p = m.STATE / 'protected-images.json'
if not p.exists():
    m.atomic_json(p, dict(schema=1, protected={}, unresolved=[]))
m.refresh_protection(m.inventory())
p = m.STATE / 'approved-excess-images.json'
if not p.exists():
    m.atomic_json(p, [])
for name in units:
    p = Path('/etc/systemd/system') / name
    shutil.copy2(SOURCE / name, p)
    p.chmod(0o644)
subprocess.run(['systemd-analyze', 'verify'] + ['/etc/systemd/system/' + u for u in units], check=True)
subprocess.run(['systemctl', 'daemon-reload'], check=True)
subprocess.run(['systemctl', 'enable', '--now'] + [u for u in units if u.endswith('.timer')], check=True)
# Only the two identified legacy cron entries are replaced, after timers are installed.
for path in originals[:2]:
    p = Path(path)
    if p.exists():
        p.write_text('# Superseded by protected grazing-storage timers; original at ' + str(backup) + '\n')
        p.chmod(0o644)
print(json.dumps(dict(installed=True, backup=str(backup), timers=[u for u in units if u.endswith('.timer')],
                      application_restarts=False, cache_cleanup_executed=False)))
