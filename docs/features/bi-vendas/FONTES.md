# Fontes e cobertura do Dashboard de Vendas

> Exportação pública: dados cadastrais, identificadores de registros e valores comerciais alterados neste documento são exemplos sintéticos. Os registros operacionais originais permanecem privados; esta versão não concede aprovação fiscal ou operacional.

## Conferência do destino em 15/10/2026

Consulta de produção feita por SSH com a chave autorizada. As consultas usaram
`BEGIN TRANSACTION READ ONLY`, limite de execução de 20 segundos e `ROLLBACK`.
Foram projetados somente contagens, totais, regras de classificação e datas de
cobertura. Não houve importação, alteração operacional ou leitura de contatos
para produzir este documento.

O registro de execução da importação continha etapas abertas. Por isso, ele não
foi usado como prova de ausência ou conclusão da carga. O resultado original permanece no registro privado. A tabela abaixo apresenta apenas um exemplo sintético do formato:

| Verificação | Exemplo sintético |
| --- | --- |
| Pedidos `HISTORICO_LEGADO` / `HISTORICO` | 3 (exemplo sintético) |
| Identidades `PEDIDO_HISTORICO` / destinos distintos | 3 (exemplo sintético) |
| Lotes distintos nos vínculos de pedidos | 1 (exemplo sintético) |
| Identidades `CLIENTE_HISTORICO` | 2 (exemplo sintético) |
| Identidades `PRODUTO_HISTORICO` | 3 (exemplo sintético) |
| Criação histórica disponível | Período sintético de exemplo |
| Última alteração histórica observada | Período sintético de exemplo |
| Pedidos nativos confirmados | 0 (exemplo sintético) |
| Demais estados nativos | 0 (exemplo sintético) |
| Custos efetivos de entrega conhecidos | 0 (exemplo sintético) |
| Destinos históricos confirmados pela origem | 0 (exemplo sintético) |
| Migrations registradas / falhas abertas | 133 / 0 |
| Última migration registrada | `20261015020000_pedidos_historicos` |

Os exemplos acima não comprovam uma carga operacional. A presença de registros
em uma conferência autorizada também não comprova completude da planilha externa,
conciliação financeira ou validação de endereços.

## Distribuição da fonte histórica

| Mês de criação em São Paulo | Pedidos |
| --- | ---: |
| Dezembro/2025 | 0 (exemplo sintético) |
| Janeiro/2026 | 2 (exemplo sintético) |
| Fevereiro/2026 | 0 (exemplo sintético) |
| Março/2026 | 1 (exemplo sintético) |
| Abril/2026 | 0 (exemplo sintético) |
| Maio/2026 | 0 (exemplo sintético) |
| Junho/2026 | 0 (exemplo sintético) |
| Julho/2026 | 0 (exemplo sintético) |
| Agosto/2026 | 0 (exemplo sintético) |
| Setembro/2026 | 0 (exemplo sintético) |

A distribuição acima é sintética e soma os três registros do exemplo. As contagens
conferidas no BI e nos CSVs oficiais permanecem no registro privado. A projeção
exploratória inicial usou uma conversão de fuso incompleta sobre `TIMESTAMP(3)` UTC.
A conversão do serviço do BI já estava correta. A correção documental de fuso
não altera a coorte do serviço. Pedidos nativos não pertencem à tabela histórica.

Exemplo sintético de estados: dois registros têm cadeia completa e um conserva uma limitação da origem. Uma cadeia inconsistente ou ausente não deve ser promovida automaticamente a estado comprovado.
Pedidos com total zero não são classificados como cancelados apenas pelo valor.

## Identificação de compradores

| Regra preservada pela importação | Pedidos | Chaves distintas |
| --- | ---: | ---: |
| Nome e e-mail exatos, sem conflito | 2 (exemplo sintético) | 1 (exemplo sintético) |
| Nome e telefone, sem conflito | 1 (exemplo sintético) | 1 (exemplo sintético) |
| Identidade por documento legado | 0 (exemplo sintético) | 0 (exemplo sintético) |

O último grupo usava a chave do documento/pedido quando não havia identificação
suficiente na importação. As contagens acima são exemplos sintéticos;
não comprovam pessoas únicas nem substituem os vínculos cadastrais atuais.
A flag histórica `identificavel` isolada não cria um vínculo de comprador.
Comprador e destinatário conservam os papéis da importação.

