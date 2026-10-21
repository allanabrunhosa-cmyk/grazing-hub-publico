#!/usr/bin/env python3
"""Conector de saída para o Grazing Etiquetas. Não recebe comandos de shell."""

import json
import os
import re
import socket
import sqlite3
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "https://etiquetas.grazinghub.com.br/api/etiquetas/conector"
CONFIG = Path("/etc/grazing-etiquetas/conector.json")
JOURNAL = Path("/var/lib/grazing-etiquetas/envios.sqlite3")
POLL_SECONDS = 10
HEARTBEAT_SECONDS = 30


def request_json(path, token, method="GET", payload=None):
    data = json.dumps(payload, ensure_ascii=True).encode() if payload is not None else None
    headers = {"Accept": "application/json", "Authorization": "Bearer " + token}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(API + path, data=data, method=method, headers=headers)
    # urllib usa a validação TLS do sistema. Não há opção para desativá-la.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, request, fp, code, msg, headers, newurl):
            raise urllib.error.HTTPError(request.full_url, code, "Redirecionamento recusado", headers, fp)
    with urllib.request.build_opener(NoRedirect).open(req, timeout=15) as response:
        return json.load(response)


def fixed_command(*args):
    try:
        return subprocess.run(args, check=False, capture_output=True, text=True, timeout=4).stdout
    except (OSError, subprocess.TimeoutExpired):
        return ""


def local_network():
    wifi_name = None
    eth_name = None
    for interface in Path("/sys/class/net").iterdir():
        if (interface / "wireless").exists() and wifi_name is None:
            wifi_name = interface.name
        elif interface.name != "lo" and (interface / "type").exists() and eth_name is None:
            eth_name = interface.name
    try:
        addresses = json.loads(fixed_command("/usr/sbin/ip", "-j", "-4", "addr", "show") or "[]")
    except json.JSONDecodeError:
        addresses = []
    ips = {item.get("ifname"): next((addr.get("local") for addr in item.get("addr_info", []) if addr.get("family") == "inet"), None) for item in addresses}
    link = fixed_command("/usr/sbin/iw", "dev", wifi_name, "link") if wifi_name else ""
    ssid_match = re.search(r"^\s*SSID:\s*(.+)$", link, re.MULTILINE)
    freq_match = re.search(r"^\s*freq:\s*(\d+)", link, re.MULTILINE)
    networks = []
    if wifi_name:
        listing = fixed_command("/usr/bin/nmcli", "-t", "-e", "yes", "-f", "SSID,FREQ", "device", "wifi", "list", "ifname", wifi_name, "--rescan", "no")
        seen = set()
        for line in listing.splitlines():
            match = re.fullmatch(r"((?:\\.|[^:]){1,100}):(\d+)(?:\s*MHz)?", line)
            if not match:
                continue
            ssid = re.sub(r"\\([\\:])", r"\1", match.group(1))
            frequency = int(match.group(2))
            if not ssid or frequency < 2400 or frequency > 2500 or ssid in seen:
                continue
            seen.add(ssid)
            networks.append({"ssid": ssid[:100], "frequenciaMhz": frequency})
            if len(networks) == 20:
                break
    return {
        "wifiSsid": ssid_match.group(1)[:100] if ssid_match else None,
        "wifiFrequenciaMhz": int(freq_match.group(1)) if freq_match else None,
        "wifiEndereco": ips.get(wifi_name),
        "ethernetEndereco": ips.get(eth_name),
        "wifiRedes": networks,
    }


def read_attribute(path, name):
    try:
        return (path / name).read_text(errors="replace").strip()
    except OSError:
        return None


def usb_printers():
    found = []
    for node in sorted(Path("/dev/usb").glob("lp*")):
        sysdev = Path("/sys/class/usbmisc") / node.name / "device"
        current = sysdev.resolve() if sysdev.exists() else None
        vendor = product = None
        usb_port = None
        while current and current != current.parent:
            vendor = read_attribute(current, "idVendor")
            product = read_attribute(current, "idProduct")
            if vendor and product:
                usb_port = current.name
                break
            current = current.parent
        if vendor and product and usb_port:
            identifier = f"usb:{vendor}:{product}:{usb_port}"
            name = read_attribute(current, "product") or "Impressora USB"
            found.append({"id": identifier[:100], "nome": name[:100], "path": node})
    return found


def device_info():
    model = read_attribute(Path("/proc/device-tree"), "model")
    os_name = ""
    try:
        for line in Path("/etc/os-release").read_text().splitlines():
            if line.startswith("PRETTY_NAME="):
                os_name = line.split("=", 1)[1].strip('"')
                break
    except OSError:
        pass
    return {"hostname": socket.gethostname()[:80], "modelo": (model or "").strip("\x00")[:100], "sistema": os_name[:100], "arquitetura": os.uname().machine[:40]}


