"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { CampoSenha } from "@/components/campo-senha";
import { loginAction, type LoginState } from "@/app/login/actions";

const initialState: LoginState = { erro: null };

export function LoginForm({ retornoOAuth }: { retornoOAuth?: string } = {}) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {retornoOAuth && <input type="hidden" name="retornoOAuth" value={retornoOAuth} />}
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="username" placeholder="voce@empresa.com.br" required disabled={pending} autoFocus />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="senha">Senha</Label>
        <CampoSenha id="senha" name="senha" autoComplete="current-password" required disabled={pending} />
        <div className="pt-1 text-right"><Link href="/login/recuperar" className="rounded text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">Esqueci minha senha</Link></div>
      </div>

      {state.erro && (
        <p role="alert" className="rounded-md bg-destructive/10 p-2 text-center text-sm text-destructive">
          {state.erro}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
