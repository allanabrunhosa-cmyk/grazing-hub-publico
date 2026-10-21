// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

type InsumoVinculado = { id: string; nome: string; especificacao: string | null };
type FornecedorConsulta = {
  id: string;
  nome: string;
  tipoCadastro: "FORNECEDOR" | "BENEFICIARIO";
  ativo: boolean;
  canaisPedido: { id: string; nome: string }[];
  formasPagamento: { id: string; nome: string }[];
  insumosPrincipais: InsumoVinculado[];
  insumosHomologados: { insumo: InsumoVinculado }[];
};
type FornecedorExibido = { id: string; nome: string; insumosVinculados: InsumoVinculado[]; quantidadeInsumos: number };

const m = vi.hoisted(() => ({
  exigirPermissao: vi.fn(),
  podeAcessar: vi.fn(),
  fornecedores: vi.fn(),
  canais: vi.fn(),
  pagamentos: vi.fn(),
  tabela: vi.fn(),
}));

vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: m.exigirPermissao, podeAcessar: m.podeAcessar }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  fornecedor: { findMany: m.fornecedores },
  canalPedido: { findMany: m.canais },
  formaPagamento: { findMany: m.pagamentos },
} }));
vi.mock("@/components/padroes-operacionais", () => ({ BarraAcoes: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/app/(protegido)/fornecedores/fornecedor-dialog", () => ({ FornecedorDialog: () => null }));
vi.mock("@/app/(protegido)/fornecedores/import-fornecedores-dialog", () => ({ ImportFornecedoresDialog: () => null }));
vi.mock("@/app/(protegido)/fornecedores/export-fornecedores-button", () => ({ ExportFornecedoresButton: () => null }));
vi.mock("@/app/(protegido)/fornecedores/fornecedores-table", () => ({
  FornecedoresTable: (props: { fornecedores: FornecedorExibido[] }) => {
    m.tabela(props);
    return <div>{props.fornecedores.map((fornecedor) => <output key={fornecedor.id} aria-label={`Vínculos de ${fornecedor.nome}`}>
      {fornecedor.insumosVinculados?.map((insumo) => insumo.nome).join(", ")}
    </output>)}</div>;
  },
}));

import FornecedoresPage from "@/app/(protegido)/fornecedores/page";

const farinha: InsumoVinculado = { id: "farinha", nome: "Farinha legado", especificacao: "Tipo 1" };
const acucar: InsumoVinculado = { id: "acucar", nome: "Açúcar", especificacao: "Refinado" };
const sal: InsumoVinculado = { id: "sal", nome: "Sal homologado", especificacao: null };

function fornecedor(dados: Partial<FornecedorConsulta> = {}): FornecedorConsulta {
  return {
    id: "distribuidora", nome: "Distribuidora Exemplo", tipoCadastro: "FORNECEDOR", ativo: true,
    canaisPedido: [], formasPagamento: [], insumosPrincipais: [], insumosHomologados: [], ...dados,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  m.exigirPermissao.mockResolvedValue(undefined);
  m.podeAcessar.mockResolvedValue(false);
  m.fornecedores.mockResolvedValue([]);
  m.canais.mockResolvedValue([]);
  m.pagamentos.mockResolvedValue([]);
});
afterEach(cleanup);

it("consulta apenas insumos ativos nas duas relações e exibe a união sem duplicatas", async () => {
  // O retorno simulado representa os registros após os filtros da consulta; não executa Prisma real.
  m.fornecedores.mockResolvedValue([
    fornecedor({ insumosPrincipais: [farinha, acucar], insumosHomologados: [{ insumo: sal }, { insumo: farinha }] }),
    fornecedor({ id: "vazio", nome: "Fornecedor sem vínculos" }),
    fornecedor({ id: "beneficiario", nome: "Beneficiário exemplo", tipoCadastro: "BENEFICIARIO" }),
  ]);

  render(await FornecedoresPage({}));

  expect(m.fornecedores).toHaveBeenCalledWith(expect.objectContaining({ include: expect.objectContaining({
    insumosPrincipais: expect.objectContaining({
      where: { ativo: true },
      select: { id: true, nome: true, especificacao: true },
    }),
    insumosHomologados: expect.objectContaining({
      where: { insumo: { ativo: true } },
      select: { insumo: { select: { id: true, nome: true, especificacao: true } } },
    }),
  }) }));
  expect(m.tabela.mock.calls[0][0].fornecedores).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "distribuidora", insumosVinculados: [acucar, farinha, sal], quantidadeInsumos: 3 }),
    expect.objectContaining({ id: "vazio", insumosVinculados: [], quantidadeInsumos: 0 }),
  ]));
  expect(screen.getByLabelText("Vínculos de Distribuidora Exemplo").textContent).toBe("Açúcar, Farinha legado, Sal homologado");
  expect(screen.getByLabelText("Vínculos de Fornecedor sem vínculos").textContent).toBe("");
});

it("usa os vínculos recarregados quando um insumo deixa de aparecer na consulta", async () => {
  m.fornecedores.mockResolvedValueOnce([
    fornecedor({ insumosPrincipais: [farinha], insumosHomologados: [{ insumo: sal }] }),
  ]).mockResolvedValueOnce([fornecedor({ insumosPrincipais: [farinha] })]);

  const tela = render(await FornecedoresPage({}));
  expect(screen.getByLabelText("Vínculos de Distribuidora Exemplo").textContent).toBe("Farinha legado, Sal homologado");
  expect(m.tabela.mock.calls.at(-1)?.[0].fornecedores[0].quantidadeInsumos).toBe(2);

  tela.rerender(await FornecedoresPage({}));
  expect(m.fornecedores).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText("Vínculos de Distribuidora Exemplo").textContent).toBe("Farinha legado");
  expect(m.tabela.mock.calls.at(-1)?.[0].fornecedores[0].quantidadeInsumos).toBe(1);
});

it("exige autorização antes de consultar cadastros e vínculos", async () => {
  m.exigirPermissao.mockRejectedValueOnce(Error("Sem acesso a fornecedores"));

  await expect(FornecedoresPage({})).rejects.toThrow("Sem acesso a fornecedores");
  expect(m.exigirPermissao).toHaveBeenCalledExactlyOnceWith("fornecedores");
  expect(m.fornecedores).not.toHaveBeenCalled();
  expect(m.canais).not.toHaveBeenCalled();
  expect(m.pagamentos).not.toHaveBeenCalled();
  expect(m.tabela).not.toHaveBeenCalled();
});
