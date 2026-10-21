#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  printf '%s\n' 'Execute com sudo no próprio equipamento após autorização.' >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  printf '%s\n' 'Python 3 não encontrado. Instalação interrompida sem alterar o sistema.' >&2
  exit 1
fi
for ferramenta in useradd usermod install systemctl visudo stty getent chown chmod mv; do
  if ! command -v "$ferramenta" >/dev/null 2>&1; then
    printf '%s\n' "Pré-requisito ausente: $ferramenta. Nenhuma alteração realizada." >&2
    exit 1
  fi
done
if ! getent group lp >/dev/null 2>&1 || [ ! -x /usr/bin/python3 ] || [ ! -d /etc/sudoers.d ]; then
  printf '%s\n' 'Grupo lp, /usr/bin/python3 ou sudoers ausente. Nenhuma alteração realizada.' >&2
  exit 1
fi
if [ ! -f /etc/grazing-etiquetas/conector.json ] && [ ! -t 0 ]; then
  printf '%s\n' 'O primeiro vínculo requer terminal interativo local. Nenhuma alteração realizada.' >&2
  exit 1
fi
BASE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
for arquivo in grazing_connector.py wifi_helper.py vincular.py grazing-etiquetas.service; do
  if [ ! -r "$BASE/$arquivo" ]; then
    printf '%s\n' "Arquivo de instalação ausente: $arquivo. Nenhuma alteração realizada." >&2
    exit 1
  fi
done
if ! id grazing-print >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/grazing-etiquetas --no-create-home --shell /usr/sbin/nologin --groups lp grazing-print
fi
usermod -a -G lp grazing-print
install -d -m 0755 /opt/grazing-etiquetas
install -m 0755 "$BASE/grazing_connector.py" /opt/grazing-etiquetas/grazing_connector.py
install -m 0755 "$BASE/wifi_helper.py" /opt/grazing-etiquetas/wifi_helper.py
install -d -m 0750 -o root -g grazing-print /etc/grazing-etiquetas
install -d -m 0700 -o grazing-print -g grazing-print /var/lib/grazing-etiquetas
if [ ! -f /etc/grazing-etiquetas/conector.json ]; then
  printf '%s' 'Código de vínculo (não aparece na tela): '
  trap 'stty echo' EXIT HUP INT TERM
  stty -echo
  IFS= read -r CODIGO
  stty echo
  trap - EXIT HUP INT TERM
  printf '\n'
  # Código entregue em stdin, sem argumento de processo, shell history ou log.
  printf '%s' "$CODIGO" | python3 "$BASE/vincular.py"
  unset CODIGO
  chown root:grazing-print /etc/grazing-etiquetas/conector.json
  chmod 0640 /etc/grazing-etiquetas/conector.json
fi
install -m 0644 "$BASE/grazing-etiquetas.service" /etc/systemd/system/grazing-etiquetas.service
printf '%s\n' 'grazing-print ALL=(root) NOPASSWD: /usr/bin/python3 /opt/grazing-etiquetas/wifi_helper.py apply' > /etc/sudoers.d/grazing-etiquetas-wifi.tmp
chmod 0440 /etc/sudoers.d/grazing-etiquetas-wifi.tmp
visudo -cf /etc/sudoers.d/grazing-etiquetas-wifi.tmp >/dev/null
mv /etc/sudoers.d/grazing-etiquetas-wifi.tmp /etc/sudoers.d/grazing-etiquetas-wifi
systemctl daemon-reload
systemctl enable grazing-etiquetas.service
systemctl restart grazing-etiquetas.service
printf '%s\n' 'Conector instalado. Confira a comunicação no site antes de enviar trabalhos.'
