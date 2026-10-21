import { beforeEach, describe, expect, it, vi } from "vitest";
const s = vi.hoisted(() => ({ loja: vi.fn(), regras: vi.fn(), estrutura: vi.fn(), perfil: vi.fn(), guarda: vi.fn(), pode: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { configuracaoLoja: { findUnique: s.loja }, regraFiscalBrasilNfe: { findMany: s.regras }, $queryRaw: s.estrutura, versaoEstruturaFiscal: { findFirst: s.perfil } } }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: s.guarda, podeAcessar: s.pode }));
import { obterRegimeFiscalEmpresaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regime-empresa";
import { hashRegraFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regras-tributarias-dominio";
import { hashFiscal } from "@/lib/tributacao/servico";
import { validarDadosFiscais } from "@/lib/tributacao/validacao";
import { rascunhoRegraSintetica } from "./brasilnfe-regras-tributarias-fixtures";
const loja = { nome: "Empresa exclusivamente fictícia", cnpj: "00000000000000", enderecoEstruturado: { uf: "SP" } };
function regra(modelo: 55 | 65, crt: 1 | 2 | 3 | 4 = 1) {
  const d = rascunhoRegraSintetica("EMPRESA", modelo);
  if (d.conteudo.tipo !== "EMPRESA") throw new Error();
  d.conteudo.emitente.crt = crt;
  const r = { id: `regra-empresa-ficticia-${modelo}`, lojaId: "singleton", modelo, operacao: d.operacao, alvo: d.alvo, revisao: 2 };
  const v = { id: `versao-ficticia-${modelo}`, regraId: r.id, revisao: 2, estado: "APROVADA", vigenteDesde: d.vigenteDesde, vigenteAte: d.vigenteAte, responsavelId: "usuario-ficticio", autorNome: "Responsável fictício", emitenteHash: hashRegraFiscalBrasilNfe(loja), versaoCadastro: null, fiscalCadastroHash: null, conteudo: d.conteudo, conteudoHash: hashRegraFiscalBrasilNfe(d.conteudo), fundamentacaoFiscal: d.fundamentacaoFiscal, fundamentacaoHash: hashRegraFiscalBrasilNfe(d.fundamentacaoFiscal), aprovacaoInterna: {}, aprovacaoHash: "" };
  v.aprovacaoInterna = { tipo: "APROVACAO_INTERNA", regraId: r.id, revisaoOrigem: 1, modelo, operacao: r.operacao, alvo: r.alvo, conteudoHash: v.conteudoHash, fundamentacaoHash: v.fundamentacaoHash, emitenteHash: v.emitenteHash, fiscalCadastroHash: null, versaoCadastro: null, vigenteDesde: v.vigenteDesde, vigenteAte: v.vigenteAte, aprovador: { id: v.responsavelId, nome: v.autorNome }, aprovadoEm: "2026-10-12T15:00:00.000Z" };
  v.aprovacaoHash = hashRegraFiscalBrasilNfe(v.aprovacaoInterna);
  return { ...r, versoes: [v] };
}
beforeEach(() => { vi.resetAllMocks(); s.estrutura.mockResolvedValue([{ existe: false }]); s.pode.mockResolvedValue(true); s.guarda.mockResolvedValue({}); s.loja.mockResolvedValue(loja); s.regras.mockResolvedValue([regra(55), regra(65)]); });
describe("Regime central, dados exclusivamente sintéticos", () => {
  function perfil(crt: number | undefined = 1) {
    const dados = { estabelecimento: "singleton", cnpj: loja.cnpj, uf: "SP", codigoMunicipio: "3550308", inscricaoEstadual: "123456789012", regime: "SIMPLES_NACIONAL", confirmado: true, evidenciaEnquadramento: "Prova cadastral exclusivamente sintética", modelos: ["55", "65"], emissor: "TAKEAT", reforma: "DISPENSADO_SIMPLES_2026", beneficioOpcional: null, ...(crt === undefined ? {} : { crt }) };
    const hash = hashFiscal(dados);
    return { id: "perfil-ficticio", dados, hash, versao: 2, vigenciaInicio: new Date("2026-10-14"), fontes: ["https://fonte.example.invalid/prova"], eventos: [{ dados: { hashConteudo: hash }, createdAt: new Date("2026-10-14T15:00:00Z") }] };
  }
  it("usa PERFIL vigente e comprovado como autoridade única, sem ler EMPRESA legado", async () => {
    s.estrutura.mockResolvedValue([{ existe: true }]); s.perfil.mockResolvedValue(perfil());
    expect(await obterRegimeFiscalEmpresaBrasilNfe("2026-10-14")).toMatchObject({ regime: "Simples Nacional", crt: 1, modelos: { 55: "perfil-ficticio", 65: "perfil-ficticio" } });
    expect(s.regras).not.toHaveBeenCalled();
  });
  it("perfil sem CRT conserva o regime comprovado, mas não infere o código", async () => {
    const p = perfil(); delete (p.dados as { crt?: number }).crt; p.hash = hashFiscal(p.dados); p.eventos[0].dados.hashConteudo = p.hash;
    s.estrutura.mockResolvedValue([{ existe: true }]); s.perfil.mockResolvedValue(p);
    expect(await obterRegimeFiscalEmpresaBrasilNfe("2026-10-14")).toMatchObject({ regime: "Simples Nacional", crt: null });
    expect(s.regras).not.toHaveBeenCalled();
  });
  it("perfil sem evento de aprovação ou com CNPJ divergente não usa confirmação legado", async () => {
    s.estrutura.mockResolvedValue([{ existe: true }]); const p = perfil(); p.eventos[0].dados.hashConteudo = "adulterado"; s.perfil.mockResolvedValue(p);
    expect((await obterRegimeFiscalEmpresaBrasilNfe("2026-10-14")).crt).toBeNull();
    p.eventos[0].dados.hashConteudo = p.hash; s.loja.mockResolvedValue({ ...loja, cnpj: "11111111111111" });
    expect((await obterRegimeFiscalEmpresaBrasilNfe("2026-10-14")).crt).toBeNull(); expect(s.regras).not.toHaveBeenCalled();
  });
  it("valida o CRT explicitamente e preserva o hash de versões anteriores sem o campo", () => {
    const p = perfil(); expect(validarDadosFiscais("PERFIL", p.dados)).toMatchObject({ crt: 1 });
    expect(() => validarDadosFiscais("PERFIL", { ...p.dados, crt: "1" })).toThrow();
    expect(() => validarDadosFiscais("PERFIL", { ...p.dados, crt: 3 })).toThrow();
    const antigo = { ...p.dados }; delete (antigo as { crt?: number }).crt;
    expect(hashFiscal(validarDadosFiscais("PERFIL", antigo))).toBe(hashFiscal(antigo));
  });
  it("projeta somente regime/CRT/IE aprovados, coerentes e vinculados à mesma empresa", async () => {
    const r = await obterRegimeFiscalEmpresaBrasilNfe("2026-10-14");
    expect(r).toMatchObject({ regime: "Simples Nacional", crt: 1, descricaoCrt: "Simples Nacional", modelos: { 55: "versao-ficticia-55", 65: "versao-ficticia-65" }, pendencias: [] });
    expect(r.verificacoes).toHaveLength(2); expect(JSON.stringify(r)).not.toMatch(/senha|Token|aprovador/);
  });
  it("nega a leitura antes de consultar cadastros", async () => { s.guarda.mockRejectedValue(new Error("Sem acesso")); await expect(obterRegimeFiscalEmpresaBrasilNfe("2026-10-14")).rejects.toThrow("Sem acesso"); expect(s.loja).not.toHaveBeenCalled(); });
  it("não infere CRT por ausência de versão ou rótulo da empresa", async () => { s.regras.mockResolvedValue([]); expect((await obterRegimeFiscalEmpresaBrasilNfe("2026-10-14")).crt).toBeNull(); });
  it("divergência entre modelos não define um regime arbitrário", async () => { s.regras.mockResolvedValue([regra(55), regra(65, 2)]); expect((await obterRegimeFiscalEmpresaBrasilNfe("2026-10-14")).pendencias[0]).toContain("divergentes"); });
  it("cadastro alterado invalida provas anteriores", async () => { s.loja.mockResolvedValue({ ...loja, nome: "Cadastro alterado" }); expect((await obterRegimeFiscalEmpresaBrasilNfe("2026-10-14")).crt).toBeNull(); });
  it("aprovação adulterada ou vigência expirada não viram confirmação", async () => { const r = regra(55); r.versoes[0].aprovacaoHash = "f".repeat(64); s.regras.mockResolvedValue([r]); expect((await obterRegimeFiscalEmpresaBrasilNfe("2026-10-14")).crt).toBeNull(); s.regras.mockResolvedValue([regra(55)]); expect((await obterRegimeFiscalEmpresaBrasilNfe("2027-01-01")).crt).toBeNull(); });
});
