# Manifesto e Movimentações — 11/11/2026

Estado: **Em revisão**. Capturas consultivas com dados fictícios. Nenhuma referência aprovada foi substituída.

## Resultado

- Notas com desconto começam sem modalidade selecionada. O aceite exige escolha explícita. Uma composição já conciliada mantém sua modalidade e proteção.
- Sair após selecionar uma modalidade aciona a proteção contra perda de alterações. Descartar e reabrir restaura o estado carregado.
- A busca usa o campo oficial e aceita descrição, categoria, fornecedor, conta e valores como `1.234,56`, `1234,56` ou `1234.56`. Uma correspondência mantém o grupo completo. Cartões, totais e saldos continuam representando todo o período.
- A edição de lançamentos usa o botão verde oficial **Salvar alterações**. Os campos receberam associações acessíveis entre rótulo e controle.

## Verificações executadas

Ambiente: Node 22.23.3, Windows, Chrome local e Playwright 1.64.0. Sem dados produtivos.

| Verificação | Resultado |
| --- | --- |
| Regressão de notas fiscais e consumidores financeiros | 299 testes aprovados; 39 testes de banco não executados, em 4 suítes optativas |
| ESLint nos arquivos alterados | Aprovado |
| Lint de design | Aprovado; 0 desvios novos, 88 históricos |
| Typecheck e build de produção com webpack | Aprovados |
| Smoke do build local sem sessão | Login 200; três rotas protegidas redirecionam para login |
| Playwright de Manifesto | 24 casos aprovados |
| Playwright de Movimentações | 24 casos aprovados |
| Auditorias dos fluxos visuais | 84 auditorias; 0 problemas detectados |
| Captura dos estados da referência existente | 5 estados capturados; nenhuma referência alterada |

Os 48 casos visuais cobrem 320, 390, 768 e 1440 px, temas claro e escuro, além de toque em 320 e 390 px. Incluem teclado, bloqueio de aceite sem escolha, reabertura, busca por texto e valores, limpeza, estado vazio e botão de edição. Os testes isolados bloqueiam solicitações externas.

As primeiras rodadas identificaram rótulos sem associação e uma falha intermitente na proteção ao fechar após escolher desconto. Ambos foram corrigidos antes da rodada final. A verificação do retorno da ação sintética passou a aguardar a atualização observável da interface, sem aumentar prazos ou reduzir as asserções.

Não houve alteração de schema, transações, cálculo tributário ou integração externa. As quatro suítes optativas que exigem banco não foram executadas. Nenhuma nota real foi manifestada e nenhuma movimentação real foi gravada para testar.

## Capturas

- [Manifesto no computador](manifesto-desktop.png)
- [Manifesto no celular](manifesto-mobile.png)
- [Busca no computador](busca-desktop.png)
- [Salvar alterações no celular](salvar-mobile.png)

O diálogo móvel foi rolado até a ação de salvar. A captura de busca mostra o filtro por texto; os formatos monetários foram verificados na mesma execução automatizada. [Origem e hashes](origem.json) vinculam as capturas ao código conferido. Logs e relatórios completos permanecem no ambiente privado da tarefa.

## Publicação e retorno

Publicação pela branch própria e PR, após verificações de integração. O resultado de produção deve ser registrado na PR após confirmar a nova tarefa estável, as rotas HTTPS e a preservação da configuração fiscal.

Reversão: reverter o código por PR. Não restaurar o banco sobre operações posteriores. O backup privado foi conferido antes da publicação. Nenhuma migration faz parte desta alteração.
