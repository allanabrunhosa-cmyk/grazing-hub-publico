import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { hashCanonico, identidadeComprador, validarPacoteHistorico, type RegistroHistorico } from "@/lib/vendas/historico-dominio";

const sim = vi.hoisted(() => ({ transaction: vi.fn(), salvarCliente: vi.fn(), historico: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (...args: unknown[]) => sim.transaction(...args) } }));
vi.mock("@/lib/vendas/persistencia", () => ({ salvarClienteNaTransacao: (...args: unknown[]) => sim.salvarCliente(...args), historico: (...args: unknown[]) => sim.historico(...args) }));
import { executarImportacaoHistorica, prepararImportacaoHistorica, reverterImportacaoHistorica } from "@/lib/vendas/historico-importacao";

import { contexto, pacote, registro } from "./historico-importacao.fixture";
import { fixtureComplementoHistorico, rehashComplementoSintetico } from "./historico-complemento.fixture";
import { validarComplementoRegistro } from "@/lib/vendas/historico-complemento";

type Linha = Record<string, unknown>;
type Estado = { produtos: Linha[]; clientes: Linha[]; pedidos: Linha[]; itens: Linha[]; fontes: Linha[]; eventos: Linha[] };
let estado: Estado, administrador: boolean, sessaoVersao: number, trava: boolean, sequencia: number;
const id = () => `id-${++sequencia}`;
function produto(nome = "Produto sintético", extra: Linha = {}): Linha { return { id: id(), nome, unidade: "UN", tipo: "PADRAO", ativo: false, versao: 1, componentes: [], _count: { grupos: 0 }, ...extra }; }
function anexarItens(pedido: Linha) { return { ...pedido, itens: estado.itens.filter(i => i.pedidoId === pedido.id && i.vigente) }; }
function alterar(lista: Linha[], where: Linha, data: Linha) {
  const indice = lista.findIndex(l => Object.entries(where).every(([k, v]) => l[k] === v));
  if (indice < 0) throw Error("Conflito de versão sintético");
  return lista[indice] = { ...lista[indice], ...data, updatedAt: new Date() };
}
const tx = {
  $queryRaw: vi.fn(async (sql: TemplateStringsArray | Prisma.Sql) => {
    const texto = Array.isArray(sql) ? sql.join("") : (sql as Prisma.Sql).sql;
    if (texto.includes("pg_try")) return [{ obtida: trava }];
    if (texto.includes("string_agg")) return [{ quantidade: "0", digest: "0".repeat(32) }];
    return [];
  }),
  $executeRaw: vi.fn<(sql: TemplateStringsArray) => Promise<number>>().mockResolvedValue(0),
  usuario: { findUnique: vi.fn(async () => ({ id: "admin-real", nome: "Administrador atual", ativo: true, excluidoEm: null, senhaDefinida: true, sessaoVersao, perfilAcesso: { sistema: administrador ? "ADMINISTRADOR" : "USUARIO" } })) },
  produtoVenda: { findMany: vi.fn(async () => estado.produtos), create: vi.fn(async ({ data }: { data: Linha }) => { const novo = produto(String(data.nome), data); estado.produtos.push(novo); return novo; }) },
  clienteVenda: { findMany: vi.fn(async () => estado.clientes), findUnique: vi.fn(async ({ where }: { where: Linha }) => estado.clientes.find(c => c.id === where.id) ?? null), findUniqueOrThrow: vi.fn(async ({ where }: { where: Linha }) => { const cliente = estado.clientes.find(c => c.id === where.id); if (!cliente) throw Error("Cliente ausente"); return cliente; }) },
  pedidoVenda: {
    findMany: vi.fn(async () => estado.pedidos.map(anexarItens)),
    findUnique: vi.fn(async ({ where }: { where: Linha }) => { const pedido = estado.pedidos.find(p => p.id === where.id); return pedido ? anexarItens(pedido) : null; }),
    create: vi.fn(async ({ data }: { data: Linha }) => { const novo = { versao: 1, createdAt: new Date(), updatedAt: new Date(), ...data }; estado.pedidos.push(novo); return novo; }),
    update: vi.fn(async ({ where, data }: { where: Linha; data: Linha }) => alterar(estado.pedidos, where, data)),
  },
  itemPedidoVenda: {
    updateMany: vi.fn(async ({ where, data }: { where: Linha; data: Linha }) => { estado.itens = estado.itens.map(i => Object.entries(where).every(([k, v]) => i[k] === v) ? { ...i, ...data } : i); return { count: 1 }; }),
    create: vi.fn(async ({ data }: { data: Linha }) => { const novo = { id: id(), ...data }; estado.itens.push(novo); return novo; }),
  },
  identidadeExternaVenda: {
    findMany: vi.fn(async () => estado.fontes),
    findFirst: vi.fn(async ({ where }: { where: Linha }) => estado.fontes.find(f => Object.entries(where).every(([k, v]) => f[k] === v)) ?? null),
    update: vi.fn(async ({ where, data }: { where: Linha; data: Linha }) => alterar(estado.fontes, where, data)),
    upsert: vi.fn(async ({ where, create, update }: { where: { origem_loja_entidade_chave: Linha }; create: Linha; update: Linha }) => {
      const atual = estado.fontes.find(f => Object.entries(where.origem_loja_entidade_chave).every(([k, v]) => f[k] === v));
      if (atual) return alterar(estado.fontes, { id: atual.id }, update);
      const novo = { id: id(), createdAt: new Date(), updatedAt: new Date(), ...create }; estado.fontes.push(novo); return novo;
    }),
  },
  historicoPedidoVenda: {
    create: vi.fn(async ({ data }: { data: Linha }) => { const novo = { id: id(), createdAt: new Date(Date.now() + sequencia), ...data }; estado.eventos.push(novo); return novo; }),
    findUnique: vi.fn(async ({ where }: { where: Linha }) => estado.eventos.find(e => e.chaveOperacao === where.chaveOperacao) ?? null),
    findMany: vi.fn(async ({ where }: { where: { depois: { equals: string } } }) => estado.eventos.filter(e => ["HISTORICO_IMPORTADO", "HISTORICO_ATUALIZADO"].includes(String(e.tipo)) && (e.depois as Linha).loteId === where.depois.equals).slice().reverse()),
  },
  lancamentoFinanceiro: { create: vi.fn() }, movimentacaoEstoque: { create: vi.fn() }, saldoEstoque: { update: vi.fn() }, reservaPedido: { create: vi.fn() }, documentoFiscalSaida: { create: vi.fn() },
};
async function importar(p = pacote(), loteId = contexto.loteId) { const previa = await prepararImportacaoHistorica({ ...contexto, loteId, pacote: p }); return executarImportacaoHistorica({ ...contexto, loteId, pacote: p, tokenPrevia: previa.token }); }
beforeEach(() => {
  vi.clearAllMocks(); estado = { produtos: [], clientes: [], pedidos: [], itens: [], fontes: [], eventos: [] }; administrador = true; sessaoVersao = 7; trava = true; sequencia = 0;
  sim.salvarCliente.mockImplementation(async (_tx, entrada: Linha) => { const cliente = { ...entrada, id: id(), versao: 1 }; estado.clientes.push(cliente); return cliente.id; });
  sim.transaction.mockImplementation(async (executar: (client: unknown) => Promise<unknown>) => { const antes = Object.fromEntries(Object.entries(estado).map(([k, v]) => [k, [...v]])) as Estado; try { return await executar(tx); } catch (erro) { estado = antes; throw erro; } });
});

