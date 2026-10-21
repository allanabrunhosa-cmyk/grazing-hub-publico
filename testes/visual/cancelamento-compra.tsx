import { createRoot } from "react-dom/client";
import { ExcluirLancamentoDialog } from "@/app/(protegido)/financeiro/lancamentos/excluir-lancamento-dialog";
import "@/app/globals.css";
createRoot(document.getElementById("root")!).render(<ExcluirLancamentoDialog lancamentoId="compra-ficticia" aoFechar={() => {}} />);
