import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
export default defineConfig({ testDir: __dirname, testMatch: "bi-vendas.spec.ts", workers: 1, retries: 0, timeout: 30000,
  outputDir: resolve(__dirname, "../../.tmp/bi-vendas/playwright"), reporter: [["list"], ["json", { outputFile: resolve(__dirname, "../../.tmp/bi-vendas/resultados.json") }]],
  use: { browserName: "chromium", baseURL: "http://127.0.0.1:4452", locale: "pt-BR", timezoneId: "America/Sao_Paulo", deviceScaleFactor: 1, reducedMotion: "reduce", screenshot: "only-on-failure", trace: "retain-on-failure" },
});
