# Dashboard de vendas

## Clientes, categorias e desempenho — 20/10/2026

A tabela **Clientes que mais compram** mostra Cliente, Tipo e Faturamento.
PF/PJ vem do cadastro canônico atual. Tipo ausente permanece explícito e não
é inferido pelo nome. A permissão de contatos continua exigida no servidor.

A legenda de Pessoa física e jurídica informa o ticket de cada grupo: faturamento
líquido com frete dividido pelos pedidos válidos daquele tipo. Não é a média dos
tickets individuais dos clientes. Sem pedidos ou receita não apurada, mostra
**Não apurado**; receita comprovadamente zero mantém zero. O CSV inclui esses
indicadores somente quando a permissão de contatos permite a consulta.

**Categorias mais vendidas** apresenta as cinco primeiras categorias por receita
líquida dos itens e abre o ranking completo em painel lateral. Selecionar uma
categoria aplica seu filtro e abre Produtos. Cada pedido conta uma vez por categoria.
Produtos com múltiplos vínculos participam de cada categoria, sem rateio inventado;
esses valores podem se sobrepor. Frete não participa. Sem categoria, Sem detalhamento
e receita não apurada continuam identificados. O CSV geral inclui o ranking.

O cálculo anterior de clientes filtrava todas as linhas de pedidos e todo o histórico
para cada comprador, em três rankings. A agregação usa agora mapas e uma passagem
por conjunto de dados. Preserva Decimal, valores indisponíveis, primeira/última
compra, recorrência e ordenação. Não adiciona cache, consulta SQL ou dependência.
Com 6.000 pedidos sintéticos e 4.500 clientes, a mediana de cinco medições após
aquecimento caiu de 1.082 ms para 187 ms, redução de cerca de 83% no cálculo local.
Isso não mede o tempo total de rede ou de abertura em produção. Um teste limita
os acessos aos IDs para impedir a regressão de complexidade quadrática.

As capturas em `evidencias/20261020-operacao/` usam dados sintéticos e permanecem
Em revisão humana. A evidência conjunta de testes e publicação está em
[OPERAÇÃO-20261020](OPERACAO-20261020.md).

## Comparação de compradores — 20/10/2026

A Visão geral apresenta **Pessoa física e jurídica** ao lado de Evolução das
vendas. O seletor **Pedidos / Faturamento** altera somente a métrica do gráfico.
Os filtros da seleção permanecem ativos. **Produtos que mais vendem** ocupa o
espaço inferior antes destinado a Oportunidades comerciais. Esse slot foi removido.

A distribuição usa a mesma seleção válida, filtrada e sem duplicidades dos
indicadores. Conta pedidos, não clientes únicos. O tipo vem do cadastro canônico
do comprador. Sem vínculo identificável ou tipo cadastrado, o pedido entra em
**Sem classificação**. Nomes e destinatários não definem PF ou PJ.
Faturamento soma produtos líquidos e frete uma vez, com agregação Decimal.
Receita sem divisão comprovada permanece **Não apurado** no grupo afetado.
A pizza não desenha proporções parciais, valores negativos ou total zero.
A legenda conserva valores exatos e explica essas situações.

A distribuição exige `vendas.bi.contatos`. Sem a permissão, o servidor retorna
`distribuicaoClientes: null`; a interface mostra a restrição. Não há nova consulta,
escrita operacional, migração ou dependência. O gráfico reutiliza Card, GrupoAcoes,
Button e os tokens `chart-1`, `chart-2` e `muted-foreground`. Referência de composição:
o Dashboard atual e seu ranking. Evidências sintéticas permanecem Em revisão visual.

Validação isolada deste incremento em Node 22.23.3: 63 testes de domínio,
consulta e gráfico aprovados; 28 contratos Playwright aprovados. A suíte executou
o auditor oficial, troca de métrica por teclado, permissões, filtros, ordenação,
estados vazio/erro/carregamento e capturas responsivas. Lint dos arquivos TS/TSX
alterados aprovado. Capturas em `.tmp/bi-vendas/capturas`: larguras 320, 390, 768,
1280, 1440, 1672, 1800 e 1920 no tema claro; 320, 390, 768 e 1440 no escuro.
Desktop e celular foram inspecionados. São evidências sintéticas consultivas,
sem nova baseline aprovada ou afirmação de publicação.

## Revisão solicitada em 15/10/2026

O nome visível passa a **Dashboard**. IDs de permissão `vendas.bi*`, URL
`/vendas/bi`, favoritos e links existentes permanecem compatíveis.
O cabeçalho não repete o breadcrumb. O período reutiliza `FiltroPeriodo`, como
na DRE, com comparação adjacente. Datas vazias removem os limites; o servidor
usa `completarPeriodo` sobre o histórico disponível e informa o período efetivo.
O limite técnico continua sendo dez anos por consulta, com erro explícito.

