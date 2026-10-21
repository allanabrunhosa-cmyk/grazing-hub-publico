import "server-only";
import { createHash } from "node:crypto";
import type { IdentidadeFiscalSaida, RespostaFiscalSaida } from "../contrato";
import { codigoAmbienteBrasilNfe, conferirChaveBrasilNfe, conferirIdentidadeBrasilNfe, conferirNumeroSerieChaveBrasilNfe, type EvidenciaConsultaBrasilNfe } from "./consulta";
import type { RetornoEnvioBrasilNfe } from "./tipos-http";
import { mensagemCodigoSefaz } from "./mensagens-sefaz";
import { mensagemRejeicaoXmlNfe } from "./texto-xml";

/** Códigos deste endpoint que comprovam rejeição de validação, sem autorização.
 * A lista curta é deliberada: duplicidade, indisponibilidade e código desconhecido
 * exigem conferência; código SEFAZ não é status do envelope de outro endpoint. */
const rejeicoesComprovadas = new Set([215, 225, 386, 725, 787]);
// Exclusivo da recuperação: NT 2026.007 v1.10, RV 12E02-10/cStat 181.
// Não altera a aceitação do envelope nem presume rejeição para código desconhecido.
const rejeicoesConsultaComprovadas = new Set([181, ...rejeicoesComprovadas]);
const denegacoes = new Set([110, 301, 302, 303]);
export type DadosAutorizacaoBrasilNfe = { chave: string; numero: string; serie: string; protocolo: string; protocoloCancelamento?: string; cancelamentoPendente?: boolean };
type Projecao = Pick<RespostaFiscalSaida, "status" | "referencia" | "chave" | "numero" | "serie" | "protocolo" | "protocoloCancelamento" | "erro">;

export function respostaFiscalBrasilNfe(identidade: IdentidadeFiscalSaida, dados: Projecao, codigoSefaz: number | null = null): RespostaFiscalSaida {
  const i = conferirIdentidadeBrasilNfe(identidade);
  const projecao = { documentoId: i.documentoId, ambiente: codigoAmbienteBrasilNfe(i.ambiente), emitente: i.emitenteCnpj, modelo: i.modeloDocumento, ...dados, codigoSefaz };
  // Ordem será atribuída sob a trava da fila; a resposta externa não publica uma
  // sequência monotônica por documento. Deduplicação usa só projeção permitida.
  const eventoId = `brasilnfe:${createHash("sha256").update(JSON.stringify(projecao)).digest("hex")}`;
  return { documentoId: i.documentoId, eventoId, ordenacao: "LOCAL_OBSERVACAO", ...dados };
}
export function conferirAutorizacaoBrasilNfe(identidade: IdentidadeFiscalSaida, dados: DadosAutorizacaoBrasilNfe): DadosAutorizacaoBrasilNfe {
  const i = conferirIdentidadeBrasilNfe(identidade);
  if (!/^\d{1,9}$/.test(dados.numero) || !/^\d{1,3}$/.test(dados.serie) || !/^\d{1,30}$/.test(dados.protocolo)) throw new Error("Autorização fiscal incompleta para esta operação Brasil NFe.");
  conferirChaveBrasilNfe(dados.chave, i);
  conferirNumeroSerieChaveBrasilNfe(dados.chave, dados.numero, dados.serie);
  if (dados.protocoloCancelamento !== undefined && !/^\d{1,30}$/.test(dados.protocoloCancelamento)) throw new Error("Protocolo de cancelamento fiscal inválido.");
  return { ...dados };
}
export function interpretarEnvioFiscalBrasilNfe(retorno: RetornoEnvioBrasilNfe, identidade: IdentidadeFiscalSaida): RespostaFiscalSaida {
  const i = conferirIdentidadeBrasilNfe(identidade), codigo = retorno.codigoSefaz;
  if (retorno.chave) { conferirChaveBrasilNfe(retorno.chave, i); conferirNumeroSerieChaveBrasilNfe(retorno.chave, retorno.numero, retorno.serie); }
  if (retorno.erroPresente || retorno.ambiente !== codigoAmbienteBrasilNfe(i.ambiente) || retorno.ok === null || codigo === null) return respostaFiscalBrasilNfe(i, { status: "PENDENTE_CONFERENCIA", erro: `${mensagemCodigoSefaz(codigo, "EMISSAO") ?? ""} Resultado da transmissão incompleto ou contraditório; consulte esta nota antes de qualquer nova tentativa.`.trim() }, codigo);
  if (retorno.ok === true && [100, 150].includes(codigo) && retorno.chave && retorno.numero && retorno.serie && retorno.protocolo) {
    const dados = conferirAutorizacaoBrasilNfe(i, { chave: retorno.chave, numero: retorno.numero, serie: retorno.serie, protocolo: retorno.protocolo });
    return respostaFiscalBrasilNfe(i, { status: "AUTORIZADO", referencia: dados.chave, ...dados }, codigo);
  }
  if (retorno.ok === false && denegacoes.has(codigo)) return respostaFiscalBrasilNfe(i, { status: "DENEGADO",
    ...(retorno.chave ? { chave: retorno.chave, referencia: retorno.chave } : {}), ...(retorno.numero ? { numero: retorno.numero } : {}), ...(retorno.serie ? { serie: retorno.serie } : {}), ...(retorno.protocolo ? { protocolo: retorno.protocolo } : {}),
    erro: `Uso fiscal denegado pela SEFAZ (código ${codigo}); manter numeração e encaminhar à conferência fiscal, sem reenvio.` }, codigo);
  if (retorno.ok === false && rejeicoesComprovadas.has(codigo) && !retorno.protocolo) return respostaFiscalBrasilNfe(i, { status: "REJEITADO", erro: `${mensagemCodigoSefaz(codigo, "EMISSAO")} Revise os dados antes de uma nova emissão; reenvio automático bloqueado.` }, codigo);
  return respostaFiscalBrasilNfe(i, { status: "PENDENTE_CONFERENCIA", erro: `${mensagemCodigoSefaz(codigo, "EMISSAO")} Resposta fiscal sem autorização ou rejeição segura. Consulte esta nota; não repita o envio.` }, codigo);
}

