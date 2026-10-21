import { defineConfig, mergeConfig, type ViteDevServer } from "vite";
import { fileURLToPath } from "node:url";
import configuracaoBase from "./vite.config.mjs";

const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));
const fotoFicticia = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800" viewBox="0 0 640 800"><rect width="640" height="800" fill="#f1eee7"/><ellipse cx="327" cy="573" rx="220" ry="57" fill="#d5d2c8"/><g transform="rotate(-24 315 410)"><rect x="186" y="152" width="149" height="420" rx="74" fill="#346c41"/><path d="M224 179 Q217 357 229 529" fill="none" stroke="#719668" stroke-width="18" opacity=".7"/><rect x="239" y="127" width="43" height="57" rx="10" fill="#5a7343"/></g><g transform="rotate(27 372 447)"><rect x="310" y="255" width="138" height="352" rx="69" fill="#417b48"/><path d="M350 283 Q342 431 354 567" fill="none" stroke="#88a779" stroke-width="15" opacity=".6"/><rect x="359" y="232" width="40" height="54" rx="9" fill="#617d49"/></g></svg>`;

export default defineConfig(mergeConfig(configuracaoBase, {
  cacheDir: caminho("../../node_modules/.cache/vite-insumos-cadastro"),
  optimizeDeps: { entries: ["insumos-cadastro.html"] },
  resolve: { alias: [{ find: "@/app/(protegido)/insumos/actions", replacement: caminho("./conversoes-acoes.ts") }] },
  plugins: [{
    name: "insumos-cadastro-fontes-isoladas",
    enforce: "pre",
    transform(fonte: string, id: string) {
      if (!id.replaceAll("\\", "/").endsWith("/src/app/globals.css")) return;
      return fonte.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);')
        .replace('@import "shadcn/tailwind.css";', '@import "shadcn/tailwind.css";\n@source "../components";\n@source "./(protegido)/insumos";\n@source "./(protegido)/fornecedores";\n@source "../../testes/visual/insumos-cadastro.tsx";');
    },
    configureServer(servidor: ViteDevServer) {
      servidor.middlewares.use((requisicao, resposta, proxima) => {
        if (!requisicao.url?.startsWith("/api/insumos/abobrinha-ficticia/foto")) return proxima();
        resposta.setHeader("Content-Type", "image/svg+xml");
        resposta.end(fotoFicticia);
      });
    },
  }],
  server: { host: "127.0.0.1", port: 4201, strictPort: true },
}));