Os indicadores passam a Faturamento, Descontos, Pedidos, Ticket médio, Clientes
compradores, Clientes recorrentes e Frete. Faturamento conserva o líquido dos
produtos mais o frete cobrado, conforme revisão de 17/10/2026. Descontos são informativos, já incorporados ao faturamento;
o desconto rateado nos itens não é contado novamente. O indicador de recorrentes
inclui a média dos intervalos entre pedidos consecutivos desses compradores até
a data final. Cada intervalo recebe o mesmo peso, inclusive zero no mesmo dia.

O ranking de clientes ocupa o card antes destinado à qualidade. Exige permissão
de contatos e independe da página do detalhamento. Cobertura e definições continuam
acessíveis no cabeçalho. Clientes mostra Tipo PF/PJ do cadastro atual e Pedidos;
a coluna Recorrência é removida. Contadores Todos/Física/Jurídica ignoram somente
o próprio filtro de tipo. Tipo ausente não é inferido pelo nome.

O comprador usa o vínculo explícito `PedidoVenda.clienteId` com um cadastro
existente. Aliases seguem `ClienteVenda.unificadoEmId` até a raiz canônica.
Esse vínculo vale para pedidos nativos e históricos, mesmo quando a regra de
importação antiga não identificava o comprador. A apresentação usa o nome atual
do cadastro: Nome Completo para PF e Nome Fantasia para PJ. Snapshots, regras
históricas e valores permanecem intactos. Nomes iguais não unem cadastros.
Um snapshot sem vínculo cadastral não identifica um comprador.

O filtro global `cliente` mantém o ID na URL e na exportação. Um ID de alias
explícito é normalizado para a raiz na resposta e no CSV. Indicadores,
comparação, rankings e detalhes usam a mesma seleção. A busca por nome reutiliza
`OpcaoBi { id, nome }` com as raízes atuais, inclusive sem vendas no período.
O catálogo e o filtro exigem permissão de contatos. E-mails, documentos e nomes
de aliases não são acrescentados às opções.

Produtos, Clientes e Entregas ordenam no servidor antes da paginação e da
exportação, com desempate estável e valores não apurados por último. Cabeçalhos
usam `SortableTableHead`; filtros e ordem permanecem na URL.

Entregas permite bairro e faixa de CEP. A faixa reúne prefixos de cinco dígitos;
os limites personalizados usam CEP completo. O mapa usa cada CEP completo ou
bairro real, geocodificado apenas por ação explícita com o Google autorizado,
limites existentes e dados transitórios. Nunca envia nome, contato, rua ou número.
Coordenadas são aproximações regionais e não validam um destino individual.
Ausência de fonte, chave ou API habilitada permanece explícita, sem ativação externa.
Endereços de cobrança não são promovidos a destinos. A planilha atualizada
fornecida pelo usuário em 15/10/2026 identifica `Full Address (Shipping)` na coluna
I e o número original na J. O enriquecimento guarda somente metadados consultivos
da identidade legada correspondente, com proveniência, hashes, transação, auditoria
e reversão. Não reimporta pedidos nem altera snapshots comerciais/financeiros.
Conforme instrução explícita do usuário, Shipping vazio significa retirada sem
frete no Dashboard. O frete original permanece preservado e sua soma é informada
na cobertura. Endereço preenchido mas incompleto não vira retirada.
O preenchimento postal consulta somente CEPs no ViaCEP, após autorização explícita
recebida nesta tarefa. Conflitos de cidade/UF impedem completar o bairro.

O segmento `somenteSemRecompra` pertence ao detalhamento de Clientes. Nesse detalhe,
compras e valores abrangem o histórico disponível até a data final. A normalização
no servidor e a troca de aba desativam esse segmento fora de Clientes, preservando
os filtros globais de período, canal, categoria e demais dimensões.

## Objetivo e limites

Primeira seção de Vendas em `/vendas/bi`, com área principal baseada na imagem
`dashboard_de_vendas_grazing_hub.png` fornecida e aprovada pelo usuário em 15/10/2026.
Conservar a lateral, o cabeçalho autenticado e as rotas anteriores do HUB.
O acesso a `/vendas` abre o BI apenas quando autorizado.

O BI consulta vendas comerciais nativas e históricas. Não importa registros,
movimenta estoque, cria títulos, concilia pagamentos ou ativa integrações.
O marco de 01/09/2026 é uma referência financeira, sem limitar a análise comercial.

## Arquitetura

- `src/lib/vendas/bi-types.ts`: contrato compartilhado sem dados operacionais brutos.
- `src/lib/vendas/bi-dominio.ts`: filtros, valores e definições centralizados.
- `src/lib/vendas/bi-consultas.ts`: consulta somente leitura e agregação no servidor.
- `src/lib/vendas/bi-csv.ts`: exportação com metadados e proteção de fórmulas.
- `src/lib/vendas/bi-url.ts`: entrada permitida na URL.
- `src/app/(protegido)/vendas/bi`: página, consulta autenticada e estados.
- `src/app/api/vendas/bi/exportar`: exportação autenticada sem cache público.
- `src/components/vendas/bi`: interface e gráficos, sem consultas diretas ao banco.

