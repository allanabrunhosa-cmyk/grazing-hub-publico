import { ErroPedidoVenda } from "./pedidos-dominio";

export type VeiculoEntrega = { id: string; nome: string; perfil: "CARRO" | "MOTO"; ativo: boolean; slotsMinimos?: number | null; slotsMaximos?: number | null };
export type RegraVeiculoEntrega = { id: string; tipoEmbalagemId: string; veiculoId: string; prioridade: number; ativo: boolean };
export type ConfiguracaoVeiculos = { modelo?: "SLOTS"; veiculo: "CARRO" | "MOTO" | null; veiculos?: VeiculoEntrega[]; regrasVeiculo?: RegraVeiculoEntrega[]; veiculoPadraoId?: string | null };
export type SelecaoVeiculoEntrega = { modelo?: "SLOTS"; id: string | null; nome: string; perfil: "CARRO" | "MOTO" | null; regraId: string | null; escolha: "PADRAO" | "REGRA" | "OPERADOR" | "SLOTS"; embalagens: string[]; slotsOcupados?: number | null; pendencia?: string };

export function validarSlots(v: unknown, campo = "Slots") {
  if (v == null || v === "") return null;
  if (!Number.isSafeInteger(v) || (v as number) < 0 || (v as number) > 999999) throw new ErroPedidoVenda(`${campo}: informe um inteiro de 0 a 999999.`);
  return v as number;
}

export function slotsPorUnidade(base: number | null | undefined, multiplicador = "1", extras: { slots: number | null | undefined; quantidade: number; multiplicador: string }[] = []) {
  if (base == null || extras.some(e => e.slots == null)) return null;
  const micro = (v: string) => { if (!/^\d+(?:[.,]\d{1,6})?$/.test(v)) throw new ErroPedidoVenda("Multiplicador de slots inválido."); const [a, b = ""] = v.replace(",", ".").split("."); return BigInt(a) * BigInt(1000000) + BigInt(b.padEnd(6, "0")); };
  let total = BigInt(validarSlots(base)!) * micro(multiplicador);
  for (const e of extras) total += BigInt(validarSlots(e.slots)!) * BigInt(e.quantidade) * micro(e.multiplicador);
  return String(total / BigInt(1000000)) + "." + String(total % BigInt(1000000)).padStart(6, "0");
}

/** Soma exata em milionésimos; arredonda para cima somente a ocupação final. */
export function slotsDosItens(itens: { quantidade: string | { toString(): string }; produtoSnapshot: unknown }[]) {
  let total = BigInt(0);
  for (const i of itens) {
    const p = i.produtoSnapshot as { slotsEntrega?: unknown } | null;
    if (p?.slotsEntrega == null) return null;
    const slots = String(p.slotsEntrega), qtd = i.quantidade.toString().replace(",", ".");
    if (!/^\d+(?:\.\d{1,6})?$/.test(slots) || !/^\d+(?:\.\d{1,6})?$/.test(qtd)) throw new ErroPedidoVenda("Ocupação de slots inválida.");
    const exato = (v: string) => { const [a, b = ""] = v.split("."); return BigInt(a) * BigInt(1000000) + BigInt(b.padEnd(6, "0")); };
    total += exato(slots) * exato(qtd);
  }
  const inteiro = (total + BigInt(999999999999)) / BigInt(1000000000000);
  if (inteiro > BigInt(Number.MAX_SAFE_INTEGER)) throw new ErroPedidoVenda("Ocupação de slots excede o limite.");
  return Number(inteiro);
}

