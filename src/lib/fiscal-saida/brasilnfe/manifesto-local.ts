import "server-only";
import { createHash } from "node:crypto";
import type { SessaoAtual } from "@/lib/session";
import { obterComplementosAprovadosDocumentoBrasilNfe } from "./regras-tributarias";
import { ErroRegraFiscalBrasilNfe } from "./regras-tributarias-dominio";
import { serializarPayloadLocalBrasilNfe } from "./payload-local";

/** Leitura autorizada do plano existente. Não cria documento, aprovação, fila ou autorização de envio. */
export async function obterManifestoLocalNfe55BrasilNfe(documentoId: string, sessao: SessaoAtual) {
  const plano = await obterComplementosAprovadosDocumentoBrasilNfe(documentoId, sessao);
  if (!plano) return { estado: "PENDENTE" as const, transmissaoPermitida: false as const, pendencias: [{ campo: "planoId", motivo: "Vincule versões internamente aprovadas à fotografia sintética antes de obter o manifesto." }] };
  if (plano.modelo !== 55) throw new ErroRegraFiscalBrasilNfe("modelo", "Este manifesto prepara exclusivamente NF-e modelo 55 em homologação.");
  if (!plano.evidencia.primeiraEmissaoPendente) throw new ErroRegraFiscalBrasilNfe("documentoId", "A fotografia mudou ou já possui processamento. Não preparar primeira emissão nem autorizar reenvio com este manifesto.");
  if (!plano.resultado.montagemConcluida || !plano.resultado.payload) return { estado: "PENDENTE" as const, transmissaoPermitida: false as const, pendencias: plano.resultado.pendencias };
  const versoes = plano.evidencia.versoes;
  const papeis = new Set(["EMPRESA", "OPERACAO", ...plano.parametros.itens.map(i => `ITEM:${i.itemId}`)]);
  const empresa = versoes.find(v => v.papel === "EMPRESA"), operacao = versoes.find(v => v.papel === "OPERACAO");
  const itensCorrespondentes = plano.parametros.itens.every(i => {
    const v = versoes.find(v => v.papel === `ITEM:${i.itemId}`);
    return v && ["PRODUTO", "GRUPO"].includes(v.alvo) && v.versaoId === i.referenciaFundamentacao;
  });
  if (versoes.length !== papeis.size || new Set(versoes.map(v => v.papel)).size !== papeis.size || versoes.some(v => !papeis.has(v.papel) || !v.fundamentacaoHash || !v.aprovacaoHash) || empresa?.alvo !== "EMPRESA" || operacao?.alvo !== "OPERACAO" || operacao.versaoId !== plano.parametros.referenciaFundamentacao || !itensCorrespondentes) {
    throw new ErroRegraFiscalBrasilNfe("versoes", "O manifesto exige as provas das versões aprovadas de empresa, operação e cada item.");
  }
  const corpo = serializarPayloadLocalBrasilNfe(plano.resultado);
  const manifesto = {
    esquema: "grazing.brasilnfe.manifesto-local" as const, versao: 1 as const,
    planoId: plano.planoId, documentoId: plano.resultado.documentoId,
    modelo: 55 as const, ambiente: 2 as const, hashSnapshot: plano.resultado.hashPayload,
    hashPayloadFiscal: createHash("sha256").update(corpo).digest("hex"),
    total: plano.resultado.payload.ValorTotal, quantidadeItens: plano.resultado.payload.Produtos.length,
    revisaoPedido: plano.evidencia.revisaoPedido, emitenteHash: plano.evidencia.emitenteHash,
    parametrosHash: plano.evidencia.parametrosHash, vinculadoEm: plano.evidencia.vinculadoEm,
    conferidoEm: plano.evidencia.conferidoEm, versoes, transmissaoPermitida: false as const,
    // Confirmação fiscal local não confirma serviço/certificado nem substitui aprovação da transmissão.
    servicoCertificadoRecuperacao: "CONFERENCIA_SEPARADA" as const,
    autorizacaoPrimeiraTransmissao: "PENDENTE" as const,
  };
  return { estado: "PREPARADO_LOCALMENTE" as const, transmissaoPermitida: false as const, pendencias: [], manifesto };
}
