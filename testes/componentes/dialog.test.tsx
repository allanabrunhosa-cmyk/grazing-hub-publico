// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

afterEach(cleanup);

function FormularioTeste() {
  const [aberto, setAberto] = useState(true);

  return (
    <>
      <p>{aberto ? "Editor aberto" : "Tela anterior"}</p>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogTitle>Editar cadastro</DialogTitle>
          <DialogDescription>Altere os dados.</DialogDescription>
          <label>
            Nome
            <input defaultValue="Original" />
          </label>
        </DialogContent>
      </Dialog>
    </>
  );
}

it("fecha imediatamente com Esc quando nada foi alterado", async () => {
  render(<FormularioTeste />);

  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByText("Tela anterior")).toBeTruthy();
});

it("pede confirmação ao usar Esc depois de editar e preserva o formulário ao continuar", async () => {
  const usuario = userEvent.setup();
  render(<FormularioTeste />);

  const campo = screen.getByLabelText("Nome");
  await usuario.clear(campo);
  await usuario.type(campo, "Alterado");
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

  expect(screen.getByText("Sair sem salvar?")).toBeTruthy();
  expect(screen.getByRole("alertdialog", { name: "Sair sem salvar?" })).toBeTruthy();
  expect(campo.closest("[inert]")).not.toBeNull();
  await usuario.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect(screen.queryByText("Sair sem salvar?")).toBeNull();
  expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Alterado");

  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await usuario.click(screen.getByRole("button", { name: "Sair sem salvar" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByText("Tela anterior")).toBeTruthy();
});

it("fecha ao clicar fora sem edição e não descarta com um segundo clique fora após edição", async () => {
  const usuario = userEvent.setup();
  const { unmount } = render(<FormularioTeste />);
  await usuario.click(document.body);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  unmount(); render(<FormularioTeste />);
  await usuario.type(screen.getByLabelText("Nome"), " editado");
  await usuario.click(document.body); await usuario.click(document.body);
  expect(screen.getByRole("alertdialog", { name: "Sair sem salvar?" })).toBeTruthy();
  expect(screen.getByText("Sair sem salvar?")).toBeTruthy();
  await usuario.keyboard("{Escape}");
  expect(screen.queryByText("Sair sem salvar?")).toBeNull();
  expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Original editado");
});

it("aplica a mesma confirmação ao clicar fora do popup", async () => {
  const usuario = userEvent.setup();
  render(<FormularioTeste />);

  const campo = screen.getByLabelText("Nome") as HTMLInputElement;
  await usuario.type(campo, " alterado");
  await usuario.click(document.body);

  expect(screen.getByText("Sair sem salvar?")).toBeTruthy();
  expect(campo.value).toBe("Original alterado");
});

it("X exige escolha e devolve o foco ao mesmo botão ao continuar", async () => {
  const usuario = userEvent.setup(); render(<FormularioTeste />);
  await usuario.type(screen.getByLabelText("Nome"), " editado");
  const fechar = screen.getByRole("button", { name: "Fechar" }) as HTMLButtonElement;
  await usuario.click(fechar);
  expect(fechar.disabled).toBe(true); expect(screen.getByRole("alertdialog", { name: "Sair sem salvar?" })).toBeTruthy();
  await usuario.click(screen.getByRole("button", { name: "Continuar editando" }));
  await waitFor(() => expect(document.activeElement).toBe(fechar));
  expect(fechar.disabled).toBe(false);
  expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Original editado");
});

it("também reconhece controles sem input nativo marcados pelo formulário", async () => {
  const usuario = userEvent.setup();
  render(
    <Dialog defaultOpen>
      <DialogContent>
        <DialogTitle>Editar opção</DialogTitle>
        <DialogDescription>Escolha uma opção.</DialogDescription>
        <Button type="button" data-dialogo-altera>Alterar opção</Button>
      </DialogContent>
    </Dialog>,
  );

  await usuario.click(screen.getByRole("button", { name: "Alterar opção" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

  expect(screen.getByText("Sair sem salvar?")).toBeTruthy();
});

it("protege um editor aberto dentro de outro diálogo", async () => {
  const usuario = userEvent.setup();
  render(
    <Dialog defaultOpen>
      <DialogContent>
        <DialogTitle>Detalhes</DialogTitle>
        <DialogDescription>Resumo.</DialogDescription>
        <Dialog>
          <DialogPrimitiveTriggerTeste />
          <DialogContent>
            <DialogTitle>Editar</DialogTitle>
            <DialogDescription>Altere os dados.</DialogDescription>
            <label>
              Nome
              <input defaultValue="Original" />
            </label>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>,
  );

  await usuario.click(screen.getByRole("button", { name: "Editar" }));
  await usuario.click(screen.getByLabelText("Nome"));
  await usuario.keyboard(" alterado");
  fireEvent.keyDown(screen.getAllByRole("dialog").at(-1)!, { key: "Escape" });

  expect(screen.getByText("Sair sem salvar?")).toBeTruthy();
  await usuario.click(screen.getByRole("button", { name: "Sair sem salvar" }));
  expect(screen.getByText("Detalhes")).toBeTruthy();

  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

function DialogPrimitiveTriggerTeste() {
  return <DialogTrigger render={<Button type="button" />}>Editar</DialogTrigger>;
}

it("reutiliza a confirmação quando o formulário declara alterações controladas", async () => {
  render(<Dialog defaultOpen alterado><DialogContent><DialogTitle>Configuração controlada</DialogTitle><DialogDescription>Alteração de um campo em portal.</DialogDescription></DialogContent></Dialog>);

  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

  expect(screen.getByRole("alertdialog").textContent).toContain("Sair sem salvar?");
  expect(screen.getByRole("alertdialog", { name: "Sair sem salvar?" })).toBeTruthy();
});

it("respeita alterado false mesmo após eventos de edição e após voltar ao valor salvo", async () => {
  const usuario = userEvent.setup();
  const painel = (alterado: boolean) => <Dialog defaultOpen alterado={alterado}><DialogContent><DialogTitle>Configuração controlada</DialogTitle><DialogDescription>O estado do formulário determina as alterações.</DialogDescription><label>Nome controlado<input defaultValue="Original" /></label></DialogContent></Dialog>;
  const view = render(painel(true));
  await usuario.type(screen.getByLabelText("Nome controlado"), " alterado");
  view.rerender(painel(false));

  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.queryByText("Sair sem salvar?")).toBeNull();
});

it("mantém o aviso fora da área rolável, conserva o rascunho e fecha por Escape com retorno de foco", async () => {
  const usuario = userEvent.setup(); render(<FormularioTeste />);
  const painel = screen.getByRole("dialog"), campo = screen.getByLabelText("Nome");
  await usuario.type(campo, " editado"); painel.scrollTop = 420;
  fireEvent.keyDown(painel, { key: "Escape" });
  const aviso = screen.getByRole("alertdialog", { name: "Sair sem salvar?" });
  expect(painel.contains(aviso)).toBe(false);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continuar editando" })));
  await usuario.tab(); expect(document.activeElement).toBe(screen.getByRole("button", { name: "Sair sem salvar" }));
  await usuario.tab(); await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continuar editando" })));
  await usuario.click(document.body); expect(screen.getByRole("alertdialog")).toBe(aviso);
  await usuario.keyboard("{Escape}");
  await waitFor(() => expect(document.activeElement).toBe(campo));
  expect(painel.scrollTop).toBe(420); expect((campo as HTMLInputElement).value).toBe("Original editado");
});

it("substitui o painel pai por um filho sem desmontar seu rascunho e devolve o foco ao voltar", async () => {
  const usuario = userEvent.setup();
  render(<Dialog defaultOpen><DialogContent><DialogTitle>Formulário pai</DialogTitle><DialogDescription>Rascunho preservado.</DialogDescription>
    <label>Nome no pai<input defaultValue="Original" /></label>
    <Dialog><DialogTrigger render={<Button />}>Abrir cadastro filho</DialogTrigger><DialogContent><DialogTitle>Cadastro filho</DialogTitle><DialogDescription>Outro formulário.</DialogDescription></DialogContent></Dialog>
  </DialogContent></Dialog>);
  const pai = screen.getByRole("dialog"), campo = screen.getByLabelText("Nome no pai"), gatilho = screen.getByRole("button", { name: "Abrir cadastro filho" });
  await usuario.type(campo, " editado"); await usuario.click(gatilho);
  await waitFor(() => expect(pai.hasAttribute("inert")).toBe(true));
  expect(pai.classList.contains("invisible")).toBe(true); expect(campo.isConnected).toBe(true);
  expect(screen.getAllByRole("dialog")).toHaveLength(1); expect(screen.getByRole("dialog").textContent).toContain("Cadastro filho");
  await usuario.keyboard("{Escape}");
  await waitFor(() => expect(pai.hasAttribute("inert")).toBe(false));
  expect(pai.classList.contains("invisible")).toBe(false); expect((campo as HTMLInputElement).value).toBe("Original editado");
  await waitFor(() => expect(document.activeElement).toBe(gatilho));
});
it("variante lateral não modal mantém o fundo utilizável e preserva coordenação com filho modal", async () => {
  const usuario = userEvent.setup();
  render(<><button>Controle no fundo</button><Dialog defaultOpen modal={false} disablePointerDismissal protegerAlteracoes={false}><DialogContent variant="painel-direito" showOverlay={false}><DialogTitle>Painel lateral oficial</DialogTitle><DialogDescription>Consulta junto à operação.</DialogDescription><input aria-label="Rascunho do painel" defaultValue="Original" /><Dialog><DialogTrigger render={<Button />}>Abrir documento filho</DialogTrigger><DialogContent><DialogTitle>Documento filho</DialogTitle><DialogDescription>Prévia separada.</DialogDescription></DialogContent></Dialog></DialogContent></Dialog></>);
  const pai = screen.getByRole("dialog", { name: "Painel lateral oficial" });
  expect(pai.getAttribute("data-dialog-variant")).toBe("painel-direito");
  expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeNull();
  await usuario.click(screen.getByRole("button", { name: "Controle no fundo" }));
  expect(screen.getByRole("dialog", { name: "Painel lateral oficial" })).toBe(pai);
  const campo = screen.getByLabelText("Rascunho do painel");
  fireEvent.change(campo, { target: { value: "Alterado localmente" } });
  await usuario.click(screen.getByRole("button", { name: "Abrir documento filho" }));
  expect(pai.hasAttribute("inert")).toBe(true);
  expect(pai.classList.contains("invisible")).toBe(true);
  expect(screen.getByRole("dialog", { name: "Documento filho" })).toBeTruthy();
  await usuario.keyboard("{Escape}");
  await waitFor(() => expect(pai.hasAttribute("inert")).toBe(false));
  expect((campo as HTMLInputElement).value).toBe("Alterado localmente");
});
