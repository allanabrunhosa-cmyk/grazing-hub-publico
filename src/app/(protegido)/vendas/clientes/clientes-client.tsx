"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { entidadeInicial } from "@/lib/atividades/entidade-inicial";
import { useRouter } from "next/navigation";
import { Plus, MapPin, ChevronRight, UserRound, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { StatusCadastroVenda } from "../status-cadastro";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { SelecaoFormulario } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { validarLivroEnderecosClienteCompleto, type ClienteEntrada } from "@/lib/vendas/dominio";
import { salvarClienteVendaAction } from "../actions";
import { ajustarCreditoClienteAction } from "./credito-actions";
import { Check, Campo, CabecalhoVendas, EditorVenda } from "../componentes";

import { cn } from "cn";
import { CampoBusca } from "@/components/campo-busca";
import { FiltroOpcoesContadas } from "@/components/filtro-opcoes-contadas";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, SortableTableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsTriggerBotao, TabsContent } from "@/components/ui/tabs";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";
import { CamposClienteVenda, novoClienteVenda } from "./campos-cliente";
import { RegrasPagamentoCliente } from "./regras-pagamento";
import { cobrancasDoCliente, nomeAbaCobranca } from "@/lib/vendas/cliente-cobranca";
import { HistoricoCliente } from "./clientes-historico";
import type { ClienteConsulta, FormaPagamentoCliente } from "./tipos";
import { exibirTelefone } from "@/lib/vendas/telefone";

const novo = novoClienteVenda;
function dataUltimoPedido(valor: string, fusoHorario: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor.split("-").reverse().join("/") : new Date(valor).toLocaleDateString("pt-BR", { timeZone: fusoHorario });
}
type CreditoCliente = { saldo: number; movimentos: { id: string; tipo: string; valor: number; data: string; pedidoNumero: number | null; motivo: string | null; referenciaComunicacao: string | null }[] };

