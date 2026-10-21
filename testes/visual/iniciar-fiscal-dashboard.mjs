import { createServer } from "vite";
import configuracao from "./fiscal-dashboard.vite.config.mts";
const servidor = await createServer({ ...configuracao, configFile: false });
await servidor.listen();
let encerrando = false;
async function encerrar() { if (encerrando) return; encerrando = true; await servidor.close(); process.exit(0); }
process.once("SIGINT", encerrar);
process.once("SIGTERM", encerrar);
