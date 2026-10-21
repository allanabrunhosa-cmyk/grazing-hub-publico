import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ErroCadastroVenda, objeto, texto, type ClienteEntrada } from "./dominio";
import { normalizarEmailCliente } from "./cliente-identificadores";
import type { ConflitosIdentidadeCliente } from "./cliente-identidade-consulta";

type Banco = Pick<Prisma.TransactionClient, "$queryRaw" | "clienteVenda">;

/** Fontes externas conservam o ID de origem; novas operações usam a raiz vigente. */
export async function resolverClienteCanonico(tx: Pick<Banco, "clienteVenda">, clienteId: string): Promise<string | null> {
  const visitados = new Set<string>();
  let id = clienteId;
  while (!visitados.has(id) && visitados.size < 100) {
    visitados.add(id);
    const cliente = await tx.clienteVenda.findUnique({ where: { id }, select: { id: true, unificadoEmId: true } });
    if (!cliente) return null;
    if (!cliente.unificadoEmId) return cliente.id;
    id = cliente.unificadoEmId;
  }
  throw new ErroCadastroVenda("O vínculo do cliente precisa de revisão. Reabra o cadastro.");
}

async function conflitosIdentidadeCliente(tx: Banco, cliente: Pick<ClienteEntrada, "id" | "email" | "documento">) {
  const email = normalizarEmailCliente(cliente.email), documento = cliente.documento || null;
  if (!email && !documento) return [];
  const encontrados = await tx.$queryRaw<{ id: string; unificadoEmId: string | null; emailIgual: boolean; documentoIgual: boolean; documentoColunaIgual: boolean }[]>`
    SELECT id, "unificadoEmId", lower(btrim(email)) = ${email}::text AS "emailIgual",
      regexp_replace(COALESCE(NULLIF(documento, ''), CASE WHEN enderecos->0->>'tipo' = tipo THEN enderecos->0->>'documento' END, ''), '[^0-9]', '', 'g') = ${documento}::text AS "documentoIgual",
      documento = ${documento}::text AS "documentoColunaIgual"
    FROM "ClienteVenda"
    WHERE id <> ${cliente.id || ""} AND (
      (${email}::text IS NOT NULL AND lower(btrim(email)) = ${email}::text)
      OR (${documento}::text IS NOT NULL AND regexp_replace(COALESCE(NULLIF(documento, ''), CASE WHEN enderecos->0->>'tipo' = tipo THEN enderecos->0->>'documento' END, ''), '[^0-9]', '', 'g') = ${documento}::text)
    )`;
  const conflitos = [];
  for (const origem of encontrados) {
    const raiz = origem.unificadoEmId ? await resolverClienteCanonico(tx, origem.unificadoEmId) : origem.id;
    if (raiz !== cliente.id || origem.documentoColunaIgual) conflitos.push({ ...origem, raiz });
  }
  return conflitos;
}

/** Consulta de leitura mínima; não reserva identificadores nem substitui a conferência ao salvar. */
export async function consultarConflitosIdentidadeCliente(tx: Banco, entrada: unknown): Promise<ConflitosIdentidadeCliente> {
  const dados = objeto(entrada), id = texto(dados.clienteId, "Cliente", 160);
  const email = normalizarEmailCliente(texto(dados.email, "E-mail", 254));
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroCadastroVenda("Informe um e-mail válido.");
  const informado = texto(dados.documento, "CPF/CNPJ", 30);
  const documento = informado.replace(/[.\-/\s]/g, "") || null;
  if (documento && (!/^\d+$/.test(documento) || documento.length !== (dados.tipo === "PF" ? 11 : dados.tipo === "PJ" ? 14 : 0))) throw new ErroCadastroVenda("Informe um CPF ou CNPJ completo.");
  const conflitos = await conflitosIdentidadeCliente(tx, { id, email, documento });
  return { email: conflitos.some(c => c.emailIgual && c.raiz !== id), documento: conflitos.some(c => c.documentoIgual || c.documentoColunaIgual) };
}

/** Mensagem antecipada; índices e triggers preservam a garantia sob concorrência. */
export async function conferirIdentidadeCliente(tx: Banco, cliente: ClienteEntrada) {
  const conflitos = await conflitosIdentidadeCliente(tx, cliente);
  if (!conflitos.length) return;
  if (new Set(conflitos.map(c => c.raiz)).size > 1) throw new ErroCadastroVenda("O e-mail e o CPF/CNPJ pertencem a cadastros diferentes. Busque os cadastros existentes e confira os dados.");
  if (conflitos.every(c => c.raiz === cliente.id)) throw new ErroCadastroVenda("Este CPF/CNPJ está preservado em um cadastro unificado. Use o titular de cobrança correspondente.");
  if (conflitos.some(c => c.emailIgual)) throw new ErroCadastroVenda("Já existe um cliente com este e-mail. Busque e selecione o cadastro existente.");
  throw new ErroCadastroVenda("Já existe um cliente com este CPF/CNPJ. Busque e selecione o cadastro existente.");
}
