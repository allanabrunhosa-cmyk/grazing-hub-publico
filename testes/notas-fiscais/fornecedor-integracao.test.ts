import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { resolverFornecedorNota } from "@/lib/notas-fiscais/fornecedor";
import type { PreviaFornecedorNota } from "@/lib/notas-fiscais/dados-fornecedor";

const estado = vi.hoisted(() => ({ banco: null as unknown as PrismaClient, autenticado: true }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return estado.banco; } }));
vi.mock("@/lib/session", () => ({ getSession: async () => estado.autenticado ? { userId: "usuario-teste-fornecedor" } : null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prepararConciliacaoFornecedorAction as preparar, conciliarFornecedorNotaAction as salvar } from "@/app/(protegido)/notas-fiscais/conciliar-fornecedor-actions";

const esquema = `teste_fornecedor_nota_${randomUUID().replaceAll("-", "")}`;
const cnpj = "12345678000199";
const chave = "352609" + cnpj + "5500100000000110000000000";
const xml = (telefone = "") => `<nfeProc><NFe><infNFe Id="NFe${chave}"><emit><CNPJ>${cnpj}</CNPJ><xNome>Razão social correta</xNome><xFant>Fornecedor correto</xFant><enderEmit>${telefone ? `<fone>${telefone}</fone>` : ""}</enderEmit></emit></infNFe></NFe></nfeProc>`;
let conexao: Client, notaId: string, fornecedorId: string;
async function previa(id = fornecedorId) {
  const resultado = await preparar(notaId, id);
  expect(resultado).not.toHaveProperty("erro");
  return resultado as PreviaFornecedorNota;
}
async function gravar(p: PreviaFornecedorNota) {
  return salvar({ notaId, fornecedorId: p.fornecedorId!, versao: p.versao, campos: p.campos });
}

describe.skipIf(process.env.FORNECEDOR_NOTA_BANCO_TESTE !== "1")("Conciliação de fornecedor no PostgreSQL isolado", () => {
  beforeAll(async () => {
    if (!["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Permitido somente no PostgreSQL local.");
    conexao = new Client({ connectionString: process.env.DATABASE_URL });
    await conexao.connect();
    await conexao.query(`CREATE SCHEMA "${esquema}"`);
    await conexao.query(`SET search_path TO "${esquema}"`);
    // Esquema completo atual, sem copiar tabelas ou depender de enums de public.
    for (const pasta of (await readdir("prisma/migrations")).filter(p => /^\d/.test(p)).sort()) {
      await conexao.query(prepararSqlMigrationFiscal(pasta, await readFile(`prisma/migrations/${pasta}/migration.sql`, "utf8")));
    }
    estado.banco = new PrismaClient({ adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL, options: `-c search_path=${esquema}`,
    }, { schema: esquema }) });
    fornecedorId = (await estado.banco.fornecedor.create({ data: { nome: "Nome antigo", telefone: "11999999999", email: "preservar@example.invalid" } })).id;
    notaId = (await estado.banco.notaFiscalRecebida.create({ data: { chaveAcesso: chave, nsu: "000000000000001", tipo: "PROC_NFE", fornecedorCnpj: cnpj, xml: xml() } })).id;
  }, 60_000);
  afterAll(async () => {
    await estado.banco?.$disconnect();
    if (conexao) {
      // Apenas o schema criado acima; nenhuma tabela pública é alterada.
      if (/^teste_fornecedor_nota_[a-f0-9]{32}$/.test(esquema)) await conexao.query(`DROP SCHEMA IF EXISTS "${esquema}" CASCADE`);
      await conexao.end();
    }
  });
  it("exige sessão inclusive para a prévia, sem expor o cadastro", async () => {
    estado.autenticado = false;
    expect(await preparar(notaId)).toHaveProperty("erro");
    expect(await salvar({ notaId, fornecedorId, versao: "", campos: [] })).toHaveProperty("erro");
    estado.autenticado = true;
  });
  it("preenche faltantes, corrige erros e mantém campos ausentes no XML", async () => {
    const p = await previa();
    expect(p.campos).toEqual(["nome", "razaoSocial", "cnpj"]);
    expect(await gravar(p)).toHaveProperty("fornecedor");
    expect(await estado.banco.fornecedor.findUnique({ where: { id: fornecedorId } })).toMatchObject({
      nome: "FORNECEDOR CORRETO", razaoSocial: "RAZÃO SOCIAL CORRETA", cnpj, telefone: "11999999999", email: "preservar@example.invalid",
    });
    const memoria = await estado.banco.fornecedorNotaVinculo.findUniqueOrThrow({ where: { cnpj } });
    expect(memoria).toMatchObject({ fornecedorId, notaOrigemId: notaId, usuarioId: "usuario-teste-fornecedor" });
    expect(memoria.atualizacao).toMatchObject({ aplicado: { razaoSocial: "RAZÃO SOCIAL CORRETA" } });
  });
  it("reconhece próximas compras pela memória mesmo após mudar o CNPJ cadastral", async () => {
    await estado.banco.fornecedor.update({ where: { id: fornecedorId }, data: { cnpj: null } });
    expect(await resolverFornecedorNota(estado.banco, cnpj)).toMatchObject({ id: fornecedorId, memorizado: true });
    const p = await preparar(notaId);
    expect(p).toMatchObject({ fornecedorId });
  });
  it("preserva campo desmarcado e atualiza telefone errado com o XML", async () => {
    await estado.banco.notaFiscalRecebida.update({ where: { id: notaId }, data: { xml: xml("1133333333") } });
    const p = await previa();
    expect(await salvar({ notaId, fornecedorId, versao: p.versao, campos: ["telefone"] })).toHaveProperty("fornecedor");
    expect(await estado.banco.fornecedor.findUnique({ where: { id: fornecedorId } })).toMatchObject({ cnpj: null, telefone: "1133333333" });
  });
  it("bloqueia prévia antiga sem sobrescrever alteração concorrente", async () => {
    const p = await previa();
    await estado.banco.fornecedor.update({ where: { id: fornecedorId }, data: { nome: "Alteração concorrente" } });
    expect(await gravar(p)).toMatchObject({ erro: expect.stringContaining("mudou") });
    expect((await estado.banco.fornecedor.findUniqueOrThrow({ where: { id: fornecedorId } })).nome).toBe("Alteração concorrente");
  });
  it("não altera fornecedor enquanto há aceite fiscal em andamento", async () => {
    const p = await previa();
    await estado.banco.$transaction(async banco => {
      await banco.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('aceite-nota'), hashtext(${notaId}))::text`;
      expect(await gravar(p)).toMatchObject({ erro: expect.stringContaining("está sendo atualizada") });
    });
  });
  it("conflito de CNPJ desfaz atualização de todos os campos e da memória", async () => {
    const outro = await estado.banco.fornecedor.create({ data: { nome: "Outro cadastro", cnpj } });
    const memoria = await estado.banco.fornecedorNotaVinculo.findUnique({ where: { cnpj } });
    const p = await previa();
    expect(await gravar(p)).toMatchObject({ erro: expect.stringContaining("CNPJ") });
    expect((await estado.banco.fornecedor.findUniqueOrThrow({ where: { id: fornecedorId } })).nome).toBe("Alteração concorrente");
    expect(await estado.banco.fornecedorNotaVinculo.findUnique({ where: { cnpj } })).toEqual(memoria);
    await estado.banco.fornecedor.delete({ where: { id: outro.id } });
  });
  it("serializa duas conciliações de notas diferentes para o mesmo CNPJ", async () => {
    const outraNota = await estado.banco.notaFiscalRecebida.create({ data: { chaveAcesso: chave.slice(0, -1) + "1", nsu: "000000000000002", tipo: "PROC_NFE", fornecedorCnpj: cnpj, xml: xml().replaceAll(chave, chave.slice(0, -1) + "1") } });
    const outro = await estado.banco.fornecedor.create({ data: { nome: "Alternativo" } });
    const p1 = await previa();
    const p2 = await preparar(outraNota.id, outro.id) as PreviaFornecedorNota;
    const resultados = await Promise.all([
      gravar(p1),
      salvar({ notaId: outraNota.id, fornecedorId: outro.id, versao: p2.versao, campos: [] }),
    ]);
    expect(resultados.filter(r => "fornecedor" in r)).toHaveLength(1);
    expect(resultados.filter(r => "erro" in r)).toHaveLength(1);
  });
  it("não usa fornecedor inativo e permite selecionar outro na conferência", async () => {
    const m = await estado.banco.fornecedorNotaVinculo.findUniqueOrThrow({ where: { cnpj } });
    await estado.banco.fornecedor.update({ where: { id: m.fornecedorId }, data: { ativo: false } });
    expect(await resolverFornecedorNota(estado.banco, cnpj)).toBeNull();
    expect(await preparar(notaId)).toMatchObject({ fornecedorId: null });
    expect(await preparar(notaId, m.fornecedorId)).toHaveProperty("erro");
  });
  it("rejeita XML de outro emitente e dados arbitrários", async () => {
    await estado.banco.notaFiscalRecebida.update({ where: { id: notaId }, data: { xml: xml().replace(`<CNPJ>${cnpj}</CNPJ>`, "<CNPJ>99999999999999</CNPJ>") } });
    expect(await preparar(notaId)).toHaveProperty("erro");
    expect(await salvar({ notaId, fornecedorId, versao: "", campos: ["email"] as never })).toHaveProperty("erro");
  });
});

// Estas regressões isolam a regra operacional; as guardas reais são exercitadas em testes/permissoes/fronteiras.test.ts.
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn().mockResolvedValue(undefined) }));
