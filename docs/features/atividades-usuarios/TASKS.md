# Atividades por usuário — execução e cobertura

Conferência de código e evidências em 10/10/2026. Contrato em [SPEC](SPEC.md),
padrão obrigatório em [Auditoria e atividades](../../contexto/auditoria-atividades.md)
e números/reprodução em [MEDICAO](MEDICAO.md). Este registro distingue implementação,
testes locais e homologação externa; não constitui autorização de publicação.

## Etapas e aceite da implementação, antes da autorização de publicação

| Etapa | Critério / área | Estado e evidência |
| --- | --- | --- |
| Inspeção e reaproveitamento | Confirmar autor, data, transação e fontes atuais; preservar contratos | Concluída. Históricos existentes mantidos; 14 fontes na whitelist SQL, sem cópia de seus payloads |
| Banco e integridade | Estrutura enxuta, UTC, índices, dedup, rollback e somente inserção | Implementado em `prisma/schema.prisma` e migration aditiva `20261010090000_atividades_usuarios`; PostgreSQL isolado: 14/14 testes de integridade/consulta |
| Registro nas lacunas | Identidade servidor, mudança e evidência na mesma transação | Implementado nos pontos da matriz; ações reais sintéticas: 7/7 testes PostgreSQL |
| Consulta e autorização | Catálogo central, lista/detalhes/API protegidos e conteúdo mínimo | Implementado em `src/lib/atividades`, catálogo e GETs de atividades; unitários e PostgreSQL real verificam filtros, cursor, acesso direto e restrições financeiras |
| Interface | Aba contextual, padrões da Central, filtros e estados; carregar sob demanda | Implementado; 14 testes de interface aprovados; links abrem entidades em consulta, com testes dos consumidores; imagens sintéticas em quatro larguras, sem erro JS/overflow horizontal observado. Referência permanece Em revisão humana |
| Integrações | Identidade validada, resultados reais, nenhum fluxo desligado ativado | MCP/iFood conferidos no código e em PostgreSQL sintético; sem homologação externa nem impressão física |
| Desempenho e retenção | 100 mil eventos, tamanho PostgreSQL, WAL e latência comparável | Concluído localmente: benchmark 1/1, 100.000 eventos por variante; diagnóstico e recuperação em lotes; expurgo desativado |
| Documentação | Fonte obrigatória para novas funcionalidades e recuperação/reversão | SPEC, este registro, MEDICAO e documento responsável pela auditoria presentes |
| Fechamento C | Regressão geral, lint, lint:design, typecheck, build e smoke isolado final | Concluído localmente: 2.943 testes aprovados, nenhuma falha, 592 opt-in pulados; demais checks e smoke aprovados, conforme evidências abaixo |
| Publicação / migration produtiva | Autorização explícita desta entrega | Não autorizadas e não executadas |

## Matriz de cobertura efetiva

`Projeção` significa INSERT transacional de referência fonte/tabela/id, com resumo,
ator e resultado mínimos; os detalhes continuam na fonte canônica. `Nativo` significa
registro compartilhado no fim da mesma transação da mudança. Os testes citados indicam
o que foi verificado; não equivalem a executar cada ramo de todas as fontes.

