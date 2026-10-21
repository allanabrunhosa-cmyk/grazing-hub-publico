import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/atividades/registro", () => ({ registrarAtividade: vi.fn(), definirContextoAtividade: vi.fn() }));

const simulados = vi.hoisted(() => ({
  sessao: vi.fn(),
  usuario: vi.fn(),
  trabalhoPorChave: vi.fn(),
  criarTrabalho: vi.fn(),
  buscarInsumo: vi.fn(),
  revalidar: vi.fn(),
  guarda: vi.fn(),
  atualizar: vi.fn(), auditar: vi.fn(), transacao: vi.fn(), loja: vi.fn(), recentes: vi.fn(), perfil: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession: simulados.sessao }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: simulados.guarda }));
vi.mock("next/cache", () => ({ revalidatePath: simulados.revalidar }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    usuario: { findUnique: simulados.usuario },
    trabalhoEtiqueta: {
      findUnique: simulados.trabalhoPorChave,
      create: simulados.criarTrabalho,
      count: simulados.recentes,
    },
    insumo: { findUnique: simulados.buscarInsumo, update: simulados.atualizar },
    eventoAuditoriaEtiqueta: { create: simulados.auditar },
    $transaction: simulados.transacao, configuracaoLoja: { upsert: simulados.loja },
    perfilImpressora: { findFirst: simulados.perfil },
  },
}));

import {
  prepararEtiquetaAction,
  salvarConfiguracaoProdutoEtiquetaAction,
} from "@/app/(protegido)/producao/etiquetas/actions";

const entrada = {
  chaveIdempotencia: "123e4567-e89b-42d3-a456-426614174000",
  insumoId: "insumo-1",
  conservacao: "REFRIGERADO" as const,
  quantidade: "1,5",
  lote: "L1",
  responsavelManipulacao: "Ana",
  tamanho: "MM_60X40" as const,
  mostrarHora: true,
  copias: 1,
};

beforeEach(() => {
  vi.resetAllMocks();
  simulados.sessao.mockResolvedValue({ userId: "usuario-1", admin: false });
  simulados.usuario.mockResolvedValue({ id: "usuario-1", nome: "Operador", ativo: true, admin: false });
  simulados.trabalhoPorChave.mockResolvedValue(null);
  simulados.recentes.mockResolvedValue(0);
  simulados.perfil.mockResolvedValue(null);
  simulados.loja.mockResolvedValue({ fusoHorario: "America/Sao_Paulo", maximoCopiasEtiqueta: 30, nome: "Loja fictícia", cnpj: null, endereco: null });
});

function habilitarPreparacao() {
  simulados.buscarInsumo.mockResolvedValue({ id: "insumo-1", nome: "Produto fictício", unidade: "KG", ativo: true, etiquetaHabilitada: true, validadeRefrigeradoDias: 3, versaoConfiguracaoEtiqueta: 1, marcasHomologadas: [] });
  simulados.criarTrabalho.mockImplementation(async ({ data }) => ({ ...data, id: "trabalho-30", status: "PREPARADO" }));
  simulados.transacao.mockImplementation(async callback => callback({ trabalhoEtiqueta: { create: simulados.criarTrabalho }, eventoAuditoriaEtiqueta: { create: simulados.auditar } }));
}

it("prepara 30 cópias no mesmo trabalho e registra a quantidade na auditoria e no ZPL", async () => {
  habilitarPreparacao();
  const resultado = await prepararEtiquetaAction({ ...entrada, copias: 30 });
  expect(resultado).toMatchObject({ ok: true, trabalho: { dados: { copias: 30 }, zpl: expect.stringContaining("^PQ30,0,1,N") } });
  expect(simulados.guarda).toHaveBeenCalledWith("producao", "adicionar");
  expect(simulados.criarTrabalho).toHaveBeenCalledOnce();
  expect(simulados.auditar).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ acao: "PREPARADO", detalhes: expect.objectContaining({ copias: 30 }) }) }));
});

it.each([0, -1, 31, 1.5, NaN, Infinity])("recusa %s cópias no servidor sem criar trabalho ou auditoria", async copias => {
  habilitarPreparacao();
  expect(await prepararEtiquetaAction({ ...entrada, copias })).toEqual({ erro: "A quantidade de cópias deve ficar entre 1 e 30." });
  expect(simulados.transacao).not.toHaveBeenCalled();
  expect(simulados.criarTrabalho).not.toHaveBeenCalled();
  expect(simulados.auditar).not.toHaveBeenCalled();
});

it("preserva um limite maior configurado e não permite extrapolá-lo", async () => {
  habilitarPreparacao();
  simulados.loja.mockResolvedValue({ fusoHorario: "America/Sao_Paulo", maximoCopiasEtiqueta: 40, nome: "Loja fictícia", cnpj: null, endereco: null });
  expect(await prepararEtiquetaAction({ ...entrada, copias: 40 })).toMatchObject({ ok: true, trabalho: { dados: { copias: 40 } } });
  expect(await prepararEtiquetaAction({ ...entrada, copias: 41 })).toEqual({ erro: "A quantidade de cópias deve ficar entre 1 e 40." });
  expect(simulados.criarTrabalho).toHaveBeenCalledOnce();
});

