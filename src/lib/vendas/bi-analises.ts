import type { PedidoFonteBi } from "./bi-dominio";
import type { FiltrosBi, LocalEntregaBi, ResultadoBi } from "./bi-types";

/** Nulos ficam por último em ambas as direções; desempate estável entre páginas. */
export function ordenarLinhasBi<T extends { nome: string }>(linhas: T[], campo: keyof T, direcao: "asc" | "desc"): T[] {
  const comparar = (a: T, b: T) => {
    const x = a[campo], y = b[campo];
    if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1;
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR", { sensitivity: "base", numeric: true })) * (direcao === "desc" ? -1 : 1);
  };
  return [...linhas].sort((a, b) => comparar(a, b) || a.nome.localeCompare(b.nome, "pt-BR") || JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

/** Cada intervalo entre pedidos consecutivos tem o mesmo peso. Inclui recompra no mesmo dia. */
export function tempoRecompraBi(periodo: PedidoFonteBi[], historico: PedidoFonteBi[], fim: string): ResultadoBi["recompra"] {
  const compradores = new Set(periodo.filter(p => p.clienteIdentificavel && p.clienteId).map(p => p.clienteId!));
  const datas = new Map<string, string[]>();
  for (const p of historico) if (p.clienteIdentificavel && p.clienteId && compradores.has(p.clienteId) && p.data <= fim) {
    const compras = datas.get(p.clienteId) ?? []; compras.push(p.data); datas.set(p.clienteId, compras);
  }
  let somaDias = 0, intervalos = 0, clientes = 0;
  for (const compras of datas.values()) {
    compras.sort(); if (compras.length < 2) continue; clientes++;
    for (let i = 1; i < compras.length; i++) { somaDias += (Date.parse(compras[i]) - Date.parse(compras[i - 1])) / 86400000; intervalos++; }
  }
  return { mediaDias: intervalos ? Math.round(somaDias / intervalos * 10) / 10 : null, clientes, intervalos };
}

export function regiaoDoPedidoBi(p: PedidoFonteBi, f: Pick<FiltrosBi, "agrupamentoRegiao">): string {
  if (f.agrupamentoRegiao === "cep") {
    const prefixo = p.cep?.match(/^\d{8}$/u)?.[0].slice(0, 5);
    return prefixo ? `CEP ${prefixo}-000 a ${prefixo}-999${p.cidade ? ` · ${p.cidade}${p.uf ? ` / ${p.uf}` : ""}` : ""}` : "CEP não informado";
  }
  if (p.cidade && !p.bairro) return `Bairro não informado · ${p.cidade}${p.uf ? ` / ${p.uf}` : ""}`;
  return p.regiao ?? "Não informado";
}

/** Só regiões de destinos. Nenhuma rua, número, nome ou contato é enviado ao provedor. */
export function locaisEntregasBi(linhas: PedidoFonteBi[], f: FiltrosBi): LocalEntregaBi[] {
  const locais = new Map<string, LocalEntregaBi>();
  for (const p of linhas) {
    if (p.modalidade !== "ENTREGA") continue;
    const bairro = p.bairro?.trim(), cidade = p.cidade?.trim(), uf = p.uf?.trim();
    if (!cidade || !uf || !/^[A-Z]{2}$/u.test(uf)) continue;
    const cep = p.cep?.match(/^\d{8}$/u)?.[0];
    const usarCep = f.agrupamentoRegiao === "cep" || !bairro;
    if (usarCep && !cep) continue;
    // O mapa usa cada CEP completo. A faixa da tabela não recebe um CEP arbitrário.
    const chave = usarCep ? `CEP ${cep!.slice(0, 5)}-${cep!.slice(5)} · ${cidade} / ${uf}` : regiaoDoPedidoBi(p, f);
    const consulta = usarCep ? `CEP ${cep!.slice(0, 5)}-${cep!.slice(5)}, ${cidade}, ${uf}, Brasil` : `${bairro}, ${cidade} - ${uf}, Brasil`;
    const agrupamento = chave.normalize("NFKD").replace(/\p{M}/gu, "").trim().replace(/\s+/gu, " ").toLocaleLowerCase("pt-BR");
    const local = locais.get(agrupamento) ?? { chave, consulta, pedidos: 0, precisao: usarCep ? "cep" as const : "bairro" as const };
    local.pedidos++; locais.set(agrupamento, local);
  }
  return [...locais.values()].sort((a, b) => b.pedidos - a.pedidos || a.chave.localeCompare(b.chave, "pt-BR"));
}
