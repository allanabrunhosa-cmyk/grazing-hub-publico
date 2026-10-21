import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import base from "./playwright.config";
const raiz = resolve(__dirname, "../..");
export default defineConfig({
  ...base, testMatch: ["complementos.spec.ts"],
  outputDir: resolve(raiz, ".tmp/complementos/contratos"),
  reporter: [["list"], ["json", { outputFile: resolve(raiz, ".tmp/complementos/contratos.json") }]],
  use: { ...base.use, baseURL: "http://127.0.0.1:4269" },
  webServer: {
    command: `"${process.execPath}" "${resolve(raiz, "node_modules/vite/bin/vite.js")}" --config testes/visual/complementos.vite.config.mts`,
    cwd: raiz, url: "http://127.0.0.1:4269/vendas.html", reuseExistingServer: false,
    timeout: 90000, stdout: "ignore", stderr: "pipe",
  },
});
