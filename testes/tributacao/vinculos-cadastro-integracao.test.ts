import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import "dotenv/config";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { argumentosVinculos, executarVinculos, montarPlanoVinculos, prepararDestinoPrivado } from "../../scripts/estrutura-fiscal-vinculos.mjs";

const exec = promisify(execFile);
const raiz = path.resolve(".tmp/fiscal/teste-vinculos", randomUUID());
const backup = path.join(raiz, "backup-ficticio.json");
let banco: Client, schema = "", data: string, adminId: string;
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
async function produto(fiscal: Record<string, unknown> = {}, revisado = false, ativo = true, grupoFiscalId: string | null = null) {
  const id = randomUUID();
  await banco.query(`INSERT INTO "ProdutoVenda" (id,nome,fiscal,"fiscalRevisado",ativo,"grupoFiscalId",preco,"updatedAt") VALUES ($1,$2,$3::jsonb,$4,$5,$6,45.67,NOW())`, [id, `Produto fictício ${id}`, JSON.stringify(fiscal), revisado, ativo, grupoFiscalId]);
  return id;
}
async function classificacao(produtoId: string, extra: Record<string, unknown> = {}, versao = 1, vigencia = data, status = "ATIVO") {
  const id = randomUUID(), dados = { produtoId, grupo: "GF05", natureza: "REVENDA", tratamento: "NORMAL", ncm: "08061000", origem: "0", cest: null, unidade: "UN", estado: "CONFIRMADO", evidencias: ["Somente fixture"], pendencias: [], ...extra };
  await banco.query(`INSERT INTO "VersaoEstruturaFiscal" (id,tipo,chave,versao,"vigenciaInicio",status,dados,hash,justificativa,fontes,"criadoPorId","criadoPorNome","chaveOperacao","hashOperacao") VALUES ($1,'CLASSIFICACAO',$2,$3,$4::date,$5,$6::jsonb,$7,'Fixture fiscal sintética','[]'::jsonb,$8,'Autor fictício',$1,$7)`, [id, produtoId, versao, vigencia, status, JSON.stringify(dados), hash(dados), adminId]);
  return id;
}
async function fotografia(id: string) { return (await banco.query(`SELECT to_jsonb(p) AS produto FROM "ProdutoVenda" p WHERE id=$1`, [id])).rows[0].produto; }
async function fotografias(ids: string[]) { const r = []; for (const id of ids) r.push(await fotografia(id)); return r; }
async function previa() { return executarVinculos(banco, { aplicar: false, schema }); }
async function aplicar(hashPlano: string, usuarioId = adminId, arquivo = backup, ambiente: NodeJS.ProcessEnv = { ...process.env, VINCULOS_FISCAIS_APLICACAO_AUTORIZADA: "SIM" }) {
  return executarVinculos(banco, { aplicar: true, schema, "hash-plano": hashPlano, "usuario-id": usuarioId, "backup-comprovante": arquivo }, ambiente);
}

describe("Vínculos fiscais: contrato local sem dados reais", () => {
  it("rejeita argumentos inválidos e mantém dry-run como padrão", () => {
    expect(argumentosVinculos([])).toMatchObject({ aplicar: false, schema: "public" });
    for (const args of [["--aplicar", "--aplicar"], ["--schema=public;DROP"], ["--hash-plano=x"], ["--usuario-id=../usuario"], ["--flag-desconhecida"]]) expect(() => argumentosVinculos(args)).toThrow();
  });
  it("recusa exportação externa antes de conectar ou aplicar e não revela conexão privada", async () => {
    await expect(prepararDestinoPrivado(path.resolve("docs"))).rejects.toThrow(".tmp/fiscal");
    let erro: { stderr?: string } | undefined;
    try { await exec(process.execPath, ["scripts/estrutura-fiscal-vinculos.mjs", `--saida=${path.resolve("docs")}`], { env: { ...process.env, DATABASE_URL: "postgres://usuario:segredo-ficticio@host.invalid/base" }, timeout: 10000 }); }
    catch (e) { erro = e as { stderr?: string }; }
    expect(erro?.stderr).toContain(".tmp/fiscal");
    expect(erro?.stderr).not.toContain("segredo-ficticio"); expect(erro?.stderr).not.toContain("host.invalid");
  });
  it("plano detecta colisão por nome e ID dos grupos auxiliares sem modificá-los", () => {
    for (const g of [{ id: "grupo-alheio", codigo: null, nome: "Kit composto — organização fiscal" }, { id: "fiscal-aux-kit-composto", codigo: "GF01", nome: "Grupo existente" }]) {
      const antes = JSON.stringify(g); const plano = montarPlanoVinculos([], [], [g], "2026-10-12");
      expect(plano.conflitosGrupos).toHaveLength(1); expect(plano.gruposCriar.map((x: { codigo: string }) => x.codigo)).toEqual(["OPCAO_CONFIGURACAO"]); expect(JSON.stringify(g)).toBe(antes);
    }
  });
});

