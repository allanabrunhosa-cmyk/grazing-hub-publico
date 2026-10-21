"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusAtivoSalvavel } from "@/components/status-ativo";
import type { TipoStatusVenda } from "@/lib/vendas/status-cadastro";
import { alterarStatusCadastroVendaAction, alterarSituacaoProdutoVendaAction } from "./actions";

export function StatusCadastroVenda({ tipo, id, versao, ativo, nome, editar }: { tipo: TipoStatusVenda; id: string; versao: number; ativo: boolean; nome: string; editar: boolean }) {
  const router = useRouter();
  const [revisao, definirRevisao] = useState({ origem: versao, valor: versao });
  if (revisao.origem !== versao) definirRevisao({ origem: versao, valor: versao });
  return <StatusAtivoSalvavel ativo={ativo} nome={nome} disabled={!editar} motivoBloqueio={!editar ? "Somente consulta neste cadastro." : undefined} salvar={async proximo => {
    const r = tipo === "PRODUTO" ? await alterarSituacaoProdutoVendaAction(id, revisao.valor, proximo) : await alterarStatusCadastroVendaAction(tipo, id, revisao.valor, proximo);
    if (r.erro) return { erro: r.erro };
    if ("versao" in r && typeof r.versao === "number") definirRevisao({ origem: versao, valor: r.versao });
    router.refresh(); return { ok: true };
  }} />;
}
