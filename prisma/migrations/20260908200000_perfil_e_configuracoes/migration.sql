-- Foto de perfil do usuário (mesmo padrão de Insumo.fotoData/fotoMimeType).
ALTER TABLE "Usuario" ADD COLUMN "fotoData" BYTEA;
ALTER TABLE "Usuario" ADD COLUMN "fotoMimeType" TEXT;

-- Configurações da Loja (linha única, id fixo "singleton").
CREATE TABLE "ConfiguracaoLoja" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "nome" TEXT,
    "cnpj" TEXT,
    "endereco" TEXT,
    "telefone" TEXT,
    "emailContato" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoLoja_pkey" PRIMARY KEY ("id")
);

-- Certificado digital A1 (.pfx) cifrado no banco — substitui a dependência do secret
-- do Docker nas chamadas à SEFAZ assim que o primeiro upload for feito.
CREATE TABLE "CertificadoDigital" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "arquivoNome" TEXT NOT NULL,
    "arquivoData" BYTEA NOT NULL,
    "senhaCifrada" TEXT NOT NULL,
    "titular" TEXT,
    "validoAte" TIMESTAMP(3),
    "atualizadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificadoDigital_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CertificadoDigital" ADD CONSTRAINT "CertificadoDigital_atualizadoPorId_fkey"
    FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
