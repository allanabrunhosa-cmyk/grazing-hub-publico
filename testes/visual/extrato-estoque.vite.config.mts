import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import configuracao from "./vite.config.mjs";
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  ...configuracao,
  resolve: { alias: [
    { find: "@/app/(protegido)/inventario/entrada-avulsa/actions", replacement: caminho("./entrada-avulsa-acoes.ts") },
    ...configuracao.resolve!.alias as { find: string; replacement: string }[],
  ] },
  server: { host: "127.0.0.1", port: 4197, strictPort: true },
});