/** Prévia comercial; a ação do pedido refaz a mesma ocupação com o catálogo do servidor. */
export function slotsDoRascunho(itens: { produtoId: string; quantidade: string; escolhas: Record<string, number>; complementoAvulso?: { opcaoId: string } }[], produtos: { id: string; slotsEntrega?: number | null }[], grupos: { opcoes: { id: string; produtoId: string | null; quantidade: string }[] }[]) {
  try {
    const opcoes = grupos.flatMap(g => g.opcoes);
    return slotsDosItens(itens.map(i => {
      const produto = produtos.find(p => p.id === i.produtoId);
      const extras = Object.entries(i.escolhas).filter(([, qtd]) => qtd > 0).flatMap(([id, qtd]) => { const o = opcoes.find(o => o.id === id); return o?.produtoId ? [{ slots: produtos.find(p => p.id === o.produtoId)?.slotsEntrega, quantidade: qtd, multiplicador: o.quantidade }] : []; });
      return { quantidade: i.quantidade, produtoSnapshot: { slotsEntrega: slotsPorUnidade(produto?.slotsEntrega, i.complementoAvulso ? opcoes.find(o => o.id === i.complementoAvulso!.opcaoId)?.quantidade ?? "1" : "1", extras) } };
    }));
  } catch { return null; }
}

export function embalagensDosItens(itens: { produtoSnapshot: unknown }[]): string[] {
  return itens.flatMap(i => { const p = i.produtoSnapshot as { tipoEmbalagem?: { id?: unknown } } | null; return typeof p?.tipoEmbalagem?.id === "string" ? [p.tipoEmbalagem.id] : []; });
}

export function validarVeiculosEntrega(d: Record<string, unknown>) {
  const texto = (v: unknown, max = 100) => { if (typeof v !== "string" || !v.trim() || v.length > max) throw new ErroPedidoVenda("Complete nome e identificadores de veículos e embalagens."); return v.trim(); };
  const veiculos = d.veiculos ?? [], regras = d.regrasVeiculo ?? [];
  if (!Array.isArray(veiculos) || veiculos.length > 50 || !Array.isArray(regras) || regras.length > 200) throw new ErroPedidoVenda("Cadastro de veículos ou regras inválido/extenso.");
  const vs: VeiculoEntrega[] = veiculos.map(v => {
    if (!v || typeof v !== "object" || !["CARRO", "MOTO"].includes(v.perfil) || typeof v.ativo !== "boolean") throw new ErroPedidoVenda("Escolha o perfil real de carro ou moto para cada veículo.");
    const capacidade = d.modelo === "SLOTS" ? { slotsMinimos: validarSlots(v.slotsMinimos, "Slots mínimos"), slotsMaximos: validarSlots(v.slotsMaximos, "Slots máximos") } : {};
    if (capacidade.slotsMinimos != null && capacidade.slotsMaximos != null && capacidade.slotsMinimos > capacidade.slotsMaximos) throw new ErroPedidoVenda("Slots mínimos não podem superar os máximos.");
    return { id: texto(v.id), nome: texto(v.nome, 80), perfil: v.perfil, ativo: v.ativo, ...capacidade };
  });
  if (new Set(vs.map(v => v.id)).size !== vs.length || new Set(vs.map(v => v.nome.toLocaleUpperCase("pt-BR"))).size !== vs.length) throw new ErroPedidoVenda("Veículos com nome ou identificador repetido.");
  if (d.modelo === "SLOTS") {
    const ativos = vs.filter(v => v.ativo && v.slotsMinimos != null && v.slotsMaximos != null);
    for (const [i, a] of ativos.entries()) if (ativos.slice(i + 1).some(b => a.slotsMinimos! <= b.slotsMaximos! && b.slotsMinimos! <= a.slotsMaximos!)) throw new ErroPedidoVenda("Capacidades de veículos ativos não podem se sobrepor. Cada ocupação precisa indicar um único veículo.");
    return { veiculos: vs, regrasVeiculo: [], veiculoPadraoId: null };
  }
  const rs: RegraVeiculoEntrega[] = regras.map(v => {
    if (!v || typeof v !== "object" || typeof v.ativo !== "boolean" || !Number.isSafeInteger(v.prioridade) || v.prioridade < 1 || v.prioridade > 999) throw new ErroPedidoVenda("Prioridade do veículo deve ser de 1 a 999.");
    const r = { id: texto(v.id), tipoEmbalagemId: texto(v.tipoEmbalagemId), veiculoId: texto(v.veiculoId), prioridade: v.prioridade, ativo: v.ativo };
    if (!vs.some(v => v.id === r.veiculoId && (!r.ativo || v.ativo))) throw new ErroPedidoVenda("Regra exige veículo cadastrado e ativo.");
    return r;
  });
  if (new Set(rs.map(r => r.id)).size !== rs.length || new Set(rs.filter(r => r.ativo).map(r => r.tipoEmbalagemId)).size !== rs.filter(r => r.ativo).length) throw new ErroPedidoVenda("Use somente uma regra ativa por tipo de embalagem.");
  for (const a of rs.filter(r => r.ativo)) if (rs.some(b => b.ativo && b.id !== a.id && b.prioridade === a.prioridade && b.veiculoId !== a.veiculoId)) throw new ErroPedidoVenda("Veículos diferentes precisam de prioridades distintas para pedidos com embalagens mistas.");
  const padrao = d.veiculoPadraoId == null || d.veiculoPadraoId === "" ? null : texto(d.veiculoPadraoId);
  if (padrao && !vs.some(v => v.id === padrao && v.ativo)) throw new ErroPedidoVenda("Selecione veículo padrão ativo.");
  return Object.hasOwn(d, "veiculos") || Object.hasOwn(d, "regrasVeiculo") || Object.hasOwn(d, "veiculoPadraoId") ? { veiculos: vs, regrasVeiculo: rs, veiculoPadraoId: padrao } : {};
}

