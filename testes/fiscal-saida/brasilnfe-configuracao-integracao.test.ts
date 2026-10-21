import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import type { SessaoAtual } from "@/lib/session";
const s = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, buscar: vi.fn(), servicos: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return s.prisma; } }));
vi.mock("@/lib/fiscal-saida/brasilnfe/cliente", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/fiscal-saida/brasilnfe/cliente")>();
  return { ...original, ClienteBrasilNfe: class { buscarEmpresa = s.buscar; consultarServicos = s.servicos; } };
});
import { obterConfiguracaoBrasilNfe, salvarConfiguracaoBrasilNfe, validarConexaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/configuracao";
import { ErroHttpBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cliente";
const schema = `teste_brasilnfe_${randomUUID().replaceAll("-", "")}`;
let banco: Client | undefined, criado = false, editor: SessaoAtual, leitor: SessaoAtual;
const token = "token-ficticio-da-suite", userToken = "usertoken-ficticio-da-suite";
const empresa = { cnpj: "11222333000181", inscricaoEstadual: "123456", crt: 1, nfceHomologacao: { cscConfigurado: false, idCscConfigurado: false } };
async function salvo() { return salvarConfiguracaoBrasilNfe({ versao: 0, tokenSubstituicao: token, userTokenSubstituicao: userToken }, editor); }
async function falhaDeServicosSintetica(resposta: unknown) {
  const original = await vi.importActual<typeof import("@/lib/fiscal-saida/brasilnfe/cliente")>("@/lib/fiscal-saida/brasilnfe/cliente");
  const cliente = new original.ClienteBrasilNfe({ token, userToken }, { fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify(resposta), { headers: { "Content-Type": "application/json" } })) });
  try { await cliente.consultarServicos(); } catch (erro) { return erro; }
  throw new Error("A massa sintética deveria falhar.");
}
describe.skipIf(process.env.BRASILNFE_BANCO_TESTE !== "1")("Brasil NFe administrativo em banco local isolado", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "http://invalido");
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || !/^\/teste_/.test(url.pathname)) throw new Error("Somente banco local fictício.");
    vi.stubEnv("AUTH_SECRET", "chave-ficticia-exclusiva-da-suite-brasilnfe-com-32-bytes");
    banco = new Client({ connectionString: url.toString() }); await banco.connect();
    await banco.query(`CREATE SCHEMA "${schema}"`); criado = true; await banco.query(`SET search_path TO "${schema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) await banco.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    s.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${schema}` }, { schema }) });
    const perfil = await s.prisma.perfilAcesso.create({ data: { nome: "Administrador fiscal fictício", permissoes: { "configuracoes.brasilnfe": ["visualizar", "editar"] } } });
    const perfilLeitor = await s.prisma.perfilAcesso.create({ data: { nome: "Leitor fiscal fictício", permissoes: { "configuracoes.brasilnfe": ["visualizar"] } } });
    for (const [id, perfilAcessoId] of [["editor-fiscal-ficticio", perfil.id], ["leitor-fiscal-ficticio", perfilLeitor.id]]) await s.prisma.usuario.create({ data: { id, nome: "Pessoa fictícia", email: `${id}@example.invalid`, senhaHash: "inutil", perfilAcessoId } });
    const base = { nome: "Pessoa fictícia", email: "ficticio@example.invalid", admin: false, versao: 0, permissoes: {}, excecoes: {}, perfilNome: "Fictício" };
    editor = { ...base, userId: "editor-fiscal-ficticio" }; leitor = { ...base, userId: "leitor-fiscal-ficticio" };
    await s.prisma.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
  }, 120000);
  beforeEach(async () => {
    vi.clearAllMocks();
    await s.prisma.eventoConfiguracaoBrasilNfe.deleteMany(); await s.prisma.configuracaoBrasilNfe.deleteMany();
    await s.prisma.usuario.update({ where: { id: editor.userId }, data: { ativo: true, sessaoVersao: 0 } });
    await s.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { nome: "EMPRESA FICTÍCIA", cnpj: empresa.cnpj, enderecoEstruturado: { cep: "01001000", logradouro: "Rua fictícia", numero: "100", bairro: "Teste", cidade: "São Paulo", uf: "SP" } } });
    s.buscar.mockResolvedValue(empresa); s.servicos.mockResolvedValue({ servicos: [{ nome: "NF-e/NFC-e", ativo: true }], avisosPresentes: false });
  });
  afterAll(async () => { await s.prisma?.$disconnect(); if (banco) { if (criado && /^teste_brasilnfe_[a-f0-9]{32}$/.test(schema)) await banco.query(`DROP SCHEMA "${schema}" CASCADE`); await banco.end(); } vi.unstubAllEnvs(); });
  it("guarda credenciais cifradas sem devolvê-las ou transmiti-las; auditoria só estados", async () => {
    const dados = await salvo();
    expect(dados).toMatchObject({ versao: 1, ambiente: "HOMOLOGACAO", emissaoHabilitada: false, producaoBloqueada: true, tokenConfigurado: true, userTokenConfigurado: true });
    const db = await s.prisma.configuracaoBrasilNfe.findUniqueOrThrow({ where: { id: "singleton" } });
    expect(db.tokenCifrado).not.toContain(token); expect(db.userTokenCifrado).not.toContain(userToken);
    const lido = await obterConfiguracaoBrasilNfe(leitor), eventos = await s.prisma.eventoConfiguracaoBrasilNfe.findMany();
    for (const secreto of [token, userToken, db.tokenCifrado!, db.userTokenCifrado!]) expect(JSON.stringify([dados, lido, eventos])).not.toContain(secreto);
    expect(s.buscar).not.toHaveBeenCalled(); expect(s.servicos).not.toHaveBeenCalled();
    expect(await s.prisma.documentoFiscalSaida.count()).toBe(0); expect(await s.prisma.eventoFiscalSaida.count()).toBe(0);
  });
  it("permissão de leitura, sessão revogada e usuário inativo não escrevem/consultam fornecedor", async () => {
    await expect(salvarConfiguracaoBrasilNfe({ versao: 0, tokenSubstituicao: token }, leitor)).rejects.toThrow("acesso");
    await salvo(); await expect(validarConexaoBrasilNfe({ versao: 1 }, leitor)).rejects.toThrow("acesso");
    await s.prisma.usuario.update({ where: { id: editor.userId }, data: { sessaoVersao: 1 } });
    await expect(obterConfiguracaoBrasilNfe(editor)).rejects.toThrow("acesso");
    await s.prisma.usuario.update({ where: { id: editor.userId }, data: { ativo: false, sessaoVersao: 0 } });
    await expect(validarConexaoBrasilNfe({ versao: 1 }, editor)).rejects.toThrow("acesso"); expect(s.buscar).not.toHaveBeenCalled();
  });
  it("sem UserToken indica exatamente consultas indisponíveis sem alegar autenticação", async () => {
    await salvarConfiguracaoBrasilNfe({ versao: 0, tokenSubstituicao: token }, editor);
    const d = await validarConexaoBrasilNfe({ versao: 1 }, editor);
    expect(d.validacaoExterna).toMatchObject({ situacao: "PARCIAL", acessoAutenticado: false, preRequisitosConferidos: false, consultasIndisponiveis: ["BuscarEmpresa", "ConsultarServicos"] });
    expect(s.buscar).not.toHaveBeenCalled(); expect(s.servicos).not.toHaveBeenCalled();
  });
  it("CNPJ divergente impede consulta de serviços e nunca homologa", async () => {
    await salvo(); s.buscar.mockResolvedValue({ ...empresa, cnpj: "99888777000166" });
    const d = await validarConexaoBrasilNfe({ versao: 1 }, editor);
    expect(d.validacaoExterna.situacao).toBe("FALHOU"); expect(d.validacaoExterna.pendencias.join(" ")).toContain("diverge");
    expect(d.validacaoExterna.emitenteCorrespondente).toBe(false);
    expect(s.servicos).not.toHaveBeenCalled(); expect(d.homologacaoFiscal).toBe("PENDENTE"); expect(d.emissaoHabilitada).toBe(false);
  });
  it.each(["CREDENCIAL_INVALIDA", "TIMEOUT", "RESPOSTA_INVALIDA"] as const)("%s fica incompleto e não expõe erros externos", async codigo => {
    await salvo(); s.buscar.mockRejectedValue(new ErroHttpBrasilNfe(codigo));
    const d = await validarConexaoBrasilNfe({ versao: 1 }, editor);
    expect(d.validacaoExterna).toMatchObject({ situacao: "FALHOU", acessoAutenticado: false, preRequisitosConferidos: false });
    expect(d.validacaoExterna.consultasIndisponiveis).toEqual(["BuscarEmpresa", "ConsultarServicos"]);
  });
  it("resposta inválida identifica somente etapa fixa, sem valor externo ou consulta subsequente", async () => {
    await salvo(); s.buscar.mockRejectedValue(new ErroHttpBrasilNfe("RESPOSTA_INVALIDA", "EMPRESA_CRT"));
    const d = await validarConexaoBrasilNfe({ versao: 1 }, editor);
    expect(d.validacaoExterna).toMatchObject({ situacao: "FALHOU", acessoAutenticado: false, preRequisitosConferidos: false });
    expect(d.validacaoExterna.pendencias).toContain("BuscarEmpresa: contrato inválido em CRT da empresa; nenhum valor da resposta foi armazenado.");
    expect(s.servicos).not.toHaveBeenCalled();
    const lido = await obterConfiguracaoBrasilNfe(leitor), registro = await s.prisma.configuracaoBrasilNfe.findUniqueOrThrow({ where: { id: "singleton" } }), eventos = await s.prisma.eventoConfiguracaoBrasilNfe.findMany();
    expect(lido.validacaoExterna).toEqual(d.validacaoExterna);
    for (const segredo of [token, userToken, registro.tokenCifrado!, registro.userTokenCifrado!]) expect(JSON.stringify([d, lido, registro.diagnostico, eventos])).not.toContain(segredo);
    expect(d).toMatchObject({ producaoBloqueada: true, emissaoHabilitada: false, homologacaoFiscal: "PENDENTE" });
  });
  it("200 e emitente conferido não significam pré-requisitos completos nem homologação", async () => {
    await salvo(); const d = await validarConexaoBrasilNfe({ versao: 1 }, editor);
    expect(d.validacaoExterna).toMatchObject({ situacao: "PARCIAL", acessoAutenticado: true, preRequisitosConferidos: false });
    expect(d.validacaoExterna.pendencias.join(" ")).toContain("certificado"); expect(d.homologacaoFiscal).toBe("PENDENTE");
    expect(d.emissaoHabilitada).toBe(false); expect(d.producaoBloqueada).toBe(true);
    expect(d.validacaoExterna).toMatchObject({ emitenteCorrespondente: true, empresaVerificadaEm: expect.any(String), servicosEmissao: { nfe: "ATIVO", nfce: "ATIVO", verificadosEm: expect.any(String) } });
    expect(d.validacaoExterna.consultas.map(c => c.situacao)).toEqual(["CONCLUIDA", "CONCLUIDA"]);
  });
  it.each([401, 403, 404, 429, 500, 502, 503])("empresa confirmada é preservada quando ConsultarServicos retorna HTTP %s", async httpStatus => {
    await salvo();
    s.servicos.mockRejectedValue(new ErroHttpBrasilNfe(httpStatus === 401 ? "CREDENCIAL_INVALIDA" : "EXTERNO", undefined, { categoria: "HTTP", httpStatus }));
    const d = await validarConexaoBrasilNfe({ versao: 1 }, editor);
    expect(d.validacaoExterna).toMatchObject({ situacao: "CONECTADO_SERVICOS_PENDENTES", acessoAutenticado: true, emitenteCorrespondente: true, empresaVerificadaEm: expect.any(String), servicosEmissao: { nfe: "NAO_CONFIRMADO", nfce: "NAO_CONFIRMADO", verificadosEm: null }, consultasIndisponiveis: ["ConsultarServicos"] });
    expect(d.validacaoExterna.consultas).toMatchObject([{ consulta: "BuscarEmpresa", situacao: "CONCLUIDA", falha: null }, { consulta: "ConsultarServicos", situacao: "FALHOU", verificadaEm: expect.any(String), falha: { categoria: "HTTP", httpStatus } }]);
    expect(d.validacaoExterna.pendencias.join(" ")).not.toContain("explicitamente inativo");
    if (httpStatus === 403) expect(d.validacaoExterna.pendencias.join(" ")).toContain("isso não comprova token incorreto");
    expect((await obterConfiguracaoBrasilNfe(leitor)).validacaoExterna).toEqual(d.validacaoExterna);
    const evento = await s.prisma.eventoConfiguracaoBrasilNfe.findFirstOrThrow({ where: { tipo: "DIAGNOSTICO" } });
    expect(evento.dados).toMatchObject({ acessoAutenticado: true, emitenteCorrespondente: true, consultas: [{ consulta: "BuscarEmpresa" }, { falha: { httpStatus } }] });
    expect(d).toMatchObject({ emissaoHabilitada: false, producaoBloqueada: true, homologacaoFiscal: "PENDENTE" });
  });
  it.each(["TIMEOUT", "TRANSPORTE", "NAO_JSON", "JSON_INVALIDO", "CONTRATO", "NEGOCIO"] as const)("falha %s nos serviços tem metadados locais e conserva somente a empresa confirmada", async categoria => {
    await salvo();
    s.servicos.mockRejectedValue(new ErroHttpBrasilNfe(categoria === "TIMEOUT" ? "TIMEOUT" : "EXTERNO", undefined, { categoria, httpStatus: ["TIMEOUT", "TRANSPORTE"].includes(categoria) ? null : 200 }));
    const d = await validarConexaoBrasilNfe({ versao: 1 }, editor);
    expect(d.validacaoExterna.situacao).toBe("CONECTADO_SERVICOS_PENDENTES");
    expect(d.validacaoExterna.consultas[1].falha?.categoria).toBe(categoria);
    expect(d.validacaoExterna.acessoAutenticado).toBe(true);
    expect(d.validacaoExterna.servicosEmissao.nfe).toBe("NAO_CONFIRMADO");
  });
  it("exceção inesperada não conserva message, cause ou credenciais", async () => {
    await salvo(); s.servicos.mockRejectedValue(new Error(`resposta-externa-${token}`, { cause: { headers: { UserToken: userToken } } }));
    const d = await validarConexaoBrasilNfe({ versao: 1 }, editor);
    const registro = await s.prisma.configuracaoBrasilNfe.findUniqueOrThrow({ where: { id: "singleton" } });
    const eventos = await s.prisma.eventoConfiguracaoBrasilNfe.findMany();
    for (const proibido of [token, userToken, "resposta-externa", "headers", "cause"]) expect(JSON.stringify([d, registro.diagnostico, eventos])).not.toContain(proibido);
    expect(d.validacaoExterna.consultas[1].falha?.categoria).toBe("CONFIGURACAO");
  });
  it("detalhes saneados chegam só na validação autorizada, nunca na leitura, banco ou auditoria", async () => {
    await salvo();
    const descricao = "Permissão de consulta não concedida.", correcao = "Conferir vínculo no cadastro.", codigo = "E42";
    s.servicos.mockRejectedValue(await falhaDeServicosSintetica({ status: 7, erros: [{ codigo, descricao, correcao }] }));
    const d = await validarConexaoBrasilNfe({ versao: 1 }, editor);
    expect(d.detalhesDiagnostico).toMatchObject({ versao: 2, verificadaEm: expect.any(String), expiraEm: expect.any(String), erros: [{ codigo: { estado: "EXIBIDO", valor: codigo }, descricao: { estado: "EXIBIDO", valor: descricao }, correcao: { estado: "EXIBIDO", valor: correcao } }] });
    expect(Date.parse(d.detalhesDiagnostico!.expiraEm) - Date.now()).toBeLessThanOrEqual(300000);
    expect(d.validacaoExterna.consultas[1].falha).toMatchObject({ categoria: "NEGOCIO", statusFornecedor: 7, tipoStatusFornecedor: "NUMERO", indicadores: expect.arrayContaining(["ERROS_PREENCHIDOS", "STATUS_NUMERICO_NAO_ZERO"]) });
    const leituras = await Promise.all([obterConfiguracaoBrasilNfe(editor), obterConfiguracaoBrasilNfe(leitor)]);
    const registro = await s.prisma.configuracaoBrasilNfe.findUniqueOrThrow({ where: { id: "singleton" } });
    const auditoria = await s.prisma.eventoConfiguracaoBrasilNfe.findMany();
    for (const leitura of leituras) expect(leitura).not.toHaveProperty("detalhesDiagnostico");
    for (const proibido of [descricao, correcao, codigo, token, userToken]) expect(JSON.stringify([leituras, registro.diagnostico, auditoria])).not.toContain(proibido);
    expect(d).toMatchObject({ emissaoHabilitada: false, producaoBloqueada: true });
  });
  it("Token refletido no código e UserToken na descrição ficam suprimidos, com ausência distinta", async () => {
    await salvo(); s.servicos.mockRejectedValue(await falhaDeServicosSintetica({ status: false, erros: [{ codigo: token, descricao: userToken }] }));
    const d = await validarConexaoBrasilNfe({ versao: 1 }, editor);
    expect(d.detalhesDiagnostico?.erros[0]).toMatchObject({ codigo: { estado: "SUPRIMIDO", valor: null }, descricao: { estado: "SUPRIMIDO", valor: null }, correcao: { estado: "AUSENTE", valor: null } });
    expect(d.validacaoExterna.consultas[1].falha).toMatchObject({ statusFornecedor: false, tipoStatusFornecedor: "BOOLEANO", indicadores: expect.arrayContaining(["STATUS_FALSE"]), camposSuprimidos: expect.arrayContaining(["ERROS_CODIGO", "ERROS_DESCRICAO"]), camposAusentes: expect.arrayContaining(["ERROS_CORRECAO"]) });
    const registro = await s.prisma.configuracaoBrasilNfe.findUniqueOrThrow({ where: { id: "singleton" } });
    const auditoria = await s.prisma.eventoConfiguracaoBrasilNfe.findMany();
    for (const segredo of [token, userToken]) expect(JSON.stringify([d, registro.diagnostico, auditoria])).not.toContain(segredo);
  });
  it("revogação durante a consulta impede devolver detalhes transitórios ou gravar diagnóstico", async () => {
    await salvo(); const erro = await falhaDeServicosSintetica({ status: 1, erros: [{ codigo: "E42", descricao: "Permissão de consulta não concedida." }] });
    s.servicos.mockImplementation(async () => { await s.prisma.usuario.update({ where: { id: editor.userId }, data: { sessaoVersao: 1 } }); throw erro; });
    await expect(validarConexaoBrasilNfe({ versao: 1 }, editor)).rejects.toThrow("acesso");
    expect(await s.prisma.eventoConfiguracaoBrasilNfe.count({ where: { tipo: "DIAGNOSTICO" } })).toBe(0);
    expect((await s.prisma.configuracaoBrasilNfe.findUniqueOrThrow({ where: { id: "singleton" } })).diagnostico).toBeNull();
  });
  it("alteração de credencial durante os serviços descarta também os detalhes transitórios", async () => {
    await salvo(); const erro = await falhaDeServicosSintetica({ status: 1, erros: [{ codigo: "E42", descricao: "Permissão de consulta não concedida." }] });
    s.servicos.mockImplementation(async () => { await salvarConfiguracaoBrasilNfe({ versao: 1, userTokenSubstituicao: "outro-user-token-ficticio" }, editor); throw erro; });
    await expect(validarConexaoBrasilNfe({ versao: 1 }, editor)).rejects.toThrow("mudou");
    expect(await s.prisma.eventoConfiguracaoBrasilNfe.count({ where: { tipo: "DIAGNOSTICO" } })).toBe(0);
    expect(await obterConfiguracaoBrasilNfe(editor)).not.toHaveProperty("detalhesDiagnostico");
  });
  it.each([true, false])("catálogo combinado ativo=%s é separado dos pré-requisitos fiscais e ignora serviços alheios", async ativo => {
    await salvo(); s.servicos.mockResolvedValue({ servicos: [{ nome: "NF-e/NFC-e", ativo }, { nome: "Sincronizar Docs", ativo: false }, { nome: "CT-e", ativo: false }], avisosPresentes: false });
    const d = await validarConexaoBrasilNfe({ versao: 1 }, editor), estado = ativo ? "ATIVO" : "INATIVO";
    expect(d.validacaoExterna.servicosEmissao).toMatchObject({ nfe: estado, nfce: estado, verificadosEm: expect.any(String) });
    expect(d.validacaoExterna.pendencias.join(" ")).not.toMatch(/Sincronizar Docs|CT-e/);
    expect(d.validacaoExterna.preRequisitosConferidos).toBe(false);
    expect(d.emissaoHabilitada).toBe(false);
  });
  it("tentativa posterior com falha não reutiliza serviços ativos da tentativa anterior", async () => {
    await salvo(); const primeiro = await validarConexaoBrasilNfe({ versao: 1 }, editor);
    expect(primeiro.validacaoExterna.servicosEmissao.nfe).toBe("ATIVO");
    await s.prisma.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { diagnosticoIniciadoEm: new Date(0) } });
    s.servicos.mockRejectedValue(new ErroHttpBrasilNfe("TIMEOUT"));
    const atual = await validarConexaoBrasilNfe({ versao: 2 }, editor);
    expect(atual.validacaoExterna).toMatchObject({ acessoAutenticado: true, emitenteCorrespondente: true, situacao: "CONECTADO_SERVICOS_PENDENTES", servicosEmissao: { nfe: "NAO_CONFIRMADO", nfce: "NAO_CONFIRMADO", verificadosEm: null } });
    expect(atual.validacaoExterna.empresaVerificadaEm).not.toBe(primeiro.validacaoExterna.empresaVerificadaEm);
  });
  it("leitura do diagnóstico legado mantém somente autenticação datada, sem inventar correspondência ou serviço", async () => {
    await salvo(); const atual = await validarConexaoBrasilNfe({ versao: 1 }, editor);
    const legado = { situacao: "FALHOU", verificadaEm: atual.validacaoExterna.verificadaEm, acessoAutenticado: true, preRequisitosConferidos: false, pendencias: ["Consulta externa indisponível; validação incompleta."], consultasIndisponiveis: ["ConsultarServicos"] };
    await s.prisma.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { diagnostico: legado } });
    expect((await obterConfiguracaoBrasilNfe(leitor)).validacaoExterna).toMatchObject({ acessoAutenticado: true, empresaVerificadaEm: legado.verificadaEm, emitenteCorrespondente: null, servicosEmissao: { nfe: "NAO_CONFIRMADO", nfce: "NAO_CONFIRMADO" } });
  });
  it("substituir segredo invalida diagnóstico, preserva outro segredo e rejeita concorrência", async () => {
    await salvo(); await validarConexaoBrasilNfe({ versao: 1 }, editor);
    const anterior = await s.prisma.configuracaoBrasilNfe.findUniqueOrThrow({ where: { id: "singleton" } });
    const resultados = await Promise.allSettled([salvarConfiguracaoBrasilNfe({ versao: 2, tokenSubstituicao: "novo-token-ficticio" }, editor), salvarConfiguracaoBrasilNfe({ versao: 2, tokenSubstituicao: "outro-token-ficticio" }, editor)]);
    expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1); expect(resultados.filter(r => r.status === "rejected")).toHaveLength(1);
    const d = await obterConfiguracaoBrasilNfe(editor), atual = await s.prisma.configuracaoBrasilNfe.findUniqueOrThrow({ where: { id: "singleton" } });
    expect(d.validacaoExterna.situacao).toBe("NAO_REALIZADA"); expect(atual.userTokenCifrado).toBe(anterior.userTokenCifrado);
    expect(d.validacaoExterna).toMatchObject({ acessoAutenticado: false, emitenteCorrespondente: null, empresaVerificadaEm: null, servicosEmissao: { nfe: "NAO_CONFIRMADO", nfce: "NAO_CONFIRMADO", verificadosEm: null } });
  });
  it("confere liberação por modelo em serviços separados, sem inferir um a partir do outro", async () => {
    await salvo(); s.servicos.mockResolvedValue({ servicos: [{ nome: "NF-e", ativo: true }, { nome: "NFC-e", ativo: false }], avisosPresentes: false });
    const d = await validarConexaoBrasilNfe({ versao: 1 }, editor);
    expect(d.validacaoExterna.pendencias.some(p => p.includes("serviço NF-e (55)"))).toBe(false);
    expect(d.validacaoExterna.pendencias.some(p => p.includes("serviço NFC-e (65)"))).toBe(true);
  });
  it("trocar somente UserToken também invalida todas as evidências sem consultar API", async () => {
    await salvo(); await validarConexaoBrasilNfe({ versao: 1 }, editor); vi.clearAllMocks();
    const d = await salvarConfiguracaoBrasilNfe({ versao: 2, userTokenSubstituicao: "novo-usertoken-ficticio" }, editor);
    expect(d.validacaoExterna).toMatchObject({ situacao: "NAO_REALIZADA", acessoAutenticado: false, emitenteCorrespondente: null, empresaVerificadaEm: null, servicosEmissao: { nfe: "NAO_CONFIRMADO", nfce: "NAO_CONFIRMADO", verificadosEm: null } });
    expect(d.validacaoExterna.consultas.every(c => c.situacao === "NAO_REALIZADA")).toBe(true);
    expect(s.buscar).not.toHaveBeenCalled(); expect(s.servicos).not.toHaveBeenCalled();
  });
  it("leitura de metadados persistidos descarta valores sem lista permitida e propriedades extras", async () => {
    await salvo(); const d = await validarConexaoBrasilNfe({ versao: 1 }, editor);
    const invalido = { ...d.validacaoExterna, consultas: [{ consulta: "ConsultarServicos", situacao: "FALHOU", verificadaEm: d.validacaoExterna.verificadaEm, falha: { categoria: "HTTP", httpStatus: 403, etapaContrato: token, statusFornecedor: userToken, codigoFornecedor: token, headers: { Token: token }, cause: token } }] };
    await s.prisma.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { diagnostico: invalido } });
    const lido = await obterConfiguracaoBrasilNfe(leitor);
    expect(lido.validacaoExterna.consultas[1].falha).toEqual({ categoria: "HTTP", httpStatus: 403, etapaContrato: null, statusFornecedor: null, codigoFornecedor: null });
    for (const proibido of [token, userToken, "headers", "cause"]) expect(JSON.stringify(lido)).not.toContain(proibido);
  });
  it("mudança de emitente ou credencial durante HTTP descarta diagnóstico antigo", async () => {
    await salvo(); s.buscar.mockImplementation(async () => { await salvarConfiguracaoBrasilNfe({ versao: 1, tokenSubstituicao: "token-alterado-ficticio" }, editor); return empresa; });
    await expect(validarConexaoBrasilNfe({ versao: 1 }, editor)).rejects.toThrow("mudou");
    expect((await obterConfiguracaoBrasilNfe(editor)).validacaoExterna.situacao).toBe("NAO_REALIZADA");
  });
  it("diagnóstico desatualiza quando cadastro empresa muda e limita repetição", async () => {
    await salvo(); const d = await validarConexaoBrasilNfe({ versao: 1 }, editor);
    await expect(validarConexaoBrasilNfe({ versao: d.versao }, editor)).rejects.toThrow("30 segundos");
    await s.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { cnpj: "99888777000166" } });
    expect((await obterConfiguracaoBrasilNfe(editor)).validacaoExterna).toMatchObject({ situacao: "NAO_REALIZADA", acessoAutenticado: false, emitenteCorrespondente: null, empresaVerificadaEm: null, servicosEmissao: { nfe: "NAO_CONFIRMADO", nfce: "NAO_CONFIRMADO", verificadosEm: null } });
  });
  it("produção é rejeitada no SQL, sem efeitos em estoque, financeiro, recebidas ou fila", async () => {
    await salvo(); await validarConexaoBrasilNfe({ versao: 1 }, editor);
    await expect(s.prisma.$executeRaw`UPDATE "ConfiguracaoBrasilNfe" SET ambiente='PRODUCAO' WHERE id='singleton'`).rejects.toThrow();
    const quantidades = await Promise.all([s.prisma.documentoFiscalSaida.count(), s.prisma.eventoFiscalSaida.count(), s.prisma.lancamentoFinanceiro.count(), s.prisma.movimentacaoEstoque.count(), s.prisma.notaFiscalRecebida.count(), s.prisma.notaFiscalServico.count(), s.prisma.sefazDocumentoRecebido.count(), s.prisma.movimentacaoBancaria.count(), s.prisma.historicoFinanceiroPedido.count()]);
    expect(quantidades).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });
});
