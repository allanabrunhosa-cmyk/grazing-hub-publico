import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
const raiz = resolve(__dirname, "../..");
if (process.argv.some(a => a.startsWith("-u") || a.startsWith("--update") || a === "--ignore-snapshots")) throw new Error("Capturas consultivas; não alterar referências.");
export default defineConfig({
  testDir: __dirname, testMatch: "fiscal-dashboard-operacao.spec.ts", workers: 1, retries: 0, timeout: 30_000,
  outputDir: resolve(raiz, ".tmp/fiscal-layout-20261016/visual/resultados"), reporter: [["list"], ["json", { outputFile: resolve(raiz, ".tmp/fiscal-layout-20261016/visual/resultados.json") }]],
  use: { browserName: "chromium", baseURL: "http://127.0.0.1:4448", locale: "pt-BR", timezoneId: "America/Sao_Paulo", deviceScaleFactor: 1, reducedMotion: "reduce", serviceWorkers: "block", trace: "off", screenshot: "only-on-failure" },
  projects: [320, 390, 768, 1440].flatMap(largura => ["claro", "escuro"].map(tema => ({ name: `dashboard-${largura}-${tema}`, metadata: { largura, tema }, use: { viewport: { width: largura, height: 900 }, colorScheme: tema === "escuro" ? "dark" as const : "light" as const } }))),
  webServer: { command: `"${process.execPath}" --experimental-strip-types testes/visual/iniciar-fiscal-dashboard.mjs`, cwd: raiz, url: "http://127.0.0.1:4448/fiscal-dashboard.html", reuseExistingServer: false, timeout: 90_000, stdout: "ignore", stderr: "pipe" },
});
