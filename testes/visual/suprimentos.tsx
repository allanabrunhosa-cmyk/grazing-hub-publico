import { createRoot } from "react-dom/client";
import { ContagemForm } from "@/app/(protegido)/inventario/contagem/[id]/contagem-form";
import { FornecedoresTable } from "@/app/(protegido)/fornecedores/fornecedores-table";
import { FornecedorDialog } from "@/app/(protegido)/fornecedores/fornecedor-dialog";
import type { FornecedorRow } from "@/app/(protegido)/fornecedores/types";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { contagemTeste, itensContagemTeste } from "../inventario/dados";
import { Toaster } from "sonner";
import { gerarHtmlContagem } from "@/app/(protegido)/inventario/contagem/impressao";
import "@/app/globals.css";

const fornecedor: FornecedorRow = {
  id: "fornecedor-visual", tipoCadastro: "FORNECEDOR", nome: "Laticínios Serra", razaoSocial: "Laticínios Serra Comércio de Alimentos", cnpj: null, cpf: null,
  contatoNome: "Equipe de atendimento", email: "contato@example.com", telefone: "(11) 0000-0000", site: "https://example.com",
  prazoPagamentoDias: 14, prazoEntregaDias: 2, observacoes: "Entregas pela manhã. Confirmar disponibilidade dos queijos antes do pedido.",
  ativo: true, createdAt: new Date(), updatedAt: new Date(), canaisPedido: [{ id: "canal", nome: "WhatsApp" }],
  formasPagamento: [{ id: "forma", nome: "Boleto" }], insumosVinculados: [{ id: "queijo", nome: "Queijo brie" }],
};
const beneficiario: FornecedorRow = {
  ...fornecedor,
  id: "beneficiario-visual",
  tipoCadastro: "BENEFICIARIO",
  nome: "Marina Oliveira",
  razaoSocial: null,
  cpf: "12345678901",
  telefone: "(11) 99999-1234",
  canaisPedido: [],
  formasPagamento: [{ id: "pix", nome: "PIX" }],
  insumosVinculados: [],
};
const finalizada = new URLSearchParams(location.search).has("finalizada");
const impressao = new URLSearchParams(location.search).has("impressao");
createRoot(document.getElementById("root")!).render(impressao ? <iframe title="Folha de contagem manual" className="h-screen w-full" srcDoc={gerarHtmlContagem(contagemTeste, contagemTeste.itens, "")} /> : <main className="mx-auto max-w-7xl space-y-6 p-6">
  <h1 className="text-2xl font-semibold">Contagem de estoque</h1>
  <p className="text-sm text-muted-foreground">Prévia com dados fictícios, sem gravação no banco.</p>
  <ContagemForm contagem={finalizada ? { ...contagemTeste, status: "FINALIZADO", itens: itensContagemTeste } : contagemTeste} />
  <div className="flex items-center justify-between">
    <h2 className="text-2xl font-semibold">Fornecedores</h2>
    <FornecedorDialog
      canaisPedidoOptions={fornecedor.canaisPedido}
      formasPagamentoOptions={[...fornecedor.formasPagamento, ...beneficiario.formasPagamento]}
      trigger={<Button><Plus className="size-4" />Novo</Button>}
    />
  </div>
  <FornecedoresTable fornecedores={[fornecedor, beneficiario]} canaisPedidoOptions={fornecedor.canaisPedido} formasPagamentoOptions={[...fornecedor.formasPagamento, ...beneficiario.formasPagamento]} />
  <Toaster />
</main>);
