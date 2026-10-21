import { createRoot } from "react-dom/client";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { InsumosTable } from "@/app/(protegido)/insumos/insumos-table";
import { FornecedoresTable } from "@/app/(protegido)/fornecedores/fornecedores-table";
import { fornecedorStatus, insumoStatus } from "../cadastros/dados";
import "@/app/globals.css";

createRoot(document.getElementById("root")!).render(
  <ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}>
    <main className="space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Edição dos cadastros</h1>
      <p className="text-sm text-muted-foreground">Dados fictícios e ações simuladas.</p>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Insumos</h2>
        <InsumosTable insumos={[insumoStatus, { ...insumoStatus, id: "preparacao", nome: "Massa de pão",
          tipo: "PRODUTO_INTERMEDIARIO", rendimentoQuantidade: 1, rendimentoUnidade: "KG" }]}
          categorias={[]} centrosCusto={[]} fornecedores={[]} todosInsumos={[]} />
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Fornecedores</h2>
        <FornecedoresTable fornecedores={[fornecedorStatus]} canaisPedidoOptions={[]} formasPagamentoOptions={[]} />
      </section>
    </main>
  </ProvedorAcesso>,
);
