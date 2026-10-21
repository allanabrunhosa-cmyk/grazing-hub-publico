import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const canais = ["WhatsApp", "Telefone", "E-mail", "Site do fornecedor", "Representante"];
const formasPagamento = ["Dinheiro", "Pix", "Boleto", "Transferência", "Cartão de crédito", "Cartão de débito", "Cheque"];

for (const nome of canais) {
  await prisma.canalPedido.upsert({ where: { nome }, update: {}, create: { nome } });
}
for (const nome of formasPagamento) {
  await prisma.formaPagamento.upsert({ where: { nome }, update: {}, create: { nome } });
}

console.log(`Canais: ${canais.length}, Formas de pagamento: ${formasPagamento.length}`);
await prisma.$disconnect();
