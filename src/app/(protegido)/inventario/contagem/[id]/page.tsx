
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ContagemForm } from "@/app/(protegido)/inventario/contagem/[id]/contagem-form";
import type { ContagemDetalhe, ContagemItemRow } from "@/app/(protegido)/inventario/types";
import { fornecedoresDoInsumo } from "@/lib/insumos/fornecedores";
import { marcasDoInsumo } from "@/lib/insumos/marcas";

export default async function ContagemDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirPermissao("inventario.contagem");
  const { id } = await params;

  const contagem = await prisma.inventarioContagem.findUnique({
    where: { id },
    include: {
      local: { select: { nome: true } },
      itens: {
        include: {
          insumo: {
            select: {
              nome: true,
              especificacao: true,
              unidade: true,
              estoqueMinimo: true,
              estoqueMaximo: true,
              conversoes: { select: { unidade: true, fator: true }, orderBy: { unidade: "asc" } },
              tipoEstoque: true,
              marca: true,
              marcasHomologadas: true,
              fornecedorPrincipal: { select: { id: true, nome: true } },
              fornecedoresHomologados: { select: { fornecedor: { select: { id: true, nome: true } } } },
            },
          },
        },
        orderBy: { insumo: { nome: "asc" } },
      },
    },
  });

  if (!contagem) notFound();

  // Fronteira da contagem cega: enquanto EM_ANDAMENTO, quantidadeSistema nunca entra no
  // payload mandado pro client — não é só escondido na tela, o valor nem trafega.
  const itens: ContagemItemRow[] = contagem.itens.map((item) => ({
    id: item.id,
    insumoId: item.insumoId,
    nome: item.insumo.nome,
    especificacao: item.insumo.especificacao,
    unidade: item.insumo.unidade,
    estoqueMinimo: Number(item.insumo.estoqueMinimo),
    estoqueMaximo: item.insumo.estoqueMaximo == null ? null : Number(item.insumo.estoqueMaximo),
    conversoes: item.insumo.conversoes.map((conversao) => ({ ...conversao, fator: Number(conversao.fator) })),
    tipoEstoque: item.insumo.tipoEstoque,
    fornecedores: fornecedoresDoInsumo({ fornecedorPrincipal: item.insumo.fornecedorPrincipal, fornecedoresHomologados: item.insumo.fornecedoresHomologados.map(v => v.fornecedor) }).map(f => f.nome),
    marcas: marcasDoInsumo(item.insumo),
    contado: item.contado,
    ajustado: item.ajustado,
    quantidadeContada: item.contado ? Number(item.quantidadeContada) : null,
    quantidadeSistema: (contagem.status === "FINALIZADO" || contagem.ajustesEstornados) ? Number(item.quantidadeSistema) : null,
  }));

  const detalhe: ContagemDetalhe = {
    id: contagem.id,
    localNome: contagem.local.nome,
    dataContagem: contagem.dataContagem.toISOString(),
    status: contagem.status,
    itens,
    exclusao: contagem.excluidaEm ? { data: contagem.excluidaEm.toISOString(), autor: contagem.excluidaPorNome ?? "Não informado", motivo: contagem.motivoExclusao, ajustesEstornados: contagem.ajustesEstornados } : null,
  };

  return <ContagemForm contagem={detalhe} administrador={sessao.admin} />;
}
