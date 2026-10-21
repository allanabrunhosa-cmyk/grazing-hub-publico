import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const centrosCusto = [
  "Insumos — Matéria-prima e alimentos",
  "Embalagens",
  "Descartáveis",
  "Limpeza",
  "Consumíveis / Uso interno",
];

for (const nome of centrosCusto) {
  await prisma.centroCusto.upsert({ where: { nome }, update: {}, create: { nome } });
}

console.log(`Centros de custo: ${centrosCusto.length}`);
await prisma.$disconnect();
