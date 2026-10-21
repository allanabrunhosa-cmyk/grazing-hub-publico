"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AcoesEdicao } from "@/components/padroes-operacionais";
import { CurrencyInput } from "@/components/ui/currency-input";
import { decimal, type ProdutoEntrada } from "@/lib/vendas/dominio";
import { percentualCmv } from "@/lib/vendas/cmv";
import { alterarPrecoProdutoVendaAction } from "../actions";
import { useAcesso } from "@/components/layout/acesso-contexto";

export function PrecoProduto({ produto, editar, custo, configuracaoObrigatoriaPaga = false }: { produto: ProdutoEntrada; editar: boolean; custo: number | null; configuracaoObrigatoriaPaga?: boolean }) {
  const podeConsultarCustos = useAcesso().pode("financeiro.custos", "visualizar");
  const [preco, setPreco] = useState(produto.preco);
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();
  const router = useRouter();
  const trava = useRef(false);
  const [confirmado, definirConfirmado] = useState({ preco: produto.preco, versao: produto.versao });
  const mudou = Number(preco || "0") !== Number(confirmado.preco);
  const ativo = Number(preco) > 0 || (Number(preco) === 0 && configuracaoObrigatoriaPaga);
  if (!mudou && produto.versao > confirmado.versao) definirConfirmado({ ...confirmado, versao: produto.versao });
  function cancelar() { if (trava.current) return; setPreco(confirmado.preco); setErro(""); }
  function confirmar() {
    if (trava.current || !editar || !mudou) return;
    const valor = preco || "0";
    try { decimal(valor, "Preço", true); }
    catch (falha) { setErro(falha instanceof Error ? falha.message : "Preço inválido."); return; }
    trava.current = true;
    iniciar(async () => {
      try {
        const resultado = await alterarPrecoProdutoVendaAction(produto.id, confirmado.versao, valor);
        if ("erro" in resultado) setErro(resultado.erro ?? "Não foi possível salvar.");
        else { setErro(""); setPreco(valor); definirConfirmado({ preco: valor, versao: resultado.versao }); router.refresh(); }
      } catch { setErro("Não foi possível confirmar. Seu preenchimento foi mantido."); }
      finally { trava.current = false; }
    });
  }
  const percentual = percentualCmv(custo, preco);
  const moeda = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const identificacao = "de " + produto.nome;
  return <div className="w-full min-w-0 space-y-1.5 text-left" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) cancelar(); }} onClick={e => e.stopPropagation()} onKeyDown={e => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); cancelar(); } if (e.key === "Enter" && e.target instanceof HTMLInputElement) { e.preventDefault(); confirmar(); } }}>
    <div className="flex min-h-9 items-center gap-2">
    <CurrencyInput containerClassName="w-32 shrink-0" className={"h-9 w-full min-w-0 pl-8 pr-2 text-right text-xs " + (ativo ? "border-primary/35 bg-primary/5 font-semibold" : "")}
      aria-label={"Preço " + identificacao} title="Preço único. Zero é permitido quando escolhas obrigatórias compõem o valor final."
      value={preco} onValueChange={valor => { setPreco(valor); setErro(""); }} disabled={!editar || ocupado} />
    <div className="w-9 shrink-0">{(mudou || ocupado) && <AcoesEdicao nome={`preço ${identificacao}`} alterado={mudou} salvando={ocupado} confirmar={confirmar} cancelar={cancelar} invalido={!editar} somenteConfirmar />}</div>
    </div>
      <p className="min-w-0 text-[10px] leading-4 text-muted-foreground" title={produto.grupos.length ? "Custo da composição fixa; o custo final depende das escolhas." : "Custo de todos os ingredientes por unidade vendida."}>
        {produto.grupos.length ? "CMV base" : "CMV"}: {!podeConsultarCustos ? "não autorizado" : custo == null ? "composição pendente" : moeda(custo) + (percentual == null ? "" : " · " + percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%")}{podeConsultarCustos && produto.grupos.length && custo != null ? " + escolhas" : ""}
      </p>
    {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
  </div>;
}
