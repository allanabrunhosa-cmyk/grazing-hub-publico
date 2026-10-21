# Financeiro

## Data da compra em Pedidos — 20/10/2026

Pedidos novos usam a Data da compra na competência dos títulos HUB. O dia vem da
loja e pode ser alterado no orçamento manual. Confirmação, captura, pagamento e
repasse conservam seus fatos e datas próprios. Prazo por venda parte da compra;
prazo por pagamento exige o fato inicial comprovado. Dias úteis seguem calendário
bancário nacional, com feriados, calculado localmente e versionado no snapshot.
Datas explícitas permanecem prioritárias. Pedidos anteriores sem Data da compra
conservam a regra anterior; não há backfill ou regravação de recebimentos.
O modo EXTERNO conserva seu controle financeiro externo.
[Contrato, limites e evidências](../features/pedidos/CADASTRO-COMPRA-20261020.md).

## Fluxo de caixa mensal

`/financeiro/fluxo-de-caixa` oferece as visualizações Diário e Mensal. A diária
conserva o período escolhido. A mensal ajusta os limites para meses completos e
mostra uma coluna por mês/ano, sem repetir a coluna Total. O modo diário conserva
o Total do período. A tabela usa largura conforme o conteúdo e fica centralizada,
com rolagem interna quando necessário. O mês atual e os futuros podem incluir projeções;
isso não representa fechamento contábil nem baixa dos títulos pendentes.

`src/lib/financeiro/fluxoCaixaMensal.ts` consolida a planilha diária existente.
Cada chave representa o último dia do mês. Receitas e despesas são somadas em
centavos. O saldo usa o valor acumulado no último dia, sem somar saldos diários.
Categorias, hierarquia, IDs, pendências, saldos iniciais e exclusões de crédito
do cliente conservam os contratos de `fluxoCaixa.ts`.

O detalhe da célula mostra os lançamentos do mês e mantém a operação na origem
para Pedidos e Faturas. PDF/XLSX seguem a visualização escolhida; os detalhes da
exportação preservam as datas reais de pagamento/vencimento.

Logo abaixo do saldo, o Resultado do Mês/Dia mostra receitas menos despesas do
próprio período, calculado em centavos por `calcularResultadoFluxoCaixa`.
Saldos iniciais não entram nesse resultado. A informação usa texto menor,
sinal positivo verde, negativo vermelho e zero neutro. A coluna Total diária
mostra o resultado geral. PDF/XLSX incluem a mesma linha numérica após o saldo.

Regressão: `testes/financeiro/fluxo-caixa-mensal.test.ts`,
`fluxo-caixa-mensal-interface.test.tsx`, `exportacao-relatorios.test.ts` e
`fluxo-hierarquia.test.tsx`. Prévia fictícia: `testes/visual/fluxo-mensal.html`.

Mapa conferido em 23/09/2026, base 2fac409. Despesas/receitas, extrato, DRE, fluxo, contas e faturas sem duplicação financeira.

## Rotas e componentes

Base: `src/app/(protegido)/financeiro`. Nomes relativos abaixo pertencem a essa base.

- /financeiro → page.tsx/dre-view.tsx
- /financeiro/movimentacoes → movimentacoes/page.tsx, movimentacoes-view.tsx, conciliacao-view.tsx, conciliacao-actions.ts
- /financeiro/fluxo-de-caixa → fluxo-de-caixa/page.tsx e fluxo-caixa-view.tsx
- /financeiro/bancario → contas-bancarias-view.tsx, cartoes-view.tsx e actions.ts na subpasta
- /financeiro/plano-de-contas → plano-contas-view.tsx/actions.ts na subpasta
- /financeiro/cartoes → importar.tsx, fatura-view.tsx/actions.ts; detalhe em cartoes/faturas/[id]
- /financeiro/cartoes/regras → regras; /financeiro/manifesto-nfs → ver Fiscal

## Serviços

- Pedidos novos (`versaoFinanceiro=1`): categoria de receita do canal de venda do pedido, sem escolha na confirmação (05/10/2026);
  competência na confirmação comercial. `competencia-pedidos.ts` projeta os próprios
  títulos e ajusta reduções na competência original; caixa mantém as datas reais.
  Versão zero/EXTERNO conserva história. Esta política foi aprovada pelo usuário na
  missão de fechamento; não estabelece categorias de despesas ou retenções.
