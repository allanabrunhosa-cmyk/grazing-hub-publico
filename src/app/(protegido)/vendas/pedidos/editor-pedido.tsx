"use client";
import { slotsDoRascunho } from "@/lib/vendas/entregas-veiculos";

import { converterHorariosEntrega } from "@/lib/vendas/pedidos-horarios-dominio";
import { HorarioEntregaCampo } from "./horario-entrega-campo";
import { PedidoPopupContext } from "./modal-pedido";
import { rotaPopupPedido } from "./pedidos-navegacao";
import { EncerramentoManual } from "./encerramento-manual";
import { FretePedido } from "./frete-pedido";
import { CustoEntrega } from "./custo-entrega";
import { itemComercialPreservado } from "@/lib/vendas/pedidos-preco-historico";
import { diaNoFuso } from "@/lib/vendas/pedidos-agenda-dominio";
import { lazy, Suspense, useContext, useEffect, useRef, useState, type SyntheticEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, MoreHorizontal, Plus, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SelecaoCanalVenda } from "@/components/canais-venda";
import { PagamentoPedidoForm } from "./pagamento-pedido-form";
import { PrecoItemPedido } from "./preco-item-pedido";
import { QuantidadeEscolha } from "@/components/quantidade-escolha";
import { MensagemPendenciaFormulario, type PendenciaFormulario } from "@/components/pendencia-formulario";
import { limiteQuantidadeEscolha } from "@/lib/vendas/escolhas-grupo";
import { pendenciaEnderecoPedido, pendenciaItensPedido } from "@/lib/vendas/pedidos-pendencias";
import { SlotComplemento } from "../catalogo/linha-complemento";
import { cobrancasDoCliente, identidadePrincipalCliente, copiarCobrancaParaEntrega, nomeAbaCobranca } from "@/lib/vendas/cliente-cobranca";
import { adicionarEntregaCliente, atualizarEntregaCliente, entregasDoCliente, indiceEntregaCliente, indiceEntregaCorrespondente, LIMITE_ENTREGAS_CLIENTE, removerEntregaCliente, selecionarEntregaCliente } from "@/lib/vendas/cliente-entrega";
import { indiceEnderecoCobrancaInicial, validarClienteNovoPedido, validarAtualizacaoClientePedido } from "@/lib/vendas/cliente-pedido";
import { Button } from "@/components/ui/button";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { BotaoRemoverItem } from "@/components/remover-item";
import { Input } from "@/components/ui/input";
import { SelecaoFormulario } from "@/components/ui/select";
import { InputComSufixo } from "@/components/ui/input-com-sufixo";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxInputGroup, ComboboxItem } from "@/components/ui/combobox";
import { novoClientePedido } from "./novo-cliente-pedido";
import type { ClienteEntrada, EntregaCliente } from "@/lib/vendas/dominio";
import { ConfirmarRemocaoEndereco, enderecoTemConteudo, rotuloEnderecoPostal } from "./endereco-cliente-ui";
import { NovaEntregaClienteDialog } from "./nova-entrega-cliente-dialog";
import type { DadosProdutos } from "@/lib/vendas/consultas";
import { opcoesEfetivas, limitesEfetivos } from "@/lib/vendas/dominio";
import { precosOpcoes } from "@/lib/vendas/complementos";
import { chaveItemCatalogoPedido, opcoesCatalogoPedido, type OpcaoCatalogoPedido } from "@/lib/vendas/pedidos-catalogo";
import { ProdutoPedidoCombobox } from "./produto-pedido-combobox";
import { CamposEnderecoPedido, enderecoPedidoVazio } from "./endereco-pedido-form";
import { Campo } from "../componentes";
import type { PedidoEntrada, ItemPedidoEntrada } from "@/lib/vendas/pedidos-dominio";
import type { dadosEditorPedido } from "./dados-editor";
import { TratamentoBoleto } from "./tratamento-boleto";
import { CorrecaoRecebimento } from "./correcao-recebimento";
import { ajustarVencimentoPedidoAction, cancelarPedidoVendaAction, concederCreditoPedidoAction, concluirDevolucaoPedidoAction, confirmarPagamentoBoletoPedidoAction, confirmarPedidoVendaAction, criarRascunhoPedidoAction, liberarCreditoAplicadoPedidoAction, mudarEstadoDevolucaoPedidoAction, registrarCapturaCartaoPedidoAction, registrarEmissaoBoletoPedidoAction, registrarRecebimentoPedidoAction, registrarRepasseCartaoPedidoAction, revisarPedidoVendaAction, salvarRascunhoPedidoAction, solicitarDevolucaoPedidoAction } from "./actions";
import type { CondicaoFinanceiraPedido } from "@/lib/vendas/pedidos";
import { aceitaMotivoCancelamento, aceitaNomeResponsavelCancelamento, LIMITE_MOTIVO_CANCELAMENTO, LIMITE_RESPONSAVEL_CANCELAMENTO, nomeResponsavelCancelamentoValido } from "@/lib/vendas/cancelamento-pedido-dominio";

type TodosDados = Awaited<ReturnType<typeof dadosEditorPedido>>;
const PreviaResumoOrcamento = lazy(async () => ({ default: (await import("./resumo-pedido")).ResumoPedido }));
import { CadastroClientePedido, CobrancaClientePedido, CamposDestinatarioCliente } from "./cadastro-cliente-form";
import { CreditoClientePedido } from "./credito-cliente-pedido";
import type { EntregaPadraoCliente } from "@/lib/vendas/dominio";

