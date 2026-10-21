-- Campos separados preservam nomes compostos do contato sem reinterpretar cadastros antigos.
ALTER TABLE "ClienteVenda"
  ADD COLUMN "nomeContato" TEXT,
  ADD COLUMN "sobrenomeContato" TEXT;
