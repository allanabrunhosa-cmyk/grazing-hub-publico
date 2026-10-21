
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { Warehouse } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { obterUsuarioInventario } from "@/lib/estoque/consultar-perdas";
import { Card, CardContent } from "@/components/ui/card";
import { PosicaoAtualTable } from "@/app/(protegido)/inventario/posicao-atual-table";
import { calcularPosicaoHistorica, chavePosicao, fimDoDia } from "@/lib/estoque/posicao";
import type { LocalOption, PosicaoAtualRow } from "@/app/(protegido)/inventario/types";
import { permissaoEfetiva } from "@/lib/permissoes/catalogo";

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const sessao = await exigirPermissao("inventario");
  const podeCadastrarInsumo = sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "insumos", "adicionar");
  const { data } = await searchParams;
  const hoje = hojeISO();
  const dataSelecionada = data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : hoje;
  const isHistorico = dataSelecionada !== hoje;

  const [locais, insumos, usuario, categoriasPerda] = await Promise.all([
    prisma.localEstoque.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.insumo.findMany({
      where: isHistorico ? { OR: [{ ativo: true }, { excluidoEm: { not: null } }] } : { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, tipo: true, especificacao: true, marca: true, marcasHomologadas: true,
        categoria: { select: { nome: true } },
        fornecedoresHomologados: { select: { fornecedor: { select: { id: true, nome: true } } } },
        unidade: true, estoqueMinimo: true, estoqueMaximo: true, custoMedio: true },
    }),
    obterUsuarioInventario(),
    prisma.categoriaPerda.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true, ativo: true, codigoLegado: true } }),
  ]);

  if (locais.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <Warehouse className="size-8 text-muted-foreground" />
          <p className="font-medium">Cadastre um local de estoque pra começar.</p>
          <p className="text-sm text-muted-foreground">Use o botão &quot;Locais&quot; no topo da página.</p>
        </CardContent>
      </Card>
    );
  }

  const saldosPorInsumo = new Map<string, Record<string, number>>();

  if (isHistorico) {
    const saldoPorChave = await calcularPosicaoHistorica(fimDoDia(dataSelecionada));
    for (const insumo of insumos) {
      const porLocal: Record<string, number> = {};
      for (const local of locais) {
        porLocal[local.id] = saldoPorChave.get(chavePosicao(insumo.id, local.id)) ?? 0;
      }
      saldosPorInsumo.set(insumo.id, porLocal);
    }
  } else {
    const saldos = await prisma.saldoEstoque.findMany({ select: { insumoId: true, localId: true, quantidadeAtual: true } });
    for (const saldo of saldos) {
      const mapa = saldosPorInsumo.get(saldo.insumoId) ?? {};
      mapa[saldo.localId] = Number(saldo.quantidadeAtual);
      saldosPorInsumo.set(saldo.insumoId, mapa);
    }
  }

  const rows: PosicaoAtualRow[] = insumos.map((insumo) => ({
    insumoId: insumo.id,
    nome: insumo.nome,
    tipo: insumo.tipo,
    marca: insumo.marca,
    marcasHomologadas: insumo.marcasHomologadas,
    categoriaNome: insumo.categoria?.nome ?? null,
    fornecedoresHomologados: insumo.fornecedoresHomologados.map((vinculo) => vinculo.fornecedor),
    especificacao: insumo.especificacao,
    unidade: insumo.unidade,
    estoqueMinimo: Number(insumo.estoqueMinimo),
    estoqueMaximo: insumo.estoqueMaximo != null ? Number(insumo.estoqueMaximo) : null,
    custoMedio: Number(insumo.custoMedio),
    saldosPorLocal: saldosPorInsumo.get(insumo.id) ?? {},
  }));

  const locaisOptions: LocalOption[] = locais;

  return (
    <PosicaoAtualTable
      linhas={rows}
      locais={locaisOptions}
      dataSelecionada={dataSelecionada}
      hoje={hoje}
      isHistorico={isHistorico}
      responsavelNome={usuario?.nome}
      podeCadastrarInsumo={podeCadastrarInsumo}
      categoriasPerda={categoriasPerda}
    />
  );
}
