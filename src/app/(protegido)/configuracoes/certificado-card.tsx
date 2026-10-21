"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Eye, EyeOff, RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { uploadCertificadoAction, removerCertificadoAction, obterSenhaCertificadoAction } from "@/app/(protegido)/configuracoes/actions";
import type { CertificadoInfo } from "@/app/(protegido)/configuracoes/types";

// diasParaVencer já vem calculado do Server Component (page.tsx) — evita chamar
// Date.now() aqui, que o lint de pureza do React proíbe dentro de um componente.
function calcularStatusValidade(validoAte: string | null, diasParaVencer: number | null) {
  if (!validoAte || diasParaVencer === null) return null;
  const dataFormatada = new Date(validoAte).toLocaleDateString("pt-BR");
  if (diasParaVencer < 0) return { variant: "destructive" as const, texto: `Vencido em ${dataFormatada}` };
  if (diasParaVencer <= 30) return { variant: "warning" as const, texto: `Vence em ${dataFormatada} (${diasParaVencer}d)` };
  return { variant: "success" as const, texto: `Válido até ${dataFormatada}` };
}

export function CertificadoCard({ certificado, podeEditar = false, podeExcluir = false }: { certificado: CertificadoInfo; podeEditar?: boolean; podeExcluir?: boolean }) {
  const id = useId();
  const [mostrarFormulario, setMostrarFormulario] = useState(certificado === null);
  const [confirmarExclusaoAberto, setConfirmarExclusaoAberto] = useState(false);
  const [senhaVisivel, setSenhaVisivel] = useState<string | null>(null);
  const [enviando, startEnviar] = useTransition();
  const [removendo, startRemover] = useTransition();
  const [buscandoSenha, startBuscarSenha] = useTransition();

  function handleUpload(formData: FormData) {
    startEnviar(async () => {
      const resultado = await uploadCertificadoAction(null, formData);
      if ("erro" in resultado) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Certificado digital salvo.");
      setMostrarFormulario(false);
      setSenhaVisivel(null);
    });
  }

  function handleRemover() {
    startRemover(async () => {
      const resultado = await removerCertificadoAction();
      if ("erro" in resultado) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Certificado removido.");
      setConfirmarExclusaoAberto(false);
      setMostrarFormulario(true);
      setSenhaVisivel(null);
    });
  }

  function handleMostrarSenha() {
    if (senhaVisivel !== null) {
      setSenhaVisivel(null);
      return;
    }
    startBuscarSenha(async () => {
      const resultado = await obterSenhaCertificadoAction();
      if ("erro" in resultado) {
        toast.error(resultado.erro);
        return;
      }
      setSenhaVisivel(resultado.senha);
    });
  }

  return (
    <Card className="vidro-painel min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4" />
          Certificado Digital (SEFAZ)
        </CardTitle>
        <CardDescription>
          Usado para assinar e consultar documentos fiscais junto à SEFAZ. Fica guardado cifrado no banco, sem
          precisar reconfigurar a cada atualização do sistema.
        </CardDescription>
      </CardHeader>

      {certificado && !mostrarFormulario && (
        <>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{certificado.arquivoNome}</span>
              {(() => {
                const status = calcularStatusValidade(certificado.validoAte, certificado.diasParaVencer);
                return status && <Badge variant={status.variant}>{status.texto}</Badge>;
              })()}
            </div>
            {certificado.titular && <p className="text-sm text-muted-foreground">Titular: {certificado.titular}</p>}
            <p className="text-xs text-muted-foreground">
              Atualizado {certificado.atualizadoPorNome ? `por ${certificado.atualizadoPorNome} ` : ""}
              em {new Date(certificado.updatedAt).toLocaleString("pt-BR")}
            </p>

            {podeEditar && <div className="space-y-1.5 pt-1">
              <Label htmlFor={`${id}-consulta`}>Senha do certificado</Label>
              <div className="flex items-center gap-2">
                <Input id={`${id}-consulta`} readOnly value={senhaVisivel ?? "••••••••"} className="font-mono" />
                <Button type="button" variant="outline" size="icon" onClick={handleMostrarSenha} disabled={buscandoSenha} aria-label={senhaVisivel !== null ? "Ocultar senha" : "Mostrar senha"}>
                  {buscandoSenha ? <Loader2 className="size-4 animate-spin" /> : senhaVisivel !== null ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>}
          </CardContent>
          <CardFooter className="justify-end gap-2 bg-transparent border-t-0 pt-0">
            {podeExcluir && <Dialog open={confirmarExclusaoAberto} onOpenChange={setConfirmarExclusaoAberto}>
              <Button type="button" variant="excluir-discreto" aria-label="Remover certificado digital" onClick={() => setConfirmarExclusaoAberto(true)} />
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Remover certificado digital?</DialogTitle>
                  <DialogDescription>
                    As chamadas à SEFAZ deixam de funcionar até um novo certificado ser cadastrado (ou até que as
                    variáveis de ambiente de fallback estejam configuradas). Essa ação não pode ser desfeita.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button type="button" variant="outline" disabled={removendo} />}>Cancelar</DialogClose>
                  <Button type="button" variant="excluir-discreto" aria-label="Confirmar remoção do certificado digital" disabled={removendo} onClick={handleRemover} />
                </DialogFooter>
              </DialogContent>
            </Dialog>}
            {podeEditar && <Button type="button" variant="outline" className="gap-1.5" onClick={() => setMostrarFormulario(true)}>
              <RefreshCcw className="size-4" />
              Substituir
            </Button>}
          </CardFooter>
        </>
      )}

      {!certificado && !podeEditar && <CardContent><p className="text-sm text-muted-foreground">Nenhum certificado cadastrado. A inclusão exige permissão de administração.</p></CardContent>}
      {mostrarFormulario && podeEditar && (
        <form action={handleUpload}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-arquivo`}>Arquivo do certificado (.pfx)</Label>
              <Input id={`${id}-arquivo`} name="arquivo" type="file" accept=".pfx,.p12" disabled={enviando} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-senha`}>Senha do certificado</Label>
              <Input id={`${id}-senha`} name="senha" type="password" autoComplete="off" disabled={enviando} />
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2 bg-transparent border-t-0 pt-0">
            {certificado && (
              <Button type="button" variant="outline" disabled={enviando} onClick={() => setMostrarFormulario(false)}>
                Cancelar
              </Button>
            )}
            <Button type="submit" variant="entrada" disabled={enviando}>
              {enviando && <Loader2 className="size-4 animate-spin" />}
              Enviar certificado
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
