import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
const url = new URL(process.env.DATABASE_URL ?? "http://invalido");
if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/design_system_teste" || url.username !== "design_teste") throw new Error("Destino não autorizado.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
try {
  const admin = await prisma.usuario.findUniqueOrThrow({ where: { id: "design-demo-admin" } });
  if (admin.email !== "design@example.invalid") throw new Error("Marcador sintético ausente.");
  // Reexecução preserva o que foi editado no navegador; não restaura dados.
  await prisma.fornecedor.upsert({ where: { id: "design-demo-fornecedor" }, create: { id: "design-demo-fornecedor", nome: "FORNECEDOR SINTÉTICO", razaoSocial: "EMPRESA FICTÍCIA DE TESTES" }, update: {} });
  await prisma.fornecedor.upsert({ where: { id: "design-demo-beneficiario" }, create: { id: "design-demo-beneficiario", nome: "BENEFICIÁRIO SINTÉTICO", tipoCadastro: "BENEFICIARIO" }, update: {} });
  await prisma.insumo.upsert({ where: { id: "design-demo-insumo" }, create: { id: "design-demo-insumo", nome: "Queijo sintético", unidade: "KG", custoMedio: 20 }, update: {} });
  await prisma.insumo.upsert({ where: { id: "design-demo-preparacao" }, create: { id: "design-demo-preparacao", nome: "Preparação sintética", tipo: "PRODUTO_INTERMEDIARIO", unidade: "KG", rendimentoQuantidade: 1, rendimentoUnidade: "KG" }, update: {} });
  console.log("Fixtures adicionais disponíveis somente no banco descartável.");
  await prisma.clienteVenda.upsert({ where: { id: "design-demo-cliente" }, create: { id: "design-demo-cliente", nome: "CLIENTE FICTÍCIO", enderecos: [] }, update: {} });
  await prisma.grupoFiscalVenda.upsert({ where: { id: "design-demo-fiscal" }, create: { id: "design-demo-fiscal", nome: "FISCAL FICTÍCIO", fiscal: {} }, update: {} });
  await prisma.formaPagamentoVenda.upsert({ where: { id: "design-demo-pagamento" }, create: { id: "design-demo-pagamento", nome: "PIX FICTÍCIO", tipo: "PIX" }, update: {} });
} finally { await prisma.$disconnect(); }
