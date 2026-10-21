import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const LOJA_ETIQUETAS = "singleton";
const RESERVA_MS = 120_000;
const VINCULO_MS = 10 * 60_000;
const PENDENCIA_MAXIMA_MS = 24 * 60 * 60_000;
const CHAVE_LIMITE = process.env.AUTH_SECRET || randomBytes(32).toString("hex");

export function hashSegredo(valor: string) {
  return createHash("sha256").update(valor).digest("hex");
}

function hashOrigem(valor: string) {
  return createHmac("sha256", CHAVE_LIMITE).update(valor).digest("hex");
}

export async function emitirCodigoVinculo(pontoId: string, usuarioId: string) {
  const codigo = randomBytes(18).toString("hex").toUpperCase();
  const expiraEm = new Date(Date.now() + VINCULO_MS);
  await prisma.$transaction(async (tx) => {
    const ponto = await tx.pontoImpressao.findFirst({ where: { id: pontoId, lojaId: LOJA_ETIQUETAS, ativo: true }, include: { dispositivo: true } });
    if (!ponto) throw new Error("Ponto inativo ou inexistente.");
    if (ponto.dispositivo && !ponto.dispositivo.revogadoEm) throw new Error("Revogue o vínculo atual antes de vincular outro equipamento.");
    await tx.codigoVinculoImpressao.updateMany({ where: { pontoId, usadoEm: null }, data: { usadoEm: new Date() } });
    await tx.codigoVinculoImpressao.create({ data: { lojaId: LOJA_ETIQUETAS, pontoId, codigoHash: hashSegredo(codigo), expiraEm, criadoPorId: usuarioId } });
  });
  return { codigo, expiraEm };
}

function ipDeOrigem(request: Request) {
  // Só o proxy reverso autorizado deve preencher este cabeçalho. A limitação não é
  // usada como identidade: o código aleatório continua sendo o fator de vínculo.
  return request.headers.get("x-real-ip")?.slice(0, 64) || "sem-ip";
}

export async function consumirCodigoVinculo(codigo: string, request: Request) {
  if (!/^[A-F0-9]{36}$/.test(codigo)) return null;
  const agora = new Date();
  const chaveLimite = hashOrigem(`vinculo:${ipDeOrigem(request)}`);
  const chaveGlobal = hashOrigem("vinculo:global");
  const token = `gpi_${randomBytes(32).toString("hex")}`;
  return prisma.$transaction(async (tx) => {
    await tx.limiteVinculoImpressao.deleteMany({ where: { expiraEm: { lt: agora } } });
    const global = await tx.$queryRaw<Array<{ tentativas: number }>>(Prisma.sql`
      INSERT INTO "LimiteVinculoImpressao" ("chave", "tentativas", "expiraEm")
      VALUES (${chaveGlobal}, 1, ${new Date(agora.getTime() + 15 * 60_000)})
      ON CONFLICT ("chave") DO UPDATE SET "tentativas" = "LimiteVinculoImpressao"."tentativas" + 1
      RETURNING "tentativas"
    `);
    if ((global[0]?.tentativas ?? 999) > 100) return null;
    const janela = await tx.$queryRaw<Array<{ tentativas: number }>>(Prisma.sql`
      INSERT INTO "LimiteVinculoImpressao" ("chave", "tentativas", "expiraEm")
      VALUES (${chaveLimite}, 1, ${new Date(agora.getTime() + 15 * 60_000)})
      ON CONFLICT ("chave") DO UPDATE SET
        "tentativas" = CASE WHEN "LimiteVinculoImpressao"."expiraEm" <= ${agora} THEN 1 ELSE "LimiteVinculoImpressao"."tentativas" + 1 END,
        "expiraEm" = CASE WHEN "LimiteVinculoImpressao"."expiraEm" <= ${agora} THEN ${new Date(agora.getTime() + 15 * 60_000)} ELSE "LimiteVinculoImpressao"."expiraEm" END
      RETURNING "tentativas"
    `);
    if ((janela[0]?.tentativas ?? 99) > 8) return null;
    const registro = await tx.codigoVinculoImpressao.findUnique({ where: { codigoHash: hashSegredo(codigo) }, include: { ponto: { include: { dispositivo: true } } } });
    if (!registro || registro.usadoEm || registro.expiraEm <= agora || registro.tentativas >= 5 || !registro.ponto.ativo || registro.lojaId !== registro.ponto.lojaId || (registro.ponto.dispositivo && !registro.ponto.dispositivo.revogadoEm)) return null;
    const consumido = await tx.codigoVinculoImpressao.updateMany({ where: { id: registro.id, usadoEm: null, tentativas: { lt: 5 }, expiraEm: { gt: agora } }, data: { usadoEm: agora, tentativas: { increment: 1 } } });
    if (consumido.count !== 1) return null;
    if (registro.ponto.dispositivo) {
      await tx.dispositivoImpressao.update({ where: { pontoId: registro.pontoId }, data: { tokenHash: hashSegredo(token), revogadoEm: null, vistoEm: null, usbImpressoras: Prisma.DbNull, impressoraDetectada: false } });
    } else {
      await tx.dispositivoImpressao.create({ data: { pontoId: registro.pontoId, tokenHash: hashSegredo(token) } });
    }
    return { token, pontoId: registro.pontoId };
  });
}

