# Execução dos pontos de impressão

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

## Fotos na emissão e etapa Etiqueta — 17/10/2026

Pedido explícito: corrigir e publicar. Branch `codex/validades-fotos-previa-20261017`,
worktree reutilizado `<DIRETORIO_PRIVADO_DO_OPERADOR> autorizado/.codex/worktrees/validades-erro-etiquetas-20261014/grazing-hub`.
Base `55a7db71` (registro da entrega anterior), main funcional `4bc3cb79`.

- Implementado: foto cadastrada nos cartões de escolha e preparo em grupo;
  FotoProduto compartilhado com Gestão. Falha/ausência usa ícone, sem esconder o
  nome. DTO consulta somente fotoMimeType e devolve a URL da rota privada existente.
- Etapa 3 renomeada para Etiqueta, incluindo navegação e demonstração da Central.
  Removidos título/subtítulo repetidos acima do papel. PreviaEmissao limita apenas
  a escala na tela à altura disponível no desktop, preservando proporção e teto
  anterior de 480px. Não altera o conteúdo físico, DPI, layout ou conector.
- Regressão: 423 testes aprovados, zero falhas; 28 condicionais de banco/HTTP não
  executados. Comando: `node node_modules/vitest/vitest.mjs run testes/etiquetas
  testes/design-system testes/layout --maxWorkers=1 --reporter=json
  --outputFile=.tmp/validades-fotos-previa-regressao.json` (uma linha).
- Prévia Vite isolada na porta 4199, fixtures e imagem sintética existente. Matriz
  Produto/Etiqueta em 320×900, 390×900, 768×1024, 1280×720, 1440×900, 1920×1080,
  claro/escuro. Extras: nome longo, falha de foto, seleção em grupo e mídia 60×40.
  29 auditorias parciais sem diagnósticos, incluindo redimensionamento da janela.
  Enter, busca e seleção preservados.
- Medida em 1280×720: SVG top 340/bottom 660; quadro bottom 704 e lateral bottom
  704. Em 1440×900 a imagem usa 480px e cabe inteira. Celular/tablet conservam
  rolagem natural de prévia e formulário. Não há promessa de mostrar todo o
  formulário sem rolagem em qualquer tamanho de janela.
- Imagens consultivas em `.tmp/validades-fotos-previa-20261017` no checkout principal;
  relatórios/logs `.tmp/validades-fotos-previa-*` neste worktree. Sem referências
  aprovadas promovidas automaticamente. Catálogo continua Em revisão humana.
- Ambiente: Node 22.23.2 e dependências existentes. Houve falta de memória ao
  concorrer testes e tipos; a tentativa de typecheck com teto de 2GB atingiu o
  limite do Node (exit 134). Repetição sequencial com teto de 4GB aprovada (exit 0).
  Lint focado, lint:design e lint de referências passaram; zero desvio novo.
- Conferência final de consumidor/Central: 37 aprovados, zero falhas.
  `node node_modules/vitest/vitest.mjs run testes/design-system/padroes.test.tsx
  testes/etiquetas/operacao-interface.test.tsx --maxWorkers=1`.
- Typecheck final: `node --max-old-space-size=4096 node_modules/typescript/bin/tsc
  --noEmit`, exit 0. Lint dos TS/TSX alterados; scripts oficiais de tokens,
  qualidade visual e referências passaram (92 históricos, zero novos; zero
  referências aprovadas). Build webpack com limite de 4GB aprovado (exit 0), sem testes concorrentes.
- Backup privado `etiquetas-validades-fotos-previa-20261017-004516`, 121.783.621 bytes,
  integridade `pg_restore --file=/dev/null` exit 0, sem restore. Imagem anterior
  exata preservada. Migrations já atualizadas no destino, exit 0.
