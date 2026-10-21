export function situacaoNfse(nota: { status: string; lancada: boolean }) {
  if (nota.status === "IGNORADA") return "RECUSADA";
  if (nota.lancada || nota.status === "LANCADA") return "ACEITA";
  return nota.status;
}

export function correspondeFiltroNfse(
  nota: { status: string; lancada: boolean; prestadorNome: string | null; prestadorCnpj: string | null; chaveAcesso: string | null; numero: string | null; dataEmissao: string | null },
  filtro: { situacao: string; busca: string; de: string; ate: string },
) {
  if (filtro.situacao !== "TODAS" && situacaoNfse(nota) !== filtro.situacao) return false;
  const dia = nota.dataEmissao?.slice(0, 10);
  if ((filtro.de && (!dia || dia < filtro.de)) || (filtro.ate && (!dia || dia > filtro.ate))) return false;
  const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const consulta = normalizar(filtro.busca.trim());
  if (!consulta) return true;
  const texto = normalizar([nota.prestadorNome, nota.prestadorCnpj, nota.chaveAcesso, nota.numero].filter(Boolean).join(" "));
  const documento = consulta.replace(/\D/g, "");
  return texto.includes(consulta) || (/^[\d./\s-]+$/.test(consulta) && Boolean(documento) && Boolean(nota.prestadorCnpj?.includes(documento)));
}