- Movimentações, conciliação e caixa preservam `pedidoVendaId` e oferecem Abrir
  pedido para receber, revisar ou corrigir o registro na origem. Título pendente
  de pedido não é candidato a baixa pela conciliação; títulos já recebidos e taxas
  continuam conciliáveis pelo líquido, sem nova receita/baixa. Canal identifica somente a origem e os relatórios. Mudar o canal ou seu cadastro conserva categoria, competência, valores, pagamentos e vínculos dos títulos.
- `extrato.ts` exclui títulos quitados com crédito da carteira antes de calcular
  entradas/saldo e de agrupar candidatos à conciliação. O título permanece na
  competência e no histórico do pedido, sem representar dinheiro novo. A mesma
  exclusão existe na DRE por caixa e no Fluxo de Caixa.
- `vendas/entregas-custos.ts` vincula/rateia despesa existente à entrega. Não cria
  lançamento nem baixa. `financeiro/custos-entrega.ts` compartilha trava entre o
  vínculo e edição/cancelamento da despesa; primeiro desvincular no Pedido com motivo.
  Pagamento e conciliação continuam disponíveis; a competência/categoria são as da
  despesa original. Custos desconhecidos continuam nulos, sem despesa presumida.

- src/lib/financeiro/extrato.ts: montarLinhasExtrato/calcularExtrato
- src/lib/financeiro/periodos.ts, saldos-iniciais.ts, agrupar-movimentacoes.ts: datas, base por conta e grupos por vínculo
- src/lib/financeiro/calcularDre.ts, fluxoCaixa.ts: relatórios
- src/lib/financeiro/baixarLancamento.ts, exclusaoLancamento.ts: baixa e cancelamento
- src/lib/financeiro/conciliacao: arquivo, identidade, sugestões e serviço
- src/lib/financeiro/faturas: importadores, serviço, consultas, acesso, regras, projeções e relatórios

## Banco de dados

LancamentoFinanceiro → CategoriaFinanceira/conta/fornecedor; MovimentacaoBancaria; ImportacaoExtrato → TransacaoExtrato → VinculoExtrato; CartaoCredito → FaturaCartao → itens/pagamentos → LiquidacaoCartao.

## Regras importantes

- Importação de extrato não altera saldo nem cria despesa. Conciliação exige confirmação e fechamento exato do valor líquido.
- Pagamento de fatura não cria outra despesa. DRE caixa usa liquidações, sem somar novamente o total bancário; competência conserva valores dos itens.
- PDF Inter/Itaú usa final principal único e senha temporária; virtuais agrupados. Total impresso/informado/soma precisam concordar. Datas inferidas são explícitas; sem IA/OCR ou classificação silenciosa.
- Agrupar por ID de nota/duplicata, não nome; busca não transforma total em subtotal. Cancelados não entram no extrato.
- Saldo inicial é início do dia por conta, inclui histórico de inativas, não entra no DRE. Realizados usam pagamento; pendentes, vencimento.
- Conciliação comum não suporta pagamento parcial; faturas suportam liquidação parcial. Desfazer vínculo comum preserva baixa; fatura tem reversão própria.
- Rotas legadas contas/lancamentos redirecionam, mas formulário/mutações ainda são reutilizados de lancamentos/lancamento-dialog.tsx e actions.ts.

## Integrações e cuidados

Mudanças em baixa/custo/parcelas também afetam NF-e, NFS-e e entrada avulsa. Escritas críticas releem permissão/versão sob trava. Não importar/conciliar dados reais para teste.

## Exportação da DRE e do Fluxo de Caixa

O botão `Exportar` de ambas as telas oferece PDF e XLSX. O relatório captura o
resultado já exibido e os filtros aplicados no instante da escolha do formato,
incluindo limites abertos e o modo Caixa/Competência da DRE. Não consulta nem grava
dados adicionais: as páginas continuam exigindo `financeiro.dre`/`financeiro.fluxo`
no servidor antes de fornecer os dados ao cliente.

`src/lib/financeiro/exportacao-relatorios.ts` monta todas as categorias, inclusive
as recolhidas e sem atividade no Fluxo, usando `montarArvoreFluxoCaixa`. Os detalhes
do Fluxo são selecionados pelos IDs das células, conservando projeções e exclusões
da fonte. Histórico usado somente no saldo não vira lançamento do período.

