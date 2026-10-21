# Entradas avulsas e extrato individual

Objetivo: inclusão no topo com foco, consulta agrupada e correção auditada de entradas,
e aba Movimentações no detalhe de insumos/preparações. Referências: formulário atual,
MovimentacoesTable e InsumosTable; primitives e tokens da Central, sem variante nova.

MovimentacaoEstoque e SaldoEstoque continuam sendo as fontes de estoque. Um cabeçalho
operacional e versões imutáveis preservam os campos comerciais e a autoria. Compras
anteriores são consultáveis e adotadas na primeira correção, sem reescrever movimentos.
Ajustes anteriores só entram quando sua origem manual é identificável com segurança.

Correções exigem inventario/editar, autorização vigente na transação, versão otimista
e chave idempotente. Deltas são lançados agora pelo gravador comum sob sua trava de
reservas. Não restaurar fotografias de saldo, apagar movimentos nem retroagir ajustes.
Saldo disponível e custo residual devem comportar a correção. Consumo posterior não
bloqueia automaticamente. A avaliação residual conserva os valores já consumidos;
custos anteriores permanecem nos registros. Mudança de unidade cadastral bloqueia
correção até conciliação, pois não há conversão histórica confiável.

Compras conservam fornecedor, datas e obrigação financeira original. Correções de
itens e rateio não podem alterar o total financeiro; valores que exigiriam reabrir
liquidação/fatura devem ser tratados no domínio Financeiro. Nenhuma integração de
Pedidos é ligada. Não há lotes físicos nas entradas atuais; controles de produção e
validade permanecem em seus registros de origem.

Extrato exige visualização vigente de Insumos e Estoque, consulta a mesma tabela real, com filtros, ordenação e paginação no servidor,
reconstruindo saldos antes dos filtros. Origens conhecidas têm link; origens sem vínculo
não são inferidas. Dados anteriores sem unidade comercial mostram essa limitação.

Aceite: inclusão preserva linhas; edição adiciona/remove/troca itens e registra diferenças;
concorrência e repetição não duplicam saldos; saldo insuficiente causa rollback integral;
consumo parcial e movimentos posteriores conservados; teste PostgreSQL descartável;
lint/design/typecheck/build e imagens 320/390/768/1440, temas claro/escuro;
backup verificado, PR/merge autorizado e smoke de produção somente leitura.

## Ajuste solicitado do histórico — 12/10/2026

Histórico como botão de ícone na entrada, sem seção lateral. Ordem pela data/hora de
lançamento, do mais recente ao antigo. Número permanente somente numérico, exibido
junto à data. Colunas: data de lançamento, fornecedor, itens com quantidade, valor
total, status com ações oficiais de editar e excluir. Edição direta em popup preenchido.

Excluir significa estornar a versão atual. Preservar o documento anterior, versões,
autoria e movimentos posteriores. Exigir confirmação, motivo, autorização e versão
atual. Cancelar títulos pendentes com as guardas financeiras existentes na mesma
transação. Pagamento/vínculo ativo, falta de saldo livre ou custo residual inseguro
impedem a exclusão com mensagem. Não apagar registros contábeis ou operacionais.
