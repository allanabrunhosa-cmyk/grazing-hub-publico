import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import base from "./pedido-emissao.playwright.config";
import contextos from "./playwright.config";
const raiz = resolve(__dirname, "../..");
const servidor = base.webServer;
if (!servidor || Array.isArray(servidor)) throw new Error("A prévia de Pedidos exige um único servidor local.");
export default defineConfig({
  ...base, testMatch: "pedido-arquivos.spec.ts", projects: contextos.projects,
  outputDir: resolve(raiz, ".tmp/fiscal-dashboard-documentos-datas-20261113/visual-pedido/resultados"),
  reporter: [["list"], ["json", { outputFile: resolve(raiz, ".tmp/fiscal-dashboard-documentos-datas-20261113/visual-pedido/resultados.json") }]],
  use: { ...base.use, ...(process.env.GRAZING_VISUAL_CHROME_LOCAL === "1" ? { channel: "chrome" } : {}) },
  webServer: { ...servidor, reuseExistingServer: false },
});
