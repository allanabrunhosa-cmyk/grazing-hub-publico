#!/usr/bin/env python3
"""Operações NetworkManager delimitadas; executado como root somente pelo conector."""

import json
import os
import re
import socket
import ssl
import subprocess
import sys
import uuid
from pathlib import Path

NM_DIR = Path("/etc/NetworkManager/system-connections")
STATE_DIR = Path("/run/grazing-etiquetas-wifi")
HOST = "etiquetas.grazinghub.com.br"


def command(*args, timeout=60):
    result = subprocess.run(args, check=False, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError("NetworkManager recusou a operação")
    return result.stdout.strip()


def escape_keyfile(value):
    escaped = value.replace("\\", "\\\\").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t")
    leading = len(escaped) - len(escaped.lstrip(" "))
    trailing = len(escaped) - len(escaped.rstrip(" "))
    middle = escaped[leading:len(escaped) - trailing if trailing else len(escaped)]
    return "\\s" * leading + middle + "\\s" * trailing


def probe_wifi(interface):
    # SO_BINDTODEVICE impede que um cabo Ethernet prove conectividade por engano.
    for family, kind, proto, _, address in socket.getaddrinfo(HOST, 443, type=socket.SOCK_STREAM):
        try:
            sock = socket.socket(family, kind, proto)
            sock.settimeout(8)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BINDTODEVICE, interface.encode() + b"\0")
            with sock:
                sock.connect(address)
                with ssl.create_default_context().wrap_socket(sock, server_hostname=HOST) as tls:
                    tls.sendall(b"HEAD / HTTP/1.1\r\nHost: " + HOST.encode() + b"\r\nConnection: close\r\n\r\n")
                    return bool(tls.recv(1))
        except (OSError, ssl.SSLError):
            continue
    return False


def read_marker(identifier):
    if not re.fullmatch(r"[a-z0-9_-]{10,80}", identifier):
        raise ValueError("Identificador inválido")
    path = STATE_DIR / (identifier + ".json")
    return path, json.loads(path.read_text())


def rollback(identifier):
    try:
        marker, state = read_marker(identifier)
    except OSError:
        return
    try:
        command("/usr/bin/nmcli", "--wait", "45", "connection", "up", "uuid", state["old"], "ifname", state["interface"])
    finally:
        subprocess.run(["/usr/bin/nmcli", "connection", "delete", "uuid", state["new"]], capture_output=True, timeout=15)
        Path(state["path"]).unlink(missing_ok=True)
        marker.unlink(missing_ok=True)


def apply_change():
    request = json.loads(sys.stdin.read(2048))
    identifier = request.get("id")
    if not isinstance(identifier, str) or not re.fullmatch(r"[a-z0-9_-]{10,80}", identifier):
        raise ValueError("Solicitação inválida")
    ssid = request.get("ssid")
    password = request.get("senha")
    if not isinstance(ssid, str) or not 1 <= len(ssid.encode()) <= 32 or any(ord(c) < 32 for c in ssid):
        raise ValueError("Rede inválida")
    if not isinstance(password, str) or not (re.fullmatch(r"[\x20-\x7e]{8,63}", password) or re.fullmatch(r"[a-fA-F0-9]{64}", password)):
        raise ValueError("Credencial inválida")
    interface = next((item.name for item in Path("/sys/class/net").iterdir() if (item / "wireless").exists()), None)
    if not interface:
        raise RuntimeError("Wi-Fi não encontrado")
    old = command("/usr/bin/nmcli", "-g", "GENERAL.CON-UUID", "device", "show", interface, timeout=10)
    if not re.fullmatch(r"[a-fA-F0-9-]{36}", old):
        raise RuntimeError("Sem perfil anterior para recuperação")
    new = str(uuid.uuid4())
    path = NM_DIR / ("grazing-" + new + ".nmconnection")
    content = (
        "[connection]\n" + f"id=grazing-wifi-{new}\nuuid={new}\ntype=wifi\ninterface-name={interface}\nautoconnect=true\nautoconnect-priority=20\n"
        + "[wifi]\nmode=infrastructure\nssid=" + escape_keyfile(ssid) + "\n"
        + "[wifi-security]\nkey-mgmt=wpa-psk\npsk=" + escape_keyfile(password) + "\n"
        + "[ipv4]\nmethod=auto\n[ipv6]\nmethod=auto\n"
    )
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as output:
        output.write(content)
    STATE_DIR.mkdir(mode=0o700, exist_ok=True)
    marker = STATE_DIR / (identifier + ".json")
    fd = os.open(marker, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as output:
        json.dump({"old": old, "new": new, "interface": interface, "path": str(path)}, output)
    timer = "grazing-wifi-reverter-" + identifier
    try:
        command("/usr/bin/nmcli", "connection", "load", str(path), timeout=15)
        command("/usr/bin/systemd-run", "--unit=" + timer, "--on-active=120s", "/usr/bin/python3", "/opt/grazing-etiquetas/wifi_helper.py", "rollback", identifier, timeout=10)
        command("/usr/bin/nmcli", "--wait", "50", "connection", "up", "uuid", new, "ifname", interface, timeout=55)
        if not probe_wifi(interface):
            raise RuntimeError("HTTPS pelo Wi-Fi não respondeu")
    except Exception:
        rollback(identifier)
        return "REVERTIDA"
    command("/usr/bin/systemctl", "stop", timer + ".timer", timeout=10)
    marker.unlink(missing_ok=True)
    return "CONFIRMADA"


def main():
    if os.geteuid() != 0:
        raise SystemExit(1)
    try:
        if len(sys.argv) == 2 and sys.argv[1] == "apply":
            print(apply_change())
        elif len(sys.argv) == 3 and sys.argv[1] == "rollback":
            rollback(sys.argv[2])
        else:
            raise SystemExit(1)
    except Exception:
        # Nunca imprimir SSID, senha, arquivo de perfil ou payload.
        print("FALHA")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