As ações dos relatórios são compostas dentro de `FiltroPeriodo`: `acoes` posiciona
Competência/Caixa após Limpar datas; `acoesDireita` ancora Exportar à direita da
mesma linha de controles. O texto de ajuda/validação fica abaixo dessa linha.
Quando a largura exige quebra, manter Limpar datas e o regime no mesmo grupo;
em telas pequenas, Exportar ocupa a linha seguinte, ainda à direita.
Reutilizar `GrupoAcoes` e a altura compacta dos filtros; não alinhar botões pela
base de um bloco que contém mensagens de apoio.

`exportacao-xlsx.ts` mantém valores numéricos, agrupamentos reabríveis e uma aba
de lançamentos do Fluxo. `exportacao-pdf.ts` mostra todos os níveis, separa os dias
em blocos de até seis colunas e inclui os lançamentos em páginas próprias. Os
totais são os calculados na tela; não somar subtotais dos diferentes níveis. `*`
identifica células com projeções. As bibliotecas são carregadas somente ao exportar.

Regressão: `testes/financeiro/exportacao-relatorios.test.ts` (inclusive leitura dos
arquivos reais) e `exportacao-interface.test.tsx`; prévia sintética em
`testes/visual/exportacao-financeiro.html`. Composição visual **Em revisão**.

## Testes relevantes

Filtro de Movimentações: testes/financeiro/movimentacoes-view.test.tsx, extrato.test.ts e periodos.test.ts. Consulta/agrupamento: agrupar-movimentacoes.test.ts e faturas/relatorios.test.ts. Conciliação: testes/financeiro/conciliacao. Faturas: testes/financeiro/faturas. Baixa: baixa-action.test.ts, baixa-nota.test.ts e consumidores.
Validar proporcionalmente pelos [níveis A/B/C](../contexto/testes.md).

## Referências

[Guia de faturas](../financeiro/cartoes/README.md), [Fiscal](fiscal.md), [Estoque](estoque.md).

## Fronteira para Pedidos — conferência em 24/09/2026, base 465b1cd

- [Pedidos/Receita](../features/pedidos/EXECUCAO.md): o primeiro incremento de M2 adicionou origem `pedidoVendaId` e chave única de efeito em `LancamentoFinanceiro`, sem livro paralelo. O schema operacional ainda não recebeu a migration.
- `lancamentos/actions.ts::criarLancamentoAction` repete o valor e avança competência por recorrência; não divide o total de uma venda. Baixa é integral por título.
- `conciliacao/servico.ts::conciliarExtrato` aceita receita e despesa de taxa na mesma transação, exigindo soma líquida exata; testes em `testes/financeiro/conciliacao/integracao.test.ts`.
- `src/app/(protegido)/notas-fiscais/actions.ts` já pode lançar compra para estoque no grupo CMV. CMV de consumo futuro não deve gerar despesa adicional sobre a mesma compra sem política de reconhecimento explícita.
- `estornarBaixaLancamento` apaga movimento e reabre pendência: correção técnica não representa devolução real de dinheiro, que precisa preservar entrada e saída.
- `calcularDre.ts` inclui lançamentos não cancelados por `dataCompetencia` na visão de competência, mesmo pendentes; a visão de caixa considera os baixados pela `dataPagamento`. `fluxoCaixa.ts` usa pagamento dos realizados e vencimento dos pendentes. Por isso a criação do título já afeta a DRE de competência. O primeiro incremento exige competência e categoria de receita bruta explícitas; isso não aprova a política contábil para vendas reais.
- Títulos de Pedidos são gerados em `src/lib/vendas/pedidos.ts`; baixa direta/ parcial usa `baixarLancamento` na mesma transação. `lancamentos/actions.ts`, `baixarLancamento.ts` e `plano-de-contas/actions.ts` impedem mutação genérica dos títulos vinculados. `conciliacao/servico.ts` só vincula um recebimento de Pedido já baixado, sem nova baixa; um pendente deve ser recebido no Pedido primeiro. A baixa parcial desdobra o saldo, mantendo a raiz e o valor original para rastreamento.
- Incrementos seguintes de M2, registrados em [EXECUCAO](../features/pedidos/EXECUCAO.md), acrescentam controle de captura de cartão, repasses brutos/taxas/líquidos, emissão/pagamento de boleto, devolução evidenciada e crédito do comprador. Reutilizam `LancamentoFinanceiro`, baixa e `MovimentacaoBancaria`; não acionam cobrança ou devolução externa. Em Pedidos novos, somente Pix, boleto, crédito on-line em 1–4x e débito on-line em 1x são selecionáveis. Cadastros históricos do Financeiro permanecem.
- Título quitado com crédito do cliente fica na DRE por competência uma vez e é excluído da DRE de caixa e do fluxo de caixa; concessão e aplicação do crédito não geram movimento bancário. Repasse de cartão baixa o bruto e registra a taxa separada, de modo que a entrada líquida seja rastreável sem receita adicional. Devolução concluída preserva a entrada original e cria saída; solicitação pendente não é saída realizada. Datas e categorias usadas em teste são sintéticas: competência e classificação para uso real ainda exigem aprovação.


