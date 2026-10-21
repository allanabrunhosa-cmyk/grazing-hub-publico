import { createServer } from "vite";
import configuracao from "./qualidade.vite.config.mts";

// Importação nativa com Node 22/strip-types: não gera config em node_modules.
const servidor = await createServer({ ...configuracao, configFile: false });
await servidor.listen();
servidor.printUrls();
let encerrando = false;
async function encerrar() {
  if (encerrando) return;
  encerrando = true;
  await servidor.close();
  process.exit(0);
}
process.once("SIGINT", encerrar);
process.once("SIGTERM", encerrar);
