-- Cópia autorizada do plano Takeat da Grazing Table & Co, consultado em 10/09/2026.
-- Mantém a classificação de origem. Nenhum lançamento, valor ou grupo existente é alterado.
BEGIN;
LOCK TABLE "CategoriaFinanceira" IN SHARE ROW EXCLUSIVE MODE;
ALTER TABLE "CategoriaFinanceira" ADD COLUMN "paiId" TEXT;
ALTER TABLE "CategoriaFinanceira" ADD CONSTRAINT "CategoriaFinanceira_paiId_fkey"
  FOREIGN KEY ("paiId") REFERENCES "CategoriaFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CategoriaFinanceira" ADD CONSTRAINT "CategoriaFinanceira_pai_distinto"
  CHECK ("paiId" IS NULL OR "paiId" <> id);
DROP INDEX "CategoriaFinanceira_nome_grupo_key";
CREATE UNIQUE INDEX "CategoriaFinanceira_nome_grupo_paiId_key" ON "CategoriaFinanceira"("nome", "grupo", "paiId");
-- O índice parcial também impede duplicação na raiz, cujo pai é NULL.
CREATE UNIQUE INDEX "CategoriaFinanceira_raiz_nome_grupo_key" ON "CategoriaFinanceira"("nome", "grupo") WHERE "paiId" IS NULL;
CREATE INDEX "CategoriaFinanceira_paiId_idx" ON "CategoriaFinanceira"("paiId");

CREATE TEMP TABLE importacao_takeat (codigo TEXT PRIMARY KEY, id TEXT NOT NULL) ON COMMIT DROP;
DO $importacao$
DECLARE
  item JSONB;
  identificador TEXT;
  pai_identificador TEXT;
