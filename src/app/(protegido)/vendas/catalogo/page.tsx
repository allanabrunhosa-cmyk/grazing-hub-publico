import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { consultarProdutos } from "@/lib/vendas/consultas";
import { CatalogoVenda } from "./catalogo-client";
export default async function CatalogoPage() {
  await exigirPermissao("vendas.catalogo");
  const [dados, adicionar, editar, adicionarComplemento, editarComplemento, podeCadastrarInsumo] = await Promise.all([consultarProdutos(), podeAcessar("vendas.catalogo", "adicionar"), podeAcessar("vendas.catalogo", "editar"), podeAcessar("vendas.produtos", "adicionar"), podeAcessar("vendas.produtos", "editar"), podeAcessar("insumos", "adicionar")]);
  return <CatalogoVenda dados={dados} dadosComplementos={dados} adicionar={adicionar} editar={editar} adicionarComplemento={adicionarComplemento} editarComplemento={editarComplemento} podeCadastrarInsumo={podeCadastrarInsumo} />;
}
