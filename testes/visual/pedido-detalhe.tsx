import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { ModalPedido } from "@/app/(protegido)/vendas/pedidos/modal-pedido";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { DetalhePedido } from "@/app/(protegido)/vendas/pedidos/detalhe-pedido";
import { criarDetalheFixture, dadosDetalhe, capacidadesDetalhe } from "./pedido-detalhe-fixture";
import "@/app/globals.css";
// A identidade fica no body, como no RootLayout real, abaixo do tema no html.
document.body.dataset.identidade = "pedidos";
const parametros = new URLSearchParams(location.search);
const documentos = ["autorizada", "pendente", "incerta"].includes(parametros.get("fiscal") ?? "") ? [{
  id: "documento-exclusivamente-sintetico", versaoPedido: 1, modeloDocumento: 65, status: parametros.get("fiscal") === "incerta" ? "PENDENTE_CONFERENCIA" : "AUTORIZADO",
  ambiente: "PRODUCAO", provedor: "BRASIL_NFE", tentativas: 1, ultimoErro: parametros.get("fiscal") === "incerta" ? "Consulta não comprova um único resultado fiscal seguro; consulte a tentativa antes de reenviar." : parametros.get("fiscal") === "pendente" ? "SEFAZ retornou o código 155. Cancelamento não confirmado. Consulte o evento sem repetir a solicitação." : null,
  cancelamentoPendente: parametros.get("fiscal") === "pendente", cancelamentoSolicitado: parametros.get("fiscal") === "pendente",
  referenciaProvedor: null, chaveFiscal: "0".repeat(44), numero: "101", serie: "1",
  protocolo: parametros.get("fiscal") === "incerta" ? null : "000000000000000", formatoImpressao: parametros.get("fiscal") === "incerta" ? null : "PDF" as const, xmlDisponivel: parametros.get("fiscal") !== "incerta",
}] : [];
createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" defaultTheme={parametros.get("tema") === "escuro" ? "dark" : "light"} enableSystem={false}><ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}><main className="painel-sistema"><h1 className="text-title">Prévia sintética de Pedidos</h1><p>Dados e ações fictícios para inspeção visual.</p></main><ModalPedido detalhe protegerAlteracoes titulo="Pedido #101" descricao="Prévia sintética. Confira os dados do pedido."><DetalhePedido pedido={criarDetalheFixture()} dados={dadosDetalhe} capacidades={capacidadesDetalhe} preparar fiscal={{ editar: true, documentos }} responsavel="Operador Exemplo" /></ModalPedido></ProvedorAcesso></ThemeProvider>);
