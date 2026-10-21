# Estoque

Mapa conferido em 23/09/2026, base 2fac409. Posição, movimentos, contagem, entradas sem nota e perdas.

## Rotas e componentes

Base: `src/app/(protegido)/inventario`. Nomes relativos abaixo pertencem a essa base.

- /inventario → page.tsx, posicao-atual-table.tsx, historico-insumo-actions.ts
- /inventario/movimentacoes → page.tsx e movimentacoes-table.tsx na subpasta; manter ação Entrada avulsa
- /inventario/entrada-avulsa → entrada-avulsa-form.tsx/actions.ts
- /inventario/contagem e /inventario/contagem/[id] → lista, formulário, actions e impressão
- /inventario/perdas → actions.ts, categorias-actions.ts, tabelas, diálogos e resumo

## Serviços

- src/lib/estoque/registrarMovimentacao.ts: gravação compartilhada de saldo/custo
- src/lib/estoque/posicao.ts, extrato.ts, detalhe-movimentacoes.ts: reconstrução e consulta
- src/lib/estoque/cancelar-contagem.ts, consultar-perdas.ts, resumo-perdas.ts
- src/lib/inventario/entrada-avulsa.ts: calcularCompraSemNota e rateios

## Banco de dados

SaldoEstoque por Insumo/LocalEstoque; MovimentacaoEstoque; EntradaAvulsaCompra; InventarioContagem/Item; Perda/CategoriaPerda/PerdaExclusao.

## Regras importantes

- Quantidade/conversão mantêm precisão; não somar unidades heterogêneas.
- Entrada Completa rateia custos e gera obrigação financeira; Simples é ajuste sem despesa. Não duplicar lançamento integrado.
- Receber pedido não movimenta estoque. Aceite fiscal/entrada avulsa fazem isso.
- Data efetiva do movimento usa createdAt nos fluxos existentes. Extrato reconstrói movimentos posteriores com desempate; custo histórico da posição usa custo médio atual.
- Excluir perda preserva saída e cria devolução auditada. Cancelar contagem finalizada exige administrador/motivo e estorna movimentos, sem restaurar saldo fotografado.
- Perdas inicia do primeiro dia do mês até hoje, no calendário de Brasília. A lista e o resumo filtram pela data do registro; o histórico administrativo filtra pela data da exclusão. Limpar datas permite consultar todo o histórico. Testes com registros datados devem fixar somente o relógio, sem remover o filtro ou limitar a precisão das quantidades.
- Recalibração de custos de 23/09 foi operação pontual; não repetir scripts como rotina.

## Integrações e cuidados

Pedidos — liberação operacional de 25/09/2026: `registrarMovimentacao` compartilha trava `estoque-reservas-pedidos` e rejeita saídas que invadam `ReservaPedido`. A tabela é criada por migration aditiva; implantar schema antes de iniciar o código correspondente. `src/lib/vendas/pedidos-fisico.ts` converte reserva em saída na mesma transação, libera no cancelamento e registra perda do material retirado sem segunda saída. Retorno não recalcula custo automaticamente nem restaura ingredientes preparados. Não executar uma versão antiga que ignore reservas com escritas habilitadas. Evidências/limites em [Pedidos](../features/pedidos/EXECUCAO.md).

Destino físico dos pedidos: `pedidos-destino.ts` abre ocorrências tipadas no
cancelamento após preparo/expedição ou retirada manual de material. A devolução
física parcial abre ocorrência pelo detalhe; a resolução exige soma exata de
recuperável + perda, destino/condição/responsável e mantém autor/data. Não produz
caixa nem entrada automática de ingredientes. Revenda/material retirado exige
retorno ou perda comprovados nas reservas de origem, acessíveis na seção
Materiais do detalhe. Alocação por lotes reais em ordem de execução conserva
referências e limita duplo tratamento; fatos de estoque OFF não criam retorno.
O preparo que impede retorno de ingrediente é conferido por item, não por outro
produto do mesmo pedido. Validação opt-in em `pedidos-integracao.test.ts` cobre
OFF, cancelamento misto, revenda parcial e tratamento explícito após ON → OFF.

