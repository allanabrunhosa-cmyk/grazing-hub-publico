# Execução do módulo Vendas

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

## 09/10 — Vendas & CRM, Atendimento e cadastros únicos — em execução

- Aprovado nesta conversa: retirar o módulo CRM separado, renomear Vendas & Pedidos
  para Vendas & CRM e posicionar Atendimento após Gestor de pedidos; usar somente
  `ClienteVenda` como cadastro comercial de clientes, concentrar Equipe em Usuários &
  Permissões e retirar o slogan “Boa comida aproxima as pessoas”, incluindo a variante
  “Boa comida aproxima pessoas” do orçamento. Publicação autorizada; ainda pendente.
- HUB: worktree `.worktrees/pedidos-validacao-complementos-20261007`, branch
  `codex/vendas-crm-unificado-20261009`, base/HEAD inicial `0aeaa95b918d63b88ee05fe4694f3958a91d628d`.
  Commit funcional `01c0112`; integração `2812f292` com a main atual (`2e01d7ec`).
  Publicação do HUB permanece pendente neste registro.
- Implementado em `src/lib/modules.ts`, `src/components/layout/sidebar.tsx`,
  `src/app/(protegido)/vendas/page.tsx`, nova `vendas/atendimento/page.tsx`,
  `crm/page.tsx`, `src/components/atendimento/entrada-crm.tsx` e
  `src/lib/permissoes/catalogo.ts`: navegação consolidada e `/crm` redireciona para
  `/vendas/atendimento` depois da guarda. A chave histórica `crm` e suas concessões
  permanecem; mover o menu não concede acesso nem substitui autorização no servidor.
- `src/lib/vendas/resumo-pedido-a4.ts` remove o slogan do cabeçalho/rodapé e seu CSS;
  busca localizada em `src/public` não encontrou outra ocorrência textual. Logo oficial,
  proporções e estrutura A4 preservados. Central reutiliza GrupoNavegacao, BarraAcoes,
  Button/Link e EX-IMP-04, sem padrão novo. Documentos donos e prévia de navegação
  atualizados; imagens fictícias em `design-system/evidencias/2026-10-09-vendas-crm`.