Pedidos em modo EXTERNO não geram efeitos financeiros. M2/HUB permanece preservado, com ativação real sujeita às pendências registradas em EXECUCAO. A candidata integra os contratos de Faturas vigentes na main.

## Linhas do plano no fluxo de caixa

O detalhe de uma célula em `fluxo-caixa-view.tsx` usa a largura de detalhes
`sm:max-w-xl`. Cabeçalho e rodapé ficam fora da lista rolável, limitada pela altura
da viewport. As linhas reorganizam valores/ações abaixo da descrição no celular;
`min-w-0` e `overflow-wrap:anywhere` permitem quebrar chaves de nota ou referências
sem espaços, preservando o texto completo. Não ampliar pela largura do texto nem
truncar a descrição para esconder overflow. Prévia sintética de casos extensos:
`testes/visual/fluxo-popup.html`; interações em `testes/financeiro/fluxo-hierarquia.test.tsx`.

`fluxo-de-caixa/page.tsx` fornece o plano não excluído (ativo ou inativo) separado
das opções ativas para editar lançamentos. `fluxoCaixa.ts` inicializa as linhas
sem atividade com zero, classifica receita pelo `GRUPOS_RECEITA` e soma somente
lançamentos reais/projeções existentes. Categorias históricas excluídas continuam
visíveis quando têm atividade no período; não se criam lançamentos para preencher
células. Grupos, categorias e subcategorias começam recolhidos e podem ser expandidos separadamente até a subdivisão. A árvore usa `paiId`, sem agrupar por nomes. `montarArvoreFluxoCaixa` agrega valores diretos e descendentes apenas para apresentação; totais do caixa continuam calculados sobre as linhas originais. O clique em uma célula de pai mostra os lançamentos de todo o ramo. Regressão:
`testes/financeiro/plano-fluxo-caixa.test.ts` e `testes/financeiro/fluxo-hierarquia.test.tsx`.

Todos os filtros de intervalo abrem do dia 1 do mês atual até hoje, no calendário de Brasília. `periodoMesAteHoje` e `aplicarPeriodoPadrao` em `src/lib/financeiro/periodos.ts` são a referência compartilhada por DRE, Fluxo, Movimentações/Conciliação, Faturas, Manifestos NF-e/NFS-e, Movimentações/Perdas de estoque, Gestão de validades e lista/gestão de Pedidos. Nas páginas com parâmetros de URL, o padrão se aplica somente quando ambas as datas estão ausentes; limites parciais ou vazios explícitos são preservados, inclusive na paginação. Limpar datas permite consultar o histórico completo. Calendário de entregas, posição de estoque e formulários de lançamento usam datas de referência, não intervalos, e conservam sua semântica. Regressão: `testes/financeiro/periodos.test.ts` e testes das interfaces consumidoras.


## Edição de datas e histórico extenso — 05/10/2026

`FiltroPeriodo` mantém a digitação em rascunho e aplica as datas ao sair do campo ou
pressionar Enter. Mês/dia/ano incompleto no input nativo não remove o limite aplicado;
limpeza intencional e Limpar datas continuam disponíveis. O contrato compartilhado
de interação está em `docs/design-system/padroes.md`.

