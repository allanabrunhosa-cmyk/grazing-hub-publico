import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const estado = vi.hoisted(() => ({ banco: null as unknown as PrismaClient }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn(async () => ({ userId: "usuario-ficticio", admin: true, versao: 0 })) }));
vi.mock("@/lib/session", () => ({ getSession: vi.fn(async () => ({ userId: "usuario-ficticio" })) }));
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, { get: (_objeto, chave) => {
  const valor = Reflect.get(estado.banco, chave);
  return typeof valor === "function" ? valor.bind(estado.banco) : valor;
} }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { consultarExclusaoInsumoAction, deleteInsumoAction, saveInsumoAction } from "@/app/(protegido)/insumos/actions";
import { alterarStatusInsumoAction } from "@/app/(protegido)/status-cadastros-actions";
import { coberturaComposicaoPedido } from "@/lib/vendas/pedidos-composicao";
import { executarFisicoPedido } from "@/lib/vendas/pedidos-fisico";
import { executarAutomaticoGestorNaTransacao } from "@/lib/vendas/pedidos-fisico-gestor";
import { conferirInsumosComposicao } from "@/lib/insumos/exclusao-servidor";
describe.skipIf(process.env.EXCLUSAO_INSUMOS_BANCO_TESTE !== "1")("exclusão em PostgreSQL fictício isolado", () => {
  let pool: Pool;
  let schema: string;
  const previa = async () => (await consultarExclusaoInsumoAction("insumo")).vinculos!.revisao!;
  const excluir = async () => deleteInsumoAction("insumo", await previa());
  beforeAll(async () => {
    const conexao = process.env.EXCLUSAO_INSUMOS_DATABASE_URL;
    if (!conexao) throw new Error("Informe o banco local exclusivo insumos_exclusao_teste.");
    const url = new URL(conexao);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      || url.pathname !== "/insumos_exclusao_teste" || [...url.searchParams].length) throw new Error("Somente banco local insumos_exclusao_teste, sem opções adicionais.");
    schema = `exclusao_teste_${randomBytes(8).toString("hex")}`;
    url.searchParams.set("options", `-c search_path=${schema}`);
    pool = new Pool({ connectionString: url.toString(), max: 3, connectionTimeoutMillis: 10000 });
    await pool.query(`CREATE SCHEMA "${schema}"`);
    estado.banco = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }, { schema }) });
    const migrations = (await readdir("prisma/migrations", { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort();
    for (const nome of migrations) await pool.query(prepararSqlMigrationFiscal(nome, await readFile(path.join("prisma/migrations", nome, "migration.sql"), "utf8")));
  }, 60000);
  beforeEach(async () => {
    await pool.query('TRUNCATE "Insumo", "ProdutoVenda", "GrupoComplementoVenda", "LocalEstoque", "Fornecedor", "Usuario", "PerfilAcesso" CASCADE');
    await estado.banco.perfilAcesso.create({ data: { id: "admin", nome: "Administrador fictício", sistema: "ADMINISTRADOR" } });
    await estado.banco.usuario.create({ data: { id: "usuario-ficticio", nome: "Operador fictício", email: "operador@example.invalid", senhaHash: "nao-utilizada", perfilAcessoId: "admin" } });
    await estado.banco.insumo.create({ data: { id: "insumo", nome: "Farinha fictícia", unidade: "KG", custoMedio: 10 } });
  });
  afterAll(async () => {
    if (estado.banco) await estado.banco.$disconnect();
    if (pool && schema) { await pool.query(`DROP SCHEMA "${schema}" CASCADE`); await pool.end(); }
  });
  it("retira do catálogo, audita o autor e repetir preserva conversões e a data da exclusão", async () => {
    await estado.banco.conversaoInsumo.create({ data: { insumoId: "insumo", unidade: "G", fator: "0.001" } });
    const revisao = await previa();
    expect(await deleteInsumoAction("insumo", revisao)).toEqual({ error: null });
    const antes = await estado.banco.insumo.findUniqueOrThrow({ where: { id: "insumo" } });
    expect(antes).toMatchObject({ ativo: false, excluidoPorId: "usuario-ficticio", exclusaoSnapshot: { autorId: "usuario-ficticio" } });
    expect(antes.excluidoEm).toBeInstanceOf(Date);
    expect(await estado.banco.insumo.count({ where: { excluidoEm: null } })).toBe(0);
    expect(await estado.banco.conversaoInsumo.count()).toBe(1);
    expect(await deleteInsumoAction("insumo", revisao)).toEqual({ error: null });
    const depois = await estado.banco.insumo.findUniqueOrThrow({ where: { id: "insumo" } });
    expect(depois.excluidoEm).toEqual(antes.excluidoEm);
    expect(depois.exclusaoSnapshot).toEqual(antes.exclusaoSnapshot);
  });
  it("lista preparação inativa e retira apenas o ingrediente confirmado com precisão auditada", async () => {
    await estado.banco.insumo.createMany({ data: [{ id: "massa", nome: "Massa fictícia", tipo: "PRODUTO_INTERMEDIARIO", unidade: "KG", ativo: false }, { id: "outro", nome: "Sal fictício", unidade: "KG" }] });
    await estado.banco.composicaoInsumo.createMany({ data: [{ produtoId: "massa", componenteId: "insumo", quantidade: "0.123456789" }, { produtoId: "massa", componenteId: "outro", quantidade: "0.01" }] });
    expect((await consultarExclusaoInsumoAction("insumo")).vinculos?.preparacoes).toEqual([{ id: "massa", nome: "Massa fictícia" }]);
    expect(await excluir()).toEqual({ error: null });
    expect(await estado.banco.composicaoInsumo.findMany()).toMatchObject([{ componenteId: "outro" }]);
    const audit = (await estado.banco.insumo.findUniqueOrThrow({ where: { id: "insumo" } })).exclusaoSnapshot as Prisma.JsonObject;
    expect(audit.preparacoes).toMatchObject([{ quantidade: "0.123456789" }]);
  });
  it("lista produtos, complementos e múltiplos papéis e mantém os demais componentes", async () => {
    await estado.banco.insumo.create({ data: { id: "outro", nome: "Sal fictício", unidade: "KG" } });
    await estado.banco.produtoVenda.createMany({ data: [
      { id: "principal", nome: "Pão fictício", classificacoes: ["PRINCIPAL"] },
      { id: "complemento", nome: "Crouton fictício", classificacoes: ["COMPLEMENTO"], ativo: false },
      { id: "duplo", nome: "Biscoito fictício", classificacoes: ["PRINCIPAL", "OPCAO"] },
    ] });
    await estado.banco.componenteProdutoVenda.createMany({ data: [...["principal", "complemento", "duplo"].map(produtoId => ({ produtoId, insumoId: "insumo", unidade: "KG" as const, quantidade: "0.25" })), { produtoId: "principal", insumoId: "outro", unidade: "KG", quantidade: "0.01" }] });
    await estado.banco.grupoComplementoVenda.create({ data: { id: "grupo", nome: "Opções fictícias" } });
    await estado.banco.opcaoComplementoVenda.create({ data: { grupoId: "grupo", produtoId: "principal", nome: "Porção de pão" } });
    const vinculos = (await consultarExclusaoInsumoAction("insumo")).vinculos!;
    expect(vinculos.complementos.map(i => i.id)).toEqual(["duplo", "complemento", "principal"]);
    expect(vinculos.produtos.map(i => i.id)).toEqual(["duplo", "principal"]);
    expect(await excluir()).toEqual({ error: null });
    expect(await estado.banco.componenteProdutoVenda.findMany()).toMatchObject([{ insumoId: "outro" }]);
    expect(await estado.banco.produtoVenda.count()).toBe(3);
    expect((await estado.banco.produtoVenda.findUniqueOrThrow({ where: { id: "principal" } })).versao).toBe(2);
  });
  it("retira composições JSON específicas sem apagar metadados nem substituir composição vazia", async () => {
    await estado.banco.produtoVenda.create({ data: { id: "produto", nome: "Produto fictício" } });
    await estado.banco.grupoComplementoVenda.create({ data: { id: "grupo", nome: "Extras fictícios" } });
    const c = { insumoId: "insumo", unidade: "KG", quantidade: "0.123456789", exibirFicha: true };
    const manter = { insumoId: "outro", unidade: "KG", quantidade: "0.02" };
    await estado.banco.opcaoComplementoVenda.create({ data: { id: "opcao", grupoId: "grupo", nome: "Extra fictício", composicao: [c, manter] } });
    await estado.banco.produtoGrupoVenda.create({ data: { produtoId: "produto", grupoId: "grupo", ajustesOpcoes: [{ opcaoId: "opcao", preco: "12", composicao: [c] }, { opcaoId: "outra", composicao: [manter] }] } });
    const vinculos = (await consultarExclusaoInsumoAction("insumo")).vinculos!;
    expect(vinculos.complementos).toEqual([{ id: "opcao", nome: "Extra fictício (Extras fictícios)" }]);
    expect(vinculos.produtos).toEqual([{ id: "produto", nome: "Produto fictício" }]);
    expect(await excluir()).toEqual({ error: null });
    expect((await estado.banco.opcaoComplementoVenda.findUniqueOrThrow({ where: { id: "opcao" } })).composicao).toEqual([manter]);
    expect((await estado.banco.produtoGrupoVenda.findUniqueOrThrow({ where: { produtoId_grupoId: { produtoId: "produto", grupoId: "grupo" } } })).ajustesOpcoes).toEqual([{ opcaoId: "opcao", preco: "12", composicao: [] }, { opcaoId: "outra", composicao: [manter] }]);
    expect((await estado.banco.grupoComplementoVenda.findUniqueOrThrow({ where: { id: "grupo" } })).versao).toBe(2);
  });
  it("preserva perdas, movimentos, contagem, compra em andamento e execução da venda fotografada", async () => {
    await estado.banco.localEstoque.create({ data: { id: "local", nome: "Estoque fictício" } });
    await estado.banco.saldoEstoque.create({ data: { insumoId: "insumo", localId: "local", quantidadeAtual: 10 } });
    await estado.banco.perda.create({ data: { insumoId: "insumo", localId: "local", motivo: "OUTRO", unidade: "KG", quantidade: "0.5", valorEstimado: "5" } });
    await estado.banco.movimentacaoEstoque.create({ data: { insumoId: "insumo", localId: "local", tipo: "SAIDA_PERDA", quantidade: "0.5" } });
    await estado.banco.inventarioContagem.create({ data: { id: "contagem", localId: "local", itens: { create: { insumoId: "insumo", quantidadeSistema: 10, quantidadeContada: 10 } } } });
    await estado.banco.pedidoCompra.create({ data: { id: "compra", status: "ENVIADO", fornecedorAvulso: "Fornecedor fictício", itens: { create: { insumoId: "insumo", quantidade: 2, unidadeCompra: "KG", fatorConversao: 1, unidadePrincipal: "KG", precoTotal: 20 } } } });
    await estado.banco.produtoVenda.create({ data: { id: "produto", nome: "Produto vendido fictício", componentes: { create: { insumoId: "insumo", unidade: "KG", quantidade: 1 } } } });
    const snapshot = [{ insumoId: "insumo", nome: "Farinha fictícia", unidade: "KG", quantidade: "1", origem: "PRODUTO" }];
    await estado.banco.pedidoVenda.create({ data: { id: "venda", chaveCriacao: "venda-ficticia", hashCriacao: "hash", criadoPorId: "usuario-ficticio", status: "CONFIRMADO", statusOperacional: "EM_PREPARO", itens: { create: { id: "item", produtoId: "produto", versaoPedido: 1, ordem: 0, quantidade: 1, unidadeSnapshot: "UN", produtoSnapshot: { nome: "Produto vendido fictício", tipo: "MONTAGEM" }, escolhasSnapshot: [], composicaoSnapshot: snapshot, estadoComposicao: "CONHECIDA", precoOriginal: 20, precoAplicado: 20, acrescimos: 0, totalLinha: 20 } } } });
    await estado.banco.itemPedidoVenda.create({ data: { id: "item-automatico", pedidoId: "venda", produtoId: "produto", versaoPedido: 1, ordem: 1, quantidade: 1, unidadeSnapshot: "UN", produtoSnapshot: { nome: "Produto vendido fictício", tipo: "MONTAGEM" }, escolhasSnapshot: [], composicaoSnapshot: snapshot, estadoComposicao: "CONHECIDA", precoOriginal: 20, precoAplicado: 20, acrescimos: 0, totalLinha: 20 } });
    const antes = await estado.banco.pedidoCompra.findUniqueOrThrow({ where: { id: "compra" }, include: { itens: true } });
    expect(await excluir()).toEqual({ error: null });
    expect(await estado.banco.pedidoCompra.findUniqueOrThrow({ where: { id: "compra" }, include: { itens: true } })).toEqual(antes);
    expect(await estado.banco.perda.count()).toBe(1);
    expect(await estado.banco.movimentacaoEstoque.count()).toBe(1);
    expect(await estado.banco.inventarioItem.count()).toBe(1);
    const item = await estado.banco.itemPedidoVenda.findUniqueOrThrow({ where: { id: "item" } });
    expect(item.composicaoSnapshot).toEqual(snapshot);
    const cobertura = await coberturaComposicaoPedido(estado.banco, [item]);
    expect(cobertura.itens[0].pendencias).toEqual([]);
    expect(cobertura.itens[0].necessidades[0].quantidade).toBe("1");
    await estado.banco.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { id: "singleton", pedidosLiberacao: { locais: ["local"] } }, update: { pedidosLiberacao: { locais: ["local"] } } });
    const sessao = { userId: "usuario-ficticio", nome: "Operador fictício", email: "operador@example.invalid", perfilNome: "Administrador fictício", admin: true, versao: 0, permissoes: {}, excecoes: {} };
    expect(await executarFisicoPedido("venda", 1, { tipo: "RESERVAR", itemId: "item", localId: "local", quantidade: "1" }, "reserva-ficticia-001", sessao)).toMatchObject({ versao: 2 });
    const reserva = await estado.banco.reservaPedido.findFirstOrThrow({ where: { itemId: "item" } });
    expect(await executarFisicoPedido("venda", 2, { tipo: "CONSUMIR", reservaId: reserva.id, quantidade: "1", motivo: "Ensaio isolado" }, "consumo-ficticio-001", sessao)).toMatchObject({ versao: 3 });
    expect((await estado.banco.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: "insumo", localId: "local" } } })).quantidadeAtual.toString()).toBe("9");
    expect((await estado.banco.itemPedidoVenda.findUniqueOrThrow({ where: { id: "item" } })).composicaoSnapshot).toEqual(snapshot);
    const pedido = await estado.banco.pedidoVenda.findUniqueOrThrow({ where: { id: "venda" }, include: { itens: true } });
    const politica = { movimentarEstoque: true, localMovimentarEstoqueId: "local", versao: 1 };
    await estado.banco.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { ...politica, locais: ["local"] } } });
    // Caminho automático sem reserva anterior e releitura de reserva já consumida.
    await estado.banco.$transaction(tx => executarAutomaticoGestorNaTransacao(tx, pedido, [{ tipo: "PREPARAR", itemId: "item-automatico", quantidade: "1" }], [], politica, sessao, "gestor-ficticio-001"));
    await estado.banco.$transaction(tx => executarAutomaticoGestorNaTransacao(tx, pedido, [{ tipo: "PREPARAR", itemId: "item", quantidade: "1" }], [], politica, sessao, "gestor-ficticio-002"));
    expect((await estado.banco.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: "insumo", localId: "local" } } })).quantidadeAtual.toString()).toBe("8");
  });
  it("revalida vínculos concorrentes e exige nova confirmação sem remoção parcial", async () => {
    const revisao = await previa();
    await estado.banco.produtoVenda.create({ data: { id: "concorrente", nome: "Produto concorrente fictício" } });
    const escritor = await pool.connect();
    try {
      await escritor.query("BEGIN");
      await escritor.query('INSERT INTO "ComponenteProdutoVenda" (id, "produtoId", "insumoId", quantidade, unidade, ordem) VALUES ($1,$2,$3,1,\'KG\',0)', ["vinculo-concorrente", "concorrente", "insumo"]);
      const exclusao = deleteInsumoAction("insumo", revisao);
      await vi.waitFor(async () => {
        const espera = await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FROM \"Insumo\"%FOR UPDATE%'");
        expect(espera.rowCount).toBeGreaterThan(0);
      }, { timeout: 5000, interval: 50 });
      await escritor.query("COMMIT");
      const resultado = await exclusao;
      expect(resultado.error).toMatch(/composições mudaram/);
      expect(resultado.vinculos?.produtos).toEqual([{ id: "concorrente", nome: "Produto concorrente fictício" }]);
      expect(await estado.banco.componenteProdutoVenda.count()).toBe(1);
      expect((await estado.banco.insumo.findUniqueOrThrow({ where: { id: "insumo" } })).excluidoEm).toBeNull();
      expect(await deleteInsumoAction("insumo", resultado.vinculos?.revisao)).toEqual({ error: null });
    } finally { await escritor.query("ROLLBACK"); escritor.release(); }
  });
  it("recusa chamada sem prévia/acesso revogado e impede ressuscitar por edição ou status", async () => {
    expect((await deleteInsumoAction("insumo")).error).toMatch(/confirme novamente/);
    const revisao = await previa();
    await estado.banco.usuario.update({ where: { id: "usuario-ficticio" }, data: { ativo: false } });
    expect((await deleteInsumoAction("insumo", revisao)).error).toBeTruthy();
    expect((await estado.banco.insumo.findUniqueOrThrow({ where: { id: "insumo" } })).excluidoEm).toBeNull();
    await estado.banco.usuario.update({ where: { id: "usuario-ficticio" }, data: { ativo: true } });
    expect(await excluir()).toEqual({ error: null });
    expect(await alterarStatusInsumoAction("insumo", true)).toMatchObject({ erro: expect.any(String) });
    const form = new FormData();
    for (const [campo, valor] of Object.entries({ id: "insumo", nome: "Nome alterado", unidade: "KG", ativo: "on" })) form.set(campo, valor);
    expect((await saveInsumoAction({ error: null }, form)).error).toBeTruthy();
    const preparo = new FormData();
    for (const [campo, valor] of Object.entries({ nome: "Preparação nova fictícia", tipo: "PRODUTO_INTERMEDIARIO", unidade: "KG", rendimentoQuantidade: "1", rendimentoUnidade: "KG", ativo: "on" })) preparo.set(campo, valor);
    preparo.append("componentes", JSON.stringify({ componenteId: "insumo", quantidade: 1 }));
    expect((await saveInsumoAction({ error: null }, preparo)).error).toMatch(/ingrediente foi excluído/);
    expect(await estado.banco.insumo.count({ where: { tipo: "PRODUTO_INTERMEDIARIO" } })).toBe(0);
    await expect(estado.banco.$transaction(tx => conferirInsumosComposicao(tx, ["insumo"]))).rejects.toThrow(/ingrediente foi excluído/);
    expect(await estado.banco.insumo.findUniqueOrThrow({ where: { id: "insumo" } })).toMatchObject({ nome: "Farinha fictícia", ativo: false });
  });
  it("falha ao concluir a exclusão desfaz todas as remoções de composição na mesma transação", async () => {
    await estado.banco.produtoVenda.create({ data: { id: "produto", nome: "Produto fictício", componentes: { create: { insumoId: "insumo", quantidade: 1, unidade: "KG" } } } });
    await estado.banco.grupoComplementoVenda.create({ data: { id: "grupo", nome: "Grupo fictício", opcoes: { create: { id: "opcao", nome: "Opção fictícia", composicao: [{ insumoId: "insumo", quantidade: "1", unidade: "KG" }] } } } });
    const anterior = await estado.banco.opcaoComplementoVenda.findUniqueOrThrow({ where: { id: "opcao" } });
    await pool.query(`CREATE FUNCTION falha_exclusao_ficticia() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Falha fictícia na conclusão'; END; $$`);
    await pool.query(`CREATE TRIGGER falha_exclusao_ficticia BEFORE UPDATE ON "Insumo" FOR EACH ROW WHEN (NEW."excluidoEm" IS NOT NULL) EXECUTE FUNCTION falha_exclusao_ficticia()`);
    try {
      expect((await excluir()).error).toBeTruthy();
      expect(await estado.banco.componenteProdutoVenda.count()).toBe(1);
      expect(await estado.banco.opcaoComplementoVenda.findUniqueOrThrow({ where: { id: "opcao" } })).toEqual(anterior);
      expect((await estado.banco.produtoVenda.findUniqueOrThrow({ where: { id: "produto" } })).versao).toBe(1);
      expect(await estado.banco.insumo.findUniqueOrThrow({ where: { id: "insumo" } })).toMatchObject({ ativo: true, excluidoEm: null, exclusaoSnapshot: null });
    } finally { await pool.query('DROP FUNCTION falha_exclusao_ficticia() CASCADE'); }
  });
});
