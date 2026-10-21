# Dashboard de Vendas — revisão visual de 15/10/2026

Resultado desta revisão isolada: **passed** nas sete larguras e nos estados
capturados. Nesse escopo não há P0, P1 ou P2 visual aberto após as correções
descritas abaixo. Este resultado não declara publicação,
homologação do SDK real do Google nem aplicação do enriquecimento histórico.
O [relatório anterior da raiz](../../../design-qa.md) permanece preservado.

## Referências e composição

A imagem aprovada de 1.672 × 941 continua como referência de organização.
A solicitação posterior altera expressamente os nomes, o filtro de período,
a quantidade de indicadores e o último card. Essas diferenças são intencionais;
não constituem uma nova aprovação de baseline visual.

Foram consultados a [Central](../../design-system/README.md), os
[padrões](../../design-system/padroes.md) e o consumidor real da DRE:
`src/app/(protegido)/financeiro/dre-view.tsx`. A implementação reutiliza
`FiltroPeriodo`, `FiltroOpcoesContadas`, `SortableTableHead`, `Table`, `Card`,
`Button formato="campo"`, `GrupoAcoes`, `Tabs`, `Dialog`, `Popover` e `Tooltip`.
Os tokens oficiais continuam responsáveis por cor, foco, superfície e geometria.
Não foi criada uma biblioteca de componentes paralela.

Mudanças verificadas:

- Título **Dashboard**, sem breadcrumb. Cabeçalho e navegação reais preservados.
- Período oficial da DRE, com De/até, atalhos, Limpar datas e aplicação no blur
  ou Enter. Comparação fica junto ao período. O seletor de data foi removido.
- Sete indicadores: Faturamento, Descontos, Pedidos, Ticket médio,
  Clientes compradores, Clientes recorrentes e Frete. A taxa de recorrência
  continua visível; o tempo médio de recompra aparece como informação adicional.
- Gráfico de colunas e ranking de produtos conservam a relação de 60%/40%
  no desktop. O ranking de clientes ocupa o lugar de Qualidade dos dados.
  **Ver cobertura** permanece acessível no cabeçalho, inclusive nas outras abas.
- Produtos, Clientes e Entregas usam ordenação oficial. Clientes recebe Tipo,
  filtro contado PF/PJ/Todos e Pedidos; a coluna Recorrência foi removida.
- Entregas oferece agrupamento por bairro/faixa de CEP e limites de CEP no
  painel. O mapa depende de ação explícita e tem alternativa regional textual.

## Capturas inspecionadas

As capturas usam componentes reais e dados sintéticos da prévia Vite isolada.
Não houve conexão da prévia ao banco, às ações operacionais ou ao Google.
Os arquivos ficam em `.tmp/bi-vendas/capturas/` no worktree desta tarefa.

| Largura | Captura do viewport | Captura completa |
| --- | --- | --- |
| Desktop | `bi-1672.png`, 1.672 × 941 | `bi-1672-completa.png`, 1.672 × 1.373 |
| Desktop de transição | `bi-1800.png`, 1.800 × 941 | `bi-1800-completa.png`, 1.800 × 1.342 |
| Desktop largo | `bi-1920.png`, 1.920 × 941 | `bi-1920-completa.png`, 1.920 × 1.206 |
| Notebook | `bi-1280.png`, 1.280 × 941 | `bi-1280-completa.png`, 1.280 × 1.662 |
| Tablet | `bi-768.png`, 768 × 941 | `bi-768-completa.png`, 768 × 2.888 |
| Celular | `bi-390.png`, 390 × 941 | `bi-390-completa.png`, 390 × 3.083 |
| Celular estreito | `bi-320.png`, 320 × 941 | `bi-320-completa.png`, 320 × 3.563 |

Também foram inspecionados `bi-390-toque.png`, `bi-vazio.png`,
`bi-carregando.png`, `bi-erro.png`, `bi-escuro.png` e `bi-cobertura-regional.png`.
As imagens de erro, vazio e carregamento mostram os respectivos estados reais
do componente com callbacks sintéticos. Não mostram erros ou dados de produção.

O estado anterior foi preservado em `.tmp/bi-vendas/dashboard-antes/`.
As comparações `comparacao-dashboard-{1672,1280,768,390,320}.png` colocam antes
à esquerda e depois à direita, na mesma largura e altura de viewport.
Há comparações completas adicionais em 1.672 e 390 pixels.
`dashboard-evidencias.json` registra dimensões e SHA-256 das imagens.
Esses arquivos são evidências locais; não substituem referências aprovadas do CI.

## Correções decorrentes da revisão

1. As ações adicionais do cabeçalho excediam a largura do celular em 33 pixels.
   O grupo oficial agora permite quebra. As cinco larguras passaram sem rolagem
   horizontal do documento e sem corte dos valores monetários.
2. A exportação recebeu semântica explícita de link. O destino preserva os filtros,
   as direções de ordenação, Tipo, agrupamento regional e limites de CEP.
   Datas vazias permanecem explícitas na URL e no destino da exportação.
