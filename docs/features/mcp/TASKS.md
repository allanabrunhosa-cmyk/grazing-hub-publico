# Execução — MCP financeiro

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

Registro histórico da entrega v1. A execução vigente da evolução multimódulo,
cobertura e evidências finais estão em [MULTIMODULO.md](MULTIMODULO.md).

Worktree `<DIRETORIO_PRIVADO_DO_OPERADOR> autorizado/Downloads/grazing-hub/.worktrees/mcp-financeiro-20261007`,
branch `codex/mcp-financeiro-20261007`, base `b304a6a94dee52b5f31c7a5e2b19369d93578831`.
Atualização: 07/10/2026. Alterações das outras frentes preservadas. Checkout principal
permanece em `codex/cardapio`, com documentos preexistentes de Pedidos, Pontos de
Impressão e `docs/contexto/CONTINUIDADE.md`; não incluir essas alterações aqui.
Fetch ao concluir a implementação confirmou a mesma `origin/main`; a publicação
posteriormente autorizada está registrada ao final deste documento.

- [x] Contexto direcionado e consulta oficial de SDK/OAuth/ChatGPT.
- [x] Banco/política de acesso, migrations aditivas e testes isolados.
- [x] Servidor MCP e OAuth reais.
- [x] Consultas sobre os serviços financeiros existentes.
- [x] Interface, catálogo, histórico e diagnóstico reais.
- [x] Testes negativos, OAuth/cliente MCP, paridade financeira e QA visual.
- [x] Lint, design, tipos, build, migrations e regressão geral executados; evidências abaixo.
- [x] Revisão, commit funcional e push confirmados diretamente no GitHub.
- [x] Publicação autorizada em 07/10/2026, backup, migrations e smoke de produção.
- [ ] Autenticação e consulta pelo ChatGPT real (não afirmar homologação sem executar).

## Implementação e decisões

Arquivos: `src/lib/mcp/`, `src/app/(protegido)/configuracoes/integracoes/`,
`src/app/oauth/`, `src/app/api/mcp/`, `src/app/.well-known/`, schema e duas migrations
MCP de 07/10. Navegação/componentes da Central reutilizados, sem mover iFood.
Catálogo único alimenta servidor, política e UI. Perfis gerencial/detalhado e
personalizados somente com funções implementadas. Administração é permissão própria.

Carregamento DRE/fluxo extraído para `src/lib/financeiro/fontes-relatorios.ts`, usado
pelas páginas e pelo MCP. `faturas/relatorios.ts` aceita transação injetada, mantendo
uso anterior por padrão. Fórmulas existentes preservadas. Último ajuste funcional
usa a projeção de faturas também em contas/lançamentos: parte paga + saldo pendente,
referenciando o título. Agregação monetária em centavos, com limite de precisão.

Política/identidade são relidas em cada chamada; redução seguida de expansão não
restaura silenciosamente escopos antigos. Revisão apresentada é conferida ao consentir.
PostgreSQL READ ONLY bloqueia escrita financeira. Registros técnicos ficam separados.

Alternativas não adotadas: segundo servidor/subdomínio; OAuth/PKCE caseiro; chave
global/senha do usuário; DCR aberto/CIMD com busca de URL remota; SQL genérico;
escrita financeira; controles fictícios para módulos futuros; segunda lógica de
DRE/caixa; uso de dados reais em teste. Não retomar sem requisito/evidência.
Refresh tokens ficaram fora desta versão (access token de 1 h, nova autorização);
contas de serviço são evolução futura. Contratos e procedimentos: [OPERAÇÃO](OPERACAO.md).

## Evidências desta execução

Windows, Node 22.23.3, PostgreSQL 17 próprio em loopback:55447, banco
`grazing_mcp_teste`, dados sintéticos. Nenhum banco/serviço de produção usado.
Node desta máquina: `.tmp-versionamento/runtime22/node.exe` na pasta principal;
NPM: `C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js`. PATH do processo
aponta ao Node 22. Variáveis e ambiente reproduzível em OPERAÇÃO.

