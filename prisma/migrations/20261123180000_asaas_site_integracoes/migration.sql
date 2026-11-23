-- Aditiva: integrações Asaas (cobrança do pedido) e Site/WooCommerce (recepção de pedidos).
-- Nenhuma tabela existente é alterada; nada é ativado sem as chaves do servidor.
CREATE TABLE "CobrancaAsaas" (
 "id" TEXT PRIMARY KEY,
 "ambiente" TEXT NOT NULL CHECK ("ambiente" IN ('SANDBOX','PRODUCAO')),
 "pedidoId" TEXT NOT NULL REFERENCES "PedidoVenda"("id") ON DELETE RESTRICT,
 "origem" TEXT NOT NULL DEFAULT 'HUB' CHECK ("origem" IN ('HUB','SITE')),
 "forma" TEXT NOT NULL CHECK ("forma" IN ('PIX','BOLETO','CARTAO_CREDITO','INDEFINIDA')),
 "valor" DECIMAL(14,2) NOT NULL CHECK ("valor" > 0),
 "vencimento" DATE NOT NULL,
 "estado" TEXT NOT NULL DEFAULT 'ENVIANDO' CHECK ("estado" IN ('ENVIANDO','ATIVA','INCERTA','FALHOU')),
 "situacao" TEXT NOT NULL DEFAULT 'AGUARDANDO' CHECK ("situacao" IN ('AGUARDANDO','PAGA','VENCIDA','ESTORNADA','CONTESTADA','REMOVIDA')),
 "statusRemoto" TEXT, "asaasId" TEXT, "clienteAsaasId" TEXT,
 "linkPagamento" TEXT, "linkBoleto" TEXT,
 "valorLiquido" DECIMAL(14,2), "pagoEm" TIMESTAMP(3), "creditoPrevisto" DATE,
 "ultimoEventoEm" TIMESTAMP(3), "erro" TEXT,
 "chaveOperacao" TEXT NOT NULL UNIQUE, "hashOperacao" TEXT NOT NULL,
 "criadoPorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "CobrancaAsaas_ambiente_asaasId_key" ON "CobrancaAsaas"("ambiente","asaasId");
CREATE INDEX "CobrancaAsaas_pedidoId_estado_idx" ON "CobrancaAsaas"("pedidoId","estado");
-- Uma única cobrança em aberto por pedido criada pelo HUB: cliques concorrentes não cobram duas vezes.
CREATE UNIQUE INDEX "CobrancaAsaas_aberta_por_pedido" ON "CobrancaAsaas"("pedidoId")
 WHERE "origem" = 'HUB' AND ("estado" IN ('ENVIANDO','INCERTA') OR ("estado" = 'ATIVA' AND "situacao" IN ('AGUARDANDO','VENCIDA')));

CREATE TABLE "EventoAsaas" (
 "id" TEXT PRIMARY KEY,
 "ambiente" TEXT NOT NULL CHECK ("ambiente" IN ('SANDBOX','PRODUCAO')),
 "externoId" TEXT NOT NULL, "tipo" TEXT NOT NULL, "pagamentoId" TEXT,
 "ocorridoEm" TIMESTAMP(3), "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "payloadCifrado" TEXT NOT NULL,
 "estado" TEXT NOT NULL DEFAULT 'PENDENTE' CHECK ("estado" IN ('PENDENTE','PROCESSADO','IGNORADO','SEM_VINCULO','FALHOU')),
 "tentativas" INTEGER NOT NULL DEFAULT 0,
 "proximaTentativa" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "erro" TEXT
);
CREATE UNIQUE INDEX "EventoAsaas_ambiente_externoId_key" ON "EventoAsaas"("ambiente","externoId");
CREATE INDEX "EventoAsaas_estado_proximaTentativa_idx" ON "EventoAsaas"("estado","proximaTentativa");
CREATE INDEX "EventoAsaas_pagamentoId_idx" ON "EventoAsaas"("pagamentoId");

CREATE TABLE "IntegracaoSite" (
 "id" TEXT PRIMARY KEY, "contaId" TEXT NOT NULL DEFAULT 'singleton',
 "loja" TEXT NOT NULL,
 "canalId" TEXT NOT NULL REFERENCES "CanalVenda"("id") ON DELETE RESTRICT,
 "ativa" BOOLEAN NOT NULL DEFAULT false, "cursor" TIMESTAMP(3),
 "proximaColeta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "leaseToken" TEXT, "leaseAte" TIMESTAMP(3), "ultimaColeta" TIMESTAMP(3),
 "ultimoRecebimento" TIMESTAMP(3), "ultimoErro" TEXT,
 "criadoPorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "IntegracaoSite_conta" CHECK ("contaId" = 'singleton')
);
CREATE UNIQUE INDEX "IntegracaoSite_contaId_key" ON "IntegracaoSite"("contaId");

CREATE TABLE "EventoSite" (
 "id" TEXT PRIMARY KEY,
 "integracaoId" TEXT NOT NULL REFERENCES "IntegracaoSite"("id") ON DELETE RESTRICT,
 "chave" TEXT NOT NULL, "pedidoExternoId" TEXT NOT NULL, "topico" TEXT NOT NULL,
 "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "estado" TEXT NOT NULL DEFAULT 'PENDENTE' CHECK ("estado" IN ('PENDENTE','PROCESSADO','IGNORADO','FALHOU')),
 "tentativas" INTEGER NOT NULL DEFAULT 0,
 "proximaTentativa" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "erro" TEXT
);
CREATE UNIQUE INDEX "EventoSite_integracaoId_chave_key" ON "EventoSite"("integracaoId","chave");
CREATE INDEX "EventoSite_estado_proximaTentativa_idx" ON "EventoSite"("estado","proximaTentativa");

CREATE TABLE "PedidoSite" (
 "id" TEXT PRIMARY KEY,
 "integracaoId" TEXT NOT NULL REFERENCES "IntegracaoSite"("id") ON DELETE RESTRICT,
 "externoId" TEXT NOT NULL, "numeroExterno" TEXT NOT NULL,
 "pedidoId" TEXT NOT NULL REFERENCES "PedidoVenda"("id") ON DELETE RESTRICT,
 "statusRemoto" TEXT NOT NULL, "modificadoEm" TIMESTAMP(3),
 "snapshotCifrado" TEXT NOT NULL, "hashSnapshot" TEXT NOT NULL,
 "pendencia" TEXT, "asaasPagamentoId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "PedidoSite_pedidoId_key" ON "PedidoSite"("pedidoId");
CREATE UNIQUE INDEX "PedidoSite_integracaoId_externoId_key" ON "PedidoSite"("integracaoId","externoId");
CREATE INDEX "PedidoSite_asaasPagamentoId_idx" ON "PedidoSite"("asaasPagamentoId");
