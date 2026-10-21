import {defineConfig} from "vite";
import {fileURLToPath} from "node:url";
const caminho=(p:string)=>fileURLToPath(new URL(p,import.meta.url));
export default defineConfig({root:caminho("./"),publicDir:caminho("../../public"),cacheDir:caminho("../../.tmp/historico-preview/vite-cache"),optimizeDeps:{entries:["historico-pedido.html"]},plugins:[{name:"historico-fontes-isoladas",enforce:"pre",transform(fonte,id){
 if(!id.replaceAll("\\","/").endsWith("/src/app/globals.css"))return;
 return fonte.replace('@import "tailwindcss";','@import "tailwindcss" source(none);').replace('@import "shadcn/tailwind.css";','@import "shadcn/tailwind.css";\n@source "../components";\n@source "./(protegido)/vendas/pedidos";\n@source "../../testes/visual/historico-pedido.tsx";');
}}],resolve:{alias:[{find:"next/navigation",replacement:caminho("./gestor-navegacao.tsx")},{find:"@",replacement:caminho("../../src")}]},css:{postcss:caminho("../../")},server:{host:"127.0.0.1",port:4261,strictPort:true}});
