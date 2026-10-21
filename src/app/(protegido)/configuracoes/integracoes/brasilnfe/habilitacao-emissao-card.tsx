"use client";
import { useId, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SelecaoFormulario } from "@/components/ui/select";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import type { ControleEmissaoBrasilNfeDto, ResultadoControleEmissaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/operacional";
import type { AmbienteEmissaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/operacional-dominio";

export function HabilitacaoEmissaoBrasilNfeCard({ inicial, editar, salvar }: {
  inicial: ControleEmissaoBrasilNfeDto; editar: boolean; salvar: (entrada: unknown) => Promise<ResultadoControleEmissaoBrasilNfe>;
}) {
  const id = useId(), trava = useRef(false), [dados, setDados] = useState(inicial), [modelo, setModelo] = useState("55"), [confirmado, setConfirmado] = useState(false), [erro, setErro] = useState("");
  const [aceite65, setAceite65] = useState(false), [modoRegistro, setModoRegistro] = useState<"SESSAO_NORMAL" | "AUTOMACAO_ASSISTIDA">("SESSAO_NORMAL");
  const [pendente, iniciar] = useTransition();
  const transmissaoLiberada = dados.liberacaoTransmissao?.liberada === true;
  const podeHabilitarManual = dados.habilitacaoManualDisponivel === true || transmissaoLiberada;
  const podeBloquearRegistro = dados.homologacao?.habilitada === true || dados.producao?.habilitada === true;
  const modelos: (55 | 65)[] = modelo === "AMBOS" ? [55, 65] : [modelo === "65" ? 65 : 55];
  const semProva65 = modelos.includes(65) && dados.requisitos.some(r => r.ambiente === "PRODUCAO" && r.modelo === 65 && r.homologacaoNaoComprovada && r.permiteAceiteAdministrativo);
  function executar(ambiente: AmbienteEmissaoBrasilNfe, habilitada: boolean) {
    if (!editar || !confirmado || trava.current || habilitada && (!podeHabilitarManual || ambiente === "PRODUCAO" && semProva65 && !aceite65)) return;
    const anterior = ambiente === "HOMOLOGACAO" ? dados.homologacao : dados.producao;
    trava.current = true; setErro("");
    iniciar(async () => {
      try {
        const r = await salvar({ ambiente, revisao: anterior?.revisao ?? 0, habilitada, modelos: habilitada ? modelos : anterior?.modelos ?? modelos,
          documentosHomologados: habilitada && ambiente === "PRODUCAO" ? modelos.flatMap(m => { const d = dados.documentosHomologados.find(d => d.modelo === m); return d ? [d.id] : []; }) : [], confirmarAtivacao: true,
          ...(habilitada && ambiente === "PRODUCAO" && semProva65 ? { decisaoProducao65: { versao: 1, tipo: "DECISAO_ADMINISTRATIVA_SEM_HOMOLOGACAO_LOCAL", motivo: "CSC_HOMOLOGACAO_INDISPONIVEL_RESPONSAVEL", confirmarResponsabilidade: true, modoRegistro } } : {}) });
        if (r.ok) { setDados(r.dados); setConfirmado(false); setAceite65(false); } else setErro(r.erro);
      } catch { setErro("Controle indisponível. Confira o estado salvo antes de repetir. Nenhuma transmissão foi solicitada."); }
      finally { trava.current = false; }
    });
  }
  return <Card>
    <CardHeader><CardTitle>Emissão manual por pedido</CardTitle><CardDescription>O pedido permite preparar e revisar a prévia fiscal. A preparação e uma habilitação histórica não liberam transmissão. A suspensão administrativa impede novas transmissões do ambiente. Emissão automática e callback permanecem desativados.</CardDescription></CardHeader>
    <CardContent className="space-y-5">
      {!transmissaoLiberada && <p role="status" className="text-sm text-muted-foreground">{podeHabilitarManual ? "A habilitação administrativa permite o fluxo manual. Cada nota exige revisão e autorização específica no pedido antes da transmissão." : "Emissão ainda não liberada. A leitura e a preparação local permanecem disponíveis."}</p>}
      {editar && podeHabilitarManual && <div className="grid gap-2"><Label htmlFor={`${id}-modelos`}>Modelos para habilitar</Label><SelecaoFormulario id={`${id}-modelos`} value={modelo} disabled={pendente} onValueChange={v => { setModelo(v); setConfirmado(false); setAceite65(false); }}><option value="55">NF-e — modelo 55</option><option value="65">NFC-e — modelo 65</option><option value="AMBOS">NF-e e NFC-e</option></SelecaoFormulario></div>}
      <div className="grid gap-5 sm:grid-cols-2">{(["HOMOLOGACAO", "PRODUCAO"] as const).map(ambiente => {
        const chave = ambiente === "HOMOLOGACAO" ? "homologacao" : "producao", h = dados[chave];
        const ativa = podeHabilitarManual && h?.habilitada === true && dados.correspondentes[chave], selecionadosAtivos = ativa && modelos.every(m => h.modelos.includes(m));
        const motivos = [...new Set(dados.requisitos.filter(r => r.ambiente === ambiente && (!podeHabilitarManual || modelos.includes(r.modelo))).flatMap(r => r.pendencias))];
        const suspensa = h?.habilitada === false && dados.correspondentes[chave];
        return <section key={ambiente} className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{ambiente === "HOMOLOGACAO" ? "Homologação — ambiente 2" : "Produção — ambiente 1"}</p><Badge variant={selecionadosAtivos ? "success" : "warning"}>{selecionadosAtivos ? "Manual habilitada" : ativa ? "Habilitada para outros modelos" : suspensa ? "Suspensa por administração" : "Bloqueada"}</Badge></div>
          {h && <p className="text-xs text-muted-foreground">Revisão {h.revisao} · {new Date(h.criadaEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · Modelos: {h.modelos.join(", ")}.{!dados.correspondentes[chave] && " A configuração ou o emitente mudou. Conferência e nova habilitação necessárias."}</p>}
          {motivos.length > 0 ? <ul className="list-disc space-y-1 pl-5 text-sm">{motivos.map(m => <li key={m}>{m}</li>)}</ul> : <p className="text-sm text-muted-foreground">Pré-requisitos administrativos conferidos para {podeHabilitarManual ? "os modelos selecionados" : "os modelos 55 e 65"}. O pedido também deve ter parâmetros fiscais aprovados.</p>}
          {ambiente === "PRODUCAO" && h?.decisaoProducao65 && <p role="status" className="text-xs text-muted-foreground">NFC-e: decisão administrativa sem prova de homologação local. Responsável: {h.decisaoProducao65.responsavel.nome}. Registro: {new Date(h.decisaoProducao65.registradaEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. As regras de cada venda continuam sujeitas à revisão.</p>}
          {editar && podeHabilitarManual && ambiente === "PRODUCAO" && semProva65 && !selecionadosAtivos && <div className="space-y-3">
            <p className="text-sm text-muted-foreground">A homologação externa da NFC-e no HUB ainda não foi comprovada. O CSC de homologação indisponível não é copiado da produção. A alternativa abaixo registra a decisão do responsável e exige CSC de produção conferido. Não autoriza nota nem aprova tributação.</p>
            <div className="flex items-start gap-2"><Checkbox id={`${id}-aceite65`} checked={aceite65} disabled={pendente} onCheckedChange={v => { setAceite65(v === true); setConfirmado(false); }} /><Label htmlFor={`${id}-aceite65`} className="min-w-0 leading-relaxed">Autorizo a habilitação manual da NFC-e em produção sem prova local de homologação, por decisão expressa do responsável. O teste externo do modelo 65 permanece pendente.</Label></div>
            <div className="grid gap-2"><Label htmlFor={`${id}-modo`}>Forma de registro da decisão</Label><SelecaoFormulario id={`${id}-modo`} value={modoRegistro} disabled={pendente} onValueChange={v => { setModoRegistro(v === "AUTOMACAO_ASSISTIDA" ? "AUTOMACAO_ASSISTIDA" : "SESSAO_NORMAL"); setConfirmado(false); }}><option value="SESSAO_NORMAL">Responsável na sessão autenticada</option><option value="AUTOMACAO_ASSISTIDA">Codex executa instrução expressa do responsável</option></SelecaoFormulario></div>
          </div>}
          {editar && <GrupoAcoes className="flex-wrap">{podeHabilitarManual ? <Button variant="entrada" disabled={pendente || !confirmado || motivos.length > 0 || selecionadosAtivos || ambiente === "PRODUCAO" && semProva65 && !aceite65} onClick={() => executar(ambiente, true)}>Habilitar emissão manual</Button> : <Button variant="entrada" disabled>Emissão ainda não liberada</Button>}<Button variant="outline" disabled={pendente || !confirmado || !h?.habilitada} onClick={() => executar(ambiente, false)}>Bloquear ambiente</Button></GrupoAcoes>}
        </section>;
      })}</div>
      {editar && (podeHabilitarManual || podeBloquearRegistro) && <div className="flex items-start gap-2"><Checkbox id={`${id}-confirmar`} checked={confirmado} disabled={pendente} onCheckedChange={v => setConfirmado(v === true)} /><Label htmlFor={`${id}-confirmar`} className="min-w-0 leading-relaxed">{podeHabilitarManual ? "Confirmo a alteração local da habilitação manual. Este ato não transmite nota, não troca o emissor global do Takeat e não ativa automações." : "Confirmo o bloqueio local do ambiente selecionado. Este ato não transmite nota nem ativa automações."}</Label></div>}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </CardContent>
  </Card>;
}
