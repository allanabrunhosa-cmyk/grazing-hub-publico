import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { hashCanonico } from "@/lib/vendas/historico-dominio";
import { contexto, data, pacote, registro } from "./historico-importacao.fixture";
import { fixtureComplementoHistorico, rehashComplementoSintetico } from "./historico-complemento.fixture";
import { validarComplementoRegistro } from "@/lib/vendas/historico-complemento";

const sim = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return sim.prisma; } }));
import { executarImportacaoHistorica, prepararImportacaoHistorica, reverterImportacaoHistorica } from "@/lib/vendas/historico-importacao";
import { consultarClientesVenda, consultarHistoricoPedidosCliente } from "@/lib/vendas/clientes-consulta";
import { prepararCorrecaoClientesHistoricos, executarCorrecaoClientesHistoricos, prepararReversaoClientesHistoricos, reverterCorrecaoClientesHistoricos } from "@/lib/vendas/clientes-correcao";
import { referenciaEmpresaHistorica } from "@/lib/vendas/clientes-correcao-dominio";
import { identidadeComprador, validarPacoteHistorico } from "@/lib/vendas/historico-dominio";

const esquema = `teste_historico_importacao_${randomUUID().replaceAll("-", "")}`;
let banco: Client | undefined, criado = false, usuarioId: string, contaId: string;
const contextoReal = (loteId = "lote-sintetico-integracao-1") => ({ ...contexto, usuarioId, sessaoVersao: 0, loteId });
afterEach(() => vi.unstubAllEnvs());
async function importar(p = pacote(), loteId?: string) {
  const entrada = { ...contextoReal(loteId), pacote: p }, previa = await prepararImportacaoHistorica(entrada);
  return executarImportacaoHistorica({ ...entrada, tokenPrevia: previa.token });
}
async function fotografarEsquemaSintetico() {
  const tabelas = await banco!.query<{tablename:string}>("SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename", [esquema]);
  const fotografias: Record<string, unknown> = {};
  for (const {tablename} of tabelas.rows) {
    const identificador = `"${esquema}"."${tablename.replaceAll('"','""')}"`;
    fotografias[tablename] = (await banco!.query(`SELECT count(*)::text AS quantidade, md5(coalesce(string_agg(to_jsonb(t)::text,'|' ORDER BY to_jsonb(t)::text),'')) AS digest FROM ${identificador} t`)).rows;
  }
  fotografias.sequencias = (await banco!.query("SELECT sequencename,last_value::text FROM pg_sequences WHERE schemaname=$1 ORDER BY sequencename", [esquema])).rows;
  return fotografias;
}