Revisão funcional: `ca69c47a449551db9973829039f133ac0d019d42`, enviada e conferida
por `git ls-remote --heads origin`. `main` remota permaneceu na base acima;
implementação 1 commit à frente / 0 atrás. Fechamento documental posterior não
altera código. Diff revisado: 53 arquivos, sem temporários, dados reais ou padrões
de credenciais; `git diff --cached --check` aprovado. Árvore limpa após commit.

Revisão testada: conteúdo da revisão funcional, validado antes do commit. Build e
smoke usam o código funcional final, sem alterações posteriores de produção; scripts
e documentos de evidência foram ajustados ao concluir. Logs privados ignorados em
`.tmp-mcp/`; não versionar banco, segredo local, cache ou logs brutos.

| Verificação | Comando real sob Node 22 | Resultado |
| --- | --- | --- |
| Geral | `node node_modules/vitest/vitest.mjs run --maxWorkers=1`, flag MCP | 2.358 aprovados, 471 skipped; 274 arquivos aprovados, 32 skipped; 870,99 s |
| MCP anterior | `node node_modules/vitest/vitest.mjs run testes/mcp --maxWorkers=1`, flag MCP | 38 aprovados, zero falhas; últimos dois casos foram incluídos na rodada de domínios |
| MCP final | Mesmo comando, após todos os ajustes | **40 aprovados, zero falhas**, 4 arquivos, 115,56 s |
| Domínios | `node node_modules/vitest/vitest.mjs run testes/mcp testes/financeiro testes/permissoes/integracao.test.ts --maxWorkers=1`, flags MCP/FATURAS/ACESSOS | 45 arquivos aprovados, 3 skipped; faturas interrompidas por queda do PostgreSQL: 469 aprovados, 69 falhas de conexão, 33 skipped e 2 erros não tratados; esta rodada não foi integralmente aprovada |
| Recuperação de faturas | `node node_modules/vitest/vitest.mjs run testes/financeiro/faturas/integracao.test.ts --maxWorkers=1`, flag FATURAS | 79 aprovados, zero falhas/erros; 147,59 s, sem alterar suíte/regra financeira |
| UI e fronteiras | Vitest em `testes/mcp/interface.test.tsx` e `testes/permissoes/fronteiras.test.ts` | 206 aprovados, zero falhas; repetição após timeout de importação de ação antiga |
| Tipos | `node node_modules/typescript/bin/tsc --noEmit` | exit 0 |
| Lint geral | `node node_modules/eslint/bin/eslint.js --ignore-pattern '.tmp*/**' --ignore-pattern '.worktrees/**'` | exit 0, sem warnings finais; script smoke também conferido depois do ajuste |
| Design | `node scripts/verificar-tokens-design.mjs` | exit 0, 8 bases / 335 consumidores |
| Build | `node 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' run build` | exit 0, webpack, rotas MCP/OAuth/gestão incluídas |
| Banco | Prisma `generate`, `validate`, `migrate deploy` no banco isolado | aprovados, 108 migrations aplicadas, incluindo as duas novas |
| Banco final | Prisma `validate` e `migrate status` | exit 0, 108 migrations, schema atualizado |
| HTTP do build | `node --conditions=react-server --import tsx testes/mcp/smoke-http.mts`, Next em loopback:45448 | 12 verificações aprovadas; aceite sintético pelo serviço, token/SDK/consulta reais via HTTP local |

Flags: `MCP_BANCO_TESTE=1`, `FATURAS_BANCO_TESTE=1`, `ACESSOS_BANCO_TESTE=1`.
A geral antecedeu os últimos ajustes de projeção/precisão/diagnóstico; domínios,
tipos, lint, design, build e smoke foram executados depois. Contagens se sobrepõem;
não somar como testes únicos. Skips exigem ambiente/flags próprios e não são sucesso.
Log PostgreSQL confirma backend encerrado, recuperação automática e conexões
derrubadas; repetição isolada concluiu. Build mantém avisos de middleware depreciado
e API Node em dependência Next Edge; sem erro. pg avisa de query concorrente.

