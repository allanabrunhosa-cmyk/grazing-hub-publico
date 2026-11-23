import "server-only";
import { ErroSite, METAS_DATA_PADRAO, METAS_JANELA_PADRAO } from "./adaptador";

export class FalhaHttpSite extends ErroSite {
  constructor(public status: number) {
    super(status === 401 || status === 403 ? "O site recusou a chave de acesso. Confira a chave e a permissão de leitura."
      : status === 404 ? "Pedido ou API não encontrados no site."
      : status === 429 ? "Limite de requisições do site atingido."
      : "O site não respondeu de forma conclusiva.");
  }
}
/** Somente HTTPS, sem credenciais embutidas: a chave trafega em Basic Auth. */
export function baseSite() {
  let u: URL;
  try { u = new URL(process.env.SITE_URL ?? ""); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash) return null;
  return { origem: u.origin + u.pathname.replace(/\/+$/, ""), loja: u.hostname.toLowerCase() };
}
export function siteConfigurado() {
  return !!baseSite() && !!process.env.SITE_CONSUMER_KEY && !!process.env.SITE_CONSUMER_SECRET;
}
export const siteAtivo = () => process.env.SITE_ATIVO === "1" && siteConfigurado();
export function segredoWebhookSite() {
  const s = process.env.SITE_WEBHOOK_SECRET ?? "";
  return s.length >= 24 ? s : null;
}
const listaEnv = (nome: string) => (process.env[nome] ?? "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 20);
/** Chaves de metadados onde o site grava data e horário de entrega; configuráveis sem novo deploy de código. */
export function metasEntregaSite() {
  const data = listaEnv("SITE_META_DATA_ENTREGA"), janela = listaEnv("SITE_META_JANELA_ENTREGA");
  return { metasData: data.length ? data : METAS_DATA_PADRAO, metasJanela: janela.length ? janela : METAS_JANELA_PADRAO };
}

/** Somente leitura (GET). Destino fixo, sem redirects e sem registrar headers ou corpos. */
export async function chamarSite(caminho: string, consulta: Record<string, string> = {}) {
  const base = baseSite(), chave = process.env.SITE_CONSUMER_KEY, segredo = process.env.SITE_CONSUMER_SECRET;
  if (!base || !chave || !segredo) throw new ErroSite("Configure o endereço e a chave de leitura do site no servidor.");
  const url = new URL(`${base.origem}/wp-json/wc/v3${caminho}`);
  for (const [k, v] of Object.entries(consulta)) url.searchParams.set(k, v);
  let resposta: Response;
  try {
    resposta = await fetch(url, { method: "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000),
      headers: { Accept: "application/json", "User-Agent": "GrazingHub/1.0", Authorization: "Basic " + Buffer.from(`${chave}:${segredo}`).toString("base64") } });
  } catch { throw new FalhaHttpSite(0); }
  if (!resposta.ok) throw new FalhaHttpSite(resposta.status);
  try { return { dados: await resposta.json() as unknown, paginas: Number(resposta.headers.get("x-wp-totalpages") ?? "1") || 1 }; }
  catch { throw new FalhaHttpSite(0); }
}
