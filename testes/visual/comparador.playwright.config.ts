import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import base from "./playwright.config";

const saida = resolve(__dirname, "../../.tmp/qualidade-visual-automatizada/comparador");
export default defineConfig({
  ...base,
  testMatch: ["comparador.prova.spec.ts"],
  projects: base.projects?.filter(p => ["chromium-1440-claro-fino", "chromium-320-escuro-toque"].includes(p.name ?? "")),
  outputDir: resolve(saida, "resultados"),
  snapshotPathTemplate: "{testDir}/../../.tmp/qualidade-visual-automatizada/comparador/esperados/{projectName}/{arg}{ext}",
  reporter: [["list"], ["html", { outputFolder: resolve(saida, "relatorio"), open: "never" }], ["json", { outputFile: resolve(saida, "relatorio/resultados.json") }]],
  updateSnapshots: "none",
});
