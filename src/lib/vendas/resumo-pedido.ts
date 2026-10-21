import { identidadeFiscalCobranca } from "./cliente-cobranca";
import { exibirTelefone } from "./telefone";

export type DadosResumoPedido = {
  numero: string; versao: string; status: string; criadoEm: string; fusoHorario: string;
  referencia: string; cliente: { nome: string; empresa: string; tipo: string; documento: string; contato: string; telefone: string; email: string };
  atendimento: string; data: string; horario: string; destinatario: string; endereco: string; cobranca: string;
  pagamento: string; parcelas: string; vencimentos: string[]; observacoes: string;
  subtotal: string; desconto: string; frete: string; outrosCustos: string; total: string;
  itens: { nome: string; quantidade: string; unidade: string; precoUnitario: string; total: string; escolhas: string[]; observacoes: string }[];
};

const objeto = (valor: unknown): Record<string, unknown> => valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
const texto = (valor: unknown) => typeof valor === "string" || typeof valor === "number" ? String(valor) : "";
const lista = (valor: unknown): unknown[] => Array.isArray(valor) ? valor : [];
const endereco = (valor: unknown) => {
  const e = objeto(valor);
  return [e.logradouro, e.numero, e.complemento, e.bairro, [e.cidade, e.uf].filter(Boolean).join(" - "), e.cep].map(texto).filter(Boolean).join(", ");
};

/** Adaptador de apresentação; valores são fornecidos pelo servidor, nunca recalculados aqui. */
export function dadosResumoPedido(pedido: Record<string, unknown>): DadosResumoPedido {
  const comprador = objeto(pedido.compradorSnapshot), destinatario = objeto(pedido.destinatarioSnapshot);
  const pagamento = objeto(pedido.pagamentoInformadoSnapshot);
  const titular = identidadeFiscalCobranca(comprador, pedido.cobrancaSnapshot);
  const identificacaoCobranca = objeto(pedido.cobrancaSnapshot).tipo ? [titular.nome, titular.documento, titular.inscricaoEstadual ? `Inscrição Estadual: ${titular.inscricaoEstadual}` : "", titular.inscricaoMunicipal ? `Inscrição Municipal: ${titular.inscricaoMunicipal}` : ""].map(texto).filter(Boolean).join(" · ") : "";
  const itens = Array.isArray(pedido.itensDetalhes) ? pedido.itensDetalhes : lista(pedido.itens);
  const formas: Record<string, string> = { PIX: "Pix", BOLETO: "Boleto", CARTAO_CREDITO: "Cartão de crédito", CARTAO_DEBITO: "Cartão de débito" };
  return {
    numero: texto(pedido.numero), versao: texto(pedido.versao), status: texto(pedido.status), criadoEm: texto(pedido.createdAt ?? pedido.criadoEm), fusoHorario: texto(pedido.fusoHorario) || "America/Sao_Paulo",
    referencia: texto(pedido.referenciaPedido),
    cliente: { nome: texto(comprador.nome ?? pedido.cliente), empresa: identificacaoCobranca ? "" : texto(comprador.razaoSocial), tipo: texto(comprador.tipo), documento: identificacaoCobranca ? "" : texto(comprador.documento), contato: texto(comprador.contato), telefone: exibirTelefone(texto(comprador.telefone)), email: texto(comprador.email) },
    atendimento: texto(pedido.atendimento), data: texto(pedido.previsaoData).slice(0, 10), horario: texto(pedido.previsaoJanela), destinatario: texto(destinatario.nome), endereco: endereco(pedido.enderecoSnapshot), cobranca: [identificacaoCobranca, endereco(pedido.cobrancaSnapshot)].filter(Boolean).join(" · "),
    pagamento: texto(pagamento.nome) || formas[texto(pedido.formaPagamentoInformada)] || "Não informado", parcelas: texto(pagamento.parcelas), vencimentos: lista(pagamento.vencimentos).map(texto).filter(Boolean), observacoes: texto(pedido.observacoes),
    subtotal: texto(pedido.subtotal), desconto: texto(pedido.desconto), frete: texto(pedido.frete), outrosCustos: texto(pedido.outrosCustos), total: texto(pedido.total),
    itens: itens.map(valor => {
      const i = objeto(valor), produto = objeto(i.produtoSnapshot);
      const escolhas = Array.isArray(i.complementos) ? i.complementos.map(texto) : lista(i.escolhasSnapshot).map(e => { const escolha = objeto(e); return `${texto(escolha.quantidade).replace(".", ",")} × ${texto(escolha.opcaoNome)}`; });
      return { nome: texto(produto.nome ?? i.nome), quantidade: texto(i.quantidade).replace(".", ","), unidade: texto(i.unidadeSnapshot ?? i.unidade), precoUnitario: texto(i.precoUnitarioResumo ?? i.precoAplicado ?? i.precoUnitario), total: texto(i.totalResumo ?? i.totalLinha ?? i.total), escolhas, observacoes: texto(i.observacoes) };
    }),
  };
}

/** Formata o decimal monetário sem conversão para ponto flutuante. */
export function moedaResumoPedido(valor: string) {
  const decimal = /^(-?)(\d+)(?:[.,](\d{1,2}))?$/.exec(valor);
  if (!decimal) return "Não informado";
  const inteiro = decimal[2].replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${decimal[1]}R$ ${inteiro},${(decimal[3] ?? "").padEnd(2, "0")}`;
}

export const dataResumoPedido = (valor: string) => /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor.split("-").reverse().join("/") : "Data a combinar";