| Módulo | Eventos cobertos | Ponto de captura / fonte | Testes e limites da evidência |
| --- | --- | --- | --- |
| Autenticação | Login validado; credenciais recusadas; logout explícito | `src/app/login/actions.ts` → `src/lib/atividades/autenticacao.ts` (nativo) | `testes/atividades/autenticacao.test.ts`: 10/10 aprovados; atores, recusa anônima, registro indisponível e logout |
| Autorização | Recusa de operação de escrita pelo guard central e pelo guard de gestão de acessos | `src/lib/permissoes/servidor.ts::exigirPermissao` e `configuracoes/usuarios/actions.ts::alterar` → registro independente, fora da transação revertida | `autenticacao.test.ts`: bloqueio preservado se auditoria falhar, leituras/navegação não auditadas; `testes/atividades/usuarios.test.ts`: 2/2 aprovados, recusa do guard próprio registrada após rollback e sem segredo |
| Usuários e perfis | Criação, edição, exclusão lógica, ativação/inativação; perfil, exceções/permissões e senha redefinida sem segredo | `configuracoes/usuarios/actions.ts::historico` → `HistoricoAcesso` (projeção) | `testes/atividades/integracao.test.ts`: autor distinto de afetado, UTC, referência, identidade histórica, rollback, falha da projeção; regressão própria em `testes/permissoes` |
| Recuperação de senha | Redefinição confirmada pela identidade validada do fluxo existente | Auditoria existente `HistoricoAcesso`, ação `Senha redefinida por link de recuperação` | Mesma projeção de acesso; não registra token/hash/senha; fluxo completo de recuperação não foi homologado externamente |
| Clientes | Criar/editar e ativar/inativar | `src/lib/vendas/persistencia.ts::historico`, entidades CLIENTE/SITUACAO_CLIENTE → `HistoricoCadastroVenda` | Fonte inspecionada; mecanismo central PostgreSQL testado; regressão de domínio em `testes/vendas/clientes-*`; sem teste novo de ponta a ponta de cada variante de cliente |
| Produtos e catálogo | Criar/editar, preço, ativar/inativar, exclusões suportadas, composição, categorias/grupos, canais e ordenações já auditadas | `src/lib/vendas/persistencia.ts` → `HistoricoCadastroVenda` | PostgreSQL verifica produto que já não existe sem perder autoria; `testes/vendas` contém regressão dos contratos existentes; não duplica snapshots comerciais |
| Estrutura fiscal versionada (11/10/2026) | Rascunho criado, impacto analisado e versão ativada por vigência | `EventoEstruturaFiscal` → projeção transacional na migration aditiva `20261011233000_atividade_estrutura_fiscal`; recurso `vendas.fiscal` | `testes/atividades/estrutura-fiscal-integracao.test.ts`: autoria relida nos serviços, origem explícita/UTC, dedup concorrente, rollback da ativação, proteção lista/detalhes e ausência de payload; validação local registrada na extensão abaixo |
| Fornecedores e beneficiários | Criar, editar, excluir; fornecedor importado por linha efetiva; ativar/inativar | `fornecedores/actions.ts` e `status-cadastros-actions.ts` (nativos) | `testes/atividades/negocio-integracao.test.ts`, casos 1–3: CRUD, import inválido, privacidade, status concorrente e repetição sem novo fato; unitários `testes/cadastros` |
| Insumos e preparações | Criar, editar, importar, ativar/inativar; excluir preservando vínculos e auditoria original | `insumos/actions.ts`, `status-cadastros-actions.ts`, `src/lib/insumos/exclusao-servidor.ts` (nativos) | PostgreSQL negócio, caso 4: diferenças permitidas, exclusão idempotente, sem copiar `exclusaoSnapshot`; regressão `testes/insumos` |
| Porções | Criar/editar/inativar porções e alterar ordenação de categorias | `src/lib/insumos/porcoes-servidor.ts` → `HistoricoPorcaoInsumo` / `HistoricoOrdemCategoriasPorcoes` | Fontes e autorização inspecionadas; projeção transacional comum; regressão de porções em `testes/insumos`. Ordenação apresenta fato/resumo sem expor array integral |
| Pedidos comerciais | Criar orçamento, editar, confirmar, revisar; condições comerciais, informações, data/janela, status e cancelamento | `src/lib/vendas/pedidos.ts::evento` → `HistoricoPedidoVenda` | Contratos/idempotência de domínio preservados; `testes/vendas/pedidos-*` e cancelamento contêm regressão existente; cada tipo real do histórico é projetado |
| Operação e entregas | Avanço/retorno de etapas, preparação/expedição, ocorrências, entrega e ações operacionais já auditadas | Históricos de pedidos gravados pelo serviço operacional e `src/lib/vendas/entregas.ts` | Fonte existente reaproveitada; sem auditoria de polling/leituras; testes de operação/entregas em `testes/vendas` |
| Financeiro de pedidos | Recebimentos, crédito, estorno e devolução/tratamento existentes, incluindo solicitação pendente | `src/lib/vendas/pedidos.ts::historicoFinanceiro` → `HistoricoFinanceiroPedido` | Consulta exige recurso financeiro, além de permissões gerais; PostgreSQL consulta real e `testes/atividades/consulta.test.ts` verificam conteúdo restrito; `testes/vendas/pedidos-financeiro-integracao.test.ts` é opt-in legado |
| Financeiro avulso | Criar/editar lançamento; baixa; estorno da baixa; cancelamentos já auditados | `financeiro/lancamentos/actions.ts`, `src/lib/financeiro/baixarLancamento.ts` (nativos); cancelamento existente via `HistoricoAcesso` | `testes/atividades/financeiro.test.ts`: ator real, parcelas correlacionadas distintas, antes/depois relido, corrida perdida, falhas e integração/sistema; sem segundo registro quando fonte de pedido/conciliação já cobre a baixa |
| Conciliação | Importar extrato, conciliar/criar e conciliar, desfazer conciliação e estornos auditados | `src/lib/financeiro/conciliacao/servico.ts` → `HistoricoConciliacao` | Fonte preservada; baixa chamada com `auditoriaOrigem` para não duplicar o fato; regressão `testes/financeiro/conciliacao` e consulta protegida da feature |
| Cartões e faturas | Cadastro/alteração/status de cartões e operações de faturas já auditadas: correção, fechamento, compensações, pagamentos e estornos | `financeiro/bancario/cartoes-actions.ts`, `src/lib/financeiro/faturas/acesso.ts::auditarFatura` → `HistoricoCartao` | Recurso `financeiro.faturas` quando há fatura, sem liberar conteúdo por permissão bancária; `testes/financeiro/faturas` e consulta protegida da feature |
| Compras | Criar/editar; receber, cancelar, reabrir, excluir e reagendar pelos fluxos existentes | `compras/actions.ts::salvarPedidoAction` (nativo); restantes via `PedidoCompraHistorico` | PostgreSQL negócio, caso 5: criar/editar com data, sem ativar/movimentar estoque; regressão `testes/compras` |
| Estoque | Entradas, ajustes e demais movimentos efetivos que passam pelo gravador compartilhado | `src/lib/estoque/registrarMovimentacao.ts` (registro novo com referência `MovimentacaoEstoque`) | `testes/inventario/atividades-movimentos.test.ts`: sessão versus autor legado, data de negócio separada, mesma tx, falhas e integração explícita; não projeta timestamps retroativos de movimentos legados |
| Perdas | Registrar perda e excluir/estornar preservando evidência | `inventario/perdas/actions.ts` e serviço de exclusão → `Perda` / `PerdaExclusao` (projeção); movimentos mantêm sua referência própria | Fonte real e timestamp servidor inspecionados; regressão `testes/inventario/perdas-*`; movimentos associados são efeitos físicos distintos, não cópias do payload de perda |
| Contagens | Iniciar, alterar quantidade real de item, finalizar; excluir em andamento ou cancelar com estorno | `inventario/contagem/actions.ts`, `src/lib/estoque/cancelar-contagem.ts` (nativos) | PostgreSQL negócio, caso 6: responsável deliberadamente diferente do autor de edição/finalização/cancelamento; repetição sem fato, saldo e estorno; regressão `testes/inventario` |
| Etiquetas | Preparar, solicitar impressão/reimpressão, exportar arquivo; relatar envio/falha/incerteza; confirmar fisicamente pelo operador; configurações já auditadas | `producao/etiquetas/actions.ts` → `EventoAuditoriaEtiqueta` / INSERT `TentativaEtiqueta`; finalização relatada nativa | `testes/etiquetas/atividades-actions.test.ts`: resultado real, pertença ao solicitante, autorização, retry/concorrência e falha; `testes/etiquetas/actions.test.ts` preserva fluxo. Impressora física não testada |
| MCP / API validada | Negócio preparado, aprovado no HUB e executado; atividades de domínio com contexto interno MCP | `src/lib/mcp/operacoes.ts`, `src/lib/mcp/servidor.ts::auditarMcp` → `McpEvento`; contexto transaction-local | PostgreSQL integração testa MCP SOLICITADO/FALHA, aprovação no HUB com origem INTERFACE e ignora token inválido sem autor; `testes/atividades/registro.test.ts` testa identidade divergente e origens; API é testada como contexto interno, sem criar novo endpoint de escrita |
| Automação / iFood | Eventos e reconciliação reais auditados, com ator integração; ação iniciada separada do resultado externo | Históricos reais de iFood em `HistoricoPedidoVenda` / `HistoricoCadastroVenda`; iniciador somente por `AcaoIfood` / `AcaoMerchantIfood` comprovada | PostgreSQL testa execução autônoma sem atribuição ao administrador legado; whitelist de resultados Merchant/reconciliação: confirmação comprovada, recusa, falha e estados pendentes/desconhecidos sem falso sucesso; nenhuma rotina desligada é ativada; falhas externas não auditadas pela fonte continuam uma lacuna |
| Empresa e configurações existentes | Mudanças de empresa/etiquetas e cadastros comerciais já gravados nas fontes acima | `HistoricoAcesso` entidade LOJA, `EventoAuditoriaEtiqueta`, `HistoricoCadastroVenda` | Fontes atuais reaproveitadas; não constitui cobertura de todos os cadastros auxiliares/configurações do sistema |

