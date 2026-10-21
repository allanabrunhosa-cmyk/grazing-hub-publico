-- Aditiva: não altera documentos, pedidos, cadastros ou regras existentes.
ALTER TABLE "GrupoFiscalVenda" ADD COLUMN "codigo" TEXT;
CREATE UNIQUE INDEX "GrupoFiscalVenda_codigo_key" ON "GrupoFiscalVenda"("codigo");
CREATE TABLE "VersaoEstruturaFiscal" (
  "id" TEXT NOT NULL, "tipo" TEXT NOT NULL, "chave" TEXT NOT NULL, "versao" INTEGER NOT NULL,
  "vigenciaInicio" DATE NOT NULL, "status" TEXT NOT NULL DEFAULT 'RASCUNHO', "dados" JSONB NOT NULL,
  "hash" TEXT NOT NULL, "justificativa" TEXT NOT NULL, "fontes" JSONB NOT NULL,
  "criadoPorId" TEXT NOT NULL, "criadoPorNome" TEXT NOT NULL, "chaveOperacao" TEXT NOT NULL,
  "hashOperacao" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VersaoEstruturaFiscal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VersaoEstruturaFiscal_tipo_check" CHECK ("tipo" IN ('CLASSIFICACAO','PERFIL','REGRA','TABELA','COMPLEMENTO')),
  CONSTRAINT "VersaoEstruturaFiscal_status_check" CHECK ("status" IN ('RASCUNHO','ATIVO')),
  CONSTRAINT "VersaoEstruturaFiscal_versao_check" CHECK ("versao" > 0)
);
CREATE UNIQUE INDEX "VersaoEstruturaFiscal_chaveOperacao_key" ON "VersaoEstruturaFiscal"("chaveOperacao");
CREATE UNIQUE INDEX "VersaoEstruturaFiscal_tipo_chave_versao_key" ON "VersaoEstruturaFiscal"("tipo","chave","versao");
CREATE INDEX "VersaoEstruturaFiscal_tipo_chave_status_vigenciaInicio_idx" ON "VersaoEstruturaFiscal"("tipo","chave","status","vigenciaInicio");
CREATE TABLE "EventoEstruturaFiscal" (
  "id" TEXT NOT NULL, "versaoId" TEXT NOT NULL, "tipo" TEXT NOT NULL, "chaveOperacao" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL, "usuarioNome" TEXT NOT NULL, "dados" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventoEstruturaFiscal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventoEstruturaFiscal_versaoId_fkey" FOREIGN KEY ("versaoId") REFERENCES "VersaoEstruturaFiscal"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EventoEstruturaFiscal_chaveOperacao_key" ON "EventoEstruturaFiscal"("chaveOperacao");
CREATE INDEX "EventoEstruturaFiscal_versaoId_createdAt_idx" ON "EventoEstruturaFiscal"("versaoId","createdAt");
ALTER TABLE "DocumentoFiscalSaida" ADD COLUMN "protocoloCancelamento" TEXT;
CREATE FUNCTION preservar_versao_estrutura_fiscal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Versões fiscais não podem ser apagadas'; END IF;
  IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
    RAISE EXCEPTION 'Conteúdo fiscal imutável: criar versão prospectiva';
  END IF;
  IF OLD.status = 'ATIVO' AND NEW.status <> 'ATIVO' THEN RAISE EXCEPTION 'Ativação fiscal preservada no histórico'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "preservar_versao_estrutura_fiscal" BEFORE UPDATE OR DELETE ON "VersaoEstruturaFiscal" FOR EACH ROW EXECUTE FUNCTION preservar_versao_estrutura_fiscal();
-- Grupos operacionais não fornecem um NCM único nem alteram produtos vinculados.
INSERT INTO "GrupoFiscalVenda" ("id","codigo","nome","fiscal","ativo","versao") VALUES
('fiscal-grupo-gf01','GF01','GF01 — Alimentação preparada: tábuas e frios','{}',true,1),
('fiscal-grupo-gf02','GF02','GF02 — Alimentação preparada: salgados','{}',true,1),
('fiscal-grupo-gf03','GF03','GF03 — Alimentação preparada: doces','{}',true,1),
('fiscal-grupo-gf04','GF04','GF04 — Preparações próprias avulsas','{}',true,1),
('fiscal-grupo-gf05','GF05','GF05 — Alimentos avulsos ou fracionados','{}',true,1),
('fiscal-grupo-gf06','GF06','GF06 — Empório e revenda alimentar','{}',true,1),
('fiscal-grupo-gf07','GF07','GF07 — Bebidas não alcoólicas industrializadas','{}',true,1),
('fiscal-grupo-gf08','GF08','GF08 — Bebidas preparadas no estabelecimento','{}',true,1),
('fiscal-grupo-gf09','GF09','GF09 — Cervejas','{}',true,1),
('fiscal-grupo-gf10','GF10','GF10 — Vinhos, espumantes e licores','{}',true,1),
('fiscal-grupo-gf11','GF11','GF11 — Embalagens e utensílios vendidos','{}',true,1),
('fiscal-grupo-gf12','GF12','GF12 — Serviços de eventos','{}',true,1)
ON CONFLICT DO NOTHING;
