-- Aditiva: preserva pedidos/cadastros anteriores. Ausência de produto só no adaptador iFood.
ALTER TABLE "ItemPedidoVenda" ALTER COLUMN "produtoId" DROP NOT NULL;
CREATE TABLE "IntegracaoIfood" (
 "id" TEXT PRIMARY KEY, "contaId" TEXT NOT NULL DEFAULT 'singleton',
 "ambiente" TEXT NOT NULL UNIQUE CHECK ("ambiente" IN ('TESTE','PRODUCAO')),
 "modalidade" TEXT NOT NULL CHECK ("modalidade" IN ('CENTRALIZADO','DISTRIBUIDO')),
 "clientId" TEXT NOT NULL, "ativo" BOOLEAN NOT NULL DEFAULT false,
 "tokenCifrado" TEXT, "refreshCifrado" TEXT, "tokenExpiraEm" TIMESTAMP(3),
 "autorizacaoUsuarioId" TEXT, "autorizacaoSessaoVersao" INTEGER, "autorizacaoId" TEXT,
 "verificadorCifrado" TEXT, "autorizacaoExpiraEm" TIMESTAMP(3), "ultimoErro" TEXT,
 "criadoPorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "IntegracaoIfood_conta" CHECK ("contaId" = 'singleton')
);
CREATE TABLE "LojaIfood" (
 "id" TEXT PRIMARY KEY, "integracaoId" TEXT NOT NULL REFERENCES "IntegracaoIfood"("id") ON DELETE RESTRICT,
 "ambiente" TEXT NOT NULL, "merchantId" TEXT NOT NULL, "nome" TEXT NOT NULL,
 "canalId" TEXT NOT NULL REFERENCES "CanalVenda"("id") ON DELETE RESTRICT,
 "autorizada" BOOLEAN NOT NULL DEFAULT false, "ativa" BOOLEAN NOT NULL DEFAULT false,
 "ultimaAutorizacao" TIMESTAMP(3), "ultimoPolling" TIMESTAMP(3), "ultimoRecebimento" TIMESTAMP(3),
 "proximoPolling" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "leaseToken" TEXT, "leaseAte" TIMESTAMP(3), "ultimoErro" TEXT,
 UNIQUE ("ambiente","merchantId")
);
CREATE INDEX "LojaIfood_ativa_proximoPolling_idx" ON "LojaIfood"("ativa","proximoPolling");
CREATE TABLE "EventoIfood" (
 "id" TEXT PRIMARY KEY, "lojaId" TEXT NOT NULL REFERENCES "LojaIfood"("id") ON DELETE RESTRICT,
 "externoId" TEXT NOT NULL, "pedidoExternoId" TEXT NOT NULL, "codigo" TEXT NOT NULL, "codigoCompleto" TEXT NOT NULL,
 "ocorridoEm" TIMESTAMP(3) NOT NULL, "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "metadataCifrada" TEXT NOT NULL, "ackEm" TIMESTAMP(3), "estado" TEXT NOT NULL DEFAULT 'PENDENTE',
 "tentativas" INTEGER NOT NULL DEFAULT 0, "proximaTentativa" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "erro" TEXT,
 UNIQUE ("lojaId","externoId")
);
CREATE INDEX "EventoIfood_estado_proximaTentativa_idx" ON "EventoIfood"("estado","proximaTentativa");
CREATE TABLE "PedidoIfood" (
 "id" TEXT PRIMARY KEY, "lojaId" TEXT NOT NULL REFERENCES "LojaIfood"("id") ON DELETE RESTRICT,
 "externoId" TEXT NOT NULL, "pedidoId" TEXT NOT NULL UNIQUE REFERENCES "PedidoVenda"("id") ON DELETE RESTRICT,
 "estadoRemoto" TEXT NOT NULL DEFAULT 'DESCONHECIDO', "ultimoEventoEm" TIMESTAMP(3),
 "modalidade" TEXT NOT NULL, "entregaPor" TEXT, "inicioPreparo" TIMESTAMP(3),
 "snapshotCifrado" TEXT NOT NULL, "pendencia" TEXT, "financeiroPendente" BOOLEAN NOT NULL DEFAULT true,
 "disputaId" TEXT, "disputaAte" TIMESTAMP(3), UNIQUE ("lojaId","externoId")
);
CREATE TABLE "AcaoIfood" (
 "id" TEXT PRIMARY KEY, "pedidoIfoodId" TEXT NOT NULL REFERENCES "PedidoIfood"("id") ON DELETE RESTRICT,
 "acao" TEXT NOT NULL, "revisao" INTEGER NOT NULL, "chave" TEXT NOT NULL UNIQUE, "hash" TEXT NOT NULL,
 "corpoCifrado" TEXT, "autorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT,
 "sessaoVersao" INTEGER NOT NULL, "estado" TEXT NOT NULL DEFAULT 'PENDENTE', "tentativas" INTEGER NOT NULL DEFAULT 0,
 "proximaTentativa" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "enviadaEm" TIMESTAMP(3), "erro" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("pedidoIfoodId","acao","revisao")
);
CREATE INDEX "AcaoIfood_estado_proximaTentativa_idx" ON "AcaoIfood"("estado","proximaTentativa");