- Implementação `ffdb2872`, merge integrado `c6e4ea92` sobre a main `d8c6ea3f`
  (Dashboard #29). Nenhum arquivo de runtime de Validades mudou nessa integração.
  Build webpack integrado aprovado, exit 0, incluindo TypeScript. Nenhuma
  referência de QA de outra alteração foi tratada como validação desta frente.
- Backup final após a atualização do Dashboard:
  `etiquetas-validades-fotos-final-20261017-005128`, 121.783.623 bytes, integridade
  exit 0. Imagem exata do contêiner `3b3c7384984e` preservada. Migrations atualizadas,
  exit 0; sem restore ou alteração de dados. O backup anterior continua preservado.
### Publicado e conferido — 17/10/2026

- Publicado `48bff635af918ee8ed0f4086e7a06bcb887e4a61`, contendo implementação
  `ffdb2872` e integração/build `c6e4ea92`. O commit final pré-publicação alterou
  somente documentação. Branch e main conferidas diretamente no GitHub.
- Tarefa `2pgtm2xzzatj`, contêiner `8467bb8cc4de`, imagem
  `sha256:8e0c6a9df8a2c7680b93d5a25cceb4f1bdf0f81041640cab536214c387ceb90f`.
  Início `2026-10-17T04:00:09.381679866Z`; Running por 166s, zero reinícios.
  Clone da VPS no SHA publicado. Build do servidor sem erro.
- Auxiliar restaurar confirmou configuração fiscal já preservada; nada reaplicado.
  Migrations atualizadas antes/depois, exit 0. Nenhuma migration, restore, consulta
  SEFAZ ou mudança no conector/rede/credenciais nesta tarefa.
- UI autenticada: três fotos reais carregadas em Frutas Frescas, 56px nos cartões;
  produto → conservação → Etiqueta preservado. Título/subtítulo repetidos ausentes.
  Em 1280×720: SVG top 340/bottom 660, quadro e lateral bottom 704. Foto, busca e
  navegação também conferidas em 390px; auditoria parcial sem diagnósticos. Console
  sem erros. Nenhum botão Imprimir/Preparar grupo/Dar baixa acionado em produção.
- HTTPS/TLS normal: logins Validades/HUB/Pedidos 200. Emissão e foto sem sessão
  retornaram 307 para login. Sem leitura de foto ou dados privados sem autenticação.
- Evidências ignoradas no checkout principal:
  `.tmp/validades-fotos-previa-20261017/publicado-produtos.png`,
  `publicado-etiqueta.png`, `publicado-celular.png` e `auditorias.json`.
  Relatórios, build, typecheck, logs e hashes em `.tmp/validades-fotos-previa-*`
  no worktree. Testes condicionais e limites de acessibilidade seguem os registros acima.
- Encerramento local: aba de QA fechada, prévia Vite preexistente segue ativa.
  Worktree e caches preservados; Close/Apply adiados por esse uso. Nenhum processo
  foi encerrado automaticamente e nenhuma cópia/cache foi removida. C: cerca de
  12GB livres após builds; medir novamente antes de outra operação pesada.
  Nenhuma impressão/baixa real executada. Sem migration ou pacote novo.


## Subetapas de Produto e nome da seção — 16/10/2026

Pedido explícito: corrigir e publicar. Branch `codex/validades-subetapas-20261016`,
mesmo worktree `<DIRETORIO_PRIVADO_DO_OPERADOR> autorizado/.codex/worktrees/validades-erro-etiquetas-20261014/grazing-hub`.
Base inicial `5aa91f81`, funcional anterior `0f553b1a`; checkout principal preservado.

- Implementado: Grupo → Produto → Conservação em abas sequenciais, avanço no
  clique, busca global estável desde Grupo, retorno a Grupo ao limpar e navegação
  anterior. Etapas principais à esquerda, Imprimir/Histórico à direita. Seta
  discreta de retorno no título do passo. Seção renomeada para Imprimir etiquetas.
- Reutilizados Tabs, Button ghost/icon, Card e CampoBusca oficiais; composição
  `validades-vidro` e demonstração da Central atualizadas, Em revisão humana.
- Sem alteração de actions, schema, ZPL, conector, rede ou filas. Nenhuma etiqueta
  real criada, impressa ou baixada nesta validação.
- Validação local: 419 testes aprovados, zero falhas, 28 condicionais não executados
  em `testes/etiquetas testes/design-system testes/layout --maxWorkers=1`.
  Após proteção do foco: 20 testes focados aprovados, zero falhas. Typecheck,
  lint focado e lint:design aprovados; 92 desvios históricos, zero novos.
- Prévia Vite isolada `--config testes/visual/etiquetas.vite.config.mts` na porta
  4199. Matriz de cinco estados em 320/390/768/1440, claro/escuro; nomes longos,
  erro simulado e somente leitura. 47 auditorias parciais sem diagnósticos.
  Capturas e relatório em `.tmp/validades-subetapas-20261016` no checkout principal.
  Teclado/Enter, busca/foco, limpeza e troca de Histórico conferidos.
- Limites: em 320px a faixa quebra para conservar alvos e rótulos. Revisão em
  celular/tablet ainda exige rolagem para prévia e formulário; em 1440×900 o botão
  Imprimir cabe. Não há referência de pixels aprovada nem teste de leitor de tela.
- Reconciliação concluída: implementação `8d48085b`, merge `5d03a3ce` sobre a
  main fiscal `19fbdd59`, sem conflitos. Regressão na revisão integrada: **438
  aprovados, zero falhas, 28 condicionais não executados**. Fonte UI idêntica à
  matriz isolada; integração não alterou seus arquivos. Build webpack integrado
  concluído com exit 0. Logs ignorados em `.tmp/validades-subetapas-*`.
- Backup pré-publicação privado `etiquetas-validades-subetapas-20261017-000042`,
  121.431.885 bytes, integridade `pg_restore --file=/dev/null` exit 0, sem restore.
  Imagem anterior exata preservada. Migrations em produção já atualizadas, exit 0.
  Nenhuma migration nova desta tarefa; a fiscal recebida já estava aplicada.
### Publicado e conferido — 17/10/2026

- Commit publicado `4bc3cb798518523102f364574bac2ce6b9a88b92`; contém implementação
  `8d48085b` e merge integrado/testado `5d03a3ce`. O commit final acrescentou apenas
  documentação. Main/branch conferidas diretamente no GitHub após push fast-forward.
- Nova tarefa `obms9vpmp2ck`, contêiner `f6829711a8dd`, início
  `2026-10-17T03:10:15.939143047Z`. Imagem
  `sha256:99ab5fd8c907df727bcac08aee520b450f8df6ec61209ab43a1941b7af681af8`.
  Running por 155 segundos, zero reinícios. Clone da VPS no SHA publicado.
- Configuração fiscal já preservada integralmente; auxiliar restaurar apenas
  conferiu. Migrations atualizadas, exit 0, antes e depois. Sem consulta SEFAZ,
  alteração fiscal, restore ou migration adicional desta tarefa.
- Typecheck independente integrado exit 0; build webpack integrado exit 0.
  Aviso preexistente sobre middleware/proxy não foi tratado neste escopo.
- HTTPS com TLS normal: login Validades/HUB/Pedidos 200. Rota da emissão e foto
  sem sessão retornaram 307 para login, sem obter dados.
- UI autenticada: nome no menu/título, Grupo inicial, busca → Produto com foco
  preservado, limpeza → Grupo, grupo → Produto, item → Conservação, conservação
  → Revisão, seta de retorno, Responsável clicável e Histórico/Imprimir conferidos.
  Auditoria parcial em desktop/390 sem diagnósticos; zero erros no console.
  Nenhum botão Imprimir, Preparar grupo ou Dar baixa foi acionado em produção.
- Evidências privadas ignoradas no checkout principal:
  `.tmp/validades-subetapas-20261016/publicado.png`, `publicado-celular.png` e
  `auditorias.json`. Logs/testes/build/hash em `.tmp/validades-subetapas-*` no worktree.
- Ambiente local preservado: prévia Vite preexistente segue ativa; não encerrar
  processos automaticamente. Close/Apply de armazenamento adiados por esse uso.
  Check final: cerca de 13,4 GB livres, trava livre. Nenhum cache/cópia foi removido.

### Comandos usados

Node 22.23.2, dependências existentes. Executar na raiz do worktree acima:

```powershell
# Node usado: <DIRETORIO_PRIVADO_DO_OPERADOR> autorizado/Downloads/grazing-hub/.tmp/validades-erro-20261014-runtime/node_modules/node/bin/node.exe
node node_modules/vitest/vitest.mjs run testes/etiquetas testes/design-system testes/layout testes/tributacao/lote-parametros.test.ts --maxWorkers=1 --reporter=json --outputFile=.tmp/validades-subetapas-regressao-integrada.json
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js <arquivos TS/TSX alterados>
node scripts/verificar-tokens-design.mjs
node scripts/verificar-qualidade-visual.mjs
node scripts/verificar-referencias-visuais.mjs
node node_modules/next/dist/bin/next build --webpack
node node_modules/vite/bin/vite.js --config testes/visual/etiquetas.vite.config.mts
```

Visual via CUA/IAB, viewport temporário, fixture sem banco/API/dispositivo.
Publicação pelo ritual de [Deploy](../../contexto/deploy.md), SSH existente com
BatchMode/StrictHostKeyChecking/IdentitiesOnly habilitados. Nenhum segredo em logs
ou comandos versionados. Não repetir impressão física por causa desta alteração de UI.


## Compactação e agrupamento — 16/10/2026

Pedido atual: corrigir **e publicar** o topo/etapas de Validades, botões com setas
de rolagem, agrupamento por produto e baixa direta quando resta uma única etiqueta.
Branch: `codex/validades-compactacao-20261016`. Worktree reutilizado:
`<DIRETORIO_PRIVADO_DO_OPERADOR> autorizado/.codex/worktrees/validades-erro-etiquetas-20261014/grazing-hub`.
Base reconciliada `2a0462af766489409dc1013e233b0a5b9f155a7a`, contendo a main
`60936fb0` e o registro anterior `79a25435`. Checkout principal preservado.

### Implementado e conferido em ambiente isolado

- Cabeçalho/subtítulo e steps compactos. Indicadores e filtros sem repetição;
  ordenação em Filtros; quebra responsiva real, sem rolagem dentro de botões/abas.
- Monitoria agrupada pelo ID do Insumo/Preparação. Filtros antes do agrupamento;
  registros com datas/lotes diferentes são revelados no clique. IDs distintos,
  mesmo com nome igual, e registros sem ID não se misturam. Nenhuma baixa em lote.
- Uma única cópia restante tem baixa direta no card ou detalhe. Múltiplas cópias
  mantêm quantidade e confirmação. Trava de clique duplo, retorno de erro e chave
  idempotente preservada ao repetir. A ação de servidor existente não foi alterada.
- Central atualizada com demonstração sintética. Auditoria comum passa a apontar
  rolagem em controles, inclusive a regressão de 1px. Nenhum Button global mudou.
- Sem migration, dependência, conector, ZPL, rede da Raspberry ou impressão real.
  Regras canônicas em [Etiquetas](../../etiquetas.md). [QA](../../../design-qa.md).

### Validações executadas

Node 22.23.2 e dependências já instaladas no worktree. Comandos reais usam o Node
local compatível com Docker; abaixo, `node` representa esse executável.

- `node node_modules/eslint/bin/eslint.js`: global, exit 0. Rechecagem focada após
  os últimos ajustes visuais de `gestao-validades.tsx`.
- `node scripts/verificar-tokens-design.mjs` e `node scripts/verificar-qualidade-visual.mjs`:
  aprovados; 92 desvios históricos, zero novos.
- `node node_modules/typescript/bin/tsc --noEmit`: exit 0.
- `node node_modules/next/dist/bin/next build --webpack`: exit 0 na revisão final,
  com TypeScript e geração de páginas concluídos. Log `.tmp/validades-compactacao-build-conclusao.log`.
  Ajuste posterior restrito à remoção de espaços em branco de CSS (`diff --check`).
- `node node_modules/vitest/vitest.mjs run testes/etiquetas testes/design-system testes/layout testes/permissoes --maxWorkers=1 --reporter=json --outputFile=.tmp/validades-compactacao-regressao.json`:
  **738 aprovados, zero falhas, 52 condicionais não executados**. Opt-ins de
  Etiquetas HTTP/banco, Design/banco e Permissões/banco não ativados. Servidor,
  schema e transações desta frente não mudaram; nenhum teste usou produção.
- Testes finais focados: `testes/etiquetas/operacao-interface.test.tsx`,
  `testes/design-system/padroes.test.tsx`, `testes/design-system/auditoria-interface.test.ts`:
  47 aprovados, zero falhas. Regressões de identidade, filtros, múltiplas cópias,
  permissão, baixa única no card/detalhe, espera/clique duplo e erro/repetição.
- `node scripts/verificar-referencias-visuais.mjs`: zero referências aprovadas;
  nenhuma captura/baseline foi atualizada para fazer o teste passar.
- CUA em prévia Vite com ações simuladas: matriz e limites em `design-qa.md`.
  Não declarar testes condicionais, impressão física ou dados reais como validados.

### Publicado e conferido — 16/10/2026 (Brasília)

Commit funcional `0f553b1a1f3e5929b5c10f8aebd762de9bc35831`, enviado à branch
e à main por fast-forward de `60936fb0`. Clone de build e origem após a partida
conferidos nesse SHA. A evidência posterior permanece nesta branch documental;
não gerar outro deploy apenas para publicar o registro.

- Build Dokploy concluído. Serviço `app-copy-auxiliary-microchip-9hhwdm`, tarefa
  `b5ejk7okpri07wkwa4sr2xaeo`, contêiner `5182ea6e20b6`, iniciado em
  `2026-10-17T02:15:42.555421599Z` (23:15 de 16/10 em Brasília).
  Conferência com **193 segundos em execução, zero reinícios**.
  Imagem `sha256:f03dd8ee5e16d12ee8a3ea959c1786e61b5f05cc1da2353ad7070556cef545f6`.
- Backup privado atualizado imediatamente antes da publicação:
  `<BACKUP_PRIVADO>`.
  Dump de 121.409.323 bytes, `pg_restore --file=/dev/null` exit 0, sem restaurar
  dados. Imagem anterior `sha256:ca949982074ed7418ba90cb9f80c0211f49a9697379e52242acf3afd0e75104d`
  e configuração fiscal preservadas. Fonte do certificado: banco. O auxiliar
  confirmou configuração já intacta, sem atualização do serviço ou consulta fiscal.
- `prisma migrate status` antes/depois: exit 0 e schema atualizado. Esta frente
  não acrescentou SQL. Nenhuma credencial foi registrada nesta documentação.
- HTTPS sem seguir redirects, TLS normal: login Validades/HUB/Pedidos 200;
  gestão e foto sem sessão 307 para login. Proteção de acesso preservada.
- UI autenticada: gestão agrupada, expansão de produto e detalhe com dez campos
  conferidos. Emissão com Responsável/Produto/Revisão e faixa de 53,6 px;
  zero controles com rolagem. Desktop e 390 px sem overflow; console sem erros.
  Nenhum botão de baixa, impressão ou reimpressão produtiva foi acionado.
- Evidências privadas ignoradas: `.tmp/validades-compactacao-publicacao-instancia.json`,
  `.tmp/validades-compactacao-publicacao-https.json` e imagens `publicado-*.png`
  na pasta de artefatos indicada no QA. Não versionar capturas com dados reais.

### Ambiente local

Worktree, arquivos ignorados e dependências preexistentes preservados. A prévia
Vite `127.0.0.1:4199` permanece ativa e o ambiente segue registrado como aberto.
O contrato de armazenamento proíbe encerrar processos automaticamente e limpar
caches de ambiente ativo; o encerramento/limpeza está adiado por essa condição.
Nenhuma cópia ou cache foi removido. A medição final ficou em aproximadamente
17 GB livres; não perseguir 20 GB por limpeza de outras frentes.


## Nova linha visual de Validades — 16/10/2026

Frente: `codex/validades-nova-linha-20261016`. Retomar no worktree
`<DIRETORIO_PRIVADO_DO_OPERADOR> autorizado/.codex/worktrees/validades-erro-etiquetas-20261014/grazing-hub`.
Base: `2c23fbb6b91af33961d5420ffb20e94aa6685239`. O checkout principal e seus
arquivos locais preexistentes foram mantidos. Especificação operacional canônica:
[Interface de Validades](../../etiquetas.md#interface-de-validades--linha-visual-de-16102026).

### Publicação autorizada e conferida — 16/10/2026

O usuário autorizou a publicação após a entrega local. Commit funcional
`4fa0db65ca77720e9d7196e3ada6fb7e10cbe305`, integrado por fast-forward de
`2c23fbb6` para main. A cópia de build da VPS foi conferida nesse SHA antes da
compilação. As validações locais abaixo correspondem a esse código.

- Build Dokploy concluído. Serviço `app-copy-auxiliary-microchip-9hhwdm`, tarefa
  `z94krv0c3482lp64odajx88eg`, contêiner `7579e9535a88`, iniciado em
  `2026-10-16T18:27:51Z`. Conferido novamente após 519 segundos: Running, zero
  reinícios. Imagem `sha256:16fe4c8f2f8216d60f54311849b695acec444800256d01338ddf81082748af39`.
- Backup privado na VPS: `<BACKUP_PRIVADO>`.
  Dump de 121.390.796 bytes, validado integralmente por `pg_restore --file=/dev/null`,
  sem conexão de restauração. Imagem anterior e configuração fiscal preservadas.
  Fonte do certificado: banco. O modo restaurar do auxiliar confirmou a configuração
  já intacta, sem atualização do serviço nem consulta à SEFAZ.
- `prisma migrate status` no contêiner, antes/depois: exit 0 e schema atualizado.
  Esta frente não acrescenta migration, dependência, alteração do conector ou Wi-Fi.
- HTTPS com validação TLS normal e sem seguir redirects: login Validades 200;
  gestão/foto sem sessão 307 para login; caminho irmão da foto não autorizado 404;
  host legado 307 para o canônico; login HUB e Pedidos 200.
- Smoke autenticado no navegador integrado: gestão com fotos existentes e status,
  card abrindo detalhe e ação Dar baixa visível; três etapas; busca imediata;
  tabela Com cadastro/Sem cadastro e suas seis colunas; conservação/revisão;
  histórico; abas de responsáveis e perfil. Nenhuma impressão, baixa ou edição
  de cadastro real foi executada. Seleções da revisão ficaram somente no rascunho
  cliente. Console sem erros novos capturados durante a conferência.
- Configurações mostrou Produção padrão com comunicação recente, USB detectada,
  zero pendentes e zero incertos. Isso não certifica nova saída física.
- Evidências privadas locais `publicado-*.png` na pasta de capturas indicada abaixo;
  respostas HTTPS em `.tmp/validades-publicacao-20261016-https.json` do worktree.
  Capturas de dados reais ficam fora do Git.

Durante a conferência, outra frente publicou na main a reconciliação Fiscal
`60936fb0d6e39e5ae9a547ae7da9c1c1cfa9fd9a`, descendente de `4fa0db65`.
A ancestralidade foi confirmada; nenhum arquivo funcional de Validades foi
substituído. Esta tarefa não atribui seus testes à revisão Fiscal nem opera seu
deploy. O contêiner e a janela de estabilidade acima pertencem à publicação de
Validades aqui acompanhada. Este registro posterior fica na branch de trabalho;
não disparar outro deploy apenas para publicar evidências documentais.

### Entrega implementada

- Linha aprovada aplicada à Gestão, emissão, detalhe, histórico, prazos e
  configurações. Sem imagem de background/hero. Tokens e componentes do HUB.
- Cards acionáveis, Dar baixa no card e no detalhe, confirmação/quantidade e
  retorno de erro no local. Preservados servidor, transação, auditoria e idempotência.
- Três etapas principais: Responsável, Produto, Revisão. Busca global imediata;
  grupo/item/conservação internos; impressão de grupo e botão único preservados.
- Lista de produtos com dois grupos e prazos reais. Sem cadastro não é zero.
  Habilitação/inatividade não se confunde com existência de prazo.
- Fotos existentes via GET privado de Produção. Host permite somente o caminho
  delimitado; middleware continua exigindo sessão de pessoa. Endpoint relê a
  sessão, exige Produção e recusa MIME ativo. Não flexibilizar a API de Insumos.
- Central: composição `validades-vidro`, demonstração sintética e testes,
  **Em revisão humana**. Nenhum token ou dependência nova.

### Validação e ambiente desta entrega

Windows local, PowerShell 7, Node 22.23.2 e dependências já instaladas do lockfile.
Sem instalação de pacotes, banco novo ou migration. Revisão testada: base acima
mais o patch de código contido nesta entrega; não atribuir os resultados ao HEAD
antigo isoladamente. Logs ignorados em `.tmp/validades-nova-linha-*` no worktree.

Comandos reais, usando o executável Node 22 do runtime local:

```text
node node_modules/eslint/bin/eslint.js .
node scripts/verificar-tokens-design.mjs
node scripts/verificar-qualidade-visual.mjs
node scripts/verificar-referencias-visuais.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run testes/etiquetas testes/design-system testes/layout testes/permissoes testes/login testes/vendas/pedidos-hostname.test.ts testes/vendas/foto-acesso.test.ts --maxWorkers=1 --reporter=json --outputFile=.tmp/validades-nova-linha-entrega-testes.json
node node_modules/next/dist/bin/next build --webpack
node node_modules/vite/bin/vite.js --config testes/visual/etiquetas.vite.config.mts
node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3108
```

Runtime usado:
`<DIRETORIO_PRIVADO_DO_OPERADOR> autorizado/Downloads/grazing-hub/.tmp/validades-erro-20261014-runtime/node_modules/node/bin/node.exe`.
Lint global passou; lint focado foi repetido após os ajustes finais. Design e
metadados de referências passaram, sem dívida nova. Regressão ampliada: **826
aprovados, zero falhas, 69 condicionais não executados**. Banco/HTTP opt-in de
Etiquetas e integrações de acesso/login não foram ativados; não são evidência
nova de persistência. Reteste final: **73 aprovados, zero falhas**, cobrindo operação, catálogo/demonstração,
foto e roteamento. Typecheck da entrega e build webpack passaram. Smoke local do
build em `127.0.0.1:3108`, com Host Validades e sem seguir redirecionamentos:
login 200; gestão sem sessão 307 para login; foto sem sessão 307 para login;
caminho irmão não autorizado 404. O servidor de smoke usou DATABASE_URL fictícia
apontada para localhost sem banco e foi encerrado. Isso não comprova sessão real,
consulta produtiva das fotos ou persistência. Aviso preexistente de convenção
middleware/proxy permanece; não migrou a infraestrutura nesta frente.

Prévia Vite isolada em `http://127.0.0.1:4199/etiquetas.html?secao=validades`.
Ações simuladas, sem banco/fila reais. Navegador controlado pelo MCP
`mcp__cua_repl`; nenhum runner de navegador alternativo nesta tarefa. Capturas e
80 auditorias consultivas em 320/390/768/1440 px, claro/escuro, mais comparação
1672 × 942 com a arte do usuário. Fonte, implementação e recorte foram revisados
no mesmo contexto. [Design QA](../../../design-qa.md#validades--linha-visual-de-16102026).
Capturas locais: `<DIRETORIO_PRIVADO_DO_OPERADOR> autorizado/Downloads/grazing-hub/.tmp/validades-nova-linha-20261016`.

### Limites e próximo passo

- Entrega inicialmente preservada em branch própria. Após a autorização atual
  do usuário, **integrada e publicada**, conforme o registro acima.
- Nenhuma etiqueta, baixa, responsável, ponto ou perfil real foi alterado para teste.
  A impressão física do template 4 é resultado histórico relatado pelo usuário;
  esta entrega não executou teste físico novo. Conector/Wi-Fi preservados.
- Não há referência humana nova de pixels no runner oficial. A inspeção técnica
  não equivale à aprovação humana, certificação de acessibilidade ou teste em
  dispositivo móvel físico. O preview usa dados fictícios e estado sem foto.
- A sessão real e as telas foram conferidas após a publicação. Nova impressão
  física desta entrega não foi executada; se necessária, seguir o ensaio
  acompanhado de OPERACAO.md, sem repetir trabalhos incertos.
- Armazenamento: ambiente reaberto oficialmente; cerca de 13,6 GB livres antes
  do build, sem cópia ou instalação. A prévia ficará ativa para revisão.
  Close/limpeza desse ambiente aguardam o fim do servidor dependente; não o
  registrar como encerrado nem remover caches em uso.


## Operação integrada — 16/10/2026

Frente atual: `codex/validades-operacao-20261016`, worktree
`<DIRETORIO_PRIVADO_DO_OPERADOR> autorizado/.codex/worktrees/validades-erro-etiquetas-20261014/grazing-hub`,
base `881f3040912ce9402dfd296e6d3ef59aef4d485d`. Pedido: simplificar impressão,
pontos compactos/exclusão, painel e baixa, navegação e configuração de responsáveis.
Requisitos e caminhos canônicos em [Etiquetas](../../etiquetas.md#operação-no-validades--16102026).

- Implementados: botão único Imprimir, seleção de destino quando necessária,
  exclusão recuperável de ponto sem apagar histórico, bloqueios de fila/padrão,
  cartões recolhidos, Voltar no topo e etapas anteriores acionáveis.
- Implementados: painel com todas as vencidas, baixa parcial por quantidade com
  idempotência/auditoria, usuários habilitados e responsáveis sem conta.
- Banco local isolado: PostgreSQL 17 em 127.0.0.1:55456, base `validades_teste`;
  135 migrations aplicadas pelo executor oficial e reexecução com zero pendências.
  Nunca usar o plano/hash desse banco como autorização do destino produtivo.
- Comandos: Prisma validate/generate; `node scripts/migrations-publicacao-fiscal.mjs
  --planejar` e `--bootstrap` somente com o hash aprovado para o destino conferido;
  Vitest com `ETIQUETAS_BANCO_TESTE=1`, lint focado, lint:design, tsc --noEmit,
  Next build --webpack e smoke HTTP `ETIQUETAS_HTTP_TESTE=1` na porta 3107.
  Node 22.23.2 e dependências existentes do lockfile.
- Prévia: `testes/visual/etiquetas.html`, Vite da fixture na porta 4199, ações
  simuladas; validação nunca envia trabalho à Zebra. Evidências e relatórios locais
  em `.tmp/validades-operacao-*` e na pasta equivalente do checkout principal.
- Limites: impressão física anterior foi confirmada pelo usuário em 15/10 para
  o template 4. Esta mudança de fluxo não executou nova impressão física, não
  alterou a Raspberry/Wi-Fi e não comprovou reinício ou computador desligado.
- Validação local concluída antes da integração: regressão geral com 5.680 testes
  aprovados, zero falhas e 936 condicionais não executados. Bateria final de operação:
  29 aprovados; smoke HTTP: 7 aprovados. Prisma validate/generate, typecheck, lint,
  lint:design e build de produção passaram. Contrato de permissões também registra
  a ação fiscal preexistente que faltava no inventário; nenhum código fiscal mudou.
- Imagens consultivas em 320/390/768/1440 px, claro/escuro: pontos, responsáveis,
  painel; revisão em tema claro. Auditoria visual identificou falta de rótulo na busca; corrigida
  com aria-label e reconferida. Prévia usa dados fictícios e ações simuladas.
  Runner oficial de referências: cinco cenários em 390 px/claro passaram, sem
  referências humanas aprovadas para comparação de pixels.
- Publicação desta frente foi autorizada no pedido. Resultado do deploy/smoke,
  revisão final, contagens e pendências devem ser conferidos no relatório da tarefa.

### Publicação e ajuste do botão

A revisão `053cd28be9d1e0f6953075d821f7eb885b81657e` foi integrada e publicada.
Contêiner `04ff8d65f0a3`, ativo por mais de três minutos sem reinício no smoke.
Prisma sem pendências; HTTPS, bloqueio sem sessão e redirecionamento legado
conferidos. Configuração fiscal preservada. Backup privado pré-migration:
`<BACKUP_PRIVADO>` (dump íntegro).

O usuário excluiu o ponto sem vínculo pela interface. Conferência autenticada:
somente Produção padrão permanece; cadastro excluído pode ser restaurado inativo.
Painel mostrou 14 etiquetas vencidas, inclusive de meses anteriores. Aba
Responsáveis e botão Dar baixa foram conferidos sem alterar responsáveis ou baixar
registros reais. Nenhuma nova impressão foi enviada.

Ajuste posterior solicitado: mostrar o texto Excluir junto ao X. Usa a variante
optativa `Button variant="excluir-rotulo"`, registrada na Central e demonstrada
como Em revisão. Os demais botões conservam a apresentação compacta. Validação
incremental: 153 testes aprovados, zero falhas e sete condicionais não executados;
42 contratos visuais e dez cenários de referências consultivas passaram em
390 px/claro e escuro. A variante foi inspecionada na fixture em 320/390/768/1440 px,
claro/escuro, com oito auditorias sem apontamentos. Build e smoke da revisão final
constam no relatório da tarefa.

## Registro histórico da preparação inicial — 24/09/2026


- [x] Banco e domínio em código: schema e migration SQL aditiva, fila e vínculo com reserva atômica. `prisma validate` e `migrate diff` conferidos; 66 migrations aplicadas em base nova, e a última aplicada após 65 anteriores com dados fictícios preservados, em PostgreSQL local exclusivo. Reexecução do mecanismo não reaplicou SQL.
- [x] Backend em código: ações por sessão, API por dispositivo com revogação, entrega única e expiração. Os seis testes de integração PostgreSQL e sete smoke HTTP opt-in passaram. Fluxo HTTP/conector Python exercitado localmente com USB simulada em arquivo, inclusive concorrência, revogação, resultado incerto, permissão e reimpressão explícita.
- [x] Interface em código: gestão de pontos, estados, seleção, teste, histórico, confirmação física opcional, reimpressão e consulta Wi-Fi. Além dos componentes, telas conectadas à aplicação e ao banco reais de ensaio foram inspecionadas em 390 × 844 e 768 × 1024; tabela histórica possui rolagem horizontal funcional.
- [x] Conector e instalador preparados: HTTPS de saída, escrita USB com diário persistente e helper delimitado com reversão Wi-Fi. Instalação e testes físicos pendentes de autorização.
- [x] Ambiente preparado com `npm ci`: Prisma validate/generate, Next typegen, lint, lint:design, typecheck e build de produção passaram. A bateria ampla revelou uma lacuna no contrato de permissões das ações de pontos; guardas e contrato corrigidos, com 127 testes focados aprovados. Bateria final: 1.217 aprovados e 216 pulados por condição. Os 13 testes de Etiquetas antes pulados foram executados (6 banco na bateria e 7 HTTP separadamente); 209 casos condicionais de outros módulos permanecem sem execução. Sem impressora ou celular físico.
- [x] Documentação operacional: `OPERACAO.md` e atualização do mapa de Produção.
- [ ] Publicação e smoke: pendentes de autorização.

Estado atual: Windows fora da empresa, sem rota autorizada à Raspberry; equipamento não consultado. A falha inicial de `tsc` resultou de pacotes declarados ainda não instalados e tipos Next ainda não gerados; com lockfile instalado e `next typegen`, o typecheck completo passou. A revisão integrada à base futura ainda exige repetição do nível C. Publicação, instalação, USB/Zebra e celular físico dependem de autorização e presença na unidade; preservar o Wi-Fi de 2,4 GHz já configurado. Ver sequência concreta em [OPERACAO.md](OPERACAO.md).
