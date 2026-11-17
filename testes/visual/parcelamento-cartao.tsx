import { createRoot } from "react-dom/client";
import { useState } from "react";
import { ParcelasNota, type DuplicataLinha } from "@/app/(protegido)/notas-fiscais/parcelas-nota";
import "@/app/globals.css";

const cartoes = [{ id: "cartao", nome: "Cartão de exemplo", contaBancariaId: "conta", contaBancariaNome: "Conta de exemplo", diaFechamento: 8, diaVencimento: 15, ativo: true }];
function Previa() {
  const [parcelas, setParcelas] = useState<DuplicataLinha[]>([{ id: "parcela", numero: "001", valor: "149.52", formaPagamento: "CARTAO", cartaoCreditoId: "cartao", dataCompra: "2026-09-25", parcelaCartao: 4, dataVencimento: "2027-01-15" }]);
  return <main className="mx-auto max-w-5xl space-y-4 p-4">
    <h1 className="text-xl font-semibold">Parcelamento de uma nota fiscal</h1>
    <p className="text-sm text-muted-foreground">Prévia com dados fictícios. As alterações ficam apenas nesta tela.</p>
    <ParcelasNota parcelas={parcelas} cartoes={cartoes} dataEmissao="2026-09-28" bloqueado={false} onChange={setParcelas} />
  </main>;
}
createRoot(document.getElementById("root")!).render(<Previa />);