export type ClientePedido = Omit<TodosDados["clientes"][number], "entregaPadrao" | "emailsAlternativos" | "documentosAlternativos"> & { entregaPadrao?: EntregaPadraoCliente | null; emailsAlternativos?: string[]; documentosAlternativos?: string[] };
export type Dados = Omit<TodosDados, "entregas" | "permissoesEntrega" | "prestadores" | "podeCriarEmbalagem" | "clientes" | "catalogo" | "dataCompraPadrao"> & { catalogo: DadosProdutos; clientes: ClientePedido[] } & Partial<Pick<TodosDados, "entregas" | "permissoesEntrega" | "prestadores" | "podeCriarEmbalagem" | "dataCompraPadrao">>;
export type Capacidades = { rascunho: boolean; confirmar: boolean; revisar: boolean; desconto: boolean; preco: boolean; cancelar: boolean; receber: boolean; estornar?: boolean; condicao: boolean; criarCliente?: boolean; editarCliente?: boolean };
export type Tratamento = { id: string; tipo: string; status: string; valor: string; retido: string; motivo: string | null; referenciaPolitica: string | null; referenciaComunicacao: string | null; evidenciaConclusao: string | null; concluidoEm: string | null };
export type Financeiro = { elegivelCancelamento?: string; recebido: string; entradaLiquida?: string; creditoAplicado?: string; creditoRestaurado?: string; creditoRestauravel?: string; capturado?: string; repassado?: string; saldo: string; saldoCliente?: string; elegivel?: string; titulos: { id: string; revisao?: string; raiz: string; valorOriginal: string; valor: string; status: string; quitadoCredito?: boolean; vencimento: string; forma: { nome?: string; tipo?: string; parcelasCliente?: number } | null; dataPagamento: string | null }[]; externos?: { id: string; tituloId: string; tipo: string; status: string; valorBruto: string; parcelasCliente: number | null; referenciaExterna: string | null; documentoExterno: string | null; vencimentoExterno: string | null; confirmadoEm: string | null; taxa: string | null; valorLiquido: string | null; previsaoRepasse: string | null; repassadoEm: string | null }[]; repasses?: { id: string; pagamentoId: string; valorBruto: string; taxa: string; valorLiquido: string; data: string }[]; tratamentos?: Tratamento[] };
export type Detalhe = {
  entregaSnapshot?: Parameters<typeof FretePedido>[0]["snapshot"]; custoEntregaEstimado?: string | null; custoEntregaEfetivo?: string | null; prestadorEntregaId?: string | null;
  modoFinanceiro?: string; versaoFinanceiro?: number; fusoHorario?: string; origem?: string; dataCompra?: string | null; referenciaOrigem?: string | null; referenciaEstabelecimento?: string | null; referenciaPedido?: string | null;
  id: string; numero: number; versao: number; status: string; statusOperacional?: string; clienteId: string | null; canalId: string | null;
  canalNomeSnapshot: string | null; compradorSnapshot: { nome: string; documento?: string | null } | null;
  atendimento: PedidoEntrada["atendimento"]; prazo: PedidoEntrada["prazo"]; previsaoData: string | null; previsaoJanela: string | null;
  destinatarioSnapshot: PedidoEntrada["destinatario"]; enderecoSnapshot: PedidoEntrada["endereco"]; cobrancaSnapshot?: PedidoEntrada["cobranca"] & { enderecos?: NonNullable<PedidoEntrada["enderecosCobranca"]>; selecionado?: number };
  observacoes: string | null; subtotal: string; desconto: string; frete: string; outrosCustos?: string; formaPagamentoInformada?: PedidoEntrada["formaPagamentoInformada"]; pagamentoInformadoSnapshot?: PedidoEntrada["pagamentoInformado"] & { nome: string }; total: string; confirmadoEm: string | null; entregueEm: string | null;
  rascunho: PedidoEntrada | null;
  financeiro: Financeiro;
  historicoFinanceiro: { id: string; tipo: string; usuarioNome: string; createdAt: string; detalhes: { motivo?: string; valorOriginal?: string; recebido?: string; saldo?: string; anterior?: string; novo?: string } }[];
  itens: { id?: string; produtoId: string; quantidade: string; observacoes?: string | null; unidadeSnapshot: string; precoOriginal: string; precoAplicado: string; acrescimos: string; desconto: string; totalLinha: string; estadoComposicao: string; produtoSnapshot: { nome: string; complementoAvulso?: ItemPedidoEntrada["complementoAvulso"]; tipoEmbalagem?: { id: string; nome: string } | null }; escolhasSnapshot: { opcaoId: string; opcaoNome: string; quantidade: number; preco?: string }[] }[];
  historico: { id: string; tipo: string; usuarioNome: string; createdAt: string; motivo: string | null; versaoAnterior: number | null; versaoNova: number; antes: { total?: string; frete?: string; custoEntregaEstimado?: string | null; custoEntregaEfetivo?: string | null } | null; depois: { total?: string; frete?: string; referencia?: string; custoEntregaEstimado?: string | null; custoEntregaEfetivo?: string | null } }[];
};
const vazio: PedidoEntrada = { clienteId: null, canalId: null, atendimento: "ENTREGA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, destinatario: null, endereco: null, cobranca: null, observacoes: "", desconto: "0.00", frete: "0.00", outrosCustos: "0.00", formaPagamentoInformada: null, itens: [] };
const moeda = (s: string | number) => Number(s).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function nomeParcela(raiz: string) {
  if (raiz.startsWith("tardio-")) return "Entrada tardia";
  const revisao = /^revisao-.+-(\d+)$/.exec(raiz);
  if (revisao) return `Parcela revisada ${Number(revisao[1]) + 1}`;
  return raiz.replace(/^parcela-(\d+)$/, "Parcela $1");
}
const statusExterno: Record<string, string> = { EMITIDO: "Emissão externa informada", CAPTURADO: "Capturado; repasse pendente", PAGO: "Pago", CANCELADO_EXTERNAMENTE: "Cancelamento externo registrado", EXCECAO_PAGAMENTO_TARDIO: "Pagamento tardio a conferir", PAGO_TARDIO: "Entrada tardia registrada" };
function estimarItem(item: ItemPedidoEntrada, catalogo: Dados["catalogo"], anteriores?: Detalhe["itens"]) {
  const anterior = anteriores?.find(i => i.id === item.itemOrigemId);
  if (itemComercialPreservado(item, anterior)) return Number(item.quantidade) * (Number(anterior!.precoAplicado) + Number(anterior!.acrescimos));
  const produto = catalogo.produtos.find(p => p.id === item.produtoId);
  if (item.complementoAvulso) {
    const opcao = catalogo.grupos.find(g => g.id === item.complementoAvulso?.grupoId)?.opcoes.find(o => o.id === item.complementoAvulso?.opcaoId);
    return Number((item.quantidade || "0").replace(",", ".")) * Number(item.precoManual ?? opcao?.preco ?? 0);
  }
  if (!produto) return 0;
  const adicionais = produto.grupos.reduce((soma, vinculo) => {
    const grupo = catalogo.grupos.find(g => g.id === vinculo.grupoId);
    return soma + ((grupo ? opcoesEfetivas(precosOpcoes(grupo.opcoes, catalogo.produtos), vinculo) : undefined)?.reduce((total, opcao) => total +
      (vinculo.opcoesExcluidas?.includes(opcao.id) ? 0 : Number(opcao.preco) * (item.escolhas[opcao.id] ?? 0)), 0) ?? 0);
  }, 0);
  return Number((item.quantidade || "0").replace(",", ".")) * (Number(item.precoManual ?? produto.preco) + adicionais);
}
function somaRepasse(financeiro: Financeiro, pagamentoId: string, campo: "taxa" | "valorLiquido") {
  return (financeiro.repasses ?? []).filter(r => r.pagamentoId === pagamentoId).reduce((s, r) => s + Number(r[campo]), 0);
}
const rotulosFinanceiros: Record<string, string> = {
  CATEGORIA_REVISADA: "Categoria da receita revisada", RECEBIMENTO_CORRIGIDO: "Registro de recebimento corrigido", TITULOS_GERADOS: "Títulos gerados", RECEBIMENTO: "Recebimento registrado",
  VENCIMENTO_AJUSTADO: "Vencimento ajustado", SALDO_REVISADO: "Saldo revisado",
  SALDO_CANCELADO: "Saldo pendente cancelado", CARTAO_CAPTURADO: "Cartão capturado",
  REPASSE_CARTAO: "Repasse do cartão registrado", BOLETO_EMITIDO: "Boleto externo emitido",
  BOLETO_CANCELADO_EXTERNAMENTE: "Cancelamento externo de boleto registrado", BOLETO_ENTRADA_TARDIA: "Entrada tardia de boleto registrada", BOLETO_PAGO: "Boleto pago", BOLETO_PAGO_APOS_CANCELAMENTO: "Pagamento tardio de boleto cancelado",
  DEVOLUCAO_SOLICITADA: "Devolução solicitada", DEVOLUCAO_PROCESSANDO: "Devolução em processamento",
  DEVOLUCAO_CONCLUIDA: "Devolução concluída", DEVOLUCAO_FALHA: "Falha na devolução",
  DEVOLUCAO_CANCELADA: "Solicitação de devolução cancelada", CREDITO_CONCEDIDO: "Crédito concedido",
  CREDITO_LIBERADO: "Crédito restaurado",
};

export function entradaDoPedido(pedido?: Detalhe): PedidoEntrada {
  if (!pedido) return vazio;
  if (["RASCUNHO", "DECLINADO"].includes(pedido.status) && pedido.rascunho) return { ...pedido.rascunho, ...(pedido.dataCompra ? { dataCompra: pedido.dataCompra } : {}), atendimento: pedido.rascunho.atendimento ?? "ENTREGA", prazo: pedido.rascunho.previsaoData ? "AGENDADO" : "IMEDIATO" };
  return { ...(pedido.dataCompra ? { dataCompra: pedido.dataCompra } : {}), ...(pedido.entregaSnapshot?.selecaoVeiculo?.escolha === "OPERADOR" ? {veiculoEntregaId:pedido.entregaSnapshot.veiculoEntregaId} : {}), referenciaOrigem: pedido.referenciaOrigem, referenciaEstabelecimento: pedido.referenciaEstabelecimento, referenciaPedido: pedido.referenciaPedido, clienteId: pedido.clienteId, canalId: pedido.canalId, atendimento: pedido.atendimento, prazo: pedido.prazo,
    previsaoData: pedido.previsaoData?.slice(0, 10) ?? null, previsaoJanela: pedido.previsaoJanela,
    destinatario: pedido.destinatarioSnapshot, endereco: pedido.enderecoSnapshot, cobranca: pedido.cobrancaSnapshot ?? null, ...(pedido.cobrancaSnapshot?.enderecos ? { enderecosCobranca: pedido.cobrancaSnapshot.enderecos, cobrancaSelecionada: pedido.cobrancaSnapshot.selecionado ?? 0 } : {}), observacoes: pedido.observacoes ?? "", desconto: pedido.desconto, frete: pedido.frete, outrosCustos: pedido.outrosCustos ?? "0.00", formaPagamentoInformada: pedido.formaPagamentoInformada ?? null,
    pagamentoInformado: pedido.pagamentoInformadoSnapshot ? { formaId: pedido.pagamentoInformadoSnapshot.formaId, parcelas: pedido.pagamentoInformadoSnapshot.parcelas, vencimentos: pedido.pagamentoInformadoSnapshot.vencimentos } : null,
    itens: pedido.itens.map(i => ({ itemOrigemId: i.id, tipoEmbalagemId:i.produtoSnapshot.tipoEmbalagem?.id??null, ...(i.produtoSnapshot.complementoAvulso ? { complementoAvulso: { produtoOrigemId: i.produtoSnapshot.complementoAvulso.produtoOrigemId, grupoId: i.produtoSnapshot.complementoAvulso.grupoId, opcaoId: i.produtoSnapshot.complementoAvulso.opcaoId } } : {}), produtoId: i.produtoId, quantidade: i.quantidade, observacoes: i.observacoes ?? "", escolhas: Object.fromEntries(i.escolhasSnapshot.map(o => [o.opcaoId, o.quantidade])), precoManual: i.precoOriginal === i.precoAplicado ? null : i.precoAplicado })),
  };
}

export function EditorPedido({ dados, pedido: bruto, capacidades, dataInicial, emDialogo = false, somenteComercial = false }: { dataInicial?: string; dados: Dados; pedido?: Record<string, unknown>; capacidades: Capacidades; emDialogo?: boolean; somenteComercial?: boolean }) {
  const pedido = bruto as Detalhe | undefined;
  const externo = pedido?.modoFinanceiro === "EXTERNO";
  const competenciaAutomatica = !pedido || pedido.versaoFinanceiro === 1;
  const router = useRouter();
  const popup = useContext(PedidoPopupContext);
  const marcarAlterado = popup?.marcarAlterado;
  function entradaInicial() {
    if (pedido) return entradaDoPedido(pedido);
    return { ...entradaDoPedido(), dataCompra: dados.dataCompraPadrao ?? diaNoFuso(new Date(), "America/Sao_Paulo"), ...(dataInicial ? { atendimento: "ENTREGA" as const, prazo: "AGENDADO" as const, previsaoData: dataInicial } : {}) };
  }
  const [d, setD] = useState<PedidoEntrada>(entradaInicial);
  const clientes = dados.clientes;
  const formularioCliente = useRef<HTMLDivElement>(null);
  const clienteInicial = dados.clientes.find(c => c.id === entradaDoPedido(pedido).clienteId);
  const preencherCliente = (c: Dados["clientes"][number]): ClienteEntrada => ({ ...novoClientePedido(), ...c, tipoEscolhido: true, tipo: c.tipo === "PJ" ? "PJ" : "PF", primeiroNome: c.primeiroNome ?? (c.tipo === "PF" ? c.nome.split(" ")[0] : null), sobrenome: c.sobrenome ?? (c.tipo === "PF" ? c.nome.split(" ").slice(1).join(" ") : null), enderecos: c.enderecos as ClienteEntrada["enderecos"], entregaPadrao: c.entregaPadrao as EntregaPadraoCliente | null });
  const [clienteForm, setClienteForm] = useState<ClienteEntrada>(() => clienteInicial ? preencherCliente(clienteInicial) : novoClientePedido());
  function entregaCorrespondenteInicial() {
    const entrada = entradaDoPedido(pedido);
    return clienteInicial && entrada.destinatario && entrada.endereco ? indiceEntregaCorrespondente(clienteInicial.entregaPadrao, { destinatario: entrada.destinatario, endereco: entrada.endereco }) : null;
  }
  const [entregaCadastroSelecionada, setEntregaCadastroSelecionada] = useState<number | null>(entregaCorrespondenteInicial);
  const [cadastroAlterado, setCadastroAlterado] = useState(false);
  const [cobrancaAlterada, setCobrancaAlterada] = useState(false);
  const [entregaClienteAlterada, setEntregaClienteAlterada] = useState(false);
  const [novaEntrega, setNovaEntrega] = useState<EntregaCliente | null>(null), [removendoEntrega, setRemovendoEntrega] = useState(false);
  const [comercialAlterado, setComercialAlterado] = useState(false);
  const [fonte, setFonte] = useState(bruto);
  const [preenchido, setPreenchido] = useState(false);
  const [enderecoCopiado, setEnderecoCopiado] = useState(false);
  useEffect(() => { if (!enderecoCopiado) return; const timer = setTimeout(() => setEnderecoCopiado(false), 1600); return () => clearTimeout(timer); }, [enderecoCopiado]);
  const [id, setId] = useState(pedido?.id ?? "");
  const [numero, setNumero] = useState(pedido?.numero ?? 0);
  const [versao, setVersao] = useState(pedido?.versao ?? 0);
  const [status, setStatus] = useState(pedido?.status ?? "NOVO");
  const entregue = !!pedido?.entregueEm;
  const [consultandoCnpjGeral, setConsultandoCnpjGeral] = useState(false);
  const [consultandoCobranca, setConsultandoCobranca] = useState(false);
  const [consultandoEntrega, setConsultandoEntrega] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [resumoAberto, setResumoAberto] = useState(false);
  const [erro, setErro] = useState("");
  const [pendencia, setPendencia] = useState<PendenciaFormulario | null>(null);
  const formularioPedido = useRef<HTMLElement>(null);
  const alertaPedido = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (erro && !ocupado) { alertaPedido.current?.focus({ preventScroll: true }); alertaPedido.current?.scrollIntoView?.({ block: "center" }); } }, [erro, ocupado]);
  const [aviso, setAviso] = useState("");
  const [motivo, setMotivo] = useState("");
  const [responsavelCancelamento, setResponsavelCancelamento] = useState("");
  const [condicao, setCondicao] = useState<CondicaoFinanceiraPedido>({ categoriaId: "", dataCompetencia: "", creditoUtilizado: "0.00", parcelas: competenciaAutomatica ? [] : [{ valor: "", vencimento: "", formaPagamentoVendaId: "" }] });
  const [financeiro, setFinanceiro] = useState<Financeiro | null>(pedido?.financeiro ?? null);
  const [tituloReceber, setTituloReceber] = useState("");
  const [valorReceber, setValorReceber] = useState("");
  const [contaReceber, setContaReceber] = useState("");
  const [dataReceber, setDataReceber] = useState("");
  const [vencimentos, setVencimentos] = useState<Record<string, string>>({});
  const [externoTitulo, setExternoTitulo] = useState("");
  const [referenciaExterna, setReferenciaExterna] = useState("");
  const [documentoExterno, setDocumentoExterno] = useState("");
  const [evidenciaExterna, setEvidenciaExterna] = useState("");
  const [dataExterna, setDataExterna] = useState("");
  const [taxaExterna, setTaxaExterna] = useState("");
  const [previsaoRepasse, setPrevisaoRepasse] = useState("");
  const [repassePagamentoId, setRepassePagamentoId] = useState("");
  const [brutoRepasse, setBrutoRepasse] = useState("");
  const [taxaRepasse, setTaxaRepasse] = useState("");
  const [contaRepasse, setContaRepasse] = useState("");
  const [dataRepasse, setDataRepasse] = useState("");
  const [categoriaTaxa, setCategoriaTaxa] = useState("");
  const [competenciaTaxa, setCompetenciaTaxa] = useState("");
  const [evidenciaRepasse, setEvidenciaRepasse] = useState("");
  const [valorDevolver, setValorDevolver] = useState(pedido?.financeiro?.elegivel ?? "");
  const [valorReter, setValorReter] = useState("0.00");
  const [motivoRetencao, setMotivoRetencao] = useState("");
  const [politicaRetencao, setPoliticaRetencao] = useState("");
  const [comunicacaoRetencao, setComunicacaoRetencao] = useState("");
  const [tratamentoAtivo, setTratamentoAtivo] = useState("");
  const [contaDevolucao, setContaDevolucao] = useState("");
  const [dataDevolucao, setDataDevolucao] = useState("");
  const [categoriaDevolucao, setCategoriaDevolucao] = useState("");
  const [competenciaDevolucao, setCompetenciaDevolucao] = useState("");
  const [evidenciaDevolucao, setEvidenciaDevolucao] = useState("");
  const [motivoFalha, setMotivoFalha] = useState("");
  const [valorCredito, setValorCredito] = useState(pedido?.financeiro?.elegivel ?? "");
  const [dataEscolhaCredito, setDataEscolhaCredito] = useState("");
  const [comunicacaoCredito, setComunicacaoCredito] = useState("");
  const [valorLiberarCredito, setValorLiberarCredito] = useState(pedido?.financeiro?.creditoRestauravel ?? pedido?.financeiro?.creditoAplicado ?? "");
  const [motivoLiberacaoCredito, setMotivoLiberacaoCredito] = useState("");
  const [comunicacaoLiberacaoCredito, setComunicacaoLiberacaoCredito] = useState("");
  // Atualizações de outra seção preservam formulários em edição.
  // Venda em edição conserva sua versão para detectar concorrência no servidor.
  if (fonte !== bruto) {
    setFonte(bruto); setFinanceiro(pedido?.financeiro ?? null); setStatus(pedido?.status ?? "NOVO");
    if (!comercialAlterado) { setD(entradaInicial()); setVersao(pedido?.versao ?? 0); setClienteForm(clienteInicial ? preencherCliente(clienteInicial) : novoClientePedido()); setEntregaCadastroSelecionada(entregaCorrespondenteInicial()); }
  }
  const emOperacao = useRef(false);
  const chaves = useRef<Record<string, { assinatura: string; chave: string }>>({});
  const editavel = status === "NOVO" || (status === "RASCUNHO" && capacidades.rascunho) || (status === "CONFIRMADO" && !entregue && capacidades.revisar);
  const dataCompraSomenteLeitura = status !== "NOVO" && (status !== "RASCUNHO" || !capacidades.rascunho || !!pedido?.origem && pedido.origem !== "INTERNO");
  const dataCompraObrigatoria = !pedido || !!pedido.dataCompra || pedido.rascunho?.dataCompra !== undefined;
  const editarCadastroCliente = !!capacidades.editarCliente && (status === "NOVO" || status === "RASCUNHO" && capacidades.rascunho);
  const cliente = clientes.find(c => c.id === d.clienteId);
  const opcoesComprador = clientes.map(c => ({ value: c.id, label: c.nome, emails: [c.email, ...(c.emailsAlternativos ?? [])], documentos: [identidadePrincipalCliente(preencherCliente(c)).documento, ...(c.documentosAlternativos ?? [])] }));
  if (d.clienteId && !opcoesComprador.some(c => c.value === d.clienteId)) opcoesComprador.push({ value: d.clienteId, label: clienteForm.nome, emails: [clienteForm.email], documentos: [identidadePrincipalCliente(clienteForm).documento] });
  function filtrarComprador(opcao: (typeof opcoesComprador)[number], consulta: string) {
    const normalizar = (texto: string) => texto.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const documento = consulta.replace(/[.\-/\s]/g, "");
    return normalizar([opcao.label, ...opcao.emails].filter(Boolean).join(" ")).includes(normalizar(consulta))
      || Boolean(documento && /^\d+$/.test(documento) && opcao.documentos.some(valor => valor.replace(/\D/g, "").includes(documento)));
  }
  const pedidoLabel = numero ? `Pedido #${numero}` : "Novo pedido";
  function campo<K extends keyof PedidoEntrada>(nome: K, valor: PedidoEntrada[K]) {
    marcarAlterado?.(); setComercialAlterado(true);
    if ((nome === "destinatario" || nome === "endereco") && entregaCadastroSelecionada !== null && (d.clienteId ? editarCadastroCliente : capacidades.criarCliente)) {
      setEntregaClienteAlterada(true);
      const indice = entregaCadastroSelecionada ?? 0;
      setEntregaCadastroSelecionada(indice);
      setClienteForm(atual => {
        const anterior = entregasDoCliente(atual.entregaPadrao)[indice] ?? { destinatario: d.destinatario ?? { nome: "", contato: "" }, endereco: d.endereco ?? enderecoPedidoVazio() };
        const entrega = nome === "destinatario" ? { ...anterior, destinatario: (valor as PedidoEntrada["destinatario"]) ?? { nome: "", contato: "" } } : { ...anterior, endereco: (valor as PedidoEntrada["endereco"]) ?? enderecoPedidoVazio() };
        return { ...atual, entregaPadrao: atualizarEntregaCliente(atual.entregaPadrao, entrega, indice) };
      });
    }
    setD(atual => {
      const invalidaFrete = ["clienteId", "canalId", "atendimento", "endereco", "itens", "desconto"].includes(nome);
      const retirada = nome === "atendimento" && valor === "RETIRADA";
      const entrega = !retirada && atual.entrega?.metodo === "MANUAL"
        ? { ...atual.entrega, recibo: "", excecaoCobertura: false, motivoCobertura: "" }
        : null;
      const novo = { ...atual, [nome]: valor, ...(invalidaFrete ? { entrega, ...(retirada ? { frete: "0.00" } : {}) } : {}) };
      if (nome === "dataCompra" && valor === undefined) delete novo.dataCompra;
      return novo;
    });
    setErro(""); setAviso(""); setPendencia(null);
  }

  function item(n: number, alteracao: Partial<ItemPedidoEntrada>) { campo("itens", d.itens.map((atual, i) => { if(i!==n)return atual;const novo={...atual,...alteracao};if(novo.tipoEmbalagemId===undefined)delete novo.tipoEmbalagemId;return novo; })); }
  function operacao(tipo: string, dadosOperacao: unknown) {
    const assinatura = JSON.stringify(dadosOperacao);
    if (!chaves.current[tipo] || chaves.current[tipo].assinatura !== assinatura) chaves.current[tipo] = { assinatura, chave: crypto.randomUUID() };
    return chaves.current[tipo].chave;
  }
  function apontarPendencia(mensagem: string, seletor?: string) {
    const raiz = formularioPedido.current;
    const nativo = Array.from(raiz?.querySelectorAll<HTMLInputElement>("input,select,textarea") ?? []).find(campo => campo.willValidate && !campo.validity.valid);
    const alvo = (seletor ? raiz?.querySelector<HTMLElement>(seletor) : nativo) ?? null;
    if (!alvo) { setPendencia(null); setErro(mensagem); return; }
    if (alvo instanceof HTMLInputElement && !alvo.validity.valid) alvo.checkValidity();
    setErro(""); setPendencia({ alvo, mensagem });
  }
  function conferirCobranca() {
    const enderecos = d.enderecosCobranca ?? [d.cobranca ?? enderecoPedidoVazio()];
    const indices = !d.clienteId || cobrancaAlterada ? enderecos.map((_, i) => i) : [d.cobrancaSelecionada ?? 0];
    for (const indice of indices) {
      const falta = pendenciaEnderecoPedido(enderecos[indice]);
      if (!falta) continue;
      setD(atual => ({ ...atual, cobrancaSelecionada: indice, cobranca: enderecos[indice] }));
      apontarPendencia(falta.mensagem, `[data-cobranca-indice="${indice}"] ${falta.seletor}`);
      return false;
    }
    return true;
  }
  function apontarErroCadastro(mensagem: string) {
    if (/cobrança|CEP/.test(mensagem) && !conferirCobranca()) return;
    apontarPendencia(mensagem, /tipo/.test(mensagem) ? '[data-pedido-campo="cliente"] [aria-label="Tipo de cliente"]' : undefined);
  }
  function validarConfirmacao() {
    if (clienteForm.tipoEscolhido === false && !d.clienteId) { apontarPendencia("Escolha o tipo de cliente para preencher as informações gerais.", '[data-pedido-campo="cliente"] [aria-label="Tipo de cliente"]'); return false; }
    const nativo = Array.from(formularioPedido.current?.querySelectorAll<HTMLInputElement>("input,select,textarea") ?? []).find(campo => campo.willValidate && !campo.validity.valid);
    if (nativo) { apontarPendencia(`Confira o campo ${nativo.getAttribute("aria-label") ?? nativo.closest("label")?.firstChild?.textContent ?? "destacado"}.`); return false; }
    if (!d.clienteId && !capacidades.criarCliente) { apontarPendencia("Selecione um cliente.", '[data-pedido-campo="cliente"] [aria-label="Cliente"]'); return false; }
    if ((d.cobranca || !d.clienteId || cobrancaAlterada) && !conferirCobranca()) return false;
    if (d.atendimento === "ENTREGA") {
      if (!d.destinatario?.nome?.trim()) { apontarPendencia("Informe o nome do destinatário.", '[data-pedido-campo="entrega"] input[aria-label="Nome"], [data-pedido-campo="entrega"] [data-destinatario-nome]'); return false; }
      const falta = pendenciaEnderecoPedido(d.endereco, !!d.cobranca || !d.clienteId);
      if (falta) { apontarPendencia(falta.mensagem, `[data-pedido-campo="entrega"] ${falta.seletor}`); return false; }
    }
    if (d.prazo === "AGENDADO" && !d.previsaoJanela) { apontarPendencia("Escolha o horário de entrega.", '[data-pedido-campo="entrega"] [aria-label="Horário de entrega"]'); return false; }
    if (!d.canalId) { apontarPendencia("Escolha o canal de venda.", '[data-pedido-campo="canal"]'); return false; }
    const falta = pendenciaItensPedido(d, dados.catalogo);
    if (falta) { apontarPendencia(falta.mensagem, falta.seletor); return false; }
    const vencimento = d.pagamentoInformado?.vencimentos.findIndex(v => !v);
    if (vencimento !== undefined && vencimento >= 0) { apontarPendencia("Informe o vencimento do boleto.", `[data-pedido-vencimento="${vencimento}"]`); return false; }
    return true;
  }
  function concluir(tipo: string, parte = tipo) {
    delete chaves.current[tipo];
    if (["criar", "salvar", "confirmar", "revisar"].includes(tipo)) setComercialAlterado(false);
    popup?.marcarSalvo(`financeiro:${parte}`);
  }
  async function executar(tarefa: () => Promise<void>) {
    if (emOperacao.current) return;
    if (consultandoCnpjGeral || consultandoCobranca || consultandoEntrega) { setErro("Aguarde a consulta de CEP ou CNPJ antes de salvar ou confirmar."); return; }
    emOperacao.current = true; setOcupado(true); setErro(""); setAviso("");
    try { await tarefa(); } catch { setErro("Não foi possível concluir. Seu preenchimento foi mantido; tente novamente."); }
    finally { emOperacao.current = false; setOcupado(false); }
  }
  function selecionarCliente(clienteId: string | null) {
    marcarAlterado?.(); setComercialAlterado(true);
    const escolhido = clientes.find(c => c.id === clienteId);
    setCadastroAlterado(false); setCobrancaAlterada(false); setEntregaClienteAlterada(false);
    setPreenchido(!!escolhido);
    const enderecos = escolhido?.enderecos.length ? cobrancasDoCliente(preencherCliente(escolhido)).map(e => ({ ...enderecoPedidoVazio(), ...e })) : [enderecoPedidoVazio()];
    const selecionado = indiceEnderecoCobrancaInicial(escolhido?.enderecos ?? []);
    const destinatario = escolhido ? { nome: escolhido.tipo === "PJ" ? escolhido.contato ?? "" : escolhido.nome, primeiroNome: escolhido.tipo === "PJ" ? escolhido.nomeContato ?? "" : escolhido.primeiroNome ?? escolhido.nome.split(" ")[0], sobrenome: escolhido.tipo === "PJ" ? escolhido.sobrenomeContato ?? "" : escolhido.sobrenome ?? escolhido.nome.split(" ").slice(1).join(" "), contato: escolhido.telefone ?? "" } : { nome: "", contato: "" };
    const padrao = selecionarEntregaCliente(escolhido?.entregaPadrao, indiceEntregaCliente(escolhido?.entregaPadrao));
    setClienteForm(escolhido ? { ...preencherCliente(escolhido), entregaPadrao: padrao } : novoClientePedido());
    setEntregaCadastroSelecionada(padrao ? indiceEntregaCliente(padrao) : null);
    setD(atual => ({ ...atual, entrega: null, clienteId, enderecosCobranca: enderecos, cobrancaSelecionada: selecionado, cobranca: enderecos[selecionado],
      endereco: padrao?.endereco ?? null, destinatario: padrao?.destinatario ?? (escolhido ? destinatario : null) }));
  }
  function aplicarEntregaCadastral(padrao: EntregaPadraoCliente | null) {
    marcarAlterado?.(); setComercialAlterado(true); setEntregaClienteAlterada(true);
    setClienteForm(atual => ({ ...atual, entregaPadrao: padrao }));
    setEntregaCadastroSelecionada(padrao ? indiceEntregaCliente(padrao) : null);
    setD(atual => ({ ...atual, entrega: null, endereco: padrao?.endereco ?? null, destinatario: padrao?.destinatario ?? null }));
    setEnderecoCopiado(false); setErro(""); setAviso(""); setPendencia(null);
  }
  function adicionarEntrega() {
    setNovaEntrega(entregaCadastroSelecionada === null ? { destinatario: d.destinatario ?? { nome: "", contato: "" }, endereco: d.endereco ?? enderecoPedidoVazio() } : { destinatario: { nome: "", contato: "" }, endereco: enderecoPedidoVazio() });
  }
  function removerEntrega() { if (entregaCadastroSelecionada !== null) aplicarEntregaCadastral(removerEntregaCliente(clienteForm.entregaPadrao, entregaCadastroSelecionada)); setRemovendoEntrega(false); }
  async function persistir(navegar: boolean) {
    const atual = status === "NOVO" || status === "RASCUNHO" ? { ...d, enderecosCobranca: cobrancasExibidas, cobranca: cobrancasExibidas[d.cobrancaSelecionada ?? 0] } : d;
    let entrada = atual.atendimento === "RETIRADA" ? { ...atual, endereco: null } : atual;
    if (!d.clienteId && ([clienteForm.nome, clienteForm.primeiroNome, clienteForm.sobrenome, clienteForm.telefone, clienteForm.documento, clienteForm.razaoSocial, clienteForm.inscricaoEstadual, clienteForm.email, clienteForm.dataNascimento, clienteForm.nomeContato, clienteForm.sobrenomeContato].some(Boolean))) {
      const email = formularioCliente.current?.querySelector<HTMLInputElement>('[aria-label="E-mail"]');
      if (!clienteForm.email?.trim() || email && !email.validity.valid) { apontarPendencia("Informe um e-mail válido para cadastrar o cliente.", '[data-pedido-campo="cliente"] [aria-label="E-mail"]'); return null; }
      try { entrada = { ...entrada, clienteNovo: validarClienteNovoPedido({ ...clienteForm, telefone: clienteForm.telefone?.replace(/\s/g, "") ?? null, enderecos: cobrancasExibidas.map((endereco, n) => ({ ...endereco, nome: nomeAbaCobranca(n), destinatario: "" })), entregaPadrao: clienteForm.entregaPadrao }) }; }
      catch (e) { apontarErroCadastro(e instanceof Error ? e.message : "Confira os dados cadastrais."); return null; }
    }
    if (d.clienteId && editarCadastroCliente && (cadastroAlterado || cobrancaAlterada || entregaClienteAlterada)) {
      try { entrada = { ...entrada, clienteAtualizacao: validarAtualizacaoClientePedido({ ...clienteForm,
        enderecos: cobrancaAlterada ? cobrancasExibidas.map((endereco, n) => ({ ...endereco, nome: nomeAbaCobranca(n), destinatario: clienteForm.enderecos[n]?.destinatario ?? "" })) : undefined,
        entregaPadrao: entregaClienteAlterada ? clienteForm.entregaPadrao : undefined }) }; }
      catch (e) { apontarErroCadastro(e instanceof Error ? e.message : "Confira os dados do cliente."); return null; }
    }
    function atualizarClienteSalvo(r: { clienteId?: string | null; clienteVersao?: number }) {
      if (!r.clienteId || r.clienteVersao === undefined) return;
      setClienteForm(atual => ({ ...atual, ...entrada.clienteNovo, ...entrada.clienteAtualizacao, id: r.clienteId!, versao: r.clienteVersao! }));
      setCadastroAlterado(false); setCobrancaAlterada(false); setEntregaClienteAlterada(false);
    }
    if (status === "NOVO") {
      const r = await criarRascunhoPedidoAction(entrada, operacao("criar", entrada));
      if ("erro" in r) { setErro(r.erro); return null; }
      atualizarClienteSalvo(r);
      concluir("criar"); setId(r.id); setNumero(r.numero); setVersao(r.versao); setStatus("RASCUNHO"); setD(a => ({ ...a, clienteId: r.clienteId ?? a.clienteId }));
      if (navegar) { popup?.marcarSalvo(); if (popup) popup.navegar(`/vendas/pedidos/${r.id}`); else router.push(`/vendas/pedidos/${r.id}`); }
      return { id: r.id, versao: r.versao };
    }
    if (status !== "RASCUNHO" || !capacidades.rascunho) return null;
    const r = await salvarRascunhoPedidoAction(id, versao, entrada, operacao("salvar", { id, versao, entrada }));
    if ("erro" in r) { setErro(r.erro); return null; }
    atualizarClienteSalvo(r);
    concluir("salvar"); setVersao(r.versao); setD(a => ({ ...a, clienteId: r.clienteId ?? a.clienteId })); router.refresh();
    return { id, versao: r.versao };
  }
  function salvar() { executar(async () => { const salvo = await persistir(true); if (salvo) { popup?.marcarSalvo(); setAviso("Orçamento salvo."); } }); }
  function confirmar() { executar(async () => {
    if ((externo || competenciaAutomatica) && !d.pagamentoInformado) { apontarPendencia("Informe as informações de pagamento antes de confirmar. Você pode salvar um orçamento sem pagamento.", '[data-pedido-campo="pagamento"] [aria-label="Forma de pagamento"]'); return; }
    if (!validarConfirmacao()) return;
    // Pedidos atuais derivam categoria do canal e parcelas do pagamento no servidor; só rascunhos anteriores informam condição.
    const condicaoAnterior = externo || competenciaAutomatica ? undefined : condicao;
    if (condicaoAnterior && !condicaoAnterior.categoriaId) { setErro("Selecione a categoria de receita na condição financeira do pedido."); return; }
    const salvo = capacidades.rascunho || status === "NOVO" ? await persistir(false) : { id, versao };
    if (!salvo) return;
    const r = await confirmarPedidoVendaAction(salvo.id, salvo.versao, operacao("confirmar", { ...salvo, condicao: condicaoAnterior ?? null }), condicaoAnterior);
    if ("erro" in r) { setErro(r.erro); return; }
    concluir("confirmar"); setStatus("CONFIRMADO"); setVersao(r.versao); setAviso(externo ? "Pedido confirmado. Financeiro controlado externamente; confira a agenda e a produção." : "Pedido confirmado com títulos financeiros vinculados.");
    popup?.marcarSalvo(); if (popup) popup.navegar(`/vendas/pedidos/${r.id}`); else router.push(`/vendas/pedidos/${r.id}`);
  }); }
  function revisar() { executar(async () => {
    const r = await revisarPedidoVendaAction(id, versao, d, operacao("revisar", { id, versao, d }));
    if ("erro" in r) { setErro(r.erro); return; }
    concluir("revisar"); popup?.marcarSalvo(); setVersao(r.versao); setAviso("Revisão registrada com histórico anterior preservado."); router.refresh();
  }); }
  function cancelar() { executar(async () => {
    const r = await cancelarPedidoVendaAction(id, versao, motivo, operacao("cancelar", { id, versao, motivo, responsavelInformado: responsavelCancelamento }), undefined, responsavelCancelamento);
    if ("erro" in r) { setErro(r.erro); return; }
    concluir("cancelar"); setStatus("CANCELADO"); setVersao(r.versao); setAviso("Pedido cancelado. O histórico foi preservado."); router.refresh();
  }); }
  function receber() { executar(async () => {
    const r = await registrarRecebimentoPedidoAction(id, tituloReceber, valorReceber, contaReceber, dataReceber, operacao("receber", { id, tituloReceber, valorReceber, contaReceber, dataReceber }));
    if ("erro" in r) { setErro(r.erro); return; }
    concluir("receber"); setFinanceiro(r.financeiro as Financeiro); setTituloReceber(""); setValorReceber(""); setAviso("Recebimento registrado; a conciliação pode vincular a entrada bancária depois."); router.refresh();
  }); }
  function ajustarVencimento(tituloId: string) { executar(async () => {
    const novo = vencimentos[tituloId] ?? "";
    const r = await ajustarVencimentoPedidoAction(id, tituloId, novo, operacao("vencimento", { id, tituloId, novo }));
    if ("erro" in r) { setErro(r.erro); return; }
    concluir("vencimento", `vencimento:${tituloId}`); setFinanceiro(r.financeiro as Financeiro); setAviso("Vencimento em aberto ajustado com histórico."); router.refresh();
  }); }
  function registrarExterno() { executar(async () => {
    const titulo = financeiro?.titulos.find(t => t.id === externoTitulo);
    if (!titulo) return;
    const assinatura = { id, externoTitulo, referenciaExterna, documentoExterno, evidenciaExterna, dataExterna, taxaExterna, previsaoRepasse };
    const r = titulo.forma?.tipo === "BOLETO"
      ? await registrarEmissaoBoletoPedidoAction(id, externoTitulo, referenciaExterna, documentoExterno || null, dataExterna, evidenciaExterna, operacao("externo", assinatura))
      : await registrarCapturaCartaoPedidoAction(id, externoTitulo, referenciaExterna, evidenciaExterna, dataExterna, taxaExterna || null, previsaoRepasse || null, operacao("externo", assinatura));
    if ("erro" in r) { setErro(r.erro); return; }
    concluir("externo"); setFinanceiro(r.financeiro as Financeiro); setExternoTitulo(""); setAviso(titulo.forma?.tipo === "BOLETO" ? "Emissão externa registrada; o boleto ainda não está pago." : "Captura registrada; repasse ao estabelecimento ainda pendente."); router.refresh();
  }); }
  function pagarBoleto(cobrancaId: string) { executar(async () => {
    const assinatura = { id, cobrancaId, contaReceber, dataReceber, evidenciaExterna };
    const r = await confirmarPagamentoBoletoPedidoAction(id, cobrancaId, contaReceber, dataReceber, evidenciaExterna, operacao("boleto-pago", assinatura));
    if ("erro" in r) { setErro(r.erro); return; }
    concluir("boleto-pago"); setFinanceiro(r.financeiro as Financeiro); setAviso(r.financeiro.externos.some(e => e.id === cobrancaId && e.status === "EXCECAO_PAGAMENTO_TARDIO") ? "Pagamento tardio informado. Confira a conta e use Registrar entrada tardia para registrar o dinheiro recebido." : "Pagamento de boleto registrado com evidência."); router.refresh();
  }); }
  function repassarCartao() { executar(async () => {
    const assinatura = { id, repassePagamentoId, brutoRepasse, taxaRepasse, contaRepasse, dataRepasse, categoriaTaxa, competenciaTaxa, evidenciaRepasse };
    const r = await registrarRepasseCartaoPedidoAction(id, repassePagamentoId, brutoRepasse, taxaRepasse, contaRepasse, dataRepasse, categoriaTaxa || null, competenciaTaxa || null, evidenciaRepasse, operacao("repasse", assinatura));
    if ("erro" in r) { setErro(r.erro); return; }
    concluir("repasse"); setFinanceiro(r.financeiro as Financeiro); setRepassePagamentoId(""); setAviso("Repasse registrado no Financeiro com bruto, taxa e líquido separados."); router.refresh();
  }); }
  function solicitarDevolucao() { executar(async () => {
    const assinatura = { id, valorDevolver, valorReter, motivoRetencao, politicaRetencao, comunicacaoRetencao };
    const r = await solicitarDevolucaoPedidoAction(id, valorDevolver, valorReter, motivoRetencao, politicaRetencao, comunicacaoRetencao, operacao("solicitar-devolucao", assinatura));
    if ("erro" in r) { setErro(r.erro); return; }
    concluir("solicitar-devolucao"); setValorDevolver(""); setValorReter("0.00"); setMotivoRetencao(""); setPoliticaRetencao(""); setComunicacaoRetencao(""); setFinanceiro(f => f ? { ...f, elegivel: (Number(f.elegivel ?? 0) - Number(valorDevolver) - Number(valorReter)).toFixed(2), tratamentos: [...(f.tratamentos ?? []), { ...r.tratamento, valor: String(r.tratamento.valor), retido: String(r.tratamento.retido), concluidoEm: null }] } : f); setAviso("Solicitação registrada e valor reservado. Nenhuma devolução foi executada."); router.refresh();
  }); }
  function mudarDevolucao(tratamentoId: string, estado: "PROCESSANDO" | "FALHA" | "CANCELADA") { executar(async () => {
    const assinatura = { id, tratamentoId, estado, motivoFalha };
    const r = await mudarEstadoDevolucaoPedidoAction(id, tratamentoId, estado, motivoFalha, operacao("estado-devolucao", assinatura));
    if ("erro" in r) { setErro(r.erro); return; }
    concluir("estado-devolucao"); setFinanceiro(f => f ? { ...f, elegivel: estado === "FALHA" || estado === "CANCELADA" ? (Number(f.elegivel ?? 0) + Number(f.tratamentos?.find(t => t.id === tratamentoId)?.valor ?? 0) + Number(f.tratamentos?.find(t => t.id === tratamentoId)?.retido ?? 0)).toFixed(2) : f.elegivel, tratamentos: f.tratamentos?.map(t => t.id === tratamentoId ? { ...t, status: r.tratamento.status } : t) } : f); setAviso(`Devolução: ${estado.toLowerCase()}.`); router.refresh();
  }); }
  function concluirDevolucao(tratamentoId: string) { executar(async () => {
    const assinatura = { id, tratamentoId, contaDevolucao, dataDevolucao, categoriaDevolucao, competenciaDevolucao, evidenciaDevolucao };
    const r = await concluirDevolucaoPedidoAction(id, tratamentoId, contaDevolucao, dataDevolucao, categoriaDevolucao, competenciaDevolucao, evidenciaDevolucao, operacao("concluir-devolucao", assinatura));
    if ("erro" in r) { setErro(r.erro); return; }
    concluir("concluir-devolucao"); setFinanceiro(f => f ? { ...f, tratamentos: f.tratamentos?.map(t => t.id === tratamentoId ? { ...t, status: r.tratamento.status, evidenciaConclusao: r.tratamento.evidenciaConclusao, concluidoEm: r.tratamento.concluidoEm ? String(r.tratamento.concluidoEm) : null } : t) } : f); setTratamentoAtivo(""); setAviso("Devolução concluída com saída no Financeiro e evidência registrada."); router.refresh();
  }); }
  function concederCredito() { executar(async () => {
    const assinatura = { id, valorCredito, dataEscolhaCredito, comunicacaoCredito };
    const r = await concederCreditoPedidoAction(id, valorCredito, dataEscolhaCredito, comunicacaoCredito, operacao("conceder-credito", assinatura));
    if ("erro" in r) { setErro(r.erro); return; }
    concluir("conceder-credito"); setFinanceiro(f => f ? { ...f, elegivel: (Number(f.elegivel ?? 0) - Number(valorCredito)).toFixed(2), tratamentos: [...(f.tratamentos ?? []), r.tratamento] } : f); setAviso("Crédito concedido ao comprador; nenhuma entrada ou saída de caixa foi criada."); router.refresh();
  }); }
  function liberarCredito() { executar(async () => {
    const assinatura = { id, valorLiberarCredito, motivoLiberacaoCredito, comunicacaoLiberacaoCredito };
    const r = await liberarCreditoAplicadoPedidoAction(id, valorLiberarCredito, motivoLiberacaoCredito, comunicacaoLiberacaoCredito, operacao("liberar-credito", assinatura));
    if ("erro" in r) { setErro(r.erro); return; }
    concluir("liberar-credito"); setFinanceiro(f => f ? { ...f, creditoRestaurado: (Number(f.creditoRestaurado ?? 0) + Number(valorLiberarCredito)).toFixed(2), creditoRestauravel: Math.max(0, Number(f.creditoRestauravel ?? f.creditoAplicado ?? 0) - Number(valorLiberarCredito)).toFixed(2) } : f); setValorLiberarCredito(""); setMotivoLiberacaoCredito(""); setComunicacaoLiberacaoCredito(""); setAviso("Crédito restaurado ao comprador por decisão autorizada, sem saída de caixa."); router.refresh();
  }); }
  function registrarEdicao(e: SyntheticEvent<HTMLElement>) {
    const alvo = e.target as HTMLElement;
    // Diálogos filhos protegem seu próprio rascunho e não alteram a venda.
    if (alvo.closest('[role="dialog"]') !== e.currentTarget.closest('[role="dialog"]')) return;
    if (alvo.closest('[data-edicao-comercial]') || ["NOVO", "RASCUNHO"].includes(status)) { marcarAlterado?.(); setComercialAlterado(true); }
    else { const parte = alvo.closest<HTMLElement>("[data-edicao-financeira]")?.dataset.edicaoFinanceira; marcarAlterado?.(`financeiro:${parte ?? "outros"}`); }
  }
  // Atualizar estado na captura pode restaurar o valor antes do onChange do campo.
  const cobrancasExibidas = cobrancasDoCliente({ ...clienteForm, enderecos: (d.enderecosCobranca ?? [d.cobranca ?? enderecoPedidoVazio()]).map((e, n) => ({ ...e, nome: nomeAbaCobranca(n), destinatario: "" })) }, false).map((endereco, indice) => indice === 0 && (status === "NOVO" || status === "RASCUNHO") ? { ...endereco, ...identidadePrincipalCliente(clienteForm) } : endereco);
  const opcoesEntrega = entregasDoCliente(clienteForm.entregaPadrao).map((entrega, indice) => ({ value: String(indice), label: [`Entrega ${indice + 1}`, entrega.destinatario.nome, rotuloEnderecoPostal(entrega.endereco)].filter(Boolean).join(" · "), textoOriginal: entrega.textoOriginal ?? "" }));
  if (entregaCadastroSelecionada === null) opcoesEntrega.unshift({ value: "pedido", label: "Endereço deste pedido", textoOriginal: "" });
  const buscaEntrega = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
  const podeEditarLivroEntrega = d.clienteId ? editarCadastroCliente : !!capacidades.criarCliente;
  return <main ref={formularioPedido} onInput={e => { setPendencia(null); registrarEdicao(e); }} onChange={e => { setPendencia(null); registrarEdicao(e); }} aria-busy={ocupado}><MensagemPendenciaFormulario pendencia={pendencia} bloqueado={ocupado} /><fieldset disabled={ocupado} className="min-w-0 space-y-4">
    {id && ["RASCUNHO", "DECLINADO"].includes(status) && <div className="flex flex-wrap items-center justify-end gap-2">{comercialAlterado && <p className="text-xs text-muted-foreground">Salve o orçamento para atualizar o resumo.</p>}<GrupoAcoes nome="Documentos do orçamento"><DropdownMenu><DropdownMenuTrigger render={<Button type="button" variant="outline" size="icon-sm" aria-label="Mais ações do orçamento" />}><MoreHorizontal aria-hidden /></DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-52"><DropdownMenuItem disabled={comercialAlterado} onClick={() => setResumoAberto(true)}><FileText aria-hidden />Resumo do pedido</DropdownMenuItem></DropdownMenuContent></DropdownMenu></GrupoAcoes></div>}
    {!somenteComercial && id && !["RASCUNHO", "DECLINADO"].includes(status) && <Link href={popup ? rotaPopupPedido(`/vendas/pedidos/${id}/comanda`, popup.retorno) : `/vendas/pedidos/${id}/comanda`} onClick={e => { if (popup && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); popup.navegar(`/vendas/pedidos/${id}/comanda`); } }} className="text-primary hover:underline">Comanda de produção · A4 ou 80 mm</Link>}
    {externo && !emDialogo && <section className="rounded-2xl border bg-card p-4"><h2 className="font-semibold">Financeiro controlado externamente</h2><p className="text-sm text-muted-foreground">Confirmação comercial sem cobrança, título, baixa ou nota no HUB. Revisões e cancelamentos precisam ser conferidos no sistema externo pelo responsável.</p></section>}
    {!emDialogo && <div><Link href="/vendas/pedidos" className="text-sm text-muted-foreground hover:text-foreground">← Pedidos</Link><h1 className="font-heading text-display">{pedidoLabel}</h1><p className="mt-1 text-sm text-muted-foreground">{status === "NOVO" || status === "RASCUNHO" ? "Em orçamento — sem venda confirmada" : status === "DECLINADO" ? "Orçamento declinado" : status === "ESTORNADO" ? "Estornado — devolução externa declarada; histórico preservado" : status === "CANCELADO" ? "Venda cancelada; histórico preservado" : entregue ? "Venda confirmada e atendimento concluído" : "Venda comercial confirmada"}</p></div>}
    {!emDialogo && <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border bg-card p-4"><strong className="text-sm">Financeiro</strong><p className="mt-1 text-sm text-muted-foreground">{externo ? "Financeiro controlado externamente. Sem saldo devedor ou quitação calculados pelo HUB." : financeiro?.titulos.length ? `Entradas líquidas registradas: ${moeda(financeiro.entradaLiquida ?? financeiro.recebido)} · Capturado em cartão: ${moeda(financeiro.capturado ?? "0")} · Crédito aplicado: ${moeda(financeiro.creditoAplicado ?? "0")} · Ainda devido pelo cliente: ${moeda(financeiro.saldoCliente ?? financeiro.saldo)}` : "Sem títulos vinculados neste rascunho."}</p></div><div className="rounded-2xl border bg-card p-4"><strong className="text-sm">Estoque e CMV</strong><p className="mt-1 text-sm text-muted-foreground">Consulte reservas e movimentos na operação. Custo apurado e CMV não são presumidos.</p></div><div className="rounded-2xl border bg-card p-4"><strong className="text-sm">Fiscal</strong><p className="mt-1 text-sm text-muted-foreground">Documento não emitido pelo Pedido.</p></div></div>}
    {pedido && !["RASCUNHO", "DECLINADO"].includes(pedido.status) && <section className="space-y-3 rounded-2xl border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Venda comercial registrada</h2><strong className="text-xl tabular-nums">{moeda(pedido.total)}</strong></div><p className="text-sm text-muted-foreground">Comprador: {pedido.compradorSnapshot?.nome ?? "—"} · Canal: {pedido.canalNomeSnapshot ?? "—"} · Confirmado em: {pedido.confirmadoEm ? new Date(pedido.confirmadoEm).toLocaleString("pt-BR", { timeZone: pedido?.fusoHorario ?? "America/Sao_Paulo" }) : "—"}</p><p className="text-sm text-muted-foreground">{pedido.atendimento === "ENTREGA" ? "Entrega" : "Retirada"} {pedido.prazo === "AGENDADO" ? `agendada: ${pedido.previsaoData ? new Date(pedido.previsaoData).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : ""} ${pedido.previsaoJanela ?? ""}` : "imediata"}{pedido.destinatarioSnapshot?.nome ? ` · Destinatário: ${pedido.destinatarioSnapshot.nome}` : ""}</p><div className="divide-y border-y">{pedido.itens.map((i, n) => <div key={n} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><div><strong>{i.produtoSnapshot.nome}</strong><span className="text-muted-foreground"> · {i.quantidade} {i.unidadeSnapshot}</span>{i.escolhasSnapshot.length > 0 && <p className="text-xs text-muted-foreground">{i.escolhasSnapshot.map(o => `${o.opcaoNome} × ${o.quantidade}`).join("; ")}</p>}{i.observacoes && <p className="whitespace-pre-wrap text-xs">Observação: {i.observacoes}</p>}{i.estadoComposicao === "PENDENTE" && <p className="text-xs text-muted-foreground">Composição e CMV pendentes</p>}</div><span className="tabular-nums">{moeda(i.totalLinha)}</span></div>)}</div><div className="grid gap-1 text-sm sm:ml-auto sm:max-w-56"><p className="flex justify-between"><span>Itens</span><span>{moeda(pedido.subtotal)}</span></p><p className="flex justify-between"><span>Desconto</span><span>− {moeda(pedido.desconto)}</span></p><p className="flex justify-between"><span>Frete</span><span>+ {moeda(pedido.frete)}</span></p><p className="flex justify-between"><span>Outras cobranças</span><span>+ {moeda(pedido.outrosCustos ?? "0")}</span></p><p className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{moeda(pedido.total)}</span></p></div></section>}
    {erro && <p ref={alertaPedido} tabIndex={-1} role="alert" className="rounded-xl border border-destructive bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
    {aviso && <p role="status" className="rounded-xl border border-success bg-success-bg p-3 text-sm text-success">{aviso}</p>}
    {!somenteComercial && pedido && pedido.modoFinanceiro === "EXTERNO" && capacidades.cancelar && ["RASCUNHO", "CONFIRMADO", "CANCELADO"].includes(pedido.status) && <EncerramentoManual id={pedido.id} versao={pedido.versao} estado={pedido.status === "RASCUNHO" ? "DECLINADO" : "ESTORNADO"} />}
    <fieldset data-edicao-comercial disabled={!editavel || ocupado} className="min-w-0 space-y-6">
      <div ref={formularioCliente} data-pedido-campo="cliente"><CadastroClientePedido rodape={!externo && capacidades.confirmar ? <CreditoClientePedido clienteId={d.clienteId} /> : undefined} valor={clienteForm} alterar={valor => { marcarAlterado?.(); setComercialAlterado(true); setCadastroAlterado(true); setClienteForm(valor); if (JSON.stringify(valor.enderecos[0]) !== JSON.stringify(clienteForm.enderecos[0])) { setCobrancaAlterada(true); setD(anterior => { const mudancas = Object.fromEntries(Object.entries(valor.enderecos[0] ?? {}).filter(([k, v]) => v !== clienteForm.enderecos[0]?.[k as keyof typeof valor.enderecos[0]])); const enderecos = (anterior.enderecosCobranca ?? [anterior.cobranca ?? enderecoPedidoVazio()]).map((e, n) => n === 0 ? { ...e, ...mudancas } : e); return { ...anterior, enderecosCobranca: enderecos, cobranca: enderecos[anterior.cobrancaSelecionada ?? 0] }; }); } }} onConsultandoCnpjChange={setConsultandoCnpjGeral} somenteLeitura={d.clienteId ? !editarCadastroCliente : !capacidades.criarCliente} emailSomenteLeitura={!!d.clienteId} aviso={preenchido ? <p role="status" className="text-xs text-muted-foreground">Dados preenchidos pelo cadastro selecionado.</p> : <p className="text-xs text-muted-foreground">Busque pelo e-mail para usar um cadastro existente.</p>} busca={<div className="flex min-w-0 items-end gap-2"><div className="min-w-0 flex-1"><Campo nome="Cliente"><Combobox items={opcoesComprador} filter={filtrarComprador} value={opcoesComprador.find(c => c.value === d.clienteId) ?? null} onValueChange={valor => selecionarCliente(valor ? (valor as { value: string }).value : null)}><ComboboxInputGroup><ComboboxInput placeholder="Nome, e-mail ou CPF/CNPJ" aria-label="Cliente" /></ComboboxInputGroup><ComboboxContent>{(opcao: { value: string; label: string }) => <ComboboxItem key={opcao.value} value={opcao}>{opcao.label}</ComboboxItem>}</ComboboxContent></Combobox></Campo></div><Button type="button" size="icon" variant="ghost" aria-label="Limpar cliente" title="Limpar cliente e seus dados" onClick={() => selecionarCliente(null)}><X className="size-4" /></Button></div>} /></div>
      {d.clienteId && <p className="text-xs text-muted-foreground">O e-mail permanece travado. Com permissão para editar Clientes, alterações cadastrais, de cobrança e da entrega padrão são salvas junto com o orçamento ou a confirmação do pedido.</p>}
      <fieldset disabled={clienteForm.tipoEscolhido === false || consultandoCnpjGeral} className="min-w-0"><CobrancaClientePedido key={d.clienteId ?? "novo"} enderecos={cobrancasExibidas} selecionado={d.cobrancaSelecionada ?? 0} obrigatorio={false} onConsultandoCepChange={setConsultandoCobranca} alterar={(enderecos, selecionado) => { marcarAlterado?.(); setComercialAlterado(true); if (JSON.stringify(enderecos) !== JSON.stringify(cobrancasExibidas)) setCobrancaAlterada(true); setD(atual => ({ ...atual, enderecosCobranca: enderecos, cobrancaSelecionada: selecionado, cobranca: enderecos[selecionado] })); }} /></fieldset>
      <section data-pedido-campo="entrega" className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-title">Entrega</h2>{d.atendimento !== "RETIRADA" && <Button type="button" variant="ghost" size="sm" aria-label="Copiar endereço de cobrança" disabled={!d.cobranca || clienteForm.tipoEscolhido === false || consultandoEntrega} onClick={() => { const indice = d.cobrancaSelecionada ?? 0; const copia = copiarCobrancaParaEntrega(cobrancasExibidas[indice], clienteForm, indice === 0); campo("endereco", copia.endereco); campo("destinatario", copia.destinatario); setEnderecoCopiado(true); }}>{enderecoCopiado ? "Endereço copiado" : "Copiar endereço de cobrança"}</Button>}</div><div className={`space-y-3 rounded-2xl border bg-card p-4 transition-colors motion-reduce:transition-none ${enderecoCopiado ? "border-primary/30 bg-primary/5" : ""}`}>
        {d.atendimento !== "RETIRADA" && <div className="flex min-w-0 items-end gap-2">
          <div className="min-w-0 flex-1"><Campo nome="Endereço de entrega"><Combobox items={opcoesEntrega} value={opcoesEntrega.find(opcao => opcao.value === (entregaCadastroSelecionada === null ? "pedido" : String(entregaCadastroSelecionada))) ?? null} disabled={clienteForm.tipoEscolhido === false || consultandoEntrega || consultandoCnpjGeral} filter={(opcao, busca) => buscaEntrega(`${opcao.label} ${opcao.textoOriginal}`).includes(buscaEntrega(busca))} onValueChange={opcao => { if (opcao && opcao.value !== "pedido") aplicarEntregaCadastral(selecionarEntregaCliente(clienteForm.entregaPadrao, Number(opcao.value))); }}>
            <ComboboxInputGroup><ComboboxInput aria-label="Endereço de entrega" placeholder="Buscar destinatário ou endereço" maxLength={250} /></ComboboxInputGroup>
            <ComboboxContent emptyLabel="Nenhum endereço de entrega encontrado.">{(opcao: { value: string; label: string }) => <ComboboxItem key={opcao.value} value={opcao}>{opcao.label}</ComboboxItem>}</ComboboxContent>
          </Combobox></Campo></div>
          <GrupoAcoes nome="Endereços de entrega">
            <Button type="button" variant="outline" size="icon" aria-label="Adicionar endereço de entrega" title="Adicionar endereço de entrega" disabled={!podeEditarLivroEntrega || clienteForm.tipoEscolhido === false || consultandoEntrega || entregasDoCliente(clienteForm.entregaPadrao).length >= LIMITE_ENTREGAS_CLIENTE} onClick={adicionarEntrega}><Plus aria-hidden="true" /></Button>
            <BotaoRemoverItem discreto nome={entregaCadastroSelecionada === null ? "Remover entrega" : `Remover entrega ${entregaCadastroSelecionada + 1}`} disabled={!podeEditarLivroEntrega || consultandoEntrega || entregaCadastroSelecionada === null} onClick={() => { const entrega = entregaCadastroSelecionada === null ? null : entregasDoCliente(clienteForm.entregaPadrao)[entregaCadastroSelecionada]; if (entrega && enderecoTemConteudo({ ...entrega.endereco, nomeCompleto: entrega.destinatario.nome, textoOriginal: entrega.textoOriginal })) setRemovendoEntrega(true); else removerEntrega(); }} />
          </GrupoAcoes>
        </div>}
        <fieldset className="min-w-0 space-y-3"><CamposDestinatarioCliente obrigatorio={entregaCadastroSelecionada !== null && podeEditarLivroEntrega} valor={d.destinatario} alterar={valor => campo("destinatario", valor)}
          antesNome={<div className="grid min-w-0 gap-1.5 text-sm font-medium sm:col-span-2 lg:col-span-1"><span>Modo</span><div role="group" aria-label="Modo de entrega" className="flex gap-2">{(["ENTREGA", "RETIRADA"] as const).map(modo => <Button key={modo} type="button" className="flex-1" variant={d.atendimento === modo ? "default" : "outline"} aria-pressed={d.atendimento === modo} onClick={() => campo("atendimento", modo)}>{modo === "ENTREGA" ? "Entrega" : "Retirada"}</Button>)}</div></div>} />
        <div className="grid items-start gap-3 sm:grid-cols-2">
          <Campo nome="Data de entrega"><Input type="date" value={d.previsaoData ?? ""} onChange={e => { marcarAlterado?.(); setComercialAlterado(true); setD(a => ({ ...a, prazo: e.target.value ? "AGENDADO" : "IMEDIATO", previsaoData: e.target.value || null, previsaoJanela: null })); }} /></Campo>
          <HorarioEntregaCampo configuracao={converterHorariosEntrega(dados.horarios ?? null, true)} data={d.previsaoData ?? ""} valor={d.previsaoJanela ?? ""} alterar={v => campo("previsaoJanela", v || null)} />
        </div>

        {entregaCadastroSelecionada !== null && entregasDoCliente(clienteForm.entregaPadrao)[entregaCadastroSelecionada]?.textoOriginal && <div className="space-y-1 text-sm"><p className="font-medium">Endereço original</p><p className="whitespace-pre-wrap text-muted-foreground">{entregasDoCliente(clienteForm.entregaPadrao)[entregaCadastroSelecionada].textoOriginal}</p></div>}
        {d.atendimento !== "RETIRADA" && <CamposEnderecoPedido key={entregaCadastroSelecionada ?? "pedido"} valor={d.endereco ?? enderecoPedidoVazio()} onConsultandoCepChange={setConsultandoEntrega} alterar={valor => campo("endereco", valor)} obrigatorio={entregaCadastroSelecionada !== null && podeEditarLivroEntrega} />}</fieldset>
      </div>
      {novaEntrega && <NovaEntregaClienteDialog entregas={entregasDoCliente(clienteForm.entregaPadrao)} inicial={novaEntrega} confirmar={valor => { aplicarEntregaCadastral(adicionarEntregaCliente(clienteForm.entregaPadrao, valor)); setNovaEntrega(null); }} fechar={() => setNovaEntrega(null)} />}
      {removendoEntrega && <ConfirmarRemocaoEndereco nome={`Entrega ${(entregaCadastroSelecionada ?? 0) + 1}`} descricao="Este endereço de entrega deixará de aparecer no cadastro." confirmar={removerEntrega} fechar={() => setRemovendoEntrega(false)} />}
      </section>
      <section className="space-y-3"><h2 className="text-title">Pedido</h2><div className="space-y-3 rounded-2xl border bg-card p-4">
        <div data-pedido-campo="canal" data-erro-container className="space-y-2"><p className="text-sm font-medium">Canal</p><SelecaoCanalVenda canais={dados.canais} valor={d.canalId} alterar={v => campo("canalId", v)} /></div>
        {!d.itens.length && <p className="text-sm text-muted-foreground">Adicione um produto para confirmar o pedido. O rascunho pode ser salvo incompleto.</p>}
        {d.itens.map((registro, n) => {
          const opcoesItens = opcoesCatalogoPedido(dados.catalogo.produtos);
          const produto = dados.catalogo.produtos.find(p => p.id === registro.produtoId);
          const antigo = registro.itemOrigemId ? pedido?.itens.find(i => i.id === registro.itemOrigemId) : pedido?.itens[n];
          const origem = registro.complementoAvulso;
          const opcaoAvulsa = origem ? dados.catalogo.grupos.find(g => g.id === origem.grupoId)?.opcoes.find(o => o.id === origem.opcaoId) : null;
          const chave = chaveItemCatalogoPedido(registro);
          const selecionada = opcoesItens.find(o => o.value === chave);
          const opcoesProduto: OpcaoCatalogoPedido[] = [...opcoesItens, ...(!selecionada && chave ? [{ value: chave, produtoId: registro.produtoId, label: origem ? opcaoAvulsa?.nome ?? antigo?.produtoSnapshot.nome ?? "Complemento indisponível" : produto?.nome ?? antigo?.produtoSnapshot.nome ?? "Produto indisponível", categorias: produto?.categorias ?? [], indisponivel: true }] : [])];
          const precoHistorico = status === "CONFIRMADO" && itemComercialPreservado(registro, antigo) ? antigo?.precoOriginal : undefined;
          const preco = precoHistorico ?? produto?.preco;
          const unidade = origem ? "UN" : produto?.unidade ?? "UN";
          return <div data-pedido-item={n} key={n} className="space-y-2 border-b pb-3"><div className="relative grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_7.5rem_10.5rem_auto]"><div className="col-span-2 min-w-0 pr-10 sm:col-span-1 sm:pr-0"><Campo nome={`Produto ${n + 1}`}><ProdutoPedidoCombobox opcoes={opcoesProduto} categorias={dados.catalogo.categorias} value={chave} indice={n} onChange={valor => { const opcao = opcoesItens.find(o => o.value === valor); item(n, { produtoId: opcao?.produtoId ?? "", complementoAvulso: opcao?.complementoAvulso, escolhas: {}, precoManual: null, tipoEmbalagemId: undefined }); }} /></Campo></div><Campo nome="Qtd."><InputComSufixo data-pedido-quantidade={n} sufixo={unidade} aria-label={`Qtd. do produto ${n + 1} em ${unidade}`} type={["KG", "G", "L", "ML", "M", "M2", "M3"].includes(unidade) ? "text" : "number"} inputMode={["KG", "G", "L", "ML", "M", "M2", "M3"].includes(unidade) ? "decimal" : "numeric"} min={["KG", "G", "L", "ML", "M", "M2", "M3"].includes(unidade) ? "0.000001" : "1"} step={1} casasDecimais={6} maxLength={40} value={registro.quantidade} onChange={e => item(n, { quantidade: e.target.value })} /></Campo><PrecoItemPedido indice={n + 1} base={precoHistorico ?? (origem ? opcaoAvulsa?.preco ?? null : preco ?? null)} manual={registro.precoManual} editar={capacidades.preco} alterar={v => item(n, { precoManual: v })} /><div className="absolute top-0 right-0 grid gap-1.5 sm:static"><span aria-hidden="true" className="invisible hidden text-sm font-medium sm:block">Ações</span><div className="flex h-[var(--ds-controle-altura)] items-center"><Button type="button" variant="excluir" aria-label={`Remover item ${n + 1}`} onClick={() => campo("itens", d.itens.filter((_, i) => i !== n))} /></div></div></div>
          {origem && opcaoAvulsa && <p className="text-xs text-muted-foreground">{dados.catalogo.grupos.find(g => g.id === origem.grupoId)?.nome} · Cada unidade corresponde a {opcaoAvulsa.quantidade.replace(".", ",")} {produto?.unidade} de {produto?.nome}.</p>}
          <details className="text-sm"><summary className="cursor-pointer text-primary">Observação{registro.observacoes ? " · preenchida" : ""}</summary><Textarea className="mt-2" aria-label={`Observação do produto ${n + 1}`} value={registro.observacoes ?? ""} maxLength={1000} onChange={e => item(n, { observacoes: e.target.value })} /></details>
          {produto && <>{antigo?.produtoSnapshot?.nome && antigo.produtoSnapshot.nome !== (origem ? opcaoAvulsa?.nome : produto.nome) && <p className="text-xs text-muted-foreground">Nome confirmado antes: {antigo.produtoSnapshot.nome}</p>}
            {!origem && produto.grupos.map((v, grupoIndice) => {
              const g = dados.catalogo.grupos.find(g => g.id === v.grupoId);
              if (!g) return null;
              const limites = limitesEfetivos(g, v);
              const obrigatorio = limites.minimo > 0;
              if (!obrigatorio) return null;
              const opcoes = opcoesEfetivas(precosOpcoes(g.opcoes, dados.catalogo.produtos), v).map(o => {
                const escolha = precoHistorico !== undefined ? antigo?.escolhasSnapshot.find(e => e.opcaoId === o.id) : undefined;
                return escolha?.preco !== undefined ? { ...o, preco: escolha.preco } : o;
              }).filter(o => g.ativo && o.ativo || (registro.escolhas[o.id] ?? 0) > 0);
              if (!opcoes.length) return null;
              const total = opcoes.reduce((soma, opcao) => soma + (registro.escolhas[opcao.id] ?? 0), 0);
              return <details key={g.id} data-pedido-grupo={`${n}-${grupoIndice}`} data-erro-container open className="min-w-0 rounded-xl border bg-card p-2"><summary className="cursor-pointer py-2 text-left text-sm font-medium">{g.nome}<span className="ml-2 text-xs font-normal text-muted-foreground">Obrigatório · Mín. {limites.minimo}{limites.maximo === null ? "" : ` · Máx. ${limites.maximo}`} · {total} selecionado(s) no grupo</span></summary><div className="space-y-2 pt-2">{opcoes.map(o => <SlotComplemento key={o.id} nome={o.nome} controles={<><div className="w-32 shrink-0"><CurrencyInput aria-label={`Preço de ${o.nome} no produto ${n + 1}`} value={o.preco} readOnly /></div><QuantidadeEscolha nome={`Quantidade de ${o.nome} no produto ${n + 1}`} disabled={!g.ativo || !o.ativo} valor={registro.escolhas[o.id] ?? 0} maximo={limiteQuantidadeEscolha(opcoes, registro.escolhas, o.id, limites.maximo, g.repetir)} alterar={quantidade => item(n, { escolhas: { ...registro.escolhas, [o.id]: quantidade } })} /></>} />)}</div></details>;
            })}
            {antigo?.estadoComposicao === "PENDENTE" && <p className="text-xs text-muted-foreground">Composição/CMV pendentes nesta versão; nenhuma baixa de estoque foi feita.</p>}
          </>}
        </div>; })}
        {editavel && <p className="text-xs text-muted-foreground">Escolha os complementos dentro dos grupos de cada produto; preço zero indica uma escolha grátis.</p>}
        {editavel && <Button data-pedido-campo="adicionar-produto" type="button" variant="outline" size="sm" onClick={() => campo("itens", [...d.itens, { produtoId: "", quantidade: "1", observacoes: "", escolhas: {}, precoManual: null }])}><Plus className="size-4" />Adicionar produto</Button>}
        <FretePedido
          mostrarConfiguracao={!emDialogo} veiculos={dados.entregas}
          slotsOcupados={slotsDoRascunho(d.itens, dados.catalogo.produtos, dados.catalogo.grupos)}
          embalagens={d.itens.flatMap(i => {
            const embalagemId = i.tipoEmbalagemId === undefined
              ? dados.catalogo.produtos.find(p => p.id === i.produtoId)?.tipoEmbalagemId
              : i.tipoEmbalagemId;
            return embalagemId ? [embalagemId] : [];
          })}
          configuracaoHref={dados.entregas?.configuracaoHref}
          dados={d} alterar={valor => { marcarAlterado?.(); setComercialAlterado(true); setD(valor); }}
          snapshot={pedido?.entregaSnapshot}
          configuracaoExistente={dados.entregas?.existente ?? false}
          configuracaoAtiva={dados.entregas?.ativo ?? false}
          calculoAutomatico={["NOVO", "RASCUNHO", "DECLINADO"].includes(status)}
          manual={dados.permissoesEntrega?.manual ?? false}
          aprovarCobertura={dados.permissoesEntrega?.cobertura ?? false}
        />
      <Campo nome="Observações"><Textarea rows={2} value={d.observacoes} maxLength={3000} onChange={e => campo("observacoes", e.target.value)} /></Campo>
      <div className="grid gap-3 sm:grid-cols-3"><Campo nome="Cupom de desconto"><Input disabled placeholder="Indisponível até definir regras de cupons" /></Campo><Campo nome="Desconto">{capacidades.desconto ? <CurrencyInput value={d.desconto} onValueChange={v => campo("desconto", v || "0")} /> : <Input value={moeda(d.desconto)} readOnly />}</Campo><Campo nome="Outras cobranças"><CurrencyInput value={d.outrosCustos ?? "0.00"} onValueChange={v => campo("outrosCustos", v || "0")} /></Campo><div data-pedido-campo="pagamento" className="sm:col-span-2"><PagamentoPedidoForm dataCompra={d.dataCompra ?? ""} dataCompraSomenteLeitura={dataCompraSomenteLeitura} dataCompraObrigatoria={dataCompraObrigatoria} alterarDataCompra={valor => { if (!dataCompraSomenteLeitura) campo("dataCompra", !valor && !dataCompraObrigatoria ? undefined : valor); }} total={Math.max(0, d.itens.reduce((s, i) => s + estimarItem(i, dados.catalogo, pedido?.itens), 0) - Number(d.desconto || 0) + Number(d.frete || 0) + Number(d.outrosCustos || 0) - Number(condicao.creditoUtilizado || 0)).toFixed(2)} formas={dados.formas ?? []} valor={d.pagamentoInformado} tipoHistorico={d.formaPagamentoInformada} nomeHistorico={pedido?.pagamentoInformadoSnapshot?.nome} alterar={(v, tipo) => { setPendencia(null); marcarAlterado?.(); setComercialAlterado(true); setD(a => ({ ...a, pagamentoInformado: v, formaPagamentoInformada: tipo })); }} /></div><div className="self-start rounded-xl border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Valor total</p><strong className="text-lg tabular-nums">{moeda(Math.max(0, d.itens.reduce((s, i) => s + estimarItem(i, dados.catalogo, status === "CONFIRMADO" ? pedido?.itens : undefined), 0) + Number(d.frete || 0) + Number(d.outrosCustos || 0) - Number(d.desconto || 0)))}</strong></div><p className="text-xs text-muted-foreground sm:col-span-2">Frete e outras cobranças compõem o valor devido pelo cliente e a receita da venda. Despesas da empresa são registradas no Financeiro. O total definitivo é validado no servidor. {externo ? "Pedido legado externo: cobrança e quitação são registradas fora do HUB." : "A confirmação gera as obrigações do pagamento informado. Registre cada recebimento quando acontecer."}</p></div></div></section>
    </fieldset>
    {!somenteComercial && pedido && pedido.atendimento === "ENTREGA" && pedido.status !== "RASCUNHO" && <CustoEntrega key={`${pedido.id}:${pedido.versao}`} id={pedido.id} versao={pedido.versao} frete={pedido.frete} estimado={pedido.custoEntregaEstimado ?? null} efetivo={pedido.custoEntregaEfetivo ?? null} prestador={pedido.prestadorEntregaId ?? null} prestadores={dados.prestadores ?? []} editar={dados.permissoesEntrega?.logistica ?? false} />}
    {!externo && !competenciaAutomatica && (status === "NOVO" || status === "RASCUNHO") && capacidades.confirmar && <section className="space-y-4 rounded-2xl border bg-card p-4"><div><h2 className="font-semibold">Condição financeira da confirmação</h2><p className="text-sm text-muted-foreground">{competenciaAutomatica ? "Receita reconhecida na confirmação, na categoria selecionada neste pedido. As obrigações usam o pagamento informado acima; receber dinheiro é uma ação separada." : "Condição financeira do pedido anterior; categoria e competência explícitas."}</p></div>
      {<div className="grid gap-3 sm:grid-cols-2"><Campo nome="Categoria de receita bruta"><SelecaoFormulario aria-label="Categoria de receita bruta"  value={condicao.categoriaId} onValueChange={valor => setCondicao(c => ({ ...c, categoriaId: valor }))}><option value="">Selecione</option>{dados.categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelecaoFormulario></Campo>{!competenciaAutomatica && <Campo nome="Data de competência contábil"><Input type="date" value={condicao.dataCompetencia} onChange={e => setCondicao(c => ({ ...c, dataCompetencia: e.target.value }))} /></Campo>}</div>}
      <div className="grid gap-3 sm:grid-cols-2"><Campo nome="Crédito do comprador a aplicar"><CurrencyInput value={condicao.creditoUtilizado ?? "0.00"} onValueChange={v => setCondicao(c => ({ ...c, creditoUtilizado: v || "0.00" }))} /></Campo><p className="self-end text-sm text-muted-foreground">Disponível para {cliente?.nome ?? "o comprador selecionado"}: {moeda(d.clienteId ? dados.creditos[d.clienteId] ?? 0 : 0)}. O crédito não altera preço nem desconto. A disponibilidade é revalidada ao confirmar.</p></div>
      {condicao.parcelas.map((parcela, indice) => <div key={indice} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"><Campo nome={`Valor da condição ${indice + 1}`}><CurrencyInput value={parcela.valor} onValueChange={valor => setCondicao(c => ({ ...c, parcelas: c.parcelas.map((p, n) => n === indice ? { ...p, valor } : p) }))} /></Campo><Campo nome={`Vencimento da condição ${indice + 1}`}><Input type="date" value={parcela.vencimento} onChange={e => setCondicao(c => ({ ...c, parcelas: c.parcelas.map((p, n) => n === indice ? { ...p, vencimento: e.target.value } : p) }))} /></Campo><Campo nome={`Forma da condição ${indice + 1}`}><SelecaoFormulario aria-label={`Forma da condição ${indice + 1}`}  value={parcela.formaPagamentoVendaId} onValueChange={valor => setCondicao(c => ({ ...c, parcelas: c.parcelas.map((p, n) => n === indice ? { ...p, formaPagamentoVendaId: valor, parcelasCliente: 1 } : p) }))}><option value="">Selecione</option>{dados.formas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</SelecaoFormulario></Campo>{dados.formas.find(f => f.id === parcela.formaPagamentoVendaId)?.tipo === "CARTAO_CREDITO" && <Campo nome="Parcelas do cartão"><SelecaoFormulario aria-label="Parcelas do cartão"  value={parcela.parcelasCliente ?? 1} onValueChange={valor => setCondicao(c => ({ ...c, parcelas: c.parcelas.map((p, n) => n === indice ? { ...p, parcelasCliente: Number(valor) } : p) }))}>{[1, 2, 3, 4].filter(n => n === 1 || (dados.formas.find(f => f.id === parcela.formaPagamentoVendaId)?.permiteParcelamento && n <= (dados.formas.find(f => f.id === parcela.formaPagamentoVendaId)?.maximoParcelas ?? 1))).map(n => <option key={n} value={n}>{n}x</option>)}</SelecaoFormulario></Campo>}<div className="flex items-end"><BotaoRemoverItem nome={`Remover condição ${indice + 1}`} disabled={!competenciaAutomatica && condicao.parcelas.length === 1 && !Number(condicao.creditoUtilizado ?? 0)} onClick={() => { marcarAlterado?.(); setCondicao(c => ({ ...c, parcelas: c.parcelas.filter((_, n) => n !== indice) })); }} /></div></div>)}
      <Button type="button" variant="outline" disabled={condicao.parcelas.length >= 36} onClick={() => setCondicao(c => ({ ...c, parcelas: [...c.parcelas, { valor: "", vencimento: "", formaPagamentoVendaId: "" }] }))}>Adicionar parcela</Button>{!dados.formas.length && <p className="text-sm text-destructive">Cadastre uma forma ativa de Pix, boleto ou cartão on-line para confirmar com pagamento complementar.</p>}</section>}
    {!somenteComercial && pedido && financeiro && financeiro.titulos.length > 0 && <section className="space-y-4 rounded-2xl border bg-card p-4"><div><h2 className="font-semibold">Títulos e recebimentos</h2><p className="text-sm text-muted-foreground">Bruto liquidado {moeda(financeiro.recebido)} · crédito aplicado {moeda(financeiro.creditoAplicado ?? "0")} · ainda devido pelo cliente {moeda(financeiro.saldoCliente ?? financeiro.saldo)}. O extrato pode ser conciliado após o registro do recebimento.</p></div>
      <div className="space-y-3">{financeiro.titulos.map(t => <div key={t.id} className="rounded-xl border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{t.quitadoCredito ? "Crédito aplicado" : nomeParcela(t.raiz)} · {t.quitadoCredito ? "Saldo do comprador" : t.forma?.nome ?? "Forma cadastrada"}</strong><span>{t.quitadoCredito ? "Quitado com crédito" : t.status === "BAIXADO" ? "Liquidado" : t.status === "CANCELADO" ? "Cancelado" : financeiro.externos?.some(e => e.tituloId === t.id && e.status === "CAPTURADO") ? "Capturado; repasse pendente" : "Em aberto"} · {moeda(t.valor)}</span></div><p className="text-muted-foreground">Condição original: {moeda(t.valorOriginal)} · Vencimento: {new Date(t.vencimento).toLocaleDateString("pt-BR")}{t.dataPagamento ? ` · Recebido em ${new Date(t.dataPagamento).toLocaleDateString("pt-BR")}` : ""}</p>{capacidades.estornar && capacidades.condicao && t.revisao && t.status === "BAIXADO" && !t.quitadoCredito && ["PIX", "TRANSFERENCIA", "DINHEIRO"].includes(t.forma?.tipo ?? "") && <CorrecaoRecebimento pedidoId={id} tituloId={t.id} revisao={t.revisao} valor={t.valor} />}{t.status === "PENDENTE" && <div className="mt-3 flex flex-wrap items-end gap-2">{capacidades.receber && ["PIX", "TRANSFERENCIA", "DINHEIRO"].includes(t.forma?.tipo ?? "") && <Button type="button" variant="outline" disabled={ocupado} onClick={() => { setTituloReceber(t.id); setValorReceber(t.valor); }}>Registrar recebimento</Button>}{capacidades.condicao && <><div data-edicao-financeira={`vencimento:${t.id}`}><Campo nome={`Novo vencimento de ${nomeParcela(t.raiz)}`}><Input type="date" value={vencimentos[t.id] ?? t.vencimento.slice(0, 10)} onChange={e => setVencimentos(v => ({ ...v, [t.id]: e.target.value }))} /></Campo><Button type="button" variant="outline" disabled={ocupado || !vencimentos[t.id]} onClick={() => ajustarVencimento(t.id)}>Ajustar vencimento</Button></div></>}</div>}</div>)}</div>
      {tituloReceber && capacidades.receber && <div data-edicao-financeira="receber" className="grid gap-3 rounded-xl border p-3 sm:grid-cols-3"><Campo nome="Valor recebido"><CurrencyInput value={valorReceber} onValueChange={setValorReceber} /></Campo><Campo nome="Conta que recebeu"><SelecaoFormulario aria-label="Conta que recebeu"  value={contaReceber} onValueChange={valor => setContaReceber(valor)}><option value="">Selecione</option>{dados.contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelecaoFormulario></Campo><Campo nome="Data do recebimento"><Input type="date" value={dataReceber} onChange={e => setDataReceber(e.target.value)} /></Campo><div className="flex gap-2 sm:col-span-3"><Button type="button" disabled={ocupado || !valorReceber || !contaReceber || !dataReceber} onClick={receber}>Confirmar recebimento</Button><Button type="button" variant="outline" onClick={() => setTituloReceber("")}>Fechar</Button></div></div>}
      <div className="space-y-2">{financeiro.titulos.filter(t => t.status === "PENDENTE" && ["BOLETO", "CARTAO_CREDITO", "CARTAO_DEBITO"].includes(t.forma?.tipo ?? "") && !financeiro.externos?.some(e => e.tituloId === t.id && ["EMITIDO", "CAPTURADO", "PAGO"].includes(e.status))).map(t => <Button key={t.id} type="button" variant="outline" disabled={ocupado || (t.forma?.tipo === "BOLETO" ? !capacidades.condicao : !capacidades.receber)} onClick={() => { setExternoTitulo(t.id); setReferenciaExterna(""); setDocumentoExterno(""); setEvidenciaExterna(""); setDataExterna(t.forma?.tipo === "BOLETO" ? t.vencimento.slice(0, 10) : ""); setTaxaExterna(""); setPrevisaoRepasse(""); }}>{t.forma?.tipo === "BOLETO" ? "Registrar boleto externo" : "Registrar captura externa"} · {nomeParcela(t.raiz)}</Button>)}</div>
      {externoTitulo && <div data-edicao-financeira="externo" className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2"><Campo nome="Referência do emissor/intermediador"><Input value={referenciaExterna} maxLength={180} onChange={e => setReferenciaExterna(e.target.value)} /></Campo><Campo nome="Evidência da operação externa"><Input value={evidenciaExterna} maxLength={180} onChange={e => setEvidenciaExterna(e.target.value)} /></Campo><Campo nome={financeiro.titulos.find(t => t.id === externoTitulo)?.forma?.tipo === "BOLETO" ? "Vencimento no emissor" : "Data da captura"}><Input type="date" value={dataExterna} onChange={e => setDataExterna(e.target.value)} /></Campo>{financeiro.titulos.find(t => t.id === externoTitulo)?.forma?.tipo === "BOLETO" ? <Campo nome="Documento do emissor, se houver"><Input value={documentoExterno} maxLength={180} onChange={e => setDocumentoExterno(e.target.value)} /></Campo> : <><Campo nome="Taxa informada pelo intermediador, se conhecida"><CurrencyInput value={taxaExterna} onValueChange={setTaxaExterna} /></Campo><Campo nome="Previsão do repasse, se conhecida"><Input type="date" value={previsaoRepasse} onChange={e => setPrevisaoRepasse(e.target.value)} /></Campo></>}<div className="flex items-end gap-2"><Button type="button" disabled={ocupado || !referenciaExterna || !evidenciaExterna || !dataExterna} onClick={registrarExterno}>Registrar evidência</Button><Button type="button" variant="outline" onClick={() => setExternoTitulo("")}>Fechar</Button></div></div>}
      {(financeiro.externos ?? []).map(e => <div key={e.id} className="rounded-xl border p-3 text-sm"><strong>{e.tipo === "BOLETO" ? "Boleto" : "Cartão"} · {e.status === "CAPTURADO" && e.repassadoEm ? "Capturado; repasse concluído" : e.status === "CAPTURADO" && (financeiro.repasses ?? []).some(r => r.pagamentoId === e.id) ? "Capturado; repasse parcial" : statusExterno[e.status] ?? e.status}</strong><p>Bruto {moeda(e.valorBruto)} · referência {e.referenciaExterna ?? "—"}{e.parcelasCliente ? ` · ${e.parcelasCliente}x cliente` : ""}</p>{e.tipo !== "BOLETO" && <p>Taxa prevista na captura {e.taxa === null ? "não informada" : moeda(e.taxa)} · líquido previsto {e.valorLiquido === null ? "não informado" : moeda(e.valorLiquido)} · {(financeiro.repasses ?? []).some(r => r.pagamentoId === e.id) ? `repasses registrados: taxa ${moeda(somaRepasse(financeiro, e.id, "taxa"))}, líquido ${moeda(somaRepasse(financeiro, e.id, "valorLiquido"))}` : "repasse pendente"}</p>}{e.tipo === "BOLETO" && <p>Vencimento no emissor: {e.vencimentoExterno?.slice(0, 10) ?? "—"}{e.vencimentoExterno?.slice(0, 10) !== financeiro.titulos.find(t => t.id === e.tituloId)?.vencimento.slice(0, 10) ? " · vencimento interno diferente; atualização externa não confirmada" : ""}</p>}{e.tipo === "BOLETO" && e.status === "EMITIDO" && capacidades.condicao && <TratamentoBoleto pedidoId={id} cobrancaId={e.id} tardio={false} contas={dados.contas} />}{e.tipo === "BOLETO" && ["EXCECAO_PAGAMENTO_TARDIO", "CANCELADO_EXTERNAMENTE"].includes(e.status) && capacidades.receber && <TratamentoBoleto pedidoId={id} cobrancaId={e.id} tardio contas={dados.contas} />}{e.tipo === "BOLETO" && e.status === "EMITIDO" && capacidades.receber && <div className="mt-2 grid gap-2 sm:grid-cols-3"><Campo nome="Conta que recebeu"><SelecaoFormulario aria-label="Conta que recebeu"  value={contaReceber} onValueChange={valor => setContaReceber(valor)}><option value="">Selecione</option>{dados.contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelecaoFormulario></Campo><Campo nome="Data do pagamento"><Input type="date" value={dataReceber} onChange={v => setDataReceber(v.target.value)} /></Campo><Campo nome="Evidência do pagamento"><Input value={evidenciaExterna} onChange={v => setEvidenciaExterna(v.target.value)} /></Campo><Button type="button" disabled={ocupado || !contaReceber || !dataReceber || !evidenciaExterna} onClick={() => pagarBoleto(e.id)}>Confirmar pagamento do boleto</Button></div>}</div>)}
    </section>}
    {!somenteComercial && pedido && financeiro && (status === "CANCELADO" || pedido.versaoFinanceiro === 1 && status === "CONFIRMADO") && <section className="space-y-3 rounded-2xl border bg-card p-4"><h2 className="font-semibold">Devoluções e pós-venda</h2><p className="text-sm text-muted-foreground">Valor disponível para tratamento: {moeda(financeiro.elegivel ?? "0")}. Antes da entrega, trate somente excedentes de revisão ou cancele a venda. Depois da entrega, registre o pós-venda preservando o atendimento. Solicitar reserva o valor; não transfere dinheiro. Retenção parcial exige política aplicável, justificativa e referência da comunicação ao cliente.</p>
      {capacidades.cancelar && capacidades.receber && Number(financeiro.elegivel ?? 0) > 0 && <div data-edicao-financeira="solicitar-devolucao" className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2"><Campo nome="Valor a devolver"><CurrencyInput value={valorDevolver} onValueChange={setValorDevolver} /></Campo><Campo nome="Valor retido, se aplicável"><CurrencyInput value={valorReter} onValueChange={setValorReter} /></Campo><Campo nome={Number(valorReter) > 0 ? "Motivo da devolução e retenção" : "Motivo da devolução"}><Input value={motivoRetencao} maxLength={1000} onChange={e => setMotivoRetencao(e.target.value)} /></Campo>{Number(valorReter) > 0 && <><Campo nome="Referência à política"><Input value={politicaRetencao} maxLength={180} onChange={e => setPoliticaRetencao(e.target.value)} /></Campo><Campo nome="Referência à comunicação com o cliente"><Input value={comunicacaoRetencao} maxLength={180} onChange={e => setComunicacaoRetencao(e.target.value)} /></Campo></>}<div className="flex items-end"><Button type="button" disabled={ocupado || !valorDevolver || !motivoRetencao.trim() || (Number(valorReter) > 0 && (!motivoRetencao || !politicaRetencao || !comunicacaoRetencao))} onClick={solicitarDevolucao}>Solicitar devolução</Button></div></div>}
      {(financeiro.tratamentos ?? []).filter(t => t.tipo === "DEVOLUCAO").map(t => <div key={t.id} className="rounded-xl border p-3 text-sm"><p><strong>Devolução {t.status.toLowerCase()}</strong> · {moeda(t.valor)} a devolver · {moeda(t.retido)} retido{t.evidenciaConclusao ? ` · evidência: ${t.evidenciaConclusao}` : ""}</p>{t.motivo && <p>Motivo: {t.motivo} {t.referenciaPolitica ? ` · política: ${t.referenciaPolitica}` : ""}{t.referenciaComunicacao ? ` · comunicação: ${t.referenciaComunicacao}` : ""}</p>}{capacidades.cancelar && capacidades.receber && t.status === "SOLICITADA" && <Button type="button" variant="outline" disabled={ocupado} onClick={() => mudarDevolucao(t.id, "PROCESSANDO")}>Marcar em processamento</Button>}{capacidades.cancelar && capacidades.receber && ["SOLICITADA", "PROCESSANDO"].includes(t.status) && <div data-edicao-financeira="estado-devolucao" className="mt-2 flex flex-wrap gap-2"><Input className="max-w-64" value={motivoFalha} placeholder="Motivo da falha/cancelamento" onChange={e => setMotivoFalha(e.target.value)} /><Button type="button" variant="outline" disabled={ocupado || !motivoFalha.trim()} onClick={() => mudarDevolucao(t.id, "FALHA")}>Registrar falha</Button><Button type="button" variant="outline" disabled={ocupado || !motivoFalha.trim()} onClick={() => mudarDevolucao(t.id, "CANCELADA")}>Cancelar solicitação</Button></div>}{capacidades.cancelar && capacidades.receber && capacidades.condicao && t.status === "PROCESSANDO" && <Button type="button" variant="outline" disabled={ocupado} onClick={() => setTratamentoAtivo(t.id)}>Registrar conclusão com evidência</Button>}{tratamentoAtivo === t.id && <div data-edicao-financeira="concluir-devolucao" className="mt-3 grid gap-3 sm:grid-cols-3"><Campo nome="Conta da saída"><SelecaoFormulario aria-label="Conta da saída"  value={contaDevolucao} onValueChange={valor => setContaDevolucao(valor)}><option value="">Selecione</option>{dados.contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelecaoFormulario></Campo><Campo nome="Data da saída"><Input type="date" value={dataDevolucao} onChange={e => setDataDevolucao(e.target.value)} /></Campo><Campo nome="Categoria explícita da dedução"><SelecaoFormulario aria-label="Categoria explícita da dedução"  value={categoriaDevolucao} onValueChange={valor => setCategoriaDevolucao(valor)}><option value="">Selecione</option>{dados.categoriasDevolucao.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelecaoFormulario></Campo>{!competenciaAutomatica && <Campo nome="Competência explícita"><Input type="date" value={competenciaDevolucao} onChange={e => setCompetenciaDevolucao(e.target.value)} /></Campo>}{competenciaAutomatica && <p className="text-sm text-muted-foreground">A redução ajusta a competência original da venda. Esta ação registra apenas a saída efetiva da conta informada; estorno feito pelo intermediador deve ser conferido separadamente.</p>}<Campo nome="Evidência da devolução concluída"><Input value={evidenciaDevolucao} maxLength={180} onChange={e => setEvidenciaDevolucao(e.target.value)} /></Campo><div className="flex items-end"><Button type="button" disabled={ocupado || !contaDevolucao || !dataDevolucao || !categoriaDevolucao || (!competenciaAutomatica && !competenciaDevolucao) || !evidenciaDevolucao} onClick={() => concluirDevolucao(t.id)}>Confirmar saída evidenciada</Button></div></div>}</div>)}
    </section>}
    {!somenteComercial && pedido && financeiro && (financeiro.externos ?? []).some(e => e.tipo !== "BOLETO") && <section className="space-y-3 rounded-2xl border bg-card p-4"><h2 className="font-semibold">Repasses de cartão</h2><p className="text-sm text-muted-foreground">Pagamento do cliente e liquidação bancária são registrados separadamente. Informe a taxa comprovada, sua categoria e a competência da despesa.</p>
      {(financeiro.externos ?? []).filter(e => e.tipo !== "BOLETO").map(e => <div key={e.id} className="flex flex-wrap items-center gap-2 text-sm"><span>{e.referenciaExterna} · capturado {moeda(e.valorBruto)} · repassado bruto {moeda((financeiro.repasses ?? []).filter(r => r.pagamentoId === e.id).reduce((s, r) => s + Number(r.valorBruto), 0))}</span>{!e.repassadoEm && capacidades.receber && capacidades.condicao && <Button type="button" variant="outline" disabled={ocupado} onClick={() => { setRepassePagamentoId(e.id); setBrutoRepasse((Number(e.valorBruto) - (financeiro.repasses ?? []).filter(r => r.pagamentoId === e.id).reduce((s, r) => s + Number(r.valorBruto), 0)).toFixed(2)); setTaxaRepasse(e.taxa ?? ""); setContaRepasse(""); setDataRepasse(""); setCategoriaTaxa(""); setCompetenciaTaxa(""); setEvidenciaRepasse(""); }}>Registrar repasse</Button>}</div>)}
      {repassePagamentoId && <div data-edicao-financeira="repasse" className="grid gap-3 rounded-xl border p-3 sm:grid-cols-3"><Campo nome="Bruto deste repasse"><CurrencyInput value={brutoRepasse} onValueChange={setBrutoRepasse} /></Campo><Campo nome="Taxa efetiva deste repasse"><CurrencyInput value={taxaRepasse} onValueChange={setTaxaRepasse} /></Campo><Campo nome="Conta de liquidação"><SelecaoFormulario aria-label="Conta de liquidação"  value={contaRepasse} onValueChange={valor => setContaRepasse(valor)}><option value="">Selecione</option>{dados.contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelecaoFormulario></Campo><Campo nome="Data efetiva"><Input type="date" value={dataRepasse} onChange={e => setDataRepasse(e.target.value)} /></Campo>{Number(taxaRepasse) > 0 && <><Campo nome="Categoria explícita da taxa"><SelecaoFormulario aria-label="Categoria explícita da taxa"  value={categoriaTaxa} onValueChange={valor => setCategoriaTaxa(valor)}><option value="">Selecione</option>{dados.categoriasTaxa.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelecaoFormulario></Campo><Campo nome="Competência explícita da taxa"><Input type="date" value={competenciaTaxa} onChange={e => setCompetenciaTaxa(e.target.value)} /></Campo></>}<Campo nome="Evidência do repasse"><Input value={evidenciaRepasse} onChange={e => setEvidenciaRepasse(e.target.value)} /></Campo><div className="flex items-end gap-2"><Button type="button" disabled={ocupado || !brutoRepasse || taxaRepasse === "" || !contaRepasse || !dataRepasse || !evidenciaRepasse || (Number(taxaRepasse) > 0 && (!categoriaTaxa || !competenciaTaxa))} onClick={repassarCartao}>Confirmar repasse</Button><Button type="button" variant="outline" onClick={() => setRepassePagamentoId("")}>Fechar</Button></div></div>}
    </section>}
    {(consultandoCnpjGeral || consultandoCobranca || consultandoEntrega) && <p role="status" className="text-sm text-muted-foreground">Aguarde a consulta de CEP ou CNPJ antes de salvar ou confirmar.</p>}
    <div className="flex flex-wrap gap-2">{(status === "NOVO" || status === "RASCUNHO") && capacidades.rascunho && <Button type="button" variant="salvar" disabled={ocupado || consultandoCnpjGeral || consultandoCobranca || consultandoEntrega} onClick={salvar}>{ocupado ? "Aguarde…" : "Salvar orçamento"}</Button>}{(status === "NOVO" || status === "RASCUNHO") && capacidades.confirmar && <Button type="button" disabled={ocupado || consultandoCnpjGeral || consultandoCobranca || consultandoEntrega} onClick={confirmar}>Confirmar pedido</Button>}{status === "CONFIRMADO" && !entregue && capacidades.revisar && <Button type="button" disabled={ocupado || consultandoCnpjGeral || consultandoCobranca || consultandoEntrega} onClick={revisar}>Registrar revisão</Button>}</div>
    {!somenteComercial && status === "CONFIRMADO" && (pedido?.statusOperacional ? pedido.statusOperacional !== "ENTREGUE" : !entregue) && capacidades.cancelar && <section className="space-y-3 rounded-2xl border border-destructive/30 p-4"><h2 className="font-semibold">Cancelar pedido</h2><p className="text-sm text-muted-foreground">O pedido e seus valores anteriores permanecem no histórico.</p><Campo nome="Nome do responsável"><Input autoComplete="off" required value={responsavelCancelamento} maxLength={LIMITE_RESPONSAVEL_CANCELAMENTO} onChange={e => { if (aceitaNomeResponsavelCancelamento(e.target.value)) setResponsavelCancelamento(e.target.value); else e.target.value = responsavelCancelamento; }} onKeyDown={e => { if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && !aceitaNomeResponsavelCancelamento(e.key)) e.preventDefault(); }} onPaste={e => { const el = e.currentTarget, proposta = el.value.slice(0, el.selectionStart ?? 0) + e.clipboardData.getData("text") + el.value.slice(el.selectionEnd ?? el.value.length); if (!aceitaNomeResponsavelCancelamento(proposta)) e.preventDefault(); }} /></Campo><Campo nome="Motivo do cancelamento"><Input required value={motivo} maxLength={LIMITE_MOTIVO_CANCELAMENTO} onChange={e => { if (aceitaMotivoCancelamento(e.target.value)) setMotivo(e.target.value); else e.target.value = motivo; }} /></Campo><GrupoAcoes nome="Confirmação do cancelamento" alinhamento="fim"><Button type="button" variant="saida" disabled={ocupado || !nomeResponsavelCancelamentoValido(responsavelCancelamento) || !motivo.trim()} onClick={cancelar}>{ocupado ? "Cancelando…" : "Confirmar cancelamento"}</Button></GrupoAcoes></section>}
    {!somenteComercial && pedido && pedido.historicoFinanceiro.length > 0 && <section className="space-y-3 rounded-2xl border bg-card p-4"><h2 className="font-semibold">Histórico financeiro</h2>{pedido.historicoFinanceiro.map(h => <div key={h.id} className="border-t py-2 text-sm first:border-t-0"><p><strong>{rotulosFinanceiros[h.tipo] ?? h.tipo}</strong> · {h.usuarioNome} · {new Date(h.createdAt).toLocaleString("pt-BR", { timeZone: pedido?.fusoHorario ?? "America/Sao_Paulo" })}</p>{["RECEBIMENTO_CORRIGIDO", "CATEGORIA_REVISADA"].includes(h.tipo) && <p className="text-muted-foreground">{h.detalhes.motivo}</p>}{h.tipo === "RECEBIMENTO" && h.detalhes.recebido && <p className="text-muted-foreground">Recebido: {moeda(h.detalhes.recebido)} · saldo da parcela: {moeda(h.detalhes.saldo ?? "0")}</p>}{h.tipo === "VENCIMENTO_AJUSTADO" && h.detalhes.novo && <p className="text-muted-foreground">Novo vencimento: {new Date(h.detalhes.novo).toLocaleDateString("pt-BR")}</p>}{h.tipo === "SALDO_REVISADO" && h.detalhes.anterior && h.detalhes.novo && <p className="text-muted-foreground">Total do pedido: {moeda(h.detalhes.anterior)} → {moeda(h.detalhes.novo)}</p>}</div>)}</section>}
{!somenteComercial && pedido && <section className="space-y-3 rounded-2xl border bg-card p-4"><h2 className="font-semibold">Histórico comercial</h2>{pedido.historico.map(h => <div key={h.id} className="border-t py-2 text-sm first:border-t-0"><p><strong>{h.tipo === "CRIADO" ? "Rascunho criado" : h.tipo === "RASCUNHO_EDITADO" ? "Rascunho salvo" : h.tipo === "CONFIRMADO" ? "Venda confirmada" : h.tipo === "REVISADO" ? "Pedido revisado" : h.tipo === "CANCELADO" ? "Pedido cancelado" : h.tipo === "DECLINADO" ? "Orçamento declinado" : h.tipo === "ESTORNADO" ? "Estorno externo declarado" : h.tipo === "CUSTO_ENTREGA" ? "Custo da entrega registrado" : h.tipo === "DESPESA_ENTREGA_VINCULADA" ? "Despesa da entrega vinculada" : h.tipo === "DESPESA_ENTREGA_DESVINCULADA" ? "Despesa da entrega desvinculada" : h.tipo.startsWith("OPERACAO_") ? "Ação operacional" : h.tipo === "ENTREGUE" ? "Atendimento concluído" : "Registro do pedido"}</strong> · {h.usuarioNome} · {new Date(h.createdAt).toLocaleString("pt-BR", { timeZone: pedido?.fusoHorario ?? "America/Sao_Paulo" })}</p><p className="text-muted-foreground">Versão {h.versaoAnterior ?? "—"} → {h.versaoNova}{h.antes?.total && h.depois?.total ? ` · ${moeda(h.antes.total)} → ${moeda(h.depois.total)}` : ""}{h.motivo ? ` · ${h.motivo}` : ""}</p>{h.antes?.frete != null && h.depois?.frete != null && <p>Frete: {moeda(h.antes.frete)} → {moeda(h.depois.frete)}</p>}{h.tipo === "CUSTO_ENTREGA" && <p>Custo estimado: {h.antes?.custoEntregaEstimado == null ? "Não informado" : moeda(h.antes.custoEntregaEstimado)} → {h.depois?.custoEntregaEstimado == null ? "Não informado" : moeda(h.depois.custoEntregaEstimado)} · Custo efetivo: {h.antes?.custoEntregaEfetivo == null ? "Não informado" : moeda(h.antes.custoEntregaEfetivo)} → {h.depois?.custoEntregaEfetivo == null ? "Não informado" : moeda(h.depois.custoEntregaEfetivo)}</p>}{h.tipo === "ESTORNADO" && h.depois?.referencia && <p>Referência da devolução externa: {h.depois.referencia}</p>}</div>)}</section>}
    {!somenteComercial && pedido && financeiro && (status === "CANCELADO" || pedido.versaoFinanceiro === 1 && status === "CONFIRMADO") && <section className="space-y-3 rounded-2xl border bg-card p-4"><h2 className="font-semibold">Crédito do comprador</h2><p className="text-sm text-muted-foreground">Crédito só pode vir de pagamento elegível após escolha comunicada pelo cliente. Não pertence automaticamente ao destinatário e não movimenta caixa.</p>{(financeiro.tratamentos ?? []).filter(t => t.tipo === "CREDITO").map(t => <p key={t.id} className="text-sm">Concedido: {moeda(t.valor)} · comunicação: {t.referenciaComunicacao ?? "—"}</p>)}
      {capacidades.cancelar && capacidades.receber && capacidades.condicao && Number(financeiro.elegivel ?? 0) > 0 && <div data-edicao-financeira="conceder-credito" className="grid gap-3 rounded-xl border p-3 sm:grid-cols-3"><Campo nome="Valor a converter em crédito"><CurrencyInput value={valorCredito} onValueChange={setValorCredito} /></Campo><Campo nome="Data da escolha do cliente"><Input type="date" value={dataEscolhaCredito} onChange={e => setDataEscolhaCredito(e.target.value)} /></Campo><Campo nome="Referência da comunicação"><Input value={comunicacaoCredito} maxLength={180} onChange={e => setComunicacaoCredito(e.target.value)} /></Campo><GrupoAcoes alinhamento="inicio" nome="Concessão de crédito" className="sm:col-span-3"><Button type="button" disabled={ocupado || !valorCredito || !dataEscolhaCredito || !comunicacaoCredito} onClick={concederCredito}>Conceder crédito</Button></GrupoAcoes></div>}
      {Number(financeiro.creditoRestaurado ?? 0) > 0 && <p className="text-sm text-muted-foreground">Crédito já restaurado deste pedido: {moeda(financeiro.creditoRestaurado ?? "0")}. Registro sem saída de caixa.</p>}
      {capacidades.cancelar && capacidades.receber && capacidades.condicao && Number(financeiro.creditoRestauravel ?? financeiro.creditoAplicado ?? 0) > 0 && <div data-edicao-financeira="liberar-credito" className="grid gap-3 rounded-xl border p-3 sm:grid-cols-3"><p className="sm:col-span-3">Este pedido utilizou {moeda(financeiro.creditoAplicado ?? "0")} de crédito; ainda pode restaurar {moeda(financeiro.creditoRestauravel ?? financeiro.creditoAplicado ?? "0")}. A restauração exige decisão autorizada e pode ser parcial.</p><Campo nome="Valor a restaurar"><CurrencyInput value={valorLiberarCredito} onValueChange={setValorLiberarCredito} /></Campo><Campo nome="Motivo da liberação"><Input value={motivoLiberacaoCredito} maxLength={1000} onChange={e => setMotivoLiberacaoCredito(e.target.value)} /></Campo><Campo nome="Referência da decisão/comunicação"><Input value={comunicacaoLiberacaoCredito} maxLength={180} onChange={e => setComunicacaoLiberacaoCredito(e.target.value)} /></Campo><Button type="button" disabled={ocupado || !valorLiberarCredito || !motivoLiberacaoCredito || !comunicacaoLiberacaoCredito} onClick={liberarCredito}>Restaurar crédito aprovado</Button></div>}
    </section>}
  </fieldset>{resumoAberto && <Suspense fallback={<p role="status" className="text-sm">Preparando o resumo do pedido…</p>}><PreviaResumoOrcamento pedido={{ id, numero }} fechar={() => setResumoAberto(false)} /></Suspense>}</main>;
}
