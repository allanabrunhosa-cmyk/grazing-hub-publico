import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { consultarProdutos } from "@/lib/vendas/consultas";
import { entidadeInicial } from "@/lib/atividades/entidade-inicial";
import { ProdutosVenda } from "./produtos-client";
import { ImportacaoCatalogo } from "../importacao/importacao-client";
import { obterRegimeFiscalEmpresaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regime-empresa";
export default async function ProdutosPage({ searchParams }: { searchParams: Promise<{ situacao?: string; entidade?: string | string[] }> }) {
  await exigirPermissao("vendas.produtos");
  const [adicionar, editar, adicionarCatalogo, editarCatalogo, podeCadastrarInsumo, podeVerFiscal, podeEditarFiscal, podeVerImportacao, podeAdicionarImportacao] = await Promise.all([podeAcessar("vendas.produtos", "adicionar"), podeAcessar("vendas.produtos", "editar"), podeAcessar("vendas.catalogo", "adicionar"), podeAcessar("vendas.catalogo", "editar"), podeAcessar("insumos", "adicionar"), podeAcessar("vendas.fiscal", "visualizar"), podeAcessar("vendas.fiscal", "editar"), podeAcessar("vendas.importacao", "visualizar"), podeAcessar("vendas.importacao", "adicionar")]);
  const [dados, regime] = await Promise.all([consultarProdutos(podeVerFiscal), podeVerFiscal ? obterRegimeFiscalEmpresaBrasilNfe() : Promise.resolve(null)]);
  if (!await podeAcessar("financeiro.custos", "visualizar")) dados.insumos = dados.insumos.map(i=>({ ...i, custo: null }));
  const parametros = await searchParams;
  const entidadeId = entidadeInicial(parametros.entidade);
  const entidadeInicialId = dados.produtos.some(p => p.id === entidadeId) ? entidadeId : undefined;
  const situacaoInicial = parametros.situacao === "inativos" || parametros.situacao === "todos" ? parametros.situacao : "ativos";
  const importar = podeVerImportacao && podeAdicionarImportacao && adicionar && editar && adicionarCatalogo && editarCatalogo;
  return <div className="space-y-6"><ProdutosVenda key={entidadeInicialId ?? "lista"} dados={dados} adicionar={adicionar} editar={editar} adicionarCatalogo={adicionarCatalogo} editarCatalogo={editarCatalogo} podeCadastrarInsumo={podeCadastrarInsumo} podeVerFiscal={podeVerFiscal} podeEditarFiscal={podeEditarFiscal} situacaoInicial={situacaoInicial} entidadeInicialId={entidadeInicialId} crt={regime?.crt} />{podeVerImportacao && <details id="importar-catalogo" className="rounded-2xl border bg-card p-4"><summary className="cursor-pointer font-medium">Importação do catálogo</summary><div className="mt-4"><ImportacaoCatalogo aplicar={importar} /></div></details>}</div>;
}
