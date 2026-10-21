import type { ValoresTemaParciais, ValoresTemaResolvidos } from "./registro";

export type RascunhoDesignTela = {
  valores: ValoresTemaParciais;
  revisao: number;
  versaoBase: number;
  autor: string;
  atualizadoEm: string;
};

export type VersaoDesignTela = {
  id: string;
  numero: number;
  tipo: "PUBLICACAO" | "RESTAURACAO";
  motivo: string;
  autor: string;
  valores: ValoresTemaResolvidos;
  versaoOrigemNumero: number | null;
  criadaEm: string;
};

export type EventoDesignTela = {
  id: string;
  acao: "RASCUNHO_SALVO" | "PUBLICADO" | "RESTAURADO";
  autor: string;
  criadoEm: string;
};

export type DadosCentralDesign = {
  revisaoPublicada: number;
  publicada: VersaoDesignTela | null;
  rascunho: RascunhoDesignTela | null;
  versoes: VersaoDesignTela[];
  eventos: EventoDesignTela[];
};

export type ResultadoDesign =
  | { erro: string }
  | { ok: true; mensagem: string; rascunho?: RascunhoDesignTela | null; publicada?: VersaoDesignTela; revisaoPublicada?: number };
