import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

const raiz = resolve(__dirname, "../..");
const porta = Number(process.env.FISCAL_PEDIDO_VISUAL_PORT ?? "4258");
if (![4258, 4458].includes(porta)) throw new Error("Porta da prévia sintética fora do contrato local.");
if (process.argv.some(a => a.startsWith("-u") || a.startsWith("--update") || a === "--ignore-snapshots")) throw new Error("Esta suíte registra evidências consultivas; não atualiza referências.");
export default defineConfig({
  testDir: __dirname,
  testMatch: "pedido-emissao.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 30_000,
  outputDir: resolve(raiz, ".tmp/emissao-direta-fiscal-20261021/visual/resultados"),
  reporter: [["list"], ["json", { outputFile: resolve(raiz, ".tmp/emissao-direta-fiscal-20261021/visual/resultados.json") }]],
  use: { browserName: "chromium", baseURL: `http://127.0.0.1:${porta}`, locale: "pt-BR", timezoneId: "America/Sao_Paulo", deviceScaleFactor: 1, reducedMotion: "reduce", serviceWorkers: "block", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [320, 390, 768, 1440].flatMap(largura => ["claro", "escuro"].map(tema => ({ name: `pedido-${largura}-${tema}`, metadata: { largura, tema }, use: { viewport: { width: largura, height: 900 }, colorScheme: tema === "escuro" ? "dark" as const : "light" as const } }))),
  webServer: { command: `"${process.execPath}" --experimental-strip-types testes/visual/iniciar-pedido-detalhe.mjs`, cwd: raiz, url: `http://127.0.0.1:${porta}/pedido-detalhe.html`, reuseExistingServer: true, timeout: 90_000, stdout: "ignore", stderr: "pipe" },
});
