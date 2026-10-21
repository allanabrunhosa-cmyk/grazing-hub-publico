import { prepararMigrationHubIsolada, limparIntegracaoHubIsolada } from "../login/migrations-hub-isoladas";
import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config } from "dotenv";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PrismaClient } from "@/generated/prisma/client";
const simulacao = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, sessao: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return simulacao.prisma; } }));
vi.mock("@/lib/session", () => ({ getSession: simulacao.sessao }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("REDIRECT:" + url); } }));
vi.mock("server-only", () => ({}));
import { prepararEtiquetaAction, registrarExportacaoEtiquetaAction, confirmarImpressaoEtiquetaAction, salvarConfiguracaoProdutoEtiquetaAction, salvarConfiguracaoImpressoraAction } from "@/app/(protegido)/producao/etiquetas/actions";
import { restaurarPontoImpressaoAction, excluirPontoImpressaoAction, baixarEtiquetaAction, configurarUsuarioResponsavelAction, salvarResponsavelEtiquetaAction } from "@/app/(protegido)/producao/etiquetas/operacao-actions";
import { enfileirarPontoAction } from "@/app/(protegido)/producao/etiquetas/pontos-actions";
const esquema = "teste_etiquetas_" + randomUUID().replaceAll("-", "");
let banco: Client | undefined;
let criado = false;
let trabalhoId: string;
const entrada = { chaveIdempotencia: randomUUID(), insumoId: "preparacao", conservacao: "REFRIGERADO" as const, quantidade: "1,25", validadeOriginal: "2099-12-31", marcaFornecedor: "Aurora", sif: "953", lote: "TESTE", responsavelManipulacao: "Operador fictício", tamanho: "MM_60X40" as const, mostrarHora: true, copias: 1 };

