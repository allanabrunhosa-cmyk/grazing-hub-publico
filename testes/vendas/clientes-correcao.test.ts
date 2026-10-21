import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashCanonico, identidadeComprador } from "@/lib/vendas/historico-dominio";
import { referenciaEmpresaHistorica } from "@/lib/vendas/clientes-correcao-dominio";
import { contexto, pacote, registro } from "./historico-importacao.fixture";

type R = Record<string, unknown>;
const sim = vi.hoisted(() => ({ transacao: vi.fn(), historico: vi.fn(), salvar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/vendas/historico-importacao", () => ({ transacaoHistorica: sim.transacao }));
vi.mock("@/lib/vendas/persistencia", () => ({ historico: sim.historico, salvarClienteNaTransacao: sim.salvar }));
import { prepararCorrecaoClientesHistoricos, executarCorrecaoClientesHistoricos, prepararReversaoClientesHistoricos, reverterCorrecaoClientesHistoricos } from "@/lib/vendas/clientes-correcao";

let estado: Record<string, R[]>, contador: number;
const copiar = <T,>(v: T): T => structuredClone(v);
const objeto = (v: unknown): R => v && typeof v === "object" && !Array.isArray(v) ? v as R : {};
function corresponde(linha: R, where: R): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR") return (v as R[]).some(c => corresponde(linha, c));
    const o = objeto(v);
    return o.in ? (o.in as unknown[]).includes(linha[k]) : o.notIn ? !(o.notIn as unknown[]).includes(linha[k]) : linha[k] === v;
  });
}
function projetar(linha: R, select: unknown) { return !select ? copiar(linha) : Object.fromEntries(Object.entries(objeto(select)).filter(([,v]) => v === true).map(([k]) => [k, copiar(linha[k])])); }
function modelo(tabela: string) {
  const buscar = (a: R = {}) => estado[tabela].filter(l => corresponde(l, objeto(a.where)));
  return {
    findMany: vi.fn(async (a: R = {}) => buscar(a).map(l => projetar(l, a.select))),
    findUnique: vi.fn(async (a: R) => buscar(a)[0] ? projetar(buscar(a)[0], a.select) : null),
    findUniqueOrThrow: vi.fn(async (a: R) => { if (!buscar(a)[0]) throw Error("fixture ausente"); return projetar(buscar(a)[0], a.select); }),
    create: vi.fn(async (a: R) => { const linha = { id: `novo-${++contador}`, versao: 1, ativo: true, createdAt: new Date("2026-10-15T00:00:00Z"), updatedAt: new Date("2026-10-15T00:00:00Z"), ...objeto(a.data) }; estado[tabela].push(linha); return copiar(linha); }),
    updateMany: vi.fn(async (a: R) => { const linhas = buscar(a); for (const l of linhas) { for (const [k,v] of Object.entries(objeto(a.data))) l[k] = objeto(v).increment ? Number(l[k]) + Number(objeto(v).increment) : copiar(v); l.updatedAt = new Date(`2026-10-15T00:00:${String(++contador).padStart(2,"0")}Z`); } return { count: linhas.length }; }),
    groupBy: vi.fn(async () => []),
  };
}
const tx = { clienteVenda: modelo("clientes"), contatoClienteVenda: modelo("contatos"), pedidoVenda: modelo("pedidos"), identidadeExternaVenda: modelo("fontes"), historicoCadastroVenda: modelo("auditorias"), atividadeUsuario: modelo("atividades"), creditoClienteMovimento: modelo("creditos"), historicoPedidoVenda: modelo("eventos"),
  $queryRaw: vi.fn(async () => estado.fontes.filter(f => f.entidade === "PEDIDO_HISTORICO").map(f => ({ ...f, ...objeto(f.projecao) }))), };
