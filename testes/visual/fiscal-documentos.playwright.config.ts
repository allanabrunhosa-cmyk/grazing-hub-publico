import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import base from "./playwright.config";

const raiz = resolve(__dirname, "../..");
export default defineConfig({
  ...base,
  testMatch: ["fiscal-documentos.spec.ts"],
  outputDir: resolve(raiz, ".tmp/fiscal-dashboard-documentos-datas-20261113/visual/resultados"),
  reporter: [["list"], ["json", { outputFile: resolve(raiz, ".tmp/fiscal-dashboard-documentos-datas-20261113/visual/resultados.json") }]],
  use: { ...base.use, ...(process.env.GRAZING_VISUAL_CHROME_LOCAL === "1" ? { channel: "chrome" } : {}), baseURL: "http://127.0.0.1:4448" },
  webServer: {
    command: '"' + process.execPath + '" "' + resolve(raiz, "node_modules/vite/bin/vite.js") + '" --config testes/visual/fiscal-documentos.vite.config.mts',
    cwd: raiz, url: "http://127.0.0.1:4448/fiscal-dashboard.html", reuseExistingServer: false,
    timeout: 90_000, stdout: "ignore", stderr: "pipe",
  },
});
