import { historicoRegraFicticio } from "./brasilnfe-regras-dados";
export async function salvarRascunhoRegraBrasilNfeAction() { return { erro: "Prévia isolada: nenhuma decisão foi salva. Dados exclusivamente fictícios." }; }
export async function aprovarRegraBrasilNfeAction() { return { erro: "Prévia isolada: nenhuma aprovação foi registrada." }; }
export async function inativarRegraBrasilNfeAction() { return { erro: "Prévia isolada: nenhuma inativação foi registrada." }; }
export async function revisarRegraBrasilNfeAction() { return { erro: "Prévia isolada: nenhuma revisão foi registrada." }; }
export async function bloquearRegraBrasilNfeAction() { return { erro: "Prévia isolada: nenhum bloqueio foi registrado." }; }
export async function historicoRegraBrasilNfeAction() { return { ok: true as const, historico: historicoRegraFicticio, responsaveis: { "usuario-ficticio": "Responsável fictício" } }; }
