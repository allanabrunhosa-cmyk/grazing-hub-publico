#!/bin/sh
# Integracao cooperativa para futuras publicacoes; nao inicia nenhuma por conta propria.
set -eu
exec flock -n /run/lock/grazing-storage-maintenance.lock "$@"
