"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { RelatorioFinanceiro } from "@/lib/financeiro/exportacao-relatorios";

export function ExportarRelatorioButton({ obterRelatorio }: { obterRelatorio: () => RelatorioFinanceiro }) {
  const [exportando, setExportando] = useState(false);
  const ocupado = useRef(false);
  async function exportar(formato: "pdf" | "xlsx") {
    if (ocupado.current) return;
    ocupado.current = true;
    setExportando(true);
    try {
      // Captura antes do carregamento: trocar filtros durante o download não altera o arquivo solicitado.
      const relatorio = obterRelatorio();
      if (formato === "pdf") {
        const { baixarPdfFinanceiro } = await import("@/lib/financeiro/exportacao-pdf");
        baixarPdfFinanceiro(relatorio);
      } else {
        const { baixarXlsxFinanceiro } = await import("@/lib/financeiro/exportacao-xlsx");
        baixarXlsxFinanceiro(relatorio);
      }
    } catch {
      toast.error("Não foi possível exportar o relatório. Tente novamente ou reduza o período.");
    } finally {
      ocupado.current = false;
      setExportando(false);
    }
  }
  return <DropdownMenu>
    <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" className="h-9!" disabled={exportando} aria-busy={exportando} />}>
      {exportando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      {exportando ? "Exportando…" : "Exportar"}
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem disabled={exportando} onClick={() => void exportar("pdf")}><FileText />PDF</DropdownMenuItem>
      <DropdownMenuItem disabled={exportando} onClick={() => void exportar("xlsx")}><FileSpreadsheet />XLSX</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
