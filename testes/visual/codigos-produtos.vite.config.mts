import base from "./vendas.vite.config.mjs";
import { fileURLToPath } from "node:url";
const p = (s: string) => fileURLToPath(new URL(s, import.meta.url));
const aliases = Array.isArray(base.resolve?.alias) ? base.resolve.alias : [];
const configuracao = {
  ...base,
  cacheDir: p("../../.tmp/codigos-produtos-ui/vite"),
  resolve: { ...base.resolve, alias: [
    { find: /^(?:.*\/)?simples-actions$/, replacement: p("./fiscal-unificado-simples-acoes.ts") },
    { find: /^(\.\.?\/)+manutencao-actions$/, replacement: p("./fiscal-unificado-acoes.ts") },
    { find: /^(\.\.\/)+estrutura-actions$/, replacement: p("./estrutura-fiscal-acoes.ts") },
    ...aliases,
  ] },
  server: { host: "127.0.0.1", port: 4277, strictPort: true },
};
export default configuracao;
