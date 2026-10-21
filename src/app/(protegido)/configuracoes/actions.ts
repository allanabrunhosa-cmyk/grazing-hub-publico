"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";


import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { cifrar, decifrar } from "@/lib/crypto";
import { parsePfx, invalidarCacheCertificado } from "@/lib/sefaz/certificado";
import { consultarCepVenda } from "@/lib/vendas/cep";
import { textoEndereco, enderecoPreciso } from "@/lib/vendas/entregas-dominio";
import { normalizarEnderecoEmpresa } from "@/lib/configuracao-loja-endereco";
import { autorEntregas } from "@/lib/vendas/entregas";
import { historico } from "@/lib/vendas/persistencia";
import { Prisma } from "@/generated/prisma/client";

export async function buscarCepLojaAction(cep: string) {
  await exigirPermissao("configuracoes.loja");
  return consultarCepVenda(cep);
}

async function obterSessaoConfiguracoes() {
  const session = await getSession();
  if (!session) return null;
  return session;
}

export type ResultadoConfiguracao = { erro: string } | { ok: true };

export async function salvarConfiguracaoLojaAction(_prevState: unknown, formData: FormData): Promise<ResultadoConfiguracao> {
  await exigirPermissao("configuracoes.loja", "editar");
  const session = await obterSessaoConfiguracoes();
  if (!session) return { erro: "Apenas administradores podem alterar as configurações da loja." };

  const nome = String(formData.get("nome") ?? "").trim() || null;
  const cnpj = String(formData.get("cnpj") ?? "").trim() || null;
  const endereco = String(formData.get("endereco") ?? "").trim() || null;
  const telefone = String(formData.get("telefone") ?? "").trim() || null;
  const emailContato = String(formData.get("emailContato") ?? "").trim() || null;

  try {
    const estruturado = formData.has("enderecoEstruturado") ? normalizarEnderecoEmpresa(JSON.parse(String(formData.get("enderecoEstruturado")))) : undefined;
    if ((nome?.length ?? 0) > 160 || (cnpj?.length ?? 0) > 30 || (telefone?.length ?? 0) > 40 || (emailContato?.length ?? 0) > 254 || (endereco?.length ?? 0) > 1000) return { erro: "Dados da empresa excedem o tamanho permitido." };
    await prisma.$transaction(async tx => {
      const autor = await autorEntregas(tx, session, "configuracoes.loja");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('entregas-config'))`;
      const antes = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" } });
      const valores = { nome, cnpj, endereco: estruturado && enderecoPreciso(estruturado) ? textoEndereco(estruturado) : endereco, telefone, emailContato,
        ...(estruturado ? { enderecoEstruturado: JSON.parse(JSON.stringify(estruturado)) as Prisma.InputJsonValue } : {}) };
      const mudouOrigem = estruturado && JSON.stringify(antes?.enderecoEstruturado) !== JSON.stringify(estruturado);
      const depois = await tx.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...valores }, update: { ...valores, ...(mudouOrigem ? { versaoEntregas: { increment: 1 } } : {}) } });
      await historico(tx, autor, "LOJA", "singleton", antes, depois);
    });
  } catch { return { erro: "Não foi possível salvar os dados da empresa. Confira o endereço e tente novamente." }; }

  revalidatePath("/configuracoes/empresa");
  revalidatePath("/vendas/area-entrega");
  return { ok: true };
}

export type ResultadoCertificado =
  | { erro: string }
  | { ok: true; arquivoNome: string; titular: string | null; validoAte: string | null };

export async function uploadCertificadoAction(_prevState: unknown, formData: FormData): Promise<ResultadoCertificado> {
  await exigirPermissao("configuracoes.loja", "editar");
  const session = await obterSessaoConfiguracoes();
  if (!session) return { erro: "Apenas administradores podem gerenciar o certificado digital." };

  const arquivo = formData.get("arquivo");
  const senha = String(formData.get("senha") ?? "");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Selecione o arquivo .pfx do certificado." };
  }
  if (!senha) return { erro: "Informe a senha do certificado." };

  const buffer = Buffer.from(await arquivo.arrayBuffer());

  let certificado: ReturnType<typeof parsePfx>;
  try {
    certificado = parsePfx(buffer, senha);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível abrir o certificado." };
  }

  await prisma.certificadoDigital.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      arquivoNome: arquivo.name,
      arquivoData: buffer,
      senhaCifrada: cifrar(senha),
      titular: certificado.titular,
      validoAte: certificado.validoAte,
      atualizadoPorId: session.userId,
    },
    update: {
      arquivoNome: arquivo.name,
      arquivoData: buffer,
      senhaCifrada: cifrar(senha),
      titular: certificado.titular,
      validoAte: certificado.validoAte,
      atualizadoPorId: session.userId,
    },
  });

  invalidarCacheCertificado();
  revalidatePath("/financeiro/fiscal/configuracoes");
  revalidatePath("/financeiro/fiscal");
  return {
    ok: true,
    arquivoNome: arquivo.name,
    titular: certificado.titular,
    validoAte: certificado.validoAte?.toISOString() ?? null,
  };
}

export async function removerCertificadoAction(): Promise<ResultadoConfiguracao> {
  await exigirPermissao("configuracoes.loja", "excluir");
  const session = await obterSessaoConfiguracoes();
  if (!session) return { erro: "Apenas administradores podem remover o certificado digital." };

  await prisma.certificadoDigital.deleteMany({ where: { id: "singleton" } });
  invalidarCacheCertificado();
  revalidatePath("/financeiro/fiscal/configuracoes");
  revalidatePath("/financeiro/fiscal");
  return { ok: true };
}

export type ResultadoSenhaCertificado = { erro: string } | { ok: true; senha: string };

export async function obterSenhaCertificadoAction(): Promise<ResultadoSenhaCertificado> {
  await exigirPermissao("configuracoes.loja", "editar");
  const session = await obterSessaoConfiguracoes();
  if (!session) return { erro: "Apenas administradores podem consultar a senha do certificado." };

  const registro = await prisma.certificadoDigital.findUnique({ where: { id: "singleton" } });
  if (!registro) return { erro: "Nenhum certificado cadastrado." };

  return { ok: true, senha: decifrar(registro.senhaCifrada) };
}
