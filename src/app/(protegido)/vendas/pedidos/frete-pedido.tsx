"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Info, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CampoEntrega, EscolhaEntrega } from "@/components/entregas/campos-entrega";
import { ResultadoCalculoEntrega } from "@/components/entregas/resultado-entrega";
import { cents, enderecoPreciso, motivosEntrega, type EstadoEntrega } from "@/lib/vendas/entregas-dominio";
import type { PedidoEntrada } from "@/lib/vendas/pedidos-dominio";
import type { ResultadoEntrega } from "@/lib/vendas/entregas";
import { calcularFretePedidoAction } from "./entregas-actions";
import { selecionarVeiculoEntrega, type ConfiguracaoVeiculos, type SelecaoVeiculoEntrega } from "@/lib/vendas/entregas-veiculos";

type Snapshot = {
  selecaoVeiculo?: SelecaoVeiculoEntrega; veiculoEntregaId?: string | null; metodo?: string; cobertura?: string;
  excepcional?: boolean; motivo?: string; motivoCobertura?: string; versao?: number; origemInformada?: string;
  destinoInformado?: { logradouro: string; numero: string; cidade: string; uf: string }; veiculo?: string;
  freteCobrado?: string; calculadoEm?: string; usuarioId?: string;
  memoria?: { frete?: string | null; faixaId?: string; faixaDescricao?: string; excecaoId?: string; excecaoNome?: string; antesGratuidade?: string; descontoFrete?: string };
};
type Motivos = { motivo: string; excecaoCobertura: boolean; motivoCobertura: string };
type CalculoAtual = { assinatura: string; valor: ResultadoEntrega };
const moeda = (valor: string) => Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function fretesIguais(a: string, b: string) { try { return cents(a || "0") === cents(b); } catch { return false; } }

