# Cartões e Faturas

## Como usar

1. Financeiro → Bancos → Faturas (Contas e cartões no mesmo grupo). Cadastre/edite o cartão existente e sua conta de pagamento.
2. Importar fatura: primeiro escolha o PDF mascarado (até 2 MB). Nos layouts Inter e Itaú
   Empresas conferidos, o sistema lê total, vencimento, final principal e compras/encargos.
   Se protegido, informe a senha no campo próprio: usada somente em memória, não persistida.
   Cadastre os três cartões principais uma vez; final único identifica o cadastro, nunca
   apenas o nome do banco. A associação do final exige confirmação e permissão de edição
   bancária. Cartões virtuais ficam agrupados no PDF principal, sem cadastros separados.
   Competência usa o mês de vencimento; período/fechamento administrativos são calculados
   pela emissão quando não impressos e aparecem como referência calculada, editável.
   CSV padrão: Data;Descrição;Valor, com data DD/MM/AAAA e 1.234,56; XLS/XLSX com uma aba.
   Outros PDFs precisam ser pesquisáveis; campos ausentes exigem preenchimento. Sem OCR.
3. Confira a prévia e as linhas não reconhecidas. Confirmar só importa os itens: não paga
   nem cria despesas. Arquivo repetido abre a mesma fatura; reprocessar preserva vínculos.
4. Primeiro selecione a saída do extrato na conta do cartão. A escolha persiste na fatura,
   com versão e auditoria, sem reservar a transação, criar lançamento ou dar baixa.
5. Classifique os itens ou vincule lançamentos existentes. Ao abrir a revisão, as sugestões
   são consultadas automaticamente; nome, valor e vencimento da fatura orientam a correspondência.
   Responsável e centro de custo não são opções do formulário: valores históricos permanecem
   e a categoria continua fornecendo o centro padrão. Após revisar todos os itens, use
   **Criar despesas e finalizar**: cria somente os faltantes e concilia a saída selecionada
   na mesma transação. A saída é relida sob trava; duplicidades fortes, conta incorreta,
   alteração concorrente ou lançamento inválido desfazem toda a finalização. Não há outra
   despesa pelo total pago. Pagamentos parciais continuam permitidos até o saldo restante.
6. Desfazer pagamento exige motivo e permissões. Preserva despesas e histórico, reabre
   o extrato e remove somente o movimento bancário gerado pela conciliação revertida.

Para os três pagamentos mensais: repita a importação para cada PDF e vincule cada fatura
à respectiva saída do extrato. Não crie um lançamento de despesa adicional pelo total.
Se a saída já estiver conciliada a uma despesa genérica, revise esse vínculo antes;
o módulo não desfaz nem exclui lançamentos existentes automaticamente.

Nos PDFs Inter/Itaú reconhecidos, a confirmação exige soma exata dos itens igual ao total
impresso e nenhuma linha financeira pendente. Não é possível ocultar uma divergência
editando o total. Pagamentos anteriores, limites, ofertas e parcelas futuras são excluídos.
Datas Itaú DD/MM recebem ano inferido pelo ciclo/parcela e aviso obrigatório de conferência.
Nova parcela conserva data original e assume competência da fatura, não a da compra antiga.

## Arquitetura

Reutiliza CartaoCredito, LancamentoFinanceiro, ContaBancaria, TransacaoExtrato, cadastros
e ACL. Novas entidades: FaturaCartao, ArquivoFaturaCartao, ItemFaturaCartao,
ParcelamentoCartao, RegraCartao, PagamentoFaturaCartao, LiquidacaoCartao e HistoricoCartao.
Migration manual `20260923180000_faturas_cartao`: aditiva, não reclassifica registros antigos.

