import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho=(p:string)=>fileURLToPath(new URL(p,import.meta.url));
export default defineConfig({root:caminho("./"),resolve:{alias:[
  {find:"./actions",replacement:caminho("./faturas-acoes.ts")},
  {find:"next/navigation",replacement:caminho("./navegacao-simulada.tsx")},
  {find:"next/link",replacement:caminho("./navegacao-simulada.tsx")},
  {find:"@/app/(protegido)/fornecedores/actions",replacement:caminho("./faturas-acoes.ts")},
  {find:"@",replacement:caminho("../../src")},
]},css:{postcss:caminho("../../")},server:{host:"127.0.0.1",port:4235,strictPort:true}});
