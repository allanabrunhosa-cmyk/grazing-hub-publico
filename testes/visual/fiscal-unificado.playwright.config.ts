import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
export default defineConfig({ testDir: __dirname, testMatch: "fiscal-unificado.spec.ts", workers: 1, retries: 0, timeout: 40000,
  outputDir: resolve(__dirname, "../../.tmp/fiscal-unificado/playwright"),
  use: { browserName: "chromium", baseURL: "http://127.0.0.1:4269", locale: "pt-BR", timezoneId: "America/Sao_Paulo", reducedMotion: "reduce", serviceWorkers: "block", trace: "retain-on-failure" },
  projects: [320, 390, 768, 1440].flatMap(largura => ["claro", "escuro"].map(tema => ({ name: `${largura}-${tema}`, metadata: { largura, tema }, use: { viewport: { width: largura, height: 1000 }, colorScheme: tema === "escuro" ? "dark" as const : "light" as const } }))),
  webServer: { command: `"${process.execPath}" node_modules/vite/bin/vite.js --config testes/visual/fiscal-unificado.vite.config.mts`, cwd: resolve(__dirname, "../.."), url: "http://127.0.0.1:4269/fiscal-unificado.html", reuseExistingServer: true },
});
