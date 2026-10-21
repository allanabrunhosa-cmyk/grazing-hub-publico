import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const [suite, ...args] = process.argv.slice(2);
if (!["contratos", "referencias", "comparador"].includes(suite) || args.some(a => a === "-u" || a.startsWith("--update") || a.startsWith("--config") || a === "--ignore-snapshots" || a === "--pass-with-no-tests")) throw new Error("Uso: executar-visual.mjs contratos|referencias|comparador [--project=...]. Atualizar/ignorar screenshots ou aceitar ausência de testes é proibido.");
const arquivo = suite === "contratos" ? "testes/visual/contratos" : suite === "referencias" ? "testes/visual/referencias.spec.ts" : "testes/visual/comparador.prova.spec.ts";
const config = suite === "comparador" ? "testes/visual/comparador.playwright.config.ts" : "testes/visual/playwright.config.ts";
const r = spawnSync(process.execPath, [resolve("node_modules/@playwright/test/cli.js"), "test", arquivo, `--config=${config}`, ...args], { stdio: "inherit", env: { ...process.env, GRAZING_SUITE_VISUAL: suite === "comparador" ? "contratos" : suite } });
if (r.error) throw r.error;
process.exitCode = r.status ?? 1;
