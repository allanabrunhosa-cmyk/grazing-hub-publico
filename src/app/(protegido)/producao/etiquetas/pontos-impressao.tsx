"use client";

import { SelecaoFormulario } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, ChefHat, Printer, Tags } from "lucide-react";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { excluirPontoImpressaoAction, restaurarPontoImpressaoAction } from "./operacao-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarPontoImpressaoAction, atualizarPontoImpressaoAction, emitirCodigoPontoAction, imprimirTestePontoAction, revogarPontoAction, selecionarImpressoraPontoAction, solicitarMudancaWifiPontoAction } from "./pontos-actions";

export type PontoImpressaoTela = {
  id: string; excluidoEm?: string | null; nome: string; icone: string; ativo: boolean; padrao: boolean;
  situacao: "NAO_VINCULADO" | "REVOGADO" | "AGUARDANDO_PRIMEIRA_COMUNICACAO" | "RECENTE" | "ATRASADA";
  vistoEm: string | null; impressoraDetectada: boolean; impressoraSelecionadaId: string | null;
  impressoras: { id: string; nome: string }[];
  wifiSsid: string | null; wifiFrequenciaMhz: number | null; wifiEndereco: string | null; ethernetEndereco: string | null;
  wifiRedes: { ssid: string; frequenciaMhz: number }[];
  wifiMudancaEstado: string | null;
  hostname: string | null; modelo: string | null;
  pendentes: number; incertos: number;
};

const SITUACAO = {
  NAO_VINCULADO: "Equipamento ainda não vinculado", REVOGADO: "Vínculo revogado",
  AGUARDANDO_PRIMEIRA_COMUNICACAO: "Vinculado · aguardando primeira comunicação",
  RECENTE: "Comunicação recente", ATRASADA: "Comunicação atrasada ou indisponível",
};

function IconePonto({ icone }: { icone: string }) {
  return icone === "cozinha" ? <ChefHat className="size-5" aria-hidden="true" /> : icone === "etiqueta" ? <Tags className="size-5" aria-hidden="true" /> : <Printer className="size-5" aria-hidden="true" />;
}