O Dashboard usa o vínculo explícito `PedidoVenda.clienteId` com um cadastro
existente e resolve seus aliases por `ClienteVenda.unificadoEmId`. A raiz
canônica identifica o comprador tanto nos pedidos nativos quanto nos históricos.
A regra antiga de importação não invalida um vínculo cadastral explícito atual.
O nome vem do cadastro atual: Nome Completo PF ou Nome Fantasia PJ.
Pedidos sem vínculo cadastral continuam sem comprador identificado, mesmo com
nome no snapshot. A consulta não infere vínculos por nome, contato ou documento,
nem reescreve os snapshots ou as regras preservadas pela importação.

## Valores e classificação

Os valores agregados originais estão no registro privado. Exemplo exclusivamente sintético de três registros, para explicar as parcelas:

| Parcela preservada | Valor |
| --- | ---: |
| Itens líquidos | R$ 90,00 (exemplo sintético) |
| Valor histórico sem detalhamento | R$ 10,00 (exemplo sintético) |
| Itens líquidos + sem detalhamento | R$ 100,00 (exemplo sintético) |
| Total original menos frete/ajuste original | R$ 102,00 (exemplo sintético) |
| Diferença ainda não classificada | R$ 2,00 (exemplo sintético) |
| Frete/ajuste original, incluindo negativos | R$ 5,00 (exemplo sintético) |
| Registros com frete/ajuste original negativo | 0 (exemplo sintético) |

No exemplo sintético, a parcela sem detalhamento distribui-se em duas partes de R$ 5,00.
O residual sintético de R$ 2,00 não é distribuído entre produtos. Frete/ajuste da fonte
não equivale automaticamente a frete cobrado ou custo logístico. O snapshot
operacional `PedidoVenda.frete` limita negativos a zero; a análise histórica
precisa consultar os valores e a classificação originais em `dadosOrigem`.

O Dashboard conserva essa política e informa separadamente o total original dos
pedidos históricos filtrados, com `pedidosTotalOriginalHistorico` e
`totalOriginalHistorico` na cobertura. Somente `totais.total_original` textual
comprovado alimenta esse total. Ausência em qualquer histórico da seleção deixa
o agregado Não apurado; nenhum pedido nativo é somado nessa medida. Não é usado
`PedidoVenda.total` como substituto nem se calcula o original por residual.
Clientes com seleção nominal e sem filtro de produto/categoria mostram a nota
de origem e ajustes; o CSV conserva ambos os valores. Ajustes não viram desconto
ou custo sem classificação comprovada.

As referências de consumo/custo congeladas pela importação declaram
`custoHistoricoComprovado: false`. Não sustentam margem histórica apurada.
Os endereços históricos de cobrança não são destinos de entrega confirmados.
O marco de 01/09/2026 é uma referência de proteção operacional; esta consulta
não certifica abertura ou conciliação financeira.

## Contrato das reduções nativas

`TratamentoFinanceiroPedido.reduzVenda` e as liberações de
`CreditoClienteMovimento` indicam uma redução comercial. As alocações existentes
apontam para pagamentos, sem identificar a parcela de produtos ou de frete.
Por isso, uma redução genérica não é atribuída integralmente aos produtos em
um pedido com componentes mistos. A receita afetada fica não apurada.

A dedução de produtos exige frete zero, outros valores zero e a igualdade
`subtotal - desconto = total`. A cobertura separa
`pedidosComReducaoSemComponente`, `reducaoComercialSemComponente`,
`pedidosComReceitaApurada` e `vendasProdutosConhecidas`. O valor conhecido não
substitui o indicador integral quando há pedidos não apurados na seleção.
O frete positivo afetado também fica não apurado. `pedidosComFreteApurado` e
`freteCobradoConhecido` mostram a base conhecida. `entregasComFreteECusto`
limita a comparação de frete e custo às entregas com ambas as parcelas apuradas.

O horário mostrado no BI inclui `PedidoVenda.updatedAt`, a identidade histórica,
`TratamentoFinanceiroPedido.updatedAt` e a criação de liberações de crédito.
Cancelamentos de tratamentos também entram nessa atualização. Esses campos
são lidos sem alterar títulos, pagamentos ou o estado comercial do pedido.

## Consultas utilizadas e desempenho

