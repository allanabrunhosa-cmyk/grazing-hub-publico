# Conciliação por vencimento e filtros com quantidades

## Comportamento
- Despesas pendentes podem ser sugeridas com até sete dias civis de diferença, para ambos os lados, com valor exato em centavos e contraparte compatível. Ambiguidade exige escolha manual; confirmar continua explícito e revalidado no servidor.
- Uma candidata sugerida aparece mesmo se o vencimento estiver fora do período do extrato. A ampliação não altera datas de pagamentos já realizados nem o período bancário.
- Todas as opções de filtros categóricos de listas incluem quantidade, inclusive Todos e zero. Busca e demais filtros entram no cálculo; seleção do próprio grupo e paginação não entram.
- Contagens financeiras representam as linhas agrupadas exibidas. Conciliação conta transações bancárias; a busca da empresa não filtra o banco.
- Resumos explicitamente gerais permanecem independentes dos filtros. Seletores de edição e abas de navegação não são filtros.

## Cobertura
- NF-e e NFS-e: situação por busca/período.
- Compras: Todos, pendentes, atrasados, recebidos com/sem divergência e excluídos.
- Estoque: direção das movimentações, contagens/excluídas, itens contados, locais e abaixo do mínimo.
- Financeiro: situação de movimentações, conciliação, contas legadas; faturas e itens da fatura antes da paginação.
- Vendas: filtro de formas de pagamento, canais do Gestor, clientes/canais de Gestão.
- Validades: período, grupo, conservação e estado da impressão; remove o corte silencioso de 500 trabalhos para consultar o conjunto completo.
- Preservados os contadores já existentes: Insumos, Clientes, Fornecedores, Plano de contas, Vínculos fiscais, Perdas e colunas do Gestor.

## Caminhos
Padrão: src/components/filtro-opcoes-contadas.tsx e docs/design-system/padroes.md.
Sugestão: src/lib/financeiro/conciliacao/sugestoes.ts e conciliacao-view.tsx.
Consultas completas: src/lib/financeiro/faturas/consultas.ts, src/lib/vendas/pedidos.ts, pedidos-gestao.ts.
Consumidores nas rotas de notas-fiscais, financeiro, inventario, compras, vendas e producao/etiquetas.

## Aceitação
Sete dias inclusive, oito excluído, valores divergentes/nomes genéricos/ambiguidades protegidos. Contadores acompanham busca, período e atualização dos dados; zero pode ser selecionado. Itens ignorados distinguem a própria situação sem inflar outras. Paginação não limita contagens. Visual responsivo e smoke somente de leitura, sem operar dados reais.
