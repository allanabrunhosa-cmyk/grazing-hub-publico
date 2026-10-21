import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

const raiz = resolve(__dirname, "../..");
export default defineConfig({
  testDir: __dirname,
  testMatch: "validades-quantidade.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 30_000,
  outputDir: resolve(raiz, ".tmp/dashboard-operacao-20261020/validades/resultados"),
  reporter: [["list"], ["json", { outputFile: resolve(raiz, ".tmp/dashboard-operacao-20261020/validades/playwright.json") }]],
  use: { browserName: "chromium", baseURL: "http://127.0.0.1:4279", locale: "pt-BR", timezoneId: "America/Sao_Paulo", deviceScaleFactor: 1, reducedMotion: "reduce", serviceWorkers: "block", screenshot: "only-on-failure" },
  projects: [320, 390, 768, 1440].flatMap(largura => ["claro", "escuro"].map(tema => ({ name: `validades-${largura}-${tema}`, metadata: { largura, tema }, use: { viewport: { width: largura, height: 900 }, colorScheme: tema === "escuro" ? "dark" as const : "light" as const } }))),
  webServer: { command: `"${process.execPath}" node_modules/vite/bin/vite.js --config testes/visual/etiquetas.vite.config.mts --port 4279`, cwd: raiz, url: "http://127.0.0.1:4279/etiquetas.html", reuseExistingServer: false, timeout: 90_000, stdout: "ignore", stderr: "pipe" },
});
