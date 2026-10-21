import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessaoAtual } from "@/lib/session";
import type { ClassificacaoFiscal, RegraFiscal, SalvarVersaoFiscalEntrada } from "@/lib/tributacao/tipos";
import { classificacaoFicticia, materiaisFicticios } from "./declaracao-fci-fixtures";
const s = vi.hoisted(() => ({ usuario: vi.fn(), ultima: vi.fn(), criar: vi.fn(), evento: vi.fn(), loja: vi.fn(), foto: vi.fn(), execute: vi.fn(), transacao: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: s.transacao } }));
vi.mock("@/lib/tributacao/validacao", async original => ({ ...await original<typeof import("@/lib/tributacao/validacao")>(), hojeFiscal: () => "2026-10-15" }));
vi.mock("@/lib/tributacao/fotografia-tecnica", async original => ({ ...await original<typeof import("@/lib/tributacao/fotografia-tecnica")>(), fotografarClassificacaoNormal: s.foto }));
import { aprovarRevisaoConsolidadaNaTransacao, hashFiscal, hashRevisaoConsolidadaGrazing1, registrarDeclaracaoGrazing1PelaInstrucao, salvarVersaoFiscalNaTransacao } from "@/lib/tributacao/servico";
import { PENDENCIA_ORIGEM_GRAZING1, REFERENCIA_INSTRUCAO_GRAZING1, REGRA_DECLARACAO_FCI_GRAZING1 } from "@/lib/tributacao/declaracao-fci-contrato";
import type { Prisma } from "@/generated/prisma/client";
const sessao = { userId: "responsavel-sessao-ficticia", versao: 1 } as SessaoAtual;
function massa() {
  const c = classificacaoFicticia(), base = structuredClone(c); base.origem = null; base.fci!.situacao = "PENDENTE"; delete base.fci!.declaracaoResponsavel;
  const ultima = { id: "classificacao-base-ficticia", tipo: "CLASSIFICACAO", chave: c.produtoId!, versao: 3, hash: hashFiscal(base), dados: base };
  c.fci!.declaracaoResponsavel!.classificacaoBase = { id: ultima.id, hash: ultima.hash, versao: 3 };
  const entrada: SalvarVersaoFiscalEntrada = { tipo: "CLASSIFICACAO", chave: c.produtoId!, versaoBase: 3, vigenciaInicio: "2026-10-15", dados: c, justificativa: "Registrar exclusivamente a decisão administrativa sintética, sem aprovar demais parâmetros", fontes: ["INSTRUCAO-RESPONSAVEL-SOMENTE-TESTE"], chaveOperacao: "declaracao-ficticia-operacao" };
  return { c, base, ultima, entrada };
}
function tx() { return { $executeRaw: s.execute, usuario: { findUnique: s.usuario }, versaoEstruturaFiscal: { findUnique: vi.fn(async () => null), findFirst: s.ultima, create: s.criar }, produtoVenda: { findUnique: vi.fn(async () => ({ unidade: "UN" })) }, configuracaoLoja: { findUnique: s.loja }, eventoEstruturaFiscal: { create: s.evento } } as unknown as Prisma.TransactionClient; }
describe("Registro administrativo selado pelo serviço versionado existente", () => {
  beforeEach(() => {
    vi.clearAllMocks(); s.usuario.mockResolvedValue({ id: sessao.userId, nome: "Responsável da sessão fictícia", ativo: true, excluidoEm: null, sessaoVersao: 1, perfilAcesso: { sistema: "ADMINISTRADOR" } }); s.loja.mockResolvedValue({ cnpj: "00000000000000" });
    s.foto.mockResolvedValue({ algoritmo: "grazing.classificacao-fiscal.v1", principalHash: "b".repeat(64), materiais: materiaisFicticios }); s.criar.mockImplementation(async ({ data }) => ({ ...data, id: data.id ?? "regra-nova-ficticia" }));
    s.transacao.mockImplementation(async executar => executar(tx()));
  });
  it("salva nova versão e evento auditado sem ativar ou aprovar campos restantes", async () => {
    const m = massa(), antes = structuredClone(m.base); s.ultima.mockResolvedValue(m.ultima);
    const resultado = await salvarVersaoFiscalNaTransacao(tx(), m.entrada, sessao), data = s.criar.mock.calls[0][0].data;
    expect(data.id).toBe(resultado.id); expect(data.versao).toBe(4); expect(data).not.toHaveProperty("status"); expect(data.dados).toMatchObject({ estado: "PENDENTE", pendencias: m.c.pendencias, fci: { apuracaoCompleta: false, valorParcelaImportada: "2.125", valorSaidaReferencia: null, conteudoImportacao: null } });
    const registro = data.dados.fci.declaracaoResponsavel.registro;
    expect(registro.versaoId).toBe(data.id); expect(registro.responsavel.usuarioId).toBe(sessao.userId); expect(registro.executor).toMatchObject({ usuarioId: sessao.userId, modo: "AUTOMACAO_ASSISTIDA", identificacao: "Codex" }); expect(registro.hashConteudo).toMatch(/^[a-f0-9]{64}$/);
    expect(data.hash).toBe(hashFiscal(data.dados)); expect(m.base).toEqual(antes);
    expect(s.evento).toHaveBeenCalledTimes(1); expect(s.evento).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tipo: "RASCUNHO", usuarioId: sessao.userId, dados: expect.objectContaining({ declaracaoResponsavel: expect.objectContaining({ hashConteudo: data.hash, declaracao: data.dados.fci.declaracaoResponsavel, aprovacaoDemaisParametros: false }) }) }) }));
    expect(s.evento.mock.calls.some(c => c[0].data.tipo === "ATIVACAO")).toBe(false);
  });
  it.each(["CI", "materiais", "emitente", "base"])("recusa alteração fora do alcance comprovado: %s", async caso => {
    const m = massa(); s.ultima.mockResolvedValue(m.ultima);
    if (caso === "CI") (m.entrada.dados as ClassificacaoFiscal).fci!.valorParcelaImportada = "9";
    if (caso === "materiais") (m.entrada.dados as ClassificacaoFiscal).fci!.declaracaoResponsavel!.materiaisHash = "c".repeat(64);
    if (caso === "emitente") s.loja.mockResolvedValue({ cnpj: "11111111111111" });
    if (caso === "base") (m.entrada.dados as ClassificacaoFiscal).fci!.declaracaoResponsavel!.classificacaoBase.hash = "d".repeat(64);
    await expect(salvarVersaoFiscalNaTransacao(tx(), m.entrada, sessao)).rejects.toThrow(); expect(s.criar).not.toHaveBeenCalled(); expect(s.evento).not.toHaveBeenCalled();
  });
  it("sessão revogada ou perfil sem administração não registra declaração", async () => {
    const m = massa(); s.ultima.mockResolvedValue(m.ultima); s.usuario.mockResolvedValue({ ativo: true, sessaoVersao: 0 });
    await expect(salvarVersaoFiscalNaTransacao(tx(), m.entrada, sessao)).rejects.toThrow("sessão"); expect(s.criar).not.toHaveBeenCalled();
    s.usuario.mockResolvedValue({ ativo: true, sessaoVersao: 1, perfilAcesso: { sistema: "OPERADOR" } });
    await expect(salvarVersaoFiscalNaTransacao(tx(), m.entrada, sessao)).rejects.toThrow("acesso"); expect(s.criar).not.toHaveBeenCalled();
  });
  it("aprovação consolidada exige hash exato antes de qualquer efeito", async () => {
    const selecao = [{ id: "classificacao-ficticia", hash: "a".repeat(64) }];
    await expect(aprovarRevisaoConsolidadaNaTransacao(tx(), selecao, "b".repeat(64), sessao)).rejects.toThrow("revisão consolidada mudou");
    expect(s.execute).not.toHaveBeenCalled(); expect(s.criar).not.toHaveBeenCalled(); expect(s.evento).not.toHaveBeenCalled();
  });
  it.each(["outro-produto", "vigencia-passada", "hash-alterado", "perfil"])("aprovação consolidada não contorna revisão: %s", async caso => {
    const m = massa(), id = "classificacao-ficticia", dados = structuredClone(m.c), versao = { ...m.ultima, id, status: "RASCUNHO", dados, hash: hashFiscal(dados), vigenciaInicio: new Date("2026-10-15T00:00:00Z") };
    if (caso === "outro-produto") { versao.dados.produtoId = "produto-nao-autorizado"; versao.hash = hashFiscal(versao.dados); }
    if (caso === "vigencia-passada") versao.vigenciaInicio = new Date("2026-10-14T00:00:00Z");
    if (caso === "hash-alterado") versao.hash = "b".repeat(64);
    if (caso === "perfil") versao.tipo = "PERFIL";
    const selecao = [{ id, hash: versao.hash }], t = tx(); t.versaoEstruturaFiscal.findMany = vi.fn(async () => [versao]) as unknown as typeof t.versaoEstruturaFiscal.findMany; s.ultima.mockResolvedValue(versao);
    await expect(aprovarRevisaoConsolidadaNaTransacao(t, selecao, hashRevisaoConsolidadaGrazing1(selecao), sessao)).rejects.toThrow();
    expect(s.criar).not.toHaveBeenCalled(); expect(s.evento).not.toHaveBeenCalled();
  });
  function instrucao(outrasPendencias: string[] = []) {
    const m = massa(); m.base.pendencias = [PENDENCIA_ORIGEM_GRAZING1, ...outrasPendencias];
    m.base.fotografiaTecnica = { algoritmo: "grazing.classificacao-fiscal.v1", principalHash: "b".repeat(64), materiais: materiaisFicticios };
    const base = { ...m.ultima, dados: m.base, hash: hashFiscal(m.base), fontes: ["PROVA-SINTETICA-PRESERVADA"] }; s.ultima.mockImplementation(async ({ where }) => where.tipo === "CLASSIFICACAO" ? base : null);
    return { base, entrada: { baseId: base.id, baseHash: base.hash, referenciaInstrucao: REFERENCIA_INSTRUCAO_GRAZING1 } };
  }
  it("instrução normal clona a base, preserva CI/fontes e resolve somente origem sem aprovar", async () => {
    const m = instrucao(), antes = structuredClone(m.base);
    const resultado = await registrarDeclaracaoGrazing1PelaInstrucao(m.entrada, sessao), data = s.criar.mock.calls[0][0].data;
    expect(resultado).toEqual({ id: data.id, regraId: null, regraProspectivaCriada: false }); expect(data.versao).toBe(4); expect(data.vigenciaInicio.toISOString()).toBe("2026-10-15T00:00:00.000Z"); expect(data).not.toHaveProperty("status");
    expect(data.dados).toMatchObject({ origem: "5", gtin: "SEM GTIN", estado: "CONFIRMADO", pendencias: [], fci: { situacao: "DISPENSADA_POR_DECLARACAO_RESPONSAVEL", periodoApuracao: m.base.dados.fci!.periodoApuracao, conteudoImportacao: null, valorParcelaImportada: m.base.dados.fci!.valorParcelaImportada, valorSaidaReferencia: null, apuracaoCompleta: false } });
    for (const campo of ["analiseNcm", "evidencias", "ncm", "tratamento", "natureza", "unidade", "grupo"] as const) expect(data.dados[campo]).toEqual(m.base.dados[campo]);
    expect(data.fontes).toEqual(["PROVA-SINTETICA-PRESERVADA", REFERENCIA_INSTRUCAO_GRAZING1]); expect(m.base).toEqual(antes);
    expect(data.dados.fci.declaracaoResponsavel.registro.executor.identificacao).toBe("Codex"); expect(s.evento.mock.calls.map(c => c[0].data.tipo)).toEqual(["RASCUNHO"]); expect(s.evento.mock.calls[0][0].data.dados.declaracaoResponsavel).toMatchObject({ hashConteudo: data.hash, aprovacaoDemaisParametros: false });
  });
  it("conserva pendência material não resolvida pela declaração", async () => {
    const m = instrucao(["Outra decisão tributária sintética ainda pendente."]);
    await registrarDeclaracaoGrazing1PelaInstrucao(m.entrada, sessao);
    expect(s.criar.mock.calls[0][0].data.dados).toMatchObject({ estado: "PENDENTE", pendencias: ["Outra decisão tributária sintética ainda pendente."] });
  });
  it.each(["0", "1", "3", "5", "8"])("instrução antiga não substitui a origem%s já definida nem cria rascunho", async origem => {
    const m = instrucao(); m.base.dados.origem = origem;
    m.base.hash = hashFiscal(m.base.dados); m.entrada.baseHash = m.base.hash;
    await expect(registrarDeclaracaoGrazing1PelaInstrucao(m.entrada, sessao)).rejects.toThrow("origem fiscal deste produto já foi definida");
    expect(s.criar).not.toHaveBeenCalled(); expect(s.evento).not.toHaveBeenCalled(); expect(s.loja).not.toHaveBeenCalled();
  });
  it.each(["hash", "instrucao", "sem-fotografia", "sem-admin"])("instrução rejeita requisito incompatível antes de criar: %s", async caso => {
    const m = instrucao();
    if (caso === "hash") m.entrada.baseHash = "f".repeat(64);
    if (caso === "instrucao") m.entrada.referenciaInstrucao = "Referência livre não autorizada";
    if (caso === "sem-fotografia") { delete m.base.dados.fotografiaTecnica; m.base.hash = hashFiscal(m.base.dados); m.entrada.baseHash = m.base.hash; }
    if (caso === "sem-admin") s.usuario.mockResolvedValue({ ativo: true, sessaoVersao: 1, perfilAcesso: { sistema: "OPERADOR" } });
    await expect(registrarDeclaracaoGrazing1PelaInstrucao(m.entrada, sessao)).rejects.toThrow(); expect(s.criar).not.toHaveBeenCalled(); expect(s.evento).not.toHaveBeenCalled();
  });
  it.each(["2026-10-14", "2026-10-15", "2026-10-16"])("regra vigente desde%s só ganha clone quando a vigência já passou", async vigencia => {
    const m = instrucao(), tributo = { cst: "49", aliquota: null, reducaoBase: "0", modalidade: "SEM_DESTAQUE" as const, justificativa: "Tratamento exclusivamente sintético" };
    const dados: RegraFiscal = { estabelecimento: "singleton", regime: "SIMPLES_NACIONAL", operacao: "VENDA", ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL", grupo: "GF01", produtoId: m.base.chave, natureza: "PREPARADO", ncm: "19059090", cfop: "5101", csosn: "102", icms: { ...tributo, cst: "40" }, pis: tributo, cofins: tributo, ipi: null, st: "NAO_APLICAVEL", cest: null, segregacaoReceita: "TRATAMENTO_SINTETICO_SEM_CONCLUSAO_APURACAO", reforma: null, seletivo: "NAO_APLICAVEL" };
    const regra = { id: "regra-base-ficticia", tipo: "REGRA", chave: REGRA_DECLARACAO_FCI_GRAZING1, versao: 1, vigenciaInicio: new Date(`${vigencia}T00:00:00Z`), status: "RASCUNHO", dados, hash: hashFiscal(dados), fontes: ["FONTE-SINTETICA-REGRA"], justificativa: "Justificativa sintética preservada sem nova interpretação" }, antes = structuredClone(regra);
    s.ultima.mockImplementation(async ({ where }) => where.tipo === "CLASSIFICACAO" ? m.base : regra);
    const resultado = await registrarDeclaracaoGrazing1PelaInstrucao(m.entrada, sessao), clonar = vigencia < "2026-10-15";
    expect(resultado).toMatchObject({ regraId: clonar ? "regra-nova-ficticia" : regra.id, regraProspectivaCriada: clonar }); expect(s.criar).toHaveBeenCalledTimes(clonar ? 2 : 1); expect(regra).toEqual(antes);
    if (clonar) {
      const clone = s.criar.mock.calls[1][0].data; expect(clone).toMatchObject({ tipo: "REGRA", versao: 2, dados: regra.dados, hash: regra.hash, fontes: regra.fontes, justificativa: regra.justificativa }); expect(clone.vigenciaInicio.toISOString()).toBe("2026-10-15T00:00:00.000Z"); expect(clone).not.toHaveProperty("status");
      expect(s.evento.mock.calls.map(c => c[0].data.tipo)).toEqual(["RASCUNHO", "RASCUNHO"]); expect(s.evento.mock.calls[1][0].data.dados.propostaProspectiva).toMatchObject({ baseId: regra.id, baseHash: regra.hash, historicoPreservado: true, aprovacaoInterna: false, referenciaInstrucao: REFERENCIA_INSTRUCAO_GRAZING1 });
    }
  });
});
