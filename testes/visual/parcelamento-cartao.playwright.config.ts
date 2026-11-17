import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
const raiz = resolve(__dirname, "../..");
const deps = process.env.GRAZING_DEPENDENCIAS_TESTE ?? resolve(raiz, "node_modules");
export default defineConfig({
  testDir: __dirname, testMatch: "parcelamento-cartao.spec.ts", workers: 1,
  outputDir: resolve(raiz, ".tmp/parcelamento-cartao/contratos"),
  use: { baseURL: "http://127.0.0.1:4285", ...(process.env.GRAZING_VISUAL_CHROME_LOCAL === "1" ? { channel: "chrome" } : {}) },
  webServer: { command: `"${process.execPath}" "${resolve(deps, "vite/bin/vite.js")}" --config testes/visual/parcelamento-cartao.vite.config.mts`, cwd: raiz, url: "http://127.0.0.1:4285/parcelamento-cartao.html", reuseExistingServer: false, timeout: 90000 },
});
