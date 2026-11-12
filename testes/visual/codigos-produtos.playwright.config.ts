import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import base from "./playwright.config";
const raiz = resolve(__dirname, "../..");
export default defineConfig({
  ...base,
  testMatch: ["codigos-produtos.spec.ts"],
  projects: base.projects?.filter(p => !p.metadata?.toque),
  outputDir: resolve(raiz, ".tmp/codigos-produtos-ui/visual"),
  reporter: [["list"], ["json", { outputFile: resolve(raiz, ".tmp/codigos-produtos-ui/visual.json") }]],
  use: { ...base.use, ...(process.env.GRAZING_VISUAL_CHROME_LOCAL === "1" ? { channel: "chrome" } : {}), baseURL: "http://127.0.0.1:4277" },
  webServer: {
    command: `"${process.execPath}" "${resolve(raiz, "node_modules/vite/bin/vite.js")}" --config testes/visual/codigos-produtos.vite.config.mts`,
    cwd: raiz, url: "http://127.0.0.1:4277/vendas.html", reuseExistingServer: false,
    timeout: 90000, stdout: "ignore", stderr: "pipe",
  },
});
