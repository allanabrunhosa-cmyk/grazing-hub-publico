import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";

const migration = "20261019180000_clientes_identidade_email";
const esquema = `teste_clientes_email_${randomUUID().replaceAll("-", "")}`;
let banco: Client, url: string, sql: string, transacao = false;
const endereco = (numero: string) => ({ nome: "Principal", destinatario: "", pais: "Brasil", cep: "01001000", logradouro: "Rua Sintética", numero, complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" });
const pf = (numero: string) => ({ ...endereco(numero), tipo: "PF", nomeCompleto: "Pessoa sintética", documento: "12345678901" });
const pj = (numero: string) => ({ ...endereco(numero), tipo: "PJ", razaoSocial: "Empresa sintética", documento: "12345678000190" });
type Registro = Record<string, unknown>;
async function cliente(id: string, dados: Registro = {}, conexao = banco) {
  const valores = { id, nome: id, tipo: "PF", ...dados };
  const campos = Object.keys(valores), conteudos = Object.entries(valores).map(([k, v]) => v !== null && ["enderecos", "entregaPadrao", "formasPagamentoHabilitadas"].includes(k) ? JSON.stringify(v) : v);
  await conexao.query(`INSERT INTO "ClienteVenda" (${campos.map(c => `"${c}"`).join(",")},"updatedAt") VALUES (${campos.map((_, i) => `$${i + 1}`).join(",")},now())`, conteudos);
}
async function pedido(id: string, clienteId: string, dados: Registro = {}, conexao = banco) {
  const valores = { id, clienteId, chaveCriacao: id, hashCriacao: id, criadoPorId: "usuario-sintetico-email", status: "CONFIRMADO", ...dados };
  const campos = Object.keys(valores), conteudos = Object.entries(valores).map(([k, v]) => v !== null && ["rascunho", "compradorSnapshot", "cobrancaSnapshot", "enderecoSnapshot", "entregaSnapshot", "destinatarioSnapshot"].includes(k) ? JSON.stringify(v) : v);
  await conexao.query(`INSERT INTO "PedidoVenda" (${campos.map(c => `"${c}"`).join(",")},"updatedAt") VALUES (${campos.map((_, i) => `$${i + 1}`).join(",")},now())`, conteudos);
}
async function migrar() { await banco.query(sql); }
async function falhaSemAlterar(codigo: string) {
  const antes = (await banco.query(`SELECT jsonb_agg(to_jsonb(c) ORDER BY id) AS clientes FROM "ClienteVenda" c`)).rows[0].clientes;
  await banco.query("SAVEPOINT antes_da_migration");
  await expect(migrar()).rejects.toThrow(codigo);
  await banco.query("ROLLBACK TO SAVEPOINT antes_da_migration");
  expect((await banco.query(`SELECT jsonb_agg(to_jsonb(c) ORDER BY id) AS clientes FROM "ClienteVenda" c`)).rows[0].clientes).toEqual(antes);
  expect((await banco.query(`SELECT count(*)::integer AS n FROM "HistoricoCadastroVenda" WHERE "usuarioId"='sistema:clientes-email-20261019'`)).rows[0].n).toBe(0);
  expect((await banco.query(`SELECT to_regclass('"ClienteIdentidadeSerializacao"') AS tabela`)).rows[0].tabela).toBeNull();
}
async function novaConexao() {
  const c = new Client({ connectionString: url }); await c.connect(); await c.query(`SET search_path TO "${esquema}"`); return c;
}

describe.skipIf(process.env.PEDIDOS_BANCO_TESTE !== "1")("Identidade de clientes na migration PostgreSQL isolada", () => {
  beforeAll(async () => {
    const destino = new URL(process.env.DATABASE_URL ?? "");
    if (!["localhost", "127.0.0.1"].includes(destino.hostname) || !/^\/teste_[a-z0-9_]+$/.test(destino.pathname)) throw Error("Somente banco local fictício teste_.");
    url = destino.toString(); banco = new Client({ connectionString: url }); await banco.connect();
    await banco.query(`CREATE SCHEMA "${esquema}"`); await banco.query(`SET search_path TO "${esquema}"`);
    const pastas = (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory() && p.name < migration).sort((a, b) => a.name.localeCompare(b.name));
    for (const p of pastas) await banco.query(prepararSqlMigrationFiscal(p.name, await readFile(`prisma/migrations/${p.name}/migration.sql`, "utf8")));
    await banco.query(`INSERT INTO "Usuario" (id,nome,email,"senhaHash","updatedAt") VALUES ('usuario-sintetico-email','Operador sintético','operador-email@example.invalid','inutil',now())`);
    sql = await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8");
  }, 90000);
  beforeEach(async () => { await banco.query("BEGIN"); transacao = true; });
  afterEach(async () => { if (transacao) { await banco.query("ROLLBACK"); transacao = false; } });
  afterAll(async () => { if (!banco) return; if (transacao) await banco.query("ROLLBACK"); if (/^teste_clientes_email_[a-f0-9]{32}$/.test(esquema)) await banco.query(`DROP SCHEMA "${esquema}" CASCADE`); await banco.end(); });

  it("consolida por email de aliases, prefere PJ documentada e conserva origens, contatos e snapshots", async () => {
    await cliente("empresa", { tipo: "PJ", nome: "Empresa sintética", documento: "12345678000190", email: " Empresa@Example.Invalid " });
    await cliente("pessoa", { nome: "Pessoa sintética", documento: "12345678901", email: "pessoa@example.invalid", enderecos: [pf("42")] });
    await cliente("alias", { ativo: false, unificadoEmId: "pessoa", email: "EMPRESA@EXAMPLE.INVALID" });
    await cliente("alias-antigo", { ativo: false, unificadoEmId: "alias" });
    const snapshots = { compradorSnapshot: { nome: "Nome fotografado", documento: "99999999999" }, cobrancaSnapshot: pj("99"), enderecoSnapshot: endereco("88"), entregaSnapshot: { recibo: "original" }, destinatarioSnapshot: { nome: "Destinatário fotografado" }, total: "123.45" };
    await pedido("historico", "pessoa", { ...snapshots, enderecoSnapshot: null, numero: -101, status: "HISTORICO", statusOperacional: "HISTORICO", origem: "HISTORICO_LEGADO", referenciaOrigem: "grazing-legado-orders", referenciaEstabelecimento: "grazing-hub", referenciaPedido: "101", modoFinanceiro: "EXTERNO", versaoFinanceiro: 0, rascunho: { clienteId: "pessoa", itens: [], observacoes: "original" } });
    await pedido("operacional", "pessoa", snapshots);
    await banco.query(`INSERT INTO "ContatoClienteVenda" (id,"clienteId","clienteOrigemId",nome,origem,"chaveOrigem","updatedAt") VALUES ('contato','pessoa','alias','Contato sintético','FIXTURE','chave',now())`);
    await banco.query(`INSERT INTO "IdentidadeExternaVenda" (id,origem,loja,entidade,chave,"destinoId","resumoOrigem","dadosOrigem","versaoDestino","updatedAt") VALUES ('fonte','grazing-legado-orders','grazing-hub','CLIENTE_HISTORICO','chave','pessoa','hash','{}',1,now())`);
    const antesPedidos = (await banco.query(`SELECT id,to_jsonb(p)-'clienteId'-'rascunho'-'versao'-'updatedAt' AS foto FROM "PedidoVenda" p ORDER BY id`)).rows;
    const antesFontes = (await banco.query(`SELECT to_jsonb(f) AS foto FROM "IdentidadeExternaVenda" f`)).rows;
    const antesContatos = (await banco.query(`SELECT to_jsonb(c) AS foto FROM "ContatoClienteVenda" c`)).rows;
    await migrar();
    const clientes = (await banco.query(`SELECT * FROM "ClienteVenda" ORDER BY id`)).rows;
    expect(clientes.filter(c => c.unificadoEmId === null).map(c => c.id)).toEqual(["empresa"]);
    expect(clientes.filter(c => c.id !== "empresa").every(c => !c.ativo && c.unificadoEmId === "empresa")).toBe(true);
    expect(clientes.find(c => c.id === "pessoa").documento).toBe("12345678901");
    const raiz = clientes.find(c => c.id === "empresa");
    expect(raiz).toMatchObject({ email: "empresa@example.invalid", documento: "12345678000190" });
    expect(raiz.enderecos).toMatchObject([{ nome: "Principal", tipo: "PJ", documento: "12345678000190", cep: "" }, { nome: "Cobrança 2", tipo: "PF", documento: "12345678901", numero: "42" }]);
    expect((await banco.query(`SELECT id,to_jsonb(p)-'clienteId'-'rascunho'-'versao'-'updatedAt' AS foto FROM "PedidoVenda" p ORDER BY id`)).rows).toEqual(antesPedidos);
    expect((await banco.query(`SELECT "clienteId",versao FROM "PedidoVenda"`)).rows).toEqual([{ clienteId: "empresa", versao: 2 }, { clienteId: "empresa", versao: 2 }]);
    expect((await banco.query(`SELECT rascunho FROM "PedidoVenda" WHERE id='historico'`)).rows[0].rascunho).toEqual({ clienteId: "empresa", itens: [], observacoes: "original" });
    expect((await banco.query(`SELECT to_jsonb(f) AS foto FROM "IdentidadeExternaVenda" f`)).rows).toEqual(antesFontes);
    expect((await banco.query(`SELECT to_jsonb(c) AS foto FROM "ContatoClienteVenda" c`)).rows).toEqual(antesContatos);
    const auditorias = (await banco.query(`SELECT * FROM "HistoricoCadastroVenda" WHERE "usuarioId"='sistema:clientes-email-20261019' ORDER BY id`)).rows;
    expect(auditorias).toHaveLength(6);
    expect(auditorias.every(a => a.usuarioNome === "Automação autorizada" && a.antes && a.depois && a.id.startsWith("clientes-email-20261019:"))).toBe(true);
    expect(auditorias.filter(a => a.entidade === "PEDIDO_IDENTIDADE_CLIENTE").every(a => a.antes.clienteId === "pessoa" && a.depois.clienteId === "empresa")).toBe(true);
    await migrar();
    expect((await banco.query(`SELECT count(*)::integer AS n FROM "HistoricoCadastroVenda" WHERE "usuarioId"='sistema:clientes-email-20261019'`)).rows[0].n).toBe(6);
  });
  it.each([
    { caso: "pedidos operacionais", dados: {}, operacional: true },
    { caso: "mais dados", dados: { telefone: "+5511999990000" }, operacional: false },
  ])("desempata raízes por $caso antes da criação mais antiga", async ({ dados, operacional }) => {
    await cliente("antigo", { email: "igual@example.invalid", createdAt: "2020-01-01" });
    await cliente("completo", { email: "igual@example.invalid", createdAt: "2021-01-01", ...dados });
    if (operacional) await pedido("op", "completo");
    await migrar();
    expect((await banco.query(`SELECT id FROM "ClienteVenda" WHERE "unificadoEmId" IS NULL`)).rows).toEqual([{ id: "completo" }]);
  });
  it("considera documento geral e Principal do mesmo tipo, sem unir por cobrança adicional ou de outro tipo", async () => {
    await cliente("com-json", { tipo: "PJ", email: "json@example.invalid", enderecos: [pj("1")], createdAt: "2020-01-01" });
    await cliente("com-geral", { tipo: "PJ", email: "geral@example.invalid", documento: "12.345.678/0001-90", createdAt: "2021-01-01" });
    await cliente("adicional", { documento: "22222222222", enderecos: [pf("3"), pj("4")] });
    await cliente("outro-tipo", { enderecos: [pj("5")] });
    await migrar();
    expect((await banco.query(`SELECT id FROM "ClienteVenda" WHERE "unificadoEmId" IS NULL ORDER BY id`)).rows).toEqual([{ id: "adicional" }, { id: "com-json" }, { id: "outro-tipo" }]);
    expect((await banco.query(`SELECT documento FROM "ClienteVenda" WHERE id='com-json'`)).rows[0].documento).toBe("12345678000190");
  });
  it("aborta sem transferir documento geral do alias que colidiria com documento_key", async () => {
    await cliente("json", { tipo: "PJ", enderecos: [pj("1")], createdAt: "2020-01-01" });
    await cliente("geral", { tipo: "PJ", documento: "12345678000190", createdAt: "2021-01-01" });
    await falhaSemAlterar("CLIENTES_EMAIL_DOCUMENTO_GLOBAL_COLISAO_ALIAS");
  });
  it("aborta qualquer carteira nos membros mesmo com saldo líquido zero", async () => {
    await cliente("a", { email: "igual@example.invalid" }); await cliente("b", { email: "igual@example.invalid" });
    await pedido("credito", "b");
    await banco.query(`INSERT INTO "CreditoClienteMovimento" (id,"clienteId",tipo,valor,"pedidoAplicacaoId","origemMovimentoId",data,"chaveOperacao","hashOperacao","criadoPorId") VALUES ('negativo','b','APLICACAO',10,'credito',null,now(),'negativo','hash','usuario-sintetico-email'),('positivo','b','LIBERACAO',10,'credito','negativo',now(),'positivo','hash','usuario-sintetico-email')`);
    await falhaSemAlterar("CLIENTES_EMAIL_CREDITO_EXISTENTE");
  });
  it("mantém raiz utilizável e consolida regras pela opção mais restritiva, com precisão Decimal", async () => {
    await banco.query(`INSERT INTO "FormaPagamentoVenda"(id,nome,tipo,"updatedAt") VALUES ('pix-sintetico','PIX sintético','PIX',now()),('boleto-sintetico','Boleto sintético','BOLETO',now())`);
    await cliente("empresa", { tipo: "PJ", documento: "12345678000190", ativo: false, email: "igual@example.invalid", limiteCreditoAberto: null, boletoDiasAposEntrega: null });
    await cliente("pessoa", { email: "igual@example.invalid", limiteCreditoAberto: "100.15", boletoDiasAposEntrega: 14, formasPagamentoHabilitadas: ["pix-sintetico", "boleto-sintetico"] });
    await cliente("restrito", { email: "igual@example.invalid", limiteCreditoAberto: "50.07", boletoDiasAposEntrega: 7, formasPagamentoHabilitadas: ["pix-sintetico"] });
    await migrar();
    expect((await banco.query(`SELECT ativo,"limiteCreditoAberto"::text AS limite,"boletoDiasAposEntrega" AS prazo,"formasPagamentoHabilitadas" AS formas FROM "ClienteVenda" WHERE id='empresa'`)).rows[0]).toEqual({ ativo: true, limite: "50.07", prazo: 7, formas: ["pix-sintetico"] });
    const auditoria = (await banco.query(`SELECT antes,depois FROM "HistoricoCadastroVenda" WHERE "registroId"='empresa'`)).rows[0];
    expect(auditoria.antes).toMatchObject({ ativo: false, limiteCreditoAberto: null });
    expect(auditoria.depois).toMatchObject({ ativo: true, limiteCreditoAberto: 50.07 });
  });
  it("aborta regras financeiras sem mapeamento, sem inventar forma de pagamento", async () => {
    await cliente("a", { email: "igual@example.invalid", formasPagamentoHabilitadas: ["forma-inexistente"] });
    await cliente("b", { email: "igual@example.invalid" });
    await falhaSemAlterar("CLIENTES_EMAIL_FORMA_PAGAMENTO_SEM_MAPEAMENTO");
  });
  it("preserva regras e situação de família já unificada sem nova consolidação", async () => {
    await cliente("raiz", { ativo: false, limiteCreditoAberto: null, boletoDiasAposEntrega: null });
    await cliente("alias", { unificadoEmId: "raiz", ativo: false, limiteCreditoAberto: "0", boletoDiasAposEntrega: 0, formasPagamentoHabilitadas: [] });
    const antes = (await banco.query(`SELECT id,ativo,"limiteCreditoAberto","boletoDiasAposEntrega","formasPagamentoHabilitadas" FROM "ClienteVenda" ORDER BY id`)).rows;
    await migrar();
    expect((await banco.query(`SELECT id,ativo,"limiteCreditoAberto","boletoDiasAposEntrega","formasPagamentoHabilitadas" FROM "ClienteVenda" ORDER BY id`)).rows).toEqual(antes);
  });
  it("aborta excesso de cobranças sem truncar os endereços", async () => {
    await cliente("a", { email: "igual@example.invalid", enderecos: Array.from({ length: 11 }, (_, n) => endereco(String(n))) });
    await cliente("b", { email: "igual@example.invalid", enderecos: Array.from({ length: 11 }, (_, n) => endereco(String(n + 20))) });
    await falhaSemAlterar("CLIENTES_EMAIL_LIMITE_COBRANCAS");
  });
  it("aborta ciclo e preserva integralmente os registros originais", async () => {
    await cliente("a"); await cliente("b", { ativo: false, unificadoEmId: "a" });
    await banco.query(`UPDATE "ClienteVenda" SET "unificadoEmId"='b',ativo=false WHERE id='a'`);
    await falhaSemAlterar("CLIENTES_EMAIL_CICLO_ALIAS");
  });
  it.each([
    { dados: { email: "email sem formato" }, erro: "CLIENTES_EMAIL_EMAIL_ORIGEM_INVALIDO" },
    { dados: { documento: "abc12345678901" }, erro: "CLIENTES_EMAIL_DOCUMENTO_ORIGEM_INVALIDO" },
  ])("aborta formato legado inválido sem converter texto em documento ($erro)", async ({ dados, erro }) => {
    await cliente("invalido", dados); await falhaSemAlterar(erro);
  });
  it("aborta ambiguidade entre FK e rascunho de raízes diferentes", async () => {
    await cliente("a"); await cliente("b"); await pedido("op", "a", { rascunho: { clienteId: "b" } });
    await falhaSemAlterar("CLIENTES_EMAIL_RASCUNHO_RAIZES_DIVERGENTES");
  });
  it("normaliza e reserva identidades inclusive em inativos e aliases, sem restringir terceiros adicionais", async () => {
    await cliente("empresa", { tipo: "PJ", documento: "12345678000190", email: "igual@example.invalid" });
    await cliente("pessoa", { documento: "12345678901", email: "igual@example.invalid" });
    await migrar();
    for (const dados of [{ email: " IGUAL@EXAMPLE.INVALID ", ativo: false }, { documento: "123.456.789-01" }, { tipo: "PJ", documento: "12.345.678/0001-90" }]) {
      await banco.query("SAVEPOINT cadastro_repetido");
      await expect(cliente("duplicado", dados)).rejects.toMatchObject({ code: "23505" });
      await banco.query("ROLLBACK TO SAVEPOINT cadastro_repetido");
    }
    await cliente("terceiro", { email: " NOVO@EXAMPLE.INVALID ", documento: "222.222.222-22", enderecos: [endereco("1"), pj("2")] });
    expect((await banco.query(`SELECT email,documento FROM "ClienteVenda" WHERE id='terceiro'`)).rows[0]).toEqual({ email: "novo@example.invalid", documento: "22222222222" });
    await banco.query("SAVEPOINT ativar_alias"); await expect(banco.query(`UPDATE "ClienteVenda" SET ativo=true WHERE id='pessoa'`)).rejects.toThrow("CLIENTE_ALIAS_NAO_PODE_SER_ATIVADO"); await banco.query("ROLLBACK TO SAVEPOINT ativar_alias");
    await banco.query("SAVEPOINT apagar_alias"); await expect(banco.query(`DELETE FROM "ClienteVenda" WHERE id='pessoa'`)).rejects.toThrow("CLIENTE_EXCLUSAO_NAO_PERMITIDA"); await banco.query("ROLLBACK TO SAVEPOINT apagar_alias");
    await pedido("compatibilidade", "pessoa", { rascunho: { clienteId: "pessoa", observacoes: "original" }, cobrancaSnapshot: pf("77") });
    expect((await banco.query(`SELECT "clienteId",rascunho,"cobrancaSnapshot" FROM "PedidoVenda" WHERE id='compatibilidade'`)).rows[0]).toEqual({ clienteId: "empresa", rascunho: { clienteId: "empresa", observacoes: "original" }, cobrancaSnapshot: pf("77") });
  });
  it("protege corrida SQL e rejeita snapshot REPEATABLE READ anterior à reserva de um alias", async () => {
    await cliente("raiz", { documento: "12345678901" }); await migrar(); await banco.query("COMMIT"); transacao = false;
    const a = await novaConexao(), b = await novaConexao();
    try {
      await a.query("BEGIN"); await b.query("BEGIN");
      await cliente("concorrente-a", { email: "concorrente@example.invalid" }, a);
      const segunda = cliente("concorrente-b", { email: " CONCORRENTE@EXAMPLE.INVALID " }, b).then(() => null, erro => erro);
      await a.query("COMMIT"); expect(await segunda).toMatchObject({ code: "23505" }); await b.query("ROLLBACK");
      await b.query("BEGIN ISOLATION LEVEL REPEATABLE READ"); await b.query(`SELECT count(*) FROM "ClienteVenda"`);
      await a.query("BEGIN"); await cliente("nova-reserva-alias", { email: "reservado@example.invalid", ativo: false, unificadoEmId: "raiz" }, a); await a.query("COMMIT");
      await expect(cliente("snapshot-antigo", { email: "reservado@example.invalid" }, b)).rejects.toMatchObject({ code: "40001" }); await b.query("ROLLBACK");
      expect((await banco.query(`SELECT count(*)::integer AS n FROM "ClienteVenda" WHERE id IN ('concorrente-b','snapshot-antigo')`)).rows[0].n).toBe(0);
    } finally { await a.query("ROLLBACK"); await b.query("ROLLBACK"); await a.end(); await b.end(); }
  });
  it("aceita SQL completo em uma simple query atômica, sem BEGIN externo", async () => {
    await banco.query("ROLLBACK"); transacao = false;
    await migrar();
    const antes = (await banco.query(`SELECT jsonb_agg(to_jsonb(c) ORDER BY id) AS clientes FROM "ClienteVenda" c`)).rows[0].clientes;
    await migrar();
    expect((await banco.query(`SELECT jsonb_agg(to_jsonb(c) ORDER BY id) AS clientes FROM "ClienteVenda" c`)).rows[0].clientes).toEqual(antes);
    expect((await banco.query(`SELECT to_regclass('pg_temp._clientes_email_base') AS tabela`)).rows[0].tabela).toBeNull();
  });
});
