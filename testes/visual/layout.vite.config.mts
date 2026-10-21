import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import configuracao from "./vite.config.mjs";

const caminho = (nome: string) => fileURLToPath(new URL(nome, import.meta.url));

export default defineConfig({
  ...configuracao,
  resolve: { alias: [
    { find: "next/navigation", replacement: caminho("./layout-navegacao.tsx") },
    { find: "next/link", replacement: caminho("./layout-navegacao.tsx") },
    { find: "@/app/login/actions", replacement: caminho("./layout-acoes.ts") },
    ...configuracao.resolve!.alias as { find: string; replacement: string }[],
  ] },
  server: { host: "127.0.0.1", port: 4174, strictPort: true },
});
