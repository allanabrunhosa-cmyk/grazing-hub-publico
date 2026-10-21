-- Módulo Financeiro: Plano de Contas, Lançamentos, Contas a Pagar/Receber, Bancário.

CREATE TYPE "GrupoDre" AS ENUM (
    'RECEITA_BRUTA',
    'DEDUCOES_RECEITA',
    'CMV',
    'DESPESAS_VARIAVEIS',
    'FOLHA_PAGAMENTO',
    'DESPESAS_OPERACIONAIS',
    'INVESTIMENTOS',
    'DESPESAS_FINANCEIRAS',
    'DEPRECIACAO_AMORTIZACAO',
    'RECEITAS_NAO_OPERACIONAIS',
    'DESPESAS_NAO_OPERACIONAIS'
);

CREATE TYPE "TipoLancamento" AS ENUM ('RECEITA', 'DESPESA');

CREATE TYPE "StatusLancamento" AS ENUM ('PENDENTE', 'BAIXADO', 'CANCELADO');

CREATE TYPE "TipoMovimentacaoBancaria" AS ENUM ('ENTRADA', 'SAIDA', 'AJUSTE');

CREATE TABLE "CategoriaFinanceira" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "grupo" "GrupoDre" NOT NULL,
    "centroCustoId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoriaFinanceira_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CategoriaFinanceira_nome_grupo_key" ON "CategoriaFinanceira"("nome", "grupo");
CREATE INDEX "CategoriaFinanceira_grupo_idx" ON "CategoriaFinanceira"("grupo");

ALTER TABLE "CategoriaFinanceira" ADD CONSTRAINT "CategoriaFinanceira_centroCustoId_fkey"
    FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ContaBancaria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "saldoInicial" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaBancaria_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContaBancaria_nome_key" ON "ContaBancaria"("nome");

