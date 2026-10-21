"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FornecedorCombobox } from "@/app/(protegido)/compras/fornecedor-combobox";
import { rotulosFornecedor, type CampoFornecedor, type PreviaFornecedorNota } from "@/lib/notas-fiscais/dados-fornecedor";
import { prepararConciliacaoFornecedorAction, conciliarFornecedorNotaAction } from "./conciliar-fornecedor-actions";

type FornecedorVinculado = { id: string; nome: string; memorizado?: boolean };

export function ConciliacaoFornecedor({ notaId, fornecedor, bloqueado, onConciliado, onOcupado, podeCadastrarFornecedor }: {
  notaId: string; fornecedor: FornecedorVinculado | null; bloqueado: boolean;
  onConciliado: (fornecedor: FornecedorVinculado) => void; onOcupado: (ocupado: boolean) => void;
  podeCadastrarFornecedor?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [previa, setPrevia] = useState<PreviaFornecedorNota | null>(null);
  const [campos, setCampos] = useState<CampoFornecedor[]>([]);
  const [erro, setErro] = useState("");
  const [ocupado, iniciar] = useTransition();

  function carregar(id?: string | null) {
    setAberto(true); setErro(""); setPrevia(null);
    iniciar(async () => {
      try {
        const resultado = await prepararConciliacaoFornecedorAction(notaId, id);
        if ("erro" in resultado) setErro(resultado.erro);
        else { setPrevia(resultado); setCampos(resultado.campos); }
      } catch { setErro("Não foi possível carregar a conferência. Tente novamente."); }
    });
  }
  function salvar() {
    if (!previa?.fornecedorId) return;
    setErro(""); onOcupado(true);
    iniciar(async () => {
      try {
        const resultado = await conciliarFornecedorNotaAction({ notaId, fornecedorId: previa.fornecedorId!, versao: previa.versao, campos });
        if ("erro" in resultado) setErro(resultado.erro);
        else { onConciliado(resultado.fornecedor); setAberto(false); toast.success("Fornecedor conciliado. Vínculo salvo para as próximas notas."); }
      } catch { setErro("Não foi possível confirmar a gravação. Reabra a conferência para verificar."); }
      finally { onOcupado(false); }
    });
  }
  return <section className="space-y-3 rounded-lg border p-3 text-sm" aria-label="Conciliação do fornecedor">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="font-medium">{fornecedor ? fornecedor.nome : "Vincule o emitente a um fornecedor"}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{fornecedor?.memorizado
          ? "Vínculo salvo · reconhecido automaticamente pelo CNPJ da nota."
          : fornecedor ? "Cadastro encontrado pelo CNPJ. Confira os dados da nota." : "Concilie uma vez para reconhecer as próximas compras."}</p>
      </div>
      {!aberto && <Button type="button" variant="outline" size="sm" disabled={bloqueado} onClick={() => carregar()}>{fornecedor?.memorizado ? "Conferir fornecedor" : "Conciliar fornecedor"}</Button>}
    </div>
    {aberto && <div className="space-y-3 border-t pt-3">
      {ocupado && <p role="status" className="text-xs text-muted-foreground">{previa ? "Salvando conciliação..." : "Carregando..."}</p>}
      {previa && <>
        <p className="text-xs font-medium" id={`fornecedor-nota-${notaId}`}>Fornecedor do cadastro</p>
        <div aria-labelledby={`fornecedor-nota-${notaId}`}>
          <FornecedorCombobox fornecedores={previa.fornecedores} value={previa.fornecedorId} disabled={ocupado || bloqueado} onChange={id => carregar(id)} podeCadastrar={podeCadastrarFornecedor} />
        </div>
        {!previa.fornecedores.length && <p className="text-xs text-muted-foreground">Cadastre primeiro o fornecedor em Fornecedores e reabra esta conferência.</p>}
        {previa.fornecedorId && <>
          {previa.vinculoAnterior && previa.vinculoAnterior !== previa.fornecedorId && <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">O vínculo deste CNPJ será transferido para o fornecedor selecionado nas próximas conciliações.</p>}
          <p className="text-xs text-muted-foreground">Marque os dados da nota que deseja aplicar ao cadastro. Os demais campos serão mantidos.</p>
          {previa.campos.length ? <div className="divide-y rounded-lg border">
            {previa.campos.map(campo => <label key={campo} className="grid cursor-pointer grid-cols-[1rem_minmax(0,1fr)] items-start gap-3 p-3">
              <Checkbox checked={campos.includes(campo)} disabled={ocupado || bloqueado} className="mt-1"
                onCheckedChange={marcado => setCampos(atual => marcado ? [...atual, campo] : atual.filter(c => c !== campo))} />
              <span className="min-w-0 space-y-1 text-xs">
                <span className="block font-medium">{rotulosFornecedor[campo]}</span>
                <span className="block break-words text-muted-foreground">Atual: {previa.atual?.[campo] ?? "Não preenchido"}</span>
                <span className="block break-words">Na nota: {previa.nota[campo]}</span>
              </span>
            </label>)}
          </div> : <p className="text-xs text-muted-foreground">Os dados disponíveis na nota já estão atualizados.</p>}
          <p className="text-xs text-muted-foreground">O vínculo será salvo pelo CNPJ {previa.nota.cnpj}. Lançamentos já conciliados permanecem vinculados ao cadastro original.</p>
        </>}
      </>}
      {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={ocupado} onClick={() => setAberto(false)}>Cancelar</Button>
        {erro && <Button type="button" variant="outline" size="sm" disabled={ocupado || bloqueado} onClick={() => carregar(previa?.fornecedorId)}>Reabrir conferência</Button>}
        <Button type="button" size="sm" disabled={!previa?.fornecedorId || ocupado || bloqueado || !!erro} onClick={salvar}>Salvar conciliação</Button>
      </div>
    </div>}
  </section>;
}
