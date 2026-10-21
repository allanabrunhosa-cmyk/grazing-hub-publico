/** Contrato de entrada do M1; todos os valores enviados pela interface são revalidados no servidor. */
import { validarIdentidadeCobranca, type IdentidadeCobranca, type ClienteEntrada } from "./dominio";
import { validarClienteNovoPedido, validarAtualizacaoClientePedido, type AtualizacaoClientePedido } from "./cliente-pedido";
import { telefoneOpcionalArmazenado } from "./telefone";
import { preservarCodigoMunicipio } from "./municipio";
import { LIMITE_COBRANCAS_CLIENTE } from "./cliente-cobranca";
import { dataCompraValida } from "./pedidos-data-compra";
export class ErroPedidoVenda extends Error {}

export type ItemPedidoEntrada = {
  itemOrigemId?: string;
  produtoId: string;
  complementoAvulso?: { produtoOrigemId: string; grupoId: string; opcaoId: string };
  tipoEmbalagemId?: string | null;
  quantidade: string;
  observacoes?: string;
  escolhas: Record<string, number>;
  precoManual: string | null;
};

export type EnderecoPedidoEntrada = Partial<IdentidadeCobranca> & { pais?: string; cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string; codigoMunicipio?: string };

export type PedidoEntrada = {
  dataCompra?: string;
  veiculoEntregaId?: string | null;
  entrega?: { metodo: "AUTOMATICO" | "MANUAL"; recibo: string; motivo: string; excecaoCobertura: boolean; motivoCobertura: string } | null;
  referenciaOrigem?: string | null; referenciaEstabelecimento?: string | null; referenciaPedido?: string | null;
  clienteId: string | null;
  clienteNovo?: ClienteEntrada | null;
  clienteAtualizacao?: AtualizacaoClientePedido | null;
  canalId: string | null;
  atendimento: "ENTREGA" | "RETIRADA" | null;
  prazo: "IMEDIATO" | "AGENDADO" | null;
  previsaoData: string | null;
  previsaoJanela: string | null;
  destinatario: { nome: string; primeiroNome?: string; sobrenome?: string; contato: string } | null;
  endereco: EnderecoPedidoEntrada | null;
  cobranca?: EnderecoPedidoEntrada | null;
  enderecosCobranca?: EnderecoPedidoEntrada[];
  cobrancaSelecionada?: number;
  observacoes: string;
  desconto: string;
  frete: string;
  outrosCustos?: string;
  formaPagamentoInformada?: "PIX" | "BOLETO" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | null;
  pagamentoInformado?: { formaId: string; parcelas: number; vencimentos: string[] } | null;
  itens: ItemPedidoEntrada[];
};