CREATE TABLE "LancamentoFinanceiro" (
    "id" TEXT NOT NULL,
    "tipo" "TipoLancamento" NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "dataCompetencia" TIMESTAMP(3) NOT NULL,
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "status" "StatusLancamento" NOT NULL DEFAULT 'PENDENTE',
    "dataPagamento" TIMESTAMP(3),
    "contaBancariaId" TEXT,
    "formaPagamentoId" TEXT,
    "fornecedorId" TEXT,
    "contraparteNome" TEXT,
    "recorrenciaGrupoId" TEXT,
    "origemMovimentacaoEstoqueId" TEXT,
    "observacoes" TEXT,
    "criadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LancamentoFinanceiro_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LancamentoFinanceiro_origemMovimentacaoEstoqueId_key" ON "LancamentoFinanceiro"("origemMovimentacaoEstoqueId");
CREATE INDEX "LancamentoFinanceiro_tipo_idx" ON "LancamentoFinanceiro"("tipo");
CREATE INDEX "LancamentoFinanceiro_status_idx" ON "LancamentoFinanceiro"("status");
CREATE INDEX "LancamentoFinanceiro_categoriaId_idx" ON "LancamentoFinanceiro"("categoriaId");
CREATE INDEX "LancamentoFinanceiro_dataVencimento_idx" ON "LancamentoFinanceiro"("dataVencimento");
CREATE INDEX "LancamentoFinanceiro_dataCompetencia_idx" ON "LancamentoFinanceiro"("dataCompetencia");
CREATE INDEX "LancamentoFinanceiro_recorrenciaGrupoId_idx" ON "LancamentoFinanceiro"("recorrenciaGrupoId");

ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_categoriaId_fkey"
    FOREIGN KEY ("categoriaId") REFERENCES "CategoriaFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_contaBancariaId_fkey"
    FOREIGN KEY ("contaBancariaId") REFERENCES "ContaBancaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_formaPagamentoId_fkey"
    FOREIGN KEY ("formaPagamentoId") REFERENCES "FormaPagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_fornecedorId_fkey"
    FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_origemMovimentacaoEstoqueId_fkey"
    FOREIGN KEY ("origemMovimentacaoEstoqueId") REFERENCES "MovimentacaoEstoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_criadoPorId_fkey"
    FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MovimentacaoBancaria" (
    "id" TEXT NOT NULL,
    "contaBancariaId" TEXT NOT NULL,
    "tipo" "TipoMovimentacaoBancaria" NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descricao" TEXT NOT NULL,
    "lancamentoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentacaoBancaria_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MovimentacaoBancaria_lancamentoId_key" ON "MovimentacaoBancaria"("lancamentoId");
CREATE INDEX "MovimentacaoBancaria_contaBancariaId_idx" ON "MovimentacaoBancaria"("contaBancariaId");

ALTER TABLE "MovimentacaoBancaria" ADD CONSTRAINT "MovimentacaoBancaria_contaBancariaId_fkey"
    FOREIGN KEY ("contaBancariaId") REFERENCES "ContaBancaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MovimentacaoBancaria" ADD CONSTRAINT "MovimentacaoBancaria_lancamentoId_fkey"
    FOREIGN KEY ("lancamentoId") REFERENCES "LancamentoFinanceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed inicial do plano de contas — cobre os 11 grupos com categorias comuns de
-- restaurante, 100% editável/removível depois pela tela de Plano de Contas.
INSERT INTO "CategoriaFinanceira" ("id", "nome", "grupo") VALUES
    (gen_random_uuid()::text, 'Receita com Vendas', 'RECEITA_BRUTA'),
    (gen_random_uuid()::text, 'Receita Delivery', 'RECEITA_BRUTA'),
    (gen_random_uuid()::text, 'Impostos sobre Vendas', 'DEDUCOES_RECEITA'),
    (gen_random_uuid()::text, 'Taxas de Cartão/Maquininha', 'DEDUCOES_RECEITA'),
    (gen_random_uuid()::text, 'Comissão de Delivery', 'DEDUCOES_RECEITA'),
    (gen_random_uuid()::text, 'Insumos', 'CMV'),
    (gen_random_uuid()::text, 'Embalagens e Descartáveis', 'CMV'),
    (gen_random_uuid()::text, 'Gás', 'CMV'),
    (gen_random_uuid()::text, 'Frete de Compras', 'CMV'),
    (gen_random_uuid()::text, 'Salários', 'FOLHA_PAGAMENTO'),
    (gen_random_uuid()::text, 'Encargos (INSS/FGTS)', 'FOLHA_PAGAMENTO'),
    (gen_random_uuid()::text, 'Pró-labore', 'FOLHA_PAGAMENTO'),
    (gen_random_uuid()::text, 'Vale Transporte/Alimentação', 'FOLHA_PAGAMENTO'),
    (gen_random_uuid()::text, 'Aluguel', 'DESPESAS_OPERACIONAIS'),
    (gen_random_uuid()::text, 'Energia Elétrica', 'DESPESAS_OPERACIONAIS'),
    (gen_random_uuid()::text, 'Água', 'DESPESAS_OPERACIONAIS'),
    (gen_random_uuid()::text, 'Internet/Telefone', 'DESPESAS_OPERACIONAIS'),
    (gen_random_uuid()::text, 'Manutenção', 'DESPESAS_OPERACIONAIS'),
    (gen_random_uuid()::text, 'Marketing', 'DESPESAS_OPERACIONAIS'),
    (gen_random_uuid()::text, 'Material de Limpeza', 'DESPESAS_OPERACIONAIS'),
    (gen_random_uuid()::text, 'Contabilidade', 'DESPESAS_OPERACIONAIS'),
    (gen_random_uuid()::text, 'Software/Assinaturas', 'DESPESAS_OPERACIONAIS'),
    (gen_random_uuid()::text, 'Equipamentos', 'INVESTIMENTOS'),
    (gen_random_uuid()::text, 'Reformas', 'INVESTIMENTOS'),
    (gen_random_uuid()::text, 'Juros e Multas', 'DESPESAS_FINANCEIRAS'),
    (gen_random_uuid()::text, 'Tarifas Bancárias', 'DESPESAS_FINANCEIRAS'),
    (gen_random_uuid()::text, 'Empréstimos', 'DESPESAS_FINANCEIRAS'),
    (gen_random_uuid()::text, 'Depreciação de Equipamentos', 'DEPRECIACAO_AMORTIZACAO'),
    (gen_random_uuid()::text, 'Aporte de Sócios', 'RECEITAS_NAO_OPERACIONAIS'),
    (gen_random_uuid()::text, 'Venda de Ativos', 'RECEITAS_NAO_OPERACIONAIS'),
    (gen_random_uuid()::text, 'Outras Receitas', 'RECEITAS_NAO_OPERACIONAIS'),
    (gen_random_uuid()::text, 'Despesas Não Recorrentes', 'DESPESAS_NAO_OPERACIONAIS'),
    (gen_random_uuid()::text, 'Multas e Processos', 'DESPESAS_NAO_OPERACIONAIS');
