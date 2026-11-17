import JSZip from "jszip";
import { nomeArquivoGrazing, numeroNoNome } from "@/lib/nome-arquivo";

export function periodoExportacaoNfse(de: string, ate: string) {
  const lerData = (valor: string) => {
    const data = new Date(valor + "T00:00:00.000Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor) {
      throw new Error("Informe um período válido.");
    }
    return data;
  };
  const inicio = de ? lerData(de) : null;
  const fim = ate ? lerData(ate) : null;
  if (inicio && fim && fim < inicio) throw new Error("A data inicial deve ser anterior ou igual à final.");
  return {
    ...(inicio ? { gte: inicio } : {}),
    ...(fim ? { lt: new Date(fim.getTime() + 86_400_000) } : {}),
  };
}

export function nomeArquivoNfse(nota: { id: string; numero: string | null }) {
  return `nfse-${(nota.numero ?? "sem-numero").replace(/[^a-zA-Z0-9_-]/g, "")}-${nota.id.replace(/[^a-zA-Z0-9_-]/g, "")}.xml`;
}

/** Nome do XML baixado individualmente. Dentro do ZIP segue o nome técnico único acima. */
export function nomeDownloadNfse(nota: { numero: string | null }) {
  return nomeArquivoGrazing("NFS-e", "xml", numeroNoNome(nota.numero) || "sem número");
}

export function nomeDownloadZipNfse(de: string, ate: string) {
  const periodo = de && ate ? `${de} a ${ate}` : de ? `desde ${de}` : ate ? `até ${ate}` : "todas";
  return nomeArquivoGrazing("NFS-e XMLs", "zip", periodo);
}

export async function compactarXmlsNfse(notas: { id: string; numero: string | null; xml: string }[]) {
  if (notas.reduce((total, nota) => total + Buffer.byteLength(nota.xml), 0) > 30 * 1024 * 1024) throw new Error("Selecione um período menor para exportar até 30 MB por vez.");
  const zip = new JSZip();
  for (const nota of notas) zip.file(nomeArquivoNfse(nota), nota.xml);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