describe.skipIf(process.env.HISTORICO_BANCO_TESTE !== "1")("importação histórica no PostgreSQL sintético isolado", () => {
  beforeAll(async () => {
    // Sem dotenv: o executor precisa fornecer explicitamente a URL sintética.
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !/^\/teste_historico(?:$|_)/.test(url.pathname)) throw Error("Somente banco local de nome teste_historico, com dados sintéticos.");
    if (!/^teste_historico_importacao_[a-f0-9]{32}$/.test(esquema)) throw Error("Schema de teste inválido.");
    banco = new Client({ connectionString: url.toString() }); await banco.connect();
    await banco.query(`CREATE SCHEMA "${esquema}"`); criado = true; await banco.query(`SET search_path TO "${esquema}"`);
    const pastas = (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    for (const pasta of pastas) {
      await banco.query("BEGIN");
      try { await banco.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8"))); await banco.query("COMMIT"); }
      catch (erro) { await banco.query("ROLLBACK"); throw erro; }
    }
    sim.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${esquema}` }, { schema: esquema }) });
    expect(await sim.prisma.$queryRaw`SELECT current_schema() AS esquema`).toEqual([{ esquema }]);
    const perfil = await sim.prisma.perfilAcesso.upsert({ where: { sistema: "ADMINISTRADOR" }, create: { nome: "Administrador sintético histórico", sistema: "ADMINISTRADOR" }, update: {} });
    const usuario = await sim.prisma.usuario.create({ data: { nome: "Administrador sintético histórico", email: "admin-historico@example.invalid", senhaHash: "hash-sintetico", perfilAcessoId: perfil.id } }); usuarioId = usuario.id;
    const conta = await sim.prisma.contaBancaria.create({ data: { nome: "Conta sintética protegida", saldoInicial: "1234.56", dataSaldoInicial: new Date("2026-09-01T00:00:00Z") } }); contaId = conta.id;
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Ingrediente sintético", unidade: "KG", custoMedio: "20" } });
    const local = await sim.prisma.localEstoque.create({ data: { nome: "Local sintético protegido" } });
    await sim.prisma.saldoEstoque.create({ data: { insumoId: insumo.id, localId: local.id, quantidadeAtual: "12.345" } });
    await sim.prisma.produtoVenda.create({ data: { nome: "Produto sintético", ativo: false, tipo: "PADRAO", componentes: { create: { insumoId: insumo.id, unidade: "KG", quantidade: "0.1" } } } });
    await sim.prisma.pedidoVenda.create({ data: { criadoPorId: usuarioId, chaveCriacao: "pedido-operacional-sintetico", hashCriacao: "x" } });
  }, 120000);
  afterAll(async () => {
    await sim.prisma?.$disconnect();
    if (!banco) return;
    if (criado && /^teste_historico_importacao_[a-f0-9]{32}$/.test(esquema)) await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);
    await banco.end();
  });

  it("prévia funciona com PostgreSQL somente leitura e não muda tabelas, auditorias ou sequências", async () => {
    const antes = await fotografarEsquemaSintetico(), original = sim.prisma;
    const somenteLeitura = new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL!,options:`-c search_path=${esquema} -c default_transaction_read_only=on`},{schema:esquema})});
    try {
      expect(await somenteLeitura.$queryRaw`SHOW default_transaction_read_only`).toEqual([{default_transaction_read_only:"on"}]);
      await expect(somenteLeitura.$executeRaw`UPDATE "ContaBancaria" SET "saldoInicial"="saldoInicial" WHERE "id"=${contaId}`).rejects.toThrow();
      sim.prisma=somenteLeitura;
      const previa=await prepararImportacaoHistorica({...contextoReal("lote-sintetico-previa-readonly"),pacote:pacote([registro("10007",{produto:"Produto sintético ainda não cadastrado",nome:"Comprador prévia",email:"previa@example.invalid"})])});
      expect(previa).toMatchObject({contagens:{novos:1},preservacao:null});expect(previa.token).toMatch(/^[a-f0-9]{64}$/);
    } finally {sim.prisma=original;await somenteLeitura.$disconnect();}
    expect(await fotografarEsquemaSintetico()).toEqual(antes);
  });

  it("importa agosto/setembro, prova saldos, mantém sequência e reexecuta sem duplicar", async () => {
    const sequenciaAntes = await sim.prisma.$queryRaw(Prisma.sql`SELECT last_value::text AS valor, is_called AS chamado FROM ${Prisma.raw(`"${esquema}"."PedidoVenda_numero_seq"`)}`);
    const p = pacote([registro(), registro("10002", { setembro: true })]), resultado = await importar(p);
    expect(resultado).toMatchObject({ novos: 2, aplicados: 2, clientesCriados: 1, produtosNovos: 0, preservacao: { iguais: true, isolamento: "REPEATABLE_READ" } });
    expect(resultado.preservacao?.antes).toEqual(resultado.preservacao?.depois);
    const pedidos = await sim.prisma.pedidoVenda.findMany({ where: { origem: "HISTORICO_LEGADO" }, include: { itens: true }, orderBy: { numero: "desc" } });
    expect(pedidos).toHaveLength(2); expect(pedidos.every(p => p.numero < 0 && p.status === "HISTORICO" && p.confirmadoEm === null && p.entregueEm === null)).toBe(true);
    expect(pedidos[0].itens[0].desconto.toString()).toBe("0"); expect(pedidos[0].total.toString()).toBe("100");
    const agosto = await sim.prisma.identidadeExternaVenda.findUniqueOrThrow({ where: { origem_loja_entidade_chave: { origem: "grazing-legado-orders", loja: "grazing-hub", entidade: "PEDIDO_HISTORICO", chave: "10001" } } });
    const dados = agosto.dadosOrigem as unknown as { hub: { consumo: { estado: string; componentes: { quantidadeEstimada: string; custoEstimado: string }[] }[]; pagamento: { mes: string; operacional: boolean } } };
    expect(dados.hub.consumo[0]).toMatchObject({ estado: "ESTIMATIVA_COMPOSICAO_ATUAL", componentes: [{ quantidadeEstimada: "0.2", custoEstimado: "4" }] });
    expect(dados.hub.pagamento).toMatchObject({ mes: "2026-09", operacional: false });
    expect(await sim.prisma.$queryRaw(Prisma.sql`SELECT last_value::text AS valor, is_called AS chamado FROM ${Prisma.raw(`"${esquema}"."PedidoVenda_numero_seq"`)}`)).toEqual(sequenciaAntes);
    expect((await sim.prisma.contaBancaria.findUniqueOrThrow({ where: { id: contaId } })).saldoInicial.toString()).toBe("1234.56");
    expect((await sim.prisma.saldoEstoque.findFirstOrThrow()).quantidadeAtual.toString()).toBe("12.345");
    for (const contar of [sim.prisma.lancamentoFinanceiro.count(), sim.prisma.movimentacaoBancaria.count(), sim.prisma.movimentacaoEstoque.count(), sim.prisma.reservaPedido.count(), sim.prisma.pagamentoExternoPedido.count(), sim.prisma.documentoFiscalSaida.count()]) expect(await contar).toBe(0);
    p.metadados.sha256 = "2".repeat(64); expect(await importar(p)).toMatchObject({ aplicados: 0, manter: 2 });
    expect(await sim.prisma.itemPedidoVenda.count()).toBe(2);
  });

  it("atualização parcial e reversão restauram snapshot e preservam cadastros", async () => {
    const p = pacote([registro("10003", { nome: "Comprador revisão", email: "revisao@example.invalid" })]); await importar(p, "lote-sintetico-original-3");
    const original = p.registros[0].notas_originais;
    p.registros[0].notas_originais = p.registros[0].raw.valores[54] = "Correção sintética"; p.registros[0].hash_linha = hashCanonico(p.registros[0].raw.valores);
    expect(await importar(p, "lote-sintetico-revisao-3")).toMatchObject({ aplicados: 1, atualizar: 1 });
    const clientesAntes = await sim.prisma.clienteVenda.count();
    expect(await reverterImportacaoHistorica(contextoReal("lote-sintetico-revisao-3"))).toMatchObject({ revertidos: 1, preservacao: { iguais: true } });
    const restaurado = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { numero: -10003 }, include: { itens: { where: { vigente: true } } } });
    expect(restaurado).toMatchObject({ observacoes: original, versao: 3, status: "HISTORICO" }); expect(restaurado.itens).toHaveLength(1);
    expect(await sim.prisma.clienteVenda.count()).toBe(clientesAntes);
    expect(await reverterImportacaoHistorica(contextoReal("lote-sintetico-revisao-3"))).toMatchObject({ revertidos: 0 });
  });

  it("efeito indevido por trigger provoca rollback integral do lote", async () => {
    await banco!.query(`CREATE FUNCTION "${esquema}".teste_efeito_indevido() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE "${esquema}"."ContaBancaria" SET "saldoInicial" = "saldoInicial" + 1; RETURN NEW; END $$`);
    await banco!.query(`CREATE TRIGGER teste_efeito_indevido AFTER INSERT ON "${esquema}"."PedidoVenda" FOR EACH ROW WHEN (NEW."origem" = 'HISTORICO_LEGADO') EXECUTE FUNCTION "${esquema}".teste_efeito_indevido()`);
    const clientesAntes = await sim.prisma.clienteVenda.count(), fonteAntes = await sim.prisma.identidadeExternaVenda.count(), saldoAntes = (await sim.prisma.contaBancaria.findUniqueOrThrow({ where: { id: contaId } })).saldoInicial.toString();
    try {
      await expect(importar(pacote([registro("10004", { nome: "Comprador rollback", email: "rollback@example.invalid" })]), "lote-sintetico-rollback-4")).rejects.toThrow("alterou dados operacionais");
      expect(await sim.prisma.pedidoVenda.count({ where: { numero: -10004 } })).toBe(0);
      expect(await sim.prisma.clienteVenda.count()).toBe(clientesAntes); expect(await sim.prisma.identidadeExternaVenda.count()).toBe(fonteAntes);
      expect((await sim.prisma.contaBancaria.findUniqueOrThrow({ where: { id: contaId } })).saldoInicial.toString()).toBe(saldoAntes);
    } finally {
      await banco!.query(`DROP TRIGGER teste_efeito_indevido ON "${esquema}"."PedidoVenda"`); await banco!.query(`DROP FUNCTION "${esquema}".teste_efeito_indevido()`);
    }
  });

  it("lock concorrente e versão de sessão revogada impedem qualquer importação", async () => {
    await banco!.query("BEGIN"); await banco!.query("SELECT pg_advisory_xact_lock(hashtext('vendas-importacao-historica'))");
    try { await expect(importar(pacote([registro("10005")]))).rejects.toThrow("em execução"); } finally { await banco!.query("ROLLBACK"); }
    await sim.prisma.usuario.update({ where: { id: usuarioId }, data: { sessaoVersao: 1 } });
    try { await expect(importar(pacote([registro("10005")]))).rejects.toThrow("sessão"); } finally { await sim.prisma.usuario.update({ where: { id: usuarioId }, data: { sessaoVersao: 0 } }); }
    expect(await sim.prisma.pedidoVenda.count({ where: { numero: -10005 } })).toBe(0);
  });

  it("banco exige identidade histórica completa e bloqueia relações operacionais", async () => {
    await importar(pacote([registro("10006", { produto: "Produto sintético novo auditável" })]), "lote-sintetico-guardas-6");
    const pedido = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { numero: -10006 }, include: { itens: true } });
    await expect(sim.prisma.pedidoVenda.update({ where: { id: pedido.id }, data: { status: "CONFIRMADO", statusOperacional: "PENDENTE" } })).rejects.toThrow();
    await expect(sim.prisma.pedidoVenda.update({ where: { id: pedido.id }, data: { numero: 99999 } })).rejects.toThrow();
    await expect(sim.prisma.pedidoVenda.update({ where: { id: pedido.id }, data: { origem: "INTERNO", referenciaOrigem: null, referenciaEstabelecimento: null, referenciaPedido: null, status: "RASCUNHO", statusOperacional: "PENDENTE" } })).rejects.toThrow();
    await expect(sim.prisma.historicoFinanceiroPedido.create({ data: { pedidoId: pedido.id, chaveOperacao: "financeiro-bloqueado-sintetico", hashOperacao: "x", tipo: "TESTE", usuarioId, usuarioNome: "Autor sintético", detalhes: {} } })).rejects.toThrow();
    const insumo = await sim.prisma.insumo.findFirstOrThrow(), local = await sim.prisma.localEstoque.findFirstOrThrow();
    await expect(sim.prisma.reservaPedido.create({ data: { itemId: pedido.itens[0].id, localId: local.id, insumoId: insumo.id, loteExecucao: "reserva-bloqueada-sintetica", quantidadeItem: "1", quantidade: "0.1", reservada: "0.1", snapshot: {} } })).rejects.toThrow();
    expect(await sim.prisma.reservaPedido.count()).toBe(0);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: pedido.id } })).status).toBe("HISTORICO");
    const auditorias = await sim.prisma.historicoCadastroVenda.findMany({ where: { OR: [
      { entidade: "PRODUTO", registroId: pedido.itens[0].produtoId! }, { entidade: "IMPORTACAO", registroId: "lote-sintetico-guardas-6" },
    ] } });
    expect(auditorias).toHaveLength(2);
    const atividades = await sim.prisma.atividadeUsuario.findMany({ where: { fonteTabela: "HistoricoCadastroVenda", fonteId: { in: auditorias.map(a => a.id) } } });
    expect(atividades.map(a => a.recurso).sort()).toEqual(["vendas.importacao", "vendas.produtos"]);
    expect(atividades.every(a => a.autorId === usuarioId && a.antes === null && a.depois === null && a.origem === "AUTOMACAO")).toBe(true);
    const eventoPedido = await sim.prisma.historicoPedidoVenda.findFirstOrThrow({ where: { pedidoId: pedido.id, tipo: "HISTORICO_IMPORTADO" } });
    const atividadePedido = await sim.prisma.atividadeUsuario.findFirstOrThrow({ where: { fonteTabela: "HistoricoPedidoVenda", fonteId: eventoPedido.id } });
    expect(atividadePedido).toMatchObject({ recurso: "vendas.pedidos", autorId: usuarioId, antes: null, depois: null });
  });

  it("complemento comprovado detalha o pedido, não duplica receita e reverte para a fonte primária",async()=>{
    const f=fixtureComplementoHistorico(),rawPrincipal=structuredClone(f.registro.raw);await importar(f.pacote,"lote-sintetico-woo-principal");
    f.registro.complemento=validarComplementoRegistro(f.registro,f.complemento);
    const resultado=await importar(f.pacote,"lote-sintetico-woo-complemento");expect(resultado).toMatchObject({atualizar:1,aplicados:1,preservacao:{iguais:true}});
    const pedido=await sim.prisma.pedidoVenda.findUniqueOrThrow({where:{numero:-21923},include:{itens:{where:{vigente:true},orderBy:{ordem:"asc"}}}});
    expect(pedido.itens).toHaveLength(11);expect(pedido.versao).toBe(2);expect(pedido.total.toString()).toBe("200");expect(pedido.desconto.toString()).toBe("25");expect(pedido.itens[10].totalLinha.toString()).toBe("25");expect(pedido.itens[10].desconto.toString()).toBe("0");
    const fonte=await sim.prisma.identidadeExternaVenda.findFirstOrThrow({where:{entidade:"PEDIDO_HISTORICO",chave:"21923"}}),dados=fonte.dadosOrigem as unknown as {registro:typeof f.registro;hub:{itensComplementares:number;consulta:{totais:{total_original:string}}}};
    expect(dados.registro.raw).toEqual(rawPrincipal);expect(dados.registro.itens).toHaveLength(10);expect(dados.hub.itensComplementares).toBe(1);expect(dados.hub.consulta.totais.total_original).toBe("200.00");expect(fonte.resumoOrigem).not.toBe(f.registro.hash_linha);
    f.registro.complemento.prova.fonteComplementar.lidoEm="2026-10-16T00:00:00Z";expect(await importar(f.pacote,"lote-sintetico-woo-releitura")).toMatchObject({aplicados:0,manter:1});expect(await sim.prisma.itemPedidoVenda.count({where:{pedidoId:pedido.id,vigente:true}})).toBe(11);
    expect(await reverterImportacaoHistorica(contextoReal("lote-sintetico-woo-complemento"))).toMatchObject({revertidos:1,preservacao:{iguais:true}});
    expect(await sim.prisma.itemPedidoVenda.count({where:{pedidoId:pedido.id,vigente:true}})).toBe(10);expect((await sim.prisma.identidadeExternaVenda.findUniqueOrThrow({where:{id:fonte.id}})).resumoOrigem).toBe(f.registro.hash_linha);
  });
  it("extra externo fica sem produto e consumo mesmo com nome igual em catálogo com composição",async()=>{
    const f=fixtureComplementoHistorico();f.registro.numero_original=f.registro.raw.valores[8]="21924";f.registro.chave_deduplicacao="grazing-legado-orders:21924";f.registro.hash_linha=hashCanonico(f.registro.raw.valores);
    f.complemento.prova.numeroOriginal="21924";f.complemento.prova.hashLinhaPrincipal=f.registro.hash_linha;f.complemento.raw.id=f.complemento.raw.number="21924";f.complemento.raw.line_items[10].name="Produto externo";rehashComplementoSintetico(f.complemento);f.registro.complemento=validarComplementoRegistro(f.registro,f.complemento);
    const insumo=await sim.prisma.insumo.findFirstOrThrow();await sim.prisma.produtoVenda.create({data:{nome:"Produto externo",tipo:"PADRAO",ativo:false,componentes:{create:{insumoId:insumo.id,unidade:insumo.unidade,quantidade:"0.1"}}}});
    const entrada={...contextoReal("lote-sintetico-woo-externo"),pacote:f.pacote},previa=await prepararImportacaoHistorica(entrada);expect(previa.linhas[0].produtos[10]).toMatchObject({regra:"LEGADO_NAO_IDENTIFICADO",produtoId:null});
    expect(await executarImportacaoHistorica({...entrada,tokenPrevia:previa.token})).toMatchObject({aplicados:1,preservacao:{iguais:true}});
    const pedido=await sim.prisma.pedidoVenda.findUniqueOrThrow({where:{numero:-21924},include:{itens:{where:{vigente:true},orderBy:{ordem:"asc"}}}});expect(pedido.itens).toHaveLength(11);expect(pedido.itens[10].produtoId).toBeNull();expect(pedido.itens[10].totalLinha.toString()).toBe("25");expect(await sim.prisma.produtoVenda.count({where:{nome:"Produto externo"}})).toBe(1);
    const fonte=await sim.prisma.identidadeExternaVenda.findFirstOrThrow({where:{entidade:"PEDIDO_HISTORICO",chave:"21924"}}),dados=fonte.dadosOrigem as unknown as {hub:{consumo:{bloco:number;estado:string;produtoId:string|null;componentes:unknown[]}[]}};expect(dados.hub.consumo[10]).toMatchObject({bloco:11,estado:"NAO_APURADO",produtoId:null,componentes:[]});
  });

  it("métricas e histórico unem pedidos atuais e legados, com ordem correta antes de paginar", async () => {
    const nome = "Cliente métricas sintético", email = "metricas@example.invalid";
    const cliente = await sim.prisma.clienteVenda.create({ data: { nome, email } });
    const ativo = registro("30001", { nome, email }), revertido = registro("30002", { nome, email });
    ativo.data_criacao = data("2026-09-30T23:59:00"); ativo.raw.valores[4] = ativo.data_criacao.serial_original;
    ativo.pagamento_informado = data("2026-09-30T23:59:30"); ativo.raw.valores[5] = ativo.pagamento_informado.serial_original;
    ativo.hash_linha = hashCanonico(ativo.raw.valores);
    await importar(pacote([ativo]), "lote-sintetico-metricas-ativo");
    await importar(pacote([revertido]), "lote-sintetico-metricas-revertido");
    await reverterImportacaoHistorica(contextoReal("lote-sintetico-metricas-revertido"));
    for (const [indice, status, total] of [[1, "CONFIRMADO", "0.10"], [2, "CONFIRMADO", "0.20"], [3, "CANCELADO", "999.99"], [4, "DECLINADO", "999.99"], [5, "RASCUNHO", "999.99"], [6, "ESTORNADO", "999.99"]] as const) {
      await sim.prisma.pedidoVenda.create({ data: { clienteId: cliente.id, criadoPorId: usuarioId,
        chaveCriacao: `metricas-sintetico-${indice}`, hashCriacao: "sintetico", status, total,
        createdAt: new Date("2026-08-01T12:00:00Z"), confirmadoEm: status === "CONFIRMADO" ? new Date("2026-09-01T15:00:00Z") : null } });
    }
    const base = await consultarClientesVenda({ verPedidos: true, verCredito: false });
    expect(base.clientes.find(c => c.id === cliente.id)?.resumoPedidos).toEqual({ quantidadePedidos: 3, valorTotalGasto: "100.30", ultimoPedido: "2026-10-01T02:59:00.000Z" });
    let historico = await consultarHistoricoPedidosCliente(cliente.id);
    expect(historico.total).toBe(7);
    expect(historico.pedidos[0]).toMatchObject({ numero: 30001, status: "HISTORICO", dataPedido: "2026-10-01T02:59:00.000Z", baseDataPedido: "CRIACAO_HISTORICA", entregueEm: null });
    expect(historico.pedidos.some(p => p.numero === 30002 && p.status === "HISTORICO_REVERTIDO")).toBe(true);
    expect(historico.pedidos.some(p => p.status === "RASCUNHO")).toBe(false);
    expect(historico.pedidos.slice(1, 3).every(p => p.status === "CONFIRMADO")).toBe(true);
    // Há mais de uma página. Repetição da consulta conserva o desempate por ID.
    for (let i = 0; i < 24; i++) await sim.prisma.pedidoVenda.create({ data: { clienteId: cliente.id, criadoPorId: usuarioId,
      chaveCriacao: `metricas-paginado-${i}`, hashCriacao: "sintetico", status: "DECLINADO", createdAt: new Date("2026-08-15T12:00:00Z") } });
    historico = await consultarHistoricoPedidosCliente(cliente.id);
    const segunda = await consultarHistoricoPedidosCliente(cliente.id, 2);
    expect(historico.total).toBe(31); expect(historico.pedidos).toHaveLength(25); expect(segunda.pedidos).toHaveLength(6);
    expect(historico.pedidos[0].numero).toBe(30001);
    expect(new Set([...historico.pedidos, ...segunda.pedidos].map(p => p.id)).size).toBe(31);
    expect((await consultarHistoricoPedidosCliente(cliente.id)).pedidos.map(p => p.id)).toEqual(historico.pedidos.map(p => p.id));
    const fonte = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { numero: -30001 } });
    expect(fonte.confirmadoEm).toBeNull(); expect(fonte.entregueEm).toBeNull();
  });
  it("importação futura considera Company dos pedidos do mesmo comprador antes do cadastro", async () => {
    const a = registro("35001", { nome: "PESSOA SINTÉTICA EMPRESARIAL", email: "empresa-futura@example.invalid" });
    const b = registro("35002", { nome: "PESSOA SINTÉTICA EMPRESARIAL", email: "empresa-futura@example.invalid" });
    b.comprador.empresa = b.raw.valores[3] = "EMPRESA FICTÍCIA LTDA"; b.hash_linha = hashCanonico(b.raw.valores);
    const p = pacote([a, b]);
    expect(await importar(p, "lote-futuro-company-sintetico")).toMatchObject({ aplicados: 2, clientesCriados: 1 });
    const pedidos = await sim.prisma.pedidoVenda.findMany({ where: { numero: { in: [-35001, -35002] } } });
    expect(new Set(pedidos.map(v => v.clienteId)).size).toBe(1);
    const cliente = await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: pedidos[0].clienteId! } });
    expect(cliente).toMatchObject({ tipo: "PJ", nome: "Empresa Fictícia Ltda", documento: null, razaoSocial: null,
      primeiroNome: "Pessoa", sobrenome: "Sintética Empresarial", nomeContato: "Pessoa", sobrenomeContato: "Sintética Empresarial", contato: "Pessoa Sintética Empresarial" });
    expect(await importar(p, "lote-futuro-company-reexecucao")).toMatchObject({ aplicados: 0, manter: 2 });
  });
  it("correção legada sem e-mail preserva snapshots e não pode reativar aliases na reversão", async () => {
    vi.stubEnv("CLIENTES_CORRECAO_AUTORIZADA", "SIM");
    const registros = [registro("36001", { nome: "CONTATO ALFA SINTÉTICO", email: "" }), registro("36002", { nome: "CONTATO BETA SINTÉTICO", email: "" })];
    for (const r of registros) { r.comprador.emails[0] = { ...r.comprador.emails[0], normalizado: null, valido_sintaticamente: false }; r.comprador.empresa = r.raw.valores[3] = "EMPRESA ALFA SINTÉTICA"; r.hash_linha = hashCanonico(r.raw.valores); }
    const p = pacote(registros), loteOriginal = "lote-correcao-origem-sintetica";
    await importar(p, loteOriginal);
    const antes = await sim.prisma.pedidoVenda.findMany({ where: { numero: { in: [-36001,-36002] } }, orderBy: { numero: "asc" }, include: { itens: true } });
    const fontesAntes = await sim.prisma.identidadeExternaVenda.findMany({ where: { entidade: "PEDIDO_HISTORICO", chave: { in: ["36001","36002"] } }, orderBy: { chave: "asc" } });
    const ref = referenciaEmpresaHistorica("EMPRESA ALFA SINTÉTICA");
    const manifesto = { versao: 1, loteHistoricoId: loteOriginal, inventarioSha256: "a".repeat(64), empresas: [{ companyRef: ref, decisao: "PJ_CNPJ_COMPROVADO", cnpj: "11222333000181", razaoSocial: "Empresa Alfa Sintética", nomeFantasia: null, dominiosCorporativos: [], motivoPendente: null,
      provas: [{ url: "https://registro.example.invalid/empresa", consultadoEm: "2026-10-15T00:00:00Z", arquivo: "empresa.json", arquivoSha256: "b".repeat(64), papel: "REGISTRO_CNPJ", cnpjObservado: "11222333000181", nomeEmpresarialObservado: "Empresa Alfa Sintética", dominioObservado: null }] }],
      vinculos: registros.map(r => ({ chaveClienteHistorico: identidadeComprador(r).chave, companyRef: ref, numerosOriginais: [r.numero_original] })) };
    const e = { ...contextoReal("lote-correcao-cnpj-sintetica"), pacote: p, manifesto }, previa = await prepararCorrecaoClientesHistoricos(e);
    expect(previa.contagens).toMatchObject({ canonicosNovos: 1, aliasesPlanejados: 2 });
    const aplicado = await executarCorrecaoClientesHistoricos({ ...e, tokenPrevia: previa.token });
    expect(aplicado).toMatchObject({ contatosCriados: 2, pedidosReligados: 2, preservacao: { iguais: true } });
    const empresa = await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { documento: "11222333000181" }, include: { contatosEmpresa: true } });
    expect(empresa.tipo).toBe("PJ"); expect(empresa.contatosEmpresa).toHaveLength(2);
    expect(empresa.contatosEmpresa.every(c => c.ativo && !!c.clienteOrigemId && !!c.primeiroNome && !!c.sobrenome)).toBe(true);
    const atuais = await sim.prisma.pedidoVenda.findMany({ where: { id: { in: antes.map(p => p.id) } }, orderBy: { numero: "asc" } });
    expect(atuais.every(p => p.clienteId === empresa.id && p.versao === 2 && p.confirmadoEm === null && p.entregueEm === null)).toBe(true);
    expect(atuais.map(p => p.compradorSnapshot)).toEqual(antes.map(p => p.compradorSnapshot));
    const fontesDepois = await sim.prisma.identidadeExternaVenda.findMany({ where: { id: { in: fontesAntes.map(f => f.id) } }, orderBy: { chave: "asc" } });
    expect(fontesDepois.map(f => f.dadosOrigem)).toEqual(fontesAntes.map(f => f.dadosOrigem)); expect(fontesDepois.every(f => f.versaoDestino === 2)).toBe(true);
    const fotografia = await fotografarEsquemaSintetico();
    expect(await executarCorrecaoClientesHistoricos({ ...e, tokenPrevia: previa.token })).toMatchObject({ aplicados: 0, mantidos: 2 });
    expect(await fotografarEsquemaSintetico()).toEqual(fotografia);
    const reversao = await prepararReversaoClientesHistoricos(e);
    await expect(reverterCorrecaoClientesHistoricos({ ...e, tokenPrevia: reversao.token })).rejects.toThrow(/CLIENTE_ALIAS_NAO_PODE_SER_ATIVADO/);
    const depoisDaRecusa = await sim.prisma.pedidoVenda.findMany({ where: { id: { in: antes.map(p => p.id) } }, orderBy: { numero: "asc" } });
    expect(depoisDaRecusa).toEqual(atuais);
    expect(depoisDaRecusa.map(p => p.compradorSnapshot)).toEqual(antes.map(p => p.compradorSnapshot));
    expect(await sim.prisma.contatoClienteVenda.count({ where: { clienteId: empresa.id, ativo: true } })).toBe(2);
    expect((await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: empresa.id } })).ativo).toBe(true);
    expect((await sim.prisma.clienteVenda.findMany({ where: { unificadoEmId: empresa.id } })).every(alias => !alias.ativo)).toBe(true);
    expect(await sim.prisma.itemPedidoVenda.count({ where: { pedidoId: { in: antes.map(p => p.id) } } })).toBe(antes.reduce((s,p) => s+p.itens.length,0));
    const tabelasDepois = await fotografarEsquemaSintetico();
    delete fotografia.sequencias; delete tabelasDepois.sequencias;
    expect(tabelasDepois).toEqual(fotografia);
  });
  it("correção CNPJ recusa criar outra raiz com e-mail já cadastrado e reverte sem alterar a origem", async () => {
    vi.stubEnv("CLIENTES_CORRECAO_AUTORIZADA", "SIM");
    const r = registro("36003", { nome: "Contato Com Email Sintético", email: "correcao-bloqueada@example.invalid" });
    r.comprador.empresa = r.raw.valores[3] = "EMPRESA BLOQUEADA SINTÉTICA"; r.hash_linha = hashCanonico(r.raw.valores);
    const p = validarPacoteHistorico(pacote([r])), loteOriginal = "lote-correcao-email-origem";
    await importar(p, loteOriginal);
    const ref = referenciaEmpresaHistorica("EMPRESA BLOQUEADA SINTÉTICA"), cnpj = "11222333000262";
    const manifesto = { versao: 1, loteHistoricoId: loteOriginal, inventarioSha256: "a".repeat(64), empresas: [{ companyRef: ref, decisao: "PJ_CNPJ_COMPROVADO", cnpj, razaoSocial: "Empresa Bloqueada Sintética", nomeFantasia: null, dominiosCorporativos: [], motivoPendente: null,
      provas: [{ url: "https://registro.example.invalid/bloqueada", consultadoEm: "2026-10-15T00:00:00Z", arquivo: "empresa.json", arquivoSha256: "b".repeat(64), papel: "REGISTRO_CNPJ", cnpjObservado: cnpj, nomeEmpresarialObservado: "Empresa Bloqueada Sintética", dominioObservado: null }] }],
      vinculos: [{ chaveClienteHistorico: identidadeComprador(p.registros[0]).chave, companyRef: ref, numerosOriginais: ["36003"] }] };
    const entrada = { ...contextoReal("lote-correcao-email-bloqueada"), pacote: p, manifesto }, previa = await prepararCorrecaoClientesHistoricos(entrada);
    expect(previa.contagens).toMatchObject({ canonicosNovos: 1 });
    const antes = await fotografarEsquemaSintetico();
    await expect(executarCorrecaoClientesHistoricos({ ...entrada, tokenPrevia: previa.token })).rejects.toThrow(/e-mail/);
    expect(await fotografarEsquemaSintetico()).toEqual(antes);
    expect(await sim.prisma.clienteVenda.count({ where: { email: "correcao-bloqueada@example.invalid" } })).toBe(1);
  });
  it("nomes distintos com o mesmo e-mail reutilizam um único perfil com a restrição real ativa", async () => {
    const email = "dedup-historico@example.invalid";
    const p = validarPacoteHistorico(pacote([registro("37001", { nome: "Primeira Pessoa Sintética", email }), registro("37002", { nome: "Outra Pessoa Sintética", email })]));
    expect(await importar(p, "lote-email-repetido-sintetico")).toMatchObject({ aplicados: 2, clientesCriados: 1, clientesReutilizados: 1 });
    const clientes = await sim.prisma.clienteVenda.findMany({ where: { email } });
    expect(clientes).toHaveLength(1);
    expect(clientes[0].nome).toBe("Primeira Pessoa Sintética");
    const pedidos = await sim.prisma.pedidoVenda.findMany({ where: { numero: { in: [-37001, -37002] } }, orderBy: { numero: "desc" } });
    expect(pedidos.map(pedido => pedido.clienteId)).toEqual([clientes[0].id, clientes[0].id]);
    expect(pedidos.map(pedido => (pedido.compradorSnapshot as { nome: string }).nome)).toEqual(["Primeira Pessoa Sintética", "Outra Pessoa Sintética"]);
    const fontes = await sim.prisma.identidadeExternaVenda.findMany({ where: { entidade: "CLIENTE_HISTORICO", chave: { in: p.registros.map(r => identidadeComprador(r).chave) } } });
    expect(fontes).toHaveLength(2);
    expect(fontes.every(fonte => fonte.destinoId === clientes[0].id)).toBe(true);
    expect(await importar(p, "lote-email-repetido-neutro")).toMatchObject({ aplicados: 0, manter: 2 });
  });
  it("fonte ligada a alias resolve a raiz e conserva integralmente sua origem no banco", async () => {
    const raiz = await sim.prisma.clienteVenda.create({ data: { nome: "Empresa Raiz Sintética", tipo: "PJ", email: "raiz-importacao@example.invalid", versao: 6 } });
    const alias = await sim.prisma.clienteVenda.create({ data: { nome: "Perfil Origem Sintético", email: "alias-importacao@example.invalid", ativo: false, unificadoEmId: raiz.id } });
    const p = validarPacoteHistorico(pacote([registro("37003", { nome: "Nome Histórico Original", email: "origem-importacao@example.invalid" })]));
    const fonte = await sim.prisma.identidadeExternaVenda.create({ data: { origem: "grazing-legado-orders", loja: "grazing-hub", entidade: "CLIENTE_HISTORICO", chave: identidadeComprador(p.registros[0]).chave, destinoId: alias.id, resumoOrigem: "a".repeat(64), versaoDestino: alias.versao, dadosOrigem: { loteOriginal: "Preservar", provaOriginal: true } } });
    const entrada = { ...contextoReal("lote-alias-origem-sintetico"), pacote: p }, previa = await prepararImportacaoHistorica(entrada);
    expect(previa.linhas[0]).toMatchObject({ clienteId: raiz.id, situacao: "NOVO" });
    expect(await executarImportacaoHistorica({ ...entrada, tokenPrevia: previa.token })).toMatchObject({ clientesCriados: 0, clientesReutilizados: 1 });
    const pedido = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { numero: -37003 } });
    expect(pedido.clienteId).toBe(raiz.id);
    expect(pedido.compradorSnapshot).toMatchObject({ nome: "Nome Histórico Original" });
    expect(await sim.prisma.identidadeExternaVenda.findUniqueOrThrow({ where: { id: fonte.id } })).toEqual(fonte);
    expect(await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: raiz.id } })).toEqual(raiz);
    expect(await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: alias.id } })).toEqual(alias);
  });
  it("criação histórica sem e-mail conserva a ausência por origem LEGADO", async () => {
    const r = registro("37004", { nome: "Histórico Sem Email", email: "" });
    r.comprador.emails[0] = { ...r.comprador.emails[0], normalizado: null, valido_sintaticamente: false };
    expect(await importar(pacote([r]), "lote-sem-email-sintetico")).toMatchObject({ clientesCriados: 1, aplicados: 1 });
    const pedido = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { numero: -37004 } });
    expect((await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: pedido.clienteId! } })).email).toBeNull();
  });
});