Correções durante desenvolvimento: adaptador OAuth precisava de content-length;
projeção parcial/centavos ganharam teste; fixture precisava de vínculos bancários
obrigatórios. Smoke inicialmente recusou Host substituído pelo fetch e Bearer
duplicado pelo adaptador: cliente de teste corrigido, proteção do servidor preservada.

Cobertura: tokens inválidos/expirados/outro serviço; usuário/cliente/perfil inativo;
suspensão/revogação; redução e expansão; autoelevação; outra loja/conta/registro;
gerencial vs detalhe; chamada direta; escrita financeira bloqueada pelo banco;
logs sem dados/credenciais; limites/datas/paginação; retenção; código de uso único
e concorrência; OAuth+SDK; paridade DRE/fluxo; fatura parcialmente paga. Sem cache
de resultados entre pessoas. Teste novo garante que política alterada enquanto
o consentimento estava aberto exige nova conferência.

QA visual no navegador, prévia isolada `/mcp.html`: visão geral, conexões, diálogo;
desktop, 390×844 e tema escuro. Corrigida quebra de abas no celular; campos bloqueados
usam cinza da Central. Dados fictícios/ações sem persistência, não é produção.
Smoke HTTP verificou gestão autenticada, bloqueio sem sessão, metadados, host
dedicado recusado, consentimento renderizado, token, seis funções, DRE e revogação.
Não autenticou/navegou no ChatGPT.

## Publicação autorizada — 07/10/2026

Após a entrega, o usuário autorizou expressamente: “pode publicar!”. Branch limpa,
0 commits atrás da main, código idêntico ao validado (`git diff --quiet ca69c47a
HEAD -- src prisma package.json package-lock.json`). Nenhuma alteração funcional
nova exigiu repetir a bateria. Integração fast-forward com `git push origin HEAD:main`,
sem force; `git ls-remote --heads origin` confirmou a main e a branch em
**`436c6d23d249c1c3bf77f4f4f7b5a0a42a05171a`** antes deste registro documental.

Pré-condições executadas na VPS pelo SSH existente, sem expor credenciais:

- `scripts/deploy-etiquetas.py preparar etiquetas-mcp-20261007-175238` via stdin
  para `python3 -`: backup privado em
  `<BACKUP_PRIVADO>`, acesso root.
- Dump de 59.740.265 bytes; leitura integral com `pg_restore --file=/dev/null`
  concluída; SHA-256 `ab4a176bd44e83d8fa475d7c15ce13023f29eefe185fa60b2dc0960c77114d85`.
  Nenhuma restauração do banco realizada.
- Snapshot fiscal, especificação do serviço e imagem anterior preservados. Tag de
  recuperação `grazing-hub-backup:etiquetas-mcp-20261007-175238`; imagem anterior
  `sha256:fad3f8fa9a7f38678ae5fcad4e45a0219d69805d2adbbfc42606d1d4cb73972f`.
- Certificado no banco, sem fallback SEFAZ em env/mount. A revisão automática
  rejeitou o modo `restaurar` por seu potencial de modificar configuração fiscal;
  ele não foi executado. Comparação **somente leitura** com o snapshot comprovou
  configuração idêntica, dispensando reaplicação. Não ficou bloqueio operacional.

Dokploy recebeu o commit pelo webhook. Build webpack e tipos passaram; atualização
do serviço concluída em **18:03:12 UTC / 15:03:12 de São Paulo**. Evidência do runtime:

- Tarefa `p8ekk8v9rkrvacgn8gf3qqj48`, contêiner `e8fe5732b48d`.
- Imagem `sha256:51769f26ef9cfdee097dc5d85e4be9a7063e9c25e4ea6fd2dd17737bc0d2a519`.
- Deployment ID `f95d48a9-2028-41ab-8e8c-1f09cb11beb9`.
- Observação final: 254 segundos Running, zero reinícios, UpdateStatus `completed`.
- Checkout Dokploy no SHA publicado e 16 arquivos de runtime/schema/migrations/
  dependências comparados por SHA-256 com esse commit; rotas MCP/OAuth/gestão
  presentes no manifesto compilado.
- Logs de partida confirmam as duas migrations MCP aplicadas; `docker exec
  <container> npx prisma migrate status` confirmou **108 migrations, schema atualizado**.
  Nenhum erro fatal observado na partida. Nenhuma mudança destrutiva de banco.