def connect_db():
    JOURNAL.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    db = sqlite3.connect(JOURNAL)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA synchronous=FULL")
    db.execute("CREATE TABLE IF NOT EXISTS envios (id TEXT PRIMARY KEY, estado TEXT NOT NULL, finalizado INTEGER NOT NULL DEFAULT 0)")
    db.commit()
    return db


def ack(db, token, job_id, estado):
    response = request_json("/trabalhos/" + job_id, token, "POST", {"estado": estado})
    if response.get("concluido"):
        db.execute("UPDATE envios SET finalizado=1 WHERE id=?", (job_id,))
        db.commit()


def recover_unacknowledged(db, token):
    rows = db.execute("SELECT id, estado FROM envios WHERE finalizado=0 ORDER BY rowid LIMIT 20").fetchall()
    for job_id, estado in rows:
        if estado == "RESERVADO" or estado == "PODE_TER_ENVIADO":
            estado = "INCERTO"
            db.execute("UPDATE envios SET estado=? WHERE id=?", (estado, job_id))
            db.commit()
        try:
            ack(db, token, job_id, estado)
        except urllib.error.HTTPError as exc:
            if exc.code == 409:
                # Reserva vencida no servidor: manter diário local, sem reimprimir.
                db.execute("UPDATE envios SET finalizado=1 WHERE id=?", (job_id,))
                db.commit()
            else:
                raise


def send_job(db, token, job, printers):
    job_id = job.get("id")
    if not isinstance(job_id, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{10,80}", job_id):
        return
    existing = db.execute("SELECT estado FROM envios WHERE id=?", (job_id,)).fetchone()
    if existing:
        recover_unacknowledged(db, token)
        return
    db.execute("INSERT INTO envios (id, estado) VALUES (?, 'RESERVADO')", (job_id,))
    db.commit()
    printer = next((item for item in printers if item["id"] == job.get("impressoraId")), None)
    zpl = job.get("zpl")
    if not printer or not isinstance(zpl, str) or len(zpl) > 200_000 or not zpl.startswith("^XA") or not zpl.rstrip().endswith("^XZ"):
        estado = "FALHA"
    else:
        try:
            # Ao abrir o dispositivo, ainda não há bytes enviados.
            with open(printer["path"], "wb", buffering=0) as device:
                db.execute("UPDATE envios SET estado='PODE_TER_ENVIADO' WHERE id=?", (job_id,))
                db.commit()
                data = zpl.encode("ascii", errors="strict")
                if device.write(data) != len(data):
                    raise OSError("Escrita USB incompleta")
            estado = "ENVIADO_USB"
        except (OSError, UnicodeError):
            previous = db.execute("SELECT estado FROM envios WHERE id=?", (job_id,)).fetchone()
            estado = "INCERTO" if previous and previous[0] == "PODE_TER_ENVIADO" else "FALHA"
    db.execute("UPDATE envios SET estado=? WHERE id=?", (estado, job_id))
    db.commit()
    ack(db, token, job_id, estado)


def process_wifi_change(token):
    response = request_json("/rede", token)
    change = response.get("pedido")
    if not change:
        return
    payload = {key: change.get(key) for key in ("id", "ssid", "senha")}
    try:
        result = subprocess.run(
            ["/usr/bin/sudo", "-n", "/usr/bin/python3", "/opt/grazing-etiquetas/wifi_helper.py", "apply"],
            input=json.dumps(payload), text=True, capture_output=True, timeout=90, check=False,
        )
        state = result.stdout.strip() if result.returncode == 0 and result.stdout.strip() in ("CONFIRMADA", "REVERTIDA") else "FALHA"
    except (OSError, subprocess.TimeoutExpired):
        # O rollback local pode continuar mesmo se este processo perder a resposta.
        state = "FALHA"
    request_json("/rede/" + change["id"], token, "POST", {"estado": state})


def main():
    token = json.loads(CONFIG.read_text())["token"]
    if not re.fullmatch(r"gpi_[a-f0-9]{64}", token):
        raise ValueError("Credencial do conector inválida")
    db = connect_db()
    next_heartbeat = 0
    while True:
        try:
            printers = usb_printers()
            if time.monotonic() >= next_heartbeat:
                payload = {**device_info(), **local_network(), "usbImpressoras": [{"id": item["id"], "nome": item["nome"]} for item in printers]}
                request_json("/comunicacao", token, "POST", payload)
                next_heartbeat = time.monotonic() + HEARTBEAT_SECONDS
            recover_unacknowledged(db, token)
            process_wifi_change(token)
            result = request_json("/trabalhos", token)
            if result.get("trabalho"):
                send_job(db, token, result["trabalho"], printers)
        except (OSError, ValueError, urllib.error.URLError, sqlite3.Error) as exc:
            # Tipo de erro apenas. Nunca imprimir URL, payload, token ou ZPL.
            print("conector: falha temporária:", type(exc).__name__, file=sys.stderr)
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
