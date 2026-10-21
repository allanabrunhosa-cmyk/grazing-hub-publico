import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ atividade: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/atividades/registro", () => ({ registrarAtividade: sim.atividade }));
import { hashReconciliacao } from "@/lib/vendas/clientes-cobrancas-reconciliacao";
import { aplicarEquivalencias, inspecionarFontesEquivalencias, planejarEquivalencias, prepararEquivalencias, prepararReversaoEquivalencias, reverterEquivalencias, validarConfiguracaoEquivalencias, type ConfiguracaoEquivalencias } from "@/lib/vendas/clientes-enderecos-equivalencias";
import type { PerfilSaneamento } from "@/lib/vendas/clientes-enderecos-saneamento";
import type { EnderecoVenda, EntregaCliente } from "@/lib/vendas/dominio";
import { argumentosEquivalencias, validarEnvelopePreviaEquivalencias } from "../../scripts/clientes-enderecos-unificar";

type R = Record<string, unknown>;
const copiar = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
function endereco(complemento = ""): EnderecoVenda { return { nome: "Principal", destinatario: "Pessoa sintética", tipo: "PF", nomeCompleto: "Pessoa sintética", documento: "", pais: "Brasil", cep: "01001000", logradouro: "Rua Teste", numero: "100", complemento, bairro: "Centro", cidade: "São Paulo", uf: "SP" }; }
function entrega(complemento = "", nome = "Pessoa sintética"): EntregaCliente { return { destinatario: { nome, contato: "+5511900001111" }, endereco: endereco(complemento) }; }
function perfil(): PerfilSaneamento {
  const a = entrega(), b = entrega("Concessionária sintética", "Outra pessoa"), fora = entrega("Prédio A"); b.endereco.cep = "01002000"; b.endereco.bairro = "Jardim Teste"; b.textoOriginal = "Texto original selecionado"; fora.endereco.numero = "200";
  return { id: "cliente-sintetico", versao: 4, unificadoEmId: null, nome: "Pessoa sintética", tipo: "PF", documento: null, razaoSocial: null, inscricaoEstadual: null, ativo: true, enderecos: [endereco()], entregaPadrao: { ...b, enderecos: [a, b, fora], selecionado: 1 }, observacoes: "Preservar", updatedAt: "2026-10-20T11:00:00.000Z" };
}
function config(p = perfil()): ConfiguracaoEquivalencias { return { versao: 1, modo: "UNIFICAR_ENTREGAS_EQUIVALENTES", operacaoId: "equivalencias-sinteticas", revisaoCodigo: "a".repeat(40), atorSistema: "manutencao-sintetica", alvo: { id: p.id, versao: p.versao, estadoSha256: hashReconciliacao(p) }, grupos: [{ id: "grupo-01", entradas: [0, 1].map(indice => ({ indice, sha256: hashReconciliacao(p.entregaPadrao!.enderecos![indice]) })), indiceManter: 0, motivo: "Mesmo destino confirmado em revisão sintética.", permitirCodigosLojaComoReferencia: false }] }; }
const evidencia = { aprovacaoSha256: "b".repeat(64), backupSha256: "c".repeat(64), artefatoSha256: "d".repeat(64) };

