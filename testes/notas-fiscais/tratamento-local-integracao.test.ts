import { prepararDependenciaAtendimento } from "../vendas/dependencia-atendimento";
import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import type { EntradaTratamentoLocalNota } from "@/lib/notas-fiscais/tratamento-local";

vi.mock("server-only", () => ({}));
const estado = vi.hoisted(() => ({
  banco: null as unknown as PrismaClient,
  manifestar: vi.fn(),
  sessao: { userId: "usuario-manifestacao-teste", nome: "Operador sintético", email: "manifestacao@example.invalid", admin: true, versao: 0, perfilNome: "Administrador", permissoes: {}, excecoes: {} },
}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return estado.banco; } }));
vi.mock("@/lib/session", () => ({ getSession: async () => estado.sessao }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn(async () => estado.sessao) }));
vi.mock("@/lib/sefaz/manifestar", () => ({ manifestarNotaFiscal: estado.manifestar }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { tratarOutraOperacaoNotaAction } from "@/app/(protegido)/notas-fiscais/tratamento-local-actions";
import { aceitarNotaAction } from "@/app/(protegido)/notas-fiscais/aceitar-nota";
import { confirmarConciliacaoNotaAction, manifestarAction } from "@/app/(protegido)/notas-fiscais/actions";

const esquema = "teste_manifestacao_" + randomUUID().replaceAll("-", "");
const xml = '<nfeProc><NFe><infNFe><ide><natOp>Retorno de equipamento sintético</natOp></ide><det nItem="1"><prod><vProd>100</vProd></prod></det><total><ICMSTot><vProd>100</vProd><vNF>100</vNF></ICMSTot></total></infNFe></NFe></nfeProc>';
const motivo = "Devolução do equipamento sintético já realizada.";
let banco: Client | undefined;
let criado = false;
let perfilId = "";

async function criarNota() {
  const id = randomUUID();
  const nota = await estado.banco.notaFiscalRecebida.create({ data: {
    id, chaveAcesso: id.replaceAll("-", "").padEnd(44, "0"), nsu: id, tipo: "PROC_NFE", xml,
    dataEmissao: new Date("2024-02-20T12:00:00Z"), valorTotal: 100,
  } });
  const entrada: EntradaTratamentoLocalNota = { notaFiscalId: id, versao: 0, acao: "DEVOLUCAO", dataDevolucao: "2024-02-29", motivo };
  return { nota, entrada };
}

async function conferirSemCompra(notaFiscalId: string) {
  expect(await estado.banco.notaFiscalItemLancamento.count({ where: { notaFiscalItem: { notaFiscalId } } })).toBe(0);
  expect(await estado.banco.movimentacaoEstoque.count({ where: { notaFiscalItem: { notaFiscalId } } })).toBe(0);
  expect(await estado.banco.notaFiscalDuplicata.count({ where: { notaFiscalId } })).toBe(0);
}

describe.skipIf(process.env.MANIFESTACAO_NOTA_BANCO_TESTE !== "1")("tratamento local de NF-e no PostgreSQL isolado", () => {
  beforeAll(async () => {
    config({ quiet: true });
    const endereco = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(endereco.hostname)) throw new Error("Somente PostgreSQL local de testes.");
    banco = new Client({ connectionString: endereco.toString() });
    await banco.connect();
    await banco.query(`CREATE SCHEMA "${esquema}"`);
    criado = true;
    await banco.query(`SET search_path TO "${esquema}"`);
    const migrations = (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    for (const pasta of migrations) {
      await banco.query(prepararSqlMigrationFiscal(pasta.name, await prepararDependenciaAtendimento(banco, pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8"))));
    }
    estado.banco = new PrismaClient({ adapter: new PrismaPg({ connectionString: endereco.toString(), options: `-c search_path=${esquema}` }, { schema: esquema }) });
    expect(await estado.banco.$queryRaw`SELECT current_schema() AS esquema`).toEqual([{ esquema }]);
    perfilId = (await estado.banco.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } })).id;
    await estado.banco.usuario.create({ data: { id: estado.sessao.userId, nome: estado.sessao.nome, email: estado.sessao.email, senhaHash: "sem-login", senhaDefinida: true, perfilAcessoId: perfilId } });
    // A falha é restrita a IDs inseridos pelo teste neste schema descartável.
    await banco.query(`CREATE TABLE "${esquema}".falha_auditoria_manifestacao (id text PRIMARY KEY)`);
    await banco.query(`CREATE FUNCTION "${esquema}".falhar_auditoria_manifestacao() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.entidade = 'NOTA_FISCAL_RECEBIDA' AND EXISTS (SELECT 1 FROM "${esquema}".falha_auditoria_manifestacao f WHERE f.id = NEW."entidadeId") THEN
          RAISE EXCEPTION 'Falha sintética de auditoria';
        END IF;
        RETURN NEW;
      END $$`);
    await banco.query(`CREATE TRIGGER falhar_auditoria_manifestacao BEFORE INSERT ON "${esquema}"."HistoricoAcesso" FOR EACH ROW EXECUTE FUNCTION "${esquema}".falhar_auditoria_manifestacao()`);
  }, 60_000);

  beforeEach(async () => {
    await estado.banco.usuario.update({ where: { id: estado.sessao.userId }, data: { ativo: true, excluidoEm: null, senhaDefinida: true, sessaoVersao: 0, perfilAcessoId: perfilId, permissoesPersonalizadas: {} } });
    estado.manifestar.mockReset();
    estado.manifestar.mockImplementation(async (chaveAcesso: string, tipo: "CONFIRMACAO_DA_OPERACAO") => {
      const nota = await estado.banco.notaFiscalRecebida.findUniqueOrThrow({ where: { chaveAcesso } });
      // Representa a persistência fiscal em conexão própria, sem serviço externo.
      await estado.banco.manifestacaoNFe.create({ data: { notaFiscalId: nota.id, tipo, sucesso: true, protocolo: "FICTICIO", cStat: "135" } });
      await estado.banco.notaFiscalRecebida.update({ where: { id: nota.id }, data: { ultimaManifestacao: tipo } });
      return { sucesso: true, mensagem: "Confirmação sintética", protocolo: "FICTICIO" };
    });
  });

  afterAll(async () => {
    await estado.banco?.$disconnect();
    if (banco) {
      await banco.query("ROLLBACK");
      if (criado && /^teste_manifestacao_[a-f0-9]{32}$/.test(esquema)) await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);
      await banco.end();
    }
  });

  it("persiste devolução DATE e confirmação fiscal separadamente, sem efeitos de compra", async () => {
    const { nota, entrada } = await criarNota();
    expect(await tratarOutraOperacaoNotaAction(entrada)).toEqual({ ok: true, versao: 1 });
    const salva = await estado.banco.notaFiscalRecebida.findUniqueOrThrow({ where: { id: nota.id } });
    expect(salva).toMatchObject({ tratamentoLocal: "DEVOLUCAO_REGISTRADA", tratamentoLocalVersao: 1, motivoTratamentoLocal: motivo, ultimaManifestacao: "CONFIRMACAO_DA_OPERACAO" });
    expect(salva.dataDevolucao?.toISOString().slice(0, 10)).toBe("2024-02-29");
    const [dia] = await estado.banco.$queryRaw<{ dia: string }[]>`SELECT "dataDevolucao"::text AS dia FROM "NotaFiscalRecebida" WHERE id = ${nota.id}`;
    expect(dia.dia).toBe("2024-02-29");
    expect(await estado.banco.manifestacaoNFe.count({ where: { notaFiscalId: nota.id, tipo: "CONFIRMACAO_DA_OPERACAO", sucesso: true } })).toBe(1);
    expect(await estado.banco.historicoAcesso.count({ where: { entidade: "NOTA_FISCAL_RECEBIDA", entidadeId: nota.id } })).toBe(1);
    await conferirSemCompra(nota.id);
  });

  it("ignora, repete e reabre somente o controle local, mantendo XML e manifestação fiscal", async () => {
    const { nota, entrada } = await criarNota();
    await estado.banco.notaFiscalRecebida.update({ where: { id: nota.id }, data: { ultimaManifestacao: "CIENCIA_DA_OPERACAO" } });
    const ignorar = { ...entrada, acao: "IGNORAR" as const, dataDevolucao: undefined };
    expect(await tratarOutraOperacaoNotaAction(ignorar)).toEqual({ ok: true, versao: 1 });
    expect(await tratarOutraOperacaoNotaAction(ignorar)).toEqual({ ok: true, versao: 1 });
    expect((await estado.banco.notaFiscalRecebida.findUniqueOrThrow({ where: { id: nota.id } }))).toMatchObject({ xml, ultimaManifestacao: "CIENCIA_DA_OPERACAO", tratamentoLocal: "IGNORADA", dataDevolucao: null, tratamentoLocalVersao: 1 });
    const reabrir = { ...ignorar, versao: 1, acao: "REABRIR" as const, motivo: "Reabertura sintética para conferir esta nota." };
    expect(await tratarOutraOperacaoNotaAction(reabrir)).toEqual({ ok: true, versao: 2 });
    expect(await tratarOutraOperacaoNotaAction(reabrir)).toEqual({ ok: true, versao: 2 });
    expect(await estado.banco.notaFiscalRecebida.findUniqueOrThrow({ where: { id: nota.id } })).toMatchObject({ xml, ultimaManifestacao: "CIENCIA_DA_OPERACAO", tratamentoLocal: null, dataDevolucao: null, tratamentoLocalEm: null, motivoTratamentoLocal: null, tratamentoLocalVersao: 2 });
    expect(await estado.banco.historicoAcesso.count({ where: { entidade: "NOTA_FISCAL_RECEBIDA", entidadeId: nota.id } })).toBe(2);
    expect(await estado.banco.manifestacaoNFe.count({ where: { notaFiscalId: nota.id } })).toBe(0);
    expect(estado.manifestar).not.toHaveBeenCalled();
    await conferirSemCompra(nota.id);
  });

  it("repetição idêntica não duplica evento/auditoria e revisão antiga não troca conteúdo", async () => {
    const { nota, entrada } = await criarNota();
    expect(await tratarOutraOperacaoNotaAction(entrada)).toEqual({ ok: true, versao: 1 });
    expect(await tratarOutraOperacaoNotaAction(entrada)).toEqual({ ok: true, versao: 1 });
    expect(await tratarOutraOperacaoNotaAction({ ...entrada, motivo: "Outro motivo sintético para um formulário antigo." })).toHaveProperty("erro");
    expect(estado.manifestar).toHaveBeenCalledOnce();
    expect(await estado.banco.manifestacaoNFe.count({ where: { notaFiscalId: nota.id } })).toBe(1);
    expect(await estado.banco.historicoAcesso.count({ where: { entidadeId: nota.id, entidade: "NOTA_FISCAL_RECEBIDA" } })).toBe(1);
  });

  it("outra submissão concorrente não atravessa a coordenação fiscal da mesma nota", async () => {
    const { nota, entrada } = await criarNota();
    const registrar = estado.manifestar.getMockImplementation()!;
    let liberar!: () => void;
    let sinalizar!: () => void;
    const bloqueio = new Promise<void>(resolve => { liberar = resolve; });
    const iniciou = new Promise<void>(resolve => { sinalizar = resolve; });
    estado.manifestar.mockImplementationOnce(async (...args) => { sinalizar(); await bloqueio; return registrar(...args); });
    const primeira = tratarOutraOperacaoNotaAction(entrada);
    try {
      await iniciou;
      expect(await tratarOutraOperacaoNotaAction({ ...entrada, acao: "IGNORAR" })).toMatchObject({ erro: expect.stringContaining("sendo atualizada") });
    } finally { liberar(); }
    expect(await primeira).toEqual({ ok: true, versao: 1 });
    expect(await estado.banco.historicoAcesso.count({ where: { entidadeId: nota.id, entidade: "NOTA_FISCAL_RECEBIDA" } })).toBe(1);
    expect(estado.manifestar).toHaveBeenCalledOnce();
  }, 15_000);

  it("relê permissão revogada no banco antes de confirmar ou ocultar a nota", async () => {
    const { nota, entrada } = await criarNota();
    await estado.banco.usuario.update({ where: { id: estado.sessao.userId }, data: { perfilAcessoId: null } });
    expect(await tratarOutraOperacaoNotaAction(entrada)).toMatchObject({ erro: expect.stringContaining("permissão") });
    expect(await tratarOutraOperacaoNotaAction({ ...entrada, acao: "IGNORAR" })).toMatchObject({ erro: expect.stringContaining("permissão") });
    expect(estado.manifestar).not.toHaveBeenCalled();
    expect(await estado.banco.historicoAcesso.count({ where: { entidadeId: nota.id, entidade: "NOTA_FISCAL_RECEBIDA" } })).toBe(0);
    expect(await estado.banco.notaFiscalRecebida.findUniqueOrThrow({ where: { id: nota.id } })).toMatchObject({ tratamentoLocal: null, tratamentoLocalVersao: 0 });
  });

  it("rollback local após confirmação mantém evento fiscal e retoma sem reenvio", async () => {
    const { nota, entrada } = await criarNota();
    await banco!.query(`INSERT INTO "${esquema}".falha_auditoria_manifestacao (id) VALUES ($1)`, [nota.id]);
    try {
      expect(await tratarOutraOperacaoNotaAction(entrada)).toMatchObject({ erro: expect.stringContaining("sem reenviar à SEFAZ") });
      expect(await estado.banco.notaFiscalRecebida.findUniqueOrThrow({ where: { id: nota.id } })).toMatchObject({ ultimaManifestacao: "CONFIRMACAO_DA_OPERACAO", tratamentoLocal: null, dataDevolucao: null, tratamentoLocalVersao: 0 });
      expect(await estado.banco.manifestacaoNFe.count({ where: { notaFiscalId: nota.id } })).toBe(1);
      expect(await estado.banco.historicoAcesso.count({ where: { entidadeId: nota.id, entidade: "NOTA_FISCAL_RECEBIDA" } })).toBe(0);
    } finally {
      await banco!.query(`DELETE FROM "${esquema}".falha_auditoria_manifestacao WHERE id = $1`, [nota.id]);
    }
    expect(await tratarOutraOperacaoNotaAction(entrada)).toEqual({ ok: true, versao: 1 });
    expect(estado.manifestar).toHaveBeenCalledOnce();
    expect(await estado.banco.manifestacaoNFe.count({ where: { notaFiscalId: nota.id } })).toBe(1);
    expect(await estado.banco.historicoAcesso.count({ where: { entidadeId: nota.id, entidade: "NOTA_FISCAL_RECEBIDA" } })).toBe(1);
    await conferirSemCompra(nota.id);
  });

  it.each(["IGNORAR", "DEVOLUCAO"] as const)("formulários antigos não integram nem recusam nota tratada por %s", async acao => {
    const { nota, entrada } = await criarNota();
    const item = await estado.banco.notaFiscalItem.create({ data: { notaFiscalId: nota.id, numeroItem: 1, codigoProdutoFornecedor: "sintetico", descricaoProduto: "Equipamento sintético", unidadeComercial: "UN", quantidadeComercial: 1, valorTotalItem: 100 } });
    expect(await tratarOutraOperacaoNotaAction({ ...entrada, acao })).toEqual({ ok: true, versao: 1 });
    const chamadasFiscais = estado.manifestar.mock.calls.length;
    const compraAntiga = { notaFiscalId: nota.id, localId: "", dataEntradaEstoque: "2024-02-29", itens: [{ notaFiscalItemId: item.id, acao: "CONCILIAR" as const, destino: "USO_E_CONSUMO" as const, categoriaFinanceiraId: "categoria-sintetica", valorTotal: 100 }], duplicatas: [{ numero: "001", dataVencimento: "2024-03-30", valor: 100 }] };
    expect(await aceitarNotaAction(compraAntiga)).toHaveProperty("erro");
    expect(await confirmarConciliacaoNotaAction(compraAntiga)).toHaveProperty("erro");
    expect(await manifestarAction(nota.chaveAcesso, "DESCONHECIMENTO_DA_OPERACAO")).toMatchObject({ sucesso: false });
    expect(estado.manifestar).toHaveBeenCalledTimes(chamadasFiscais);
    expect(await estado.banco.notaFiscalItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({ status: "PENDENTE", dataRecebimento: null });
    await conferirSemCompra(nota.id);
  });
});
