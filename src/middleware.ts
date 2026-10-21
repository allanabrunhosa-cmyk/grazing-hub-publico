import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session-token";
import { CAMINHO_CONECTOR_ETIQUETAS, CAMINHO_ETIQUETAS, CAMINHO_PEDIDOS, HOST_ETIQUETAS, HOST_ETIQUETAS_LEGADO, HOST_PEDIDOS, caminhoDedicadoPermitido, caminhoPublico, contextoDoHost, recursoEstatico } from "@/lib/hosts";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const contexto = contextoDoHost(request.headers);
  if (!contexto) return new NextResponse("Host não permitido.", { status: 421 });
  if (recursoEstatico(pathname)) return NextResponse.next();
  if (contexto.dedicado && !caminhoDedicadoPermitido(pathname, contexto.identidade)) {
    return new NextResponse("Página não encontrada.", { status: 404 });
  }
  // Callback autenticado exclusivamente pelo adaptador fiscal, sobre bytes originais.
  // MCP tem credencial OAuth própria; apenas o consentimento usa a sessão do HUB.
  if (contexto.identidade === "hub" && ["/api/mcp", "/oauth/token", "/oauth/iniciar", "/oauth/autorizar", "/.well-known/oauth-authorization-server", "/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/api/mcp"].includes(pathname)) {
    const resposta = NextResponse.next();
    resposta.headers.set("Cache-Control", "no-store");
    resposta.headers.set("Referrer-Policy", "no-referrer");
    resposta.headers.set("X-Robots-Tag", "noindex, nofollow");
    return resposta;
  }
  // Somente no HUB; não abre sessão de pessoas nem acesso aos arquivos.
  if (contexto.identidade === "hub" && pathname === "/api/fiscal-saida/retorno") {
    const resposta = NextResponse.next();
    resposta.headers.set("Cache-Control", "no-store");
    return resposta;
  }
  // Contrato máquina-a-máquina: a rota valida código único ou credencial revogável
  // no servidor. Não compartilha o cookie nem o fluxo de login de pessoas.
  if (contexto.identidade === "etiquetas" && pathname.startsWith(`${CAMINHO_CONECTOR_ETIQUETAS}/`)) {
    const resposta = NextResponse.next();
    resposta.headers.set("Cache-Control", "no-store");
    resposta.headers.set("X-Robots-Tag", "noindex, nofollow");
    return resposta;
  }
  // Favoritos antigos chegam ao novo portal; POSTs e conectores já instalados
  // conservam seu host/origem para não interromper operações em andamento.
  if (contexto.host === HOST_ETIQUETAS_LEGADO && ["GET", "HEAD"].includes(request.method)) {
    const destino = new URL(pathname, `https://${HOST_ETIQUETAS}`);
    destino.search = request.nextUrl.search;
    const resposta = NextResponse.redirect(destino);
    resposta.headers.set("Cache-Control", "private, no-store");
    resposta.headers.set("X-Robots-Tag", "noindex, nofollow");
    return resposta;
  }
  // Mantém as proteções nativas de Server Actions e também exige origem nos POSTs
  // do acesso dedicado (inclusive formulários de login sem JavaScript).
  if (contexto.dedicado && !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.headers.get("origin") !== contexto.origem) {
    return new NextResponse("Origem não permitida.", { status: 403 });
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session && !caminhoPublico(pathname)) {
    const loginUrl = new URL("/login", contexto.origem);
    return NextResponse.redirect(loginUrl);
  }

  // A sessão real é relida no servidor. Um token revogado deve poder abrir /login.

  // Favoritos e links de pedidos também abrem a identidade dedicada. POSTs antigos
  // ficam no host original para preservar o transporte e a origem das Server Actions.
  if (contexto.identidade === "hub" && ["GET", "HEAD"].includes(request.method) &&
      (pathname === CAMINHO_PEDIDOS || pathname.startsWith(`${CAMINHO_PEDIDOS}/`))) {
    const legado = pathname === `${CAMINHO_PEDIDOS}/producao` || pathname === `${CAMINHO_PEDIDOS}/calendario`;
    const destinoPedidos = new URL(legado ? CAMINHO_PEDIDOS : pathname, `https://${HOST_PEDIDOS}`);
    destinoPedidos.search = request.nextUrl.search;
    if (legado) destinoPedidos.searchParams.set("modo", pathname.endsWith("/calendario") ? "calendario" : "quadros");
    const resposta = NextResponse.redirect(destinoPedidos);
    resposta.headers.set("Cache-Control", "private, no-store");
    return resposta;
  }

  // A rota canônica evita o encaminhamento interno de Server Actions do rewrite.
  // Origem vem da lista permitida, nunca de URL/protocolo fornecidos pelo cliente.
  const destino = new URL(contexto.identidade === "pedidos" ? CAMINHO_PEDIDOS : CAMINHO_ETIQUETAS, contexto.origem);
  destino.search = request.nextUrl.search;
  const resposta = contexto.dedicado && pathname === "/"
    ? NextResponse.redirect(destino)
    : NextResponse.next();
  if (contexto.dedicado) {
    resposta.headers.set("X-Robots-Tag", "noindex, nofollow");
    resposta.headers.set("Cache-Control", "private, no-store");
  }
  return resposta;
}

export const config = {
  matcher: ["/:path*"],
};
