import { prisma } from "@/lib/prisma";
import { obterCnpjConsulta } from "@/lib/sefaz/certificado";
import { TAMANHO_MAXIMO_XML, validarXmlImportado } from "@/lib/sefaz/validar-importacao";

export async function importarXmlAvulso(formulario: FormData): Promise<{ mensagem: string } | { erro: string }> {
  const arquivo = formulario.get("arquivo");
  if (!(arquivo instanceof File) || !arquivo.size || arquivo.size > TAMANHO_MAXIMO_XML) {
    return { erro: "Selecione um XML de até 800 KB." };
  }

  try {
    const xml = await arquivo.text();
    const dados = validarXmlImportado(xml, null, await obterCnpjConsulta());
    const documento = {
      xml,
      tipo: "PROC_NFE" as const,
      fornecedorCnpj: dados.fornecedorCnpj,
      fornecedorNome: dados.fornecedorNome,
      valorTotal: dados.valorTotal,
      dataEmissao: dados.dataEmissao,
    };
    const mensagem = await prisma.$transaction(async (transacao) => {
      // NSU vazio indica importação manual. O cursor de distribuição nunca é alterado.
      const criacao = await transacao.notaFiscalRecebida.createMany({
        data: [{ ...documento, chaveAcesso: dados.chaveAcesso, nsu: "" }],
        skipDuplicates: true,
      });
      if (criacao.count) return "Nota importada. Abra Ver nota para conferir os itens e decidir o aceite.";
      const atualizacao = await transacao.notaFiscalRecebida.updateMany({
        where: { chaveAcesso: dados.chaveAcesso, xml: null },
        data: documento,
      });
      return atualizacao.count
        ? "XML adicionado à nota já existente."
        : "Esta nota já tem XML completo. Nenhum dado foi substituído.";
    });
    return { mensagem };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível importar o XML." };
  }
}

export async function importarXmlNaNota(
  notaFiscalId: string,
  formulario: FormData
): Promise<{ ok: true } | { erro: string }> {
  const arquivo = formulario.get("arquivo");
  if (!(arquivo instanceof File) || !arquivo.size || arquivo.size > TAMANHO_MAXIMO_XML) {
    return { erro: "Selecione um XML de até 800 KB." };
  }

  try {
    const nota = await prisma.notaFiscalRecebida.findUnique({ where: { id: notaFiscalId } });
    if (!nota) return { erro: "Nota fiscal não encontrada." };
    if (nota.xml) return { erro: "Esta nota já tem XML completo. Reabra o painel para visualizar." };
    const xml = await arquivo.text();
    const dados = validarXmlImportado(xml, nota.chaveAcesso, await obterCnpjConsulta());
    // Condição atômica: uma sincronização/importação concorrente não sobrescreve o documento.
    const gravacao = await prisma.notaFiscalRecebida.updateMany({
      where: { id: notaFiscalId, xml: null },
      data: {
        xml,
        tipo: "PROC_NFE",
        fornecedorCnpj: dados.fornecedorCnpj,
        fornecedorNome: dados.fornecedorNome,
        valorTotal: dados.valorTotal,
        dataEmissao: dados.dataEmissao,
      },
    });
    if (!gravacao.count) return { erro: "O XML já foi atualizado. Reabra o painel para visualizar." };
    return { ok: true };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível importar o XML." };
  }
}
