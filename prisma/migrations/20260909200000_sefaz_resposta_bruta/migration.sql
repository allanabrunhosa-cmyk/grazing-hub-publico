-- Guarda o envelope XML bruto da última resposta da SEFAZ (mesmo em rejeição) e os
-- campos ultNSU/maxNSU que ela informou nessa resposta específica — só informativo,
-- nunca usado para avançar o cursor real (SefazDistribuicaoEstado.ultNSU).
ALTER TABLE "SefazDistribuicaoEstado"
  ADD COLUMN "ultimaRespostaXml" TEXT,
  ADD COLUMN "ultNSUResposta" TEXT,
  ADD COLUMN "maxNSUResposta" TEXT;
