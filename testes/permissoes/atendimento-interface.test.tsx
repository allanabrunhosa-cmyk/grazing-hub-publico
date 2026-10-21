// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MatrizPermissoes } from "@/app/(protegido)/configuracoes/usuarios/matriz-permissoes";
import { ACOES, ROTULOS, validarPermissoes, validarExcecoes, type Permissoes, type Excecoes } from "@/lib/permissoes/catalogo";
import { RECURSOS_ATENDIMENTO, SECOES_ATENDIMENTO } from "@/lib/permissoes/atendimento";

afterEach(cleanup);
const nome = (id: string) => { const r = RECURSOS_ATENDIMENTO.find(r => r.id === id)!; return r.nomeMatriz ?? r.nome; };
function abrirSecao(id: string) {
  const secao = SECOES_ATENDIMENTO.find(s => s.recursos.includes(id))!;
  const detalhes = [...document.querySelectorAll<HTMLDetailsElement>("details[aria-label]")].find(d => d.getAttribute("aria-label") === "Seção " + secao.nome)!;
  if (!detalhes.open) fireEvent.click(detalhes.querySelector("summary")!);
  return detalhes;
}
const campo = (id: string, acao: keyof typeof ROTULOS) => {
  abrirSecao(id);
  const grupo = [...document.querySelectorAll<HTMLElement>('[role="group"]')].find(r => r.getAttribute("aria-label") === nome(id))!;
  return within(grupo).getByRole("checkbox", { name: nome(id) + ": " + ROTULOS[acao], hidden: true });
};
const marcada = (id: string, acao: keyof typeof ROTULOS) => campo(id, acao).getAttribute("aria-checked") === "true";

it("organiza somente Atendimento em módulo, seções e recursos sem duplicar permissões", () => {
  render(<MatrizPermissoes base={{}} />);
  const atendimento = screen.getByText("Atendimento", { exact: true }).closest("details")!;
  const vendas = screen.getByText("Vendas", { exact: true }).closest("details")!;
  const secoes = [...atendimento.querySelectorAll("details[aria-label]")];
  for (const secao of SECOES_ATENDIMENTO) {
    const grupo = secoes.find(s => s.getAttribute("aria-label") === "Seção " + secao.nome)!;
    expect(grupo.tagName).toBe("DETAILS");
    expect(grupo.closest('[aria-label="Módulo Atendimento"]')).toBe(atendimento);
    abrirSecao(secao.recursos[0]);
    const grupos = [...grupo.querySelectorAll('[role="group"]')];
    for (const id of secao.recursos) {
      const recurso = grupos.filter(r => r.getAttribute("aria-label") === nome(id));
      expect(recurso).toHaveLength(1);
      expect(grupo.contains(recurso[0])).toBe(true);
      expect(vendas.contains(recurso[0])).toBe(false);
      const r = RECURSOS_ATENDIMENTO.find(r => r.id === id)!;
      for (const acao of ACOES) {
        const encontrados = [...recurso[0].querySelectorAll('[role="checkbox"]')].filter(c => c.getAttribute("aria-label") === nome(id) + ": " + ROTULOS[acao]);
        expect(encontrados).toHaveLength(r.acoes.includes(acao) ? 1 : 0);
        if (!r.acoes.includes(acao)) {
          const indisponivel = [...recurso[0].querySelectorAll("[aria-label]")].find(c => c.getAttribute("aria-label") === nome(id) + ": " + ROTULOS[acao] + " não se aplica");
          expect(indisponivel?.textContent).toBe("—");
        }
      }
    }
    if (secao.id !== "chat") fireEvent.click(grupo.querySelector("summary")!);
  }
  expect(within(vendas).getByLabelText("Clientes: Adicionar")).toBeTruthy();
});

it("marcar adicionar inclui visualizar do recurso sem liberar outra ação ou módulo", () => {
  let atual: Permissoes = { crm: ["visualizar"] };
  function Perfil() { const [base, definir] = useState(atual); atual = base; return <MatrizPermissoes base={base} aoMudar={definir} />; }
  render(<Perfil />);
  fireEvent.click(campo("crm.atendimento.mensagens", "adicionar"));
  expect(marcada("crm.atendimento.mensagens", "visualizar")).toBe(true);
  expect(atual["crm.atendimento.mensagens"]).toEqual(expect.arrayContaining(["visualizar", "adicionar"]));
  expect(atual.crm).toEqual(["visualizar"]);
  expect(atual["crm.atendimento.notas"]).toBeUndefined();
  expect(validarPermissoes(atual)).toEqual(atual);
  fireEvent.click(campo("crm.atendimento.mensagens", "visualizar"));
  expect(atual["crm.atendimento.mensagens"]).toEqual([]);
});

