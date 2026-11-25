import { ESCOPOS_MCP } from "./catalogo";
import { enderecosMcp } from "./servidor";

/** Identificação que o servidor apresenta ao cliente na inicialização: nome de exibição, site e ícones públicos (`/marca/`). */
export function identidadeServidorMcp() {
  const { emissor } = enderecosMcp();
  return { name: "grazing-hub", title: "Grazing HUB", version: "2.0.0", websiteUrl: emissor,
    icons: [512, 192].map(t => ({ src: `${emissor}/marca/grazing-hub-${t}.png`, mimeType: "image/png", sizes: [`${t}x${t}`] })) };
}
export function metadadosRecurso() {
  const { emissor, recurso } = enderecosMcp();
  return { resource: recurso, resource_name: "MCP do Grazing HUB", authorization_servers: [emissor], scopes_supported: ESCOPOS_MCP, bearer_methods_supported: ["header"] };
}
export function metadadosAutorizacao() {
  const { emissor } = enderecosMcp();
  return { issuer: emissor, authorization_endpoint: `${emissor}/oauth/iniciar`, token_endpoint: `${emissor}/oauth/token`,
    response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"], token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"], scopes_supported: ESCOPOS_MCP };
}
