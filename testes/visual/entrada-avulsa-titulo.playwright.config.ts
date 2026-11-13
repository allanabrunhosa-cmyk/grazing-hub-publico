import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import base from "./playwright.config";

const raiz = resolve(__dirname, "../..");
const saida = resolve(raiz, ".tmp/entrada-avulsa-titulo-20261113");
export default defineConfig({
  ...base, testMatch: ["entrada-avulsa-titulo.spec.ts"], outputDir: resolve(saida, "visual"),
  reporter: [["list"], ["json", { outputFile: resolve(saida, "visual.json") }]],
  use: { ...base.use, ...(process.env.GRAZING_VISUAL_CHROME_LOCAL === "1" ? { channel: "chrome" } : {}), baseURL: "http://127.0.0.1:4235" },
  webServer: {
    command: `"${process.execPath}" "${resolve(raiz, "node_modules/vite/bin/vite.js")}" --config testes/visual/faturas.vite.config.mts`,
    cwd: raiz, url: "http://127.0.0.1:4235/faturas.html", reuseExistingServer: false,
    timeout: 90_000, stdout: "ignore", stderr: "pipe",
  },
});