function objeto(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw new ErroPedidoVenda("Dados do pedido inválidos.");
  return valor as Record<string, unknown>;
}
/** Leitura tolerante: rascunhos e snapshots antigos conservam o texto que não forma telefone completo. */
function telefoneDestinatario(valor: unknown) {
  const contato = texto(valor, "Contato do destinatário", 100);
  return telefoneOpcionalArmazenado(contato) ?? contato;
}
/** Gravação: telefone do destinatário é opcional; quando informado, segue o formato do cliente. */
export function exigirTelefoneDestinatario(d: Pick<PedidoEntrada, "destinatario">) {
  if (telefoneOpcionalArmazenado(d.destinatario?.contato) === null) throw new ErroPedidoVenda("Informe o telefone do destinatário com DDD e oito ou nove dígitos.");
}
function texto(valor: unknown, nome: string, maximo: number, obrigatorio = false): string {
  if (valor == null && !obrigatorio) return "";
  if (typeof valor !== "string") throw new ErroPedidoVenda(`${nome}: texto inválido.`);
  const s = valor.trim();
  if (s.length > maximo || (obrigatorio && !s)) throw new ErroPedidoVenda(`${nome}: preencha até ${maximo} caracteres.`);
  return s;
}
function id(valor: unknown, nome: string): string | null { return texto(valor, nome, 100) || null; }
export function dinheiro(valor: unknown, nome: string): string {
  const s = texto(valor, nome, 32, true).replace(",", ".");
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(s)) throw new ErroPedidoVenda(`${nome}: informe um valor não negativo em centavos.`);
  return s;
}
export function quantidadeComercial(valor: unknown, unidade: string): string {
  const s = texto(valor, "Quantidade", 32, true).replace(",", ".");
  if (!/^\d{1,10}(?:\.\d{1,6})?$/.test(s) || Number(s) <= 0) throw new ErroPedidoVenda("Informe uma quantidade positiva com até seis casas decimais.");
  if (!["KG", "G", "L", "ML", "M", "M2", "M3"].includes(unidade.toUpperCase()) && !/^\d+$/.test(s)) throw new ErroPedidoVenda(`A unidade ${unidade} exige quantidade inteira.`);
  return s;
}
function normalizarEnderecoPedido(d: Record<string, unknown>): EnderecoPedidoEntrada {
  const pais = texto(d.pais ?? "Brasil", "País", 80), uf = texto(d.uf, "Estado", 120).toUpperCase();
  return { pais, cep: texto(d.cep, "CEP / código postal", 30), logradouro: texto(d.logradouro, "Logradouro", 200), numero: texto(d.numero, "Número", 30), complemento: texto(d.complemento, "Complemento", 160), bairro: texto(d.bairro, "Bairro", 120), cidade: texto(d.cidade, "Cidade", 120), uf,
    ...preservarCodigoMunicipio(d.codigoMunicipio, uf, pais, mensagem => new ErroPedidoVenda(mensagem)) };
}
function normalizarCobrancaPedido(d: Record<string, unknown>): EnderecoPedidoEntrada {
  try { return { ...normalizarEnderecoPedido(d), ...validarIdentidadeCobranca(d) }; }
  catch (erro) { throw new ErroPedidoVenda(erro instanceof Error ? erro.message : "Cobrança inválida."); }
}
/** Orçamentos podem omitir pagamento; confirmação exige informação comercial ou condição HUB explícita. */
export function exigirPagamentoConfirmacao(d: PedidoEntrada, modo: "HUB" | "EXTERNO", condicaoInformada: boolean) {
  if (!d.pagamentoInformado && !(modo === "HUB" && condicaoInformada)) throw new ErroPedidoVenda("Informe as informações de pagamento antes de confirmar o pedido. Você pode salvar um orçamento sem pagamento.");
}
export function validarEntradaPedido(valor: unknown): PedidoEntrada {
  const d = objeto(valor);
  if (Object.hasOwn(d, "dataCompra") && !dataCompraValida(d.dataCompra)) throw new ErroPedidoVenda("Data da compra: informe uma data válida entre 2000 e 2200.");
  const atendimento = d.atendimento == null || d.atendimento === "" ? null : d.atendimento;
  const prazo = d.prazo == null || d.prazo === "" ? null : d.prazo;
  if (atendimento !== null && atendimento !== "ENTREGA" && atendimento !== "RETIRADA") throw new ErroPedidoVenda("Atendimento inválido.");
  if (prazo !== null && prazo !== "IMEDIATO" && prazo !== "AGENDADO") throw new ErroPedidoVenda("Prazo do atendimento inválido.");
  const previsaoData = prazo === "IMEDIATO" ? null : texto(d.previsaoData, "Data prevista", 10) || null;
  if (previsaoData) {
    const data = /^\d{4}-\d{2}-\d{2}$/.test(previsaoData) ? new Date(`${previsaoData}T00:00:00Z`) : null;
    if (!data || Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== previsaoData) throw new ErroPedidoVenda("Data prevista inválida.");
  }
  const referenciaOrigem = texto(d.referenciaOrigem, "Origem externa", 80).trim().toUpperCase() || null;
  const referenciaEstabelecimento = texto(d.referenciaEstabelecimento, "Estabelecimento externo", 100).trim() || null;
  const referenciaPedido = texto(d.referenciaPedido, "Código externo", 100).trim() || null;
  if ([referenciaOrigem, referenciaEstabelecimento, referenciaPedido].some(Boolean) && ![referenciaOrigem, referenciaEstabelecimento, referenciaPedido].every(Boolean)) throw new ErroPedidoVenda("Preencha origem, estabelecimento e código externo juntos.");
  const destinatario = d.destinatario == null ? null : objeto(d.destinatario);
  const endereco = d.endereco == null ? null : objeto(d.endereco);
  let cobranca = d.cobranca == null ? null : objeto(d.cobranca);
  if (d.enderecosCobranca === undefined && cobranca?.titularPendente === true) throw new ErroPedidoVenda("A cobrança Principal não pode ter titular pendente.");
  let enderecosCobranca: EnderecoPedidoEntrada[] | undefined;
  let cobrancaSelecionada: number | undefined;
  if (d.enderecosCobranca !== undefined) {
    if (!Array.isArray(d.enderecosCobranca) || !d.enderecosCobranca.length || d.enderecosCobranca.length > LIMITE_COBRANCAS_CLIENTE) throw new ErroPedidoVenda(`Cadastre de um a ${LIMITE_COBRANCAS_CLIENTE} endereços de cobrança.`);
    if (objeto(d.enderecosCobranca[0]).titularPendente === true) throw new ErroPedidoVenda("A cobrança Principal não pode ter titular pendente.");
    cobrancaSelecionada = d.cobrancaSelecionada === undefined ? 0 : d.cobrancaSelecionada as number;
    if (!Number.isSafeInteger(cobrancaSelecionada) || cobrancaSelecionada < 0 || cobrancaSelecionada >= d.enderecosCobranca.length) throw new ErroPedidoVenda("Selecione um endereço de cobrança válido.");
    enderecosCobranca = d.enderecosCobranca.map(valor => normalizarCobrancaPedido(objeto(valor)));
    cobranca = enderecosCobranca[cobrancaSelecionada];
  } else if (d.cobrancaSelecionada !== undefined) throw new ErroPedidoVenda("Informe os endereços de cobrança para selecionar uma aba.");
  const formaPagamentoInformada = d.formaPagamentoInformada == null || d.formaPagamentoInformada === "" ? null : d.formaPagamentoInformada;
  const clienteNovo = d.clienteNovo == null ? null : validarClienteNovoPedido(d.clienteNovo as ClienteEntrada);
  if (clienteNovo && d.clienteId) throw new ErroPedidoVenda("Escolha um cliente existente ou preencha um novo cadastro.");
  const clienteAtualizacao = d.clienteAtualizacao == null ? null : validarAtualizacaoClientePedido(d.clienteAtualizacao);
  if (clienteAtualizacao && (clienteNovo || clienteAtualizacao.id !== d.clienteId)) throw new ErroPedidoVenda("A atualização deve pertencer ao cliente selecionado.");
  let pagamentoInformado: PedidoEntrada["pagamentoInformado"] = null;
  if (d.pagamentoInformado != null) {
    const p = objeto(d.pagamentoInformado);
    if (!Number.isSafeInteger(p.parcelas) || (p.parcelas as number) < 1 || (p.parcelas as number) > 120 || !Array.isArray(p.vencimentos) || p.vencimentos.length > 120) throw new ErroPedidoVenda("Parcelamento inválido.");
    pagamentoInformado = { formaId: texto(p.formaId, "Forma de pagamento", 100, true), parcelas: p.parcelas as number, vencimentos: p.vencimentos.map(v => {
      const data = texto(v, "Vencimento", 10);
      if (data && (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(new Date(`${data}T00:00:00Z`).getTime()) || new Date(`${data}T00:00:00Z`).toISOString().slice(0, 10) !== data)) throw new ErroPedidoVenda("Vencimento inválido.");
      return data;
    }) };
  }
  if (formaPagamentoInformada !== null && !["PIX", "BOLETO", "CARTAO_CREDITO", "CARTAO_DEBITO"].includes(String(formaPagamentoInformada))) throw new ErroPedidoVenda("Forma de pagamento informada inválida.");
  const entrega = d.entrega == null ? null : objeto(d.entrega);
  if (entrega && (!["AUTOMATICO", "MANUAL"].includes(String(entrega.metodo)) || typeof entrega.excecaoCobertura !== "boolean")) throw new ErroPedidoVenda("Método ou aprovação de cobertura inválidos.");
  if (!Array.isArray(d.itens) || d.itens.length > 100) throw new ErroPedidoVenda("Itens: lista inválida ou muito extensa.");
  return {
    ...(Object.hasOwn(d, "dataCompra") ? { dataCompra: d.dataCompra as string } : {}),
    entrega: entrega ? { metodo: entrega.metodo as "AUTOMATICO" | "MANUAL", recibo: texto(entrega.recibo, "Referência do cálculo", 12000), motivo: texto(entrega.motivo, "Motivo do frete", 1000), excecaoCobertura: entrega.excecaoCobertura as boolean, motivoCobertura: texto(entrega.motivoCobertura, "Motivo da cobertura excepcional", 1000) } : null,
    ...(Object.hasOwn(d, "veiculoEntregaId") ? { veiculoEntregaId: id(d.veiculoEntregaId, "Veículo de entrega") } : {}),
    referenciaOrigem, referenciaEstabelecimento, referenciaPedido,
    clienteId: id(d.clienteId, "Cliente"), ...(clienteNovo ? { clienteNovo } : {}), ...(clienteAtualizacao ? { clienteAtualizacao } : {}), canalId: id(d.canalId, "Canal"),
    atendimento, prazo, previsaoData, previsaoJanela: prazo === "IMEDIATO" ? null : texto(d.previsaoJanela, "Janela prevista", 100) || null,
    destinatario: destinatario ? { nome: texto(destinatario.nome, "Destinatário", 160), primeiroNome: texto(destinatario.primeiroNome, "Nome do destinatário", 80), sobrenome: texto(destinatario.sobrenome, "Sobrenome do destinatário", 80), contato: telefoneDestinatario(destinatario.contato) } : null,
    endereco: endereco ? normalizarEnderecoPedido(endereco) : null,
    cobranca: cobranca ? normalizarCobrancaPedido(cobranca) : null,
    ...(enderecosCobranca ? { enderecosCobranca, cobrancaSelecionada } : {}),
    observacoes: texto(d.observacoes, "Observações", 3000), desconto: dinheiro(d.desconto ?? "0", "Desconto"), frete: dinheiro(d.frete ?? "0", "Frete"), outrosCustos: dinheiro(d.outrosCustos ?? "0", "Outros custos"), formaPagamentoInformada: formaPagamentoInformada as PedidoEntrada["formaPagamentoInformada"], ...(pagamentoInformado ? { pagamentoInformado } : {}),
    itens: d.itens.map((valor: unknown) => {
      const item = objeto(valor);
      const escolhas = objeto(item.escolhas ?? {});
      if (Object.keys(escolhas).length > 200) throw new ErroPedidoVenda("Muitas escolhas no item.");
      const quantidades: Record<string, number> = {};
      for (const [chave, quantidade] of Object.entries(escolhas)) {
        if (chave.length > 100 || !Number.isSafeInteger(quantidade) || (quantidade as number) < 0 || (quantidade as number) > 1000) throw new ErroPedidoVenda("Escolha inválida.");
        if (quantidade) quantidades[chave] = quantidade as number;
      }
      const origem = item.complementoAvulso == null ? null : objeto(item.complementoAvulso);
      const complementoAvulso = origem ? { produtoOrigemId: texto(origem.produtoOrigemId, "Produto de origem", 100, true), grupoId: texto(origem.grupoId, "Grupo do complemento", 100, true), opcaoId: texto(origem.opcaoId, "Opção do complemento", 100, true) } : null;
      if (complementoAvulso && Object.values(quantidades).some(q => q > 0)) throw new ErroPedidoVenda("Complemento avulso não recebe outras escolhas.");
      return { ...(item.itemOrigemId ? { itemOrigemId: texto(item.itemOrigemId, "Item de origem", 100, true) } : {}), produtoId: texto(item.produtoId, "Produto", 100, true), ...(complementoAvulso ? { complementoAvulso } : {}), ...(Object.hasOwn(item, "tipoEmbalagemId") ? { tipoEmbalagemId: id(item.tipoEmbalagemId, "Tipo de embalagem") } : {}), quantidade: texto(item.quantidade, "Quantidade", 32, true), observacoes: texto(item.observacoes, "Observações do produto", 1000), escolhas: quantidades, precoManual: item.precoManual == null || item.precoManual === "" ? null : dinheiro(item.precoManual, "Preço manual") };
    }),
  };
}

