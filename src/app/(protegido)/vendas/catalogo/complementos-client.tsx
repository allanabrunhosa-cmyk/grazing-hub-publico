"use client";
import type { DadosProdutos } from "@/lib/vendas/consultas";
import { ProdutosVenda } from "../produtos/produtos-client";
import { EditorComplemento } from "./editor-complemento";

export { EditorComplemento } from "./editor-complemento";
export function ComplementosLista({ dados, adicionar, editar, adicionarCatalogo = false, editarCatalogo = false, podeCadastrarInsumo = false }: { dados: DadosProdutos; adicionar: boolean; editar: boolean; adicionarCatalogo?: boolean; editarCatalogo?: boolean; podeCadastrarInsumo?: boolean }) {
  return <ProdutosVenda dados={dados} adicionar={adicionar} editar={editar} adicionarCatalogo={adicionarCatalogo} editarCatalogo={editarCatalogo} complementos semCabecalho renderEditor={(inicial, fechar) => <EditorComplemento inicial={inicial} dados={dados} podeCadastrarInsumo={podeCadastrarInsumo} fechar={fechar} />} />;
}