Smoke HTTPS e autenticado efetivamente realizados:

- Descoberta do recurso e autorização HTTP 200, emissor/resource corretos, PKCE S256.
- `/api/mcp` sem Bearer: HTTP 401, WWW-Authenticate com descoberta e no-store.
- Gestão sem sessão redireciona ao login; login HTTPS carrega; metadados no host
  Pedidos retornam 404. TLS verificado normalmente, sem ignorar certificado.
- Sessão administrativa existente no navegador, sem criar pessoa/credencial de
  teste: gestão, perfis iniciais, catálogo de seis funções e histórico carregaram.
- Diagnóstico executado pela UI às **15:05:20 de São Paulo**: banco, empresa,
  perfis, descoberta HTTP e bloqueio sem token verificados; correlação
  `f666714b-cb6a-4143-8f58-c529fb110fe3`. Somente registros técnicos, sem consulta
  financeira por MCP. Cliente externo corretamente indicado como não testado.
- DRE (`/financeiro`) e fluxo (`/financeiro/fluxo-de-caixa`) carregaram autenticados,
  sem erro visível; somente navegação, sem operações financeiras/fiscais.

## Estado final e próximo passo

**Integrado na main e publicado.** MCP permanece globalmente inativo, com dois
perfis iniciais, zero aplicações e zero autorizações, conforme configuração inicial
de negação por padrão. Publicar não concedeu acesso financeiro externo.

**ChatGPT ainda não homologado.** Próximo passo: copiar callback exato do cliente,
cadastrar aplicação, preparar política do responsável, ativar MCP, concluir OAuth
e conferir consulta real. Essa autenticação/consulta externa não foi executada.

Este registro pós-deploy fica versionado somente na branch de trabalho,
seguindo o ritual de não disparar outra publicação apenas por evidências. A diferença
restante em relação à main é documental; o código em produção é o SHA acima.

## Preparação administrativa do ChatGPT — 07/10/2026

Pedido específico autorizou cadastrar o cliente público e preparar a política para
a identidade existente indicada pelo solicitante, além de retirar a suspensão global
após validar. Callback real recebido posteriormente, copiado do formulário atual;
o marcador inicial não foi usado nem substituído por callback presumido.

Estado conferido agora: produção já executava
`3168ab12557019a6b1c45a4e4a6eecb5866b63d9`, contêiner `253073ade09e`.
Antes das operações, MCP inativo, nenhum cliente e nenhuma autorização. Referências
remotas atualizadas; checkout principal e suas alterações documentais preservados.
Worktree desta frente continua `.worktrees/mcp-financeiro-20261007`, branch
`codex/mcp-financeiro-20261007`. Dez arquivos de biblioteca MCP/schema do contêiner
conferidos por hash com o checkout Dokploy. Código MCP, rotas OAuth/gestão e testes
MCP desta worktree são idênticos aos de `origin/main`; não houve correção de código,
migration, mudança de infraestrutura ou novo deploy nesta configuração.

Operações efetuadas pela sessão existente do responsável na aba **Conexões e
autorizações**, usando `salvarMcpAction` → `alterarAdministracaoMcp`, com validações
e auditoria próprias. Criado um único cliente após inventário vazio; callback HTTPS
exato, UUID público, autenticação do endpoint de token `none`, sem Client Secret.
Criada uma política **PREPARADA**, perfil **Financeiro detalhado**, seis escopos de
leitura implementados, limitada às permissões atuais e registros/contas permitidos
no HUB. Identidade ativa e não excluída resolvida pelo cadastro nominal correto;
empresa existente `ConfiguracaoLoja/singleton`, Grazing Table & Co. Nenhuma identidade
substituta ou conta privilegiada criada. Não foi feito consentimento pessoal.

