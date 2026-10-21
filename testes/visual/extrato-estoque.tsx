import { createRoot } from "react-dom/client";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { MovimentacoesTable } from "@/app/(protegido)/inventario/movimentacoes/movimentacoes-table";
import "@/app/globals.css";
createRoot(document.getElementById("root")!).render(new URLSearchParams(location.search).has("celular") ? <iframe title="Prévia em tela de celular" src="/extrato-estoque.html" style={{ width: 390, height: 844, border: 0, maxWidth: "100%" }} /> : <ProvedorAcesso acesso={{ admin: !new URLSearchParams(location.search).has("sem-permissao"), permissoes: {}, excecoes: {} }}><main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-8"><h1 className="text-2xl font-semibold">Movimentações de estoque</h1><MovimentacoesTable linhas={[
  { id: "3", createdAt: "2026-09-11T15:30:00.000Z", insumoNome: "Açúcar mascavo", localNome: "Estoque principal", unidade: "KG", tipo: "AJUSTE_ENTRADA", quantidade: 0.5, saldo: 8.5, observacao: "Estorno de contagem" },
  { id: "2", createdAt: "2026-09-10T12:00:00.000Z", insumoNome: "Açúcar mascavo", localNome: "Estoque principal", unidade: "KG", tipo: "SAIDA_PERDA", quantidade: 2, saldo: 8, observacao: "Registro de perda" },
  { id: "1", createdAt: "2026-09-01T12:00:00.000Z", insumoNome: "Açúcar mascavo", localNome: "Estoque principal", unidade: "KG", tipo: "ENTRADA_COMPRA", quantidade: 10, saldo: 10, observacao: "Recebimento de pedido de compra" },
]} /></main></ProvedorAcesso>);
