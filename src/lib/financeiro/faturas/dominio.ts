import { dataLancamentoValida } from "../data-lancamento";
import { createHash } from "node:crypto";

import { ErroFatura } from "./erros";
export { ErroFatura } from "./erros";
export const LIMITE_ITENS = 5000;
export const LIMITE_ARQUIVO = 2 * 1024 * 1024;
export const resumoHash = (valor: string | Buffer) => createHash("sha256").update(valor).digest("hex");
export const normalizarTexto = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
export function normalizarEstabelecimento(texto: string) {
  const normal = normalizarTexto(texto).replace(/\b\d{1,3}\s*\/\s*\d{1,3}\b/g, "").trim();
  if (/^MERCADO\s*LIVRE\*/.test(normal)) return "MERCADO LIVRE";
  if (/^GOOGLE\*(GSUITE|WORKSPACE)/.test(normal)) return "GOOGLE WORKSPACE";
  // O restaurante continua identificado, em vez de juntar fornecedores diferentes em IFOOD.
  return normal.replace(/^IFOOD\s*\*/, "IFOOD / ");
}
export function dinheiro(texto: string): number {
  if (!/^-?\d{1,12}(\.\d{1,2})?$/.test(texto)) throw new ErroFatura("Informe um valor decimal válido, com até duas casas.");
  const negativo = texto.startsWith("-");
  const [inteiro, fracao = ""] = texto.replace(/^-/, "").split(".");
  const valor = Number(inteiro) * 100 + Number(fracao.padEnd(2, "0"));
  if (!Number.isSafeInteger(valor)) throw new ErroFatura("Valor acima do limite suportado.");
  return negativo ? -valor : valor;
}
export const decimal = (centavos: number) => {
  if (!Number.isSafeInteger(centavos)) throw new ErroFatura("Valor inválido.");
  return `${centavos < 0 ? "-" : ""}${Math.floor(Math.abs(centavos) / 100)}.${String(Math.abs(centavos) % 100).padStart(2, "0")}`;
};
export function dataIso(texto: string) {
  if (!dataLancamentoValida(texto)) throw new ErroFatura("Data inválida. Informe dia, mês e ano completos, entre 2000 e 2200.");
  return texto;
}
export const dataBanco = (texto: string) => new Date(`${dataIso(texto)}T00:00:00Z`);
export const dataFinanceira = (texto: string) => new Date(`${dataIso(texto)}T15:00:00Z`);

