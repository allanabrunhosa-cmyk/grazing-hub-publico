"use client";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from "@/components/ui/table";
import { useRef, useState } from "react";
import { QuantidadeEscolha } from "@/components/quantidade-escolha";
import { MensagemPendenciaFormulario, type PendenciaFormulario } from "@/components/pendencia-formulario";
import { Eye, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CampoBusca } from "@/components/campo-busca";
import { TagCanalVenda } from "@/components/tag-canal-venda";
import { FiltroCanalVenda } from "@/components/filtro-canal-venda";
import { FiltroOpcoesContadas } from "@/components/filtro-opcoes-contadas";
import { SeletorVisualizacaoOperacional, type VisualizacaoOperacional } from "@/components/seletor-visualizacao-operacional";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger, TabsTriggerBotao } from "@/components/ui/tabs";
import { MultiselecaoCombobox } from "@/components/multiselecao-combobox";
import { StatusAtivo, StatusAtivoSalvavel } from "@/components/status-ativo";
import { BarraAcoes, EdicaoInline, GradeSlots, GrupoAcoes, SlotExpansivel } from "@/components/padroes-operacionais";
import { ListaOrdenavel } from "@/components/lista-ordenavel";
import { SelecaoCanalVenda } from "@/components/canais-venda";
import { BotaoRemoverItem } from "@/components/remover-item";
import type { ComponenteDemonstracao, EstadoDemonstracao } from "@/lib/design-system/grupos";
import { DemonstracaoValidades } from "./demonstracao-validades";
import { DemonstracaoProcesso } from "./demonstracao-processo";

