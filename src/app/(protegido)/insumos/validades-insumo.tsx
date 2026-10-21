"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAcesso } from "@/components/layout/acesso-contexto";
import { Button } from "@/components/ui/button";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { EtiquetaCadastroCampos } from "./etiqueta-cadastro-campos";
import type { InsumoRow } from "./types";
import { salvarConfiguracaoProdutoEtiquetaAction } from "@/app/(protegido)/producao/etiquetas/actions";

/** A mesma função de Validades, sem conceder edição dos demais dados do insumo. */
export function ValidadesInsumo({ insumo, somenteLeitura = false }: { insumo: InsumoRow; somenteLeitura?: boolean }) {
  const podeEditar = useAcesso().pode("producao.validades", "editar") && !somenteLeitura;
  const router = useRouter();
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);
  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!podeEditar || pendente) return;
    const dados = new FormData(evento.currentTarget);
    setPendente(true); setErro(""); setSalvo(false);
    try {
      const resultado = await salvarConfiguracaoProdutoEtiquetaAction({
        insumoId: insumo.id,
        etiquetaHabilitada: dados.get("etiquetaHabilitada") === "on",
        validadeSecoDias: String(dados.get("validadeSecoDias") ?? ""),
        validadeRefrigeradoDias: String(dados.get("validadeRefrigeradoDias") ?? ""),
        validadeCongeladoDias: String(dados.get("validadeCongeladoDias") ?? ""),
      });
      if ("erro" in resultado) { setErro(resultado.erro); return; }
      setSalvo(true); router.refresh();
    } catch { setErro("Não foi possível salvar os prazos. Confira seu acesso e tente novamente."); }
    finally { setPendente(false); }
  }
  return <form className="max-w-2xl space-y-3" aria-label={`Validades de ${insumo.nome}`} onSubmit={salvar} onChange={() => setSalvo(false)}>
    <EtiquetaCadastroCampos habilitadaInicial={insumo.etiquetaHabilitada} validadeSecoDias={insumo.validadeSecoDias}
      validadeRefrigeradoDias={insumo.validadeRefrigeradoDias} validadeCongeladoDias={insumo.validadeCongeladoDias} disabled={!podeEditar || pendente} />
    {!podeEditar && <p className="text-sm text-muted-foreground">Seu acesso permite apenas consultar os prazos de validade.</p>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {salvo && <p role="status" className="text-sm text-success">Prazos de validade salvos.</p>}
    {podeEditar && <GrupoAcoes nome="Salvar prazos de validade"><Button type="submit" variant="entrada" disabled={pendente}>
      {pendente && <Loader2 className="size-4 animate-spin" />}{pendente ? "Salvando…" : "Salvar validades"}
    </Button></GrupoAcoes>}
  </form>;
}
