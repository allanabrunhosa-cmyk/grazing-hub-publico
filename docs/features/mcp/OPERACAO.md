# Operação do MCP financeiro

Implementação desta versão; publicação e evidências reais em [TASKS](TASKS.md).
O contrato aprovado está em [SPEC](SPEC.md). Este documento não autoriza deploy.

## Endereços e ambiente

- Gestão: `/configuracoes/integracoes/mcp`, entrada em Configurações → Integrações.
  iFood e outras integrações existentes permanecem em suas áreas anteriores.
- Recurso técnico: `https://grazinghub.com.br/api/mcp`, Streamable HTTP stateless.
  POST retorna JSON; GET/DELETE autenticados respondem 405 (sem sessão/SSE persistente).
- Descoberta: `/.well-known/oauth-protected-resource/api/mcp` (também na raiz),
  `/.well-known/oauth-authorization-server`.
- OAuth: `/oauth/iniciar` recebe a solicitação; `/oauth/autorizar` exibe consentimento;
  `/oauth/token` troca código por token. A gestão exige sessão/permissão do HUB;
  chamadas MCP exigem Bearer próprio. Cookie do HUB não autentica ferramentas.
- Node 22, PostgreSQL, Prisma e proxy atuais. Não requer outro servidor/subdomínio.
  SDK oficial `@modelcontextprotocol/sdk@1.32.1`, `@node-oauth/oauth2-server@5.3.0`
  e `zod@4.6.5`, versões fixadas no lockfile.
- Variáveis: `DATABASE_URL` e `AUTH_SECRET` existentes; `MCP_ORIGEM` opcional,
  padrão `https://grazinghub.com.br`. A origem precisa corresponder à allowlist
  HUB de `src/lib/hosts.ts`. HTTP local só fora de produção. Não usar host de
  pedidos/validades. Nunca versionar valores de credenciais.
- Duas migrations aditivas: `20261007120000_mcp_financeiro` cria tabelas, perfis e
  configuração **inativa**; `20261007121000_mcp_versao_identidade` vincula tokens
  à revisão de permissões. Ritual de backup/deploy em
  [deploy](../../contexto/deploy.md). Não usar `migrate dev` ou `db push`.

## Modelo e autorização

`McpCliente` identifica aplicação pública pré-cadastrada; `Usuario` continua sendo
a pessoa responsável. `McpPerfil` limita funções; `McpAutorizacao` vincula cliente,
usuário, perfil, loja singleton, escopos e restrições. `McpSolicitacaoOAuth`,
`McpCodigoOAuth` e `McpToken` representam etapas distintas, não uma chave global.
`McpEvento` e `McpLimite` guardam apenas metadados técnicos e limites.

Administração exige `configuracoes.mcp` (`visualizar`/`editar`). Isso não concede
nenhuma permissão financeira. A identidade e as permissões atuais são relidas em
cada chamada e na execução da ferramenta. A empresa é a `ConfiguracaoLoja`
singleton existente: não há implementação paralela de tenants ou unidade fictícia.

Efetivo = permissão HUB atual ∩ perfil ∩ política ∩ escopos consentidos/token.
Tokens também carregam snapshot de restrições, versão da autorização, versão da
sessão e hash da revisão da identidade/perfil HUB. Desativação, exclusão, mudança
de identidade/acesso ou revogação impedem uso nas próximas chamadas. Alterações
do perfil HUB podem exigir novo consentimento mesmo quando não financeiras;
essa invalidação conservadora evita restaurar permissões silenciosamente.

Reduções do perfil MCP reduzem permanentemente o teto das autorizações existentes.
Reampliar o perfil não restaura esses escopos. Salvar política/restrições invalida
tokens e volta a PREPARADA; somente consentimento do responsável torna-a ATIVA.
Uma revisão do conteúdo apresentado é conferida ao consentir, evitando aceitar
uma política que mudou enquanto a tela estava aberta. Suspender uma autorização
invalida tokens; repreparar exige novo OAuth. Revogar é definitivo, preserva
histórico; reconexão requer outra autorização. Suspensão global bloqueia só MCP.

Restrições por contas/lançamentos: `null` permite o conjunto do HUB; `[]` não
permite nenhum registro; lista permite somente IDs indicados (até 200 por lista).
Aplicam-se a detalhes, contagens e totais. Saldos bancários ficam indisponíveis sob
restrição por lançamento; fluxo omite saldo projetado nesse caso. Não há cache
compartilhado de resultados. Campos sensíveis não têm escopo nesta versão:
descrições livres, contrapartes, fornecedores, observações e dados bancários são
omitidos por seleção explícita da saída. IDs internos não são links públicos.