function LinhaPonto({ ponto }: { ponto: PontoImpressaoTela }) {
  const roteador = useRouter();
  const [pendente, iniciar] = useTransition();
  const [nome, setNome] = useState(ponto.nome);
  const [icone, setIcone] = useState(ponto.icone);
  const [ativo, setAtivo] = useState(ponto.ativo);
  const [padrao, setPadrao] = useState(ponto.padrao);
  const [codigo, setCodigo] = useState<{ valor: string; expiraEm: string } | null>(null);
  const [impressora, setImpressora] = useState(ponto.impressoraSelecionadaId ?? "");
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiSenha, setWifiSenha] = useState("");
  const [wifiConfirmacao, setWifiConfirmacao] = useState(false);
  function executar(acao: () => Promise<{ erro: string } | { ok: true }>, sucesso: string) {
    iniciar(async () => { const resultado = await acao(); if ("erro" in resultado) toast.error(resultado.erro); else { toast.success(sucesso); roteador.refresh(); } });
  }
  return <Card>
    <details className="group">
    <summary className="flex cursor-pointer list-none items-center gap-3 p-4 focus-visible:outline focus-visible:outline-ring">
      <IconePonto icone={ponto.icone} /><div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{ponto.nome}{ponto.padrao ? " · padrão" : ""}</h3><p className="mt-1 text-xs text-muted-foreground">{SITUACAO[ponto.situacao]} · USB {ponto.impressoraDetectada ? "detectada" : "não detectada"}</p><p className="text-xs text-muted-foreground">{ponto.pendentes} pendente(s) · {ponto.incertos} incerto(s)</p></div><ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
    </summary>
    <CardContent className="space-y-3 border-t pt-4">
      <p className="text-xs text-muted-foreground">{ponto.vistoEm ? `Última comunicação: ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(ponto.vistoEm))}` : "Nenhuma comunicação recebida"}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor={`nome-${ponto.id}`}>Nome do ponto</Label><Input id={`nome-${ponto.id}`} value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} /></div>
        <div><Label htmlFor={`icone-${ponto.id}`}>Ícone</Label><SelecaoFormulario id={`icone-${ponto.id}`} value={icone} onValueChange={(novoValor) => setIcone(novoValor)}><option value="impressora">Impressora</option><option value="cozinha">Cozinha</option><option value="etiqueta">Etiqueta</option></SelecaoFormulario></div>
      </div>
      <div className="flex flex-wrap gap-5 text-sm"><label><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativo</label><label><input type="checkbox" checked={padrao} onChange={(e) => setPadrao(e.target.checked)} /> Ponto padrão</label></div>
      <Button disabled={pendente} onClick={() => executar(() => atualizarPontoImpressaoAction(ponto.id, { nome, icone, ativo, padrao }), "Ponto salvo.")}>Salvar ponto</Button>
      <div className="grid gap-2 rounded-xl border p-3 text-xs sm:grid-cols-2"><strong className="sm:col-span-2">Equipamento</strong><p>{ponto.hostname || "Ainda não informado"}{ponto.modelo ? ` · ${ponto.modelo}` : ""}</p><p>Wi-Fi: {ponto.wifiSsid || "sem informação"}{ponto.wifiFrequenciaMhz ? ` · ${ponto.wifiFrequenciaMhz} MHz` : ""}{ponto.wifiEndereco ? ` · ${ponto.wifiEndereco}` : ""}</p><p>Ethernet: {ponto.ethernetEndereco || "sem informação"}</p><p>Redes 2,4 GHz detectadas: {ponto.wifiRedes.length ? ponto.wifiRedes.map((rede) => rede.ssid).join(", ") : "nenhuma informação recente"}. Também será possível informar um SSID manualmente na etapa de mudança de rede.</p><p className="text-muted-foreground">A rede atual é somente consultada; mudanças de Wi-Fi exigem uma etapa acompanhada.</p></div>
      <details className="rounded-xl border p-3 text-sm"><summary className="cursor-pointer font-semibold">Mudar Wi-Fi futuramente</summary><div className="mt-3 space-y-3"><p>Somente com alguém na unidade. Este Pi 3 B usa Wi-Fi de 2,4 GHz. O perfil atual é preservado e a mudança será revertida se o novo Wi-Fi não alcançar o HUB por HTTPS.</p><p>Última solicitação: {ponto.wifiMudancaEstado ?? "nenhuma"}. Se o equipamento não estiver comunicando, ele não pode receber uma mudança pelo site.</p><div><Label htmlFor={`rede-${ponto.id}`}>Rede detectada</Label><SelecaoFormulario id={`rede-${ponto.id}`} value={wifiSsid} onValueChange={(novoValor) => setWifiSsid(novoValor)}><option value="">Informar SSID manualmente</option>{ponto.wifiRedes.map((rede) => <option key={rede.ssid} value={rede.ssid}>{rede.ssid} · {rede.frequenciaMhz} MHz</option>)}</SelecaoFormulario></div><div><Label htmlFor={`ssid-${ponto.id}`}>SSID da nova rede</Label><Input id={`ssid-${ponto.id}`} value={wifiSsid} maxLength={32} onChange={(e) => setWifiSsid(e.target.value)} /></div><div><Label htmlFor={`senha-${ponto.id}`}>Senha da nova rede</Label><Input id={`senha-${ponto.id}`} type="password" autoComplete="new-password" value={wifiSenha} onChange={(e) => setWifiSenha(e.target.value)} /></div><label className="flex gap-2"><input type="checkbox" checked={wifiConfirmacao} onChange={(e) => setWifiConfirmacao(e.target.checked)} /> Há alguém disponível na unidade para recuperar a conexão se necessário.</label><Button disabled={pendente || ponto.situacao !== "RECENTE" || !wifiSsid || !wifiSenha || !wifiConfirmacao} onClick={() => iniciar(async () => { const resultado = await solicitarMudancaWifiPontoAction({ pontoId: ponto.id, ssid: wifiSsid, senha: wifiSenha, confirmacao: wifiConfirmacao }); setWifiSenha(""); if ("erro" in resultado) toast.error(resultado.erro); else { toast.success("Mudança enviada; acompanhe o resultado antes de sair."); roteador.refresh(); } })}>Solicitar mudança de Wi-Fi</Button></div></details>
      <div className="space-y-2"><strong className="text-sm">Impressora USB: {ponto.impressoraDetectada ? "detectada" : "não detectada ou não selecionada"}</strong><div className="flex flex-wrap gap-2"><SelecaoFormulario aria-label={`Impressora de ${ponto.nome}`} value={impressora} onValueChange={(novoValor) => setImpressora(novoValor)}><option value="">Selecionar impressora</option>{ponto.impressoras.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</SelecaoFormulario><Button variant="outline" disabled={pendente || !impressora} onClick={() => executar(() => selecionarImpressoraPontoAction(ponto.id, impressora), "Impressora selecionada.")}>Selecionar</Button></div><p className="text-xs text-muted-foreground">Mídia homologada para este ponto: 60 × 60 mm, 203 dpi, ZPL.</p></div>
      <p className="text-sm">Fila: {ponto.pendentes} pendente(s) · {ponto.incertos} de resultado incerto.</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={pendente || !ponto.ativo} onClick={() => iniciar(async () => { const resultado = await emitirCodigoPontoAction(ponto.id); if ("erro" in resultado) toast.error(resultado.erro); else setCodigo({ valor: resultado.codigo, expiraEm: resultado.expiraEm.toISOString() }); })}>Gerar código de vínculo</Button><Button variant="outline" disabled={pendente || !ponto.impressoraSelecionadaId} onClick={() => executar(() => imprimirTestePontoAction(ponto.id), "Teste colocado na fila; confira a etiqueta física na operação.")}>Imprimir teste</Button><Button variant="destructive" disabled={pendente || ponto.situacao === "NAO_VINCULADO" || ponto.situacao === "REVOGADO"} onClick={() => { if (window.confirm("Revogar o acesso deste equipamento? Trabalhos em andamento ficarão incertos.")) executar(() => revogarPontoAction(ponto.id), "Vínculo revogado."); }}>Revogar vínculo</Button></div>
      {codigo && <p role="status" className="rounded-xl border bg-muted p-3 text-sm">Código de uso único: <strong className="break-all font-mono">{codigo.valor}</strong><br />Válido até {new Date(codigo.expiraEm).toLocaleString("pt-BR")}. Digite somente no terminal da Raspberry durante a instalação. Este código não é a senha da rede.</p>}
      <GrupoAcoes nome={`Gestão do ponto ${ponto.nome}`}><Button variant="excluir-rotulo" aria-label={`Excluir ponto ${ponto.nome}`} disabled={pendente || ponto.padrao} onClick={() => { if (window.confirm(`Excluir o ponto ${ponto.nome}? O histórico será preservado e o vínculo será revogado.`)) executar(() => excluirPontoImpressaoAction(ponto.id), "Ponto excluído."); }}>Excluir</Button></GrupoAcoes>
      {ponto.padrao && <p className="text-xs text-muted-foreground">O ponto padrão é preservado. Defina outro padrão para permitir a exclusão.</p>}
    </CardContent></details>
  </Card>;
}