export type LinhaFatura = {
  linha: number; textoOriginal: string; descricao: string; estabelecimento: string;
  data: string; valor: number; parcela: number; totalParcelas: number; moeda: "BRL";
  tipo: "COMPRA" | "ESTORNO" | "JUROS" | "IOF" | "MULTA" | "TARIFA" | "CREDITO";
  revisar: boolean; portador?: string; documento?: string;
};
export function tipoDaLinha(descricao: string, valor: number): LinhaFatura["tipo"] {
  const texto = normalizarTexto(descricao);
  if (valor < 0) return /ESTORNO|DEVOLUCAO|CHARGEBACK/.test(texto) ? "ESTORNO" : "CREDITO";
  if (/\bIOF\b/.test(texto)) return "IOF";
  if (/\bJUROS\b|ENCARGOS/.test(texto)) return "JUROS";
  if (/\bMULTA\b/.test(texto)) return "MULTA";
  if (/\bTARIFA\b|ANUIDADE/.test(texto)) return "TARIFA";
  return "COMPRA";
}
export function identificarLinhas(linhas: LinhaFatura[]) {
  const ocorrencias = new Map<string, number>();
  return linhas.map(linha => {
    // Usa descrição completa (não o nome simplificado do estabelecimento) para deduplicar.
    const base = [linha.data, linha.valor, normalizarTexto(linha.descricao), linha.parcela, linha.totalParcelas].join("|");
    const ocorrencia = (ocorrencias.get(base) ?? 0) + 1;
    ocorrencias.set(base, ocorrencia);
    return { ...linha, identidade: resumoHash(`${base}|${ocorrencia}`), possivelDuplicada: ocorrencia > 1 };
  });
}
export function chaveParcelamento(linha: LinhaFatura, competencia: string) {
  if (linha.totalParcelas <= 1) return null;
  const [ano, mes] = competencia.split("-").map(Number);
  // Âncora da primeira competência; não presume o valor total de compra (parcelas podem variar).
  const inicio = ano * 12 + mes - linha.parcela;
  return resumoHash([normalizarEstabelecimento(linha.descricao), inicio, linha.totalParcelas, linha.valor].join("|"));
}
export type Candidato = { id: string; valor: number; data: string; descricao: string; cartaoId: string | null; fornecedorId: string | null; competencia?: string; parcela?: number; documento?: string; vencimento?:string };
export function pontuarCorrespondencia(item: { valor: number; data: string; descricao: string; cartaoId: string; fornecedorId?: string | null; competencia?: string; parcela?: number; documento?: string; vencimento?:string }, candidato: Candidato, tolerancia: number) {
  const mesmoVencimento=!!item.vencimento&&item.vencimento===candidato.vencimento;
  const dias = mesmoVencimento?0:Math.abs(Date.parse(item.data) - Date.parse(candidato.data)) / 86400000;
  if (candidato.valor !== item.valor || dias > tolerancia || (candidato.cartaoId && candidato.cartaoId !== item.cartaoId)) return null;
  const motivos = ["Valor exato"];
  let pontos = 40;
  if (dias === 0) { pontos += 15; motivos.push(mesmoVencimento?"Mesmo vencimento":"Mesma data"); }
  else { pontos += 5; motivos.push(`Data próxima (${dias} dias)`); }
  if (candidato.cartaoId === item.cartaoId) { pontos += 15; motivos.push("Mesmo cartão"); }
  if (normalizarTexto(candidato.descricao) === normalizarTexto(item.descricao)) { pontos += 20; motivos.push("Descrição exata"); }
  if (item.fornecedorId && candidato.fornecedorId === item.fornecedorId) { pontos += 10; motivos.push("Mesmo fornecedor"); }
  if (item.documento && candidato.documento === item.documento) { pontos += 15; motivos.push("Mesmo documento"); }
  if (item.parcela && candidato.parcela === item.parcela) { pontos += 5; motivos.push("Mesma parcela"); }
  return { id: candidato.id, pontos: Math.min(100, pontos), motivos, forte: pontos >= 70 };
}

export type Regra = { id: string; texto: string; modo: string; prioridade: number; cartaoId: string | null; tipo: string | null; valorMinimo: number | null; valorMaximo: number | null; origem: string };
export function selecionarRegra(regras: Regra[], item: { descricao: string; cartaoId: string; tipo: string; valor: number }) {
  const descricao = normalizarEstabelecimento(item.descricao);
  return regras.filter(r => (!r.cartaoId || r.cartaoId === item.cartaoId) && (!r.tipo || r.tipo === item.tipo)
    && (r.valorMinimo === null || item.valor >= r.valorMinimo) && (r.valorMaximo === null || item.valor <= r.valorMaximo)
    && (r.modo === "EXATO" ? descricao === normalizarEstabelecimento(r.texto) : descricao.includes(normalizarTexto(r.texto))))
    .sort((a,b) => Number(b.origem === "EXPLICITA") - Number(a.origem === "EXPLICITA")
      || Number(b.modo === "EXATO") - Number(a.modo === "EXATO") || b.prioridade - a.prioridade || a.id.localeCompare(b.id))[0] ?? null;
}