describe("plano dirigido de entregas equivalentes", () => {
  it("unifica CEP/bairro/referência distintos somente no grupo e preserva a opção selecionada", () => {
    const p = perfil(), antes = copiar(p), plano = planejarEquivalencias(config(p), p);
    expect(plano).toMatchObject({ aplicavel: true, contagens: { grupos: 1, entregasAntes: 3, entregasDepois: 2, entregasUnificadas: 1 }, selecionadoAntes: 1, selecionadoDepois: 0 });
    expect(plano.campos.entregaPadrao.enderecos).toEqual([p.entregaPadrao!.enderecos![1], p.entregaPadrao!.enderecos![2]]);
    expect(plano.campos.entregaPadrao).toMatchObject({ selecionado: 0, destinatario: p.entregaPadrao!.destinatario, textoOriginal: "Texto original selecionado" });
    expect(plano.depois.enderecos).toEqual(p.enderecos); expect(plano.indices).toEqual([{ indiceOriginal: 0, indiceNovo: 0 }, { indiceOriginal: 1, indiceNovo: 0 }, { indiceOriginal: 2, indiceNovo: 1 }]); expect(p).toEqual(antes);
  });
  it("usa indiceManter quando seleção está fora do grupo sem alterar seleção nem itens externos", () => {
    const p = perfil(); p.entregaPadrao = { ...p.entregaPadrao!.enderecos![2], enderecos: p.entregaPadrao!.enderecos, selecionado: 2 }; const c = config(p); c.grupos[0].indiceManter = 1;
    const plano = planejarEquivalencias(c, p); expect(plano.grupos[0].indiceManterEfetivo).toBe(1); expect(plano.campos.entregaPadrao.selecionado).toBe(1); expect(plano.campos.entregaPadrao.destinatario).toEqual(p.entregaPadrao.destinatario); expect(plano.campos.entregaPadrao).not.toHaveProperty("textoOriginal");
  });
  it("conserva grupos independentes e ordem dos itens externos", () => {
    const p = perfil(); p.entregaPadrao!.enderecos!.push(copiar(p.entregaPadrao!.enderecos![2])); const c = config(p); c.grupos.push({ ...c.grupos[0], id: "grupo-02", entradas: [2, 3].map(indice => ({ indice, sha256: hashReconciliacao(p.entregaPadrao!.enderecos![indice]) })), indiceManter: 2 });
    expect(planejarEquivalencias(c, p)).toMatchObject({ aplicavel: true, contagens: { grupos: 2, entregasDepois: 2, entregasUnificadas: 2 } });
  });
  it.each(["Prédio", "Sala", "Bloco", "Apartamento", "Torre", "Piso"])("bloqueia %s A/B mesmo com autorização de códigos comerciais", unidade => {
    const p = perfil(); p.entregaPadrao!.enderecos![0].endereco.complemento = `${unidade} A`; p.entregaPadrao!.enderecos![1].endereco.complemento = `${unidade} B`; const c = config(p); c.grupos[0].permitirCodigosLojaComoReferencia = true; c.grupos[0].complementoFinal = `${unidade} A`;
    expect(planejarEquivalencias(c, p)).toMatchObject({ aplicavel: false, pendencias: [{ codigo: "UNIDADES_FISICAS_DIVERGENTES", grupoId: "grupo-01" }] });
  });
  it.each(["Bloco II", "Prédio 4", "Piso Xingu"])("preserva %s no complemento final e impede apagar a informação", complemento => {
    const p = perfil(); p.entregaPadrao!.enderecos![0].endereco.complemento = complemento; p.entregaPadrao!.enderecos![1].endereco.complemento = ""; const c = config(p);
    expect(planejarEquivalencias(c, p)).toMatchObject({ aplicavel: false, pendencias: [{ codigo: "UNIDADE_FISICA_ALTERADA" }] });
    c.grupos[0].complementoFinal = complemento; const plano = planejarEquivalencias(c, p); expect(plano.aplicavel).toBe(true); expect(plano.campos.entregaPadrao.endereco.complemento).toBe(complemento); expect(plano.grupos[0]).toMatchObject({ complementoAntes: "", complementoDepois: complemento });
  });
  it("exige permissão explícita para interpretar Loja 1/002 como códigos comerciais", () => {
    const p = perfil(); p.entregaPadrao!.enderecos![0].endereco.complemento = "Loja 1"; p.entregaPadrao!.enderecos![1].endereco.complemento = "Loja 002"; const c = config(p); c.grupos[0].complementoFinal = "";
    expect(planejarEquivalencias(c, p).aplicavel).toBe(false); c.grupos[0].permitirCodigosLojaComoReferencia = true; expect(planejarEquivalencias(c, p).aplicavel).toBe(true);
  });
  it("não permite acrescentar unidade física inexistente", () => { const c = config(); c.grupos[0].complementoFinal = "Sala 9"; expect(planejarEquivalencias(c, perfil()).pendencias).toContainEqual({ codigo: "UNIDADE_FISICA_ALTERADA", grupoId: "grupo-01" }); });
  it.each([["2º andar", "3º andar"], ["2º andar fundos", "3º andar fundos"], ["2º andar 3", "2º andar"], ["Andar n.º 2", "Andar n.º 3"], ["Sala 1 e 2", "Sala 1"], ["Sala 1, 2", "Sala 1"], ["Prédio", ""]])("bloqueia descarte de unidade ordinal, numerada ou ambígua (%s / %s)", (a, b) => {
    const p = perfil(); p.entregaPadrao!.enderecos![0].endereco.complemento = a; p.entregaPadrao!.enderecos![1].endereco.complemento = b; const c = config(p); c.grupos[0].permitirCodigosLojaComoReferencia = true; expect(planejarEquivalencias(c, p).aplicavel).toBe(false);
  });
  it.each(["2º andar", "2ºandar fundos", "Andar n.º 2"])("conserva a unidade na forma %s", complemento => {
    const p = perfil(); p.entregaPadrao!.enderecos![0].endereco.complemento = complemento; p.entregaPadrao!.enderecos![1].endereco.complemento = ""; const c = config(p); c.grupos[0].complementoFinal = "Andar 2"; expect(planejarEquivalencias(c, p).aplicavel).toBe(true);
  });
  it.each(["numero", "cidade", "uf", "logradouro", "pais"] as const)("bloqueia local distinto em %s", campo => {
    const p = perfil(); p.entregaPadrao!.enderecos![1].endereco[campo] = campo === "uf" ? "RJ" : "Outro"; expect(planejarEquivalencias(config(p), p).pendencias).toContainEqual({ codigo: "LOCAIS_DIVERGENTES", grupoId: "grupo-01" });
  });
  it("rejeita hash de entrada divergente mesmo com alvo íntegro", () => { const c = config(); c.grupos[0].entradas[1].sha256 = "f".repeat(64); expect(() => planejarEquivalencias(c, perfil())).toThrow("EQUIVALENCIAS_ENTRADA_DIVERGENTE"); });
  it("rejeita grupos sobrepostos, sobrevivente externo e permissão implícita", () => {
    const c = config(); expect(() => validarConfiguracaoEquivalencias({ ...c, grupos: [...c.grupos, { ...c.grupos[0], id: "outro" }] })).toThrow("EQUIVALENCIAS_GRUPOS_SOBREPOSTOS"); expect(() => validarConfiguracaoEquivalencias({ ...c, grupos: [{ ...c.grupos[0], indiceManter: 2 }] })).toThrow("EQUIVALENCIAS_SOBREVIVENTE_FORA_GRUPO"); expect(() => validarConfiguracaoEquivalencias({ ...c, grupos: [{ ...c.grupos[0], permitirCodigosLojaComoReferencia: undefined }] })).toThrow("EQUIVALENCIAS_GRUPO_INVALIDO");
  });
  it("inclui motivo, escolha e complemento no token; rejeita campos de alteração cadastral", () => {
    const c = config(), a = planejarEquivalencias(c, perfil()); c.grupos[0].complementoFinal = "Referência comercial revisada"; expect(planejarEquivalencias(c, perfil()).token).not.toBe(a.token); expect(() => validarConfiguracaoEquivalencias({ ...c, nome: "Alterar nome" })).toThrow("EQUIVALENCIAS_CAMPO_DESCONHECIDO");
  });
});

