import base from "./vendas.vite.config.mjs";
import { fileURLToPath } from "node:url";
const configuracao = { ...base, cacheDir: fileURLToPath(new URL("../../.tmp/complementos/vite-contratos", import.meta.url)), server: { host: "127.0.0.1", port: 4269, strictPort: true } };
export default configuracao;
