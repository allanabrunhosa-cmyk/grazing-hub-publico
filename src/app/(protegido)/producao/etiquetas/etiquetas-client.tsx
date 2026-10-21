"use client";

import "./validades.css";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { SelecaoFormulario } from "@/components/ui/select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, Loader2, Save, Settings2 } from "lucide-react";
import { CampoBusca } from "@/components/campo-busca";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputComSufixo } from "@/components/ui/input-com-sufixo";
import { Label } from "@/components/ui/label";
import { ResponsaveisConfiguracao, type ConfiguracaoResponsaveis } from "./responsaveis-configuracao";
import type { ResponsavelEtiquetaOpcao } from "./responsavel-etiqueta";
import { useAcesso } from "@/components/layout/acesso-contexto";
import { PreparacaoRaspberry } from "./preparacao-raspberry";
import type { PlanejamentoRaspberry } from "@/lib/etiquetas/raspberry";
import type { SecaoEtiquetas } from "@/lib/etiquetas/navegacao";
import { PainelValidades, type GestaoValidadesTela } from "./gestao-validades";
import { PainelImpressaoGuiado } from "./painel-impressao-guiado";
import { PainelPontosImpressao, type PontoImpressaoTela } from "./pontos-impressao";
import { confirmarSaidaFisicaPontoAction, enfileirarPontoAction } from "./pontos-actions";
import {
  confirmarImpressaoEtiquetaAction,
  registrarExportacaoEtiquetaAction,
  salvarConfiguracaoImpressoraAction,
  salvarConfiguracaoProdutoEtiquetaAction,
} from "@/app/(protegido)/producao/etiquetas/actions";
import { rotuloConservacaoEtiqueta, type ConservacaoEtiquetaValor, type DadosEtiqueta, type TamanhoEtiquetaValor } from "@/lib/etiquetas/tipos";
import { IdentificacaoInsumo } from "@/components/identificacao-insumo";

export type ProdutoEtiquetaTela = {
  id: string;
  fotoUrl?: string | null;
  nome: string;
  especificacao?: string | null;
  marcasFornecedor?: string[];
  tipo: "INSUMO" | "PRODUTO_INTERMEDIARIO";
  unidade: string;
  categoria: string | null;
  ativo: boolean;
  etiquetaHabilitada: boolean;
  validadeSecoDias: number | null;
  validadeRefrigeradoDias: number | null;
  validadeCongeladoDias: number | null;
  validadeAposAbertoDias: number | null;
  conservacaoEtiquetaPadrao: ConservacaoEtiquetaValor | null;
  versaoConfiguracaoEtiqueta: number;
};

export type HistoricoEtiquetaTela = {
  id: string;
  produtoNome: string;
  conservacao: ConservacaoEtiquetaValor;
  responsavelManipulacao: string;
  emitidoPorNome: string;
  manipuladoEm: string;
  validoAte: string;
  fusoHorario: string;
  copias: number;
  status: string;
  pontoEstado?: string | null;
  tamanho: TamanhoEtiquetaValor;
  zpl: string;
  nomeArquivo: string;
  dados: DadosEtiqueta;
  tentativas: number;
};

export type PerfilImpressoraTela = {
  planejamentoRaspberry?: PlanejamentoRaspberry | null;
  id: string;
  nome: string;
  modelo: string | null;
  dpi: number;
  suporta60x40: boolean;
  suporta60x60: boolean;
} | null;

type Props = {
  configuracaoResponsaveis?: ConfiguracaoResponsaveis;
  pontos?: PontoImpressaoTela[];
  enviosPonto?: { id: string; tipo: string; estado: string; criadoEm: string; finalizadoEm: string | null; detalhe: string | null; pontoNome: string; produtoNome: string | null }[];
  dedicado?: boolean;
  mostrarPrazos?: boolean;
  secao?: SecaoEtiquetas;
  gestaoValidades?: GestaoValidadesTela;
  responsaveis: ResponsavelEtiquetaOpcao[];
  caminhoBase: string;
  produtos: ProdutoEtiquetaTela[];
  historico: HistoricoEtiquetaTela[];
  admin: boolean;
  podeConfigurarValidades?: boolean;
  loja: {
    fusoHorario: string;
    maximoCopiasEtiqueta: number;
    nome?: string;
    cnpj?: string | null;
    endereco?: string | null;
  };
  perfil: PerfilImpressoraTela;
  paginaHistorico: { pagina: number; porPagina: number; total: number };
  abaInicial: "imprimir" | "historico";
};

