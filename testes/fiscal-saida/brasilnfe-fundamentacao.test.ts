import { describe, expect, it } from "vitest";
import { conferirFundamentacaoAprovavelBrasilNfe, uriFonteFiscalBrasilNfe, validarFundamentacaoFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/fundamentacao-dominio";
import { ErroRegraFiscalBrasilNfe, hashRegraFiscalBrasilNfe, validarRascunhoRegraFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regras-tributarias-dominio";
import { rascunhoRegraSintetica } from "./brasilnfe-regras-tributarias-fixtures";

function capturarErroValidacao(executar: () => unknown): ErroRegraFiscalBrasilNfe {
  let erro: unknown;
  try { executar(); } catch (capturado) { erro = capturado; }
  // As asserções ficam fora do catch: sua própria falha nunca conta como rejeição do domínio.
  expect(erro).toBeInstanceOf(ErroRegraFiscalBrasilNfe);
  if (!(erro instanceof ErroRegraFiscalBrasilNfe)) throw new Error("A validação deveria rejeitar a entrada com erro de domínio.");
  return erro;
}

describe("Fundamentação fiscal verificável — dados exclusivamente sintéticos", () => {
  it("valida sem mutação e permite proposta incompleta, sem confundi-la com aprovação", () => {
    const r = rascunhoRegraSintetica(), copia = JSON.stringify(r);
    expect(validarRascunhoRegraFiscalBrasilNfe(r)).toEqual(r); expect(JSON.stringify(r)).toBe(copia);
    const f = { ...r.fundamentacaoFiscal, fontes: [], confianca: [], justificativa: "" };
    expect(validarFundamentacaoFiscalBrasilNfe(f)).toEqual(f);
    expect(() => conferirFundamentacaoAprovavelBrasilNfe(f, r.conteudo, r.operacao, "2026-10-11")).toThrow("Complete");
    expect(() => validarRascunhoRegraFiscalBrasilNfe({ ...r, referenciaConfirp: "Falsa aprovação externa" })).toThrow("inválida");
  });
  it.each(["XML_HISTORICO", "SUGESTAO_IA", "EXEMPLO_API"] as const)("fonte %s não fundamenta aprovação sozinha", tipo => {
    const r = rascunhoRegraSintetica(); r.fundamentacaoFiscal.fontes[0].tipo = tipo;
    expect(() => conferirFundamentacaoAprovavelBrasilNfe(r.fundamentacaoFiscal, r.conteudo, r.operacao, "2026-10-11")).toThrow("fonte concreta");
  });
  it.each(["NORMA_OFICIAL", "ORIENTACAO_SEFAZ", "SOLUCAO_RECEITA", "NCM_CLASSIF", "PARECER_ESPECIALIZADO"] as const)("fonte concreta %s pode instruir revisão interna; não exige Confirp", tipo => {
    const r = rascunhoRegraSintetica(); r.fundamentacaoFiscal.fontes[0].tipo = tipo;
    expect(conferirFundamentacaoAprovavelBrasilNfe(r.fundamentacaoFiscal, r.conteudo, r.operacao, "2026-10-11")).toEqual(r.fundamentacaoFiscal);
  });
  it("URL isolada, referência genérica e data futura não confirmam norma aplicada", () => {
    const r = rascunhoRegraSintetica();
    for (const fonte of [{ ...r.fundamentacaoFiscal.fontes[0], referencia: "", uri: "https://www.gov.br/" }, { ...r.fundamentacaoFiscal.fontes[0], trechoAplicavel: "ver lei" }, { ...r.fundamentacaoFiscal.fontes[0], consultadoEm: "2026-10-12" }]) {
      expect(() => conferirFundamentacaoAprovavelBrasilNfe({ ...r.fundamentacaoFiscal, fontes: [fonte] }, r.conteudo, r.operacao, "2026-10-11")).toThrow("fonte concreta");
    }
  });
  it.each(["PENDENTE", "REVISAO_ESPECIALIZADA"] as const)("ambiguidade NCM %s bloqueia somente o perfil que depende dela", estado => {
    const item = rascunhoRegraSintetica(); item.fundamentacaoFiscal.confianca.find(c => c.campo === "NCM")!.estado = estado;
    expect(() => conferirFundamentacaoAprovavelBrasilNfe(item.fundamentacaoFiscal, item.conteudo, item.operacao, "2026-10-11")).toThrow("campo NCM");
    const op = rascunhoRegraSintetica("OPERACAO"); op.fundamentacaoFiscal.confianca = item.fundamentacaoFiscal.confianca;
    expect(conferirFundamentacaoAprovavelBrasilNfe(op.fundamentacaoFiscal, op.conteudo, op.operacao, "2026-10-11")).toEqual(op.fundamentacaoFiscal);
  });
  it("não aplicabilidade é explícita, fundamentada e recusada para campo aplicável", () => {
    const r = rascunhoRegraSintetica(); const c = r.fundamentacaoFiscal.confianca.find(c => c.campo === "CEST")!; c.estado = "NAO_APLICAVEL";
    expect(conferirFundamentacaoAprovavelBrasilNfe(r.fundamentacaoFiscal, r.conteudo, r.operacao, "2026-10-11")).toEqual(r.fundamentacaoFiscal);
    c.fontes = []; expect(() => conferirFundamentacaoAprovavelBrasilNfe(r.fundamentacaoFiscal, r.conteudo, r.operacao, "2026-10-11")).toThrow("fonte concreta");
    c.fontes = ["fonte-sintetica"]; if (r.conteudo.tipo !== "ITEM") throw new Error("Massa inválida"); r.conteudo.perfil.cestAplicavel = true;
    expect(() => conferirFundamentacaoAprovavelBrasilNfe(r.fundamentacaoFiscal, r.conteudo, r.operacao, "2026-10-11")).toThrow("campo aplicável CEST");
  });
  it("regime pretendido não equivale a vigente; CRT e operação precisam corresponder", () => {
    const r = rascunhoRegraSintetica("EMPRESA"); r.fundamentacaoFiscal.contexto.regimeConfirmado = false;
    expect(() => conferirFundamentacaoAprovavelBrasilNfe(r.fundamentacaoFiscal, r.conteudo, r.operacao, "2026-10-11")).toThrow("regime vigente");
    r.fundamentacaoFiscal.contexto.regimeConfirmado = true; r.fundamentacaoFiscal.contexto.regime = "LUCRO_PRESUMIDO";
    expect(() => conferirFundamentacaoAprovavelBrasilNfe(r.fundamentacaoFiscal, r.conteudo, r.operacao, "2026-10-11")).toThrow("CRT");
    expect(() => validarRascunhoRegraFiscalBrasilNfe({ ...r, fundamentacaoFiscal: { ...r.fundamentacaoFiscal, contexto: { ...r.fundamentacaoFiscal.contexto, operacao: "NFC_E_VENDA" } } })).toThrow("inválida");
  });
  it("hash associa fonte, confiança, contexto e justificativa; nenhuma inferência pela ordem do JSON", () => {
    const f = rascunhoRegraSintetica().fundamentacaoFiscal;
    expect(hashRegraFiscalBrasilNfe(f)).toBe(hashRegraFiscalBrasilNfe({ ...f, contexto: { ...f.contexto } }));
    expect(hashRegraFiscalBrasilNfe(f)).not.toBe(hashRegraFiscalBrasilNfe({ ...f, justificativa: "Outra hipótese exclusivamente sintética de decisão." }));
    expect(hashRegraFiscalBrasilNfe(f)).not.toBe(hashRegraFiscalBrasilNfe({ ...f, fontes: [{ ...f.fontes[0], referencia: "Outra norma fictícia" }] }));
  });
  it("parágrafos legítimos são normalizados para LF, mantendo hash canônico e sem modificar entrada", () => {
    const f = rascunhoRegraSintetica().fundamentacaoFiscal;
    const paragrafo = "Primeiro parágrafo exclusivamente sintético.\n\nSegundo parágrafo com limites da hipótese de teste.";
    const comCrLf = { ...f, justificativa: paragrafo.replaceAll("\n", "\r\n") };
    const recebido = validarFundamentacaoFiscalBrasilNfe(comCrLf), comLf = validarFundamentacaoFiscalBrasilNfe({ ...f, justificativa: paragrafo });
    expect(recebido.justificativa).toBe(paragrafo); expect(comCrLf.justificativa).toContain("\r\n");
    expect(hashRegraFiscalBrasilNfe(recebido)).toBe(hashRegraFiscalBrasilNfe(comLf));
    expect(() => conferirFundamentacaoAprovavelBrasilNfe(recebido, rascunhoRegraSintetica().conteudo, f.contexto.operacao, "2026-10-11")).not.toThrow();
  });
  it("recusa listas excessivas, IDs ausentes, repetidos ou inventados", () => {
    const f = rascunhoRegraSintetica().fundamentacaoFiscal;
    for (const errado of [{ ...f, fontes: [...f.fontes, ...f.fontes] }, { ...f, fontes: Array.from({ length: 11 }, (_, i) => ({ ...f.fontes[0], id: `f${i}` })) }, { ...f, confianca: [...f.confianca, f.confianca[0]] }, { ...f, confianca: [{ ...f.confianca[0], fontes: ["inexistente"] }] }]) expect(() => validarFundamentacaoFiscalBrasilNfe(errado)).toThrow("inválida");
  });
  it.each(["javascript:alert(1)", "http://www.gov.br/lei", "https://usuario:senha@www.gov.br/lei", "https://127.0.0.1/lei", "https://localhost/lei", "https://host.local/lei", "https://www.gov.br/lei?Token=refletido", "https://www.gov.br/Token%3Dsegredo", "https://www.gov.br/%3Cscript%3E", "https://www.gov.br/lei#" + "a".repeat(60), "https://www.gov.br/lei%0A"])("URI perigosa rejeitada sem refletir dados: %s", uri => {
    const erro = capturarErroValidacao(() => uriFonteFiscalBrasilNfe(uri));
    expect(erro.message).not.toContain(uri);
  });
  it.each(["https://legislacao.fazenda.sp.gov.br/Paginas/RC34039_2026.aspx", "https://www.gov.br/pt-br/servicos/formalizar-consulta-sobre-classificacao-fiscal-de-mercadorias", "https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/setembro/simples-nacional-2027-entenda-os-novos-prazos-e-faca-sua-escolha-com-consciencia-e-tranquilidade/"])("permite URI oficial específica com slug humano longo: %s", uri => { expect(uriFonteFiscalBrasilNfe(uri)).toBe(uri); });
  it.each(["https://www.gov.br/documento/12345678901", "https://www.gov.br/documento/12345678901234", "https://www.gov.br/documento/123.456.789-01", "https://www.gov.br/documento/12.345.678/0001-00", "https://www.gov.br/documento#12345678901", "https://www.gov.br/documento/%31%32%33%34%35%36%37%38%39%30%31", "https://www.gov.br/documento#12.345.678%2F0001-00"])("URI não conserva identificador pessoal no caminho ou fragmento: %s", uri => {
    const f = rascunhoRegraSintetica().fundamentacaoFiscal;
    const erro = capturarErroValidacao(() => validarFundamentacaoFiscalBrasilNfe({ ...f, fontes: [{ ...f.fontes[0], tipo: "XML_HISTORICO", uri }] }));
    expect(erro.message).not.toContain(uri);
  });
  it.each(["<script>alert(1)</script>", "Token=segredo-sintetico", "UserToken: segredo-sintetico", "CSC=segredo-sintetico", "a".repeat(60), "CPF 12345678901", "CNPJ 12.345.678/0001-00", "dado\u0000invalido", "controle\tinvalido", "controle\rinvalido", "controle\u000binvalido", "controle\u007finvalido", "Token:\nsegredo-sintetico"])("texto inválido recusado sem vazamento: %s", texto => {
    const f = rascunhoRegraSintetica().fundamentacaoFiscal;
    const erro = capturarErroValidacao(() => validarFundamentacaoFiscalBrasilNfe({ ...f, justificativa: texto }));
    expect(erro.message).not.toContain(texto);
  });
});
