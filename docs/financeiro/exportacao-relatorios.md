# Exportação de Fluxo de Caixa e DRE — validação de 06/10/2026

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

Implementação: `d17332e3`, integrada sobre `2cd3460f`. Contratos e caminhos estão
no [guia financeiro](../modulos/financeiro.md#exportação-da-dre-e-do-fluxo-de-caixa).

## Evidências locais

- `npx vitest run testes/financeiro/exportacao-interface.test.tsx testes/financeiro/exportacao-relatorios.test.ts --maxWorkers=1`:
  8 testes aprovados. Inclui modo Caixa/Competência, datas aplicadas, categorias
  recolhidas, zeros, subtotais, detalhes do período, células numéricas, agrupamentos
  XLSX, texto que começa por `=` e leitura do PDF de um mês completo.
- `npm test -- --maxWorkers=2`: 2.217 aprovados, 430 ignorados, um timeout de 5 s
  em `testes/vendas/interface.test.tsx`, durante o build simultâneo. Reexecução
  isolada desse arquivo, com `--maxWorkers=1`: 28 aprovados sem alterar timeout,
  código ou asserções. Não se apresenta a execução inicial como integralmente verde.
- Após integrar a publicação concorrente de Faturas: `npx vitest run testes/financeiro --maxWorkers=2`:
  368 aprovados, 109 ignorados (38 arquivos aprovados e 3 ignorados). Os opt-ins
  de integração com banco/serviços não foram ativados; não houve mudança de schema,
  consulta, autorização ou escrita financeira nesta implementação.
- ESLint dos arquivos alterados, `npm run lint:design`, `npx tsc --noEmit` e
  `git diff --check`: aprovados. `next typegen` preparou os tipos do checkout novo.
- `npm run build`: aprovado também após a integração, incluindo TypeScript.
  Avisos existentes de middleware/Edge Runtime não impediram o build.
- Smoke local do build com host autorizado: DRE e Fluxo retornaram 307 para login
  sem sessão; host desconhecido retornou 421.
- Prévia Vite isolada `exportacao-financeiro.html`: menus nas duas telas e downloads
  reais de PDF e XLSX da DRE e do Fluxo com dados fictícios. PDFs renderizados
  com Poppler e conferidos visualmente, incluindo a página de lançamentos. A coleta
  automática do evento de download no navegador interno expirou, mas os arquivos
  baixados foram encontrados e inspecionados. Nenhum dado real foi exportado em teste.

## Publicação

- Branch `codex/exportar-financeiro` e `main` conferidas no remoto em `d17332e3`.
- Backup e configuração anterior privados em
  `<BACKUP_PRIVADO>` na VPS.
  Índice do dump verificado por `pg_restore --list`; ID da imagem anterior preservado.
- Referência visual permanece **Em revisão** humana.
- Dokploy concluiu o build. Tarefa `m0ak4mi7vhmlyr76hz9ppqf56`, contêiner
  `e11d40660c19`, imagem `sha256:c34d0deea79dd347bc0d9c2e553cee6f44df06afb118c97e4f7a367e6ac2cea4`.
  Conferência sem reinícios; configuração fiscal preservada e 101 migrations
  aplicadas, sem pendências (`prisma migrate status`).
- UI autenticada em HTTPS: Fluxo de Caixa e DRE carregaram, com botão Exportar e
  opções PDF/XLSX presentes nas duas telas. Sem sessão, ambas redirecionaram ao
  login (307). A inspeção em produção foi somente de leitura; downloads de teste
  foram feitos exclusivamente na prévia sintética.
- Esta evidência pós-deploy fica na branch de trabalho, sem novo deploy documental.

## Correção de alinhamento — 06/10/2026

- DRE e Fluxo agora compõem as ações na barra de `FiltroPeriodo`, seguindo os
  padrões 5 (alinhamento), 7 (botões) e 11 (filtros) da Central. Competência e Caixa
  ficam imediatamente após Limpar datas; Exportar fica na extremidade direita.
  Ajuda e validação ocupam linhas próprias. Controles e ações têm 36 px de altura.
- Prévia isolada com dados fictícios: em 1.024 px, a posição vertical de todos os
  controles é idêntica em cada barra, e a borda direita de Exportar coincide com
  a barra. Conferidos também Mês completo e largura de 390 px, sem overflow da
  página; em tela pequena o regime permanece junto de Limpar datas e Exportar
  ocupa a próxima linha à direita. Captura sintética salva fora do repositório.
- Bateria do Financeiro e demais consumidores de `FiltroPeriodo` (Notas fiscais,
  NFS-e, Inventário e Estoque): 732 aprovados, 173 ignorados e um timeout de 5 s
  em `testes/inventario/perdas-interface.test.tsx`, com build simultâneo.
  Reexecução sem build, incluindo esse arquivo, controles e exportações:
  30 testes aprovados em quatro arquivos, sem alterar código ou timeout do teste.
  A primeira execução não é apresentada como integralmente aprovada. A bateria
  anterior do mesmo escopo teve 733 aprovados e 173 ignorados.
- Os opt-ins de banco/serviços permanecem desativados. A correção é de composição
  visual; a composição original permanece para consumidores sem ações adicionais.
- Revisão final: lint dos quatro TSX, `lint:design`, `tsc --noEmit`, build webpack
  e `git diff --check` aprovados. Smoke do build local: DRE e Fluxo redirecionam
  para login (307) sem sessão; host inválido é bloqueado (421).