- Atendimento tem frente separada: `.worktrees/atendimento-menu-rodape-20261009`,
  branch `codex/atendimento-clientes-unicos-20261009`, base `65740022e83abee0d56aae1e915e42adecb25449`.
  [Registro canônico na branch publicada](https://github.com/allanabrunhosa-cmyk/grazing-hub/blob/codex/atendimento-clientes-unicos-20261009/docs/features/donatella-crm/TASKS.md)
  e SPEC/PREVIA-INTERATIVA dessa branch conservam o contrato detalhado. Consulta/prévia
  apontam cadastros ao HUB; CRUD comercial e gestão de Equipe removidos. Identidades
  técnicas legadas e responsáveis permanecem para histórico, sem merge de dados,
  concessões, cookies ou alteração de banco. Não retomar duas bases comerciais nem
  importar as migrations antigas dessa branch para a main ao publicar seus aplicativos.
- Validação HUB conferida nesta frente: resumo A4 **6/6**; ESLint e design aprovados
  (**8 bases/353 consumidores**); lote layout/permissões/consumidores **309 aprovados,
  1 timeout de 5 s em `aprovarMcpAction`, 12 opt-ins/skips**. Não é aprovação integral.
  Typecheck inicial encontrou cliente Prisma local desatualizado; geração oficial apenas
  em `src/generated/prisma` (ignorado, físico na worktree) e repetição com 2048 MB passaram,
  sem alterar banco/schema/dependências ou a junction compartilhada de `node_modules`.
  Revisão integrada `2812f292` incorpora `origin/main` `2e01d7ec` sem conflitos;
  a bateria anterior na base inicial foi interrompida sem conclusão. A tentativa completa
  com threads terminou com falha nativa Windows `-1073741819`, sem resumo; não é aprovação.
  Repetição na revisão integrada usa `--pool=forks --maxWorkers=1 --reporter=default`,
  sem ampliar prazos. Reporter automático de agente imprime somente falhas e resumo;
  silêncio durante a execução não comprova sucesso nem travamento.
  **Resultado final integrado:** 297 arquivos/2.789 casos aprovados, 35 arquivos/562
  casos opt-in ou previamente ignorados; zero falhas, exit 0, 848,14 s em `2812f292`.
  As flags de integração em banco/serviços reais não foram ativadas. O caso inicial
  `aprovarMcpAction` e os consumidores de Clientes/Detalhe/Notas passaram nessa rodada.
  ESLint global repetido e lint:design (8 bases/353 consumidores) também passaram;
  `origin/main` reconferida em `2e01d7ec`; C: com 25,18 GB antes do build.
  Build webpack aprovado, incluindo tipos e rota `/vendas/atendimento`; avisos de
  streams no Edge via JOSE (`session-token.ts`, não alterado nesta frente) registrados
  no log, sem erro de compilação. Smoke compilado em loopback 3269: oito verificações
  aprovadas, login 200, seis rotas protegidas 307 para login e host inválido 421.
  Antes do envio, main avançou para `a540b87c` (PR #5). Integração `feeb79b4` preserva
  essas mudanças sem conflitos; revalidação do impacto novo: 24 arquivos/406 casos
  aprovados, 12 opt-ins ignorados, mais 7 casos da Central aprovados. Lint global/design
  novamente aprovados; C: 24,33 GB antes da recompilação. Não atribuir a bateria global
  da revisão anterior à nova main: essa revisão tem evidência focada e novo build/smoke.
  A descrição do Gestor em `modulos/vendas.md` foi alinhada ao contrato da Central
  já incorporado pela PR #5 (nove colunas, sem expansão), sem mudar seu comportamento.
  Recompilação webpack em `feeb79b4` aprovada (tipos incluídos); smoke local de oito
  verificações novamente aprovado na compilação final. Nenhum código funcional mudou
  após essa validação; alterações posteriores antes do envio são este registro documental.
- Resultados relatados pela frente isolada de Atendimento: **54 testes de servidor/estado
  e 12 de UI** aprovados; tipos, lint prévia/design e builds Vite consulta/prévia/servidor
  isolado aprovados. Novo teste de cadastros incluído no catálogo jsdom/React único da
  prévia. Publicação isolada do Atendimento concluída: funcional `49869b90`, evidências
  `f3242e33` nessa branch; 59 conferências HTTPS e quatro amostras saudáveis por 105,17 s.
  Assets e servidor da prévia preservados antes da troca; reiniciada apenas a prévia,
  consulta/coletor/banco mantiveram IDs, partidas e reinícios. CUA autenticado confirmou
  Clientes/Usuários no HUB e ausência de Equipe; imagem da prévia publicada registrada
  no documento canônico. Isso não comprova vínculo operacional dos contatos legados.
- Ambiente HUB: Node 22.23.3 em `.worktrees/clientes-publicacao-20261001/.tmp-cobranca-runtime/bin/node.exe`;
  `TEMP`/`TMP` e logs em `.tmp/vendas-crm-20261009` (ignorados). Comandos executados:
  `node node_modules/vitest/vitest.mjs run testes/vendas/resumo-pedido-a4.test.ts`;
  `node node_modules/eslint/bin/eslint.js`; `node scripts/verificar-tokens-design.mjs`;
  `node node_modules/typescript/bin/tsc --noEmit`. Prévia Atendimento: `node
  node_modules/vitest/vitest.mjs run --config apps/atendimento/preview/vitest.config.ts --maxWorkers 1`.
  Geração local: `node node_modules/prisma/build/index.js generate --config prisma7.config.ts`;
  build: `node node_modules/next/dist/bin/next build --webpack` (heap 3072 MB);
  smoke: `next start -H 127.0.0.1 -p 3269` e Python `.tmp/vendas-crm-20261009/smoke-local.py`.
- Pendentes no HUB: publicar
  o escopo integrado e verificar nova tarefa estável e UI autenticada. Backup privado
  `etiquetas-vendas-crm-20261009-a` já preparado/verificado por pg_restore catálogo/conteúdo
  (60.023.737 bytes); tag anterior `grazing-vendas-crm-anterior:20261009-a` e configuração
  fiscal preservadas. Não confundir o Atendimento publicado com publicação do HUB.
  Após a publicação alheia da PR #5, snapshot adicional da base imediatamente anterior
  conservado sem sobrescrever A: tarefa `qidy2eq1fmigrblnwn295i8t2`, imagem
  `sha256:c6741c59a94fc8391bf24b97c056d1e26187c39207bc0cc80f4a1ad664fe6b5b`,
  zero reinícios/163 s estável, tag `grazing-vendas-crm-anterior:20261009-b`.
  Nenhum teste criou ou alterou dados comerciais reais.

## 07/10 — pendências de pedido, escolhas por grupo e preço compacto

- Aprovado nesta conversa: falta na confirmação recebe destaque vermelho e
  foco/rolagem; mínimo/máximo valem para a soma do grupo; menos/campo/mais bloqueiam
  adição no teto e repetição proibida. Produtos usa preço menor, check ao lado apenas
  na edição, cancelamento ao sair e espaço antes do status. Publicação autorizada.
- Worktree `.worktrees/pedidos-validacao-complementos-20261007`, branch
  `codex/pedidos-validacao-complementos-20261007`, base `a49f33a6`. Checkout principal
  `codex/cardapio` conserva documentos locais preexistentes sem alteração desta frente.
- Implementado no editor de Pedido e simulador, helpers `escolhas-grupo` e
  `pedidos-pendencias`, componentes `QuantidadeEscolha`/`MensagemPendenciaFormulario`,
  `preco-produto`/coluna de Produtos. Marcadores nos formulários compartilhados de
  endereço/cobrança/vencimento não alteram os dados. Sem migration/dependências novas.
- Central reutiliza Button, Input, CurrencyInput, AcoesEdicao somenteConfirmar,
  SlotComplemento e estados de erro existentes. Duas composições novas documentadas
  e demonstradas no catálogo tipado, Em revisão visual. Não reintroduzir controles
  por opção que ignorem o saldo do grupo, check/X em repouso ou gravação no blur.
- Conferido agora em prévia Vite com dados fictícios: pagamento/Tipo recebem foco,
  vermelho e rolagem; grupo recolhido abre após liberar o fieldset da operação; teto
  bloqueia adição nas duas opções e diminuir libera vaga. Preço 128 px, check a 8 px,
  centros coincidentes; clique fora restaura preço sem gravação. Evidências sintéticas
  em `docs/design-system/evidencias/2026-10-07-pedidos-produtos`.
- Ambiente local: Node 22.23.3, runtime instalado conforme lock atual reutilizado por
  junção (sem alterar o lock); cliente Prisma gerado e `next typegen` executado.
  Typecheck e ESLint global/design aprovados (8 bases/337 consumidores).
- Regressão ampla: 100 arquivos, 723 testes aprovados, 10 falhas e 149 opt-ins/skips.
  Quatro expectativas antigas foram adaptadas à regra aprovada (sem X/check em repouso,
  cancelamento no blur e sem repetição). Correção de foco pós-fieldset tem teste próprio.
  Nova execução dos oito consumidores envolvidos: 99/99 aprovados, inclusive os três
  arquivos sem alteração que falharam inicialmente; sem ampliar timeout. Ajuste final
  para comparar o valor monetário, em vez da representação textual: três arquivos/11
  testes aprovados, incluindo redigitar o mesmo preço sem mostrar check/gravar.
- Responsivo conferido por DOM em Chrome, viewport efetivo 434×938: preço/quantidade
  das opções e seus botões têm 44 px e o mesmo eixo. Captura móvel ficou sem evidência por timeout do
  navegador; as imagens preservadas são somente desktop e sintéticas. Overrides removidos.
- Build local inicialmente falhou por ENOSPC. Removido apenas `.next/cache/webpack`
  desta worktree (gerado nesta validação); nova execução desativa `config.cache` só
  localmente. A sessão dessa tentativa encerrou sem resultado; configuração restaurada
  e conferida contra HEAD. Build remoto não executado: revisão automática rejeitou
  exportação do repositório. Depois de recuperar espaço, build **padrão local** de
  `a58d180ad2e950ee3967734c9153c632a226bc9f` aprovado, sem ajuste de NextConfig.
  Não integrar ajustes de ambiente nem limpar caches/arquivos de outras frentes.
- Comandos: `node node_modules/vitest/vitest.mjs run testes/vendas testes/design-system
  testes/layout/central-design-navegacao.test.tsx --maxWorkers=1`; `node
  node_modules/next/dist/bin/next typegen`; `node node_modules/typescript/bin/tsc
  --noEmit`; `node node_modules/eslint/bin/eslint.js`; `node scripts/verificar-tokens-design.mjs`.
  Prévia: `node node_modules/vite/bin/vite.js --config testes/visual/pedidos.vite.config.mts`
  (4231) e `vendas.vite.config.mts` (4218), só localhost, ações simuladas e sem banco.
- Finalizado localmente: typecheck e lint focado finais aprovados; build webpack/Node
  22 padrão aprovado em 08/10. Smoke compilado: login 200; Novo Pedido, Produtos,
  Clientes/Canais 307 para login sem sessão; host desconhecido 421. Processo local
  encerrado após o smoke. Sem operações comerciais ou SQL de teste em produção.
- Salvaguarda privada `etiquetas-pedidos-validacao-20261007-a`: dump de 59.774.469 bytes,
  catálogo e conteúdo íntegros via pg_restore; SHA256
  `82d3625b1845c0616c8a684af5d48551e3d5944e78af624e0e55a62b1423ae06`.
  Imagem/configuração anterior preservadas; tag `grazing-pedidos-validacao-anterior:20261007-a`.
- Integração e publicação aguardam atualização da main e verificação da nova tarefa.
  Não considerar build como publicação. Opt-ins SQL não executados (sem mudança de servidor/schema).

## 05/10 — proporções e espaços no telefone

- Pedido aprovado: telefone menor e e-mail maior, com apresentação `+55 (11) 97658-6412`. Implementação compartilhada em `CamposClientePedido`: grade desktop 4/5/3 para telefone/e-mail/nascimento; aplica-se a Clientes e Novo Pedido, PF/PJ. `CampoTelefone` atualiza placeholder e validação HTML nos dois telefones. Armazenamento permanece normalizado, sem migration.
- Reutilizados Campo, Input, grade responsiva e máscara existente; nenhum padrão novo. Central/documento de Vendas atualizados. Não reduzir altura dos controles nem introduzir margens locais para compensar alinhamento.
- Executado nesta sessão, Node 22.23.3: cinco arquivos/56 testes focados de telefone, Clientes, Pedido, endereços e sincronização aprovados; ESLint global, design (8 bases/321 consumidores) e typecheck aprovados na base inicial. Comandos: `node_modules/vitest/vitest.mjs run testes/vendas/telefone.test.ts testes/vendas/clientes-campos-interface.test.tsx testes/vendas/pedidos-interface.test.tsx testes/vendas/pedidos-endereco-interface.test.tsx testes/vendas/clientes-pedidos-sincronizacao.test.ts --maxWorkers=1`; lint/tipos conforme comandos da revisão abaixo.
- Prévia fictícia Vite, desktop 1280×720: telefone 305,86 px, e-mail 385,34 px e mesmo eixo vertical em PF/PJ; oito/nove dígitos formatados. Móvel 390×844: sem extravasamento horizontal. [Desktop](features/pedidos/evidencias/20261005-telefone-espacos-desktop.jpg), [móvel](features/pedidos/evidencias/20261005-telefone-espacos-mobile.jpg). Referências Em revisão; viewport restaurado, sem gravação real.
- Trabalho na worktree `.worktrees/novo-pedido-telefone-credito-20261005`, branch `claude/novo-pedido-telefone-credito-20261005`. A main avançou de `afc04d40` para `59dbdeb5` (Financeiro) durante a revisão: preservar e integrar antes do build final. Build inicial interrompido intencionalmente para validar a revisão integrada; publicação ainda pendente neste registro.
- Salvaguarda privada `etiquetas-telefone-espacos-20261005-a`, dump 59.524.148 bytes, catálogo/conteúdo pg_restore aprovados, SHA256 `003aefb75cfe74887d3d7170de8a6dcf669f9be1c57c7d89177a476827945f54`. Imagem anterior `grazing-telefone-espacos-anterior:20261005-a`, tarefa `8q670tm84lrhm8xh57fhg7p8a`. Primeira leitura coincidiu com transição de contêiner; segunda leitura com um contêiner concluiu a verificação. Snapshot/configuração fiscal privados, sem valores de credenciais.
- Revisão funcional `98b2150`, integração sem conflitos `f897d3fd` com `59dbdeb5`. Typecheck repetido e build webpack aprovados na revisão integrada; 18 testes da interface de faturas recebida também aprovados (74 casos distintos com os 56 focados). Smoke compilado porta 3253: login 200, rotas protegidas 307 para login e host inválido 421. Comandos adicionais: `node_modules/vitest/vitest.mjs run testes/financeiro/faturas/conciliacao-interface.test.tsx --maxWorkers=1`, `next build --webpack`, `next start -H 127.0.0.1 -p 3253`. Logs `.tmp-telefone-espacos-*` ignorados. Integrações de banco não repetidas para esta mudança de apresentação; produção ainda pendente deste registro.

## 05/10 — revisão e publicação da implementação do Claude

- Encontrados `925e8fc8` (implementação) e `2cedf40e` (documentação) na worktree `.worktrees/novo-pedido-telefone-credito-20261005`, branch `claude/novo-pedido-telefone-credito-20261005`, sobre `87c5eed0`. Antes desta revisão, não integrados à main e migration ausente em produção. Checkout principal e alterações alheias preservados.
- Reutilizada a implementação: `CampoTelefone`/Input oficial nos dois telefones e em Clientes; máscara brasileira de oito/nove dígitos, categoria derivada do canal no servidor e resumo de limite disponível/em aberto em `text-xs` no rodapé de Informações gerais. Não confundir limite para dívida com saldo da carteira: novo pedido não aplica saldo da carteira automaticamente. Pagamento continua obrigatório na confirmação. Condição explícita permanece somente para contratos históricos versão zero; não aparece em Novo Pedido.
- Complemento opcional já publicado em `15ac9481`: mantido em cobrança/entrega, rótulo explícito e ausência de `required`, com validação equivalente no servidor. Nenhum padrão visual novo; reutilizados `CadastroClientePedido`, `CamposEnderecoPedido`, Campo, Input e tokens da Central.
- Ajuste da revisão: validação do telefone opcional rejeita letras/excesso de dígitos/DDI não brasileiro, em vez de validar um número silenciosamente truncado pela máscara. Regressão acrescentada em `testes/vendas/telefone.test.ts`; máscara da digitação/colagem e armazenamento compatível preservados.
- Conferência produtiva anterior somente leitura/agregada: dois clientes com limite nulo, zero limites manuais distintos de 50000, zero canais sem categoria e migration nova não aplicada. O registro do Claude abaixo relata decisão sobre limites preexistentes; nenhuma nova inferência de categoria, quitação ou saldo real foi feita nesta revisão.
- Validação **executada nesta revisão**, Node 22.23.3: 110 arquivos/1.029 testes aprovados na bateria de Vendas, permissões, Central, componentes e layout; mais quatro arquivos/sete casos de padrões operacionais aprovados (**1.036 distintos**). O lote geral pulou 160 casos opt-in; cinco integrações PostgreSQL foram executadas separadamente, com **132 aprovados** (122 no lote inicial e dez na repetição da guarda que exigia também `PEDIDOS_AMBIENTE_ISOLADO=1`). Não somar a repetição focal de oito testes de telefone ao total distinto.
- Integrações em cluster PostgreSQL 17 exclusivo `.tmp-telefone-credito-pg`, loopback 55486, banco `teste_telefone_credito_codex_20261005`, UTF-8/locale C, schemas temporários. Flags `PEDIDOS_BANCO_TESTE`, `VENDAS_BANCO_TESTE`, `ENTREGAS_BANCO_TESTE` e `PEDIDOS_AMBIENTE_ISOLADO` somente nos testes. Guardas preservadas; nenhum teste sobre produção. Migration exercitada novamente com quatro clientes fictícios antigos: três alterações auditadas/versão+1, valor já padronizado intacto, novo cliente com 50000 por default SQL.
- ESLint do código publicável/configurações, design (8 bases/321 consumidores), typecheck integral e Prisma validate aprovados; client já gerado pelo Claude para este schema. Build webpack aprovado; avisos de middleware/proxy e Edge Runtime não tratados como refatoração desta tarefa. Smoke compilado, porta local 3253: login 200; Novo Pedido/Clientes/Canais/Financeiro sem sessão 307; host não autorizado 421.
- Prévia Vite com ações/CEP fictícios: telefones de oito/nove dígitos, crédito no rodapé, ausência da seção financeira nos novos pedidos, ambos complementos opcionais; desktop 1280×720 e móvel 390×844 sem extravasamento horizontal. [Desktop](features/pedidos/evidencias/20261005-telefone-credito-desktop.jpg), [móvel](features/pedidos/evidencias/20261005-telefone-credito-mobile.jpg). Capturas somente com telefone fictício; viewport restaurado. Referências Em revisão visual.
- Comandos: Node 22 em `.worktrees/clientes-publicacao-20261001/.tmp-cobranca-runtime/bin/node.exe`; `node_modules/vitest/vitest.mjs run testes/vendas testes/permissoes testes/design-system testes/componentes testes/layout --maxWorkers=1` e lote `testes/padroes`; integrações `pedidos-integracao`, `pedidos-financeiro-integracao`, `clientes-regras-pagamento-integracao`, `entregas-integracao`, `integracao` em `testes/vendas`. `node_modules/eslint/bin/eslint.js src testes scripts *.ts *.mjs *.mts`, `scripts/verificar-tokens-design.mjs`, `node_modules/typescript/bin/tsc --noEmit`, `node_modules/prisma/build/index.js validate --config prisma7.config.ts`, `node_modules/next/dist/bin/next build --webpack` e `next start -H 127.0.0.1 -p 3253`. Heap 1536 MB nos testes/lint, 2048 MB em tipos/build. Logs/auxiliares `.tmp-telefone-credito-*` ignorados; valores de credenciais não registrados.
- Backup privado `etiquetas-telefone-credito-20261005-a`, 59.523.878 bytes, catálogo/conteúdo integral pg_restore aprovados, SHA256 `a6b61ed892b5cadac2a1706118b99964be95259a6a3558142de86fd43e41b7b2`. Imagem anterior `grazing-telefone-credito-anterior:20261005-a`, configuração fiscal preservada. Publicação autorizada pelo usuário nesta sessão; resultado e estabilidade pós-deploy serão registrados separadamente. Sem confirmação comercial, cobrança ou impressão real para testar.
- **Publicação concluída nesta sessão:** `afc04d400a242b3894cf9f64f319d08a414e0cc4` enviado por fast-forward a `main`, remoto confirmado. Tarefa `h4gi7dbgidw4vlg9geiu25foc`, contêiner `2deb62b80f9d`, imagem `sha256:d74f8f8d9bbe073a36acf25a51010fa263d432d28424adf9226f1e2b1d3d30a0`, Running por 124 segundos, zero reinícios. Migration nova concluída e banco atualizado; dois clientes com limite padrão e dois históricos da migration. Fonte fiscal banco, certificado/configuração preservados, sem consulta externa.
- Pós-deploy HTTPS: login 200 no HUB e no host Pedidos; Novo Pedido/Clientes/Canais/Financeiro no HUB e Novo Pedido dedicado sem sessão 307 para login. Chrome autenticado, formulário vazio: exatamente dois `input[type=tel]`, crédito inicial de R$50.000 no rodapé, seção de condição financeira ausente e dois complementos rotulados opcionais/sem `required`. Captura produtiva local ignorada `.tmp-telefone-credito-publicado.jpg`; nenhuma seleção, alteração cadastral ou gravação de pedido real para esse smoke. Prévia, aplicação compilada e banco isolado encerrados.
- Evidência pós-publicação versionada somente na branch da frente, sem outro push/deploy da main por documentação. Limites: não houve confirmação comercial real nem homologação de boleto, captura de cartão, fiscal ou impressão física; testes isolados não são essas operações externas.

## 05/10 — Novo Pedido: telefone único, categoria pelo canal e crédito do cliente

- Base `origin/main` `87c5eed0`, branch `claude/novo-pedido-telefone-credito-20261005` (Claude Code), worktree próprio. Não publicado.
- Pedido do usuário: (1) DDI, DDD e telefone em um campo formatado `+55(11)97658-6412`, 8 ou 9 dígitos, nos dois telefones; (2) retirar a condição financeira da confirmação, categoria de receita implícita no canal e crédito do comprador em letras pequenas ao fim de Informações gerais, com R$ 50.000 iniciais em aberto por cliente; (3) complemento opcional.
- Decisões do usuário nesta tarefa: o limite de R$ 50.000 vale para **todos** os clientes, sobrescrevendo também limites manuais; o abatimento do saldo de crédito do cliente na confirmação é retirado. Isso reverte a parte de `b68fafde` que tirava a categoria do canal; preço único continua.
- Item 3 já estava no código desde `15ac9481`; `pedidos-novo-formulario.test.ts` ainda exigia complemento e falhava na main, corrigido para o contrato vigente. Se a produção ainda mostrar `*`, conferir revisão publicada/cache.
- Impactos conhecidos: rascunhos HUB versão 0 continuam com condição explícita; pedidos HUB sem títulos que forem revisados com aumento de total passam a esbarrar no limite (mensagem existente). Telefone de destinatário antigo incompleto é lido como estava, mas precisa ser corrigido ao salvar. Canal sem categoria impede confirmar até configurar em Canais de venda.
- Validação local (Node 22.23.3): typecheck, ESLint (src/testes/scripts/configs, 0 erros), lint:design (8 bases/321 consumidores), Prisma validate/generate. Vitest de Vendas/permissões/Central/componentes/padrões/layout: 114 arquivos, 1.035 aprovados, 160 pulados (opt-in). Integrações PostgreSQL 17 em cluster descartável local (`teste_novo_pedido_20261005`, schemas temporários, flags PEDIDOS/VENDAS/ENTREGAS_BANCO_TESTE): 5 arquivos, 132 aprovados. Migration exercitada também sobre clientes fictícios pré-existentes (nulo, 1000, 0, 50000): três atualizados com histórico e versão+1, o já padronizado intacto, novo cliente nasce com 50000.
- Não executado: build de produção, smoke HTTP, prévia visual no navegador (a ferramenta de preview iniciou o `next dev` do checkout principal; foi parado em ~10 s sem interação e sem alterar arquivos), dados reais, produção. Referências visuais Em revisão.

## 05/10 — preço único e canal como origem

- Base `518f9b51`, branch `codex/preco-unico-20261005`, checkout isolado. Publicação autorizada. Consolidação escolhida pelo usuário: Site vigente, incluindo promoção; na ausência, valor disponível.
- `ProdutoVenda.preco` torna-se o único preço comercial. Migration aditiva `20261005120000_preco_unico` audita antes/depois, conserva zero explícito, aumenta revisão e mantém arquivo legado; nenhum pedido anterior é alterado pela migration.
- Produtos/Complementos, cadastro, edição inline, simulador, ficha de configuração, importação e pedidos usam o contrato único. Canal conserva somente origem/relatórios. Categoria de receita é explícita no pedido; trocar canal não reclassifica títulos. Itens comerciais inalterados conservam valores/composição históricos durante revisão.
- Regressão geral: 259 arquivos/2.253 testes aprovados. Quatro integrações pararam nas guardas de nome da base antes de testar; recriada a base local com prefixo `teste_`, os quatro arquivos/28 casos passaram. Outros 22 arquivos/262 casos opt-in não foram executados. Flags exercidas: VENDAS_BANCO_TESTE, PEDIDOS_BANCO_TESTE, ENTREGAS_BANCO_TESTE e PEDIDOS_AMBIENTE_ISOLADO. Sem dados/efeitos externos reais.
- Ajuste final do editor: identificação do item histórico por ID após remover outra linha; rótulos de escolhas preservam o preço do snapshot. Revalidação focal final: dois arquivos/25 casos aprovados. O total de casos distintos verificados é 2.282; não somar reexecuções aos testes da regressão.
- ESLint global aprovado; lint dos dois arquivos finais novamente aprovado. lint:design (8 bases/320 consumidores), typecheck completo, Prisma validate/generate, migration isolada e build webpack/Node 22 aprovados. Build/types/smoke repetidos após o último ajuste da tela. Login 200; rotas Produtos, Complementos, Canais, Pedidos e Financeiro sem sessão 307; host não autorizado 421. Prévia fictícia desktop/móvel sem erros de console ou transbordamento, com um único preço e editor de canal sem categoria financeira. Referências visuais Em revisão.
- Salvaguarda privada `etiquetas-preco-unico-20261005-a`: dump de 59.512.508 bytes, catálogo/conteúdo íntegros, SHA256 `b49b9f407aa2103f79a9c301e9b0b4fd06136ac590e7da3336d754f25a1a5b7b`. Imagem `grazing-preco-unico-anterior:20261005-a` e configuração fiscal preservadas. Verificação autenticada pela sessão existente do Chrome depende da recuperação da conexão da automação, que falha antes de abrir a aba; navegador alternativo exige login. Publicação autorizada pelo usuário.

## 05/10 — complementos em linhas compactas de largura inteira

- Base `61971d7e`, branch `codex/complementos-linhas-20261005` em checkout isolado.
  Publicação autorizada pelo usuário; trabalho alheio preservado.
- Conteúdo aberto do grupo sai da coluna do título e ocupa toda a largura abaixo
  do cabeçalho. Linha compartilhada por Produtos/Grupos mantém nome, preço,
  status e X no mesmo eixo; composição abre abaixo. Em telas estreitas, rolagem
  interna preserva a linha. Sem mudança de cálculo, banco ou salvamento explícito.
- 23 testes de interface aprovados, incluindo abrir/fechar por Enter/Espaço,
  preservação do preço em edição e ausência de gravação automática.
- Prévia fictícia de Charcutarias: seis opções; cartão mede a largura do conteúdo
  do grupo (699,56 px), altura 53,78 px e centros dos controles no mesmo eixo.
  Em viewport efetivo de 434 px, cartão/área de opções medem 316,44 px e os controles
  continuam no mesmo eixo; composição expandida permanece abaixo. Override removido.
  Referência visual Em revisão.

- Regressão de Vendas: 74 arquivos/628 testes aprovados; sete arquivos/138 opt-ins
  de banco ignorados. ESLint completo e lint:design (8 bases/319 consumidores)
  aprovados. Editor de Grupos também conferido: seis opções em linhas de 53,78 px,
  controles no mesmo eixo. Cliente Prisma local regenerado para o schema existente
  após detectar tipos locais desatualizados; nenhuma alteração de banco/schema.
- Salvaguarda privada `etiquetas-complementos-linhas-20261005-a`: dump de 59.456.098
  bytes; catálogo/conteúdo íntegros; SHA256
  `e0f4eb53ac27e00e83d1930609370fe4d72085b7a46a614feb49370ea841dc9f`.
  Configuração fiscal e imagem anterior preservadas.
- Typecheck completo e build webpack/Node 22 aprovados após regeneração local.
  Smoke compilado: login 200; Produtos e Complementos 307 para login sem sessão,
  com Host coerente. Sem dependências, migrations ou operações reais para teste.

## 04/10 — leitura e distribuição da ficha técnica

- Base integrada `bb8f1799`; mesma branch/worktree isolada das fichas. Foto ampliada
  de 66 para 90 mm na largura; categorias do produto, tempo de preparo e observações
  ficam na coluna da foto. Nomes de ingredientes passam a 13 pt; categoria tem coluna
  separada entre ingrediente e porção, em 8 pt/cor secundária. Especificação mantida
  sob o ingrediente; ordem, visibilidade e quantidades preservadas.
- Mesma geração para ficha-mestre/configuração, prévia/PDF, com ajuste automático
  para uma folha A4 paisagem. Sem mudança em dados, grupos, schema ou autorização.
  Publicação autorizada pelo usuário para este incremento.
- Testes focados: quatro arquivos/24 testes aprovados, incluindo posição das
  informações de produção, quatro colunas, textos escapados e estado vazio.
  ESLint focado e lint:design (8 bases/316 consumidores) aprovados.
- Seis PDFs fictícios regenerados, incluindo ficha com 12 ingredientes, observações
  extensas, nomes longos, 120 ingredientes e configuração com 40 escolhas. Todos
  têm uma página A4 paisagem, sem corte e com conteúdo final/rodapé presentes.
  Chromium/pypdf/Poppler conferidos; fichas extremas reduzem a escala para caber.
  Referência visual Em revisão; nenhuma homologação de impressora física.
- Regressão de Vendas: 73 arquivos/610 testes aprovados; sete arquivos/137 opt-ins
  de banco ignorados. A primeira compilação detectou campos obrigatórios ausentes
  na categoria fictícia do teste; completados sem mudar código funcional ou asserções.
  Consumidor de foto/ficha revalidado (3/3).
- Build webpack com Node 22 e checagem de tipos da compilação aprovados. Smoke
  compilado: login 200 e Produtos 307 para login sem sessão, com Host coerente.
  Typecheck completo separado (`tsc --noEmit --incremental false`) também aprovado.
  Sem dependências novas, migration ou uso de dados operacionais para teste.
- Salvaguarda privada `etiquetas-ficha-layout-20261004-a`: dump 41.668.158 bytes,
  catálogo/conteúdo conferidos; SHA256
  `d337c9d0a70e9cc2448b43e1c3fdc974c45760bb96ac0f2d5154a3a9e07c5cf7`.
  Configuração fiscal e imagem anterior preservadas, sem restauração de banco.

## 04/10 — refinamento das margens e ação da composição

- Branch `codex/composicao-espacamento-20261004`, continuidade do componente
  compartilhado publicado em `f713e4d2`. Checkout isolado limpo; alterações alheias
  preservadas. Publicação autorizada nesta solicitação.
- Margens laterais de 12px para 8px, respiro nome/FM de 4px para 12px e coluna de
  Custo de 72px para 56px. X oficial centralizado em área com altura do controle;
  mantém tamanho acionável, nome acessível e comportamento neutro/vermelho.
- Central: mesmos componentes e tokens, sem padrão/variante nova. Grade do
  cabeçalho e das linhas permanece igual; nenhuma alteração de cálculo/salvamento.
- 61/61 testes dos consumidores aprovados. Comparação isolada em 720px reproduziu
  o X 4px acima e confirmou diferença zero após o ajuste nas seis linhas, inclusive
  nomes longos. Imagens em 720px, 1040px (Insumos) e 390px: sem transbordamento;
  seis eixos do cabeçalho alinhados com diferença inferior a 1px em desktop.
- Integrada a main `cc906268` (ficha A4), preservando ambos os registros no único
  conflito documental. Na revisão integrada, 77/77 testes de seis consumidores
  aprovados, incluindo ficha/configuração. Lint focado, lint:design (8 bases/316
  consumidores) e typecheck aprovados. Backup privado íntegro em
  `etiquetas-composicao-espacamento-20261004-a`; primeira conferência aguardou a
  transição da publicação concorrente, sem sobrescrever salvaguardas.
- Build webpack/Node 22 aprovado, com os avisos existentes de middleware/Edge.
  Smoke compilado: login 200, Produtos/Insumos 307 para login sem sessão. Servidores
  isolados encerrados; nenhum dado real editado para validar a interface.

## 04/10 — ficha técnica sem grupos e alternativas

- Base `ab46ddb4`, branch/worktree `codex/ficha-producao-sem-alternativas-20261004`;
  checkout principal preservado. Removido o anexo de grupos/alternativas de
  `src/lib/vendas/ficha.ts` e sua quebra de página; prévia, impressão e PDF usam
  o mesmo documento. Descrição da prévia e rodapé ajustados ao conteúdo atual.
- Preservados foto, composição fixa, ordem/visibilidade dos ingredientes, porções,
  quantidades, categorias, tempo de preparo e observações. Configuração de exemplo
  mantém as escolhas efetivas e composição resolvida. Nenhuma alteração em grupos
  cadastrados, preços, persistência, schema ou dados operacionais.
- Node 22: build webpack com tipos, lint focado, lint:design (8 bases/316
  consumidores) e diff aprovados. Smoke local compilado: login 200 e Produtos 307
  para login sem sessão. Geração do cliente Prisma somente local, sem banco.
- Regressão de Vendas: 72 arquivos/604 testes aprovados, 7 arquivos/137 opt-ins
  ignorados. Rodada focada: 36 aprovados e um timeout de categorias sob execução
  concorrente; interface isolada passou 19/19 sem alterar limites ou asserções.
- Prévia sintética padrão/personalizada conferida, sem anexo; imagem local
  `.tmp-ficha-previa.png`. Em 390 px, conteúdo e ações conferidos pelo DOM;
  captura móvel indisponível por timeout do navegador, sem homologação visual móvel.
  Referência visual Em revisão.
- Publicação autorizada pelo usuário com exigência de uma folha A4 paisagem.
  Incremento `ficha-a4.ts`: escala por largura/altura reais, recalculada em load,
  fotos/fontes e beforeprint; iframe usa o mesmo cálculo com scripts bloqueados.
  Não há escala mínima que possa cortar conteúdo. Área 281 × 193 mm, margens
  de 8 mm e reserva vertical de 1 mm. Prévia adapta sua largura à tela.
- Seis PDFs de fixtures fictícias (vazia, comum, observações longas, nomes longos,
  120 ingredientes e configuração com 40 escolhas): uma página A4 paisagem cada,
  conteúdo final e rodapé presentes. Chromium mediu todos dentro da página;
  pypdf conferiu paginação/texto e Poppler renderizou para inspeção visual.
  Fichas muito extensas terão fontes menores; impressão física não homologada.
- Incremento: 37 testes focados aprovados. Primeira compilação encontrou import
  sem tipos de jsdom no teste; corrigido usando o ambiente jsdom já configurado,
  sem dependências novas. Revisão final integrada com `f713e4d2`: build/tipos,
  lint focado, lint:design, smoke login 200/Produtos 307 e 70 testes dos seis
  consumidores afetados aprovados. Conflitos apenas documentais resolvidos
  preservando ambos os registros. Funcionais `ec8e244` e `095492e`.
- Salvaguarda privada `etiquetas-ficha-a4-20261004-a`: dump 41.668.034 bytes,
  catálogo/conteúdo conferidos; SHA256
  `feb64c7e2e68edb7ab7f0bb4476d2801ef77486212821682f65f025616cfbc2f`.
  Imagem `grazing-ficha-a4-anterior:20261004-a` e configuração fiscal preservadas.
- Publicado em `main` na revisão `cc906268`; task
  `qhf7mjfcvkx58t6da1bwbifpc`, container `6531c5a8b02b`, estável por 163 s,
  sem reinícios. Hashes de `ficha.ts`/`ficha-a4.ts` conferidos na imagem em execução;
  migrations atualizadas, configuração fiscal e certificado preservados.
  HTTPS: login 200, Clientes/Produtos/Pedidos protegidos por sessão (307).
  Prévia autenticada padrão e personalizada: conteúdo dentro da área, sem anexo.
  Página de impressão padrão também ajustada; captura completa local
  `.tmp-ficha-a4-publicada-completa.png`. Nenhum dado salvo na conferência.
  Registro pós-publicação enviado somente à branch de trabalho.

## 04/10 — largura do ingrediente na composição

- Base `ab46ddb4`, branch `codex/composicao-nome-ingrediente-20261004`; checkout
  isolado, preservando alterações alheias. Publicação autorizada nesta solicitação.
- Grade compartilhada de `ComposicaoPicker` reserva o espaço restante ao nome,
  compactando Porção, Descrição e Custo. Qtd. conserva sua largura e unidade fixa.
  Nome permite duas linhas e título completo; inclusão/cabeçalho/linhas alinhados.
- Reutilizados os componentes existentes da Central, sem novo padrão ou variante.
  Contrato registrado no guia de Insumos e no inventário. Sem mudança de cálculo,
  salvamento, banco, dependência ou operação em dados reais.
- Testes dos quatro consumidores próximos: 61/61 aprovados. Imagens sintéticas
  de Produtos e Insumos em 720px/1040px e celular 390px; sem transbordamento.
  Em 720px, coluna do ingrediente passou de 164px para 233px (aproximadamente 42%).
  Conferência da grade em desktop confirmou os seis eixos com diferença inferior a 1px.
- Lint focado, lint:design (8 bases/316 consumidores), geração de tipos, typecheck
  e build webpack com Node 22 aprovados. Build manteve os avisos existentes de
  middleware e APIs de `jose` no Edge. Smoke da compilação com Host e cabeçalho
  encaminhado coerentes: login 200; Produtos/Insumos 307 para sessão. Prévia e
  servidor local encerrados. Backup privado íntegro, imagem/configuração preservadas
  em `etiquetas-composicao-nome-ingrediente-20261004-a`, sem restauração de dados.
- Publicado o funcional `f713e4d2` na main. Nova tarefa
  `0arm9c70cpa9plbwud7whe6sc`, contêiner `0ead599e439c`: imagem nova, Running
  por 83 segundos, zero reinícios, migrations atualizadas e configuração fiscal
  preservada. HTTPS: login 200; Produtos/Insumos/Central protegidos com 307.
  Navegação autenticada conferiu Produtos e Insumos; composição do produto abriu
  sem salvar dados. Nome passou de 176px para 256px no editor real, com cabeçalho
  e linhas alinhados. Registro pós-deploy enviado somente à branch de trabalho.

## 03/10 — impressão de pedidos em bobina de 80 mm

- Base `e0879782`, branch/worktree `codex/impressao-pedidos-80mm-20261003`;
  publicação autorizada pelo usuário. Checkout principal preservado. Sem schema,
  migration, dependência nova, alteração comercial ou gravação de dados reais para testar.
- Gestor/Quadros e produção/resumo operacional compartilham `htmlComandaPedido`
  em `src/lib/vendas/impressao-pedido.ts`. 80 mm padrão, área útil 72 mm e margens
  de 4 mm; altura contínua escolhida no driver, sem declarar `80mm auto` inválido.
  Produção mantém opção A4. Preto/branco sólido destaca número, data civil/janela,
  quantidades/unidades e observações gerais/dos itens. Preservados revisão, orçamento,
  cancelamento e restrição de dados pessoais/financeiros na comanda de produção.
- Corrigida a seleção explícita das observações dos itens na rota de produção.
  Impressão comercial preserva unidade do produto/snapshot, inclusive KG fracionado.
  Não há novos efeitos em pedido, financeiro, estoque ou fiscal.
- Central: Button default/outline, aria-pressed, Dialog e feedback existentes;
  documento físico reutiliza o contrato térmico já presente em Compras, com template
  compartilhado para Vendas. Novo contrato documentado no inventário como EX-IMP-02,
  restrito à impressão; nenhuma variante administrativa ou token novo. Em revisão visual.
- Validação: Vendas 584 aprovados/135 opt-ins ignorados; rodada final de impressão,
  agenda, Quadros, Gestor e guarda/projeção da comanda, 53/53 aprovados. Após acrescentar
  asserção de unidade fracionada no Gestor, 33/33 aprovados nesse consumidor. Tipos,
  lint focado e lint:design (8 bases/315 consumidores) aprovados. Primeira rodada
  encontrou cliente Prisma ausente no checkout isolado; geração local resolveu, sem
  aplicar migrations ou acessar banco. Contrato de atendimento nullable ajustado.
- Prévia sintética: comanda comercial/produção, retirada, A4, texto longo, quantidade
  fracionada, 320 px e documento com 100 itens. Área útil observada 272,125 px (72 mm),
  scrollWidth 272 px; documento móvel 320/320 px, último item/rodapé preservados.
  Imagens `.tmp-impressao-comercial.png`, `.tmp-impressao-producao.png` e
  `.tmp-impressao-320.png` inspecionadas. Impressora física/corte não homologados.
- Backup privado `etiquetas-impressao-pedidos-80mm-20261003-a`, 41.659.780 bytes;
  catálogo e conteúdo conferidos por pg_restore, sem restaurar banco. SHA256
  `8066cad6df75735ff50e5b2f249d86c7003521ac99e2753a8af7c65d06ca5153`.
  Build webpack/tipos aprovados; smoke compilado local: login 200, Gestor, Novo Pedido
  e comanda 307 para login sem sessão. Avisos existentes de jose/Edge não impediram
  a compilação. Prévia local encerrada após a conferência. Evidência pós-deploy ficará
  na branch de trabalho, sem publicar novamente apenas para atualizar este registro.

## 03/10 — atualizar cliente ao salvar orçamento ou confirmar pedido

- Base `5a6ace30`, branch/worktree `codex/clientes-edicao-pedido-20261003`;
  preservado o checkout principal com trabalho alheio. Publicação autorizada pelo usuário.
  Escopo: cadastro compartilhado, salvamento de orçamento, consumidores e documentação;
  sem schema, migration, dependência nova ou operação sobre dados reais para testar.
- Cliente selecionado permite editar informações gerais com permissão de editar Clientes.
  E-mail fica somente leitura no pedido e protegido no servidor, inclusive contra payload
  alterado. Novo cliente continua permitindo informar seu primeiro e-mail.
- Alterações explícitas de cobrança e, conforme escolha do usuário, destinatário/endereço
  de entrega padrão também atualizam o cadastro. Só trocar a aba ou selecionar um cliente
  não grava dados. Modo, data, janela, frete e pagamento permanecem informações do pedido.
- Cadastro, orçamento e auditoria são gravados na mesma transação, com trava compartilhada,
  revisão cadastral e idempotência. Falha do salvamento desfaz a atualização. Repetição de
  operação devolve ID/revisões originais, sem aproveitar revisões de alterações posteriores.
  Confirmação segue o salvamento do orçamento e fotografa os dados atuais; vendas anteriores
  conservam seus snapshots. Status, observações e regras cadastrais não expostos são preservados.
- Central: CamposClientePedido/CadastroClientePedido, Input readOnly, Select, Campo,
  CobrancaClientePedido/Tabs e os botões/diálogo existentes; nenhum token, variante ou padrão
  visual novo. Prévia sintética PF/PJ em 1280px e PF em 390px, editando nome e conferindo
  e-mail travado. Documento e diálogo sem transbordamento horizontal; referências Em revisão.
- Validação: Vendas 580 aprovados/135 opt-ins ignorados; rodada final com M1/M2, regras de
  clientes e validadores focados, 109/109 aprovados no PostgreSQL local fictício. Cobertos
  e-mail, permissões, concorrência, rollback, replay, campos não expostos e snapshots antigos.
  Tipos, lint focado, lint:design (8 bases/315 consumidores) e build webpack aprovados.
  Smoke compilado: login 200, Clientes e Novo Pedido 307 para login sem sessão.
- Primeira rodada foi interrompida por memória; repetida isoladamente, com limite de
  memória e timeout de execução adequado à lentidão observada, sem alterar asserções ou
  limites globais. Fixtures de documento/agenda corrigidas; nenhum teste ignorado conta
  como aprovado. Prévia atualizada com exports simulados das ações financeiras atuais,
  sem permitir operações financeiras. Servidor de prévia encerrado após a conferência.
- Backup privado `etiquetas-clientes-edicao-pedido-20261003-a`, 41.656.838 bytes,
  catálogo e conteúdo conferidos por pg_restore; SHA256
  `c5330e26cf3eb7be991a432bdc8872a955127432f6a4c2dc82c5f04e0bd82922`.
  Imagem/configuração anteriores preservadas; conferência produtiva será registrada após
  ativação, sem gerar outro deploy apenas para publicar evidência.

## 02/10 — ficha no editor e complementos avulsos no pedido

- Base `952800b5`, branch `codex/produto-ficha-complementos-pedido`; referências
  sincronizadas e checkout inicialmente limpo. Escopo restrito a produtos/pedidos,
  seus consumidores e documentação. Sem migration, dependência nova ou dado real.
- Editor de produto reutiliza `PreviaFichaProduto` e Button; a prévia reflete o
  rascunho sem salvá-lo. Dialog descendente suspende o editor; foco inicial no botão
  de impressão permite Escape e retorno ao mesmo preenchimento/foco.
- Novo Pedido mostra grupos obrigatórios efetivos no produto; complementos e opções
  de grupos opcionais entram separadamente pelo Combobox agrupado. Porções usam
  ProdutoVenda real, preço do grupo, unidade UN e composição multiplicada uma vez.
  Opções sem vínculo/preço/quantidade válidos ficam indisponíveis com explicação.
- Origem validada no servidor e preservada em snapshot/revisão; gestor e consulta
  agrupada distinguem opções/porções. Escolhas opcionais anteriores não são apagadas.
  Identidade completa impede trocar silenciosamente a origem ou o produto vinculado.
  Contrato reutilizável documentado em `docs/modulos/vendas.md`.
- Central: Button, Dialog coordenado, ComboboxGroup, Campo, InputComSufixo e preço
  comercial existentes; nenhum padrão visual ou token novo. Referência Em revisão.
- Validação: Vendas 539 aprovados/99 opt-ins ignorados; integração M1/M2 em PostgreSQL
  local novo com dados sintéticos e guardas oficiais, 60/60 aprovados. Os opt-ins não
  executados não são certificados. Lint dos arquivos alterados, lint:design
  (8 bases/300 consumidores), tipos e build webpack aprovados. Revisão independente
  de identidade, snapshots e consumidores sem bloqueantes após ajuste.
- Imagens isoladas 1280px/390px conferiram impressão interna, ausência de sobreposição,
  retorno de foco/rascunho, grupos obrigatórios e porções avulsas; sem transbordamento
  horizontal. Impressão pelo navegador não equivale a teste físico de impressora.
- Smoke local da compilação: login 200; Produtos e Novo Pedido 307 para sessão.
  Entrega destinada à branch de trabalho no GitHub; produção depende de autorização
  específica conforme `docs/contexto/versionamento.md`.
- Antes do envio, integrada a `main` `7f9a428f` (tabela de porções) sem conflitos,
  preservando também o registro concorrente `ee2a5d77`. Merge `fdd1b2e8` mantém o
  funcional `b3402cc`. Prisma validate/generate locais aprovados, sem aplicação em
  banco operacional. Regressão da base integrada: 124/124 em oito arquivos,
  incluindo integração M1/M2 e consumidores de composição; tipos, build e lint
  aprovados, lint:design com 303 consumidores. Prévia e smoke protegidos reconferidos.
  Vendas visual reutiliza as ações fictícias de porções; servidores e banco sintético
  encerrados ao concluir. Nenhuma publicação em produção nesta entrega.

## 02/10 — descrições do site e ajustes de interface

- A solicitação atual autoriza copiar as descrições de grazingtable.com.br para os
  produtos correspondentes, com correções pontuais de escrita. Esta atualização de
  dados é específica; não cria novos produtos nem altera opções compartilhadas.
- Conferidas 49 páginas do site e 56 produtos no HUB, incluindo sete personalizados.
  Gravadas 51 descrições; cinco já coincidiam. Corrigidos, entre outros, Mini Bolos
  citando Mini Cookies, acentos, pontuação, nomes no corpo e referência incorreta a
  ausência de proteína animal em produto com queijos. Personalizados mantêm o texto
  introdutório e o convite à escolha, sem composição fixa.
- Operação assistida em transação com permissão administrativa vigente, trava do
  catálogo, conferência integral da versão anterior e 51 históricos PRODUTO.
  Ensaio anterior em PostgreSQL local fictício cobriu idempotência, conflito/rollback,
  autorização, limite, duplicidade, apóstrofos e preservação. Leitura final conferiu
  os 83 cadastros, incluindo todos os 56 alvos. Preços, fotos e demais campos preservados.
- Backup privado `catalogo-descricoes-20261002-a`, validado por pg_restore
  (catálogo/conteúdo) e SHA256; manifesto, SQL e conferência ficam fora do Git.
- Interface: contadores compartilhados em Clientes, Insumos e Posição de estoque;
  categorias de Produto com multisseleção oficial, check e tags. Referências visuais
  continuam Em revisão. Publicação da interface registrada separadamente ao ocorrer.
- Validação da interface: suítes focadas de Clientes, Vendas, filtros, multisseleção,
  Insumos, Fornecedores, estoque e Central aprovadas. ESLint nos 952 arquivos de código
  rastreados/novos, lint:design (8 bases/300 consumidores), TypeScript e build Next em
  Node 22 aprovados. Prévia fictícia de categorias em 1280×1000 e 390×844, sem overflow;
  Clientes também conferido em desktop/mobile. Smoke da aplicação compilada local:
  login 200 e rotas protegidas 307 com Host permitido; Host local desconhecido 421.
- Publicação autorizada nesta conversa e concluída para o commit funcional `952800b5`.
  Tarefa `oe60r7pumki7gfymy9d9ardt5`, container `33aecdf14403`, nova imagem estável por
  mais de cinco minutos sem reinícios; migrations em dia. Backup privado de publicação
  `etiquetas-clientes-produtos-20261002-a` íntegro; configuração fiscal e certificado no
  banco preservados. HTTPS: login 200, Clientes/Produtos/Pedidos protegidos por sessão.
  Interface autenticada confirmou PF/PJ/Todos com quantidades, seleção zero acionável,
  categorias com check/tag e descrição corrigida dos Mini Bolos. Nenhum cadastro foi
  salvo para teste. Este registro posterior fica na branch de trabalho, sem novo deploy.

## Autorização e escopo

**Escopo histórico da retomada de 22/09: não importar produtos.** responsável autorizado pediu deixar o fluxo pronto para cadastrar manualmente, visualizar fichas técnicas e validar regras de negócio, e avisar quando publicado. Essa orientação substituiu a próxima etapa de consolidação/importação citada nos registros históricos abaixo. A automação noturna permaneceu pausada.

Em 22/09/2026 responsável autorizado autorizou executar a sequência da análise Takeat/iFood, tomar decisões técnicas sem depender de respostas durante a madrugada e publicar etapas prontas. Ele aceita ajustes posteriores, mas isso não dispensa testes, preservação dos dados, segurança e transparência sobre incompletudes.

Extras: grupo compartilhado, opcional (mínimo 0), sem máximo comercial, igual em todos os produtos associados. Edição centralizada de opções, preços e regras, com explicação dos produtos impactados. Evitar cópias divergentes por produto. Guardas técnicas contra payload excessivo ou overflow não devem aparecer como um limite comercial arbitrário de 99/100 itens.

Padrão e personalizada são produtos separados, conforme o iFood, incluindo tamanhos/versões que já são individualizados. Não voltar ao seletor padrão/personalizar do site.

O plano detalhado está em `docs/analise-vendas-takeat-ifood-2026-09-22.md`. Esta execução cobre a fundação comercial (clientes, produtos, categorias, complementos, preços por canal, composição/custo teórico, fiscal cadastral, ficha e importação controlada). O item de evolução posterior do plano não transforma esta tarefa em implantação irrestrita de pedidos, pagamentos, emissão fiscal e integrações externas.

## Regras para trabalho autônomo

- Leia as instruções do projeto e os guias locais do Next relevantes antes de escrever código.
- Não modificar o cadastro do iFood/Takeat; usar apenas como fonte de consulta autorizada.
- Dados fiscais incertos permanecem como rascunho/pendência de revisão; não inferir tributos, porções ou mapeamentos ambíguos.
- Não emitir notas, aceitar notas de compra, criar baixas financeiras, registrar consumo real ou executar operações de negócio só para testar.
- Proteger novas páginas e ações com permissões; sem concessão automática de acesso a perfis existentes.
- Migrations SQL manuais aditivas. Testes de integração em banco/esquema isolado, sem apagar dados de desenvolvimento ou produção.
- Preservar mudanças de outras tarefas e arquivos preexistentes. Commitar apenas o trabalho desta implementação.
- Publicar etapas completas e testadas conforme o ritual do CONTEXTO.md; registrar o commit e confirmar implantação, migrations e interface em produção.
- Um problema de dados/acesso não bloqueia as etapas independentes. Registrar pendência com precisão, não alegar que está resolvida.

## Estado inicial verificado

- Vendas ainda tem página de módulo em breve; nenhuma implementação do novo módulo foi feita nesta rodada de preparação.
- Base de referência contém amostra verificada, não exportação integral do catálogo.
- Diretório atual: `<DIRETORIO_PRIVADO_DO_OPERADOR> autorizado/Downloads/grazing-hub`.
- Arquivos preexistentes não rastreados: `.tmp-stage4-build.log` e `.worktrees/`; não incluir nem remover.
- Relatório de análise ainda não estava commitado antes desta autorização.
- Sessões de navegador foram preservadas ao fim da análise: Takeat aba 3, iFood aba 4 no navegador in-app de ID 1. Descobrir estado atual antes de agir; credenciais podem expirar e não devem ser solicitadas se houver trabalho independente possível.

## Plano de trabalho e conclusão verificável

1. [ ] Inventário e modelo: registrar dados observados; especificar entidades, vínculos, pendências e regras de importação.
2. [ ] Fundação: migrations, clientes PF/PJ e endereços, produtos separados, categorias ordenáveis e edição prática.
3. [ ] Complementos: grupos compartilhados, Extras sem limite, escolhas obrigatórias, preços por canal e simulador de configuração.
4. [ ] Composição e impressão: vínculos com insumos/preparações, porções explícitas, custo teórico e ficha no padrão existente.
5. [ ] Fiscal e importação: cadastro fiscal revisável, origem/auditoria, prévia de conflitos, identidade externa contextual e reimportação idempotente.
6. [ ] Verificação: testes de domínio, autorização, persistência/concorrência, interface responsiva, build e revisão dos fluxos principais.
7. [ ] Publicação: commit/push autorizado, saúde do serviço, migrations, certificado preservado e verificação visual.
8. [ ] Balanço: relacionar o que foi concluído e publicado, testes e pendências reais. Não marcar etapa parcialmente implementada como concluída.

## Continuidade noturna

Retomada automática desta mesma tarefa criada com ID `desenvolver-vendas-durante-a-madrugada`, a cada 10 minutos, com fim da janela às 08:00 de 22/09/2026 (Brasília). Encerrar antes se o escopo estiver concluído. Não criar outra tarefa ou automação duplicada.

Ao alcançar o horário, finalizar o passo em curso de forma segura, registrar o estado real e pausar a automação; não publicar algo incompleto só por causa do horário. As retomadas dependem da disponibilidade do computador, aplicativo, acessos e limites de uso.

## Registro de execução

### 22/09 — importação real autorizada do catálogo iFood

- Login recuperado e leitura autenticada concluída: 55 produtos principais, 28 produtos usados como complementos, 10 categorias, 34 grupos (33 pela lista + Atenção! pela ficha), 187 opções contextuais e 163 vínculos. Coleta preserva IDs de catálogo e IDs contextuais, sem unir homônimos automaticamente.
- Pacote validado pelo domínio e prévia real. Categoria existente conferida individualmente e vinculada sem sobrescrita. Produto manual, sua foto, preço e situação preservados. UI confirmou 126 aplicados, 1 mantido e zero conflitos.
- Todos os 83 produtos importados permanecem inativos. Extras único com 38 opções, opcional/ilimitado/repetível. 71 fotos públicas observadas copiadas e normalizadas para JPEG, até 2 MB; gravação condicional protege fotos/cadastros alterados localmente e cria histórico por foto.
- Verificação real: foto carregada em 1000×750, descrição/categoria/preço preservado no registro privado e regras da personalizada para 1 conferidos; ficha-mestre abre com foto, alternativas e indicação de composição pendente. Backup pré-carga: `<BACKUP_PRIVADO>`.
- Prévia pós-carga/fotos: 0 novos, 0 para atualizar, 127 sem alteração e 0 conflitos. Banco confirmou 83 importados inativos, 71 fotos auditadas, 55 preços IFOOD e zero cadastros fiscais inferidos. Testes de domínio/importação: 11/11; TypeScript sem erros. Tela de produtos deixada em Inativos para revisão.
- Não houve alteração de código da aplicação, migration ou deploy nesta carga. Uma publicação simultânea de outra tarefa invalidou a primeira Server Action; atualização da página e nova prévia resolveram sem duplicar carga.
- Ressalvas: contador 165 no portal diverge dos 83 atuais listados; históricos fora do cardápio não recriados. Grupo Atenção! recuperado parcialmente; regra das outras versões para 10 e texto completo sinalizados para conferência. Repetição dos demais grupos e sua ordem individual exigem revisão. Fiscal, receitas, gramagens, validade, custos e promoções automáticas não presumidos.

### 22/09 — cadastro manual e fichas para teste

- Categorias e grupos podem ser criados dentro do produto sem perder o formulário; retornam selecionados. Edição compartilhada explicita os produtos afetados e respeita permissões. Grupos podem ser ordenados no produto.
- Ficha-mestre com prévia e impressão A4 paisagem. Simulador por canal com escolhas obrigatórias, Extras opcionais ilimitados e ficha da configuração selecionada; composição somada sem juntar alternativas não escolhidas.
- Quantidades resolvidas com aritmética decimal exata. Custo incompleto fica pendente, nunca falsamente zero. Nenhum pedido, consumo de estoque ou lançamento financeiro é gerado.
- Campos fiscais com validação visual de formato e preenchimento. Fiscal permanece cadastro revisável; não inclui emissão, homologação tributária nem regras por operação/vigência.
- Conferência visual local: categoria/grupo criados com dados fictícios, formulário preservado, grupo selecionado, obrigatório bloqueando ficha, 120 Extras aceitos, composição/custo resolvidos, prévias das duas fichas, formulário em 390×844. Nenhum dado fictício salvo em produção.
- Build de produção, TypeScript e ESLint aprovados. Testes finais: 148/148 aprovados (53 de Vendas, incluindo PostgreSQL isolado, e 95 de fronteiras de permissões). Backup pré-publicação: `<BACKUP_PRIVADO>`. Publicação ainda precisa de confirmação do serviço e interface real.
- Publicação confirmada às 09:27: commit `9fdd7ed` em `origin/main`, tarefa `so5lah817bcd`, container `9c2f675fa482` estável por 2 minutos, zero reinícios, 58 migrations em dia. Configuração fiscal preservada integralmente. `/vendas/produtos` autenticada verificada com cadastro rápido de categoria/grupo e composição; modal fechado sem salvar. Nenhum produto importado ou fictício criado na base real. Pronto para o teste manual solicitado; o plano ampliado de integrações/emissão/importação não é declarado concluído.

### 22/09 — segunda etapa: ordenação e importação controlada

- Ordenação de categorias e produtos por categoria com versão otimista, histórico e prevenção de sobrescrita. Ordem independente por categoria, preservada em reimportações.
- Importador com pacote JSON normalizado, prévia, conflitos, token de confirmação, transação/idempotência e identidade contextual. Permissões compostas verificadas antes da leitura/escrita. Novos produtos inativos; dados fiscais, estoque e financeiro não são alterados por inferência.
- Migration manual `20260922020000_identidades_importacao_vendas`; testada em esquema PostgreSQL temporário. Publicação desta etapa ainda precisa ser confirmada abaixo.
- 46/46 testes de Vendas aprovados, incluindo integração PostgreSQL, autorização, interface, importação concorrente e prevenção de escolhas aninhadas. TypeScript, ESLint e build de produção aprovados. Execução inicial conjunta encontrou falta de memória; repetição isolada com memória limitada concluiu sem erro.
- Prévia visual local testada com arquivo fictício: upload, conferência, conflito destacado, confirmação obrigatória e resultado; sem envio de teste à produção.
- Interação de upload do navegador ficou presa por cerca de 5h43 (02:07–07:50), interrompendo o avanço real. Retomada com timeout explícito funcionou. Não contabilizar esse período como desenvolvimento contínuo nem apresentar o escopo como concluído.
- Dados observados persistidos em `docs/catalogo/inventario-ifood-2026-09-22.json` (55 produtos/10 categorias, nomes/identidades/preços-base) e `extras-ifood-observados-2026-09-22.json` (38 opções). Não são pacote pronto; descrições/grupos/fotos ainda precisam de consolidação. Nenhum desses produtos foi importado na base real.
- Restam: consolidar catálogo e regras completas, carga real revisada, ficha de configuração específica e refinamentos fiscais por operação/vigência. Não presumir preço gratuito nos seis produtos de base zero nem dados fiscais a partir de nomes.
- Publicação confirmada às 08:00: commit `ca58b3f` em `origin/main`, tarefa `cnuqyrx4mtck`, container `2775c9dd031e` estável, 58 migrations em dia. Backup em `<BACKUP_PRIVADO>`. Configuração fiscal preservada integralmente; sem consulta SEFAZ. `/vendas/importacao` verificada no HUB autenticado, sem carga fictícia/real.
- Verificação adicional isolada: 95/95 testes de fronteiras de permissões aprovados. Inventário JSON validado: 55 IDs únicos, 10 categorias, 38 Extras, seis bases zero. Popup de ordenação verificado visualmente com dados fictícios.
- Encerrada a janela noturna configurada (08:00); retomada automática pausada. O escopo total NÃO está concluído. Próxima etapa é consolidar grupos obrigatórios/opções/descrições dos 55 produtos, preparar pacote normalizado e conferir/importar como inativos. Não pedir novamente autorização genérica para desenvolver/publicar; autorização de responsável autorizado continua vigente. Não reiniciar a fundação nem refazer migrations concluídas.

- Preparação: autorização e correção de Extras documentadas; retomada noturna configurada. Nenhuma migration aplicada, nenhum código do módulo implementado e nenhum deploy nesta preparação.

### 22/09 — fundação implementada, em validação para primeira publicação

- Implementados clientes PF/PJ, endereços, produtos individualizados, fotos privadas, categorias ordenáveis, grupos/opções compartilhados, preços-base por canal, composição fixa e simulador. Extras tem um único grupo canônico, mínimo zero, máximo nulo e repetição habilitada.
- Cadastro fiscal separado por permissão, com rascunhos e conferência interna; não representa emissão ou homologação tributária. Produtos e opções incompletos não recebem classificações/porções presumidas.
- Ficha-mestre A4 paisagem, com alternativas em anexo separado da composição fixa. Impressão de configuração específica e parâmetros fiscais por operação/vigência ainda são próximos incrementos.
- Migration manual aditiva `20260922010000_cadastros_vendas`; testada em esquemas temporários PostgreSQL local. Até este registro não aplicada em produção. Nenhum estoque ou lançamento financeiro criado.
- Ações protegidas, histórico antes/depois e controle de versão. A transação serializa alterações relacionadas; conflitos de edição não sobrescrevem silenciosamente. Reordenação de categorias ainda usa conferência do conjunto de IDs, não versão de ordem.
- Testes de domínio, autorização, persistência concorrente, fotos/ficha e formulário criados. Build de produção, TypeScript e ESLint passaram. A suíte completa inicialmente excedeu memória ao executar muitos processos; repetição em andamento com `--maxWorkers=1 --testTimeout=15000`.
- Verificação visual isolada em 1280×720 e 390×844: popup compacto, nome/especificação acima, foto e identificação em colunas; campo obrigatório vermelho retorna ao normal após preenchimento. Simulador aceita 120 Extras. Aviso explícito de produtos afetados na edição compartilhada.
- Atualizado contrato de testes para três ações de categorias de perdas que já existiam e estavam protegidas, mas ausentes da lista de teste; nenhuma regra de perdas foi alterada.
- Pendências do escopo: inventário integral, importação com prévia/identidade externa/idempotência, ordenação dos produtos por categoria, ficha de configuração específica, refinamentos fiscais conforme orientação contábil. Não apresentar a fundação como módulo integral concluído.
- Validação específica concluída: 26/26 testes de Vendas (incluindo PostgreSQL isolado) e 99/99 testes de fronteiras/interface de permissões. TypeScript final sem erros. Backup pré-publicação criado em `<BACKUP_PRIVADO>`, sem consulta à SEFAZ.
- Commit `0fc6046` enviado a `origin/main`; deploy automático acionado. Aguardar/verificar serviço, migration e interface antes de marcar publicado.
- Primeira publicação confirmada: nova tarefa `960q8lm8hdqc`, container `ad1bbc34910f`; 57 migrations em dia. Helper confirmou configuração fiscal preservada integralmente. Interface real autenticada verificada em `/vendas`, `/vendas/catalogo`, `/vendas/produtos`, `/vendas/clientes` e `/vendas/fiscal`, sem criar dados fictícios em produção. Catálogo inicialmente vazio, apenas Extras canônico, opcional e ilimitado. Prosseguir com importação controlada.
- Suíte completa sequencial: 929 testes passaram, 162 pulados, 2 falharam e 1 arquivo falhou ao carregar. Falhas fora dos arquivos implementados: mock de sessão sem `permissoes/excecoes` em `design-system/publicacao-actions`, importação `server-only` em `notas-fiscais/fornecedor-interface`, seletor de opção ainda fechado em `inventario/posicao-detalhe-interface`. Não declarar a suíte inteira verde. Vendas e permissões específicas passaram separadamente.

### 01/10 — Clientes, integração para publicação autorizada

- Listagem alinhada à experiência de Insumos, com resumo por cliente e detalhes expansíveis; cadastro reutiliza os campos atuais do Novo pedido, consulta/travas CEP e múltiplos endereços. Abas de condições comerciais e histórico com acesso ao pedido; autorização e validação no servidor.
- Integração sobre `f861672`, preservando campos atuais de cliente, cadastro inline transacional, embalagem, horários, pagamento comercial EXTERNO e interface compacta/vidro do Gestor. Migration aditiva `20261001100000_clientes_regras_pagamento`; sem outras refatorações.
- Publicação autorizada por responsável autorizado. Validação: 287 testes focados de domínio, consultas, interface e permissões; 75 integrações em PostgreSQL fictício exclusivo; Prisma validate/generate/migrations; build Docker Node22 e tipos; lint focado, lint:design e imagens desktop/mobile sem erros de página/overflow. Timeout local de 15s apenas no cenário que preenche todo o cadastro e reenvia após erro; sem alteração das asserções. Dependências do checkout antigo não cobrem a main atual: build/tipos completos foram validados no Docker com npm ci. Backup privado etiquetas-clientes-20261001-a verificado por pg_restore (catálogo/conteúdo), SHA256 e imagem/configuração anterior. Referências visuais continuam Em revisão.

- Integração final sobre c7efb85, incorporando a publicação paralela de Novo Pedido/diálogo inline e mantendo campos postais brasileiros travados, limpeza ao trocar CEP/país e nova tentativa em falha. Regressão final: 191/191 casos de Clientes/Vendas/permissões e 45/45 de CEP, Pedidos, Dialog e identidade. Backend e migration permanecem idênticos à revisão das 75 integrações aprovadas. Smoke da imagem isolada: login 200, três rotas protegidas 307, migrations atualizadas e zero reinícios. Build Docker Node22 e typecheck completo da versão integrada aprovados; lint:design passou (8 bases, 297 consumidores). Smoke repetido na imagem final: login 200, rotas protegidas 307, migrations em dia e zero reinícios.
