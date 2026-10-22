import { salvarFiscalSimples, salvarGrupoFiscalSimples } from "@/lib/tributacao/edicao-simples";
import { camposDoProduto, camposDaRegra } from "@/lib/tributacao/campos-simples";
import { prepararMigrationHubIsolada, limparIntegracaoHubIsolada } from "../login/migrations-hub-isoladas";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessaoAtual } from "@/lib/session";
import type { ClassificacaoFiscal, PerfilFiscal, RegraFiscal, SalvarVersaoFiscalEntrada } from "@/lib/tributacao/tipos";

const sim = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, hoje: "2026-10-11" }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return sim.prisma; } }));
vi.mock("@/lib/tributacao/validacao", async importar => ({ ...await importar<typeof import("@/lib/tributacao/validacao")>(), hojeFiscal: () => sim.hoje }));
import { analisarImpactoFiscal, ativarVersaoFiscal, consultarPainelFiscal, dtoVersaoFiscal, hashFiscal, registrarDeclaracaoGrazing1PelaInstrucao, salvarVersaoFiscal } from "@/lib/tributacao/servico";
import { PRODUTO_DECLARACAO_FCI_GRAZING1, REFERENCIA_INSTRUCAO_GRAZING1, PENDENCIA_ORIGEM_GRAZING1 } from "@/lib/tributacao/declaracao-fci-contrato";
import { salvarManutencaoFiscal, revisarManutencaoFiscal, aplicarManutencaoFiscal, consultarFichaFiscal, simularConciliacaoFiscal } from "@/lib/tributacao/manutencao";
import { capturarConciliacaoFiscal } from "../../scripts/fiscal-unificado-simular.mjs";
import { excluirCadastroVenda } from "@/lib/vendas/persistencia";
import { calcularPreviaPedido } from "@/lib/tributacao/pedidos";
import { conferirFciFiscal } from "@/lib/tributacao/fci";
import { classificacaoFicticia } from "./declaracao-fci-fixtures";
import { versoesVigentes } from "@/lib/tributacao/motor";
import { fotografarPoliticaKit } from "@/lib/tributacao/fotografia-kit";
import { exigirTransmissaoBrasilNfeLiberada, transmissaoBrasilNfeLiberada } from "@/lib/fiscal-saida/brasilnfe/bloqueio-transmissao";
import { obterAdaptadorFiscalSaida } from "@/lib/fiscal-saida/provedor";

const esquema = `teste_estrutura_fiscal_${randomUUID().replaceAll("-", "")}`;
let banco: Client | undefined, criado = false;
let sessao: SessaoAtual, operador: SessaoAtual, produtoId: string, perfilAdminId: string, perfilConsultaId: string;
const legado = { ncm: "19059090", cfop: "5102", observacoes: "Cadastro anterior exclusivamente fictício" };
function entrada(alteracoes: Partial<SalvarVersaoFiscalEntrada> = {}): SalvarVersaoFiscalEntrada {
  const classificacao: ClassificacaoFiscal = { produtoId, grupo: "GF05", natureza: "FRACIONADO", tratamento: "NORMAL",
    ncm: "08061000", origem: "0", cest: null, unidade: "UN", estado: "PENDENTE",
    evidencias: ["Nota de entrada exclusivamente fictícia"], pendencias: ["Característica pendente sintética"] };
  return { tipo: "CLASSIFICACAO", chave: produtoId, versaoBase: 0, vigenciaInicio: sim.hoje,
    dados: classificacao, justificativa: "Classificação sintética em teste isolado", fontes: ["https://www.gov.br/receitafederal/pt-br"], chaveOperacao: randomUUID(), ...alteracoes };
}
function perfilLp(): PerfilFiscal {
  return { estabelecimento: "singleton", cnpj: "12345678000195", uf: "SP", codigoMunicipio: "3550308", inscricaoEstadual: "123456789012",
    regime: "LUCRO_PRESUMIDO", confirmado: false, evidenciaEnquadramento: "", modelos: ["55", "65"], emissor: "TAKEAT",
    reforma: "EXIGIR_REGRA", beneficioOpcional: null };
}

