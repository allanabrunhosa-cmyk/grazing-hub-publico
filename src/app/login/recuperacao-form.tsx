"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleCheck, Loader2, MailCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampoSenha } from "@/components/campo-senha";
import { ERRO_LINK, tokenBemFormado, validarNovaSenha } from "@/lib/recuperacao-senha/validacao";
import { solicitarRecuperacaoAction, redefinirSenhaAction, verificarLinkRecuperacaoAction, type EstadoRecuperacao } from "./recuperacao-actions";

async function solicitarComTratamento(anterior: EstadoRecuperacao, dados: FormData): Promise<EstadoRecuperacao> {
  try { return await solicitarRecuperacaoAction(anterior, dados); }
  catch { return { erro: "Não foi possível conectar ao sistema. Confira sua conexão e tente novamente." }; }
}
async function redefinirComTratamento(anterior: EstadoRecuperacao, dados: FormData): Promise<EstadoRecuperacao> {
  try { return await redefinirSenhaAction(anterior, dados); }
  catch { return { erro: "A conexão foi interrompida. Tente entrar com a nova senha antes de solicitar outro link." }; }
}

const classeLink = "inline-flex min-h-10 items-center justify-center gap-2 rounded text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring";
function VoltarLogin() { return <div className="text-center"><Link href="/login" className={classeLink}><ArrowLeft className="size-4" /> Voltar para o login</Link></div>; }
function AvisoErro({ mensagem }: { mensagem: string }) { return <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm leading-relaxed text-destructive">{mensagem}</p>; }

export function SolicitarRecuperacaoForm() {
  const [estado, acao, pendente] = useActionState(solicitarComTratamento, null);
  const [email, definirEmail] = useState("");
  const [segundos, definirSegundos] = useState(0);
  const aviso = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (estado && "ok" in estado) {
      aviso.current?.focus();
      const fim = Date.now() + 60000;
      const intervalo = window.setInterval(() => { const restante = Math.max(0, Math.ceil((fim - Date.now()) / 1000)); definirSegundos(restante); if (!restante) clearInterval(intervalo); }, 1000);
      return () => clearInterval(intervalo);
    }
  }, [estado]);
  return <div className="space-y-5">
    {estado && "ok" in estado && <div ref={aviso} tabIndex={-1} role="status" className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4 outline-none">
      <MailCheck className="size-6 text-primary" /><p className="font-semibold">Confira seu e-mail</p>
      <p className="text-sm leading-relaxed">{estado.mensagem}</p>
      <p className="text-sm text-muted-foreground">O link vale por 30 minutos. Confira também o spam. Ao pedir outro link, o anterior deixa de funcionar.</p>
    </div>}
    <form action={acao} onSubmit={() => definirSegundos(60)} className="space-y-4">
      <div className="space-y-1.5"><Label htmlFor="email-recuperacao">E-mail da conta</Label>
        <Input id="email-recuperacao" name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={evento => definirEmail(evento.target.value)} required disabled={pendente} placeholder="voce@empresa.com.br" />
      </div>
      {estado && "erro" in estado && <AvisoErro mensagem={estado.erro} />}
      <Button type="submit" className="w-full" disabled={pendente || Boolean(estado && "ok" in estado && segundos > 0)}>
        {pendente && <Loader2 className="size-4 animate-spin" />}
        {pendente ? "Solicitando..." : estado && "ok" in estado ? segundos > 0 ? `Reenviar em ${segundos}s` : "Solicitar novo link" : "Enviar link de recuperação"}
      </Button>
    </form><VoltarLogin />
  </div>;
}

