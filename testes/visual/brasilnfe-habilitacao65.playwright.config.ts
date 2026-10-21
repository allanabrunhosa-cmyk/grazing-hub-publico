import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
const raiz = resolve(__dirname, "../..");
export default defineConfig({
  testDir: __dirname, testMatch: "brasilnfe-habilitacao65.spec.ts", workers: 1, retries: 0,
  outputDir: resolve(__dirname, "../../.tmp/fiscal-manual65-ui/resultados"),
  use: { browserName: "chromium", baseURL: "http://127.0.0.1:4496", locale: "pt-BR", timezoneId: "America/Sao_Paulo", reducedMotion: "reduce", serviceWorkers: "block", trace: "retain-on-failure" },
  projects: [320, 390, 768, 1440].flatMap(largura => ["claro", "escuro"].map(tema => ({ name: `habilitacao65-${largura}-${tema}`, metadata: { largura, tema }, use: { viewport: { width: largura, height: 1000 }, colorScheme: tema === "escuro" ? "dark" as const : "light" as const } }))),
  webServer: { command: `"${process.execPath}" node_modules/vite/bin/vite.js --config testes/visual/brasilnfe-habilitacao65.vite.config.mts`, cwd: raiz, url: "http://127.0.0.1:4496/brasilnfe.html", reuseExistingServer: false },
});