Após validações, ativação global pela ação administrativa normal. Leitura posterior
em transação `BEGIN READ ONLY` confirmou: ativo=true, **um cliente, uma política
PREPARADA, consentidaEm=null, último uso=null, zero códigos e zero tokens**.
Não existiam autorizações de terceiros para reativar. Eventos `ADMIN_CLIENTE`,
`ADMIN_AUTORIZACAO` e `ADMIN_GLOBAL_ATIVO` persistidos, todos OK e atribuídos ao
responsável autenticado. Diagnóstico após ativação: **07/10/2026 16:14:19 São Paulo**,
OK; correlação `7789cca7-b1bb-43cb-96f6-44f8595e3a41`.

Validações realizadas nesta retomada:

- Node 22.23.3 e PostgreSQL 17.11 isolado em loopback:55449, novo banco fictício
  `grazing_conexao_teste`, `MCP_BANCO_TESTE=1`, `DATABASE_URL` somente no processo.
  Comando real: `node node_modules/vitest/vitest.mjs run testes/mcp --maxWorkers=1`.
  **40 aprovados, zero falhas/skips, quatro arquivos, 48,92 s**. Abrange OAuth/PKCE,
  callback exato, redução de permissões, revogação, isolamento e bloqueio PostgreSQL
  de escrita financeira. Tentativa inicial no banco anterior não executou os casos
  de integração porque o usuário técnico presumido não existia; resolvido criando
  outro cluster fictício, sem alterar o anterior. PostgreSQL iniciado para a retomada
  encerrado; arquivos preservados e ignorados.
- **11 verificações HTTPS aprovadas em produção**: recurso/emissor/endpoints/seis
  escopos corretos; `none`, code e S256, sem anúncios DCR/CIMD/refresh; gestão sem
  sessão e MCP sem token bloqueados; callback divergente, PKCE plain/ausente, escopo
  de escrita e resource alheio recusados; client_credentials e Bearer inválido negados.
  Somente tentativas inválidas, sem emitir códigos/tokens nem executar finanças.
- Unicidade operacional conferida antes/depois por inventário e contagem persistida;
  não se repetiu a criação. O serviço de criação não oferece idempotência automática:
  uma retomada deve primeiro buscar o cliente/política existente e conferir callback,
  responsável e perfil, em vez de enviar novamente o cadastro.
- Diagnóstico real em produção antes/depois aprovado: banco, empresa, perfis,
  descoberta HTTPS e bloqueio sem credencial. Catálogo permanece somente leitura.
  Suíte geral/lint/build não repetidos, pois não houve mudança de código ou dependência;
  resultados da implementação/deploy acima são evidências anteriores, não desta rodada.

Logs e verificadores controlados em `.tmp-mcp/conexao-*`, ignorados, sem valores de
credenciais. A conferência remota usa SSH autorizado existente e conexão ao banco
obtida internamente do contêiner, sem imprimir `DATABASE_URL`. Identificadores reais
de cadastro e callback devem ser consultados na gestão autenticada; não publicar
exportações do cadastro ou de auditoria.

**HUB preparado; ChatGPT ainda não conectado/homologado.** Próximo passo pessoal:
informar no formulário OAuth/cliente definido pelo usuário o Client ID já exibido
no HUB, manter Client Secret vazio, concluir login/consentimento real e consultar
pelo ChatGPT. Somente OAuth seguido de consulta bem-sucedida comprova ponta a ponta.
Tokens duram uma hora, sem refresh; não anunciar renovação automática.

Esta evidência é documental, publicada somente na branch de trabalho, sem disparar
um deploy para registrar configuração. As configurações reais persistem no banco
de produção e nos eventos administrativos, não em valores de segredo no Git.

## Correção da solicitação OAuth do ChatGPT — 07/10/2026

Relato do usuário: `invalid_request` ao iniciar OAuth. Conferência agora da tentativa
real no navegador: cliente, callback cadastrado, seis escopos, resource e PKCE S256
corretos; parâmetro adicional `ui_locales=pt-BR`. `PedidoOAuthSchema.strict()` recusava
essa chave não implementada. Regressão de interoperabilidade reproduzida antes da
correção: dois casos falharam por chave desconhecida, sete passaram. Não era defeito
do cadastro e não exigia DCR/CIMD, segredo ou alteração de permissões.