Contas de serviço são evolução futura: cliente e identidade já são entidades
separadas. Esta entrega exige pessoa válida em `Usuario`, não habilita
`client_credentials`, não cria usuário técnico nem oferece controle fictício.

## OAuth e conexão ao ChatGPT

Authorization Code + PKCE S256 obrigatório; a biblioteca gera códigos/tokens e
valida PKCE. Armazenamento somente de hashes SHA-256 de credenciais aleatórias.
Códigos são de uso único, válidos por 2 minutos; pedido de consentimento dura
10 minutos; access token dura 1 hora. **Sem refresh token**: reconectar/autorizar
novamente após expiração. Password grant, chave global e token em URL são recusados.
Emissor, `resource`/destinatário, prazo, escopos e autorização são validados.

A solicitação também aceita `ui_locales` opcional, preferência de idioma enviada
pelo ChatGPT. Tags BCP 47 são validadas pelo `Intl.getCanonicalLocales` do Node,
com até dez tags separadas por espaço e 256 caracteres. A interface continua em
português; a preferência não altera identidade, consentimento, escopos, callback,
PKCE ou destinatário. Não implica oferecer OpenID Connect/ID tokens. Outros
parâmetros não implementados continuam recusados. Definição do parâmetro:
[OpenID Connect Core, solicitação de autorização](https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest).

Clientes são públicos, previamente cadastrados, com `client_id` UUID e sem segredo.
Não há DCR aberto nem leitura remota de metadados de clientes. Redirect HTTPS é
comparado exatamente com o cadastro; não deduzir callback de exemplos antigos.

1. Após publicação autorizada, abrir a criação de servidor MCP personalizado no
   ChatGPT conforme sua conta/workspace e selecionar OAuth. A disponibilidade
   depende do plano e da política do workspace.
2. Copiar o callback **exato informado pelo cliente**. Cadastrar aplicação no HUB,
   informar o ID gerado no cliente e preparar política para o responsável.
3. Ativar MCP, executar diagnóstico e iniciar OAuth pelo ChatGPT. Entrar com a
   identidade HUB, conferir cliente/destino/funções/restrições e consentir.
4. Pedir uma consulta real e confrontar filtros/resultado com o HUB e o histórico.
   Só essa etapa comprova conexão pelo ChatGPT. Nome “ChatGPT”, URL cadastrada,
   diagnóstico e cliente sintético não comprovam homologação externa.

