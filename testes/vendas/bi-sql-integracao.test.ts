import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({ prisma: null as PrismaClient | null }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return estado.prisma; } }));
import { consultarBiVendas, exportarConsultaBiCsv } from "@/lib/vendas/bi-consultas";
import { entregaSintetica } from "./entregas-historicas.fixture";

const schema = `teste_bi_sql_${randomUUID().replaceAll("-", "")}`;
const tabelas = ["PedidoVenda", "ItemPedidoVenda", "IdentidadeExternaVenda", "ClienteVenda", "ProdutoVenda", "CanalVenda", "CategoriaVenda", "ProdutoCategoriaVenda", "TratamentoFinanceiroPedido", "CreditoClienteMovimento", "ContatoClienteVenda", "HistoricoPedidoVenda"];
const permissoes = { contatos: true, custos: true, exportar: true, pedidos: true };
const periodo = { de: "2026-01-01", ate: "2026-01-01" };
let banco: Client | null = null;
let criado = false;

describe.skipIf(process.env.BI_BANCO_TESTE !== "1")("BI: SELECT verdadeiro em PostgreSQL sintético", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "http://invalido");
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !/^\/teste_[a-z0-9_]+$/.test(url.pathname) || process.env.PEDIDOS_AMBIENTE_ISOLADO !== "1") throw new Error("Exige banco sintético local explícito.");
    banco = new Client({ connectionString: url.toString() });
    await banco.connect();
    await banco.query(`CREATE SCHEMA "${schema}"`);
    criado = true;
    await banco.query(`SET search_path TO "${schema}"`);
    // Contrato SQL mínimo do SELECT. Não executa migrations ou seeds operacionais.
    await banco.query(`
      CREATE TABLE "ClienteVenda" (id text PRIMARY KEY, nome text, tipo text NOT NULL DEFAULT 'PF', documento text, "unificadoEmId" text, "updatedAt" timestamp NOT NULL DEFAULT '2026-10-15 03:00:00');
      CREATE TABLE "ContatoClienteVenda" (id text PRIMARY KEY, "clienteId" text, ativo boolean, origem text, proveniencia jsonb);
      CREATE TABLE "HistoricoPedidoVenda" (id text PRIMARY KEY, "pedidoId" text, tipo text, depois jsonb);
      CREATE TABLE "CanalVenda" (id text PRIMARY KEY, nome text, ordem integer DEFAULT 0);
      CREATE TABLE "ProdutoVenda" (id text PRIMARY KEY, nome text, ativo boolean);
      CREATE TABLE "CategoriaVenda" (id text PRIMARY KEY, nome text);
      CREATE TABLE "ProdutoCategoriaVenda" ("produtoId" text, "categoriaId" text);
      CREATE TABLE "PedidoVenda" (
        id text PRIMARY KEY, numero integer, status text, origem text, "referenciaOrigem" text,
        "referenciaEstabelecimento" text, "referenciaPedido" text, "createdAt" timestamp, "dataCompra" date,
        "entregueEm" timestamp, "updatedAt" timestamp, "clienteId" text, "canalId" text,
        "canalNomeSnapshot" text, atendimento text, subtotal numeric(14,2), desconto numeric(14,2),
        frete numeric(14,2), "outrosCustos" numeric(14,2) NOT NULL DEFAULT 0, total numeric(14,2) NOT NULL DEFAULT 0,
        "custoEntregaEfetivo" numeric(14,2), "compradorSnapshot" jsonb,
        "enderecoSnapshot" jsonb, "entregaSnapshot" jsonb, rascunho jsonb, observacoes text);
      CREATE TABLE "ItemPedidoVenda" (id text PRIMARY KEY, "pedidoId" text, "produtoId" text,
        "produtoSnapshot" jsonb, "unidadeSnapshot" text, quantidade numeric(14,6), "totalLinha" numeric(14,2), vigente boolean);
      CREATE TABLE "IdentidadeExternaVenda" (id text PRIMARY KEY, "destinoId" text, entidade text,
        origem text, loja text, "dadosOrigem" jsonb, "updatedAt" timestamp);
      CREATE TABLE "TratamentoFinanceiroPedido" (id text PRIMARY KEY, "pedidoId" text, "reduzVenda" boolean, status text, valor numeric(14,2), "updatedAt" timestamp NOT NULL DEFAULT '2026-10-15 03:00:00');
      CREATE TABLE "CreditoClienteMovimento" (id text PRIMARY KEY, "pedidoAplicacaoId" text, tipo text, "reduzVenda" boolean, valor numeric(14,2), "createdAt" timestamp NOT NULL DEFAULT '2026-10-15 03:00:00');
      INSERT INTO "ClienteVenda" (id,nome) VALUES ('comprador','Comprador sintético'),('historico','Comprador histórico'),('insuficiente','Identidade insuficiente');
      INSERT INTO "CanalVenda" (id, nome) VALUES ('site','Site');
      INSERT INTO "ProdutoVenda" VALUES ('kit','=KIT SINTÉTICO',false),('alimento','Produto sintético',true);
      INSERT INTO "CategoriaVenda" VALUES ('presentes','Presentes');
      INSERT INTO "ProdutoCategoriaVenda" VALUES ('kit','presentes');
    `);
    const pedido = async (id: string, alteracoes: Record<string, unknown> = {}) => {
      const p: Record<string, unknown> = { numero: 1, status: "CONFIRMADO", origem: "INTERNO", createdAt: "2026-01-01 03:00:00", clienteId: "comprador", subtotal: "100", desconto: "0", frete: "0", outrosCustos: "0", ...alteracoes };
      const total = p.total ?? new Prisma.Decimal(String(p.subtotal)).minus(String(p.desconto)).plus(String(p.frete)).plus(String(p.outrosCustos)).toFixed(2);
      await banco!.query(`INSERT INTO "PedidoVenda" (id,numero,status,origem,"createdAt","updatedAt","clienteId",subtotal,desconto,frete,"compradorSnapshot","referenciaOrigem","referenciaEstabelecimento","referenciaPedido",atendimento,"custoEntregaEfetivo","enderecoSnapshot","entregaSnapshot",rascunho,"outrosCustos",total)
        VALUES ($1,$2,$3,$4,$5,'2026-10-15 03:00:00',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [id,p.numero,p.status,p.origem,p.createdAt,p.clienteId,p.subtotal,p.desconto,p.frete,JSON.stringify(p.compradorSnapshot ?? { nome: p.clienteId === "comprador" ? "Comprador sintético" : "Comprador histórico" }),p.referenciaOrigem ?? null,p.referenciaEstabelecimento ?? null,p.referenciaPedido ?? null,p.atendimento ?? null,p.custoEntregaEfetivo ?? null,p.enderecoSnapshot ? JSON.stringify(p.enderecoSnapshot) : null,p.entregaSnapshot ? JSON.stringify(p.entregaSnapshot) : null,p.rascunho ? JSON.stringify(p.rascunho) : null,p.outrosCustos,total]);
    };
    const item = async (id: string, pedidoId: string, produtoId: string, valor: string, vigente = true) => banco!.query(`INSERT INTO "ItemPedidoVenda" VALUES ($1,$2,$3,'{"nome":"Nome preservado","categorias":[]}',CASE WHEN $3='kit' THEN 'KIT' ELSE 'UN' END,1,$4,$5)`, [id,pedidoId,produtoId,valor,vigente]);
    const fonte = async (id: string, pedidoId: string, liquido: string, naoDetalhado: string, status = "Retirado", regra = "nome_email_exatos", atualizado = "2026-10-15 03:00:00") => banco!.query(`INSERT INTO "IdentidadeExternaVenda" VALUES ($1,$2,'PEDIDO_HISTORICO','grazing-legado-orders','grazing-hub',$3,$4)`, [id,pedidoId,JSON.stringify({ registro: { status: { final_legado: status }, comprador: { regra_identidade: regra }, totais: { liquido_itens: liquido, valor_historico_nao_detalhado: naoDetalhado, frete_ajuste_original: "-7" } }, hub: { consulta: { totais: { liquido_itens: liquido, valor_historico_nao_detalhado: naoDetalhado, diferenca_total_apos_nao_detalhado: "0" } }, freteOriginal: "-7", parcelaNaoDetalhada: { valor: naoDetalhado } } }),atualizado]);
    await pedido("n-valido", { desconto: "10", atendimento: "ENTREGA", custoEntregaEfetivo: "8", enderecoSnapshot: { cidade: "São Paulo", bairro: "Centro", uf: "SP" }, entregaSnapshot: { cobertura: "CONFIRMADA" } });
    await item("n-kit","n-valido","kit","70"); await item("n-alimento","n-valido","alimento","20");
    await item("n-obsoleto","n-valido","alimento","999",false);
    await banco.query(`INSERT INTO "TratamentoFinanceiroPedido" VALUES ('parcial','n-valido',true,'CONCLUIDA',10,'2026-10-15 04:00:00'),('estornado','n-valido',true,'CANCELADA',999,'2026-10-15 05:00:00')`);
    for (const [id, dia, extras] of [
      ["n-ajuste-frete", "2026-02-01", { frete: "20" }],
      ["n-ajuste-outros", "2026-02-02", { outrosCustos: "20" }],
      ["n-total-divergente", "2026-02-03", { total: "101" }],
    ] as const) {
      await pedido(id, { createdAt: `${dia} 03:00:00`, ...extras });
      await item(`${id}-item`, id, "kit", "100");
      await banco.query(`INSERT INTO "TratamentoFinanceiroPedido" VALUES ($1,$2,true,'CONCLUIDA',20,'2026-10-15 06:00:00')`, [`${id}-devolucao`, id]);
    }
    await pedido("n-credito", { createdAt: "2026-02-04 03:00:00" }); await item("credito-item", "n-credito", "kit", "100");
    await banco.query(`INSERT INTO "CreditoClienteMovimento" VALUES ('credito-devolvido','n-credito','LIBERACAO',true,10,'2026-10-15 07:00:00')`);
    await pedido("h-valido", { numero: -55, status: "HISTORICO", origem: "HISTORICO_LEGADO", createdAt: "2026-01-02 02:59:59.999", clienteId: "historico", subtotal: "100", desconto: "25", referenciaOrigem: "grazing-legado-orders", referenciaEstabelecimento: "grazing-hub", referenciaPedido: "55" });
    await item("h-kit","h-valido","kit","50"); await item("h-alimento","h-valido","alimento","25");
    await fonte("fonte-antiga","h-valido","999","0","Retirado","nome_email_exatos","2026-10-14 03:00:00");
    await fonte("fonte-atual","h-valido","75","5");
    await pedido("h-zero", { numero: -56, status: "HISTORICO", origem: "HISTORICO_LEGADO", clienteId: null, subtotal: "0", referenciaPedido: "56" });
    await fonte("fonte-zero","h-zero","0","0","Retirado","identidade_por_documento_legado");
    await pedido("n-antes", { createdAt: "2026-01-01 02:59:59.999", subtotal: "10" });
    await item("antes","n-antes","kit","10");
    await pedido("n-depois", { createdAt: "2026-01-02 03:00:00", clienteId: "historico", subtotal: "10" });
    await item("depois","n-depois","kit","10");
    await pedido("n-cancelado", { status: "CANCELADO", subtotal: "999" });
    await pedido("n-orcamento", { status: "RASCUNHO", subtotal: "999" });
    await pedido("n-teste", { subtotal: "999", compradorSnapshot: { nome: "Destinatário diferente", teste: true } });
    await pedido("h-cancelado", { status: "HISTORICO", origem: "HISTORICO_LEGADO", subtotal: "999" });
    await fonte("fonte-cancelada","h-cancelado","999","0","Cancelado");
    await pedido("h-sem-fonte", { status: "HISTORICO", origem: "HISTORICO_LEGADO", subtotal: "999" });
    await banco.query(`INSERT INTO "ClienteVenda" (id,nome,tipo,documento) VALUES ('empresa-canonica','Empresa Sintética Ltda','PJ','11222333000181')`);
    for (const [sufixo, numero, nome, liquido] of [
      ["a", "8601", "Contato sintético Alfa", "40"],
      ["b", "8602", "Contato sintético Beta", "60"],
    ] as const) {
      const id = `h-empresa-${sufixo}`;
      await pedido(id, { numero: -Number(numero), status: "HISTORICO", origem: "HISTORICO_LEGADO", createdAt: "2026-03-01 03:00:00", clienteId: "empresa-canonica", subtotal: liquido,
        compradorSnapshot: { nome }, referenciaOrigem: "grazing-legado-orders", referenciaEstabelecimento: "grazing-hub", referenciaPedido: numero });
      await item(`${id}-item`, id, "kit", liquido);
      await fonte(`${id}-fonte`, id, liquido, "0", "Retirado", "identidade_por_documento_legado");
      await banco.query(`UPDATE "IdentidadeExternaVenda" SET "dadosOrigem"=jsonb_set("dadosOrigem",'{hub,consulta,totais,total_original}',to_jsonb($2::text)) WHERE id=$1`, [`${id}-fonte`, new Prisma.Decimal(liquido).minus(7).toFixed(2)]);
      await banco.query(`INSERT INTO "HistoricoPedidoVenda" VALUES ($1,$2,'HISTORICO_CLIENTE_CORRIGIDO','{"clienteId":"empresa-canonica"}')`, [`correcao-${sufixo}`, id]);
      await banco.query(`INSERT INTO "ContatoClienteVenda" VALUES ($1,'empresa-canonica',true,'grazing-legado-orders',$2)`, [`contato-${sufixo}`, JSON.stringify({ numerosOriginais: [numero], hashManifesto: "a".repeat(64) })]);
    }
    for (const [id, numero, endereco, frete] of [["h-shipping", "8801", "Destinatário fictício\nRua Sintética, 10\nSão Paulo\nSão Paulo\n12345-678", "10"], ["h-retirada", "8802", " \n ", "15"]] as const) {
      await pedido(id, { numero: -Number(numero), status: "HISTORICO", origem: "HISTORICO_LEGADO", createdAt: "2026-04-01 03:00:00", clienteId: "historico", subtotal: "30", frete,
        referenciaOrigem: "grazing-legado-orders", referenciaEstabelecimento: "grazing-hub", referenciaPedido: numero });
      await item(`${id}-item`, id, "kit", "30"); await fonte(`${id}-fonte`, id, "30", "0");
      await banco.query(`UPDATE "IdentidadeExternaVenda" SET "dadosOrigem"=jsonb_set(jsonb_set("dadosOrigem",'{hub,freteOriginal}',to_jsonb($2::text)), '{hub,entregaHistorica}', $3::jsonb) WHERE id=$1`, [`${id}-fonte`, frete, JSON.stringify(entregaSintetica(endereco, numero))]);
    }
    await banco.query(`INSERT INTO "ClienteVenda" (id,nome,tipo,"unificadoEmId") VALUES
      ('empresa-ranking','Fantasia Sintética','PJ',NULL),('empresa-alias','Nome histórico do alias','PF','empresa-ranking'),
      ('empresa-alias-antigo','Outro titular histórico','PF','empresa-alias'),('empresa-homonima','Fantasia Sintética','PJ',NULL),
      ('sem-pedidos','Cadastro sem vendas','PF',NULL),('pessoa-atual','Nome Completo Atual','PF',NULL)`);
    for (let n = 0; n < 125; n++) {
      const id = `h-ranking-${n}`, numero = String(9000 + n);
      await pedido(id, { numero: -Number(numero), status: "HISTORICO", origem: "HISTORICO_LEGADO", createdAt: "2026-05-01 03:00:00", clienteId: n % 2 ? "empresa-alias-antigo" : "empresa-ranking", subtotal: "1880",
        compradorSnapshot: { nome: `Titular preservado ${n}` }, referenciaOrigem: "grazing-legado-orders", referenciaEstabelecimento: "grazing-hub", referenciaPedido: numero });
      await item(`${id}-item`, id, "kit", "1880");
      await fonte(`${id}-fonte`, id, "1880", "0", "Retirado", "identidade_por_documento_legado");
    }
    await pedido("ranking-anterior", { createdAt: "2026-04-30 03:00:00", clienteId: "empresa-alias", subtotal: "100" });
    await item("ranking-anterior-item", "ranking-anterior", "kit", "100");
    await pedido("ranking-homonimo", { createdAt: "2026-05-01 03:00:00", clienteId: "empresa-homonima", subtotal: "55" });
    await item("ranking-homonimo-item", "ranking-homonimo", "kit", "55");
    await pedido("ranking-sem-fk", { createdAt: "2026-05-01 03:00:00", clienteId: null, compradorSnapshot: { nome: "Fantasia Sintética" }, subtotal: "500" });
    await item("ranking-sem-fk-item", "ranking-sem-fk", "kit", "500");
    await pedido("pessoa-historico", { status: "HISTORICO", origem: "HISTORICO_LEGADO", createdAt: "2026-06-01 03:00:00", clienteId: "pessoa-atual", subtotal: "75", compradorSnapshot: { nome: "Nome pessoal antigo" }, referenciaPedido: "9500" });
    await item("pessoa-historico-item", "pessoa-historico", "kit", "75");
    await fonte("pessoa-historico-fonte", "pessoa-historico", "75", "0", "Retirado", "identidade_por_documento_legado");
    estado.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${schema} -c default_transaction_read_only=on` }, { schema }) });
  }, 30_000);

  afterAll(async () => {
    await estado.prisma?.$disconnect();
    if (!banco) return;
    if (criado && /^teste_bi_sql_[a-f0-9]{32}$/.test(schema)) await banco.query(`DROP SCHEMA "${schema}" CASCADE`);
    await banco.end();
  });

  async function fotografia() {
    const resultado = [];
    for (const tabela of tabelas) resultado.push((await banco!.query(`SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]')) AS hash FROM "${tabela}" t`)).rows[0].hash);
    return resultado;
  }

  it("reconcilia itens, descontos, devolução parcial, histórico e limites de fuso", async () => {
    const r = await consultarBiVendas(periodo, permissoes);
    expect(r.indicadores).toMatchObject({ vendas: 160, pedidos: 3, ticket: 53.33, compradores: 2, recorrencia: 50, frete: 0 });
    expect(r.pedidos.linhas.map(p => p.numero)).toContain("55");
    expect(r.pedidos.linhas).toHaveLength(3);
    expect(r.produtos.linhas.find(p => p.id === "kit")).toMatchObject({ receita: 120, unidade: "KIT", quantidade: 2 });
    expect(r.produtos.linhas.find(p => p.id === "sem-detalhamento")).toMatchObject({ receita: -5, quantidade: null });
    expect(r.cobertura).toMatchObject({ pedidosSemCliente: 1, fretesNegativos: 2, ajustesFrete: -14, custosEntrega: 1 });
    expect(r.rentabilidade).toMatchObject({ custoProdutos: null, margem: null, freteCoberto: 0, custoEntrega: 8 });
    expect(r.atualizadoEm).toBe("2026-10-15T05:00:00.000Z");
    expect(r.reconciliacao).toEqual({ vendas: 160, serie: 160, ranking: 160, frete: 0, pedidos: 160, confere: true });
  });

  it("consulta e exportação mantêm todas as tabelas intactas e a conexão recusa escrita", async () => {
    const antes = await fotografia();
    await consultarBiVendas(periodo, permissoes);
    const csv = await exportarConsultaBiCsv(periodo, permissoes);
    expect(csv).toContain('"Faturamento";160');
    expect(csv).toContain('"Pedidos";3');
    expect(csv).toContain('"Receita reconciliada";"Sim"');
    const produtos = await exportarConsultaBiCsv({ ...periodo, aba: "produtos" }, permissoes);
    expect(produtos).toContain('"\'=KIT SINTÉTICO";"KIT";120');
    expect(await fotografia()).toEqual(antes);
    await expect(estado.prisma!.$executeRawUnsafe('UPDATE "PedidoVenda" SET subtotal=0')).rejects.toThrow(/read.only|somente.leitura/iu);
    expect(await fotografia()).toEqual(antes);
  });
  it("exibe a empresa canônica em dois históricos sem duplicar vendas ou alterar compradores preservados", async () => {
    const antes = await fotografia();
    const r = await consultarBiVendas({ de: "2026-03-01", ate: "2026-03-01", aba: "clientes", cliente: "empresa-canonica" }, permissoes);
    expect(r.indicadores).toMatchObject({ vendas: 100, pedidos: 2, compradores: 1, ticket: 50 });
    expect(r.cobertura).toMatchObject({ pedidosTotalOriginalHistorico: 2, totalOriginalHistorico: 86, ajustesFrete: -14 });
    expect(r.clientes.linhas).toEqual([expect.objectContaining({ id: "empresa-canonica", nome: "Empresa Sintética Ltda", compras: 2, valor: 100, ticket: 50 })]);
    expect(r.opcoes.clientes.filter(c => c.id === "empresa-canonica")).toEqual([{ id: "empresa-canonica", nome: "Empresa Sintética Ltda" }]);
    expect(r.pedidos.linhas).toHaveLength(2);
    expect(r.pedidos.linhas.every(p => p.cliente === "Empresa Sintética Ltda")).toBe(true);
    const csv = await exportarConsultaBiCsv({ de: "2026-03-01", ate: "2026-03-01", aba: "clientes", cliente: "empresa-canonica" }, permissoes);
    expect(csv).toContain('"Faturamento";100'); expect(csv).toContain('"Total original na fonte histórica";86'); expect(csv).toContain('"Ajustes de frete a classificar";-14');
    expect(r.reconciliacao).toEqual({ vendas: 100, serie: 100, ranking: 100, frete: 0, pedidos: 100, confere: true });
    const snapshots = await banco!.query(`SELECT "compradorSnapshot"->>'nome' AS nome FROM "PedidoVenda" WHERE id IN ('h-empresa-a','h-empresa-b') ORDER BY id`);
    expect(snapshots.rows).toEqual([{ nome: "Contato sintético Alfa" }, { nome: "Contato sintético Beta" }]);
    expect(await fotografia()).toEqual(antes);
  });
  it("inclui 125 históricos no ranking canônico sem fundir homônimos ou inferir FK do snapshot", async () => {
    const antes = await fotografia();
    const selecao = { de: "2026-05-01", ate: "2026-05-01" };
    const geral = await consultarBiVendas(selecao, permissoes);
    expect(geral.indicadores).toMatchObject({ pedidos: 127, vendas: 235555, compradores: 2 });
    expect(geral.rankingClientes).toEqual([
      expect.objectContaining({ id: "empresa-ranking", nome: "Fantasia Sintética", tipo: "PJ", compras: 125, valor: 235000 }),
      expect.objectContaining({ id: "empresa-homonima", nome: "Fantasia Sintética", compras: 1, valor: 55 }),
    ]);
    expect(geral.cobertura.pedidosSemCliente).toBe(1);
    const r = await consultarBiVendas({ ...selecao, cliente: "empresa-alias-antigo", comparacao: "anterior", pagina: 3 }, permissoes);
    expect(r.filtros.cliente).toBe("empresa-ranking");
    expect(r.indicadores).toMatchObject({ pedidos: 125, vendas: 235000, compradores: 1, recorrencia: 100 });
    expect(r.anterior).toMatchObject({ pedidos: 1, vendas: 100, compradores: 1 });
    expect(r.rankingClientes).toHaveLength(1); expect(r.rankingClientes[0]).toMatchObject({ id: "empresa-ranking", compras: 125, valor: 235000 });
    expect(r.pedidos.total).toBe(125); expect(r.pedidos.linhas).toHaveLength(25);
    expect(r.pedidos.linhas.every(p => p.cliente === "Fantasia Sintética")).toBe(true);
    expect(r.produtos.linhas).toEqual([]); expect(r.produtos.total).toBe(1);
    expect(r.reconciliacao).toMatchObject({ vendas: 235000, ranking: 235000, confere: true });
    expect(r.opcoes.clientes).toContainEqual({ id: "sem-pedidos", nome: "Cadastro sem vendas" });
    expect(r.opcoes.clientes.some(c => c.id.startsWith("empresa-alias"))).toBe(false);
    const csv = await exportarConsultaBiCsv({ ...selecao, cliente: "empresa-alias", pagina: 3 }, permissoes);
    expect(csv).toContain('"Faturamento";235000'); expect(csv).toContain('""cliente"":""empresa-ranking""');
    expect(csv.split("\r\n").filter(l => /^"9\d{3}";"2026-05-01";/u.test(l))).toHaveLength(125);
    expect(csv).not.toContain("Titular preservado"); expect(csv).not.toContain("Nome histórico do alias");
    const clientes = await consultarBiVendas({ ...selecao, aba: "clientes", tipoCliente: "PJ", cliente: "empresa-ranking" }, permissoes);
    expect(clientes.clientes.linhas).toEqual([expect.objectContaining({ id: "empresa-ranking", nome: "Fantasia Sintética", compras: 125, valor: 235000 })]);
    expect(await fotografia()).toEqual(antes);
  });
  it("usa o nome completo atual PF no filtro, ranking, detalhes e CSV sem reescrever o nome antigo", async () => {
    const antes = await fotografia(), selecao = { de: "2026-06-01", ate: "2026-06-01", cliente: "pessoa-atual", aba: "clientes" as const, tipoCliente: "PF" as const };
    const r = await consultarBiVendas(selecao, permissoes);
    expect(r.indicadores).toMatchObject({ compradores: 1, pedidos: 1, vendas: 75 });
    expect(r.rankingClientes[0]).toMatchObject({ id: "pessoa-atual", nome: "Nome Completo Atual", tipo: "PF" });
    expect(r.clientes.linhas[0]).toMatchObject({ nome: "Nome Completo Atual", compras: 1 });
    expect(r.pedidos.linhas[0].cliente).toBe("Nome Completo Atual");
    expect(r.opcoes.clientes).toContainEqual({ id: "pessoa-atual", nome: "Nome Completo Atual" });
    const csv = await exportarConsultaBiCsv(selecao, permissoes);
    expect(csv).toContain('"Nome Completo Atual";"Física";1;75'); expect(csv).not.toContain("Nome pessoal antigo");
    expect(await fotografia()).toEqual(antes);
  });
  it.each(["2026-02-01", "2026-02-02", "2026-02-03"])("redução sem componente comprovado fica Não apurado no dia %s", async dia => {
    const r = await consultarBiVendas({ de: dia, ate: dia }, permissoes);
    expect(r.indicadores).toMatchObject({ vendas: null, pedidos: 1, ticket: null });
    expect(r.cobertura).toMatchObject({ pedidosComReducaoSemComponente: 1, reducaoComercialSemComponente: 20, vendasProdutosConhecidas: 0 });
    expect(r.produtos.linhas[0].receita).toBeNull();
    expect(r.reconciliacao).toMatchObject({ naoApurado: true, confere: false });
    expect(r.atualizadoEm).toBe("2026-10-15T06:00:00.000Z");
    const csv = await exportarConsultaBiCsv({ de: dia, ate: dia }, permissoes);
    expect(csv).toContain('"Receita reconciliada";"Não apurado"');
    if (dia === "2026-02-01") {
      expect(r.indicadores.frete).toBeNull(); expect(r.pedidos.linhas[0].frete).toBeNull();
      expect(csv).toContain('"Frete";"Não apurado"');
    } else expect(r.indicadores.frete).toBe(0);
  });
  it("liberação de crédito exclusivamente de produtos afeta a receita uma vez e atualiza o horário", async () => {
    const r = await consultarBiVendas({ de: "2026-02-04", ate: "2026-02-04" }, permissoes);
    expect(r.indicadores).toMatchObject({ vendas: 90, pedidos: 1, ticket: 90 });
    expect(r.reconciliacao).toEqual({ vendas: 90, serie: 90, ranking: 90, frete: 0, pedidos: 90, confere: true });
    expect(r.atualizadoEm).toBe("2026-10-15T07:00:00.000Z");
  });

  it("não projeta compradores ou custos sem permissões, inclusive no CSV", async () => {
    const semDetalhes = { contatos: false, custos: false, exportar: true };
    const r = await consultarBiVendas(periodo, semDetalhes);
    expect(r.clientes.linhas).toEqual([]);
    expect(r.opcoes.clientes).toEqual([]);
    expect(r.pedidos.linhas.every(p => p.cliente === null)).toBe(true);
    expect(r.rentabilidade.custoEntrega).toBeNull();
    const csv = await exportarConsultaBiCsv(periodo, semDetalhes);
    expect(csv).not.toContain("Comprador sintético");
    expect(csv).not.toContain("Comprador histórico");
    expect(csv).not.toContain('"Custo conhecido"');
    await expect(exportarConsultaBiCsv(periodo, { ...semDetalhes, exportar: false })).rejects.toMatchObject({ status: 403 });
    await expect(consultarBiVendas({ ...periodo, aba: "clientes" }, semDetalhes)).rejects.toMatchObject({ status: 403 });
  });
  it("projeta Shipping por whitelist e retirada sem endereço sem tocar valores originais", async () => {
    const antes = await fotografia();
    const r = await consultarBiVendas({ de: "2026-04-01", ate: "2026-04-01" }, permissoes);
    expect(r.indicadores).toMatchObject({ vendas: 70, pedidos: 2, frete: 10 }); expect(r.cobertura).toMatchObject({ entregas: 1, localizadas: 1, retiradasSemEndereco: 1, freteOriginalRetiradas: 15 });
    expect(r.pedidos.linhas.find(p => p.numero === "8802")).toMatchObject({ modalidade: "RETIRADA", frete: 0 });
    expect(r.locaisEntrega[0]).toMatchObject({ consulta: "CEP 12345-678, São Paulo, SP, Brasil", precisao: "cep", pedidos: 1 });
    expect(JSON.stringify(r)).not.toContain("Rua Sintética"); expect(JSON.stringify(r)).not.toContain("Destinatário fictício");
    expect(await fotografia()).toEqual(antes);
    const originais = await banco!.query(`SELECT frete::text FROM "PedidoVenda" WHERE id IN ('h-shipping','h-retirada') ORDER BY id`);
    expect(originais.rows).toEqual([{ frete: "15.00" }, { frete: "10.00" }]);
  });
});