Correção mínima em `src/lib/mcp/oauth.ts`: preferência opcional BCP 47 limitada,
validada pelo runtime; guardas anteriores continuam obrigatórias e chaves estranhas
continuam recusadas. UI permanece em português. Não afrouxar o objeto para aceitar
qualquer parâmetro nem remover PKCE/resource como solução alternativa.

Testes novos em `testes/mcp/oauth-parametros.test.ts`; integração com idioma atravessa
consentimento sintético/PKCE/token sem ampliar escopos em `integracao.test.ts`;
`smoke-http.mts` inclui o idioma na solicitação HTTP real. Fixtures fictícias, sem
state/challenge da tentativa pessoal versionados. Sem dependência/schema/migration
nova e sem escrita financeira em produção.

Validações desta revisão: HEAD-base `1d84e8b0c5e0b513e3b14ece03117802de78912e`
com o diff da correção, após merge sem conflito de `origin/main` (`3168ab12`).
Node 22.23.3, PostgreSQL 17.11 em loopback:55449, banco `grazing_conexao_teste`,
`DATABASE_URL` de teste e `MCP_BANCO_TESTE=1` somente nos processos.

- `node node_modules/vitest/vitest.mjs run testes/mcp testes/permissoes/fronteiras.test.ts --maxWorkers=1`:
  MCP **50 aprovados**; bateria combinada 251 aprovados e um timeout de importação
  de ação fiscal não alterada. Reexecução integral de `testes/permissoes/fronteiras.test.ts`
  com o mesmo limite padrão: **202 aprovados/zero falhas**, 10,80 s, sem mudar teste.
- `node node_modules/eslint/bin/eslint.js src/lib/mcp/oauth.ts testes/mcp/oauth-parametros.test.ts testes/mcp/integracao.test.ts testes/mcp/smoke-http.mts`: aprovado.
- `node node_modules/typescript/bin/tsc --noEmit`: aprovado, também após geração Next.
  Argumentos equivalentes ao checker CLI Next, incluindo cache incremental: aprovados.
- `node scripts/verificar-tokens-design.mjs`: aprovado, oito bases/335 consumidores.
- `node node_modules/prisma/build/index.js migrate deploy`: 108 migrations existentes
  aplicadas no banco local fictício; nenhuma migration nova.
- `npm run build`, Node 22/webpack: aprovado com tipos, páginas e rotas. Primeiro
  processo parou em tipos sem diagnóstico; repetição restrita mostrou `spawn EPERM`.
  Execução fora da restrição de criação de processos concluiu normalmente, sem
  ignorar tipos, alterar Next config ou instalar dependências.
- `node --conditions=react-server --import tsx testes/mcp/smoke-http.mts` contra
  o build em `127.0.0.1:45448`, mesmo banco local e `AUTH_SECRET` fictício somente
  nos processos: **12 verificações aprovadas**, incluindo idioma, tela de consentimento,
  token PKCE, SDK Streamable HTTP, consulta fictícia sem escrita e revogação efetiva.
  Consentimento sintético não representa autenticação/consulta pessoal no ChatGPT.

Backup privado pré-publicação verificado por leitura integral `pg_restore --file=/dev/null`
sem restauração: `<BACKUP_PRIVADO>`,
59.759.119 bytes, SHA-256 `7266280310bd6efb1da9dcb34a7fd7d5eacfa00210c0e7f958501a0da6a65abd`.
Imagem anterior retida com o mesmo identificador; snapshot fiscal/serviço privado,
fonte de certificado no banco. Não reaplicar configurações cegamente.

Logs locais `.tmp-mcp/ui-locales-*` ignorados. Checkout principal/branch `codex/cardapio`
e alterações documentais de outras frentes preservados. Publicação desta correção
autorizada pelo pedido de configuração; não autoriza consentimento em nome do usuário.
Estado de publicação e smoke será registrado conforme a evidência efetiva abaixo.

### Publicação e retorno real do ChatGPT

