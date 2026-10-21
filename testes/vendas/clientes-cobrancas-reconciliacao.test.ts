import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ atividade: vi.fn(), conferir: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/atividades/registro", () => ({ registrarAtividade: sim.atividade }));
vi.mock("@/lib/vendas/clientes-unicidade", async importar => ({ ...await importar<typeof import("@/lib/vendas/clientes-unicidade")>(), conferirIdentidadeCliente: sim.conferir }));
import { aplicarReconciliacao, hashReconciliacao, ORIGEM_RECONCILIACAO, planejarReconciliacao, prepararReconciliacao, prepararReversaoReconciliacao, reverterReconciliacao, validarConfiguracaoReconciliacao, type ConfiguracaoReconciliacao, type FonteReconciliacao } from "@/lib/vendas/clientes-cobrancas-reconciliacao";
import type { EnderecoVenda } from "@/lib/vendas/dominio";

type R = Record<string, unknown>;
const copiar = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const o = (v: unknown): R => v && typeof v === "object" && !Array.isArray(v) ? v as R : {};
function endereco(n = "10", documento = "11222333000181"): EnderecoVenda { return { nome: "Principal", tipo: "PJ", documento, nomeCompleto: "", razaoSocial: "Empresa de teste sintético", inscricaoEstadual: "ISENTO", inscricaoMunicipal: "12345", destinatario: "Empresa de teste sintético", pais: "Brasil", cep: "01001000", logradouro: "Praça de teste", numero: n, complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" }; }
function perfil(id = "raiz", unificadoEmId: string | null = null) { return { id, unificadoEmId, versao: 3, nome: "Empresa anterior sintética", tipo: "PJ", documento: "11222333000181", email: "compras@example.invalid", razaoSocial: "Empresa de teste sintético", inscricaoEstadual: "ISENTO", ativo: true, enderecos: [endereco()], entregaPadrao: null, telefone: "11900001111", observacoes: "Preservar perfil", createdAt: "2026-10-19T00:00:00.000Z", updatedAt: "2026-10-19T00:00:00.000Z" }; }
function config(): ConfiguracaoReconciliacao { return { versao: 1, operacaoId: "reconciliacao-sintetica-01", revisaoCodigo: "a".repeat(40), atorSistema: "manutencao-cadastral-sintetica", alvo: { id: "raiz", email: "compras@example.invalid", versao: 3 }, nomeCliente: "Fantasia sintética", principal: endereco(), copiarCobrancasParaEntrega: true, mapeamentos: [] }; }
function fontePedido(id = "pedido-1", alterar: R = {}): FonteReconciliacao { const dados = { id, clienteId: "raiz", status: "HISTORICO", versao: 1, atendimento: "ENTREGA", cobrancaSnapshot: endereco(), destinatarioSnapshot: { nome: "Pessoa sintética", contato: "" }, enderecoSnapshot: { ...endereco("99"), tipo: undefined, documento: undefined }, ...alterar }; return { tipo: "PEDIDO", id, pedidoId: id, dados: copiar(dados), sha256: hashReconciliacao(dados) }; }
function fonteExterna(pedidoId = "pedido-1"): FonteReconciliacao & { tipo: "IDENTIDADE_EXTERNA" } { const dados = { id: "fonte-1", origem: "grazing-legado-orders", entidade: "PEDIDO_HISTORICO", destinoId: pedidoId, dadosOrigem: { registro: { enderecos: [{ texto: "Endereço de cobrança sintético comprovado", entrega_confirmada: false }] }, hub: { clienteId: "raiz", entregaHistorica: { origem: "google-sheets-shipping", enderecoOriginal: "Entrega real sintética", modalidade: "ENTREGA_INFORMADA" } } } }; return { tipo: "IDENTIDADE_EXTERNA", id: "fonte-1", pedidoId, dados, sha256: hashReconciliacao(dados) }; }
function planejamento(c = config(), perfis = [perfil()], fontes = [fontePedido()]) { return planejarReconciliacao(c, perfis, fontes); }

describe("prévia privada de reconciliação cadastral", () => {
  it("preserva entrega real diferente de cobrança e usa o Principal como default novo", () => {
    const previa = planejamento(); expect(previa.aplicavel).toBe(true);
    expect(previa.contagens).toEqual({ pedidos: 1, cobrancas: 1, entregas: 2, pedidosTitularPendente: 0, cobrancasTitularPendente: 0 });
    const root = previa.alteracoes.at(-1)!;
    expect(root.campos).toMatchObject({ nome: "Fantasia sintética", entregaPadrao: { selecionado: 0, endereco: { numero: "10" }, enderecos: [{ endereco: { numero: "10" } }, { endereco: { numero: "99" } }] } });
    expect(root.depois.telefone).toBe(root.antes.telefone); expect(root.depois.observacoes).toBe(root.antes.observacoes);
  });
  it("deduplica mesma identidade/postal, mas mantém outro CNPJ, número e complemento", () => {
    const f = fontePedido("pedido-1", { cobrancaSnapshot: endereco("10", "22333444000199") });
    const f2 = fontePedido("pedido-2", { cobrancaSnapshot: endereco("11") });
    const f3 = fontePedido("pedido-3", { cobrancaSnapshot: { ...endereco(), complemento: "Sala B" } });
    expect(planejamento(config(), [perfil()], [f, f2, f3]).contagens.cobrancas).toBe(4);
  });
  it("não depende da ordem das propriedades JSON para produzir hash", () => {
    expect(hashReconciliacao({ b: 2, a: 1 })).toBe(hashReconciliacao({ a: 1, b: 2 }));
    expect(planejamento().token).toBe(planejamento().token);
  });
  it("refaz hash quando mudam perfil, endereço ou versão de pedido", () => {
    const antes = planejamento().token, p = perfil(); p.telefone = "11900002222";
    expect(planejamento(config(), [p]).token).not.toBe(antes);
    expect(planejamento(config(), [perfil()], [fontePedido("pedido-1", { versao: 2 })]).token).not.toBe(antes);
  });
  it("aceita transcrição vinculada ao id, hash e caminho da fonte original", () => {
    const externa = fonteExterna(), c = config(), original = copiar(externa);
    c.mapeamentos = [{ tipo: externa.tipo, id: externa.id, sha256: externa.sha256, caminho: "/dadosOrigem/registro/enderecos/0/texto", cobranca: endereco("30") }, { tipo: externa.tipo, id: externa.id, sha256: externa.sha256, caminho: "/dadosOrigem/hub/entregaHistorica/enderecoOriginal", entrega: { destinatario: { nome: "Outro destinatário sintético", contato: "" }, endereco: endereco("80") } }];
    const previa = planejamento(c, [perfil()], [fontePedido("pedido-1", { cobrancaSnapshot: null, enderecoSnapshot: null }), externa]);
    expect(previa.aplicavel).toBe(true); expect(previa.contagens.cobrancas).toBe(2); expect(externa).toEqual(original);
    expect(previa.contagens.entregas).toBe(3);
  });
  it.each(["HASH", "ID", "CAMINHO"])("recusa prova divergente por %s", erro => {
    const externa = fonteExterna(), c = config(); c.mapeamentos = [{ tipo: externa.tipo, id: erro === "ID" ? "outra-fonte" : externa.id, sha256: erro === "HASH" ? "f".repeat(64) : externa.sha256, caminho: erro === "CAMINHO" ? "/ausente" : "/dadosOrigem/registro/enderecos", cobranca: endereco("30") }];
    expect(() => planejamento(c, [perfil()], [fontePedido(), externa])).toThrow(/RECONCILIACAO_(PROVA_DIVERGENTE|PROVA_CAMINHO_AUSENTE)/);
  });
  it("não trata endereço de cobrança sem confirmação como prova automática de entrega", () => {
    const previa = planejamento({ ...config(), copiarCobrancasParaEntrega: false }, [perfil()], [fontePedido("pedido-1", { enderecoSnapshot: null }), fonteExterna()]);
    expect(previa.contagens.entregas).toBe(0); expect(previa.alteracoes[0].campos.entregaPadrao).toBeNull();
  });
  it("mantém Shipping incompleto e seu texto original sem inventar CEP ou número", () => {
    const f = fonteExterna(), c = config();
    c.mapeamentos = [{ tipo: f.tipo, id: f.id, sha256: f.sha256, caminho: "/dadosOrigem/hub/entregaHistorica/enderecoOriginal", entrega: { destinatario: { nome: "", contato: "" }, endereco: { pais: "Brasil", cep: "", logradouro: "Rua de teste", numero: "", complemento: "", bairro: "", cidade: "", uf: "" }, textoOriginal: "Rua de teste\nNúmero não informado" } }];
    const previa = planejamento(c, [perfil()], [fontePedido("pedido-1", { enderecoSnapshot: null }), f]);
    expect(previa.aplicavel).toBe(true);
    expect(o(previa.alteracoes[0].campos.entregaPadrao).enderecos).toContainEqual(expect.objectContaining({ textoOriginal: "Rua de teste\nNúmero não informado", endereco: expect.objectContaining({ cep: "", numero: "" }) }));
  });
  it("não permite promover C/H sem entrega confirmada a endereço real", () => {
    const f = fonteExterna(), c = config(); c.mapeamentos = [{ tipo: f.tipo, id: f.id, sha256: f.sha256, caminho: "/dadosOrigem/registro/enderecos/0/texto", entrega: { destinatario: { nome: "", contato: "" }, endereco: endereco() } }];
    expect(() => planejamento(c, [perfil()], [fontePedido(), f])).toThrow("RECONCILIACAO_ENTREGA_ORIGEM_NAO_COMPROVADA");
  });
  it("mantém titular PJ pendente só com política explícita e prova postal", () => {
    const f = fonteExterna(), origem = o(f.dados.dadosOrigem); origem.hub = { clienteId: "raiz" }; f.sha256 = hashReconciliacao(f.dados);
    const c = config(), pendente = { ...endereco("70"), documento: "", razaoSocial: "", inscricaoEstadual: "", inscricaoMunicipal: "", titularPendente: true };
    c.mapeamentos = [{ tipo: f.tipo, id: f.id, sha256: f.sha256, caminho: "/dadosOrigem/registro/enderecos/0/texto", cobranca: pendente }];
    expect(() => planejamento(c, [perfil()], [fontePedido(), f])).toThrow("RECONCILIACAO_POLITICA_TITULAR_PENDENTE_EXIGIDA");
    c.politicaTitularSemProva = "MANTER_PENDENTE";
    const previa = planejamento(c, [perfil()], [fontePedido("pedido-1", { cobrancaSnapshot: null }), f]);
    expect(previa).toMatchObject({ aplicavel: true, contagens: { pedidosTitularPendente: 1, cobrancasTitularPendente: 1 } });
    expect(previa.alteracoes[0].campos.enderecos).toEqual(expect.arrayContaining([expect.objectContaining({ documento: "", razaoSocial: "", titularPendente: true })]));
    expect(() => validarConfiguracaoReconciliacao({ ...c, principal: pendente })).toThrow("RECONCILIACAO_TITULAR_PENDENTE_INVALIDO");
  });
  it("usa correção histórica comprovada quando o membro original não tem CNPJ", () => {
    const p = perfil(); p.documento = null as never; p.enderecos = [];
    const alias = perfil("titular-comprovado", "raiz"), f = fonteExterna(); o(f.dados.dadosOrigem).hub = { clienteId: "raiz" }; f.sha256 = hashReconciliacao(f.dados);
    const dados = { id: "historico-1", pedidoId: "pedido-1", tipo: "HISTORICO_CLIENTE_CORRIGIDO", depois: { clienteId: alias.id } };
    const historico: FonteReconciliacao = { tipo: "HISTORICO_PEDIDO", id: dados.id, pedidoId: dados.pedidoId, dados, sha256: hashReconciliacao(dados) };
    const c = config(); c.reservaPrincipal = { aliasId: alias.id, versao: alias.versao, sha256: hashReconciliacao(alias), titularComprovado: endereco() };
    c.mapeamentos = [{ tipo: f.tipo, id: f.id, sha256: f.sha256, caminho: "/dadosOrigem/registro/enderecos/0/texto", cobranca: endereco(), provaIdentidade: { tipo: historico.tipo as "HISTORICO_PEDIDO", id: historico.id, sha256: historico.sha256, caminho: "/depois/clienteId" } }];
    expect(planejamento(c, [p, alias], [fontePedido("pedido-1", { cobrancaSnapshot: null }), f, historico]).aplicavel).toBe(true);
    c.mapeamentos[0].provaIdentidade!.sha256 = "f".repeat(64);
    expect(() => planejamento(c, [p, alias], [fontePedido("pedido-1", { cobrancaSnapshot: null }), f, historico])).toThrow("RECONCILIACAO_PROVA_IDENTIDADE_DIVERGENTE");
  });
  it("informa pedido sem identidade comprovada e não permite ignorar a lacuna", () => {
    const f = fontePedido("pedido-1", { cobrancaSnapshot: null }), c = config();
    expect(planejamento(c, [perfil()], [f]).pendencias).toContainEqual({ codigo: "COBRANCA_PEDIDO_SEM_PROVA", referencia: f.id });
    expect(() => validarConfiguracaoReconciliacao({ ...c, semCobrancaComprovada: [{ pedidoId: f.id, sha256: f.sha256 }] })).toThrow("RECONCILIACAO_CAMPO_DESCONHECIDO");
  });
  it("preserva a opção de entrega selecionada do cadastro", () => {
    const p = perfil(); p.entregaPadrao = { destinatario: { nome: "Um", contato: "" }, endereco: endereco("20"), selecionado: 1, enderecos: [{ destinatario: { nome: "Um", contato: "" }, endereco: endereco("20") }, { destinatario: { nome: "Dois", contato: "" }, endereco: endereco("21") }] } as never;
    expect(planejamento(config(), [p]).alteracoes[0].campos.entregaPadrao).toMatchObject({ selecionado: 0, endereco: { numero: "21" } });
  });
  it("bloqueia acima dos limites sem truncar as listas", () => {
    const fontes = Array.from({ length: 251 }, (_, i) => fontePedido(`pedido-${i}`, { cobrancaSnapshot: endereco(String(i + 100)), enderecoSnapshot: null }));
    const previa = planejamento(config(), [perfil()], fontes);
    expect(previa.aplicavel).toBe(false); expect(previa.contagens.cobrancas).toBe(252); expect(previa.contagens.entregas).toBe(252);
    expect(previa.pendencias.map(p => p.codigo)).toEqual(expect.arrayContaining(["LIMITE_COBRANCAS_EXCEDIDO", "LIMITE_ENTREGAS_EXCEDIDO"]));
  });
  it("recusa natureza, versão, e-mail ou família incompatíveis", () => {
    expect(() => planejamento({ ...config(), alvo: { ...config().alvo, versao: 2 } })).toThrow("RECONCILIACAO_ALVO_DIVERGENTE");
    expect(() => planejamento({ ...config(), alvo: { ...config().alvo, email: "outro@example.invalid" } })).toThrow("RECONCILIACAO_ALVO_DIVERGENTE");
    expect(() => planejamento(config(), [perfil(), perfil("alias", "outra-raiz")])).toThrow("RECONCILIACAO_FAMILIA_DIVERGENTE");
    expect(() => planejamento(config(), [perfil()], [fontePedido("outro", { clienteId: "fora" })])).toThrow("RECONCILIACAO_PEDIDO_FORA_ESCOPO");
  });
  it("recusa campos inesperados, ator humano e configuração sem identidade", () => {
    expect(() => validarConfiguracaoReconciliacao({ ...config(), usuarioId: "admin" })).toThrow("RECONCILIACAO_CAMPO_DESCONHECIDO");
    expect(() => validarConfiguracaoReconciliacao({ ...config(), principal: { ...endereco(), tipo: undefined } })).toThrow("RECONCILIACAO_IDENTIDADE_COBRANCA_AUSENTE");
    expect(() => validarConfiguracaoReconciliacao({ ...config(), principal: { ...endereco(), cep: "" } })).toThrow("RECONCILIACAO_COBRANCA_INCOMPLETA");
  });
  it("não perde o documento anterior da raiz ao trocar o principal", () => {
    const p = perfil(); p.enderecos = []; const c = config(); c.principal = endereco("12", "22333444000199");
    expect(planejamento(c, [p], [fontePedido("pedido-1", { cobrancaSnapshot: c.principal })]).pendencias).toContainEqual({ codigo: "TITULAR_ANTERIOR_SEM_PROVA", referencia: "raiz" });
  });
  it("move reserva apenas com prova de alias do mesmo grupo e preserva sua identidade em JSON", () => {
    const c = config(), p = perfil(), alias = perfil("alias", "raiz"); p.documento = "22333444000199"; p.enderecos = [endereco("15", p.documento)];
    c.reservaPrincipal = { aliasId: alias.id, versao: alias.versao, sha256: hashReconciliacao(alias), titularComprovado: endereco() };
    const previa = planejamento(c, [p, alias]); expect(previa.aplicavel).toBe(true);
    expect(previa.alteracoes[0]).toMatchObject({ id: "alias", campos: { documento: null, enderecos: [{ documento: c.principal.documento }] } });
    expect(previa.contagens.cobrancas).toBe(2);
    c.reservaPrincipal.sha256 = "0".repeat(64);
    expect(() => planejamento(c, [p, alias])).toThrow("RECONCILIACAO_RESERVA_DIVERGENTE");
  });
});

let estado: { clientes: R[]; pedidos: R[]; fontes: R[]; atividades: R[]; historicos: R[]; contatos: R[] }, tick = 0;
function corresponde(linha: R, where: R): boolean { return Object.entries(where).every(([k, v]) => k === "OR" ? (v as R[]).some(c => corresponde(linha, c)) : o(v).in ? (o(v).in as unknown[]).includes(linha[k]) : Object.hasOwn(o(v), "not") ? linha[k] !== o(v).not : linha[k] === v); }
function modelo(tipo: "clientes" | "pedidos" | "fontes" | "historicos" | "contatos") { return {
  findMany: vi.fn(async (a: R) => estado[tipo].filter(p => corresponde(p, o(a.where))).sort((a, b) => String(a.id).localeCompare(String(b.id))).map(p => a.select ? Object.fromEntries(Object.entries(o(a.select)).filter(([, v]) => v).map(([k]) => [k, p[k] ?? null])) : copiar(p))),
  findUnique: vi.fn(async (a: R) => { const where = o(a.where), p = estado[tipo].find(p => corresponde(p, o(where.origem_loja_entidade_chave ?? where))); return p ? copiar(p) : null; }),
  findUniqueOrThrow: vi.fn(async (a: R) => { const p = estado[tipo].find(p => corresponde(p, o(a.where))); if (!p) throw Error("ausente"); return copiar(p); }),
  updateMany: vi.fn(async (a: R) => { const p = estado[tipo].find(p => corresponde(p, o(a.where))); if (!p) return { count: 0 }; for (const [k, v] of Object.entries(o(a.data))) p[k] = o(v).increment ? Number(p[k]) + Number(o(v).increment) : String(v) === "Prisma.DbNull" ? null : copiar(v); p.updatedAt = `2026-10-19T00:00:${String(++tick).padStart(2, "0")}.000Z`; return { count: 1 }; }),
  create: vi.fn(async (a: R) => { const p = { id: `novo-${++tick}`, ...copiar(o(a.data)) }; estado[tipo].push(p); return copiar(p); }),
}; }
const tx = { clienteVenda: modelo("clientes"), pedidoVenda: modelo("pedidos"), identidadeExternaVenda: modelo("fontes"), historicoPedidoVenda: modelo("historicos"), contatoClienteVenda: modelo("contatos"), $queryRaw: vi.fn(async () => []), $executeRaw: vi.fn(async () => 0) };
const banco = { $transaction: vi.fn(async (operacao: (tx: unknown) => Promise<unknown>) => { const antes = copiar(estado); try { return await operacao(tx); } catch (e) { estado = antes; throw e; } }) } as unknown as Parameters<typeof prepararReconciliacao>[1];
beforeEach(() => { vi.clearAllMocks(); tick = 0; vi.stubEnv("CLIENTES_RECONCILIACAO_AUTORIZADA", "SIM"); estado = { clientes: [perfil()], pedidos: [fontePedido().dados], fontes: [], atividades: [], historicos: [], contatos: [] }; sim.atividade.mockImplementation(async (_tx, ator, evento) => { estado.atividades.push({ ator, evento }); }); sim.conferir.mockResolvedValue(undefined); });
afterEach(() => vi.unstubAllEnvs());
describe("transação auditada de reconciliação", () => {
  it("prévia não escreve; aplicação muda apenas cadastro e acrescenta registro técnico e atividade de sistema", async () => {
    const antes = copiar(estado), previa = await prepararReconciliacao(config(), banco); expect(estado).toEqual(antes);
    await aplicarReconciliacao(config(), previa.token, banco);
    expect(estado.pedidos).toEqual(antes.pedidos); expect(estado.fontes).toHaveLength(1);
    expect(estado.fontes[0]).toMatchObject({ origem: ORIGEM_RECONCILIACAO, destinoId: "raiz", versaoDestino: 4 });
    expect(estado.fontes[0].dadosOrigem).toMatchObject({ antes: [{ nome: antes.clientes[0].nome }], depois: [{ nome: "Fantasia sintética" }] });
    expect(estado.atividades[0]).toMatchObject({ ator: { tipo: "SISTEMA", referencia: config().atorSistema }, evento: { correlacaoId: config().operacaoId } });
    expect(JSON.stringify(estado.atividades)).not.toContain("example.invalid"); expect(JSON.stringify(estado.atividades)).not.toContain("Praça");
  });
  it("repetição exata é idempotente; mesma chave com outro conteúdo é rejeitada", async () => {
    const previa = await prepararReconciliacao(config(), banco); await aplicarReconciliacao(config(), previa.token, banco); const aplicado = copiar(estado);
    await expect(aplicarReconciliacao(config(), previa.token, banco)).resolves.toMatchObject({ jaAplicada: true }); expect(estado).toEqual(aplicado);
    await expect(aplicarReconciliacao({ ...config(), nomeCliente: "Diferente" }, previa.token, banco)).rejects.toThrow("RECONCILIACAO_OPERACAO_DIVERGENTE");
  });
  it("bloqueia ausência de autorização, prévia desatualizada e pedido acrescentado", async () => {
    const previa = await prepararReconciliacao(config(), banco); vi.stubEnv("CLIENTES_RECONCILIACAO_AUTORIZADA", "NAO");
    await expect(aplicarReconciliacao(config(), previa.token, banco)).rejects.toThrow("RECONCILIACAO_NAO_AUTORIZADA");
    vi.stubEnv("CLIENTES_RECONCILIACAO_AUTORIZADA", "SIM"); estado.pedidos.push(fontePedido("novo-pedido").dados);
    await expect(aplicarReconciliacao(config(), previa.token, banco)).rejects.toThrow("RECONCILIACAO_PREVIA_DIVERGENTE");
  });
  it("reverte toda escrita se auditoria falhar", async () => {
    const previa = await prepararReconciliacao(config(), banco), antes = copiar(estado); sim.atividade.mockRejectedValueOnce(Error("auditoria indisponível"));
    await expect(aplicarReconciliacao(config(), previa.token, banco)).rejects.toThrow("auditoria indisponível"); expect(estado).toEqual(antes);
  });
  it("reversão mantém versões crescentes, restaura somente campos alterados e conserva fonte e pedidos", async () => {
    const antes = copiar(estado), previa = await prepararReconciliacao(config(), banco); await aplicarReconciliacao(config(), previa.token, banco);
    const reversao = await prepararReversaoReconciliacao(config(), banco); await reverterReconciliacao(config(), reversao.token, banco);
    expect(estado.clientes[0]).toMatchObject({ ...antes.clientes[0], versao: 5, updatedAt: estado.clientes[0].updatedAt });
    expect(estado.pedidos).toEqual(antes.pedidos); expect(estado.fontes).toHaveLength(2); expect(estado.atividades).toHaveLength(2);
    const revertido = copiar(estado); await expect(reverterReconciliacao(config(), reversao.token, banco)).resolves.toMatchObject({ jaRevertida: true }); expect(estado).toEqual(revertido);
    await expect(aplicarReconciliacao(config(), previa.token, banco)).rejects.toThrow("RECONCILIACAO_OPERACAO_REVERTIDA");
  });
  it("reversão recusa qualquer edição posterior, inclusive em campo fora da correção", async () => {
    const previa = await prepararReconciliacao(config(), banco); await aplicarReconciliacao(config(), previa.token, banco); estado.clientes[0].telefone = "11900002222";
    await expect(prepararReversaoReconciliacao(config(), banco)).rejects.toThrow("RECONCILIACAO_REVERSAO_ESTADO_DIVERGENTE");
  });
  it("transfere e devolve reserva do alias na ordem segura sem alterar fontes externas", async () => {
    const raiz = perfil(), alias = perfil("alias", "raiz"), c = config(); raiz.documento = "22333444000199"; raiz.enderecos = [endereco("15", raiz.documento)]; estado.clientes = [raiz, alias];
    c.reservaPrincipal = { aliasId: alias.id, versao: 3, sha256: hashReconciliacao(alias), titularComprovado: endereco() };
    estado.fontes = [{ id: "fonte-original", origem: "legado", loja: "loja", entidade: "PEDIDO_HISTORICO", chave: "p1", destinoId: "pedido-1", resumoOrigem: "original", dadosOrigem: { nomeOriginal: "Preservar" }, versaoDestino: 1 }]; const fonteAntes = copiar(estado.fontes[0]);
    const previa = await prepararReconciliacao(c, banco); await aplicarReconciliacao(c, previa.token, banco);
    expect(estado.clientes.find(p => p.id === "alias")).toMatchObject({ documento: null, versao: 4, enderecos: [{ documento: c.principal.documento }] });
    const rev = await prepararReversaoReconciliacao(c, banco); await reverterReconciliacao(c, rev.token, banco);
    expect(estado.clientes.find(p => p.id === "alias")).toMatchObject({ documento: alias.documento, versao: 5 });
    expect(estado.clientes.find(p => p.id === "raiz")).toMatchObject({ documento: raiz.documento, versao: 5 }); expect(estado.fontes[0]).toEqual(fonteAntes);
  });
});
