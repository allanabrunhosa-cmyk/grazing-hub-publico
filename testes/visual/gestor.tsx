import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";

import { CabecalhoConteudo } from "@/components/layout/cabecalho-conteudo";
import { GestorPedidos } from "@/app/(protegido)/vendas/pedidos/gestor-client";
import { ModalPedido } from "@/app/(protegido)/vendas/pedidos/modal-pedido";
import { DetalhePedido, type PedidoDetalhado } from "@/app/(protegido)/vendas/pedidos/detalhe-pedido";
import type { Dados } from "@/app/(protegido)/vendas/pedidos/editor-pedido";
import { fixtureGestorVisual } from "./gestor-estado";
import { criarDetalheFixture, dadosDetalhe, capacidadesDetalhe } from "./pedido-detalhe-fixture";
import { etapaDoPedido, type GestorFiltros } from "@/app/(protegido)/vendas/pedidos/gestor-dominio";
import type { PedidoGestor } from "@/app/(protegido)/vendas/pedidos/gestor-client";
import { retornoGestorSeguro } from "@/app/(protegido)/vendas/pedidos/pedidos-navegacao";
import { enderecoPedidoVazio } from "@/app/(protegido)/vendas/pedidos/endereco-pedido-form";
import "@/app/globals.css";
const parametros = new URLSearchParams(location.search);
const fixture = fixtureGestorVisual;
fixture.filtros.modo = parametros.get("modo") ?? undefined;
for (const chave of ["busca", "clienteId", "canalId", "produtoId", "status", "etapaGestor", "operacional"] as const) if (parametros.has(chave)) fixture.filtros[chave] = parametros.get(chave) ?? undefined;
function operacional(p: PedidoGestor) { return p.status === "CONFIRMADO" && p.operacional !== "INTERROMPIDO" || p.status === "RECEBIDO_EXTERNO" && p.origem === "IFOOD"; }
function consultaFixture(filtros: GestorFiltros) {
  const busca = (filtros.busca ?? "").toLocaleLowerCase("pt-BR");
  const canal = fixture.canais.find(item => item.id === filtros.canalId)?.nome;
  const cliente = fixture.clientes.find(item => item.id === filtros.clienteId)?.nome;
  const consultados = fixture.resultado.pedidos.filter(p => (!canal || p.canal === canal) && (!cliente || p.cliente === cliente) && (!filtros.produtoId || p.itensDetalhes.some(i => i.produtoId === filtros.produtoId)) && (!busca || p.cliente.toLocaleLowerCase("pt-BR").includes(busca) || p.referenciaPedido?.toLocaleLowerCase("pt-BR").includes(busca) || p.itensDetalhes.some(i => i.nome.toLocaleLowerCase("pt-BR").includes(busca)) || String(p.numero) === busca));
  const pedidos = consultados.filter(p => (!filtros.status || ["todos", "operacionais"].includes(filtros.status) ? operacional(p) : p.status === filtros.status) && (!filtros.etapaGestor || etapaDoPedido(p.status, p.operacional)?.id === filtros.etapaGestor) && (!filtros.operacional || p.operacional === filtros.operacional));
  const etapa = (id: string) => consultados.filter(p => operacional(p) && etapaDoPedido(p.status, p.operacional)?.id === id).length;
  const contagensStatus = { todos: consultados.filter(operacional).length, novo: etapa("novo"), preparo: etapa("preparo"), pronto: etapa("pronto"), rota: etapa("rota"), entregues: etapa("entregues"), orcamento: consultados.filter(p => p.status === "RASCUNHO").length, cancelado: consultados.filter(p => p.status === "CANCELADO").length, declinado: consultados.filter(p => p.status === "DECLINADO").length, estornado: consultados.filter(p => p.status === "ESTORNADO").length, interrompido: consultados.filter(p => p.status === "CONFIRMADO" && p.operacional === "INTERROMPIDO").length };
  return { ...fixture, filtros, resultado: { ...fixture.resultado, pedidos, contagensStatus, quantidadeTotal: pedidos.length, pagina: 1, paginas: 1 } };
}
function detalheFixture(p: PedidoGestor): PedidoDetalhado {
  const base = criarDetalheFixture();
  const forma = p.formaPagamentoInformada;
  const formaPagamentoInformada = forma === "PIX" || forma === "BOLETO" || forma === "CARTAO_CREDITO" || forma === "CARTAO_DEBITO" ? forma : null;
  return { ...base, id: p.id, numero: p.numero, versao: p.versao, status: p.status, statusOperacional: p.operacional, origem: p.origem, createdAt: p.criadoEm, fusoHorario: p.fusoHorario, modoFinanceiro: p.modoFinanceiro, compradorSnapshot: p.compradorSnapshot,
    destinatarioSnapshot: p.destinatarioSnapshot ? { ...p.destinatarioSnapshot, nome: p.destinatarioSnapshot.nome ?? "", contato: p.destinatarioSnapshot.contato ?? "" } : null,
    enderecoSnapshot: p.enderecoSnapshot ? { ...enderecoPedidoVazio(), ...p.enderecoSnapshot } : null,
    cobrancaSnapshot: p.cobrancaSnapshot ? { ...enderecoPedidoVazio(), ...p.cobrancaSnapshot, tipo: p.cobrancaSnapshot.tipo === "PF" || p.cobrancaSnapshot.tipo === "PJ" ? p.cobrancaSnapshot.tipo : undefined } : undefined,
    atendimento: p.atendimento === "ENTREGA" || p.atendimento === "RETIRADA" ? p.atendimento : null, prazo: p.prazo === "IMEDIATO" || p.prazo === "AGENDADO" ? p.prazo : null,
    previsaoData: p.previsaoData, previsaoJanela: p.previsaoJanela, confirmadoEm: p.confirmadoEm, entregueEm: p.entregueEm, subtotal: p.subtotal, total: p.total, desconto: p.desconto, frete: p.frete, outrosCustos: p.outrosCustos, observacoes: p.observacoes ?? "", formaPagamentoInformada,
    pagamentoInformadoSnapshot: p.pagamentoInformadoSnapshot ? { formaId: "forma-ficticia", nome: p.pagamentoInformadoSnapshot.nome, parcelas: p.pagamentoInformadoSnapshot.parcelas, vencimentos: p.pagamentoInformadoSnapshot.vencimentos } : undefined, canalNomeSnapshot: p.canal,
    itens: p.itensDetalhes.map(i => ({ ...base.itens[0], id: i.id, produtoId: i.produtoId ?? "produto-sem-vinculo-ficticio", quantidade: i.quantidade, unidadeSnapshot: i.unidade, precoOriginal: i.precoUnitario, precoAplicado: i.precoUnitario, totalLinha: i.total, observacoes: i.observacoes, produtoSnapshot: { nome: i.nome }, escolhasSnapshot: i.complementos.map((nome, n) => ({ opcaoId: `opcao-ficticia-${n}`, opcaoNome: nome.replace(/^\d+\s*×\s*/, ""), quantidade: 1 })) })),
  };
}
function dadosDoDetalhe(p: PedidoGestor): Dados {
  return { ...dadosDetalhe, catalogo: { ...dadosDetalhe.catalogo, produtos: p.itensDetalhes.filter(i => i.produtoId).map(i => ({ id: i.produtoId, nome: i.nome, unidade: i.unidade, fotoUrl: i.fotoUrl }) as Dados["catalogo"]["produtos"][number]) } };
}
function PreviaGestor() {
  const [dados, setDados] = useState(() => consultaFixture(fixture.filtros));
  const [pedidoAberto, setPedidoAberto] = useState<PedidoGestor | null>(null), [retorno, setRetorno] = useState("/vendas/pedidos"), [abrirCancelamentoInicial, setAbrirCancelamentoInicial] = useState(false);
  useEffect(() => {
    function consultar(evento: Event) {
      const url = new URL((evento as CustomEvent<string>).detail, location.origin);
      const pedidoId = /^\/vendas\/pedidos\/(pedido-ficticio-\d+)$/.exec(url.pathname)?.[1];
      if (pedidoId) {
        const pedido = fixture.resultado.pedidos.find(p => p.id === pedidoId);
        setPedidoAberto(pedido ? { ...pedido } : null);
        setAbrirCancelamentoInicial(url.searchParams.get("cancelar") === "1");
        setRetorno(retornoGestorSeguro(url.searchParams.get("retorno")));
        setDados(dadosAtuais => consultaFixture(dadosAtuais.filtros));
        return;
      }
      setPedidoAberto(null); setAbrirCancelamentoInicial(false); setDados(consultaFixture(Object.fromEntries(url.searchParams)));
    }
    window.addEventListener("gestor-consulta-simulada", consultar);
    return () => window.removeEventListener("gestor-consulta-simulada", consultar);
  }, []);
  return <><GestorPedidos {...dados} configurarIfood />{pedidoAberto && <ModalPedido key={pedidoAberto.id} detalhe protegerAlteracoes titulo={`Pedido #${pedidoAberto.numero}`} descricao="Acompanhe cliente, entrega, pagamento e itens do pedido." retorno={retorno}><DetalhePedido key={`${pedidoAberto.id}:${abrirCancelamentoInicial ? "cancelar" : "detalhe"}`} pedido={detalheFixture(pedidoAberto)} dados={dadosDoDetalhe(pedidoAberto)} capacidades={capacidadesDetalhe} preparar responsavel="Operador Exemplo" abrirCancelamentoInicial={abrirCancelamentoInicial} /></ModalPedido>}</>;
}
document.body.dataset.identidade = "pedidos";
createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" defaultTheme={parametros.has("escuro") ? "dark" : "light"}><ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}><div className="estrutura-sistema"><div className="painel-sistema"><CabecalhoConteudo identidade="pedidos" sessao={{ nome: "Equipe Exemplo", email: "equipe@example.com", admin: true }} /><main className="conteudo-sistema"><PreviaGestor /></main></div></div></ProvedorAcesso></ThemeProvider>);
