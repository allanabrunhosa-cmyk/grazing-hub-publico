"use client";

import { SelecaoFormulario } from "@/components/ui/select";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxInputGroup, ComboboxItem } from "@/components/ui/combobox";
import Script from "next/script";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { ArrowLeft, Check, Layers3, Loader2, Printer, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAcesso } from "@/components/layout/acesso-contexto";
import { ListaProdutos } from "./lista-produtos";
import { CampoBusca } from "@/components/campo-busca";
import { IdentificacaoInsumo } from "@/components/identificacao-insumo";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { detectarImpressoraPadrao, enviarZpl, type ImpressoraLocal } from "@/lib/etiquetas/browser-print";
import { enfileirarPontoAction } from "./pontos-actions";
import type { PontoImpressaoTela } from "./pontos-impressao";
import { fimDoDiaLocal, somarDiasDeCalendario } from "@/lib/etiquetas/datas";
import {
  conservacoesEtiqueta,
  rotuloConservacaoEtiqueta,
  type ConservacaoEtiquetaValor,
  type DadosEtiqueta,
  type TamanhoEtiquetaValor,
  type TrabalhoEtiquetaPreparado,
} from "@/lib/etiquetas/tipos";
import {
  finalizarTentativaEtiquetaAction,
  iniciarEnvioEtiquetaAction,
  prepararEtiquetaAction,
} from "@/app/(protegido)/producao/etiquetas/actions";
import { PreviaEmissao } from "./previa-emissao";
import { FotoProduto } from "./foto-produto";
import { QuantidadeEtiquetas, quantidadeEtiquetasValida } from "./quantidade-etiquetas";
import type { PerfilImpressoraTela, ProdutoEtiquetaTela } from "./etiquetas-client";
import type { ResponsavelEtiquetaOpcao } from "./responsavel-etiqueta";

const SCRIPT_BROWSER_PRINT = typeof process === "undefined"
  ? "/browser-print/BrowserPrint.min.js"
  : process.env.NEXT_PUBLIC_BROWSER_PRINT_SCRIPT_URL || "/browser-print/BrowserPrint.min.js";

type LojaEtiqueta = {
  fusoHorario: string;
  nome?: string;
  cnpj?: string | null;
  endereco?: string | null;
};

function prazo(produto: ProdutoEtiquetaTela, conservacao: ConservacaoEtiquetaValor) {
  return {
    SECO: produto.validadeSecoDias,
    REFRIGERADO: produto.validadeRefrigeradoDias,
    CONGELADO: produto.validadeCongeladoDias,
    APOS_ABERTO: produto.validadeAposAbertoDias,
  }[conservacao];
}

function BotaoCard({ selecionado, children, onClick }: { selecionado?: boolean; children: ReactNode; onClick: () => void }) {
  return <Button variant="ghost" aria-pressed={selecionado} onClick={onClick} className="validades-opcao">{children}</Button>;
}

function quantidadeDaPrevia(valor: string) {
  const limpo = valor.trim().replace(",", ".");
  return /^\d{1,9}(?:\.\d{1,3})?$/.test(limpo) && Number(limpo) > 0 ? limpo : null;
}

