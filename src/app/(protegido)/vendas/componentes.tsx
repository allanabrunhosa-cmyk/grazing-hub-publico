"use client";
import { useState, useTransition, type ReactNode, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BarraAcoes } from "@/components/padroes-operacionais";

export const classeSelecao = "ds-selecao-nativa outline-none focus-visible:ring-2 focus-visible:ring-ring";
export function Campo({ nome, children }: { nome: string; children: ReactNode }) {
  return <label className="grid min-w-0 gap-1.5 text-sm font-medium">{nome}{children}</label>;
}
export function Texto({ nome, ...props }: ComponentProps<typeof Input> & { nome: string }) { return <Campo nome={nome}><Input {...props} /></Campo>; }
export function Situacao({ ativo }: { ativo: boolean }) { return <span className={`rounded-full px-2.5 py-1 text-xs ${ativo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{ativo ? "Ativo" : "Inativo"}</span>; }
export function Check({ children, ...props }: ComponentProps<"input"> & { children: ReactNode }) { return <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" {...props} />{children}</label>; }
export function Vazio({ children }: { children: ReactNode }) { return <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">{children}</div>; }
export function CabecalhoVendas(props: { titulo: string; descricao: string; children?: ReactNode }) { return <BarraAcoes {...props} />; }
export function EditorVenda({ titulo, descricao, fechar, children, salvar, impedido = false, abrirSecao, largura = "padrao", varianteSalvar = "default", cabecalho, conteudoIndependente, exibirIndependente = false }: { titulo: string; descricao: string; fechar: () => void; children: ReactNode; salvar: () => Promise<{ erro?: string }>; impedido?: boolean; abrirSecao?: (secao: string) => void; largura?: "padrao" | "pedido"; varianteSalvar?: ComponentProps<typeof Button>["variant"]; cabecalho?: ReactNode; conteudoIndependente?: ReactNode; exibirIndependente?: boolean }) {
  const [erro, setErro] = useState(""); const [validar, setValidar] = useState(false); const [salvando, iniciar] = useTransition(); const router = useRouter();
  return <Dialog open onOpenChange={aberto => { if (!aberto && !salvando) fechar(); }}><DialogContent className={largura === "pedido" ? "max-h-[calc(100dvh-2rem)] overflow-y-auto break-words sm:max-w-5xl" : "sm:max-w-3xl"}><DialogHeader><DialogTitle>{titulo}</DialogTitle><DialogDescription>{descricao}</DialogDescription></DialogHeader>
    {cabecalho}
    <div hidden={!exibirIndependente}>{conteudoIndependente}</div>
    <form hidden={exibirIndependente} noValidate data-validar={validar} className="vendas-formulario min-w-0 max-w-full space-y-5" onSubmit={evento => {
      evento.preventDefault(); evento.stopPropagation(); if (impedido) return; setValidar(true);
      if (!evento.currentTarget.checkValidity()) {
        setErro("Preencha os campos destacados para salvar.");
        const invalido = Array.from(evento.currentTarget.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea")).find(campo => campo.willValidate && !campo.validity.valid);
        const secao = invalido?.closest("[data-secao]")?.getAttribute("data-secao");
        if (secao) abrirSecao?.(secao);
        requestAnimationFrame(() => { let pai = invalido?.parentElement; while (pai && pai !== evento.currentTarget) { if (pai instanceof HTMLDetailsElement) pai.open = true; pai = pai.parentElement; } invalido?.focus(); }); return;
      }
      setErro(""); iniciar(async () => { try { const resposta = await salvar(); if (resposta.erro) setErro(resposta.erro); else { fechar(); router.refresh(); } } catch (falha) { setErro(falha instanceof Error && falha.name === "ErroCadastroVenda" ? falha.message : "Não foi possível salvar. Seu preenchimento foi mantido. Tente novamente ou atualize a página."); } });
    }}><fieldset disabled={salvando || exibirIndependente} className="min-w-0 max-w-full space-y-5">{children}</fieldset>{erro && <p role="alert" className="rounded-xl border border-destructive bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}<div className="sticky bottom-0 flex justify-end border-t bg-background py-3"><Button type="submit" variant={varianteSalvar} disabled={salvando || impedido}>{salvando ? "Salvando…" : impedido ? "Aguarde o envio…" : "Salvar"}</Button></div></form>
    <style>{`.vendas-formulario[data-validar="true"] input:invalid,.vendas-formulario[data-validar="true"] select:invalid,.vendas-formulario[data-validar="true"] textarea:invalid {border-color:var(--destructive);background:color-mix(in srgb,var(--destructive) 10%,transparent);box-shadow:0 0 0 2px color-mix(in srgb,var(--destructive) 20%,transparent)}`}</style>
  </DialogContent></Dialog>;
}
