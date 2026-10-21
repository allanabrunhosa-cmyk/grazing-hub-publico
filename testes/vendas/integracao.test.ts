import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { config } from "dotenv";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { consultarProdutos } from "@/lib/vendas/consultas";
import { selecionarPorcao } from "@/lib/insumos/porcoes";
import { readdir, readFile } from "node:fs/promises";
const sim = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return sim.prisma; } }));
vi.mock("server-only", () => ({}));
import { salvarCliente, salvarCategoria, salvarCategoriaGrupo, salvarGrupo, salvarProduto, salvarFiscalProduto, salvarGrupoFiscal, alterarPrecoProduto, excluirCadastroVenda, reordenarCategorias, reordenarProdutos, alterarSituacaoProduto } from "@/lib/vendas/persistencia";
import { previaImportacao, aplicarImportacao } from "@/lib/vendas/importacao";
import { criarCanalVenda } from "@/lib/vendas/persistencia";
import { alterarStatusCadastroVenda } from "@/lib/vendas/persistencia";
import { consultarConflitosIdentidadeCliente } from "@/lib/vendas/clientes-unicidade";
const esquema = `teste_vendas_${randomUUID().replaceAll("-", "")}`;
const autor = { userId: "autor-teste", nome: "Pessoa de teste" };
const enderecoCliente = { nome: "Principal", destinatario: "", pais: "Brasil", cep: "01001000", logradouro: "Rua Sintética", numero: "42", complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
const produto = { id: "", versao: 0, nome: "Produto teste", especificacao: null, descricao: null, tipo: "PADRAO", codigo: null, unidade: "UN", fotoUrl: null, observacoes: null, modoPreparo: null, ativo: true, categorias: [], grupos: [], preco: "149", componentes: [] };
let banco: Client | undefined; let criado = false;
describe.skipIf(process.env.VENDAS_BANCO_TESTE !== "1")("Vendas no PostgreSQL isolado", () => {
  it("salva e reabre multiplicador decimal preservando referência e sem movimentar estoque", async () => {
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Queijo sintético porcionável", unidade: "KG", custoMedio: "20" } });
    const porcao = { ...selecionarPorcao({ id: "referencia", insumoId: insumo.id, nome: "8 fatias", quantidade: "0.1", unidade: "KG", versao: 1 }), numeroPorcoes: "0,5" };
    const id = await salvarProduto({ ...produto, nome: "Produto meia porção", componentes: [{ insumoId: insumo.id, unidade: "KG", quantidade: "0.05", porcao }] }, autor);
    const salvo = (await consultarProdutos()).produtos.find(p => p.id === id)!;
    expect(salvo.componentes[0]).toMatchObject({ quantidade: "0.05", observacaoPorcao: "4 fatias", porcao: { numeroPorcoes: "0.5", quantidadeInsumo: "0.1", quantidadeMedida: "8" } });
    await salvarProduto({ ...salvo, componentes: [{ ...salvo.componentes[0], quantidade: "0.2", porcao: { ...salvo.componentes[0].porcao!, numeroPorcoes: "2" } }] }, autor);
    expect((await sim.prisma.componenteProdutoVenda.findFirstOrThrow({ where: { produtoId: id } })).observacaoPorcao).toBe("16 fatias");
    await expect(salvarProduto({ ...salvo, versao: 2, componentes: [{ ...salvo.componentes[0], quantidade: "0.1" }] }, autor)).rejects.toThrow("não corresponde");
    expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
    expect(await sim.prisma.historicoCadastroVenda.count({ where: { registroId: id, entidade: "PRODUTO" } })).toBe(2);
  });
  it("persiste composição por grupo/produto, pausa global auditada, conflitos e rollback", async () => {
    const perfil = await sim.prisma.perfilAcesso.upsert({ where: { sistema: "ADMINISTRADOR" }, create: { nome: "Admin sintético complementos", sistema: "ADMINISTRADOR" }, update: {} });
    const usuario = await sim.prisma.usuario.create({ data: { nome: "Autor sintético", email: "complementos@example.invalid", senhaHash: "hash-sintetico", perfilAcessoId: perfil.id } });
    const autorizacao = { userId: usuario.id, nome: usuario.nome, versao: 0 };
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Salame sintético", unidade: "KG", custoMedio: "20" } });
    const composicao = (quantidade: string) => [{ insumoId: insumo.id, unidade: "KG", quantidade }];
    const complemento = await salvarProduto({ ...produto, nome: "Salame complemento", classificacoes: ["COMPLEMENTO"], preco: "10", componentes: composicao("0.05") }, autor);
    const ids = await Promise.all(["Extra salame A", "Escolha salame B"].map(nome => salvarGrupo({ id: "", versao: 0, nome, tipo: "COMPOSICAO", minimo: 0, maximo: null, repetir: true, ativo: true, opcoes: [{ id: "", nome: "Salame", preco: "10", produtoId: complemento, quantidade: "1", ativo: true, composicao: composicao("0.1") }] }, autor)));
    const grupos = await sim.prisma.grupoComplementoVenda.findMany({ where: { id: { in: ids } }, include: { opcoes: true }, orderBy: { nome: "asc" } });
    const opcaoId = grupos[0].opcoes[0].id;
    const id = await salvarProduto({ ...produto, nome: "Tábua salame A", grupos: [{ grupoId: grupos[0].id, usarPadrao: false, minimo: 0, maximo: null, ajustesOpcoes: [{ opcaoId, preco: "0", composicao: composicao("0.2") }] }] }, autor);
    const consultar = async () => (await consultarProdutos()).produtos.find(p => p.id === id)!;
    const salvo = await consultar();
    expect(salvo.grupos[0].ajustesOpcoes).toMatchObject([{ opcaoId, preco: "0", composicao: [{ quantidade: "0.2" }] }]);
    expect((await sim.prisma.componenteProdutoVenda.findFirstOrThrow({ where: { produtoId: complemento } })).quantidade.toString()).toBe("0.05");
    expect((await consultarProdutos()).grupos.find(g => g.id === grupos[0].id)?.opcoes[0].composicao?.[0].quantidade).toBe("0.1");
    await expect(salvarProduto({ ...salvo, grupos: [{ ...salvo.grupos[0], ajustesOpcoes: [{ opcaoId: "invasor", preco: "0" }] }] }, autor)).rejects.toThrow("não pertence");
    const comando = { opcaoId, ativo: false, grupos: grupos.map(g => ({ id: g.id, versao: g.versao })) };
    await expect(salvarProduto({ ...salvo, pausasComplementos: [{ ...comando, grupos: [comando.grupos[0], comando.grupos[0]] }] }, autorizacao)).rejects.toThrow("Grupos afetados");
    await expect(salvarProduto({ ...salvo, pausasComplementos: [comando, comando] }, autorizacao)).rejects.toThrow("decisões repetidas");
    await expect(salvarProduto({ ...salvo, pausasComplementos: [comando] }, autor)).rejects.toThrow("sessão");
    await expect(salvarProduto({ ...salvo, nome: "Nome que deve reverter", pausasComplementos: [{ ...comando, grupos: comando.grupos.map(g => ({ ...g, versao: 0 })) }] }, autorizacao)).rejects.toThrow("outra tela");
    expect((await consultar()).nome).toBe("Tábua salame A");
    await salvarProduto({ ...salvo, pausasComplementos: [comando] }, autorizacao);
    expect(await sim.prisma.opcaoComplementoVenda.count({ where: { produtoId: complemento, ativo: true } })).toBe(0);
    expect(await sim.prisma.historicoCadastroVenda.count({ where: { entidade: "PAUSA_COMPLEMENTO_GLOBAL", registroId: { in: ids } } })).toBe(2);
    const atuais = await sim.prisma.grupoComplementoVenda.findMany({ where: { id: { in: ids } } });
    const reabrir = { ...comando, ativo: true, grupos: atuais.map(g => ({ id: g.id, versao: g.versao })) };
    await salvarProduto({ ...await consultar(), pausasComplementos: [reabrir] }, autorizacao);
    expect(await sim.prisma.opcaoComplementoVenda.count({ where: { produtoId: complemento, ativo: true } })).toBe(2);
    const semPermissao = await sim.prisma.usuario.create({ data: { nome: "Sem acesso sintético", email: "sem-acesso-complementos@example.invalid", senhaHash: "hash-sintetico" } });
    await expect(salvarProduto({ ...await consultar(), pausasComplementos: [comando] }, { userId: semPermissao.id, nome: semPermissao.nome })).rejects.toThrow("Seu acesso");
    expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
  });
  beforeAll(async () => {
    config({ quiet: true }); const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Somente PostgreSQL local.");
    banco = new Client({ connectionString: url.toString() }); await banco.connect(); await banco.query(`CREATE SCHEMA "${esquema}"`); criado = true; await banco.query(`SET search_path TO "${esquema}"`);
    const pastas = (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a,b) => a.name.localeCompare(b.name));
    for (const p of pastas) await banco.query(prepararSqlMigrationFiscal(p.name, await readFile(`prisma/migrations/${p.name}/migration.sql`, "utf8")));
    sim.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${esquema}` }, { schema: esquema }) });
    expect(await sim.prisma.$queryRaw`SELECT current_schema() AS esquema`).toEqual([{ esquema }]);
  }, 90000);
  afterAll(async () => {
    await sim.prisma?.$disconnect(); if (!banco) return;
    if (criado && /^teste_vendas_[a-f0-9]{32}$/.test(esquema)) await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);
    await banco.end();
  });
  it("reabre consumo de nove casas em decimal simples e permite salvar sem alteração", async () => {
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Ingrediente mínimo sintético", unidade: "KG" } });
    const porcao = selecionarPorcao({ id: "referencia-minima", insumoId: insumo.id, nome: "1 medida", quantidade: "0.000000001", unidade: "KG", versao: 1 });
    const id = await salvarProduto({ ...produto, nome: "Produto precisão mínima", componentes: [{ insumoId: insumo.id, unidade: "KG", quantidade: "0.000000001", porcao }] }, autor);
    const salvo = (await consultarProdutos()).produtos.find(p => p.id === id)!;
    expect(salvo.componentes[0].quantidade).toBe("0.000000001");
    await salvarProduto(salvo, autor);
    expect((await sim.prisma.componenteProdutoVenda.findFirstOrThrow({ where: { produtoId: id } })).quantidade.toFixed()).toBe("0.000000001");
  });
  it("cria cliente/endereço e impede sobrescrita por versão antiga", async () => {
    const entrada = { id: "", versao: 0, nome: "Cliente Teste", tipo: "PF", documento: null, email: "teste@example.invalid", telefone: null, contato: null, observacoes: null, ativo: true, enderecos: [enderecoCliente] };
    const id = await salvarCliente(entrada, autor);
    const concorrentes = await Promise.allSettled([salvarCliente({ ...entrada, id, versao: 1, nome: "Alteração A" }, autor), salvarCliente({ ...entrada, id, versao: 1, nome: "Alteração B" }, autor)]);
    expect(concorrentes.filter(c => c.status === "fulfilled")).toHaveLength(1);
    expect((await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id } })).versao).toBe(2);
    expect(await sim.prisma.historicoCadastroVenda.count({ where: { registroId: id } })).toBe(2);
  });
  it("reserva e-mail normalizado sob concorrência e não altera o titular ao recusar duplicado", async () => {
    const email = `identidade-${randomUUID()}@example.invalid`;
    const entrada = { id: "", versao: 0, nome: "Titular Sintético", tipo: "PF", documento: "96385274109", email: ` ${email.toUpperCase()} `, telefone: null, contato: null, observacoes: null, ativo: true, enderecos: [enderecoCliente] };
    const resultados = await Promise.allSettled([salvarCliente(entrada, autor), salvarCliente({ ...entrada, nome: "Outro Nome Sintético", email }, autor)]);
    expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const existente = await sim.prisma.clienteVenda.findFirstOrThrow({ where: { email } });
    expect(await sim.prisma.clienteVenda.count({ where: { email } })).toBe(1);
    expect(existente.versao).toBe(1);
    expect(await sim.prisma.historicoCadastroVenda.count({ where: { registroId: existente.id } })).toBe(1);
    await expect(salvarCliente({ ...entrada, documento: null, email }, autor)).rejects.toThrow(/e-mail/);
    await expect(salvarCliente({ ...entrada, email: `outro-${randomUUID()}@example.invalid` }, autor)).rejects.toThrow(/CPF\/CNPJ/);
    expect(await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: existente.id } })).toEqual(existente);
  });
  it("antecipa duplicidade por identificador com inativos, aliases e legado sem gravar dados", async () => {
    const raiz = await sim.prisma.clienteVenda.create({ data: { nome: "Titular inativo sintético", tipo: "PF", email: `consulta-${randomUUID()}@example.invalid`, documento: "15935725806", ativo: false, enderecos: [enderecoCliente] } });
    const empresa = await sim.prisma.clienteVenda.create({ data: { nome: "Empresa sintética", tipo: "PJ", email: `empresa-${randomUUID()}@example.invalid`, documento: "55000000000100", enderecos: [enderecoCliente] } });
    const alias = await sim.prisma.clienteVenda.create({ data: { nome: "Origem sintética preservada", tipo: "PF", email: `origem-${randomUUID()}@example.invalid`, documento: "65432198700", unificadoEmId: raiz.id, ativo: false, enderecos: [enderecoCliente] } });
    await sim.prisma.clienteVenda.create({ data: { nome: "Legado sintético", tipo: "PF", email: `legado-${randomUUID()}@example.invalid`, enderecos: [{ ...enderecoCliente, tipo: "PF", documento: "74185296300" }, { ...enderecoCliente, nome: "Cobrança 2", tipo: "PJ", documento: "44000000000100" }] } });
    const contagens = [await sim.prisma.clienteVenda.count(), await sim.prisma.historicoCadastroVenda.count()];
    const consulta = { clienteId: "", email: ` ${raiz.email!.toUpperCase()} `, documento: "159.357.258-06", tipo: "PF" };
    expect(await consultarConflitosIdentidadeCliente(sim.prisma, consulta)).toEqual({ email: true, documento: true });
    expect(await consultarConflitosIdentidadeCliente(sim.prisma, { ...consulta, clienteId: raiz.id })).toEqual({ email: false, documento: false });
    expect(await consultarConflitosIdentidadeCliente(sim.prisma, { ...consulta, email: alias.email, documento: alias.documento })).toEqual({ email: true, documento: true });
    expect(await consultarConflitosIdentidadeCliente(sim.prisma, { ...consulta, clienteId: raiz.id, email: alias.email, documento: null })).toEqual({ email: false, documento: false });
    expect(await consultarConflitosIdentidadeCliente(sim.prisma, { ...consulta, clienteId: raiz.id, email: alias.email, documento: alias.documento })).toEqual({ email: false, documento: true });
    expect(await consultarConflitosIdentidadeCliente(sim.prisma, { ...consulta, email: raiz.email, tipo: "PJ", documento: "55.000.000/0001-00" })).toEqual({ email: true, documento: true });
    expect(await consultarConflitosIdentidadeCliente(sim.prisma, { ...consulta, clienteId: empresa.id, email: empresa.email, tipo: "PJ", documento: empresa.documento })).toEqual({ email: false, documento: false });
    expect(await consultarConflitosIdentidadeCliente(sim.prisma, { ...consulta, email: null, documento: "74185296300" })).toEqual({ email: false, documento: true });
    expect(await consultarConflitosIdentidadeCliente(sim.prisma, { ...consulta, email: null, tipo: "PJ", documento: "44000000000100" })).toEqual({ email: false, documento: false });
    expect([await sim.prisma.clienteVenda.count(), await sim.prisma.historicoCadastroVenda.count()]).toEqual(contagens);
  });
  it("status de grupo altera somente o cadastro, preserva opções e audita conflito", async () => {
    const id = await salvarGrupo({ id: "", versao: 0, nome: "Status direto", tipo: "COMPOSICAO", minimo: 0, maximo: null, repetir: true, ativo: true, opcoes: [{ id: "", nome: "Opção preservada", preco: "2.50", quantidade: "1", produtoId: null, ativo: true }] }, autor);
    const antes = await sim.prisma.opcaoComplementoVenda.findMany({ where: { grupoId: id } });
    expect(await alterarStatusCadastroVenda("GRUPO", id, 1, false, autor)).toEqual({ ativo: false, versao: 2 });
    expect(await sim.prisma.opcaoComplementoVenda.findMany({ where: { grupoId: id } })).toEqual(antes);
    await expect(alterarStatusCadastroVenda("GRUPO", id, 1, true, autor)).rejects.toThrow("outra tela");
    await alterarStatusCadastroVenda("GRUPO", id, 2, true, autor);
    expect(await sim.prisma.historicoCadastroVenda.count({ where: { entidade: "SITUACAO_GRUPO", registroId: id } })).toBe(2);
  });
  it("status de cliente, fiscal e pagamento preserva os demais campos e rejeita revisão antiga", async () => {
    const cliente = await sim.prisma.clienteVenda.create({ data: { nome: "Cliente status", tipo: "PF", enderecos: [{ nome: "Casa fictícia" }] } });
    const fiscal = await sim.prisma.grupoFiscalVenda.create({ data: { nome: "Fiscal status", fiscal: { ncm: "04069020" } } });
    const forma = await sim.prisma.formaPagamentoVenda.create({ data: { nome: "Cartão status", tipo: "CARTAO_CREDITO", taxaPercentual: "3.5", taxaFixa: "1.25", prazoDias: 30, permiteParcelamento: true, maximoParcelas: 3, faixasTaxa: [{ de: 2, ate: 3, percentual: "1", fixa: "0" }] } });
    for (const [tipo, antes, ler] of [
      ["CLIENTE", cliente, () => sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: cliente.id } })],
      ["GRUPO_FISCAL", fiscal, () => sim.prisma.grupoFiscalVenda.findUniqueOrThrow({ where: { id: fiscal.id } })],
      ["FORMA_PAGAMENTO", forma, () => sim.prisma.formaPagamentoVenda.findUniqueOrThrow({ where: { id: forma.id } })],
    ] as const) {
      expect(await alterarStatusCadastroVenda(tipo, antes.id, 1, false, autor)).toEqual({ ativo: false, versao: 2 });
      const depois = await ler();
      expect(depois).toEqual({ ...antes, ativo: false, versao: 2, ...("updatedAt" in depois ? { updatedAt: depois.updatedAt } : {}) });
      await expect(alterarStatusCadastroVenda(tipo, antes.id, 1, true, autor)).rejects.toThrow("outra tela");
      expect(await sim.prisma.historicoCadastroVenda.count({ where: { entidade: `SITUACAO_${tipo}`, registroId: antes.id } })).toBe(1);
    }
  });
  it("edita quantidade e porção na mesma composição sem movimentar estoque", async () => {
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Queijo sintético", unidade: "KG", custoMedio: 20 } });
    const componentes = [{ insumoId: insumo.id, quantidade: "0.1", unidade: "KG", observacaoPorcao: "1 fatia" }];
    const id = await salvarProduto({ ...produto, nome: "Composição sintética", componentes }, autor);
    await salvarProduto({ ...produto, id, versao: 1, nome: "Composição sintética", componentes: [{ ...componentes[0], quantidade: "0.2", observacaoPorcao: "2 fatias" }] }, autor);
    const salvo = await sim.prisma.componenteProdutoVenda.findMany({ where: { produtoId: id } });
    expect(salvo).toHaveLength(1); expect(salvo[0].insumoId).toBe(insumo.id);
    expect(salvo[0].quantidade.toString()).toBe("0.2"); expect(salvo[0].observacaoPorcao).toBe("2 fatias");
    expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
  });
  it("cadastra origem e salva preço único com precisão, versão e auditoria", async () => {
    const canal = await criarCanalVenda("  Site teste  ", autor);
    expect(canal.nome).toBe("SITE TESTE");
    await expect(criarCanalVenda("site teste", autor)).rejects.toThrow("já está cadastrado");
    const id = await salvarProduto({ ...produto, nome: "Produto com preço único" }, autor);
    await alterarPrecoProduto(id, 1, "80", autor);
    expect((await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id } })).preco.toString()).toBe("80");
    await expect(alterarPrecoProduto(id, 1, "50", autor)).rejects.toThrow("outra tela");
    await expect(alterarPrecoProduto(id, 2, "1.001", autor)).rejects.toThrow();
    await alterarPrecoProduto(id, 2, "0", autor);
    expect(await sim.prisma.historicoCadastroVenda.count({ where: { registroId: id, entidade: "PRECO_PRODUTO" } })).toBe(2);
    expect(await sim.prisma.precoProdutoVenda.count({ where: { produtoId: id } })).toBe(0);
    expect((await sim.prisma.produtoVenda.findUniqueOrThrow({where:{id}}))).toMatchObject({ ativo: true, versao: 3 });
  });
  it("salva comercial e fiscal atomicamente e não grava grupo fiscal inválido", async () => {
    const id = await salvarProduto({ ...produto, nome: "Fiscal junto" }, autor, { fiscal: { ncm: "04069020" }, revisado: false, grupoFiscalId: null });
    expect((await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id } })).fiscal).toMatchObject({ ncm: "04069020" });
    await expect(salvarProduto({ ...produto, id, versao: 1, nome: "Não salvar" }, autor, { fiscal: {}, revisado: false, grupoFiscalId: "inexistente" })).rejects.toThrow("Grupo fiscal indisponível");
    expect((await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id } })).nome).toBe("Fiscal junto");
  });
  it("persiste ordem e visibilidade dos ingredientes sem remover consumo", async () => {
    const queijo = await sim.prisma.insumo.create({data:{nome:"Queijo teste",unidade:"KG",custoMedio:20}});
    const saco = await sim.prisma.insumo.create({data:{nome:"Embalagem teste",unidade:"UN",custoMedio:1}});
    const componentes = [{insumoId:saco.id,quantidade:"1",unidade:"UN",exibirFicha:false},{insumoId:queijo.id,quantidade:"0.2",unidade:"KG",exibirFicha:true}];
    const id = await salvarProduto({...produto,componentes},autor);
    const linhas = await sim.prisma.componenteProdutoVenda.findMany({where:{produtoId:id},orderBy:{ordem:"asc"}});
    expect(linhas.map(c=>[c.insumoId,c.exibirFicha,Number(c.quantidade)])).toEqual([[saco.id,false,1],[queijo.id,true,0.2]]);
    await salvarProduto({...produto,id,versao:1,componentes:[componentes[1],componentes[0]]},autor);
    expect((await sim.prisma.componenteProdutoVenda.findMany({where:{produtoId:id},orderBy:{ordem:"asc"}})).map(c=>c.insumoId)).toEqual([queijo.id,saco.id]);
  });
  it("categorias são ordenáveis e alteração não apaga referências", async () => {
    const a = await salvarCategoria({ id: "", versao: 0, nome: "Primeira", ativo: true }, autor);
    const b = await salvarCategoria({ id: "", versao: 0, nome: "Segunda", ativo: true }, autor);
    await reordenarCategorias([{ id: b, versao: 1 }, { id: a, versao: 1 }], autor);
    expect((await sim.prisma.categoriaVenda.findMany({ orderBy: { ordem: "asc" } })).map(c => c.id)).toEqual([b,a]);
    const id = await salvarProduto({ ...produto, categorias: [a] }, autor);
    expect(await sim.prisma.produtoCategoriaVenda.count({ where: { produtoId: id, categoriaId: a } })).toBe(1);
    await expect(reordenarCategorias([{ id: a, versao: 2 }], autor)).rejects.toThrow("lista");
  });
  it("ordem dos produtos pertence à categoria e não aceita versão antiga", async () => {
    const categoria = await salvarCategoria({ id: "", versao: 0, nome: "Ordem de produtos", ativo: true }, autor);
    const outra = await salvarCategoria({ id: "", versao: 0, nome: "Outra ordem", ativo: true }, autor);
    const a = await salvarProduto({ ...produto, nome: "Item A", categorias: [categoria, outra] }, autor);
    const b = await salvarProduto({ ...produto, nome: "Item B", categorias: [categoria, outra] }, autor);
    await reordenarProdutos(categoria, [{ id: b, versao: 1 }, { id: a, versao: 1 }], autor);
    const ordem = async (categoriaId: string) => (await sim.prisma.produtoCategoriaVenda.findMany({ where: { categoriaId }, orderBy: { ordem: "asc" } })).map(v => v.produtoId);
    expect(await ordem(categoria)).toEqual([b, a]);
    expect(await ordem(outra)).toEqual([a, b]);
    await expect(reordenarProdutos(categoria, [{ id: a, versao: 1 }, { id: b, versao: 1 }], autor)).rejects.toThrow("outra tela");
    await expect(reordenarProdutos(categoria, [{ id: a, versao: 2 }], autor)).rejects.toThrow("lista");
    expect(await ordem(categoria)).toEqual([b, a]);
    expect(await sim.prisma.historicoCadastroVenda.count({ where: { entidade: "ORDEM_PRODUTOS", registroId: categoria } })).toBe(1);
  });
  it("Extras é um único grupo compartilhado e ignora limites legados de vínculos", async () => {
    const g = await sim.prisma.grupoComplementoVenda.findUniqueOrThrow({ where: { id: "vendas-extras-padrao" } });
    await salvarGrupo({ ...g, minimo: 9, maximo: 3, repetir: false, opcoes: [{ id: "", nome: "Queijo extra", preco: "20", produtoId: null, quantidade: "1", ativo: true }] }, autor);
    const id = await salvarProduto({ ...produto, nome: "Personalizado", tipo: "PERSONALIZADO", grupos: [{ grupoId: g.id, usarPadrao: false, minimo: 9, maximo: 10 }] }, autor);
    expect(await sim.prisma.produtoGrupoVenda.findFirst({ where: { produtoId: id } })).toMatchObject({ usarPadrao: true, minimo: 0, maximo: null });
    const atual = await sim.prisma.grupoComplementoVenda.findUniqueOrThrow({ where: { id: g.id }, include: { opcoes: true } });
    await expect(salvarGrupo({ ...atual, tipo: "COMPOSICAO", opcoes: [] }, autor)).rejects.toThrow("Extras");
  });
  it("fiscal não é alterado por edição comercial e toda gravação é auditada", async () => {
    const id = await salvarProduto({ ...produto, nome: "Fiscal separado" }, autor);
    await salvarFiscalProduto(id, 1, { ncm: "04069020" }, false, autor);
    await salvarProduto({ ...produto, id, versao: 2, fiscal: { ncm: "99999999" }, fiscalRevisado: true, nome: "Fiscal preservado" }, autor);
    const salvo = await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id } });
    expect(salvo.fiscal).toMatchObject({ ncm: "04069020" }); expect(salvo.fiscalRevisado).toBe(false);
    expect(await sim.prisma.historicoCadastroVenda.count({ where: { registroId: id } })).toBe(3);
  });
  it("recusa vínculos de outra opção e ciclos sem gravar parcialmente", async () => {
    const id = await salvarProduto({ ...produto, nome: "Componente fixo" }, autor);
    const g = { id: "", versao: 0, nome: "Grupo composição", tipo: "COMPOSICAO", minimo: 1, maximo: 1, repetir: false, ativo: true, opcoes: [{ id: "", nome: "Opção", preco: "0", quantidade: "1", produtoId: id, ativo: true }] };
    const grupoId = await salvarGrupo(g, autor);
    await expect(salvarProduto({ ...produto, id, versao: 1, grupos: [{ grupoId, usarPadrao: true, minimo: 1, maximo: 1 }] }, autor)).rejects.toThrow("opção");
    expect((await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id } })).versao).toBe(1);
    await expect(salvarGrupo({ ...g, id: grupoId, versao: 1, opcoes: [{ ...g.opcoes[0], id: "opcao-invasora" }] }, autor)).rejects.toThrow("não pertence");
    expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0); expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(0);
  });
  it("combina papéis, aplica grupo fiscal e altera preço sem regravar o cadastro", async () => {
    const id = await salvarProduto({ ...produto, nome: "Produto de múltiplos papéis" }, autor);
    const grupoOpcao = await salvarGrupo({ id:"",versao:0,nome:"Grupo que usa o produto",tipo:"COMPOSICAO",minimo:0,maximo:null,repetir:false,ativo:true,opcoes:[{id:"",nome:"Escolha múltipla",preco:"3",produtoId:id,quantidade:"1",ativo:true}] },autor);
    const outroGrupo = await salvarGrupo({ id:"",versao:0,nome:"Grupo próprio independente",tipo:"COMPOSICAO",minimo:0,maximo:null,repetir:false,ativo:true,opcoes:[{id:"",nome:"Escolha livre",preco:"2",produtoId:null,quantidade:"1",ativo:true}] },autor);
    const categoriaGrupo = await salvarCategoriaGrupo({id:"",versao:0,nome:"Família de grupos",ativo:true},autor);
    const dadosGrupo = await sim.prisma.grupoComplementoVenda.findUniqueOrThrow({where:{id:outroGrupo},include:{opcoes:true}});
    await salvarGrupo({ ...dadosGrupo, categoriaId: categoriaGrupo, opcoes: dadosGrupo.opcoes.map(o => ({...o,preco:o.preco.toString(),quantidade:o.quantidade.toString()})) },autor);
    await salvarProduto({ ...produto, id, versao:1, nome:"Produto de múltiplos papéis", classificacoes:["PRINCIPAL","OPCAO","COMPLEMENTO"], grupos:[{grupoId:outroGrupo,usarPadrao:false,minimo:0,maximo:null}] },autor);
    const papeis = await sim.prisma.produtoVenda.findUniqueOrThrow({where:{id}});
    expect(papeis.classificacoes).toEqual(["PRINCIPAL","OPCAO","COMPLEMENTO"]);
    expect((await sim.prisma.grupoComplementoVenda.findUniqueOrThrow({where:{id:outroGrupo}})).categoriaId).toBe(categoriaGrupo);
    await alterarPrecoProduto(id,2,"159",autor);
    expect((await sim.prisma.produtoVenda.findUniqueOrThrow({where:{id}})).preco.toString()).toBe("159");
    const fiscalId = await salvarGrupoFiscal({id:"",versao:0,nome:"Fiscal de produção",fiscal:{ncm:"04069020",cfop:"5101"},ativo:true},autor);
    await salvarFiscalProduto(id,3,{ncm:"04069020",cfop:"5101"},false,autor,fiscalId);
    expect((await sim.prisma.produtoVenda.findUniqueOrThrow({where:{id}})).grupoFiscalId).toBe(fiscalId);
    await salvarGrupoFiscal({id:fiscalId,versao:1,nome:"Fiscal de produção",fiscal:{ncm:"16010000",cfop:"5102",pis:"99",ean:"6291041500213",unidadeTributavel:"KG"},ativo:true,atualizarVinculados:true},autor);
    const atualizado = await sim.prisma.produtoVenda.findUniqueOrThrow({where:{id}});
    expect(atualizado.fiscal).toMatchObject({ncm:"04069020",cfop:"5101",pis:"99",ean:"",unidadeTributavel:""}); expect(atualizado.fiscalRevisado).toBe(false);
    await expect(excluirCadastroVenda("PRODUTO",id,atualizado.versao,autor)).rejects.toThrow("grupos de complementos");
    expect(await sim.prisma.produtoVenda.count({where:{id}})).toBe(1);
    await excluirCadastroVenda("CATEGORIA_GRUPO",categoriaGrupo,1,autor);
    expect((await sim.prisma.grupoComplementoVenda.findUniqueOrThrow({where:{id:outroGrupo}})).categoriaId).toBeNull();
    expect(await sim.prisma.grupoComplementoVenda.count({where:{id:grupoOpcao}})).toBe(1);
  });
  it("persiste preço único, tempo, limites e exclusões próprios sem afetar outro produto", async () => {
    const gid = await salvarGrupo({id:"",versao:0,nome:"Regras individuais",tipo:"COMPOSICAO",minimo:1,maximo:2,repetir:false,ativo:true,opcoes:["Brie","Gouda"].map(nome=>({id:"",nome,preco:"10",produtoId:null,quantidade:"1",ativo:true}))},autor);
    const grupo = await sim.prisma.grupoComplementoVenda.findUniqueOrThrow({where:{id:gid},include:{opcoes:true}});
    const vinculo = {grupoId:gid,usarPadrao:false,minimo:1,maximo:1,opcoesExcluidas:[grupo.opcoes[1].id]};
    const id = await salvarProduto({...produto,nome:"Regras A",tempoPreparoMinutos:15,preco: "80",grupos:[vinculo]},autor);
    const outro = await salvarProduto({...produto,nome:"Regras B",grupos:[{...vinculo,minimo:2,maximo:2,opcoesExcluidas:[]}]},autor);
    await salvarGrupo({...grupo,versao:1,minimo:0,maximo:9,opcoes:grupo.opcoes.map(o=>({...o,preco:o.preco.toString(),quantidade:o.quantidade.toString()}))},autor);
    expect(await sim.prisma.produtoGrupoVenda.findFirst({where:{produtoId:id}})).toMatchObject(vinculo);
    expect(await sim.prisma.produtoGrupoVenda.findFirst({where:{produtoId:outro}})).toMatchObject({minimo:2,maximo:2,opcoesExcluidas:[]});
    expect((await sim.prisma.produtoVenda.findUniqueOrThrow({where:{id}})).preco.toString()).toBe("80");
    expect((await sim.prisma.produtoVenda.findUniqueOrThrow({where:{id}})).tempoPreparoMinutos).toBe(15);
    await expect(salvarProduto({...produto,nome:"Exclusão invasora",grupos:[{...vinculo,opcoesExcluidas:["de-outro-grupo"]}]},autor)).rejects.toThrow("não pertence");
    await expect(salvarProduto({...produto,nome:"Mínimo impossível",grupos:[{...vinculo,minimo:2,maximo:2}]},autor)).rejects.toThrow("mínimo excede");
  });
  it("complemento pode nascer independente e seus vínculos podem ser retirados preservando histórico", async () => {
    await salvarProduto({...produto,nome:"Complemento órfão",classificacao:"COMPLEMENTO",preco:"0"},autor);
    expect(await sim.prisma.produtoVenda.count({where:{nome:"Complemento órfão"}})).toBe(1);
    const gid=await salvarGrupo({id:"",versao:0,nome:"Grupo para complemento",tipo:"COMPLEMENTAR",minimo:0,maximo:null,repetir:true,ativo:true,opcoes:[]},autor);
    const id=await salvarProduto({...produto,nome:"Complemento vinculado",classificacao:"COMPLEMENTO",novoVinculoComplemento:{grupoId:gid,preco:"7.50"}},autor);
    expect(await sim.prisma.opcaoComplementoVenda.findFirst({where:{produtoId:id}})).toMatchObject({grupoId:gid,nome:"Complemento vinculado",ativo:true});
    const grupo=await sim.prisma.grupoComplementoVenda.findUniqueOrThrow({where:{id:gid}});
    expect(grupo.versao).toBe(2);
    await salvarGrupo({...grupo,opcoes:[]},autor);
    expect(await sim.prisma.opcaoComplementoVenda.count({where:{produtoId:id,ativo:true}})).toBe(0);
    expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(0);
  });
  it("status altera só situação/versão e protege edição concorrente",async()=>{
    const id=await salvarProduto({...produto,nome:"Status isolado",tempoPreparoMinutos:18},autor);
    const precos=await sim.prisma.precoProdutoVenda.findMany({where:{produtoId:id}});
    await alterarSituacaoProduto(id,1,false,autor);
    expect(await sim.prisma.produtoVenda.findUnique({where:{id}})).toMatchObject({nome:"Status isolado",ativo:false,versao:2,tempoPreparoMinutos:18});
    expect(await sim.prisma.precoProdutoVenda.findMany({where:{produtoId:id}})).toEqual(precos);
    await expect(alterarSituacaoProduto(id,1,true,autor)).rejects.toThrow("outra tela");
  });
  const pacoteImportacao = () => ({ formato: 1, origem: "IFOOD", loja: "loja-importacao", referencia: "Teste isolado de importação",
    categorias: [{ chave: "cat-ext", nome: "Categoria externa" }],
    grupos: [{ chave: "g-ext", nome: "Grupo externo", tipo: "COMPLEMENTAR", minimo: 1, maximo: 1, repetir: false, opcoes: [{ chave: "op-ext", nome: "Escolha externa", preco: "29", produtoChave: "porcao-ext", quantidade: "1" }] }],
    produtos: [
      { chave: "porcao-ext", nome: "Porção externa", tipo: "PADRAO", categorias: [], grupos: [], preco: "29" },
      { chave: "produto-ext", nome: "Produto externo", tipo: "PERSONALIZADO", categorias: ["cat-ext"], grupos: [{ chave: "g-ext", usarPadrao: true, minimo: 1, maximo: 1 }], preco: "0" },
    ],
  });
  it("importação mantém identidades e repetições concorrentes não duplicam", async () => {
    const conteudo = JSON.stringify(pacoteImportacao()); const previa = await previaImportacao(conteudo);
    expect(previa.contagens).toEqual({ novos: 4, atualizar: 0, manter: 0, conflitos: 0 });
    const resultados = await Promise.all([aplicarImportacao(conteudo, previa.token, autor), aplicarImportacao(conteudo, previa.token, autor)]);
    expect(resultados.map(r => r.aplicados).sort()).toEqual([0, 4]);
    const fonte = await sim.prisma.identidadeExternaVenda.findFirstOrThrow({ where: { chave: "produto-ext", entidade: "PRODUTO" } });
    const p = await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: fonte.destinoId }, include: { grupos: true, precos: true } });
    expect(p.ativo).toBe(false); expect(p.fiscalRevisado).toBe(false); expect(p.grupos).toHaveLength(1);
    expect(p.preco.toString()).toBe("0");
    expect((await previaImportacao(conteudo)).contagens.manter).toBe(4);
    expect(await sim.prisma.identidadeExternaVenda.count({ where: { loja: "loja-importacao" } })).toBe(5);
    expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
    expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(0);
  });
  it("importação detecta prévia obsoleta e preserva alteração local", async () => {
    const pacote = pacoteImportacao(); pacote.produtos[1].nome = "Produto externo atualizado";
    const conteudo = JSON.stringify(pacote); const previa = await previaImportacao(conteudo);
    expect(previa.contagens.atualizar).toBe(1);
    const fonte = await sim.prisma.identidadeExternaVenda.findFirstOrThrow({ where: { chave: "produto-ext", entidade: "PRODUTO" } });
    // Simula edição fiscal legítima, que incrementa a versão e não pode ser sobrescrita.
    await salvarFiscalProduto(fonte.destinoId, fonte.versaoDestino, { ncm: "04069020" }, false, autor);
    await expect(aplicarImportacao(conteudo, previa.token, autor)).rejects.toThrow("mudou depois da prévia");
    const outra = await previaImportacao(conteudo);
    expect(outra.linhas.find(l => l.chave === "produto-ext")?.situacao).toBe("CONFLITO");
    expect((await aplicarImportacao(conteudo, outra.token, autor)).aplicados).toBe(0);
    const p = await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: fonte.destinoId } });
    expect(p.nome).toBe("Produto externo"); expect(p.fiscal).toMatchObject({ ncm: "04069020" });
  });
  it("outra origem não une produtos por nome e conflitos não geram vínculos parciais", async () => {
    const pacote = pacoteImportacao(); pacote.origem = "TAKEAT";
    const conteudo = JSON.stringify(pacote); const previa = await previaImportacao(conteudo);
    expect(previa.contagens.conflitos).toBe(4);
    expect((await aplicarImportacao(conteudo, previa.token, autor)).aplicados).toBe(0);
    expect(await sim.prisma.identidadeExternaVenda.count({ where: { origem: "TAKEAT" } })).toBe(0);
  });
  it("não transforma produto já usado como opção em escolhas aninhadas por importação", async () => {
    const pacote = pacoteImportacao();
    // A opção já existente no banco deixa de apontar ao produto na nova origem.
    // Mesmo assim, outros vínculos locais podem continuar existindo: exige revisão.
    pacote.grupos[0].opcoes[0].produtoChave = "";
    const bruto = JSON.parse(JSON.stringify(pacote));
    bruto.grupos[0].opcoes[0].produtoChave = null;
    bruto.produtos[0].grupos = [{ chave: "g-ext", usarPadrao: true, minimo: 1, maximo: 1 }];
    const conteudo = JSON.stringify(bruto);
    const previa = await previaImportacao(conteudo);
    expect(previa.linhas.find(l => l.chave === "porcao-ext")).toMatchObject({ situacao: "CONFLITO", motivo: expect.stringContaining("já compõe opções") });
    const fonte = await sim.prisma.identidadeExternaVenda.findFirstOrThrow({ where: { chave: "porcao-ext", entidade: "PRODUTO" } });
    await aplicarImportacao(conteudo, previa.token, autor);
    expect(await sim.prisma.produtoGrupoVenda.count({ where: { produtoId: fonte.destinoId } })).toBe(0);
  });
});
