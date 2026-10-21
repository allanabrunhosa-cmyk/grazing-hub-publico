import {defineConfig} from "vite";
import {fileURLToPath} from "node:url";
const caminho=(p:string)=>fileURLToPath(new URL(p,import.meta.url));
export default defineConfig({root:caminho('./'),resolve:{alias:[
 {find:'./conciliacao-actions',replacement:caminho('./conciliacao-acoes.ts')},
 {find:'@/app/login/actions',replacement:caminho('./layout-acoes.ts')},
 {find:'next/navigation',replacement:caminho('./conciliacao-navegacao.tsx')},
 {find:'next/link',replacement:caminho('./conciliacao-navegacao.tsx')},
 {find:'@/app/(protegido)/financeiro/lancamentos/actions',replacement:caminho('./acoes-simuladas.ts')},
 {find:'@/app/(protegido)/financeiro/contas/actions',replacement:caminho('./acoes-simuladas.ts')},
 {find:'@/app/(protegido)/fornecedores/actions',replacement:caminho('./acoes-simuladas.ts')},
 {find:'./baixar-nota',replacement:caminho('./baixa-nota-simulada.ts')},
 {find:'@',replacement:caminho('../../src')},
]},css:{postcss:caminho('../../')},server:{host:'127.0.0.1',port:4198,strictPort:true}});
