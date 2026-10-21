import ncm from "./2026-10-14/ncm.json";
import cfop from "./2026-10-14/cfop.json";
import cest from "./2026-10-14/cest.json";
import csosn from "./2026-10-14/csosn.json";
import cstIcms from "./2026-10-14/cstIcms.json";
import cEnq from "./2026-10-14/cEnq.json";
import cBenef from "./2026-10-14/cBenef.json";
import cClassTrib from "./2026-10-14/cClassTrib.json";
import cstIbsCbs from "./2026-10-14/cstIbsCbs.json";
import unidadeTributavel from "./2026-10-14/unidadeTributavel.json";
import pagamento from "./2026-10-14/pagamento.json";
import { TABELAS_CODIFICADAS } from "./codificados";
import { hojeFiscalCivil, type ConsultaTabelaFiscal, type ResultadoTabelaFiscal } from "./tipos";

type Registro = { codigo: string; descricao: string; detalhe?: string; inicio: string | null; fim: string | null; ncms?: string[]; csts?: string[]; uf?: string; simples?: boolean; cst?: string; nfe?: boolean; nfce?: boolean; grupo?: string };
type Tabela = { id: string; versao: string; fonte: string; sha256Origem: string; obtidoEm: string; registros: Registro[] };
const tabelas: Record<ConsultaTabelaFiscal["tabela"], Tabela> = { ncm, cfop, cest, csosn, cstIcms, cEnq, cBenef, cClassTrib, cstIbsCbs, unidadeTributavel, pagamento, ...TABELAS_CODIFICADAS };
const normal = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
function dataValida(v: string) { return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v; }