3. O notebook passou de 3+3+1 para 4+3 indicadores. A mudança remove uma linha
   desnecessária e conserva o valor completo, inclusive R$ 1.260.981,60 sintético.
   Tablet e celular mantêm a quebra adequada à largura disponível.
4. O contrato de Escape aguarda o foco inicial do painel antes de fechar.
   Foram conferidos fechamento, retorno de foco e acesso por teclado à
   alternativa textual do gráfico e à seleção de colunas.
5. O mapa converte o token oficial em hexadecimal antes de criar as camadas.
   Os limites passam a incluir os extremos do maior raio, inclusive com um único
   grupo. Isso evita enquadrar somente o centro e perder o contexto da região.
6. A conferência adicional de 1.800 pixels confirmou um valor de 169 pixels para
   165 disponíveis na grade de sete colunas. O breakpoint passou para 96 rem de
   conteúdo, sem reduzir fontes. A captura de 1.800 usa 4+3; a de 1.920 mostra os
   sete indicadores em uma linha, com valores completos e sem overflow.

## Resultados executados

Runner: `testes/visual/bi-vendas.playwright.config.ts`, Chromium, Node 22.23.3,
um worker, localidade pt-BR e fuso America/Sao_Paulo.

Comando completo e repetições focadas, com a prévia isolada disponível:

```powershell
node node_modules/@playwright/test/cli.js test --config testes/visual/bi-vendas.playwright.config.ts
node node_modules/@playwright/test/cli.js test --config testes/visual/bi-vendas.playwright.config.ts -g "hierarquia"
node node_modules/@playwright/test/cli.js test --config testes/visual/bi-vendas.playwright.config.ts -g "mapa carrega"
node node_modules/@playwright/test/cli.js test --config testes/visual/bi-vendas.playwright.config.ts -g "erro preserva"
```

| Execução | Resultado | Evidência em `.tmp/bi-vendas/` |
| --- | --- | --- |
| Contratos completos do consumidor | 20/20; 51,9 s | `resultados-dashboard-completo.json` |
| Geometria após o ajuste final do notebook | 5/5; 10,4 s | `resultados-dashboard-geometria-final.json` |
| Cor do mapa após conversão do token | 1/1; 2,9 s | `resultados-dashboard-mapa-cor.json` |
| Estado de erro após o ajuste final | 1/1; 3,8 s | `resultados-dashboard-erro-final.json` |
| Enquadramento do mapa, inclusive um grupo | 1/1; 5,9 s | `resultados-dashboard-mapa-enquadramento.json` |
| Grade larga após o ajuste do breakpoint | 2/2; 9,1 s | `resultados-dashboard-geometria-larga-final.json` |

A execução completa ocorreu antes dos últimos refinamentos localizados.
Os cenários afetados foram repetidos após cada refinamento; não se apresenta
a rodada inicial como uma nova bateria integral da revisão final.

Os contratos cobrem nomes e sete indicadores, estados desconhecidos,
abas e oportunidades, painéis, permissões, paginação, filtros, resposta antiga,
períodos abertos, PF/PJ, ordenação, exportação, CEP, toque e teclado.
O cenário do mapa verifica POST somente por ação, cobertura parcial, passagem
de dois para um grupo, área de enquadramento não nula e remoção das 18 camadas
ao trocar o filtro. SDK e resposta da API são inteiramente simulados nesse caso.

O auditor oficial `auditarInterface(document)` foi executado pelo runner.
Não houve diagnóstico aberto nos estados aprovados. A auditoria cobre parte
dos rótulos, agrupamentos, alvos e overflow; não certifica WCAG, leitor de tela
ou o comportamento do SDK e das credenciais reais.

As prévias e os navegadores próprios foram encerrados. `git diff --check`
passou nos arquivos desta frente. Lint, tipos, build, validação de fontes,
CI, publicação e smoke são registrados na [execução](TASKS.md).

## Fontes e limites de cobertura

As imagens não usam os endereços reais de Shipping nem o snapshot postal.
A apuração externa autorizada ficou separada da prévia. Foram consultados
1.091 CEPs distintos no ViaCEP: 1.086 retornaram bairro e cinco retornaram erro.
Esses resultados não comprovam aplicação dos metadados em produção.

Shipping identifica a origem do destino; Billing não foi promovido.
O usuário definiu Shipping vazio como retirada. Bairro obtido por CEP é uma
aproximação postal e exige compatibilidade com os demais campos da fonte.
Não comprova endereço validado nem coordenada de destino individual.
As [fontes e suas limitações](FONTES.md) detalham essa distinção.

O mapa real depende da integração autorizada e da disponibilidade das chaves.
As posições regionais permanecem aproximadas, limitadas e transitórias.
Não foi contratado serviço, ativada API ou criado ponto fictício em produção.

A faixa responsiva adicional apontada na leitura final foi conferida em
1.800/1.920 pixels. A correção e os dois resultados aprovados estão registrados
acima. Não permanece pendência de corte de moeda nessas larguras.
