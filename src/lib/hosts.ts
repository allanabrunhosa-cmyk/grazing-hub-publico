/** O proxy precisa preservar Host. Não escolhemos o destino por X-Forwarded-Host. */
export const HOST_ETIQUETAS = "validades.grazinghub.com.br";
export const HOST_ETIQUETAS_LEGADO = "etiquetas.grazinghub.com.br";
export const CAMINHO_ETIQUETAS = "/producao/etiquetas";
export const CAMINHO_CONECTOR_ETIQUETAS = "/api/etiquetas/conector";
export const HOST_PEDIDOS = "pedidos.grazinghub.com.br";
export const HOST_ATENDIMENTO = "atendimento.grazinghub.com.br";
export const CAMINHO_PEDIDOS = "/vendas/pedidos";
export type IdentidadeInterface = "hub" | "etiquetas" | "pedidos";
const HOSTS_PUBLICOS = new Set(["grazinghub.com.br", "www.grazinghub.com.br", HOST_ETIQUETAS, HOST_ETIQUETAS_LEGADO, HOST_PEDIDOS]);

export function contextoDoHost(cabecalhos: Pick<Headers, "get">, producao = process.env.NODE_ENV === "production") {
  const host = cabecalhos.get("host")?.toLowerCase();
  if (!host) return null;
  const publico = HOSTS_PUBLICOS.has(host);
  const local = !producao && /^(localhost|127\.0\.0\.1|validades\.localhost|etiquetas\.localhost|pedidos\.localhost)(:\d{1,5})?$/.test(host);
  if (!publico && !local) return null;
  const encaminhado = cabecalhos.get("x-forwarded-host");
  if (encaminhado && encaminhado.toLowerCase() !== host) return null;
  const hostname = host.split(":")[0];
  const identidade: IdentidadeInterface = [HOST_ETIQUETAS, HOST_ETIQUETAS_LEGADO, "validades.localhost", "etiquetas.localhost"].includes(hostname)
    ? "etiquetas" : hostname === HOST_PEDIDOS || hostname === "pedidos.localhost" ? "pedidos" : "hub";
  return {
    host,
    identidade,
    dedicado: identidade !== "hub",
    origem: `${publico ? "https" : "http"}://${host}`,
  };
}

export function caminhoPublico(caminho: string) {
  return caminho === "/login" || caminho === "/login/recuperar" || caminho === "/login/redefinir" || caminho === "/termos-mapas" || caminho === "/privacidade-mapas";
}

export function recursoEstatico(caminho: string) {
  return caminho.startsWith("/_next/static/") || caminho === "/_next/image" ||
    caminho.startsWith("/browser-print/") || caminho.startsWith("/marca/") || caminho === "/logo-etiquetas.png" ||
    ["/favicon.ico", "/icon", "/window.svg", "/vercel.svg", "/next.svg", "/globe.svg", "/file.svg"].includes(caminho);
}

export function caminhoDedicadoPermitido(caminho: string, identidade: IdentidadeInterface = "etiquetas") {
  if (caminho === "/" || caminho === "/sem-acesso" || caminhoPublico(caminho)) return true;
  if (identidade === "etiquetas") return caminho === CAMINHO_ETIQUETAS
    || caminho.startsWith(`${CAMINHO_CONECTOR_ETIQUETAS}/`)
    || /^\/api\/etiquetas\/produtos\/[a-zA-Z0-9_-]{1,100}\/foto$/.test(caminho);
  if (identidade !== "pedidos") return false;
  if (caminho === "/api/vendas/clientes/identidade") return true;
  if (/^\/api\/vendas\/fotos\/[a-zA-Z0-9_-]{1,100}$/.test(caminho)) return true;
  if (/^\/api\/fiscal-saida\/[a-zA-Z0-9_-]{1,100}\/arquivo$/.test(caminho)) return true;
  if ([CAMINHO_PEDIDOS, `${CAMINHO_PEDIDOS}/novo`, `${CAMINHO_PEDIDOS}/gestao`, `${CAMINHO_PEDIDOS}/prontidao`].includes(caminho)) return true;
  // Somente as páginas de um pedido, sem admitir submódulos pela regra genérica de IDs.
  const segmentos = caminho.slice(`${CAMINHO_PEDIDOS}/`.length).split("/");
  if (!caminho.startsWith(`${CAMINHO_PEDIDOS}/`) || !segmentos[0] ||
      ["producao", "calendario", "gestao", "prontidao", "novo"].includes(segmentos[0])) return false;
  return segmentos.length === 1 || (segmentos.length === 2 && ["operacao", "comanda"].includes(segmentos[1]));
}
