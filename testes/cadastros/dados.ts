import type { InsumoRow } from "@/app/(protegido)/insumos/types";
import type { FornecedorRow } from "@/app/(protegido)/fornecedores/types";

export const insumoStatus: InsumoRow = {
  id: "farinha", nome: "Farinha de trigo", tipo: "INSUMO", unidade: "KG", marca: null, codigoEan: null,
  perecivel: false, validadePadraoDias: null, estoqueMinimo: 2, estoqueMaximo: null, custoMedio: 5,
  fornecedorPrincipalId: null, tipoEstoque: "SECO", observacoes: null, rendimentoQuantidade: null,
  rendimentoUnidade: null, ativo: true, createdAt: new Date(), updatedAt: new Date(), categoria: null,
  centroCusto: null, fornecedorPrincipal: null, fornecedoresHomologados: [], componentes: [], temFoto: false, conversoes: [],
};
export const fornecedorStatus: FornecedorRow = {
  id: "serra", tipoCadastro: "FORNECEDOR", nome: "Laticínios Serra", razaoSocial: "Laticínios Serra Comércio de Alimentos", cnpj: null, cpf: null,
  contatoNome: null, email: null, telefone: null, site: null, prazoPagamentoDias: null, prazoEntregaDias: null,
  observacoes: null, ativo: true, createdAt: new Date(), updatedAt: new Date(),
  canaisPedido: [], formasPagamento: [], insumosVinculados: [],
};
