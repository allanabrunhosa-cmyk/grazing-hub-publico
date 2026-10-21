import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hashSha256, type ManifestoFotos } from "@/lib/insumos/lote-fotos";

const ativado = process.env.FOTOS_INSUMOS_BANCO_TESTE === "1";
const executarArquivo = promisify(execFile);
const raizProjeto = fileURLToPath(new URL("../../", import.meta.url));
const imagem = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrCsAAAAASUVORK5CYII=", "base64");
const fotoAnterior = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQEBAHcY42YAAAAASUVORK5CYII=", "base64");

describe.skipIf(!ativado)("CLI de fotos em PostgreSQL descartável", () => {
  let pool: Pool;
  let bancoTeste: URL;
  let schema: string;
  let pasta: string;
  let manifesto: ManifestoFotos;
  let arquivoManifesto: string;
  let auditoriaDir: string;

  beforeAll(() => {
    const conexao = process.env.FOTOS_INSUMOS_DATABASE_URL;
    if (!conexao) throw new Error("Informe a URL exclusiva do PostgreSQL descartável de fotos.");
    bancoTeste = new URL(conexao);
    if (!["postgres:", "postgresql:"].includes(bancoTeste.protocol)
      || !["localhost", "127.0.0.1", "::1", "[::1]", "pg-insumos-fotos-validacao-20261002"].includes(bancoTeste.hostname)
      || bancoTeste.pathname !== "/insumos_fotos_teste") throw new Error("Integração de fotos exige host local/descartável e database insumos_fotos_teste.");
    if (bancoTeste.searchParams.has("options")) throw new Error("A URL de teste não pode fornecer schema ou opções adicionais.");
    pool = new Pool({ connectionString: bancoTeste.toString(), max: 1, connectionTimeoutMillis: 10000 });
  });

  beforeEach(async () => {
    schema = `fotos_teste_${randomBytes(8).toString("hex")}`;
    pasta = await fs.mkdtemp(path.join(os.tmpdir(), "insumos-fotos-teste-"));
    auditoriaDir = path.join(pasta, "auditoria");
    await fs.mkdir(auditoriaDir, { mode: 0o700 });
    await fs.mkdir(path.join(pasta, "imagens"), { mode: 0o700 });
    await fs.writeFile(path.join(pasta, "imagens", "foto.png"), imagem, { mode: 0o600 });
    await pool.query(`CREATE SCHEMA "${schema}"`);
    await pool.query(`CREATE TABLE "${schema}"."Insumo" (
      "id" text PRIMARY KEY, "nome" text NOT NULL, "especificacao" text, "tipo" text NOT NULL,
      "fotoData" bytea, "fotoMimeType" text, "updatedAt" timestamp NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT '2026-01-01 12:00:00',
      "unidade" text NOT NULL DEFAULT 'KG', "ativo" boolean NOT NULL DEFAULT true,
      "categoriaId" text DEFAULT 'categoria-ficticia', "categoriaFinanceiraId" text DEFAULT 'financeira-ficticia',
      "custoMedio" numeric(12,4) NOT NULL DEFAULT 12.3456, "estoqueMinimo" numeric(12,3) NOT NULL DEFAULT 1.234,
      "fornecedorPrincipalId" text DEFAULT 'fornecedor-ficticio', "marcasHomologadas" text[] DEFAULT ARRAY['Marca fictícia'],
      "observacoes" text DEFAULT 'Observação fictícia preservada', "modoPreparo" jsonb NOT NULL DEFAULT '[]'
    )`);
    await pool.query(`INSERT INTO "${schema}"."Insumo" ("id","nome","especificacao","tipo","fotoData","fotoMimeType","updatedAt")
      VALUES ('insumo-a','Ingrediente fictício A',NULL,'INSUMO',NULL,NULL,'2026-10-02 10:00:00.123456'),
      ('insumo-b','Ingrediente fictício B','Especificação fictícia','INSUMO',$1,'image/png','2026-10-02 10:00:00.654321'),
      ('preparacao','Preparação fictícia',NULL,'PRODUTO_INTERMEDIARIO',NULL,NULL,'2026-10-02 10:00:00')`, [fotoAnterior]);
    await pool.query(`CREATE TABLE "${schema}"."VinculoFicticio" ("insumoId" text, "fornecedorId" text)`);
    await pool.query(`INSERT INTO "${schema}"."VinculoFicticio" VALUES ('insumo-a','fornecedor-a'),('insumo-b','fornecedor-b')`);
    const linhas = await pool.query<{ id: string; nome: string; especificacao: string | null; updatedAt: string; fotoHashMd5: string | null }>(`
      SELECT "id","nome","especificacao",to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt",
        md5(encode("fotoData",'hex')) AS "fotoHashMd5" FROM "${schema}"."Insumo" WHERE "tipo"='INSUMO' ORDER BY "id"
    `);
    manifesto = {
      versao: 1, loteId: `fotos-ficticias-${randomBytes(5).toString("hex")}`,
      autorizacaoOperacional: "Autorização fictícia da suíte isolada para aplicar fotos sintéticas.",
      itens: linhas.rows.map(linha => ({ ...linha, foto: {
        arquivo: "imagens/foto.png", sha256: hashSha256(imagem), mimeType: "image/png",
        origem: { tipo: "gerada", prompt: "Foto sintética genérica sem marca para teste isolado." },
      } })),
    };
    arquivoManifesto = path.join(pasta, "manifesto.json");
    await salvarManifesto();
  });

  afterEach(async () => {
    if (pool && schema && /^fotos_teste_[a-f0-9]{16}$/.test(schema)) await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    if (pasta && path.dirname(pasta) === os.tmpdir() && path.basename(pasta).startsWith("insumos-fotos-teste-")) await fs.rm(pasta, { recursive: true, force: true });
  });
  afterAll(async () => { if (pool) await pool.end(); });

  async function salvarManifesto() { await fs.writeFile(arquivoManifesto, `${JSON.stringify(manifesto, null, 2)}\n`, { mode: 0o600 }); }
  function arquivoAuditoria(nome: string) { return path.join(auditoriaDir, manifesto.loteId, nome); }
  async function linhas() { return (await pool.query(`SELECT *,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "versaoFoto" FROM "${schema}"."Insumo" ORDER BY "id"`)).rows; }
  function semFoto(linha: Record<string, unknown>) {
    const { fotoData: _bytes, fotoMimeType: _mime, updatedAt: _updatedAt, versaoFoto: _versao, ...outros } = linha;
    void _bytes; void _mime; void _updatedAt; void _versao;
    return outros;
  }
  async function cli(modo?: "--aplicar" | "--reverter") {
    const url = new URL(bancoTeste.toString());
    url.searchParams.set("options", `-c search_path=${schema}`);
    const args = [path.join(raizProjeto, "node_modules", "tsx", "dist", "cli.mjs"), path.join(raizProjeto, "scripts", "aplicar-fotos-insumos.ts"),
      `--manifesto=${arquivoManifesto}`, `--auditoria-dir=${auditoriaDir}`, `--quantidade-esperada=${manifesto.itens.length}`, ...(modo ? [modo] : [])];
    const resposta = await executarArquivo(process.execPath, args, {
      cwd: raizProjeto, timeout: 30000, maxBuffer: 200000,
      env: { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", NODE_ENV: "test", DATABASE_URL: url.toString() },
    });
    return JSON.parse(resposta.stdout.trim()) as { modo: string; alteradas: number; inalteradas: number };
  }
  async function falha(modo: "--aplicar" | "--reverter", mensagem: RegExp) {
    await expect(cli(modo)).rejects.toMatchObject({ stderr: expect.stringMatching(mensagem) });
  }

  it("conferência não grava fotos nem arquivos de auditoria", async () => {
    const antes = await linhas();
    expect(await cli()).toMatchObject({ modo: "conferir", alteradas: 2 });
    expect(await linhas()).toEqual(antes);
    await expect(fs.access(arquivoAuditoria("snapshot.json"))).rejects.toMatchObject({ code: "ENOENT" });
  }, 40000);

  it("aplica, repete sem escrita e reverte preservando outros campos e vínculos", async () => {
    const antes = await linhas();
    const vinculos = (await pool.query(`SELECT * FROM "${schema}"."VinculoFicticio" ORDER BY "insumoId"`)).rows;
    expect(await cli("--aplicar")).toMatchObject({ alteradas: 2, inalteradas: 0 });
    const aplicadas = await linhas();
    expect(aplicadas.map(semFoto)).toEqual(antes.map(semFoto));
    expect(aplicadas[0].fotoData).toEqual(imagem);
    expect(aplicadas[1].fotoData).toEqual(imagem);
    expect(aplicadas[2]).toEqual(antes[2]);
    const snapshot = await fs.readFile(arquivoAuditoria("snapshot.json"));
    const recibo = JSON.parse(await fs.readFile(arquivoAuditoria("recibo.json"), "utf8"));
    expect(recibo).toMatchObject({ estado: "aplicado", snapshotSha256: hashSha256(snapshot) });
    if (process.platform !== "win32") {
      expect((await fs.stat(path.dirname(arquivoAuditoria("snapshot.json")))).mode & 0o077).toBe(0);
      for (const nome of ["snapshot.json", "recibo.json"]) expect((await fs.stat(arquivoAuditoria(nome))).mode & 0o077).toBe(0);
    }
    expect(await cli("--aplicar")).toMatchObject({ alteradas: 0, inalteradas: 2 });
    expect(await linhas()).toEqual(aplicadas);
    expect(await fs.readFile(arquivoAuditoria("snapshot.json"))).toEqual(snapshot);
    expect(await cli("--reverter")).toMatchObject({ alteradas: 2, inalteradas: 0 });
    const revertidas = await linhas();
    expect(revertidas.map(semFoto)).toEqual(antes.map(semFoto));
    expect(revertidas.map(linha => [linha.fotoData, linha.fotoMimeType])).toEqual(antes.map(linha => [linha.fotoData, linha.fotoMimeType]));
    expect(revertidas[0].versaoFoto).not.toBe(antes[0].versaoFoto);
    expect(revertidas[0].versaoFoto).not.toBe(aplicadas[0].versaoFoto);
    expect(await cli("--reverter")).toMatchObject({ alteradas: 0, inalteradas: 2 });
    expect(await linhas()).toEqual(revertidas);
    expect((await pool.query(`SELECT * FROM "${schema}"."VinculoFicticio" ORDER BY "insumoId"`)).rows).toEqual(vinculos);
  }, 40000);

  it("recusa reverter após edição posterior e conserva todas as fotos", async () => {
    await cli("--aplicar");
    await pool.query(`UPDATE "${schema}"."Insumo" SET "nome"='Ingrediente editado depois', "updatedAt"="updatedAt" + interval '1 microsecond' WHERE "id"='insumo-b'`);
    const antes = await linhas();
    await falha("--reverter", /alterado.*reversão bloqueada/);
    expect(await linhas()).toEqual(antes);
  }, 40000);

  it("preparação em um único ID bloqueia o lote inteiro", async () => {
    manifesto.itens.push({ ...manifesto.itens[0], id: "preparacao", nome: "Preparação fictícia", updatedAt: "2026-10-02T10:00:00.000000Z" });
    await salvarManifesto();
    const antes = await linhas();
    await falha("--aplicar", /contém preparação/);
    expect(await linhas()).toEqual(antes);
    await expect(fs.access(arquivoAuditoria("snapshot.json"))).rejects.toMatchObject({ code: "ENOENT" });
  }, 40000);

  it("uma versão obsoleta impede qualquer foto do lote", async () => {
    await pool.query(`UPDATE "${schema}"."Insumo" SET "updatedAt"="updatedAt" + interval '1 microsecond' WHERE "id"='insumo-b'`);
    const antes = await linhas();
    await falha("--aplicar", /alterado após o inventário/);
    expect(await linhas()).toEqual(antes);
  }, 40000);

  it("erro no segundo UPDATE desfaz o primeiro e deixa evidência durável recuperável", async () => {
    const antes = await linhas();
    await pool.query(`CREATE FUNCTION "${schema}".falhar_segundo() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW."id"='insumo-b' THEN RAISE EXCEPTION 'falha sintética no segundo item'; END IF; RETURN NEW; END $$`);
    await pool.query(`CREATE TRIGGER falha_ficticia BEFORE UPDATE ON "${schema}"."Insumo" FOR EACH ROW EXECUTE FUNCTION "${schema}".falhar_segundo()`);
    await falha("--aplicar", /falha sintética/);
    expect(await linhas()).toEqual(antes);
    const snapshot = await fs.readFile(arquivoAuditoria("snapshot.json"));
    expect(JSON.parse(await fs.readFile(arquivoAuditoria("recibo.json"), "utf8"))).toMatchObject({ estado: "preparado", snapshotSha256: hashSha256(snapshot) });
    await pool.query(`DROP TRIGGER falha_ficticia ON "${schema}"."Insumo"`);
    expect(await cli("--aplicar")).toMatchObject({ alteradas: 2 });
    expect(await fs.readFile(arquivoAuditoria("snapshot.json"))).toEqual(snapshot);
    expect(await cli("--reverter")).toMatchObject({ alteradas: 2 });
    expect((await linhas()).map(linha => [linha.fotoData, linha.fotoMimeType])).toEqual(antes.map(linha => [linha.fotoData, linha.fotoMimeType]));
  }, 40000);

  it("recibo preparado após commit pode ser finalizado sem repetir UPDATE", async () => {
    await cli("--aplicar");
    const antes = await linhas();
    const recibo = JSON.parse(await fs.readFile(arquivoAuditoria("recibo.json"), "utf8"));
    recibo.estado = "preparado";
    await fs.writeFile(arquivoAuditoria("recibo.json"), JSON.stringify(recibo), { mode: 0o600 });
    expect(await cli("--aplicar")).toMatchObject({ alteradas: 0, inalteradas: 2 });
    expect(await linhas()).toEqual(antes);
    expect(JSON.parse(await fs.readFile(arquivoAuditoria("recibo.json"), "utf8"))).toMatchObject({ estado: "aplicado" });
    expect(await cli("--reverter")).toMatchObject({ alteradas: 2 });
  }, 40000);
});