export function PainelImpressaoGuiado({ produtos, loja, maximoCopias, perfil, pontos = [], admin, responsaveis, abrirConfiguracao, etapaAtual, mudarEtapa, abasNavegacao }: {
  abasNavegacao?: ReactNode;
  etapaAtual?: number;
  mudarEtapa?: (etapa: number) => void;
  responsaveis: ResponsavelEtiquetaOpcao[];
  produtos: ProdutoEtiquetaTela[];
  loja: LojaEtiqueta;
  maximoCopias: number;
  perfil: PerfilImpressoraTela;
  pontos?: PontoImpressaoTela[];
  admin: boolean;
  abrirConfiguracao: () => void;
}) {
  const podeImprimir = useAcesso().pode("producao.imprimir", "adicionar");
  const disponiveis = useMemo(() => produtos.filter((item) => item.ativo && item.etiquetaHabilitada), [produtos]);
  const categorias = useMemo(() => Array.from(new Set(disponiveis.map((item) => item.categoria || "Sem categoria"))).sort((a, b) => a.localeCompare(b, "pt-BR")), [disponiveis]);
  const [etapaLocal, setEtapaLocal] = useState(1);
  const etapa = etapaAtual ?? etapaLocal;
  const conteudoPasso = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Seleções desmontam o botão anterior. Preserve a busca e o foco dos controles que continuam na tela.
    const quadro = requestAnimationFrame(() => {
      if (document.activeElement === document.body) conteudoPasso.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(quadro);
  }, [etapa]);
  const setEtapa = (nova: number) => { if (nova < 5) setTrabalhos([]); (mudarEtapa ?? setEtapaLocal)(nova); };
  const [mostrarLista, setMostrarLista] = useState(false);
  const [modoGrupo, setModoGrupo] = useState(false);
  const [responsavelUsuarioId, setResponsavelUsuarioId] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [buscaResponsavel, setBuscaResponsavel] = useState("");
  const [responsavelCadastroId, setResponsavelCadastroId] = useState("");
  const [categoria, setCategoria] = useState("");
  const [todosGrupos, setTodosGrupos] = useState(false);
  const [buscaProduto, setBuscaProduto] = useState("");
  const [insumoId, setInsumoId] = useState("");
  const produto = disponiveis.find((item) => item.id === insumoId) ?? null;
  const [conservacao, setConservacao] = useState<ConservacaoEtiquetaValor>("REFRIGERADO");
  const [quantidade, setQuantidade] = useState("");
  const [validadeOriginal, setValidadeOriginal] = useState("");
  const [marcaFornecedor, setMarcaFornecedor] = useState("");
  const [sif, setSif] = useState("");
  const [lote, setLote] = useState("");
  const [copiasTexto, setCopias] = useState("1");
  const copias = Number(copiasTexto);
  const copiasValidas = quantidadeEtiquetasValida(copiasTexto, 1, maximoCopias);
  const [copiasGrupo, setCopiasGrupo] = useState<Record<string, string>>({});
  const [tamanho, setTamanho] = useState<TamanhoEtiquetaValor>(perfil?.suporta60x60 === false ? "MM_60X40" : "MM_60X60");
  const [mostrarHora, setMostrarHora] = useState(true);
  const [trabalhos, setTrabalhos] = useState<TrabalhoEtiquetaPreparado[]>([]);
  const pontosDisponiveis = pontos.filter(ponto => ponto.ativo && !ponto.excluidoEm && ponto.impressoraSelecionadaId && !["REVOGADO", "NAO_VINCULADO"].includes(ponto.situacao));
  const [pontoEscolhido, setPontoId] = useState("");
  const pontoId = pontoEscolhido || pontosDisponiveis.find(ponto => ponto.padrao)?.id || pontosDisponiveis[0]?.id || "";
  const usarPonto = pontosDisponiveis.length > 0;
  const chavesEnvio = useRef(new Map<string, string>());
  const travaImpressao = useRef(false);
  const [enviadosPonto, setEnviadosPonto] = useState<string[]>([]);
  const [impressora, setImpressora] = useState<ImpressoraLocal | null>(null);
  const [mensagemImpressora, setMensagemImpressora] = useState("Nenhuma impressora detectada neste navegador.");
  const [detectando, setDetectando] = useState(false);
  const [agoraPrevia] = useState(() => new Date());
  const [pendente, iniciarTransicao] = useTransition();

  const responsaveisFiltrados = responsaveis.filter((item) => item.nome.toLocaleLowerCase("pt-BR").includes(buscaResponsavel.trim().toLocaleLowerCase("pt-BR")));
  const produtosCategoria = disponiveis.filter((item) => (!categoria || Boolean(buscaProduto.trim()) || (item.categoria || "Sem categoria") === categoria) && item.nome.toLocaleLowerCase("pt-BR").includes(buscaProduto.trim().toLocaleLowerCase("pt-BR")));
  const conservacoesDisponiveis = produto ? conservacoesEtiqueta.filter((item) => Boolean(prazo(produto, item.valor))) : [];
  const totalGrupo = Object.values(copiasGrupo).reduce((total, valor) => total + Number(valor), 0);
  const copiasGrupoValidas = Object.values(copiasGrupo).every(valor => quantidadeEtiquetasValida(valor, 0, maximoCopias));

  const dadosRascunho: DadosEtiqueta | null = (() => {
    const dias = produto ? prazo(produto, conservacao) : null;
    if (!produto || !dias || !responsavel) return null;
    const calculada = somarDiasDeCalendario(agoraPrevia, dias, loja.fusoHorario);
    let validade = calculada;
    if (validadeOriginal) {
      try {
        const original = fimDoDiaLocal(validadeOriginal, loja.fusoHorario);
        if (original < validade) validade = original;
      } catch { /* O servidor apresenta a validação exata ao preparar. */ }
    }
    return {
      produtoNome: produto.nome,
      lojaNome: loja.nome || "Grazing Table & Co",
      lojaCnpj: loja.cnpj ?? null,
      lojaEndereco: loja.endereco ?? null,
      conservacao,
      quantidade: quantidadeDaPrevia(quantidade),
      unidade: produto.unidade,
      lote: lote.trim() || null,
      marcaFornecedor: marcaFornecedor.trim() || null,
      sif: sif.trim() || null,
      validadeOriginal: validadeOriginal || null,
      codigoRastreio: "PRÉVIA",
      responsavelManipulacao: responsavel,
      manipuladoEm: agoraPrevia.toISOString(),
      validoAte: validade.toISOString(),
      fusoHorario: loja.fusoHorario,
      resolucaoDpi: perfil?.dpi ?? 203,
      tamanho,
      mostrarHora,
      copias,
    };
  })();

  const previa = trabalhos[0]?.dados ?? dadosRascunho;

  function escolherProduto(item: ProdutoEtiquetaTela) {
    setInsumoId(item.id);
    setCategoria(item.categoria || "Sem categoria");
    setBuscaProduto("");
    setModoGrupo(false);
    const padrao = item.conservacaoEtiquetaPadrao && prazo(item, item.conservacaoEtiquetaPadrao)
      ? item.conservacaoEtiquetaPadrao
      : conservacoesEtiqueta.find((opcao) => prazo(item, opcao.valor))?.valor ?? "REFRIGERADO";
    setConservacao(padrao);
    setMarcaFornecedor(item.marcasFornecedor?.[0] ?? "");
    setQuantidade("");
    setValidadeOriginal("");
    setSif("");
    setLote("");
    setTrabalhos([]);
    setEtapa(4);
  }

  function limparPreparados() {
    if (trabalhos.length) setTrabalhos([]);
  }

  function prepararGrupo() {
    if (!copiasGrupoValidas || !totalGrupo || pendente) return;
    const selecionados = produtosCategoria.filter((item) => Number(copiasGrupo[item.id]) > 0);
    iniciarTransicao(async () => {
      const preparados: TrabalhoEtiquetaPreparado[] = [];
      for (const item of selecionados) {
        const conservacaoItem = item.conservacaoEtiquetaPadrao && prazo(item, item.conservacaoEtiquetaPadrao)
          ? item.conservacaoEtiquetaPadrao
          : conservacoesEtiqueta.find((opcao) => prazo(item, opcao.valor))?.valor;
        if (!conservacaoItem) { toast.error(`${item.nome} não possui prazo configurado.`); continue; }
        const resultado = await prepararEtiquetaAction({
          chaveIdempotencia: crypto.randomUUID(),
          insumoId: item.id,
          conservacao: conservacaoItem,
          quantidade: "",
          validadeOriginal: "",
          marcaFornecedor: item.marcasFornecedor?.[0] ?? "",
          sif: "",
          lote: "",
          responsavelManipulacao: responsavel,
          responsavelUsuarioId: responsavelUsuarioId || undefined, responsavelCadastroId: responsavelCadastroId || undefined,
          tamanho,
          mostrarHora,
          copias: Number(copiasGrupo[item.id]),
        });
        if ("erro" in resultado) toast.error(`${item.nome}: ${resultado.erro}`); else preparados.push(resultado.trabalho);
      }
      setTrabalhos(preparados);
      if (preparados.length) { setEtapa(5); toast.success(`${preparados.length} trabalho(s) preparado(s).`); }
    });
  }

  async function detectar(): Promise<ImpressoraLocal | null> {
    setImpressora(null);
    setDetectando(true);
    setMensagemImpressora("Buscando impressoras disponíveis no Browser Print…");
    try {
      const encontrada = await detectarImpressoraPadrao();
      setImpressora(encontrada);
      setMensagemImpressora(`${encontrada.nome} · ${encontrada.conexao}`);
      return encontrada;
    } catch (erro) {
      setImpressora(null);
      setMensagemImpressora(erro instanceof Error ? erro.message : "Browser Print indisponível.");
      return null;
    } finally {
      setDetectando(false);
    }
  }

  function imprimir() {
    if (!modoGrupo && !copiasValidas) return;
    if (usarPonto) { enviarAoPonto(); return; }
    if (!produto && trabalhos.length === 0) return;
    iniciarTransicao(async () => {
      const impressoraAtual = impressora ?? await detectar();
      if (!impressoraAtual) return;
      let trabalhosParaEnviar = trabalhos;
      if (trabalhosParaEnviar.length === 0 && produto) {
        const resultado = await prepararEtiquetaAction({
          chaveIdempotencia: crypto.randomUUID(),
          insumoId: produto.id,
          conservacao,
          quantidade,
          validadeOriginal,
          marcaFornecedor,
          sif,
          lote,
          responsavelManipulacao: responsavel,
          responsavelUsuarioId: responsavelUsuarioId || undefined, responsavelCadastroId: responsavelCadastroId || undefined,
          tamanho,
          mostrarHora,
          copias,
        });
        if ("erro" in resultado) { toast.error(resultado.erro); return; }
        trabalhosParaEnviar = [resultado.trabalho];
        setTrabalhos(trabalhosParaEnviar);
      }
      let enviados = 0;
      const falhas: string[] = [];
      for (const trabalho of trabalhosParaEnviar) {
        const inicio = await iniciarEnvioEtiquetaAction(trabalho.id, perfil?.id ?? null, impressoraAtual.nome);
        if ("erro" in inicio) { falhas.push(inicio.erro); continue; }
        try {
          await enviarZpl(impressoraAtual, trabalho.zpl);
          await finalizarTentativaEtiquetaAction(inicio.tentativaId, "SUCESSO");
          enviados += 1;
        } catch (erro) {
          const mensagem = erro instanceof Error ? erro.message : "Falha ao enviar";
          falhas.push(mensagem);
          await finalizarTentativaEtiquetaAction(inicio.tentativaId, mensagem === "TEMPO_LIMITE_INCERTO" ? "INCERTO" : "FALHA", mensagem);
        }
      }
      if (falhas.length > 0) {
        toast.error(`${enviados} de ${trabalhosParaEnviar.length} trabalho(s) enviados. ${falhas[0]}`);
      } else {
        toast.success(`${enviados} de ${trabalhosParaEnviar.length} trabalho(s) enviados ao dispositivo.`);
      }
    });
  }

  function enviarAoPonto() {
    if (travaImpressao.current || !pontoId || tamanho !== "MM_60X60") return;
    travaImpressao.current = true;
    iniciarTransicao(async () => {
      try {
      let preparados = trabalhos;
      if (preparados.length === 0 && produto) {
        const resultado = await prepararEtiquetaAction({
          chaveIdempotencia: crypto.randomUUID(), insumoId: produto.id, conservacao,
          quantidade, validadeOriginal, marcaFornecedor, sif, lote,
          responsavelManipulacao: responsavel, responsavelUsuarioId: responsavelUsuarioId || undefined, responsavelCadastroId: responsavelCadastroId || undefined,
          tamanho, mostrarHora, copias,
        });
        if ("erro" in resultado) { toast.error(resultado.erro); return; }
        preparados = [resultado.trabalho];
        setTrabalhos(preparados);
      }
      let enviados = 0;
      for (const trabalho of preparados) {
        if (enviadosPonto.includes(trabalho.id)) continue;
        const chave = chavesEnvio.current.get(trabalho.id) ?? crypto.randomUUID();
        chavesEnvio.current.set(trabalho.id, chave);
        const resultado = await enfileirarPontoAction({ pontoId, trabalhoId: trabalho.id, chaveIdempotencia: chave, reimpressao: false });
        if ("erro" in resultado) { toast.error(resultado.erro); break; }
        enviados += 1;
        setEnviadosPonto((atual) => [...atual, trabalho.id]);
      }
      if (enviados) toast.success(`${enviados} trabalho(s) enviados para impressão. Confira a saída na Zebra.`);
      } catch { toast.error("Não foi possível confirmar o envio. Confira o Histórico antes de tentar novamente."); }
      finally { travaImpressao.current = false; }
    });
  }

  const nomesEtapas = ["Responsável", "Produto", "Etiqueta"];
  const etapaPrincipal = etapa === 1 ? 1 : etapa === 5 ? 3 : 2;

  return <div className="space-y-3">
    {SCRIPT_BROWSER_PRINT ? <Script src={SCRIPT_BROWSER_PRINT} strategy="afterInteractive" /> : null}
    <div className="validades-navegacao-emissao">
    <div role="region" className="validades-steps flex items-center" aria-label="Etapas da emissão">
      {nomesEtapas.map((nome, indice) => <Button key={nome} variant="ghost" aria-label={`Voltar para ${nome}`} aria-current={etapaPrincipal === indice + 1 ? "step" : undefined} disabled={indice + 1 >= etapaPrincipal || pendente} onClick={() => setEtapa(indice === 0 ? 1 : 2)} className="text-center">
        <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${etapaPrincipal > indice + 1 ? "bg-success text-white" : etapaPrincipal === indice + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{etapaPrincipal > indice + 1 ? <Check className="size-4" /> : indice + 1}</span>
        <span className="validades-nome-etapa text-xs">{nome}</span>
      </Button>)}
    </div>
    {abasNavegacao}
    </div>

    <Card className="validades-passo-conteudo">
      <CardHeader className="validades-cabecalho-passo">
        {etapaPrincipal > 1 && <Button size="icon" variant="ghost" aria-label="Voltar" title={etapa === 5 ? "Voltar para Produto" : "Voltar para Responsável"} disabled={pendente} onClick={() => setEtapa(etapa === 5 ? 2 : 1)}><ArrowLeft /></Button>}
        <div><CardTitle>{nomesEtapas[etapaPrincipal - 1]}</CardTitle>
        {etapaPrincipal === 1 && <CardDescription>Quem manipulou ou preparou os produtos?</CardDescription>}</div>
      </CardHeader>
      <CardContent ref={conteudoPasso} tabIndex={-1} className="space-y-5 outline-none">
        {disponiveis.length === 0 && <div className="rounded-xl border border-warning/30 bg-warning-bg p-4 text-sm">Nenhum produto está habilitado para etiquetas. {admin && <Button variant="link" onClick={abrirConfiguracao}>Configurar produtos</Button>}</div>}

        {etapa === 1 && <>
          <CampoBusca aria-label="Buscar responsável" placeholder="Buscar responsável" value={buscaResponsavel} onChange={setBuscaResponsavel} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{responsaveisFiltrados.map((item) => <BotaoCard key={item.id} selecionado={(responsavelUsuarioId || responsavelCadastroId) === item.id} onClick={() => { setResponsavelUsuarioId(item.origem === "CADASTRO" ? "" : item.id); setResponsavelCadastroId(item.origem === "CADASTRO" ? item.id : ""); setResponsavel(item.nome); setTrabalhos([]); setEtapa(2); }}><UserRound className="mb-2 size-5 text-primary" /><strong>{item.nome}</strong></BotaoCard>)}</div>
          {!responsaveis.length && <p className="text-sm text-muted-foreground">Nenhum responsável disponível. Peça ao administrador para configurar os responsáveis.</p>}
        </>}

        {etapa>=2&&etapa<=4&&<Tabs value={String(etapa)} onValueChange={valor=>{if(pendente)return;const nova=Number(valor);if(nova===2){setBuscaProduto("");setModoGrupo(false);}setEtapa(nova);}} className="validades-produto-subetapas">
          <div><CampoBusca aria-label="Buscar produto" placeholder="Buscar produto em todos os grupos…" value={buscaProduto} onChange={v=>{setBuscaProduto(v);setModoGrupo(false);setInsumoId("");setCopiasGrupo({});setEtapa(v.trim()?3:2);}} /></div>
          <TabsList aria-label="Escolha do produto" variant="line"><TabsTrigger value="2" disabled={pendente}>Grupo</TabsTrigger><TabsTrigger value="3" disabled={pendente||(!categoria&&!todosGrupos&&!buscaProduto.trim())}>Produto</TabsTrigger><TabsTrigger value="4" disabled={pendente||!produto||modoGrupo}>Conservação</TabsTrigger></TabsList>
          <TabsContent value="2">
          <section aria-label="Grupo" className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Grupo</h3><Button variant="ghost" onClick={()=>{setCategoria("");setTodosGrupos(true);setModoGrupo(false);setInsumoId("");setTrabalhos([]);setEtapa(3);}}>Todos os grupos</Button></div><div className="flex flex-wrap gap-2">{categorias.map(item=><Button key={item} variant={categoria===item?"secondary":"outline"} aria-pressed={categoria===item} onClick={()=>{setCategoria(item);setTodosGrupos(false);setInsumoId("");setTrabalhos([]);setBuscaProduto("");setModoGrupo(false);setCopiasGrupo({});setEtapa(3);}}><Layers3 />{item}<span className="text-xs text-muted-foreground">{disponiveis.filter(p=>(p.categoria||"Sem categoria")===item).length} produto(s)</span></Button>)}</div></section>
          </TabsContent>
          <TabsContent value="3"><section aria-label="Produto" className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Produto</h3><Button variant={modoGrupo?"secondary":"outline"} disabled={!categoria} onClick={()=>setModoGrupo(!modoGrupo)}><Layers3 />{modoGrupo?"Selecionando grupo":"Imprimir grupo"}</Button></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{produtosCategoria.map(item=>modoGrupo?<div key={item.id} className="validades-opcao-grupo"><div className="flex items-center gap-3"><FotoProduto url={item.fotoUrl} className="validades-foto-selecao" /><div className="min-w-0"><strong className="break-words">{item.nome}</strong><p className="mt-1 text-xs text-muted-foreground">{item.conservacaoEtiquetaPadrao?rotuloConservacaoEtiqueta(item.conservacaoEtiquetaPadrao):"Sem conservação padrão"}</p></div></div><div className="mt-3"><QuantidadeEtiquetas id={`copias-grupo-${item.id}`} produto={item.nome} valor={copiasGrupo[item.id] ?? "0"} minimo={0} maximo={maximoCopias} disabled={pendente} onChange={valor => { limparPreparados(); setCopiasGrupo(atual => ({ ...atual, [item.id]: valor })); }} /></div></div>:<BotaoCard key={item.id} selecionado={produto?.id===item.id} onClick={()=>escolherProduto(item)}><span className="flex items-center gap-3"><FotoProduto url={item.fotoUrl} className="validades-foto-selecao" /><span className="min-w-0"><IdentificacaoInsumo nome={item.nome} nomeClassName="font-semibold" />{" "}<span className="mt-1 block text-xs text-muted-foreground">{item.tipo==="PRODUTO_INTERMEDIARIO"?"Preparação":"Insumo"} · {item.unidade}</span></span></span></BotaoCard>)}</div>
          {!produtosCategoria.length&&<p className="text-sm text-muted-foreground">Nenhum produto encontrado. Consulte a Lista de produtos para verificar o cadastro.</p>}
          {modoGrupo&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><strong>{totalGrupo} etiqueta(s)</strong><Button disabled={!totalGrupo||!copiasGrupoValidas||pendente} onClick={prepararGrupo}>{pendente?<Loader2 className="animate-spin" />:<ShieldCheck />}Preparar grupo</Button></div>}</section></TabsContent>
          <TabsContent value="4">{produto&&!modoGrupo&&<section aria-label="Conservação" className="validades-conservacao space-y-3"><div><h3 className="font-semibold">Conservação</h3><p className="text-sm text-muted-foreground">{produto.nome} · {produto.categoria||"Sem categoria"}</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{conservacoesDisponiveis.map(item=><BotaoCard key={item.valor} selecionado={conservacao===item.valor} onClick={()=>{setConservacao(item.valor);setTrabalhos([]);setEtapa(5);}}><strong>{item.rotulo}</strong><p className="mt-1 text-sm text-muted-foreground">Validade: {prazo(produto,item.valor)} dia(s)</p></BotaoCard>)}</div>{!conservacoesDisponiveis.length&&<p className="text-warning">Nenhum prazo configurado. {admin&&<Button variant="link" onClick={abrirConfiguracao}>Configurar agora</Button>}</p>}</section>}</TabsContent>
          <details className="validades-lista-produtos" onToggle={e=>setMostrarLista(e.currentTarget.open)}><summary className="cursor-pointer py-3 font-semibold">Lista de produtos <span className="text-xs font-normal text-muted-foreground">· Todos os insumos e preparações</span></summary>{mostrarLista&&<ListaProdutos produtos={produtos} selecionar={escolherProduto} />}</details>
        </Tabs>}

        {etapa === 5 && <div className="grid items-start gap-8 xl:grid-cols-[minmax(360px,1fr)_minmax(420px,1fr)]">
          {previa ? <PreviaEmissao dados={previa} /> : <section aria-label="Prévia da etiqueta" className="grid min-h-64 place-items-center rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Prepare o grupo para conferir a primeira etiqueta.</section>}

          <section className="space-y-5" aria-label="Informações da etiqueta">
            <div className="rounded-xl bg-muted p-4 text-sm">{modoGrupo ? <strong>{Object.values(copiasGrupo).filter(valor => Number(valor) > 0).length} produto(s)</strong> : produto ? <IdentificacaoInsumo nome={produto.nome} nomeClassName="font-semibold" /> : null}<p>{responsavel} · {modoGrupo ? `${totalGrupo} etiqueta(s)` : rotuloConservacaoEtiqueta(conservacao)}</p></div>
            {!modoGrupo && <>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="medida-etiqueta">Medida</Label><div className="flex overflow-hidden rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring"><Input id="medida-etiqueta" inputMode="decimal" casasDecimais={3} maxLength={13} placeholder="0" className="rounded-none border-0 focus-visible:ring-0" value={quantidade} onChange={(evento) => { limparPreparados(); setQuantidade(evento.target.value); }} /><span className="grid min-w-20 place-items-center border-l bg-muted px-3 text-sm">{produto?.unidade.toLocaleLowerCase("pt-BR")}</span></div></div>
                <div className="space-y-2"><Label htmlFor="validade-original">Validade original</Label><Input id="validade-original" type="date" value={validadeOriginal} onChange={(evento) => { limparPreparados(); setValidadeOriginal(evento.target.value); }} /></div>
                <div className="space-y-2"><Label htmlFor="marca-fornecedor">Marca/fornecedor</Label><Combobox items={produto?.marcasFornecedor ?? []} value={marcaFornecedor || null} inputValue={marcaFornecedor}
                  onInputValueChange={(texto, detalhes) => { if (detalhes.reason !== "escape-key") { limparPreparados(); setMarcaFornecedor(texto); } }}
                  onValueChange={(opcao, detalhes) => { if (opcao !== null && detalhes.reason !== "escape-key") { limparPreparados(); setMarcaFornecedor(opcao); } }}>
                  <ComboboxInputGroup><ComboboxInput id="marca-fornecedor" aria-label="Marca/fornecedor" maxLength={60} /></ComboboxInputGroup>
                  <ComboboxContent emptyLabel="Informe uma marca ou fornecedor.">{(opcao: string) => <ComboboxItem key={opcao} value={opcao}>{opcao}</ComboboxItem>}</ComboboxContent>
                </Combobox></div>
                <div className="space-y-2"><Label htmlFor="sif-etiqueta">SIF</Label><Input id="sif-etiqueta" inputMode="numeric" placeholder="Número do SIF" value={sif} maxLength={30} onChange={(evento) => { limparPreparados(); setSif(evento.target.value); }} /></div>
                <div className="space-y-2"><Label htmlFor="lote-etiqueta">Lote</Label><Input id="lote-etiqueta" placeholder="Lote do produto" value={lote} maxLength={80} onChange={(evento) => { limparPreparados(); setLote(evento.target.value); }} /></div>
                <div className="space-y-2"><Label htmlFor="midia-etiqueta">Mídia</Label><SelecaoFormulario id="midia-etiqueta" value={tamanho} onValueChange={(novoValor) => { limparPreparados(); setTamanho(novoValor as TamanhoEtiquetaValor); }}>{(!perfil || perfil.suporta60x40) && <option value="MM_60X40">60 × 40 mm</option>}{(!perfil || perfil.suporta60x60) && <option value="MM_60X60">60 × 60 mm</option>}</SelecaoFormulario></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={mostrarHora} onCheckedChange={(marcado) => { limparPreparados(); setMostrarHora(marcado); }} /> Mostrar hora de manipulação e validade</label>
            </>}
            <div className="space-y-4 border-t pt-5">
              {!modoGrupo && <QuantidadeEtiquetas id="quantidade-etiquetas" valor={copiasTexto} maximo={maximoCopias} disabled={pendente || detectando} onChange={valor => { limparPreparados(); setCopias(valor); }} />}
              <Button className="h-12 w-full text-base sm:w-auto sm:flex-1" disabled={!podeImprimir || pendente || detectando || (!modoGrupo && !copiasValidas) || (!produto && trabalhos.length === 0) || (usarPonto && tamanho !== "MM_60X60") || (trabalhos.length > 0 && trabalhos.every(item => enviadosPonto.includes(item.id)))} onClick={imprimir}>{pendente || detectando ? <Loader2 className="animate-spin" /> : <Printer />} Imprimir</Button>
            </div>
            {usarPonto ? <div className="space-y-2 text-sm">{pontosDisponiveis.length > 1 ? <div className="space-y-1"><Label htmlFor="destino-impressao">Impressora</Label><SelecaoFormulario id="destino-impressao" value={pontoId} onValueChange={setPontoId}>{pontosDisponiveis.map(ponto => <option key={ponto.id} value={ponto.id}>{ponto.nome}{ponto.padrao ? " · padrão" : ""}</option>)}</SelecaoFormulario></div> : <p className="text-center text-muted-foreground">Impressora: {pontosDisponiveis[0].nome}</p>}{tamanho !== "MM_60X60" && <p role="status" className="text-warning">A Zebra deste ponto usa etiquetas 60 × 60 mm.</p>}<p className="text-center text-xs text-muted-foreground">Confira a saída física. Reimpressões ficam no Histórico.</p></div> : <p className="text-center text-xs text-muted-foreground">{detectando ? "Detectando impressora…" : impressora ? `Impressora: ${impressora.nome}` : mensagemImpressora}</p>}
            {trabalhos.length > 0 && trabalhos.every(item => enviadosPonto.includes(item.id)) && <Button variant="outline" onClick={() => { setTrabalhos([]); setEnviadosPonto([]); chavesEnvio.current.clear(); }}>Preparar nova etiqueta</Button>}
          </section>
        </div>}


      </CardContent>
    </Card>

  </div>;
}
