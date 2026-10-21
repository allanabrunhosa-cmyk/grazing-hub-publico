// Importação em lote do catálogo de Fornecedores e Insumos (planilha do usuário).
// Recebe um JSON já normalizado (ver plano/nota no topo do repo) como primeiro
// argumento — gerado uma vez a partir do .xlsx, fora do repo.
//
// Uso: npx tsx scripts/importar-catalogo.mjs caminho/para/catalogo-import.json

import "dotenv/config";
import { readFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const caminhoJson = process.argv[2];
if (!caminhoJson) {
  console.error("Uso: npx tsx scripts/importar-catalogo.mjs <caminho-do-json>");
  process.exit(1);
}

const { fornecedores, insumos } = JSON.parse(readFileSync(caminhoJson, "utf-8"));

const INSUMOS_DE_TESTE = ["Detergente", "Preparação 1", "teste insumo"];

async function main() {
  console.log("=== Removendo insumos de teste ===");
  let removidosCount = 0;
  for (const nome of INSUMOS_DE_TESTE) {
    try {
      const resultado = await prisma.insumo.deleteMany({ where: { nome } });
      if (resultado.count === 0) throw Object.assign(new Error("not found"), { code: "P2025" });
      removidosCount += resultado.count;
      console.log(`  removido: ${nome}`);
    } catch (e) {
      if (e.code === "P2025") {
        console.log(`  (não encontrado, já não existia: ${nome})`);
      } else if (e.code === "P2003") {
        console.log(`  ⚠️  NÃO removido (tem movimentações/saldo de estoque vinculados, não é só teste): ${nome}`);
      } else {
        throw e;
      }
    }
  }
  console.log(`${removidosCount} insumo(s) de teste removido(s).`);

  console.log("\n=== Fornecedores ===");
  const fornecedorIdPorNome = new Map();
  let fornecedoresCriados = 0;
  let fornecedoresAtualizados = 0;

  for (const f of fornecedores) {
    const existente = await prisma.fornecedor.findFirst({
      where: { nome: { equals: f.nome, mode: "insensitive" } },
    });

    const canaisConnect = f.canalPedido
      ? { connectOrCreate: { where: { nome: f.canalPedido }, create: { nome: f.canalPedido } } }
      : undefined;
    const formasConnect = f.formaPagamento
      ? { connectOrCreate: { where: { nome: f.formaPagamento }, create: { nome: f.formaPagamento } } }
      : undefined;

    if (existente) {
      await prisma.fornecedor.update({
        where: { id: existente.id },
        data: {
          contatoNome: existente.contatoNome ?? f.contatoNome,
          telefone: existente.telefone ?? f.telefone,
          email: existente.email ?? f.email,
          site: existente.site ?? f.site,
          prazoPagamentoDias: existente.prazoPagamentoDias ?? f.prazoPagamentoDias,
          prazoEntregaDias: existente.prazoEntregaDias ?? f.prazoEntregaDias,
          observacoes: existente.observacoes ?? f.observacoes,
          ...(canaisConnect ? { canaisPedido: canaisConnect } : {}),
          ...(formasConnect ? { formasPagamento: formasConnect } : {}),
        },
      });
      fornecedorIdPorNome.set(f.nome.toLowerCase(), existente.id);
      fornecedoresAtualizados++;
    } else {
      const criado = await prisma.fornecedor.create({
        data: {
          nome: f.nome,
          contatoNome: f.contatoNome,
          telefone: f.telefone,
          email: f.email,
          site: f.site,
          prazoPagamentoDias: f.prazoPagamentoDias,
          prazoEntregaDias: f.prazoEntregaDias,
          observacoes: f.observacoes,
          ativo: f.ativo,
          ...(canaisConnect ? { canaisPedido: canaisConnect } : {}),
          ...(formasConnect ? { formasPagamento: formasConnect } : {}),
        },
      });
      fornecedorIdPorNome.set(f.nome.toLowerCase(), criado.id);
      fornecedoresCriados++;
    }
  }
  console.log(`Criados: ${fornecedoresCriados} | Atualizados (já existiam): ${fornecedoresAtualizados}`);

  console.log("\n=== Categorias ===");
  const categoriasDistintas = [...new Set(insumos.map((i) => i.categoria).filter(Boolean))];
  const categoriaIdPorNome = new Map();
  for (const nome of categoriasDistintas) {
    const cat = await prisma.categoria.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
    categoriaIdPorNome.set(nome, cat.id);
  }
  const antes = await prisma.categoria.count();
  console.log(`${categoriasDistintas.length} categoria(s) processada(s) (total no banco: ${antes}).`);

  console.log("\n=== Insumos ===");
  let insumosCriados = 0;
  const semFornecedorEncontrado = [];

  for (const i of insumos) {
    const fornecedorPrincipalId = i.fornecedorPrincipal
      ? (fornecedorIdPorNome.get(i.fornecedorPrincipal.toLowerCase()) ?? null)
      : null;

    const criado = await prisma.insumo.create({
      data: {
        nome: i.nome,
        marca: i.marca,
        categoriaId: i.categoria ? categoriaIdPorNome.get(i.categoria) : null,
        tipoEstoque: i.tipoEstoque,
        unidade: i.unidade,
        estoqueMinimo: i.estoqueMinimo,
        estoqueMaximo: i.estoqueMaximo,
        ativo: i.ativo,
        observacoes: i.observacoes,
        fornecedorPrincipalId,
      },
    });

    for (const nomeFornecedor of i.fornecedoresHomologados) {
      const fornecedorId = fornecedorIdPorNome.get(nomeFornecedor.toLowerCase());
      if (!fornecedorId) {
        semFornecedorEncontrado.push(`${i.nome} → ${nomeFornecedor}`);
        continue;
      }
      await prisma.insumoFornecedor.create({
        data: { insumoId: criado.id, fornecedorId },
      });
    }

    insumosCriados++;
  }

  console.log(`Insumos criados: ${insumosCriados}`);
  if (semFornecedorEncontrado.length > 0) {
    console.log(`\n⚠️  Vínculos não resolvidos (fornecedor não encontrado pelo nome):`);
    semFornecedorEncontrado.forEach((l) => console.log(`  - ${l}`));
  }

  console.log("\n=== Resumo final ===");
  console.log("Fornecedores no banco:", await prisma.fornecedor.count());
  console.log("Insumos no banco:", await prisma.insumo.count());
  console.log("Categorias no banco:", await prisma.categoria.count());
  console.log("Vínculos InsumoFornecedor:", await prisma.insumoFornecedor.count());
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