## Autoria, retroativo e resultados

- A aba inicia em **atividades pelo usuário** (`autorId`). **Alterações no cadastro**
  usa `usuarioAfetadoId`; exibe quem realmente executou a mudança. `responsavelId`
  da contagem não é usado para atribuir edição/finalização de outra pessoa.
- Login recusado sem identidade confirmada permanece ator sistema, sem vincular o
  e-mail informado ao cadastro. Fechar o navegador não produz logout.
- iFood autônomo usa ator integração e `autorId=null`; iniciador não transforma uma
  execução posterior da integração em ação direta do usuário. Fato técnico MCP
  preparado/aprovado e alteração de domínio são efeitos distintos correlacionados.
  Aprovar no HUB usa origem interface e comprova a aprovação; não comprova execução
  externa. Merchant/reconciliação sem confirmação permanecem solicitados; estado
  desconhecido ou ausente não vira sucesso por conveniência.
- Projeção começa após a migration. Retroativo exige fonte real e autoria confiável;
  não se reconstrói ação por estado atual ou timestamp de negócio. A migration não faz
  backfill; CLI permanece em simulação até autorização explícita e `--aplicar`.
  Nas fontes sem nome histórico, a projeção conserva o ID confiável e obtém nome
  disponível no momento da projeção; não afirma conhecer nome pretérito ausente.
