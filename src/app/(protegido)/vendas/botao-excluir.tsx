"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { excluirCadastroVendaAction } from "./actions";

export function BotaoExcluirVenda({ tipo, id, versao, nome, aviso = "" }: { tipo: "PRODUTO" | "CATEGORIA" | "GRUPO" | "CATEGORIA_GRUPO" | "GRUPO_FISCAL"; id: string; versao: number; nome: string; aviso?: string }) {
  const [erro, setErro] = useState(""); const [ocupado, iniciar] = useTransition(); const router = useRouter();
  const trava = useRef(false);
  function excluir() {
    if (trava.current || !window.confirm(`Excluir ${nome} permanentemente? ${aviso}`)) return;
    trava.current = true; setErro("");
    iniciar(async () => {
      try { const r = await excluirCadastroVendaAction(tipo,id,versao); if (r.erro) setErro(r.erro); else router.refresh(); }
      catch { setErro("Não foi possível confirmar a exclusão. Atualize a página para conferir antes de tentar novamente."); }
      finally { trava.current = false; }
    });
  }
  return <span className="inline-flex flex-col items-end"><Button type="button" variant="excluir" disabled={ocupado} aria-label={`Excluir ${nome}`} title={`Excluir ${nome}`} onClick={excluir} />{erro && <span role="alert" className="max-w-72 text-right text-xs text-destructive">{erro}</span>}</span>;
}
