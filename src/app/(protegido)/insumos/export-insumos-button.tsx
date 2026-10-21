"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/app/(protegido)/insumos/csv";
import type { InsumoRow } from "@/app/(protegido)/insumos/types";
import { marcasDoInsumo } from "@/lib/insumos/marcas";

export function ExportInsumosButton({ insumos }: { insumos: InsumoRow[] }) {
  function handleExport() {
    const rows = insumos.map((i) => ({
      nome: i.nome,
      especificacao: i.especificacao ?? "",
      tipo: i.tipo === "PRODUTO_INTERMEDIARIO" ? "produto_intermediario" : "insumo",
      categoria: i.categoria?.nome ?? "",
      unidade: i.unidade,
      centroCusto: i.centroCusto?.nome ?? "",
      marca: i.marca ?? "",
      marcasHomologadas: JSON.stringify(marcasDoInsumo(i)),
      codigoEan: i.codigoEan ?? "",
      perecivel: i.perecivel ? "sim" : "não",
      validadePadraoDias: i.validadePadraoDias?.toString() ?? "",
      estoqueMinimo: i.estoqueMinimo.toString(),
      estoqueMaximo: i.estoqueMaximo?.toString() ?? "",
      custoMedio: i.tipo === "PRODUTO_INTERMEDIARIO" ? "" : i.custoMedio?.toString() ?? "",
      fornecedorPrincipal: i.fornecedorPrincipal?.nome ?? "",
      status: i.ativo ? "ativo" : "inativo",
    }));
    downloadCsv("catalogo-global.csv", rows);
  }

  return (
    <Button type="button" variant="outline" onClick={handleExport} disabled={insumos.length === 0}>
      <Download className="size-4" />
      Exportar
    </Button>
  );
}