describe.skipIf(process.env.VINCULOS_FISCAIS_BANCO_TESTE !== "1")("Vínculos fiscais no PostgreSQL fictício isolado", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/teste_estrutura_fiscal") throw new Error("Somente PostgreSQL local teste_estrutura_fiscal.");
    banco = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 10000 }); await banco.connect();
    const host = (await banco.query("SELECT host(inet_server_addr()) AS host")).rows[0].host;
    if (!["127.0.0.1", "::1"].includes(host)) throw new Error("Servidor de teste não local.");
    await mkdir(raiz, { recursive: true });
    await writeFile(backup, JSON.stringify({ verificado: true, autorizacaoImplantacao: true, hashDump: "a".repeat(64), criadoEm: new Date().toISOString() }));
  });
  beforeEach(async () => {
    schema = `teste_vinculos_fiscais_${randomUUID().replaceAll("-", "")}`;
    await banco.query(`CREATE SCHEMA "${schema}"`);
    await banco.query(`SET search_path TO "${schema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) await banco.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    data = (await banco.query("SELECT (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date::text AS data")).rows[0].data;
    adminId = randomUUID();
    await banco.query(`INSERT INTO "Usuario" (id,nome,email,"senhaHash","perfilAcessoId","updatedAt") SELECT $1,'Administrador fictício',$2,'sem-login',id,NOW() FROM "PerfilAcesso" WHERE sistema='ADMINISTRADOR'`, [adminId, `${adminId}@example.invalid`]);
  }, 120000);
  afterEach(async () => { if (banco && /^teste_vinculos_fiscais_[a-f0-9]{32}$/.test(schema)) await banco.query(`DROP SCHEMA "${schema}" CASCADE`); schema = ""; });
  afterAll(async () => { await banco?.end(); });

  it("dry-run não escreve; aplicação preserva JSON desconhecido, preço, pedidos e fotografia fiscal", async () => {
    const id = await produto({ cfop: "5102", ean: "SEM GTIN", observacoes: "Nota anterior integral", legadoExtra: { valor: "não descartar" } });
    await banco.query(`UPDATE "ProdutoVenda" SET fiscal=fiscal || '{"legadoInteiro":9007199254740993,"legadoDecimal":1.1234567890123456789}'::jsonb WHERE id=$1`, [id]);
    const fonte = await classificacao(id);
    const pedido = randomUUID(), documento = randomUUID();
    await banco.query(`INSERT INTO "PedidoVenda" (id,"chaveCriacao","hashCriacao","criadoPorId","updatedAt",total) VALUES ($1,$1,'hash-ficticio',$2,NOW(),45.67)`, [pedido, adminId]);
    await banco.query(`INSERT INTO "DocumentoFiscalSaida" (id,"pedidoId","versaoPedido",payload,"hashPayload","criadoPorId","criadoPorNome","updatedAt") VALUES ($1,$2,1,'{"ncmHistorico":"19053100","total":"45.67"}'::jsonb,'hash-historico',$3,'Autor fictício',NOW())`, [documento, pedido, adminId]);
    const antes = await fotografia(id), fiscalAntes = (await banco.query(`SELECT to_jsonb(d) AS d FROM "DocumentoFiscalSaida" d WHERE id=$1`, [documento])).rows[0].d;
    const pedidoAntes = (await banco.query(`SELECT to_jsonb(p) AS p FROM "PedidoVenda" p WHERE id=$1`, [pedido])).rows[0].p;
    const p = await previa();
    expect(p.plano.resumo).toMatchObject({ alterar: 1, comGrupo: 1, ncmConfirmado: 1, gruposCriar: 2, conflitos: 0 });
    expect(await fotografia(id)).toEqual(antes); expect((await banco.query(`SELECT count(*)::int AS n FROM "GrupoFiscalVenda" WHERE codigo IN ('KIT_COMPOSTO','OPCAO_CONFIGURACAO')`)).rows[0].n).toBe(0);
    const r = await aplicar(p.plano.hashPlano); expect(r).toMatchObject({ alterados: 1, gruposCriados: 2 });
    const depois = await fotografia(id);
    expect(depois.fiscal).toMatchObject({ cfop: "5102", ean: "SEM GTIN", legadoExtra: { valor: "não descartar" }, ncm: "08061000" });
    expect(depois.fiscal.observacoes.startsWith("Nota anterior integral\n\n")).toBe(true); expect(depois.fiscal.observacoes).toContain(fonte); expect(depois.fiscalRevisado).toBe(false);
    expect((await banco.query(`SELECT fiscal->>'legadoInteiro' AS inteiro,fiscal->>'legadoDecimal' AS decimal FROM "ProdutoVenda" WHERE id=$1`, [id])).rows[0]).toEqual({ inteiro: "9007199254740993", decimal: "1.1234567890123456789" });
    const retirarMutaveis = (p: Record<string, unknown>) => Object.fromEntries(Object.entries(p).filter(([k]) => !["fiscal", "grupoFiscalId", "versao", "updatedAt"].includes(k)));
    expect(retirarMutaveis(depois)).toEqual(retirarMutaveis(antes)); expect(depois.versao).toBe(antes.versao + 1);
    expect((await banco.query(`SELECT to_jsonb(d) AS d FROM "DocumentoFiscalSaida" d WHERE id=$1`, [documento])).rows[0].d).toEqual(fiscalAntes);
    expect((await banco.query(`SELECT to_jsonb(p) AS p FROM "PedidoVenda" p WHERE id=$1`, [pedido])).rows[0].p).toEqual(pedidoAntes);
    const auditoria = (await banco.query(`SELECT * FROM "HistoricoCadastroVenda" WHERE entidade='FISCAL' AND "registroId"=$1`, [id])).rows;
    expect(auditoria).toHaveLength(1); expect(auditoria[0]).toMatchObject({ usuarioId: adminId, usuarioNome: "Administrador fictício" });
    expect(auditoria[0].depois.sincronizacaoEstruturaFiscal.versaoId).toBe(fonte);
    expect((await banco.query(`SELECT antes#>>'{fiscal,legadoInteiro}' AS "antesInteiro",depois#>>'{fiscal,legadoInteiro}' AS "depoisInteiro",antes#>>'{fiscal,legadoDecimal}' AS "antesDecimal",depois#>>'{fiscal,legadoDecimal}' AS "depoisDecimal" FROM "HistoricoCadastroVenda" WHERE entidade='FISCAL' AND "registroId"=$1`, [id])).rows[0]).toEqual({ antesInteiro: "9007199254740993", depoisInteiro: "9007199254740993", antesDecimal: "1.1234567890123456789", depoisDecimal: "1.1234567890123456789" });
    expect((await banco.query(`SELECT count(*)::int AS n FROM "AtividadeUsuario" WHERE "fonteTabela"='HistoricoCadastroVenda' AND "autorId"=$1 AND recurso='vendas.fiscal'`, [adminId])).rows[0].n).toBe(3);
    const repeticao = await aplicar(p.plano.hashPlano); expect(repeticao).toMatchObject({ aplicadoAnteriormente: true, alterados: 0, gruposCriados: 0 });
    expect(await fotografia(id)).toEqual(depois); expect((await previa()).plano.resumo.alterar).toBe(0);
  });
  it("NCM candidato fica só em observação; kit recebe auxiliar e opções preservam grupo com aviso", async () => {
    const pendente = await produto(), kit = await produto(), opcao = await produto(), kitConfirmado = await produto(), kitLegado = await produto({ ncm: "22042100" });
    await classificacao(pendente, { estado: "PENDENTE", pendencias: ["Receita final não comprovada"], ncm: "19059090" });
    await classificacao(kit, { grupo: null, tratamento: "KIT_COMPOSTO", estado: "PENDENTE", ncm: null, pendencias: ["Classificar componentes"], componentesKit: [] });
    await classificacao(opcao, { tratamento: "OPCAO_CONFIGURACAO" });
    for (const id of [kitConfirmado, kitLegado]) await classificacao(id, { grupo: "GF06", tratamento: "KIT_COMPOSTO", ncm: "19059090", componentesKit: [{ produtoId: pendente, quantidade: "1", pesoRateio: "1" }] });
    const p = await previa(); expect(p.plano.resumo).toMatchObject({ alterar: 5, comGrupo: 5, ncmConfirmado: 1, ncmCandidato: 1 });
    await aplicar(p.plano.hashPlano);
    const a = await fotografia(pendente), b = await fotografia(kit), c = await fotografia(opcao);
    expect(a.fiscal.ncm).toBeUndefined(); expect(a.fiscal.observacoes).toContain("NCM de entrada candidato 19059090; sem confirmação para produto final"); expect(a.fiscal.observacoes).toContain("Receita final não comprovada");
    expect(b.grupoFiscalId).toBe("fiscal-aux-kit-composto"); expect(b.fiscal.ncm).toBeUndefined(); expect(b.fiscal.observacoes).toContain("não atribuir NCM genérico");
    expect(c.fiscal.ncm).toBe("08061000"); expect(c.grupoFiscalId).not.toBe("fiscal-aux-opcao-configuracao"); expect(c.fiscal.observacoes).toContain("não produz linha fiscal independente");
    const d = await fotografia(kitConfirmado), e = await fotografia(kitLegado);
    expect(d.fiscal.ncm).toBeUndefined(); expect(d.fiscal.observacoes).toContain("NCM 19059090 declarado na referência não projetado ao conjunto");
    expect(e.fiscal.ncm).toBe("22042100"); expect(e.fiscal.observacoes).toContain("discriminar os componentes na emissão");
    expect((await banco.query(`SELECT codigo FROM "GrupoFiscalVenda" WHERE id=$1`, [d.grupoFiscalId])).rows[0].codigo).toBe("GF06");
    expect((await banco.query(`SELECT fiscal FROM "GrupoFiscalVenda" WHERE codigo IN ('KIT_COMPOSTO','OPCAO_CONFIGURACAO')`)).rows.map(g => g.fiscal)).toEqual([{}, {}]);
  });
  it("resolve somente a última classificação ATIVA vigente e deixa produtos inativos intocados", async () => {
    const id = await produto(), inativo = await produto({}, false, false);
    await classificacao(id, { ncm: "19053100" }, 1, "2020-01-01"); const atual = await classificacao(id, { ncm: "08061000" }, 2);
    await classificacao(id, { ncm: "22042100" }, 3, "2999-01-01"); await classificacao(id, { ncm: "22030000" }, 4, data, "RASCUNHO"); await classificacao(inativo);
    const antesInativo = await fotografia(inativo), p = await previa();
    expect(p.plano.linhas).toHaveLength(1); expect(p.plano.linhas[0].fonte?.id).toBe(atual);
    await aplicar(p.plano.hashPlano); expect((await fotografia(id)).fiscal.ncm).toBe("08061000"); expect(await fotografia(inativo)).toEqual(antesInativo);
  });
  it("conflitos de NCM, grupo, revisão e limite de notas não sobrescrevem nenhuma linha protegida", async () => {
    const grupo = (await banco.query(`SELECT id FROM "GrupoFiscalVenda" WHERE codigo='GF01'`)).rows[0].id;
    const ids = [await produto({ ncm: "22042100" }), await produto({}, false, true, grupo), await produto({}, true), await produto({ observacoes: "x".repeat(1999) })];
    for (const id of ids) await classificacao(id);
    const antes = await fotografias(ids), p = await previa(); expect(p.plano.resumo).toMatchObject({ alterar: 0, conflitos: 4 });
    await aplicar(p.plano.hashPlano); expect(await fotografias(ids)).toEqual(antes);
    expect((await banco.query(`SELECT count(*)::int AS n FROM "HistoricoCadastroVenda" WHERE entidade='FISCAL'`)).rows[0].n).toBe(0);
  });
  it("exige autorização, administrador ativo, backup válido, data atual e plano reconferido", async () => {
    const id = await produto(); await classificacao(id); const p = await previa(), antes = await fotografia(id);
    await expect(aplicar(p.plano.hashPlano, adminId, backup, { NODE_ENV: "test" })).rejects.toThrow("autorização explícita");
    const inativo = randomUUID(); await banco.query(`INSERT INTO "Usuario" (id,nome,email,"senhaHash","perfilAcessoId",ativo,"updatedAt") SELECT $1,'Admin inativo fictício',$2,'sem-login',id,false,NOW() FROM "PerfilAcesso" WHERE sistema='ADMINISTRADOR'`, [inativo, `${inativo}@example.invalid`]);
    await expect(aplicar(p.plano.hashPlano, inativo)).rejects.toThrow("Administrador vigente"); await expect(aplicar("f".repeat(64))).rejects.toThrow("Plano mudou");
    const leitor = randomUUID(); await banco.query(`INSERT INTO "Usuario" (id,nome,email,"senhaHash","updatedAt") VALUES ($1,'Leitor fictício',$2,'sem-login',NOW())`, [leitor, `${leitor}@example.invalid`]);
    await expect(aplicar(p.plano.hashPlano, leitor)).rejects.toThrow("Administrador vigente");
    const vencido = path.join(raiz, "backup-vencido.json"); await writeFile(vencido, JSON.stringify({ verificado: true, autorizacaoImplantacao: true, hashDump: "b".repeat(64), criadoEm: "2000-01-01" }));
    await expect(aplicar(p.plano.hashPlano, adminId, vencido)).rejects.toThrow("vencido");
    await expect(executarVinculos(banco, { aplicar: false, schema, data: "2020-01-01" })).rejects.toThrow("dia atual");
    expect(await fotografia(id)).toEqual(antes); expect((await banco.query(`SELECT count(*)::int AS n FROM "HistoricoCadastroVenda"`)).rows[0].n).toBe(0);
    await banco.query(`UPDATE "ProdutoVenda" SET versao=versao+1 WHERE id=$1`, [id]); await expect(aplicar(p.plano.hashPlano)).rejects.toThrow("Plano mudou");
  });
  it("falha de auditoria reverte auxiliares, vínculos e todas as alterações anteriores do lote", async () => {
    const a = await produto(), b = await produto(); await classificacao(a); await classificacao(b);
    const antes = await fotografias([a, b]), p = await previa();
    await banco.query(`CREATE FUNCTION falhar_fiscal_teste() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entidade='FISCAL' THEN RAISE EXCEPTION 'falha somente fictícia'; END IF; RETURN NEW; END $$`);
    await banco.query(`CREATE TRIGGER falhar_fiscal_teste BEFORE INSERT ON "HistoricoCadastroVenda" FOR EACH ROW EXECUTE FUNCTION falhar_fiscal_teste()`);
    await expect(aplicar(p.plano.hashPlano)).rejects.toThrow("falha somente fictícia");
    expect(await fotografias([a, b])).toEqual(antes);
    expect((await banco.query(`SELECT count(*)::int AS n FROM "GrupoFiscalVenda" WHERE codigo IN ('KIT_COMPOSTO','OPCAO_CONFIGURACAO')`)).rows[0].n).toBe(0);
    expect((await banco.query(`SELECT count(*)::int AS n FROM "HistoricoCadastroVenda"`)).rows[0].n).toBe(0);
    expect((await banco.query(`SELECT count(*)::int AS n FROM "AtividadeUsuario" WHERE "fonteTabela"='HistoricoCadastroVenda'`)).rows[0].n).toBe(0);
  });
  it("não declara replay bem-sucedido após revisão manual", async () => {
    const id = await produto(); await classificacao(id); const p = await previa(); await aplicar(p.plano.hashPlano);
    await banco.query(`UPDATE "ProdutoVenda" SET "fiscalRevisado"=true,versao=versao+1 WHERE id=$1`, [id]);
    await expect(aplicar(p.plano.hashPlano)).rejects.toThrow("Plano mudou");
    expect((await fotografia(id)).fiscalRevisado).toBe(true);
  });
  it("hash e replay detectam mudança de número JSONB não representável mesmo sem incremento de versão", async () => {
    const id = await produto(); await classificacao(id);
    await banco.query(`UPDATE "ProdutoVenda" SET fiscal='{"legadoInteiro":9007199254740993}'::jsonb WHERE id=$1`, [id]);
    const p = await previa();
    await banco.query(`UPDATE "ProdutoVenda" SET fiscal=jsonb_set(fiscal,'{legadoInteiro}','9007199254740992'::jsonb) WHERE id=$1`, [id]);
    const novo = await previa(); expect(novo.plano.hashPlano).not.toBe(p.plano.hashPlano);
    await expect(aplicar(p.plano.hashPlano)).rejects.toThrow("Plano mudou");
    await aplicar(novo.plano.hashPlano);
    await banco.query(`UPDATE "ProdutoVenda" SET fiscal=jsonb_set(fiscal,'{legadoInteiro}','9007199254740993'::jsonb) WHERE id=$1`, [id]);
    await expect(aplicar(novo.plano.hashPlano)).rejects.toThrow("Plano mudou");
    expect((await banco.query(`SELECT fiscal->>'legadoInteiro' AS inteiro FROM "ProdutoVenda" WHERE id=$1`, [id])).rows[0].inteiro).toBe("9007199254740993");
  });
  it("CLI real imprime só resumo e escreve plano privado; dados sintéticos não saem no stdout", async () => {
    const id = await produto({ observacoes: "Observação privada fictícia" }); await classificacao(id);
    const saida = path.join(raiz, "cli");
    const r = await exec(process.execPath, ["scripts/estrutura-fiscal-vinculos.mjs", `--schema=${schema}`, `--saida=${saida}`], { env: { ...process.env, VINCULOS_FISCAIS_APLICACAO_AUTORIZADA: "" }, timeout: 10000 });
    const resumo = JSON.parse(r.stdout); expect(resumo).toMatchObject({ modo: "DRY_RUN", alterar: 1, comGrupo: 1, documentosTransmitidos: 0 });
    expect(r.stdout).not.toContain(id); expect(r.stdout).not.toContain("Observação privada");
    const plano = JSON.parse(await readFile(path.join(saida, `plano-${resumo.hashPlano}.json`), "utf8")); expect(plano.linhas[0].produtoId).toBe(id); expect(await fotografia(id)).toMatchObject({ versao: 1, grupoFiscalId: null });
  });
  it("artefato de plano divergente interrompe CLI antes de qualquer alteração no banco", async () => {
    const id = await produto(); await classificacao(id); const p = await previa(), antes = await fotografia(id), saida = path.join(raiz, "plano-divergente");
    await mkdir(saida, { recursive: true }); await writeFile(path.join(saida, `plano-${p.plano.hashPlano}.json`), "{}", { mode: 0o600 });
    await expect(exec(process.execPath, ["scripts/estrutura-fiscal-vinculos.mjs", `--schema=${schema}`, `--saida=${saida}`, "--aplicar", `--hash-plano=${p.plano.hashPlano}`, `--usuario-id=${adminId}`, `--backup-comprovante=${backup}`], { env: { ...process.env, VINCULOS_FISCAIS_APLICACAO_AUTORIZADA: "SIM" }, timeout: 10000 })).rejects.toThrow("Artefato privado existente diverge");
    expect(await fotografia(id)).toEqual(antes); expect((await banco.query(`SELECT count(*)::int AS n FROM "HistoricoCadastroVenda"`)).rows[0].n).toBe(0);
    expect((await banco.query(`SELECT count(*)::int AS n FROM "GrupoFiscalVenda" WHERE codigo IN ('KIT_COMPOSTO','OPCAO_CONFIGURACAO')`)).rows[0].n).toBe(0);
  });
  it("falha do arquivo de recibo após commit informa a aplicação confirmada na auditoria", async () => {
    const id = await produto(); await classificacao(id); const p = await previa(), saida = path.join(raiz, "recibo-divergente");
    await mkdir(saida, { recursive: true }); await writeFile(path.join(saida, `recibo-${p.plano.hashPlano}.json`), "{}", { mode: 0o600 });
    let falha: { stdout: string; stderr: string } | undefined;
    try { await exec(process.execPath, ["scripts/estrutura-fiscal-vinculos.mjs", `--schema=${schema}`, `--saida=${saida}`, "--aplicar", `--hash-plano=${p.plano.hashPlano}`, `--usuario-id=${adminId}`, `--backup-comprovante=${backup}`], { env: { ...process.env, VINCULOS_FISCAIS_APLICACAO_AUTORIZADA: "SIM" }, timeout: 10000 }); }
    catch (e) { falha = e as { stdout: string; stderr: string }; }
    expect(falha?.stderr).toContain("Aplicação confirmada na auditoria"); expect(JSON.parse(falha!.stdout)).toMatchObject({ aplicado: true, alterados: 1, reciboArquivoGravado: false });
    expect((await fotografia(id)).fiscal.ncm).toBe("08061000"); expect((await banco.query(`SELECT count(*)::int AS n FROM "HistoricoCadastroVenda" WHERE entidade='FISCAL'`)).rows[0].n).toBe(1);
    expect(await aplicar(p.plano.hashPlano)).toMatchObject({ aplicadoAnteriormente: true, alterados: 0 });
  });
});
