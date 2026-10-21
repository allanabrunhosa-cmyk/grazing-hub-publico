"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";


import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dataLancamentoValida } from "@/lib/financeiro/data-lancamento";

export type ResultadoContaBancaria = { erro: string } | { ok: true };

export async function editarSaldoInicialAction(contaId: string, formulario: FormData): Promise<ResultadoContaBancaria> {
  await exigirPermissao("financeiro.saldo", "editar");
  if (typeof contaId !== "string" || !contaId.trim()) return { erro: "Informe uma conta bancária válida." };
  const textoValor = String(formulario.get("saldoInicial") ?? "").trim();
  const data = String(formulario.get("dataSaldoInicial") ?? "");
  if (!/^-?\d{1,12}([.,]\d{1,2})?$/.test(textoValor)) return { erro: "Informe um saldo válido, com até duas casas decimais." };
  const saldoInicial = Number(textoValor.replace(",", "."));
  if (!Number.isFinite(saldoInicial) || Math.abs(saldoInicial) > 999999999999.99) return { erro: "O saldo informado excede o limite permitido." };
  if (!dataLancamentoValida(data)) return { erro: "Informe uma data válida para o saldo inicial." };
  try {
    const resultado = await prisma.contaBancaria.updateMany({
      where: { id: contaId },
      data: { saldoInicial, dataSaldoInicial: new Date(`${data}T00:00:00.000Z`) },
    });
    if (resultado.count !== 1) return { erro: "Conta bancária não encontrada." };
  } catch {
    return { erro: "Não foi possível atualizar o saldo inicial. Tente novamente." };
  }
  revalidatePath("/financeiro/bancario");
  revalidatePath("/financeiro/movimentacoes");
  revalidatePath("/financeiro/fluxo-de-caixa");
  return { ok: true };
}

export async function criarContaBancariaAction(_prevState: unknown, formData: FormData): Promise<ResultadoContaBancaria> {
  await exigirPermissao("financeiro.bancario", "adicionar");
  const nome = String(formData.get("nome") ?? "").trim();
  const saldoInicial = Number.parseFloat(String(formData.get("saldoInicial") ?? "0").replace(",", "."));

  if (!nome) return { erro: "Informe o nome da conta." };
  if (!Number.isFinite(saldoInicial)) return { erro: "Informe o saldo inicial." };

  try {
    await prisma.contaBancaria.create({ data: { nome, saldoInicial } });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { erro: "Já existe uma conta com esse nome." };
    }
    return { erro: "Não foi possível criar a conta." };
  }

  revalidatePath("/financeiro/bancario");
  revalidatePath("/financeiro/movimentacoes");
  return { ok: true };
}

export async function alternarAtivoContaBancariaAction(contaId: string, ativo: boolean): Promise<ResultadoContaBancaria> {
  await exigirPermissao("financeiro.bancario", "editar");
  await prisma.contaBancaria.update({ where: { id: contaId }, data: { ativo } });
  revalidatePath("/financeiro/bancario");
  revalidatePath("/financeiro/movimentacoes");
  return { ok: true };
}
