# Popup de movimentações do Fluxo de Caixa — 06/10/2026

## Correção

Base integrada: `3f039611`. Mudança localizada em
`src/app/(protegido)/financeiro/fluxo-de-caixa/fluxo-caixa-view.tsx`.

Descrições e referências sem espaços ultrapassavam a largura mínima dos itens
flex, deslocando valores e ações e criando rolagem horizontal no diálogo.
O detalhe agora usa largura `sm:max-w-xl`, quebra de texto completa e `min-w-0`.
No celular, valores/ações ocupam a segunda linha. Somente a lista tem rolagem;
cabeçalho e fechamento permanecem visíveis, respeitando a altura da viewport.
Não acrescenta cálculos, consultas ou dependências. A exclusão usa o X do Button
oficial, preservando a confirmação e os mesmos eventos.

## Validação

- Prévia oficial Vite, `testes/visual/fluxo-popup.html`, com 18 registros fictícios,
  chaves extensas, referências sem espaços, valores grandes, estados pendente/baixado
  e vínculos de fatura/pedido. Antes da correção, popup de 326 px tinha conteúdo de
  1.840 px. Após: largura e conteúdo iguais nas viewports de 320, 390 e 1.024 px;
  rolagem apenas na lista, fechamento dentro da viewport e retorno da confirmação
  de cancelamento ao resumo. Capturas sintéticas fora do repositório.
- `npx vitest run testes/financeiro/fluxo-hierarquia.test.tsx testes/financeiro/plano-fluxo-caixa.test.ts --maxWorkers=1`:
  9 aprovados em dois arquivos. Confirmações e links da origem preservados.
- `npx vitest run testes/financeiro --maxWorkers=2`: 369 aprovados, 109 ignorados,
  38 arquivos aprovados e três ignorados. Opt-ins de banco/serviços não ativados.
- Cliente Prisma local regenerado para o schema já integrado pela main;
  a primeira conferência de tipos identificou o cliente anterior desatualizado
  e um campo opcional da fixture, corrigido antes da validação final.
- Referência visual permanece Em revisão humana.
- Revisão final: lint dos TSX alterados, `lint:design`, `tsc --noEmit`,
  `prisma validate`, build webpack e `git diff --check` aprovados.
  A primeira tentativa de build falhou com o cliente local anterior e a fixture;
  a compilação final foi realizada após regenerar o cliente e corrigir a prévia.
- Smoke local do build: Fluxo retorna 307 para login sem sessão; host inválido
  retorna 421. Nenhuma movimentação real foi alterada para validar a correção.
