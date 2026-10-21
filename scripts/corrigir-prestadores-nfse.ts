// Por padrão apenas confere. --aplicar grava exclusivamente a identidade do
// prestador das notas visíveis, após validar TODO o lote na mesma transação.
import { prisma } from "../src/lib/prisma";
import { DATA_MINIMA_NFSE_DATE, extrairDadosNfse } from "../src/lib/nfse/parse";
import { Prisma } from "../src/generated/prisma/client";

async function executar() {
  const aplicar = process.argv.includes("--aplicar");
  const cnpj = process.argv.find(arg => arg.startsWith("--cnpj="))?.split("=")[1];
  const esperadas = Number(process.argv.find(arg => arg.startsWith("--esperadas="))?.split("=")[1]);
  if (!cnpj || !/^\d{14}$/.test(cnpj) || !Number.isInteger(esperadas) || esperadas < 1) {
    throw new Error("Informe --cnpj=<CNPJ do tomador> e --esperadas=<quantidade conferida>.");
  }
  const resultado = await prisma.$transaction(async tx => {
    const historico = () => tx.$queryRaw<{ resumo: string | null }[]>`
      SELECT md5(string_agg(row_to_json(n)::text, '' ORDER BY id)) AS resumo
      FROM "NotaFiscalServico" n
      WHERE "dataEmissao" < ${DATA_MINIMA_NFSE_DATE} OR "dataEmissao" IS NULL
    `;
    const antes = await historico();
    const notas = await tx.notaFiscalServico.findMany({
      where: { dataEmissao: { gte: DATA_MINIMA_NFSE_DATE } },
      include: { fornecedor: { select: { cnpj: true, cpf: true } } },
      orderBy: { numero: "asc" },
    });
    if (notas.length !== esperadas) throw new Error("Quantidade de notas mudou; refaça a conferência antes de aplicar.");
    const lote = notas.map(nota => {
      if (!nota.xml) throw new Error(`Nota ${nota.numero}: XML ausente.`);
      const dados = extrairDadosNfse(nota.xml, cnpj);
      if (!dados.prestadorNome || !dados.prestadorCnpj || !dados.prestadorDados
        || dados.prestadorCnpj === cnpj || dados.tomadorCnpj !== cnpj
        || dados.identificador !== nota.identificador
        || dados.prestadorCnpj !== nota.prestadorCnpj
        || !dados.dataEmissao || dados.dataEmissao < DATA_MINIMA_NFSE_DATE) {
        throw new Error(`Nota ${nota.numero}: identidade ou período divergente. Nenhuma alteração foi aplicada.`);
      }
      const documentoFornecedor = (nota.fornecedor?.cnpj || nota.fornecedor?.cpf)?.replace(/\D/g, "");
      if (nota.fornecedor && documentoFornecedor !== dados.prestadorCnpj) {
        throw new Error(`Nota ${nota.numero}: cadastro do fornecedor diverge do prestador. Revisão necessária.`);
      }
      return { nota, dados };
    });
    // Somente após conferir todos os pares nome/documento e os vínculos.
    let alteradas = 0;
    for (const { nota, dados } of lote) {
      if (aplicar) {
        const resultado = await tx.notaFiscalServico.updateMany({
          where: { id: nota.id, xml: nota.xml, prestadorCnpj: dados.prestadorCnpj, dataEmissao: { gte: DATA_MINIMA_NFSE_DATE } },
          data: { prestadorNome: dados.prestadorNome, prestadorDados: dados.prestadorDados as Prisma.InputJsonValue },
        });
        if (resultado.count !== 1) throw new Error("Nota alterada durante a conferência; operação desfeita.");
        alteradas++;
      }
    }
    const depois = await historico();
    if (antes[0].resumo !== depois[0].resumo) throw new Error("Histórico sofreu alteração; operação desfeita.");
    return {
      modo: aplicar ? "aplicado" : "somente conferencia",
      alteradas, historicoPreservado: true,
      notas: lote.map(({ nota, dados }) => ({
        numero: nota.numero, nomeAnterior: nota.prestadorNome,
        nomeXml: dados.prestadorNome, cnpjPrestador: dados.prestadorCnpj,
        cnpjTomador: dados.tomadorCnpj, dadosPrestador: dados.prestadorDados,
      })),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
  console.log(JSON.stringify(resultado, null, 2));
}

executar().catch(erro => { console.error(erro instanceof Error ? erro.message : "Falha na conferência."); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
