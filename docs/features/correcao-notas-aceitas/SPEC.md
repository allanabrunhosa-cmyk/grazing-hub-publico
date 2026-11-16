# Correção de pagamentos e notas aceitas

## Objetivo

Corrigir dados operacionais lançados incorretamente sem repetir a manifestação fiscal,
duplicar despesas ou perder o histórico. Pedido de implementação e publicação em 16/11/2026.

## Comportamento esperado

- A revisão de fatura permite selecionar uma despesa pendente registrada em outro cartão.
  O vínculo explícito corrige o cartão na mesma transação, com autorização e auditoria.
- Notas aceitas podem ser abertas para corrigir pagamento, recebimento e associação
  de itens a insumos ou categorias. O salvamento é explícito e exige motivo.
- O XML, os valores fiscais e o aceite externo permanecem como evidências da origem.
  Corrigir dados internos não transmite outro evento à SEFAZ.
- Alterações concorrentes exigem recarregar a nota. Pagamentos e vínculos protegidos
  recebem tratamento específico; um bloqueio não deve impedir mudanças independentes.
- Correções físicas preservam movimentos anteriores e o estoque já consumido.
  Saldo disponível, reservas e custo residual precisam continuar coerentes.

## Arquitetura e limites

Reutilizar os formulários de NF-e/NFS-e e os serviços de Faturas, Financeiro e Estoque.
Manter IDs e relacionamentos financeiros quando houver correção de dados, além de
sincronizar o cartão da duplicata com seus componentes financeiros. O cancelamento
de compra deve continuar a considerar a entrada de estoque vigente.

As decisões implementadas e suas evidências ficam em [TASKS](TASKS.md).
Regras gerais: [Fiscal](../../modulos/fiscal.md), [Financeiro](../../modulos/financeiro.md)
e [Estoque](../../modulos/estoque.md). Não operar notas, pagamentos ou estoque reais
para validar a entrega.

## Critérios de aceite

1. Vincular despesa de outro cartão corrige o dado e conserva valor, identidade e histórico.
2. Falta de permissão, alteração concorrente ou título indisponível não deixam efeitos parciais.
3. Abrir nota aceita apresenta seus dados atuais e permite salvar correções autorizadas.
4. Repetir ou concorrer com o salvamento não duplica efeitos físicos ou financeiros.
5. Correção de estoque mantém entradas históricas e respeita saldo, reservas e custo.
6. Lint, tipos, testes de domínio, integração local, build e QA isolado são registrados.
7. Publicação só é concluída após confirmar a revisão em produção e o smoke autorizado.
