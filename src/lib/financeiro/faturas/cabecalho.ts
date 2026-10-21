import { dataIso } from "./dominio";

export const CAMPOS_CABECALHO = ["competencia", "total", "inicio", "fim", "fechamento", "vencimento", "final"] as const;
export type CampoCabecalho = typeof CAMPOS_CABECALHO[number];
export type DadoCabecalho = { valor: string; origem: "PDF" | "CONVENCAO"; evidencia: string };
export type CabecalhoFatura = { dados: Partial<Record<CampoCabecalho, DadoCabecalho>>; conflitos: CampoCabecalho[]; banco?: "INTER" | "ITAU" };
const DATA = "(\\d{2}/\\d{2}/\\d{4})";
const MOEDA = "(?:R\\$\\s*)?(-?(?:\\d{1,3}(?:\\.\\d{3})+|\\d+),\\d{2})(?![\\d,.])";
const MESES = ["JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[\t \u00a0]+/g, " ").trim();
function dataBr(s: string) {
  const [dia, mes, ano] = s.split("/");
  try { return dataIso(`${ano}-${mes}-${dia}`); } catch { return null; }
}

/** Leitura conservadora: só rótulos explícitos. Nunca soma compras para inventar o total. */
export function identificarCabecalho(texto: string): CabecalhoFatura {
  const candidatos = new Map<CampoCabecalho, DadoCabecalho[]>();
  const linhas = texto.split(/\r?\n/).map(normalizar);
  function adicionar(campo: CampoCabecalho, valor: string | null, evidencia: string, origem: DadoCabecalho["origem"] = "PDF") {
    if (valor === null) return;
    candidatos.set(campo, [...(candidatos.get(campo) ?? []), { valor, origem, evidencia: evidencia.slice(0, 180) }]);
  }
  function ler(rotulo: string, valor: string, receber: (m: RegExpExecArray, trecho: string) => void) {
    const junto = new RegExp(`^(?:${rotulo})\\s*[:–-]?\\s*${valor}\\s*$`);
    const sozinho = new RegExp(`^(?:${rotulo})\\s*:?\\s*$`);
    for (let i = 0; i < linhas.length; i++) {
      let trecho = linhas[i];
      if (sozinho.test(trecho)) {
        const proxima = linhas.slice(i + 1).find(l => l.length);
        if (proxima) trecho += " " + proxima;
      }
      const m = junto.exec(trecho);
      if (m) receber(m, trecho);
    }
  }
  for (const [campo, rotulo] of [
    ["vencimento", "(?:DATA (?:DE |DO )?)?VENCIMENTO(?: (?:DA|DESTA) FATURA)?"],
    ["fechamento", "(?:DATA (?:DE |DO )?)?FECHAMENTO(?: (?:DA|DESTA) FATURA)?|FATURA FECHADA EM"],
    ["inicio", "INICIO (?:DO PERIODO|DA FATURA)|PERIODO INICIAL"],
    ["fim", "FIM (?:DO PERIODO|DA FATURA)|PERIODO FINAL"],
  ] as const) ler(rotulo, DATA, (m, trecho) => adicionar(campo, dataBr(m[1]), trecho));
  ler("PERIODO(?: (?:DA FATURA|DE COMPRAS|DE FATURAMENTO))?", `${DATA}\\s*(?:A|ATE|–|-)\\s*${DATA}`, (m, trecho) => {
    const inicio = dataBr(m[1]), fim = dataBr(m[2]);
    if (inicio && fim && inicio <= fim) { adicionar("inicio", inicio, trecho); adicionar("fim", fim, trecho); }
  });
  ler("TOTAL (?:DA |DESTA |DA SUA )?FATURA|VALOR TOTAL DA FATURA", MOEDA, (m, trecho) => {
    const [inteiro, fracao] = m[1].replaceAll(".", "").split(",");
    adicionar("total", `${inteiro}.${fracao}`, trecho);
  });
  ler("(?:TOTAL|SALDO) CREDOR(?: DA FATURA)?", MOEDA, (m, trecho) => {
    adicionar("total", "-" + m[1].replace(/^-/, "").replaceAll(".", "").replace(",", "."), trecho);
  });
  ler("COMPETENCIA|MES DE REFERENCIA|REFERENCIA|FATURA DE", "(\\d{2}/\\d{4}|\\d{4}-\\d{2}|[A-Z]+(?: DE |/| )\\d{4})", (m, trecho) => {
    let valor = m[1];
    if (/^\d{2}\//.test(valor)) valor = valor.slice(3) + "-" + valor.slice(0, 2);
    else if (/^[A-Z]/.test(valor)) {
      const mes = MESES.indexOf(valor.split(/ DE |\/| /)[0]) + 1;
      if (!mes) return;
      valor = valor.slice(-4) + "-" + String(mes).padStart(2, "0");
    }
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) adicionar("competencia", valor, trecho);
  });
  ler("(?:CARTAO(?: DE CREDITO)? )?(?:FINAL|TERMINADO EM)|CARTAO", "(?:[X*•. -]+\\s*)?(\\d{4})", (m, trecho) => adicionar("final", m[1], trecho));

  const dados: CabecalhoFatura["dados"] = {}, conflitos: CampoCabecalho[] = [];
  for (const [campo, valores] of candidatos) {
    if (new Set(valores.map(v => v.valor)).size === 1) dados[campo] = valores[0];
    else conflitos.push(campo);
  }
  // Convenção do módulo: competência da fatura é o mês de vencimento, não da compra.
  if (!dados.competencia && !conflitos.includes("competencia") && dados.vencimento) {
    dados.competencia = { valor: dados.vencimento.valor.slice(0, 7), origem: "CONVENCAO", evidencia: "Mês de vencimento da fatura; confira se esta é a competência desejada." };
  }
  return { dados, conflitos };
}

export function identificarCartao(cabecalho: CabecalhoFatura, cartoes: { id: string; final: string | null }[]) {
  const final = cabecalho.dados.final?.valor;
  const candidatos = final ? cartoes.filter(c => c.final === final) : [];
  return candidatos.length === 1 ? candidatos[0].id : null;
}

/** Datas administrativas do ciclo, quando o banco só imprime emissão/fechamento. */
export function completarCiclo(cabecalho: CabecalhoFatura) {
  const dados = cabecalho.dados, fechamento = dados.fechamento?.valor;
  if (!fechamento) return cabecalho;
  const [ano, mes, dia] = fechamento.split("-").map(Number);
  if (!dados.fim && !cabecalho.conflitos.includes("fim")) dados.fim = { valor: fechamento, origem: "CONVENCAO", evidencia: "Fim do ciclo administrativo: data de fechamento/emissão. Não limita a data original de compras parceladas." };
  if (!dados.inicio && !cabecalho.conflitos.includes("inicio")) {
    const ultimoAnterior = new Date(Date.UTC(ano, mes - 1, 0)).getUTCDate();
    const anterior = new Date(Date.UTC(ano, mes - 2, Math.min(dia, ultimoAnterior) + 1));
    dados.inicio = { valor: anterior.toISOString().slice(0, 10), origem: "CONVENCAO", evidencia: "Ciclo administrativo mensal calculado a partir do fechamento/emissão; editável na conferência." };
  }
  return cabecalho;
}