- Solicitação/reimpressão e envio relatado não afirmam papel impresso. Envio incerto
  permanece solicitado; falha tem resultado próprio; somente confirmação explícita
  do operador é `CONFIRMADO`. Exportação bem-sucedida comprova o arquivo, não impressão.
- API/lista/detalhe são somente leitura e não expõem payload completo, nomes pessoais
  de terceiros, segredo, anexo ou corpo de requisição. Campos financeiros/custos
  continuam condicionados à autorização específica do leitor.

## Evidências locais consolidadas

| Validação | Resultado comprovado nesta etapa | Evidência |
| --- | --- | --- |
| PostgreSQL integridade/consulta/CLI | 14/14 aprovados na rodada final, sem skip, 6,11 s; inclui semântica externa iFood, aprovação HUB e diagnóstico das 16 fontes | `testes/atividades/integracao.test.ts`; [MEDICAO](MEDICAO.md) e logs PostgreSQL isolados |
| Regressão geral final | 310 arquivos aprovados / 38 opt-in pulados; 2.943 testes aprovados / 592 pulados; nenhuma falha; 740,47 s | Node 22, `vitest run --maxWorkers=2`, início 19:55:39 de 10/10/2026; `.tmp/testes-atividades-global-final.log`. Sem lint/build concorrentes; opt-in não equivale a teste executado |
| PostgreSQL ações reais | 7/7 aprovados, sem skip, 7,51 s | `testes/atividades/negocio-integracao.test.ts`; `.tmp/atividades-usuarios/negocio-integracao-final.log` |
| Auth/guard/consulta/privacidade/registro/helper e fronteiras | 249/249 aprovados em 7 arquivos, sem skip, 21,89 s | Rodada final Node 22, `maxWorkers=1`: autenticação 10, guard usuários 2, consulta 14, conteúdo financeiro 6, registro 7, helper 1 e fronteiras 209 |
| Benchmark | 1/1 aprovado, 100.000 eventos por variante, 67,82 s | `testes/atividades/desempenho.test.ts`, [MEDICAO](MEDICAO.md), JSON local de medição |
| Regressão cadastros/insumos/compras/inventário | 53 arquivos aprovados; 345 testes aprovados, 107 opt-in pulados em 10 arquivos; zero falhas | `.tmp-atividades-dominios-tests.log`; opt-in não representa execução PostgreSQL dos testes legados pulados |
| Financeiro/estoque/etiquetas e interface focados | 88 testes únicos aprovados em 9 arquivos (incluem os 14 da interface); teste de envio incerto evita confirmar impressão | Testes nativos e consumidores citados na matriz |
| PostgreSQL opt-in de etiquetas/perdas/contagem/entrada | 50 testes aprovados em ambiente isolado; contagem/entrada: 18 na rodada final | Testes legados dos quatro fluxos, com asserções de autor, referência, baixa, concorrência e rollback sem nova atividade |
| Interface da feature | 14 testes aprovados | `testes/atividades/interface.test.tsx` |
| Links compras/insumos/fornecedores | 29 novos casos; rodada de consumidores: 9 arquivos, 60 testes aprovados, 72,98 s; após bloquear status no detalhe inicial para admin, 2 arquivos afetados e 10 testes aprovados, 20,69 s | `testes/atividades/entidades-paginas.test.ts`, `entidades-interface.test.tsx`; `.tmp-atividades-deeplinks-final.log` e `.tmp-atividades-deeplinks-insumos-final.log` |
| Links clientes/produtos | 17 novos casos; 5 arquivos de consumidores, 68 testes aprovados | `testes/atividades/entidades-vendas-pagina.test.tsx` e consumidores de clientes/produtos |
| Link financeiro | 16 testes de interface aprovados e lint focado limpo | Consumidores de movimentações financeiras; abre detalhe de leitura mesmo fora do período, preservando os filtros atuais |
| Visual sintético isolado | 1440×1000, 768×1024, 390×844 e 320×740; lista/detalhes e usuário excluído inspecionados; zero erro JS e overflow observado | Harness `testes/visual/usuarios-atividades.*`, imagens `.tmp-ui/atividades-*.png` |
| Lint dos arquivos instrumentados | Aprovado localmente | 7 pontos de negócio, testes novos e unitários ajustados |
| lint:design após links | Aprovado: 8 bases / 354 consumidores; diff check limpo | Verificação após os consumidores alterados; fechamento geral permanece abaixo |
| Prisma no schema final | `validate` aprovado; `generate` aprovado, cliente 7.10.0 | Geração somente em `src/generated/prisma` ignorado, sem conexão/migration de banco |
| Lint geral | Aprovado, exit 0; fixtures alteradas depois receberam lint focado aprovado | `.tmp/lint-atividades-concluido.log`; nenhum ajuste para enfraquecer regras |
| Tipos finais | `next typegen` e `tsc --noEmit` aprovados, exit 0 | Node 22, contratos gerados após corrigir as três assinaturas PageProps; logs `.tmp/atividades-usuarios/typegen-final.log` e `typecheck-final.log` |
| Compilação final | `next build --webpack` aprovado, exit 0; 87 páginas geradas | Node 22, ambiente limpo e somente banco sintético; `.tmp/atividades-usuarios/build.log`. Aviso herdado: convenção middleware deprecada em favor de proxy, sem bloqueio da compilação |
| Smoke da aplicação compilada | 14 grupos aprovados; acesso 307/401/403/404, filtros/cursor 400, escrita 405, páginas 50+50, privacidade e login/logout reais | HTTP somente em `127.0.0.1:4301`, PostgreSQL sintético; `.tmp/atividades-usuarios/smoke-http.json`. Headers do contrato de host preservados, sem seguir redirecionamento externo; servidor próprio encerrado |