describe.skipIf(process.env.ETIQUETAS_BANCO_TESTE !== "1")("etiquetas no PostgreSQL local isolado", () => {
  beforeAll(async () => {
    config({ quiet: true });
    const endereco = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(endereco.hostname)) throw new Error("Somente PostgreSQL local.");
    banco = new Client({ connectionString: endereco.toString() });
    await banco.connect();
    await banco.query(`CREATE SCHEMA "${esquema}"`);
    criado = true;
    await banco.query(`SET search_path TO "${esquema}"`);
    const pastas = (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    for (const pasta of pastas) await banco.query(await prepararMigrationHubIsolada(banco, esquema, pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    simulacao.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: endereco.toString(), options: `-c search_path=${esquema}` }, { schema: esquema }) });
    await simulacao.prisma.usuario.create({ data: { id: "admin-etiquetas", nome: "Admin fictício", email: "etiquetas@example.invalid", senhaHash: "sem-login", admin: true, perfilAcessoId: "perfil-administrador" } });
    simulacao.sessao.mockResolvedValue({ userId: "admin-etiquetas", admin: true, permissoes: {}, excecoes: {} });
    await simulacao.prisma.insumo.createMany({ data: [
      { id: "insumo", nome: "Brie fictício", unidade: "KG", tipo: "INSUMO" },
      { id: "preparacao", nome: "Creme fictício", unidade: "KG", tipo: "PRODUTO_INTERMEDIARIO" },
    ] });
  }, 60_000);
  afterAll(async () => {
    await simulacao.prisma?.$disconnect();
    if (!banco) return;
    await limparIntegracaoHubIsolada(banco, esquema);
    if (criado && /^teste_etiquetas_[a-f0-9]{32}$/.test(esquema)) await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);
    await banco.end();
  });
  it("não inventa validade nem habilita os cadastros existentes", async () => {
    const insumo = await simulacao.prisma.insumo.findUniqueOrThrow({ where: { id: "insumo" } });
    expect(insumo.etiquetaHabilitada).toBe(false);
    expect(insumo.validadeRefrigeradoDias).toBeNull();
    expect(await prepararEtiquetaAction({ ...entrada, insumoId: "insumo" })).toHaveProperty("erro");
  });
  it("configura a preparação existente e deduplica emissões concorrentes", async () => {
    expect(await salvarConfiguracaoProdutoEtiquetaAction({ insumoId: "preparacao", etiquetaHabilitada: true, validadeRefrigeradoDias: "2", validadeCongeladoDias: "", conservacaoEtiquetaPadrao: "REFRIGERADO" })).toMatchObject({ ok: true });
    const resultados = await Promise.all([prepararEtiquetaAction(entrada), prepararEtiquetaAction(entrada)]);
    for (const resultado of resultados) {
      expect(resultado).toHaveProperty("ok", true);
      if ("erro" in resultado) throw new Error(resultado.erro);
      trabalhoId = resultado.trabalho.id;
    }
    expect(await simulacao.prisma.trabalhoEtiqueta.count()).toBe(1);
    expect(await simulacao.prisma.trabalhoEtiqueta.findUniqueOrThrow({ where: { id: trabalhoId } })).toMatchObject({
      marcaFornecedor: "Aurora", sif: "953", validadeOriginal: "2099-12-31", codigoRastreio: expect.stringMatching(/^[A-F0-9]{6}$/), versaoTemplate: 4,
    });
    expect(await simulacao.prisma.insumo.count()).toBe(2);
    expect(await simulacao.prisma.movimentacaoEstoque.count()).toBe(0);
    expect(await simulacao.prisma.saldoEstoque.count()).toBe(0);
  });
  it("guarda o nome histórico sem criar outro produto e distingue download de impressão", async () => {
    await simulacao.prisma.insumo.update({ where: { id: "preparacao" }, data: { nome: "Creme atualizado" } });
    expect((await simulacao.prisma.trabalhoEtiqueta.findUniqueOrThrow({ where: { id: trabalhoId } })).produtoNome).toBe("Creme fictício");
    expect(await confirmarImpressaoEtiquetaAction(trabalhoId)).toHaveProperty("erro");
    expect(await registrarExportacaoEtiquetaAction(trabalhoId)).toEqual({ ok: true });
    const trabalho = await simulacao.prisma.trabalhoEtiqueta.findUniqueOrThrow({ where: { id: trabalhoId } });
    expect(trabalho.status).toBe("EXPORTADO");
    expect(trabalho.confirmadoEm).toBeNull();
    // Simula somente a confirmação humana em dados fictícios; nenhuma impressora é acessada.
    expect(await confirmarImpressaoEtiquetaAction(trabalhoId)).toEqual({ ok: true });
    expect(await simulacao.prisma.movimentacaoEstoque.count()).toBe(0);
  });
  it("resolve responsável ativo no mesmo cadastro, ignorando nome enviado pelo navegador", async () => {
    await simulacao.prisma.usuario.create({ data: { id: "responsavel", nome: "Ana da cozinha", email: "ana@example.invalid", senhaHash: "sem-login" } });
    expect((await simulacao.prisma.usuario.findUniqueOrThrow({ where: { id: "responsavel" } })).responsavelEtiquetaHabilitado).toBe(false);
    expect(await prepararEtiquetaAction({ ...entrada, chaveIdempotencia: randomUUID(), responsavelUsuarioId: "responsavel" })).toHaveProperty("erro");
    expect(await configurarUsuarioResponsavelAction("responsavel", true)).toEqual({ ok: true });
    expect(await simulacao.prisma.eventoAuditoriaEtiqueta.count({ where: { entidadeId: "responsavel", acao: "RESPONSAVEL_CONFIGURADO" } })).toBe(1);
    const resultado = await prepararEtiquetaAction({ ...entrada, chaveIdempotencia: randomUUID(), responsavelUsuarioId: "responsavel", responsavelManipulacao: "Nome adulterado" });
    if ("erro" in resultado) throw new Error(resultado.erro);
    expect(resultado.trabalho.dados.responsavelManipulacao).toBe("Ana da cozinha");
    expect(resultado.trabalho.dados.produtoNome).toBe("Creme atualizado");
    const auditoria = await simulacao.prisma.eventoAuditoriaEtiqueta.findFirstOrThrow({ where: { entidadeId: resultado.trabalho.id, acao: "PREPARADO" } });
    expect(auditoria.detalhes).toMatchObject({ responsavelUsuarioId: "responsavel", origemResponsavel: "USUARIO" });
    await simulacao.prisma.usuario.update({ where: { id: "responsavel" }, data: { nome: "Ana atualizada", ativo: false } });
    expect((await simulacao.prisma.trabalhoEtiqueta.findUniqueOrThrow({ where: { id: resultado.trabalho.id } })).responsavelManipulacao).toBe("Ana da cozinha");
    expect(await prepararEtiquetaAction({ ...entrada, chaveIdempotencia: randomUUID(), responsavelUsuarioId: "responsavel" })).toHaveProperty("erro");
    expect(await prepararEtiquetaAction({ ...entrada, chaveIdempotencia: randomUUID(), responsavelUsuarioId: "inexistente" })).toHaveProperty("erro");
    expect(await simulacao.prisma.insumo.count()).toBe(2);
  });
  it("acesso de consulta não prepara, exporta ou configura por chamada direta", async () => {
    simulacao.sessao.mockResolvedValue({ userId: "admin-etiquetas", admin: false, permissoes: { producao: ["visualizar"] }, excecoes: {} });
    await expect(prepararEtiquetaAction({ ...entrada, chaveIdempotencia: randomUUID() })).rejects.toThrow("REDIRECT:/sem-acesso");
    await expect(registrarExportacaoEtiquetaAction(trabalhoId)).rejects.toThrow("REDIRECT:/sem-acesso");
    await expect(salvarConfiguracaoProdutoEtiquetaAction({ insumoId: "preparacao", etiquetaHabilitada: true, validadeRefrigeradoDias: "2", validadeCongeladoDias: "", conservacaoEtiquetaPadrao: "REFRIGERADO" })).rejects.toThrow("REDIRECT:/sem-acesso");
    simulacao.sessao.mockResolvedValue({ userId: "admin-etiquetas", admin: true, permissoes: {}, excecoes: {} });
  });
  it("salva preparação Raspberry no mesmo perfil, audita e não cria trabalhos", async () => {
    const entradaPerfil = { fusoHorario: "America/Sao_Paulo", maximoCopias: 10, perfilId: null as string | null, nomePerfil: "Cozinha teste", modelo: "Modelo de teste", dpi: 203, suporta60x40: true, suporta60x60: true };
    const antes = await simulacao.prisma.trabalhoEtiqueta.count();
    const planejamentoRaspberry = { estacao: "Cozinha", fila: "zebra_cozinha", conexao: "USB" as const };
    const resultado = await salvarConfiguracaoImpressoraAction({ ...entradaPerfil, planejamentoRaspberry });
    if ("erro" in resultado) throw new Error(resultado.erro);
    entradaPerfil.perfilId = resultado.perfilId;
    expect((await simulacao.prisma.perfilImpressora.findUniqueOrThrow({ where: { id: resultado.perfilId } })).planejamentoRaspberry).toEqual(planejamentoRaspberry);
    expect(await salvarConfiguracaoImpressoraAction(entradaPerfil)).toMatchObject({ ok: true });
    expect((await simulacao.prisma.perfilImpressora.findUniqueOrThrow({ where: { id: resultado.perfilId } })).planejamentoRaspberry).toEqual(planejamentoRaspberry);
    simulacao.sessao.mockResolvedValue({ userId: "admin-etiquetas", admin: false, permissoes: { producao: ["visualizar"] }, excecoes: {} });
    expect(await salvarConfiguracaoImpressoraAction({ ...entradaPerfil, planejamentoRaspberry: null })).toHaveProperty("erro");
    simulacao.sessao.mockResolvedValue({ userId: "admin-etiquetas", admin: true, permissoes: {}, excecoes: {} });
    expect(await salvarConfiguracaoImpressoraAction({ ...entradaPerfil, planejamentoRaspberry: null })).toMatchObject({ ok: true });
    expect((await simulacao.prisma.perfilImpressora.findUniqueOrThrow({ where: { id: resultado.perfilId } })).planejamentoRaspberry).toBeNull();
    expect(await simulacao.prisma.trabalhoEtiqueta.count()).toBe(antes);
    expect(await simulacao.prisma.perfilImpressora.count()).toBe(1);
    expect(await simulacao.prisma.movimentacaoEstoque.count()).toBe(0);
    expect(await simulacao.prisma.eventoAuditoriaEtiqueta.count({ where: { acao: "PERFIL_IMPRESSORA_SALVO" } })).toBe(3);
  });
  it("baixa parcial concorrente é limitada, idempotente e preserva impressão e estoque", async () => {
    const r = await prepararEtiquetaAction({ ...entrada, chaveIdempotencia: randomUUID(), copias: 3 });
    if ("erro" in r) throw new Error(r.erro);
    const pedido = { trabalhoId: r.trabalho.id, quantidade: 2, chaveIdempotencia: randomUUID() };
    expect(await Promise.all([baixarEtiquetaAction(pedido), baixarEtiquetaAction(pedido)])).toEqual([{ ok: true }, { ok: true }]);
    const concorrentes = await Promise.all([baixarEtiquetaAction({ ...pedido, quantidade: 1, chaveIdempotencia: randomUUID() }), baixarEtiquetaAction({ ...pedido, quantidade: 1, chaveIdempotencia: randomUUID() })]);
    expect(concorrentes.filter(item => "ok" in item)).toHaveLength(1);
    const salvo = await simulacao.prisma.trabalhoEtiqueta.findUniqueOrThrow({ where: { id: r.trabalho.id } });
    expect(salvo).toMatchObject({ copias: 3, copiasBaixadas: 3, status: "PREPARADO", zpl: r.trabalho.zpl });
    expect(await baixarEtiquetaAction({ ...pedido, quantidade: 1 })).toHaveProperty("erro");
    expect(await simulacao.prisma.eventoAuditoriaEtiqueta.count({ where: { entidadeId: salvo.id, acao: "ETIQUETA_BAIXADA" } })).toBe(2);
    expect(await simulacao.prisma.atividadeUsuario.count({ where: { entidadeId: salvo.id, acao: "ETIQUETA_BAIXADA", recurso: "producao.validades", resumo: "Baixa de etiquetas registrada." } })).toBe(2);
    expect(await simulacao.prisma.movimentacaoEstoque.count()).toBe(0);
  });
  it("exclusão preserva padrão e histórico, recusa fila e revoga o ponto removido", async () => {
    const padrao = await simulacao.prisma.pontoImpressao.create({ data: { nome: "Padrão fictício", lojaId: "singleton", padrao: true } });
    expect(await excluirPontoImpressaoAction(padrao.id)).toHaveProperty("erro");
    const ponto = await simulacao.prisma.pontoImpressao.create({ data: { nome: "Duplicado fictício", lojaId: "singleton", impressoraSelecionadaId: "usb-teste" } });
    await simulacao.prisma.dispositivoImpressao.create({ data: { pontoId: ponto.id, tokenHash: "hash-publico-ficticio" } });
    const envio = await simulacao.prisma.envioPontoImpressao.create({ data: { pontoId: ponto.id, trabalhoId, lojaId: "singleton", solicitadoPorId: "admin-etiquetas", zpl: "^XA^XZ", chaveIdempotencia: randomUUID() } });
    expect(await excluirPontoImpressaoAction(ponto.id)).toHaveProperty("erro");
    await simulacao.prisma.envioPontoImpressao.update({ where: { id: envio.id }, data: { estado: "FALHA" } });
    expect(await excluirPontoImpressaoAction(ponto.id)).toEqual({ ok: true });
    expect(await excluirPontoImpressaoAction(ponto.id)).toEqual({ ok: true });
    expect(await simulacao.prisma.pontoImpressao.findUniqueOrThrow({ where: { id: ponto.id } })).toMatchObject({ ativo: false, padrao: false, excluidoEm: expect.any(Date) });
    expect(await simulacao.prisma.dispositivoImpressao.findUniqueOrThrow({ where: { pontoId: ponto.id } })).toMatchObject({ revogadoEm: expect.any(Date) });
    expect(await simulacao.prisma.envioPontoImpressao.count({ where: { pontoId: ponto.id } })).toBe(1);
    expect(await enfileirarPontoAction({ pontoId: ponto.id, trabalhoId, chaveIdempotencia: randomUUID(), reimpressao: true })).toHaveProperty("erro");
    expect(await simulacao.prisma.pontoImpressao.findUniqueOrThrow({ where: { id: padrao.id } })).toMatchObject({ ativo: true, padrao: true, excluidoEm: null });
  });
  it("responsáveis configurados usam nome canônico e preservam o snapshot", async () => {
    await simulacao.prisma.usuario.update({ where: { id: "responsavel" }, data: { ativo: true } });
    expect(await configurarUsuarioResponsavelAction("responsavel", false)).toEqual({ ok: true });
    expect(await prepararEtiquetaAction({ ...entrada, chaveIdempotencia: randomUUID(), responsavelUsuarioId: "responsavel" })).toHaveProperty("erro");
    expect(await salvarResponsavelEtiquetaAction({ nome: "Pessoa sem conta fictícia", ativo: true })).toEqual({ ok: true });
    const cadastro = await simulacao.prisma.responsavelEtiqueta.findFirstOrThrow({ where: { nome: "Pessoa sem conta fictícia" } });
    const r = await prepararEtiquetaAction({ ...entrada, chaveIdempotencia: randomUUID(), responsavelCadastroId: cadastro.id, responsavelManipulacao: "Adulterado" });
    if ("erro" in r) throw new Error(r.erro);
    expect(r.trabalho.dados.responsavelManipulacao).toBe(cadastro.nome);
    expect(await salvarResponsavelEtiquetaAction({ id: cadastro.id, nome: "Atualizada fictícia", ativo: false })).toEqual({ ok: true });
    expect((await simulacao.prisma.trabalhoEtiqueta.findUniqueOrThrow({ where: { id: r.trabalho.id } })).responsavelManipulacao).toBe(cadastro.nome);
    expect(await prepararEtiquetaAction({ ...entrada, chaveIdempotencia: randomUUID(), responsavelCadastroId: cadastro.id })).toHaveProperty("erro");
    expect(await simulacao.prisma.usuario.count({ where: { nome: cadastro.nome } })).toBe(0);
  });
  it("nega novas operações por chamada direta antes de escrever", async () => {
    simulacao.sessao.mockResolvedValue({ userId: "admin-etiquetas", admin: false, permissoes: { producao: ["visualizar"] }, excecoes: {} });
    await expect(baixarEtiquetaAction({ trabalhoId, quantidade: 1, chaveIdempotencia: randomUUID() })).rejects.toThrow("REDIRECT:/sem-acesso");
    await expect(excluirPontoImpressaoAction("inexistente")).rejects.toThrow("REDIRECT:/sem-acesso");
    await expect(configurarUsuarioResponsavelAction("responsavel", true)).rejects.toThrow("REDIRECT:/sem-acesso");
    await expect(salvarResponsavelEtiquetaAction({ nome: "Proibida", ativo: true })).rejects.toThrow("REDIRECT:/sem-acesso");
    simulacao.sessao.mockResolvedValue({ userId: "admin-etiquetas", admin: true, permissoes: {}, excecoes: {} });
  });

  it("restaura somente o cadastro, sem reativar a credencial", async () => {
    const ponto = await simulacao.prisma.pontoImpressao.findFirstOrThrow({ where: { excluidoEm: { not: null } } });
    expect(await restaurarPontoImpressaoAction(ponto.id)).toEqual({ ok: true });
    expect(await simulacao.prisma.pontoImpressao.findUniqueOrThrow({ where: { id: ponto.id } })).toMatchObject({ ativo: false, padrao: false, excluidoEm: null });
    expect((await simulacao.prisma.dispositivoImpressao.findUniqueOrThrow({ where: { pontoId: ponto.id } })).revogadoEm).not.toBeNull();
  });
  it("duas solicitações simultâneas não duplicam envio de um trabalho", async () => {
    const r = await prepararEtiquetaAction({ ...entrada, tamanho: "MM_60X60", chaveIdempotencia: randomUUID() });
    if ("erro" in r) throw new Error(r.erro);
    const ponto = await simulacao.prisma.pontoImpressao.create({ data: { nome: "Concorrência fictícia", lojaId: "singleton", impressoraSelecionadaId: "usb-teste" } });
    await simulacao.prisma.dispositivoImpressao.create({ data: { pontoId: ponto.id, tokenHash: "hash-ficticio-concorrencia" } });
    const pedido = { pontoId: ponto.id, trabalhoId: r.trabalho.id, chaveIdempotencia: randomUUID(), reimpressao: false };
    const resultados = await Promise.all([enfileirarPontoAction(pedido), enfileirarPontoAction({ ...pedido, chaveIdempotencia: randomUUID() })]);
    expect(resultados.filter(item => "ok" in item)).toHaveLength(1);
    expect(await enfileirarPontoAction(pedido)).toEqual(resultados[0]);
    expect(await simulacao.prisma.envioPontoImpressao.count({ where: { trabalhoId: r.trabalho.id } })).toBe(1);
    expect(await baixarEtiquetaAction({ trabalhoId: r.trabalho.id, quantidade: 1, chaveIdempotencia: randomUUID() })).toHaveProperty("erro");
    // Não há conector real nesta base. Nenhum byte foi enviado à USB.
  });
  it("falha da auditoria reverte a baixa e cadastro repetido não duplica responsável", async () => {
    const r = await prepararEtiquetaAction({ ...entrada, chaveIdempotencia: randomUUID() });
    if ("erro" in r) throw new Error(r.erro);
    simulacao.sessao.mockResolvedValue({ userId: "ator-inexistente", admin: true, permissoes: {}, excecoes: {} });
    expect(await baixarEtiquetaAction({ trabalhoId: r.trabalho.id, quantidade: 1, chaveIdempotencia: randomUUID() })).toHaveProperty("erro");
    expect((await simulacao.prisma.trabalhoEtiqueta.findUniqueOrThrow({ where: { id: r.trabalho.id } })).copiasBaixadas).toBe(0);
    simulacao.sessao.mockResolvedValue({ userId: "admin-etiquetas", admin: true, permissoes: {}, excecoes: {} });
    const antes = await simulacao.prisma.responsavelEtiqueta.count();
    const duplicadas = await Promise.all([salvarResponsavelEtiquetaAction({ nome: "Pessoa duplicada fictícia", ativo: true }), salvarResponsavelEtiquetaAction({ nome: "Pessoa duplicada fictícia", ativo: true })]);
    expect(duplicadas.filter(item => "ok" in item)).toHaveLength(1);
    expect(await simulacao.prisma.responsavelEtiqueta.count()).toBe(antes + 1);
  });

  it("migration de 30 cópias eleva limites menores, preserva maiores e não altera outros dados", async () => {
    const schema = "teste_trinta_etiquetas_" + randomUUID().replaceAll("-", "");
    const c = new Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
    try {
      await c.query(`CREATE SCHEMA "${schema}"`); await c.query(`SET search_path TO "${schema}"`);
      await c.query(`CREATE TABLE "ConfiguracaoLoja" (id text PRIMARY KEY, nome text NOT NULL, "maximoCopiasEtiqueta" integer NOT NULL DEFAULT 10);
        INSERT INTO "ConfiguracaoLoja" VALUES ('minimo', 'Loja A', 1), ('padrao', 'Loja B', 10), ('trinta', 'Loja C', 30), ('maior', 'Loja D', 50);
        CREATE TABLE "TrabalhoEtiqueta" (id text, copias integer, zpl text);
        INSERT INTO "TrabalhoEtiqueta" VALUES ('historico', 10, '^XA^PQ10,0,1,N^XZ');`);
      const trabalhoAntes = (await c.query('SELECT * FROM "TrabalhoEtiqueta"')).rows;
      const sql = await readFile("prisma/migrations/20261020170000_validades_trinta_etiquetas/migration.sql", "utf8");
      await c.query(sql); await c.query(sql);
      expect((await c.query('SELECT * FROM "ConfiguracaoLoja" ORDER BY id')).rows).toEqual([
        { id: "maior", nome: "Loja D", maximoCopiasEtiqueta: 50 },
        { id: "minimo", nome: "Loja A", maximoCopiasEtiqueta: 30 },
        { id: "padrao", nome: "Loja B", maximoCopiasEtiqueta: 30 },
        { id: "trinta", nome: "Loja C", maximoCopiasEtiqueta: 30 },
      ]);
      await c.query(`INSERT INTO "ConfiguracaoLoja" (id, nome) VALUES ('nova', 'Loja nova')`);
      expect((await c.query(`SELECT "maximoCopiasEtiqueta" FROM "ConfiguracaoLoja" WHERE id = 'nova'`)).rows[0].maximoCopiasEtiqueta).toBe(30);
      expect((await c.query('SELECT * FROM "TrabalhoEtiqueta"')).rows).toEqual(trabalhoAntes);
    } finally { await c.query('SET search_path TO public'); await c.query(`DROP SCHEMA "${schema}" CASCADE`); await c.end(); }
  });

  it("prepara trinta cópias em um trabalho auditado e recusa extrapolar o limite da loja", async () => {
    await simulacao.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { maximoCopiasEtiqueta: 30 } });
    const chaveIdempotencia = randomUUID();
    const resultado = await prepararEtiquetaAction({ ...entrada, chaveIdempotencia, copias: 30 });
    if ("erro" in resultado) throw new Error(resultado.erro);
    const repetida = await prepararEtiquetaAction({ ...entrada, chaveIdempotencia, copias: 30 });
    expect(repetida).toMatchObject({ ok: true, trabalho: { id: resultado.trabalho.id, reutilizado: true } });
    const salvo = await simulacao.prisma.trabalhoEtiqueta.findUniqueOrThrow({ where: { id: resultado.trabalho.id } });
    expect(salvo.copias).toBe(30); expect(salvo.zpl).toContain("^PQ30,0,1,N");
    expect(await simulacao.prisma.eventoAuditoriaEtiqueta.count({ where: { entidadeId: salvo.id, acao: "PREPARADO" } })).toBe(1);
    const antes = await simulacao.prisma.trabalhoEtiqueta.count();
    expect(await prepararEtiquetaAction({ ...entrada, chaveIdempotencia: randomUUID(), copias: 31 })).toHaveProperty("erro");
    expect(await simulacao.prisma.trabalhoEtiqueta.count()).toBe(antes);
  });

  it("migration incremental preserva cadastros e snapshots e aplica defaults compatíveis", async () => {
    const schema = "teste_migracao_validades_" + randomUUID().replaceAll("-", "");
    const c = new Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
    try {
      await c.query(`CREATE SCHEMA "${schema}"`); await c.query(`SET search_path TO "${schema}"`);
      const pastas = (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a,b) => a.name.localeCompare(b.name));
      for (const pasta of pastas.filter(p => p.name < "20261016120000_validades_operacao")) await c.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
      await c.query(`INSERT INTO "ConfiguracaoLoja" ("id", "nome", "updatedAt") VALUES ('singleton','Loja fictícia',now());
        INSERT INTO "Usuario" ("id","nome","email","senhaHash","updatedAt") VALUES ('teste','Pessoa fictícia','teste@example.invalid','sem-login',now());
        INSERT INTO "Insumo" ("id","nome","unidade","updatedAt") VALUES ('item','Produto fictício','KG',now());
        INSERT INTO "PontoImpressao" ("id","lojaId","nome","updatedAt") VALUES ('ponto','singleton','Ponto fictício',now());
        INSERT INTO "TrabalhoEtiqueta" ("id","chaveIdempotencia","lojaId","insumoId","produtoNome","unidade","prazoDias","configuracaoVersao","lojaNome","fusoHorario","resolucaoDpi","conservacao","responsavelManipulacao","emitidoPorId","manipuladoEm","validoAte","tamanho","copias","zpl","hashPayload","codigoRastreio","updatedAt") VALUES ('etiqueta','chave','singleton','item','Snapshot fictício','KG',5,1,'Loja fictícia','America/Sao_Paulo',203,'REFRIGERADO','Pessoa fictícia','teste',now(),now(),'MM_60X60',2,'^XA^XZ','hash-ficticio','TESTE',now());`);
      const antes = (await c.query('SELECT row_to_json(t) AS trabalho FROM "TrabalhoEtiqueta" t')).rows[0].trabalho;
      await c.query(await readFile("prisma/migrations/20261016120000_validades_operacao/migration.sql", "utf8"));
      const depois = (await c.query('SELECT row_to_json(t) AS trabalho FROM "TrabalhoEtiqueta" t')).rows[0].trabalho;
      expect(depois.copiasBaixadas).toBe(0); delete depois.copiasBaixadas; expect(depois).toEqual(antes);
      expect((await c.query('SELECT "responsavelEtiquetaHabilitado" FROM "Usuario"')).rows[0].responsavelEtiquetaHabilitado).toBe(true);
      expect((await c.query('SELECT "excluidoEm" FROM "PontoImpressao"')).rows[0].excluidoEm).toBeNull();
    } finally { await c.query('SET search_path TO public'); await c.query(`DROP SCHEMA "${schema}" CASCADE`); await c.end(); }
  });

});