`extrato.ts::calcularExtrato` conserva todos os dias até 366 dias de intervalo. Acima
disso, lista datas com movimentações, saldos iniciais e ambos os limites, mantendo
cada operação, centavos, saldo anterior e final. A interface explica o resumo;
não há truncamento da consulta ou dos totais. Isso evita enumerar centenas de milhares
de dias vazios quando há uma data histórica ou edição de ano muito antigo.
Regressões: `controles.test.tsx`, `movimentacoes-view.test.tsx`, `extrato.test.ts`
e consumidores de `FiltroPeriodo`; teclado e roda do mouse conferidos em prévia
isolada com dados fictícios. Não operar dados reais para reproduzir esse defeito.

## Compensação de itens de faturas

`faturas/compensacao.ts` valida cobrança/crédito na mesma data, com líquido zero.
`servico.ts` registra relação recíproca e auditoria sem criar lançamentos para o par;
finalização, pendências e resumo reconhecem somente relações íntegras. Ajustes e
vínculo permanecem bloqueados até desfazer a compensação. Não altera registros reais
por migração. [Contrato do módulo](../financeiro/cartoes/COMPENSACAO.md).

## Cancelamento integral de compras

O Financeiro identifica despesas originadas de NF-e, EntradaAvulsaCompra ou movimento legado e exige a prévia da compra inteira: todas as parcelas, itens, quantidades, locais e datas originais. `src/lib/financeiro/cancelamento-compra.ts` cancela títulos pendentes e estorna entradas numa transação, com autorização relida, hash da prévia e auditoria. Pagamentos, cartões, extrato e custos ativos de Pedidos bloqueiam o cancelamento até a correção dos vínculos. Contrato e limites em [Cancelamento de compra](../features/cancelamento-compra/SPEC.md).

## Datas de lançamentos manuais

`src/lib/financeiro/data-lancamento.ts` valida calendário e intervalo 2000–2200,
compartilhado com Cartões/Faturas, baixa de títulos/notas, saldo inicial e conciliação bancária.
Pagamentos de NF-e/NFS-e reutilizam dataCalendarioValida com o mesmo limite. Cadastro/edição em `lancamentos/actions.ts` validam
competência, vencimento, pagamento inicial e **todas** as parcelas antes de escrever;
parcelas inválidas não são descartadas. Competências geradas também respeitam o intervalo.
O diálogo aplica min/max aos campos nativos e não gera parcelas de uma data incompleta.
Essa regra não restringe os filtros de consulta nem reescreve documentos fiscais históricos.
Novas datas operacionais e de extratos importados anteriores a 2000 são recusadas.
Cancelamento avulso conserva o título CANCELADO e grava autor, datas, valor e escopo
em HistoricoAcesso dentro da mesma transação. Regressões: datas-lancamento-action.test.ts
e exclusao-lancamento.test.ts em `testes/financeiro`.

Validação inicial da correção de datas (06/10/2026, limite ampliado para 2000 posteriormente):
domínio financeiro 391 testes aprovados, 112 opt-ins ignorados; opt-in DATAS_LANCAMENTO_BANCO_TESTE executado separadamente
com 3 testes PostgreSQL local aprovados (schema exclusivo, rollback de auditoria).
Consumidor visual isolado em testes/visual/datas-lancamento.html; lint, lint:design,
typecheck e build aprovados. Sem migration ou alteração do saldo inicial.

Validação final do limite 2000: 527 testes financeiros/NFS-e aprovados (112 opt-ins
ignorados na bateria), mais 22 testes de cartão/integrações aprovados separadamente.
Executados DATAS_LANCAMENTO_BANCO_TESTE e NOTAS_PAGAMENTOS_BANCO_TESTE em bancos
locais isolados. Rejeição de 1999 comprovada no navegador da prévia, limite inclusivo
01/01/2000, lint/design/types/build aprovados.

### Sugestões bancárias e contadores — 07/10/2026
As sugestões de conciliacao/sugestoes.ts aceitam pendências a até sete dias civis do
extrato, com valor exato e contraparte compatível. Pagamentos realizados conservam
data exata; ambiguidades continuam manuais. A tela amplia a faixa das candidatas em
sete dias e mostra a sugerida mesmo fora do período bancário.
faturas/consultas.ts conta situações pela busca/cartão/competência/período antes
da paginação e sem a própria situação. Itens ignorados contam somente no geral e
em Ignorados. Movimentações contam linhas agrupadas, não os itens de uma mesma nota.
Contrato e cobertura: [Conciliação e contadores](../features/conciliacao-contadores/SPEC.md).
