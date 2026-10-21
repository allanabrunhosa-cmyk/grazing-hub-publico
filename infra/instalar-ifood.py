"""Instalar os dois workers iFood na mesma imagem/configuração do HUB.

Executar na VPS autorizada: python3 instalar-ifood.py --verificar | --aplicar.
Não recebe nem imprime credenciais. Produção continua exigindo sua chave própria.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

APP = "app-copy-auxiliary-microchip-9hhwdm"
PAPEIS = ("coletor", "processador")


def consultar(*args):
    return subprocess.check_output(args, text=True).strip()


def executar(*args):
    resultado = subprocess.run(args, capture_output=True, text=True)
    if resultado.returncode:
        raise SystemExit("Falha ao configurar worker; verificar Docker sem exibir segredos.")


def main():
    if sys.argv[1:] not in (["--verificar"], ["--aplicar"]):
        raise SystemExit("Use --verificar ou --aplicar.")
    os.umask(0o077)
    app = json.loads(consultar("docker", "service", "inspect", APP))[0]
    tarefa = app["Spec"]["TaskTemplate"]
    container = tarefa["ContainerSpec"]
    env = container.get("Env", [])
    valores = dict(e.split("=", 1) for e in env)
    if valores.get("IFOOD_ATIVO") != "1":
        raise SystemExit("Recepção iFood precisa estar explicitamente liberada no servidor.")
    if not all(valores.get(k) for k in ("DATABASE_URL", "AUTH_SECRET", "IFOOD_TESTE_CLIENT_ID", "IFOOD_TESTE_CLIENT_SECRET")):
        raise SystemExit("Configuração de teste incompleta; nenhum worker alterado.")
    redes = tarefa.get("Networks", [])
    if len(redes) != 1:
        raise SystemExit("Rede do HUB ambígua; nenhum worker alterado.")
    # Apenas dependências do worker: não propagar segredos fiscais ou de outros serviços.
    env_worker = [e for e in env if e.split("=", 1)[0] in {
        "DATABASE_URL", "AUTH_SECRET", "NODE_ENV", "IFOOD_ATIVO",
        "IFOOD_PRODUCAO_AUTORIZADA", "IFOOD_ACOMPANHAMENTO_PRODUCAO_AUTORIZADO", "IFOOD_ACOMPANHAMENTO_MERCHANT_ID", "IFOOD_TESTE_CLIENT_ID", "IFOOD_TESTE_CLIENT_SECRET",
        "IFOOD_PRODUCAO_CLIENT_ID", "IFOOD_PRODUCAO_CLIENT_SECRET",
    }]
    existentes = consultar("docker", "service", "ls", "--format", "{{.Name}}").splitlines()
    for papel in PAPEIS:
        nome = "grazing-ifood-" + papel
        if nome in existentes:
            worker = json.loads(consultar("docker", "service", "inspect", nome))[0]
            atual = worker["Spec"]["TaskTemplate"]
            if sorted(atual["ContainerSpec"].get("Env", [])) != sorted(env_worker):
                raise SystemExit("Credenciais/configuração do worker mudaram; realizar rotação administrativa controlada.")
            if atual.get("Networks") != redes:
                raise SystemExit("Rede do worker diverge do HUB; revisar antes de atualizar.")
    print("Configuração verificada: dois workers, rede do HUB, sem portas públicas.")
    if sys.argv[1] == "--verificar":
        return
    for papel in PAPEIS:
        nome = "grazing-ifood-" + papel
        if nome in existentes:
            executar("docker", "service", "update", "--detach=true", "--no-resolve-image",
                     "--image", container["Image"], "--force", nome)
        else:
            arquivo = None
            try:
                with tempfile.NamedTemporaryFile(mode="w", prefix="grazing-ifood-", delete=False) as f:
                    arquivo = Path(f.name)
                    os.chmod(arquivo, 0o600)
                    f.write("\n".join(env_worker) + "\n")
                comando = ["docker", "service", "create", "--detach=true", "--no-resolve-image",
                           "--name", nome, "--replicas", "1", "--restart-condition", "any",
                           "--restart-delay", "5s", "--stop-grace-period", "30s",
                           "--network", redes[0]["Target"], "--env-file", str(arquivo),
                           container["Image"], "node", "--conditions=react-server", "--import", "tsx",
                           "/app/scripts/processar-ifood.ts"]
                if papel == "coletor":
                    comando.append("--coletor")
                executar(*comando)
            finally:
                if arquivo:
                    arquivo.unlink(missing_ok=True)
        print(nome + ": implantação solicitada; conferir tarefa Running e indicadores no HUB.")


if __name__ == "__main__":
    main()
