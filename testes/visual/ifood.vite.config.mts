import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const caminho=(p:string)=>fileURLToPath(new URL(p,import.meta.url));
export default defineConfig({root:caminho("./"),cacheDir:caminho("../../.cache/ifood-vite"),optimizeDeps:{entries:["ifood.html"]},resolve:{alias:[
{find:/^\.\/actions$/,replacement:caminho("./ifood-acoes.ts")},
{find:"next/navigation",replacement:caminho("./gestor-navegacao.tsx")},
{find:"next/link",replacement:caminho("./navegacao-simulada.tsx")},
{find:"@",replacement:caminho("../../src")}
]},css:{postcss:caminho("../../")},server:{host:"127.0.0.1",port:4256,strictPort:true}});
