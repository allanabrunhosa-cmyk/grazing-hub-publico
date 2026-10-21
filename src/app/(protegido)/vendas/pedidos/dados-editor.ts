import "server-only";
import type { EntregaPadraoCliente } from "@/lib/vendas/dominio";
import { prisma } from "@/lib/prisma";
import { consultarHorariosPedidos } from "@/lib/vendas/pedidos-horarios";
import { consultarProdutos } from "@/lib/vendas/consultas";
import { consultarEntregas } from "@/lib/vendas/entregas";
import { podeAcessar } from "@/lib/permissoes/servidor";
import { identidadeDaInterface } from "@/lib/contexto-interface";
import { identificadoresAlternativosCliente } from "@/lib/vendas/cliente-identificadores";
import { diaNoFuso } from "@/lib/vendas/pedidos-agenda-dominio";

export async function dadosEditorPedido(financeiro = false) {
  const [catalogo, clientes, canais, formas, categorias, contas, categoriasTaxa, categoriasDevolucao, movimentosCredito, loja] = await Promise.all([
    consultarProdutos(),
    prisma.clienteVenda.findMany({ where: { ativo: true, unificadoEmId: null }, select: { id: true, versao: true, nome: true, primeiroNome: true, sobrenome: true, tipo: true, documento: true, razaoSocial: true, inscricaoEstadual: true, email: true, dataNascimento: true, telefone: true, contato: true, nomeContato: true, sobrenomeContato: true, enderecos: true, entregaPadrao: true, clientesUnificados: { select: { email: true, tipo: true, documento: true, enderecos: true } } }, orderBy: { nome: "asc" } }),
    prisma.canalVenda.findMany({ select: { id: true, nome: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }] }),
    prisma.formaPagamentoVenda.findMany({ where: { ativo: true, tipo: { in: ["PIX", "BOLETO", "CARTAO_CREDITO", "CARTAO_DEBITO"] } }, orderBy: { nome: "asc" } }),
    financeiro ? prisma.categoriaFinanceira.findMany({ where: { ativo: true, excluidoEm: null, grupo: "RECEITA_BRUTA" }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : Promise.resolve([]),
    financeiro ? prisma.contaBancaria.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : Promise.resolve([]),
    financeiro ? prisma.categoriaFinanceira.findMany({ where: { ativo: true, excluidoEm: null, grupo: "DESPESAS_FINANCEIRAS" }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : Promise.resolve([]),
    financeiro ? prisma.categoriaFinanceira.findMany({ where: { ativo: true, excluidoEm: null, grupo: "DEDUCOES_RECEITA" }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : Promise.resolve([]),
    financeiro ? prisma.creditoClienteMovimento.groupBy({ by: ["clienteId", "tipo"], _sum: { valor: true } }) : Promise.resolve([]),
    prisma.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { fusoHorario: true } }),
  ]);
  const horarios = (await consultarHorariosPedidos()).horarios;
  const creditos: Record<string, number> = {};
  for (const m of movimentosCredito) creditos[m.clienteId] = (creditos[m.clienteId] ?? 0) + (["CONCESSAO", "LIBERACAO", "AJUSTE_CREDITO"].includes(m.tipo) ? 1 : -1) * Number(m._sum.valor ?? 0);
  const [entregas, manual, coberturaEntrega, logistica] = await Promise.all([consultarEntregas(), podeAcessar("vendas.pedidos.frete", "editar"), podeAcessar("vendas.pedidos.cobertura", "editar"), podeAcessar("vendas.pedidos.logistica", "editar")]);
  const prestadores = logistica ? await prisma.fornecedor.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : [];
  const configuracaoHref = await identidadeDaInterface() === "pedidos" ? "https://grazinghub.com.br/vendas/area-entrega" : "/vendas/area-entrega";
  return { horarios, podeCriarEmbalagem: await podeAcessar("vendas.catalogo", "adicionar"), entregas: { ...(entregas.config.modelo ? { modelo: entregas.config.modelo } : {}), existente: entregas.versao > 0, ativo: entregas.config.ativo, pendencias: entregas.pendencias, configuracaoHref, veiculos: entregas.config.veiculos ?? [], regrasVeiculo: entregas.config.regrasVeiculo ?? [], veiculoPadraoId: entregas.config.veiculoPadraoId, veiculo: entregas.config.veiculo }, permissoesEntrega: { manual, cobertura: coberturaEntrega, logistica }, prestadores, catalogo, clientes: clientes.map(({ clientesUnificados, ...c }) => ({ ...c, ...identificadoresAlternativosCliente(clientesUnificados ?? []), entregaPadrao: c.entregaPadrao as EntregaPadraoCliente | null, dataNascimento: c.dataNascimento?.toISOString().slice(0, 10) ?? null, enderecos: JSON.parse(JSON.stringify(c.enderecos)) as unknown[] })), canais,
    dataCompraPadrao: diaNoFuso(new Date(), loja?.fusoHorario ?? "America/Sao_Paulo"),
    formas: formas.filter(f => !financeiro || f.tipo !== "PIX" || (f.taxaPercentual.isZero() && f.taxaFixa.isZero() && Array.isArray(f.faixasTaxa) && f.faixasTaxa.length === 0)).map(f => ({ id: f.id, nome: f.nome, tipo: f.tipo, permiteParcelamento: f.permiteParcelamento, maximoParcelas: f.maximoParcelas })), categorias, contas, categoriasTaxa, categoriasDevolucao, creditos };
}
