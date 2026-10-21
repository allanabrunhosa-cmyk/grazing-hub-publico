"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/app/(protegido)/fornecedores/csv";
import type { FornecedorRow } from "@/app/(protegido)/fornecedores/types";

export function ExportFornecedoresButton({ fornecedores }: { fornecedores: FornecedorRow[] }) {
  function handleExport() {
    const rows = fornecedores.map((f) => ({
      nome: f.nome,
      razaoSocial: f.razaoSocial ?? "",
      cnpj: f.cnpj ?? "",
      email: f.email ?? "",
      site: f.site ?? "",
      contatoNome: f.contatoNome ?? "",
      telefone: f.telefone ?? "",
      canaisPedido: f.canaisPedido.map((c) => c.nome).join(";"),
      formasPagamento: f.formasPagamento.map((p) => p.nome).join(";"),
      prazoPagamentoDias: f.prazoPagamentoDias?.toString() ?? "",
      prazoEntregaDias: f.prazoEntregaDias?.toString() ?? "",
      status: f.ativo ? "ativo" : "inativo",
      observacoes: f.observacoes ?? "",
    }));
    downloadCsv("fornecedores.csv", rows);
  }

  return (
    <Button type="button" variant="outline" onClick={handleExport} disabled={fornecedores.length === 0}>
      <Download className="size-4" />
      Exportar
    </Button>
  );
}
