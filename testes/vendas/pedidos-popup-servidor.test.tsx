import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
const { permitidos, pode, exigir, obter, dados, consultar, comanda, prontidao, identidade, redirecionar, fiscal } = vi.hoisted(() => {
  const permitidos = new Set<string>();
  const pode = vi.fn(async (recurso: string, acao = "visualizar") => permitidos.has(`${recurso}:${acao}`));
  return { permitidos, pode, exigir: vi.fn(async (recurso: string, acao = "visualizar") => { if (!await pode(recurso, acao)) throw new Error("ACESSO_NEGADO_FICTICIO"); return { nome: "Operador fictício" }; }), obter: vi.fn(), dados: vi.fn(), consultar: vi.fn(), comanda: vi.fn(), prontidao: vi.fn(), identidade: vi.fn(async () => "pedidos"), redirecionar: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }), fiscal: vi.fn(async () => []) };
});
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ host: "pedidos.localhost:4302" })) }));
vi.mock("@/lib/ifood/acoes", () => ({ consultarPedidoIfood: vi.fn(async () => null) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/permissoes/servidor", () => ({ podeAcessar: pode, exigirPermissao: exigir }));
vi.mock("next/navigation", () => ({ redirect: redirecionar, useRouter: vi.fn() }));
vi.mock("@/lib/contexto-interface", () => ({ identidadeDaInterface: identidade }));
vi.mock("@/lib/vendas/pedidos", () => ({ obterPedido: obter }));
vi.mock("@/lib/fiscal-saida/servico", () => ({ consultarFiscalSaida: fiscal }));
vi.mock("@/app/(protegido)/vendas/pedidos/emissao-actions", () => ({ consultarResultadoEmissaoPedidoBrasilNfeAction: vi.fn(), prepararEmissaoPedidoBrasilNfeAction: vi.fn(), emitirNotaPedidoDiretaBrasilNfeAction: vi.fn(), consultarEmissaoPedidoBrasilNfeAction: vi.fn(), obterDocumentosEmissaoPedidoBrasilNfeAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/pedidos/fiscal-actions", () => ({ previaFiscalSaidaAction: vi.fn() }));
vi.mock("@/lib/vendas/pedidos-gestao", () => ({ consultarGestaoPedidos: consultar }));
vi.mock("@/lib/vendas/pedidos-prontidao", () => ({ consultarProntidaoProdutos: prontidao }));
vi.mock("@/lib/vendas/pedidos-horarios", () => ({ consultarHorariosPedidos: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { pedidoVenda: { findUnique: comanda }, clienteVenda: { findMany: vi.fn(async () => []) }, canalVenda: { findMany: vi.fn(async () => []) } } }));
vi.mock("@/app/(protegido)/vendas/pedidos/dados-editor", () => ({ dadosEditorPedido: dados }));
vi.mock("@/app/(protegido)/vendas/pedidos/editor-pedido", () => ({ EditorPedido: () => null }));
vi.mock("@/app/(protegido)/vendas/pedidos/ocorrencias-pedido", () => ({ OcorrenciasPedido: () => null }));
vi.mock("@/app/(protegido)/vendas/pedidos/[id]/operacao/operacao-client", () => ({ OperacaoPedido: () => null }));
vi.mock("@/app/(protegido)/vendas/pedidos/[id]/operacao/fisico-client", () => ({ FisicoPedido: () => null }));
vi.mock("@/app/(protegido)/vendas/pedidos/[id]/operacao/documento-client", () => ({ DocumentoExternoPedido: () => null }));
vi.mock("@/app/(protegido)/vendas/pedidos/[id]/comanda/comanda-client", () => ({ ComandaPedido: () => null }));
vi.mock("@/app/(protegido)/vendas/pedidos/gestor-conteudo", () => ({ FundoGestorPedidos: () => null }));
import { ConteudoPedido } from "@/app/(protegido)/vendas/pedidos/[id]/conteudo";
import { ConteudoNovoPedido } from "@/app/(protegido)/vendas/pedidos/novo/conteudo";
import { ConteudoGestaoPedidos } from "@/app/(protegido)/vendas/pedidos/gestao/conteudo";
import { ConteudoComanda } from "@/app/(protegido)/vendas/pedidos/[id]/comanda/conteudo";
import PedidoPage from "@/app/(protegido)/vendas/pedidos/[id]/page";
import PedidoInterceptado from "@/app/(protegido)/vendas/pedidos/@modal/(.)[id]/page";
import NovoPage from "@/app/(protegido)/vendas/pedidos/novo/page";
import GestaoPage from "@/app/(protegido)/vendas/pedidos/gestao/page";
import ComandaPage from "@/app/(protegido)/vendas/pedidos/[id]/comanda/page";
import OperacaoPage from "@/app/(protegido)/vendas/pedidos/[id]/operacao/page";
import ProntidaoPage from "@/app/(protegido)/vendas/pedidos/prontidao/page";
import ModalDefault from "@/app/(protegido)/vendas/pedidos/@modal/page";
import { DetalhePedido } from "@/app/(protegido)/vendas/pedidos/detalhe-pedido";
import { ModalPedido } from "@/app/(protegido)/vendas/pedidos/modal-pedido";
import { MensagemPopupPedido } from "@/app/(protegido)/vendas/pedidos/mensagem-popup";
import { FundoGestorPedidos } from "@/app/(protegido)/vendas/pedidos/gestor-conteudo";

const params = Promise.resolve({ id: "pedido-ficticio" });
const retorno = "/vendas/pedidos?busca=ficticio&canalId=site&pagina=3&modo=lista";
beforeEach(() => { vi.clearAllMocks(); permitidos.clear(); dados.mockResolvedValue({ horarios: null }); identidade.mockResolvedValue("pedidos"); });
it("detalhe recusado fica no popup e não lê pedido nem catálogo", async () => {
  const resultado = await ConteudoPedido({ params, retorno });
  expect(resultado.type).toBe(MensagemPopupPedido); expect(resultado.props.retorno).toBe(retorno);
  expect(obter).not.toHaveBeenCalled(); expect(dados).not.toHaveBeenCalled();
});
it("Novo recusado não consulta catálogo nem autoriza adicionar", async () => {
  const resultado = await ConteudoNovoPedido({ searchParams: Promise.resolve({}), modal: true });
  expect(resultado.props.role).toBe("alert"); expect(dados).not.toHaveBeenCalled(); expect(exigir).not.toHaveBeenCalled();
});
it("Novo permitido exige adicionar no servidor", async () => {
  permitidos.add("vendas.pedidos:adicionar");
  await ConteudoNovoPedido({ searchParams: Promise.resolve({ data: "2026-10-05" }), modal: true });
  expect(exigir).toHaveBeenCalledWith("vendas.pedidos", "adicionar"); expect(dados).toHaveBeenCalledTimes(1);
});
it("gestão mantém guarda financeira composta antes de consultar", async () => {
  permitidos.add("vendas.pedidos:visualizar");
  const resultado = await ConteudoGestaoPedidos({ searchParams: Promise.resolve({ retorno }) });
  expect(resultado.type).toBe(MensagemPopupPedido); expect(consultar).not.toHaveBeenCalled();
});
it("comanda sem nenhuma permissão é recusada antes de ler snapshots", async () => {
  const resultado = await ConteudoComanda({ params, retorno });
  expect(resultado.type).toBe(MensagemPopupPedido); expect(comanda).not.toHaveBeenCalled();
});
it("comanda preserva alternativa autorizada de produção e indisponibilidade fechável", async () => {
  permitidos.add("vendas.pedidos.producao:visualizar"); comanda.mockResolvedValue(null);
  const resultado = await ConteudoComanda({ params, retorno });
  expect(exigir).toHaveBeenCalledWith("vendas.pedidos.producao");
  expect(comanda).toHaveBeenCalledTimes(1); expect(resultado.type).toBe(MensagemPopupPedido);
});
it("comanda envia observações dos itens autorizados sem snapshots pessoais ou financeiros", async () => {
  permitidos.add("vendas.pedidos.producao:visualizar");
  comanda.mockResolvedValue({ id: "pedido-ficticio", numero: 101, versao: 2, status: "CONFIRMADO", statusOperacional: "EM_PREPARO", atendimento: "RETIRADA", fusoHorario: "America/Sao_Paulo", referenciaPedido: null, previsaoData: null, previsaoJanela: null, observacoes: "Conferir embalagem", historico: [], compradorSnapshot: { cpf: "privado" }, itens: [{ id: "item", quantidade: "2", unidadeSnapshot: "UN", observacoes: "Sem cebola", produtoSnapshot: { nome: "Kit", custo: "privado" }, escolhasSnapshot: [{ opcaoNome: "Extra", quantidade: 1, preco: "privado" }] }] });
  const resultado = await ConteudoComanda({ params, retorno });
  const pedido = resultado.props.children.props.pedido;
  expect(pedido.atendimento).toBe("RETIRADA");
  expect(pedido.itens[0].observacoes).toBe("Sem cebola");
  expect(pedido.itens[0].produtoSnapshot).toEqual({ nome: "Kit" });
  expect(pedido.itens[0].escolhasSnapshot).toEqual([{ opcaoNome: "Extra", quantidade: 1 }]);
  expect(JSON.stringify(pedido)).not.toContain("privado");
  expect(comanda.mock.calls[0][0].select.itens.select.observacoes).toBe(true);
});
it("detalhe mantém exigirPermissao e versão atual sem a área de operação removida", async () => {
  permitidos.add("vendas.pedidos:visualizar");
  obter.mockResolvedValue({ id: "pedido-ficticio", numero: 101, versao: 3, modoFinanceiro: "EXTERNO", status: "CONFIRMADO", statusOperacional: "EM_PREPARO", previsaoData: null, previsaoJanela: null, historico: [], itens: [], financeiro: null });
  const resultado = await ConteudoPedido({ params, retorno });
  expect(exigir).toHaveBeenCalledWith("vendas.pedidos"); expect(resultado.type).toBe(ModalPedido);
  const detalhe = resultado.props.children;
  expect(detalhe.type).toBe(DetalhePedido); expect(detalhe.props.responsavel).toBe("Operador fictício");
  expect(detalhe.props.pedido.versao).toBe(3); expect(detalhe.props.preparar).toBe(false);
  expect(detalhe.props.children).toBeUndefined();
  expect(detalhe.key).toBe("pedido-ficticio:detalhe");
  expect(detalhe.props.abrirCancelamentoInicial).toBe(false);
  expect(detalhe.props.fiscal).toBeUndefined(); expect(fiscal).not.toHaveBeenCalled();
});
it("documentos fiscais só entram no detalhe com consulta fiscal e edição exige revisão do pedido", async () => {
  permitidos.add("vendas.pedidos:visualizar"); permitidos.add("vendas.fiscal:visualizar"); permitidos.add("vendas.fiscal:editar");
  obter.mockResolvedValue({ id: "pedido-ficticio", numero: 101, versao: 3, modoFinanceiro: "EXTERNO", status: "CONFIRMADO", itens: [] });
  const leitura = await ConteudoPedido({ params, retorno });
  expect(leitura.props.children.props.fiscal).toEqual({ editar: false, documentos: [], origemHub: "http://127.0.0.1:4302" });
  expect(fiscal).toHaveBeenCalledExactlyOnceWith("pedido-ficticio", { nome: "Operador fictício" });
  permitidos.add("vendas.pedidos.revisar:editar");
  const edicao = await ConteudoPedido({ params, retorno });
  expect(edicao.props.children.props.fiscal.editar).toBe(true);
});
it("solicitação de cancelar identifica o detalhe sem usar a versão como chave nem perder retorno", async () => {
  permitidos.add("vendas.pedidos:visualizar");
  obter.mockResolvedValue({ id: "pedido-ficticio", numero: 101, versao: 4, modoFinanceiro: "EXTERNO", status: "CONFIRMADO", statusOperacional: "EM_PREPARO", historico: [], itens: [], financeiro: null });
  const resultado = await ConteudoPedido({ params, retorno, abrirCancelamentoInicial: true });
  expect(resultado.props.retorno).toBe(retorno);
  expect(resultado.props.children.key).toBe("pedido-ficticio:cancelar");
  expect(resultado.props.children.props.abrirCancelamentoInicial).toBe(true);
  expect(resultado.props.children.props.pedido.versao).toBe(4);
});
it("cancelar=1 é repassado nas rotas direta e interceptada preservando a consulta de origem", async () => {
  const consulta = Promise.resolve({ retorno, cancelar: "1" });
  const direta = await PedidoPage({ params, searchParams: consulta });
  const popup = React.Children.toArray(direta.props.children)[1];
  if (!React.isValidElement<{ children: React.ReactElement<{ abrirCancelamentoInicial: boolean; retorno: string }> }>(popup)) throw new Error("Popup ausente");
  expect(popup.props.children.props.abrirCancelamentoInicial).toBe(true);
  expect(popup.props.children.props.retorno).toBe(retorno);
  const interceptada = await PedidoInterceptado({ params, searchParams: consulta });
  expect(interceptada.props.abrirCancelamentoInicial).toBe(true);
  expect(interceptada.props.retorno).toBe(retorno);
});
it("acesso direto a detalhe, novo, gestão e comanda recompõe Gestor com a consulta original", async () => {
  const consultas = Promise.resolve({ retorno });
  for (const pagina of [await PedidoPage({ params, searchParams: consultas }), await NovoPage({ searchParams: consultas }), await GestaoPage({ searchParams: consultas }), await ComandaPage({ params, searchParams: consultas })]) {
    const fundo = React.Children.toArray(pagina.props.children)[0];
    expect(React.isValidElement(fundo) && fundo.type).toBe(FundoGestorPedidos);
    if (!React.isValidElement<{ searchParams: Promise<Record<string, string>> }>(fundo)) throw new Error("Fundo ausente");
    expect(await fundo.props.searchParams).toEqual({ busca: "ficticio", canalId: "site", pagina: "3", modo: "lista" });
  }
  expect(ModalDefault()).toBeNull();
});
it("rotas retiradas redirecionam no host dedicado só após autorização e sem consultar estoque", async () => {
  permitidos.add("vendas.pedidos:visualizar");
  await expect(OperacaoPage({ params, searchParams: Promise.resolve({ retorno }) })).rejects.toThrow(`REDIRECT:${retorno}`);
  await expect(ProntidaoPage({ searchParams: Promise.resolve({ retorno: "https://example.invalid" }) })).rejects.toThrow("REDIRECT:/vendas/pedidos");
  expect(exigir).toHaveBeenCalledTimes(2); expect(obter).not.toHaveBeenCalled(); expect(prontidao).not.toHaveBeenCalled();
});
it("favoritos retirados não ultrapassam a guarda quando não há acesso", async () => {
  await expect(OperacaoPage({ params, searchParams: Promise.resolve({ retorno }) })).rejects.toThrow("ACESSO_NEGADO_FICTICIO");
  await expect(ProntidaoPage({ searchParams: Promise.resolve({ retorno }) })).rejects.toThrow("ACESSO_NEGADO_FICTICIO");
  expect(identidade).not.toHaveBeenCalled(); expect(redirecionar).not.toHaveBeenCalled();
});
