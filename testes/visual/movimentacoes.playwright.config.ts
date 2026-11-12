import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import base from "./playwright.config";

const raiz = resolve(__dirname, "../..");
export default defineConfig({
  ...base,
  testMatch: ["movimentacoes-busca.spec.ts"],
  outputDir: resolve(raiz, ".tmp/manifesto-movimentacoes-20261111/visual-movimentacoes"),
  reporter: [["list"], ["json", { outputFile: resolve(raiz, ".tmp/manifesto-movimentacoes-20261111/visual-movimentacoes.json") }]],
  use: { ...base.use, ...(process.env.GRAZING_VISUAL_CHROME_LOCAL === "1" ? { channel: "chrome" } : {}), baseURL: "http://127.0.0.1:4389" },
  webServer: {
    command: `"${process.execPath}" "${resolve(raiz, "node_modules/vite/bin/vite.js")}" --config testes/visual/movimentacoes.vite.config.mts`,
    cwd: raiz, url: "http://127.0.0.1:4389/movimentacoes.html", reuseExistingServer: false,
    timeout: 90_000, stdout: "ignore", stderr: "pipe",
  },
});