Consultar as [fontes oficiais datadas na SPEC](SPEC.md#fontes-oficiais-consultadas-em-07102026)
se o cliente alterar telas ou exigências. Não inserir segredos em URLs, capturas,
logs ou prompts. Nenhum MCP externo é necessário para desenvolver/testar localmente.

## Ferramentas e semântica financeira

Catálogo único `src/lib/mcp/catalogo.ts`, usado por SDK, UI e política.

| Ferramenta | Escopo | Permissão HUB de visualizar |
| --- | --- | --- |
| `financeiro_dre` | `financeiro:dre:ler` | `financeiro.dre` |
| `financeiro_fluxo_caixa` | `financeiro:fluxo:ler` | `financeiro.fluxo` |
| `financeiro_saldos` | `financeiro:saldos:ler` | `financeiro.bancario` |
| `financeiro_lancamentos` | `financeiro:lancamentos:ler` | `financeiro.movimentacoes` |
| `financeiro_contas` | `financeiro:contas:ler` | `financeiro.baixas` e `financeiro.movimentacoes` |
| `financeiro_plano_contas` | `financeiro:plano:ler` | `financeiro.plano` |

Financeiro gerencial permite as três primeiras, consolidadas. Financeiro detalhado
permite as seis, sujeito à pessoa/política/consentimento. Perfis personalizados
selecionam somente esses escopos implementados. Ferramentas futuras exigem escopo
explícito e nova autorização; não existe “liberar sistema inteiro”.

`fontes-relatorios.ts` compartilha carregamento com telas DRE/fluxo; os cálculos
continuam em `calcularDre.ts`, `fluxoCaixa.ts`, `saldos-iniciais.ts`,
`competencia-pedidos.ts` e `faturas/relatorios.ts`. A projeção de faturas também
alimenta lançamentos e contas: pagamento parcial vira realizado + saldo pendente,
com referência ao título original. Não somar partes projetadas de novo ao original.
Cancelados não entram, como nas telas. DRE distingue caixa/competência; fluxo
separa realizado/previsto; contas usa vencimento; lançamentos permite competência,
vencimento ou pagamento. Saldos usa movimentações bancárias realizadas e bases
iniciais existentes. Não altera baixa, conciliação, importação ou valor persistido.

Saída estruturada contém estado OK/VAZIO/INDISPONIVEL, empresa, moeda BRL, fuso da
loja, instante de geração, regime, filtros e limitações. Valores monetários são
strings com duas casas, com agregação em centavos e recusa fora de precisão segura.
Erro não vira zero. Pagamentos de fatura sem classificação são sinalizados no fluxo;
DRE informa a exclusão sem inventar indicador de completude.

## Limites, auditoria e diagnóstico

- Períodos de 1–366 dias; até 100 registros/página, página máxima 1000. Fontes dos
  relatórios/projeções limitadas a 5.000 registros, considerando o conjunto histórico
  necessário aos serviços existentes. Acima disso a consulta é recusada inteira;
  reduzir só o período pode não bastar. Não retorna total truncado. Paginação do
  plano de contas usa contagem/consulta filtradas no banco.
- Entrada 16 KiB, leitura em até 3 s; saída 512 KiB; uma chamada JSON-RPC por POST.
  60 chamadas/minuto por usuário e autorização, 600 globais; 120 trocas de token e
  60 inícios OAuth/minuto globais, 10 consentimentos/minuto por usuário.
- Transação financeira Repeatable Read, `READ ONLY`, timeout SQL de 8 s e
  transação de 10 s. Uma tentativa acidental de escrita financeira é bloqueada
  pelo PostgreSQL. Escritas técnicas de segurança/auditoria ficam fora dela.
- Auditados: emissão, consentimento, alterações administrativas, chamadas/negações,
  ferramenta conhecida, resultado, duração e correlação. Não armazenar argumentos,
  respostas financeiras completas ou mensagens arbitrárias de exceção.
- Retenção 90 dias; limpeza oportunista de eventos antigos e registros expirados
  em lotes de 1.000, no máximo uma vez/minuto entre instâncias, ao usar OAuth/MCP
  ou diagnóstico. Sem tráfego não há limpeza programada; o próximo uso a retoma.
- Diagnóstico verifica banco, empresa, perfis, metadados via HTTP e bloqueio HTTP
  sem token. Só consulta a origem HUB permitida, sem redirects ou URL fornecida
  pelo cliente, com timeout e corpo limitado. Não executa consulta financeira,
  não cria token privilegiado e sempre distingue cliente externo não testado.
- HTTPS/proxy e ChatGPT real precisam de evidência após deploy. O diagnóstico
  pode falhar se a aplicação não conseguir acessar sua própria origem publicada.

## Validação reproduzível

Usar Node 22, `npm ci`, banco PostgreSQL local **fictício**, nome terminado em
`_teste`, `DATABASE_URL` só em ambiente do processo. Rodar `npx prisma generate`,
`npx prisma validate` e `npx prisma migrate deploy`/`status` apenas nesse banco.
As suítes de integração criam schemas próprios e removem somente seus schemas.

```powershell
$env:MCP_BANCO_TESTE='1'
npx vitest run testes/mcp --maxWorkers=1
$env:FATURAS_BANCO_TESTE='1'
$env:ACESSOS_BANCO_TESTE='1'
npx vitest run testes/mcp testes/financeiro testes/permissoes/integracao.test.ts --maxWorkers=1
npx vitest run --maxWorkers=1
npx tsc --noEmit
npm run lint -- --ignore-pattern '.tmp*/**' --ignore-pattern '.worktrees/**'
npm run lint:design
npm run build
npx vite --config testes/visual/mcp.vite.config.mts
```

Smoke do build: manter `AUTH_SECRET` fictício idêntico nos dois processos e
`DATABASE_URL` apontando ao mesmo banco local `_teste`; iniciar
`npx next start -H 127.0.0.1 -p 45448` e executar
`node --conditions=react-server --import tsx testes/mcp/smoke-http.mts`.
`MCP_SMOKE_URL` opcional troca somente o endereço loopback. O script cria identidades
e políticas fictícias no banco isolado e faz 12 verificações HTTP. O aceite usa o
serviço real com identidade sintética, não representa aceite humano/ChatGPT.
Guarda recusa host não local/banco sem sufixo `_teste`. Preserva o banco de teste.

O ignore do lint exclui somente artefatos locais gerados, inclusive cache Vite de
terceiros. Prévia `/mcp.html`, tema escuro `?tema=escuro`, dados sintéticos, sem
gravação. QA pelo navegador/Computer Use; prévia não comprova backend. Resultados,
revisão, comandos efetivamente rodados e pendências ficam somente em TASKS.
