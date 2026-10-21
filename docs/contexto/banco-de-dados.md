# Banco de dados

## Fontes e navegação

- PostgreSQL; singleton em `src/lib/prisma.ts`, usando `@prisma/adapter-pg`.
- Schema: `prisma/schema.prisma`; configuração CLI: `prisma7.config.ts`.
- Client gerado: `src/generated/prisma`. Nunca editar manualmente.
- Comece por `rg -n '^model |^enum ' prisma/schema.prisma`; leia o model desejado,
  relações e migrations relacionadas. Não carregue o schema inteiro por padrão.
- `DATABASE_URL` é privada e específica do ambiente. Não copiar credenciais para docs.

## Relações centrais

| Domínio | Entrada no schema |
| --- | --- |
| Acesso | Usuario → PerfilAcesso, exceções e sessaoVersao |
| Cadastros | Fornecedor (também beneficiário), Categoria, CentroCusto, ConfiguracaoLoja |
| Insumos | Insumo → ConversaoInsumo, InsumoFornecedor, ComposicaoInsumo |
| Estoque | SaldoEstoque por insumo/local; MovimentacaoEstoque; InventarioContagem/Item |
| Compras | PedidoCompra/Item → Recebimento/Item; histórico preservado |
| Financeiro | LancamentoFinanceiro → CategoriaFinanceira, conta, fornecedor; MovimentacaoBancaria |
| Extrato/cartão | TransacaoExtrato → vínculos; FaturaCartao → itens/pagamentos → LiquidacaoCartao |
| Fiscal | NotaFiscalRecebida → itens/duplicatas/vínculos; NotaFiscalServico → vínculos |
| Vendas | ProdutoVenda → grupos, opções, preços e componentes; não é Insumo |
| Etiquetas/Design | TrabalhoEtiqueta e tentativas; ConfiguracaoDesign, RascunhoDesign, VersaoDesign |

## Migrations e precisão

1. Escrever SQL manual em `prisma/migrations/<timestamp>_<nome>/migration.sql`,
   timestamp posterior aos existentes. Não usar `prisma migrate dev` ou `db push`.
2. Preservar migrations aplicadas, IDs, vínculos, snapshots e dados anteriores.
   Preferir alteração aditiva; transformação de dados exige plano, conferência e reversão.
3. Rodar `npx prisma validate` e `npx prisma generate` quando schema/client mudarem.
4. Aplicar/testar via `npx prisma migrate deploy` **somente na base local isolada conferida**.
   A mesma sintaxe em produção só faz parte do ritual autorizado de [deploy](deploy.md).
5. Após gerar client, reiniciar dev; se houver client antigo em cache, remover apenas o
   diretório .next do worktree verificado. Não apagar caches de outras tarefas.
6. Usar Decimal/centavos para dinheiro e precisão própria de quantidades/conversões.
   Não normalizar data de negócio como instante UTC sem examinar o domínio.

Operações críticas usam transações, travas e versão otimista: preservar ordem de travas,
idempotência e revalidação de autorização. Testes opt-in criam schema temporário em
PostgreSQL localhost e removem somente esse schema. Nunca apontar teste para produção.
Backup privado verificável antes de qualquer migration produtiva de schema/dados.

`PedidoVenda.createdAt` guarda um instante UTC em `TIMESTAMP(3)` sem fuso. Em SQL
de análise, converter para São Paulo com
`(createdAt AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo'`.
Aplicar apenas o segundo `AT TIME ZONE` interpreta o relógio UTC como horário local
e pode trocar o mês de pedidos próximos da meia-noite. O domínio usa
`src/lib/vendas/pedidos-agenda-dominio.ts`; os limites são cobertos pelos testes
do BI. Confirme o contrato de cada campo antes de aplicar a expressão a outro domínio.

AtividadeUsuario é projeção enxuta, append-only, por referência às auditorias de
domínio. Fontes existentes e registros novos compartilham a transação do negócio.
Consultar [auditoria/atividades](auditoria-atividades.md) para o padrão obrigatório,
diagnóstico, recuperação em lotes e manutenção por papel separado.
