import { describe, expect, it } from "vitest";
import { conferirCatalogoPosteriorBrasilNfe, conferirContadorAtualizacaoBrasilNfe, validarAtualizacaoNumeracaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/numeracao-validacao";
import type { ComandoAtualizacaoNumeracaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/numeracao-dto";
import type { NumeracoesBrasilNfeSanitizadas } from "@/lib/fiscal-saida/brasilnfe/tipos-http";
const comando: ComandoAtualizacaoNumeracaoBrasilNfe = { versao: 1, modelo: 55, ambiente: 2, serie: "6", proximoNumero: "1", padrao: true, operacaoId: "00000000-0000-4000-8000-000000000001", consultadoEm: "2026-10-15T10:00:00.000Z", confirmarAtualizacao: true };
const linha = { ambiente: 2 as const, modelo: 55 as const, serie: "6", numero: "1", padrao: true };
const catalogo = (...numeracoes: NumeracoesBrasilNfeSanitizadas["numeracoes"]) => ({ numeracoes, avisosPresentes: false });
describe("Validação administrativa de série e contador", () => {
  it("valida e projeta o comando exato", () => expect(validarAtualizacaoNumeracaoBrasilNfe(comando)).toEqual(comando));
  it.each([{ serie: "1A" }, { serie: "1234" }, { serie: 6 }, { proximoNumero: "0" }, { proximoNumero: "01" }, { proximoNumero: "1000000000" }, { proximoNumero: 1 }, { ambiente: "2" }, { ambiente: 3 }, { modelo: 10 }, { padrao: 1 }, { confirmarAtualizacao: false }, { operacaoId: "arbitrario" }, { consultadoEm: "ontem" }, { token: "segredo-inaceitavel" }])("recusa comando parcial/fora de limite (%#)", mudanca => expect(() => validarAtualizacaoNumeracaoBrasilNfe({ ...comando, ...mudanca })).toThrow());
  it("série nova começa somente em1, sem copiar contador de outro ambiente", () => {
    expect(conferirContadorAtualizacaoBrasilNfe(comando, catalogo({ ...linha, ambiente: 1, numero: "100" }), 0)).toBe(false);
    expect(() => conferirContadorAtualizacaoBrasilNfe({ ...comando, proximoNumero: "2" }, catalogo(), 0)).toThrow("número 1");
  });
  it.each([{ proximoNumero: "8", contador: "9", local: 0 }, { proximoNumero: "9", contador: "9", local: 9 }, { proximoNumero: "10", contador: "9", local: 10 }])("não reduz nem reutiliza número comprovado (%#)", ({ proximoNumero, contador, local }) => {
    expect(() => conferirContadorAtualizacaoBrasilNfe({ ...comando, proximoNumero }, catalogo({ ...linha, numero: contador }), local)).toThrow("reduzir");
  });
  it("mesmo contador/padrão vira no-op após consulta, série equivalente com zeros", () => expect(conferirContadorAtualizacaoBrasilNfe(comando, catalogo({ ...linha, serie: "006" }), 0)).toBe(true));
  it("avançar contador é permitido sem reservar ou duplicar número local", () => expect(conferirContadorAtualizacaoBrasilNfe({ ...comando, proximoNumero: "10" }, catalogo({ ...linha, numero: "9" }), 9)).toBe(false));
  it("padrão afeta somente outras séries do mesmo modelo/ambiente", () => {
    const antes = catalogo({ ...linha, serie: "1" }, { ...linha, ambiente: 1, numero: "99" }, { ...linha, modelo: 65, serie: "7", numero: "22" });
    const depois = catalogo({ ...linha, serie: "1", padrao: false }, linha, { ...linha, ambiente: 1, numero: "99" }, { ...linha, modelo: 65, serie: "7", numero: "22" });
    expect(conferirCatalogoPosteriorBrasilNfe(comando, antes, depois)).toBe(true);
    expect(conferirCatalogoPosteriorBrasilNfe(comando, antes, { ...depois, numeracoes: depois.numeracoes.map(n => n.ambiente === 1 ? { ...n, numero: "1" } : n) })).toBe(false);
  });
  it("consulta posterior divergente não comprova atualização ou ausência", () => {
    expect(conferirCatalogoPosteriorBrasilNfe(comando, catalogo(), catalogo({ ...linha, padrao: false }))).toBe(false);
    expect(conferirCatalogoPosteriorBrasilNfe(comando, catalogo(), catalogo())).toBe(false);
    expect(conferirCatalogoPosteriorBrasilNfe(comando, catalogo({ ...linha, serie: "1" }), catalogo(linha))).toBe(false);
  });
  it("recuperação pode comprovar contador avançado, nunca reduzi-lo ou ignorar padrão", () => {
    expect(conferirCatalogoPosteriorBrasilNfe(comando, catalogo(), catalogo({ ...linha, numero: "2" }), true)).toBe(true);
    expect(conferirCatalogoPosteriorBrasilNfe(comando, catalogo(), catalogo({ ...linha, numero: "2", padrao: false }), true)).toBe(false);
    expect(conferirCatalogoPosteriorBrasilNfe({ ...comando, proximoNumero: "3" }, catalogo(), catalogo({ ...linha, numero: "2" }), true)).toBe(false);
  });
});
