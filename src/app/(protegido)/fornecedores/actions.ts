"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";


import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { paraCaixaAlta, paraCaixaAltaOpcional } from "@/lib/caixa-alta";
import { documentoValidoOuVazio, somenteDigitos } from "@/lib/documento-brasileiro";
import { registrarAtividade } from "@/lib/atividades/registro";

export type FormState = {
  error: string | null;
  fornecedor?: { id: string; nome: string };
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function optionalString(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();
  return value === "" ? null : value;
}

function optionalInt(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();
  if (value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function saveFornecedorAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const sessao = await exigirPermissao("fornecedores", String(formData.get("id") ?? "").trim() ? "editar" : "adicionar");
  const id = String(formData.get("id") ?? "").trim();
  const nome = paraCaixaAlta(String(formData.get("nome") ?? ""));
  const razaoSocial = paraCaixaAltaOpcional(String(formData.get("razaoSocial") ?? ""));
  const cnpjInput = onlyDigits(String(formData.get("cnpj") ?? ""));

  if (!nome) {
    return { error: "Preencha o nome." };
  }
  if (cnpjInput && cnpjInput.length !== 14) {
    return { error: "CNPJ inválido — precisa ter 14 números." };
  }

  const cnpj = cnpjInput || null;

  const canaisPedidoIds = formData.getAll("canaisPedido").map(String);
  const formasPagamentoIds = formData.getAll("formasPagamento").map(String);

  const camposComuns = {
    nome,
    razaoSocial,
    cnpj,
    email: optionalString(formData, "email"),
    site: optionalString(formData, "site"),
    contatoNome: optionalString(formData, "contatoNome"),
    telefone: optionalString(formData, "telefone"),
    prazoPagamentoDias: optionalInt(formData, "prazoPagamentoDias"),
    prazoEntregaDias: optionalInt(formData, "prazoEntregaDias"),
    observacoes: optionalString(formData, "observacoes"),
    ativo: formData.get("ativo") === "on",
  };

  let fornecedorSalvo: { id: string; nome: string };
  try {
    fornecedorSalvo = await prisma.$transaction(async tx => {
      if (id) await tx.$queryRaw`SELECT "id" FROM "Fornecedor" WHERE "id" = ${id} FOR UPDATE`;
      const existente = id ? await tx.fornecedor.findFirst({ where: { id, tipoCadastro: "FORNECEDOR" }, select: { id: true, ativo: true } }) : null;
      if (id && !existente) throw new Error("FORNECEDOR_NAO_ENCONTRADO");
      const salvo = id ? await tx.fornecedor.update({
        where: { id },
        data: {
          ...camposComuns,
          canaisPedido: { set: canaisPedidoIds.map((id) => ({ id })) },
          formasPagamento: { set: formasPagamentoIds.map((id) => ({ id })) },
        },
        select: { id: true, nome: true },
      }) : await tx.fornecedor.create({
        data: {
          ...camposComuns,
          tipoCadastro: "FORNECEDOR",
          canaisPedido: { connect: canaisPedidoIds.map((id) => ({ id })) },
          formasPagamento: { connect: formasPagamentoIds.map((id) => ({ id })) },
        },
        select: { id: true, nome: true },
      });
      await registrarAtividade(tx, sessao, { modulo: "cadastros", recurso: "fornecedores", acao: id ? "FORNECEDOR_EDITADO" : "FORNECEDOR_CRIADO",
        entidade: "Fornecedor", entidadeId: salvo.id, resumo: id ? "Fornecedor alterado." : "Fornecedor criado.",
        ...(existente && existente.ativo !== camposComuns.ativo ? { antes: { ativo: existente.ativo }, depois: { ativo: camposComuns.ativo } } : !id ? { depois: { ativo: camposComuns.ativo, tipo: "FORNECEDOR" } } : {}) });
      return salvo;
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "FORNECEDOR_NAO_ENCONTRADO") return { error: "Fornecedor não encontrado. Atualize a página." };
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { error: "Já existe um fornecedor cadastrado com esse CNPJ." };
    }
    return { error: "Não foi possível salvar o fornecedor. Tente novamente." };
  }

  revalidatePath("/fornecedores");
  revalidatePath("/compras");
  revalidatePath("/inventario", "layout");
  revalidatePath("/notas-fiscais");
  return { error: null, fornecedor: fornecedorSalvo };
}

export async function salvarBeneficiarioAction(
  formData: FormData
): Promise<{ ok: true; beneficiario: { id: string; nome: string; formaPagamentoId: string | null } } | { erro: string }> {
  const sessao = await exigirPermissao("fornecedores", String(formData.get("id") ?? "").trim() ? "editar" : "adicionar");
  const id = String(formData.get("id") ?? "").trim();

  const nome = paraCaixaAlta(String(formData.get("nome") ?? ""));
  const documento = somenteDigitos(String(formData.get("documento") ?? ""));
  const formaPagamentoId = String(formData.get("formaPagamentoId") ?? "").trim() || null;
  if (!nome) return { erro: "Preencha o nome." };
  if (!documentoValidoOuVazio(documento)) {
    return { erro: "Informe um CPF com 11 números ou um CNPJ com 14 números." };
  }

  const dados = {
    tipoCadastro: "BENEFICIARIO" as const,
    nome,
    cpf: documento.length === 11 ? documento : null,
    cnpj: documento.length === 14 ? documento : null,
    telefone: optionalString(formData, "telefone"),
    ativo: formData.get("ativo") === "on",
  };

  let beneficiarioSalvo: { id: string; nome: string };
  try {
    beneficiarioSalvo = await prisma.$transaction(async tx => {
      if (id) await tx.$queryRaw`SELECT "id" FROM "Fornecedor" WHERE "id" = ${id} FOR UPDATE`;
      const existente = id ? await tx.fornecedor.findFirst({
        where: { id, tipoCadastro: "BENEFICIARIO" },
        select: { id: true, ativo: true },
      }) : null;
      if (id && !existente) throw new Error("BENEFICIARIO_NAO_ENCONTRADO");
      const salvo = id ? await tx.fornecedor.update({
        where: { id },
        data: {
          ...dados,
          formasPagamento: { set: formaPagamentoId ? [{ id: formaPagamentoId }] : [] },
        },
        select: { id: true, nome: true },
      }) : await tx.fornecedor.create({
        data: {
          ...dados,
          formasPagamento: formaPagamentoId ? { connect: { id: formaPagamentoId } } : undefined,
        },
        select: { id: true, nome: true },
      });
      await registrarAtividade(tx, sessao, { modulo: "cadastros", recurso: "fornecedores", acao: id ? "BENEFICIARIO_EDITADO" : "BENEFICIARIO_CRIADO",
        entidade: "Fornecedor", entidadeId: salvo.id, resumo: id ? "Beneficiário alterado." : "Beneficiário criado.",
        ...(existente && existente.ativo !== dados.ativo ? { antes: { ativo: existente.ativo }, depois: { ativo: dados.ativo } } : !id ? { depois: { ativo: dados.ativo, tipo: "BENEFICIARIO" } } : {}) });
      return salvo;
    });
  } catch (erro: unknown) {
    if (erro instanceof Error && erro.message === "BENEFICIARIO_NAO_ENCONTRADO") return { erro: "Beneficiário não encontrado. Atualize a página." };
    if (typeof erro === "object" && erro !== null && "code" in erro && erro.code === "P2002") {
      return { erro: "Já existe um cadastro com esse CPF ou CNPJ." };
    }
    return { erro: "Não foi possível salvar o beneficiário. Tente novamente." };
  }

  revalidatePath("/fornecedores");
  revalidatePath("/financeiro", "layout");
  return { ok: true, beneficiario: { ...beneficiarioSalvo, formaPagamentoId } };
}

export async function excluirBeneficiarioAction(id: string): Promise<{ ok: true } | { erro: string }> {
  const sessao = await exigirPermissao("fornecedores", "excluir");
  if (!id.trim()) return { erro: "Beneficiário inválido." };
  try {
    const resultado = await prisma.$transaction(async tx => {
      const removidos = await tx.fornecedor.deleteMany({ where: { id, tipoCadastro: "BENEFICIARIO" } });
      if (removidos.count === 1) await registrarAtividade(tx, sessao, { modulo: "cadastros", recurso: "fornecedores", acao: "BENEFICIARIO_EXCLUIDO",
        entidade: "Fornecedor", entidadeId: id, resumo: "Beneficiário excluído.", depois: { status: "EXCLUIDO" } });
      return removidos;
    });
    if (resultado.count !== 1) return { erro: "Beneficiário não encontrado. Atualize a página." };
  } catch {
    return { erro: "Não foi possível excluir. Verifique se não há lançamentos ligados a este beneficiário." };
  }
  revalidatePath("/fornecedores");
  revalidatePath("/financeiro", "layout");
  return { ok: true };
}

export async function deleteFornecedorAction(id: string) {
  const sessao = await exigirPermissao("fornecedores", "excluir");
  const resultado = await prisma.$transaction(async tx => {
    const removidos = await tx.fornecedor.deleteMany({ where: { id, tipoCadastro: "FORNECEDOR" } });
    if (removidos.count === 1) await registrarAtividade(tx, sessao, { modulo: "cadastros", recurso: "fornecedores", acao: "FORNECEDOR_EXCLUIDO",
      entidade: "Fornecedor", entidadeId: id, resumo: "Fornecedor excluído.", depois: { status: "EXCLUIDO" } });
    return removidos;
  });
  if (resultado.count !== 1) throw new Error("Fornecedor não encontrado.");
  revalidatePath("/fornecedores");
}

export async function createCanalPedidoAction(nomeInput: string) {
  await exigirPermissao("fornecedores", "adicionar");
  const nome = nomeInput.trim();
  if (!nome) throw new Error("Informe um nome para o canal.");
  const canal = await prisma.canalPedido.upsert({ where: { nome }, update: {}, create: { nome } });
  revalidatePath("/fornecedores");
  return canal;
}

export async function createFormaPagamentoAction(nomeInput: string) {
  await exigirPermissao("fornecedores", "adicionar");
  const nome = nomeInput.trim();
  if (!nome) throw new Error("Informe um nome para a forma de pagamento.");
  const forma = await prisma.formaPagamento.upsert({ where: { nome }, update: {}, create: { nome } });
  revalidatePath("/fornecedores");
  return forma;
}

export type ImportFornecedorRow = {
  nome?: string;
  razaoSocial?: string;
  cnpj?: string;
  email?: string;
  site?: string;
  contatoNome?: string;
  telefone?: string;
  canaisPedido?: string;
  formasPagamento?: string;
  prazoPagamentoDias?: string;
  prazoEntregaDias?: string;
  status?: string;
  observacoes?: string;
};

export type ImportSummary = {
  criados: number;
  atualizados: number;
  erros: { linha: number; mensagem: string }[];
};

function splitMultiValor(value: string | undefined) {
  return (value ?? "")
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseIntOrNull(value: string | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function importFornecedoresAction(rows: ImportFornecedorRow[]): Promise<ImportSummary> {
  const sessao = await exigirPermissao("fornecedores", "adicionar");
  await exigirPermissao("fornecedores", "editar");
  const summary: ImportSummary = { criados: 0, atualizados: 0, erros: [] };

  for (let i = 0; i < rows.length; i++) {
    const linha = i + 2; // +1 pelo cabeçalho, +1 porque a lista é 0-indexed
    const row = rows[i];
    const nome = paraCaixaAlta(row.nome ?? "");
    const razaoSocial = paraCaixaAlta(row.razaoSocial ?? "");
    const cnpj = onlyDigits(row.cnpj ?? "");

    if (!nome || !razaoSocial) {
      summary.erros.push({ linha, mensagem: "Nome e razão social são obrigatórios." });
      continue;
    }
    if (cnpj.length !== 14) {
      summary.erros.push({ linha, mensagem: "CNPJ inválido — precisa ter 14 números." });
      continue;
    }

    const canais = splitMultiValor(row.canaisPedido);
    const formas = splitMultiValor(row.formasPagamento);
    const statusTexto = (row.status ?? "").trim().toLowerCase();

    try {
      const existente = await prisma.fornecedor.findUnique({ where: { cnpj } });
      if (existente?.tipoCadastro === "BENEFICIARIO") {
        summary.erros.push({ linha, mensagem: "Este CNPJ já pertence a um beneficiário. Exclua ou ajuste esse cadastro antes de importar." });
        continue;
      }

      const camposComuns = {
        nome,
        razaoSocial,
        cnpj,
        email: row.email?.trim() || null,
        site: row.site?.trim() || null,
        contatoNome: row.contatoNome?.trim() || null,
        telefone: row.telefone?.trim() || null,
        prazoPagamentoDias: parseIntOrNull(row.prazoPagamentoDias),
        prazoEntregaDias: parseIntOrNull(row.prazoEntregaDias),
        observacoes: row.observacoes?.trim() || null,
        ativo: statusTexto === "inativo" ? false : true,
      };
      const canaisConnectOrCreate = canais.map((nome) => ({ where: { nome }, create: { nome } }));
      const formasConnectOrCreate = formas.map((nome) => ({ where: { nome }, create: { nome } }));

      await prisma.$transaction(async tx => {
        if (existente) await tx.$queryRaw`SELECT "id" FROM "Fornecedor" WHERE "id" = ${existente.id} FOR UPDATE`;
        const anterior = existente ? await tx.fornecedor.findUnique({ where: { id: existente.id }, select: { ativo: true } }) : null;
        const salvo = existente ? await tx.fornecedor.update({
          where: { id: existente.id },
          data: {
            ...camposComuns,
            tipoCadastro: "FORNECEDOR",
            canaisPedido: { set: [], connectOrCreate: canaisConnectOrCreate },
            formasPagamento: { set: [], connectOrCreate: formasConnectOrCreate },
          },
        }) : await tx.fornecedor.create({
          data: {
            ...camposComuns,
            canaisPedido: { connectOrCreate: canaisConnectOrCreate },
            formasPagamento: { connectOrCreate: formasConnectOrCreate },
          },
        });
        await registrarAtividade(tx, sessao, { modulo: "cadastros", recurso: "fornecedores", acao: existente ? "FORNECEDOR_IMPORTADO_EDITADO" : "FORNECEDOR_IMPORTADO_CRIADO",
          entidade: "Fornecedor", entidadeId: salvo.id, resumo: existente ? "Fornecedor atualizado por importação." : "Fornecedor criado por importação.",
          ...(anterior && anterior.ativo !== camposComuns.ativo ? { antes: { ativo: anterior.ativo }, depois: { ativo: camposComuns.ativo } } : !existente ? { depois: { ativo: camposComuns.ativo, tipo: "FORNECEDOR" } } : {}) });
      });
      if (existente) summary.atualizados++; else summary.criados++;
    } catch {
      summary.erros.push({ linha, mensagem: "Não foi possível salvar esta linha." });
    }
  }

  revalidatePath("/fornecedores");
  return summary;
}
