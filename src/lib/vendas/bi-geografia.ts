import { entregaHistoricaProjetadaValida } from "./entregas-historicas-dominio";

/** Projeção comercial: não consulta mapas nem promove cobrança a destino. */
export type GeografiaFonteBi = {
  historico: boolean;
  atendimento: unknown;
  cep: unknown;
  bairro: unknown;
  cidade: unknown;
  uf: unknown;
  entregaHistorica?: unknown;
  numeroOriginal?: string | null;
};

function campo(valor: unknown, limite: number) {
  if (typeof valor !== "string" || valor.length > limite || /[\u0000-\u001f]/u.test(valor)) return null;
  return valor.trim().normalize("NFC") || null;
}

export function geografiaPedidoBi(fonte: GeografiaFonteBi) {
  const entregaHistorica = fonte.historico ? entregaHistoricaProjetadaValida(fonte.entregaHistorica, fonte.numeroOriginal ?? null) : null;
  const modalidade = fonte.historico ? entregaHistorica?.modalidade ?? null : fonte.atendimento === "ENTREGA" || fonte.atendimento === "RETIRADA" ? fonte.atendimento : null;
  if (modalidade !== "ENTREGA") return {
    modalidade, cep: null, bairro: null, cidade: null, uf: null, regiao: null,
    enderecoEstado: "ausente" as const, coordenadas: null,
  };
  const dados = fonte.historico && entregaHistorica ? entregaHistorica : fonte;
  const cepOriginal = campo(dados.cep, 9), bairro = campo(dados.bairro, 120), cidade = campo(dados.cidade, 120);
  const ufOriginal = campo(dados.uf, 2)?.toLocaleUpperCase("pt-BR"), uf = ufOriginal && /^[A-Z]{2}$/u.test(ufOriginal) ? ufOriginal : null;
  const cep = cepOriginal && /^\d{5}-?\d{3}$/u.test(cepOriginal) ? cepOriginal.replace("-", "") : null;
  const regiao = cidade ? `${bairro ? `${bairro} · ` : ""}${cidade}${uf ? ` / ${uf}` : ""}` : bairro;
  return {
    modalidade, cep, bairro, cidade, uf, regiao,
    // PERMITIDO é decisão de cobertura comercial. Não comprova a localização.
    enderecoEstado: regiao ? entregaHistorica?.bairroPostal ? "aproximado" as const : "nao-validado" as const : "ausente" as const,
    // O adaptador autorizado usa geodados transitórios. Não há escritor de pontos persistidos.
    coordenadas: null,
  };
}