Os logs temporários e credenciais sintéticas ficam ignorados. Este registro guarda
o resultado e a localização da evidência, sem reproduzir dados ou logs brutos.

## Lacunas e limites reais

- Cadastros auxiliares de canais/formas de fornecedores e categorias/centros de custo/
  fotos de insumos não receberam novos registros. Só operações já auditadas nesses
  assuntos aparecem pelas fontes existentes. Não declarar auditoria total de configurações.
- Antes/depois são limitados pela allowlist; edição de campo pessoal ou detalhe aninhado
  pode apresentar somente o fato/resumo, sem reproduzir o valor. Ordenações, snapshots
  fiscais, motivos livres e conteúdo de impressão não são devolvidos integralmente.
- Links autorizados abrem pedido comercial, contagem, fatura e, por `?entidade=id`,
  compras, insumos, fornecedores/beneficiários, clientes, produtos e movimentações
  financeiras. O servidor valida o ID e a existência no conjunto já autorizado;
  a interface abre consulta e ajusta situação/página do alvo, preservando o estado
  padrão sem parâmetro. Compras excluídas permitem somente histórico; insumos excluídos
  e lançamentos cancelados não recebem link. Perda não tem detalhe de leitura existente;
  entidades ausentes e demais cadastros auxiliares conservam o fato sem link.
