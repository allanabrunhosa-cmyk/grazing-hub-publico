import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import configuracao from "./layout.vite.config.mjs";
export default defineConfig({ ...configuracao,
  optimizeDeps: { entries: ["compras.html", "status-notas.html"] },
  resolve: { alias: [{ find: "@/app/(protegido)/compras/reagendar-pedido", replacement: fileURLToPath(new URL("./compras-acoes-simuladas.ts", import.meta.url)) }, { find: "@/app/(protegido)/compras/actions", replacement: fileURLToPath(new URL("./compras-acoes-simuladas.ts", import.meta.url)) }, ...configuracao.resolve!.alias as { find: string; replacement: string }[]] },
  server: { host: "127.0.0.1", port: 4175, strictPort: true },
});
