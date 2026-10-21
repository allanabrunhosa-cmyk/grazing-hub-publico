import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Toaster } from "sonner";
import "@/app/globals.css";
import { AcaoBarra } from "@/app/(protegido)/financeiro/manifesto-nfs/manifesto-nfs-view";
import { ImportarMunicipalDialog } from "@/app/(protegido)/financeiro/manifesto-nfs/importar-municipal-dialog";
// Prévia isolada: nenhuma chamada fiscal ou alteração no banco.
window.fetch = async () => Response.json({ erro: "Prévia: confira o código de verificação informado." }, { status: 400 });
function App() {
  const [aberto, setAberto] = useState(true);
  return <main className="mx-auto max-w-6xl space-y-6 p-6"><h1 className="text-2xl font-semibold">Manifesto de NFS</h1><AcaoBarra podeBuscar /><ImportarMunicipalDialog aberto={aberto} aoFechar={() => setAberto(false)} /><Toaster /></main>;
}
createRoot(document.getElementById("root")!).render(<App />);
