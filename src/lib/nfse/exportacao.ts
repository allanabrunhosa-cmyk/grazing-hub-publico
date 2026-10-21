import JSZip from "jszip";

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

export async function compactarXmlsNfse(notas: { id: string; numero: string | null; xml: string }[]) {
  if (notas.reduce((total, nota) => total + Buffer.byteLength(nota.xml), 0) > 30 * 1024 * 1024) throw new Error("Selecione um período menor para exportar até 30 MB por vez.");
  const zip = new JSZip();
  for (const nota of notas) zip.file(nomeArquivoNfse(nota), nota.xml);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
