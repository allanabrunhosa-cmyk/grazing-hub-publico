import { describe, expect, it } from "vitest";
import { resumirCertificadoDashboard } from "@/lib/fiscal-dashboard/certificado";

const agora = new Date("2026-10-12T12:00:00-03:00");
const naoVerificado = { situacao: "NAO_VERIFICADO", validoAte: null, diasParaVencer: null };

describe("Validade do certificado cadastrado no HUB", () => {
  it("indica renovação em 26 dias para validade em 07/11 consultada em 12/10", () => {
    const validoAte = new Date("2026-11-07T12:00:00-03:00");
    expect(resumirCertificadoDashboard({ validoAte }, agora)).toEqual({ situacao: "A_VENCER", validoAte: "2026-11-07T15:00:00.000Z", diasParaVencer: 26 });
  });
  it.each([
    [30, "A_VENCER"],
    [31, "VIGENTE"],
  ] as const)("classifica prazo exato de %i dias como %s", (dias, situacao) => {
    const validoAte = new Date(agora.getTime() + dias * 86400000);
    expect(resumirCertificadoDashboard({ validoAte }, agora)).toEqual({ situacao, validoAte: validoAte.toISOString(), diasParaVencer: dias });
  });
  it("respeita o limite de aviso e arredonda frações para cima como Dados da empresa", () => {
    const trintaDias = agora.getTime() + 30 * 86400000;
    expect(resumirCertificadoDashboard({ validoAte: new Date(trintaDias) }, agora)).toMatchObject({ situacao: "A_VENCER", diasParaVencer: 30 });
    expect(resumirCertificadoDashboard({ validoAte: new Date(trintaDias + 1) }, agora)).toMatchObject({ situacao: "VIGENTE", diasParaVencer: 31 });
    expect(resumirCertificadoDashboard({ validoAte: new Date(agora.getTime() + 1) }, agora)).toMatchObject({ situacao: "A_VENCER", diasParaVencer: 1 });
  });
  it("considera vencido no instante exato de notAfter", () => {
    expect(resumirCertificadoDashboard({ validoAte: new Date(agora) }, agora)).toEqual({ situacao: "VENCIDO", validoAte: agora.toISOString(), diasParaVencer: 0 });
  });
  it("considera vencido há minutos mesmo quando o prazo arredondado ainda é zero", () => {
    const validoAte = new Date(agora.getTime() - 5 * 60000);
    expect(resumirCertificadoDashboard({ validoAte }, agora)).toEqual({ situacao: "VENCIDO", validoAte: validoAte.toISOString(), diasParaVencer: 0 });
  });
  it("conserva prazo negativo de um certificado vencido há dias", () => {
    const validoAte = new Date(agora.getTime() - 2 * 86400000);
    expect(resumirCertificadoDashboard({ validoAte }, agora)).toMatchObject({ situacao: "VENCIDO", diasParaVencer: -2 });
  });
  it.each([null, { validoAte: null }, { validoAte: new Date(NaN) }])("não inventa validade quando os metadados estão ausentes ou inválidos: %j", registro => {
    expect(resumirCertificadoDashboard(registro, agora)).toEqual(naoVerificado);
  });
  it("não inventa estado se o horário de referência for inválido", () => {
    expect(resumirCertificadoDashboard({ validoAte: new Date("2026-11-07T15:00:00Z") }, new Date(NaN))).toEqual(naoVerificado);
  });
  it("uma falha na leitura dos metadados representada por null permanece não verificada", () => {
    expect(resumirCertificadoDashboard(null, agora)).toEqual(naoVerificado);
  });
  it("recusa data recebida em tipo inesperado em vez de converter silenciosamente", () => {
    const registro = { validoAte: "2026-11-07T15:00:00Z" } as unknown as { validoAte: Date | null };
    expect(resumirCertificadoDashboard(registro, agora)).toEqual(naoVerificado);
  });
  it("mantém os metadados e o horário recebidos intactos", () => {
    const validoAte = new Date("2026-11-07T15:00:00Z"), referencia = new Date(agora);
    const validadeAntes = validoAte.getTime(), referenciaAntes = referencia.getTime();
    resumirCertificadoDashboard({ validoAte }, referencia);
    expect(validoAte.getTime()).toBe(validadeAntes); expect(referencia.getTime()).toBe(referenciaAntes);
  });
});
