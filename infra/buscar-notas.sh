#!/bin/sh
set -eu
servico=app-copy-auxiliary-microchip-9hhwdm
tarefa=$(docker service ps --filter desired-state=running --format '{{.ID}}' "$servico" | head -n 1)
test -n "$tarefa"
container=$(docker inspect --format '{{.Status.ContainerStatus.ContainerID}}' "$tarefa")
test -n "$container"
exec docker exec "$container" node --conditions=react-server --import tsx /app/scripts/buscar-notas.ts "$@"
