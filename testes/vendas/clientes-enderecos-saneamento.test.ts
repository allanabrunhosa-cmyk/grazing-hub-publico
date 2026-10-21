import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
const sim = vi.hoisted(() => ({ atividade: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/atividades/registro", () => ({ registrarAtividade: sim.atividade }));
import { hashReconciliacao } from "@/lib/vendas/clientes-cobrancas-reconciliacao";
import { aplicarSaneamento, planejarSaneamento, prepararReversaoSaneamento, prepararSaneamento, reverterSaneamento, validarConfiguracaoSaneamento, type ConfiguracaoSaneamento, type ConsultaSaneamento, type PerfilSaneamento } from "@/lib/vendas/clientes-enderecos-saneamento";
import { argumentosSaneamento, validarEnvelopePreviaSaneamento } from "../../scripts/clientes-enderecos-sanear";
import type { EnderecoVenda, EntregaCliente } from "@/lib/vendas/dominio";

const CNPJ_A = "11222333000181", CNPJ_B = "11444777000161";
type R = Record<string, unknown>;
const copiar = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
function cobranca(documento = CNPJ_A, numero = "1"): EnderecoVenda { return { nome: "Principal", tipo: "PJ", documento, razaoSocial: "Empresa sintética", nomeCompleto: "", inscricaoEstadual: "ISENTO", inscricaoMunicipal: "", destinatario: "Pessoa sintética", pais: "Brasil", cep: "01001000", logradouro: "Rua Sintética", numero, complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" }; }
function entrega(numero = "1", nome = "Pessoa sintética"): EntregaCliente { return { destinatario: { nome, contato: "" }, endereco: cobranca(CNPJ_A, numero) }; }
function perfil(): PerfilSaneamento { return { id: "cliente-sintetico", versao: 4, unificadoEmId: null, nome: "Fantasia sintética", tipo: "PJ", documento: CNPJ_A, razaoSocial: "Empresa sintética", inscricaoEstadual: "ISENTO", ativo: true, enderecos: [cobranca()], entregaPadrao: null, telefone: "+5511900001111", observacoes: "Não alterar observações", createdAt: "2026-10-20T10:00:00.000Z", updatedAt: "2026-10-20T10:00:00.000Z" }; }
function config(p = perfil()): ConfiguracaoSaneamento { return { versao: 1, modo: "SANEAR_ENDERECOS", operacaoId: "sanear-sintetico-01", revisaoCodigo: "a".repeat(40), atorSistema: "manutencao-sintetica", alvo: { id: p.id, versao: p.versao, estadoSha256: hashReconciliacao(p) }, politicaIncompletos: "REMOVER", copiarCobrancasParaEntrega: true }; }
function resultado(numero = "1") { return { cadastro: { razaoSocial: "Razão oficial sintética", endereco: { pais: "Brasil", cep: "01001000", logradouro: "Rua Sintética", numero, complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" } } }; }
function consulta(cnpj = CNPJ_A, resposta: ConsultaSaneamento["resultado"] = resultado()): ConsultaSaneamento { const fonte = resposta.fonte ?? "BRASILAPI_CNPJ_V1"; return { cnpj, fonte, consultadoEm: "2026-10-20T11:00:00.000Z", resultado: resposta, resultadoSha256: hashReconciliacao({ fonte, resultado: resposta }) }; }
const evidencia = { aprovacaoSha256: "b".repeat(64), backupSha256: "c".repeat(64), artefatoSha256: "d".repeat(64) };

describe("plano de saneamento dos livros atuais", () => {
  it("deduplica cobrança por postal mesmo entre CNPJs e prefere a Principal", () => {
    const p = perfil(); p.enderecos.push(cobranca(CNPJ_B));
    const plano = planejarSaneamento(config(p), p, [consulta(), consulta(CNPJ_B)]);
    expect(plano).toMatchObject({ aplicavel: true, contagens: { cobrancasAntes: 2, cobrancasDepois: 1, cobrancasUnificadas: 1 } });
    expect(plano.campos.enderecos).toEqual([expect.objectContaining({ nome: "Principal", documento: CNPJ_A, razaoSocial: "Razão oficial sintética" })]);
    expect(plano.antes.enderecos).toHaveLength(2);
  });
  it("canonicaliza antes de avaliar completude e recupera CNPJ com postal antigo incompleto", () => {
    const p = perfil(); p.enderecos[0] = { ...cobranca(), cep: "", numero: "", bairro: "", pais: "" };
    expect(planejarSaneamento(config(p), p, [consulta()])).toMatchObject({ aplicavel: true, contagens: { cobrancasIncompletas: 0 }, campos: { enderecos: [expect.objectContaining({ cep: "01001000", numero: "1" })] } });
  });
  it("remove titular pendente sem inventar documento e preserva antes completo", () => {
    const p = perfil(); p.enderecos.push({ ...cobranca("", "8"), razaoSocial: "", inscricaoEstadual: "", titularPendente: true });
    const plano = planejarSaneamento(config(p), p, [consulta()]);
    expect(plano).toMatchObject({ aplicavel: true, contagens: { cobrancasIncompletas: 1, cobrancasDepois: 1 } });
    expect(plano.antes.enderecos[1]).toMatchObject({ titularPendente: true, documento: "" });
  });
  it("mantém PF com nome completo e CPF opcional sem consulta de rede", () => {
    const p = { ...perfil(), tipo: "PF" as const, documento: null, razaoSocial: null, enderecos: [{ ...cobranca(""), tipo: "PF" as const, nomeCompleto: "Pessoa sintética", razaoSocial: "" }] };
    const plano = planejarSaneamento(config(p), p, []); expect(plano.aplicavel).toBe(true); expect(plano.campos.enderecos).toEqual([expect.objectContaining({ tipo: "PF", documento: "", nomeCompleto: p.nome })]);
  });
  it("falha de rede bloqueia a operação em vez de autorizar exclusão", () => {
    const resposta = { erro: "Consulta indisponível" }, c = consulta(CNPJ_A, resposta);
    const plano = planejarSaneamento(config(), perfil(), [c]); expect(plano.aplicavel).toBe(false); expect(plano.pendencias).toContainEqual({ codigo: "CONSULTA_CNPJ_INDISPONIVEL", referencia: CNPJ_A });
  });
  it("bloqueia Principal oficial incompleta sem promover outra empresa", () => {
    const p = perfil(); p.enderecos.push(cobranca(CNPJ_B, "9")); const parcial = resultado(); parcial.cadastro.endereco.cep = "";
    const plano = planejarSaneamento(config(p), p, [consulta(CNPJ_A, parcial), consulta(CNPJ_B, resultado("9"))]); expect(plano.aplicavel).toBe(false); expect(plano.pendencias.map(p => p.codigo)).toContain("PRINCIPAL_INCOMPLETA");
  });
  it("retira adicional cuja fonte pública válida permanece incompleta", () => {
    const p = perfil(); p.enderecos.push(cobranca(CNPJ_B, "9")); const parcial = resultado("9"); parcial.cadastro.endereco.cep = "";
    const plano = planejarSaneamento(config(p), p, [consulta(), consulta(CNPJ_B, parcial)]); expect(plano).toMatchObject({ aplicavel: true, contagens: { cobrancasIncompletas: 1 } });
  });
  it("deduplica entrega sem usar nome, telefone ou texto original na chave", () => {
    const p = perfil(), a = { ...entrega(), textoOriginal: "Texto original A" }, b = { ...entrega("1", "Outro destinatário"), textoOriginal: "Texto original B" }; b.destinatario.contato = "+5511900002222";
    p.entregaPadrao = { ...b, enderecos: [a, b], selecionado: 1 };
    const plano = planejarSaneamento(config(p), p, [consulta()]); expect(plano).toMatchObject({ aplicavel: true, contagens: { entregasDepois: 1, entregasUnificadas: 1 }, campos: { entregaPadrao: { selecionado: 0, textoOriginal: "Texto original A" } } });
    expect(plano.antes.entregaPadrao?.enderecos).toHaveLength(2);
  });
  it("mantém complemento distinto e destino real diferente da sede CNPJ", () => {
    const p = perfil(), a = entrega("2"), b = entrega("2"); b.endereco.complemento = "Sala 2";
    p.entregaPadrao = { ...a, enderecos: [a, b], selecionado: 1 };
    const plano = planejarSaneamento(config(p), p, [consulta()]); expect(plano.contagens.entregasDepois).toBe(3); expect(plano.contagens.copiasIncluidas).toBe(1); expect(plano.campos.entregaPadrao).toMatchObject({ endereco: { numero: "2", complemento: "Sala 2" } });
  });
  it("remove raw incompleto sem inferir CEP e guarda origem no antes", () => {
    const p = perfil(), a = entrega(); a.endereco.cep = ""; a.textoOriginal = "Rua real sem CEP comprovado"; p.entregaPadrao = a;
    const plano = planejarSaneamento(config(p), p, [consulta()]); expect(plano.contagens.entregasIncompletas).toBe(1); expect(plano.antes.entregaPadrao?.textoOriginal).toBe(a.textoOriginal); expect(plano.contagens.copiasIncluidas).toBe(1);
  });
  it("não conserva entrega sem destinatário obrigatório mesmo com postal completo", () => {
    const p = perfil(); p.entregaPadrao = entrega("9", ""); const plano = planejarSaneamento({ ...config(p), copiarCobrancasParaEntrega: false }, p, [consulta()]); expect(plano.campos.entregaPadrao).toBeNull(); expect(plano.contagens.entregasIncompletas).toBe(1);
  });
  it("rejeita alias, versão/hash diferente e consultas omitidas ou adulteradas", () => {
    const p = perfil(); expect(() => planejarSaneamento({ ...config(), alvo: { ...config().alvo, versao: 2 } }, p, [consulta()])).toThrow("SANEAMENTO_ESTADO_DIVERGENTE");
    const alias = { ...p, unificadoEmId: "outra-raiz" }; expect(() => planejarSaneamento(config(alias), alias, [consulta()])).toThrow("SANEAMENTO_ESTADO_DIVERGENTE");
    expect(() => planejarSaneamento(config(), p, [])).toThrow("SANEAMENTO_CONSULTAS_DIVERGENTES");
    expect(() => planejarSaneamento(config(), p, [{ ...consulta(), resultadoSha256: "f".repeat(64) }])).toThrow("SANEAMENTO_CONSULTAS_DIVERGENTES");
  });
  it("rejeita política implícita de remoção e campos de identidade humana", () => {
    expect(() => validarConfiguracaoSaneamento({ ...config(), politicaIncompletos: undefined })).toThrow("SANEAMENTO_CONFIGURACAO_INVALIDA");
    expect(() => validarConfiguracaoSaneamento({ ...config(), usuarioId: "admin" })).toThrow("SANEAMENTO_CAMPO_DESCONHECIDO");
  });
  it("valida fonte real permitida e recusa rotular fallback como BrasilAPI", () => {
    const r = { ...resultado(), fonte: "MINHA_RECEITA_CNPJ_V1" as const }, prova = consulta(CNPJ_A, r);
    expect(planejarSaneamento(config(), perfil(), [prova]).consultas[0].fonte).toBe("MINHA_RECEITA_CNPJ_V1");
    const adulterada = { ...prova, fonte: "BRASILAPI_CNPJ_V1" as const }; adulterada.resultadoSha256 = hashReconciliacao({ fonte: adulterada.fonte, resultado: r });
    expect(() => planejarSaneamento(config(), perfil(), [adulterada])).toThrow("SANEAMENTO_CONSULTAS_DIVERGENTES");
    expect(() => planejarSaneamento(config(), perfil(), [{ ...prova, fonte: "OUTRA_FONTE" as ConsultaSaneamento["fonte"] }])).toThrow("SANEAMENTO_CONSULTAS_DIVERGENTES");
  });
});

let estado: { perfil: PerfilSaneamento; registros: R[]; atividades: unknown[] }, dentroTx = false, leitura = false, tick = 0;
const tx = {
  $executeRaw: vi.fn(async (sql: TemplateStringsArray) => { if (sql[0].includes("READ ONLY")) leitura = true; return 0; }), $queryRaw: vi.fn(async () => []),
  clienteVenda: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => where.id === estado.perfil.id ? copiar(estado.perfil) : null),
    updateMany: vi.fn(async ({ where, data }: { where: { id: string; versao: number }; data: R }) => { if (leitura) throw Error("read only"); if (where.id !== estado.perfil.id || where.versao !== estado.perfil.versao) return { count: 0 }; for (const [k, v] of Object.entries(data)) estado.perfil[k] = k === "versao" ? estado.perfil.versao + 1 : v === Prisma.DbNull ? null : copiar(v); estado.perfil.updatedAt = `2026-10-20T11:00:${String(++tick).padStart(2, "0")}.000Z`; return { count: 1 }; }) },
  identidadeExternaVenda: { findUnique: vi.fn(async ({ where }: { where: { origem_loja_entidade_chave: R } }) => copiar(estado.registros.find(r => Object.entries(where.origem_loja_entidade_chave).every(([k, v]) => r[k] === v)) ?? null)), create: vi.fn(async ({ data }: { data: R }) => { if (leitura) throw Error("read only"); const r = { id: `auditoria-${++tick}`, ...copiar(data) }; estado.registros.push(r); return r; }) },
};
const banco = { $transaction: vi.fn(async (operacao: (tx: unknown) => Promise<unknown>) => { const antes = copiar(estado); dentroTx = true; leitura = false; try { return await operacao(tx); } catch (e) { estado = antes; throw e; } finally { dentroTx = false; leitura = false; } }) } as unknown as NonNullable<Parameters<typeof prepararSaneamento>[1]>["banco"];
const consultar = vi.fn(async (): Promise<ConsultaSaneamento["resultado"]> => { expect(dentroTx).toBe(false); return resultado(); });
const opcoes = { banco, consultar, agora: () => new Date("2026-10-20T11:05:00Z") };
beforeEach(() => { vi.clearAllMocks(); tick = 0; dentroTx = false; leitura = false; estado = { perfil: perfil(), registros: [], atividades: [] }; consultar.mockImplementation(async () => { expect(dentroTx).toBe(false); return resultado(); }); sim.atividade.mockImplementation(async (_tx, ator, evento) => { estado.atividades.push({ ator, evento }); }); vi.stubEnv("CLIENTES_SANEAMENTO_AUTORIZADO", "SIM"); });
afterEach(() => vi.unstubAllEnvs());
describe("aplicação auditada do saneamento", () => {
  it("consulta uma vez por CNPJ foraTx e mantém prévia sem escrita", async () => {
    estado.perfil.enderecos.push(cobranca()); const antes = copiar(estado);
    const previa = await prepararSaneamento(config(estado.perfil), opcoes); expect(previa.aplicavel).toBe(true); expect(consultar).toHaveBeenCalledOnce(); expect(estado).toEqual(antes);
  });
  it("reconsulta foraTx com nova data sem mudar comparabilidade, preserva perfil e audita Sistema", async () => {
    const c = config(), previa = await prepararSaneamento(c, opcoes);
    await aplicarSaneamento(c, previa, evidencia, { ...opcoes, agora: () => new Date("2026-10-20T11:10:00Z") });
    expect(consultar).toHaveBeenCalledTimes(2); expect(estado.perfil).toMatchObject({ versao: 5, telefone: previa.antes.telefone, observacoes: previa.antes.observacoes });
    expect(estado.registros[0]).toMatchObject({ origem: "MANUTENCAO_CLIENTES_V1", entidade: "RECONCILIACAO_COBRANCAS", chave: `sanear:${c.operacaoId}`, dadosOrigem: { modo: "SANEAR_ENDERECOS", antes: previa.antes, evidencia } });
    expect(estado.atividades[0]).toMatchObject({ ator: { tipo: "SISTEMA", referencia: c.atorSistema } }); expect(JSON.stringify(estado.atividades)).not.toContain(CNPJ_A);
  });
  it("audita MinhaReceita como fonte real e revalida o mesmo provedor antes da escrita", async () => {
    const r = { ...resultado(), fonte: "MINHA_RECEITA_CNPJ_V1" as const }; consultar.mockResolvedValue(r);
    const c = config(), previa = await prepararSaneamento(c, opcoes); expect(previa.consultas[0]).toMatchObject({ fonte: "MINHA_RECEITA_CNPJ_V1", resultado: { fonte: "MINHA_RECEITA_CNPJ_V1" } });
    await aplicarSaneamento(c, previa, evidencia, opcoes);
    expect(estado.registros[0]).toMatchObject({ dadosOrigem: { previa: { consultas: [{ fonte: "MINHA_RECEITA_CNPJ_V1" }] }, consultasRevalidadas: [{ fonte: "MINHA_RECEITA_CNPJ_V1" }] } });
  });
  it("mudança de provedor na reconsulta exige outra prévia mesmo com cadastro idêntico", async () => {
    consultar.mockResolvedValueOnce({ ...resultado(), fonte: "MINHA_RECEITA_CNPJ_V1" });
    const c = config(), previa = await prepararSaneamento(c, opcoes), antes = copiar(estado);
    consultar.mockResolvedValueOnce({ ...resultado(), fonte: "BRASILAPI_CNPJ_V1" });
    await expect(aplicarSaneamento(c, previa, evidencia, opcoes)).rejects.toThrow("SANEAMENTO_CONSULTA_PUBLICA_DIVERGENTE"); expect(estado).toEqual(antes);
  });
  it("mudança pública ou erro na reconsulta impede toda escrita", async () => {
    const c = config(), previa = await prepararSaneamento(c, opcoes), antes = copiar(estado); consultar.mockResolvedValueOnce(resultado("99"));
    await expect(aplicarSaneamento(c, previa, evidencia, opcoes)).rejects.toThrow("SANEAMENTO_CONSULTA_PUBLICA_DIVERGENTE"); expect(estado).toEqual(antes);
    consultar.mockRejectedValueOnce(Error("rede sintética indisponível")); await expect(aplicarSaneamento(c, previa, evidencia, opcoes)).rejects.toThrow("rede sintética indisponível"); expect(estado).toEqual(antes);
  });
  it("edição posterior à prévia é rejeitada antes de atualizar", async () => {
    const c = config(), previa = await prepararSaneamento(c, opcoes); estado.perfil.observacoes = "Mudança concorrente";
    await expect(aplicarSaneamento(c, previa, evidencia, opcoes)).rejects.toThrow("SANEAMENTO_ESTADO_DIVERGENTE"); expect(estado.registros).toHaveLength(0);
  });
  it("repetição exata é idempotente sem nova consulta nem auditoria", async () => {
    const c = config(), previa = await prepararSaneamento(c, opcoes); await aplicarSaneamento(c, previa, evidencia, opcoes); const antes = copiar(estado); consultar.mockClear();
    await expect(aplicarSaneamento(c, previa, evidencia, opcoes)).resolves.toMatchObject({ jaAplicado: true }); expect(estado).toEqual(antes); expect(consultar).not.toHaveBeenCalled();
  });
  it("falha de auditoria reverte cadastro e registro técnico", async () => {
    const c = config(), previa = await prepararSaneamento(c, opcoes), antes = copiar(estado); sim.atividade.mockRejectedValueOnce(Error("auditoria sintética indisponível"));
    await expect(aplicarSaneamento(c, previa, evidencia, opcoes)).rejects.toThrow("auditoria sintética indisponível"); expect(estado).toEqual(antes);
  });
  it("reversão restaura livros/razão com versão crescente e impede reaplicação do mesmo lote", async () => {
    const c = config(), previa = await prepararSaneamento(c, opcoes), antes = copiar(estado.perfil); await aplicarSaneamento(c, previa, evidencia, opcoes);
    const reversao = await prepararReversaoSaneamento(c, opcoes); await reverterSaneamento(c, reversao.token, evidencia, opcoes);
    expect(estado.perfil).toEqual({ ...antes, versao: antes.versao + 2, updatedAt: estado.perfil.updatedAt });
    expect(estado.registros).toHaveLength(2); await expect(reverterSaneamento(c, reversao.token, evidencia, opcoes)).resolves.toMatchObject({ jaRevertido: true });
    await expect(aplicarSaneamento(c, previa, evidencia, opcoes)).rejects.toThrow("SANEAMENTO_OPERACAO_REVERTIDA");
  });
  it("edição posterior bloqueia reversão e escrita exige autorização e evidência completas", async () => {
    const c = config(), previa = await prepararSaneamento(c, opcoes); vi.stubEnv("CLIENTES_SANEAMENTO_AUTORIZADO", "NAO");
    await expect(aplicarSaneamento(c, previa, evidencia, opcoes)).rejects.toThrow("SANEAMENTO_NAO_AUTORIZADO"); vi.stubEnv("CLIENTES_SANEAMENTO_AUTORIZADO", "SIM");
    await expect(aplicarSaneamento(c, previa, {} as typeof evidencia, opcoes)).rejects.toThrow("SANEAMENTO_HASH_INVALIDO");
    await aplicarSaneamento(c, previa, evidencia, opcoes); estado.perfil.observacoes = "Pessoa editou depois";
    await expect(prepararReversaoSaneamento(c, opcoes)).rejects.toThrow("SANEAMENTO_REVERSAO_ESTADO_DIVERGENTE");
  });
});
describe("fronteira do CLI", () => {
  it("não aceita trocar plano interno preservando o token externo aprovado", () => {
    const c = config(), plano = planejarSaneamento(c, perfil(), [consulta()]), outro = planejarSaneamento(c, perfil(), [{ ...consulta(), consultadoEm: "2026-10-20T12:00:00Z" }]);
    const envelope = { modo: "previa", operacaoId: c.operacaoId, configuracaoSha256: plano.configuracaoSha256, token: plano.token, resultado: plano };
    expect(validarEnvelopePreviaSaneamento(envelope, c, "aplicar").token).toBe(plano.token);
    expect(() => validarEnvelopePreviaSaneamento({ ...envelope, resultado: outro }, c, "aplicar")).toThrow("SANEAMENTO_CLI_ENVELOPE_DIVERGENTE");
    expect(() => validarEnvelopePreviaSaneamento({ ...envelope, resultado: { ...plano, configuracaoSha256: "f".repeat(64) } }, c, "aplicar")).toThrow("SANEAMENTO_CLI_ENVELOPE_DIVERGENTE");
  });
  it("usa prévia por padrão e fontes tem alvo explícito", () => { expect(argumentosSaneamento(["--configuracao=privada.json", "--saida=.tmp/privado"]).modo).toBe("previa"); expect(argumentosSaneamento(["--modo=fontes", "--cliente-id=sintetico"]).obrigatorio("cliente-id")).toBe("sintetico"); });
  it.each([{ args: ["--usuario-id=admin"] }, { args: ["--modo=aplicar", "--cliente-id=outro"] }, { args: ["--modo=aplicar", "--modo=aplicar"] }])("recusa argumento não autorizado %#", ({ args }) => { expect(() => argumentosSaneamento(args)).toThrow(/SANEAMENTO_CLI_/); });
});