Compra é DESPESA. Créditos podem reduzir despesa (valor negativo) ou ser RECEITA positiva, conforme categoria confirmada pelo usuário. Pagamento cria um movimento bancário,
nunca uma segunda despesa. Liquidações proporcionais preservam centavos e registram
parcelas no DRE caixa. Competência usa o valor integral da compra. Projeções de leitura
em Movimentações/Fluxo não criam novos lançamentos. Antes da revisão completa, pagamentos
ficam no caixa não classificado; alertas explicam a incompletude do DRE e da previsão.

Server Actions: `financeiro/cartoes/actions.ts`. Download privado:
`GET /api/financeiro/faturas/arquivos/[id]`, com sessão/permissão e no-store.
Serviços em `src/lib/financeiro/faturas`. Mutações revalidam usuário/permissão no banco
sob trava de acesso, depois trava de cartões, versão da fatura e bloqueios de registros.
Não há catálogo paralelo, API de IA nem envio de dados a terceiros.

## Permissões

`financeiro.faturas`: visualizar/adicionar/editar/excluir. Regras:
`financeiro.cartoes-regras`. Pagamentos: `financeiro.cartoes-pagamentos` mais permissões
existentes de conciliação e baixas. Cadastro do cartão conserva `financeiro.bancario`.
Criar despesas exige adicionar em Movimentações; consultar/vincular exige visualizar.
Administradores seguem a regra existente. Perfis não administrativos não ganham acesso
automaticamente; configurar em Gestão de Acessos conforme função do usuário.

## Publicação e reversão

Seguir CONTEXTO.md: backup privado antes da migration, build/testes, commit isolado,
push main, Dokploy e migration automática pelo entrypoint. Conferir origem fiscal no
banco sem substituir certificado. Verificar /financeiro/cartoes, DRE, Movimentações,
Fluxo de Caixa e módulos existentes. Não lançar transações reais como teste.

Antes de qualquer operação no módulo novo, a migration aditiva é compatível com a
imagem anterior. Depois de pagamentos de faturas, não voltar cegamente para código
antigo: ele não conhece liquidações parciais e pode apresentar caixa duplicado. Suspender
escritas, preservar backup atual, preferir correção em nova versão ou revisão controlada
das conciliações. Nunca restaurar o dump sobre produção sem avaliar operações posteriores.

Testes: `testes/financeiro/faturas`, demais Financeiro/permissões e Design System.
`FATURAS_BANCO_TESTE=1` somente em PostgreSQL localhost isolado, schema temporário próprio.
Prévia sintética: `node node_modules/vite/bin/vite.js --config testes/visual/faturas.vite.config.mts`.

## Conciliação dos itens — 26/09/2026

- `servico.ts::candidatos` consulta lançamentos do HUB pendentes, sem baixa/vínculo anterior,
  com cartão correspondente ou ainda sem cartão, excluindo títulos protegidos de Pedidos.
  A competência não limita a seleção; a data só pontua sugestões. Limite explícito: 1.000
  candidatos, sem truncamento silencioso. O formulário permite buscar por descrição.
- `vincularItem` relê versões/permissões sob trava e exige soma exata. Compra vincula despesa
  positiva; crédito vincula receita positiva ou despesa negativa. Não vincular título já pago:
  o pagamento da fatura precisa continuar sendo a única saída bancária correspondente.
- `entrada.novo` reúne classificação, descrição, competência e vencimento no mesmo formulário
  e transação de criação/vínculo; valor vem do documento, não é digitado. Correspondência
  forte exige justificativa. Fornecedor/beneficiário usa `FornecedorDialog`, como no extrato,
  com permissão própria. Cadastro é ação explícita independente; cancelar o lançamento não
  apaga um fornecedor que já foi criado.
- O valor de RECEITA contribui negativamente no resumo/rateio da fatura; o lançamento e suas
  liquidações conservam sinal positivo no DRE/fluxo. Estorno de despesa continua negativo.
  `relatorios.ts` usa o mesmo sinal ao projetar pagamento parcial antes da revisão completa.
  Não converter créditos históricos automaticamente nem criar despesa pelo total pago.
