import "server-only";
import type { AdaptadorFiscalSaida } from "../contrato";
const adaptadores = new WeakSet<AdaptadorFiscalSaida>();
/** A homologação controlada está limitada à base administrativa exclusiva.
 * Não habilita ambiente produtivo, processador global ou agendamento. */
export function exigirBaseHomologacaoControlada() {
  let url: URL;
  try { url = new URL(process.env.DATABASE_URL ?? ""); } catch { throw new Error("Homologação manual indisponível neste ambiente."); }
  if (url.hostname !== "127.0.0.1" || url.port !== "55449" || url.pathname !== "/admin_brasilnfe_m11") throw new Error("Homologação manual exige o banco administrativo isolado.");
}
export function baseHomologacaoControladaDisponivel() {
  try { exigirBaseHomologacaoControlada(); return true; } catch { return false; }
}
/** Exclusivamente composição de serviços do servidor, nunca recebido de action. */
export function registrarAdaptadorHomologacaoControlada(a: AdaptadorFiscalSaida) {
  exigirBaseHomologacaoControlada();
  if (a.id !== "BRASIL_NFE" || a.ambiente !== "HOMOLOGACAO" || a.bloqueioOperacional) throw new Error("Adaptador manual inválido.");
  adaptadores.add(a); return a;
}
export function conferirCapacidadeHomologacao(a: AdaptadorFiscalSaida, id: string) {
  exigirBaseHomologacaoControlada();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || !adaptadores.has(a)) throw new Error("Execução manual sem capacidade válida.");
}
