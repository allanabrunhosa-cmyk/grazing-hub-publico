"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { validarPlanejamentoRaspberry, type PlanejamentoRaspberry } from "@/lib/etiquetas/raspberry";
import { getSession } from "@/lib/session";
import { registrarAtividade, definirContextoAtividade } from "@/lib/atividades/registro";
import { contextoExecucao } from "@/lib/contexto-execucao";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { fimDoDiaLocal, somarDiasDeCalendario, fusoHorarioValido } from "@/lib/etiquetas/datas";
import { gerarZplEtiqueta, nomeArquivoZpl } from "@/lib/etiquetas/zpl";
import {
  normalizarQuantidade,
  validarChaveIdempotencia,
  validarTextoObrigatorio,
  validarTextoOpcional,
} from "@/lib/etiquetas/validacao";
import type {
  DadosEtiqueta,
  EntradaPrepararEtiqueta,
  TrabalhoEtiquetaPreparado,
} from "@/lib/etiquetas/tipos";

const LOJA_ID = "singleton";
const VERSAO_TEMPLATE = 4;

type Resultado<T> = { erro: string } | T;

function mensagemErro(erro: unknown) {
  return erro instanceof Error ? erro.message : "Não foi possível concluir a operação.";
}

async function obterUsuarioAtivo(exigirAdmin = false) {
  const sessao = await getSession();
  if (!sessao) return null;
  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.userId },
    select: { id: true, nome: true, ativo: true, excluidoEm: true },
  });
  // getSession relê perfil e versão no banco; Usuario.admin é legado, não a autorização.
  if (!usuario?.ativo || usuario.excluidoEm || (exigirAdmin && !sessao.admin)) return null;
  return usuario;
}

async function obterLoja() {
  return prisma.configuracaoLoja.upsert({
    where: { id: LOJA_ID },
    create: { id: LOJA_ID },
    update: {},
  });
}

function dadosDoTrabalho(trabalho: {
  produtoNome: string;
  lojaNome: string;
  lojaCnpj: string | null;
  lojaEndereco: string | null;
  conservacao: "SECO" | "REFRIGERADO" | "CONGELADO" | "APOS_ABERTO";
  quantidade: { toString(): string } | null;
  unidade: string;
  lote: string | null;
  marcaFornecedor: string | null;
  sif: string | null;
  validadeOriginal: string | null;
  codigoRastreio: string;
  responsavelManipulacao: string;
  manipuladoEm: Date;
  validoAte: Date;
  fusoHorario: string;
  resolucaoDpi: number;
  tamanho: "MM_60X40" | "MM_60X60";
  mostrarHora: boolean;
  copias: number;
}): DadosEtiqueta {
  return {
    produtoNome: trabalho.produtoNome,
    lojaNome: trabalho.lojaNome,
    lojaCnpj: trabalho.lojaCnpj,
    lojaEndereco: trabalho.lojaEndereco,
    conservacao: trabalho.conservacao,
    quantidade: trabalho.quantidade?.toString() ?? null,
    unidade: trabalho.unidade,
    lote: trabalho.lote,
    marcaFornecedor: trabalho.marcaFornecedor,
    sif: trabalho.sif,
    validadeOriginal: trabalho.validadeOriginal,
    codigoRastreio: trabalho.codigoRastreio,
    responsavelManipulacao: trabalho.responsavelManipulacao,
    manipuladoEm: trabalho.manipuladoEm.toISOString(),
    validoAte: trabalho.validoAte.toISOString(),
    fusoHorario: trabalho.fusoHorario,
    resolucaoDpi: trabalho.resolucaoDpi,
    tamanho: trabalho.tamanho,
    mostrarHora: trabalho.mostrarHora,
    copias: trabalho.copias,
  };
}

function retornoTrabalho(
  trabalho: Parameters<typeof dadosDoTrabalho>[0] & { id: string; zpl: string; status: string },
  reutilizado: boolean,
): TrabalhoEtiquetaPreparado {
  return {
    id: trabalho.id,
    zpl: trabalho.zpl,
    nomeArquivo: nomeArquivoZpl(trabalho.produtoNome, trabalho.id),
    dados: dadosDoTrabalho(trabalho),
    status: trabalho.status,
    reutilizado,
  };
}

