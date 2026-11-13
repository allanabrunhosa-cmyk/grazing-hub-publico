import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import base from "./playwright.config";

const raiz = resolve(__dirname, "../..");
export default defineConfig({
  ...base,
  timeout: 60_000,
  testMatch: ["entrada-avulsa.spec.ts"],
  outputDir: resolve(raiz, ".tmp/entrada-avulsa-pagamento/contratos"),
  reporter: [["list"], ["json", { outputFile: resolve(raiz, ".tmp/entrada-avulsa-pagamento/contratos.json") }]],
  use: { ...base.use, ...(process.env.GRAZING_VISUAL_CHROME_LOCAL === "1" ? { channel: "chrome" } : {}), baseURL: "http://127.0.0.1:4187" },
  webServer: {
    command: `"${process.execPath}" "${resolve(raiz, "node_modules/vite/bin/vite.js")}" --config testes/visual/estoque-entradas.vite.config.mts`,
    cwd: raiz, url: "http://127.0.0.1:4187/estoque-entradas.html", reuseExistingServer: false,
    timeout: 90_000, stdout: "ignore", stderr: "pipe",
  },
});