/** Maior prioridade vence entre os tipos presentes; não depende da ordem dos itens. */
export function selecionarVeiculoEntrega(c: ConfiguracaoVeiculos, tipos: string[] = [], escolhido?: string | null, slotsOcupados?: number | null): SelecaoVeiculoEntrega {
  const embalagens = [...new Set(tipos)].sort(), ativos = (c.veiculos ?? []).filter(v => v.ativo);
  if (c.modelo === "SLOTS") {
    if (slotsOcupados != null && (!Number.isSafeInteger(slotsOcupados) || slotsOcupados < 0)) throw new ErroPedidoVenda("Ocupação de slots inválida.");
    if (escolhido) {
      const v = ativos.find(v => v.id === escolhido);
      if (!v) throw new ErroPedidoVenda("Veículo escolhido indisponível. Revise o pedido.");
      return { modelo: "SLOTS", id: v.id, nome: v.nome, perfil: v.perfil, regraId: null, escolha: "OPERADOR", embalagens: [], slotsOcupados: slotsOcupados ?? null };
    }
    const v = slotsOcupados == null ? undefined : ativos.find(v => v.slotsMinimos != null && v.slotsMaximos != null && slotsOcupados >= v.slotsMinimos && slotsOcupados <= v.slotsMaximos);
    return { modelo: "SLOTS", id: v?.id ?? null, nome: v?.nome ?? "Pendente", perfil: v?.perfil ?? null, regraId: null, escolha: "SLOTS", embalagens: [], slotsOcupados: slotsOcupados ?? null, ...(!v ? { pendencia: slotsOcupados == null ? "Configure os slots dos produtos para indicar o veículo ou escolha um veículo para este pedido." : "Nenhum veículo ativo atende à ocupação de slots do pedido. Escolha um veículo para este pedido." } : {}) };
  }
  if (escolhido) {
    const v = ativos.find(v => v.id === escolhido);
    if (!v) throw new ErroPedidoVenda("Veículo escolhido indisponível. Revise o pedido.");
    return { id: v.id, nome: v.nome, perfil: v.perfil, regraId: null, escolha: "OPERADOR", embalagens };
  }
  const regra = (c.regrasVeiculo ?? []).filter(r => r.ativo && embalagens.includes(r.tipoEmbalagemId) && ativos.some(v => v.id === r.veiculoId)).sort((a, b) => b.prioridade - a.prioridade || a.id.localeCompare(b.id))[0];
  const veiculo = ativos.find(v => v.id === (regra?.veiculoId ?? c.veiculoPadraoId));
  return { id: veiculo?.id ?? null, nome: veiculo?.nome ?? (c.veiculo === "CARRO" ? "Carro" : c.veiculo === "MOTO" ? "Moto" : "Pendente"), perfil: veiculo?.perfil ?? c.veiculo, regraId: regra?.id ?? null, escolha: regra ? "REGRA" : "PADRAO", embalagens };
}