- Rotas e ACL individuais permanecem: o agrupamento lateral Bancos é apenas navegação.
  Evidências: integração de faturas, conciliação-interface, relatorios e layout.

## Seleção prévia e finalização — 27/09/2026

- `FaturaCartao.transacaoSelecionadaId` é uma escolha reversível pela seleção de outra saída,
  não um vínculo financeiro nem uma reserva. A migration manual `20260927100000_selecao_extrato_fatura`
  é aditiva e não modifica pagamentos antigos. Faturas historicamente pagas continuam revisáveis.
- `selecionarExtratoFatura` valida conta, saída disponível, saldo e permissão. `conciliarFatura`
  exige a seleção, todos os itens revisados e vínculos íntegros; reutiliza `criarDespesaItem`
  e `liquidar` para conservar precisão, rateios, baixa e auditoria. Após finalizar, limpa a seleção.
- `pagarFaturaAction` distingue SELECIONAR de FINALIZAR; ambas releem autorização no servidor.
  Correspondências nunca vinculam silenciosamente. Mesmo vencimento permite sugerir uma despesa
  cuja competência seja diferente; valores e nomes continuam sendo conferidos.
- Regressão: `testes/financeiro/faturas/conciliacao-interface.test.tsx` e `integracao.test.ts`
  cobrem seleção sem efeitos, vínculo existente, faltantes, baixa, transação usada por outro fluxo,
  rollback de duplicidade e repetição. Banco e prévia usam somente dados fictícios.

A descrição da saída selecionada só é enviada à interface com permissão de consulta da conciliação bancária, seguindo a mesma fronteira da lista de saídas disponíveis.

Validação local desta entrega: testes de faturas (103 aprovados), regressão de interface/domínio/relatórios (107 aprovados; opt-in bancário executado separadamente), conciliação e fronteiras de permissão (173 aprovados após repetir sem build concorrente; a primeira rodada teve timeouts de hooks), e integração final de faturas (36 aprovados). Prisma validado/gerado, migration aplicada em schema fictício, lint e padrões aprovados. A tentativa de prévia isolada em `/faturas.html` ficou sem resposta no navegador (timeouts de CDP); não há screenshot nem aprovação visual desta revisão. Nenhuma operação de negócio real foi executada.

## Revisão em duas colunas e transações elegíveis — 27/09/2026

- A seleção da saída parte de `TransacaoExtrato`, que possui `importacaoId` obrigatório;
  lista somente saídas da conta do cartão, sem conciliação/vínculo/pagamento. O serviço
  repete a checagem sob trava ao selecionar e finalizar. A descrição do banco não é
  critério de elegibilidade: pagamentos reais podem aparecer como `BOLETO PAGO`, sem
  mencionar cartão ou fatura. Lançamentos financeiros do HUB não entram nessa lista.
- O diálogo do item segue a composição visual da conciliação bancária:
  documento à esquerda, lançamentos pendentes do HUB à direita, com lista rolável.
  Sugestões amarelas exigem nome, valor e vencimento coincidentes, ou soma exata de
  componentes com mesmo nome/vencimento ou grupo de nota; só selecionam candidatos,
  sem gravar vínculo. A confirmação aceita vários títulos cuja soma em centavos fecha
  exatamente o item, e o servidor relê versões/permissões e impede duplicidade.
- `ItemFaturaCartao.descricaoLancamento` guarda o nome revisado para lançamento novo;
  `descricaoOriginal` e evidência importada não são alterados. A migration manual
  `20260927110000_nome_lancamento_fatura` é aditiva. Nome vazio, longo ou aplicado a
  vários itens é rejeitado. Vincular despesa existente preserva o nome dessa despesa.
- Datas são exibidas em DD/MM/AAAA por `dataFatura`, enquanto inputs, filtros e
  persistência conservam ISO.

## Conciliação na página da fatura — 28/09/2026

- O passo 2 apresenta todos os itens do filtro escolhido na coluna esquerda, por
  `dataCompra`, linha e ID crescentes, sem paginação ou ordenação por valor/nome.
  O estado inicial mostra todos os itens; busca e situação continuam opcionais.
