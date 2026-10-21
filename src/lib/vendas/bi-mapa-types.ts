import type { LocalEntregaBi } from "./bi-types";

export type GrupoMapaBi = LocalEntregaBi;
export type PontoMapaBi = {
  chave: string; nome: string; latitude: number; longitude: number; pedidos: number;
  precisao: "bairro" | "cep"; origem: "GOOGLE_MAPS";
};
export type ResultadoMapaBi = {
  estado: "pronto" | "parcial" | "sem-dados" | "indisponivel";
  pontos: PontoMapaBi[];
  totalEntregas: number; entregasLocalizadas: number;
  totalGrupos: number; gruposConsultados: number; limiteGrupos: 10;
  atualizadoEm: string; validoAte: string; avisos: string[];
};
