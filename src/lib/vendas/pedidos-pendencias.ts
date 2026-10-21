import { limitesEfetivos, opcoesEfetivas } from "./dominio";
import type { DadosProdutos } from "./consultas";
import { quantidadeComercial, type PedidoEntrada } from "./pedidos-dominio";

type Pendencia = { seletor: string; mensagem: string };
const campoEndereco = (chave: string, mensagem: string): Pendencia => ({ seletor: `[data-endereco-campo="${chave}"]`, mensagem });

/** Localiza campos da regra existente; o servidor continua sendo a autoridade. */
export function pendenciaEnderecoPedido(endereco: PedidoEntrada["endereco"], completo = true): Pendencia | null {
  const brasileiro = (endereco?.pais ?? "Brasil").trim().toLocaleLowerCase("pt-BR") === "brasil";
  if (completo && !endereco?.pais?.trim()) return campoEndereco("pais", "Informe o país do endereço.");
  if (completo && (!endereco?.cep?.trim() || brasileiro && !/^\d{8}$/.test(endereco.cep.replace(/\D/g, "")))) return campoEndereco("cep", brasileiro ? "Informe um CEP brasileiro com oito dígitos." : "Informe o código postal.");
  if (!endereco?.numero?.trim()) return campoEndereco("numero", "Informe o número do endereço.");
  for (const chave of completo ? ["logradouro", "bairro", "cidade", "uf"] as const : ["logradouro", "cidade"] as const) {
    if (!endereco?.[chave]?.trim()) return campoEndereco(brasileiro ? "cep" : chave, brasileiro ? "Confira o CEP para preencher logradouro, bairro, cidade e estado." : "Preencha os campos obrigatórios do endereço.");
  }
  return null;
}

export function pendenciaItensPedido(pedido: PedidoEntrada, catalogo: Pick<DadosProdutos, "produtos" | "grupos">): Pendencia | null {
  if (!pedido.itens.length) return { seletor: '[data-pedido-campo="adicionar-produto"]', mensagem: "Adicione ao menos um produto antes de confirmar." };
  for (const [indice, item] of pedido.itens.entries()) {
    const produto = catalogo.produtos.find(p => p.id === item.produtoId);
    if (!produto) return { seletor: `[data-pedido-item="${indice}"] [role="combobox"]`, mensagem: "Selecione o produto." };
    try { quantidadeComercial(item.quantidade, item.complementoAvulso ? "UN" : produto.unidade); }
    catch (erro) { return { seletor: `[data-pedido-quantidade="${indice}"]`, mensagem: erro instanceof Error ? erro.message : "Informe uma quantidade válida." }; }
    if (item.complementoAvulso) continue;
    for (const [grupoIndice, vinculo] of produto.grupos.entries()) {
      const grupo = catalogo.grupos.find(g => g.id === vinculo.grupoId);
      if (!grupo) continue; // Indisponibilidade é revalidada no servidor.
      const limites = limitesEfetivos(grupo, vinculo);
      if (!limites.minimo) continue;
      const opcoes = opcoesEfetivas(grupo.opcoes, vinculo).filter(o => grupo.ativo && o.ativo);
      const selecionadas = opcoes.reduce((soma, opcao) => soma + (item.escolhas[opcao.id] ?? 0), 0);
      const repeticao = !grupo.repetir && opcoes.some(o => (item.escolhas[o.id] ?? 0) > 1);
      if (!grupo.ativo || selecionadas < limites.minimo || limites.maximo !== null && selecionadas > limites.maximo || repeticao) {
        return { seletor: `[data-pedido-grupo="${indice}-${grupoIndice}"]`, mensagem: repeticao ? `${grupo.nome}: escolha cada opção no máximo uma vez.` : `${grupo.nome}: selecione ${limites.minimo}${limites.maximo === null ? " ou mais" : limites.maximo === limites.minimo ? "" : ` a ${limites.maximo}`} complemento(s) no grupo inteiro.` };
      }
    }
  }
  return null;
}