it("ações em lote do módulo respeitam operações disponíveis e preservam outros módulos", () => {
  let atual: Permissoes = {};
  function Perfil() { const [base, definir] = useState<Permissoes>({ "vendas.clientes": ["visualizar"] }); atual = base; return <MatrizPermissoes base={base} aoMudar={definir} />; }
  render(<Perfil />);
  fireEvent.click(screen.getByRole("button", { name: "Tudo em Atendimento", hidden: true }));
  for (const r of RECURSOS_ATENDIMENTO) expect(atual[r.id]).toEqual([...r.acoes]);
  expect(atual["vendas.clientes"]).toEqual(["visualizar"]);
  expect(validarPermissoes(atual)).toEqual(atual);
  fireEvent.click(screen.getByRole("button", { name: "Só visualizar em Atendimento", hidden: true }));
  for (const r of RECURSOS_ATENDIMENTO) expect(atual[r.id]).toEqual(["visualizar"]);
  fireEvent.click(screen.getByRole("checkbox", { name: "Atendimento: Excluir em todas as seções", hidden: true }));
  for (const r of RECURSOS_ATENDIMENTO) expect(atual[r.id]).toEqual(r.acoes.includes("excluir") ? expect.arrayContaining(["visualizar", "excluir"]) : ["visualizar"]);
  expect(validarPermissoes(atual)).toEqual(atual);
});

it("ações da seção alteram somente seus filhos e não enviam o formulário", () => {
  const enviar = vi.fn(); let atual: Permissoes = {};
  function Perfil() { const [base, definir] = useState<Permissoes>({ "vendas.clientes": ["visualizar"], "crm.atendimento.agenda": ["visualizar"] }); atual = base; return <form onSubmit={enviar}><MatrizPermissoes base={base} aoMudar={definir} /></form>; }
  render(<Perfil />);
  fireEvent.click(screen.getByRole("button", { name: "Tudo em Chat", hidden: true }));
  for (const id of SECOES_ATENDIMENTO.find(s => s.id === "chat")!.recursos) expect(atual[id]).toEqual(RECURSOS_ATENDIMENTO.find(r => r.id === id)!.acoes);
  expect(atual["crm.atendimento.agenda"]).toEqual(["visualizar"]);
  expect(atual["crm.atendimento.pipeline"]).toBeUndefined();
  expect(atual["vendas.clientes"]).toEqual(["visualizar"]);
  fireEvent.click(screen.getByRole("checkbox", { name: "Chat: Editar em todos os recursos", hidden: true }));
  expect(atual["crm.atendimento.mensagens"]).toEqual(["visualizar", "adicionar"]);
  expect(atual.crm).toEqual(["visualizar"]);
  expect(enviar).not.toHaveBeenCalled();
  expect(validarPermissoes(atual)).toEqual(atual);
});

