"""Executar via SSH na VPS: python3 - preparar|restaurar < scripts/deploy-etiquetas.py.

Preserva somente as configurações SEFAZ do serviço e cria backup pré-migration.
Não imprime segredos, não consulta a SEFAZ e não restaura o banco automaticamente.
"""
import json
import os
import re
from pathlib import Path
import subprocess
import sys

SERVICO = "app-copy-auxiliary-microchip-9hhwdm"
BANCO = "postgres-index-optical-alarm-pzjdxf"
identificador = sys.argv[2] if len(sys.argv) > 2 else "etiquetas-20260916"
if not re.fullmatch(r"etiquetas-[a-z0-9-]+", identificador):
    raise SystemExit("Identificador de backup inválido.")
raiz_backup = os.environ.get("GRAZING_BACKUP_ROOT", "")
if not raiz_backup or not Path(raiz_backup).is_absolute():
    raise SystemExit("Configure GRAZING_BACKUP_ROOT com o destino privado absoluto do backup.")
PASTA = Path(raiz_backup) / identificador


def executar(*args):
    return subprocess.check_output(args, text=True).strip()


def configuracao():
    return json.loads(executar("docker", "service", "inspect", SERVICO))[0]["Spec"]["TaskTemplate"]["ContainerSpec"]


os.umask(0o077)
modo = sys.argv[1]
if modo == "preparar":
    atual = configuracao()
    env = [valor for valor in atual.get("Env", []) if valor.startswith(("SEFAZ_CERTIFICADO_PATH=", "SEFAZ_CERTIFICADO_SENHA=", "SEFAZ_CNPJ="))]
    mounts = [m for m in atual.get("Mounts", []) if m["Target"] == "/run/secrets/certificado.pfx"]
    if (len(env), len(mounts)) not in {(0, 0), (3, 1)}:
        raise SystemExit("Configuração SEFAZ incompleta: interrompido antes de publicar.")
    fonte_certificado = "ambiente" if env else "banco"
    PASTA.mkdir(parents=True, exist_ok=True, mode=0o700)
    containers = executar("docker", "ps", "--filter", "label=com.docker.swarm.service.name=" + BANCO, "--format", "{{.ID}}").splitlines()
    if len(containers) != 1:
        raise SystemExit("Container do banco ambíguo: interrompido.")
    if fonte_certificado == "banco":
        certificados = executar("docker", "exec", containers[0], "sh", "-c", "psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -Atc 'select count(*) from \"CertificadoDigital\";'")
        if certificados != "1":
            raise SystemExit("Nenhum certificado SEFAZ único foi encontrado no banco: interrompido antes de publicar.")
    with (PASTA / "configuracao.json").open("x") as arquivo:
        json.dump({"env": env, "mounts": mounts, "fonteCertificado": fonte_certificado, "imagemAnterior": atual["Image"]}, arquivo)
    with (PASTA / "antes-etiquetas.dump").open("xb") as arquivo:
        subprocess.run(["docker", "exec", containers[0], "sh", "-c", 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc'], stdout=arquivo, check=True)
    if (PASTA / "antes-etiquetas.dump").stat().st_size < 1000:
        raise SystemExit("Backup vazio: interrompido.")
    print("Backup pré-migration e configuração fiscal preservados na VPS, acesso restrito ao root.")
elif modo == "restaurar":
    salvo = json.loads((PASTA / "configuracao.json").read_text())
    atual = configuracao()
    argumentos = ["docker", "service", "update", "--detach=true"]
    for valor in salvo["env"]:
        if valor not in atual.get("Env", []):
            argumentos.extend(["--env-add", valor])
    for mount in salvo["mounts"]:
        if mount not in atual.get("Mounts", []):
            argumentos.extend(["--mount-add", f'type=bind,source={mount["Source"]},target={mount["Target"]},readonly'])
    if len(argumentos) > 4:
        # Não propagar stderr/exceções que possam reproduzir os argumentos com segredos.
        resultado = subprocess.run(argumentos + [SERVICO], capture_output=True)
        if resultado.returncode:
            raise SystemExit("Falha ao reaplicar configuração fiscal; revisar na VPS sem exibir segredos.")
        print("Configuração fiscal reaplicada; aguardar estabilização do serviço.")
    else:
        print("Configuração fiscal já preservada integralmente.")
    conferida = configuracao()
    assert all(v in conferida.get("Env", []) for v in salvo["env"])
    assert all(m in conferida.get("Mounts", []) for m in salvo["mounts"])
    print("Variáveis fiscais e mount conferidos sem consulta externa.")
else:
    raise SystemExit("Use preparar ou restaurar.")
