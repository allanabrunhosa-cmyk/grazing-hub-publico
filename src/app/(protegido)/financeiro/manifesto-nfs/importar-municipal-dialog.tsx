"use client";

import { type FormEvent, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatarCpfCnpj } from "@/lib/documento-brasileiro";
import { dataCalendarioValida } from "@/lib/financeiro/cartoes";

export function ImportarMunicipalDialog({ aberto, aoFechar }: { aberto: boolean; aoFechar: (importada: boolean) => void }) {
  const [cnpjPrestador, setCnpjPrestador] = useState("");
  const [numero, setNumero] = useState("");
  const [dataEmissao, setDataEmissao] = useState("");
  const [codigoVerificacao, setCodigoVerificacao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const enviando = useRef(false);
  const podeEnviar = /^\d{14}$/.test(cnpjPrestador) && /^\d{1,12}$/.test(numero) && Number(numero) > 0
    && dataCalendarioValida(dataEmissao) && dataEmissao >= "2026-01-01" && /^[A-Z0-9]{8}$/.test(codigoVerificacao.replace(/-/g, ""));

  async function importar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!podeEnviar || enviando.current) return;
    enviando.current = true; setCarregando(true); setErro("");
    try {
      const resposta = await fetch("/api/nfse/importar-municipal", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ municipioCodigo: "3550308", cnpjPrestador, numero, dataEmissao, codigoVerificacao }) });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível importar a NFS-e municipal.");
      toast.success(resultado.mensagem);
      setCnpjPrestador(""); setNumero(""); setDataEmissao(""); setCodigoVerificacao(""); aoFechar(true);
    } catch (falha) { setErro(falha instanceof Error ? falha.message : "Não foi possível consultar a Prefeitura. Tente novamente."); }
    finally { enviando.current = false; setCarregando(false); }
  }

  return <Dialog open={aberto} protegerAlteracoes={false} onOpenChange={valor => { if (!valor && !carregando) aoFechar(false); }}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>Importar NFS-e municipal</DialogTitle><DialogDescription>Preencha os dados que aparecem na nota. O HUB consulta a Prefeitura, recupera a chave nacional e importa o XML oficial.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={importar}>
        <fieldset disabled={carregando} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="municipal-municipio">Município emissor</Label><Input id="municipal-municipio" value="São Paulo / SP" readOnly /><p className="text-xs text-muted-foreground">Integração disponível para notas de São Paulo emitidas desde 2026. Para outros municípios, use a chave nacional ou o XML oficial.</p></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="municipal-cnpj">CNPJ do prestador *</Label><Input id="municipal-cnpj" required inputMode="numeric" value={formatarCpfCnpj(cnpjPrestador)} onChange={evento => setCnpjPrestador(evento.target.value.replace(/\D/g, "").slice(0, 14))} placeholder="00.000.000/0000-00" /></div>
          <div className="space-y-1.5"><Label htmlFor="municipal-numero">Número da NFS-e *</Label><Input id="municipal-numero" required inputMode="numeric" maxLength={12} value={numero} onChange={evento => setNumero(evento.target.value)} aria-describedby="municipal-numero-ajuda" placeholder="Número da nota" /><p id="municipal-numero-ajuda" className="text-xs text-muted-foreground">Use o número da NFS-e, não o número do RPS.</p></div>
          <div className="space-y-1.5"><Label htmlFor="municipal-emissao">Data de emissão *</Label><Input id="municipal-emissao" required type="date" min="2026-01-01" value={dataEmissao} onChange={evento => setDataEmissao(evento.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="municipal-verificacao">Código de verificação *</Label><Input id="municipal-verificacao" required maxLength={9} value={codigoVerificacao} onChange={evento => setCodigoVerificacao(evento.target.value.toUpperCase())} placeholder="8 caracteres da nota" autoCapitalize="characters" /></div>
        </fieldset>
        <p className="text-xs text-muted-foreground">A nota será conferida contra o CNPJ da empresa e ficará pendente para sua análise. Importações manuais podem incluir notas anteriores a 10/09/2026.</p>
        {erro && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{erro}</p>}
        {carregando && <p role="status" className="text-sm text-muted-foreground">Consultando a Prefeitura e conferindo o XML. Aguarde a conclusão.</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={carregando} onClick={() => aoFechar(false)}>Cancelar</Button><Button type="submit" disabled={!podeEnviar || carregando}>{carregando && <Loader2 className="size-4 animate-spin" />}Consultar e importar</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
