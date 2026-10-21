import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

function chave() {
  const valor = process.env.ETIQUETAS_WIFI_KEY;
  if (!valor) throw new Error("A chave de proteção de credenciais Wi-Fi ainda não foi configurada no servidor.");
  const bytes = Buffer.from(valor, "base64");
  if (bytes.length !== 32) throw new Error("Chave de proteção Wi-Fi inválida.");
  return bytes;
}

export function cifrarSenhaWifi(senha: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chave(), nonce);
  const encrypted = Buffer.concat([cipher.update(senha, "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64");
}

function decifrarSenhaWifi(valor: string) {
  const dados = Buffer.from(valor, "base64");
  if (dados.length < 29) throw new Error("Credencial Wi-Fi corrompida.");
  const decipher = createDecipheriv("aes-256-gcm", chave(), dados.subarray(0, 12));
  decipher.setAuthTag(dados.subarray(12, 28));
  return Buffer.concat([decipher.update(dados.subarray(28)), decipher.final()]).toString("utf8");
}

export async function entregarMudancaWifi(pontoId: string) {
  return prisma.$transaction(async (tx) => {
    const agora = new Date();
    await tx.mudancaWifiPonto.updateMany({ where: { pontoId, estado: "PENDENTE", expiraEm: { lte: agora } }, data: { estado: "EXPIRADA", segredoCifrado: null, finalizadoEm: agora } });
    const pedido = await tx.mudancaWifiPonto.findFirst({ where: { pontoId, estado: "PENDENTE", expiraEm: { gt: agora } }, orderBy: { createdAt: "asc" } });
    if (!pedido?.segredoCifrado) return null;
    const senha = decifrarSenhaWifi(pedido.segredoCifrado);
    const atualizado = await tx.mudancaWifiPonto.updateMany({ where: { id: pedido.id, estado: "PENDENTE", expiraEm: { gt: agora } }, data: { estado: "ENTREGUE", segredoCifrado: null, entregueEm: agora } });
    if (!atualizado.count) return null;
    return { id: pedido.id, ssid: pedido.ssid, senha };
  });
}