export function interpretarRecuperacaoFiscalBrasilNfe(evidencia: EvidenciaConsultaBrasilNfe, identidade: IdentidadeFiscalSaida): RespostaFiscalSaida {
  const i = conferirIdentidadeBrasilNfe(identidade), todas = [...(evidencia.notaPrincipal ? [evidencia.notaPrincipal] : []), ...evidencia.historico];
  if (evidencia.documentoId !== i.documentoId) throw new Error("Consulta fiscal não corresponde ao documento solicitado.");
  const autorizacoes = evidencia.autorizacoes;
  const chaves = new Set(autorizacoes.map(a => a.chave));
  const protocolos = new Set(autorizacoes.map(a => `${a.chave}:${a.protocolo}`));
  if (chaves.size === 1 && protocolos.size === 1 && autorizacoes.length) {
    const a = autorizacoes[0];
    // Uma tentativa com outro número/chave, inclusive denegada, nunca é ignorada.
    if (!todas.some(n => (n.chave && n.chave !== a.chave) || (n.codigoResposta !== null && denegacoes.has(n.codigoResposta)))) {
      const dados = conferirAutorizacaoBrasilNfe(i, { chave: a.chave!, numero: a.numero!, serie: a.serie!, protocolo: a.protocolo! });
      return respostaFiscalBrasilNfe(i, { status: "AUTORIZADO", referencia: dados.chave, ...dados }, a.codigoResposta);
    }
  }
  if (!autorizacoes.length && todas.length === 1 && todas[0].emitenteComprovado && todas[0].codigoResposta !== null && denegacoes.has(todas[0].codigoResposta!)) {
    const d = todas[0];
    return respostaFiscalBrasilNfe(i, { status: "DENEGADO", ...(d.chave ? { chave: d.chave, referencia: d.chave } : {}), ...(d.numero ? { numero: d.numero } : {}), ...(d.serie ? { serie: d.serie } : {}), ...(d.protocolo ? { protocolo: d.protocolo } : {}),
      erro: `Consulta identifica denegação (código ${d.codigoResposta}); documento exige conferência fiscal sem reenvio.` }, d.codigoResposta);
  }
  if (evidencia.encontrada && !autorizacoes.length && todas.length === 1 && evidencia.notaPrincipal
    && todas[0].situacaoFornecedor === 3 && todas[0].emitida === false && !todas[0].protocolo
    && todas[0].emitenteComprovado && todas[0].codigoResposta !== null
    && (todas[0].codigoResposta === 0 && todas[0].motivoValidacaoXml === "DESCRICAO_PRODUTO" || rejeicoesConsultaComprovadas.has(todas[0].codigoResposta))) {
    const r = todas[0];
    if (r.chave) { conferirChaveBrasilNfe(r.chave, i); conferirNumeroSerieChaveBrasilNfe(r.chave, r.numero, r.serie); }
    return respostaFiscalBrasilNfe(i, { status: "REJEITADO", ...(r.chave ? { chave: r.chave, referencia: r.chave } : {}), ...(r.numero ? { numero: r.numero } : {}), ...(r.serie ? { serie: r.serie } : {}),
      erro: r.codigoResposta === 0 ? mensagemRejeicaoXmlNfe(r.motivoValidacaoXml) : r.codigoResposta === 181
        ? "SEFAZ rejeitou a nota: CNPJ do destinatário não cadastrado na Receita Federal (código 181). Corrigir o cenário e revisar nova transmissão; reenvio automático permanece bloqueado."
        : `${mensagemCodigoSefaz(r.codigoResposta, "EMISSAO")} Consulta identifica uma rejeição fiscal única. Revise os parâmetros aprovados; não reenviar automaticamente.` }, r.codigoResposta);
  }
  // Encontrada:false/Status2/rejeição no histórico não são provas de inexistência
  // atômica nem de idempotência. Este adaptador jamais retorna NAO_ENCONTRADO.
  const codigos = [...new Set(todas.map(n => n.codigoResposta).filter((codigo): codigo is number => codigo !== null && codigo >= 200))].slice(0, 5);
  const motivos = codigos.map(codigo => mensagemCodigoSefaz(codigo, "EMISSAO")).join(" ");
  return respostaFiscalBrasilNfe(i, { status: "PENDENTE_CONFERENCIA", erro: `${motivos ? `${motivos} ` : ""}Consulta não comprova um único resultado fiscal seguro; conferir todas as tentativas sem reenviar.` });
}