- A coluna direita carrega automaticamente os lançamentos pendentes elegíveis para
  a fatura após selecionar o primeiro item. Ordena por vencimento e ID crescentes;
  inclui despesas e créditos, mas só permite marcar os de sinal compatível com o
  item selecionado. O conjunto mantém as restrições já usadas por `vincularItem`:
  cartão correspondente ou não atribuído, sem baixa, vínculo bancário, fatura ou
  Pedido protegido. O limite explícito de 1.000 candidatos permanece e gera erro
  em vez de ocultar linhas excedentes.
- A seleção de um item troca as sugestões e reinicia apenas a escolha local de
  lançamentos. Classificação, ajustes, valor exato, permissões e finalização no
  passo 3 mantêm as validações transacionais do servidor. A consulta do painel é
  somente leitura e não antecipa a baixa.

Ao trocar a movimentação selecionada, o painel mantém visíveis os lançamentos
pendentes já carregados e sua posição de rolagem; as sugestões e versões são
atualizadas para o novo item antes de habilitar o vínculo. A escolha de vários
lançamentos soma seus valores para fechar o item. Busca e filtros do passo 2 usam
navegação sem rolar a página para o início (`scroll: false`).

## Cadastros invalidados após a classificação

`src/lib/financeiro/faturas/servico.ts` identifica, antes de criar lançamentos ou baixar
o extrato, itens revisados ainda sem vínculo cuja categoria foi excluída/inativada ou
cujo fornecedor/responsável/centro deixou de ser válido. `consultas.ts` expõe as linhas
afetadas; `fatura-view.tsx` destaca cada uma, informa o motivo e permite reclassificar.
O passo final fica bloqueado até a correção, e a validação transacional repete a
checagem para impedir uma baixa com dados alterados após abrir a página.
Na exclusão de categoria pelo Plano de Contas, `plano-de-contas/actions.ts` inclui
itens e regras de cartão na transferência para categoria ativa do mesmo grupo. A
inativação mantém vínculos históricos; itens ainda não lançados devem ser revistos.

## Vínculos pendentes antes da finalização

`servico.ts::pendenciasVinculoFatura` aplica aos itens revisados ainda sem vínculo
o mesmo critério de correspondência forte e soma de componentes de nota usado
por `criarDespesaItem`. `consultas.ts::detalheFatura` expõe as linhas afetadas;
`fatura-view.tsx` as destaca no passo 2, mostra os lançamentos possíveis no
passo 3 e exige conferência antes de liberar a finalização. O usuário pode
vincular o lançamento existente ou criar a despesa individualmente com motivo
de duplicidade. A verificação transacional permanece no servidor para cobrir
mudanças ocorridas após a abertura da página. A prévia é somente leitura e
consulta os candidatos em um lote, mantendo o limite de 1.000 lançamentos.
Na soma de componentes de NF-e, igualdade de valor isolada não basta: os
lançamentos devem estar atribuídos ao mesmo cartão e ter competência próxima
à data da compra, dentro da tolerância configurada do cartão. Caso contrário,
o usuário ainda pode vincular manualmente após conferir os documentos, mas a
soma coincidente não impede a criação de uma despesa distinta.
`dominio.ts::sugerirVinculosFatura` usa a mesma restrição para sugestões de
soma por nota; a sugestão por nome e vencimento continua independente.

## Correção de vínculo após conciliação

Na revisão de um item vinculado, **Alterar vínculo** libera a seleção de despesas
pendentes na coluna do HUB, inclusive com vencimento diferente do da fatura. A soma
deve fechar exatamente o valor do item. **Confirmar troca de vínculo** mostra os
lançamentos anteriores e os novos e exige motivo. O servidor revalida permissões,
versão da fatura e dos candidatos, cartão, ausência de baixa independente e vínculos.

