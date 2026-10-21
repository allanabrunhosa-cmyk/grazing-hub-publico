import { z } from "zod";
import { funcao } from "./definicao";
import { FUNCOES_SUPRIMENTOS_MCP } from "./registro-suprimentos";
import { FUNCOES_FINANCEIRO_ACOES_MCP } from "./registro-financeiro-acoes";
import { FUNCOES_PEDIDOS_MCP, CondicaoFinanceiraMcp } from "./registro-pedidos";
import { FUNCOES_PRODUCAO_MCP } from "./registro-producao";
import { FUNCOES_CADASTROS_MCP } from "./registro-cadastros";
import { FUNCOES_CANAIS_FISCAL_MCP } from "./registro-canais-fiscal";
import { FUNCOES_COMPLEMENTARES_MCP } from "./registro-complementar";
import { camposAtualizacaoMcp, ClienteMcp, ClienteAtualizacaoMcp, ConsultaMcp, DataMcp, DinheiroMcp, IdMcp, LancamentoMcp, LancamentoCriacaoMcp, PedidoMcp, ProdutoMcp, ProdutoAtualizacaoMcp, ReferenciaMcp, TextoMcp } from "./contratos-negocio";

const alvo = ReferenciaMcp;
const motivo = TextoMcp.min(5);
export const FUNCOES_NEGOCIO_MCP = [
  funcao("conexao_contexto", "Conexão", "Consultar minha identidade e capacidades", "", "visualizar", z.object({}).strict()),
  funcao("clientes_consultar", "Clientes", "Localizar clientes por nome ou identificador", "vendas.clientes", "visualizar", ConsultaMcp),
  funcao("clientes_criar", "Clientes", "Cadastrar cliente", "vendas.clientes", "adicionar", ClienteMcp.omit({ id: true, versao: true })),
  funcao("clientes_atualizar", "Clientes", "Atualizar somente os campos informados do cliente", "vendas.clientes", "editar", ClienteAtualizacaoMcp),
  funcao("clientes_inativar", "Clientes", "Inativar cliente conservando histórico", "vendas.clientes", "editar", alvo),
  funcao("produtos_consultar", "Produtos", "Localizar produtos comerciais e preços", "vendas.produtos", "visualizar", ConsultaMcp),
  funcao("produtos_criar", "Produtos", "Cadastrar produto e composição comercial", "vendas.produtos", "adicionar", ProdutoMcp.omit({ id: true, versao: true })),
  funcao("produtos_atualizar", "Produtos", "Atualizar somente os campos informados do produto e sua composição", "vendas.produtos", "editar", ProdutoAtualizacaoMcp),
  funcao("produtos_disponibilidade", "Produtos", "Ativar ou inativar produto", "vendas.produtos", "editar", alvo.extend({ ativo: z.boolean() })),
  funcao("produtos_preco", "Produtos", "Alterar preço comercial", "vendas.produtos", "editar", alvo.extend({ preco: DinheiroMcp })),
  funcao("pedidos_consultar", "Pedidos", "Consultar pedidos em páginas de 50, detalhes e histórico operacional", "vendas.pedidos", "visualizar", ConsultaMcp.omit({ ativo: true, tamanho: true }).extend({ de: DataMcp.optional(), ate: DataMcp.optional() }).refine(d=>!d.de || !d.ate || d.de<=d.ate)),
  funcao("pedidos_criar_rascunho", "Pedidos", "Criar orçamento no fluxo normal do HUB", "vendas.pedidos", "adicionar", PedidoMcp),
  funcao("pedidos_salvar_rascunho", "Pedidos", "Atualizar orçamento existente", "vendas.pedidos", "adicionar", alvo.extend({ pedido: PedidoMcp })),
  funcao("pedidos_confirmar", "Pedidos", "Confirmar orçamento com seus efeitos normais", "vendas.pedidos.confirmar", "editar", alvo.extend({ condicaoFinanceira: CondicaoFinanceiraMcp.optional() }), true),
  funcao("pedidos_revisar", "Pedidos", "Revisar pedido confirmado com snapshots preservados", "vendas.pedidos.revisar", "editar", alvo.extend({ pedido: PedidoMcp }), true),
  funcao("pedidos_cancelar", "Pedidos", "Cancelar pedido sem inventar devolução financeira", "vendas.pedidos.cancelar", "editar", alvo.extend({ motivo }), true),
  funcao("pedidos_registrar_entrega", "Pedidos", "Registrar entrega sem registrar pagamento", "vendas.pedidos.revisar", "editar", alvo),
  funcao("pedidos_registrar_recebimento", "Pedidos", "Registrar recebimento interno de título de pedido", "financeiro.baixas", "editar", z.object({ pedidoId: IdMcp, tituloId: IdMcp, valor: DinheiroMcp, contaId: IdMcp, data: DataMcp }).strict(), true),
  funcao("pedidos_ajustar_vencimento", "Pedidos", "Ajustar vencimento de título do pedido", "financeiro.movimentacoes", "editar", z.object({ pedidoId: IdMcp, tituloId: IdMcp, vencimento: DataMcp }).strict()),
  funcao("financeiro_criar_lancamento", "Financeiro", "Cadastrar lançamento financeiro manual e parcelas recorrentes pendentes", "financeiro.movimentacoes", "adicionar", LancamentoCriacaoMcp),
  funcao("financeiro_atualizar_lancamento", "Financeiro", "Editar lançamento manual pendente", "financeiro.movimentacoes", "editar", camposAtualizacaoMcp(LancamentoMcp).extend({ id: IdMcp, revisao: z.iso.datetime() }).refine(d=>Object.keys(d).some(k=>!["id","revisao"].includes(k)), "Informe um campo para atualizar.")),
  funcao("financeiro_baixar_lancamento", "Financeiro", "Registrar pagamento ou recebimento interno", "financeiro.baixas", "editar", z.object({ id: IdMcp, contaId: IdMcp, data: DataMcp }).strict(), true),
  funcao("financeiro_estornar_baixa", "Financeiro", "Reverter baixa interna sem transferir dinheiro", "financeiro.estornos", "editar", z.object({ id: IdMcp, motivo }).strict(), true),
  ...FUNCOES_SUPRIMENTOS_MCP,
  ...FUNCOES_FINANCEIRO_ACOES_MCP,
  ...FUNCOES_PEDIDOS_MCP,
  ...FUNCOES_PRODUCAO_MCP,
  ...FUNCOES_CADASTROS_MCP,
  ...FUNCOES_CANAIS_FISCAL_MCP,
  ...FUNCOES_COMPLEMENTARES_MCP,
] as const;
export type NomeNegocioMcp = typeof FUNCOES_NEGOCIO_MCP[number]["nome"];
export const SAIDA_NEGOCIO_MCP = z.object({ estado: z.enum(["OK", "VAZIO", "AGUARDANDO_APROVACAO"]), geradoEm: z.iso.datetime(), moeda: z.literal("BRL"), fuso: z.string(), dados: z.json(), limitacoes: z.array(z.string()) }).strict();
