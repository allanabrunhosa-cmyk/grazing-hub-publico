"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { InputComSufixo } from "@/components/ui/input-com-sufixo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusAtivo } from "@/components/status-ativo";
import { BarraAcoes, GrupoAcoes } from "@/components/padroes-operacionais";
import { CampoEntrega, EscolhaEntrega } from "@/components/entregas/campos-entrega";
import { CamposEnderecoEntrega } from "@/components/entregas/endereco-entrega";
import { ResultadoCalculoEntrega } from "@/components/entregas/resultado-entrega";
import { enderecoEntregaVazio, kmParaMetros, pendenciasEntregas, type ConfiguracaoEntregas } from "@/lib/vendas/entregas-dominio";
import type { consultarEntregas, ResultadoEntrega } from "@/lib/vendas/entregas";
import { salvarEntregasAction, simularEntregaAction, buscarCepEntregaAction } from "./actions";
import { VeiculosEntregaEditor } from "@/components/entregas/veiculos-editor";
import { BotaoRemoverItem } from "@/components/remover-item";

type Consulta = Awaited<ReturnType<typeof consultarEntregas>>;
type Inicial = Pick<Consulta, "config" | "versao" | "origemLoja" | "mapasProntos" | "pendencias"> & Partial<Pick<Consulta, "nomeLoja" | "enderecoLoja" | "enderecoLojaLegado">>;
function rascunho(c: ConfiguracaoEntregas): ConfiguracaoEntregas { return { ...c, modelo: "SLOTS", veiculo: null, veiculoPadraoId: null, regrasVeiculo: [], excecoes: [], pedidoMinimo: null, freteMinimo: null, gratisAPartir: null, origemNome: c.origemNome ?? "", veiculos: c.veiculos ?? [] }; }
const limitesIniciais = (c: ConfiguracaoEntregas) => Object.fromEntries(c.faixas.map(f => [f.id, String(f.limiteMetros / 1000)]));
export function EntregasForm({ inicial, editar }: { inicial: Inicial; editar: boolean }) {
  const [base, setBase] = useState({ ...inicial, config: rascunho(inicial.config) });
  const [d, setD] = useState(() => rascunho(inicial.config));
  const [limites, setLimites] = useState(() => limitesIniciais(inicial.config));
  const [salvando, setSalvando] = useState(false), [erro, setErro] = useState(""), [aviso, setAviso] = useState("");
  const [endereco, setEndereco] = useState({ ...enderecoEntregaVazio }), [veiculoSim, setVeiculoSim] = useState("");
  const [consultandoOrigem, setConsultandoOrigem] = useState(false), [consultandoDestino, setConsultandoDestino] = useState(false);
  const [simulando, setSimulando] = useState(false), [simErro, setSimErro] = useState("");
  const [resultado, setResultado] = useState<{ assinatura: string; valor: ResultadoEntrega } | null>(null);
  const assinatura = JSON.stringify({ endereco, veiculoSim, versao: base.versao });
  const atual = useRef(assinatura), travaSalvar = useRef(false), travaSimular = useRef(false);
  useLayoutEffect(() => { atual.current = assinatura; }, [assinatura]);
  useEffect(() => {
    if (!resultado) return;
    const t = setTimeout(() => { setResultado(null); setSimErro("Cálculo vencido. Simule novamente."); }, Math.max(0, new Date(resultado.valor.validoAte).getTime() - Date.now()));
    return () => clearTimeout(t);
  }, [resultado]);
  const alterado = JSON.stringify(d) !== JSON.stringify(base.config) || d.faixas.some(f => limites[f.id] !== String(f.limiteMetros / 1000));
  const bloqueado = !editar || salvando;
  const nomeLoja = base.nomeLoja || "Grazing Table & Co";
  function campo<K extends keyof ConfiguracaoEntregas>(k: K, valor: ConfiguracaoEntregas[K]) { setD(a => ({ ...a, [k]: valor })); setErro(""); setAviso(""); }
  async function salvar() {
    if (travaSalvar.current || consultandoOrigem) return;
    travaSalvar.current = true; setSalvando(true); setErro(""); setAviso("");
    try {
      const config = { ...d, faixas: d.faixas.map(f => ({ ...f, limiteMetros: kmParaMetros(limites[f.id] ?? "") })) };
      const r = await salvarEntregasAction(config, base.versao);
      if ("erro" in r) setErro(r.erro);
      else {
        const confirmado = r.config ?? config;
        setD(confirmado); setLimites(limitesIniciais(confirmado));
        setBase({ ...base, config: confirmado, versao: r.versao, pendencias: [...pendenciasEntregas(confirmado, base.origemLoja), ...(!base.mapasProntos ? ["Integração Google Maps pendente de configuração"] : [])] });
        setAviso("Configuração de Entregas salva. Pedidos confirmados mantêm seus valores.");
      }
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar. Seu preenchimento foi mantido."); }
    finally { travaSalvar.current = false; setSalvando(false); }
  }
  async function simular() {
    if (travaSimular.current || consultandoDestino || !veiculoSim) return;
    travaSimular.current = true; setSimulando(true); setSimErro("");
    try {
      const r = await simularEntregaAction({ clienteId: null, atendimento: "ENTREGA", endereco, subtotalProdutos: "0.00", veiculoEntregaId: veiculoSim });
      if (atual.current !== assinatura) return;
      if ("erro" in r) setSimErro(r.erro ?? "Não foi possível simular."); else setResultado({ assinatura, valor: r.resultado });
    } catch { if (atual.current === assinatura) setSimErro("Não foi possível simular. Tente novamente."); }
    finally { travaSimular.current = false; setSimulando(false); }
  }
  return <div className="space-y-6">
    <BarraAcoes titulo="Entregas" descricao="Frete por distância e capacidade dos veículos"><Button variant="outline" nativeButton={false} render={<Link href="/vendas/pedidos" />}>Pedidos</Button></BarraAcoes>
    <Card><CardHeader><CardTitle>Cálculo automático {base.config.ativo ? "ativo" : "inativo"}</CardTitle><CardDescription>O pedido indica o veículo pela ocupação de slots e usa o frete cadastrado para a distância da rota.</CardDescription></CardHeader><CardContent>{base.pendencias.length > 0 && <p className="text-sm text-muted-foreground">Configuração pendente: {base.pendencias.join(" · ")}</p>}</CardContent></Card>
    <Tabs defaultValue="frete">
      <TabsList aria-label="Configuração de Entregas">{[["frete", "Taxa de entrega"], ["veiculos", "Veículos"], ["mapas", "Integração de mapas"], ["simulador", "Simulador de frete"]].map(([v, n]) => <TabsTrigger key={v} value={v} className="flex-none">{n}</TabsTrigger>)}</TabsList>
      <TabsContent value="frete"><Card><CardHeader><CardTitle>Taxa de entrega</CardTitle></CardHeader><CardContent className="space-y-6">
        <fieldset disabled={bloqueado} className="min-w-0 space-y-5">
          <StatusAtivo nome="cálculo automático de entregas" ativo={d.ativo} onChange={ativo => campo("ativo", ativo)} />
          <section className="max-w-4xl space-y-4" aria-label="Origem da rota">
            <h3 className="text-sm font-semibold">Origem da rota</h3>
            <div className="max-w-xs"><EscolhaEntrega nome="Origem" valor={d.origemTipo} opcoes={[{ value: "LOJA", label: nomeLoja }, { value: "PERSONALIZADA", label: "Origem personalizada" }]} alterar={v => campo("origemTipo", v as ConfiguracaoEntregas["origemTipo"])} disabled={bloqueado || consultandoOrigem} /></div>
            <div className="max-w-sm"><CampoEntrega nome="Nome"><Input maxLength={160} readOnly={d.origemTipo === "LOJA"} value={d.origemTipo === "LOJA" ? nomeLoja : d.origemNome ?? ""} onChange={e => campo("origemNome", e.target.value)} /></CampoEntrega></div>
            <CamposEnderecoEntrega consultarCep={buscarCepEntregaAction} prefixo="Endereço da origem" valor={d.origemTipo === "LOJA" ? base.enderecoLoja ?? enderecoEntregaVazio : d.origem} alterar={v => campo("origem", v)} somenteLeitura={bloqueado || d.origemTipo === "LOJA"} onConsultandoCepChange={setConsultandoOrigem} />
            {d.origemTipo === "LOJA" && <p className="text-xs text-muted-foreground">Endereço de <Link href="/configuracoes/empresa" className="underline">Dados da empresa</Link>. {!base.enderecoLoja && "Complete o endereço estruturado para usar esta origem."}</p>}
          </section>
          <section className="space-y-3" aria-label="Frete">
            <h3 className="text-sm font-semibold">Frete</h3>
            <Table className="w-max table-fixed text-left">
              <colgroup><col className="w-32" />{(d.veiculos ?? []).map(v => <col key={v.id} className="w-40" />)}<col className="w-14" /></colgroup>
              <TableHeader><TableRow><TableHead>Até (km)</TableHead>{(d.veiculos ?? []).map(v => <TableHead key={v.id}>{v.nome || "Novo veículo"}</TableHead>)}<TableHead><span className="sr-only">Remover</span></TableHead></TableRow></TableHeader>
              <TableBody>{d.faixas.map((f, i) => <TableRow key={f.id}>
                <TableCell><InputComSufixo sufixo="km" aria-label={"Limite em km da faixa " + (i + 1)} inputMode="decimal" casasDecimais={3} maxLength={8} value={limites[f.id] ?? ""} onChange={e => setLimites(a => ({ ...a, [f.id]: e.target.value }))} /></TableCell>
                {(d.veiculos ?? []).map(v => <TableCell key={v.id}><CurrencyInput aria-label={"Frete de " + (v.nome || "novo veículo") + " na faixa " + (i + 1)} value={f.precos?.[v.id] ?? ""} onValueChange={preco => campo("faixas", d.faixas.map(a => a.id === f.id ? { ...a, precos: { ...a.precos, [v.id]: preco } } : a))} /></TableCell>)}
                <TableCell><BotaoRemoverItem nome={"Remover faixa " + (i + 1)} disabled={bloqueado} onClick={() => campo("faixas", d.faixas.filter(a => a.id !== f.id))} /></TableCell>
              </TableRow>)}</TableBody>
            </Table>
            {!d.faixas.length && <p className="text-sm text-muted-foreground">Nenhuma faixa cadastrada. A última faixa define a cobertura.</p>}
            <Button type="button" variant="outline" disabled={bloqueado || d.faixas.length >= 100} onClick={() => { const id = crypto.randomUUID(); campo("faixas", [...d.faixas, { id, limiteMetros: 0, preco: "0.00", precos: {} }]); setLimites(a => ({ ...a, [id]: "" })); }}>Adicionar faixa</Button>
          </section>
        </fieldset>
      </CardContent></Card></TabsContent>
      <TabsContent value="veiculos"><VeiculosEntregaEditor config={d} alterar={setD} disabled={bloqueado} /></TabsContent>
      <TabsContent value="mapas"><Card><CardHeader><CardTitle>Integração de mapas</CardTitle></CardHeader><CardContent className="max-w-4xl space-y-3 text-sm">
        <p>{base.mapasProntos ? "Google Maps configurado no servidor. Rota real deve ser conferida na operação." : "Pendente de configuração: credencial privada e habilitação do adaptador no servidor."}</p>
        <p>Rota principal de ida, com perfil específico para carro ou moto. Coordenadas, distância, duração e trajeto são transitórios; o histórico conserva decisões e valores comerciais.</p>
        <p>Uso limitado por dia e usuário, com timeout e uma repetição para falha transitória.</p>
        <p><Link href="/termos-mapas" className="underline">Termos de mapas</Link> · <Link href="/privacidade-mapas" className="underline">Privacidade de mapas</Link></p>
      </CardContent></Card></TabsContent>
      <TabsContent value="simulador"><Card><CardHeader><CardTitle>Simulador de frete</CardTitle><CardDescription>Endereço e veículo usam a configuração salva e o mesmo cálculo dos pedidos.</CardDescription></CardHeader><CardContent className="space-y-4">
        <div className="max-w-4xl"><CamposEnderecoEntrega consultarCep={buscarCepEntregaAction} prefixo="Endereço do destino" valor={endereco} alterar={setEndereco} somenteLeitura={simulando} onConsultandoCepChange={setConsultandoDestino} /></div>
        <div className="max-w-xs"><EscolhaEntrega nome="Veículo" valor={veiculoSim} opcoes={[{ value: "", label: "Selecione o veículo" }, ...(base.config.veiculos ?? []).filter(v => v.ativo).map(v => ({ value: v.id, label: v.nome }))]} alterar={setVeiculoSim} disabled={simulando} /></div>
        {alterado && <p className="text-sm text-muted-foreground">Salve as alterações antes de simular.</p>}
        <Button type="button" disabled={simulando || alterado || consultandoDestino || !veiculoSim} onClick={() => void simular()} aria-busy={simulando}>{simulando ? "Calculando…" : "Simular entrega"}</Button>
        {simErro && <p role="alert" className="text-sm text-destructive">{simErro}</p>}
        {resultado && resultado.assinatura !== assinatura && <p role="status" className="text-sm text-muted-foreground">Entradas alteradas. Simule novamente.</p>}
        {resultado?.assinatura === assinatura && <ResultadoCalculoEntrega key={resultado.valor.calculadoEm} resultado={resultado.valor} />}
      </CardContent></Card></TabsContent>
    </Tabs>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}{aviso && <p role="status" className="text-sm text-success">{aviso}</p>}
    {editar && <GrupoAcoes nome="Salvar configuração de Entregas" className="flex-wrap">
      <Button type="button" disabled={salvando || consultandoOrigem || !alterado} onClick={() => void salvar()} aria-busy={salvando}>{salvando ? "Salvando…" : "Salvar Entregas"}</Button>
      <Button type="button" variant="outline" disabled={salvando || consultandoOrigem || !alterado} onClick={() => { setD(base.config); setLimites(limitesIniciais(base.config)); setErro(""); setAviso(""); }}>Cancelar alterações</Button>
      <span className="text-xs text-muted-foreground">{alterado ? "Alterações pendentes, inclusive status." : "Configuração salva."}</span>
    </GrupoAcoes>}
  </div>;
}