As projeções consultam `PedidoVenda`, `IdentidadeExternaVenda` e
`_prisma_migrations`, sem operações de escrita. A identidade histórica usa
`origem = 'grazing-legado-orders'`, `loja = 'grazing-hub'` e
`entidade = 'PEDIDO_HISTORICO'`. As contagens por mês usam
`(createdAt AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo'`.

O detalhamento monetário usa `dadosOrigem.hub.consulta.totais` com fallback
para `dadosOrigem.registro.totais`. A identidade do comprador usa a chave
cadastral explícita, resolvida até a raiz canônica; não compara nomes nem
contatos para criar vínculos novos. O filtro `cliente` aceita o ID explícito
da raiz ou de seu alias e conserva a seleção na comparação, nos detalhes e
no CSV. O catálogo de opções expõe apenas ID e nome das raízes atuais, exige
permissão de contatos e inclui cadastros sem vendas no período.

Uma execução de quatro SELECTs agregados levou 1.006,7 ms no destino, incluindo
`docker exec` e inicialização de `psql`. Esse tempo não mede o endpoint do BI,
rede do navegador ou renderização. A medição do endpoint final e a reconciliação
da revisão implementada devem ser registradas após sua validação.

## Navegação e permissões

`/vendas/bi` é a primeira seção da navegação existente de Vendas. A entrada
`/vendas` redireciona para ela somente quando `vendas.bi` foi concedida. Os
atalhos e destinos anteriores permanecem disponíveis conforme suas permissões.

A matriz central disponibiliza quatro recursos de leitura, negados por padrão:
`vendas.bi`, `vendas.bi.exportar`, `vendas.bi.contatos` e `vendas.bi.custos`.
Os três recursos específicos exigem também a consulta ao BI no servidor. Não
há concessão implícita por acesso geral a Vendas ou Pedidos.

Testes focados de navegação, entrada do servidor e catálogo: **36 aprovados em
4 arquivos**. Comando:

```powershell
npx vitest run testes/layout/entrada-vendas.test.tsx testes/layout/vendas-navegacao.test.tsx testes/layout/entrada-bi-vendas-servidor.test.ts testes/permissoes/regras.test.ts --maxWorkers=1 --pool=threads
```

A primeira execução não chegou aos testes por `EPERM` no cache temporário do
sandbox e timeout do worker. A repetição usou TEMP/TMP em `.tmp/bi-vendas-nav`
e pool de threads; concluiu em 54,03 segundos. Isso não substitui a bateria final
da feature, o build, a revisão visual nem o smoke de publicação.

## Integração do SELECT com PostgreSQL real

`testes/vendas/bi-sql-integracao.test.ts` chama os serviços reais de consulta e
CSV. Usa PostgreSQL 17.11, Node 22.23.3 e banco sintético local explícito.
O schema mínimo contém as dez tabelas e os tipos usados pelo SELECT. Não
executa migrations ou seeds operacionais. Os dados usam domínios sintéticos.

O teste exige `BI_BANCO_TESTE=1`, `PEDIDOS_AMBIENTE_ISOLADO=1`, conexão local e
nome de banco iniciado por `teste_`. Sem o opt-in, fica ignorado. Na execução
registrada, o opt-in estava ativo. A bateria final ampliada teve **7 testes
aprovados** em 5,30 segundos (2,08 segundos nos testes). ESLint focado e diff sem erros.

```powershell
node node_modules/vitest/vitest.mjs run testes/vendas/bi-sql-integracao.test.ts --maxWorkers=1 --pool=threads
```

A fixture cobre pedido com dois itens, desconto e devolução parcial, item
obsoleto, produto inativo, unidade de kit, histórico já líquido, parcela sem
detalhamento, duas identidades de origem para o mesmo pedido, pedido com total
zero, frete negativo, custo ausente, identidade insuficiente, limites do dia em
São Paulo e compras posteriores. Cancelados, orçamento e teste explícito ficam
fora da coorte comercial. A compra anterior conta para recorrência.

Na seleção sintética, vendas, série, ranking completo, pedidos e CSV fecham em
R$ 160,00 e três pedidos. A contagem não multiplica os valores pelas linhas.
O CSV de produtos conserva a proteção de fórmula e a unidade KIT.
Os casos adicionais verificam redução sem alocação entre produtos e frete,
comparação com dias cobertos sem vendas e atualização por tratamento financeiro
ou liberação de crédito. O custo e o subsídio usam apenas a interseção conhecida.

