import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { identidadeDaInterface } from "@/lib/contexto-interface";
import { CAMINHO_PEDIDOS, HOST_PEDIDOS } from "@/lib/hosts";
import { consultarMovimentacaoEstoqueGestorPedidos, listarPedidos } from "@/lib/vendas/pedidos";
import { diaNoFuso, diaValido, periodoCalendario } from "@/lib/vendas/pedidos-agenda-dominio";
import { GestorPedidos } from "./gestor-client";
import { AtualizacaoIfood } from "./ifood/atualizacao-ifood";
import { modoGestor, rotaGestor, type GestorFiltros } from "./gestor-dominio";

export async function FundoGestorPedidos(props: { searchParams: Promise<GestorFiltros> }) {
  if (!await podeAcessar("vendas.pedidos")) return <p role="alert">Seu perfil não possui acesso ao Gestor de pedidos.</p>;
  return <ConteudoGestorPedidos {...props} />;
}

export async function ConteudoGestorPedidos({ searchParams }: { searchParams: Promise<GestorFiltros> }) {
  const sessao = await exigirPermissao("vendas.pedidos");
  const parametros = await searchParams;
  if (await identidadeDaInterface() !== "pedidos") redirect(`https://${HOST_PEDIDOS}${rotaGestor(parametros)}`);
  const filtros = { ...parametros, modo: parametros.modo ?? (parametros.visao === "lista" ? "lista" : undefined), status: parametros.status ?? "todos", ...(parametros.status === "HISTORICO" ? { modo: "lista", baseData: "criacao", etapaGestor: undefined, operacional: undefined } : {}) };
  const [loja, clientes, canais, produtos, adicionar, preparar, expedir, configuracaoEstoque, configurarIfood, cancelar] = await Promise.all([
    prisma.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { fusoHorario: true } }),
    prisma.clienteVenda.findMany({ where: { unificadoEmId: null }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.canalVenda.findMany({ select: { id: true, nome: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }] }),
    prisma.produtoVenda.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    podeAcessar("vendas.pedidos", "adicionar"), podeAcessar("vendas.pedidos.producao", "editar"), podeAcessar("vendas.pedidos.revisar", "editar"),
    consultarMovimentacaoEstoqueGestorPedidos(sessao),
    sessao.admin ? podeAcessar("configuracoes.loja", "editar") : false,
    podeAcessar("vendas.pedidos.cancelar", "editar"),
  ]);
  const fuso = loja?.fusoHorario ?? "America/Sao_Paulo";
  const dia = diaValido(filtros.data) ? filtros.data : diaNoFuso(new Date(), fuso);
  const visao = filtros.visao === "dia" || filtros.visao === "semana" ? filtros.visao : "mes";
  const periodo = periodoCalendario(dia, visao);
  const calendario = modoGestor(filtros.modo) === "calendario";
  const de = diaValido(filtros.de) ? filtros.de : undefined;
  const ate = diaValido(filtros.ate) ? filtros.ate : undefined;
  const resultado = await listarPedidos({ ...filtros, status: filtros.status === "todos" ? "operacionais" : filtros.status, pagina: Number(filtros.pagina) || 1,
    ...(calendario ? { baseData: "entrega", de: de && de > periodo.inicio ? de : periodo.inicio, ate: ate && ate < periodo.fim ? ate : periodo.fim, incluirSemData: true } : {}),
  });
  return <>{process.env.IFOOD_ATIVO === "1" && <AtualizacaoIfood />}<GestorPedidos filtros={filtros} resultado={resultado} clientes={clientes} canais={canais} produtos={produtos} configurarIfood={configurarIfood}
    capacidades={{ adicionar, preparar: preparar || expedir, expedir, cancelar }} configuracaoEstoque={configuracaoEstoque} agenda={{ ...periodo, dia, visao, fuso }} caminhoBase={CAMINHO_PEDIDOS} /></>;
}
