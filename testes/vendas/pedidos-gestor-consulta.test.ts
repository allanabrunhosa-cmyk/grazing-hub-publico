import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { comandoAvancoGestor, estadoAnteriorGestor } from "@/lib/vendas/pedidos-operacao-dominio";
import { ORIGEM_HISTORICA } from "@/lib/vendas/historico-dominio";

const sim = vi.hoisted(() => ({ listar: vi.fn(), total: vi.fn(), contar: vi.fn(), loja: vi.fn(), ids: vi.fn(), contagens: vi.fn(), clientes: vi.fn(), produtos: vi.fn(), opcoes: vi.fn(), canais: vi.fn(), horarios: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ifood/horarios-servidor", () => ({ horariosSnapshotIfood: sim.horarios }));
vi.mock("@/lib/prisma", () => ({ prisma: { pedidoVenda: { findMany: sim.listar, aggregate: sim.total, count: sim.contar, groupBy: sim.contagens }, configuracaoLoja: { findUnique: sim.loja }, $queryRaw: sim.ids, clienteVenda: { findMany: sim.clientes }, produtoVenda: { findMany: sim.produtos }, opcaoComplementoVenda: { findMany: sim.opcoes }, canalVenda: { findMany: sim.canais } } }));
import { listarPedidos } from "@/lib/vendas/pedidos";
const semHistorico = { origem: { not: "HISTORICO_LEGADO" }, OR: [{ referenciaOrigem: null }, { referenciaOrigem: { not: ORIGEM_HISTORICA } }] };

beforeEach(() => {
  sim.horarios.mockReturnValue(null);
  sim.listar.mockResolvedValue([{
    id: "pedido-ficticio", clienteId: "cliente-ficticio", numero: 12, versao: 5, fusoHorario: "America/Manaus", modoFinanceiro: "EXTERNO", referenciaPedido: "referencia-ficticia", status: "CONFIRMADO", statusOperacional: "EM_PREPARO", atendimento: "ENTREGA", prazo: "AGENDADO", rascunho: null,
    dataCompra: null, previsaoData: new Date("2026-10-03T00:00:00Z"), previsaoJanela: "14:00", createdAt: new Date("2026-10-01T15:00:00Z"), confirmadoEm: new Date("2026-10-01T16:00:00Z"), entregueEm: null,
    subtotal: new Prisma.Decimal("25.50"), total: new Prisma.Decimal("30.50"), frete: new Prisma.Decimal("5.00"), desconto: new Prisma.Decimal("0.00"), outrosCustos: new Prisma.Decimal("0"), formaPagamentoInformada: null, cobrancaSnapshot: null, observacoes: "Instrução fictícia", cliente: { nome: "Cliente renomeado" }, compradorSnapshot: { nome: "Cliente fictício", documentoPrivado: "não-serializar" }, canalNomeSnapshot: "Canal fictício",
    destinatarioSnapshot: { nome: "Destinatário fictício", contato: "000000000", documentoPrivado: "não-serializar" }, enderecoSnapshot: { logradouro: "Rua fictícia", numero: "1", cidade: "Cidade fictícia", bancoPrivado: "não-serializar" },
    historico: [{ depois: { comando: { tipo: "PREPARAR", itemId: "item-ficticio", quantidade: "1" } } }, { depois: { comando: { tipo: "PREPARAR", itemId: "item-ficticio", quantidade: "0.5" } } }],
    itens: [{ id: "item-ficticio", produtoId: "produto-ficticio", quantidade: new Prisma.Decimal("2"), observacoes: null, unidadeSnapshot: "KG", produtoSnapshot: { nome: "Kit fictício", composicaoPrivada: "não-serializar" }, escolhasSnapshot: [{ opcaoNome: "Extra fictício", quantidade: 2, preco: "privado" }], estadoComposicao: "CONHECIDA", precoAplicado: new Prisma.Decimal("12.75"), totalLinha: new Prisma.Decimal("25.50"), reservas: [{ reservada: new Prisma.Decimal("1"), consumida: new Prisma.Decimal("1"), loteExecucao: "lote-ficticio", quantidadeItem: new Prisma.Decimal("2") }] }],
  }]);
  sim.total.mockResolvedValue({ _count: { id: 87 }, _sum: { total: new Prisma.Decimal("2610.50") } });
  sim.contar.mockResolvedValue(87);
  sim.loja.mockResolvedValue({ fusoHorario: "America/Manaus" });
  sim.ids.mockResolvedValue([{ id: "pedido-sem-dia-ficticio" }]);
  sim.contagens.mockImplementation(({ by }) => Promise.resolve(by.includes("canalId") ? [{ canalId: "canal-ficticio", _count: { _all: 87 } }] : by.includes("status") ? [{ status: "CONFIRMADO", statusOperacional: "EM_PREPARO", _count: { _all: 87 } }] : [{ clienteId: "cliente-ficticio", _count: 3 }]));
  sim.clientes.mockResolvedValue([{ id: "cliente-ficticio", nome: "Cliente do rascunho" }]);
  sim.produtos.mockResolvedValue([{ id: "produto-ficticio", nome: "Produto do rascunho", unidade: "KG" }]);
  sim.opcoes.mockResolvedValue([{ id: "opcao-ficticia", nome: "Extra do rascunho" }]);
  sim.canais.mockResolvedValue([{ id: "canal-ficticio", nome: "Canal do rascunho" }]);
});

describe("Consulta compartilhada do gestor", () => {
  it("conta a coorte completa dos status sem etapa, status ou paginação do próprio filtro", async () => {
    sim.contagens.mockImplementation(({ by }) => Promise.resolve(by.includes("status") ? [
      { status: "RASCUNHO", statusOperacional: "PENDENTE", _count: { _all: 5 } },
      { status: "CONFIRMADO", statusOperacional: "PENDENTE", _count: { _all: 12 } },
      { status: "CONFIRMADO", statusOperacional: "EM_PREPARO", _count: { _all: 30 } },
      { status: "CONFIRMADO", statusOperacional: "PRONTO", _count: { _all: 24 } },
      { status: "CONFIRMADO", statusOperacional: "EM_ENTREGA", _count: { _all: 11 } },
      { status: "CONFIRMADO", statusOperacional: "ENTREGUE", _count: { _all: 9 } },
      { status: "CANCELADO", statusOperacional: "PRONTO", _count: { _all: 3 } },
      { status: "RECEBIDO_EXTERNO", statusOperacional: "PENDENTE", origem: "IFOOD", _count: { _all: 6 } },
      { status: "RECEBIDO_EXTERNO", statusOperacional: "PENDENTE", origem: "INTERNO", _count: { _all: 2 } },
      { status: "CONFIRMADO", statusOperacional: "INTERROMPIDO", _count: { _all: 4 } },
      { status: "DECLINADO", statusOperacional: "INTERROMPIDO", _count: { _all: 7 } },
      { status: "ESTORNADO", statusOperacional: "INTERROMPIDO", _count: { _all: 8 } },
    ] : by.includes("canalId") ? [] : [{ clienteId: "cliente-ficticio", _count: 3 }]));
    const resultado = await listarPedidos({ status: "CONFIRMADO", etapaGestor: "pronto", busca: "Cliente", canalId: "canal-ficticio", pagina: 2 });
    expect(resultado.contagensStatus).toEqual({ todos: 92, novo: 18, orcamento: 5, preparo: 30, pronto: 24, rota: 11, entregues: 9, cancelado: 3, declinado: 7, estornado: 8, interrompido: 4 });
    const consulta = sim.contagens.mock.calls.find(([q]) => q.by.includes("status"))![0];
    expect(consulta.where).toMatchObject({ canalId: "canal-ficticio", OR: expect.any(Array) });
    expect(consulta.where).not.toHaveProperty("status");
    expect(consulta.where).not.toHaveProperty("statusOperacional");
    expect(consulta).not.toHaveProperty("skip");
    expect(consulta).not.toHaveProperty("take");
    await listarPedidos({ status: "RASCUNHO", excluirCancelados: true });
    expect(sim.contagens.mock.calls.filter(([q]) => q.by.includes("status"))[1][0].where.status).toEqual({ not: "CANCELADO" });
  });

  it("conserva os dados comerciais fotografados para o resumo e filtra campos extras", async () => {
    const pedido = (await sim.listar())[0];
    sim.listar.mockClear();
    sim.listar.mockResolvedValue([{ ...pedido,
      compradorSnapshot: { nome: "Empresa fictícia", tipo: "PJ", documento: "00000000000000", razaoSocial: "Empresa fictícia Ltda", inscricaoEstadual: "ISENTO", email: "ficticio@example.invalid", telefone: "000000000", contato: "Contato fictício", segredo: "não-serializar" },
      pagamentoInformadoSnapshot: { formaId: "forma-ficticia", nome: "Boleto histórico", tipo: "BOLETO", parcelas: 2, vencimentos: ["2026-10-10", "2026-10-20"], segredo: "não-serializar" },
    }]);
    const { pedidos } = await listarPedidos();
    expect(pedidos[0].compradorSnapshot).toMatchObject({ nome: "Empresa fictícia", tipo: "PJ", razaoSocial: "Empresa fictícia Ltda", documento: "00000000000000" });
    expect(pedidos[0].pagamentoInformadoSnapshot).toEqual({ nome: "Boleto histórico", tipo: "BOLETO", parcelas: 2, vencimentos: ["2026-10-10", "2026-10-20"] });
    expect(sim.clientes).not.toHaveBeenCalled();
    expect(JSON.stringify(pedidos)).not.toContain("não-serializar");
  });
  it("mantém busca/período e sem data, separa preparo e pagina a coorte filtrada", async () => {
    const resultado = await listarPedidos({ busca: "Kit", baseData: "entrega", de: "2026-10-01", ate: "2026-10-31", etapaGestor: "preparo", incluirSemData: true, pagina: 2 });
    const consulta = sim.listar.mock.calls[0][0];
    expect(consulta.where).toMatchObject({
      OR: [{ cliente: { nome: { contains: "Kit", mode: "insensitive" } } }, { referenciaPedido: { contains: "Kit", mode: "insensitive" } }],
      statusOperacional: { in: ["EM_PREPARO"] },
      AND: [semHistorico, { OR: [{ previsaoData: { gte: new Date("2026-10-01T00:00:00Z"), lt: new Date("2026-11-01T00:00:00Z") } }, { id: { in: ["pedido-sem-dia-ficticio"] } }] }, { status: "CONFIRMADO" }],
    });
    expect(consulta).toMatchObject({ skip: 50, take: 50 });
    expect(resultado).toMatchObject({ quantidadeTotal: 87, pagina: 2, paginas: 2 });
    expect(sim.contar).toHaveBeenCalledWith({ where: consulta.where });
    const sql = sim.ids.mock.calls[0][0];
    expect(sql.values).toEqual([true, "2026-10-01", "2026-10-31"]);
    expect(sql.text).toContain("AT TIME ZONE");
    expect(sql.text).not.toContain("2026-10-01");
  });

  it("aplica a coorte principal antes da paginação e não a impõe a consultas globais", async () => {
    const resultado = await listarPedidos({ status: "operacionais", etapaGestor: "novo", busca: "Kit", pagina: 2 });
    const consulta = sim.listar.mock.calls[0][0];
    expect(consulta).toMatchObject({ skip: 50, take: 50, where: { OR: expect.any(Array), AND: [
      semHistorico,
      { OR: [{ status: "CONFIRMADO", statusOperacional: { not: "INTERROMPIDO" } }, { status: "RECEBIDO_EXTERNO", origem: "IFOOD" }] },
      { OR: [{ status: "CONFIRMADO", statusOperacional: "PENDENTE" }, { status: "RECEBIDO_EXTERNO", origem: "IFOOD" }] },
    ] } });
    expect(sim.contar).toHaveBeenCalledWith({ where: consulta.where });
    expect(resultado.quantidadeTotal).toBe(87);
    expect(resultado.consultadoEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const contagem = sim.contagens.mock.calls.find(([q]) => q.by.includes("status"))![0];
    expect(contagem.where.AND).toEqual([semHistorico]);
    expect(contagem.where).toHaveProperty("OR", expect.any(Array));
    await listarPedidos();
    expect(sim.listar.mock.calls[1][0].where).toEqual({});
  });

  it.each(["RASCUNHO", "CANCELADO", "DECLINADO", "ESTORNADO"])("consulta o filtro separado %s sem ocultação posterior à paginação", async status => {
    await listarPedidos({ status, pagina: 2 });
    expect(sim.listar.mock.calls[0][0]).toMatchObject({ where: { status }, skip: 50, take: 50 });
    expect(sim.contar).toHaveBeenCalledWith({ where: { status } });
  });

  it("inclui apenas fotos privadas atuais do produto vinculado e preserva nome/preço do snapshot", async () => {
    const pedido = (await sim.listar())[0];
    sim.listar.mockClear();
    sim.listar.mockResolvedValue([{ ...pedido, itens: [{ ...pedido.itens[0], produto: { fotoUrl: "/api/vendas/fotos/foto-ficticia" }, produtoSnapshot: { nome: "Nome histórico", fotoUrl: "https://nao-enviar.invalid/foto" } }] }]);
    const { pedidos } = await listarPedidos();
    expect(pedidos[0].itensDetalhes[0]).toMatchObject({ produtoId: "produto-ficticio", fotoUrl: "/api/vendas/fotos/foto-ficticia", nome: "Nome histórico", precoUnitario: "12.75" });
    expect(JSON.stringify(pedidos)).not.toContain("nao-enviar.invalid");
    expect(sim.listar.mock.calls[0][0].select.itens.select.produto).toEqual({ select: { fotoUrl: true } });
    sim.listar.mockResolvedValue([{ ...pedido, itens: [{ ...pedido.itens[0], produto: { fotoUrl: "https://nao-enviar.invalid/foto" } }] }]);
    expect((await listarPedidos()).pedidos[0].itensDetalhes[0]).not.toHaveProperty("fotoUrl");
  });

  it("exibe a criação externa aprovada sem substituir criação local ou expor snapshot iFood", async () => {
    const pedido = (await sim.listar())[0];
    sim.listar.mockClear();
    sim.listar.mockResolvedValue([{ ...pedido, origem: "IFOOD", ifood: { snapshotCifrado: "cifra-nunca-enviar", acompanhamento: true, loja: { modoOperacao: "ACOMPANHAMENTO" } } }]);
    sim.horarios.mockReturnValue({ criadoEm: new Date("2026-10-01T14:59:00Z"), inicioPreparo: null, janela: "14:00" });
    const p = (await listarPedidos()).pedidos[0];
    expect(p).toMatchObject({ criadoEm: "2026-10-01T15:00:00.000Z", criadoEmExterno: "2026-10-01T14:59:00.000Z", acompanhamentoIfood: true });
    expect(JSON.stringify(p)).not.toContain("cifra-nunca-enviar");
  });

  it("serializa apenas campos operacionais aprovados, com números precisos e quantidades históricas", async () => {
    const { pedidos } = await listarPedidos();
    expect(pedidos[0]).toMatchObject({ versao: 5, fusoHorario: "America/Manaus", cliente: "Cliente fictício", compradorSnapshot: { nome: "Cliente fictício" }, pedidosAnteriores: 2, atendimento: "ENTREGA", prazo: "AGENDADO", dataGestor: "2026-10-03", total: "30.5", destinatarioSnapshot: { nome: "Destinatário fictício", contato: "000000000" }, enderecoSnapshot: { logradouro: "Rua fictícia", numero: "1", cidade: "Cidade fictícia" }, itensDetalhes: [{ id: "item-ficticio", nome: "Kit fictício", quantidade: "2", unidade: "KG", complementos: ["2 × Extra fictício"], preparado: "1.5", expedido: "0", precoUnitario: "12.75", total: "25.5" }] });
    expect(JSON.stringify(pedidos)).not.toContain("não-serializar");
    expect(JSON.stringify(pedidos)).not.toContain("composicaoPrivada");
    expect(sim.listar.mock.calls[0][0].select).toHaveProperty("versao", true);
    expect(sim.listar.mock.calls[0][0]).not.toHaveProperty("include");
  });

  it("conserva o filtro operacional anterior e a base comercial sem incluir pedidos sem data", async () => {
    await listarPedidos({ operacional: "PENDENTE", baseData: "confirmacao", de: "2026-10-01", incluirSemData: true, busca: "12" });
    expect(sim.listar.mock.calls[0][0].where).toMatchObject({ statusOperacional: "PENDENTE", OR: expect.arrayContaining([{ numero: 12 }]), AND: [semHistorico, { OR: [
      { dataCompra: { gte: new Date("2026-10-01T00:00:00Z") } },
      { dataCompra: null, confirmadoEm: { gte: new Date("2026-10-01T04:00:00Z") } },
    ] }] });
    expect(sim.listar.mock.calls[0][0].where.confirmadoEm).toBeUndefined();
  });

  it("preserva cobrança, pagamento informado, custos e instruções por item sem serializar campos extras", async () => {
    const pedido = (await sim.listar())[0];
    sim.listar.mockClear();
    sim.listar.mockResolvedValue([{ ...pedido, outrosCustos: new Prisma.Decimal("7.35"), total: new Prisma.Decimal("37.85"), formaPagamentoInformada: "PIX",
      cobrancaSnapshot: { nome: "Cobrança", pais: "Brasil", cep: "00000000", logradouro: "Rua de cobrança fictícia", numero: "3", complemento: "Portaria", bairro: "Centro", cidade: "Cidade fictícia", uf: "AM", metadadosPrivados: "não-serializar" },
      enderecoSnapshot: { ...pedido.enderecoSnapshot, pais: "Portugal" },
      destinatarioSnapshot: { ...pedido.destinatarioSnapshot, primeiroNome: "Destinatário", sobrenome: "Fictício" },
      itens: pedido.itens.map((i: object) => ({ ...i, observacoes: "Instrução específica fictícia" })),
    }]);
    const { pedidos } = await listarPedidos();
    expect(pedidos[0]).toMatchObject({ subtotal: "25.5", outrosCustos: "7.35", total: "37.85", formaPagamentoInformada: "PIX", cobrancaSnapshot: { nome: "Cobrança", pais: "Brasil", logradouro: "Rua de cobrança fictícia" }, enderecoSnapshot: { pais: "Portugal" }, destinatarioSnapshot: { primeiroNome: "Destinatário", sobrenome: "Fictício" }, itensDetalhes: [{ observacoes: "Instrução específica fictícia" }] });
    expect(JSON.stringify(pedidos)).not.toContain("não-serializar");
    expect(sim.listar.mock.calls[0][0].select.itens.select.observacoes).toBe(true);
  });

  it("não aplica datas civis inexistentes ou uma etapa desconhecida", async () => {
    await listarPedidos({ de: "2026-02-30", etapaGestor: "inexistente" as "preparo" });
    expect(sim.listar.mock.calls[0][0].where).toEqual({});
  });

  it("limita a página solicitada à última disponível após mudar a coorte", async () => {
    expect(await listarPedidos({ pagina: 100 })).toMatchObject({ pagina: 2, paginas: 2, quantidadeTotal: 87 });
    expect(sim.listar.mock.calls[0][0]).toMatchObject({ skip: 50, take: 50 });
    sim.contar.mockResolvedValue(0);
    sim.listar.mockResolvedValue([]);
    expect(await listarPedidos({ pagina: 100 })).toMatchObject({ pagina: 1, paginas: 0, quantidadeTotal: 0, pedidos: [] });
    expect(sim.listar.mock.calls[1][0]).toMatchObject({ skip: 0, take: 50 });
  });

  it("serializa rascunho pela entrada validada e data imediata no fuso do pedido", async () => {
    const confirmado = (await sim.listar())[0];
    sim.listar.mockClear();
    const rascunho = { ...confirmado, status: "RASCUNHO", clienteId: null, itens: [], atendimento: null, prazo: null, previsaoData: null, confirmadoEm: null, createdAt: new Date("2026-10-02T02:00:00Z"), rascunho: {
      clienteId: "cliente-ficticio", canalId: "canal-ficticio", atendimento: "ENTREGA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null,
      destinatario: { nome: "Pessoa do rascunho", contato: "00000000" }, endereco: { cep: "00000000", logradouro: "Rua do rascunho", numero: "2", complemento: "", bairro: "Centro", cidade: "Cidade fictícia", uf: "AM", privado: "não-serializar" },
      cobranca: { pais: "Brasil", cep: "00000000", logradouro: "Rua de cobrança do rascunho", numero: "3", complemento: "Portaria", bairro: "Centro", cidade: "Cidade fictícia", uf: "AM", metadadosPrivados: "não-serializar" },
      observacoes: "Instrução do rascunho", frete: "2.00", desconto: "0.00", outrosCustos: "3.15", formaPagamentoInformada: "BOLETO", itens: [{ produtoId: "produto-ficticio", quantidade: "2", observacoes: "Instrução do item rascunho", precoManual: null, escolhas: { "opcao-ficticia": 1 } }], privado: "não-serializar",
    } };
    sim.listar.mockResolvedValue([rascunho]);
    const { pedidos } = await listarPedidos();
    expect(pedidos[0]).toMatchObject({ cliente: "Cliente do rascunho", pedidosAnteriores: 3, atendimento: "ENTREGA", prazo: "IMEDIATO", dataGestor: "2026-10-01", observacoes: "Instrução do rascunho", canal: "Canal do rascunho", destinatarioSnapshot: { nome: "Pessoa do rascunho" }, enderecoSnapshot: { logradouro: "Rua do rascunho" }, cobrancaSnapshot: { pais: "Brasil", logradouro: "Rua de cobrança do rascunho" }, outrosCustos: "3.15", formaPagamentoInformada: "BOLETO", itens: 1, itensDetalhes: [{ nome: "Produto do rascunho", quantidade: "2", observacoes: "Instrução do item rascunho", complementos: ["1 × Extra do rascunho"] }] });
    expect(JSON.stringify(pedidos)).not.toContain("não-serializar");
  });

  it.each(["DECLINADO", "ESTORNADO"])("conserva estado comercial %s no filtro e DTO", async status => {
    const pedido = (await sim.listar())[0];
    sim.listar.mockClear();
    sim.listar.mockResolvedValue([{ ...pedido, status }]);
    const { pedidos } = await listarPedidos({ status });
    expect(sim.listar.mock.calls[0][0].where.status).toBe(status);
    expect(pedidos[0].status).toBe(status);
  });

  it("recência do quadro restringe apenas entregues e mantém OR de busca e período separados", async () => {
    await listarPedidos({ busca: "12", de: "2026-10-01", baseData: "entrega", incluirSemData: true, apenasEntreguesRecentes: true });
    const { where } = sim.listar.mock.calls[0][0];
    expect(where.OR).toEqual(expect.arrayContaining([{ numero: 12 }]));
    expect(where.AND).toHaveLength(2);
    expect(where.AND[1]).toEqual({ OR: [{ statusOperacional: { not: "ENTREGUE" } }, { entregueEm: { gte: expect.any(Date) } }] });
  });
});

describe("Transições da interface compartilhadas com o domínio", () => {
  it("usa as etapas existentes e mantém a primeira coluna sem retorno a não iniciado", () => {
    expect(["PENDENTE", "EM_PREPARO", "PRONTO", "EM_ENTREGA", "ENTREGUE", "INTERROMPIDO"].map(estado => comandoAvancoGestor(estado))).toEqual(["INICIAR", "PRONTO", "SAIR", "ENTREGAR", null, null]);
    expect(["PENDENTE", "EM_PREPARO", "PRONTO", "EM_ENTREGA", "ENTREGUE", "INTERROMPIDO"].map(estado => estadoAnteriorGestor(estado))).toEqual([null, null, "EM_PREPARO", "PRONTO", "EM_ENTREGA", null]);
  });
});

it("conta canais em toda a busca antes da paginação, excluindo somente o próprio filtro", async () => {
  sim.contagens.mockImplementation(({ by }) => Promise.resolve(by.includes("canalId") ? [
    { canalId: "site", _count: { _all: 55 } }, { canalId: "ifood", _count: { _all: 32 } },
  ] : [{ clienteId: "cliente-ficticio", _count: 3 }]));
  const resultado = await listarPedidos({ busca: "Kit", canalId: "site", clienteId: "cliente-ficticio", pagina: 2 });
  expect(resultado.contagensCanal).toEqual({ "": 87, site: 55, ifood: 32 });
  const query = sim.contagens.mock.calls.find(([args]) => args.by.includes("canalId"))![0];
  expect(query.where).toMatchObject({ clienteId: "cliente-ficticio", OR: expect.any(Array) });
  expect(query.where).not.toHaveProperty("canalId");
  expect(query).not.toHaveProperty("take");
  expect(query).not.toHaveProperty("skip");
});
