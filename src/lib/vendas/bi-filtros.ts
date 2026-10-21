import type { FiltrosBi } from "./bi-types";
import { diaNoFuso, diaValido, somarDias } from "./pedidos-agenda-dominio";

export class ErroBi extends Error { constructor(message: string, readonly status = 400) { super(message); } }
const opcao = <T extends string>(valor: unknown, permitidos: readonly T[], padrao: T): T => {
  if (valor === undefined || valor === "") return padrao;
  if (!permitidos.includes(valor as T)) throw new ErroBi("Há um filtro inválido na consulta.");
  return valor as T;
};
export function normalizarFiltrosBi(entrada: Partial<FiltrosBi> | Record<string, unknown> = {}, agora = new Date()): FiltrosBi {
  const hoje = diaNoFuso(agora, "America/Sao_Paulo");
  const padrao = entrada.de === undefined && entrada.ate === undefined;
  const de = entrada.de ?? (padrao ? `${hoje.slice(0, 4)}-01-01` : ""), ate = entrada.ate ?? (padrao ? hoje : "");
  if (typeof de !== "string" || typeof ate !== "string" || (de !== "" && (!diaValido(de) || de.startsWith("0000"))) || (ate !== "" && (!diaValido(ate) || ate.startsWith("0000"))) || de && ate && de > ate) throw new ErroBi("Informe um período válido.");
  if (de && ate && (Date.parse(ate) - Date.parse(de)) / 86400000 > 3660) throw new ErroBi("Consulte até dez anos por vez.");
  const texto = (chave: string) => { const v = entrada[chave as keyof typeof entrada] ?? ""; if (typeof v !== "string" || v.length > 160 || /[\u0000-\u001f]/u.test(v)) throw new ErroBi("Há um filtro inválido na consulta."); return v.trim(); };
  const inteiro = (chave: string, padrao: number, minimo: number, maximo: number) => { const v = entrada[chave as keyof typeof entrada]; if (v === undefined || v === "") return padrao; if (typeof v !== "number" && (typeof v !== "string" || v.length > String(maximo).length || !/^\d+$/u.test(v))) throw new ErroBi("Há um filtro numérico inválido."); const n = Number(v); if (!Number.isSafeInteger(n) || n < minimo || n > maximo) throw new ErroBi("Há um filtro numérico inválido."); return n; };
  const aba = opcao(entrada.aba, ["geral", "produtos", "clientes", "entregas", "rentabilidade"], "geral");
  const tipoCliente = opcao(entrada.tipoCliente, ["todos", "PF", "PJ"], "todos");
  const cep = (chave: "cepDe" | "cepAte") => { const valor = texto(chave); if (valor && !/^\d{5}-?\d{3}$/u.test(valor)) throw new ErroBi("Informe o CEP com oito dígitos."); return valor.replace("-", ""); };
  const cepDe = cep("cepDe"), cepAte = cep("cepAte");
  if (cepDe && cepAte && cepDe > cepAte) throw new ErroBi("O CEP inicial deve ser menor ou igual ao final.");
  const adicionais = {
    tipoCliente: aba === "clientes" ? tipoCliente : "todos" as const,
    ordemProdutos: opcao(entrada.ordemProdutos, ["nome", "unidade", "receita", "quantidade", "participacao", "pedidos", "ticket"], "receita"),
    ordemClientes: opcao(entrada.ordemClientes, ["nome", "tipo", "compras", "valor", "ticket", "primeira", "ultima"], "valor"),
    ordemEntregas: opcao(entrada.ordemEntregas, ["nome", "pedidos", "frete", "custo", "custosConhecidos", "confirmados", "aproximados", "naoValidados"], "pedidos"),
    direcaoProdutos: opcao(entrada.direcaoProdutos, ["asc", "desc"], "desc"),
    direcaoClientes: opcao(entrada.direcaoClientes, ["asc", "desc"], "desc"),
    direcaoEntregas: opcao(entrada.direcaoEntregas, ["asc", "desc"], "desc"),
    agrupamentoRegiao: opcao(entrada.agrupamentoRegiao, ["bairro", "cep"], "bairro"), cepDe, cepAte,
  };
  return { ...adicionais, de, ate, baseData: opcao(entrada.baseData, ["pedido", "entrega"], "pedido"), canal: texto("canal"), categoria: texto("categoria"), produto: texto("produto"), cliente: texto("cliente"), regiao: texto("regiao"), modalidade: texto("modalidade"), origem: opcao(entrada.origem, ["todas", "historico", "nativo"], "todas"), comparacao: opcao(entrada.comparacao, ["nenhuma", "anterior", "ano-anterior"], "nenhuma"), agrupamento: opcao(entrada.agrupamento, ["dia", "semana", "mes"], "mes"), metrica: opcao(entrada.metrica, ["vendas", "pedidos"], "vendas"), ranking: opcao(entrada.ranking, ["receita", "quantidade"], "receita"), aba, pagina: inteiro("pagina", 1, 1, 100000), diasSemRecompra: inteiro("diasSemRecompra", 60, 1, 3650), somenteConfirmados: entrada.somenteConfirmados === true || entrada.somenteConfirmados === "true", somenteSemRecompra: aba === "clientes" && (entrada.somenteSemRecompra === true || entrada.somenteSemRecompra === "true") };
}
export function periodoComparacaoBi(filtros: FiltrosBi): { de: string; ate: string } | null {
  if (filtros.comparacao === "nenhuma") return null;
  if (filtros.comparacao === "anterior") { const dias = Math.round((Date.parse(filtros.ate) - Date.parse(filtros.de)) / 86400000) + 1; return { de: somarDias(filtros.de, -dias), ate: somarDias(filtros.de, -1) }; }
  const anoAnterior = (dia: string) => { const ano = Number(dia.slice(0, 4)) - 1, candidato = `${ano}${dia.slice(4)}`; return diaValido(candidato) ? candidato : `${ano}-02-28`; };
  return { de: anoAnterior(filtros.de), ate: anoAnterior(filtros.ate) };
}
