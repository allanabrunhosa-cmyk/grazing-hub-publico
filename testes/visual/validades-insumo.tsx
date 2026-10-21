import {createRoot} from "react-dom/client";
import {ProvedorAcesso} from "@/components/layout/acesso-contexto";
import {ValidadesInsumo} from "@/app/(protegido)/insumos/validades-insumo";
import {insumoStatus} from "../cadastros/dados";
import "@/app/globals.css";
const params=new URLSearchParams(location.search);if(params.has("escuro"))document.documentElement.classList.add("dark");
createRoot(document.getElementById("root")!).render(<ProvedorAcesso acesso={{admin:false,permissoes:{insumos:["visualizar"],"producao.validades":params.has("leitor")?["visualizar"]:["visualizar","editar"]},excecoes:{}}}>
 <main className="mx-auto max-w-3xl space-y-4 p-4"><h1 className="text-xl font-semibold">Validades do insumo fictício</h1><p className="text-sm text-muted-foreground">Perfil de Produção. Dados e salvamento simulados.</p><ValidadesInsumo insumo={{...insumoStatus,etiquetaHabilitada:true,validadeSecoDias:1,validadeRefrigeradoDias:3,validadeCongeladoDias:30}}/></main>
</ProvedorAcesso>);
