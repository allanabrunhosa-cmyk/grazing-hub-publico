import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

// Playwright carrega .ts como CommonJS neste projeto sem type=module.
const raiz = resolve(__dirname, "../..");
const saida = resolve(raiz, ".tmp/qualidade-visual-automatizada");
const suite = process.env.GRAZING_SUITE_VISUAL ?? "contratos";
if (!["contratos", "referencias"].includes(suite)) throw new Error("Suíte visual desconhecida.");
if (process.argv.some(argumento => argumento.startsWith("-u") || argumento.startsWith("--update") || argumento === "--ignore-snapshots" || argumento === "--pass-with-no-tests")) throw new Error("Atualizar/ignorar referências ou aceitar ausência de testes não é permitido; use a revisão explícita dos candidatos.");
const temas = ["claro", "escuro"] as const;
const contextos = [
  ...[320, 390, 768, 1440].map(largura => ({ largura, toque: false })),
  ...[320, 390].map(largura => ({ largura, toque: true })),
];

export default defineConfig({
  testDir: __dirname,
  testMatch: suite === "referencias" ? ["referencias.spec.ts"] : ["contratos/*.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 30_000,
  globalTimeout: 10 * 60_000,
  expect: { timeout: 5_000 },
  outputDir: resolve(saida, suite, "resultados"),
  reporter: [["list"], ["html", { outputFolder: resolve(saida, suite, "relatorio"), open: "never" }], ["json", { outputFile: resolve(saida, suite, "relatorio/resultados.json") }]],
  updateSnapshots: "none",
  snapshotPathTemplate: "{testDir}/../../docs/design-system/referencias-visuais/{arg}{ext}",
  use: {
    browserName: "chromium",
    baseURL: "http://127.0.0.1:4238",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: contextos.flatMap(({ largura, toque }) => temas.map(tema => ({
    name: `chromium-${largura}-${tema}-${toque ? "toque" : "fino"}`,
    metadata: { largura, tema, toque },
    use: {
      viewport: { width: largura, height: 900 },
      colorScheme: tema === "escuro" ? "dark" as const : "light" as const,
      hasTouch: toque,
      isMobile: toque,
    },
  }))),
  webServer: {
    command: '"' + process.execPath + '" --experimental-strip-types testes/visual/iniciar-qualidade.mjs',
    cwd: raiz,
    url: "http://127.0.0.1:4238/qualidade.html",
    reuseExistingServer: false,
    timeout: 90_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