export function FretePedido({ dados: d, alterar, snapshot, manual, aprovarCobertura, configuracaoExistente,
  veiculos, embalagens = [], slotsOcupados, configuracaoHref = "/vendas/area-entrega", mostrarConfiguracao = true,
  calculoAutomatico = false, configuracaoAtiva = false,
}: {
  dados: PedidoEntrada; alterar: (d: PedidoEntrada) => void; snapshot?: Snapshot | null; manual: boolean;
  aprovarCobertura: boolean; configuracaoExistente: boolean; configuracaoHref?: string;
  veiculos?: ConfiguracaoVeiculos; embalagens?: string[]; slotsOcupados?: number | null; mostrarConfiguracao?: boolean;
  calculoAutomatico?: boolean; configuracaoAtiva?: boolean;
}) {
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<CalculoAtual | null>(null);
  const [aberto, setAberto] = useState(false), [legadoAjustado, setLegadoAjustado] = useState(false), [veiculoEditado, setVeiculoEditado] = useState(false);
  const motivosIniciais = { motivo: "", excecaoCobertura: false, motivoCobertura: "" };
  const [motivos, setMotivos] = useState<Motivos>(motivosIniciais), [baseMotivos, setBaseMotivos] = useState<Motivos>(motivosIniciais);
  // Frete e instruções não fazem parte da assinatura: o próprio cálculo não pode iniciar outro.
  const assinatura = JSON.stringify({ cliente: d.clienteId, endereco: d.endereco,
    itens: d.itens.map(({ produtoId, quantidade, escolhas, precoManual, tipoEmbalagemId }) => ({ produtoId, quantidade, escolhas, precoManual, tipoEmbalagemId })),
    embalagens, slotsOcupados, desconto: d.desconto, modalidade: d.atendimento, veiculo: d.veiculoEntregaId ?? null, veiculoEditado });
  const [assinaturaSnapshot] = useState(assinatura);
  const historico = assinatura === assinaturaSnapshot ? snapshot : null;
  const atuais = useRef({ dados: d, assinatura, alterar, historico }), trava = useRef(false);
  const ultimoAutomatico = useRef("");
  useLayoutEffect(() => { atuais.current = { dados: d, assinatura, alterar, historico }; }, [d, assinatura, alterar, historico]);
  useEffect(() => {
    if (!resultado) return;
    const tempo = setTimeout(() => {
      setResultado(null); setErro("Cálculo vencido. Calcule novamente.");
    }, Math.max(0, new Date(resultado.valor.validoAte).getTime() - Date.now()));
    return () => clearTimeout(tempo);
  }, [resultado]);
  const r = resultado?.assinatura === assinatura ? resultado.valor : null;
  const registroVigente = assinatura === assinaturaSnapshot ? snapshot : null;
  const recomendado = veiculos ? selecionarVeiculoEntrega(veiculos, embalagens, null, slotsOcupados) : null;
  const indicado = !d.veiculoEntregaId && r ? r.selecaoVeiculo ?? (r.veiculo ? { id: null, nome: r.veiculo === "CARRO" ? "Carro" : "Moto", perfil: r.veiculo } : recomendado) : recomendado;
  const ativos = (veiculos?.veiculos ?? []).filter(v => v.ativo);
  const escolhido = d.veiculoEntregaId ? ativos.find(v => v.id === d.veiculoEntregaId) : null;
  const veiculoHistorico = !r && !veiculoEditado ? registroVigente?.selecaoVeiculo : null;
  const slotsApresentados = veiculoHistorico?.modelo === "SLOTS" ? veiculoHistorico.slotsOcupados ?? null : slotsOcupados;
  const valorVeiculo = d.veiculoEntregaId ?? veiculoHistorico?.id ?? "";
  const veiculoAlterado = !!d.veiculoEntregaId;
  const valorIndicado = r?.memoria.frete ?? registroVigente?.memoria?.frete ?? (registroVigente?.metodo === "AUTOMATICO" ? registroVigente.freteCobrado : null);
  const metodoManual = d.entrega?.metodo === "MANUAL" || (!d.entrega && registroVigente?.metodo === "MANUAL");
  const freteAlterado = metodoManual && (valorIndicado == null || !fretesIguais(d.frete, valorIndicado));
  const valorConhecido = d.atendimento === "RETIRADA" || metodoManual || !configuracaoExistente || !!registroVigente || r?.memoria.frete != null;
  const produtosPreenchidos = d.itens.length > 0 && d.itens.every(i => !!i.produtoId && /^\d+(?:[.,]\d+)?$/.test(i.quantidade) && Number(i.quantidade.replace(",", ".")) > 0);
  const enderecoPreenchido = enderecoPreciso(d.endereco) && !!d.endereco?.cep.trim();
  const podeAutomatico = calculoAutomatico && configuracaoAtiva && configuracaoExistente && (!snapshot || veiculoEditado) && d.atendimento === "ENTREGA"
    && enderecoPreenchido && produtosPreenchidos && !!(escolhido?.perfil ?? indicado?.perfil);

  const calcular = useCallback(async () => {
    const pedido = atuais.current;
    if (trava.current || pedido.dados.atendimento === "RETIRADA") return;
    trava.current = true; setOcupado(true); setErro(""); ultimoAutomatico.current = pedido.assinatura;
    try {
      const resposta = await calcularFretePedidoAction(pedido.dados);
      if (atuais.current.assinatura !== pedido.assinatura) return;
      if ("erro" in resposta) setErro(resposta.erro ?? "Não foi possível calcular.");
      else {
        const rr = resposta.resultado, atual = atuais.current.dados;
        setResultado({ assinatura: pedido.assinatura, valor: rr });
        const atualManual = atual.entrega?.metodo === "MANUAL" || (!atual.entrega && atuais.current.historico?.metodo === "MANUAL");
        const manterManual = atualManual && (rr.memoria.frete == null || !fretesIguais(atual.frete, rr.memoria.frete));
        atuais.current.alterar({ ...atual,
          ...(rr.memoria.frete != null && !manterManual ? { frete: rr.memoria.frete } : {}),
          entrega: { metodo: manterManual ? "MANUAL" : "AUTOMATICO", recibo: rr.recibo,
            motivo: atual.entrega?.motivo ?? atuais.current.historico?.motivo ?? "", excecaoCobertura: rr.memoria.estado === "PERMITIDO" ? false : atual.entrega?.excecaoCobertura ?? atuais.current.historico?.excepcional ?? false,
            motivoCobertura: atual.entrega?.motivoCobertura ?? atuais.current.historico?.motivoCobertura ?? "" } });
      }
    } catch { if (atuais.current.assinatura === pedido.assinatura) setErro("Não foi possível calcular. Seu preenchimento foi mantido."); }
    finally { trava.current = false; setOcupado(false); }
  }, []);
  useEffect(() => {
    if (!podeAutomatico || ocupado || ultimoAutomatico.current === assinatura) return;
    const tempo = setTimeout(() => { void calcular(); }, 600);
    return () => clearTimeout(tempo);
  }, [assinatura, podeAutomatico, ocupado, calcular]);

  function alterarFrete(valor: string) {
    const atual = atuais.current.dados;
    if (!configuracaoExistente) { setLegadoAjustado(true); alterar({ ...atual, frete: valor || "0", entrega: null }); return; }
    const automatico = valorIndicado != null && fretesIguais(valor, valorIndicado);
    alterar({ ...atual, frete: valor || "0", entrega: { metodo: automatico ? "AUTOMATICO" : "MANUAL", recibo: r?.recibo ?? "",
      motivo: atual.entrega?.motivo ?? atuais.current.historico?.motivo ?? "", excecaoCobertura: atual.entrega?.excecaoCobertura ?? false, motivoCobertura: atual.entrega?.motivoCobertura ?? "" } });
  }
  function abrirDetalhes() {
    const atual = atuais.current.dados;
    const valores = { motivo: atual.entrega?.motivo ?? registroVigente?.motivo ?? "", excecaoCobertura: atual.entrega?.excecaoCobertura ?? registroVigente?.excepcional ?? false, motivoCobertura: atual.entrega?.motivoCobertura ?? registroVigente?.motivoCobertura ?? "" };
    setMotivos(valores); setBaseMotivos(valores);
  }
  function aplicarMotivos() {
    const atual = atuais.current.dados;
    alterar({ ...atual, entrega: { metodo: atual.entrega?.metodo ?? (registroVigente?.metodo === "AUTOMATICO" ? "AUTOMATICO" : "MANUAL"), recibo: r?.recibo ?? atual.entrega?.recibo ?? "", ...motivos } });
    setBaseMotivos(motivos); setAberto(false);
  }
  const pendencia = d.atendimento === "RETIRADA" ? "Retirada: frete zero."
    : ocupado ? "Calculando frete…"
    : resultado && !r ? "Pedido alterado. Cálculo anterior invalidado; calcule novamente."
    : r?.memoria.frete == null && r ? r.memoria.motivo
    : !produtosPreenchidos ? "Selecione os produtos e suas quantidades para calcular o frete."
    : !enderecoPreenchido ? "Preencha o endereço de entrega para calcular o frete."
    : !valorConhecido || (d.entrega?.metodo === "AUTOMATICO" && !r && !!registroVigente) ? "Frete pendente de cálculo."
    : !configuracaoExistente ? "Configuração pendente; frete informado manualmente."
    : "";

  return <div className="space-y-2" aria-label="Veículo e frete do pedido">
    <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,14rem)]">
      <div className="min-w-0 space-y-1">
        <EscolhaEntrega nome="Tipo de veículo" valor={d.atendimento === "RETIRADA" ? "" : valorVeiculo}
          disabled={d.atendimento === "RETIRADA" || !ativos.length} opcoes={d.atendimento === "RETIRADA" ? [{ value: "", label: "Não se aplica à retirada" }] : [
            { value: "", label: veiculoHistorico && !veiculoHistorico.id ? `${veiculoHistorico.nome} · registrado` : indicado?.id ? `${indicado.nome} · indicado` : "Pendente · escolha automática" },
            ...ativos.map(v => ({ value: v.id, label: veiculoHistorico?.id === v.id ? `${veiculoHistorico.nome} · registrado` : v.nome })),
            ...(d.veiculoEntregaId && !escolhido ? [{ value: d.veiculoEntregaId, label: "Veículo salvo indisponível" }] : []),
            ...(veiculoHistorico?.id && !d.veiculoEntregaId && !ativos.some(v => v.id === veiculoHistorico.id) ? [{ value: veiculoHistorico.id, label: `${veiculoHistorico.nome} · registrado` }] : []),
          ]} alterar={id => {
            const atual = atuais.current.dados;
            const manterManual = atual.entrega?.metodo === "MANUAL" || (!atual.entrega && atuais.current.historico?.metodo === "MANUAL");
            setVeiculoEditado(true);
            alterar({ ...atual, veiculoEntregaId: id || null,
              entrega: manterManual ? { metodo: "MANUAL", motivo: atual.entrega?.motivo ?? atuais.current.historico?.motivo ?? "", recibo: "", excecaoCobertura: false, motivoCobertura: "" } : null });
          }} />
        {veiculos?.modelo === "SLOTS" && d.atendimento !== "RETIRADA" && <p className="text-xs text-muted-foreground">{veiculoHistorico && veiculoHistorico.modelo !== "SLOTS" ? "Veículo registrado no pedido." : slotsApresentados == null ? escolhido ? "Slots não informados. Veículo escolhido para este pedido." : "Slots não informados. Escolha um veículo para este pedido." : slotsApresentados + " slots ocupados."}{!veiculoHistorico && !escolhido && recomendado?.pendencia && slotsApresentados != null ? " " + recomendado.pendencia : ""}</p>}
        {veiculoAlterado && <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"><Badge variant="warning">Alterado manualmente</Badge><span>Indicado: {indicado?.nome ?? "Pendente"}.</span></p>}
      </div>
      <CampoEntrega nome="Frete"><div className="flex items-center gap-1"><CurrencyInput aria-label="Frete" value={valorConhecido ? d.atendimento === "RETIRADA" ? "0" : d.frete : ""} placeholder="A calcular"
        containerClassName="min-w-0 flex-1" readOnly={d.atendimento === "RETIRADA" || (!manual && configuracaoExistente)} onValueChange={alterarFrete} />
        {d.atendimento !== "RETIRADA" && <Button type="button" variant="ghost" size="icon-sm" title={r ? "Recalcular frete" : "Calcular frete por rota"} aria-label={r ? "Recalcular frete" : "Calcular frete por rota"}
          disabled={ocupado || !produtosPreenchidos || !enderecoPreenchido} aria-busy={ocupado} onClick={() => void calcular()}><RefreshCw /></Button>}
        <Dialog open={aberto} onOpenChange={setAberto} alterado={JSON.stringify(motivos) !== JSON.stringify(baseMotivos)}>
          <DialogTrigger render={<Button type="button" variant="ghost" size="icon-sm" title="Detalhes do frete" aria-label="Detalhes do frete" onClick={abrirDetalhes} />}><Info /></DialogTrigger>
          <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Detalhes do frete</DialogTitle><DialogDescription>Confira o cálculo, a cobertura e os ajustes. Aplicar prepara o pedido; a gravação acontece ao salvar ou confirmar.</DialogDescription></DialogHeader>
            {mostrarConfiguracao && <Link href={configuracaoHref} className="text-sm text-primary underline">Configurar Entregas</Link>}
            {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
            {pendencia && <p role="status" className="text-sm text-muted-foreground">{pendencia}</p>}
            {d.atendimento !== "RETIRADA" && <Button type="button" variant="outline" onClick={() => void calcular()} disabled={ocupado || !produtosPreenchidos || !enderecoPreenchido} aria-busy={ocupado}>{ocupado ? "Calculando…" : r ? "Recalcular frete" : "Calcular frete por rota"}</Button>}
            {r && <ResultadoCalculoEntrega key={r.calculadoEm} resultado={r} />}
            {d.atendimento !== "RETIRADA" && metodoManual && configuracaoExistente && <>
              <CampoEntrega nome="Justificativa do frete manual"><Input disabled={!manual} value={motivos.motivo} maxLength={1000} onChange={e => setMotivos(a => ({ ...a, motivo: e.target.value }))} /></CampoEntrega>
              <p className="text-xs text-muted-foreground">{veiculos?.modelo === "SLOTS" ? "Alterar o preço exige justificativa e mantém a cobertura limitada à última faixa de Frete." : "Alterar o preço exige justificativa e não libera bloqueios ou distância máxima."}</p>
              {aprovarCobertura && veiculos?.modelo !== "SLOTS" && <><EscolhaEntrega nome="Aprovação excepcional de atendimento" valor={motivos.excecaoCobertura ? "SIM" : "NAO"} opcoes={[{ value: "NAO", label: "Sem aprovação excepcional" }, { value: "SIM", label: "Aprovar região bloqueada ou fora da área" }]} alterar={valor => setMotivos(a => ({ ...a, excecaoCobertura: valor === "SIM" }))} />
                {motivos.excecaoCobertura && <CampoEntrega nome="Justificativa da cobertura excepcional"><Input value={motivos.motivoCobertura} maxLength={1000} onChange={e => setMotivos(a => ({ ...a, motivoCobertura: e.target.value }))} /></CampoEntrega>}</>}
            </>}
            {snapshot && <div className="space-y-1 border-t pt-3 text-sm"><p>Registro comercial: {snapshot.metodo === "AUTOMATICO" ? "Automático por rota" : snapshot.metodo === "RETIRADA" ? "Retirada" : "Manual"} · Cobertura: {snapshot.cobertura === "NAO_VALIDADA" ? "Não validada" : motivosEntrega[snapshot.cobertura as EstadoEntrega] ?? "Retirada"}{snapshot.excepcional ? " · Aprovada excepcionalmente" : ""} · Regras v{snapshot.versao ?? "—"}</p>
              {snapshot.origemInformada && <p>Origem informada: {snapshot.origemInformada} · Veículo: {snapshot.selecaoVeiculo?.nome ?? snapshot.veiculo ?? "Pendente"} ({snapshot.selecaoVeiculo?.perfil ?? snapshot.veiculo ?? "—"})</p>}
              {snapshot.destinoInformado && <p>Destino informado: {snapshot.destinoInformado.logradouro}, {snapshot.destinoInformado.numero} · {snapshot.destinoInformado.cidade}/{snapshot.destinoInformado.uf}</p>}
              <p>Faixa: {snapshot.memoria?.faixaDescricao ?? snapshot.memoria?.faixaId ?? "—"}{snapshot.selecaoVeiculo?.modelo !== "SLOTS" && <> · Exceção: {snapshot.memoria?.excecaoNome ?? snapshot.memoria?.excecaoId ?? "—"}</>} · Frete cobrado: {moeda(snapshot.freteCobrado ?? d.frete)}</p>
              {snapshot.motivo && <p>Ajuste: {snapshot.motivo}</p>}{snapshot.motivoCobertura && <p>Cobertura excepcional: {snapshot.motivoCobertura}</p>}
              <p className="text-xs text-muted-foreground">Pedidos confirmados preservam sua decisão comercial. Dados de mapas não são mantidos no histórico.</p></div>}
            <DialogFooter>{metodoManual && configuracaoExistente && (manual || aprovarCobertura) && <Button type="button" disabled={ocupado || !motivos.motivo.trim() || (motivos.excecaoCobertura && !motivos.motivoCobertura.trim())} onClick={aplicarMotivos}>Aplicar ajustes</Button>}</DialogFooter>
          </DialogContent>
        </Dialog>
      </div>{(freteAlterado || legadoAjustado) && <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"><Badge variant="warning">Alterado manualmente</Badge>{valorIndicado != null && <span>Indicado: {moeda(valorIndicado)}.</span>}</span>}</CampoEntrega>
    </div>
    {erro ? <p role="alert" className="text-xs text-destructive">{erro}</p> : pendencia && <p role="status" className="text-xs text-muted-foreground">{pendencia}</p>}
    {metodoManual && configuracaoExistente && !(d.entrega?.motivo ?? registroVigente?.motivo ?? "").trim() && <p className="text-xs text-warning">Informe a justificativa em Detalhes do frete antes de confirmar.</p>}
  </div>;
}
