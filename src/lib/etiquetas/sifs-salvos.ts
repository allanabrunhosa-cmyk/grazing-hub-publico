import "server-only";
import { prisma } from "@/lib/prisma";
import { chaveMarcaEtiqueta } from "./validacao";

export async function consultarSifsSalvos(lojaId: string, insumoId: string) {
  // O histórico preserva as emissões. Leia só o último SIF preenchido de cada grafia.
  const registros = await prisma.$queryRaw<{ marca: string; sif: string }[]>`
    SELECT "marcaFornecedor" AS marca, sif
    FROM (
      SELECT DISTINCT ON (trabalho."marcaFornecedor")
        trabalho."marcaFornecedor", trabalho.sif, trabalho."createdAt", trabalho.id
      FROM "TrabalhoEtiqueta" trabalho
      JOIN "Insumo" insumo ON insumo.id = trabalho."insumoId"
      WHERE trabalho."lojaId" = ${lojaId}
        AND trabalho."insumoId" = ${insumoId}
        AND insumo.ativo AND insumo."etiquetaHabilitada"
        AND trabalho."marcaFornecedor" IS NOT NULL AND trabalho.sif ~ '^[0-9]{1,30}$'
        AND NOT EXISTS (
          SELECT 1 FROM "EventoAuditoriaEtiqueta" evento
          WHERE evento.entidade = 'TrabalhoEtiqueta' AND evento."entidadeId" = trabalho.id
            AND evento.acao = 'PREPARADO' AND evento.detalhes->>'sifRecuperado' = 'true'
        )
      ORDER BY trabalho."marcaFornecedor", trabalho."createdAt" DESC, trabalho.id DESC
    ) AS ultimos
    ORDER BY "createdAt" DESC, id DESC
  `;

  const sifs = new Map<string, string>();
  for (const { marca, sif } of registros) {
    const chave = chaveMarcaEtiqueta(marca);
    if (chave && !sifs.has(chave)) sifs.set(chave, sif);
  }
  return sifs;
}
