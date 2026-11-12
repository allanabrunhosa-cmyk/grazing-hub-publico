import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import base from "./playwright.config";

const raiz = resolve(__dirname, "../..");
export default defineConfig({
  ...base,
  testMatch: ["manifestacao-nf.spec.ts"],
  outputDir: resolve(raiz, ".tmp/manifestacao-nf/contratos"),
  reporter: [["list"], ["json", { outputFile: resolve(raiz, ".tmp/manifestacao-nf/contratos.json") }]],
  use: { ...base.use, ...(process.env.GRAZING_VISUAL_CHROME_LOCAL === "1" ? { channel: "chrome" } : {}), baseURL: "http://127.0.0.1:4278" },
  webServer: {
    command: `"${process.execPath}" "${resolve(raiz, "node_modules/vite/bin/vite.js")}" --config testes/visual/manifestacao-nf.vite.config.mts`,
    cwd: raiz, url: "http://127.0.0.1:4278/manifestacao-nf.html", reuseExistingServer: false,
    timeout: 90_000, stdout: "ignore", stderr: "pipe",
  },
});
