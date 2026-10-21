"use client";

import { useContext, useEffect, useId, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CalendarDays, Check, CheckCheck, ChefHat, ChevronDown, ClipboardList, CreditCard, FileText, History, Mail, MapPin, MoreHorizontal, Package, Phone, Printer, StickyNote, Truck, UserRound, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { TagCanalVenda } from "@/components/tag-canal-venda";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { HorarioEntregaCampo } from "./horario-entrega-campo";
import { converterHorariosEntrega } from "@/lib/vendas/pedidos-horarios-dominio";
import { estadoAnteriorGestor } from "@/lib/vendas/pedidos-operacao-dominio";
import { exibirTelefone } from "@/lib/vendas/telefone";
import type { InformacoesPedidoEntrada } from "@/lib/vendas/pedidos-edicao";
import type { Dados, Capacidades, Detalhe } from "./editor-pedido";
import { editarInformacoesPedidoAction } from "./actions";
import { mudarStatusGestorPedidoAction } from "./gestor-actions";
import { nomeStatusGestor, tempoPedidoGestor } from "./gestor-dominio";
import { rotaPopupPedido } from "./pedidos-navegacao";
import { CancelamentoPedido } from "./cancelamento-pedido";
import { PagamentoOperacionalPedido } from "./pagamento-operacional-pedido";
import { IdentidadeCobrancaForm } from "./identidade-cobranca-form";
import { buscarCnpjPedidoAction } from "./cadastro-cliente-actions";
import { CamposEnderecoPedido, enderecoPedidoVazio, type EnderecoPedidoForm } from "./endereco-pedido-form";
import { CamposDestinatarioCliente, type DestinatarioClienteForm } from "./cadastro-cliente-form";
import { ResumoPedido } from "./resumo-pedido";
import { PedidoPopupContext } from "./modal-pedido";
import { EmitirNotaPedido, type FiscalDoDetalhePedido } from "./emitir-nota-pedido";
import "./painel-pedido.css";

export type PedidoDetalhado = Detalhe & { statusOperacional: string; origem?: string; createdAt: string; compradorSnapshot: (NonNullable<Detalhe["compradorSnapshot"]> & { telefone?: string | null; email?: string | null }) | null };
export const moedaPedido = (v: string | number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const atividades: Record<string, string> = { CRIADO: "Orçamento criado", RASCUNHO_EDITADO: "Orçamento salvo", CONFIRMADO: "Pedido confirmado", REVISADO: "Pedido revisado", INFORMACOES_ATUALIZADAS: "Informações do pedido atualizadas", CANCELADO: "Pedido cancelado", ENTREGUE: "Pedido entregue", OPERACAO_INICIAR: "Preparo iniciado", OPERACAO_PRONTO: "Pedido pronto", OPERACAO_SAIR: "Pedido em rota", OPERACAO_ENTREGAR: "Entrega registrada", OPERACAO_REAGENDAR: "Entrega reagendada", OPERACAO_VOLTAR: "Etapa anterior restaurada", RECEBIMENTO: "Pagamento recebido", DEVOLUCAO_SOLICITADA: "Devolução solicitada", DEVOLUCAO_PROCESSANDO: "Devolução em processamento", DEVOLUCAO_FALHA: "Falha na devolução", DEVOLUCAO_CONCLUIDA: "Devolução concluída", CREDITO_CONCEDIDO: "Crédito concedido", CREDITO_LIBERADO: "Crédito restaurado", SALDO_CANCELADO: "Cobranças pendentes canceladas" };
const iconesEtapa: Record<string, LucideIcon> = { PENDENTE: ClipboardList, EM_PREPARO: ChefHat, PRONTO: Package, EM_ENTREGA: Truck, ENTREGUE: CheckCheck };
type ParteEdicao = "agenda" | "cobranca" | "destinatario";
let agoraDoDetalhe = 0;
function lerAgoraDoDetalhe() { return agoraDoDetalhe; }
function lerAgoraDoServidor() { return 0; }
function assinarRelogioDetalhe(atualizar: () => void) {
  const registrar = () => { agoraDoDetalhe = Date.now(); atualizar(); };
  registrar();
  const intervalo = setInterval(registrar, 30000);
  return () => clearInterval(intervalo);
}
function cobrancaDoPedido(p: PedidoDetalhado): EnderecoPedidoForm {
  const base = enderecoPedidoVazio(), endereco = p.cobrancaSnapshot;
  const identidade = Object.fromEntries(["tipo", "nomeCompleto", "documento", "razaoSocial", "inscricaoEstadual", "inscricaoMunicipal", "codigoMunicipio"].filter(chave => endereco && Object.hasOwn(endereco, chave)).map(chave => [chave, endereco![chave as keyof EnderecoPedidoForm]]));
  return { ...identidade, ...Object.fromEntries(Object.entries(base).map(([chave, padrao]) => [chave, endereco?.[chave as keyof EnderecoPedidoForm] ?? padrao])) } as EnderecoPedidoForm;
}
function informacoesDoPedido(p: PedidoDetalhado) {
  return { versao: p.versao, data: p.previsaoData?.slice(0, 10) ?? "", janela: p.previsaoJanela ?? "", cobranca: cobrancaDoPedido(p), destinatario: p.destinatarioSnapshot };
}
function Secao({ titulo, icone: Icone, acao, children }: { titulo: string; icone: LucideIcon; acao?: ReactNode; children: ReactNode }) {
  return <Card size="sm" role="region" aria-label={titulo} className="pedido-detalhe-secao"><CardHeader className="pedido-detalhe-rotulo"><h2><Icone aria-hidden />{titulo}</h2>{acao}</CardHeader><CardContent className="space-y-2">{children}</CardContent></Card>;
}
function Endereco({ endereco, vazio }: { endereco?: Detalhe["enderecoSnapshot"]; vazio: string }) {
  if (!endereco || !endereco.logradouro && !endereco.cidade && !endereco.cep) return <p className="pedido-detalhe-secundario">{vazio}</p>;
  return <div className="space-y-0.5"><p className="font-medium">{[endereco.logradouro, endereco.numero].filter(Boolean).join(", ")}</p><p className="pedido-detalhe-secundario">{[endereco.bairro, endereco.cidade, endereco.uf].filter(Boolean).join(" · ")}</p>{(endereco.complemento || endereco.cep) && <p className="pedido-detalhe-secundario">{[endereco.complemento, endereco.cep ? `CEP ${endereco.cep}` : ""].filter(Boolean).join(" · ")}</p>}</div>;
}

export function DetalhePedido({ pedido: p, dados, capacidades, responsavel, preparar, fiscal, abrirCancelamentoInicial = false }: { pedido: PedidoDetalhado; dados: Dados; capacidades: Capacidades; responsavel: string; preparar: boolean; fiscal?: FiscalDoDetalhePedido; abrirCancelamentoInicial?: boolean }) {
  const router = useRouter(), popup = useContext(PedidoPopupContext);
  const agora = useSyncExternalStore(assinarRelogioDetalhe, lerAgoraDoDetalhe, lerAgoraDoServidor);
  const avisoSalvarId = useId(), motivoCancelamentoId = useId();
  const exibirCancelar = p.status === "CONFIRMADO" && capacidades.cancelar && p.origem !== "IFOOD";
  const podeCancelar = p.status === "CONFIRMADO" && p.statusOperacional !== "ENTREGUE" && capacidades.cancelar && p.origem !== "IFOOD";
  const [cancelamentoAberto, setCancelamentoAberto] = useState(abrirCancelamentoInicial && podeCancelar);
  const [editando, setEditando] = useState<ParteEdicao[]>([]), [resumoAberto, setResumoAberto] = useState(false);
  const [ocupado, iniciar] = useTransition(), trava = useRef(false), chaves = useRef<Record<string, string>>({});
  const formularios = useRef<Partial<Record<ParteEdicao, HTMLFormElement | null>>>({});
  const [aguardandoVersao, setAguardandoVersao] = useState<number | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [base, setBase] = useState(() => informacoesDoPedido(p));
  const [data, setData] = useState(base.data), [janela, setJanela] = useState(base.janela), [motivo, setMotivo] = useState("");
  const [cobranca, setCobranca] = useState(base.cobranca), [consultandoCep, setConsultandoCep] = useState(false), [consultandoCnpj, setConsultandoCnpj] = useState(false);
  const [destinatario, setDestinatario] = useState<DestinatarioClienteForm | null>(base.destinatario);
  const mudouAgenda = data !== base.data || janela !== base.janela;
  const mudouCobranca = JSON.stringify(cobranca) !== JSON.stringify(base.cobranca);
  const mudouDestinatario = JSON.stringify(destinatario) !== JSON.stringify(base.destinatario);
  const alterado = mudouAgenda || mudouCobranca || mudouDestinatario;
  const marcadoAlterado = popup?.marcarAlterado, marcadoSalvo = popup?.marcarSalvo, bloquearSaida = popup?.bloquearSaida;
  useEffect(() => {
    if (alterado) marcadoAlterado?.("metadados"); else marcadoSalvo?.("metadados");
  }, [alterado, marcadoAlterado, marcadoSalvo]);
  useEffect(() => {
    bloquearSaida?.("metadados", ocupado || consultandoCep || consultandoCnpj);
    return () => bloquearSaida?.("metadados", false);
  }, [ocupado, consultandoCep, consultandoCnpj, bloquearSaida]);
  // Uma nova revisão só substitui o estado local quando não existe edição aberta.
  if (!alterado && !editando.length && (aguardandoVersao === null || p.versao >= aguardandoVersao) && (p.versao !== base.versao || aguardandoVersao !== null)) {
    setAguardandoVersao(null);
    const proximaBase = informacoesDoPedido(p);
    setBase(proximaBase); setData(proximaBase.data); setJanela(proximaBase.janela); setCobranca(proximaBase.cobranca); setDestinatario(proximaBase.destinatario);
  }
  const ativo = p.status === "CONFIRMADO", podeEditar = capacidades.revisar && p.origem !== "IFOOD";
  const proxima = ({ PENDENTE: "Iniciar preparo", EM_PREPARO: "Marcar como pronto", PRONTO: p.atendimento === "RETIRADA" ? "Registrar retirada" : "Sair para entrega", EM_ENTREGA: "Marcar como entregue" } as Record<string, string>)[p.statusOperacional];
  const IconeAtual = iconesEtapa[p.statusOperacional] ?? ClipboardList;
  const IconeProximo = p.statusOperacional === "PENDENTE" ? ChefHat : p.statusOperacional === "EM_PREPARO" ? Package : p.statusOperacional === "PRONTO" && p.atendimento !== "RETIRADA" ? Truck : CheckCheck;
  const podeAvancar = ativo && proxima && (["PENDENTE", "EM_PREPARO"].includes(p.statusOperacional) ? preparar : capacidades.revisar);
  const podeVoltar = ativo && capacidades.revisar && Boolean(estadoAnteriorGestor(p.statusOperacional, p.atendimento));
  const statusVariante = ["CANCELADO", "ESTORNADO"].includes(p.status) ? "destructive" : p.statusOperacional === "EM_PREPARO" ? "warning" : ["PRONTO", "ENTREGUE"].includes(p.statusOperacional) ? "success" : "outline";
  const historico = [...p.historico.map(h => ({ ...h, motivo: h.motivo })), ...p.historicoFinanceiro.map(h => ({ ...h, motivo: h.detalhes.motivo }))].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const bloqueado = ocupado || consultandoCep || consultandoCnpj;
  const bloqueioOperacao = bloqueado || alterado || aguardandoVersao !== null && p.versao < aguardandoVersao;
  const motivoBloqueioCancelamento = p.statusOperacional === "ENTREGUE" ? "Pedido entregue. O cancelamento não está disponível nesta etapa." : alterado ? "Salve as alterações antes de cancelar o pedido." : bloqueado || aguardandoVersao !== null && p.versao < aguardandoVersao ? "Aguarde a atualização do pedido para cancelar." : "";
  const agendaInvalida = mudouAgenda && (!data || !janela.trim());
  const destinatarioInvalido = mudouDestinatario && p.atendimento === "ENTREGA" && !destinatario?.nome.trim();
  const requisitosSalvar = [agendaInvalida ? "Escolha a data e o horário de entrega." : "", destinatarioInvalido ? "Informe o nome do destinatário." : "", alterado && !motivo.trim() ? "Informe o motivo da alteração para salvar." : ""].filter(Boolean).join(" ");
  function mudarCancelamento(aberto: boolean) {
    setCancelamentoAberto(aberto);
    if (!aberto && abrirCancelamentoInicial) {
      if (popup) popup.navegar(`/vendas/pedidos/${p.id}`);
      else router.replace(rotaPopupPedido(`/vendas/pedidos/${p.id}`), { scroll: false });
    }
  }
  function alternar(parte: ParteEdicao) {
    if (bloqueado) return;
    setEditando(atuais => atuais.includes(parte) ? atuais.filter(p => p !== parte) : [...atuais, parte]);
    setMensagem("");
  }
  function acaoEditar(parte: ParteEdicao, nome: string) {
    return podeEditar && <Button type="button" variant="editar" size="sm" disabled={bloqueado} onClick={() => alternar(parte)} aria-label={`Editar ${nome}`} aria-expanded={editando.includes(parte)}>Editar</Button>;
  }
  async function executarFluxo(direcao: "avancar" | "voltar") {
    if (trava.current || bloqueioOperacao) return; trava.current = true;
    iniciar(async () => {
      const assinatura = `${direcao}:${p.versao}`;
      try {
        const r = await mudarStatusGestorPedidoAction(p.id, p.versao, direcao, chaves.current[assinatura] ??= crypto.randomUUID());
        if (r.erro) { setMensagem(r.erro); return; }
        delete chaves.current[assinatura]; setMensagem("Status atualizado."); router.refresh();
      } catch { setMensagem("Resultado não confirmado. Atualize o pedido antes de repetir."); }
      finally { trava.current = false; }
    });
  }
  function salvarInformacoes() {
    if (trava.current || bloqueado || !podeEditar || !alterado || !motivo.trim() || agendaInvalida || destinatarioInvalido) return;
    const partesAlteradas: Record<ParteEdicao, boolean> = { agenda: mudouAgenda, cobranca: mudouCobranca, destinatario: mudouDestinatario };
    const formularioInvalido = (Object.keys(partesAlteradas) as ParteEdicao[]).find(parte => partesAlteradas[parte] && formularios.current[parte] && !formularios.current[parte]!.reportValidity());
    if (formularioInvalido) { setMensagem("Confira os campos obrigatórios das informações que foram alteradas."); return; }
    const entrada: InformacoesPedidoEntrada = { ...(mudouAgenda ? { previsaoData: data, previsaoJanela: janela } : {}), ...(mudouCobranca ? { cobranca } : {}), ...(mudouDestinatario ? { destinatario } : {}), motivo };
    const assinatura = JSON.stringify({ versao: base.versao, entrada });
    trava.current = true;
    bloquearSaida?.("metadados", true);
    iniciar(async () => {
      try {
        const r = await editarInformacoesPedidoAction(p.id, base.versao, entrada, chaves.current[assinatura] ??= crypto.randomUUID());
        if ("erro" in r) { setMensagem(r.erro); return; }
        delete chaves.current[assinatura];
        const versaoSalva = r.versao ?? base.versao + 1;
        setAguardandoVersao(versaoSalva);
        setBase({ versao: versaoSalva, data, janela, cobranca, destinatario }); setEditando([]); setMotivo(""); marcadoSalvo?.("metadados");
        setMensagem("Alterações salvas."); router.refresh();
      } catch { setMensagem("Resultado não confirmado. Seu preenchimento foi mantido; confira o pedido antes de repetir."); }
      finally { trava.current = false; bloquearSaida?.("metadados", false); }
    });
  }
  const destinatarioVisivel = destinatario?.nome || p.compradorSnapshot?.nome || "Não informado";
  return <div className="pedido-detalhe" data-pedido-detalhe>
    <div className="pedido-detalhe-topo"><p className="mb-2 text-xs text-muted-foreground">Criado em {new Date(p.createdAt).toLocaleString("pt-BR", { timeZone: p.fusoHorario })}{agora > 0 && <span> · {tempoPedidoGestor(p.createdAt, agora)}</span>}</p><div className="pedido-detalhe-status-acoes"><GrupoAcoes nome="Identificação do pedido" alinhamento="inicio" className="flex-wrap"><Badge variant={statusVariante} className={p.statusOperacional === "EM_ENTREGA" ? "bg-[var(--ds-processo-rota-fundo)] text-[var(--ds-processo-rota)]" : ""}><IconeAtual aria-hidden />{nomeStatusGestor(p.status, p.statusOperacional)}</Badge><TagCanalVenda canal={p.canalNomeSnapshot} /></GrupoAcoes><GrupoAcoes nome="Documentos e fluxo do pedido" alinhamento="inicio" className="flex-wrap">{podeVoltar && <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Voltar uma etapa" disabled={bloqueioOperacao} onClick={() => void executarFluxo("voltar")} />}><ArrowLeft aria-hidden /></TooltipTrigger><TooltipContent>{alterado ? "Salve as alterações antes de atualizar o fluxo" : "Voltar uma etapa"}</TooltipContent></Tooltip>}{podeAvancar && <Tooltip><TooltipTrigger render={<Button size="icon-sm" aria-label={proxima} disabled={bloqueioOperacao} onClick={() => void executarFluxo("avancar")} />}><IconeProximo aria-hidden /></TooltipTrigger><TooltipContent>{alterado ? "Salve as alterações antes de atualizar o fluxo" : proxima}</TooltipContent></Tooltip>}<Tooltip><TooltipTrigger render={<Button variant="outline" size="icon-sm" nativeButton={false} render={<Link href={`/vendas/pedidos/${p.id}/comanda`} onClick={e => { if (popup) { e.preventDefault(); popup.navegar(`/vendas/pedidos/${p.id}/comanda`); } }} />} aria-label="Imprimir produção" />}><Printer aria-hidden /></TooltipTrigger><TooltipContent>Imprimir produção</TooltipContent></Tooltip><DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label="Mais ações do pedido" />}><MoreHorizontal aria-hidden /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          {["CANCELADO", "ESTORNADO"].includes(p.status) && <DropdownMenuItem disabled={bloqueioOperacao} onClick={() => mudarCancelamento(true)}><History aria-hidden />Cancelamento e devolução</DropdownMenuItem>}
          <DropdownMenuItem onClick={() => setResumoAberto(true)}><FileText aria-hidden />Resumo do pedido</DropdownMenuItem>
          {alterado && <p className="max-w-56 px-2 py-1 text-xs text-muted-foreground">O resumo usa os dados salvos do pedido.</p>}
          {exibirCancelar && <><DropdownMenuSeparator /><DropdownMenuItem className="pedido-detalhe-menu-cancelar" aria-label="Cancelar pedido" aria-describedby={motivoBloqueioCancelamento ? motivoCancelamentoId : undefined} disabled={!podeCancelar || bloqueioOperacao} onClick={() => { if (podeCancelar && !bloqueioOperacao) mudarCancelamento(true); }}><X aria-hidden /><span className="grid gap-0.5"><span>Cancelar pedido</span>{motivoBloqueioCancelamento && <span id={motivoCancelamentoId} className="max-w-56 text-xs font-normal text-muted-foreground">{motivoBloqueioCancelamento}</span>}</span></DropdownMenuItem></>}
        </DropdownMenuContent>
      </DropdownMenu></GrupoAcoes></div></div>
    <div className="pedido-detalhe-secoes">
      <Secao titulo="Cliente" icone={UserRound}><div className="space-y-0.5"><p className="font-semibold">{p.compradorSnapshot?.nome ?? "Cliente não informado"}</p>{(p.compradorSnapshot?.telefone || p.compradorSnapshot?.email) && <div className="pedido-detalhe-contatos">{p.compradorSnapshot.telefone && <span><Phone aria-hidden="true" />{exibirTelefone(p.compradorSnapshot.telefone)}</span>}{p.compradorSnapshot.email && <span><Mail aria-hidden="true" />{p.compradorSnapshot.email}</span>}</div>}{p.referenciaPedido && <p className="pedido-detalhe-secundario">Referência: {p.referenciaPedido}</p>}</div><details className="pedido-detalhe-cobranca" open={editando.includes("cobranca") || undefined}><summary className="text-muted-foreground">Cobrança / faturamento</summary><div className="mt-2 space-y-2">{!cobranca.tipo && p.compradorSnapshot?.documento && <p className="pedido-detalhe-secundario">{p.compradorSnapshot.documento}</p>}{cobranca.tipo && <div><p className="font-medium">{cobranca.tipo === "PJ" ? cobranca.razaoSocial : cobranca.nomeCompleto}</p><p className="pedido-detalhe-secundario">{cobranca.tipo === "PJ" ? "CNPJ" : "CPF"}: {cobranca.documento || "Não informado"}</p>{cobranca.tipo === "PJ" && <p className="pedido-detalhe-secundario">Inscrição Estadual: {cobranca.inscricaoEstadual || "Não informado"} · Inscrição Municipal: {cobranca.inscricaoMunicipal || "Não informado"}</p>}</div>}<div className="flex items-start justify-between gap-2"><Endereco endereco={cobranca} vazio="Endereço de cobrança não informado" />{acaoEditar("cobranca", "endereço de cobrança")}</div>{editando.includes("cobranca") && <form ref={formulario => { formularios.current.cobranca = formulario; }} className="pedido-detalhe-formulario" onSubmit={e => { e.preventDefault(); salvarInformacoes(); }}><fieldset disabled={bloqueado} className="pedido-detalhe-endereco-campos"><IdentidadeCobrancaForm somenteLeitura={p.cobrancaSnapshot?.selecionado === 0} valor={cobranca} alterar={setCobranca} obrigatorio={!!cobranca.tipo} consultarCnpj={buscarCnpjPedidoAction} aoConsultar={setConsultandoCnpj} /><CamposEnderecoPedido valor={cobranca} alterar={setCobranca} obrigatorio onConsultandoCepChange={setConsultandoCep} /></fieldset></form>}<p className="pedido-detalhe-regra">Para alterar itens, quantidades, composição, valores ou endereço de entrega, cancele o pedido e crie um novo. Data, horário, destinatário e cobrança podem ser atualizados aqui.</p></div></details></Secao>
      <Secao titulo="Frete e entrega" icone={MapPin} acao={p.atendimento === "ENTREGA" ? acaoEditar("destinatario", "destinatário") : undefined}>
        <div className="pedido-detalhe-entrega-resumo">
          <div><span className="pedido-detalhe-entrega-rotulo"><Truck aria-hidden="true" />Tipo de entrega</span><p className="font-semibold">{p.atendimento === "RETIRADA" ? "Retirada" : String(p.atendimento) === "LOCAL" ? "Consumo no local" : "Entrega"}</p></div>
      <section aria-label="Data e horário" className="pedido-detalhe-entrega-agenda"><div className="pedido-detalhe-entrega-rotulo"><span><CalendarDays aria-hidden="true" />Data e horário</span>{acaoEditar("agenda", "data e horário")}</div><div><p className="font-medium">{data ? new Date(`${data}T00:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "long", year: "numeric" }) : "Imediata"}</p><p className="pedido-detalhe-secundario">{p.atendimento === "RETIRADA" ? "Retirada" : String(p.atendimento) === "LOCAL" ? "Consumo no local" : "Entrega"}{janela ? ` · ${janela}` : ""}</p>{p.entregueEm && <p className="pedido-detalhe-secundario">Concluído em {new Date(p.entregueEm).toLocaleString("pt-BR", { timeZone: p.fusoHorario })}</p>}</div>{editando.includes("agenda") && <form ref={formulario => { formularios.current.agenda = formulario; }} className="pedido-detalhe-formulario" onSubmit={e => { e.preventDefault(); salvarInformacoes(); }}><fieldset disabled={bloqueado} className="pedido-detalhe-agenda-campos"><Label>Data<Input required type="date" value={data} onChange={e => { setData(e.target.value); setJanela(""); }} /></Label><HorarioEntregaCampo configuracao={converterHorariosEntrega(dados.horarios, true)} data={data} valor={janela} alterar={setJanela} /></fieldset></form>}</section>

          <div><span className="pedido-detalhe-entrega-rotulo">Frete</span><p className="font-semibold tabular-nums">{moedaPedido(p.frete)}</p></div>
        </div>
        {p.atendimento === "ENTREGA" && <div className="pedido-detalhe-entrega-endereco"><span className="pedido-detalhe-entrega-rotulo"><MapPin aria-hidden="true" />Endereço de entrega</span><Endereco endereco={p.enderecoSnapshot} vazio="Endereço não informado" /><p className="pedido-detalhe-secundario">Para: <span className="font-medium text-foreground">{destinatarioVisivel}</span>{destinatario?.contato ? ` · ${exibirTelefone(destinatario.contato)}` : ""}</p>{editando.includes("destinatario") && <form ref={formulario => { formularios.current.destinatario = formulario; }} className="pedido-detalhe-formulario" onSubmit={e => { e.preventDefault(); salvarInformacoes(); }}><fieldset disabled={bloqueado} className="pedido-detalhe-destinatario-campos"><CamposDestinatarioCliente valor={destinatario} alterar={setDestinatario} /></fieldset></form>}</div>}
      </Secao>
      <Secao titulo={`Itens do pedido (${p.itens.length})`} icone={Package}><ul className="pedido-detalhe-itens">{p.itens.map((i, n) => {
        const foto = dados.catalogo.produtos.find(produto => produto.id === i.produtoId)?.fotoUrl;
        return <li key={i.id ?? n}><span className="pedido-detalhe-foto">{foto ? <Image src={foto} alt="" width={48} height={48} unoptimized loading="lazy" className="size-full object-cover" /> : <Package aria-hidden className="size-5 text-muted-foreground" />}</span><div className="pedido-detalhe-item-corpo"><div className="pedido-detalhe-item-nome"><p>{i.quantidade} × {i.produtoSnapshot.nome}</p><span className="pedido-detalhe-item-valor">{moedaPedido(i.totalLinha)}</span></div>{i.escolhasSnapshot.map((e, k) => <p key={k} className="pedido-detalhe-secundario">{e.quantidade} × {e.opcaoNome}</p>)}{i.observacoes && <p className="whitespace-pre-wrap text-xs">{i.observacoes}</p>}</div></li>;
      })}</ul></Secao>
      {p.observacoes && <Secao titulo="Observações" icone={StickyNote}><p className="whitespace-pre-wrap text-sm">{p.observacoes}</p></Secao>}
      <Secao titulo="Resumo financeiro" icone={ClipboardList}><dl className="pedido-detalhe-resumo-financeiro">{[["Subtotal dos itens", p.subtotal], ["Desconto", `-${p.desconto}`], ["Frete (entrega)", p.frete], ["Outras cobranças", p.outrosCustos ?? "0"]].filter(([nome, valor]) => nome === "Subtotal dos itens" || Number(valor) !== 0).map(([nome, valor]) => <div key={nome}><dt>{nome}</dt><dd>{moedaPedido(valor)}</dd></div>)}<div className="pedido-detalhe-resumo-total"><dt>Total do pedido</dt><dd>{moedaPedido(p.total)}</dd></div></dl></Secao>
      <Secao titulo="Pagamento" icone={CreditCard}><PagamentoOperacionalPedido pedido={p} /><details className="pedido-detalhe-total"><summary className="text-muted-foreground">Detalhamento do total</summary><dl>{[["Itens", p.subtotal], ["Desconto", `-${p.desconto}`], ["Entrega", p.frete], ["Outras cobranças", p.outrosCustos ?? "0"]].filter(([nome, valor]) => nome === "Itens" || Number(valor) !== 0).map(([nome, valor]) => <div key={nome}><dt className="text-muted-foreground">{nome}</dt><dd className="tabular-nums">{moedaPedido(valor)}</dd></div>)}</dl></details></Secao>
      {fiscal && <EmitirNotaPedido pedidoId={p.id} numeroPedido={p.numero} versao={p.versao} confirmado={p.status === "CONFIRMADO"} modeloSugerido={65} fiscal={fiscal} />}
      <Card size="sm" className="pedido-detalhe-secao"><CardContent><details className="group pedido-detalhe-historico"><summary><History aria-hidden className="text-primary" />Histórico do pedido <span className="text-muted-foreground">({historico.length})</span><ChevronDown aria-hidden className="group-open:rotate-180" /></summary><ol className="mt-2 divide-y">{historico.map(h => <li key={h.id} className="space-y-1 py-2"><p className="font-medium">{atividades[h.tipo] ?? (h.tipo.startsWith("OPERACAO_") ? "Atendimento atualizado" : h.tipo.replaceAll("_", " ").toLocaleLowerCase("pt-BR"))}</p><p className="text-xs text-muted-foreground">{h.usuarioNome} · {new Date(h.createdAt).toLocaleString("pt-BR", { timeZone: p.fusoHorario })}</p>{h.motivo && <p>{h.motivo}</p>}</li>)}</ol></details></CardContent></Card>
    </div>
    {(mensagem || alterado || editando.length > 0) && <div className="pedido-detalhe-rodape">{mensagem && <p role="status" className="text-xs">{mensagem}</p>}{alterado && <Label className="pedido-detalhe-motivo">Motivo<Textarea required value={motivo} maxLength={1000} rows={2} onChange={e => setMotivo(e.target.value)} placeholder="Descreva a alteração para o histórico" disabled={bloqueado} /></Label>}{requisitosSalvar && <p id={avisoSalvarId} role="status" className="text-xs text-muted-foreground">{requisitosSalvar}</p>}{podeEditar && (alterado || editando.length > 0) && <div className="pedido-detalhe-rodape-acoes"><Button type="button" aria-describedby={requisitosSalvar ? avisoSalvarId : undefined} onClick={salvarInformacoes} disabled={bloqueado || !alterado || !motivo.trim() || agendaInvalida || destinatarioInvalido}><Check aria-hidden />{ocupado ? "Salvando…" : "Salvar alterações"}</Button></div>}</div>}
    <CancelamentoPedido pedido={p} dados={dados} capacidades={capacidades} responsavel={responsavel} aberto={cancelamentoAberto} aoMudarAberto={mudarCancelamento} mostrarGatilho={false} />
    {resumoAberto && <ResumoPedido pedido={p} fechar={() => setResumoAberto(false)} />}
  </div>;
}
