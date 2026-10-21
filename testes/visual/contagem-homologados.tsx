import { createRoot } from "react-dom/client";
import { ContagemForm } from "@/app/(protegido)/inventario/contagem/[id]/contagem-form";
import { contagemTeste } from "../inventario/dados";
import "@/app/globals.css";
const itens = contagemTeste.itens.map((i, indice) => ({ ...i, marcas: indice === 0 ? ["Zeta", "Alfa"] : ["Beta"], fornecedores: indice === 0 ? ["Zeta principal", "Alfa homologado"] : i.fornecedores }));
createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-6xl space-y-4 p-6"><p>Prévia isolada — dados fictícios, sem alterações de estoque.</p><ContagemForm contagem={{ ...contagemTeste, itens }} /></main>);
