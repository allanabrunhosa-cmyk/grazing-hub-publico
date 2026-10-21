import type { ConteudoRegraFiscalBrasilNfe, RascunhoRegraFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regras-tributarias-dominio";
import { classificacoesRegraBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regras-tributarias-dominio";
import { massaPayloadLocal } from "./brasilnfe-payload-local-fixtures";
import { CAMPOS_CONFIANCA_FISCAL, type FundamentacaoFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/fundamentacao-dominio";

export function fundamentacaoRegraSintetica(modelo: 55 | 65 = 55): FundamentacaoFiscalBrasilNfe {
  return { versao: 1, contexto: { uf: "SP", regime: "SIMPLES_NACIONAL", regimeConfirmado: true, operacao: modelo === 55 ? "NF_E_VENDA" : "NFC_E_VENDA", origem: "PREPARADO", naturezaProduto: "Produto exclusivamente fictício para a suíte de testes; sem uso cadastral real." }, fontes: [{ id: "fonte-sintetica", tipo: "NORMA_OFICIAL", titulo: "Fonte inteiramente fictícia", referencia: "Norma exclusivamente sintética; não é referência para decisão real.", uri: null, consultadoEm: "2026-10-10", trechoAplicavel: "Trecho fictício usado apenas para verificar o contrato de fundamentação na suíte.", limitesAplicabilidade: "Válida apenas nesta massa sintética, sem eficácia normativa ou fiscal real." }], justificativa: "A hipótese é exclusivamente simulada para verificar aprovação interna e preservação de provas.", limitesAplicabilidade: "Não usar este exemplo na parametrização, homologação ou produção da empresa real.", elaboradoEm: "2026-10-10", confianca: CAMPOS_CONFIANCA_FISCAL.map(campo => ({ campo, estado: "COMPROVADO", fontes: ["fonte-sintetica"], justificativa: "Hipótese exclusivamente simulada, coerente com o perfil sintético desta suíte." })) };
}

/** Exclusivamente sintético. Nenhuma referência/código desta massa aprova regra do emitente real. */
export function conteudosRegrasSinteticas() {
  const m = massaPayloadLocal(), item = m.parametros.itens[0];
  const perfil = { cestAplicavel: item.cestAplicavel, fatorTributavel: item.fatorTributavel, icms: item.icms, pis: item.pis, cofins: item.cofins, ipiAplicavel: item.ipiAplicavel, stAplicavel: item.stAplicavel, fcpAplicavel: item.fcpAplicavel, difalAplicavel: item.difalAplicavel, ibsCbsAplicavel: item.ibsCbsAplicavel, beneficioFiscalAplicavel: item.beneficioFiscalAplicavel };
  return {
    empresa: { tipo: "EMPRESA", emitente: m.parametros.emitente } as ConteudoRegraFiscalBrasilNfe,
    operacao: { tipo: "OPERACAO", operacao: m.parametros.operacao, pagamentos: m.parametros.pagamentos, destinatario: { identificar: true, origem: "comprador", IndicadorIe: 9 } } as ConteudoRegraFiscalBrasilNfe,
    item: { tipo: "ITEM", perfil: { ...perfil, classificacoes: classificacoesRegraBrasilNfe(m.documento.payload.itens[0].fiscal.produto) } } as ConteudoRegraFiscalBrasilNfe,
  };
}
export function rascunhoRegraSintetica(alvo: RascunhoRegraFiscalBrasilNfe["alvo"] = "PRODUTO", modelo: 55 | 65 = 55): RascunhoRegraFiscalBrasilNfe {
  const c = conteudosRegrasSinteticas();
  return { revisao: 0, modelo, operacao: modelo === 55 ? "NF_E_VENDA" : "NFC_E_VENDA", alvo, ...(alvo === "PRODUTO" ? { produtoId: "produto-ficticio" } : {}), ...(alvo === "GRUPO" ? { grupoId: "grupo-ficticio" } : {}), fundamentacaoFiscal: fundamentacaoRegraSintetica(modelo), vigenteDesde: "2026-01-01", vigenteAte: "2026-12-31", conteudo: alvo === "EMPRESA" ? c.empresa : alvo === "OPERACAO" ? c.operacao : c.item };
}