/** Sem Server Actions: o callback altera somente o estado deste exemplo montado. */
export function DemonstracaoPadrao({ componente, estado, aplicado }: { componente: ComponenteDemonstracao; estado: EstadoDemonstracao; aplicado: boolean }) {
  const [ativo, definirAtivo] = useState(true), [nome, definirNome] = useState("Caixa de degustação"), [preco, definirPreco] = useState("149.90");
  const [mensagem, definirMensagem] = useState(""), [excluido, definirExcluido] = useState(false), [confirmarExclusao, definirConfirmacao] = useState(false);
  const [selecionados, definirSelecionados] = useState<string[]>(["Queijos"]), [opcao, definirOpcao] = useState("producao"), [marcado, definirMarcado] = useState(false);
  const [itens, definirItens] = useState(["Queijos", "Frutas", "Pães", "Complementos"]), [filtro, definirFiltro] = useState("");
  const [itemRemovido, definirItemRemovido] = useState(false);
  const [canal, definirCanal] = useState("site");
  const [quantidade, definirQuantidade] = useState(0);
  const campoValidacao = useRef<HTMLInputElement>(null);
  const [pendencia, definirPendencia] = useState<PendenciaFormulario | null>(null);
  const bloqueio = estado === "sem-permissao" ? "Seu perfil permite apenas consultar este exemplo." : estado === "somente-leitura" ? "Exemplo em modo somente leitura." : undefined;
  const ocupado = estado === "carregando" || estado === "salvando";
  const disabled = estado === "desabilitado" || Boolean(bloqueio) || ocupado;
  const titulo = estado === "longo" ? "Caixa de degustação artesanal com queijos, frutas da estação e acompanhamentos selecionados para evento" : nome;
  async function simular<T>(alterar: () => T) {
    await new Promise(resolve => setTimeout(resolve, 450));
    if (estado === "erro") return { erro: "Falha simulada. Nada foi alterado; tente novamente após trocar o cenário." };
    alterar(); definirMensagem("Alteração confirmada somente neste exemplo."); return { ok: true as const };
  }
  const acoes = <GrupoAcoes><Dialog><DialogTrigger render={<Button variant="editar" aria-label={`Editar ${titulo}`} disabled={disabled} />} /><DialogContent><DialogHeader><DialogTitle>Editar exemplo</DialogTitle><DialogDescription>Dados sintéticos; não altera o catálogo do HUB.</DialogDescription></DialogHeader><label className="grid gap-2 text-sm">Nome<Input value={nome} onChange={e => definirNome(e.target.value)} /></label><DialogFooter><DialogClose render={<Button />}>Concluir exemplo</DialogClose></DialogFooter></DialogContent></Dialog><Button variant="excluir" aria-label={`Excluir ${titulo}`} disabled={disabled} onClick={() => definirConfirmacao(true)} /></GrupoAcoes>;
  let conteudo;
  if (componente === "filtros-contados") return <DemonstracaoFiltrosContados estado={estado} />;
  if (componente === "quantidade") return <div className="space-y-2"><QuantidadeEscolha nome="Quantidade de acompanhamento sintético" valor={quantidade} maximo={2} alterar={definirQuantidade} disabled={disabled} /><p className="text-xs text-muted-foreground">Máximo do grupo: 2. Aumentar fica indisponível ao atingir o máximo; diminuir libera uma vaga.</p></div>;
  if (componente === "validacao") return <div className="space-y-3"><label className="grid gap-1.5 text-sm">Nome do exemplo<Input ref={campoValidacao} aria-label="Nome para validar" required onChange={() => definirPendencia(null)} disabled={disabled} /></label><Button disabled={disabled} onClick={() => { const alvo = campoValidacao.current; definirPendencia(alvo && !alvo.value.trim() ? { alvo, mensagem: "Informe o nome do exemplo." } : null); }}>Conferir preenchimento</Button><MensagemPendenciaFormulario pendencia={pendencia} /></div>;
  if (componente === "validades") return <DemonstracaoValidades estado={estado} />;
  if (componente === "processo") return <DemonstracaoProcesso estado={estado} />;
  if (componente === "canais") return <SelecaoCanalVenda canais={estado === "vazio" ? [] : [{ id: "site", nome: "Site" }, { id: "ifood", nome: "iFood" }, { id: "gf", nome: "Giuliana Flores" }]} valor={canal} alterar={definirCanal} disabled={disabled} />;
  if (componente === "operacional-compacto") return <DemonstracaoOperacionalCompacta estado={estado} />;
  if (estado === "vazio" && ["slots", "tabela", "ordenacao", "status"].includes(componente)) conteudo = <div className="rounded-xl border border-dashed p-6 text-center"><p>Nenhum item neste exemplo.</p><Button className="mt-3" disabled={false} onClick={() => definirMensagem("Use Reiniciar exemplo e selecione Normal para recuperar os dados sintéticos.")}>Como recuperar os exemplos</Button></div>;
  else if (componente === "status") conteudo = <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"><div className="min-w-0 flex-1"><p className="break-words font-medium">{titulo}</p><p className="text-xs text-muted-foreground">Cadastro sintético · clique no status para alternar</p></div>{ocupado ? <StatusAtivo nome={titulo} ativo={ativo} onChange={() => {}} salvando /> : <StatusAtivoSalvavel ativo={ativo} nome={titulo} disabled={disabled} motivoBloqueio={bloqueio} salvar={v => simular(() => definirAtivo(v))} />}</div>;
  else if (componente === "acoes") conteudo = <div className="space-y-3"><Button formato="campo" disabled={disabled} onClick={() => definirMensagem("Consulta sintética, sem alterar registros.")}>Consultar indicadores</Button><Button variant="atencao" disabled={disabled} onClick={() => definirMensagem("Orçamento fictício salvo.")}>Salvar orçamento</Button><Button variant="outline" disabled={disabled} onClick={() => definirMensagem("Edição cancelada somente neste exemplo.")}>Cancelar edição</Button><Button variant="excluir-rotulo" aria-label="Excluir exemplo com rótulo" disabled={disabled || excluido} onClick={() => definirConfirmacao(true)}>Excluir</Button>{excluido ? <p role="status">Exemplo removido. Reinicie para restaurar.</p> : <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"><span className="min-w-0 break-words">{titulo}</span>{acoes}</div>}{itemRemovido ? <p role="status">Item removido somente do rascunho sintético.</p> : <div className="flex items-center justify-between gap-3 rounded-xl border p-4"><span>Item do rascunho</span><BotaoRemoverItem nome="Remover item do rascunho" disabled={disabled} onClick={() => definirItemRemovido(true)} /></div>}<div className="flex items-center justify-between gap-3 rounded-xl border p-4"><span>Foto do formulário (remoção pequena)</span><BotaoRemoverItem discreto nome="Remover foto fictícia" disabled={disabled} onClick={() => definirMensagem("Foto removida somente neste exemplo.")} /></div></div>;
  else if (componente === "inline") conteudo = <EdicaoInline nome={aplicado ? "Preço por canal · DIRETO" : "Preço de exemplo"} valor={preco} inputMode="decimal" disabled={disabled} motivoBloqueio={bloqueio} validar={v => /^\d+([.,]\d{1,2})?$/.test(v) ? null : "Exemplo monetário: use vírgula ou ponto e até duas casas decimais."} salvar={v => simular(() => definirPreco(v))} />;
  else if (componente === "slots") conteudo = <GradeSlots>{(aplicado ? itens : itens.slice(0, 1)).map(item => <SlotExpansivel key={item} titulo={estado === "longo" ? `${item} · ${titulo}` : item} resumo="2 opções · exemplo" acoes={acoes}><p className="text-sm">Brie · 80 g</p><p className="text-sm">Gouda · 60 g</p><EdicaoInline nome={`Porção de ${item}`} valor="0.080" validar={v => /^\d+(\.\d{1,6})?$/.test(v) && Number(v) > 0 ? null : "Informe quantidade positiva."} salvar={() => simular(() => {})} disabled={disabled} /></SlotExpansivel>)}</GradeSlots>;
  else if (componente === "ordenacao") conteudo = <div className="space-y-3"><p className="text-xs text-muted-foreground">Conjunto completo de 4 categorias sintéticas. Não há paginação ou filtro nesta ordenação.</p><ListaOrdenavel itens={itens} chave={v => v} nome={v => v} mudar={definirItens} disabled={disabled}>{(item, indice, alca) => <div className="flex items-center gap-2 rounded-xl border p-2">{alca}<span>{indice + 1}. {item}</span></div>}</ListaOrdenavel></div>;
  else if (componente === "selecao") conteudo = <div className="space-y-4"><p className="text-xs text-muted-foreground">Listas abrem abaixo do campo. Grupos identificam categorias do domínio; o check indica a escolha atual.</p><label className="grid gap-2 text-sm">Local do exemplo<Select items={{ producao: "Produção", estoque: "Estoque principal e reserva para eventos" }} value={opcao} onValueChange={v => v && definirOpcao(v)} disabled={disabled}><SelectTrigger aria-label="Local do exemplo" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectLabel>Operação</SelectLabel><SelectItem value="producao">Produção</SelectItem></SelectGroup><SelectGroup><SelectLabel>Armazenamento</SelectLabel><SelectItem value="estoque" quebrarTexto>Estoque principal e reserva para eventos</SelectItem></SelectGroup></SelectContent></Select></label><MultiselecaoCombobox placeholder="Buscar categorias" ariaLabel="Categorias do exemplo" opcoes={itens.map(id => ({ id, nome: id, grupo: id === "Complementos" ? "Acompanhamentos" : "Alimentos" }))} selecionadosIds={selecionados} aoMudar={definirSelecionados} disabled={disabled} /></div>;
  else if (componente === "dialogo") conteudo = <Dialog><DialogTrigger render={<Button disabled={disabled} />}>Abrir janela de exemplo</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Janela de exemplo</DialogTitle><DialogDescription>Tab percorre os controles. Escape fecha e devolve o foco ao botão.</DialogDescription></DialogHeader><Input aria-label="Observação do exemplo" placeholder="Digite para testar o formulário" /><DialogFooter><DialogClose render={<Button variant="outline" />}>Voltar</DialogClose><DialogClose render={<Button onClick={() => definirMensagem("Janela confirmada, sem operação real.")} />}>Confirmar exemplo</DialogClose></DialogFooter></DialogContent></Dialog>;
  else if (componente === "navegacao") conteudo = <div className="space-y-4"><Tabs defaultValue="inventario"><TabsList aria-label="Seções de exemplo"><TabsTrigger value="inventario">Inventário</TabsTrigger><TabsTrigger value="movimentacoes">Movimentações</TabsTrigger></TabsList><TabsContent value="inventario">Saldo sintético: 12 unidades.</TabsContent><TabsContent value="movimentacoes">Nenhuma movimentação real é executada aqui.</TabsContent></Tabs><Tabs defaultValue="produtos"><TabsList variant="buttons" aria-label="Abas com geometria de botão"><TabsTriggerBotao value="produtos">Produtos</TabsTriggerBotao><TabsTriggerBotao value="complementos">Complementos</TabsTriggerBotao></TabsList><TabsContent value="produtos">Produtos sintéticos.</TabsContent><TabsContent value="complementos">Complementos sintéticos.</TabsContent></Tabs></div>;
  else if (componente === "tabela") conteudo = <div className="space-y-3"><Input aria-label="Filtrar tabela de exemplo" value={filtro} onChange={e => definirFiltro(e.target.value)} placeholder="Buscar item" /><div className="overflow-x-auto"><Table className="w-full text-sm"><TableCaption className="sr-only">Itens sintéticos</TableCaption><TableHeader><TableRow><TableHead className="text-left">Item</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{itens.filter(v => v.toLocaleLowerCase("pt-BR").includes(filtro.toLocaleLowerCase("pt-BR"))).map(v => <TableRow key={v} className="border-t"><TableCell className="py-3">{v}</TableCell><TableCell>{acoes}</TableCell></TableRow>)}</TableBody></Table></div></div>;
  else if (componente === "tipografia") conteudo = <div className="space-y-4"><h2 className="text-display">Texto e hierarquia</h2><p className="text-title">Título de seção</p><p className="text-sm">{titulo}. Texto de leitura com números 1.234,56 e acentuação.</p><label className="grid gap-2 text-label">Edite o exemplo<Input value={nome} onChange={e => definirNome(e.target.value)} /></label></div>;
  else if (componente === "cores") conteudo = <div className="space-y-4"><div className="flex flex-wrap gap-3">{["bg-primary text-primary-foreground", "bg-card text-card-foreground", "bg-muted text-muted-foreground", "bg-success-bg text-success"].map(c => <span key={c} className={`${c} rounded-lg border p-4 text-sm`}>{c.split(" ")[0].replace("bg-", "")}</span>)}</div><Button onClick={() => definirMensagem("Ação de exemplo acionada.")}>Testar ação primária</Button></div>;
  else if (componente === "mensagens") conteudo = <div className="space-y-3"><p role={estado === "erro" ? "alert" : "status"} className="rounded-xl border p-4">{estado === "erro" ? "Falha simulada. Seus dados foram mantidos." : ocupado ? "Carregando exemplo…" : estado === "sucesso" ? "Exemplo concluído com sucesso." : "Nenhum evento operacional é executado."}</p><Button onClick={() => definirMensagem("Nova tentativa simulada concluída.")}>Tentar novamente no exemplo</Button></div>;
  else if (componente === "impressao") conteudo = <div className="space-y-3"><p className="text-sm">Prévia de ficha, sem validar impressão física. Os ajustes administrativos não alteram ZPL nem medidas 60×40/60×60.</p><Card><CardHeader><CardTitle>Ficha sintética · degustação</CardTitle></CardHeader><CardContent>Queijo · porção 80 g · consumo de estoque 0,080 kg</CardContent></Card><Button variant="outline" onClick={() => definirMensagem("Nenhuma impressão enviada. Para validar hardware, use o fluxo autorizado de Validades.")}>Conferir limite deste exemplo</Button></div>;
  else conteudo = <div className="space-y-4"><label className="grid gap-2 text-sm">Nome do exemplo<Input value={estado === "longo" ? titulo : nome} onChange={e => definirNome(e.target.value)} disabled={disabled && estado !== "somente-leitura"} readOnly={estado === "somente-leitura"} aria-invalid={estado === "erro"} /></label><label className="grid gap-2 text-sm">Observação do exemplo<Textarea defaultValue="Informação sintética para consulta" disabled={disabled && estado !== "somente-leitura"} readOnly={estado === "somente-leitura"} /></label>{estado === "erro" && <p role="alert" className="text-sm text-destructive">Exemplo de erro: informe um nome válido.</p>}<label className="flex items-center gap-2 text-sm"><Checkbox checked={marcado} onCheckedChange={v => definirMarcado(v === true)} disabled={disabled} />Receber aviso</label><Button disabled={disabled} onClick={() => definirMensagem("Formulário sintético conferido.")}>Conferir exemplo</Button></div>;
  return <div className="space-y-4" data-cenario={estado}>{aplicado && <BarraAcoes titulo="Contexto de cadastro" descricao="Aplicação sintética do mesmo componente, sem catálogo real." />}{bloqueio && <p className="text-xs text-muted-foreground">{bloqueio}</p>}{estado === "foco" && <p className="text-xs text-muted-foreground">Pressione Tab para percorrer os controles e inspecionar o foco real.</p>}{estado === "hover" && <p className="text-xs text-muted-foreground">Passe o ponteiro sobre os controles para inspecionar o hover real.</p>}{ocupado && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" />{estado === "salvando" ? "Salvando exemplo…" : "Carregando exemplo…"}</p>}{conteudo}{(mensagem || estado === "sucesso") && <p role="status" className="rounded-lg border bg-success-bg p-3 text-sm text-success">{mensagem || "Operação sintética confirmada."}</p>}<Dialog open={confirmarExclusao} onOpenChange={definirConfirmacao} protegerAlteracoes={false}><DialogContent><DialogHeader><DialogTitle>Excluir exemplo?</DialogTitle><DialogDescription>Somente o item sintético desta demonstração será removido. Reiniciar recupera o item.</DialogDescription></DialogHeader><DialogFooter><DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose><Button variant="destructive" onClick={() => { definirExcluido(true); definirConfirmacao(false); definirMensagem("Exemplo excluído; nenhum cadastro foi removido."); }}>Confirmar exclusão simulada</Button></DialogFooter></DialogContent></Dialog></div>;
}

function DemonstracaoFiltrosContados({ estado }: { estado: EstadoDemonstracao }) {
  const [busca, definirBusca] = useState("");
  const [tipo, definirTipo] = useState<"TODOS" | "PF" | "PJ">("TODOS");
  const bloqueado = ["desabilitado", "carregando", "salvando"].includes(estado);
  const clientes = estado === "vazio" ? [] : [
    { id: "pf-1", nome: "Pessoa fictícia", tipo: "PF" },
    { id: "pf-2", nome: "Outra pessoa fictícia", tipo: "PF" },
    { id: "pj-1", nome: estado === "longo" ? "Empresa fictícia com nome extenso para conferir a quebra de linha da listagem" : "Empresa fictícia", tipo: "PJ" },
  ];
  const encontrados = clientes.filter(cliente => cliente.nome.toLocaleLowerCase("pt-BR").includes(busca.trim().toLocaleLowerCase("pt-BR")));
  const filtrados = encontrados.filter(cliente => tipo === "TODOS" || cliente.tipo === tipo);
  return <div className="space-y-3" data-cenario={estado}>
    <p className="text-sm font-semibold">Clientes · filtros com contagem</p>
    <p className="text-xs text-muted-foreground">A busca atualiza todas as contagens. Escolher um tipo mantém visíveis as quantidades das outras opções. Dados fictícios, sem gravação.</p>
    <fieldset disabled={bloqueado} className="min-w-0 space-y-3">
      <CampoBusca aria-label="Buscar cliente do exemplo" placeholder="Buscar cliente" value={busca} onChange={definirBusca} disabled={bloqueado} />
      <FiltroOpcoesContadas nome="Filtrar clientes do exemplo por tipo" valor={tipo} onValueChange={definirTipo} opcoes={[
        { valor: "TODOS", nome: "Todos", quantidade: encontrados.length },
        { valor: "PF", nome: "Pessoa física", quantidade: encontrados.filter(cliente => cliente.tipo === "PF").length },
        { valor: "PJ", nome: "Pessoa jurídica", quantidade: encontrados.filter(cliente => cliente.tipo === "PJ").length },
      ]} />
    </fieldset>
    {filtrados.length ? <ul aria-label="Clientes fictícios encontrados" className="space-y-2 text-sm">{filtrados.map(cliente => <li key={cliente.id} className="break-words">{cliente.nome}</li>)}</ul> : <p role="status" className="text-sm text-muted-foreground">Nenhum cliente encontrado no exemplo.</p>}
    {bloqueado && <p role="status" className="text-xs text-muted-foreground">Controles indisponíveis neste cenário sintético.</p>}
    {estado === "erro" && <p role="alert" className="text-sm text-destructive">Falha fictícia; contagens e consulta anteriores preservadas.</p>}
  </div>;
}

/** Controles compartilhados com dados locais fictícios, sem ações ou consultas reais. */
function DemonstracaoOperacionalCompacta({ estado }: { estado: EstadoDemonstracao }) {
  const [busca, definirBusca] = useState(""), [visao, definirVisao] = useState<VisualizacaoOperacional>("quadros");
  const [canal, definirCanal] = useState<string | undefined>();
  const canais = [{ id: "site", nome: "Site" }, { id: "ifood", nome: "iFood" }, { id: "gf", nome: "Giuliana Flores" }];
  const [mensagem, definirMensagem] = useState("");
  const bloqueado = ["desabilitado", "sem-permissao", "somente-leitura", "carregando", "salvando"].includes(estado);
  return <div className="space-y-3" data-cenario={estado}>
    <p className="text-sm font-semibold">Gestor de Pedidos · exemplo compacto</p>
    <BarraAcoes titulo="Gestor de Pedidos" variante="compacta">
      <CampoBusca formato="arredondado" aria-label="Buscar pedido do exemplo" placeholder="Buscar pedido" value={busca} onChange={definirBusca} disabled={bloqueado} />
      <FiltroCanalVenda canais={canais} canalId={canal} aoMudar={definirCanal} disabled={bloqueado} />
      <SeletorVisualizacaoOperacional valor={visao} aoMudar={definirVisao} disabled={bloqueado} />
    </BarraAcoes>
    <p className="text-xs text-muted-foreground">Consulta local fictícia: {busca || "todos os pedidos"} · {canais.find(item => item.id === canal)?.nome ?? "todos os canais"} · {visao}.</p>
    <div className="flex flex-wrap gap-2" aria-label="Canais de venda do exemplo">{["site", "iFood", "Giuliana Flores", estado === "longo" ? "Canal de exemplo com nome bastante extenso para conferir o limite da tag" : "Outro canal", null].map(canal => <TagCanalVenda key={canal ?? "sem-canal"} canal={canal} />)}</div>
    {estado === "vazio" ? <p role="status">Nenhum pedido neste exemplo.</p> : <Card size="sm"><CardContent><div className="flex flex-wrap items-center gap-2"><p className="min-w-0 flex-1 break-words text-title font-semibold">{estado === "longo" ? "Cliente fictício com nome completo bastante extenso" : "Cliente fictício"}</p><TagCanalVenda canal="site" /><GrupoAcoes nome="Ações do pedido fictício"><Button variant="ghost" size="icon-sm" aria-label="Ver pedido fictício" title="Ver pedido fictício" disabled={bloqueado} onClick={() => definirMensagem("Detalhes fictícios; nenhum pedido real foi consultado.")}><Eye aria-hidden="true" /></Button><Button variant="ghost" size="icon-sm" aria-label="Imprimir pedido fictício" title="Imprimir pedido fictício" disabled={bloqueado} onClick={() => definirMensagem("Prévia fictícia; nenhuma impressão foi enviada.")}><Printer aria-hidden="true" /></Button></GrupoAcoes></div><p className="mt-2 text-sm font-semibold text-muted-foreground">Para: destinatário fictício</p><p className="mt-1 text-title font-semibold">Pedido #101</p><p className="text-xs">Em preparo</p></CardContent></Card>}
    {mensagem && <p role="status" className="text-sm">{mensagem}</p>}
    {estado === "erro" && <p role="alert" className="text-sm text-destructive">Falha fictícia; consulta anterior preservada.</p>}
    {bloqueado && <p role="status" className="text-xs text-muted-foreground">Controles indisponíveis neste cenário sintético.</p>}
  </div>;
}