it("exige sessão ativa para preparar e configurar", async () => {
  simulados.sessao.mockResolvedValue(null);
  expect(await prepararEtiquetaAction(entrada)).toHaveProperty("erro");
  expect(await salvarConfiguracaoProdutoEtiquetaAction({
    insumoId: "insumo-1",
    etiquetaHabilitada: true,
    validadeRefrigeradoDias: "2",
    validadeCongeladoDias: "30",
    conservacaoEtiquetaPadrao: "REFRIGERADO",
  })).toHaveProperty("erro");
  expect(simulados.criarTrabalho).not.toHaveBeenCalled();
});

it("exige permissão central de configurar validades; o flag administrativo legado não concede acesso", async () => {
  // O flag legado não pode ampliar o perfil atual retornado por getSession.
  simulados.usuario.mockResolvedValue({ id: "usuario-1", nome: "Operador", ativo: true, admin: true });
  simulados.guarda.mockRejectedValue(new Error("SEM_ACESSO"));
  await expect(salvarConfiguracaoProdutoEtiquetaAction({
    insumoId: "insumo-1",
    etiquetaHabilitada: true,
    validadeRefrigeradoDias: "2",
    validadeCongeladoDias: "30",
    conservacaoEtiquetaPadrao: "REFRIGERADO",
  })).rejects.toThrow("SEM_ACESSO");
  expect(simulados.guarda).toHaveBeenCalledWith("producao.validades", "editar");
  expect(simulados.buscarInsumo).not.toHaveBeenCalled();
});

it("a mesma chave retorna o mesmo trabalho sem nova criação", async () => {
  simulados.trabalhoPorChave.mockResolvedValue({
    id: "trabalho-1",
    emitidoPorId: "usuario-1",
    produtoNome: "Brie porcionado",
    lojaNome: "Grazing Table & Co",
    lojaCnpj: null,
    conservacao: "REFRIGERADO",
    quantidade: { toString: () => "1.500" },
    unidade: "KG",
    lote: "L1",
    responsavelManipulacao: "Ana",
    manipuladoEm: new Date("2026-09-16T12:00:00Z"),
    validoAte: new Date("2026-09-18T12:00:00Z"),
    fusoHorario: "America/Sao_Paulo",
    resolucaoDpi: 203,
    tamanho: "MM_60X40",
    mostrarHora: true,
    copias: 1,
    zpl: "^XA^XZ",
    status: "PREPARADO",
  });
  const resultado = await prepararEtiquetaAction(entrada);
  expect(resultado).toMatchObject({ ok: true, trabalho: { id: "trabalho-1", reutilizado: true } });
  expect(simulados.buscarInsumo).not.toHaveBeenCalled();
  expect(simulados.criarTrabalho).not.toHaveBeenCalled();
});

it("configura prazos pelo acesso funcional, limita a escrita e revalida as duas entradas", async () => {
  simulados.buscarInsumo.mockResolvedValue({id:"insumo-1",etiquetaHabilitada:true,validadeSecoDias:1,validadeRefrigeradoDias:3,validadeCongeladoDias:30,versaoConfiguracaoEtiqueta:4});
  expect(await salvarConfiguracaoProdutoEtiquetaAction({insumoId:"insumo-1",etiquetaHabilitada:true,validadeSecoDias:"2",validadeRefrigeradoDias:"5",validadeCongeladoDias:"60",...{nome:"Não salvar",custoMedio:999}})).toEqual({ok:true,versao:5});
  expect(simulados.guarda).toHaveBeenCalledWith("producao.validades","editar");
  expect(simulados.atualizar).toHaveBeenCalledWith({where:{id:"insumo-1"},data:{etiquetaHabilitada:true,validadeSecoDias:2,validadeRefrigeradoDias:5,validadeCongeladoDias:60,versaoConfiguracaoEtiqueta:5,etiquetaAtualizadaPorId:"usuario-1"}});
  expect(simulados.transacao).toHaveBeenCalledOnce();expect(simulados.auditar).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({acao:"CONFIGURACAO_ETIQUETA_ALTERADA",usuarioId:"usuario-1"})}));
  expect(simulados.revalidar).toHaveBeenCalledWith("/insumos");expect(simulados.revalidar).toHaveBeenCalledWith("/producao/etiquetas");
});
it.each(["0","1.5","abc","10000","-3"])("recusa prazo %s sem alterar nem auditar", async prazo=>{
 simulados.buscarInsumo.mockResolvedValue({id:"insumo-1"});expect(await salvarConfiguracaoProdutoEtiquetaAction({insumoId:"insumo-1",etiquetaHabilitada:true,validadeRefrigeradoDias:prazo,validadeCongeladoDias:""})).toHaveProperty("erro");expect(simulados.atualizar).not.toHaveBeenCalled();expect(simulados.transacao).not.toHaveBeenCalled();
});
