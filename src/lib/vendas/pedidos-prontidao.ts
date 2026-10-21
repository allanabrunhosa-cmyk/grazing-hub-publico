import "server-only";
import type { UnidadeMedida } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { precoObrigatorioNaConfiguracao } from "./dominio";
import { consultarProdutos } from "./consultas";
import { fatorDaUnidade } from "@/lib/insumos/conversoes";

export function detectarCicloComposicao(id: string, grafo: Map<string, string[]>, caminho = new Set<string>()): boolean {
  if (caminho.has(id)) return true;
  const proximo = new Set(caminho).add(id);
  return (grafo.get(id) ?? []).some(filho => detectarCicloComposicao(filho, grafo, proximo));
}

// Leitura da base selecionada pelo ambiente. Não preenche composição, custo ou saldo.
export async function consultarProntidaoProdutos() {
  const dados = await consultarProdutos();
  const [insumos, locais] = await Promise.all([
    prisma.insumo.findMany({ include: { conversoes: true, componentes: true } }),
    prisma.localEstoque.findMany({ where: { ativo: true }, select: { id: true, nome: true } }),
  ]);
  const grafo = new Map(insumos.map(i => [i.id, i.componentes.map(c => c.componenteId)]));
  return dados.produtos.map(p => {
    const problemas: string[] = []; const pendenciasCusto: string[] = [];
    const verificar = (produto: typeof p, prefixo: string) => {
      if (!produto.componentes.length) problemas.push(`${prefixo}: composição não cadastrada.`);
      for (const c of produto.componentes) {
        const i = insumos.find(v => v.id === c.insumoId);
        if (!i?.ativo) { problemas.push(`${prefixo}: insumo ${c.insumoId} ausente/inativo.`); continue; }
        if (!Number.isFinite(Number(c.quantidade)) || Number(c.quantidade) <= 0 || fatorDaUnidade(c.unidade as UnidadeMedida, i.unidade, i.conversoes.map(v => ({ unidade: v.unidade, fator: Number(v.fator) }))) == null) problemas.push(`${prefixo}: ${i.nome} exige quantidade/conversão válida.`);
        if (detectarCicloComposicao(i.id, grafo)) problemas.push(`${prefixo}: ciclo na preparação ${i.nome}.`);
        if (i.tipo === "PRODUTO_INTERMEDIARIO" && (!i.rendimentoQuantidade?.gt(0) || !i.rendimentoUnidade)) problemas.push(`${prefixo}: rendimento de ${i.nome} pendente.`);
        if (dados.insumos.find(v => v.id === i.id)?.custo == null) pendenciasCusto.push(`${prefixo}: custo de ${i.nome} pendente.`);
      }
    };
    verificar(p, p.nome);
    for (const vinculo of p.grupos) {
      const grupo = dados.grupos.find(g => g.id === vinculo.grupoId);
      if (!grupo) { problemas.push(`Grupo ${vinculo.grupoId} ausente.`); continue; }
      for (const opcao of grupo.opcoes.filter(o => o.ativo && !vinculo.opcoesExcluidas.includes(o.id))) {
        if (!opcao.produtoId) { problemas.push(`Opção ${opcao.nome}: vínculo de composição pendente.`); continue; }
        const produto = dados.produtos.find(v => v.id === opcao.produtoId);
        if (!produto?.ativo) problemas.push(`Opção ${opcao.nome}: produto inativo/ausente.`);
        else verificar(produto, `Opção ${opcao.nome}`);
      }
    }
    return { id: p.id, nome: p.nome, versao: p.versao, vendavel: p.ativo && (Number(p.preco) > 0 || precoObrigatorioNaConfiguracao(dados.grupos, p.grupos)), composicaoValidada: problemas.length === 0, aptoFisicoCadastral: problemas.length === 0 && locais.length > 0, custoEstimadoDisponivel: problemas.length === 0 && pendenciasCusto.length === 0, custoPorMovimentos: null, problemas: [...new Set([...problemas, ...pendenciasCusto, ...(locais.length ? [] : ["Nenhum local ativo cadastrado."])])], acao: "Revisar produto, opções e ficha nos cadastros existentes. Conferir locais e estoque com responsável; não ajustar saldos para eliminar pendência." };
  });
}
