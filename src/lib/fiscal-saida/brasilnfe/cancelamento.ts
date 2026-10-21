import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { conferirAcesso } from "@/lib/vendas/pedidos";
import { exigirEfeitoOperacional } from "@/lib/ifood/acompanhamento";
import { consultarFiscalSaida, executarFiscalSaidaManual } from "../servico";
import { AdaptadorBrasilNfeM1 } from "./adaptador";
import { criarPortaTecnicaBrasilNfe } from "./porta-tecnica";
import { conferirAutorizacaoBrasilNfe } from "./resposta-fiscal";
import { obterClienteHomologacaoBrasilNfe, conferirAcessoAdministrativoBrasilNfe } from "./configuracao";
import { registrarCapacidadeEmissaoManualBrasilNfe } from "./capacidade-operacional";
import { executarComAutorizacaoManualBrasilNfe, exigirTransmissaoBrasilNfeLiberada } from "./bloqueio-transmissao";
import { ErroEmissaoPedidoBrasilNfe } from "./operacional-dominio";
import { validarComandoCancelamentoPedidoBrasilNfe } from "./cancelamento-dominio";

const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const falhar = (mensagem: string): never => { throw new ErroEmissaoPedidoBrasilNfe(mensagem); };
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

/** Cancelamento individual da autorização original. Não depende da revisão atual
 * do pedido e não recalcula tributos históricos. Nenhuma capacidade vai à fila automática. */