A substituição é atômica: preserva pagamento, movimento bancário e conciliação do
extrato, refaz as liquidações dos pagamentos ativos e registra auditoria com os
vínculos anteriores. Lançamentos substituídos são preservados e voltam a PENDENTE;
o usuário deve conferir se são duplicidades e tratá-las em Movimentações. A troca
exige edição de Movimentações e, quando há pagamento, edição de Baixas. Faturas com
pagamento exigem revisão completa antes da troca; valores e itens ignorados continuam
protegidos pelo fluxo de desfazer pagamento. Histórico de pagamentos revertidos permanece.

Implementação: `servico.ts::vincularItem` e `fatura-view.tsx`. Regressões em
`testes/financeiro/faturas/integracao.test.ts` cobrem despesas de 15/09, pagamento
integral/parcial, auditoria, versão, autorização, rollback e reversão posterior.

## Despesa pendente cadastrada em outro cartão

Na revisão da fatura, **Mostrar despesas de outros cartões** também mostra o cartão
cadastrado. Esses títulos ficam impedidos de seleção. **Usar cartão desta fatura**
abre uma confirmação com origem, destino e motivo obrigatório. A correção mantém
valor, competência, vencimento, nota de origem e situação pendente; não altera o
pagamento bancário. Depois, use **Alterar vínculo** e selecione a despesa corrigida.

`corrigirCartaoDespesaAction` e `corrigirCartaoDespesa` exigem edição de faturas e
movimentações, relendo usuário/permissões e versões dentro da transação. Despesas
pagas, vinculadas, com liquidação, de Pedido/custo de entrega ou componentes de NF-e
não podem ser corrigidas por este caminho. NF-e deve ser revista na parcela de origem.
A auditoria `CARTAO_CORRIGIDO` registra cartões antes/depois, versões, autor e motivo.
Não executar SQL direto nem desfazer pagamento para liberar uma despesa de outro cartão.
Referência visual nova **Em revisão**. Regressão: testes de interface e integração
em `testes/financeiro/faturas`, usando somente PostgreSQL local isolado.

Validação em 05/10/2026: lint focado e lint:design aprovados; typecheck e build
webpack aprovados; 338 testes de faturas/permissões aprovados, com 12 testes da
integração de gestão de acessos não ativados. Integração de faturas executada em
schema temporário localhost, incluindo preservação do pagamento, motivo, versões,
permissões e bloqueio de títulos realizados/vinculados. As duas regressões novas
foram repetidas após o ajuste final da ordem de travas. Prévia isolada conferida
com dados fictícios e diálogo de confirmação; smoke do build local redireciona
requisição sem sessão para login (307) com Host e X-Forwarded-Host coerentes.
Correção de cartão publicada em 05/10/2026; evidência operacional registrada separadamente, sem nova publicação apenas documental.

## Concluir despesas de faturas já pagas

Classificar define categoria e dados dos itens; a criação dos lançamentos acontece
na finalização. Faturas do fluxo anterior podem ter pagamento conciliado e itens
classificados ainda sem despesas. Nesse caso, **Concluir despesas da fatura** libera
uma confirmação sem exigir outra saída do extrato. O pagamento, o movimento bancário
e a conciliação existente são preservados. Com pagamento integral e todos os itens
vinculados, o estado passa a **Conciliada**; pagamento parcial conserva o saldo.

`concluirDespesasFaturaAction` e `servico.ts::concluirDespesasFatura` releem sessão,
permissões e versão sob trava. Exigem edição de faturas/baixas e consulta de
Movimentações; criar faltantes exige adição de Movimentações. Classificação inválida,
diferença de total, vínculos inconsistentes, baixa independente ou correspondência
pendente bloqueiam a operação. Despesas existentes são preservadas; só os faltantes
são criados. A transação refaz liquidações com os pagamentos ativos e registra
`DESPESAS_CONCLUIDAS`. Repetição com a versão atual não duplica títulos ou auditoria;
confirmação concorrente com versão antiga é rejeitada.

