import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

export const MENSAGEM_BLOQUEIO_TRANSMISSAO_BRASILNFE = "Emissão ainda não liberada.";
export class ErroTransmissaoFiscalBloqueadaBrasilNfe extends Error {
  readonly codigo = "TRANSMISSAO_BLOQUEADA";
  constructor() { super(MENSAGEM_BLOQUEIO_TRANSMISSAO_BRASILNFE); this.name = "ErroTransmissaoFiscalBloqueadaBrasilNfe"; }
}
export type ContextoTransmissaoManualBrasilNfe = {
  empresaId: "singleton"; emitenteCnpj: string; usuarioId: string; documentoId: string;
  modelo: 55 | 65; ambiente: "HOMOLOGACAO" | "PRODUCAO"; hashSnapshot: string;
  hashPayloadFiscal: string; versaoConfiguracao: number; habilitacaoId: string; autorizacaoId: string;
  /** Ausência mantém o contrato de emissão existente. Cancelamento exige escopo próprio. */
  operacao?: "ENVIAR" | "CANCELAR";
};
type GuardiaoTransporte = <T>(acaoHTTP: () => Promise<T>) => Promise<T>;
type Escopo = { contexto: Readonly<ContextoTransmissaoManualBrasilNfe>; ativo: boolean; expira: number; guardiao?: GuardiaoTransporte; transporteIniciado: boolean };
const escopoManual = new AsyncLocalStorage<Escopo>();
type Restricao = Partial<Pick<ContextoTransmissaoManualBrasilNfe, "documentoId" | "emitenteCnpj" | "hashSnapshot" | "hashPayloadFiscal">> & { ambiente?: string; modelo?: number; operacao?: "ENVIAR" | "CANCELAR"; canal?: "MANUAL" | "LEGADO" };
/** Somente a orquestração de emissão manual chama esta função, depois de validar
 * sessão, permissão, revisão, habilitação e autorização durável. O escopo termina
 * ao concluir a ação; não existe chave global nem liberação por variável de ambiente. */
export async function executarComAutorizacaoManualBrasilNfe<T>(contexto: ContextoTransmissaoManualBrasilNfe, acao: () => Promise<T>, guardiao?: GuardiaoTransporte): Promise<T> {
  const id = (v: unknown) => typeof v === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v);
  if (contexto.empresaId !== "singleton" || !/^\d{14}$/.test(contexto.emitenteCnpj) || !id(contexto.usuarioId) || !id(contexto.documentoId)
    || !id(contexto.habilitacaoId) || !id(contexto.autorizacaoId) || ![55, 65].includes(contexto.modelo)
    || !["HOMOLOGACAO", "PRODUCAO"].includes(contexto.ambiente) || !Number.isSafeInteger(contexto.versaoConfiguracao) || contexto.versaoConfiguracao < 1
    || contexto.operacao !== undefined && !["ENVIAR", "CANCELAR"].includes(contexto.operacao)
    || ![contexto.hashSnapshot, contexto.hashPayloadFiscal].every(h => /^[a-f0-9]{64}$/.test(h))) throw new ErroTransmissaoFiscalBloqueadaBrasilNfe();
  if (escopoManual.getStore()?.ativo) throw new ErroTransmissaoFiscalBloqueadaBrasilNfe();
  const escopo: Escopo = { contexto: Object.freeze({ ...contexto }), ativo: true, expira: Date.now() + 120_000, guardiao, transporteIniciado: false };
  try { return await escopoManual.run(escopo, acao); } finally { escopo.ativo = false; }
}
export function transmissaoBrasilNfeLiberada(restricao: Restricao = {}): boolean {
  const escopo = escopoManual.getStore();
  if (!escopo?.ativo || Date.now() >= escopo.expira || restricao.canal === "LEGADO"
    || restricao.operacao !== undefined && restricao.operacao !== (escopo.contexto.operacao ?? "ENVIAR")) return false;
  return (["documentoId", "modelo", "ambiente", "emitenteCnpj", "hashSnapshot", "hashPayloadFiscal"] as const).every(k => restricao[k] === undefined || restricao[k] === escopo.contexto[k]);
}
/** A última fronteira segura executa a única chamada HTTP sob as travas e a
 * revalidação durável do orquestrador. Um escopo de teste sem guardião não envia. */
export async function executarTransporteManualBrasilNfe<T>(acaoHTTP: () => Promise<T>): Promise<T> {
  exigirTransmissaoBrasilNfeLiberada();
  const escopo = escopoManual.getStore()!;
  if (!escopo.guardiao || escopo.transporteIniciado) throw new ErroTransmissaoFiscalBloqueadaBrasilNfe();
  escopo.transporteIniciado = true;
  let callbackConsumido = false;
  try {
    return await escopo.guardiao(async () => {
      exigirTransmissaoBrasilNfeLiberada();
      if (callbackConsumido) throw new ErroTransmissaoFiscalBloqueadaBrasilNfe();
      callbackConsumido = true;
      return acaoHTTP();
    });
  } catch (erro) {
    if (!callbackConsumido) throw new ErroTransmissaoFiscalBloqueadaBrasilNfe();
    throw erro;
  }
}
export function exigirTransmissaoBrasilNfeLiberada(restricao: Restricao = {}): void {
  if (!transmissaoBrasilNfeLiberada(restricao)) throw new ErroTransmissaoFiscalBloqueadaBrasilNfe();
}
export function liberacaoTransmissaoBrasilNfe() {
  const liberada = transmissaoBrasilNfeLiberada();
  return { liberada, motivo: liberada ? null : MENSAGEM_BLOQUEIO_TRANSMISSAO_BRASILNFE };
}
