import { defineConfig } from "vite";import {fileURLToPath} from "node:url";
const caminho=(p:string)=>fileURLToPath(new URL(p,import.meta.url));
export default defineConfig({root:caminho("./"),resolve:{alias:[{find:"./cartoes-actions",replacement:caminho("./pagamentos-acoes.ts")},{find:"./importar-chave",replacement:caminho("./pagamentos-acoes.ts")},{find:"next/navigation",replacement:caminho("./navegacao-simulada.tsx")},{find:"@",replacement:caminho("../../src")}]},css:{postcss:caminho("../../")},server:{host:"127.0.0.1",port:4202,strictPort:true}});