export function exigirPedidoConfirmavel(d: PedidoEntrada) {
  if (!d.clienteId || !d.canalId || !d.atendimento || !d.prazo || !d.itens.length) throw new ErroPedidoVenda("Informe cliente, canal, atendimento, prazo e ao menos um item antes de confirmar.");
  if (d.prazo === "AGENDADO" && (!d.previsaoData || !d.previsaoJanela)) throw new ErroPedidoVenda("Informe data e horário ou janela prevista para o atendimento agendado.");
  if (d.atendimento === "ENTREGA" && (!d.destinatario?.nome || !d.endereco?.logradouro || !d.endereco.numero || !d.endereco.cidade)) throw new ErroPedidoVenda("Informe destinatário e endereço para entrega.");
  if (d.cobranca) {
    try { validarIdentidadeCobranca(d.cobranca, true); } catch (erro) { throw new ErroPedidoVenda(erro instanceof Error ? erro.message : "Cobrança inválida."); }
    if ([d.cobranca.pais, d.cobranca.cep, d.cobranca.logradouro, d.cobranca.numero, d.cobranca.bairro, d.cobranca.cidade, d.cobranca.uf].some(v => !v?.trim())) throw new ErroPedidoVenda("Preencha o endereço de cobrança deste pedido.");
    if (d.cobranca.pais?.toLocaleLowerCase("pt-BR") === "brasil" && !/^\d{8}$/.test(d.cobranca.cep.replace(/\D/g, ""))) throw new ErroPedidoVenda("Informe um CEP brasileiro com oito dígitos no endereço de cobrança.");
    if (d.atendimento === "ENTREGA" && (!d.endereco || [d.endereco.pais, d.endereco.cep, d.endereco.logradouro, d.endereco.numero, d.endereco.bairro, d.endereco.cidade, d.endereco.uf].some(v => !v?.trim()))) throw new ErroPedidoVenda("Preencha o endereço de entrega deste pedido.");
    if (d.endereco?.pais?.toLocaleLowerCase("pt-BR") === "brasil" && !/^\d{8}$/.test(d.endereco.cep.replace(/\D/g, ""))) throw new ErroPedidoVenda("Informe um CEP brasileiro com oito dígitos no endereço de entrega.");
  }
}
