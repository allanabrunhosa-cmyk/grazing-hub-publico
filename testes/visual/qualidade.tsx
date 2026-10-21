import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Link from "next/link";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AcoesEdicao, BarraAcoes, EdicaoInline, GrupoAcoes } from "@/components/padroes-operacionais";
import { BotaoRemoverItem } from "@/components/remover-item";
import { DemonstracaoPadrao } from "@/components/design-system/demonstracao-padrao";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { CabecalhoConteudo } from "@/components/layout/cabecalho-conteudo";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { auditarInterface } from "../../scripts/auditar-interface.mjs";
import "@/app/globals.css";

export const CASOS_QUALIDADE = ["normal", "longo", "salvando", "erro", "vazio"] as const;
type Caso = typeof CASOS_QUALIDADE[number];
type Resposta = { ok: true } | { erro: string };
const parametros = new URLSearchParams(location.search);
const caso = CASOS_QUALIDADE.includes(parametros.get("caso") as Caso) ? parametros.get("caso") as Caso : "normal";
const tema = parametros.get("tema") === "escuro" ? "escuro" : "claro";
const estadoDemonstracao = caso === "salvando" ? "salvando" : caso;

declare global {
  interface Window {
    grazingQualidade?: Readonly<{
      pronta: true;
      caso: Caso;
      tema: "claro" | "escuro";
      auditar: () => ReturnType<typeof auditarInterface>;
    }>;
  }
}

