import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
const saida = resolve(__dirname, "../../.tmp/permissoes-atendimento-20261021");
export default defineConfig({
  testDir: __dirname, testMatch: "permissoes-atendimento.spec.ts", workers: 1, retries: 0, timeout: 30000,
  outputDir: resolve(saida, "resultados"), reporter: [["list"], ["json", { outputFile: resolve(saida, "relatorio.json") }]],
  updateSnapshots: "none",
  use: { browserName: "chromium", baseURL: "http://127.0.0.1:4459", locale: "pt-BR", timezoneId: "America/Sao_Paulo", deviceScaleFactor: 1, reducedMotion: "reduce", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [320, 390, 768, 1440].flatMap(largura => ["claro", "escuro"].map(tema => ({
    name: "chromium-" + largura + "-" + tema,
    metadata: { largura, tema },
    use: { viewport: { width: largura, height: 900 }, colorScheme: tema === "escuro" ? "dark" as const : "light" as const, hasTouch: largura <= 390, isMobile: largura <= 390 },
  }))),
  webServer: {
    command: '"' + process.execPath + '" node_modules/vite/bin/vite.js --config testes/visual/permissoes-atendimento.vite.config.mts',
    cwd: resolve(__dirname, "../.."), url: "http://127.0.0.1:4459/permissoes-atendimento.html", reuseExistingServer: false, timeout: 90000, stdout: "ignore", stderr: "pipe",
  },
});
