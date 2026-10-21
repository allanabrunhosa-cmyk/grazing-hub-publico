#!/bin/sh
set -eu
cd "$(dirname "$0")"
install -D -m 755 buscar-notas.sh /usr/local/lib/grazing-hub/buscar-notas.sh
# Verifica dependências e migration sem iniciar consulta ou registrar Ciência.
/usr/local/lib/grazing-hub/buscar-notas.sh --verificar
install -m 644 grazing-buscar-notas.service /etc/systemd/system/grazing-buscar-notas.service
install -m 644 grazing-buscar-notas.timer /etc/systemd/system/grazing-buscar-notas.timer
systemd-analyze verify /etc/systemd/system/grazing-buscar-notas.service /etc/systemd/system/grazing-buscar-notas.timer
systemctl daemon-reload
systemctl enable --now grazing-buscar-notas.timer
systemctl list-timers --all grazing-buscar-notas.timer --no-pager