export async function prepararEtiquetaAction(
  entrada: EntradaPrepararEtiqueta,
): Promise<Resultado<{ ok: true; trabalho: TrabalhoEtiquetaPreparado }>> {
  await exigirPermissao("producao", "adicionar");
  try {
    const usuario = await obterUsuarioAtivo();
    if (!usuario) return { erro: "Sua sessão expirou ou o usuário está inativo. Entre novamente." };

    const chaveIdempotencia = validarChaveIdempotencia(entrada.chaveIdempotencia);
    const existente = await prisma.trabalhoEtiqueta.findUnique({
      where: { lojaId_chaveIdempotencia: { lojaId: LOJA_ID, chaveIdempotencia } },
    });
    if (existente) {
      if (existente.emitidoPorId !== usuario.id) return { erro: "Esta solicitação não pertence ao usuário atual." };
      return { ok: true, trabalho: retornoTrabalho(existente, true) };
    }

    const [loja, insumo, trabalhosRecentes, perfil] = await Promise.all([
      obterLoja(),
      prisma.insumo.findUnique({
        where: { id: entrada.insumoId },
        include: { categoria: { select: { nome: true } }, fornecedorPrincipal: { select: { nome: true } } },
      }),
      prisma.trabalhoEtiqueta.count({
        where: {
          emitidoPorId: usuario.id,
          createdAt: { gte: new Date(Date.now() - 60_000) },
        },
      }),
      prisma.perfilImpressora.findFirst({
        where: { lojaId: LOJA_ID, ativo: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    if (trabalhosRecentes >= 30) return { erro: "Muitas etiquetas foram preparadas em pouco tempo. Aguarde um minuto." };
    if (!insumo?.ativo || !insumo.etiquetaHabilitada) {
      return { erro: "Este insumo ou preparação não está habilitado para etiquetas." };
    }
    const conservacoesValidas = ["SECO", "REFRIGERADO", "CONGELADO", "APOS_ABERTO"] as const;
    if (!conservacoesValidas.includes(entrada.conservacao)) {
      return { erro: "Selecione uma conservação válida." };
    }
    if (entrada.tamanho !== "MM_60X40" && entrada.tamanho !== "MM_60X60") {
      return { erro: "Selecione um tamanho de etiqueta válido." };
    }
    if (perfil && entrada.tamanho === "MM_60X40" && !perfil.suporta60x40) return { erro: "O perfil ativo não está homologado para mídia 60×40 mm." };
    if (perfil && entrada.tamanho === "MM_60X60" && !perfil.suporta60x60) return { erro: "O perfil ativo não está homologado para mídia 60×60 mm." };
    const prazoDias = {
      SECO: insumo.validadeSecoDias,
      REFRIGERADO: insumo.validadeRefrigeradoDias,
      CONGELADO: insumo.validadeCongeladoDias,
      APOS_ABERTO: insumo.validadeAposAbertoDias,
    }[entrada.conservacao];
    if (!prazoDias || prazoDias <= 0) {
      const descricao = { SECO: "em estoque seco", REFRIGERADO: "refrigerado", CONGELADO: "congelado", APOS_ABERTO: "após aberto" }[entrada.conservacao];
      return { erro: `Configure uma validade positiva para o produto ${descricao} antes de emitir.` };
    }
    if (!Number.isInteger(entrada.copias) || entrada.copias < 1 || entrada.copias > loja.maximoCopiasEtiqueta) {
      return { erro: `A quantidade de cópias deve ficar entre 1 e ${loja.maximoCopiasEtiqueta}.` };
    }
    if (!fusoHorarioValido(loja.fusoHorario)) return { erro: "O fuso horário da loja é inválido. Corrija a configuração." };

    const quantidade = normalizarQuantidade(entrada.quantidade);
    let nomeResponsavel = entrada.responsavelManipulacao;
    if (entrada.responsavelUsuarioId) {
      const id = validarTextoObrigatorio(entrada.responsavelUsuarioId, "O responsável selecionado", 120);
      const cadastrado = await prisma.usuario.findUnique({
        where: { id }, select: { nome: true, ativo: true, excluidoEm: true, responsavelEtiquetaHabilitado: true },
      });
      if (!cadastrado?.ativo || cadastrado.excluidoEm || !cadastrado.responsavelEtiquetaHabilitado) return { erro: "O responsável selecionado não está mais ativo. Selecione novamente." };
      nomeResponsavel = cadastrado.nome;
    }
    if (entrada.responsavelCadastroId) {
      if (entrada.responsavelUsuarioId) return { erro: "Selecione apenas um responsável." };
      const cadastrado = await prisma.responsavelEtiqueta.findFirst({ where: { id: entrada.responsavelCadastroId, lojaId: LOJA_ID, ativo: true } });
      if (!cadastrado) return { erro: "O responsável não está disponível. Selecione novamente." };
      nomeResponsavel = cadastrado.nome;
    }
    const responsavel = validarTextoObrigatorio(nomeResponsavel, "A pessoa responsável", 120);
    const lote = validarTextoOpcional(entrada.lote, "O lote/referência", 80);
    const marcaFornecedor = validarTextoOpcional(entrada.marcaFornecedor ?? "", "A marca ou o fornecedor", 60)
      ?? insumo.marcasHomologadas[0]
      ?? insumo.fornecedorPrincipal?.nome
      ?? null;
    const sif = validarTextoOpcional(entrada.sif ?? "", "O SIF", 30);
    const validadeOriginal = validarTextoOpcional(entrada.validadeOriginal ?? "", "A validade original", 10);
    const manipuladoEm = new Date();
    const validadeCalculada = somarDiasDeCalendario(manipuladoEm, prazoDias, loja.fusoHorario);
    const limiteOriginal = validadeOriginal ? fimDoDiaLocal(validadeOriginal, loja.fusoHorario) : null;
    if (limiteOriginal && limiteOriginal < manipuladoEm) return { erro: "A validade original não pode estar vencida." };
    const validoAte = limiteOriginal && limiteOriginal < validadeCalculada ? limiteOriginal : validadeCalculada;
    const codigoRastreio = chaveIdempotencia.replaceAll("-", "").slice(0, 6).toUpperCase();
    const dados: DadosEtiqueta = {
      produtoNome: insumo.nome,
      lojaNome: loja.nome?.trim() || "Grazing Table & Co",
      lojaCnpj: loja.cnpj,
      lojaEndereco: loja.endereco,
      conservacao: entrada.conservacao,
      quantidade,
      unidade: insumo.unidade,
      lote,
      marcaFornecedor,
      sif,
      validadeOriginal,
      codigoRastreio,
      responsavelManipulacao: responsavel,
      manipuladoEm: manipuladoEm.toISOString(),
      validoAte: validoAte.toISOString(),
      fusoHorario: loja.fusoHorario,
      resolucaoDpi: perfil?.dpi ?? 203,
      tamanho: entrada.tamanho,
      mostrarHora: Boolean(entrada.mostrarHora),
      copias: entrada.copias,
    };
    const zpl = gerarZplEtiqueta(dados);
    const hashPayload = createHash("sha256").update(JSON.stringify(dados)).update(zpl).digest("hex");

    const trabalho = await prisma.$transaction(async (tx) => {
      const criado = await tx.trabalhoEtiqueta.create({
        data: {
          chaveIdempotencia,
          lojaId: LOJA_ID,
          insumoId: insumo.id,
          produtoNome: insumo.nome,
          categoriaNome: insumo.categoria?.nome ?? null,
          unidade: insumo.unidade,
          prazoDias,
          configuracaoVersao: insumo.versaoConfiguracaoEtiqueta,
          lojaNome: dados.lojaNome,
          lojaCnpj: dados.lojaCnpj,
          lojaEndereco: dados.lojaEndereco,
          fusoHorario: dados.fusoHorario,
          resolucaoDpi: dados.resolucaoDpi,
          conservacao: entrada.conservacao,
          quantidade,
          lote,
          marcaFornecedor,
          sif,
          validadeOriginal,
          codigoRastreio,
          responsavelManipulacao: responsavel,
          emitidoPorId: usuario.id,
          manipuladoEm,
          validoAte,
          tamanho: entrada.tamanho,
          mostrarHora: dados.mostrarHora,
          copias: entrada.copias,
          versaoTemplate: VERSAO_TEMPLATE,
          zpl,
          hashPayload,
        },
      });
      await tx.eventoAuditoriaEtiqueta.create({
        data: {
          lojaId: LOJA_ID,
          entidade: "TrabalhoEtiqueta",
          entidadeId: criado.id,
          acao: "PREPARADO",
          detalhes: { hashPayload, copias: entrada.copias, conservacao: entrada.conservacao, responsavelUsuarioId: entrada.responsavelUsuarioId || null, responsavelCadastroId: entrada.responsavelCadastroId || null, origemResponsavel: entrada.responsavelUsuarioId ? "USUARIO" : entrada.responsavelCadastroId ? "CADASTRO" : "MANUAL" },
          usuarioId: usuario.id,
        },
      });
      return criado;
    });

    revalidatePath("/producao/etiquetas");
    return { ok: true, trabalho: retornoTrabalho(trabalho, false) };
  } catch (erro) {
    // Uma corrida com a mesma chave retorna o trabalho já criado, sem duplicá-lo.
    try {
      const usuario = await obterUsuarioAtivo();
      const chave = entrada.chaveIdempotencia?.toLowerCase();
      const existente = usuario && chave
        ? await prisma.trabalhoEtiqueta.findUnique({ where: { lojaId_chaveIdempotencia: { lojaId: LOJA_ID, chaveIdempotencia: chave } } })
        : null;
      if (existente && usuario && existente.emitidoPorId === usuario.id) {
        return { ok: true, trabalho: retornoTrabalho(existente, true) };
      }
    } catch {
      // Preserva o erro original.
    }
    return { erro: mensagemErro(erro) };
  }
}

export async function iniciarEnvioEtiquetaAction(
  trabalhoId: string,
  perfilImpressoraId: string | null,
  dispositivoNome: string,
): Promise<Resultado<{ ok: true; tentativaId: string }>> {
  await exigirPermissao("producao.imprimir", "adicionar");
  try {
    const usuario = await obterUsuarioAtivo();
    if (!usuario) return { erro: "Sua sessão expirou ou o usuário está inativo." };
    const trabalho = await prisma.trabalhoEtiqueta.findFirst({ where: { id: trabalhoId, lojaId: LOJA_ID } });
    if (!trabalho) return { erro: "Trabalho de etiqueta não encontrado." };
    if (perfilImpressoraId) {
      const perfil = await prisma.perfilImpressora.findFirst({ where: { id: perfilImpressoraId, lojaId: LOJA_ID, ativo: true } });
      if (!perfil) return { erro: "O perfil de impressora não pertence à loja ou está inativo." };
    }
    const nomeDispositivo = validarTextoObrigatorio(dispositivoNome, "A impressora", 160);
    const tentativa = await prisma.$transaction(async (tx) => {
      await definirContextoAtividade(tx, contextoExecucao() ? "MCP" : "INTERFACE");
      const criada = await tx.tentativaEtiqueta.create({
        data: {
          trabalhoId,
          perfilImpressoraId,
          solicitadoPorId: usuario.id,
          transporte: "ZEBRA_BROWSER_PRINT",
          resultado: "INICIADA",
          dispositivoNome: nomeDispositivo,
        },
      });
      if (trabalho.status !== "CONFIRMADO_PELO_OPERADOR") {
        await tx.trabalhoEtiqueta.update({ where: { id: trabalhoId }, data: { status: "ENVIANDO" } });
      }
      return criada;
    });
    revalidatePath("/producao/etiquetas");
    return { ok: true, tentativaId: tentativa.id };
  } catch (erro) {
    return { erro: mensagemErro(erro) };
  }
}

export async function finalizarTentativaEtiquetaAction(
  tentativaId: string,
  resultado: "SUCESSO" | "FALHA" | "INCERTO",
  erroRelatado?: string,
): Promise<Resultado<{ ok: true }>> {
  await exigirPermissao("producao.imprimir", "adicionar");
  try {
    const usuario = await obterUsuarioAtivo();
    if (!usuario) return { erro: "Sua sessão expirou ou o usuário está inativo." };
    if (!(["SUCESSO", "FALHA", "INCERTO"] as const).includes(resultado)) return { erro: "Resultado de envio inválido." };
    const tentativa = await prisma.tentativaEtiqueta.findFirst({
      where: { id: tentativaId, solicitadoPorId: usuario.id, trabalho: { lojaId: LOJA_ID } },
      include: { trabalho: { select: { id: true, status: true } } },
    });
    if (!tentativa) return { erro: "Tentativa de envio não encontrada." };
    if (tentativa.resultado !== "INICIADA") return { ok: true };
    const erroLimpo = erroRelatado ? validarTextoOpcional(erroRelatado, "O erro", 500) : null;
    const status = resultado === "SUCESSO" ? "ENVIADO_AO_DISPOSITIVO" : resultado === "INCERTO" ? "ENVIO_INCERTO" : "FALHA";
    await prisma.$transaction(async (tx) => {
      const concluida = await tx.tentativaEtiqueta.updateMany({
        where: { id: tentativa.id, resultado: "INICIADA" },
        data: { resultado, erro: erroLimpo, finalizadoEm: new Date() },
      });
      if (concluida.count !== 1) return;
      await registrarAtividade(tx, { userId: usuario.id, nome: usuario.nome }, {
        modulo: "etiquetas", recurso: "producao.imprimir", acao: resultado === "SUCESSO" ? "ENVIO_RELATADO" : resultado === "FALHA" ? "ENVIO_FALHOU" : "ENVIO_INCERTO", entidade: "TrabalhoEtiqueta", entidadeId: tentativa.trabalho.id,
        resumo: resultado === "SUCESSO" ? "Cliente relatou envio ao dispositivo; impressão física não confirmada." : resultado === "FALHA" ? "Cliente relatou falha no envio da etiqueta." : "Cliente relatou envio incerto; impressão física não confirmada.",
        resultado: resultado === "FALHA" ? "FALHA" : "SOLICITADO", correlacaoId: tentativa.id, deduplicacao: "etiqueta-finalizada:" + tentativa.id,
      });
      if (tentativa.trabalho.status !== "CONFIRMADO_PELO_OPERADOR") {
        await tx.trabalhoEtiqueta.update({ where: { id: tentativa.trabalho.id }, data: { status } });
      }
    });
    revalidatePath("/producao/etiquetas");
    return { ok: true };
  } catch (erro) {
    return { erro: mensagemErro(erro) };
  }
}

export async function registrarExportacaoEtiquetaAction(trabalhoId: string): Promise<Resultado<{ ok: true }>> {
  await exigirPermissao("producao.imprimir", "adicionar");
  try {
    const usuario = await obterUsuarioAtivo();
    if (!usuario) return { erro: "Sua sessão expirou ou o usuário está inativo." };
    const trabalho = await prisma.trabalhoEtiqueta.findFirst({ where: { id: trabalhoId, lojaId: LOJA_ID } });
    if (!trabalho) return { erro: "Trabalho de etiqueta não encontrado." };
    await prisma.$transaction(async (tx) => {
      await tx.tentativaEtiqueta.create({
        data: {
          trabalhoId,
          solicitadoPorId: usuario.id,
          transporte: "ARQUIVO_ZPL",
          resultado: "SUCESSO",
          finalizadoEm: new Date(),
        },
      });
      if (trabalho.status !== "CONFIRMADO_PELO_OPERADOR" && trabalho.status !== "ENVIADO_AO_DISPOSITIVO") {
        await tx.trabalhoEtiqueta.update({ where: { id: trabalhoId }, data: { status: "EXPORTADO" } });
      }
    });
    revalidatePath("/producao/etiquetas");
    return { ok: true };
  } catch (erro) {
    return { erro: mensagemErro(erro) };
  }
}

export async function confirmarImpressaoEtiquetaAction(trabalhoId: string): Promise<Resultado<{ ok: true }>> {
  await exigirPermissao("producao.imprimir", "adicionar");
  try {
    const usuario = await obterUsuarioAtivo();
    if (!usuario) return { erro: "Sua sessão expirou ou o usuário está inativo." };
    const trabalho = await prisma.trabalhoEtiqueta.findFirst({ where: { id: trabalhoId, lojaId: LOJA_ID } });
    if (!trabalho) return { erro: "Trabalho de etiqueta não encontrado." };
    if (!(["ENVIADO_AO_DISPOSITIVO", "EXPORTADO", "CONFIRMADO_PELO_OPERADOR"] as const).includes(trabalho.status as never)) {
      return { erro: "Só confirme depois de conferir a saída física da etiqueta." };
    }
    if (trabalho.status !== "CONFIRMADO_PELO_OPERADOR") {
      await prisma.$transaction([
        prisma.trabalhoEtiqueta.update({ where: { id: trabalho.id }, data: { status: "CONFIRMADO_PELO_OPERADOR", confirmadoEm: new Date() } }),
        prisma.eventoAuditoriaEtiqueta.create({
          data: {
            lojaId: LOJA_ID,
            entidade: "TrabalhoEtiqueta",
            entidadeId: trabalho.id,
            acao: "CONFIRMADO_PELO_OPERADOR",
            usuarioId: usuario.id,
          },
        }),
      ]);
    }
    revalidatePath("/producao/etiquetas");
    return { ok: true };
  } catch (erro) {
    return { erro: mensagemErro(erro) };
  }
}

export type EntradaConfiguracaoProdutoEtiqueta = {
  insumoId: string;
  etiquetaHabilitada: boolean;
  validadeSecoDias?: string;
  validadeRefrigeradoDias: string;
  validadeCongeladoDias: string;
  /** Campos antigos aceitos para compatibilidade com clientes já abertos; não são mais gravados. */
  validadeAposAbertoDias?: string;
  conservacaoEtiquetaPadrao?: "SECO" | "REFRIGERADO" | "CONGELADO" | "APOS_ABERTO" | null;
};

function prazoOpcional(valor: string, campo: string) {
  const limpo = valor.trim();
  if (!limpo) return null;
  if (!/^\d{1,4}$/.test(limpo) || Number(limpo) <= 0) throw new Error(`${campo} deve ser informado em dias inteiros positivos.`);
  return Number(limpo);
}

export async function salvarConfiguracaoProdutoEtiquetaAction(
  entrada: EntradaConfiguracaoProdutoEtiqueta,
): Promise<Resultado<{ ok: true; versao: number }>> {
  await exigirPermissao("producao.validades", "editar");
  try {
    const usuario = await obterUsuarioAtivo();
    if (!usuario) return { erro: "Entre no HUB com acesso à configuração de validades." };
    const insumo = await prisma.insumo.findUnique({ where: { id: entrada.insumoId } });
    if (!insumo) return { erro: "Insumo ou preparação não encontrado." };
    await obterLoja();
    const seco = prazoOpcional(entrada.validadeSecoDias ?? "", "A validade em ambiente");
    const refrigerado = prazoOpcional(entrada.validadeRefrigeradoDias, "A validade refrigerada");
    const congelado = prazoOpcional(entrada.validadeCongeladoDias, "A validade congelada");
    const mudou = insumo.etiquetaHabilitada !== entrada.etiquetaHabilitada
      || insumo.validadeSecoDias !== seco
      || insumo.validadeRefrigeradoDias !== refrigerado
      || insumo.validadeCongeladoDias !== congelado;
    if (!mudou) return { ok: true, versao: insumo.versaoConfiguracaoEtiqueta };
    const versao = insumo.versaoConfiguracaoEtiqueta + 1;
    await prisma.$transaction([
      prisma.insumo.update({
        where: { id: insumo.id },
        data: {
          etiquetaHabilitada: entrada.etiquetaHabilitada,
          validadeSecoDias: seco,
          validadeRefrigeradoDias: refrigerado,
          validadeCongeladoDias: congelado,
          versaoConfiguracaoEtiqueta: versao,
          etiquetaAtualizadaPorId: usuario.id,
        },
      }),
      prisma.eventoAuditoriaEtiqueta.create({
        data: {
          lojaId: LOJA_ID,
          entidade: "Insumo",
          entidadeId: insumo.id,
          acao: "CONFIGURACAO_ETIQUETA_ALTERADA",
          detalhes: {
            versaoAnterior: insumo.versaoConfiguracaoEtiqueta,
            versaoNova: versao,
            anterior: {
              habilitada: insumo.etiquetaHabilitada,
              validadeSecoDias: insumo.validadeSecoDias,
              validadeRefrigeradoDias: insumo.validadeRefrigeradoDias,
              validadeCongeladoDias: insumo.validadeCongeladoDias,
              validadeAposAbertoDias: insumo.validadeAposAbertoDias,
              conservacaoPadrao: insumo.conservacaoEtiquetaPadrao,
            },
            nova: {
              habilitada: entrada.etiquetaHabilitada,
              validadeSecoDias: seco,
              validadeRefrigeradoDias: refrigerado,
              validadeCongeladoDias: congelado,
            },
          },
          usuarioId: usuario.id,
        },
      }),
    ]);
    revalidatePath("/producao/etiquetas");
    revalidatePath("/insumos");
    return { ok: true, versao };
  } catch (erro) {
    return { erro: mensagemErro(erro) };
  }
}

export type EntradaConfiguracaoImpressora = {
  planejamentoRaspberry?: PlanejamentoRaspberry | null;
  fusoHorario: string;
  maximoCopias: number;
  perfilId: string | null;
  nomePerfil: string;
  modelo: string;
  dpi: number;
  suporta60x40: boolean;
  suporta60x60: boolean;
};

export async function salvarConfiguracaoImpressoraAction(
  entrada: EntradaConfiguracaoImpressora,
): Promise<Resultado<{ ok: true; perfilId: string }>> {
  await exigirPermissao("producao");
  try {
    const usuario = await obterUsuarioAtivo(true);
    if (!usuario) return { erro: "Apenas administradores ativos podem configurar a impressora." };
    const fuso = entrada.fusoHorario.trim();
    if (!fusoHorarioValido(fuso)) return { erro: "Informe um fuso IANA válido, como America/Sao_Paulo." };
    if (!Number.isInteger(entrada.maximoCopias) || entrada.maximoCopias < 1 || entrada.maximoCopias > 50) return { erro: "O limite de cópias deve ficar entre 1 e 50." };
    if (!Number.isInteger(entrada.dpi) || entrada.dpi < 100 || entrada.dpi > 1200) return { erro: "A resolução deve ficar entre 100 e 1200 dpi." };
    if (!entrada.suporta60x40 && !entrada.suporta60x60) return { erro: "Habilite pelo menos um tamanho de mídia." };
    const nome = validarTextoObrigatorio(entrada.nomePerfil, "O nome do perfil", 80);
    const modelo = validarTextoOpcional(entrada.modelo, "O modelo", 80);
    const planejamento = entrada.planejamentoRaspberry === undefined ? undefined : validarPlanejamentoRaspberry(entrada.planejamentoRaspberry);
    const configuracaoRaspberry = planejamento === null ? Prisma.DbNull : planejamento;
    if (entrada.perfilId) {
      const perfil = await prisma.perfilImpressora.findFirst({ where: { id: entrada.perfilId, lojaId: LOJA_ID } });
      if (!perfil) return { erro: "Perfil de impressora não encontrado para esta loja." };
    }
    const [, perfil] = await prisma.$transaction([
      prisma.configuracaoLoja.upsert({
        where: { id: LOJA_ID },
        create: { id: LOJA_ID, fusoHorario: fuso, maximoCopiasEtiqueta: entrada.maximoCopias },
        update: { fusoHorario: fuso, maximoCopiasEtiqueta: entrada.maximoCopias },
      }),
      entrada.perfilId
        ? prisma.perfilImpressora.update({
          where: { id: entrada.perfilId },
          data: { nome, modelo, dpi: entrada.dpi, suporta60x40: entrada.suporta60x40, suporta60x60: entrada.suporta60x60, planejamentoRaspberry: configuracaoRaspberry },
        })
        : prisma.perfilImpressora.create({
          data: { lojaId: LOJA_ID, nome, modelo, dpi: entrada.dpi, suporta60x40: entrada.suporta60x40, suporta60x60: entrada.suporta60x60, planejamentoRaspberry: configuracaoRaspberry },
        }),
      prisma.eventoAuditoriaEtiqueta.create({
        data: {
          lojaId: LOJA_ID,
          entidade: "PerfilImpressora",
          entidadeId: entrada.perfilId ?? "novo",
          acao: "PERFIL_IMPRESSORA_SALVO",
          detalhes: { fusoHorario: fuso, maximoCopias: entrada.maximoCopias, dpi: entrada.dpi, ...(planejamento !== undefined ? { planejamentoRaspberry: planejamento } : {}) },
          usuarioId: usuario.id,
        },
      }),
    ]);
    revalidatePath("/producao/etiquetas");
    return { ok: true, perfilId: perfil.id };
  } catch (erro) {
    return { erro: mensagemErro(erro) };
  }
}