BEGIN
  FOR item IN SELECT value FROM jsonb_array_elements($dados$[
  {
    "codigo": "1",
    "pai": null,
    "nome": "Aquisição de Ativos",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "1-1",
    "pai": "1",
    "nome": "Aplicações Financeiras",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "1-2",
    "pai": "1",
    "nome": "Ativos de produção",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "1-2-1",
    "pai": "1-2",
    "nome": "Equipamentos",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "1-2-2",
    "pai": "1-2",
    "nome": "Utensilios",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "1-3",
    "pai": "1",
    "nome": "Imobilizado -benfeitorias e equips",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "1-4",
    "pai": "1",
    "nome": "Instalações Gerais",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "1-5",
    "pai": "1",
    "nome": "Mão de Obra",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "1-6",
    "pai": "1",
    "nome": "Outros Ativos",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "1-6-1",
    "pai": "1-6",
    "nome": "Outros equipamentos",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "1-6-2",
    "pai": "1-6",
    "nome": "Outros utensilios",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "2",
    "pai": null,
    "nome": "Consumo e Utilidades Prediais",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "2-1",
    "pai": "2",
    "nome": "Aluguel",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "2-2",
    "pai": "2",
    "nome": "Energia Elétrica",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "2-3",
    "pai": "2",
    "nome": "Gás",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "2-4",
    "pai": "2",
    "nome": "IPTU",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "2-5",
    "pai": "2",
    "nome": "Internet",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "2-6",
    "pai": "2",
    "nome": "Manutenção Refrig. e AC",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "2-7",
    "pai": "2",
    "nome": "Manutenção diversas",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "2-8",
    "pai": "2",
    "nome": "Seguro Predial",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "2-9",
    "pai": "2",
    "nome": "Telefone",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "2-10",
    "pai": "2",
    "nome": "Água",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "3",
    "pai": null,
    "nome": "Despesas com pessoal",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "3-1",
    "pai": "3",
    "nome": "13º Salário",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "3-2",
    "pai": "3",
    "nome": "Adiantamento",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "3-3",
    "pai": "3",
    "nome": "Alimentação funcionário (AF)",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "3-4",
    "pai": "3",
    "nome": "Comissão",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "3-5",
    "pai": "3",
    "nome": "FGTS",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "3-6",
    "pai": "3",
    "nome": "Freelancers",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "3-7",
    "pai": "3",
    "nome": "Férias",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "3-8",
    "pai": "3",
    "nome": "Horas Extras",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "3-9",
    "pai": "3",
    "nome": "Outras despesas com pessoal",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "3-10",
    "pai": "3",
    "nome": "Plano de Saúde",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "3-11",
    "pai": "3",
    "nome": "Previdência Social (INSS)",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "3-12",
    "pai": "3",
    "nome": "Pró Labore",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "3-13",
    "pai": "3",
    "nome": "Rescisão Contratual",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "3-14",
    "pai": "3",
    "nome": "Salários",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "3-15",
    "pai": "3",
    "nome": "Seguro de vida",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "3-16",
    "pai": "3",
    "nome": "Vale Alimentação",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "3-17",
    "pai": "3",
    "nome": "Vale Transporte",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "4",
    "pai": null,
    "nome": "Empréstimos e Financiamentos",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "4-1",
    "pai": "4",
    "nome": "Empréstimo de Capital de Giro",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "4-2",
    "pai": "4",
    "nome": "Outros Empréstimos",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "5",
    "pai": null,
    "nome": "Frete",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "5-1",
    "pai": "5",
    "nome": "Entregas terceirizadas",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "6",
    "pai": null,
    "nome": "GA (Gerais e ADM)",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "6-1",
    "pai": "6",
    "nome": "Contador",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "6-2",
    "pai": "6",
    "nome": "Cursos e eventos (socios)",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "6-3",
    "pai": "6",
    "nome": "Distribuição de lucros",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "6-4",
    "pai": "6",
    "nome": "Marketing",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "6-4-1",
    "pai": "6-4",
    "nome": "ADS",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "6-4-2",
    "pai": "6-4",
    "nome": "Outros",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "6-4-3",
    "pai": "6-4",
    "nome": "Serviços terceiros",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "6-5",
    "pai": "6",
    "nome": "Nutricionista",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "6-6",
    "pai": "6",
    "nome": "Outras despesas",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "6-7",
    "pai": "6",
    "nome": "Serviços terceiros",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "6-8",
    "pai": "6",
    "nome": "Sistemas e assinaturas digitais",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "7",
    "pai": null,
    "nome": "Impostos, Taxas e Tarifas",
    "grupo": "DEDUCOES_RECEITA"
  },
  {
    "codigo": "7-1",
    "pai": "7",
    "nome": "Alvará Contribuição Sindical",
    "grupo": "DEDUCOES_RECEITA"
  },
  {
    "codigo": "7-2",
    "pai": "7",
    "nome": "COFINS",
    "grupo": "DEDUCOES_RECEITA"
  },
  {
    "codigo": "7-3",
    "pai": "7",
    "nome": "CSLL",
    "grupo": "DEDUCOES_RECEITA"
  },
  {
    "codigo": "7-4",
    "pai": "7",
    "nome": "ICMS",
    "grupo": "DEDUCOES_RECEITA"
  },
  {
    "codigo": "7-5",
    "pai": "7",
    "nome": "IPI",
    "grupo": "DEDUCOES_RECEITA"
  },
  {
    "codigo": "7-6",
    "pai": "7",
    "nome": "IRPJ",
    "grupo": "DEDUCOES_RECEITA"
  },
  {
    "codigo": "7-7",
    "pai": "7",
    "nome": "ISS",
    "grupo": "DEDUCOES_RECEITA"
  },
  {
    "codigo": "7-8",
    "pai": "7",
    "nome": "PIS",
    "grupo": "DEDUCOES_RECEITA"
  },
  {
    "codigo": "7-9",
    "pai": "7",
    "nome": "Simples Nacional",
    "grupo": "DEDUCOES_RECEITA"
  },
  {
    "codigo": "7-10",
    "pai": "7",
    "nome": "Tarifas Bancárias",
    "grupo": "DEDUCOES_RECEITA"
  },
  {
    "codigo": "8",
    "pai": null,
    "nome": "Insumos",
    "grupo": "CMV"
  },
  {
    "codigo": "8-1",
    "pai": "8",
    "nome": "Bebidas para preparações",
    "grupo": "CMV"
  },
  {
    "codigo": "8-2",
    "pai": "8",
    "nome": "Charcutaria",
    "grupo": "CMV"
  },
  {
    "codigo": "8-3",
    "pai": "8",
    "nome": "Embalagens e acessórios descartáveis",
    "grupo": "CMV"
  },
  {
    "codigo": "8-4",
    "pai": "8",
    "nome": "Frutas, antepastos e ervas",
    "grupo": "CMV"
  },
  {
    "codigo": "8-5",
    "pai": "8",
    "nome": "Insumos para preparações",
    "grupo": "CMV"
  },
  {
    "codigo": "8-6",
    "pai": "8",
    "nome": "Preparações doces",
    "grupo": "CMV"
  },
  {
    "codigo": "8-7",
    "pai": "8",
    "nome": "Preparações salgadas",
    "grupo": "CMV"
  },
  {
    "codigo": "8-8",
    "pai": "8",
    "nome": "Pães e Crackers",
    "grupo": "CMV"
  },
  {
    "codigo": "8-9",
    "pai": "8",
    "nome": "Queijos",
    "grupo": "CMV"
  },
  {
    "codigo": "9",
    "pai": null,
    "nome": "Material de Consumo",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "9-1",
    "pai": "9",
    "nome": "Descartaveis operacionais",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "9-2",
    "pai": "9",
    "nome": "Limpeza e conservação",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "9-3",
    "pai": "9",
    "nome": "Material de escritório",
    "grupo": "DESPESAS_OPERACIONAIS"
  },
  {
    "codigo": "10",
    "pai": null,
    "nome": "Produtos para Revendas",
    "grupo": "CMV"
  },
  {
    "codigo": "10-1",
    "pai": "10",
    "nome": "Cervejas e outros alcoolicos",
    "grupo": "CMV"
  },
  {
    "codigo": "10-2",
    "pai": "10",
    "nome": "Doces revenda",
    "grupo": "CMV"
  },
  {
    "codigo": "10-3",
    "pai": "10",
    "nome": "Emporio",
    "grupo": "CMV"
  },
  {
    "codigo": "10-4",
    "pai": "10",
    "nome": "Não Alcoolicos revenda",
    "grupo": "CMV"
  },
  {
    "codigo": "10-5",
    "pai": "10",
    "nome": "Tortas e salgados revenda",
    "grupo": "CMV"
  },
  {
    "codigo": "10-6",
    "pai": "10",
    "nome": "Vinhos e espumantes",
    "grupo": "CMV"
  }
]$dados$::jsonb)
  LOOP
    pai_identificador := NULL;
    IF item->>'pai' IS NOT NULL THEN
      SELECT id INTO STRICT pai_identificador FROM importacao_takeat WHERE codigo = item->>'pai';
    END IF;
    SELECT id INTO identificador FROM "CategoriaFinanceira"
      WHERE nome = item->>'nome' AND grupo = (item->>'grupo')::"GrupoDre"
      AND "paiId" IS NOT DISTINCT FROM pai_identificador;
    IF identificador IS NULL AND pai_identificador IS NOT NULL THEN
      -- Reaproveita somente correspondência exata no mesmo grupo, ainda sem pai.
      -- Preserva ID, situação, centro de custo e todos os vínculos históricos.
      SELECT id INTO identificador FROM "CategoriaFinanceira"
        WHERE nome = item->>'nome' AND grupo = (item->>'grupo')::"GrupoDre" AND "paiId" IS NULL;
      IF identificador IS NOT NULL THEN
        UPDATE "CategoriaFinanceira" SET "paiId" = pai_identificador WHERE id = identificador;
      END IF;
    END IF;
    IF identificador IS NULL THEN
      identificador := 'takeat-conta-' || (item->>'codigo');
      INSERT INTO "CategoriaFinanceira" (id, nome, grupo, "paiId", ativo)
        VALUES (identificador, item->>'nome', (item->>'grupo')::"GrupoDre", pai_identificador, true);
    END IF;
    INSERT INTO importacao_takeat VALUES (item->>'codigo', identificador);
  END LOOP;
END $importacao$;
COMMIT;

