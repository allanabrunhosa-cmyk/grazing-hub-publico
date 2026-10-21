"use client";
import { useContext, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelecaoFormulario } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { executarFisicoPedidoAction } from "../../fisico-actions";
import { produzirMaterialAction } from "../../producao/actions";
import type { ComandoFisico } from "@/lib/vendas/pedidos-fisico";
import { PedidoPopupContext } from "../../modal-pedido";

export type ResumoFisico = { id: string; itemId: string; nome: string; local: string; unidade: string; reservada: string; consumida: string; liberada: string; retornada: string; perdida: string; lote: string };
export function FisicoPedido({ id, versao, editar, locais, itens, reservas, producao = false, retornosSomente = false }: { retornosSomente?: boolean; producao?: boolean; id: string; versao: number; editar: boolean; locais: { id: string; nome: string }[]; itens: { id: string; nome: string }[]; reservas: ResumoFisico[] }) {
  const popup = useContext(PedidoPopupContext);
  const router = useRouter(); const [ocupado, iniciar] = useTransition(); const [erro, setErro] = useState("");
  const [itemId, item] = useState(""); const [localId, local] = useState(""); const [qtd, quantidade] = useState("");
  const [qtdMaterial, quantidadeMaterial] = useState("");
  const [reservaId, reserva] = useState(""); const [acao, setAcao] = useState<Exclude<ComandoFisico["tipo"], "RESERVAR">>(retornosSomente ? "RETORNAR" : "CONSUMIR"); const [motivo, setMotivo] = useState("");
  const chaves = useRef<Record<string, string>>({});
  function executar(comando: ComandoFisico) {
    if (popup?.temAlteracoes()) { setErro("Salve ou descarte as alterações comerciais antes do apontamento físico."); return; }
    const key = chaves.current[JSON.stringify(comando)] ??= crypto.randomUUID();
    iniciar(async () => { setErro(""); try { const r = await (producao ? produzirMaterialAction : executarFisicoPedidoAction)(id, versao, comando, key); if ("erro" in r) setErro(r.erro ?? "Falha ao registrar."); else { popup?.marcarSalvo("materiais"); router.refresh(); } } catch { setErro("Resultado não confirmado. Recarregue e confira o histórico."); } });
  }
  return <section onChangeCapture={() => popup?.marcarAlterado("materiais")} className="min-w-0 space-y-4 rounded-2xl border bg-card p-4"><h2 className="font-semibold">{retornosSomente ? "Materiais: retorno e perda" : "Reserva e utilização de materiais"}</h2>
    <p className="text-sm text-muted-foreground">Reserva é calculada pela ficha. Consumo é apontamento da equipe; não equivale a medição automática. Custo por movimentos aguarda política de valorização. Escolha explicitamente o local e a quantidade utilizada.</p>
    {erro && <p role="alert" className="text-destructive">{erro}</p>}
    {editar && !retornosSomente && <><div className="grid items-end gap-3 sm:grid-cols-2">
      <label>Item<SelecaoFormulario aria-label="Item"  value={itemId} onValueChange={valor => item(valor)}><option value="">Selecione</option>{itens.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}</SelecaoFormulario></label>
      <label>Local<SelecaoFormulario aria-label="Local"  value={localId} onValueChange={valor => local(valor)}><option value="">Selecione</option>{locais.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}</SelecaoFormulario></label>
      <label>Quantidade do item<Input value={qtd} onChange={e => quantidade(e.target.value.replace(",", "."))} inputMode="decimal" min={0} casasDecimais={6} maxLength={17} /></label>
      <Button disabled={ocupado || !itemId || !localId || !qtd} onClick={() => executar({ tipo: "RESERVAR", itemId, localId, quantidade: qtd })}>Reservar para preparação</Button>
    </div></>}
    <Table><TableHeader><TableRow>{["Material / lote de execução", "Local", "Reservado", "Retirado", "Liberado", "Retornado", "Perda após retirada"].map((t, i) => <TableHead className={i > 1 ? "text-right" : undefined} key={t}>{t}</TableHead>)}</TableRow></TableHeader><TableBody>{reservas.map((r, n) => <TableRow key={r.id}><TableCell className="whitespace-normal">{r.nome} ({r.unidade})<br /><span className="text-muted-foreground">Lote {n + 1}</span></TableCell><TableCell className="whitespace-normal">{r.local}</TableCell>{[r.reservada, r.consumida, r.liberada, r.retornada, r.perdida].map((v, i) => <TableCell className="text-right tabular-nums" key={i}>{v}</TableCell>)}</TableRow>)}</TableBody></Table>
    {!reservas.length && <p>Nenhuma reserva registrada. Demanda física ainda não reservada.</p>}
    {editar && reservas.length > 0 && <div className="grid items-end gap-3 sm:grid-cols-2"><label className="min-w-0">Reserva<SelecaoFormulario aria-label="Reserva" value={reservaId} onValueChange={valor => { reserva(valor); popup?.marcarAlterado("materiais"); }}><option value="">Selecione</option>{reservas.map((r, n) => <option key={r.id} value={r.id}>{r.nome} — {r.local} — lote {n + 1}</option>)}</SelecaoFormulario></label>
      <label className="min-w-0">Ação<SelecaoFormulario aria-label="Ação física" value={acao} onValueChange={valor => { setAcao(valor as typeof acao); popup?.marcarAlterado("materiais"); }}>{!retornosSomente && <><option value="CONSUMIR">Registrar uso na preparação</option><option value="EXPEDIR_REVENDA">Saída de revenda na expedição</option></>}<option value="LIBERAR">Liberar reserva sem saída</option><option value="RETORNAR">Confirmar material recuperado</option><option value="PERDA">Registrar perda do já retirado</option></SelecaoFormulario></label>
      <label>Quantidade do material<Input aria-label="Quantidade do material" value={qtdMaterial} onChange={e => quantidadeMaterial(e.target.value.replace(",", "."))} inputMode="decimal" min={0} casasDecimais={6} maxLength={19} /></label>
      <label>Motivo / condição confirmada<Input value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={1000} /></label>
      <Button disabled={ocupado || !reservaId || !qtdMaterial || !motivo} onClick={() => executar({ tipo: acao, reservaId, quantidade: qtdMaterial, motivo })}>Confirmar apontamento físico</Button>
    </div>}
  </section>;
}