// Rateio cumulativo evita perder centavos em múltiplos pagamentos e suporta créditos assinados.
// BigInt impede perda de precisão no produto de valores monetários.
export function ratearLiquidacao(valores: number[], pago: number) {
  const total = valores.reduce((a,b) => a+b, 0);
  if (!Number.isSafeInteger(total) || total <= 0 || !Number.isSafeInteger(pago) || pago < 0 || pago > total || valores.some(v => !Number.isSafeInteger(v))) throw new ErroFatura("Pagamento incompatível com o total da fatura.");
  const partes = valores.map((valor, indice) => {
    const produto = BigInt(valor) * BigInt(pago), divisor = BigInt(total);
    let inteiro = produto / divisor, resto = produto % divisor;
    if (resto < BigInt(0)) { inteiro -= BigInt(1); resto += divisor; }
    return { indice, inteiro: Number(inteiro), resto };
  });
  let faltam = pago - partes.reduce((s,p) => s+p.inteiro, 0);
  for (const p of [...partes].sort((a,b) => a.resto === b.resto ? a.indice-b.indice : a.resto > b.resto ? -1 : 1)) {
    if (faltam-- > 0) p.inteiro++;
  }
  return partes.map(p => p.inteiro);
}
export function resumoFatura(total: number, itens: { valor: number; vinculado: boolean; revisado: boolean; ignorado: boolean }[], pago: number, cancelada = false) {
  const ativos = itens.filter(i => !i.ignorado);
  const calculado = ativos.reduce((s,i) => s+i.valor, 0);
  const pendencias = ativos.filter(i => !i.vinculado || !i.revisado).length;
  const diferenca = calculado - total;
  return { calculado, diferenca, pago, pendente: total - pago, quantidade: ativos.length, pendencias,
    estado: cancelada ? "CANCELADA" : diferenca !== 0 ? "DIVERGENTE" : pendencias ? "REVISAO" : pago === total ? "CONCILIADA" : pago > 0 ? "PARCIAL" : "PRONTA" };
}
export const parecePagamentoCartao = (texto: string) => /(?:PAG(?:AMENTO|TO)?|PGTO|PAGAR).*?(?:FATURA|CARTAO)|(?:FATURA|CARTAO).*?(?:PAG(?:AMENTO|TO)?|PGTO)/.test(normalizarTexto(texto));

export type CandidatoVinculoFatura={id:string;descricao:string;valor:number;vencimento:string;notaGrupo:string|null;cartaoId?:string|null;data?:string};
/** Sugestões são somente propostas: vinculação exige seleção e confirmação explícitas. */
export function sugerirVinculosFatura(item:{descricao:string;valor:number;vencimento:string;cartaoId?:string;data?:string;toleranciaDias?:number},candidatos:CandidatoVinculoFatura[]) {
  const nome=normalizarTexto(item.descricao);
  const compativeis=candidatos.filter(c=>c.vencimento===item.vencimento&&Math.sign(c.valor)===Math.sign(item.valor));
  const sugestoes:{ids:string[];valor:number;motivo:string}[]=[];
  for(const c of compativeis)if(c.valor===item.valor&&normalizarTexto(c.descricao)===nome)sugestoes.push({ids:[c.id],valor:c.valor,motivo:"Nome, valor e vencimento coincidem"});
  const grupos=new Map<string,CandidatoVinculoFatura[]>();
  for(const c of compativeis){
    const notaCompativel=!!(c.notaGrupo&&item.cartaoId&&c.cartaoId===item.cartaoId&&item.data&&c.data&&Math.abs(Date.parse(c.data)-Date.parse(item.data))<=(item.toleranciaDias??0)*86400000);
    for(const chave of [notaCompativel?`nota:${c.notaGrupo}`:null,normalizarTexto(c.descricao)===nome?`nome:${nome}`:null].filter((v):v is string=>!!v)){
      grupos.set(chave,[...(grupos.get(chave)??[]),c]);
    }
  }
  for(const [chave,linhas] of grupos){
    if(linhas.length<2||linhas.length>200||linhas.reduce((s,c)=>s+c.valor,0)!==item.valor)continue;
    const ids=linhas.map(l=>l.id);
    if(sugestoes.some(s=>s.ids.length===ids.length&&s.ids.every(id=>ids.includes(id))))continue;
    sugestoes.push({ids,valor:item.valor,motivo:chave.startsWith("nota:")?"Soma de despesas da mesma nota e vencimento":"Soma de despesas com mesmo nome e vencimento"});
  }
  return sugestoes;
}
