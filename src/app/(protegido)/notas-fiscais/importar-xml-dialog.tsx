"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { importarXmlPelaApi } from "@/lib/notas-fiscais/api-cliente";

export function ImportarXmlDialog() {
  const router = useRouter();
  const [aberto, definirAberto] = useState(false);
  const [arquivo, definirArquivo] = useState<File | null>(null);
  const [importando, iniciarImportacao] = useTransition();

  function importar() {
    if (!arquivo) return;
    iniciarImportacao(async () => {
      try {
        const formulario = new FormData();
        formulario.set("arquivo", arquivo);
        const resultado = await importarXmlPelaApi(formulario);
        if ("erro" in resultado) { toast.error(resultado.erro); return; }
        toast.success(resultado.mensagem);
        definirArquivo(null);
        definirAberto(false);
        router.refresh();
      } catch {
        toast.error("Não foi possível importar o XML.", { description: "Verifique sua conexão e tente novamente." });
      }
    });
  }

  return <Dialog open={aberto} onOpenChange={(valor) => { if (!importando) { definirAberto(valor); definirArquivo(null); } }}>
    <DialogTrigger render={<Button type="button" variant="outline"><FileUp className="size-4" />Importar XML</Button>} />
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Importar XML de nota fiscal</DialogTitle>
        <DialogDescription>Selecione o XML completo da NF-e autorizada, destinado à sua empresa. A nota será adicionada à lista ou terá o XML faltante preenchido.</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="arquivo-xml-avulso">Arquivo XML (até 800 KB)</Label>
        <Input id="arquivo-xml-avulso" type="file" accept=".xml,text/xml,application/xml" disabled={importando} onChange={(evento) => definirArquivo(evento.target.files?.[0] ?? null)} />
        <p className="text-xs text-muted-foreground">A importação não aceita a nota nem movimenta estoque ou financeiro. Notas repetidas não são duplicadas.</p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={importando} onClick={() => definirAberto(false)}>Cancelar</Button>
        <Button type="button" disabled={importando || !arquivo} onClick={importar}>{importando && <Loader2 className="size-4 animate-spin" />}Importar arquivo</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