function FixtureQualidade() {
  const [nome, definirNome] = useState("Cadastro sintético");
  const [local, definirLocal] = useState("producao");
  const [filtro, definirFiltro] = useState("");
  const [envios, definirEnvios] = useState(0);
  const [aguardando, definirAguardando] = useState(false);
  const respostaPendente = useRef<((resposta: Resposta) => void) | null>(null);
  const bloqueado = caso === "salvando";
  const titulo = caso === "longo" ? "Cadastro sintético com nome extenso para conferir quebra de linha e ações disponíveis em todas as larguras" : "Prévia de componentes reais";
  const itens = caso === "vazio" ? [] : [
    { id: "item-a", nome: caso === "longo" ? "Acompanhamento sintético com descrição extensa para eventos e montagem de caixas de degustação" : "Queijo de exemplo", local: "Produção", unidade: "kg", saldo: "12,500", valor: "149,90" },
    { id: "item-b", nome: "Fruta de exemplo", local: "Estoque principal", unidade: "un", saldo: "24,000", valor: "24,50" },
  ];
  const visiveis = itens.filter(item => item.nome.toLocaleLowerCase("pt-BR").includes(filtro.toLocaleLowerCase("pt-BR")));

  useEffect(() => {
    let ativo = true;
    // Apenas metadado para selecionar o aside real; não altera aparência/layout.
    document.querySelector(".menu-lateral")?.setAttribute("data-testid", "lateral");
    void document.fonts.ready.then(() => requestAnimationFrame(() => {
      if (!ativo) return;
      window.grazingQualidade = Object.freeze({ pronta: true, caso, tema, auditar: () => auditarInterface(document) });
    }));
    return () => { ativo = false; delete window.grazingQualidade; };
  }, []);

  function salvarSintetico(): Promise<Resposta> {
    definirEnvios(valor => valor + 1);
    definirAguardando(true);
    return new Promise(resolve => { respostaPendente.current = resolve; });
  }
  function responder(resposta: Resposta) {
    const resolver = respostaPendente.current;
    respostaPendente.current = null;
    definirAguardando(false);
    resolver?.(resposta);
  }

  return <ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}>
    <div className="estrutura-sistema">
      <Sidebar usuarioId="fixture-qualidade" />
      <div className="painel-sistema">
        <CabecalhoConteudo sessao={{ nome: "Equipe sintética", email: "fixture@example.invalid", admin: true }} />
        <main data-testid="fixture-qualidade" className="conteudo-sistema space-y-6">
          <BarraAcoes titulo={titulo} descricao="Dados fixos e callbacks locais; nenhuma operação real.">
            <Button nativeButton={false} variant="outline" render={<Link href="#formulario" />}>Ver formulário</Button>
          </BarraAcoes>

          <section data-testid="controles" aria-label="Ações semânticas" className="space-y-3">
            <h2 className="text-title">Ações semânticas</h2>
            <GrupoAcoes nome="Ações da amostra" alinhamento="inicio" className="flex-wrap">
              <Button data-testid="confirmacao-positiva" variant="entrada" disabled={bloqueado}>Confirmar</Button>
              <Button data-testid="cancelamento-operacional" variant="saida" disabled={bloqueado}>Confirmar cancelamento</Button>
              <Button data-testid="cancelar-edicao" variant="outline" disabled={bloqueado}>Cancelar edição</Button>
              <Button data-testid="salvar-orcamento" variant="salvar" disabled={bloqueado}>Salvar orçamento</Button>
              <Button data-testid="editar-item" variant="editar" aria-label="Editar item sintético" disabled={bloqueado} />
              <BotaoRemoverItem data-testid="remover-item" nome="Remover item sintético" disabled={bloqueado} />
              <Button data-testid="link-icone" nativeButton={false} variant="ghost" size="icon-sm" aria-label="Ver detalhes da amostra" render={<Link href="#tabela" />}><Eye aria-hidden="true" /></Button>
            </GrupoAcoes>
          </section>

          <section id="formulario" data-testid="formulario" aria-label="Formulário da amostra" className="space-y-4">
            <h2 className="text-title">Formulário da amostra</h2>
            <div data-testid="linha-controles" className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="grid min-w-0 gap-2 text-sm"><span>Nome do cadastro</span><Input data-testid="campo-nome" value={nome} onChange={evento => definirNome(evento.target.value)} disabled={bloqueado} aria-invalid={caso === "erro"} aria-describedby={caso === "erro" ? "erro-nome" : undefined} /></label>
              <label className="grid min-w-0 gap-2 text-sm"><span>Local do cadastro</span><Select items={{ producao: "Produção", estoque: "Estoque principal" }} value={local} onValueChange={valor => valor && definirLocal(valor)} disabled={bloqueado}><SelectTrigger data-testid="campo-local" aria-label="Local do cadastro" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="producao">Produção</SelectItem><SelectItem value="estoque">Estoque principal</SelectItem></SelectContent></Select></label>
              <div className="grid min-w-0 gap-2 text-sm"><span aria-hidden="true">Ação do cadastro</span><Button data-testid="botao-linha" variant="entrada" disabled={bloqueado}>Concluir cadastro</Button></div>
            </div>
            {caso === "erro" && <p id="erro-nome" role="alert" className="text-sm text-destructive">Falha simulada: confira o nome. O preenchimento foi preservado.</p>}
            <label className="grid gap-2 text-sm">Observações<Textarea defaultValue="Informação sintética, estável e somente local." disabled={bloqueado} /></label>
            <div data-testid="edicao-inline"><EdicaoInline nome="Preço da amostra" valor="10.00" inputMode="decimal" disabled={bloqueado} validar={valor => /^\d+(?:[.,]\d{1,2})?$/.test(valor) ? null : "Use número positivo com até duas casas decimais."} salvar={salvarSintetico} /></div>
            <output className="sr-only" aria-label="Envios simulados">{envios}</output>
          </section>

          <section id="tabela" data-testid="tabela" aria-label="Tabela da amostra" className="min-w-0 space-y-3">
            <h2 className="text-title">Tabela da amostra</h2>
            <Input aria-label="Filtrar itens sintéticos" placeholder="Buscar item" value={filtro} onChange={evento => definirFiltro(evento.target.value)} disabled={bloqueado} />
            <Table data-testid="tabela-itens" aria-label="Itens sintéticos" className="min-w-[52rem]">
              <TableCaption className="sr-only">Inventário sintético com rolagem interna</TableCaption>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Local</TableHead><TableHead>Unidade</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>{visiveis.length ? visiveis.map(item => <TableRow key={item.id}><TableCell>{item.nome}</TableCell><TableCell>{item.local}</TableCell><TableCell>{item.unidade}</TableCell><TableCell className="text-right tabular-nums">{item.saldo}</TableCell><TableCell className="text-right tabular-nums">{item.valor}</TableCell><TableCell><GrupoAcoes nome={`Ações de ${item.nome}`}><Button variant="editar" aria-label={`Editar ${item.nome}`} disabled={bloqueado} /><BotaoRemoverItem nome={`Remover ${item.nome}`} disabled={bloqueado} /></GrupoAcoes></TableCell></TableRow>) : <TableRow><TableCell colSpan={6}><p role="status">Nenhum item encontrado nesta amostra.</p></TableCell></TableRow>}</TableBody>
            </Table>
          </section>

          <section data-testid="filtros" aria-label="Filtros reais da Central" className="space-y-3"><h2 className="text-title">Filtros com contagem</h2><DemonstracaoPadrao componente="filtros-contados" estado={estadoDemonstracao} aplicado /></section>

          <section data-testid="dialogo" aria-label="Diálogo da amostra" className="space-y-3"><h2 className="text-title">Diálogo da amostra</h2><Dialog protegerAlteracoes={false}><DialogTrigger render={<Button data-testid="abrir-dialogo" variant="outline" disabled={bloqueado} />}>Abrir diálogo sintético</DialogTrigger><DialogContent data-testid="dialogo-painel"><DialogHeader><DialogTitle>Revisar amostra sintética</DialogTitle><DialogDescription>Somente controles locais; Escape fecha e devolve o foco.</DialogDescription></DialogHeader><Input aria-label="Observação do diálogo" defaultValue="Texto da amostra" /><DialogFooter><DialogClose render={<Button variant="outline" />}>Voltar</DialogClose><DialogClose render={<Button variant="entrada" />}>Confirmar revisão</DialogClose></DialogFooter></DialogContent></Dialog></section>

          <section data-testid="estados" aria-label="Estados de edição" className="space-y-3"><h2 className="text-title">Estados de edição</h2><AcoesEdicao nome="descrição sintética" alterado={caso !== "vazio"} salvando={bloqueado} destacarAlterado confirmar={() => {}} cancelar={() => {}} />{bloqueado && <p role="status">Salvando exemplo sintético…</p>}{caso === "vazio" && <p role="status">Amostra sem itens.</p>}</section>
        </main>
        {aguardando && <section aria-label="Controle da resposta sintética" className="conteudo-sistema"><GrupoAcoes nome="Responder ao callback fictício" className="flex-wrap"><Button variant="outline" onClick={() => responder({ ok: true })}>Responder com sucesso</Button><Button variant="outline" onClick={() => responder({ erro: "Falha sintética. O valor foi mantido." })}>Responder com falha</Button></GrupoAcoes></section>}
      </div>
    </div>
    <div hidden aria-hidden="true"><span data-testid="token-success" style={{ backgroundColor: "var(--success)" }} /><span data-testid="token-destructive" style={{ backgroundColor: "var(--destructive)" }} /><span data-testid="token-salvar" style={{ backgroundColor: tema === "escuro" ? "var(--ds-salvar-escuro)" : "var(--ds-salvar-claro)" }} /><span data-testid="token-neutro" style={{ backgroundColor: "var(--card)", color: "var(--foreground)", borderColor: "var(--border)" }} /><span data-testid="token-hover-neutro" style={{ backgroundColor: "var(--muted)" }} /></div>
  </ProvedorAcesso>;
}

createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" forcedTheme={tema === "escuro" ? "dark" : "light"} enableSystem={false}><FixtureQualidade /></ThemeProvider>);