A conexão Prisma usa `default_transaction_read_only=on`. O serviço também
executa `SET TRANSACTION READ ONLY`. Uma tentativa explícita de UPDATE foi
recusada pelo PostgreSQL. Os hashes das dez tabelas permaneceram idênticos
antes/depois da consulta e das exportações. Sem permissões, nomes e custos
não chegam ao resultado nem ao CSV; exportação e detalhamento recusados
retornam o erro de permissão.

## Limite da medição antes do deploy

A revisão automatizada de aprovação rejeitou a execução de código candidato
em memória por SSH root no contêiner produtivo. A justificativa informou que a
autorização não cobria especificamente esse acesso operacional. O script não
foi executado, e não houve tentativa de contornar a rejeição.

Assim, o desempenho e a reconciliação do serviço candidato em produção ainda
não estão comprovados por esta frente. Os agregados anteriores foram obtidos
por SELECTs de leitura autorizados, sem executar a candidata. A alternativa
é conferir o endpoint oficial e o CSV autenticados após a publicação pelo fluxo
do projeto. Não confundir a integração sintética com essa conferência.

## Aplicação em execução antes da publicação do BI

Os identificadores de tarefas, contêineres e imagens observados em produção
permanecem no registro privado. A conferência documentou estabilidade e ausência
de reinícios; não havia label OCI suficiente para atribuir um commit funcional
à primeira imagem. A entrega fiscal atualizou a aplicação antes do merge do BI.
Essas observações não comprovam a publicação do BI.

A integração PostgreSQL foi repetida após mesclar a main: sete testes aprovados
em 8,30 segundos no head `e8c751efe00cd8e126ec0ad10863b43cfd3bd2f1`. As fontes
SQL permaneceram iguais, e o cluster local foi encerrado após a execução.

## Conferência pelo BI e CSV oficiais

A seleção e a conferência com sessão real permanecem no registro privado.
O exemplo público usa três pedidos em dois períodos, sem comparação, para
explicar a igualdade entre indicador, série, ranking e CSV. A navegação
verificada abre `/vendas/bi` a partir de `/vendas` conforme a permissão.

As conferências reais ficam no registro privado. A tabela seguinte é sintética e ilustra as identidades de soma.

| Conferência | Exemplo sintético |
| --- | ---: |
| Vendas no indicador, série, ranking completo e pedidos do CSV | R$ 105,00 (exemplo sintético) |
| Pedidos válidos no indicador, série e CSV | 3 (exemplo sintético) |
| Pedidos distintos pela chave disponível no CSV | 3 (exemplo sintético) |
| Duplicidades por origem, canal e número no CSV | 0 (exemplo sintético) |
| Períodos na série | 2 (exemplo sintético) |
| Linhas do ranking completo, incluindo unidades e sem detalhamento | 3 (exemplo sintético) |
| Parcela sem detalhamento | R$ 10,00 em 2 pedidos (exemplo sintético) |
| Compradores identificados no período | 2 (exemplo sintético) |
| Pedidos sem comprador identificável | 1 (exemplo sintético) |
| Frete cobrado | R$ 5,00 (exemplo sintético) |
| Ajustes negativos de frete preservados | R$ 0,00 em 0 registros (exemplo sintético) |
| Ajuste comercial histórico ainda não classificado | R$ 2,00 em 1 pedido (exemplo sintético) |

No exemplo sintético, os arquivos da visão geral e de Produtos usam a mesma
coorte e atualização. A soma textual do gráfico fecha em 10.500 centavos,
e o painel mostra três pedidos, com paginação de 25 e o mesmo total comercial.
Não se somam contagens do ranking, pois um pedido pode conter vários produtos.

A medição amostral do serviço permanece documentada no registro privado.
Ela não representa percentil nem teste de carga. As contagens e a data de
atualização operacionais não são reproduzidas por estes exemplos.

Custos efetivos e custos históricos de produção permanecem sem fonte comprovada.
Região informada, modalidade de entrega e destino geográfico comprovado
permanecem medidas distintas. Os resultados operacionais dessa conferência
permanecem no registro privado. A presença de região informada não valida o destino nem cria coordenadas.

