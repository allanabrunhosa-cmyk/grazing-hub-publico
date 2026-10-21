"use client";

import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AvatarDropzone } from "@/app/(protegido)/perfil/avatar-dropzone";
import { atualizarPerfilAction, alterarSenhaAction } from "@/app/(protegido)/perfil/actions";

export function PerfilForm({ usuario }: { usuario: { id: string; nome: string; email: string; temFoto: boolean } }) {
  const id = useId();
  const [nome, setNome] = useState(usuario.nome);
  const [salvandoPerfil, startSalvarPerfil] = useTransition();
  const [salvandoSenha, startSalvarSenha] = useTransition();
  const [erroPerfil, definirErroPerfil] = useState("");
  const [erroSenha, definirErroSenha] = useState("");
  const travaPerfil = useRef(false), travaSenha = useRef(false);

  const iniciais = (nome || "?")
    .split(" ")
    .map((parte) => parte[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function handleSalvarPerfil(formData: FormData) {
    if (travaPerfil.current) return;
    travaPerfil.current = true; definirErroPerfil("");
    startSalvarPerfil(async () => {
      try {
      const resultado = await atualizarPerfilAction(null, formData);
      if ("erro" in resultado) {
        definirErroPerfil(resultado.erro);
        toast.error(resultado.erro);
        return;
      }
      toast.success("Alterações salvas.");
      } catch { definirErroPerfil("Não foi possível confirmar. Confira os dados antes de tentar novamente."); }
      finally { travaPerfil.current = false; }
    });
  }

  function handleAlterarSenha(formData: FormData) {
    if (travaSenha.current) return;
    travaSenha.current = true; definirErroSenha("");
    startSalvarSenha(async () => {
      try {
      const resultado = await alterarSenhaAction(null, formData);
      if ("erro" in resultado) {
        definirErroSenha(resultado.erro);
        toast.error(resultado.erro);
        return;
      }
      toast.success("Senha alterada.");
      (document.getElementById("form-senha") as HTMLFormElement | null)?.reset();
      } catch { definirErroSenha("Não foi possível confirmar a alteração da senha. Confira seu acesso antes de tentar novamente."); }
      finally { travaSenha.current = false; }
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={e => { e.preventDefault(); handleSalvarPerfil(new FormData(e.currentTarget)); }}>
        <Card>
          <CardHeader>
            <CardTitle>Informações Pessoais</CardTitle>
            <CardDescription>Atualize seu nome e informações de contato.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {erroPerfil && <p role="alert" className="text-sm text-destructive">{erroPerfil}</p>}
            <AvatarDropzone
              fotoAtualUrl={usuario.temFoto ? `/api/usuarios/${usuario.id}/foto` : null}
              iniciais={iniciais}
              onChange={() => {}}
              disabled={salvandoPerfil}
            />
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-nome`}>Nome Completo</Label>
              <Input id={`${id}-nome`} name="nome" value={nome} onChange={(e) => setNome(e.target.value)} disabled={salvandoPerfil} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-email`}>E-mail</Label>
              <Input id={`${id}-email`} name="email" type="email" defaultValue={usuario.email} disabled={salvandoPerfil} />
            </div>
          </CardContent>
          <CardFooter className="justify-end bg-transparent border-t-0 pt-0">
            <Button type="submit" disabled={salvandoPerfil}>
              {salvandoPerfil && <Loader2 className="size-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </CardFooter>
        </Card>
      </form>

      <form id="form-senha" onSubmit={e => { e.preventDefault(); handleAlterarSenha(new FormData(e.currentTarget)); }}>
        <Card>
          <CardHeader>
            <CardTitle>Segurança</CardTitle>
            <CardDescription>Altere sua senha de acesso ao sistema.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              {erroSenha && <p role="alert" className="text-sm text-destructive">{erroSenha}</p>}
              <Label htmlFor={`${id}-senhaAtual`}>Senha Atual</Label>
              <Input id={`${id}-senhaAtual`} name="senhaAtual" type="password" autoComplete="current-password" disabled={salvandoSenha} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-novaSenha`}>Nova Senha</Label>
              <Input id={`${id}-novaSenha`} name="novaSenha" type="password" autoComplete="new-password" minLength={8} maxLength={72} aria-describedby={`${id}-regraSenha`} disabled={salvandoSenha} />
              <p id={`${id}-regraSenha`} className="text-xs text-muted-foreground">Use pelo menos 8 caracteres, uma letra maiúscula e um caractere especial.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-confirmarNovaSenha`}>Confirmar Nova Senha</Label>
              <Input id={`${id}-confirmarNovaSenha`} name="confirmarNovaSenha" type="password" autoComplete="new-password" maxLength={72} disabled={salvandoSenha} />
            </div>
          </CardContent>
          <CardFooter className="justify-end bg-transparent border-t-0 pt-0">
            <Button type="submit" disabled={salvandoSenha}>
              {salvandoSenha && <Loader2 className="size-4 animate-spin" />}
              Alterar Senha
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
