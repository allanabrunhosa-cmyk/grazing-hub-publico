# Cancelamento integral da compra — 06/10/2026

Cancelamento de despesa integrada cancela a compra inteira, todas as parcelas e
reverte os movimentos físicos uma única vez, após popup com itens, quantidades,
local e data originais. Para compras, a reversão é saída: remove a entrada;
não devolve unidades que nunca saíram. Preserva nota/XML, movimentos e auditoria.
Despesas sem origem física conservam o fluxo existente.

Origens: NF-e recebida, entrada avulsa completa e compra simples legada.
Pagamento, conciliação, vínculo de cartão/Pedido ou custo de entrega ativo
bloqueiam a operação. O usuário deve corrigir os vínculos primeiro.
Prévia assinada por hash do estado e confirmação com motivo (15–255 caracteres);
permissões e sessão são relidas no servidor sob trava. Reservas de estoque
continuam protegidas pelo gravador oficial. Cancelamento não restaura custo médio
antigo sobre compras/consumos posteriores.

NF-e pendente/recusada não gera estoque/financeiro. Somente Aceitar nota registra
confirmação e conclui os efeitos locais. Recusa de nota já aceita apresenta a
mesma prévia de reversão e valida os efeitos antes do envio fiscal. A evidência
fiscal é independente do commit local; falha local informa retomada sem reenviar
o evento já confirmado. Cancelamento local não cancela a NF-e do fornecedor.
Compra local cancelada não é reaceita implicitamente.

Persistência aditiva: CancelamentoCompra (chave de origem única, autor/motivo/hash/
fotografia); HistoricoAcesso guarda IDs de estorno e saldos; MovimentacaoEstoque.estornoDeId único. Sem backfill
automático e sem modificação de migrations aplicadas.

Correção operacional autorizada: uma única compra Impakto; preservar NF 3331374
paga e cancelar efeitos da NF 3333074 recusada. Executar separadamente do deploy,
pela operação oficial, após conferência da prévia. Sem novo evento SEFAZ.

Aceite: rollback integral, idempotência/concorrência, cancelamento de todas as
parcelas/itens, bloqueios/autorização/estado alterado, inversão na mesma data,
sem efeitos em notas pendentes/recusadas, popup acessível e regressão de consumidores.
