import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

export default defineConfig({
  testDir: __dirname, testMatch: "perdas-motivos.spec.ts", workers: 1, retries: 0, timeout: 30000,
  outputDir: resolve(__dirname, "../../.tmp/dashboard-operacao-20261020/perdas/playwright"),
  reporter: [["list"], ["json", { outputFile: resolve(__dirname, "../../.tmp/dashboard-operacao-20261020/perdas/resultados.json") }]],
  use: { browserName: "chromium", baseURL: "http://127.0.0.1:4463", locale: "pt-BR", timezoneId: "America/Sao_Paulo", reducedMotion: "reduce", screenshot: "only-on-failure" },
});
