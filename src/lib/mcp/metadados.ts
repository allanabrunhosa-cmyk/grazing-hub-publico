import { ESCOPOS_MCP } from "./catalogo";
import { enderecosMcp } from "./servidor";

export function metadadosRecurso() {
  const { emissor, recurso } = enderecosMcp();
  return { resource: recurso, resource_name: "MCP do Grazing HUB", authorization_servers: [emissor], scopes_supported: ESCOPOS_MCP, bearer_methods_supported: ["header"] };
}
export function metadadosAutorizacao() {
  const { emissor } = enderecosMcp();
  return { issuer: emissor, authorization_endpoint: `${emissor}/oauth/iniciar`, token_endpoint: `${emissor}/oauth/token`,
    response_types_supported: ["code"], grant_types_supported: ["authorization_code"], token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"], scopes_supported: ESCOPOS_MCP };
}