export async function cancelarNotaPedidoBrasilNfe(entrada: unknown, sessao: SessaoAtual) {
  const e = validarComandoCancelamentoPedidoBrasilNfe(entrada);
  const ler = async (tx: Prisma.TransactionClient) => {
    await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar");
    await conferirAcesso(tx, sessao, ["consultar", "revisar", "fiscal"]);
    const d = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id: e.documentoId } });
    await exigirEfeitoOperacional(tx, d.pedidoId);
    if (d.provedor !== "BRASIL_NFE" || d.ambiente !== e.ambiente || d.modeloDocumento !== e.modelo
      || d.chaveFiscal !== e.chaveFiscal || d.protocolo !== e.protocolo || !d.numero || !d.serie)
      return falhar("A nota ou o ambiente mudou. Reabra o documento autorizado antes de cancelar.");
    if (d.status !== "AUTORIZADO" || d.cancelamentoPendente || d.protocoloCancelamento)
      return falhar("Somente uma nota autorizada e sem cancelamento pendente pode ser cancelada. Consulte o resultado existente.");
    return d;
  };
  const original = await prisma.$transaction(ler);
  const contexto = await obterClienteHomologacaoBrasilNfe(sessao, e.ambiente);
  const identidade = { documentoId: original.id, ambiente: e.ambiente, modeloDocumento: e.modelo, emitenteCnpj: contexto.emitenteCnpj, chaveIdempotencia: original.id, referencia: original.referenciaProvedor, ultimaSequencia: original.ultimaSequencia };
  conferirAutorizacaoBrasilNfe(identidade, { chave: e.chaveFiscal, protocolo: e.protocolo, numero: original.numero!, serie: original.serie! });
  const hashComando = createHash("sha256").update(JSON.stringify(e)).digest("hex");
  const autorizacao = await prisma.$transaction(async tx => {
    await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar");
    await conferirAcesso(tx, sessao, ["consultar", "revisar", "fiscal"]);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fiscal-saida'))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('brasilnfe-config'))`;
    const d = await ler(tx);
    const configuracao = await tx.configuracaoBrasilNfe.findUniqueOrThrow({ where: { id: "singleton" }, select: { versao: true } });
    const emissao = objeto((await tx.eventoFiscalSaida.findUnique({ where: { chave: `emissao-manual-autorizada:${d.id}` }, select: { dados: true } }))?.dados);
    if (d.hashPayload !== original.hashPayload || d.acao || d.leaseToken || configuracao.versao !== contexto.versao
      || emissao.hashSnapshot !== d.hashPayload)
      return falhar("A configuração ou a identidade da nota diverge da emissão original. Confira o documento antes de cancelar.");
    if (await tx.eventoFiscalSaida.findUnique({ where: { chave: `cancelamento-manual-autorizado:${d.id}` }, select: { id: true } }))
      return falhar("O cancelamento desta nota já foi solicitado. Consulte o resultado antes de outra ação.");
    return tx.eventoFiscalSaida.create({ data: { documentoId: d.id, chave: `cancelamento-manual-autorizado:${d.id}`, tipo: "CANCELAMENTO_MANUAL_AUTORIZADO",
      dados: json({ ...e, usuarioId: sessao.userId, hashSnapshot: d.hashPayload, hashComando, versaoConfiguracao: contexto.versao, emitenteHash: contexto.emitenteHash }) } });
  });
  const tecnica = criarPortaTecnicaBrasilNfe(sessao, e.ambiente);
  const base = new AdaptadorBrasilNfeM1(contexto.cliente, contexto.emitenteCnpj, { ...tecnica,
    async preparar() { return falhar("Este contexto permite somente cancelar a nota confirmada."); },
    async autorizar(operacao, i) {
      if (operacao !== "CANCELAR" || i.documentoId !== original.id || i.ambiente !== e.ambiente || i.modeloDocumento !== e.modelo || i.emitenteCnpj !== contexto.emitenteCnpj)
        return falhar("A operação não corresponde ao cancelamento confirmado.");
      exigirTransmissaoBrasilNfeLiberada({ documentoId: i.documentoId, ambiente: e.ambiente, modelo: e.modelo, operacao: "CANCELAR", hashSnapshot: original.hashPayload, hashPayloadFiscal: hashComando });
      await prisma.$transaction(async tx => {
        await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar");
        await conferirAcesso(tx, sessao, ["consultar", "revisar", "fiscal"]);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fiscal-saida'))`;
        const d = await ler(tx);
        if (d.acao !== "CANCELAR" || d.tentativas !== 1 || !d.leaseToken || !d.leaseAte || d.leaseAte <= new Date()
          || d.hashPayload !== original.hashPayload || d.motivoCancelamento !== e.justificativa
          || await tx.eventoFiscalSaida.findUnique({ where: { chave: `cancelamento-manual-consumido:${d.id}` }, select: { id: true } }))
          return falhar("Cancelamento em andamento ou já processado. Não repita a solicitação.");
        await tx.eventoFiscalSaida.create({ data: { documentoId: d.id, chave: `cancelamento-manual-consumido:${d.id}`, tipo: "CANCELAMENTO_MANUAL_EXECUCAO_INICIADA",
          dados: json({ autorizacaoId: autorizacao.id, usuarioId: sessao.userId, leaseToken: d.leaseToken, hashComando }) } });
      });
    },
  }, e.ambiente);
  const a = registrarCapacidadeEmissaoManualBrasilNfe({ id: base.id, ambiente: base.ambiente,
    enviar: async () => falhar("Este contexto permite somente cancelar a nota confirmada."),
    consultar: base.consultar.bind(base), cancelar: base.cancelar.bind(base), obterDocumentos: base.obterDocumentos.bind(base), autenticarRetorno: async () => null,
  }, original.id);
  await executarComAutorizacaoManualBrasilNfe({
    empresaId: "singleton", operacao: "CANCELAR", documentoId: original.id, emitenteCnpj: contexto.emitenteCnpj, usuarioId: sessao.userId,
    ambiente: e.ambiente, modelo: e.modelo, hashSnapshot: original.hashPayload, hashPayloadFiscal: hashComando,
    versaoConfiguracao: contexto.versao, habilitacaoId: autorizacao.id, autorizacaoId: autorizacao.id,
  }, () => executarFiscalSaidaManual(a, original.id, "CANCELAR", e.justificativa, sessao),
  acaoHTTP => prisma.$transaction(async tx => {
    await conferirAcessoAdministrativoBrasilNfe(tx, sessao, "editar");
    await conferirAcesso(tx, sessao, ["consultar", "revisar", "fiscal"]);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fiscal-saida'))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('brasilnfe-config'))`;
    await tx.$queryRaw`SELECT id FROM "ConfiguracaoLoja" WHERE id='singleton' FOR SHARE`;
    const d = await ler(tx);
    const loja = await tx.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" }, select: { id: true, nome: true, cnpj: true, enderecoEstruturado: true } });
    const hashEmitente = createHash("sha256").update(JSON.stringify(loja)).digest("hex");
    const configuracao = await tx.configuracaoBrasilNfe.findUniqueOrThrow({ where: { id: "singleton" }, select: { versao: true } });
    const consumo = objeto((await tx.eventoFiscalSaida.findUnique({ where: { chave: `cancelamento-manual-consumido:${d.id}` }, select: { dados: true } }))?.dados);
    const registro = objeto((await tx.eventoFiscalSaida.findUnique({ where: { id: autorizacao.id }, select: { dados: true } }))?.dados);
    if (hashEmitente !== contexto.emitenteHash || configuracao.versao !== contexto.versao || d.hashPayload !== original.hashPayload
      || d.acao !== "CANCELAR" || d.tentativas !== 1 || !d.leaseToken || !d.leaseAte || d.leaseAte <= new Date() || d.motivoCancelamento !== e.justificativa
      || consumo.autorizacaoId !== autorizacao.id || consumo.usuarioId !== sessao.userId || consumo.leaseToken !== d.leaseToken || consumo.hashComando !== hashComando
      || registro.usuarioId !== sessao.userId || registro.hashComando !== hashComando || registro.hashSnapshot !== d.hashPayload)
      return falhar("Acesso, configuração ou confirmação mudou antes do cancelamento. Consulte esta nota; não repita a ação.");
    // As mesmas travas protegem a autorização e o único POST. Timeout permanece
    // incerto na fila existente, com chave/protocolo e auditoria preservados.
    return acaoHTTP();
  }, { timeout: 20_000, maxWait: 5_000 }));
  return (await consultarFiscalSaida(original.pedidoId, sessao)).find(d => d.id === original.id)!;
}