export function RedefinirSenhaForm() {
  const [token, definirToken] = useState("");
  const [verificacao, definirVerificacao] = useState<"carregando" | "valido" | string>("carregando");
  const [erroLocal, definirErroLocal] = useState<string | null>(null);
  const [estado, acao, pendente] = useActionState(redefinirComTratamento, null);
  const formulario = useRef<HTMLFormElement>(null);
  const sucesso = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let ativo = true;
    const segredo = window.location.hash.slice(1);
    async function verificar() {
      if (!tokenBemFormado(segredo)) { if (ativo) definirVerificacao(ERRO_LINK); return; }
      try {
        const resultado = await verificarLinkRecuperacaoAction(segredo);
        if (!ativo) return;
        definirToken(segredo);
        definirVerificacao("erro" in resultado ? resultado.erro : resultado.valido ? "valido" : ERRO_LINK);
      } catch { if (ativo) definirVerificacao("Não foi possível verificar o link. Atualize a página para tentar novamente."); }
    }
    void verificar();
    return () => { ativo = false; };
  }, []);
  useEffect(() => {
    if (estado && "ok" in estado) {
      window.history.replaceState(null, "", window.location.pathname);
      formulario.current?.reset();
      sucesso.current?.focus();
    }
  }, [estado]);
  if (estado && "ok" in estado) return <div className="space-y-5">
    <div ref={sucesso} tabIndex={-1} role="status" className="space-y-3 text-center outline-none"><CircleCheck className="mx-auto size-10 text-green-600" />
      <p className="text-lg font-semibold">Senha alterada com sucesso</p><p className="text-sm text-muted-foreground">Seu e-mail foi confirmado. Entre com a nova senha no HUB, Gestor de Pedidos, Validades ou Atendimento, conforme seu perfil.</p>
    </div><VoltarLogin /></div>;
  if (verificacao === "carregando") return <p role="status" className="flex items-center justify-center gap-2 py-6 text-sm"><Loader2 className="size-4 animate-spin" /> Verificando seu link...</p>;
  if (verificacao !== "valido") return <div className="space-y-4 text-center"><ShieldAlert className="mx-auto size-9 text-amber-600" /><AvisoErro mensagem={verificacao} /><Link className={classeLink} href="/login/recuperar">Solicitar novo link</Link><VoltarLogin /></div>;
  return <div className="space-y-5"><form ref={formulario} action={acao} className="space-y-4" onSubmit={(evento) => {
    const dados = new FormData(evento.currentTarget);
    const erro = validarNovaSenha(String(dados.get("senha") ?? ""), String(dados.get("confirmacao") ?? ""));
    definirErroLocal(erro); if (erro) evento.preventDefault();
  }}>
    <input type="hidden" name="token" value={token} />
    <div className="space-y-1.5"><Label htmlFor="nova-senha">Nova senha</Label><CampoSenha id="nova-senha" name="senha" autoComplete="new-password" minLength={8} maxLength={72} required disabled={pendente} aria-describedby="orientacao-senha" /></div>
    <p id="orientacao-senha" className="text-xs leading-relaxed text-muted-foreground">Use pelo menos 8 caracteres, uma letra maiúscula e um caractere especial. Evite nomes, datas e senhas usadas em outros serviços.</p>
    <div className="space-y-1.5"><Label htmlFor="confirmacao-senha">Confirme a nova senha</Label><CampoSenha id="confirmacao-senha" name="confirmacao" autoComplete="new-password" maxLength={72} required disabled={pendente} /></div>
    {(erroLocal || (estado && "erro" in estado)) && <AvisoErro mensagem={erroLocal || (estado && "erro" in estado ? estado.erro : "")} />}
    {estado && "erro" in estado && estado.erro === ERRO_LINK && <Link className={classeLink} href="/login/recuperar">Solicitar novo link</Link>}
    <Button className="w-full" type="submit" disabled={pendente}>{pendente && <Loader2 className="size-4 animate-spin" />}{pendente ? "Salvando..." : "Salvar nova senha"}</Button>
    <p className="text-xs leading-relaxed text-muted-foreground">Ao salvar, você confirma seu e-mail e encerra os acessos anteriores à conta.</p>
  </form><VoltarLogin /></div>;
}