export async function autenticarDispositivo(request: Request) {
  const autorizacao = request.headers.get("authorization") ?? "";
  if (!/^Bearer gpi_[a-f0-9]{64}$/.test(autorizacao)) return null;
  const tokenHash = hashSegredo(autorizacao.slice(7));
  const dispositivo = await prisma.dispositivoImpressao.findUnique({ where: { tokenHash }, include: { ponto: true } });
  if (!dispositivo || dispositivo.revogadoEm || !dispositivo.ponto.ativo) return null;
  return dispositivo;
}

export async function reservarProximoEnvio(pontoId: string, lojaId: string) {
  return prisma.$transaction(async (tx) => {
    const trava = await tx.$queryRaw<Array<{ obtida: boolean }>>(Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtext(${pontoId})) AS obtida`);
    if (!trava[0]?.obtida) return null;
    if (!await tx.pontoImpressao.findFirst({ where: { id: pontoId, lojaId, ativo: true, excluidoEm: null, dispositivo: { is: { revogadoEm: null } } } })) return null;
    const agora = new Date();
    await tx.envioPontoImpressao.updateMany({
      where: { pontoId, lojaId, estado: "PENDENTE", createdAt: { lt: new Date(agora.getTime() - PENDENCIA_MAXIMA_MS) } },
      data: { estado: "FALHA", finalizadoEm: agora, detalhe: "Trabalho expirou na fila antes de chegar à impressora. Reimprima explicitamente se ainda for válido." },
    });
    await tx.envioPontoImpressao.updateMany({
      where: { pontoId, lojaId, estado: "RESERVADO", reservaAte: { lt: agora } },
      data: { estado: "INCERTO", finalizadoEm: agora, detalhe: "Prazo da reserva encerrado; não reenviar automaticamente." },
    });
    const emCurso = await tx.envioPontoImpressao.count({ where: { pontoId, lojaId, estado: "RESERVADO" } });
    if (emCurso) return null;
    const proximo = await tx.envioPontoImpressao.findFirst({ where: { pontoId, lojaId, estado: "PENDENTE" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    if (!proximo) return null;
    if (proximo.origemMcpOperacaoId) {
      const { permitirEfeitoPendenteMcp } = await import("@/lib/mcp/efeito-pendente");
      if (!await permitirEfeitoPendenteMcp(tx, proximo.origemMcpOperacaoId, proximo.solicitadoPorId, lojaId)) {
        await tx.envioPontoImpressao.update({ where: { id: proximo.id }, data: { estado: "FALHA", finalizadoEm: agora, detalhe: "Acesso MCP retirado antes do envio à impressora. Nenhum envio realizado." } });
        return null;
      }
    }
    return tx.envioPontoImpressao.update({ where: { id: proximo.id }, data: { estado: "RESERVADO", reservadaEm: agora, reservaAte: new Date(agora.getTime() + RESERVA_MS) } });
  });
}

export async function finalizarEnvio(pontoId: string, envioId: string, estado: "ENVIADO_USB" | "FALHA" | "INCERTO") {
  const atualizado = await prisma.envioPontoImpressao.updateMany({
    where: { id: envioId, pontoId, estado: "RESERVADO" },
    data: { estado, finalizadoEm: new Date(), detalhe: estado === "ENVIADO_USB" ? "Dados entregues à interface USB; saída física não confirmada." : estado === "INCERTO" ? "Envio USB pode ter ocorrido; exige conferência local." : "Falha antes de qualquer envio USB." },
  });
  return atualizado.count === 1;
}
