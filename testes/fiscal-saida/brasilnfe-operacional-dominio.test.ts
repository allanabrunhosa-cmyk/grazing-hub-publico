import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
// Exercita os limites do contrato futuro apenas no transporte sintético.
vi.mock("@/lib/fiscal-saida/brasilnfe/bloqueio-transmissao", () => ({ exigirTransmissaoBrasilNfeLiberada: () => {}, transmissaoBrasilNfeLiberada: () => true }));
import { ClienteBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cliente";
import { prepararPayloadLocalBrasilNfe, prepararPayloadSnapshotBrasilNfeLocal, serializarPayloadLocalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/payload-local";
import { habilitacaoCorrespondeBrasilNfe, restaurarHabilitacaoEmissaoBrasilNfe, validarComandoEmissaoPedidoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/operacional-dominio";
import { conferirCapacidadeEmissaoManualBrasilNfe, possuiCapacidadeEmissaoManualBrasilNfe, registrarCapacidadeEmissaoManualBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/capacidade-operacional";
import { massaPayloadLocal } from "./brasilnfe-payload-local-fixtures";
import type { AdaptadorFiscalSaida } from "@/lib/fiscal-saida/contrato";
const comando = { documentoId: "documento-ficticio", modelo: 55, ambiente: "PRODUCAO", hashSnapshot: "a".repeat(64), hashPayloadFiscal: "b".repeat(64), total: "10.00", autorizarUmaTransmissao: true, conferenciaSemDocumentoExterno: true };
describe("Emissão manual: autorização exata e ambientes separados", () => {
  it("confirma documento, hashes, total e ausência de emissão externa na mesma autorização", () => {
    expect(validarComandoEmissaoPedidoBrasilNfe(comando)).toEqual(comando);
    for (const alteracao of [{ total: "0.00" }, { total: 10 }, { hashSnapshot: "incerto" }, { ambiente: 1 }, { modelo: 57 }, { autorizarUmaTransmissao: false }, { conferenciaSemDocumentoExterno: false }, { Token: "ficticio" }]) expect(() => validarComandoEmissaoPedidoBrasilNfe({ ...comando, ...alteracao })).toThrow();
  });
  it("credenciais, empresa, versão, modelo ou ambiente diferentes invalidam a habilitação", () => {
    const d = { ambiente: "PRODUCAO", habilitada: true, revisao: 1, versaoConfiguracao: 9, emitenteHash: "a".repeat(64), modelos: [55] };
    const h = restaurarHabilitacaoEmissaoBrasilNfe("evento-ficticio", { ...d, token: "nao-projetado" }, new Date("2026-10-14T12:00:00Z"))!;
    expect(h).not.toHaveProperty("token"); expect(habilitacaoCorrespondeBrasilNfe(h, { versao: 9, emitenteHash: d.emitenteHash }, "PRODUCAO", 55)).toBe(true);
    for (const [c, ambiente, modelo] of [[{ versao: 10, emitenteHash: d.emitenteHash }, "PRODUCAO", 55], [{ versao: 9, emitenteHash: "b".repeat(64) }, "PRODUCAO", 55], [{ versao: 9, emitenteHash: d.emitenteHash }, "HOMOLOGACAO", 55], [{ versao: 9, emitenteHash: d.emitenteHash }, "PRODUCAO", 65]] as const) expect(habilitacaoCorrespondeBrasilNfe(h, c, ambiente, modelo)).toBe(false);
    expect(restaurarHabilitacaoEmissaoBrasilNfe("e", { ...d, revisao: "1" }, new Date())).toBeNull();
  });
  it("capacidade é somente servidor, vinculada ao documento; cópia/DTO não concede execução", () => {
    const a = { id: "BRASIL_NFE", ambiente: "PRODUCAO" } as AdaptadorFiscalSaida;
    expect(possuiCapacidadeEmissaoManualBrasilNfe(a)).toBe(false); registrarCapacidadeEmissaoManualBrasilNfe(a, "documento-ficticio");
    expect(possuiCapacidadeEmissaoManualBrasilNfe(a, "documento-ficticio")).toBe(true);
    expect(() => conferirCapacidadeEmissaoManualBrasilNfe(a, "outro-documento")).toThrow();
    expect(possuiCapacidadeEmissaoManualBrasilNfe({ ...a })).toBe(false);
  });
  it.each([55, 65] as const)("monta modelo%s em ambiente1 sem literal de homologação e sem transmitir", async modelo => {
    const m = massaPayloadLocal(), r = prepararPayloadLocalBrasilNfe(m.documento, modelo, m.cadastro, m.parametros, "PRODUCAO"), fetch = vi.fn<typeof globalThis.fetch>();
    expect(r.payload?.TipoAmbiente).toBe(1); expect(r.payload?.Produtos[0].NmProduto).toBe("Produto fictício"); expect(r.transmissaoPermitida).toBe(false);
    const padrao = new ClienteBrasilNfe({ token: "token-somente-fixture" }, { fetch });
    await expect(padrao.enviarNotaFiscal(r)).rejects.toMatchObject({ codigo: "PRODUCAO_BLOQUEADA" }); expect(fetch).not.toHaveBeenCalled();
    const prod = new ClienteBrasilNfe({ token: "token-somente-fixture" }, { fetch, ambienteNota: 1 });
    const homo = prepararPayloadLocalBrasilNfe(m.documento, modelo, m.cadastro, m.parametros);
    await expect(prod.enviarNotaFiscal(homo)).rejects.toMatchObject({ codigo: "PRODUCAO_BLOQUEADA" }); expect(fetch).not.toHaveBeenCalled();
  });
  it("cliente de contexto produtivo usa filtro ambiente1 e rejeita nota retornada de ambiente2", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({ Encontrada: false, Nota: null, Historico: [], erros: [], avisos: [], status: 0 }), { headers: { "content-type": "application/json" } }));
    const c = new ClienteBrasilNfe({ token: "token-somente-fixture" }, { fetch, ambienteNota: 1 });
    await c.consultarNotaFiscal({ documentoId: "documento-ficticio", modelo: 55, ambiente: "PRODUCAO" });
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({ TipoAmbiente: 1, ModeloDocumento: 55, IdentificadorInterno: "documento-ficticio" });
    await expect(c.consultarNotaFiscal({ documentoId: "documento-ficticio", modelo: 55, ambiente: "HOMOLOGACAO" })).rejects.toMatchObject({ codigo: "PRODUCAO_BLOQUEADA" }); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([[55, "HOMOLOGACAO", 2], [65, "HOMOLOGACAO", 2], [55, "PRODUCAO", 1], [65, "PRODUCAO", 1]] as const)("reutiliza snapshot v2 do motor único: modelo%s ambiente%s sem recalcular valores", (modelo, ambiente, tipoAmbiente) => {
    const m = massaPayloadLocal(), base = prepararPayloadLocalBrasilNfe(m.documento, modelo, m.cadastro, m.parametros, ambiente);
    const fotografia = { ...m.documento, payload: { ...m.documento.payload, versao: 2, tributacao: { apto: true, pendencias: [], emitenteCnpj: m.cadastro.cnpj, emitenteIE: m.parametros.emitente.ie, crt: 1, documento: base.payload, previa: { contexto: { data: "2026-10-14" } } } } };
    const r = prepararPayloadSnapshotBrasilNfeLocal(fotografia, modelo, { cnpj: m.cadastro.cnpj, ambiente });
    expect(r.montagemConcluida).toBe(true); expect(r.transmissaoPermitida).toBe(false);
    expect(r.payload).toMatchObject({ TipoAmbiente: tipoAmbiente, ModeloDocumento: modelo, IdentificadorInterno: fotografia.id, ValorTotal: "24.53", EnviarEmail: false });
    expect(r.payload?.Produtos[0]).toMatchObject({ Quantidade: "2", ValorTotal: "26.50", ValorDesconto: "2.00", ValorFrete: "0.02", ValorOutrasDespesas: "0.01" });
    expect(r.payload?.Produtos[0].NmProduto).toBe(modelo === 65 && tipoAmbiente === 2 ? "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL" : "Produto fictício");
    const corpo = serializarPayloadLocalBrasilNfe(r); expect(corpo).toContain('"ValorUnitario":13.25'); expect(corpo).toContain('"ValorUnitarioTributavel":13.2500000000'); expect(JSON.parse(corpo).ValorTotal).toBe(24.53);
    for (const campo of ["Serie", "Numero", "Lote"]) expect(JSON.parse(corpo)).not.toHaveProperty(campo);
    for (const campo of ["Serie", "Numero", "Lote"]) {
      const manual = { ...fotografia, payload: { ...fotografia.payload, tributacao: { ...fotografia.payload.tributacao, documento: { ...base.payload, [campo]: "1" } } } };
      expect(() => prepararPayloadSnapshotBrasilNfeLocal(manual, modelo, { cnpj: m.cadastro.cnpj, ambiente })).toThrow("Numeração automática");
    }
    expect(() => prepararPayloadSnapshotBrasilNfeLocal(fotografia, modelo, { cnpj: m.cadastro.cnpj, ambiente: ambiente === "HOMOLOGACAO" ? "PRODUCAO" : "HOMOLOGACAO" })).toThrow();
  });
  it("snapshot v2 incompleto conserva as pendências e não obtém marca de transmissão", () => {
    const m = massaPayloadLocal(), fotografia = { ...m.documento, payload: { versao: 2, tributacao: { apto: false, pendencias: ["Produto fictício: NCM sem aprovação interna."] } } };
    const r = prepararPayloadSnapshotBrasilNfeLocal(fotografia, 55, { cnpj: m.cadastro.cnpj, ambiente: "PRODUCAO" });
    expect(r).toMatchObject({ montagemConcluida: false, payload: null, transmissaoPermitida: false, pendencias: [{ motivo: "Produto fictício: NCM sem aprovação interna." }] });
    expect(() => serializarPayloadLocalBrasilNfe(r)).toThrow();
  });
});
