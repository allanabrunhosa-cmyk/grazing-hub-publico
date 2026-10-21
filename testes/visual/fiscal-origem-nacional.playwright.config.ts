import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

export default defineConfig({
  testDir: __dirname, testMatch: ["fiscal-origem-nacional.spec.ts", "fiscal-fci-fornecedor.spec.ts"], workers: 1, retries: 0,
  outputDir: resolve(__dirname, "../../.tmp/sem-gtin-modelos-20261021/visual/resultados"),
  use: { browserName: "chromium", baseURL: "http://127.0.0.1:4461", locale: "pt-BR", timezoneId: "America/Sao_Paulo", reducedMotion: "reduce", serviceWorkers: "block", trace: "retain-on-failure" },
  projects: [320, 390, 768, 1440].flatMap(largura => ["claro", "escuro"].map(tema => ({ name: `origem-${largura}-${tema}`, metadata: { largura, tema }, use: { viewport: { width: largura, height: 1000 }, colorScheme: tema === "escuro" ? "dark" as const : "light" as const } }))),
  webServer: { command: `"${process.execPath}" node_modules/vite/bin/vite.js --config testes/visual/estrutura-fiscal.vite.config.mts`, cwd: resolve(__dirname, "../.."), url: "http://127.0.0.1:4461/estrutura-fiscal.html", reuseExistingServer: true },
});
