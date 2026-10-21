import type { listarRegrasTributariasBrasilNfe, obterHistoricoRegraTributariaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regras-tributarias";

export type RegraListaBrasilNfe = Awaited<ReturnType<typeof listarRegrasTributariasBrasilNfe>>[number];
export type HistoricoRegraBrasilNfe = Awaited<ReturnType<typeof obterHistoricoRegraTributariaBrasilNfe>>;
export type CatalogosRegrasBrasilNfe = {
  crt?: 1 | 2 | 3 | 4 | null;
  vigenteDesde?: string | null;
  vigenteAte?: string | null;
  produtos: { id: string; nome: string; versao: number; revisado: boolean; fiscal: Record<string, string> }[];
  grupos: { id: string; nome: string; versao: number; fiscal: Record<string, string> }[];
  formas: { id: string; nome: string }[];
};
export type RespostaAcaoRegraBrasilNfe = { ok: true } | { erro: string; campo?: string };
