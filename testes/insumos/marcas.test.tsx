// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarcasCampo } from "@/app/(protegido)/insumos/marcas-campo";
import { lerMarcasJson, marcasDoInsumo, validarMarcas } from "@/lib/insumos/marcas";

afterEach(cleanup);

describe("Marcas homologadas", () => {
  it("normaliza espaços e elimina duplicadas sem separar nomes compostos", () => {
    expect(validarMarcas(["  União  ", "UNIÃO", "Da   Barra", "Marca, A & B"])).toEqual({ marcas: ["União", "Da Barra", "Marca, A & B"] });
    expect(lerMarcasJson('["União","Da Barra"]')).toEqual({ marcas: ["União", "Da Barra"] });
  });
  it.each([null, {}, [1], [""], ["a".repeat(121)], Array.from({ length: 31 }, (_, indice) => String(indice))])("rejeita lista inválida %j", (valor) => {
    expect(validarMarcas(valor)).toHaveProperty("erro");
  });
  it("distingue campo antigo de lista explicitamente vazia", () => {
    expect(marcasDoInsumo({ marca: "União" })).toEqual(["União"]);
    expect(marcasDoInsumo({ marca: "União", marcasHomologadas: [] })).toEqual([]);
    expect(lerMarcasJson("União")).toHaveProperty("erro");
  });
  it("adiciona com Enter e botão, remove uma tag e salva a última marca digitada", async () => {
    const usuario = userEvent.setup();
    const salvar = vi.fn();
    render(<form onSubmit={(evento) => { evento.preventDefault(); salvar(JSON.parse(String(new FormData(evento.currentTarget).get("marcasHomologadas")))); }}>
      <MarcasCampo marcasIniciais={["União"]} /><button>Salvar insumo</button>
    </form>);
    const campo = screen.getByLabelText("Marcas homologadas");
    await usuario.type(campo, "Da Barra{Enter}");
    expect(salvar).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Remover marca Da Barra" })).toBeTruthy();
    await usuario.type(campo, "UNIÃO");
    await usuario.click(screen.getByRole("button", { name: "Adicionar marca" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    await usuario.click(screen.getByRole("button", { name: "Remover marca União" }));
    await usuario.type(campo, "Caravelas");
    await usuario.click(screen.getByRole("button", { name: "Salvar insumo" }));
    expect(salvar).toHaveBeenCalledWith(["Da Barra", "Caravelas"]);
  });
  it("permite remover todas e não edita enquanto está salvando", async () => {
    const usuario = userEvent.setup();
    const { container, rerender } = render(<MarcasCampo marcasIniciais={["União"]} />);
    await usuario.click(screen.getByRole("button", { name: "Remover marca União" }));
    expect((container.querySelector('input[name="marcasHomologadas"]') as HTMLInputElement).value).toBe("[]");
    rerender(<MarcasCampo desabilitado />);
    expect((screen.getByLabelText("Marcas homologadas") as HTMLInputElement).disabled).toBe(true);
  });
});