Gestor — chave de 01/10/2026: começa desligada e permite controle de produção sem
efeito físico. Quando ligada por administrador, o caminho automático baixa no local
configurado e permite saldo negativo, conservando reservas alheias mesmo com cobertura
insuficiente. Essa exceção não altera a proteção padrão do gravador comum ou das ações
manuais. Política, momentos da baixa e não retroatividade têm fonte única no
[contrato do Gestor](../features/pedidos/ARQUITETURA.md#chave-de-estoque-do-gestor--01102026).

Nunca finalizar/cancelar contagem nem excluir perda real para validar deploy.

### Exclusão de insumos e prioridade cadastral — 06/10/2026

A exclusão lógica de insumos conserva perdas, movimentos, saldos e linhas de contagens
existentes. A posição histórica inclui os insumos excluídos para manter a consulta dos
movimentos; o catálogo atual continua exibindo ativos. Pedidos existentes mantêm a
execução de suas fotografias de composição. Contrato e regressão PostgreSQL em
[Exclusão de insumos](../features/insumos-exclusao-historico/SPEC.md).

O DTO da contagem usa `fornecedoresDoInsumo` e `marcasDoInsumo`: principal/primeira
homologada precedem as demais opções. A tabela mostra Marcas, permite busca por elas e
usa a lista apresentada na ordenação de marcas/fornecedores. A folha conserva a ordem
prioritária dos fornecedores de cada item. A contagem cega continua sem saldo do sistema
no payload enquanto em andamento.

## Testes relevantes

testes/inventario; movimento/custo exige consumidores em testes/notas-fiscais e Financeiro. Flags de integração constam no teste, incluindo CONTAGEM_BANCO_TESTE e PERDAS_BANCO_TESTE. Prévias: testes/visual/extrato-estoque.vite.config.mts e posicao-atual.vite.config.mts.
Validar proporcionalmente pelos [níveis A/B/C](../contexto/testes.md).

## Histórico e correção de entradas avulsas — 12/10/2026

`/inventario/entradas` consulta operações completas, inclusive compras anteriores;
`/inventario/entradas/[id]` detalha e corrige por `inventario/editar`. A inclusão aceita
vários itens também em Simples, insere no topo com foco e mantém Adicionar item acessível.
O botão fica imediatamente abaixo do Item 1, dentro de Itens recebidos, sem rodapé fixo.
Insumo, Local, Qtd, Fator e Valor compartilham uma linha em desktop/tablet; celulares
reorganizam os campos. A unidade cadastrada é fixa no sufixo de Qtd, sem campo adicional.
`entrada-avulsa-historico.ts` valida limites, conversões exatas, diferenças e deltas;
`estoque/entrada-avulsa-servidor.ts` mantém `EntradaAvulsaRegistro/Versao`, sem duplicar
a fonte física `MovimentacaoEstoque/SaldoEstoque`. Migration aditiva
`20261012120000_entradas_avulsas_versionadas`; versões imutáveis por trigger.

Escritas revalidam sessão/permissão na transação, usam a trava comum de reservas,
chave idempotente vinculada a autor/conteúdo e versão otimista. Correções produzem
deltas no instante atual; preservam registros anteriores, consumos, reservas e
valores já consumidos. Custo residual conserva o valor corrente mais a diferença
do documento; não revaloriza saídas anteriores. Simples sem valor estimado mantém
a base de custo vigente. Redução sem saldo livre, unidade cadastral divergente,
estorno externo ou custo residual inviável bloqueiam com motivo e rollback.

Uma compra corrigida conserva sua obrigação financeira e seu total. Não alterar
pagamentos/faturas no editor de estoque. Cancelamento financeiro baseado nos itens
originais recusa uma compra cuja versão vigente mudou produtos/quantidades, evitando
estorno indevido. Correções de observação/conversão sem mudar a quantidade física
continuam compatíveis. Campos comerciais ausentes no legado não são inventados:
detalhe sinaliza reconstrução e preserva custos/rateios originais separadamente.

Insumos/Preparações têm aba Movimentações no detalhe expandido. Consulta em
`estoque/extrato-individual.ts`, com saldos por local reconstruídos antes dos filtros,
ordenação e paginação de 25, autor e vínculos reais. Fontes sem URL própria têm
detalhe somente leitura em `/inventario/movimentacoes/[id]`, com permissão do domínio
de origem. Movimentos de Pedidos vêm do vínculo JSON auditado, não de texto livre.
Nenhuma chave de integração é ligada. Testes e evidências em
[execução da feature](../features/estoque-entradas/TASKS.md).

A aba individual exige visualização de Insumos **e** Estoque, também no servidor;
não amplia acesso pela navegação. Autoria ausente no movimento é consultada na
atividade auditada existente. Quantidade conserva a string decimal registrada;
saldos que não possam ser reconstruídos sem perda de precisão ficam indisponíveis.
Após correções reais, não voltar ao cancelamento financeiro antigo com escrita
habilitada: ele não conhece a versão corrigida. Preferir correção de código em frente;
nunca restaurar o dump sobre transações novas.

## Referências

[Insumos](insumos.md), [Financeiro](financeiro.md), [entrada avulsa restaurada](../estoque-entrada-avulsa-restauracao.md).

## Consulta da posição

`page.tsx` envia marcas, categoria e fornecedores homologados em `PosicaoAtualRow`. `posicao-atual-table.tsx` busca por nome, especificação, marcas, categoria e nomes dos fornecedores homologados sem acentos; combina a busca com os filtros existentes e mostra os fornecedores homologados. Na posição histórica, esses dados cadastrais são atuais, como o custo médio; somente as quantidades são reconstruídas na data.

## Reversão de compra integrada

O cancelamento integral gera AJUSTE_SAIDA por entrada original, no mesmo local e `createdAt`, pelo gravador oficial. `estornoDeId` único conserva o vínculo e impede duplicidade; CancelamentoCompra e HistoricoAcesso guardam prévia/autor/motivo. Não excluir o movimento original nem recalcular retroativamente o custo médio. A saída respeita reservas de Pedidos e um erro reverte também o cancelamento financeiro. Contrato em [Cancelamento de compra](../features/cancelamento-compra/SPEC.md); regressões no PostgreSQL isolado em `testes/notas-fiscais/custos-integracao.test.ts`.

## Histórico compacto e exclusão de entradas — 12/10/2026

Acesso pelo botão de ícone Histórico na entrada avulsa, sem seção própria na barra
lateral. A lista usa a data/hora de registro em ordem decrescente, fornecedor, itens
com quantidade, total e status. Editar carrega o detalhe autorizado e abre o mesmo
editor em Dialog, preenchido, sem trocar de página após salvar.

`NumeroEntradaAvulsaLegada` guarda apenas a identidade numérica das origens antigas.
Compartilha a sequência de `EntradaAvulsaRegistro.numero`; a adoção conserva o número.
Migration `20261013020000_numeros_entradas_avulsas` numera origens já existentes e
instala triggers para futuros consumidores legados. Não muda estoques, custos ou
títulos; números podem conter lacunas, como qualquer sequência transacional.

Excluir exige inventario/excluir, versão, motivo e chave idempotente. O serviço
`entrada-avulsa-servidor.ts` compensa a versão vigente no instante atual e grava uma
versão cancelada imutável. A lista conserva os itens e o valor anteriores para consulta.
Não apaga lançamentos nem reescreve movimentos. Saldo livre, reservas, unidade e
custo residual usam as mesmas proteções da correção.

Compras reutilizam as verificações de `financeiro/cancelamento-compra.ts`, inclusive
permissão financeira vigente, pagamentos, faturas, extrato e custos de entrega.
`cancelarObrigacoesEntradaAvulsa` cancela apenas títulos pendentes dentro da mesma
transação da compensação. Falha de estoque reverte tudo. O fluxo original do
Financeiro conserva seu comportamento; compras corrigidas podem ser excluídas pelo
histórico com a quantidade atual, sem estornar uma quantidade original incorreta.

## Acesso e filtros compactos do histórico — 12/10/2026

O ícone Histórico fica ao lado de Entrada avulsa em
`movimentacoes/movimentacoes-table.tsx`, com permissão de visualizar Estoque.
Não fica dentro do formulário de lançamento. A lista usa CampoBusca e FiltroPeriodo
na mesma linha no desktop, com quebra responsiva. Busca aplica termos combinados,
sem acentos, em todo o lançamento, antes da paginação: número, produtos, fornecedor,
responsável, observações, locais, quantidades, valores e datas. Digitação consulta
após 300 ms; Enter aplica imediatamente; limpar também cancela a busca pendente.
Datas seguem o rascunho/blur/Enter do componente oficial. A URL preserva busca e
período e reinicia a página ao mudar um filtro. Seletores separados de insumo e
responsável foram removidos da tela, junto da consulta desnecessária ao catálogo.
A última coluna se chama Ações e contém apenas editar/excluir. Entradas encerradas
conservam as ações bloqueadas, com motivo e acesso ao detalhe pelo número.
Nenhuma regra de escrita, tabela, migration ou saldo mudou neste ajuste.