Não há schema ou migration nova. As identidades legadas existentes conservam
o vínculo e o número original. A cobertura observada não prova importação completa.
Custos não comprovados permanecem não apurados. Preços e custos atuais não
recalculam o histórico. Endereço de cobrança não vira destino de entrega.

## Reduções de pós-venda e atualização

O tratamento financeiro existente aloca devoluções e créditos por pagamento.
Essa alocação não separa produtos, frete e outros valores. O BI só deduz uma
redução dos produtos quando frete e outros valores são zero e o total coincide
com subtotal menos desconto. A dedução ocorre uma vez. Sem divisão comprovada,
a receita afetada, o frete positivo afetado, o ticket e a reconciliação ficam
**Não apurado**. Frete explicitamente zero permanece zero. O ajuste,
a quantidade de pedidos afetados e a receita dos demais pedidos ficam separados
na cobertura. O ranking, os clientes, a série e o CSV conservam a mesma limitação.
Frete × custo e subsídio usam somente entregas com as duas parcelas conhecidas.
O total de custos cadastrados fica separado da cobertura dessa interseção.

O horário da fonte considera o pedido, a identidade histórica, os tratamentos
que reduzem a venda e as liberações de crédito. Inclui tratamentos cancelados,
pois essa transição altera o abatimento ativo. Na comparação temporal, dias
cobertos sem vendas têm zero. Dias sem cobertura continuam sem valor apurado.

## Interface e permissões

Reutilizar Card, Button, Tabs, Table, seleção, tooltip e Dialog com painel direito.
Consumidor de referência: Painel Fiscal. Usar tokens atuais do HUB e gráficos
projetados a partir de dados. Não criar uma segunda biblioteca de componentes.
O formato optativo `Button formato="campo"` usa o raio de controle oficial.
Está registrado e demonstrado na Central; não altera o formato padrão existente.

Manter sete indicadores, linha 60/40 de evolução/tipos de pessoa e três cards inferiores
(Entregas por região, Produtos que mais vendem e Clientes que mais compram).
As outras abas oferecem detalhes paginados. Filtros ficam na URL e a preferência
local não pode substituir uma URL explicitamente compartilhada. Respostas antigas
não substituem consultas mais recentes. Consultar pedidos preserva a seleção exata.

Recursos independentes em Usuários e permissões: `vendas.bi`,
`vendas.bi.exportar`, `vendas.bi.contatos` e `vendas.bi.custos`.
O servidor resolve as capacidades em cada requisição. Recursos novos não concedem
acesso automaticamente aos perfis existentes. Administrador conserva a regra oficial.

## Critérios de conclusão

- Reconciliação entre indicadores, série, ranking com Sem detalhamento, pedidos e CSV.
- Testes de descontos líquidos, parciais, identidades, frete, datas e permissões.
- Nenhuma escrita operacional nos caminhos de consulta e exportação.
- Testes do domínio e nível C do contrato do repositório.
- Capturas isoladas em 1672×941, notebook, tablet e celular.
- Comparação visual registrada em `design-qa.md`.
- Branch própria, commit publicado e deploy com smoke conforme o ritual vigente.

Execução, evidências e limitações: [TASKS.md](TASKS.md).

## Correção de 17/10/2026

O filtro Canal usa o mesmo cadastro `CanalVenda` e a mesma ordenação do lançamento
de Pedidos. Site, iFood e GF aparecem mesmo sem vendas na seleção. Canais históricos
com identidade própria permanecem disponíveis; ausência continua Não identificado.
Nenhum canal é inferido da origem técnica da importação.

Faturamento, ticket, clientes, série atual/anterior, pedidos consultados e CSV somam
o líquido dos produtos e o frete cobrado uma única vez. O ranking mantém receita
líquida dos produtos e participação sobre produtos, sem rateio arbitrário de frete.
Reconciliação: ranking completo, incluindo Sem detalhamento, mais frete = faturamento.
Ajustes negativos históricos a classificar e retiradas conservam o contrato anterior.
O card de Faturamento reutiliza o token success da Central.

Na aba Clientes, selecionar um cliente sem filtro de produto ou categoria mostra
o número de pedidos históricos da seleção, o total original comprovado na fonte e
os ajustes históricos de frete separados das vendas. O total usa somente
`totais.total_original` textual preservado. Se qualquer histórico da seleção não
tiver esse valor, o total fica Não apurado; não há fallback para `PedidoVenda.total`
nem cálculo por diferença. Os novos campos de cobertura também integram o CSV.
A reconciliação do Dashboard confere sua composição comercial, sem afirmar
igualdade com o total original ou conciliação financeira.

A correção não altera pedidos, vínculos legados, financeiro, estoque ou integrações.

A apresentação dos canais reutiliza `canais-apresentacao.ts`, extraída do selo
oficial TagCanalVenda: SITE → Site, IFOOD → iFood, GIULIANA FLORES → GF.
Os aliases são exatos e afetam somente rótulos. IDs não são unidos ou substituídos;
o histórico sem canal continua Não identificado e nomes desconhecidos são preservados.
