import { describe, expect, it } from "vitest";
import { hashCanonico } from "@/lib/vendas/historico-dominio";
import { nomesEmpresariaisEquivalentes, normalizarEmpresaHistorica, referenciaEmpresaHistorica, validarManifestoEmpresasHistoricas } from "@/lib/vendas/clientes-correcao-dominio";

export const manifestoSintetico = () => {
  const empresa = "Empresa Alfa Sintética";
  return { versao: 1, loteHistoricoId: "lote-original-sintetico", inventarioSha256: "a".repeat(64), empresas: [{
    companyRef: referenciaEmpresaHistorica(empresa), decisao: "PJ_CNPJ_COMPROVADO", cnpj: "11222333000181", razaoSocial: empresa, nomeFantasia: null,
    dominiosCorporativos: ["empresa.example.invalid"], motivoPendente: null, provas: [{ url: "https://registro.example.invalid/empresa", consultadoEm: "2026-10-15T00:00:00Z", arquivo: "empresa.json", arquivoSha256: "b".repeat(64),
      papel: "REGISTRO_CNPJ", cnpjObservado: "11222333000181", nomeEmpresarialObservado: empresa, dominioObservado: "empresa.example.invalid" }],
  }], vinculos: [{ chaveClienteHistorico: `grazing-legado-orders:cliente:${"c".repeat(64)}`, companyRef: referenciaEmpresaHistorica(empresa), numerosOriginais: ["10001"] }] };
};
describe("manifesto estrito de correção cadastral", () => {
  it("mantém prova pública e vínculo privado sem transformar documento ou texto bruto", () => {
    const m = manifestoSintetico(), antes = hashCanonico(m), validado = validarManifestoEmpresasHistoricas(m);
    expect(validado.empresas[0].cnpj).toBe("11222333000181"); expect(validado.vinculos[0].regra).toBe("COMPANY_EXATA");
    expect(hashCanonico(m)).toBe(antes);
  });
  it("repete referência NFKD, espaços e casefold sem depender de JSON", () => {
    expect(normalizarEmpresaHistorica("  EMPRESA ÁLFA  \n SINTÉTICA ")).toBe("empresa alfa sintetica");
    expect(referenciaEmpresaHistorica(" ÁLFA ")).toBe(referenciaEmpresaHistorica("alfa"));
    expect(referenciaEmpresaHistorica("Straße")).toBe(referenciaEmpresaHistorica("STRASSE"));
  });
  it("compara só diferenças tipográficas, mantendo tokens e titulares distintos", () => {
    expect(nomesEmpresariaisEquivalentes("BANCO FICTÍCIO S.A.", "Banco Ficticio SA")).toBe(true);
    expect(nomesEmpresariaisEquivalentes("EMPRESA FICTÍCIA LTDA.", "Empresa Fictícia Ltda")).toBe(true);
    expect(nomesEmpresariaisEquivalentes("HOME2INVEST", "HOME 2 INVEST")).toBe(false);
    expect(nomesEmpresariaisEquivalentes("Empresa Ltda", "Empresa Eireli")).toBe(false);
    expect(nomesEmpresariaisEquivalentes("Empresa Comercial", "Empresa Comercial Holding")).toBe(false);
  });
  it("preserva a separação de palavras em vírgula e ponto e vírgula sem espaço", () => {
    expect(nomesEmpresariaisEquivalentes("ALFA,BETA,GAMA S.A.", "Alfa Beta Gama SA")).toBe(true);
    expect(nomesEmpresariaisEquivalentes("ALFA;BETA;GAMA LTDA.", "Alfa Beta Gama Ltda")).toBe(true);
    expect(nomesEmpresariaisEquivalentes("ALFA,BETA", "ALFABETA")).toBe(false);
  });
  it.each(["telefone", "email", "empresaLivre", "aprovado"])("rejeita campo extra %s em vez de confiar em flags", campo => {
    const m = manifestoSintetico(); Object.assign(m.empresas[0], { [campo]: "valor" });
    expect(() => validarManifestoEmpresasHistoricas(m)).toThrow("CORRECAO_CAMPOS_INVALIDOS");
  });
  it.each(["11222333000182", "11111111111111", "12ABC345000190", "11.222.333/0001-81"])("não cria documento a partir de CNPJ inválido/não canônico %s", cnpj => {
    const m = manifestoSintetico(); m.empresas[0].cnpj = cnpj;
    expect(() => validarManifestoEmpresasHistoricas(m)).toThrow("CORRECAO_CNPJ_SEM_PROVA");
  });
  it("conserva CNPJ alfanumérico candidato como pendência explícita", () => {
    const m = manifestoSintetico(), e = m.empresas[0];
    Object.assign(e, { decisao: "PJ_CNPJ_PENDENTE", cnpj: null, cnpjCandidato: "12ABC345000190", razaoSocial: null, motivoPendente: "CNPJ_ALFANUMERICO_NAO_SUPORTADO" });
    expect(validarManifestoEmpresasHistoricas(m).empresas[0]).toMatchObject({ cnpj: null, cnpjCandidato: "12ABC345000190" });
  });
  it.each(["../empresa.json", "pasta/empresa.json", "C:\\empresa.json", "arquivo..json"])("bloqueia caminho de prova arbitrário %s", arquivo => {
    const m = manifestoSintetico(); m.empresas[0].provas[0].arquivo = arquivo;
    expect(() => validarManifestoEmpresasHistoricas(m)).toThrow("CORRECAO_ARQUIVO_PROVA_INVALIDO");
  });
  it.each(["http://registro.example.invalid", "https://segredo@registro.example.invalid", "https://registro.example.invalid/#segredo"])("bloqueia URL fora do contrato %s", url => {
    const m = manifestoSintetico(); m.empresas[0].provas[0].url = url;
    expect(() => validarManifestoEmpresasHistoricas(m)).toThrow("CORRECAO_URL_INVALIDA");
  });
  it("não herda CNPJ de domínio corporativo sem prova ou nome legal correspondente", () => {
    const m = manifestoSintetico(); m.empresas[0].provas[0].nomeEmpresarialObservado = "Outra empresa sintética";
    expect(() => validarManifestoEmpresasHistoricas(m)).toThrow("CORRECAO_CNPJ_SEM_PROVA");
    m.empresas[0].provas[0].nomeEmpresarialObservado = "Empresa Alfa Sintética"; m.empresas[0].provas[0].dominioObservado = "outro.example.invalid";
    expect(() => validarManifestoEmpresasHistoricas(m)).toThrow("CORRECAO_DOMINIO_SEM_PROVA");
  });
  it("rejeita e-mail completo e provedores pessoais como domínio de empresa", () => {
    const m = manifestoSintetico(); m.empresas[0].dominiosCorporativos = ["pessoa@empresa.example.invalid"];
    expect(() => validarManifestoEmpresasHistoricas(m)).toThrow("CORRECAO_DOMINIO_INVALIDO");
    for (const d of ["gmail.com", "uol.com.br", "bol.com.br", "terra.com.br", "ig.com.br"]) {
      m.empresas[0].dominiosCorporativos = [d];
      expect(() => validarManifestoEmpresasHistoricas(m)).toThrow("CORRECAO_DOMINIO_PESSOAL");
    }
  });
  it("não permite vínculo/empresa repetidos ou número negativo/inexistente", () => {
    const m = manifestoSintetico(); m.vinculos[0].numerosOriginais = ["-1"];
    expect(() => validarManifestoEmpresasHistoricas(m)).toThrow("CORRECAO_NUMEROS_INVALIDOS");
    m.vinculos[0].numerosOriginais = ["10001"]; m.empresas.push(structuredClone(m.empresas[0]));
    expect(() => validarManifestoEmpresasHistoricas(m)).toThrow("CORRECAO_EMPRESA_REPETIDA");
  });
});
