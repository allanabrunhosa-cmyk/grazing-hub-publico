# Exclusão de insumos e prioridade cadastral

## Comportamento

A exclusão exige `insumos/excluir` e confirmação em popup que identifica preparações,
produtos, complementos e composições particulares afetadas. A confirmação retira somente
esse ingrediente das composições atuais, preservando os demais ingredientes. Vendas,
perdas, compras, movimentos, contagens, etiquetas e pedidos existentes conservam seus
registros e referências. O insumo deixa o catálogo, inclusive a lista de inativos.

O fornecedor principal e a marca principal homologada (ou primeira marca cadastrada)
precedem as demais opções. A lista exibida serve de chave da ordenação em Insumos
e Contagem; as demais opções são ordenadas em português e sem duplicar fornecedores.

## Implementação e concorrência

- `Insumo.excluidoEm`, `excluidoPorId` e `exclusaoSnapshot`: migration SQL aditiva
  `20261006090000_insumos_exclusao_historico`; nenhuma remoção de registros históricos.
- `src/lib/insumos/exclusao-servidor.ts`: releitura transacional da sessão, travas de
  acesso, cadastros de vendas e composições, trava da linha e revisão do popup. Mudança
  entre leitura e confirmação retorna nova lista e exige confirmação novamente.
- Guarda de composição impede rascunhos antigos de reinserir um ingrediente excluído;
  edição, importação e status não podem reativar um insumo excluído.
- Composições JSON de opções e ajustes por produto também são revisadas. Versões de
  produtos/grupos afetados avançam para invalidar edições antigas. Snapshot de exclusão
  conserva autor, composições retiradas e quantidades sem reduzir a precisão.
- Pedidos em andamento continuam utilizando suas fotografias de composição. Exclusão
  do catálogo não equivale a inativação operacional de ingrediente fotografado.

## Aceite

Excluir um insumo com histórico deve preservar todos os registros e retirar apenas
os vínculos atuais confirmados. Cancelar não grava; repetição não duplica auditoria;
conflito e revogação de acesso não causam remoção parcial. Conferir integração PostgreSQL
com fixtures, consumidores de estoque/vendas/compras, prévia e smoke sem exclusão real.

Referências: [Insumos](../../modulos/insumos.md), [Estoque](../../modulos/estoque.md),
[Banco](../../contexto/banco-de-dados.md). Publicação autorizada pelo usuário em 06/10/2026.