function dadosCliente(id: string, nome: string) { return { id, nome, primeiroNome: "PESSOA", sobrenome: "SINTÉTICA", tipo: "PF", documento: null, razaoSocial: null, email: "pessoa@example.invalid", telefone: "11900001234", contato: null, nomeContato: null, sobrenomeContato: null, ativo: true, versao: 1, unificadoEmId: null, createdAt: new Date("2026-10-15T00:00:00Z"), updatedAt: new Date("2026-10-15T00:00:00Z") }; }
function montar({ manual = false, parcial = false, semCompany = false, duasEmpresas = false } = {}) {
  const r = registro("10001", { nome: "PESSOA SINTÉTICA", email: semCompany ? "pessoa@empresa.example.invalid" : "pessoa@example.invalid" });
  r.comprador.empresa = r.raw.valores[3] = semCompany ? null : "EMPRESA ALFA SINTÉTICA"; r.hash_linha = hashCanonico(r.raw.valores);
  const registros = [r];
  if (parcial) registros.push(registro("10002", { nome: "PESSOA SINTÉTICA", email: "pessoa@example.invalid" }));
  if (duasEmpresas) {
    const outro = registro("10002", { nome: "PESSOA SINTÉTICA", email: "pessoa@example.invalid" });
    outro.comprador.empresa = outro.raw.valores[3] = "EMPRESA BETA SINTÉTICA"; outro.hash_linha = hashCanonico(outro.raw.valores);
    registros.push(outro);
  }
  const chave = identidadeComprador(r).chave, cliente = dadosCliente("cliente-origem", r.comprador.nome_cobranca!);
  estado.clientes.push(cliente);
  estado.auditorias.push({ id: "audit-criacao", entidade: "CLIENTE", registroId: cliente.id, antes: null, depois: JSON.parse(JSON.stringify(cliente)) });
  estado.atividades.push({ fonteTabela: "HistoricoCadastroVenda", fonteId: "audit-criacao", origem: manual ? "INTERFACE" : "AUTOMACAO", correlacaoId: "lote-original-sintetico" });
  estado.fontes.push({ id: "fonte-cliente", origem: "grazing-legado-orders", loja: "grazing-hub", entidade: "CLIENTE_HISTORICO", chave, destinoId: cliente.id, resumoOrigem: "hash-cliente", versaoDestino: 1 });
  for (const f of registros) {
    estado.pedidos.push({ id: `pedido-${f.numero_original}`, clienteId: cliente.id, versao: 1, status: "HISTORICO", origem: "HISTORICO_LEGADO", referenciaOrigem: "grazing-legado-orders", referenciaEstabelecimento: "grazing-hub", referenciaPedido: f.numero_original });
    estado.fontes.push({ id: `fonte-${f.numero_original}`, origem: "grazing-legado-orders", loja: "grazing-hub", entidade: "PEDIDO_HISTORICO", chave: f.numero_original, destinoId: `pedido-${f.numero_original}`, resumoOrigem: f.hash_linha, versaoDestino: 1, projecao: { loteId: "lote-original-sintetico", hashLinha: f.hash_linha, rawValores: f.raw.valores } });
  }
  const ref = referenciaEmpresaHistorica(r.comprador.empresa ?? "EMPRESA ALFA SINTÉTICA");
  const manifesto = { versao: 1, loteHistoricoId: "lote-original-sintetico", inventarioSha256: "a".repeat(64), empresas: [{ companyRef: ref, decisao: "PJ_CNPJ_COMPROVADO", cnpj: "11222333000181", razaoSocial: "Empresa Alfa Sintética", nomeFantasia: null, dominiosCorporativos: semCompany ? ["empresa.example.invalid"] : [], motivoPendente: null,
    provas: [{ url: "https://registro.example.invalid/empresa", consultadoEm: "2026-10-15T00:00:00Z", arquivo: "empresa.json", arquivoSha256: "b".repeat(64), papel: "REGISTRO_CNPJ", cnpjObservado: "11222333000181", nomeEmpresarialObservado: "Empresa Alfa Sintética", dominioObservado: semCompany ? "empresa.example.invalid" : null }] }], vinculos: [{ chaveClienteHistorico: chave, companyRef: ref, numerosOriginais: [r.numero_original], regra: semCompany ? "DOMINIO_TITULAR_UNICO" : "COMPANY_EXATA" }] };
  return { ...contexto, loteId: "correcao-sintetica-1", pacote: pacote(registros), manifesto };
}
beforeEach(() => {
  vi.stubEnv("CLIENTES_CORRECAO_AUTORIZADA", "SIM");
  vi.clearAllMocks(); contador = 0; estado = Object.fromEntries(["clientes","contatos","pedidos","fontes","auditorias","atividades","creditos","eventos"].map(k => [k,[]]));
  sim.transacao.mockImplementation(async (_entrada, operacao, leitura = false) => {
    const antes = copiar(estado);
    try { const r = await operacao(tx, { userId: "admin-sintetico", nome: "Admin sintético" }); if (leitura && hashCanonico(JSON.parse(JSON.stringify(antes))) !== hashCanonico(JSON.parse(JSON.stringify(estado)))) throw Error("prévia escreveu"); return { ...r, preservacao: leitura ? null : { iguais: true } }; }
    catch (e) { estado = antes; throw e; }
  });
  sim.historico.mockImplementation(async (_tx, _autor, entidade, registroId, antes, depois) => { estado.auditorias.push({ id: `audit-${++contador}`, entidade, registroId, antes: antes === null ? null : JSON.parse(JSON.stringify(antes)), depois: JSON.parse(JSON.stringify(depois)) }); });
  sim.salvar.mockImplementation(async (_tx, entrada, autor) => { const c = { ...dadosCliente(`canonico-${++contador}`, entrada.nome), ...entrada }; const novo = await tx.clienteVenda.create({ data: { ...c, id: `canonico-${contador}`, versao: 1 } }); await sim.historico(tx, autor, "CLIENTE", novo.id, null, novo); return novo.id; });
});
afterEach(() => vi.unstubAllEnvs());
describe("correção cadastral histórica sem efeitos operacionais", () => {
  it("serviço bloqueia escrita sem autorização de processo, antes da transação", async () => {
    const e = montar(); vi.stubEnv("CLIENTES_CORRECAO_AUTORIZADA", "NAO");
    await expect(executarCorrecaoClientesHistoricos({ ...e, tokenPrevia: "x" })).rejects.toThrow("CORRECAO_NAO_AUTORIZADA");
    await expect(reverterCorrecaoClientesHistoricos({ ...e, tokenPrevia: "x" })).rejects.toThrow("CORRECAO_NAO_AUTORIZADA");
    expect(sim.transacao).not.toHaveBeenCalled();
  });
  it("prévia não escreve e normaliza somente nomes automáticos", async () => {
    const e = montar(), antes = copiar(estado), p = await prepararCorrecaoClientesHistoricos(e);
    expect(estado).toEqual(antes); expect(p.linhas[0]).toMatchObject({ primeiroNome: "Pessoa", sobrenome: "Sintética", aliasSeguro: true, natureza: "PJ" });
    expect(p.contagens.canonicosNovos).toBe(1); expect(sim.transacao.mock.calls[0][2]).toBe(true);
  });
  it("normaliza o nome automático de PJ reconhecida pelo domínio sem Company", async () => {
    const e = montar({ semCompany: true }), p = await prepararCorrecaoClientesHistoricos(e);
    expect(p.linhas[0]).toMatchObject({ natureza: "PJ", companyRefs: [], modificavel: true, dados: { nome: "Pessoa Sintética", primeiroNome: "Pessoa", sobrenome: "Sintética" } });
    await executarCorrecaoClientesHistoricos({ ...e, tokenPrevia: p.token });
    expect(estado.clientes[0]).toMatchObject({ nome: "Pessoa Sintética", primeiroNome: "Pessoa", sobrenome: "Sintética" });
    expect(estado.contatos[0]).toMatchObject({ nome: "Pessoa Sintética", primeiroNome: "Pessoa", sobrenome: "Sintética" });
  });
  it("normaliza o nome automático com Company múltipla sem fundir empresas", async () => {
    const e = montar({ duasEmpresas: true }), p = await prepararCorrecaoClientesHistoricos(e);
    expect(p.linhas[0]).toMatchObject({ natureza: "PJ", canonico: null, aliasSeguro: false, dados: { nome: "Pessoa Sintética" } });
    expect(p.linhas[0].pendencias).toContain("MULTIPLAS_EMPRESAS_NO_COMPRADOR");
    await executarCorrecaoClientesHistoricos({ ...e, tokenPrevia: p.token });
    expect(estado.clientes[0]).toMatchObject({ nome: "Pessoa Sintética", tipo: "PJ", unificadoEmId: null });
    expect(estado.pedidos.every(pedido => pedido.clienteId === "cliente-origem")).toBe(true);
    expect(sim.salvar).not.toHaveBeenCalled();
  });
  it("preserva a grafia humana de PJ reconhecida pelo domínio sem Company", async () => {
    const e = montar({ semCompany: true, manual: true }), p = await prepararCorrecaoClientesHistoricos(e);
    expect(p.linhas[0]).toMatchObject({ natureza: "PJ", modificavel: false, nomePessoal: "PESSOA SINTÉTICA" });
    expect(p.linhas[0].dados).not.toHaveProperty("nome");
    await executarCorrecaoClientesHistoricos({ ...e, tokenPrevia: p.token });
    expect(estado.clientes[0]).toMatchObject({ nome: "PESSOA SINTÉTICA", primeiroNome: "PESSOA", sobrenome: "SINTÉTICA" });
    expect(estado.contatos[0]).toMatchObject({ nome: "PESSOA SINTÉTICA", primeiroNome: "PESSOA", sobrenome: "SINTÉTICA" });
  });
  it("token fica obsoleto se uma revisão cadastral mudar", async () => {
    const e = montar(), p = await prepararCorrecaoClientesHistoricos(e); estado.clientes[0].versao = 2;
    await expect(executarCorrecaoClientesHistoricos({ ...e, tokenPrevia: p.token })).rejects.toThrow("CORRECAO_PREVIA_DESATUALIZADA");
    expect(estado.contatos).toHaveLength(0); expect(estado.pedidos[0].clienteId).toBe("cliente-origem");
  });
  it("cria empresa/contato, religa só referência cadastral e reexecução não escreve", async () => {
    const e = montar(), raw = copiar(estado.fontes[1].projecao), p = await prepararCorrecaoClientesHistoricos(e);
    const r = await executarCorrecaoClientesHistoricos({ ...e, tokenPrevia: p.token });
    expect(r).toMatchObject({ contatosCriados: 1, pedidosReligados: 1, preservacao: { iguais: true } });
    expect(estado.clientes[0]).toMatchObject({ ativo: false, unificadoEmId: estado.pedidos[0].clienteId, primeiroNome: "Pessoa", sobrenome: "Sintética" });
    expect(estado.contatos[0]).toMatchObject({ clienteOrigemId: "cliente-origem", primeiroNome: "Pessoa", sobrenome: "Sintética", ativo: true });
    expect(estado.fontes[1].projecao).toEqual(raw); const antes = copiar(estado);
    expect(await executarCorrecaoClientesHistoricos({ ...e, tokenPrevia: p.token })).toMatchObject({ aplicados: 0, mantidos: 1 });
    expect(estado).toEqual(antes);
  });
  it("pedido sem Company do mesmo comprador permanece na origem, sem marcar alias", async () => {
    const e = montar({ parcial: true }), p = await prepararCorrecaoClientesHistoricos(e);
    expect(p.linhas[0]).toMatchObject({ aliasSeguro: false, numerosVinculados: ["10001"] });
    await executarCorrecaoClientesHistoricos({ ...e, tokenPrevia: p.token });
    expect(estado.pedidos[1].clienteId).toBe("cliente-origem"); expect(estado.clientes[0].unificadoEmId).toBeNull();
  });
  it("conserva nomes manuais e não atribui CNPJ ao cliente de origem", async () => {
    const e = montar({ manual: true }), p = await prepararCorrecaoClientesHistoricos(e);
    expect(p.linhas[0]).toMatchObject({ modificavel: false, nomePessoal: "PESSOA SINTÉTICA", primeiroNome: "PESSOA" });
    await executarCorrecaoClientesHistoricos({ ...e, tokenPrevia: p.token });
    expect(estado.clientes[0]).toMatchObject({ nome: "PESSOA SINTÉTICA", primeiroNome: "PESSOA", documento: null });
  });
  it("não usa documento de outra holding mesmo com manifesto válido", async () => {
    const e = montar(); e.manifesto.empresas[0].razaoSocial = e.manifesto.empresas[0].provas[0].nomeEmpresarialObservado = "Empresa Holding Sintética";
    const p = await prepararCorrecaoClientesHistoricos(e);
    expect(p.linhas[0].canonico).toBeNull(); expect(p.linhas[0].pendencias).toContain("CNPJ_SEM_CORROBORACAO_COMPANY");
  });
  it("reverte com versões crescentes, inativa cadastros novos e preserva snapshots", async () => {
    const e = montar(), raw = copiar(estado.fontes[1].projecao), p = await prepararCorrecaoClientesHistoricos(e);
    await executarCorrecaoClientesHistoricos({ ...e, tokenPrevia: p.token });
    const previa = await prepararReversaoClientesHistoricos(e);
    expect(await reverterCorrecaoClientesHistoricos({ ...e, tokenPrevia: previa.token })).toMatchObject({ pedidosRestaurados: 1, contatosInativados: 1 });
    expect(estado.pedidos[0]).toMatchObject({ clienteId: "cliente-origem", versao: 3 }); expect(estado.fontes[1].versaoDestino).toBe(3);
    expect(estado.contatos[0].ativo).toBe(false); expect(estado.clientes[0]).toMatchObject({ nome: "PESSOA SINTÉTICA", ativo: true, unificadoEmId: null, versao: 3 });
    expect(estado.fontes[1].projecao).toEqual(raw); const antes = copiar(estado);
    expect(await reverterCorrecaoClientesHistoricos({ ...e, tokenPrevia: previa.token })).toMatchObject({ revertidos: 0 }); expect(estado).toEqual(antes);
    const nova = await prepararReversaoClientesHistoricos(e);
    expect(await reverterCorrecaoClientesHistoricos({ ...e, tokenPrevia: nova.token })).toMatchObject({ revertidos: 0 }); expect(estado).toEqual(antes);
  });
  it("reversão inteira para se contato tiver edição posterior", async () => {
    const e = montar(), p = await prepararCorrecaoClientesHistoricos(e); await executarCorrecaoClientesHistoricos({ ...e, tokenPrevia: p.token });
    estado.contatos[0].versao = 2;
    await expect(prepararReversaoClientesHistoricos(e)).rejects.toThrow("CORRECAO_REVERSAO_CONTATO_ALTERADO");
    expect(estado.pedidos[0].versao).toBe(2);
  });
  it("não sobrescreve empresa de CNPJ já existente nem seu contato primário", async () => {
    const e = montar(), atual = { ...dadosCliente("empresa-preexistente", "GRAFIA HUMANA PRESERVADA"), tipo: "PJ", documento: "11222333000181", razaoSocial: "RAZAO HUMANA", contato: "CONTATO HUMANO" };
    estado.clientes.push(atual); const p = await prepararCorrecaoClientesHistoricos(e);
    await executarCorrecaoClientesHistoricos({ ...e, tokenPrevia: p.token });
    expect(estado.clientes.find(c => c.id === atual.id)).toEqual(atual); expect(sim.salvar).not.toHaveBeenCalled();
    expect(estado.pedidos[0].clienteId).toBe(atual.id);
  });
  it("preserva canônico inativo e mantém origem separada sem relink ou reativação", async () => {
    const e = montar(), atual = { ...dadosCliente("empresa-inativa", "ESTADO HUMANO PRESERVADO"), tipo: "PJ", documento: "11222333000181", ativo: false };
    estado.clientes.push(atual); const p = await prepararCorrecaoClientesHistoricos(e);
    expect(p.linhas[0].canonico).toBeNull(); expect(p.linhas[0].pendencias).toContain("CANONICO_INATIVO_PRESERVADO");
    await executarCorrecaoClientesHistoricos({ ...e, tokenPrevia: p.token });
    expect(estado.clientes.find(c => c.id === atual.id)).toEqual(atual); expect(estado.clientes[0]).toMatchObject({ tipo: "PJ", ativo: true, unificadoEmId: null, documento: null });
    expect(estado.pedidos[0].clienteId).toBe("cliente-origem"); expect(sim.salvar).not.toHaveBeenCalled();
  });
  it("canônico novo usado por pedido alheio permanece ativo durante a reversão", async () => {
    const e = montar(), p = await prepararCorrecaoClientesHistoricos(e); await executarCorrecaoClientesHistoricos({ ...e, tokenPrevia: p.token });
    const canonico = estado.pedidos[0].clienteId; estado.pedidos.push({ id: "pedido-legitimo-externo-ao-lote", clienteId: canonico, versao: 1, status: "RASCUNHO" });
    const r = await prepararReversaoClientesHistoricos(e); expect(r.contagens.canonicosCompartilhados).toBe(1);
    expect(await reverterCorrecaoClientesHistoricos({ ...e, tokenPrevia: r.token })).toMatchObject({ canonicosCompartilhadosPreservados: 1 });
    expect(estado.clientes.find(c => c.id === canonico)?.ativo).toBe(true); expect(estado.pedidos[1].clienteId).toBe(canonico);
  });
});