it("recolher a seção retira seus controles sem perder as permissões alteradas", () => {
  let atual: Permissoes = {};
  function Perfil() { const [base, definir] = useState<Permissoes>({}); atual = base; return <MatrizPermissoes base={base} aoMudar={definir} />; }
  render(<Perfil />);
  fireEvent.click(campo("crm.atendimento.contatos", "editar"));
  const chat = abrirSecao("crm.atendimento.contatos");
  fireEvent.click(chat.querySelector("summary")!);
  expect(chat.open).toBe(false);
  expect(within(chat).queryByRole("checkbox", { name: nome("crm.atendimento.contatos") + ": Editar", hidden: true })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tudo em Agenda", hidden: true }));
  expect(marcada("crm.atendimento.contatos", "editar")).toBe(true);
  expect(atual["crm.atendimento.contatos"]).toEqual(expect.arrayContaining(["visualizar", "editar"]));
  expect(atual["crm.atendimento.agenda"]).toEqual(RECURSOS_ATENDIMENTO.find(r => r.id === "crm.atendimento.agenda")!.acoes);
});

it("personaliza sem alterar o perfil e restaura somente o recurso escolhido", () => {
  const base: Permissoes = { "crm.atendimento.conhecimento": ["visualizar", "editar", "excluir"], "vendas.clientes": ["visualizar"] }; let atual: Excecoes = {};
  function Usuario() { const [excecoes, definir] = useState<Excecoes>({ "crm.atendimento.conhecimento": { excluir: false }, "vendas.clientes": { visualizar: false } }); atual = excecoes; return <MatrizPermissoes base={base} excecoes={excecoes} aoPersonalizar={definir} />; }
  render(<Usuario />);
  expect(marcada("crm.atendimento.conhecimento", "excluir")).toBe(false);
  fireEvent.click(campo("crm.atendimento.notas", "adicionar"));
  expect(atual["crm.atendimento.notas"]).toEqual({ adicionar: true, visualizar: true });
  expect(atual["crm.atendimento.conhecimento"]).toEqual({ excluir: false });
  fireEvent.click(screen.getByRole("button", { name: "Restaurar perfil em " + nome("crm.atendimento.notas"), hidden: true }));
  expect(atual["crm.atendimento.notas"]).toBeUndefined();
  expect(atual["vendas.clientes"]).toEqual({ visualizar: false });
  expect(validarExcecoes(atual, base)).toEqual(atual);
  expect(base).toEqual({ "crm.atendimento.conhecimento": ["visualizar", "editar", "excluir"], "vendas.clientes": ["visualizar"] });
});

it("retirar visualizar personaliza somente ações aplicáveis sem gravar vetos inválidos", () => {
  const base: Permissoes = { "crm.atendimento.mensagens": ["visualizar", "adicionar"] }; let atual: Excecoes = {};
  function Usuario() { const [excecoes, definir] = useState<Excecoes>({}); atual = excecoes; return <MatrizPermissoes base={base} excecoes={excecoes} aoPersonalizar={definir} />; }
  render(<Usuario />);
  fireEvent.click(campo("crm.atendimento.mensagens", "visualizar"));
  expect(atual).toEqual({ "crm.atendimento.mensagens": { visualizar: false, adicionar: false } });
  expect(validarExcecoes(atual, base)).toEqual(atual);
  expect(marcada("crm.atendimento.mensagens", "adicionar")).toBe(false);
});

it("coluna da seção personaliza os filhos e conserva vetos fora da seção", () => {
  const base: Permissoes = { "crm.atendimento.conhecimento": ["visualizar", "editar", "excluir"] }; let atual: Excecoes = {};
  function Usuario() { const [excecoes, definir] = useState<Excecoes>({ "crm.atendimento.conhecimento": { excluir: false } }); atual = excecoes; return <MatrizPermissoes base={base} excecoes={excecoes} aoPersonalizar={definir} />; }
  render(<Usuario />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Chat: Adicionar em todos os recursos", hidden: true }));
  for (const id of SECOES_ATENDIMENTO.find(s => s.id === "chat")!.recursos) {
    const r = RECURSOS_ATENDIMENTO.find(r => r.id === id)!;
    expect(atual[id]).toEqual(r.acoes.includes("adicionar") ? { adicionar: true, visualizar: true } : undefined);
  }
  expect(atual["crm.atendimento.conhecimento"]).toEqual({ excluir: false });
  expect(validarExcecoes(atual, base)).toEqual(atual);
  expect(screen.queryByRole("button", { name: "Tudo em Chat", hidden: true })).toBeNull();
});

it("descreve revogação e impede edição individual ou em lote sem capacidade", () => {
  const mudar = vi.fn(); render(<MatrizPermissoes base={{}} bloqueada aoMudar={mudar} />);
  const excluir = campo("crm.atendimento.conhecimento", "excluir");
  expect(excluir.hasAttribute("data-disabled")).toBe(true);
  const grupo = screen.getByRole("group", { name: nome("crm.atendimento.conhecimento"), hidden: true });
  expect(grupo.contains(excluir)).toBe(true);
  const descricoes = grupo.getAttribute("aria-describedby")!.split(" ").map(id => document.getElementById(id)?.textContent).join(" ");
  expect(descricoes).toContain("preserva o histórico");
  fireEvent.click(campo("crm", "editar"));
  fireEvent.click(screen.getByRole("checkbox", { name: "Chat: Editar em todos os recursos", hidden: true }));
  expect(mudar).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Tudo em Atendimento", hidden: true })).toBeNull();
});
