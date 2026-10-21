"use client";

import { useRef, useState, useTransition, type ReactElement } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Loader2, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { importInsumosAction, type ImportInsumoRow, type ImportSummary } from "@/app/(protegido)/insumos/actions";
import { INSUMO_CSV_EXEMPLO, downloadCsv } from "@/app/(protegido)/insumos/csv";

export function ImportInsumosDialog({ trigger }: { trigger: ReactElement }) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportInsumoRow[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetState() {
    setFileName(null);
    setRows([]);
    setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSummary(null);
    setFileName(file.name);

    Papa.parse<ImportInsumoRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (result) => {
        setRows(result.data);
      },
      error: () => {
        toast.error("Não foi possível ler o arquivo CSV.");
        resetState();
      },
    });
  }

  function handleImport() {
    if (rows.length === 0) return;
    startTransition(async () => {
      const result = await importInsumosAction(rows);
      setSummary(result);
      if (result.erros.length === 0) {
        toast.success(`${result.criados} criado(s), ${result.atualizados} atualizado(s).`);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetState();
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar catálogo global</DialogTitle>
          <DialogDescription>
            Envie uma planilha CSV. Itens com o mesmo nome já cadastrado são atualizados. A composição de preparações
            não é importada por CSV — monte a receita na tela.
          </DialogDescription>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">Na coluna marcasHomologadas, use uma lista como {'["União", "Da Barra"]'}. Use [] para remover todas. A coluna marca dos arquivos antigos continua aceita e preserva as demais marcas já homologadas.</p>

        <Button type="button" variant="outline" onClick={() => downloadCsv("modelo-catalogo-global.csv", [INSUMO_CSV_EXEMPLO])}>
          <Download className="size-4" />
          Baixar modelo de planilha
        </Button>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-accent">
          <Upload className="size-5" />
          {fileName ?? "Clique para escolher o arquivo .csv"}
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
        </label>

        {rows.length > 0 && !summary && (
          <p className="text-sm text-muted-foreground">{rows.length} linha(s) encontrada(s) no arquivo.</p>
        )}

        {summary && (
          <div className="space-y-1 rounded-lg border p-3 text-sm">
            <p>
              <strong>{summary.criados}</strong> criado(s), <strong>{summary.atualizados}</strong> atualizado(s).
            </p>
            {summary.erros.length > 0 && (
              <div className="text-destructive">
                <p className="font-medium">{summary.erros.length} linha(s) com erro:</p>
                <ul className="list-inside list-disc">
                  {summary.erros.slice(0, 8).map((erro, i) => (
                    <li key={i}>
                      Linha {erro.linha}: {erro.mensagem}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Fechar</DialogClose>
          <Button type="button" onClick={handleImport} disabled={pending || rows.length === 0}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Importar {rows.length > 0 ? `(${rows.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
