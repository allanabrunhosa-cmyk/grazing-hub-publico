# MCP do Grazing HUB

Este documento registra a **primeira versão financeira somente leitura**.
A evolução aprovada para permissões centrais, consultas e ações multimódulo tem
arquitetura, cobertura e estado real em [MULTIMODULO](MULTIMODULO.md). As referências
a perfis próprios abaixo são históricas; não orientam o fluxo ativo da versão v2.

Entrega solicitada em 07/10/2026: gestão em Configurações → Integrações → MCP,
servidor remoto Streamable HTTP, OAuth Authorization Code/PKCE S256 e consultas
financeiras. Escrita operacional, SQL livre e contas de serviço estão fora desta versão.

## Arquitetura

- Mesma aplicação Next e host HUB; `/api/mcp` é o recurso técnico. Administração
  em `/configuracoes/integracoes/mcp`, consentimento em `/oauth/autorizar`.
- SDK oficial `@modelcontextprotocol/sdk`; protocolo OAuth pela biblioteca mantida
  `@node-oauth/oauth2-server`. Clientes públicos pré-cadastrados, redirect exato.
  Sem descoberta remota de clientes, DCR aberto ou callbacks presumidos.
- Tokens opacos, somente hashes persistidos, emissor/recurso e expiração conferidos
  junto da autorização e identidade em toda chamada. Sem refresh tokens nesta entrega:
  expiração exige nova autorização; password/client_credentials não habilitados.
- Isolamento existente é ConfiguracaoLoja singleton; não há tenant financeiro por linha.
  Rejeitar outra loja; restringir contas/registros e omitir campos pessoais/bancários.
- Permissão efetiva é interseção HUB atual × perfil MCP × autorização × consentimento
  × token. Novas ferramentas têm escopo próprio, nunca herdado automaticamente.
  Alterações de política invalidam consentimento/tokens anteriores quando ampliam acesso.
- Administração do MCP é recurso distinto de consultar financeiro. Apenas o usuário
  responsável pode consentir; nenhuma ferramenta MCP administra o próprio acesso.
- Serviços/calculadores das telas são reutilizados; consultas em transação PostgreSQL
  somente leitura, snapshot consistente e timeout. Auditoria técnica ocorre separada,
  sem parâmetros livres, respostas, tokens, cookies ou PII financeira.
- UI utiliza componentes existentes da Central; nenhuma nova identidade visual.
- Retenção técnica implementada: 90 dias de eventos e limpeza de
  credenciais/solicitações expiradas, com limites persistentes de chamadas.

## Critérios

Reproduzir OAuth com cliente sintético, consultas reais no banco isolado, permissão
revogada com token válido, restrição nos totais/detalhes, ausência de escrita financeira,
paginação/limites, precisão, igualdade com calculadores das telas, UI e validações C.
Publicação exige autorização vigente, backup/migrations/ritual de deploy. A autorização
de 03/10 de outra frente não se aplica. ChatGPT real é etapa externa distinta.

## Fontes oficiais consultadas em 07/10/2026

- [Autorização OpenAI](https://developers.openai.com/plugins/build/auth): descoberta,
  resource e PKCE; callback exato deve ser copiado da configuração do cliente.
- [Conectar servidor no ChatGPT](https://developers.openai.com/api/docs/guides/custom-mcp-server).
- [Autorização MCP](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).
- [SDK TypeScript oficial](https://ts.sdk.modelcontextprotocol.io/server).
- [OAuth mantido / PKCE](https://node-oauth.github.io/node-oauth2-server/guide/pkce.html).
  A documentação da branch principal pode antecipar opções; conferir a versão instalada.

Configuração, contratos e limites: [OPERAÇÃO](OPERACAO.md).
Progresso e evidências: [TASKS](TASKS.md). Regras financeiras permanecem no
[mapa Financeiro](../../modulos/financeiro.md), acesso e deploy nos guias canônicos.
