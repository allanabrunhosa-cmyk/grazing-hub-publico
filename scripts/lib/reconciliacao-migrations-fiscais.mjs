/** Reconciliador de duas branches com uma adição SQL equivalente.
 * Não altera os arquivos/checksums históricos. Não ignora erros de migrations.
 * A transformação exige a instrução conhecida e confere tipo/nullability.
 */
export function prepararSqlMigrationFiscal(nome, sql) {
  const antiga = nome === '20261011100000_brasilnfe_preparacao_operacional';
  if (!antiga && nome !== '20261011220000_estrutura_fiscal_versionada') return sql;
  const instrucao = antiga ? ' ADD COLUMN "protocoloCancelamento" TEXT,' : 'ALTER TABLE "DocumentoFiscalSaida" ADD COLUMN "protocoloCancelamento" TEXT;';
  if (sql.split(instrucao).length !== 2) throw new Error('Migration fiscal fora da revisão SQL conhecida.');
  const guarda = `DO $reconciliacao_fiscal$
DECLARE coluna RECORD;
BEGIN
  SELECT a.atttypid, a.attnotnull, a.attgenerated, a.attidentity,
         pg_get_expr(d.adbin,d.adrelid) AS padrao INTO coluna FROM pg_attribute a
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid = '"DocumentoFiscalSaida"'::regclass
      AND a.attname = 'protocoloCancelamento' AND NOT a.attisdropped;
  IF NOT FOUND THEN
    ALTER TABLE "DocumentoFiscalSaida" ADD COLUMN "protocoloCancelamento" TEXT;
  ELSIF coluna.atttypid <> 'text'::regtype OR coluna.attnotnull
     OR coluna.attgenerated <> '' OR coluna.attidentity <> ''
     OR coluna.padrao IS NOT NULL AND coluna.padrao NOT IN ('NULL', 'NULL::text') THEN
    RAISE EXCEPTION 'Protocolo de cancelamento: coluna histórica não equivalente';
  END IF;
END $reconciliacao_fiscal$;`;
  return antiga ? guarda + '\n' + sql.replace(instrucao, '') : sql.replace(instrucao, guarda);
}
