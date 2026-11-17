import { describe, expect, it } from "vitest";
import { disposicaoArquivo, nomeArquivoGrazing, nomeArquivoGrazingDeOriginal, nomeDaDisposicao, numeroNoNome } from "@/lib/nome-arquivo";
import { nomeArquivoZpl } from "@/lib/etiquetas/zpl";
import { nomeDownloadNfse, nomeDownloadZipNfse } from "@/lib/nfse/exportacao";

describe("nomes dos arquivos baixados", () => {
  it("começa por Grazing e pelo tema, com o número do documento", () => {
    expect(nomeArquivoGrazing("NF saída", "pdf", numeroNoNome("000001234"))).toBe("Grazing - NF saída #1234.pdf");
    expect(nomeArquivoGrazing("NF saída", "xml", `${numeroNoNome("77")} cancelamento`)).toBe("Grazing - NF saída #77 cancelamento.xml");
    expect(nomeArquivoGrazing("NF saída", "xml", numeroNoNome(null))).toBe("Grazing - NF saída.xml");
    expect(nomeArquivoGrazing("BI de vendas", "CSV")).toBe("Grazing - BI de vendas.csv");
  });

  it("remove caracteres inválidos em nomes de arquivo e quebras de cabeçalho", () => {
    const nome = nomeArquivoGrazing('NF "a/b"\r\nX-Teste: sim', "xml", "c:\\d*?<>|");
    expect(nome).toBe("Grazing - NF a b X-Teste sim c d.xml");
    expect(numeroNoNome('1"\r\n2')).toBe("#12");
    expect(numeroNoNome("000")).toBe("#0");
  });

  it("preserva o nome original de arquivos enviados, sem duplicar o prefixo", () => {
    expect(nomeArquivoGrazingDeOriginal("Fatura cartão", "fatura outubro.CSV")).toBe("Grazing - Fatura cartão - fatura outubro.csv");
    expect(nomeArquivoGrazingDeOriginal("Fatura cartão", "Grazing - Fatura cartão - fatura.pdf")).toBe("Grazing - Fatura cartão - fatura.pdf");
    expect(nomeArquivoGrazingDeOriginal("Fatura cartão", "sem-extensao")).toBe("Grazing - Fatura cartão - sem-extensao");
  });

  it("envia o nome acentuado e uma alternativa ASCII no cabeçalho", () => {
    const cabecalho = disposicaoArquivo("Grazing - NF saída #1234.pdf", "inline");
    expect(cabecalho).toBe(`inline; filename="Grazing - NF saida #1234.pdf"; filename*=UTF-8''Grazing%20-%20NF%20sa%C3%ADda%20%231234.pdf`);
    expect(nomeDaDisposicao(cabecalho)).toBe("Grazing - NF saída #1234.pdf");
    expect(nomeDaDisposicao('attachment; filename="a.xml"')).toBe("a.xml");
    expect(nomeDaDisposicao(null)).toBeNull();
  });

  it("aplica o padrão a NFS-e e etiquetas", () => {
    expect(nomeDownloadNfse({ numero: "42" })).toBe("Grazing - NFS-e #42.xml");
    expect(nomeDownloadNfse({ numero: null })).toBe("Grazing - NFS-e sem número.xml");
    expect(nomeDownloadZipNfse("2026-10-01", "2026-10-31")).toBe("Grazing - NFS-e XMLs 2026-10-01 a 2026-10-31.zip");
    expect(nomeDownloadZipNfse("", "")).toBe("Grazing - NFS-e XMLs todas.zip");
    expect(nomeArquivoZpl("Pão de Queijo", "trabalho-abcdef123456")).toBe("Grazing - Etiqueta Pao de Queijo ef123456.zpl");
  });
});