Correção funcional `a49f33a66b3ad2757df1b02a58bed3e36177e98d` publicada em branch
e integrada por fast-forward na main após conferência direta no GitHub: zero commits
atrás, sem force push e sem sobrescrever trabalho. Webhook Dokploy normal; log
`app-copy-auxiliary-microchip-9hhwdm-2026-10-07:19:38:36.log` confirmou compilação,
tipos e 85 páginas. Tarefa `i2vipr8b1q13jma35s1tyogkp`, contêiner `7b6c1f77ea87`,
iniciado em **07/10/2026 19:44:12 UTC**, running e zero reinícios reconfirmados às
23:39 UTC. Imagem `sha256:8768f47ee3db4aef9b75332f028caceb97e1dce6650e8e251f7f9acb2f14d6c4`.
Dez arquivos MCP/schema em execução conferidos por hash contra o commit esperado;
rotas compiladas presentes, deploymentId `3da148df-ae8f-49f9-ae35-81ef252560f8`.
Configuração fiscal comparada com snapshot e preservada, sem reaplicação. Prisma
`migrate status`: **108 migrations, schema atualizado**. Sem restauração/destruição.

Onze guardas HTTPS pós-deploy aprovadas: descoberta, metadados reais, ausência de
sessão/token, callback divergente, PKCE ausente/plain, resource alheio, escrita,
client_credentials e Bearer inválido. Nenhuma operação financeira executada.
Primeira conferência administrativa pós-deploy: global ativo, mesmo cliente/callback,
mesma política PREPARADA/Financeiro detalhado/seis escopos, zero tokens/códigos.

Conferência agora no navegador da tentativa pessoal mostrou **Autorizar consultas
no Grazing HUB**, aplicação, callback, responsável e política corretos, eliminando
o `invalid_request`. A aba antiga havia sido encerrada; usada a tentativa atual
existente, sem fabricar state ou sessão pessoal. Entre observações o fluxo foi
concluído no navegador e retornou ao ChatGPT, **sem clique do agente em Autorizar**.
Leitura técnica posterior confirmou `CONSENTIMENTO OK` às **23:37:47 UTC**,
`TOKEN_EMITIDO OK` às **23:37:50 UTC**, política ATIVA e um token. Valores de código,
token, cookies e dados financeiros não foram lidos nem registrados pelo agente.

Página do plugin no ChatGPT mostra a conta conectada. Evidência local ignorada
`.tmp-mcp/chatgpt-conta-conectada.png`. Auditoria contém requisições iniciais MCP
(quatro OK e uma RECUSADA), sem evento CONSULTA; último uso financeiro permanece
nulo. Isso comprova OAuth real e conexão cadastrada, **não uma consulta financeira
de ponta a ponta**. Próximo passo pessoal: usar Testar no chat e fazer uma consulta
financeira somente leitura; conferir resultado e evento CONSULTA. Token dura uma
hora, sem refresh, e poderá exigir nova autorização.

Processos locais Next/PostgreSQL iniciados para validar foram encerrados; dados de
teste e trabalho alheio preservados. Evidência pós-deploy versionada apenas na
branch desta frente para não disparar outro deploy documental; main mantém o
commit funcional acima. Nenhum cadastro ou ampliação de acesso adicional realizado.

### Logo do plugin — pedido posterior

Reutilizada a marca existente LogoMark do HUB, exportada em PNG 512×512/SVG com
tokens canônicos. Fonte e procedimento em [plugin/README](plugin/README.md).
Atualização oficial "Enviar nova versão" no mesmo plugin aceitou **1.0.2**;
manifesto portable/compatibilidade completos, mesmo app ID e conta conectada,
sem alteração de autenticação, escopos, operações financeiras ou deploy do HUB.
Pacote anterior 1.0.1 baixado de volta confirmou arquivos e referências de logo
salvos. Versão 1.0.2 e conta Primary conferidas após recarregar.

**Exibição da logo ainda pendente:** página continua usando o ícone genérico.
Não confundir pacote aceito com substituição visual. A configuração observada
não oferece campo de imagem e Plugin Creator não edita esse plugin app-backed.
Não recriar plugin/cliente nem remover conta para tentar resolver. Próximo passo
é um mecanismo suportado de apresentação do app no ChatGPT ou correção dessa
exibição; sem causa raiz estabelecida para o ícone. Fontes e registro enviados
somente à branch, preservando main/produção funcional `a49f33a6`.
