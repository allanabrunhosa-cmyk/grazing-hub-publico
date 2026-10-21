// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BotaoRemoverItem } from "@/components/remover-item";
import { Tabs, TabsContent, TabsList, TabsTrigger, TabsTriggerBotao } from "@/components/ui/tabs";
import { EdicaoInline, SlotExpansivel, GrupoAcoes } from "@/components/padroes-operacionais";
import { ListaOrdenavel } from "@/components/lista-ordenavel";
import { DemonstracaoValidades } from "@/components/design-system/demonstracao-validades";
import { buscarPadroes, PADROES_DESIGN } from "@/lib/design-system/grupos";

afterEach(cleanup);
it("abas com geometria de botão preservam teclado, painel e as variantes oficiais", async () => {
  render(<Tabs defaultValue="a"><TabsList variant="buttons" aria-label="Prévia de botões"><TabsTriggerBotao value="a">Produtos</TabsTriggerBotao><TabsTriggerBotao value="b">Complementos</TabsTriggerBotao></TabsList><TabsContent value="a">Produtos fictícios</TabsContent><TabsContent value="b">Complementos fictícios</TabsContent></Tabs>);
  const u = userEvent.setup(), produtos = screen.getByRole("tab", { name: "Produtos" });
  expect(produtos.className).toContain("bg-primary"); expect(produtos.className).toContain("px-5");
  expect(produtos.className).toContain("rounded-[var(--ds-botao-raio)]");
  expect(screen.getByRole("tab", { name: "Complementos" }).className).toContain("border-border/80");
  produtos.focus(); await u.keyboard("{ArrowRight}{Enter}");
  expect(screen.getByRole("tab", { name: "Complementos" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tabpanel").textContent).toBe("Complementos fictícios");
});
it("remoção de rascunho tem nome acessível, não envia formulário e consta no catálogo", async () => {
  const remover = vi.fn(), enviar = vi.fn();
  render(<form onSubmit={enviar}><BotaoRemoverItem nome="Remover faixa do rascunho" onClick={remover} /></form>);
  await userEvent.click(screen.getByRole("button", { name: "Remover faixa do rascunho" }));
  expect(remover).toHaveBeenCalledOnce(); expect(enviar).not.toHaveBeenCalled();
  expect(buscarPadroes("remover item").some(p => p.variantes.includes("Remover item do rascunho (X)"))).toBe(true);
});
it("abas primárias preservam teclado, seleção e painel associado", async () => {
  render(<Tabs defaultValue="a"><TabsList variant="primary" aria-label="Prévia"><TabsTrigger value="a">Produtos</TabsTrigger><TabsTrigger value="b">Complementos</TabsTrigger></TabsList><TabsContent value="a">Lista de produtos</TabsContent><TabsContent value="b">Lista de complementos</TabsContent></Tabs>);
  const u = userEvent.setup(); const produtos = screen.getByRole("tab", { name: "Produtos" });
  expect(produtos.getAttribute("aria-selected")).toBe("true"); produtos.focus(); await u.keyboard("{ArrowRight}{Enter}");
  expect(screen.getByRole("tab", { name: "Complementos" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tabpanel").textContent).toBe("Lista de complementos");
});
it("busca por intenções em português e mantém ids únicos", () => {
  for (const termo of ["ativar", "inativar", "status", "lápis", "editar preço", "abrir box", "slot", "agrupar", "porção", "multiseleção", "seleção múltipla"]) expect(buscarPadroes(termo).length, termo).toBeGreaterThan(0);
  expect(new Set(PADROES_DESIGN.map(p => p.id)).size).toBe(PADROES_DESIGN.length);
  expect(PADROES_DESIGN.every(p => p.componente && p.cenarios.length && p.situacao === "Em revisão")).toBe(true);
});
it("ações compactas usam o mesmo contrato e não expandem o slot", async () => {
  const editar = vi.fn();
  render(<SlotExpansivel titulo="Queijos" acoes={<><Button variant="editar" aria-label="Editar Queijos" onClick={editar} /><Button variant="excluir" aria-label="Excluir Queijos" /></>}>Conteúdo sintético</SlotExpansivel>);
  const usuario = userEvent.setup();
  await usuario.click(screen.getByRole("button", { name: "Editar Queijos" }));
  expect(editar).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Abrir Queijos" }).getAttribute("aria-expanded")).toBe("false");
  for (const nome of ["Editar Queijos", "Excluir Queijos"]) expect(screen.getByRole("button", { name: nome }).className).toContain("ds-acao-compacta");
  await usuario.click(screen.getByRole("button", { name: "Abrir Queijos" }));
  expect(screen.getByRole("region", { name: "Conteúdo de Queijos" })).toBeTruthy();
});
it("inline não salva no blur, cancela com Escape, confirma Enter e preserva precisão", async () => {
  const salvar = vi.fn(async () => ({ ok: true as const })), expandir = vi.fn();
  render(<div onClick={expandir}><EdicaoInline nome="Porção" valor="0.00125" salvar={salvar} validar={v => v ? null : "Obrigatório"} /></div>);
  const usuario = userEvent.setup(), campo = screen.getByLabelText("Porção");
  await usuario.clear(campo); await usuario.type(campo, "0.123456"); await usuario.tab();
  expect(salvar).not.toHaveBeenCalled();
  await usuario.click(campo); await usuario.keyboard("{Escape}");
  expect(campo).toHaveProperty("value", "0.00125");
  await usuario.clear(campo); await usuario.type(campo, "0.123456{Enter}");
  await waitFor(() => expect(salvar).toHaveBeenCalledExactlyOnceWith("0.123456"));
  expect(campo).toHaveProperty("value", "0.123456");
  expect(expandir).not.toHaveBeenCalled();
});
it("inline bloqueia duplicatas e preserva preenchimento no erro", async () => {
  let concluir!: (r: { erro: string }) => void;
  const salvar = vi.fn(() => new Promise<{ erro: string }>(resolver => { concluir = resolver; }));
  render(<EdicaoInline nome="Preço" valor="10" salvar={salvar} validar={() => null} />);
  fireEvent.change(screen.getByLabelText("Preço"), { target: { value: "20" } });
  const confirmar = screen.getByRole("button", { name: "Confirmar Preço" });
  fireEvent.click(confirmar); fireEvent.click(confirmar);
  expect(salvar).toHaveBeenCalledOnce(); concluir({ erro: "Conflito de revisão" });
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Preço")).toHaveProperty("value", "20");
  expect(confirmar).toHaveProperty("disabled", false);
});
it("somente leitura não grava e oferece explicação", async () => {
  const salvar = vi.fn();
  render(<EdicaoInline nome="Preço" valor="10" salvar={salvar} validar={() => null} motivoBloqueio="Seu perfil permite apenas consultar." />);
  expect(screen.getByLabelText("Preço")).toHaveProperty("readOnly", true);
  expect(screen.getByText("Seu perfil permite apenas consultar.")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar Preço" })); expect(salvar).not.toHaveBeenCalled();
});
it("ordena pela alça e pelo teclado sem botões de subir e descer", async () => {
  function Lista() { const [itens, definir] = useState(["A", "B"]); return <ListaOrdenavel itens={itens} chave={s => s} nome={s => s} mudar={definir}>{(s, i, alca) => <div>{alca}<span>{i + 1}: {s}</span></div>}</ListaOrdenavel>; }
  render(<Lista />); const usuario = userEvent.setup();
  expect(screen.queryByRole("button", { name: "Descer A" })).toBeNull();
  const alca = screen.getByRole("button", { name: "Arrastar A" }); alca.focus();
  await usuario.keyboard(" {ArrowDown}{Enter}");
  expect(screen.getByText("1: B")).toBeTruthy();
});
it("grupo de ações preserva o clique de ação sem propagação", async () => {
  const externo = vi.fn(), interno = vi.fn(); render(<div onClick={externo}><GrupoAcoes><Button onClick={interno}>Salvar</Button></GrupoAcoes></div>);
  await userEvent.click(screen.getByRole("button")); expect(interno).toHaveBeenCalledOnce(); expect(externo).not.toHaveBeenCalled();
});
it("captura ponteiro no contêiner estável e conclui após mover a alça", () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  const mudou = vi.fn();
  const tela = render(<ListaOrdenavel itens={["A", "B"]} chave={s => s} nome={s => s} mudar={mudou}>{(s, _, alca) => <div>{alca}{s}</div>}</ListaOrdenavel>);
  const raiz = tela.container.firstElementChild!;
  const capturar = vi.fn(); Object.defineProperty(raiz, "setPointerCapture", { value: capturar });
  const destino = tela.container.querySelector('[data-ordem="1"]')!;
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => destino });
  try {
    fireEvent.pointerDown(screen.getByRole("button", { name: "Arrastar A" }), { button: 0 });
    expect(capturar).toHaveBeenCalledOnce();
    fireEvent.pointerMove(raiz, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(raiz);
    expect(mudou).toHaveBeenCalledExactlyOnceWith(["B", "A"]);
    expect(screen.getByRole("button", { name: "Arrastar A" }).getAttribute("aria-pressed")).toBe("false");
  } finally { Reflect.deleteProperty(document, "elementFromPoint"); vi.unstubAllGlobals(); }
});

it("registra a composição de Validades sem aprovar automaticamente a referência",()=>{
 const padrao=buscarPadroes("validades vidro").find(p=>p.id==="validades-vidro");
 expect(padrao?.componente).toBe("validades");expect(padrao?.situacao).toBe("Em revisão");
 expect(padrao?.variantes).toContain("Card com baixa independente");
});

it("a demonstração de Validades dá baixa direta na única etiqueta sintética", async()=>{
 render(<DemonstracaoValidades estado="normal" />);const u=userEvent.setup();
 await u.click(screen.getByRole("button",{name:"Dar baixa"}));
 expect(screen.queryByRole("dialog")).toBeNull();
 expect(screen.getByRole("status").textContent).toBe("Nenhuma etiqueta neste exemplo.");
});

it("a demonstração agrupa e revela os registros somente ao clicar",async()=>{
 render(<DemonstracaoValidades estado="normal" />);const u=userEvent.setup();
 expect(screen.queryByRole("region",{name:"Registros agrupados do exemplo"})).toBeNull();
 await u.click(screen.getByRole("button",{name:"Produto agrupado · 2 registros"}));
 expect(screen.getByRole("region",{name:"Registros agrupados do exemplo"})).toBeDefined();
 expect(screen.getByText("Lote B · Congelado · 1 etiqueta")).toBeDefined();
});
