export type ConsultaIdentidadeCliente = { clienteId: string; email: string | null; documento: string | null; tipo: "PF" | "PJ" };
export type ConflitosIdentidadeCliente = { email: boolean; documento: boolean };
export type ConsultarIdentidadeCliente = (entrada: ConsultaIdentidadeCliente, signal?: AbortSignal) => Promise<ConflitosIdentidadeCliente>;
export type AvisoIdentidadeCliente = { mensagem: string; invalido: boolean; verificarAgora: () => void };