- Novos fatos de API/automação são identificados quando há identidade/contexto interno
  confirmado. Histórico legado de canal desconhecido fica `NAO_IDENTIFICADA`;
  falhas de integrações sem auditoria canônica não foram reconstruídas nem homologadas.
- Paginação exclui novas sequências/backfill posteriores ao limite inicial, com empate
  resolvido por id. Transação que já reservou sequência menor pode confirmar depois;
  o cursor entre requisições não promete snapshot MVCC permanente.
- Não há teste novo de ponta a ponta para cada variante de cada uma das 14 fontes.
  Há teste do mecanismo comum, fontes representativas, ações reais das lacunas e
  regressões de domínio; testes legados opt-in pulados permanecem explícitos.
- Banco/auditoria indisponível pode impedir evidência de logout ou recusa; a operação
  de segurança continua protegida. Login confirmado exige evidência antes de emitir cookie.
- Benchmark mede SQL/PostgreSQL local, uma rodada com aquecimento; não mede HTTP,
  renderização, impressão/integração externa ou SLA produtivo. Dados/índices, WAL e
  backups são separados; não converter tempos medidos em impacto universal.
- Retenção de 12 meses por categoria é proposta configurável operacional; não é prazo
  legal nem descarte autorizado. Expurgo está desativado e fontes existentes preservadas.

## Fechamento da implementação — antes da autorização de publicação

- [x] Consolidar regressão geral final: 310 arquivos / 2.943 testes aprovados, nenhuma falha; 38 arquivos / 592 opt-in pulados, com rodadas PostgreSQL efetivamente executadas discriminadas acima.
- [x] Confirmar `prisma validate` e geração do cliente no schema final: ambos aprovados em 10/10/2026, cliente 7.10.0.
- [x] Registrar resultado final de `lint`, `lint:design`, `typecheck` e `build`: aprovados; detalhes e limites na tabela acima.
- [x] Registrar smoke da versão compilada em banco sintético isolado: 14 grupos aprovados; nenhum negócio externo ou dado real usado.
- [x] Confirmar imagens responsivas da versão final e referência Em revisão humana: quatro larguras, lista/detalhes e usuário excluído; nenhuma alteração posterior no consumidor de atividades.
- [x] Revisar diff e documentos; branch local `codex/atividades-usuarios-20261010`, baseada em `origin/main` 8911c91e, reconferida no remoto em 10/10/2026. Código, testes, migration e documentação reunidos em commit local; consultar `git log -1` para identificação. Checkout original `codex/cardapio` e alterações alheias preservados.
- [x] Entregar preparação e roteiro de publicação em [SPEC](SPEC.md), sem publicar.
  Branch não enviada, `main` não atualizada, migration produtiva, recuperação histórica
  e deploy não executados. Servidor e PostgreSQL próprios dos testes encerrados;
  arquivos/evidências sintéticos preservados e ignorados no Git.

