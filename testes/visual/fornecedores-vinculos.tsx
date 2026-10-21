import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { FornecedoresTable } from "@/app/(protegido)/fornecedores/fornecedores-table";
import type { FornecedorRow } from "@/app/(protegido)/fornecedores/types";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { Button } from "@/components/ui/button";
import "@/app/globals.css";

const insumos = [
  { id: "queijo", nome: "Queijo brie", especificacao: "Peça de 1 kg" },
  { id: "farinha", nome: "Farinha de trigo", especificacao: "Tipo 1, força W300" },
];
const fornecedor: FornecedorRow = {
  id: "fornecedor-ficticio", tipoCadastro: "FORNECEDOR", nome: "Distribuidora Exemplo", razaoSocial: "Comércio fictício de alimentos",
  cnpj: null, cpf: null, contatoNome: "Equipe de atendimento", email: "contato@example.com", telefone: null, site: null,
  prazoPagamentoDias: 14, prazoEntregaDias: 2, observacoes: "Fornecedor fictício para revisão visual dos vínculos.",
  ativo: true, createdAt: new Date("2026-01-01T12:00:00Z"), updatedAt: new Date("2026-01-01T12:00:00Z"),
  canaisPedido: [{ id: "canal", nome: "E-mail" }], formasPagamento: [{ id: "forma", nome: "Boleto" }],
  insumosVinculados: insumos,
};

function PreviaVinculos() {
  const [queijoAtivo, definirQueijoAtivo] = useState(true);
  const [vazio, definirVazio] = useState(false);
  const vinculados = vazio ? [] : queijoAtivo ? insumos : [insumos[1]];

  return <ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}>
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Insumos vinculados aos fornecedores</h1>
        <p className="text-sm text-muted-foreground">Prévia com dados fictícios e ações simuladas. Abra os detalhes ou a edição para conferir os insumos ativos.</p>
      </div>
      <section aria-label="Controles da simulação" className="space-y-3 rounded-lg border bg-muted/30 p-4">
        <p className="text-sm font-medium">Simulação: {vinculados.length} insumo(s) ativo(s) vinculado(s)</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={!queijoAtivo || vazio} onClick={() => definirQueijoAtivo(false)}>Simular retirada do queijo</Button>
          <Button type="button" variant="outline" disabled={queijoAtivo && !vazio} onClick={() => { definirQueijoAtivo(true); definirVazio(false); }}>Simular reativação do queijo</Button>
          <Button type="button" variant="outline" disabled={vazio} onClick={() => definirVazio(true)}>Simular nenhum insumo ativo</Button>
        </div>
      </section>
      <FornecedoresTable fornecedores={[{ ...fornecedor, insumosVinculados: vinculados }]}
        canaisPedidoOptions={fornecedor.canaisPedido} formasPagamentoOptions={fornecedor.formasPagamento} />
      <Toaster />
    </main>
  </ProvedorAcesso>;
}

createRoot(document.getElementById("root")!).render(<PreviaVinculos />);