function ExtratoCreditoCliente({ credito, clienteId, ajustar }: { credito?: CreditoCliente; clienteId: string; ajustar: boolean }) {
  const dinheiro = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const router = useRouter();
  const [origemId, setOrigemId] = useState("");
  const [tipo, setTipo] = useState<"AJUSTE_DEBITO" | "AJUSTE_CREDITO">("AJUSTE_DEBITO");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const chave = useRef("");
  async function salvarAjuste() {
    if (ocupado) return;
    setOcupado(true); setErro("");
    if (!chave.current) chave.current = crypto.randomUUID();
    try {
      const resposta = await ajustarCreditoClienteAction(clienteId, origemId, tipo, valor, motivo, chave.current);
      if ("erro" in resposta) setErro(resposta.erro ?? "Não foi possível registrar o ajuste.");
      else { chave.current = ""; setValor(""); setMotivo(""); setOrigemId(""); router.refresh(); }
    } catch { setErro("Não foi possível registrar. Confira o extrato antes de tentar novamente."); }
    finally { setOcupado(false); }
  }
  return <details className="mt-2 text-sm"><summary className="cursor-pointer text-primary">Crédito disponível: {dinheiro(credito?.saldo ?? 0)} · extrato</summary><div className="mt-2 space-y-1 rounded-lg bg-muted/30 p-3">{!credito?.movimentos.length ? <p>Nenhum movimento de crédito.</p> : credito.movimentos.map(m => <p key={m.id}>{new Date(m.data).toLocaleDateString("pt-BR")} · {m.tipo.replaceAll("_", " ")} · {dinheiro(m.valor)}{m.pedidoNumero ? ` · Pedido #${m.pedidoNumero}` : ""}{m.motivo ? ` · ${m.motivo}` : ""}{m.referenciaComunicacao ? ` · ${m.referenciaComunicacao}` : ""}</p>)}{ajustar && !!credito?.movimentos.length && <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2"><p className="sm:col-span-2">Ajuste autorizado com origem e motivo. Crédito adicional só corrige débito anterior.</p><Campo nome="Tipo de ajuste"><SelecaoFormulario aria-label="Tipo de ajuste"  value={tipo} onValueChange={valor => { setTipo(valor as typeof tipo); chave.current = ""; }}><option value="AJUSTE_DEBITO">Reduzir saldo</option><option value="AJUSTE_CREDITO">Corrigir débito anterior</option></SelecaoFormulario></Campo><Campo nome="Movimento de origem"><SelecaoFormulario aria-label="Movimento de origem"  value={origemId} onValueChange={valor => { setOrigemId(valor); chave.current = ""; }}><option value="">Selecione</option>{credito.movimentos.filter(m => tipo === "AJUSTE_CREDITO" ? m.tipo === "AJUSTE_DEBITO" : true).map(m => <option key={m.id} value={m.id}>{m.tipo.replaceAll("_", " ")} · {dinheiro(m.valor)} · {new Date(m.data).toLocaleDateString("pt-BR")}</option>)}</SelecaoFormulario></Campo><Campo nome="Valor"><CurrencyInput value={valor} onValueChange={v => { setValor(v); chave.current = ""; }} /></Campo><Campo nome="Motivo"><Input value={motivo} maxLength={1000} onChange={e => { setMotivo(e.target.value); chave.current = ""; }} /></Campo><Button type="button" disabled={ocupado || !origemId || !valor || !motivo.trim()} onClick={salvarAjuste}>Registrar ajuste</Button>{erro && <p role="alert" className="text-destructive">{erro}</p>}</div>}</div></details>;
}
export function ClientesVenda({ clientes, pagina: paginaInicial = 1, busca = "", situacao = "ativos", entidadeInicialId, adicionar, editar, creditos, ajustarCredito = false, formasPagamento = [], verPedidos = false, fusoHorario = "America/Sao_Paulo" }: {
  clientes: ClienteConsulta[]; total?: number; pagina?: number; busca?: string; situacao?: string;
  adicionar: boolean; editar: boolean; creditos?: Record<string, CreditoCliente> | null;
  ajustarCredito?: boolean; formasPagamento?: FormaPagamentoCliente[]; verPedidos?: boolean; fusoHorario?: string; entidadeInicialId?: string;
}) {
  const alvoInicial = entidadeInicial(entidadeInicialId) ? clientes.find(c => c.id === entidadeInicialId) : undefined;
  const [cliente, setCliente] = useState<ClienteEntrada | null>(null);
  const [query, setQuery] = useState(alvoInicial ? "" : busca);
  const [tipo, setTipo] = useState<"TODOS" | "PF" | "PJ">("TODOS");
  const [status, setStatus] = useState(alvoInicial ? "todos" : situacao);
  const [pagina, setPagina] = useState(alvoInicial ? Math.floor(clientes.findIndex(c => c.id === alvoInicial.id) / 25) + 1 : paginaInicial);
  const [expandido, setExpandido] = useState<string | null>(alvoInicial?.id ?? null);
  const [ordenacao, setOrdenacao] = useState<{ coluna: "nome" | "tipo" | "ultimoPedido" | "quantidadePedidos" | "valorTotalGasto"; direcao: "asc" | "desc" } | null>(null);
  const encontrados = useMemo(() => {
    const normalizar = (v: string) => v.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const termo = normalizar(query.trim());
    const digitos = /^[\d\s.\-/()+]+$/.test(termo) ? termo.replace(/\D/g, "") : "";
    return clientes.filter(c => {
      const contatos = c.contatosEmpresa ?? [];
      const cobrancas = cobrancasDoCliente(c);
      return normalizar([c.nome, c.razaoSocial, c.inscricaoEstadual, c.documento, c.email, ...(c.emailsAlternativos ?? []), ...(c.documentosAlternativos ?? []), c.telefone, c.contato, ...cobrancas.flatMap(e => [e.nomeCompleto, e.documento, e.razaoSocial, e.inscricaoEstadual, e.inscricaoMunicipal]),
        ...contatos.flatMap(p => [p.nome, p.primeiroNome, p.sobrenome, p.email, p.telefone])].filter(Boolean).join(" ")).includes(termo)
        || Boolean(digitos && [c.documento, ...(c.documentosAlternativos ?? []), c.telefone, ...cobrancas.map(e => e.documento), ...contatos.map(p => p.telefone)].some(v => v?.replace(/\D/g, "").includes(digitos)));
    });
  }, [clientes, query]);
  const porStatus = encontrados.filter(c => status === "todos" || c.ativo === (status === "ativos"));
  const porTipo = encontrados.filter(c => tipo === "TODOS" || c.tipo === tipo);
  const filtrados = useMemo(() => {
    const resultado = encontrados.filter(c => (status === "todos" || c.ativo === (status === "ativos")) && (tipo === "TODOS" || c.tipo === tipo));
    if (!ordenacao) return resultado;
    const valor = (c: ClienteConsulta) => {
      if (ordenacao.coluna === "nome") return c.nome;
      if (ordenacao.coluna === "tipo") return c.tipo === "PF" ? "Pessoa física" : "Pessoa jurídica";
      if (ordenacao.coluna === "ultimoPedido") return c.resumoPedidos?.ultimoPedido ?? "";
      if (ordenacao.coluna === "quantidadePedidos") return c.resumoPedidos?.quantidadePedidos ?? 0;
      return Number(c.resumoPedidos?.valorTotalGasto ?? 0);
    };
    return [...resultado].sort((a, b) => {
      const va = valor(a), vb = valor(b);
      const comparacao = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
      return (ordenacao.direcao === "asc" ? 1 : -1) * comparacao || a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [encontrados, tipo, status, ordenacao]);
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / 25));
  const atual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((atual - 1) * 25, atual * 25);
  function filtrar() { setPagina(1); setExpandido(null); }
  function ordenar(coluna: NonNullable<typeof ordenacao>["coluna"]) {
    setExpandido(null);
    setOrdenacao(a => a?.coluna !== coluna ? { coluna, direcao: "asc" } : a.direcao === "asc" ? { coluna, direcao: "desc" } : null);
  }
  return <div className="space-y-6">
    <CabecalhoVendas titulo="Clientes" descricao="Pessoas, empresas e endereços para suas vendas.">{adicionar && <Button onClick={() => setCliente(novo())}><Plus className="size-4" />Novo cliente</Button>}</CabecalhoVendas>
    <Card className="gap-4 py-4">
      <div className="flex flex-wrap items-center gap-2 px-4">
        <CampoBusca value={query} onChange={v => { setQuery(v); filtrar(); }} placeholder="Buscar cliente, documento ou contato..." aria-label="Buscar clientes" />
        <FiltroOpcoesContadas nome="Filtrar clientes por tipo" valor={tipo} onValueChange={valor => { setTipo(valor); filtrar(); }} opcoes={[
          { valor: "TODOS", nome: "Todos", quantidade: porStatus.length },
          { valor: "PF", nome: "Pessoa física", quantidade: porStatus.filter(c => c.tipo === "PF").length, icone: <UserRound className="size-4" /> },
          { valor: "PJ", nome: "Pessoa jurídica", quantidade: porStatus.filter(c => c.tipo === "PJ").length, icone: <Building2 className="size-4" /> },
        ]} />
        <SelecaoFormulario aria-label="Filtrar clientes por status" value={status} onValueChange={valor => { setStatus(valor); filtrar(); }} className="max-w-48 font-medium focus-visible:outline-2 focus-visible:outline-ring sm:ml-auto"><option value="todos">Todos os status ({porTipo.length})</option><option value="ativos">Ativos ({porTipo.filter(c => c.ativo).length})</option><option value="inativos">Inativos ({porTipo.filter(c => !c.ativo).length})</option></SelecaoFormulario>
      </div>
      {!filtrados.length ? <div className="px-4 py-10 text-left text-sm text-muted-foreground">{!clientes.length ? "Nenhum cliente cadastrado. Cadastre uma pessoa ou empresa para começar." : "Nenhum cliente encontrado com os filtros selecionados."}</div> : <>
        <Table className="text-left">
          <TableHeader><TableRow>
            <SortableTableHead active={ordenacao?.coluna === "nome"} direction={ordenacao?.direcao} onClick={() => ordenar("nome")}>Cliente</SortableTableHead>
            <SortableTableHead active={ordenacao?.coluna === "tipo"} direction={ordenacao?.direcao} onClick={() => ordenar("tipo")} className="hidden sm:table-cell">Tipo</SortableTableHead>
            <SortableTableHead active={ordenacao?.coluna === "ultimoPedido"} direction={ordenacao?.direcao} onClick={() => ordenar("ultimoPedido")} className="hidden md:table-cell">Último pedido</SortableTableHead>
            <SortableTableHead active={ordenacao?.coluna === "quantidadePedidos"} direction={ordenacao?.direcao} onClick={() => ordenar("quantidadePedidos")} className="hidden lg:table-cell">Quantidade de pedidos</SortableTableHead>
            <SortableTableHead active={ordenacao?.coluna === "valorTotalGasto"} direction={ordenacao?.direcao} onClick={() => ordenar("valorTotalGasto")} className="hidden sm:table-cell">Valor total já gasto</SortableTableHead>
            <TableHead>Status</TableHead><TableHead>Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>{visiveis.map(c => {
            const aberto = expandido === c.id;
            const alternar = () => setExpandido(a => a === c.id ? null : c.id);
            return <Fragment key={c.id}>
              <TableRow className={cn("cursor-pointer", aberto && "border-b-0")} onClick={alternar}>
                <TableCell className="whitespace-normal"><div className="flex items-center gap-2.5"><button id={`expansao-cliente-${c.id}`} type="button" aria-expanded={aberto} aria-controls={`cliente-${c.id}`} aria-label={`${aberto ? "Fechar" : "Abrir"} detalhes de ${c.nome}`} onClick={e => { e.stopPropagation(); alternar(); }} className="-ml-1 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"><ChevronRight className={cn("size-4 transition-transform duration-200", aberto && "rotate-90")} /></button><span className="break-words font-medium">{c.nome}</span></div></TableCell>
                <TableCell className="hidden sm:table-cell"><Badge variant="secondary">{c.tipo === "PF" ? "Pessoa física" : "Pessoa jurídica"}</Badge></TableCell>
                <TableCell className="hidden md:table-cell">{c.resumoPedidos?.ultimoPedido ? dataUltimoPedido(c.resumoPedidos.ultimoPedido, fusoHorario) : "—"}</TableCell>
                <TableCell className="hidden tabular-nums lg:table-cell">{c.resumoPedidos?.quantidadePedidos ?? "—"}</TableCell>
                <TableCell className="hidden tabular-nums sm:table-cell">{c.resumoPedidos ? formatarMoeda(Number(c.resumoPedidos.valorTotalGasto)) : "—"}</TableCell>
                <TableCell onClick={e => e.stopPropagation()}><StatusCadastroVenda tipo="CLIENTE" id={c.id} versao={c.versao} ativo={c.ativo} nome={c.nome} editar={editar} /></TableCell>
                <TableCell><GrupoAcoes nome={`Ações de ${c.nome}`} alinhamento="inicio">{editar && <Button aria-label={`Editar ${c.nome}`} onClick={() => setCliente(structuredClone(c))} variant="editar" size="icon-sm" />}</GrupoAcoes></TableCell>
              </TableRow>
              {aberto && <TableRow className="bg-muted/30 hover:bg-muted/30"><TableCell colSpan={7} className="p-0 whitespace-normal"><DetalhesCliente cliente={c} formas={formasPagamento} verPedidos={verPedidos} credito={creditos?.[c.id]} verCredito={Boolean(creditos)} ajustarCredito={ajustarCredito} fusoHorario={fusoHorario} fechar={() => setExpandido(null)} /></TableCell></TableRow>}
            </Fragment>;
          })}</TableBody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 text-xs text-muted-foreground"><span>Mostrando {visiveis.length} de {filtrados.length} clientes</span><div className="flex items-center gap-2"><Button type="button" size="sm" variant="outline" disabled={atual <= 1} onClick={() => { setPagina(atual - 1); setExpandido(null); }}>Anterior</Button><span>Pag. {atual}</span><Button type="button" size="sm" variant="outline" disabled={atual >= totalPaginas} onClick={() => { setPagina(atual + 1); setExpandido(null); }}>Próxima</Button></div></div>
      </>}
    </Card>
    {cliente && <EditorCliente verPedidos={verPedidos} key={`${cliente.id}-${cliente.versao}`} inicial={cliente} formas={formasPagamento} fechar={() => setCliente(null)} />}
  </div>;
}

function DetalhesCliente({ cliente, formas, verPedidos, credito, verCredito, ajustarCredito, fusoHorario, fechar }: {
  cliente: ClienteConsulta; formas: FormaPagamentoCliente[]; verPedidos: boolean; credito?: CreditoCliente; verCredito: boolean; ajustarCredito: boolean; fusoHorario: string; fechar: () => void;
}) {
  const painel = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState<number>();
  useEffect(() => {
    const container = painel.current?.closest('[data-slot="table-container"]');
    if (!container || typeof ResizeObserver === "undefined") return;
    const atualizar = () => setLargura(container.clientWidth);
    const observer = new ResizeObserver(atualizar);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  return <div style={largura ? { width: largura } : undefined} className="sticky left-0 w-0"><div ref={painel} id={`cliente-${cliente.id}`} role="region" aria-label={`Detalhes de ${cliente.nome}`} className="space-y-4 border-l-2 border-primary p-4" onKeyDown={e => { if (e.key === "Escape" && !e.defaultPrevented) { e.stopPropagation(); fechar(); document.getElementById(`expansao-cliente-${cliente.id}`)?.focus(); } }}>
    <Tabs defaultValue="dados"><TabsList className="w-full sm:w-fit"><TabsTrigger className="flex-none" value="dados">Dados do cliente</TabsTrigger>{cliente.tipo === "PJ" && <TabsTrigger className="flex-none" value="contatos">Contatos</TabsTrigger>}<TabsTrigger className="flex-none" value="regras">Regras de pagamento</TabsTrigger>{verPedidos && <TabsTrigger className="flex-none" value="historico">Histórico de pedidos</TabsTrigger>}{verCredito && <TabsTrigger className="flex-none" value="credito">Crédito disponível</TabsTrigger>}</TabsList>
      <TabsContent value="dados" className="space-y-4">
        <dl className="grid gap-4 text-sm sm:grid-cols-3">{[["Tipo", cliente.tipo === "PF" ? "Pessoa física" : "Pessoa jurídica"], ["Telefone / WhatsApp", exibirTelefone(cliente.telefone)], ["E-mail", cliente.email], ["Pessoa de contato", cliente.contato], ["Data de nasc.", cliente.dataNascimento ? cliente.dataNascimento.split("-").reverse().join("/") : null]].map(([nome, valor]) => <div key={nome}><dt className="text-muted-foreground">{nome}</dt><dd className="mt-1 break-words">{valor || "Não informado"}</dd></div>)}{cliente.resumoPedidos && <><div><dt className="text-muted-foreground">Quantidade de pedidos</dt><dd className="mt-1">{cliente.resumoPedidos.quantidadePedidos}</dd></div><div><dt className="text-muted-foreground">Valor total já gasto</dt><dd className="mt-1">{formatarMoeda(Number(cliente.resumoPedidos.valorTotalGasto))}</dd></div><div><dt className="text-muted-foreground">Último pedido</dt><dd className="mt-1">{cliente.resumoPedidos.ultimoPedido ? dataUltimoPedido(cliente.resumoPedidos.ultimoPedido, fusoHorario) : "Nenhum pedido contabilizado"}</dd></div></>}</dl>
        {cliente.enderecos.length ? <div className="grid gap-3 sm:grid-cols-2">{cobrancasDoCliente(cliente).map((e, i) => <div key={i} className="rounded-xl border bg-card p-3 text-sm"><strong className="flex items-center gap-2"><MapPin className="size-3" />{nomeAbaCobranca(i)}</strong><p>{e.tipo === "PJ" ? e.razaoSocial : e.nomeCompleto}</p><p>{e.tipo === "PJ" ? "CNPJ" : "CPF"}: {e.documento || "Não informado"}</p>{e.tipo === "PJ" && <><p>Inscrição Estadual: {e.inscricaoEstadual || "Não informado"}</p><p>Inscrição Municipal: {e.inscricaoMunicipal || "Não informado"}</p></>}{e.destinatario && <p>{e.destinatario}</p>}<p>{e.logradouro}, {e.numero}{e.complemento ? ` · ${e.complemento}` : ""}</p><p>{e.bairro} · {e.cidade}/{e.uf} · {e.cep}</p><p>{e.pais ?? "Brasil"}</p></div>)}</div> : <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado.</p>}
        {cliente.observacoes && <p className="whitespace-pre-wrap text-sm">{cliente.observacoes}</p>}
      </TabsContent>
      {cliente.tipo === "PJ" && <TabsContent value="contatos">{cliente.contatosEmpresa?.length ? <Table className="min-w-xl text-left"><TableHeader><TableRow><TableHead>Nome Completo</TableHead><TableHead>E-mail</TableHead><TableHead>Telefone / WhatsApp</TableHead></TableRow></TableHeader><TableBody>{cliente.contatosEmpresa.map(p => <TableRow key={p.id}><TableCell className="whitespace-normal">{p.nome}</TableCell><TableCell className="whitespace-normal break-all">{p.email || "Não informado"}</TableCell><TableCell className="whitespace-normal">{exibirTelefone(p.telefone) || "Não informado"}</TableCell></TableRow>)}</TableBody></Table> : <p className="py-6 text-sm text-muted-foreground">Nenhum contato adicional cadastrado.</p>}</TabsContent>}
      <TabsContent value="regras"><RegrasPagamentoCliente cliente={cliente} formas={formas} /></TabsContent>
      {verPedidos && <TabsContent value="historico"><HistoricoCliente clienteId={cliente.id} /></TabsContent>}
      {verCredito && <TabsContent value="credito"><ExtratoCreditoCliente credito={credito} clienteId={cliente.id} ajustar={ajustarCredito} /></TabsContent>}
    </Tabs>
  </div></div>;
}

function EditorCliente({ inicial, formas, fechar, verPedidos }: { inicial: ClienteEntrada; formas: FormaPagamentoCliente[]; fechar: () => void; verPedidos: boolean }) {
  const [d, setD] = useState(inicial);
  const [aba, setAba] = useState("dados");
  const [consultandoCep, setConsultandoCep] = useState(false);
  async function salvar() {
    if (d.tipoEscolhido === false) { setAba("dados"); return { erro: "Escolha o tipo de cliente antes de salvar." }; }
    try { validarLivroEnderecosClienteCompleto(d); }
    catch (erro) { setAba("dados"); return { erro: erro instanceof Error ? erro.message : "Confira os endereços do cliente." }; }
    return salvarClienteVendaAction(d);
  }
  return <EditorVenda largura="pedido" titulo={d.id ? "Editar cliente" : "Novo cliente"} descricao="Identifique o cliente e cadastre os titulares e endereços de cobrança. CPF é opcional; cobrança de pessoa jurídica exige CNPJ e razão social." fechar={fechar} salvar={salvar} impedido={consultandoCep} abrirSecao={setAba}>
    <Tabs value={aba} onValueChange={valor => setAba(String(valor))}><TabsList variant="buttons" className="w-full sm:w-fit"><TabsTriggerBotao value="dados">Dados do cliente</TabsTriggerBotao><TabsTriggerBotao value="regras">Regras de pagamento</TabsTriggerBotao>{verPedidos && d.id && <TabsTriggerBotao value="pedidos">Pedidos</TabsTriggerBotao>}</TabsList>
      <TabsContent value="dados" keepMounted data-secao="dados" className="space-y-4"><CamposClienteVenda cliente={d} onChange={setD} onConsultandoCepChange={setConsultandoCep} /></TabsContent>
      <TabsContent value="regras" keepMounted data-secao="regras"><fieldset disabled={d.tipoEscolhido === false} className="min-w-0 space-y-5"><RegrasPagamentoCliente cliente={d} formas={formas} onChange={regrasPagamento => setD(a => ({ ...a, regrasPagamento }))} /><Campo nome="Observações do cadastro"><Textarea maxLength={2000} value={d.observacoes ?? ""} onChange={e => setD(a => ({ ...a, observacoes: e.target.value }))} /></Campo><Check checked={d.ativo} onChange={e => setD(a => ({ ...a, ativo: e.target.checked }))}>Cliente ativo</Check></fieldset></TabsContent>
      {verPedidos && d.id && <TabsContent value="pedidos"><HistoricoCliente clienteId={d.id} /></TabsContent>}
    </Tabs>
  </EditorVenda>;
}
