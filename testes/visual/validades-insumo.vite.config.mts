import {defineConfig} from "vite";
import {fileURLToPath} from "node:url";
const caminho=(p:string)=>fileURLToPath(new URL(p,import.meta.url));
export default defineConfig({root:caminho("./"),cacheDir:caminho("../../.tmp/vite-validades-insumo"),optimizeDeps:{entries:["validades-insumo.html"]},resolve:{alias:[
 {find:"@/app/(protegido)/producao/etiquetas/actions",replacement:caminho("./validades-insumo-acoes.ts")},
 {find:"next/navigation",replacement:caminho("./navegacao-simulada.tsx")},
 {find:"@",replacement:caminho("../../src")}
]},css:{postcss:caminho("../../")},server:{host:"127.0.0.1",port:4253,strictPort:true}});
