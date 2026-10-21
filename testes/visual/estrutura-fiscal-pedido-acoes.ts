import type { PreviaTributacao } from "@/lib/tributacao/tipos";
export async function previaFiscalSaidaAction() {
  return { ok: true, previa: { apto: false, pendencias: ["Tábua demonstrativa: formulação e apresentação ainda precisam de evidência."], contexto: { data: "2026-10-11", estabelecimento: "ESTAB-DEMO", ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL", modelo: "65", operacao: "VENDA" }, perfilId: null, regime: "SIMPLES_NACIONAL", linhas: [], totalMercadorias: "120.00", justificativas: ["Cenário sintético: nenhum documento transmitido."] } as PreviaTributacao } as const;
}
export async function prepararFiscalSaidaAction() { return { erro: "Prévia sintética: sem transmissão de documentos." }; }
export async function acaoFiscalSaidaAction() { return { erro: "Ação externa desabilitada na prévia sintética." }; }
