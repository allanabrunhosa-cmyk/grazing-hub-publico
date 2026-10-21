import { validarPorcao, type SalvarPorcaoInput } from "@/lib/insumos/porcoes";
import { categoriasPorcoes, porcoesFicticias } from "./porcoes-dados";
import { validarOrdemCategoriasPorcoes, type OrdemCategoriaPorcoesInput } from "@/lib/insumos/ordem-categorias-porcoes";
let lista = [...porcoesFicticias];

export async function listarPorcoesAction(insumoId: string) { return { porcoes: lista.filter(p => p.insumoId === insumoId), podeCadastrar: true }; }
const falhasSimuladas = new Set<string>();
export async function consultarPorcoesNoCliente(insumoId: string) {
  if (insumoId === "bandeja-ficticia" && new URLSearchParams(window.location.search).has("falha") && !falhasSimuladas.has(insumoId)) {
    falhasSimuladas.add(insumoId);
    throw new TypeError("Falha de conexão simulada.");
  }
  return listarPorcoesAction(insumoId);
}
export async function salvarPorcaoAction(entrada: SalvarPorcaoInput) {
  const resultado = validarPorcao(entrada);
  if ("erro" in resultado) return resultado;
  const porcao = { ...resultado.porcao, id: entrada.id ?? `porcao-ficticia-${lista.length + 1}`, versao: (entrada.versao ?? 0) + 1 };
  lista = [...lista.filter(p => p.id !== porcao.id), porcao];
  return { sucesso: true as const, porcao };
}
export async function removerPorcaoAction({ id }: { id: string; versao: number }) { lista = lista.filter(p => p.id !== id); return { sucesso: true as const }; }
export async function reordenarCategoriasPorcoesAction(entrada: OrdemCategoriaPorcoesInput[]) {
  const validado = validarOrdemCategoriasPorcoes(entrada);
  if ("erro" in validado) return validado;
  const atualizadas = validado.map((item, ordem) => ({ ...categoriasPorcoes.find(c => c.id === item.id)!, ordem, versao: item.versao + 1 }));
  return { categorias: categoriasPorcoes.map(c => atualizadas.find(a => a.id === c.id) ?? c).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR")) };
}
export async function saveInsumoAction() { return { error: "Cadastro indisponível nesta prévia isolada." }; }

export async function salvarFormaPagamentoVendaAction() { return { erro: "Prévia isolada: nenhum cadastro é gravado." }; }
export async function alterarStatusCadastroVendaAction() { return { erro: "Prévia isolada: nenhum cadastro é gravado." }; }
export async function alterarSituacaoProdutoVendaAction() { return { erro: "Prévia isolada: nenhum cadastro é gravado." }; }
