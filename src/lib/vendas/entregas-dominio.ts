import { ErroPedidoVenda, dinheiro } from "./pedidos-dominio";
import { validarVeiculosEntrega, type ConfiguracaoVeiculos } from "./entregas-veiculos";
export type EnderecoEntrega = { pais?: string; cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string; codigoMunicipio?: string };
export type ExcecaoEntrega = { id: string; nome: string; ativo: boolean; tipo: "CEP" | "INTERVALO" | "BAIRRO"; cepInicio: string; cepFim: string; bairro: string; cidade: string; uf: string; bloquear: boolean; fixo: string | null; acrescimo: string | null; freteMinimo: string | null; pedidoMinimo: string | null };
export type ConfiguracaoEntregas = ConfiguracaoVeiculos & { ativo: boolean; origemNome?: string; origemTipo: "LOJA" | "PERSONALIZADA"; origem: EnderecoEntrega; maximoMetros: number | null; faixas: { id: string; limiteMetros: number; preco: string; precos?: Record<string, string> }[]; excecoes: ExcecaoEntrega[]; pedidoMinimo: string | null; freteMinimo: string | null; gratisAPartir: string | null };
export const enderecoEntregaVazio: EnderecoEntrega = { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" };
export const entregasVazias = (): ConfiguracaoEntregas => ({ ativo: false, origemTipo: "LOJA", origem: { ...enderecoEntregaVazio }, veiculo: null, maximoMetros: null, faixas: [], excecoes: [], pedidoMinimo: null, freteMinimo: null, gratisAPartir: null });
export function normalizarCep(v: string) { const s = v.replace(/[-\s]/g, ""); if (!/^\d{8}$/.test(s)) throw new ErroPedidoVenda("CEP deve conter oito dígitos."); return s; }
const nome = (s: string) => s.trim().normalize("NFC").toLocaleUpperCase("pt-BR");
function obj(v: unknown): Record<string, unknown> { if (!v || typeof v !== "object" || Array.isArray(v)) throw new ErroPedidoVenda("Configuração de entregas inválida."); return v as Record<string, unknown>; }
function texto(v: unknown, max = 200) { if (typeof v !== "string" || v.length > max) throw new ErroPedidoVenda("Texto inválido na configuração de entregas."); return v.trim(); }
function booleano(v: unknown) { if (typeof v !== "boolean") throw new ErroPedidoVenda("Estado de ativação inválido."); return v; }
const opcional = (v: unknown) => v == null || v === "" ? null : dinheiro(v, "Valor da regra");
function metros(v: unknown) { if (!Number.isSafeInteger(v) || (v as number) <= 0 || (v as number) > 1000000) throw new ErroPedidoVenda("Distância deve ser positiva, em metros, até 1.000 km."); return v as number; }
export function kmParaMetros(v: string) { if (!/^\d{1,4}(?:[.,]\d{1,3})?$/.test(v)) throw new ErroPedidoVenda("Informe quilômetros com até três casas decimais."); const [i, d = ""] = v.replace(",", ".").split("."); return metros(Number(i) * 1000 + Number(d.padEnd(3, "0"))); }
export function validarEnderecoEntrega(v: unknown): EnderecoEntrega {
  const d = obj(v), pais = texto(d.pais ?? "Brasil", 80), estrangeiro = nome(pais) !== "BRASIL";
  const e = Object.fromEntries(Object.keys(enderecoEntregaVazio).map(k => [k, texto(d[k] ?? "", k === "uf" ? estrangeiro ? 120 : 2 : k === "numero" ? 30 : 200)])) as EnderecoEntrega;
  e.cep = e.cep && !estrangeiro ? normalizarCep(e.cep) : e.cep; e.uf = nome(e.uf); if (estrangeiro) e.pais = pais;
  return e;
}
export function enderecoPreciso(e: EnderecoEntrega | null) { return !!e && (!e.pais || nome(e.pais) === "BRASIL") && !!e.logradouro && !!e.numero && /\d/.test(e.numero) && !!e.bairro && !!e.cidade && /^[A-Z]{2}$/.test(e.uf); }
export function textoEndereco(e: EnderecoEntrega) { return `${e.logradouro}, ${e.numero}, ${e.complemento ? e.complemento + ", " : ""}${e.bairro}, ${e.cidade} - ${e.uf}, ${e.cep}, Brasil`; }
export function validarConfiguracaoEntregas(v: unknown): ConfiguracaoEntregas {
  const d = obj(v);
  if (d.modelo === "SLOTS") {
    if (!["LOJA", "PERSONALIZADA"].includes(String(d.origemTipo)) || !Array.isArray(d.faixas) || d.faixas.length > 100) throw new ErroPedidoVenda("Origem ou tabela de frete inválida.");
    const veiculos = validarVeiculosEntrega(d);
    const faixas = d.faixas.map(v => { const f = obj(v), valores = obj(f.precos ?? {}), precos: Record<string, string> = {};
      if (Object.keys(valores).some(id => !veiculos.veiculos?.some(v => v.id === id))) throw new ErroPedidoVenda("Preço de frete vinculado a veículo inexistente.");
      for (const veiculo of veiculos.veiculos ?? []) { const valor = valores[veiculo.id]; if (valor != null && valor !== "") precos[veiculo.id] = dinheiro(valor, `Frete de ${veiculo.nome}`); }
      return { id: texto(f.id, 100), limiteMetros: metros(f.limiteMetros), preco: "0.00", precos };
    });
    if (faixas.some((f, i) => !f.id || i > 0 && f.limiteMetros <= faixas[i - 1].limiteMetros) || new Set(faixas.map(f => f.id)).size !== faixas.length) throw new ErroPedidoVenda("Ordene as faixas por limites crescentes, sem identificadores repetidos.");
    return { modelo: "SLOTS", ativo: booleano(d.ativo), origemTipo: d.origemTipo as ConfiguracaoEntregas["origemTipo"], origemNome: texto(d.origemNome ?? "", 160), origem: validarEnderecoEntrega(d.origem), ...veiculos, veiculo: null, maximoMetros: faixas.at(-1)?.limiteMetros ?? null, faixas, excecoes: [], pedidoMinimo: null, freteMinimo: null, gratisAPartir: null };
  }
  if (!["LOJA", "PERSONALIZADA"].includes(String(d.origemTipo)) || ![null, "CARRO", "MOTO"].includes(d.veiculo as null)) throw new ErroPedidoVenda("Selecione origem e veículo válidos.");
  if (!Array.isArray(d.faixas) || d.faixas.length > 100 || !Array.isArray(d.excecoes) || d.excecoes.length > 200) throw new ErroPedidoVenda("Tabela de entregas inválida ou extensa demais.");
  const c: ConfiguracaoEntregas = { ativo: booleano(d.ativo), origemTipo: d.origemTipo as ConfiguracaoEntregas["origemTipo"], origem: validarEnderecoEntrega(d.origem), veiculo: d.veiculo as ConfiguracaoEntregas["veiculo"], maximoMetros: d.maximoMetros == null ? null : metros(d.maximoMetros), pedidoMinimo: opcional(d.pedidoMinimo), freteMinimo: opcional(d.freteMinimo), gratisAPartir: opcional(d.gratisAPartir), faixas: d.faixas.map(v => { const f = obj(v); return { id: texto(f.id, 100), limiteMetros: metros(f.limiteMetros), preco: dinheiro(f.preco, "Preço da faixa") }; }), excecoes: d.excecoes.map(v => {
    const r = obj(v); if (!["CEP", "INTERVALO", "BAIRRO"].includes(String(r.tipo))) throw new ErroPedidoVenda("Tipo da exceção inválido.");
    const e: ExcecaoEntrega = { id: texto(r.id, 100), nome: texto(r.nome, 100), ativo: booleano(r.ativo), tipo: r.tipo as ExcecaoEntrega["tipo"], cepInicio: r.tipo === "BAIRRO" ? "" : normalizarCep(texto(r.cepInicio)), cepFim: r.tipo === "INTERVALO" ? normalizarCep(texto(r.cepFim)) : "", bairro: nome(texto(r.bairro ?? "")), cidade: nome(texto(r.cidade ?? "")), uf: nome(texto(r.uf ?? "", 2)), bloquear: booleano(r.bloquear), fixo: opcional(r.fixo), acrescimo: opcional(r.acrescimo), freteMinimo: opcional(r.freteMinimo), pedidoMinimo: opcional(r.pedidoMinimo) };
    if (!e.id || !e.nome || (e.tipo === "INTERVALO" && e.cepInicio > e.cepFim) || (e.tipo === "BAIRRO" && (!e.bairro || !e.cidade || !/^[A-Z]{2}$/.test(e.uf)))) throw new ErroPedidoVenda("Complete o identificador da região, incluindo município e UF para bairro.");
    return e;
  }) };
  if (new Set(c.faixas.map(f => f.id)).size !== c.faixas.length || c.faixas.some(f => !f.id) || new Set(c.excecoes.map(e => e.id)).size !== c.excecoes.length) throw new ErroPedidoVenda("Identificadores de regras duplicados.");
  if (c.faixas.some((f, i) => i > 0 && f.limiteMetros <= c.faixas[i - 1].limiteMetros)) throw new ErroPedidoVenda("Ordene as faixas por limites crescentes, sem sobreposição.");
  if (c.faixas.length && c.maximoMetros !== c.faixas.at(-1)!.limiteMetros) throw new ErroPedidoVenda("A última faixa deve terminar exatamente na distância máxima; não deixe lacunas.");
  const comerciais = c.excecoes.filter(e => e.ativo && !e.bloquear);
  for (let i = 0; i < comerciais.length; i++) for (const b of comerciais.slice(i + 1)) {
    const a = comerciais[i]; if (a.tipo !== b.tipo) continue;
    const conflito = a.tipo === "CEP" ? a.cepInicio === b.cepInicio : a.tipo === "BAIRRO" ? a.bairro === b.bairro && a.cidade === b.cidade && a.uf === b.uf : Number(a.cepFim) - Number(a.cepInicio) === Number(b.cepFim) - Number(b.cepInicio) && a.cepInicio <= b.cepFim && b.cepInicio <= a.cepFim;
    if (conflito) throw new ErroPedidoVenda("Exceções comerciais empatadas. Remova o conflito ou inative uma regra.");
  }
  const veiculos = validarVeiculosEntrega(d);
  return { ...c, ...veiculos, ...(veiculos.veiculoPadraoId ? { veiculo: veiculos.veiculos?.find(v => v.id === veiculos.veiculoPadraoId)!.perfil } : {}) };
}
export function pendenciasEntregas(c: ConfiguracaoEntregas, origemLoja: string, veiculoEscolhidoId?: string | null) {
  if (c.modelo === "SLOTS") { const ativos = (c.veiculos ?? []).filter(v => v.ativo), escolhaAtiva = !!veiculoEscolhidoId && ativos.some(v => v.id === veiculoEscolhidoId); return [!ativos.length && "Cadastrar veículos ativos", !escolhaAtiva && ativos.some(v => v.slotsMinimos == null || v.slotsMaximos == null) && "Definir capacidades de slots dos veículos", !c.faixas.length && "Cadastrar faixas de frete", c.faixas.some(f => ativos.some(v => f.precos?.[v.id] == null)) && "Preencher frete de cada veículo", (c.origemTipo === "LOJA" ? !origemLoja.trim() || !/\d/.test(origemLoja) : !enderecoPreciso(c.origem)) && "Completar endereço da origem"].filter(Boolean) as string[]; }
  return [!c.veiculo && "Selecionar veículo", !c.maximoMetros && "Definir distância máxima por rota", !c.faixas.length && "Cadastrar faixas", (c.origemTipo === "LOJA" ? !origemLoja.trim() || !/\d/.test(origemLoja) : !enderecoPreciso(c.origem)) && "Completar endereço da origem"].filter(Boolean) as string[];
}
export type EstadoEntrega = "PERMITIDO" | "FORA_AREA" | "BLOQUEADO" | "ABAIXO_MINIMO" | "ENDERECO_PENDENTE" | "CONFIGURACAO_INCOMPLETA" | "PROVEDOR_INDISPONIVEL" | "SEM_ROTA";
export const motivosEntrega: Record<EstadoEntrega, string> = { PERMITIDO: "Atendimento permitido", FORA_AREA: "Fora da distância máxima por rota", BLOQUEADO: "Região bloqueada", ABAIXO_MINIMO: "Pedido abaixo do mínimo", ENDERECO_PENDENTE: "Endereço pendente de validação", CONFIGURACAO_INCOMPLETA: "Configuração incompleta ou cálculo automático inativo", PROVEDOR_INDISPONIVEL: "Provedor de mapas indisponível", SEM_ROTA: "Nenhuma rota encontrada" };
export type MemoriaEntrega = { estado: EstadoEntrega; motivo: string; faixaId: string | null; faixaDescricao?: string; excecaoId: string | null; excecaoNome?: string; subtotalProdutos: string; precoFaixa: string | null; fixo: string | null; acrescimo: string | null; piso: string | null; pedidoMinimo: string | null; antesGratuidade: string | null; descontoFrete: string | null; frete: string | null };
export function cents(s: string) { const [i, d = ""] = dinheiro(s, "Valor").split("."); return BigInt(i) * BigInt(100) + BigInt(d.padEnd(2, "0")); }
export const moedaCentavos = (v: bigint) => { if (v < 0 || v > BigInt("99999999999999")) throw new ErroPedidoVenda("Frete excede o limite monetário."); return `${v / BigInt(100)}.${(v % BigInt(100)).toString().padStart(2, "0")}`; };
export function memoriaPendente(estado: EstadoEntrega, subtotal: string): MemoriaEntrega { return { estado, motivo: motivosEntrega[estado], subtotalProdutos: moedaCentavos(cents(subtotal)), faixaId: null, excecaoId: null, precoFaixa: null, fixo: null, acrescimo: null, piso: null, pedidoMinimo: null, antesGratuidade: null, descontoFrete: null, frete: null }; }
export function regrasAplicaveis(c: ConfiguracaoEntregas, e: EnderecoEntrega) { if (e.pais && nome(e.pais) !== "BRASIL") return []; return c.excecoes.filter(r => r.ativo && (r.tipo === "CEP" ? r.cepInicio === e.cep : r.tipo === "INTERVALO" ? !!e.cep && r.cepInicio <= e.cep && e.cep <= r.cepFim : r.bairro === nome(e.bairro) && r.cidade === nome(e.cidade) && r.uf === nome(e.uf))); }
export function excecaoComercialEntrega(c: ConfiguracaoEntregas, e: EnderecoEntrega) {
  const rank = (r: ExcecaoEntrega) => r.tipo === "CEP" ? 0 : r.tipo === "INTERVALO" ? 1 : 2;
  return regrasAplicaveis(c,e).filter(r=>!r.bloquear).sort((a,b)=>rank(a)-rank(b)||(Number(a.cepFim)-Number(a.cepInicio))-(Number(b.cepFim)-Number(b.cepInicio)))[0];
}
export function precificarEntrega(c: ConfiguracaoEntregas, e: EnderecoEntrega, subtotal: string, distanciaMetros: number, veiculoId?: string | null): MemoriaEntrega {
  if (c.modelo === "SLOTS") {
    const m = memoriaPendente("PERMITIDO", subtotal);
    if (!Number.isSafeInteger(distanciaMetros) || distanciaMetros < 0) throw new ErroPedidoVenda("Distância da rota inválida.");
    if (!c.faixas.length || distanciaMetros > c.faixas.at(-1)!.limiteMetros) return { ...m, estado: "FORA_AREA", motivo: "Fora da última faixa de quilômetros cadastrada em Frete" };
    const faixa = c.faixas.find(f => distanciaMetros <= f.limiteMetros)!, preco = veiculoId ? faixa.precos?.[veiculoId] : undefined;
    if (preco == null || !c.veiculos?.some(v => v.id === veiculoId && v.ativo)) return memoriaPendente("CONFIGURACAO_INCOMPLETA", subtotal);
    return { ...m, faixaId: faixa.id, faixaDescricao: `Até ${(faixa.limiteMetros / 1000).toLocaleString("pt-BR")} km`, precoFaixa: preco, antesGratuidade: preco, descontoFrete: "0.00", frete: preco };
  }
  const m = memoriaPendente("PERMITIDO", subtotal), aplicaveis = regrasAplicaveis(c, e);
  if (aplicaveis.some(r => r.bloquear)) return { ...m, estado: "BLOQUEADO", motivo: motivosEntrega.BLOQUEADO, excecaoId: aplicaveis.find(r => r.bloquear)!.id };
  if (!Number.isSafeInteger(distanciaMetros) || distanciaMetros < 0) throw new ErroPedidoVenda("Distância da rota inválida.");
  if (c.maximoMetros == null || distanciaMetros > c.maximoMetros) return { ...m, estado: "FORA_AREA", motivo: motivosEntrega.FORA_AREA };
  const r = excecaoComercialEntrega(c,e), minimo = r?.pedidoMinimo ?? c.pedidoMinimo;
  m.excecaoId = r?.id ?? null; m.excecaoNome = r?.nome; m.pedidoMinimo = minimo;
  if (minimo != null && cents(subtotal) < cents(minimo)) return { ...m, estado: "ABAIXO_MINIMO", motivo: motivosEntrega.ABAIXO_MINIMO };
  const faixa = c.faixas.find(f => distanciaMetros <= f.limiteMetros);
  if (!faixa) return { ...m, estado: "CONFIGURACAO_INCOMPLETA", motivo: motivosEntrega.CONFIGURACAO_INCOMPLETA };
  const anterior = c.faixas[c.faixas.indexOf(faixa) - 1];
  const km = (v: number) => (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  m.faixaId = faixa.id; m.faixaDescricao = `${anterior ? `Acima de ${km(anterior.limiteMetros)}` : "De zero"} até ${km(faixa.limiteMetros)} km, inclusive`;
  m.precoFaixa = moedaCentavos(cents(faixa.preco)); m.fixo = r?.fixo ?? null; m.acrescimo = r?.acrescimo ?? null; m.piso = r?.freteMinimo ?? c.freteMinimo;
  let preco = cents(m.fixo ?? faixa.preco) + cents(m.acrescimo ?? "0"); if (m.piso != null && preco < cents(m.piso)) preco = cents(m.piso);
  m.antesGratuidade = moedaCentavos(preco); m.descontoFrete = c.gratisAPartir != null && cents(subtotal) >= cents(c.gratisAPartir) ? moedaCentavos(preco) : "0.00"; m.frete = moedaCentavos(preco - cents(m.descontoFrete)); return m;
}