Regressões: `testes/financeiro/faturas/integracao.test.ts` (pagamento legado integral,
parcial, 11 itens, concorrência, duplicidade/rollback e permissões) e
`conciliacao-interface.test.tsx`. Prévia sintética em `/faturas.html?paga-classificada`;
referência visual **Em revisão**. Nenhuma migration ou atualização automática de
faturas reais acompanha esta correção: a conclusão exige confirmação na aplicação.

Validação da conclusão de despesas em 05/10/2026: 354 testes de faturas/permissões
aprovados, com 12 testes de gestão de acessos sem opt-in; integração de faturas
ativada somente em schema temporário localhost. O bloqueio de baixa independente
foi conferido isoladamente após sua inclusão; os 18 testes de interface foram
repetidos após o texto final. Lint focado, lint:design, typecheck e build webpack
aprovados. Prévia e confirmação conferidas com dados fictícios; smoke do build
local redirecionou a rota de fatura sem sessão para login (307). Nenhuma fatura real
foi alterada nessa validação. Publicação desta correção permanece pendente de
autorização para a nova revisão, conforme o ritual de versionamento/deploy.

## Compensação no mesmo dia — 06/10/2026

Selecione uma cobrança e um crédito da mesma data e de valores exatamente iguais,
sem lançamento vinculado, na lista da própria fatura. **Compensar selecionados**
exige confirmação com motivo e marca ambos como Compensados. As linhas/documentos
permanecem; o par de líquido zero não cria títulos nem movimentos. O total continua
sendo conferido e os demais itens seguem o fluxo normal de finalização.
**Desfazer compensação** exige motivo e devolve ambas à revisão sem desfazer o
pagamento. Datas/faturas diferentes, diferenças de centavos e itens já vinculados
são bloqueados no servidor. Contrato e limites: [Compensação](COMPENSACAO.md).

## Baixa integral e pagamento parcial explícito — 06/10/2026

Classificar/criar os títulos registra despesas; a quitação depende do valor da
saída bancária escolhida. A revisão completa dos itens não prova pagamento integral.
Nunca aumentar o valor de uma transação do extrato para forçar estado Conciliada.

`conciliarFatura` usa `INTEGRAL` por padrão e exige valor igual ao saldo pendente.
`PARCIAL` deve ser escolhido explicitamente; conserva a liquidação parcial e o saldo.
A validação ocorre antes de criar títulos/movimento/pagamento, dentro da transação
com as guardas e travas existentes. Auditoria inclui tipo e saldos antes/depois em
centavos. `pagarFaturaAction` distingue `FINALIZAR_PARCIAL`; modos desconhecidos
são recusados e a seleção continua sem efeito de caixa.

Na interface, uma saída menor mostra valor/saldo restante e exige marcar “Este é
um pagamento parcial da fatura”, vinculada ao ID selecionado e à versão da fatura.
O botão/dialogo dizem Registrar pagamento parcial. Saídas de valor igual ao saldo
aparecem primeiro, sem seleção automática. Uma baixa integral confirma quitação do
saldo restante; se houver pagamentos anteriores, não paga de novo o total original.

Para corrigir uma saída vinculada incorretamente: desfazer somente esse pagamento
com motivo, selecionar a saída bancária correta e finalizar. `desconciliarFatura`
conserva despesas, compensações e histórico; a nova baixa reaproveita os títulos.
A orientação aparece quando há saldo parcial. Nenhuma migration ou ajuste automático
de dados históricos. A investigação usa leitura, e a prévia usa fixtures fictícias; nenhuma operação
real foi usada para testar a correção.

Regressão: `conciliacao-interface.test.tsx` cobre aviso, bloqueio, confirmação,
invalidade após troca de saída/versão e prioridade do valor exato; `integracao.test.ts`
cobre recusa integral insuficiente sem efeitos, reversão de pagamento incorreto e
quitação integral preservando títulos/compensação e pagamento parcial legítimo.
