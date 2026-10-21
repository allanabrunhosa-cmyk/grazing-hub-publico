import { describe, expect, it } from "vitest";
import { aplicarCaixaAltaNoCampo, paraCaixaAlta, paraCaixaAltaOpcional } from "@/lib/caixa-alta";

describe("padrão de caixa alta", () => {
  it("remove espaços externos e preserva acentos em português", () => {
    expect(paraCaixaAlta("  Açougue São José  ")).toBe("AÇOUGUE SÃO JOSÉ");
    expect(paraCaixaAltaOpcional("  aluguel de setembro ")).toBe("ALUGUEL DE SETEMBRO");
    expect(paraCaixaAltaOpcional("   ")).toBeNull();
  });

  it("converte o valor visível do campo durante o preenchimento", () => {
    const campo = { value: "venda diária" } as HTMLInputElement;
    aplicarCaixaAltaNoCampo(campo);
    expect(campo.value).toBe("VENDA DIÁRIA");
  });
});