export function PainelPontosImpressao({ pontos }: { pontos: PontoImpressaoTela[] }) {
  const roteador = useRouter();
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false);
  const [nome, setNome] = useState("");
  const [icone, setIcone] = useState("impressora");
  const [pendente, iniciar] = useTransition();
  return <div className="space-y-5"><Card><CardHeader><CardTitle>Pontos de impressão</CardTitle><CardDescription>O conector na Raspberry envia trabalhos à Zebra USB. A comunicação do equipamento não garante que a impressora esteja pronta.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-end gap-3"><div><Label htmlFor="novo-ponto">Nome do novo ponto</Label><Input id="novo-ponto" maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Cozinha principal" /></div><div><Label htmlFor="novo-icone">Ícone</Label><SelecaoFormulario id="novo-icone" value={icone} onValueChange={(novoValor) => setIcone(novoValor)}><option value="impressora">Impressora</option><option value="cozinha">Cozinha</option><option value="etiqueta">Etiqueta</option></SelecaoFormulario></div><Button disabled={pendente || !nome.trim()} onClick={() => iniciar(async () => { const resultado = await criarPontoImpressaoAction(nome, icone); if ("erro" in resultado) toast.error(resultado.erro); else { setNome(""); roteador.refresh(); toast.success("Ponto criado."); } })}>Cadastrar ponto</Button><Button variant="outline" onClick={() => roteador.refresh()}>Atualizar situação</Button></CardContent></Card>{pontos.filter(ponto => !ponto.excluidoEm).map(ponto => <LinhaPonto key={ponto.id} ponto={ponto} />)}{pontos.some(ponto => ponto.excluidoEm) && <div className="space-y-3"><Button variant="ghost" aria-expanded={mostrarExcluidos} onClick={() => setMostrarExcluidos(!mostrarExcluidos)}>{mostrarExcluidos ? "Ocultar excluídos" : "Ver pontos excluídos"}</Button>{mostrarExcluidos && pontos.filter(ponto => ponto.excluidoEm).map(ponto => <Card key={ponto.id}><CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4"><div className="min-w-0"><strong>{ponto.nome}</strong><p className="text-xs text-muted-foreground">Excluído · histórico preservado. Restaurar mantém o ponto inativo e exige novo vínculo.</p></div><Button variant="outline" disabled={pendente} onClick={() => iniciar(async () => { const r = await restaurarPontoImpressaoAction(ponto.id); if ("erro" in r) toast.error(r.erro); else { roteador.refresh(); toast.success("Cadastro restaurado, ainda inativo."); } })}>Restaurar cadastro</Button></CardContent></Card>)}</div>}</div>;
}