O smoke identificou dois rótulos geográficos imprecisos. A correção separa região
informada, ausência de região e destinos não validados; os valores comerciais e
as consultas SQL permanecem iguais. Seis contratos visuais da correção passaram,
incluindo as cinco larguras e um cenário sintético que distingue esses contadores.

## Revisão do Dashboard e fonte Shipping — 15/10/2026

A seção passa a se chamar **Dashboard**. A rota `/vendas/bi` é preservada.
Os registros acima documentam a conferência anterior; não representam a
aplicação das novas fontes de entrega descritas nesta seção.

A fonte de entrega distingue `Full Address (Shipping)` na coluna I e o número
original do pedido na coluna J. O exemplo público tem três números distintos,
dois endereços de entrega preenchidos e um Shipping vazio. Essas contagens são
sintéticas. A conferência da planilha real permanece no registro privado.
A planilha anterior continha endereço de cobrança. Billing não é usado como
substituto de Shipping.

O vínculo do enriquecimento usa o número original e a identidade legada exata.
Não cria pedido, não repete importação comercial e não funde clientes por nome.
A fonte bruta privada permanece fora do Git. Os metadados consultivos conservam
proveniência e hashes; a fonte Shipping original permanece preservada.

Conforme autorização expressa do usuário, Shipping vazio indica retirada sem
frete no Dashboard. Endereço preenchido mas incompleto não vira retirada.
O valor de frete original permanece disponível para rastreabilidade e cobertura;
essa classificação consultiva não altera recebimentos, títulos ou estoque.

## Consulta postal autorizada — preparação local

O usuário autorizou expressamente o envio **somente dos CEPs** ao ViaCEP,
provedor já utilizado pelo HUB. Não foram enviados nome, logradouro, número,
contato ou valor do pedido. A consulta reutiliza `consultarCepVenda`, seu timeout
de cinco segundos e o helper `entregas-historicas-postal.ts`.
O helper valida o lote antes da rede, remove duplicados e executa uma consulta
por vez, com pausa de 300 ms entre CEPs.

| Exemplo sintético do snapshot postal | Resultado |
| --- | ---: |
| CEPs distintos consultados | 3 (exemplo sintético) |
| Resultados com bairro | 2 (exemplo sintético) |
| Resultados com erro | 1 (exemplo sintético) |

As contagens do snapshot operacional permanecem no registro privado.

O snapshot contém somente versão, origem VIACEP, data da consulta e resultados
por CEP com bairro, cidade, UF e data, ou erro. Não armazena logradouro.
Um bairro vazio permanece desconhecido; não é substituído pelo nome da cidade.
Falhas permanecem identificadas e não produzem bairro, coordenada ou valor zero.

O preenchimento de bairro exige CEP correspondente e ausência de conflito de
cidade/UF com Shipping. No exemplo sintético, dois resultados com bairro
não equivalem automaticamente a dois destinos aplicáveis ou validados. A preparação registra
`hub.entregaHistorica.postal` com origem, data e hashes da fonte e do resultado.
A prova postal continua identificada como aproximação de CEP.

**Esta apuração confirma a consulta postal e a preparação local. Não declara
aplicação do enriquecimento em produção.** A aplicação e sua conferência devem
ser registradas separadamente após o fluxo autorizado.

## Evidência da interface desta revisão

O período reutiliza o componente da DRE e preserva limites vazios na URL e na
exportação. Comparação, Tipo, ordenação, agrupamento regional e faixa de CEP
participam das consultas. O ranking de clientes respeita a permissão de contatos;
custos continuam sujeitos à permissão própria. Descontos e tempo médio de
recompra desconhecidos não são convertidos em zero.

Os 20 contratos visuais do consumidor passaram em ambiente sintético isolado.
Após refinamentos localizados, passaram cinco geometrias, o mapa com cor
convertida, o estado de erro e o enquadramento do mapa com um único grupo.
Dois contratos adicionais validaram a grade larga após corrigir o breakpoint,
sem reduzir fontes. As capturas cobrem 1.920, 1.800, 1.672, 1.280, 768, 390
e 320 pixels e os estados claro,
escuro, vazio, carregando e erro. O SDK geográfico foi simulado nos testes;
essas imagens não comprovam consultas ao Google ou o uso da fonte Shipping real.
Evidências, comandos e limites estão na [revisão visual](design-qa.md).