/** Apenas pesquisa de tabela normativa. Não infere tributação, vigência de regra nem aprovação. */
export function consultarTabelaFiscal(consulta: ConsultaTabelaFiscal): ResultadoTabelaFiscal {
  const original = tabelas[consulta.tabela];
  // Convenções do cadastro doméstico. Não reescrever a tabela oficial extraída
  // nem aplicar estas abreviações à tabela NCM/uTrib de comércio exterior.
  const convencoes = consulta.tabela === "unidadeTributavel" && [undefined, "SAIDA", "INTERNA", "INTERESTADUAL"].includes(consulta.operacao)
    ? [{ codigo: "UN", descricao: "Unidade", detalhe: "Convenção cadastral doméstica. uTrib textual de 1 a 6 caracteres (MOC, grupo I13). Não define conversão nem unidade exigida na exportação.", inicio: null, fim: null },
      { codigo: "L", descricao: "Litro", detalhe: "Convenção cadastral doméstica para venda efetiva por volume. Não converte garrafa vendida por unidade.", inicio: null, fim: null }] : [];
  const tabela = original && { ...original, registros: [...original.registros, ...convencoes] };
  const dia = consulta.dia ?? hojeFiscalCivil();
  if (!tabela || !dataValida(dia) || dia < "2000-01-01" || dia > "2199-12-31" || (consulta.busca?.length ?? 0) > 100 || /[<>\u0000-\u001f\u007f]/.test(consulta.busca ?? "") || (consulta.selecionado?.length ?? 0) > 20) throw new Error("Pesquisa fiscal inválida.");
  const vigente = (r: Registro) => (!r.inicio || r.inicio <= dia) && (!r.fim || r.fim >= dia);
  const operacao = consulta.operacao ?? "SAIDA";
  const ehSaida = operacao !== "ENTRADA" && operacao !== "TODAS";
  const compativel = (r: Registro) => {
    if (!vigente(r)) return false;
    if (consulta.tabela === "cfop") {
      if (r.nfe === false) return false;
      const prefixo = r.codigo[0];
      if (operacao === "SAIDA" && !"567".includes(prefixo) || operacao === "ENTRADA" && !"123".includes(prefixo) || operacao === "INTERNA" && prefixo !== "5" || operacao === "INTERESTADUAL" && prefixo !== "6" || operacao === "EXTERIOR" && prefixo !== "7") return false;
      if (consulta.modelo === 65 && prefixo !== "5") return false;
    }
    if (consulta.tabela === "csosn" && (consulta.crt === 2 || consulta.crt === 3)) return false;
    if (consulta.tabela === "cstIcms") {
      if (consulta.uso !== "PARAMETRO_INTERNO" && (consulta.crt === 1 || consulta.crt === 4) && !["02", "15", "53", "61"].includes(r.codigo)) return false; // Exceção expressa de tributação monofásica.
      if (consulta.uf === "SP" && r.codigo === "51") return false;
    }
    if ((consulta.tabela === "pis" || consulta.tabela === "cofins") && ehSaida && !(Number(r.codigo) <= 9 || r.codigo === "49" || r.codigo === "99")) return false;
    if (consulta.tabela === "ipi" && ehSaida && Number(r.codigo) < 50) return false;
    if (consulta.tabela === "cest" && consulta.ncm && !r.ncms?.some(n => consulta.ncm!.startsWith(n))) return false;
    if (consulta.tabela === "cBenef" && ((consulta.uf && r.uf !== consulta.uf) || (consulta.cst && !r.csts?.includes(consulta.cst)) || ((consulta.crt === 1 || consulta.crt === 4) && !r.simples))) return false;
    if (consulta.tabela === "cClassTrib" && ((consulta.cst && r.cst !== consulta.cst) || (consulta.modelo === 55 && !r.nfe) || (consulta.modelo === 65 && !r.nfce))) return false;
    if (consulta.tabela === "cEnq" && consulta.ipi) {
      const grupo = ["02", "52"].includes(consulta.ipi) ? "Isenção" : ["04", "54"].includes(consulta.ipi) ? "Imunidade" : ["05", "55"].includes(consulta.ipi) ? "Suspensão" : null;
      if (grupo && r.grupo !== grupo) return false;
    }
    return true;
  };
  const busca = normal((consulta.busca ?? "").trim()), termos = busca.split(/\s+/).filter(Boolean);
  const filtrados = tabela.registros.filter(r => compativel(r) && termos.every(t => normal(`${r.codigo} ${r.descricao} ${r.detalhe ?? ""}`).includes(t)));
  const unico = [...new Map(filtrados.map(r => [r.codigo, r])).values()];
  if (busca) {
    const prioridade = (r: Registro) => r.codigo === busca ? 100 : /^\d+$/.test(busca) && r.codigo.startsWith(busca) ? 90 : termos.every(t => normal(r.descricao.split(" / ").slice(-2).join(" ")).includes(t)) ? 20 : 0;
    unico.sort((a, b) => prioridade(b) - prioridade(a));
  }
  const opcao = (r: Registro, compat = compativel(r)) => ({ codigo: r.codigo, descricao: r.descricao, ...(r.detalhe ? { detalhe: r.detalhe } : {}), vigente: compat });
  const salvo = consulta.selecionado ? tabela.registros.find(r => r.codigo === consulta.selecionado && vigente(r)) ?? tabela.registros.find(r => r.codigo === consulta.selecionado) : undefined;
  const selecionado = salvo ? opcao(salvo) : consulta.selecionado ? { codigo: consulta.selecionado, descricao: "Código salvo · não consta na tabela consultada", vigente: false } : null;
  return { tabela: consulta.tabela, fonte: tabela.fonte, versao: tabela.versao, sha256Origem: tabela.sha256Origem, obtidoEm: tabela.obtidoEm, opcoes: unico.slice(0, 50).map(r => opcao(r)), selecionado, total: unico.length, limite: 50,
    ...(consulta.tabela === "ncm" && dia < tabela.obtidoEm ? { aviso: "Este retrato contém a NCM vigente na data da obtenção. Códigos anteriores ausentes exigem consulta ao histórico Classif; o cadastro antigo foi preservado." } : {}),
    ...(consulta.tabela === "cest" ? { aviso: "NCM e descrição devem corresponder. Selecionar CEST não determina sujeição à ST." } : {}),
  };
}