Próximo passo externo: revisão humana e autorização explícita de integração/publicação,
seguindo o roteiro da SPEC. Nenhuma pendência de implementação ou check automatizado
foi identificada nesta revisão; lacunas de cobertura e limites permanecem discriminados.

## Autorização posterior e preparação de publicação

### Extensão da estrutura fiscal — 11/10/2026

`EventoEstruturaFiscal` amplia a whitelist SQL para 15 fontes projetadas; o
diagnóstico administrativo passa a medir 17 fontes, contando os dois registros
nativos. As contagens e evidências de 10/10 acima permanecem históricas.
Criação, análise e ativação registram o administrador executor relido pelo serviço,
inclusive no bootstrap assistido; a projeção não atribui a execução a um sistema
ou ao criador da versão por suposição. Canal sem contexto interno comprovado fica
`NAO_IDENTIFICADA`; `definirContextoAtividade` permite origem técnica transacional
explícita. Ativação local não é emissão nem autorização fiscal externa.

Lista/detalhes exigem `vendas.fiscal` além das capacidades centrais existentes.
Os detalhes retornam somente tipo, número e início da vigência da versão imutável;
não consultam `dados`, fontes, justificativas, NCM, informações de destinatários ou
credenciais. A referência leva ao painel fiscal, sem conceder edição.

Migration adiciona o trigger de INSERT e estende a função por delegação ao contrato
original preservado em `grazing_projetar_atividade_20261010`. Não há recuperação
histórica automática. Os scripts de diagnóstico/recuperação reconhecem a nova
fonte; não foram usados para recuperar ou modificar dados reais.

Reversão preserva ambas as funções, `EventoEstruturaFiscal` e `AtividadeUsuario`.
Voltar o código pode manter o trigger. Se uma falha de projeção exigir interromper
essa captura, remover somente `atividades_projetar_insert` de
`EventoEstruturaFiscal` em janela autorizada e registrar o intervalo; manter os
eventos para posterior recuperação em lotes com autorização própria. Não apagar
registros nem desfazer as migrations já aplicadas.

Validação local desta extensão em 11/10/2026: **7/7 testes PostgreSQL aprovados,
sem skip**, em schema temporário exclusivo de `teste_estrutura_fiscal` criado e
removido pelo teste; rodada final às 23h52 Brasília, 3,65 s. A migration também
foi aplicada sobre conexão que já executara a projeção anterior. Comando:
`ESTRUTURA_FISCAL_BANCO_TESTE=1 vitest run testes/atividades/estrutura-fiscal-integracao.test.ts --maxWorkers=1`;
conexões UTC explícitas, identidade do banco/localhost conferida antes das escritas.
Regressão de consulta, registro, restrições financeiras e referência inicial:
**28/28 aprovados em quatro arquivos**, sem skip. Lint dos seis arquivos de
código/teste alterados e `git diff --check` aprovados. Nenhum script de recuperação,
negócio real, alteração produtiva ou transmissão fiscal foi executado nesta validação.

Em 10/10/2026, após o fechamento acima, o usuário autorizou a publicação desta entrega.
Conferência produtiva somente de metadados: PostgreSQL 16.15, 14 fontes presentes,
nenhuma migration incompleta, UUID disponível e conexão real da aplicação em `Etc/UTC`.
Backup privado pré-migration com leitura integral validada, imagem anterior e configuração
fiscal preservadas na VPS. Certificado permanece no banco; nenhum fallback foi reaplicado.
Dockerfile inclui os dois comandos administrativos no runner. Nenhum backfill/expurgo
será executado durante a publicação. Acompanhamento e smoke produtivo ainda em execução.