describe("serviço de importação histórica segregada", () => {
  it("prévia começa somente leitura, dispensa bloqueio de linha e não grava dados", async () => {
    const antes = structuredClone(estado), previa = await prepararImportacaoHistorica({ ...contexto, pacote: pacote() });
    const comandos = tx.$executeRaw.mock.calls.map(([sql]) => sql.join("")), consultas = tx.$queryRaw.mock.calls.map(([sql]) => Array.isArray(sql) ? sql.join("") : (sql as Prisma.Sql).sql);
    expect(comandos[0]).toBe("SET TRANSACTION READ ONLY");expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.$queryRaw.mock.invocationCallOrder[0]);
    expect(consultas.some(sql=>sql.includes("FOR UPDATE"))).toBe(false);expect(tx.usuario.findUnique).toHaveBeenCalledOnce();
    expect(previa).toMatchObject({ contagens: { novos: 1 }, preservacao: null });expect(estado).toEqual(antes);
    expect(sim.salvarCliente).not.toHaveBeenCalled();expect(sim.historico).not.toHaveBeenCalled();expect(tx.pedidoVenda.create).not.toHaveBeenCalled();expect(tx.produtoVenda.create).not.toHaveBeenCalled();expect(tx.identidadeExternaVenda.upsert).not.toHaveBeenCalled();expect(tx.historicoPedidoVenda.create).not.toHaveBeenCalled();
    vi.clearAllMocks();await executarImportacaoHistorica({...contexto,pacote:pacote(),tokenPrevia:previa.token});
    expect(tx.$queryRaw.mock.calls.some(([sql])=>(Array.isArray(sql)?sql.join(""):(sql as Prisma.Sql).sql).includes("FOR UPDATE"))).toBe(true);expect(tx.$executeRaw.mock.calls.some(([sql])=>sql.join("") === "SET TRANSACTION READ ONLY")).toBe(false);
  });
  it("exige comprovantes e relê administrador, atividade e versão real na transação", async () => {
    await expect(prepararImportacaoHistorica({ ...contexto, guardas: { ...contexto.guardas, baselineSha256: "" }, pacote: pacote() })).rejects.toThrow("Comprove backup");
    administrador = false; await expect(importar()).rejects.toThrow("administrador"); administrador = true;
    sessaoVersao = 8; await expect(importar()).rejects.toThrow("sessão"); expect(estado.pedidos).toHaveLength(0);
    expect(tx.$executeRaw.mock.calls.some(([sql]) => sql.join("").includes("gestao-acessos"))).toBe(true);
  });
  it("rejeita importador concorrente antes de qualquer escrita", async () => { trava = false; await expect(importar()).rejects.toThrow("em execução"); expect(tx.pedidoVenda.create).not.toHaveBeenCalled(); });
  it("invalida prévia quando catálogo ou clientes mudam", async () => {
    estado.produtos.push(produto()); const p = pacote(), previa = await prepararImportacaoHistorica({ ...contexto, pacote: p }); estado.produtos[0] = { ...estado.produtos[0], versao: 2 };
    await expect(executarImportacaoHistorica({ ...contexto, pacote: p, tokenPrevia: previa.token })).rejects.toThrow("mudaram depois"); expect(estado.pedidos).toHaveLength(0);
  });
  it("grava histórico com número negativo, data original e sem efeitos de setembro", async () => {
    await importar(pacote([registro("10001", { setembro: true })]));
    expect(estado.pedidos[0]).toMatchObject({ numero: -10001, status: "HISTORICO", statusOperacional: "HISTORICO", modoFinanceiro: "EXTERNO", confirmadoEm: null, entregueEm: null, origem: "HISTORICO_LEGADO" });
    expect((estado.pedidos[0].createdAt as Date).toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(estado.itens[0]).toMatchObject({ quantidade: "2", precoAplicado: "45", desconto: "0", totalLinha: "90" });
    const fonte = estado.fontes.find(f => f.entidade === "PEDIDO_HISTORICO")!, dados = fonte.dadosOrigem as { hub: { consumo: Linha[]; pagamento: Linha } };
    expect(dados.hub.consumo[0].estado).toBe("NAO_REAPLICADO_SETEMBRO"); expect(dados.hub.pagamento).toMatchObject({ mes: "2026-09", base: "PAGAMENTO_INFORMADO", operacional: false });
    for (const modelo of [tx.lancamentoFinanceiro, tx.movimentacaoEstoque, tx.reservaPedido, tx.documentoFiscalSaida]) expect(modelo.create).not.toHaveBeenCalled(); expect(tx.saldoEstoque.update).not.toHaveBeenCalled();
  });
  it("preserva frete negativo, zero e desconto de linha sem descontar duas vezes", async () => {
    await importar(pacote([registro("10001", { frete: "-90", total: "0" })]));
    expect(estado.pedidos[0]).toMatchObject({ subtotal: "100.00", desconto: "10.00", frete: "0.00", outrosCustos: "-90.00", total: "0.00" });
    expect(estado.itens[0]).toMatchObject({ desconto: "0", totalLinha: "90" });
  });
  it("mesmo lote ou novo hash de arquivo não duplica pedidos, clientes ou itens", async () => {
    const p = pacote(), previa = await prepararImportacaoHistorica({ ...contexto, pacote: p });
    await executarImportacaoHistorica({ ...contexto, pacote: p, tokenPrevia: previa.token }); p.metadados.sha256 = "2".repeat(64);
    const segundo = await executarImportacaoHistorica({ ...contexto, pacote: p, tokenPrevia: previa.token });
    expect(segundo).toMatchObject({ aplicados: 0, manter: 1 }); expect(estado.pedidos).toHaveLength(1); expect(estado.itens).toHaveLength(1); expect(estado.clientes).toHaveLength(1);
  });
  it("versão corrigida atualiza só linha alterada e preserva revisões locais", async () => {
    const p = pacote([registro(), registro("10002", { nome: "Outra pessoa", email: "outra@example.invalid" })]); await importar(p);
    p.registros[0].notas_originais = p.registros[0].raw.valores[54] = "Nota corrigida"; p.registros[0].hash_linha = hashCanonico(p.registros[0].raw.valores);
    const resultado = await importar(p, "lote-sintetico-2"); expect(resultado).toMatchObject({ atualizar: 1, manter: 1, aplicados: 1 }); expect(estado.pedidos).toHaveLength(2); expect(estado.itens.filter(i => i.vigente)).toHaveLength(2);
    estado.pedidos[0] = { ...estado.pedidos[0], versao: 99 }; p.registros[0].notas_originais = p.registros[0].raw.valores[54] = "Outra correção"; p.registros[0].hash_linha = hashCanonico(p.registros[0].raw.valores);
    expect(await importar(p, "lote-sintetico-3")).toMatchObject({ conflitos: 1, aplicados: 0 }); expect(estado.pedidos[0].versao).toBe(99);
  });
  it("reutiliza cadastro corroborado sem alterar dados atuais ou atividade", async () => {
    estado.clientes.push({ id: "cliente-atual", nome: "Pessoa sintética", email: "pessoa@example.invalid", telefone: null, versao: 8, ativo: false, observacoes: "Informação atual" });
    await importar(); expect(sim.salvarCliente).not.toHaveBeenCalled(); expect(estado.pedidos[0].clienteId).toBe("cliente-atual"); expect(estado.clientes[0]).toMatchObject({ versao: 8, ativo: false, observacoes: "Informação atual" });
  });
  it("reutiliza e-mail normalizado antes de comparar o nome, inclusive canônico inativo", async () => {
    const cliente = { id: "cliente-email", nome: "Nome Atual Diferente", email: " PESSOA@EXAMPLE.INVALID ", telefone: null, versao: 8, ativo: false, unificadoEmId: null, observacoes: "Perfil atual preservado" };
    estado.clientes.push(cliente);
    const resultado = await importar();
    expect(resultado).toMatchObject({ clientesCriados: 0, clientesReutilizados: 1 });
    expect(sim.salvarCliente).not.toHaveBeenCalled();
    expect(estado.pedidos[0].clienteId).toBe(cliente.id);
    expect(estado.clientes[0]).toEqual(cliente);
    expect(estado.pedidos[0].compradorSnapshot).toMatchObject({ nome: "Pessoa sintética" });
  });
  it("nomes e chaves distintos com mesmo e-mail criam um perfil e preservam as fontes individuais", async () => {
    const p = validarPacoteHistorico(pacote([registro("10001", { nome: "Primeira Pessoa" }), registro("10002", { nome: "Outra Pessoa" })]));
    const chaves = p.registros.map(r => identidadeComprador(r).chave);
    expect(new Set(chaves).size).toBe(2);
    const resultado = await importar(p);
    expect(resultado).toMatchObject({ clientesCriados: 1, clientesReutilizados: 1 });
    expect(sim.salvarCliente).toHaveBeenCalledTimes(1);
    expect(sim.salvarCliente.mock.calls[0][3]).toBe("LEGADO");
    expect(estado.clientes).toHaveLength(1);
    expect(estado.clientes[0]).toMatchObject({ nome: "Primeira Pessoa", email: "pessoa@example.invalid" });
    expect(new Set(estado.pedidos.map(pedido => pedido.clienteId)).size).toBe(1);
    expect(estado.pedidos.map(pedido => (pedido.compradorSnapshot as Linha).nome)).toEqual(["Primeira Pessoa", "Outra Pessoa"]);
    const fontes = estado.fontes.filter(fonte => fonte.entidade === "CLIENTE_HISTORICO");
    expect(fontes.map(fonte => fonte.chave)).toEqual(chaves);
    expect(new Set(fontes.map(fonte => fonte.destinoId)).size).toBe(1);
    expect(fontes.map(fonte => fonte.resumoOrigem)).toEqual(p.registros.map(r => hashCanonico(identidadeComprador(r))));
  });
  it("a prévia usa vínculo comprovado posterior no lote para todos os nomes com o mesmo e-mail", async () => {
    const p = validarPacoteHistorico(pacote([registro("10001", { nome: "Primeira Pessoa" }), registro("10002", { nome: "Outra Pessoa" })]));
    estado.clientes.push({ id: "raiz-posterior", nome: "Perfil Atual", email: "atual@example.invalid", versao: 3, ativo: true });
    estado.fontes.push({ id: "fonte-posterior", entidade: "CLIENTE_HISTORICO", chave: identidadeComprador(p.registros[1]).chave, destinoId: "raiz-posterior", dadosOrigem: { comprovante: "Preservado" } });
    const fonteAntes = structuredClone(estado.fontes[0]);
    const previa = await prepararImportacaoHistorica({ ...contexto, pacote: p });
    expect(previa.linhas.map(linha => linha.clienteId)).toEqual(["raiz-posterior", "raiz-posterior"]);
    const resultado = await executarImportacaoHistorica({ ...contexto, pacote: p, tokenPrevia: previa.token });
    expect(resultado).toMatchObject({ clientesCriados: 0, clientesReutilizados: 2 });
    expect(sim.salvarCliente).not.toHaveBeenCalled();
    expect(estado.fontes.find(fonte => fonte.id === "fonte-posterior")).toEqual(fonteAntes);
  });
  it.each(["identidade", "email"])("resolve alias por %s sem mudar o perfil, a fonte antiga ou o nome original do pedido", async caminho => {
    const p = validarPacoteHistorico(pacote()), chave = identidadeComprador(p.registros[0]).chave;
    estado.clientes.push({ id: "alias-valido", nome: "Pessoa sintética", email: caminho === "identidade" ? "alias@example.invalid" : "pessoa@example.invalid", versao: 2, ativo: false, unificadoEmId: "raiz-valida" }, { id: "raiz-valida", nome: "Empresa Atual", email: "empresa@example.invalid", versao: 9, ativo: true, unificadoEmId: null });
    if (caminho === "identidade") estado.fontes.push({ id: "fonte-alias-valida", entidade: "CLIENTE_HISTORICO", chave, destinoId: "alias-valido", resumoOrigem: "hash-anterior", versaoDestino: 2, dadosOrigem: { autorOriginal: "Preservar" } });
    const clientesAntes = structuredClone(estado.clientes), fonteAntes = structuredClone(estado.fontes[0]);
    const previa = await prepararImportacaoHistorica({ ...contexto, pacote: p });
    expect(previa.linhas[0]).toMatchObject({ clienteId: "raiz-valida", situacao: "NOVO" });
    expect(previa.linhas[0].pendencias).not.toContain("cliente_unificado; revisao_necessaria");
    await executarImportacaoHistorica({ ...contexto, pacote: p, tokenPrevia: previa.token });
    expect(estado.pedidos[0].clienteId).toBe("raiz-valida");
    expect(estado.pedidos[0].compradorSnapshot).toMatchObject({ nome: "Pessoa sintética" });
    expect(estado.clientes).toEqual(clientesAntes);
    expect(sim.salvarCliente).not.toHaveBeenCalled();
    const fonte = estado.fontes.find(fonte => fonte.entidade === "CLIENTE_HISTORICO" && fonte.chave === chave);
    if (caminho === "identidade") expect(fonte).toEqual(fonteAntes);
    else expect(fonte).toMatchObject({ destinoId: "raiz-valida" });
  });
  it("fonte sem e-mail permanece legada e não recebe endereço eletrônico inventado", async () => {
    const r = registro("10001", { email: "" });
    r.comprador.emails[0] = { ...r.comprador.emails[0], normalizado: null, valido_sintaticamente: false };
    await importar(pacote([r]));
    expect(sim.salvarCliente).toHaveBeenCalledWith(tx, expect.objectContaining({ email: null }), expect.any(Object), "LEGADO");
  });
  it("revisão histórica aceita alias da mesma raiz e preserva o snapshot de nome e a fonte do comprador", async () => {
    const p = validarPacoteHistorico(pacote());
    await importar(p);
    const alias = estado.clientes[0], snapshotAntes = structuredClone(estado.pedidos[0].compradorSnapshot);
    alias.unificadoEmId = "raiz-revisao"; alias.ativo = false;
    estado.clientes.push({ id: "raiz-revisao", nome: "Empresa Canônica", email: "raiz-revisao@example.invalid", versao: 4, ativo: true });
    const fonteAntes = structuredClone(estado.fontes.find(fonte => fonte.entidade === "CLIENTE_HISTORICO"));
    p.registros[0].notas_originais = p.registros[0].raw.valores[54] = "Nota revisada da fonte original";
    p.registros[0].hash_linha = hashCanonico(p.registros[0].raw.valores);
    const resultado = await importar(p, "lote-revisao-alias-sintetico");
    expect(resultado).toMatchObject({ atualizar: 1, conflitos: 0, aplicados: 1, clientesCriados: 0 });
    expect(estado.pedidos[0]).toMatchObject({ clienteId: "raiz-revisao", versao: 2 });
    expect(estado.pedidos[0].compradorSnapshot).toEqual(snapshotAntes);
    expect(estado.fontes.find(fonte => fonte.entidade === "CLIENTE_HISTORICO")).toEqual(fonteAntes);
  });
  it.each([
    ["identidade", "NOVO"], ["correspondencia", "NOVO"],
    ["identidade", "ATUALIZAR"], ["correspondencia", "ATUALIZAR"],
  ])("bloqueia alias por %s no pedido %s sem escrever pedidos ou cadastros", async (caminho, operacao) => {
    const p = pacote();
    if (operacao === "ATUALIZAR") {
      await importar(p);
      p.registros[0].notas_originais = p.registros[0].raw.valores[54] = "Correção sintética";
      p.registros[0].hash_linha = hashCanonico(p.registros[0].raw.valores);
    } else estado.clientes.push({ id: "alias-sintetico", nome: "Pessoa sintética", email: "pessoa@example.invalid", telefone: null, versao: 1, ativo: false });
    const alias = estado.clientes[0]; alias.unificadoEmId = "empresa-canonica-sintetica"; alias.ativo = false;
    if (caminho === "identidade") {
      if (operacao === "NOVO") estado.fontes.push({ id: "fonte-cliente-alias", entidade: "CLIENTE_HISTORICO", chave: identidadeComprador(p.registros[0]).chave, destinoId: alias.id });
      alias.nome = "Nome distinto da busca por correspondência";
    } else estado.fontes = estado.fontes.filter(f => f.entidade !== "CLIENTE_HISTORICO");
    const antes = JSON.stringify(estado); vi.clearAllMocks();
    const previa = await prepararImportacaoHistorica({ ...contexto, pacote: p });
    expect(previa.contagens).toMatchObject({ novos: 0, atualizar: 0, conflitos: 1 });
    expect(previa.linhas[0].pendencias).toContain("cliente_unificado; revisao_necessaria");
    expect(await executarImportacaoHistorica({ ...contexto, pacote: p, tokenPrevia: previa.token })).toMatchObject({ aplicados: 0, conflitos: 1 });
    expect(JSON.stringify(estado)).toBe(antes); expect(sim.salvarCliente).not.toHaveBeenCalled(); expect(sim.historico).not.toHaveBeenCalled();
    expect(tx.pedidoVenda.create).not.toHaveBeenCalled(); expect(tx.pedidoVenda.update).not.toHaveBeenCalled(); expect(tx.identidadeExternaVenda.upsert).not.toHaveBeenCalled();
  });
  it("mantém reexecução sem mudança da fonte mesmo com alias legado pendente", async () => {
    const p = pacote(); await importar(p);
    estado.clientes[0].unificadoEmId = "empresa-canonica-sintetica"; estado.clientes[0].ativo = false;
    const antes = JSON.stringify(estado), previa = await prepararImportacaoHistorica({ ...contexto, pacote: p });
    expect(previa.contagens).toMatchObject({ manter: 1, conflitos: 0 });
    expect(await executarImportacaoHistorica({ ...contexto, pacote: p, tokenPrevia: previa.token })).toMatchObject({ aplicados: 0, manter: 1, conflitos: 0 });
    expect(JSON.stringify(estado)).toBe(antes);
  });
  it("preserva o vínculo cadastral corrigido quando só a linha da fonte muda", async () => {
    const p = pacote(); await importar(p);
    estado.pedidos[0].clienteId = "empresa-canonica-sintetica"; estado.pedidos[0].versao = 2;
    estado.fontes.find(f => f.entidade === "PEDIDO_HISTORICO")!.versaoDestino = 2;
    p.registros[0].notas_originais = p.registros[0].raw.valores[54] = "Correção sintética posterior ao vínculo";
    p.registros[0].hash_linha = hashCanonico(p.registros[0].raw.valores);
    const antes = JSON.stringify(estado); vi.clearAllMocks();
    const previa = await prepararImportacaoHistorica({ ...contexto, pacote: p });
    expect(previa.contagens).toMatchObject({ atualizar: 0, conflitos: 1 });
    expect(previa.linhas[0].pendencias).toContain("vinculo_cliente_atual_preservado; revisao_necessaria");
    expect(await executarImportacaoHistorica({ ...contexto, pacote: p, tokenPrevia: previa.token })).toMatchObject({ aplicados: 0, conflitos: 1 });
    expect(JSON.stringify(estado)).toBe(antes); expect(tx.pedidoVenda.update).not.toHaveBeenCalled(); expect(tx.identidadeExternaVenda.upsert).not.toHaveBeenCalled();
  });
  it("reutiliza produto inativo e equivalência autorizada; externo não vira mercadoria", async () => {
    estado.produtos.push(produto("Grazing para 4"));
    const p = pacote([registro("10001", { produto: "Grazinng para 4 - luxo branca" }), registro("10002", { produto: "Produto Externo" })]);
    await importar(p); expect(tx.produtoVenda.create).not.toHaveBeenCalled(); expect(estado.itens[0].produtoId).toBe(estado.produtos[0].id); expect(estado.itens[1].produtoId).toBeNull();
    expect((estado.itens[0].produtoSnapshot as Linha).nome).toBe("Grazinng para 4 - luxo branca");
  });
  it("bloco incompleto permanece na fonte sem quantidade inventada", async () => {
    await importar(pacote([registro("10001", { incompleto: true })])); expect(estado.itens).toHaveLength(0); expect(estado.produtos).toHaveLength(0);
    const fonte = estado.fontes.find(f => f.entidade === "PEDIDO_HISTORICO")!; expect(((fonte.dadosOrigem as Linha).registro as RegistroHistorico).itens[0].quantidade).toBeNull();
  });
  it("nome de produto fora do limite fica integral no snapshot, com exceção e sem truncar cadastro", async () => {
    const nome = "P".repeat(161), resultado = await importar(pacote([registro("10001", { produto: nome })]));
    expect(estado.produtos).toHaveLength(0); expect(estado.itens[0].produtoId).toBeNull(); expect((estado.itens[0].produtoSnapshot as Linha).nome).toBe(nome);
    expect(resultado.registros[0].pendencias.some(p => p.includes("fora_dos_limites_cadastrais"))).toBe(true);
  });
  it("reverte pedidos novos sem apagar cadastros, itens ou auditoria; reexecução é neutra", async () => {
    await importar(); expect(await reverterImportacaoHistorica(contexto)).toMatchObject({ revertidos: 1 });
    expect(estado.pedidos[0].status).toBe("HISTORICO_REVERTIDO"); expect(estado.itens[0].vigente).toBe(false); expect(estado.clientes).toHaveLength(1); expect(estado.produtos).toHaveLength(1); expect(estado.eventos).toHaveLength(2);
    expect(await reverterImportacaoHistorica(contexto)).toMatchObject({ revertidos: 0 });
  });
  it("reversão de atualização restaura fonte e fotografia anterior em nova revisão", async () => {
    const p = pacote(); await importar(p); const original = p.registros[0].notas_originais;
    p.registros[0].notas_originais = p.registros[0].raw.valores[54] = "Correção posterior"; p.registros[0].hash_linha = hashCanonico(p.registros[0].raw.valores);
    await importar(p, "lote-sintetico-2"); expect(estado.pedidos[0].versao).toBe(2);
    expect(await reverterImportacaoHistorica({ ...contexto, loteId: "lote-sintetico-2" })).toMatchObject({ revertidos: 1 });
    expect(estado.pedidos[0]).toMatchObject({ observacoes: original, versao: 3, status: "HISTORICO" }); expect(estado.itens.filter(i => i.vigente)).toHaveLength(1); expect(estado.itens).toHaveLength(3);
  });
  it("reversão preserva alteração legítima posterior", async () => {
    await importar(); estado.pedidos[0] = { ...estado.pedidos[0], versao: 2 };
    const resultado = await reverterImportacaoHistorica(contexto); expect(resultado.revertidos).toBe(0); expect(resultado.pendencias).toHaveLength(1); expect(estado.pedidos[0].status).toBe("HISTORICO");
  });
  it("rollback inclui pedidos e cadastros quando um efeito protegido muda", async () => {
    const original = tx.$queryRaw.getMockImplementation()!;
    tx.$queryRaw.mockImplementation(async sql => {
      const texto = Array.isArray(sql) ? sql.join("") : (sql as Prisma.Sql).sql;
      if (texto.includes("string_agg") && estado.pedidos.length) return [{ quantidade: "1", digest: "1".repeat(32) }];
      return original(sql);
    });
    try {
      await expect(importar()).rejects.toThrow("alterou dados operacionais");
      expect(estado.pedidos).toHaveLength(0); expect(estado.clientes).toHaveLength(0); expect(estado.itens).toHaveLength(0); expect(estado.fontes).toHaveLength(0);
    } finally { tx.$queryRaw.mockImplementation(original); }
  });
  it("importa extra comprovado, inclui desconto uma vez e mantém versão em nova leitura",async()=>{
    const f=fixtureComplementoHistorico();f.registro.complemento=validarComplementoRegistro(f.registro,f.complemento);
    estado.produtos.push(produto("Extra sintético 1",{componentes:[{insumoId:"insumo-sintetico",unidade:"KG",quantidade:new Prisma.Decimal("0.1"),insumo:{id:"insumo-sintetico",nome:"Ingrediente sintético",tipo:"INSUMO",unidade:"KG",custoMedio:new Prisma.Decimal("20"),excluidoEm:null,updatedAt:new Date("2026-10-15T00:00:00Z")}}]}));
    const original=structuredClone(f.registro.raw);expect(await importar(f.pacote)).toMatchObject({aplicados:1});expect(estado.itens).toHaveLength(11);expect(estado.pedidos[0]).toMatchObject({subtotal:"230.00",desconto:"25.00",total:"200.00",frete:"0.00",outrosCustos:"-5.00"});
    expect(estado.itens[10]).toMatchObject({quantidade:"2",precoAplicado:"12.50",desconto:"0",totalLinha:"25.00",produtoId:estado.produtos[0].id});expect(((estado.itens[10].produtoSnapshot as Linha).historico as Linha).provenienciaComplementar).toMatchObject({pedidoWooId:"21923",itemWooId:100});
    const dados=estado.fontes.find(f=>f.entidade==="PEDIDO_HISTORICO")!.dadosOrigem as {registro:RegistroHistorico;hub:Linha};expect(dados.registro.raw).toEqual(original);expect(dados.registro.itens).toHaveLength(10);expect(dados.hub).toMatchObject({itensFontePrincipal:10,itensComplementares:1,parcelaNaoDetalhada:{valor:"0"},ajusteLegadoAClassificar:"0",consulta:{totais:{total_original:"200.00"}}});expect((dados.hub.consumo as Linha[])[10]).toMatchObject({estado:"ESTIMATIVA_COMPOSICAO_ATUAL",componentes:[{quantidadeEstimada:"0.2",custoEstimado:"4"}]});
    f.pacote.metadados.sha256="2".repeat(64);f.registro.complemento.prova.fontePrincipal.sha256=f.pacote.metadados.sha256;f.registro.complemento.prova.fontePrincipal.pacoteSha256="3".repeat(64);f.registro.complemento.prova.fonteComplementar.lidoEm="2026-10-16T00:00:00Z";
    expect(await importar(f.pacote)).toMatchObject({aplicados:0,manter:1});expect(estado.pedidos[0].versao).toBe(1);expect(estado.itens).toHaveLength(11);
  });
  it("complemento novo atualiza só a versão derivada e reversão restaura dez itens",async()=>{
    const f=fixtureComplementoHistorico();await importar(f.pacote);const hashPrincipal=f.registro.hash_linha;
    f.registro.complemento=validarComplementoRegistro(f.registro,f.complemento);expect(await importar(f.pacote,"lote-sintetico-complemento")).toMatchObject({atualizar:1,aplicados:1});expect(f.registro.hash_linha).toBe(hashPrincipal);expect(estado.itens.filter(i=>i.vigente)).toHaveLength(11);expect(estado.pedidos[0].versao).toBe(2);
    expect(await reverterImportacaoHistorica({...contexto,loteId:"lote-sintetico-complemento"})).toMatchObject({revertidos:1});expect(estado.itens.filter(i=>i.vigente)).toHaveLength(10);expect(estado.pedidos[0].versao).toBe(3);
    const fonte=estado.fontes.find(f=>f.entidade==="PEDIDO_HISTORICO")!;expect(fonte.resumoOrigem).toBe(hashPrincipal);expect(((fonte.dadosOrigem as Linha).registro as RegistroHistorico).complemento).toBeUndefined();
  });
  it("extra Produto externo conserva quantidade/valor sem cadastrar, vincular ou presumir consumo",async()=>{
    const f=fixtureComplementoHistorico();f.complemento.raw.line_items[10].name="Produto externo";rehashComplementoSintetico(f.complemento);f.registro.complemento=validarComplementoRegistro(f.registro,f.complemento);
    estado.produtos.push(produto("Produto externo",{componentes:[{insumoId:"insumo-sintetico",unidade:"KG",quantidade:new Prisma.Decimal("0.1"),insumo:{id:"insumo-sintetico",nome:"Ingrediente sintético",tipo:"INSUMO",unidade:"KG",custoMedio:new Prisma.Decimal("20"),excluidoEm:null,updatedAt:new Date("2026-10-15T00:00:00Z")}}]}));
    const previa=await prepararImportacaoHistorica({...contexto,pacote:f.pacote});expect(previa.linhas[0].produtos[10]).toMatchObject({bloco:11,produtoId:null,regra:"LEGADO_NAO_IDENTIFICADO"});
    await executarImportacaoHistorica({...contexto,pacote:f.pacote,tokenPrevia:previa.token});expect(estado.itens[10]).toMatchObject({produtoId:null,quantidade:"2",precoAplicado:"12.50",totalLinha:"25.00"});
    expect(tx.produtoVenda.create.mock.calls.some(([p])=>String(p.data.nome).toLowerCase()==="produto externo")).toBe(false);expect(estado.produtos.filter(p=>p.nome==="Produto externo")).toHaveLength(1);
    const dados=estado.fontes.find(f=>f.entidade==="PEDIDO_HISTORICO")!.dadosOrigem as {registro:RegistroHistorico;hub:{consumo:Linha[]}};expect(dados.registro.complemento!.itens[0].produto_externo_nao_identificado).toBe(true);expect(dados.hub.consumo[10]).toMatchObject({bloco:11,produtoId:null,estado:"NAO_APURADO",componentes:[]});
  });
});