const STATUS: Record<string, string> = {
  PREPARADO: "Preparado",
  ENVIANDO: "Enviando",
  ENVIADO_AO_DISPOSITIVO: "Enviado ao dispositivo",
  ENVIO_INCERTO: "Envio incerto",
  EXPORTADO: "Arquivo exportado",
  FALHA: "Falha",
  CONFIRMADO_PELO_OPERADOR: "Impressão confirmada",
};

function baixarArquivo(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "application/octet-stream;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

function PainelHistorico({ historico, pagina, caminhoBase, pontos, envios }: { historico: HistoricoEtiquetaTela[]; pagina: Props["paginaHistorico"]; caminhoBase: string; pontos: PontoImpressaoTela[]; envios: NonNullable<Props["enviosPonto"]> }) {
  const roteador = useRouter();
  const podeEmitir = useAcesso().pode("producao.imprimir", "adicionar");
  const [busca, setBusca] = useState("");
  const [pendente, iniciarTransicao] = useTransition();
  const [pontoReimpressao, setPontoReimpressao] = useState(pontos.find((ponto) => ponto.padrao)?.id ?? pontos[0]?.id ?? "");
  const filtrado = historico.filter((item) => item.produtoNome.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  function exportar(item: HistoricoEtiquetaTela) {
    baixarArquivo(item.nomeArquivo, item.zpl);
    iniciarTransicao(async () => {
      const resultado = await registrarExportacaoEtiquetaAction(item.id);
      if ("erro" in resultado) toast.warning(`Arquivo baixado; falha ao registrar: ${resultado.erro}`);
    });
  }
  function confirmar(id: string) {
    iniciarTransicao(async () => {
      const resultado = await confirmarImpressaoEtiquetaAction(id);
      if ("erro" in resultado) toast.error(resultado.erro); else toast.success("Saída física confirmada.");
    });
  }
  function reimprimir(item: HistoricoEtiquetaTela) {
    if (!window.confirm(`Reimprimir ${item.produtoNome} no ponto selecionado? Confira a validade antes de usar a etiqueta.`)) return;
    iniciarTransicao(async () => {
      const resultado = await enfileirarPontoAction({ pontoId: pontoReimpressao, trabalhoId: item.id, chaveIdempotencia: crypto.randomUUID(), reimpressao: true });
      if ("erro" in resultado) toast.error(resultado.erro); else toast.success("Reimpressão registrada na fila.");
    });
  }
  return (
    <div className="space-y-5">
    <Card>
      <CardHeader><CardTitle>Histórico da loja</CardTitle><CardDescription>Trabalhos, cópias e resultado são métricas diferentes. {pagina.total} trabalho(s) registrado(s).</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {pontos.length > 0 && <div className="flex flex-wrap items-center gap-2"><Label htmlFor="ponto-reimpressao">Ponto para reimpressão</Label><SelecaoFormulario id="ponto-reimpressao" value={pontoReimpressao} onValueChange={(novoValor) => setPontoReimpressao(novoValor)}>{pontos.filter((ponto) => ponto.ativo).map((ponto) => <option key={ponto.id} value={ponto.id}>{ponto.nome}</option>)}</SelecaoFormulario></div>}
        <CampoBusca aria-label="Buscar no histórico" value={busca} onChange={setBusca} placeholder="Buscar produto" />
        <div className="overflow-x-auto rounded-xl border">
          <Table className="w-full  text-left text-sm">
            <TableHeader className="bg-muted text-muted-foreground"><TableRow><TableHead className="p-3">Produto</TableHead><TableHead className="p-3">Manipulação / validade</TableHead><TableHead className="p-3">Responsáveis</TableHead><TableHead className="p-3">Cópias</TableHead><TableHead className="p-3">Resultado</TableHead><TableHead className="p-3">Ações</TableHead></TableRow></TableHeader>
            <TableBody>{filtrado.map((item) => <TableRow key={item.id} className="border-t align-top">
              <TableCell className="p-3"><strong>{item.produtoNome}</strong><div className="text-xs text-muted-foreground">{rotuloConservacaoEtiqueta(item.conservacao)} · {item.tamanho === "MM_60X40" ? "60×40" : "60×60"}</div></TableCell>
              <TableCell className="p-3 text-xs"><div>{new Intl.DateTimeFormat("pt-BR", { timeZone: item.fusoHorario, dateStyle: "short", timeStyle: "short" }).format(new Date(item.manipuladoEm))}</div><div>até {new Intl.DateTimeFormat("pt-BR", { timeZone: item.fusoHorario, dateStyle: "short", timeStyle: "short" }).format(new Date(item.validoAte))}</div></TableCell>
              <TableCell className="p-3 text-xs"><div>Manipulou: {item.responsavelManipulacao}</div><div>Emitiu: {item.emitidoPorNome}</div></TableCell>
              <TableCell className="p-3">{item.copias}<div className="text-xs text-muted-foreground">{item.tentativas} tentativa(s)</div></TableCell>
              <TableCell className="p-3"><span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">{STATUS[item.status] ?? item.status}</span>{item.pontoEstado && <div className="mt-2 text-xs">Ponto: {({ PENDENTE: "Pendente", RESERVADO: "Reservado", ENVIADO_USB: "Enviado por USB", FALHA: "Falha", INCERTO: "Resultado incerto", CONFIRMADO: "Saída física confirmada" } as Record<string, string>)[item.pontoEstado] ?? item.pontoEstado}</div>}</TableCell>
              <TableCell className="p-3"><GrupoAcoes><Button size="sm" variant="outline" disabled={pendente || !podeEmitir} onClick={() => exportar(item)}><Download /> ZPL</Button>{pontoReimpressao && item.tamanho === "MM_60X60" && <Button size="sm" variant="outline" disabled={pendente || !podeEmitir} onClick={() => reimprimir(item)}>Reimprimir no ponto</Button>}{["ENVIADO_AO_DISPOSITIVO", "EXPORTADO"].includes(item.status) ? <Button size="sm" variant="secondary" disabled={pendente || !podeEmitir} onClick={() => confirmar(item.id)}>Confirmar</Button> : null}</GrupoAcoes></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </div>
        {filtrado.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum trabalho encontrado.</p> : null}
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Página {pagina.pagina} de {Math.max(1, Math.ceil(pagina.total / pagina.porPagina))}</span>
          <div className="flex gap-2">
            {pagina.pagina > 1 ? <Link className="inline-flex min-h-10 items-center rounded-md border px-4 font-medium hover:bg-muted" href={`${caminhoBase}?pagina=${pagina.pagina - 1}`}>Anterior</Link> : null}
            {pagina.pagina * pagina.porPagina < pagina.total ? <Link className="inline-flex min-h-10 items-center rounded-md border px-4 font-medium hover:bg-muted" href={`${caminhoBase}?pagina=${pagina.pagina + 1}`}>Próxima</Link> : null}
          </div>
        </div>
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle>Fila dos pontos</CardTitle><CardDescription>Últimos 30 envios. “Enviado por USB” significa apenas que os dados foram entregues à interface.</CardDescription></CardHeader><CardContent className="space-y-2">{envios.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum envio pelo conector.</p> : envios.map((envio) => <div key={envio.id} className="rounded-xl border p-3 text-sm"><strong>{envio.produtoNome ?? "Teste de impressão"}</strong> · {envio.pontoNome}<p>{({ PENDENTE: "Pendente", RESERVADO: "Reservado", ENVIADO_USB: "Enviado por USB", FALHA: "Falha", INCERTO: "Resultado incerto", CONFIRMADO: "Saída física confirmada" } as Record<string, string>)[envio.estado] ?? envio.estado} · {new Date(envio.criadoEm).toLocaleString("pt-BR")}</p>{envio.detalhe && <p className="text-muted-foreground">{envio.detalhe}</p>}{["ENVIADO_USB", "INCERTO"].includes(envio.estado) && podeEmitir && <Button size="sm" variant="outline" disabled={pendente} onClick={() => { if (window.confirm("Você conferiu a etiqueta física deste envio?")) iniciarTransicao(async () => { const resultado = await confirmarSaidaFisicaPontoAction(envio.id); if ("erro" in resultado) toast.error(resultado.erro); else { toast.success("Saída física confirmada."); roteador.refresh(); } }); }}>Confirmar saída física</Button>}</div>)}</CardContent></Card>
    </div>
  );
}

function LinhaConfiguracaoProduto({ produto }: { produto: ProdutoEtiquetaTela }) {
  const [habilitada, setHabilitada] = useState(produto.etiquetaHabilitada);
  const [seco, setSeco] = useState(produto.validadeSecoDias?.toString() ?? "");
  const [refrigerado, setRefrigerado] = useState(produto.validadeRefrigeradoDias?.toString() ?? "");
  const [congelado, setCongelado] = useState(produto.validadeCongeladoDias?.toString() ?? "");
  const [pendente, iniciarTransicao] = useTransition();
  function salvar() {
    iniciarTransicao(async () => {
      const resultado = await salvarConfiguracaoProdutoEtiquetaAction({ insumoId: produto.id, etiquetaHabilitada: habilitada, validadeSecoDias: seco, validadeRefrigeradoDias: refrigerado, validadeCongeladoDias: congelado });
      if ("erro" in resultado) toast.error(resultado.erro); else toast.success(`${produto.nome}: configuração v${resultado.versao} salva.`);
    });
  }
  const campos = [
    ["Ambiente", seco, setSeco],
    ["Refrigerado", refrigerado, setRefrigerado],
    ["Congelado", congelado, setCongelado],
  ] as const;
  return <TableRow className="border-t align-middle"><TableCell className="p-3"><IdentificacaoInsumo nome={produto.nome} nomeClassName="font-semibold" /><div className="text-xs text-muted-foreground">{produto.tipo === "PRODUTO_INTERMEDIARIO" ? "Preparação" : "Insumo"} · {produto.ativo ? "Ativo" : "Inativo"} · v{produto.versaoConfiguracaoEtiqueta}</div></TableCell><TableCell className="p-3"><Checkbox checked={habilitada} onCheckedChange={setHabilitada} aria-label={`Habilitar ${produto.nome}`} /></TableCell>{campos.map(([nome, valor, alterar]) => <TableCell key={nome} className="p-3"><div className="flex items-baseline gap-1"><Label className="text-xs">{nome}</Label><span className="text-xs font-normal text-muted-foreground">(após aberto)</span></div><div className="relative mt-1"><Input className="w-24 pr-12" type="number" min={1} value={valor} onChange={(e) => alterar(e.target.value)} aria-label={`${nome} de ${produto.nome}`} /><span aria-hidden="true" className="pointer-events-none absolute right-2 top-2.5 text-xs text-muted-foreground">dias</span></div></TableCell>)}<TableCell className="p-3"><Button size="sm" variant="outline" onClick={salvar} disabled={pendente}>{pendente ? <Loader2 className="animate-spin" /> : <Save />} Salvar</Button></TableCell></TableRow>;
}

function ConfiguracaoImpressora({ loja, perfil }: { loja: Props["loja"]; perfil: PerfilImpressoraTela }) {
  const [planejamentoRaspberry, setPlanejamentoRaspberry] = useState(perfil?.planejamentoRaspberry ?? null);
  const [fuso, setFuso] = useState(loja.fusoHorario);
  const [maximo, setMaximo] = useState(loja.maximoCopiasEtiqueta);
  const [nome, setNome] = useState(perfil?.nome ?? "Impressora da cozinha");
  const [modelo, setModelo] = useState(perfil?.modelo ?? "");
  const [dpi, setDpi] = useState(perfil?.dpi ?? 203);
  const [mm40, setMm40] = useState(perfil?.suporta60x40 ?? true);
  const [mm60, setMm60] = useState(perfil?.suporta60x60 ?? true);
  const [pendente, iniciarTransicao] = useTransition();
  function salvar() { iniciarTransicao(async () => { const resultado = await salvarConfiguracaoImpressoraAction({ fusoHorario: fuso, maximoCopias: maximo, perfilId: perfil?.id ?? null, nomePerfil: nome, modelo, dpi, suporta60x40: mm40, suporta60x60: mm60, planejamentoRaspberry }); if ("erro" in resultado) toast.error(resultado.erro); else toast.success("Configuração da loja e perfil salvos."); }); }
  return <Card><CardHeader><CardTitle>Loja e perfil de impressão</CardTitle><CardDescription>Confirme no equipamento real a linguagem ZPL, resolução e mídia. O dispositivo USB continua local.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
    <div className="space-y-2"><Label htmlFor="impressora-fuso">Fuso IANA</Label><Input id="impressora-fuso" value={fuso} onChange={(e) => setFuso(e.target.value)} /></div>
    <div className="space-y-2"><Label htmlFor="impressora-copias">Máximo de cópias</Label><Input id="impressora-copias" type="number" min={1} max={50} value={maximo} onChange={(e) => setMaximo(Number(e.target.value))} /></div>
    <div className="space-y-2"><Label htmlFor="impressora-nome">Nome do perfil</Label><Input id="impressora-nome" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
    <div className="space-y-2"><Label htmlFor="impressora-modelo">Modelo da impressora</Label><Input id="impressora-modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Ex.: ZD220" /></div>
    <div className="space-y-2"><Label htmlFor="impressora-dpi">Resolução</Label><InputComSufixo id="impressora-dpi" type="number" value={dpi} onChange={(e) => setDpi(Number(e.target.value))} sufixo="dpi" /></div>
    <div className="flex flex-wrap items-end gap-4"><label className="flex items-center gap-2"><Checkbox checked={mm40} onCheckedChange={setMm40} /> 60×40</label><label className="flex items-center gap-2"><Checkbox checked={mm60} onCheckedChange={setMm60} /> 60×60</label></div>
    <PreparacaoRaspberry valor={planejamentoRaspberry} mudar={setPlanejamentoRaspberry} />
    <div className="md:col-span-2"><Button onClick={salvar} disabled={pendente}>{pendente ? <Loader2 className="animate-spin" /> : <Settings2 />} Salvar perfil</Button></div>
  </CardContent></Card>;
}

function PainelConfiguracao({ produtos, loja, perfil, somenteProdutos = false }: Pick<Props, "produtos" | "loja" | "perfil"> & { somenteProdutos?: boolean }) {
  const [busca, setBusca] = useState("");
  const filtrados = produtos.filter((produto) => produto.nome.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  return <div className="space-y-6">{!somenteProdutos && <ConfiguracaoImpressora loja={loja} perfil={perfil} />}<Card><CardHeader><CardTitle>Validade no cadastro existente</CardTitle><CardDescription>Os campos abaixo pertencem ao mesmo Insumo/Preparação. Todos os prazos são após aberto; a embalagem fechada segue a validade do fornecedor. Vazio não é zero e nenhum prazo é sugerido automaticamente.</CardDescription></CardHeader><CardContent className="space-y-4"><CampoBusca aria-label="Buscar no cadastro de prazos" value={busca} onChange={setBusca} placeholder="Buscar insumo ou preparação" /><div className="overflow-x-auto rounded-xl border"><Table className="w-full  text-left text-sm"><TableHeader className="bg-muted text-muted-foreground"><TableRow><TableHead className="p-3">Cadastro</TableHead><TableHead className="p-3">Habilitado</TableHead><TableHead className="p-3">Ambiente</TableHead><TableHead className="p-3">Refrigerado</TableHead><TableHead className="p-3">Congelado</TableHead><TableHead className="p-3">Ação</TableHead></TableRow></TableHeader><TableBody>{filtrados.map((produto) => <LinhaConfiguracaoProduto key={produto.id} produto={produto} />)}</TableBody></Table></div></CardContent></Card></div>;
 
}

export function EtiquetasClient(props: Props) {
  return <div className="validades-premium"><ConteudoValidades {...props} /></div>;
}

function ConteudoValidades(props: Props) {
  const roteador = useRouter();
  const pontos = (props.pontos ?? []).filter(ponto => !ponto.excluidoEm);
  const podeEmitir = useAcesso().pode("producao", "adicionar");
  const [aba, setAba] = useState<string>(props.abaInicial);
  const [etapaImpressao, setEtapaImpressao] = useState(1);
  const [prazos, setPrazos] = useState(props.mostrarPrazos ?? false);
  const abasNavegacao = <TabsList aria-label="Áreas de etiquetas"><TabsTrigger value="imprimir">Imprimir</TabsTrigger><TabsTrigger value="historico">Histórico</TabsTrigger>{props.admin && !props.dedicado && <TabsTrigger value="configurar">Configurar</TabsTrigger>}</TabsList>;
  if (props.secao === "configuracoes") return props.admin
    ? <Tabs defaultValue="pontos" className="space-y-5"><TabsList aria-label="Configurações de Validades"><TabsTrigger value="pontos">Pontos de impressão</TabsTrigger><TabsTrigger value="responsaveis">Responsáveis</TabsTrigger><TabsTrigger value="perfil">Perfil da impressora</TabsTrigger></TabsList><TabsContent value="pontos"><PainelPontosImpressao pontos={props.pontos ?? []} /></TabsContent><TabsContent value="responsaveis">{props.configuracaoResponsaveis && <ResponsaveisConfiguracao dados={props.configuracaoResponsaveis} />}</TabsContent><TabsContent value="perfil"><ConfiguracaoImpressora loja={props.loja} perfil={props.perfil} /></TabsContent></Tabs>
    : <p role="status">A configuração exige um administrador ativo.</p>;
  if (props.secao === "validades") return <div className="space-y-6">
    {prazos && (props.admin || props.podeConfigurarValidades) && <div className="flex flex-wrap gap-2"><Button variant={prazos ? "outline" : "default"} onClick={() => setPrazos(false)}>Acompanhamento</Button><Button variant={prazos ? "default" : "outline"} onClick={() => setPrazos(true)}>Prazos dos produtos</Button></div>}
    {prazos && (props.admin || props.podeConfigurarValidades) ? <PainelConfiguracao {...props} somenteProdutos /> : props.gestaoValidades && <PainelValidades dados={props.gestaoValidades} caminhoBase={props.caminhoBase} acoes={(props.admin||props.podeConfigurarValidades)?<Button variant="ghost" aria-label="Prazos dos produtos" onClick={()=>setPrazos(true)}>Prazos<span className="hidden sm:inline"> dos produtos</span></Button>:undefined} />}
  </div>;
  return (
    <Tabs value={aba} onValueChange={(valor) => setAba(String(valor))} className="validades-fluxo">
      {(aba !== "imprimir" || !podeEmitir) && <div className="flex justify-end">{abasNavegacao}</div>}
      {!props.dedicado && <Link className="inline-flex text-sm font-medium text-primary underline" href={`${props.caminhoBase}?secao=validades`}>Gestão de validades</Link>}
      {!podeEmitir && <p role="status" className="rounded-xl border bg-muted p-3 text-sm">Seu acesso permite consulta. Preparar exige Produção → Adicionar. Imprimir, exportar e conferir exigem Imprimir etiquetas → Adicionar.</p>}
      <TabsContent value="imprimir" keepMounted><fieldset disabled={!podeEmitir} className="min-w-0"><legend className="sr-only">Emissão de etiquetas</legend><PainelImpressaoGuiado abasNavegacao={podeEmitir && aba === "imprimir" ? abasNavegacao : undefined} etapaAtual={etapaImpressao} mudarEtapa={setEtapaImpressao} responsaveis={props.responsaveis} produtos={props.produtos} loja={props.loja} maximoCopias={props.loja.maximoCopiasEtiqueta} perfil={props.perfil} pontos={pontos} admin={props.admin} abrirConfiguracao={() => props.dedicado ? roteador.push(`${props.caminhoBase}?secao=validades&prazos=1`) : setAba("configurar")} /></fieldset></TabsContent>
      <TabsContent value="historico"><PainelHistorico historico={props.historico} pagina={props.paginaHistorico} caminhoBase={props.caminhoBase} pontos={pontos} envios={props.enviosPonto ?? []} /></TabsContent>
      {props.admin ? <TabsContent value="configurar"><PainelConfiguracao produtos={props.produtos} loja={props.loja} perfil={props.perfil} /><PainelPontosImpressao pontos={props.pontos ?? []} /></TabsContent> : null}
    </Tabs>
  );
}
