-- Não altera códigos, ZPL, snapshots ou contagens dos trabalhos já existentes.
-- nextval é atômico entre sessões e não reutiliza números após rollback.
-- Seis dígitos em base 36; esgotamento falha em vez de repetir um código.
CREATE SEQUENCE "SequenciaCodigoEtiqueta" AS BIGINT
  MINVALUE 1 MAXVALUE 2176782335 START WITH 1 NO CYCLE;
