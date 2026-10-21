import { classificacaoComercial } from "./classificacao";
import { opcoesEfetivas, type ProdutoEntrada, type GrupoEntrada } from "./dominio";

export type GrupoDisponibilidade = GrupoEntrada & { id: string };
/** Mostra vínculos existentes, inclusive pausados e excluídos no produto. */
export function disponibilidadeDoCadastro(cadastroId: string, produtos: ProdutoEntrada[], grupos: GrupoDisponibilidade[]) {
  return grupos.flatMap(grupo => grupo.opcoes.filter(o => o.produtoId === cadastroId).flatMap(opcao => {
    const destinos = produtos.filter(p => p.grupos.some(v => v.grupoId === grupo.id));
    return destinos.length ? destinos.map(produto => {
      const vinculo = produto.grupos.find(v => v.grupoId === grupo.id)!;
      const efetiva = opcoesEfetivas([opcao], vinculo)[0];
      const ajuste = vinculo.ajustesOpcoes?.find(a => a.opcaoId === opcao.id);
      const fonte = produtos.find(p => p.id === cadastroId);
      const aliasComposicao = grupo.tipo === "COMPOSICAO" && !!efetiva.composicao?.length;
      const motivo = !produto.ativo ? "Produto inativo" : classificacaoComercial(produto) !== "PRINCIPAL" ? "Sem venda avulsa" : !grupo.ativo ? "Grupo inativo" : !fonte || !fonte.ativo && !aliasComposicao ? "Cadastro inativo" : !opcao.ativo ? "Escolha pausada no grupo" : !efetiva.ativo ? "Indisponível neste produto" : "Disponível";
      return { grupoId: grupo.id, grupoNome: grupo.nome, opcaoId: opcao.id, produtoId: produto.id, produtoNome: produto.nome, motivo, composicao: ajuste?.composicao != null ? "Específica deste produto" : opcao.composicao != null ? "Específica do grupo" : "Padrão do cadastro" };
    }) : [{ grupoId: grupo.id, grupoNome: grupo.nome, opcaoId: opcao.id, produtoId: "", produtoNome: "Sem produto vinculado", motivo: "Grupo sem produto", composicao: opcao.composicao != null ? "Específica do grupo" : "Padrão do cadastro" }];
  }));
}