let estado: { perfil: PerfilSaneamento; registros: R[]; atividades: unknown[] }, leitura = false, tick = 0;
const tx = {
  $executeRaw: vi.fn(async (sql: TemplateStringsArray) => { if (sql[0].includes("READ ONLY")) leitura = true; return 0; }), $queryRaw: vi.fn(async () => []),
  clienteVenda: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => where.id === estado.perfil.id ? copiar(estado.perfil) : null), updateMany: vi.fn(async ({ where, data }: { where: { id: string; versao: number }; data: R }) => { if (leitura) throw Error("read only"); if (where.id !== estado.perfil.id || where.versao !== estado.perfil.versao) return { count: 0 }; estado.perfil.entregaPadrao = copiar(data.entregaPadrao) as PerfilSaneamento["entregaPadrao"]; estado.perfil.versao++; estado.perfil.updatedAt = `2026-10-20T11:01:${String(++tick).padStart(2, "0")}.000Z`; return { count: 1 }; }) },
  identidadeExternaVenda: { findUnique: vi.fn(async ({ where }: { where: { origem_loja_entidade_chave: R } }) => copiar(estado.registros.find(r => Object.entries(where.origem_loja_entidade_chave).every(([k, v]) => r[k] === v)) ?? null)), create: vi.fn(async ({ data }: { data: R }) => { if (leitura) throw Error("read only"); const r = { id: `auditoria-${++tick}`, ...copiar(data) }; estado.registros.push(r); return r; }) },
};
const banco = { $transaction: vi.fn(async (operacao: (tx: unknown) => Promise<unknown>) => { const antes = copiar(estado); leitura = false; try { return await operacao(tx); } catch (e) { estado = antes; throw e; } finally { leitura = false; } }) } as unknown as NonNullable<Parameters<typeof prepararEquivalencias>[1]>["banco"];
const opcoes = { banco, agora: () => new Date("2026-10-20T11:05:00Z") };
beforeEach(() => { vi.clearAllMocks(); tick = 0; leitura = false; estado = { perfil: perfil(), registros: [], atividades: [] }; sim.atividade.mockImplementation(async (_tx, ator, evento) => { estado.atividades.push({ ator, evento }); }); vi.stubEnv("CLIENTES_EQUIVALENCIAS_AUTORIZADAS", "SIM"); });
afterEach(() => vi.unstubAllEnvs());
describe("aplicação e reversão da equivalência", () => {
  it("fontes/prévia são somente leitura e incluem hashes individuais", async () => { const antes = copiar(estado); const fontes = await inspecionarFontesEquivalencias(estado.perfil.id, opcoes); expect(fontes.entregas[1].sha256).toBe(hashReconciliacao(estado.perfil.entregaPadrao!.enderecos![1])); await prepararEquivalencias(config(), opcoes); expect(estado).toEqual(antes); expect(tx.$executeRaw).toHaveBeenCalled(); });
  it("altera apenas entregaPadrao com versão e auditoria Sistema completa", async () => {
    const c = config(), antes = copiar(estado.perfil), previa = await prepararEquivalencias(c, opcoes); await aplicarEquivalencias(c, previa, evidencia, opcoes);
    const protegidos = (p: PerfilSaneamento) => Object.fromEntries(Object.entries(p).filter(([k]) => !["entregaPadrao", "versao", "updatedAt"].includes(k))); expect(protegidos(estado.perfil)).toEqual(protegidos(antes)); expect(estado.perfil.versao).toBe(antes.versao + 1); expect(estado.registros[0]).toMatchObject({ dadosOrigem: { antes, depois: estado.perfil, configuracao: c, evidencia } }); expect(estado.atividades[0]).toMatchObject({ ator: { tipo: "SISTEMA" } });
  });
  it("repetição exata é idempotente e rejeita operação já revertida", async () => { const c = config(), previa = await prepararEquivalencias(c, opcoes); await aplicarEquivalencias(c, previa, evidencia, opcoes); const antes = copiar(estado); await expect(aplicarEquivalencias(c, previa, evidencia, opcoes)).resolves.toMatchObject({ jaAplicado: true }); expect(estado).toEqual(antes); const reversao = await prepararReversaoEquivalencias(c, opcoes); await reverterEquivalencias(c, reversao.token, evidencia, opcoes); await expect(aplicarEquivalencias(c, previa, evidencia, opcoes)).rejects.toThrow("EQUIVALENCIAS_OPERACAO_REVERTIDA"); });
  it("reversão restaura exatamente os livros antigos com versão crescente e idempotência", async () => { const c = config(), antes = copiar(estado.perfil), previa = await prepararEquivalencias(c, opcoes); await aplicarEquivalencias(c, previa, evidencia, opcoes); const reversao = await prepararReversaoEquivalencias(c, opcoes); await reverterEquivalencias(c, reversao.token, evidencia, opcoes); expect(estado.perfil).toEqual({ ...antes, versao: antes.versao + 2, updatedAt: estado.perfil.updatedAt }); const gravado = copiar(estado); await expect(reverterEquivalencias(c, reversao.token, evidencia, opcoes)).resolves.toMatchObject({ jaRevertido: true }); expect(estado).toEqual(gravado); });
  it("edição concorrente bloqueia aplicação e edição posterior bloqueia reversão", async () => {
    const c = config(), previa = await prepararEquivalencias(c, opcoes); estado.perfil.observacoes = "Mudou"; await expect(aplicarEquivalencias(c, previa, evidencia, opcoes)).rejects.toThrow("EQUIVALENCIAS_ESTADO_DIVERGENTE"); expect(estado.registros).toHaveLength(0); estado.perfil.observacoes = previa.antes.observacoes; await aplicarEquivalencias(c, previa, evidencia, opcoes); estado.perfil.observacoes = "Posterior"; await expect(prepararReversaoEquivalencias(c, opcoes)).rejects.toThrow("EQUIVALENCIAS_REVERSAO_ESTADO_DIVERGENTE");
  });
  it("falha de auditoria desfaz toda alteração", async () => { const c = config(), previa = await prepararEquivalencias(c, opcoes), antes = copiar(estado); sim.atividade.mockRejectedValueOnce(Error("falha sintética")); await expect(aplicarEquivalencias(c, previa, evidencia, opcoes)).rejects.toThrow("falha sintética"); expect(estado).toEqual(antes); });
  it("plano bloqueado/adulterado, autorização ausente e evidência inválida não escrevem", async () => {
    const c = config(), previa = await prepararEquivalencias(c, opcoes), antes = copiar(estado); await expect(aplicarEquivalencias(c, { ...previa, token: "f".repeat(64) }, evidencia, opcoes)).rejects.toThrow("EQUIVALENCIAS_PREVIA_INVALIDA"); vi.stubEnv("CLIENTES_EQUIVALENCIAS_AUTORIZADAS", "NAO"); await expect(aplicarEquivalencias(c, previa, evidencia, opcoes)).rejects.toThrow("EQUIVALENCIAS_NAO_AUTORIZADO"); vi.stubEnv("CLIENTES_EQUIVALENCIAS_AUTORIZADAS", "SIM"); await expect(aplicarEquivalencias(c, previa, { ...evidencia, backupSha256: "" }, opcoes)).rejects.toThrow("EQUIVALENCIAS_HASH_INVALIDO"); expect(estado).toEqual(antes);
  });
});
describe("CLI de unificação", () => {
  it("aceita modos existentes e rejeita argumentos duplicados/desconhecidos", () => { expect(argumentosEquivalencias(["--modo=fontes", "--cliente-id=sintetico", "--saida=.tmp/teste"]).modo).toBe("fontes"); expect(() => argumentosEquivalencias(["--modo=aplicar", "--modo=previa"])).toThrow("EQUIVALENCIAS_CLI_ARGUMENTOS_INVALIDOS"); expect(() => argumentosEquivalencias(["--email=real"])).toThrow(); expect(() => argumentosEquivalencias(["--modo=aplicar", "--cliente-id=sintetico"])).toThrow(); });
  it("vincula envelope interno/externo, token e configuração aprovada", () => {
    const c = config(), resultado = planejarEquivalencias(c, perfil()), envelope = { modo: "previa", operacaoId: c.operacaoId, configuracaoSha256: hashReconciliacao(c), token: resultado.token, resultado };
    expect(validarEnvelopePreviaEquivalencias(envelope, c, "aplicar").token).toBe(resultado.token); expect(() => validarEnvelopePreviaEquivalencias({ ...envelope, token: "f".repeat(64) }, c, "aplicar")).toThrow("EQUIVALENCIAS_CLI_ENVELOPE_DIVERGENTE"); expect(() => validarEnvelopePreviaEquivalencias({ ...envelope, resultado: { ...resultado, configuracaoSha256: "f".repeat(64) } }, c, "aplicar")).toThrow(); expect(() => validarEnvelopePreviaEquivalencias(envelope, c, "reverter")).toThrow();
  });
});
