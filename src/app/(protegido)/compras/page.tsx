
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { PedidosView } from "@/app/(protegido)/compras/pedidos-view";
import type { FornecedorOption, InsumoComFornecedorOption, PedidoRow } from "@/app/(protegido)/compras/types";
import { permissaoEfetiva } from "@/lib/permissoes/catalogo";
import { entidadeInicial } from "@/lib/atividades/entidade-inicial";

export default async function ComprasPage({ searchParams }: { searchParams?: Promise<{ entidade?: string | string[] }> }) {
  const sessao = await exigirPermissao("compras");
  const entidadeId = entidadeInicial((await searchParams)?.entidade);
  const pode = (recurso: string) => sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, recurso, "adicionar");
  const [pedidosRaw, fornecedores, insumosRaw, cotacoesRaw] = await Promise.all([
    prisma.pedidoCompra.findMany({
      orderBy: { previsaoEntrega: "asc" },
      include: {
        fornecedor: { select: { id: true, nome: true } },
        historico: { orderBy: { criadoEm: "desc" } },
        itens: { where: { ativo: true }, include: { insumo: { select: { id: true, nome: true, especificacao: true } } } },
        recebimentos: {
          orderBy: { createdAt: "desc" },
          include: {
            itens: {
              include: {
                divergencias: true,
                pedidoItem: { include: { insumo: { select: { nome: true, especificacao: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.fornecedor.findMany({ where: { ativo: true, tipoCadastro: "FORNECEDOR" }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.insumo.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        especificacao: true,
        unidade: true,
        conversoes: { select: { unidade: true, fator: true }, orderBy: { unidade: "asc" } },
        custoMedio: true,
        fornecedorPrincipalId: true,
        fornecedoresHomologados: { select: { fornecedorId: true } },
      },
    }),
    prisma.cotacao.findMany({
      orderBy: { data: "desc" },
      select: { insumoId: true, fornecedorId: true, precoUnitario: true },
    }),
  ]);

  const fornecedoresOptions: FornecedorOption[] = fornecedores;
  const insumosOptions: InsumoComFornecedorOption[] = insumosRaw.map((i) => ({
    ...i,
    custoMedio: Number(i.custoMedio),
    conversoes: i.conversoes.map((conversao) => ({ ...conversao, fator: Number(conversao.fator) })),
    fornecedorIds: [...new Set([...i.fornecedoresHomologados.map((h) => h.fornecedorId), ...(i.fornecedorPrincipalId ? [i.fornecedorPrincipalId] : [])])],
  }));

  // Cotação mais recente por (insumo, fornecedor) — cotacoesRaw já vem ordenado por data desc,
  // então a primeira ocorrência de cada par é a mais recente.
  const cotacaoMaisRecente = new Map<string, number>();
  for (const c of cotacoesRaw) {
    const chave = `${c.insumoId}:${c.fornecedorId}`;
    if (!cotacaoMaisRecente.has(chave)) cotacaoMaisRecente.set(chave, Number(c.precoUnitario));
  }
  const cotacoes = Array.from(cotacaoMaisRecente.entries()).map(([chave, precoUnitario]) => {
    const [insumoId, fornecedorId] = chave.split(":");
    return { insumoId, fornecedorId, precoUnitario };
  });

  const pedidos: PedidoRow[] = pedidosRaw.map((p) => {
    const temDivergencia = p.recebimentos.some((r) => !r.reabertoEm && r.itens.some((i) => i.divergencias.length > 0));
    return {
      id: p.id,
      numero: p.numero,
      fornecedorId: p.fornecedorId,
      fornecedorNome: p.fornecedor?.nome ?? p.fornecedorAvulso ?? "Fornecedor avulso",
      fornecedorAvulso: p.fornecedorAvulso,
      usoConsumo: p.usoConsumo,
      excluidoEm: p.excluidoEm?.toISOString() ?? null,
      historico: p.historico.map(h => ({ ...h, criadoEm: h.criadoEm.toISOString() })),
      dataPedido: p.dataPedido.toISOString(),
      previsaoEntrega: p.previsaoEntrega ? p.previsaoEntrega.toISOString() : null,
      status: p.status,
      observacoes: p.observacoes,
      itens: p.itens.map((item) => ({
        id: item.id,
        insumoId: item.insumoId,
        insumoNome: item.descricao ?? item.insumo?.nome ?? "Item",
        insumoEspecificacao: item.descricao ? null : item.insumo?.especificacao ?? null,
        unidadeCompra: item.unidadeCompra,
        fatorConversao: item.fatorConversao == null ? null : Number(item.fatorConversao),
        unidadePrincipal: item.unidadePrincipal,
        quantidade: Number(item.quantidade),
        precoUnitario: item.precoUnitario != null ? Number(item.precoUnitario) : null,
        precoTotal: item.precoTotal != null ? Number(item.precoTotal) : null,
      })),
      recebimentos: p.recebimentos.map((r) => ({
        id: r.id,
        dataRecebimento: r.dataRecebimento.toISOString(),
        reabertoEm: r.reabertoEm?.toISOString() ?? null,
        tipo: r.tipo,
        responsavelNome: r.responsavelNome,
        itens: r.itens.map((ri) => ({
          id: ri.id,
          pedidoItemId: ri.pedidoItemId,
          insumoNome: ri.pedidoItem.descricao ?? ri.pedidoItem.insumo?.nome ?? "Item",
          insumoEspecificacao: ri.pedidoItem.descricao ? null : ri.pedidoItem.insumo?.especificacao ?? null,
          unidadeCompra: ri.pedidoItem.unidadeCompra,
          fatorConversao: ri.pedidoItem.fatorConversao == null ? null : Number(ri.pedidoItem.fatorConversao),
          unidadePrincipal: ri.pedidoItem.unidadePrincipal,
          quantidadeOrdenada: Number(ri.pedidoItem.quantidade),
          quantidadeRecebida: Number(ri.quantidadeRecebida),
          lote: ri.lote,
          validade: ri.validade ? ri.validade.toISOString() : null,
          qualidadeOk: ri.qualidadeOk,
          divergencias: ri.divergencias.map((d) => ({ tipo: d.tipo, descricao: d.descricao })),
        })),
      })),
      temDivergencia,
    };
  });

  const entidadeInicialId = pedidos.some(p => p.id === entidadeId) ? entidadeId : undefined;
  return <PedidosView key={entidadeInicialId ?? "lista"} entidadeInicialId={entidadeInicialId} pedidos={pedidos} fornecedores={fornecedoresOptions} insumos={insumosOptions} cotacoes={cotacoes} podeCadastrarFornecedor={pode("fornecedores")} podeCadastrarInsumo={pode("insumos")} />;
}
