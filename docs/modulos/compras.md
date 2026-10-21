# Compras

Mapa conferido em 23/09/2026, base 2fac409. Pedidos, calendário, cotações e recebimentos.

## Rotas e componentes

Base: `src/app/(protegido)/compras`. Nomes relativos abaixo pertencem a essa base.

- /compras → page.tsx/actions.ts; pedidos-view.tsx, pedidos-table.tsx, pedidos-calendario.tsx
- pedido-dialog.tsx, pedido-detalhe-dialog.tsx, recebimento-dialog.tsx
- calendario.ts, reagendar-pedido.ts, cores-status.ts

## Serviços

- src/lib/compras/impressao-pedido.ts: documento térmico
- src/lib/insumos/conversoes.ts: unidades compartilhadas

## Banco de dados

PedidoCompra/Item/Anexo/Historico → Recebimento/Item/Divergencia; Cotacao; Fornecedor e Insumo existentes.

## Regras importantes

- Recebimento registra chegada, não estoque/financeiro. Não introduzir esses efeitos aqui.
- Fornecedor avulso não cria cadastro, homologação ou cotação silenciosamente.
- Editar preserva itens históricos, inativando-os; reabrir exige motivo e não soma conferência reaberta novamente.
- Trava por pedido serializa editar/receber/excluir/reabrir/reagendar. Reagendamento altera só previsão e confere estado anterior.
- Exclusão é lógica; snapshots de unidade/fator conservam o significado de pedidos antigos.
- Rascunho em sessionStorage protege falha de ação antiga após deploy; transporte incerto exige conferir resultado antes de repetir.

## Integrações e cuidados

Impressão 80 mm no navegador não comprova impressora física. Não receber/excluir pedidos reais como teste.

## Testes relevantes

testes/compras (COMPRAS_BANCO_TESTE no PostgreSQL isolado); testes/insumos e testes/cadastros conforme consumidor. Prévia testes/visual/compras.vite.config.mts.
Validar proporcionalmente pelos [níveis A/B/C](../contexto/testes.md).

## Referências

[Insumos](insumos.md), [Cadastros](cadastros.md), [Estoque](estoque.md).
