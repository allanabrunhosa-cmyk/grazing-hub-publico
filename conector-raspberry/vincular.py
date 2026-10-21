#!/usr/bin/env python3
"""Troca código temporário por token sem imprimir a credencial."""
import json
import os
import sys
import urllib.request
import urllib.error

codigo = sys.stdin.read().strip().upper()
if len(codigo) != 36 or any(c not in "0123456789ABCDEF" for c in codigo):
    raise SystemExit(1)
request = urllib.request.Request(
    "https://etiquetas.grazinghub.com.br/api/etiquetas/conector/vincular",
    data=json.dumps({"codigo": codigo}).encode(),
    headers={"Content-Type": "application/json", "Accept": "application/json"},
    method="POST",
)
try:
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, request, fp, code, msg, headers, newurl):
            raise urllib.error.HTTPError(request.full_url, code, "Redirecionamento recusado", headers, fp)
    with urllib.request.build_opener(NoRedirect).open(request, timeout=15) as response:
        token = json.load(response)["token"]
except Exception:
    print("Vínculo recusado ou conexão indisponível.", file=sys.stderr)
    raise SystemExit(1)
if not isinstance(token, str) or not token.startswith("gpi_"):
    raise SystemExit(1)
target = "/etc/grazing-etiquetas/conector.json"
fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o640)
with os.fdopen(fd, "w") as output:
    json.dump({"token": token}, output)