describe.skipIf(process.env.ESTRUTURA_FISCAL_BANCO_TESTE !== "1")("Estrutura fiscal: autorização, concorrência, versões e auditoria em banco isolado", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/teste_estrutura_fiscal") throw new Error("Somente PostgreSQL local teste_estrutura_fiscal é permitido.");
    banco = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 10000 });
    await banco.connect(); await banco.query(`CREATE SCHEMA "${esquema}"`); criado = true;
    await banco.query(`SET search_path TO "${esquema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      await banco.query(await prepararMigrationHubIsolada(banco, esquema, pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    }
    sim.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 4, options: `-c search_path=${esquema}` }, { schema: esquema }) });
    perfilAdminId = (await sim.prisma.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } })).id;
    perfilConsultaId = (await sim.prisma.perfilAcesso.create({ data: { nome: "Operador fiscal sintético", permissoes: { "vendas.fiscal": ["visualizar", "editar"] } } })).id;
    await sim.prisma.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { id: "singleton", nome: "Loja exclusivamente fictícia", cnpj: "12345678000195" }, update: { cnpj: "12345678000195" } });
  }, 120000);
  beforeEach(async () => {
    sim.hoje = "2026-10-11";
    const autor = await sim.prisma.usuario.create({ data: { nome: "Administrador fictício", email: `${randomUUID()}@example.invalid`, senhaHash: "inutil", perfilAcessoId: perfilAdminId } });
    const leitor = await sim.prisma.usuario.create({ data: { nome: "Operador fictício", email: `${randomUUID()}@example.invalid`, senhaHash: "inutil", perfilAcessoId: perfilConsultaId } });
    sessao = { userId: autor.id, nome: autor.nome, email: autor.email, versao: 0, admin: true, permissoes: {}, excecoes: {}, perfilNome: "Administrador" };
    operador = { ...sessao, userId: leitor.id, nome: leitor.nome, email: leitor.email, admin: false, perfilNome: "Operador" };
    produtoId = (await sim.prisma.produtoVenda.create({ data: { nome: "Produto exclusivamente fictício", codigo: randomUUID(), fiscal: legado, fiscalRevisado: true, grupoFiscalId: "fiscal-grupo-gf05", versao: 3 } })).id;
  });
  afterAll(async () => {
    await sim.prisma?.$disconnect();
    if (!banco) return;
    if (criado && /^teste_estrutura_fiscal_[a-f0-9]{32}$/.test(esquema)) { await limparIntegracaoHubIsolada(banco, esquema); await banco.query(`DROP SCHEMA "${esquema}" CASCADE`); }
    await banco.end();
  });

  it("a ficha canônica aplicada altera prévia e montagem 55/65 sem tocar snapshots anteriores", async () => {
    sim.hoje = "2026-10-21";
    const grupo = await sim.prisma.grupoFiscalVenda.create({ data: { nome: `Grupo do usuário fictício ${randomUUID()}` } });
    const perfil: PerfilFiscal = { estabelecimento: "singleton", cnpj: "12345678000195", uf: "SP", codigoMunicipio: "3550308", inscricaoEstadual: "123456789012", regime: "SIMPLES_NACIONAL", crt: 1, confirmado: true, evidenciaEnquadramento: "Enquadramento exclusivamente sintético", modelos: ["55", "65"], emissor: "BRASIL_NFE", reforma: "DISPENSADO_SIMPLES_2026", beneficioOpcional: null };
    const tributo = (cst: string) => ({ cst, aliquota: null, reducaoBase: "0", modalidade: "SEM_DESTAQUE" as const, justificativa: "Fundamento exclusivamente sintético" });
    const regra: RegraFiscal = { estabelecimento: "singleton", regime: "SIMPLES_NACIONAL", operacao: "VENDA", ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL", grupo: null, grupoFiscalId: grupo.id, produtoId: null, natureza: null, ncm: null, cfop: "5102", csosn: "102", icms: tributo("00"), pis: tributo("49"), cofins: tributo("49"), ipi: null, st: "NAO_APLICAVEL", cest: null, segregacaoReceita: "REVENDA_SINTETICA", reforma: null, seletivo: "NAO_APLICAVEL" };
    const c: ClassificacaoFiscal = { produtoId, grupo: null, grupoFiscalId: grupo.id, natureza: "FRACIONADO", tratamento: "NORMAL", ncm: "08061000", origem: "0", cest: null, unidade: "UN", gtin: "SEM GTIN", estado: "CONFIRMADO", evidencias: ["Classificação exclusivamente sintética"], pendencias: [] };
    const entradas: SalvarVersaoFiscalEntrada[] = [];
    async function incluir(tipo: SalvarVersaoFiscalEntrada["tipo"], chave: string, dados: unknown) {
      const ultima = await sim.prisma.versaoEstruturaFiscal.findFirst({ where: { tipo, chave }, orderBy: { versao: "desc" } });
      entradas.push(entrada({ tipo, chave, versaoBase: ultima?.versao ?? 0, dados, vigenciaInicio: sim.hoje }));
    }
    await incluir("PERFIL", "singleton", perfil);
    for (const [tabela, codigos] of [["NCM", ["08061000", "08101000"]], ["CFOP", ["5102"]], ["CSOSN", ["102"]], ["CST_ICMS", ["00"]], ["CST_PIS_COFINS", ["49", "04"]]] as const) await incluir("TABELA", tabela, { tabela, referencia: "Tabela exclusivamente sintética", completa: false, linhas: codigos.map(codigo => ({ codigo, descricao: "Descrição exclusivamente sintética" })) });
    await incluir("CLASSIFICACAO", produtoId, c); await incluir("REGRA", `grupo-${grupo.id}`, regra);
    const salvas = await salvarManutencaoFiscal(entradas, sessao), impacto = await revisarManutencaoFiscal(salvas.ids, sessao);
    await aplicarManutencaoFiscal(salvas.ids, impacto.hash, sessao);
    await expect(excluirCadastroVenda("GRUPO_FISCAL", grupo.id, grupo.versao, sessao)).rejects.toThrow("integra versões fiscais");
    const cadastroAntes = await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: produtoId } });
    const p = await sim.prisma.pedidoVenda.create({ data: { chaveCriacao: randomUUID(), hashCriacao: "sintetico", status: "CONFIRMADO", canalNomeSnapshot: "Site", atendimento: "ENTREGA", criadoPorId: sessao.userId, subtotal: 100, total: 100, formaPagamentoInformada: "DINHEIRO", enderecoSnapshot: { uf: "SP" }, cobrancaSnapshot: { pais: "BRASIL", cep: "01001000", uf: "SP", codigoMunicipio: "3550308", cidade: "São Paulo", logradouro: "Rua fictícia", numero: "1", bairro: "Centro" }, compradorSnapshot: { tipo: "PF", nome: "Cliente exclusivamente fictício", documento: "00000000000" }, itens: { create: { produtoId, versaoPedido: 1, ordem: 0, quantidade: 1, unidadeSnapshot: "UN", produtoSnapshot: { nome: "Produto exclusivamente fictício" }, escolhasSnapshot: [], composicaoSnapshot: [], estadoComposicao: "CONHECIDA", precoOriginal: 100, precoAplicado: 100, acrescimos: 0, totalLinha: 100 } } }, include: { itens: true } });
    try {
      const anterior = await sim.prisma.documentoFiscalSaida.create({ data: { pedidoId: p.id, versaoPedido: 1, payload: { prova: "snapshot sintético imutável" }, hashPayload: "f".repeat(64), criadoPorId: sessao.userId, criadoPorNome: sessao.nome, status: "PENDENTE_CONFERENCIA", tentativas: 1, modeloDocumento: 55, serie: "6" } });
      const manifesto = await capturarConciliacaoFiscal(banco!, sim.hoje); expect(manifesto.somenteLeitura).toBe(true); expect(manifesto.dados.documentos.find((d: { id: string; hash: string }) => d.id === anterior.id)?.hash).toMatch(/^[a-f0-9]{64}$/);
      const fichaAntes = await consultarFichaFiscal(produtoId, sessao);
      expect((versoesVigentes(fichaAntes.painel.versoes, sim.hoje).find(v => v.tipo === "CLASSIFICACAO" && v.chave === produtoId)!.dados as ClassificacaoFiscal).ncm).toBe("08061000");
      const mudanca = await salvarManutencaoFiscal([entrada({ chave: produtoId, versaoBase: 1, dados: { ...c, ncm: "08101000" }, vigenciaInicio: sim.hoje })], sessao);
      for (const modelo of ["55", "65"] as const) {
        const pre = await sim.prisma.$transaction(tx => calcularPreviaPedido(tx, p, modelo, { consumidorFinal: true, indicadorPresenca: modelo === "65" ? 4 : 2 }));
        expect(pre.previa.linhas, JSON.stringify(pre.pendencias)).toHaveLength(1); expect(pre.documento.Produtos[0].NCM).toBe("08061000");
      }
      const revisao = await revisarManutencaoFiscal(mudanca.ids, sessao); await aplicarManutencaoFiscal(mudanca.ids, revisao.hash, sessao);
      for (const modelo of ["55", "65"] as const) {
        const pre = await sim.prisma.$transaction(tx => calcularPreviaPedido(tx, p, modelo, { consumidorFinal: true, indicadorPresenca: modelo === "65" ? 4 : 2 }));
        expect(pre.previa.linhas[0]).toMatchObject({ ncm: "08101000", origem: "0", cfop: "5102", csosn: "102" });
        expect(pre.documento.Produtos[0]).toMatchObject({ NCM: "08101000", OrigemProduto: 0, CFOP: 5102, EAN: "SEM GTIN", Imposto: { ICMS: { CodSituacaoTributaria: "102" } } });
      }
      expect(await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: anterior.id } })).toEqual(anterior);
      expect(await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: produtoId } })).toEqual(cadastroAntes);
      const propria = { ...regra, grupoFiscalId: null, produtoId, segregacaoReceita: "EXCECAO_EXCLUSIVAMENTE_SINTETICA" };
      for (const [numero, dados] of [[0, propria], [1, { ...propria, habilitada: false }]] as const) {
        const versoes = await salvarManutencaoFiscal([entrada({ tipo: "REGRA", chave: `excecao-${produtoId}`, versaoBase: numero, dados, vigenciaInicio: sim.hoje })], sessao);
        const revisao = await revisarManutencaoFiscal(versoes.ids, sessao); await aplicarManutencaoFiscal(versoes.ids, revisao.hash, sessao);
        for (const modelo of ["55", "65"] as const) {
          const pre = await sim.prisma.$transaction(tx => calcularPreviaPedido(tx, p, modelo, { consumidorFinal: true, indicadorPresenca: modelo === "65" ? 4 : 2 }));
          expect(pre.previa.linhas[0].segregacaoReceita).toBe(numero === 0 ? propria.segregacaoReceita : regra.segregacaoReceita);
        }
      }
      const comparacao = await simularConciliacaoFiscal(sessao); expect(comparacao.find(p => p.id === produtoId)?.diferencas).toContainEqual({ campo: "ncm", cadastrado: "19059090", vigente: "08101000" });
      const reversao = await salvarManutencaoFiscal([entrada({ chave: produtoId, versaoBase: 2, dados: c, vigenciaInicio: sim.hoje })], sessao);
      const impactoReversao = await revisarManutencaoFiscal(reversao.ids, sessao); await aplicarManutencaoFiscal(reversao.ids, impactoReversao.hash, sessao);
      const restaurada = await sim.prisma.$transaction(tx => calcularPreviaPedido(tx, p, "65", { consumidorFinal: true, indicadorPresenca: 4 }));
      expect(restaurada.documento.Produtos[0].NCM).toBe("08061000");
      expect(await sim.prisma.versaoEstruturaFiscal.count({ where: { tipo: "CLASSIFICACAO", chave: produtoId, status: "ATIVO" } })).toBe(3);
      expect(await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: anterior.id } })).toEqual(anterior);
      await expect(salvarManutencaoFiscal([entrada()], operador)).rejects.toThrow("acesso");
      const fichaSimples = await consultarFichaFiscal(produtoId, sessao);
      const vv = versoesVigentes(fichaSimples.painel.versoes, sim.hoje), classeSimples = vv.find(v => v.tipo === "CLASSIFICACAO" && v.chave === produtoId)!;
      const regraSimples = vv.find(v => v.tipo === "REGRA" && (v.dados as RegraFiscal).grupoFiscalId === grupo.id)!;
      const contextoSimples = { modelo: "65" as const, ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL" as const };
      const direto = { produtoId, classificacaoId: classeSimples.id, regraId: regraSimples.id, contexto: contextoSimples, grupoFiscalId: grupo.id, herdarOrigemGrupo: false, chaveOperacao: randomUUID(), fiscal: { ...camposDoProduto(classeSimples.dados as ClassificacaoFiscal, regraSimples.dados as RegraFiscal), ncm: "08101000" } };
      await expect(salvarFiscalSimples(direto, operador)).rejects.toThrow("acesso");
      await salvarFiscalSimples(direto, sessao);
      await salvarFiscalSimples(direto, sessao);
      await expect(salvarFiscalSimples({ ...direto, fiscal: { ...direto.fiscal, ncm: "08061000" } }, sessao)).rejects.toThrow("outros dados");
      await expect(salvarFiscalSimples({ ...direto, chaveOperacao: randomUUID() }, sessao)).rejects.toThrow("atualizado");
      const outro = await sim.prisma.produtoVenda.create({ data: { nome: "Item legado exclusivamente sintético", grupoFiscalId: grupo.id, unidade: "UN", fiscal: { ncm: "08061000" } } });
      const classeLegada = { ...c, produtoId: outro.id, grupo: "GF05" as const }; delete classeLegada.grupoFiscalId;
      const loteLegado = await salvarManutencaoFiscal([entrada({ chave: outro.id, dados: classeLegada, vigenciaInicio: sim.hoje })], sessao);
      const impactoLegado = await revisarManutencaoFiscal(loteLegado.ids, sessao); await aplicarManutencaoFiscal(loteLegado.ids, impactoLegado.hash, sessao);
      const cadastroLegado = await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: outro.id } });
      const fiscaisGrupo = { ...camposDaRegra(regraSimples.dados as RegraFiscal), origem: "0", pis: "04" };
      await salvarGrupoFiscalSimples({ id: grupo.id, versao: grupo.versao, nome: grupo.nome, ativo: true, regraId: regraSimples.id, contexto: contextoSimples, fiscal: fiscaisGrupo, chaveOperacao: randomUUID() }, sessao);
      const novoProduto = await sim.prisma.produtoVenda.create({ data: { nome: "Novo cadastro fiscal exclusivamente sintético", grupoFiscalId: grupo.id, unidade: "UN" } });
      const primeiroCadastro = { produtoId: novoProduto.id, classificacaoId: null, regraId: null, contexto: contextoSimples, grupoFiscalId: grupo.id, fiscal: { ...fiscaisGrupo, ncm: "08101000", natureza: "FRACIONADO", ean: "SEM GTIN", unidadeTributavel: "UN" }, herdarOrigemGrupo: true, chaveOperacao: randomUUID() };
      await salvarFiscalSimples(primeiroCadastro, sessao); await salvarFiscalSimples(primeiroCadastro, sessao);
      const fichaNova = await consultarFichaFiscal(novoProduto.id, sessao);
      expect((versoesVigentes(fichaNova.painel.versoes, sim.hoje).find(v => v.tipo === "CLASSIFICACAO" && v.chave === novoProduto.id)!.dados as ClassificacaoFiscal)).toMatchObject({ ncm: "08101000", origem: "0", herdarOrigemGrupo: true });
      const legadoAtual = await consultarFichaFiscal(outro.id, sessao);
      expect((versoesVigentes(legadoAtual.painel.versoes, sim.hoje).find(v => v.tipo === "CLASSIFICACAO" && v.chave === outro.id)!.dados as ClassificacaoFiscal).grupoFiscalId).toBe(grupo.id);
      expect(await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: outro.id } })).toEqual(cadastroLegado);
      for (const modelo of ["55", "65"] as const) {
        const pre = await sim.prisma.$transaction(tx => calcularPreviaPedido(tx, p, modelo, { consumidorFinal: true, indicadorPresenca: modelo === "65" ? 4 : 2 }));
        expect(pre.previa.apto, pre.previa.pendencias.join("; ")).toBe(true); expect(pre.documento.Produtos[0].NCM).toBe("08101000");
        expect(pre.previa.linhas[0].impostos.pis.cst).toBe("04");
      }
      expect(await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: anterior.id } })).toEqual(anterior);
      expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0); expect(await sim.prisma.notaFiscalRecebida.count()).toBe(0); expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(0);
    } finally { await sim.prisma.documentoFiscalSaida.deleteMany({ where: { pedidoId: p.id } }); await sim.prisma.itemPedidoVenda.deleteMany({ where: { pedidoId: p.id } }); await sim.prisma.pedidoVenda.delete({ where: { id: p.id } }); }
  }, 30000);
  it("Kit é escolha explícita; corrigir preparação gera uma linha 55/65 e preserva frutas, pedido e tentativa incerta", async () => {
    sim.hoje = "2026-10-22";
    const grupo = await sim.prisma.grupoFiscalVenda.create({ data: { nome: `Preparações sintéticas ${randomUUID()}` } });
    const fruta = await sim.prisma.produtoVenda.create({ data: { nome: "Fruta exclusivamente sintética", unidade: "UN" } });
    const perfil: PerfilFiscal = { estabelecimento: "singleton", cnpj: "12345678000195", uf: "SP", codigoMunicipio: "3550308", inscricaoEstadual: "123456789012", regime: "SIMPLES_NACIONAL", crt: 1, confirmado: true, evidenciaEnquadramento: "Fixture", modelos: ["55", "65"], emissor: "BRASIL_NFE", reforma: "DISPENSADO_SIMPLES_2026", beneficioOpcional: null };
    const tributo = { cst: "49", aliquota: null, reducaoBase: "0", modalidade: "SEM_DESTAQUE" as const, justificativa: "Fixture sem efeito real" };
    const regra: RegraFiscal = { estabelecimento: "singleton", regime: "SIMPLES_NACIONAL", operacao: "VENDA", ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL", grupo: null, produtoId: fruta.id, natureza: null, ncm: null, cfop: "5101", csosn: "900", icms: { ...tributo, cst: "00" }, pis: tributo, cofins: tributo, ipi: null, st: "NAO_APLICAVEL", cest: null, segregacaoReceita: "FIXTURE", reforma: null, seletivo: "NAO_APLICAVEL" };
    const classe: ClassificacaoFiscal = { produtoId, grupo: null, grupoFiscalId: grupo.id, natureza: "PREPARADO", tratamento: "NORMAL", ncm: "21069090", origem: "0", gtin: "SEM GTIN", cest: null, unidade: "UN", estado: "CONFIRMADO", evidencias: ["Fixture"], pendencias: [] };
    async function ativar(tipo: SalvarVersaoFiscalEntrada["tipo"], chave: string, dados: unknown) {
      const ultima = await sim.prisma.versaoEstruturaFiscal.findFirst({ where: { tipo, chave }, orderBy: { versao: "desc" } });
      const l = await salvarManutencaoFiscal([entrada({ tipo, chave, dados, versaoBase: ultima?.versao ?? 0 })], sessao);
      const a = await revisarManutencaoFiscal(l.ids, sessao); await aplicarManutencaoFiscal(l.ids, a.hash, sessao);
      return l.ids[0];
    }
    await ativar("PERFIL", "singleton", perfil);
    for (const [tabela, codigos] of [["NCM", ["21069090", "08061000"]], ["CFOP", ["5101"]], ["CSOSN", ["102", "900"]], ["CST_ICMS", ["00"]], ["CST_PIS_COFINS", ["49"]]] as const) await ativar("TABELA", tabela, { tabela, referencia: "Fixture", completa: false, linhas: codigos.map(codigo => ({ codigo, descricao: "Fixture" })) });
    await ativar("CLASSIFICACAO", fruta.id, { ...classe, produtoId: fruta.id, natureza: "FRACIONADO", ncm: "08061000" });
    const regraFrutaId = await ativar("REGRA", `fruta-${fruta.id}`, regra);
    const classeOriginalId = await ativar("CLASSIFICACAO", produtoId, classe);
    const contexto = { modelo: "65" as const, ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL" as const };
    const definirKit = { produtoId, classificacaoId: classeOriginalId, regraId: null, contexto, grupoFiscalId: grupo.id, herdarOrigemGrupo: false, fiscal: {}, representacao: "KIT" as const, chaveOperacao: randomUUID(), componentesKit: [{ produtoId: fruta.id, quantidade: "1", pesoRateio: "1" }] };
    await expect(salvarFiscalSimples({ ...definirKit, componentesKit: [] }, sessao)).rejects.toThrow("adicione as mercadorias");
    await expect(salvarFiscalSimples(definirKit, operador)).rejects.toThrow("acesso");
    await salvarFiscalSimples(definirKit, sessao);
    const kit = versoesVigentes((await consultarFichaFiscal(produtoId, sessao)).painel.versoes, sim.hoje).find(v => v.tipo === "CLASSIFICACAO" && v.chave === produtoId)!;
    expect((kit.dados as ClassificacaoFiscal).componentesKit).toHaveLength(1);
    const foto = fotografarPoliticaKit(kit.dados as ClassificacaoFiscal, kit.id);
    const p = await sim.prisma.pedidoVenda.create({ data: { chaveCriacao: randomUUID(), hashCriacao: "fixture", status: "CONFIRMADO", canalNomeSnapshot: "Site", atendimento: "ENTREGA", criadoPorId: sessao.userId, subtotal: 100, frete: 10, total: 110, formaPagamentoInformada: "DINHEIRO", enderecoSnapshot: { uf: "SP" }, cobrancaSnapshot: { pais: "BRASIL", cep: "01001000", uf: "SP", codigoMunicipio: "3550308", cidade: "São Paulo", logradouro: "Rua fictícia", numero: "1", bairro: "Centro" }, compradorSnapshot: { tipo: "PF", nome: "Fixture", documento: "00000000000" }, itens: { create: { produtoId, versaoPedido: 1, ordem: 0, quantidade: 1, unidadeSnapshot: "UN", produtoSnapshot: { nome: "Preparação final sintética", fotografiaKitFiscal: foto }, escolhasSnapshot: [], composicaoSnapshot: [{ insumoId: "ingrediente-ficticio", quantidade: "1", unidade: "KG" }], estadoComposicao: "CONHECIDA", precoOriginal: 100, precoAplicado: 100, acrescimos: 0, totalLinha: 100 } } }, include: { itens: true } });
    try {
    const antes = await sim.prisma.$transaction(tx => calcularPreviaPedido(tx, p, "55", { consumidorFinal: true }));
    expect(antes.documento.Produtos[0].CodProdutoServico).toBe(fruta.id);
    expect(antes.pendencias.join(" ")).toContain("900");
    const incerta = await sim.prisma.documentoFiscalSaida.create({ data: { pedidoId: p.id, versaoPedido: 1, payload: { fixture: "kit fotografado anteriormente" }, hashPayload: "e".repeat(64), criadoPorId: sessao.userId, criadoPorNome: sessao.nome, status: "PENDENTE_CONFERENCIA", tentativas: 1, modeloDocumento: 55, serie: "6" } });
    const frutaAntes = await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: regraFrutaId } });
    const kitAntes = await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: kit.id } });
    const corrigir = { ...definirKit, classificacaoId: kit.id, representacao: "PRODUTO_PREPARADO" as const, componentesKit: undefined, chaveOperacao: randomUUID(), fiscal: { ncm: "21069090", origem: "0", ean: "SEM GTIN", unidadeTributavel: "UN", cfop: "5101", csosn: "102", pis: "49", cofins: "49" } };
    await salvarFiscalSimples(corrigir, sessao); await salvarFiscalSimples(corrigir, sessao);
    for (const modelo of ["55", "65"] as const) {
      const pre = await sim.prisma.$transaction(tx => calcularPreviaPedido(tx, p, modelo, { consumidorFinal: true }));
      expect(pre.pendencias).toEqual([]); expect(pre.apto).toBe(true);
      expect(pre.documento.Produtos).toHaveLength(1);
      expect(pre.documento.Produtos[0]).toMatchObject({ CodProdutoServico: produtoId, NCM: "21069090", ValorTotal: "100.00", ValorFrete: "10.00", EAN: "SEM GTIN", Imposto: { ICMS: { CodSituacaoTributaria: "102" } } });
      expect(pre.documento.ValorTotal).toBe("110.00");
    }
    expect(await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: regraFrutaId } })).toEqual(frutaAntes);
    expect(await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: kit.id } })).toEqual(kitAntes);
    expect(await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: incerta.id } })).toEqual(incerta);
    expect(await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id }, include: { itens: true } })).toEqual(p);
    } finally { await sim.prisma.documentoFiscalSaida.deleteMany({ where: { pedidoId: p.id } }); await sim.prisma.itemPedidoVenda.deleteMany({ where: { pedidoId: p.id } }); await sim.prisma.pedidoVenda.delete({ where: { id: p.id } }); }
  });
  it("a revisão consolidada recusa concorrência e a versão futura não entra antecipadamente", async () => {
    const d = entrada({ dados: { ...(entrada().dados as ClassificacaoFiscal), grupoFiscalId: null } });
    await expect(salvarManutencaoFiscal([{ ...d, justificativa: "x" }], sessao)).rejects.toThrow("15 caracteres");
    const salvo = await salvarManutencaoFiscal([d], sessao); expect(await salvarManutencaoFiscal([d], sessao)).toEqual(salvo);
    const revisao = await revisarManutencaoFiscal(salvo.ids, sessao);
    await sim.prisma.produtoVenda.update({ where: { id: produtoId }, data: { versao: { increment: 1 } } });
    await expect(aplicarManutencaoFiscal(salvo.ids, revisao.hash, sessao)).rejects.toThrow("mudou");
    expect((await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: salvo.ids[0] } })).status).toBe("RASCUNHO");
    const futuro = await salvarManutencaoFiscal([entrada({ versaoBase: 1, dados: d.dados, vigenciaInicio: "2027-01-01" })], sessao), analise = await revisarManutencaoFiscal(futuro.ids, sessao);
    await aplicarManutencaoFiscal(futuro.ids, analise.hash, sessao);
    expect(versoesVigentes((await consultarPainelFiscal(sessao)).versoes, sim.hoje).some(v => v.id === futuro.ids[0])).toBe(false);
  });
  it("migração cria os doze grupos sem NCM padrão", async () => {
    const grupos = await sim.prisma.grupoFiscalVenda.findMany({ where: { codigo: { startsWith: "GF" } }, orderBy: { codigo: "asc" } });
    expect(grupos).toHaveLength(12); expect(grupos.map(g => g.codigo)).toEqual(Array.from({ length: 12 }, (_, i) => `GF${String(i + 1).padStart(2, "0")}`));
    expect(grupos.every(g => JSON.stringify(g.fiscal) === "{}")).toBe(true);
  });
  it("correção nacional SEM GTIN preserva a FCI anterior e permite ambos os modelos sem inventar FCI", async () => {
    sim.hoje = "2026-10-15";
    const rede = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Rede proibida neste teste sintético"));
    try {
      await sim.prisma.produtoVenda.create({ data: { id: PRODUTO_DECLARACAO_FCI_GRAZING1, codigo: randomUUID(), nome: "Preparação exclusivamente sintética", unidade: "UN" } });
      const dados = classificacaoFicticia(); delete dados.fci;
      dados.origem = null; dados.pendencias = [PENDENCIA_ORIGEM_GRAZING1];
      const inicial = await salvarVersaoFiscal(entrada({ chave: PRODUTO_DECLARACAO_FCI_GRAZING1, vigenciaInicio: sim.hoje, dados }), sessao);
      const baseInicial = await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: inicial.id } });
      const declarada = await registrarDeclaracaoGrazing1PelaInstrucao({ baseId: inicial.id, baseHash: baseInicial.hash, referenciaInstrucao: REFERENCIA_INSTRUCAO_GRAZING1 }, sessao);
      const impactoAnterior = await analisarImpactoFiscal(declarada.id, sessao);
      await ativarVersaoFiscal(declarada.id, impactoAnterior.hash, randomUUID(), sessao);
      const antiga = await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: declarada.id } });
      const anterior = antiga.dados as unknown as ClassificacaoFiscal;
      expect(anterior.fci!.declaracaoResponsavel!.modelos).toEqual(["55"]);
      sim.hoje = "2026-10-21";
      const nacional = { ...structuredClone(anterior), origem: "0", gtin: "SEM GTIN" }; delete nacional.fci;
      const correcao = entrada({ chave: antiga.chave, versaoBase: antiga.versao, vigenciaInicio: sim.hoje, dados: nacional,
        justificativa: "Declaração exclusivamente sintética: produção nacional com ingredientes exclusivamente nacionais e sem GTIN. Histórico anterior preservado.", fontes: ["INSTRUCAO_RESPONSAVEL_EXCLUSIVAMENTE_SINTETICA"] });
      await expect(salvarVersaoFiscal(correcao, operador)).rejects.toThrow("acesso");
      const criada = await salvarVersaoFiscal(correcao, sessao);
      expect((await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: criada.id } })).status).toBe("RASCUNHO");
      const impactoNovo = await analisarImpactoFiscal(criada.id, sessao);
      await ativarVersaoFiscal(criada.id, impactoNovo.hash, randomUUID(), sessao);
      const nova = await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: criada.id } });
      const c = nova.dados as unknown as ClassificacaoFiscal;
      expect(nova.status).toBe("ATIVO"); expect(nova.versao).toBe(antiga.versao + 1); expect(nova.hash).toBe(hashFiscal(c));
      expect(c).toMatchObject({ origem: "0", gtin: "SEM GTIN" }); expect(c).not.toHaveProperty("fci");
      const { origem: origemAntiga, fci: fciAntiga, ...demaisAnteriores } = anterior;
      const { origem: origemNova, ...demaisNovos } = c;
      expect(origemAntiga).toBe("5"); expect(origemNova).toBe("0"); expect(fciAntiga).toBeTruthy(); expect(demaisNovos).toEqual(demaisAnteriores);
      expect(await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: antiga.id } })).toEqual(antiga);
      expect(await sim.prisma.eventoEstruturaFiscal.findMany({ where: { versaoId: nova.id } })).toEqual(expect.arrayContaining([
        expect.objectContaining({ tipo: "RASCUNHO", usuarioId: sessao.userId }), expect.objectContaining({ tipo: "ATIVACAO", usuarioId: sessao.userId }),
      ]));
      for (const modelo of ["55", "65"] as const) expect(conferirFciFiscal("0", c.fci, { data: sim.hoje, ufEmitente: "SP", ufDestino: "SP", modelo })).toEqual({ numero: null, pendencias: [] });
      expect(await sim.prisma.documentoFiscalSaida.count()).toBe(0); expect(await sim.prisma.eventoFiscalSaida.count()).toBe(0);
      expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(0); expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0); expect(await sim.prisma.notaFiscalRecebida.count()).toBe(0);
      expect(rede).not.toHaveBeenCalled(); expect(obterAdaptadorFiscalSaida()).toBeNull();
    } finally { rede.mockRestore(); }
  });
  it("sessão revogada não consulta, salva, analisa ou ativa", async () => {
    const salvo = await salvarVersaoFiscal(entrada(), sessao), impacto = await analisarImpactoFiscal(salvo.id, sessao);
    await sim.prisma.usuario.update({ where: { id: sessao.userId }, data: { sessaoVersao: 1 } });
    await expect(consultarPainelFiscal(sessao)).rejects.toThrow("sessão");
    await expect(salvarVersaoFiscal(entrada(), sessao)).rejects.toThrow("sessão");
    await expect(analisarImpactoFiscal(salvo.id, sessao)).rejects.toThrow("sessão");
    await expect(ativarVersaoFiscal(salvo.id, impacto.hash, randomUUID(), sessao)).rejects.toThrow("sessão");
    expect((await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: salvo.id } })).status).toBe("RASCUNHO");
  });
  it("usuário com permissão de leitura/edição fiscal não administra versões", async () => {
    const salvo = await salvarVersaoFiscal(entrada(), sessao), impacto = await analisarImpactoFiscal(salvo.id, sessao);
    expect((await consultarPainelFiscal(operador)).administrador).toBe(false);
    await expect(salvarVersaoFiscal(entrada(), operador)).rejects.toThrow("acesso");
    await expect(analisarImpactoFiscal(salvo.id, operador)).rejects.toThrow("acesso");
    await expect(ativarVersaoFiscal(salvo.id, impacto.hash, randomUUID(), operador)).rejects.toThrow("acesso");
  });
  it.each([undefined, "1"])("perfil Brasil NFe auditado não depende da flag produtiva (%s) e não libera transmissão", async flag => {
    vi.stubEnv("BRASIL_NFE_PRODUCAO_AUTORIZADA", flag);
    const rede = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Rede proibida neste teste sintético"));
    const contagens = async () => ({
      documentos: await sim.prisma.documentoFiscalSaida.count(), eventos: await sim.prisma.eventoFiscalSaida.count(),
      financeiro: await sim.prisma.lancamentoFinanceiro.count(), estoque: await sim.prisma.movimentacaoEstoque.count(),
      recebidas: await sim.prisma.notaFiscalRecebida.count(),
    });
    try {
      const loja = await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } });
      const antes = await contagens();
      const ultima = await sim.prisma.versaoEstruturaFiscal.findFirst({ where: { tipo: "PERFIL", chave: "singleton" }, orderBy: { versao: "desc" } });
      const perfil: PerfilFiscal = { ...perfilLp(), regime: "SIMPLES_NACIONAL", crt: 1, emissor: "BRASIL_NFE",
        confirmado: true, reforma: "DISPENSADO_SIMPLES_2026", evidenciaEnquadramento: "Decisão interna exclusivamente sintética; documento de enquadramento fictício identificado" };
      const salvo = await salvarVersaoFiscal(entrada({ tipo: "PERFIL", chave: "singleton", versaoBase: ultima?.versao ?? 0, dados: perfil }), sessao);
      const impacto = await analisarImpactoFiscal(salvo.id, sessao);
      await ativarVersaoFiscal(salvo.id, impacto.hash, randomUUID(), sessao);
      const ativo = await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: salvo.id } });
      expect(ativo.status).toBe("ATIVO"); expect(ativo.dados).toMatchObject({ crt: 1, emissor: "BRASIL_NFE" });
      const evento = await sim.prisma.eventoEstruturaFiscal.findFirstOrThrow({ where: { versaoId: salvo.id, tipo: "ATIVACAO" } });
      expect(evento.usuarioId).toBe(sessao.userId); expect(evento.dados).toMatchObject({ hashImpacto: impacto.hash, hashConteudo: ativo.hash });
      expect(await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } })).toEqual(loja);
      expect(await contagens()).toEqual(antes); expect(rede).not.toHaveBeenCalled();
      expect(transmissaoBrasilNfeLiberada()).toBe(false); expect(obterAdaptadorFiscalSaida()).toBeNull();
      expect(() => exigirTransmissaoBrasilNfeLiberada()).toThrow("Emissão ainda não liberada");
    } finally { rede.mockRestore(); vi.unstubAllEnvs(); }
  });
  it("escritas concorrentes com a mesma base produzem uma versão, recusando a desatualizada", async () => {
    const resultados = await Promise.allSettled([salvarVersaoFiscal(entrada(), sessao), salvarVersaoFiscal(entrada(), sessao)]);
    expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(resultados.filter(r => r.status === "rejected")).toHaveLength(1);
    expect(await sim.prisma.versaoEstruturaFiscal.count({ where: { tipo: "CLASSIFICACAO", chave: produtoId } })).toBe(1);
  });
  it("repetição idempotente conserva versão/evento e rejeita a chave com conteúdo diferente", async () => {
    const d = entrada(), a = await salvarVersaoFiscal(d, sessao), b = await salvarVersaoFiscal(d, sessao);
    expect(a.id).toBe(b.id);
    expect(await sim.prisma.eventoEstruturaFiscal.count({ where: { versaoId: a.id, tipo: "RASCUNHO" } })).toBe(1);
    await expect(salvarVersaoFiscal({ ...d, dados: { ...(d.dados as ClassificacaoFiscal), ncm: "08062000" } }, sessao)).rejects.toThrow("conteúdo diferente");
    expect(await sim.prisma.versaoEstruturaFiscal.count({ where: { chave: produtoId } })).toBe(1);
  });
  it("mudança no catálogo invalida a análise de impacto antes da ativação", async () => {
    const salvo = await salvarVersaoFiscal(entrada(), sessao), impacto = await analisarImpactoFiscal(salvo.id, sessao);
    await sim.prisma.produtoVenda.update({ where: { id: produtoId }, data: { versao: { increment: 1 } } });
    await expect(ativarVersaoFiscal(salvo.id, impacto.hash, randomUUID(), sessao)).rejects.toThrow("Execute novamente");
    expect(await sim.prisma.eventoEstruturaFiscal.count({ where: { versaoId: salvo.id, tipo: "ATIVACAO" } })).toBe(0);
    expect((await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: salvo.id } })).status).toBe("RASCUNHO");
  });
  it("ativação futura conserva a data e não substitui a configuração vigente antecipadamente", async () => {
    const salvo = await salvarVersaoFiscal(entrada({ vigenciaInicio: "2027-01-01" }), sessao);
    const impacto = await analisarImpactoFiscal(salvo.id, sessao); await ativarVersaoFiscal(salvo.id, impacto.hash, randomUUID(), sessao);
    const v = dtoVersaoFiscal(await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: salvo.id } }));
    expect(v.status).toBe("ATIVO"); expect(versoesVigentes([v], "2026-12-31")).toEqual([]);
    expect(versoesVigentes([v], "2027-01-01").map(v => v.id)).toEqual([salvo.id]);
  });
  it("perfil LP não confirmado permanece rascunho e não é antecipado em 2026", async () => {
    const ultima = await sim.prisma.versaoEstruturaFiscal.findFirst({ where: { tipo: "PERFIL", chave: "singleton" }, orderBy: { versao: "desc" } });
    const d = entrada({ tipo: "PERFIL", chave: "singleton", versaoBase: ultima?.versao ?? 0, vigenciaInicio: "2027-01-01", dados: perfilLp() });
    const salvo = await salvarVersaoFiscal(d, sessao), impacto = await analisarImpactoFiscal(salvo.id, sessao);
    await expect(ativarVersaoFiscal(salvo.id, impacto.hash, randomUUID(), sessao)).rejects.toThrow("Confirme o enquadramento");
    expect((await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: salvo.id } })).status).toBe("RASCUNHO");
    await expect(salvarVersaoFiscal({ ...d, chaveOperacao: randomUUID(), vigenciaInicio: "2026-10-11", versaoBase: d.versaoBase + 1 }, sessao)).rejects.toThrow("Não antecipar");
  });
  it("banco impede alteração dos dados/hash e exclusão da versão histórica", async () => {
    const d = entrada(), salvo = await salvarVersaoFiscal(d, sessao);
    await expect(sim.prisma.versaoEstruturaFiscal.update({ where: { id: salvo.id }, data: { dados: { adulterado: true } } })).rejects.toThrow("imutável");
    await expect(sim.prisma.versaoEstruturaFiscal.update({ where: { id: salvo.id }, data: { hash: "hash-adulterado" } })).rejects.toThrow("imutável");
    await expect(sim.prisma.versaoEstruturaFiscal.delete({ where: { id: salvo.id } })).rejects.toThrow("não podem ser apagadas");
    const original = await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: salvo.id } });
    expect(original.dados).toEqual(d.dados); expect(original.hash).toBe(hashFiscal(d.dados));
  });
  it("ativação idempotente preserva eventos e não permite retroceder o status", async () => {
    const salvo = await salvarVersaoFiscal(entrada(), sessao), impacto = await analisarImpactoFiscal(salvo.id, sessao), chave = randomUUID();
    await ativarVersaoFiscal(salvo.id, impacto.hash, chave, sessao); await ativarVersaoFiscal(salvo.id, impacto.hash, chave, sessao);
    expect((await sim.prisma.eventoEstruturaFiscal.findMany({ where: { versaoId: salvo.id }, orderBy: { createdAt: "asc" } })).map(e => e.tipo)).toEqual(["RASCUNHO", "IMPACTO", "ATIVACAO"]);
    await expect(sim.prisma.versaoEstruturaFiscal.update({ where: { id: salvo.id }, data: { status: "RASCUNHO" } })).rejects.toThrow("preservada no histórico");
  });
  it("versões prospectivas não reescrevem fiscal legado nem a fotografia de documento anterior", async () => {
    const pedido = await sim.prisma.pedidoVenda.create({ data: { chaveCriacao: randomUUID(), hashCriacao: "hash-pedido-ficticio", criadoPorId: sessao.userId, status: "CONFIRMADO", total: 20, subtotal: 20 } });
    const snapshot = { sintentico: true, fiscal: legado, total: "20.00" };
    const documento = await sim.prisma.documentoFiscalSaida.create({ data: { pedidoId: pedido.id, versaoPedido: 1, payload: snapshot, hashPayload: hashFiscal(snapshot), criadoPorId: sessao.userId, criadoPorNome: sessao.nome } });
    const d = entrada(), primeira = await salvarVersaoFiscal(d, sessao), impacto = await analisarImpactoFiscal(primeira.id, sessao);
    expect(impacto.documentosPreservados).toBeGreaterThanOrEqual(1); await ativarVersaoFiscal(primeira.id, impacto.hash, randomUUID(), sessao);
    const segunda = await salvarVersaoFiscal({ ...d, versaoBase: 1, chaveOperacao: randomUUID(), vigenciaInicio: "2027-01-01", dados: { ...(d.dados as ClassificacaoFiscal), ncm: "08062000" } }, sessao);
    expect(segunda.id).not.toBe(primeira.id);
    const p = await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: produtoId } });
    expect(p.fiscal).toEqual(legado); expect(p.fiscalRevisado).toBe(true); expect(p.grupoFiscalId).toBe("fiscal-grupo-gf05"); expect(p.versao).toBe(3);
    const antigo = await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: documento.id } });
    expect(antigo.payload).toEqual(snapshot); expect(antigo.hashPayload).toBe(hashFiscal(snapshot));
    expect(await sim.prisma.eventoEstruturaFiscal.count({ where: { versaoId: primeira.id } })).toBe(3);
  });
  it("ativação revalida UF/data/fonte da exceção líquida e preserva rascunhos sem prova, somente fixtures", async () => {
    const ultimaPerfil = await sim.prisma.versaoEstruturaFiscal.findFirst({ where: { tipo: "PERFIL", chave: "singleton" }, orderBy: { versao: "desc" } });
    const perfil = await salvarVersaoFiscal(entrada({ tipo: "PERFIL", chave: "singleton", versaoBase: ultimaPerfil?.versao ?? 0, vigenciaInicio: "2027-01-01", dados: { ...perfilLp(), confirmado: true, evidenciaEnquadramento: "Enquadramento exclusivamente sintético do teste local" } }), sessao);
    const impactoPerfil = await analisarImpactoFiscal(perfil.id, sessao); await ativarVersaoFiscal(perfil.id, impactoPerfil.hash, randomUUID(), sessao);
    // Este caminho fictício não representa ato existente; testa somente vínculo,
    // domínio da fonte, UF e vigência. Nenhuma regra é ativada em banco real.
    const fonte = "https://legislacao.fazenda.sp.gov.br/Paginas/ATO_FICTICIO_DE_TESTE.aspx";
    const tributo = { cst: "40", aliquota: null, reducaoBase: "0", modalidade: "SEM_DESTAQUE" as const, justificativa: "Tributo exclusivamente sintético" };
    const regra: RegraFiscal = { estabelecimento: "singleton", regime: "LUCRO_PRESUMIDO", operacao: "VENDA", ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL", grupo: "GF01", produtoId: null, natureza: "PREPARADO", ncm: "19059090", cfop: "5101", csosn: null, icms: tributo, pis: tributo, cofins: tributo, ipi: null, st: "NAO_APLICAVEL", cest: null, segregacaoReceita: "RECEITA_SINTETICA", seletivo: "NAO_APLICAVEL", reforma: { cst: "000", cClassTrib: "000001", cbs: "10", ibsUf: "5", ibsMunicipio: "5", reducao: "0", justificativa: "Taxas matemáticas exclusivamente fictícias", preco2027: { baseIcms: "LIQUIDA_RTC", rateio: "SEM_ACRESCIMOS", justificativa: "Política exclusivamente fictícia para teste local", excecaoBaseLiquida: { uf: "SP", vigenciaInicio: "2027-01-01", vigenciaFim: null, fonteNormativa: fonte, ato: "Ato exclusivamente fictício para teste", justificativa: "Exceção exclusivamente fictícia sem efeito real" } } } };
    for (const caso of ["UF", "DATA", "FONTE", "COMPLETO"] as const) {
      const dados = structuredClone(regra);
      if (caso === "UF") dados.reforma!.preco2027!.excecaoBaseLiquida!.uf = "RJ";
      if (caso === "DATA") dados.reforma!.preco2027!.excecaoBaseLiquida!.vigenciaInicio = "2027-02-01";
      const salvo = await salvarVersaoFiscal(entrada({ tipo: "REGRA", chave: `regra-${randomUUID()}`, vigenciaInicio: "2027-01-01", dados, fontes: caso === "FONTE" ? ["https://www.gov.br/receitafederal/pt-br"] : [fonte] }), sessao);
      const impacto = await analisarImpactoFiscal(salvo.id, sessao);
      if (caso === "COMPLETO") {
        await ativarVersaoFiscal(salvo.id, impacto.hash, randomUUID(), sessao);
        expect((await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: salvo.id } })).status).toBe("ATIVO");
        expect(await sim.prisma.eventoEstruturaFiscal.count({ where: { versaoId: salvo.id, tipo: "ATIVACAO" } })).toBe(1);
      } else {
        await expect(ativarVersaoFiscal(salvo.id, impacto.hash, randomUUID(), sessao)).rejects.toThrow("exceção normativa");
        expect((await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: salvo.id } })).status).toBe("RASCUNHO");
        expect(await sim.prisma.eventoEstruturaFiscal.count({ where: { versaoId: salvo.id, tipo: "ATIVACAO" } })).toBe(0);
      }
    }
  });
});
