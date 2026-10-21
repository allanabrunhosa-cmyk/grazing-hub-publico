"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { permissaoEfetiva } from "@/lib/permissoes/catalogo";


import { completarZeroDecimal } from "@/lib/campos-entrada";
import { GRUPOS_RECEITA } from "@/lib/labels";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma, TipoProdutoGlobal, UnidadeMedida, TipoEstoque } from "@/generated/prisma/client";
import { getSession } from "@/lib/session";
import { validarConversoes, type ConversaoInsumo } from "@/lib/insumos/conversoes";
import { calcularPorcao, validarPorcaoComposicao, type PorcaoComposicao } from "@/lib/insumos/porcoes";
import { MAXIMO_INGREDIENTES_PREPARACAO, MAXIMO_PASSOS_PREPARO } from "@/lib/insumos/limites-preparacao";
import { lerMarcasJson, validarMarcas } from "@/lib/insumos/marcas";
import type { VinculosExclusaoInsumo } from "@/lib/insumos/exclusao";
import { conferirInsumosComposicao, consultarPlanoExclusaoInsumo, excluirInsumoPreservandoHistorico, ErroInsumoExcluido } from "@/lib/insumos/exclusao-servidor";
import type { InsumoCriado } from "@/app/(protegido)/insumos/types";
import { registrarAtividade } from "@/lib/atividades/registro";

export type FormState = { error: string | null; insumoId?: string; insumo?: InsumoCriado };

const NENHUM = "__nenhum__";
const LOJA_ID = "singleton";
const ERRO_UNIDADE_PORCAO = "A unidade de um ingrediente mudou. Revise sua porção.";

function optionalId(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();
  return value === "" || value === NENHUM ? null : value;
}

function optionalString(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();
  return value === "" ? null : value;
}

function requiredDecimal(formData: FormData, field: string, fallback: number) {
  const value = String(formData.get(field) ?? "").trim();
  if (value === "") return fallback;
  const parsed = Number(completarZeroDecimal(value).replace(",", "."));
  return Number.isNaN(parsed) ? fallback : parsed;
}

function optionalDecimal(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();
  if (value === "") return null;
  const parsed = Number(completarZeroDecimal(value).replace(",", "."));
  return Number.isNaN(parsed) ? null : parsed;
}

type ComponenteInput = { componenteId: string; quantidade: number; observacaoPorcao: string | null; porcao?: PorcaoComposicao | null };

function parseComponentes(formData: FormData): { componentes: ComponenteInput[] } | { erro: string } {
  const componentes: ComponenteInput[] = [];
  for (const raw of formData.getAll("componentes")) {
    try {
      const parsed = JSON.parse(String(raw)) as { componenteId?: string; quantidade?: number; observacaoPorcao?: unknown; porcao?: unknown };
      if (!parsed.componenteId || typeof parsed.quantidade !== "number") return { erro: "Composição inválida." };
      const validada = validarPorcaoComposicao(parsed.porcao, parsed.quantidade.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 9 }));
      if ("erro" in validada) return validada;
      const calculada = validada.porcao && calcularPorcao(validada.porcao);
      const observacao = calculada && !("erro" in calculada) ? calculada.observacaoPorcao : typeof parsed.observacaoPorcao === "string" ? parsed.observacaoPorcao.trim() : "";
      componentes.push({ componenteId: parsed.componenteId, quantidade: parsed.quantidade, observacaoPorcao: observacao || null, porcao: validada.porcao });
    } catch { return { erro: "Composição inválida." }; }
  }
  return { componentes };
}

async function conferirUnidadesPorcoes(tx: Prisma.TransactionClient, componentes: ComponenteInput[]) {
  await conferirInsumosComposicao(tx, componentes.map(c => c.componenteId));
  const comPorcao = componentes.filter(c => c.porcao);
  if (!comPorcao.length) return;
  const insumos = await tx.insumo.findMany({ where: { id: { in: comPorcao.map(c => c.componenteId) } }, select: { id: true, unidade: true } });
  if (comPorcao.some(c => insumos.find(i => i.id === c.componenteId)?.unidade !== c.porcao!.unidadeInsumo)) throw new Error(ERRO_UNIDADE_PORCAO);
}

function parseModoPreparo(formData: FormData): { passos: string[] } | { erro: string } {
  if (!formData.has("modoPreparo")) return { passos: [] };
  try {
    const valor = JSON.parse(String(formData.get("modoPreparo"))) as unknown;
    if (!Array.isArray(valor) || valor.some((passo) => typeof passo !== "string")) return { erro: "O modo de preparo é inválido." };
    const passos = valor.map((passo) => passo.trim()).filter(Boolean);
    if (passos.length > MAXIMO_PASSOS_PREPARO) return { erro: `O modo de preparo pode ter no máximo ${MAXIMO_PASSOS_PREPARO} passos.` };
    if (passos.some((passo) => passo.length > 1000)) return { erro: "Cada passo do modo de preparo pode ter no máximo 1.000 caracteres." };
    return { passos };
  } catch {
    return { erro: "O modo de preparo é inválido." };
  }
}

function prazoEtiqueta(formData: FormData, campo: string, rotulo: string) {
  const bruto = String(formData.get(campo) ?? "").trim();
  if (!bruto) return null;
  if (!/^\d{1,4}$/.test(bruto) || Number(bruto) <= 0) throw new Error(`${rotulo} deve ser informada em dias inteiros positivos.`);
  return Number(bruto);
}

export async function saveInsumoAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const sessao = await exigirPermissao("insumos", String(formData.get("id") ?? "").trim() ? "editar" : "adicionar");
  if (!await getSession()) return { error: "Sua sessão expirou. Entre novamente." };
  const id = String(formData.get("id") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const unidade = String(formData.get("unidade") ?? "") as UnidadeMedida;

  if (!nome) {
    return { error: "Preencha o nome oficial." };
  }
  const especificacao = optionalString(formData, "especificacao");
  if ((especificacao?.length ?? 0) > 300) return { error: "A especificação pode ter no máximo 300 caracteres." };
  if (!Object.values(UnidadeMedida).includes(unidade)) {
    return { error: "Escolha a unidade escopo." };
  }

  const marcasInformadas = formData.has("marcasHomologadas")
    ? lerMarcasJson(String(formData.get("marcasHomologadas")))
    : formData.has("marca") ? validarMarcas(optionalString(formData, "marca") ? [optionalString(formData, "marca")] : []) : undefined;
  if (marcasInformadas && "erro" in marcasInformadas) return { error: marcasInformadas.erro };

  let conversoes: ConversaoInsumo[] | undefined;
  if (formData.has("conversoes")) {
    let valor: unknown;
    try { valor = JSON.parse(String(formData.get("conversoes"))); }
    catch { return { error: "Lista de conversões inválida." }; }
    const validacao = validarConversoes(valor, unidade);
    if ("erro" in validacao) return { error: validacao.erro };
    conversoes = validacao.conversoes;
  }

  // O tipo (Insumo x Preparação) é travado depois de criado — ignora
  // qualquer valor vindo do form numa edição e usa sempre o que já está salvo, mesmo
  // que o client tenha sido adulterado. Pra mudar de verdade, precisa excluir e recriar.
  let tipo: TipoProdutoGlobal;
  let custoAnterior = new Prisma.Decimal(0);
  if (id) {
    const existente = await prisma.insumo.findUnique({ where: { id }, select: { tipo: true, custoMedio: true } });
    if (!existente) return { error: "Item não encontrado." };
    tipo = existente.tipo; custoAnterior = existente.custoMedio;
  } else {
    const tipoInformado = String(formData.get("tipo") ?? "") as TipoProdutoGlobal;
    if (!Object.values(TipoProdutoGlobal).includes(tipoInformado)) {
      return { error: "Escolha a classificação (Insumo ou Preparação)." };
    }
    tipo = tipoInformado;
  }

  const podeConsultarCustos = sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "financeiro.custos", "visualizar");
  if (tipo === "INSUMO" && !podeConsultarCustos) {
    const informado = String(formData.get("custoMedio") ?? "").trim().replace(",", ".");
    if (informado && (!/^\d+(\.\d{1,4})?$/.test(informado) || !new Prisma.Decimal(informado).equals(custoAnterior))) return { error: "Seu acesso não permite alterar custos." };
    formData.set("custoMedio", custoAnterior.toString());
  }
  const ehProdutoIntermediario = tipo === "PRODUTO_INTERMEDIARIO";
  const tempoBruto = String(formData.get("tempoPreparoMinutos") ?? "").trim();
  if (tempoBruto && (!/^\d{1,6}$/.test(tempoBruto) || !Number.isSafeInteger(Number(tempoBruto)))) return { error: "Informe o tempo de preparo em minutos inteiros." };
  const modoPreparoLido = ehProdutoIntermediario ? parseModoPreparo(formData) : { passos: [] as string[] };
  if ("erro" in modoPreparoLido) return { error: modoPreparoLido.erro };
  const rendimentoUnidade = String(formData.get("rendimentoUnidade") ?? "") as UnidadeMedida;
  const tipoEstoqueRaw = String(formData.get("tipoEstoque") ?? "") as TipoEstoque;
  const tipoEstoque = Object.values(TipoEstoque).includes(tipoEstoqueRaw) ? tipoEstoqueRaw : null;

  let configuracaoEtiqueta: {
    etiquetaHabilitada: boolean;
    validadeSecoDias: number | null;
    validadeRefrigeradoDias: number | null;
    validadeCongeladoDias: number | null;
  } | undefined;
  if (formData.has("etiquetaHabilitada")) {
    if (!sessao.admin && !permissaoEfetiva(sessao.permissoes, sessao.excecoes, "producao.validades", "editar")) return { error: "Seu acesso não permite configurar prazos de etiquetas." };
    try {
      const validadeSecoDias = prazoEtiqueta(formData, "validadeSecoDias", "A validade em ambiente");
      const validadeRefrigeradoDias = prazoEtiqueta(formData, "validadeRefrigeradoDias", "A validade refrigerada");
      const validadeCongeladoDias = prazoEtiqueta(formData, "validadeCongeladoDias", "A validade congelada");
      configuracaoEtiqueta = {
        etiquetaHabilitada: formData.get("etiquetaHabilitada") === "on",
        validadeSecoDias,
        validadeRefrigeradoDias,
        validadeCongeladoDias,
      };
    } catch (erro) {
      return { error: erro instanceof Error ? erro.message : "Configuração de etiqueta inválida." };
    }
  }
  const origemConfiguracaoEtiqueta = ehProdutoIntermediario ? "CADASTRO_PREPARACAO" : "CADASTRO_INSUMO";

  const fornecedorPrincipalId = optionalId(formData, "fornecedorPrincipalId");
  // O principal sempre entra na lista de homologados, mesmo que o form não tenha marcado o checkbox dele.
  const fornecedorIds = [...new Set([...formData.getAll("fornecedorIds").map(String), ...(fornecedorPrincipalId ? [fornecedorPrincipalId] : [])])];
  if (fornecedorIds.length > 0) {
    const fornecedoresValidos = await prisma.fornecedor.count({
      where: { id: { in: fornecedorIds }, ativo: true, tipoCadastro: "FORNECEDOR" },
    });
    if (fornecedoresValidos !== fornecedorIds.length) {
      return { error: "Selecione apenas fornecedores ativos para este insumo." };
    }
  }

  const categoriaFinanceiraId = optionalId(formData, "categoriaFinanceiraId");
  if (formData.has("categoriaFinanceiraId") && categoriaFinanceiraId) {
    const categoria = await prisma.categoriaFinanceira.findUnique({ where: { id: categoriaFinanceiraId }, select: { ativo: true, excluidoEm: true, grupo: true } });
    if (!categoria?.ativo || categoria.excluidoEm || GRUPOS_RECEITA.includes(categoria.grupo)) return { error: "Escolha uma categoria financeira de despesa ativa." };
  }
  for (const [campo, rotulo, casas] of [["estoqueMinimo", "Estoque mínimo", 3], ["estoqueMaximo", "Estoque máximo", 3], ["rendimentoQuantidade", "Rendimento", 3], ...(!ehProdutoIntermediario ? [["custoMedio", "Custo médio", 4]] : [])] as [string, string, number][]) {
    const bruto = String(formData.get(campo) ?? "").trim();
    const decimal = completarZeroDecimal(bruto).replace(",", ".");
    if (bruto && !new RegExp(`^\\d{1,${12 - casas}}(?:\\.\\d{1,${casas}})?$`).test(decimal)) return { error: `${rotulo}: informe um valor não negativo com até ${casas} casas decimais.` };
  }
  const camposComuns = {
    nome,
    especificacao,
    tipo,
    categoriaId: optionalId(formData, "categoriaId"),
    ...(formData.has("categoriaFinanceiraId") ? { categoriaFinanceiraId } : {}),
    unidade,
    tipoEstoque,
    centroCustoId: optionalId(formData, "centroCustoId"),
    ...(marcasInformadas ? { marcasHomologadas: marcasInformadas.marcas, marca: marcasInformadas.marcas[0] ?? null } : {}),
    codigoEan: optionalString(formData, "codigoEan"),
    observacoes: optionalString(formData, "observacoes"),
    estoqueMinimo: requiredDecimal(formData, "estoqueMinimo", 0),
    estoqueMaximo: optionalDecimal(formData, "estoqueMaximo"),
    // Preparações têm custo calculado pela receita; editar a ficha não altera
    // o custo contábil das movimentações de estoque já registradas.
    ...(!ehProdutoIntermediario ? { custoMedio: requiredDecimal(formData, "custoMedio", 0) } : {}),
    fornecedorPrincipalId,
    rendimentoQuantidade: ehProdutoIntermediario ? optionalDecimal(formData, "rendimentoQuantidade") : null,
    rendimentoUnidade: ehProdutoIntermediario && Object.values(UnidadeMedida).includes(rendimentoUnidade) ? rendimentoUnidade : null,
    modoPreparo: ehProdutoIntermediario ? modoPreparoLido.passos : [],
    tempoPreparoMinutos: ehProdutoIntermediario && tempoBruto ? Number(tempoBruto) : null,
    ...(configuracaoEtiqueta ?? {}),
    ativo: formData.get("ativo") === "on",
  };

  const foto = formData.get("foto");
  const removerFoto = formData.get("removerFoto") === "on";
  let dadosFoto: { fotoData: Uint8Array<ArrayBuffer> | null; fotoMimeType: string | null } | null = null;
  if (removerFoto) {
    dadosFoto = { fotoData: null, fotoMimeType: null };
  } else if (foto instanceof File && foto.size > 0) {
    const buffer = await foto.arrayBuffer();
    dadosFoto = { fotoData: new Uint8Array(buffer), fotoMimeType: foto.type || "application/octet-stream" };
  }

  const composicao = ehProdutoIntermediario ? parseComponentes(formData) : { componentes: [] };
  if ("erro" in composicao) return { error: composicao.erro };
  const componentes = composicao.componentes;
  if (componentes.length > MAXIMO_INGREDIENTES_PREPARACAO) {
    return { error: `A receita pode ter no máximo ${MAXIMO_INGREDIENTES_PREPARACAO} ingredientes.` };
  }
  if (componentes.some((c) => !Number.isFinite(c.quantidade) || c.quantidade <= 0)) {
    return { error: "Informe uma quantidade positiva para cada ingrediente." };
  }
  if (componentes.some((c) => c.quantidade >= 1_000_000_000 || new Prisma.Decimal(c.quantidade).decimalPlaces() > 9)) {
    return { error: "A quantidade de cada ingrediente deve ser menor que 1 bilhão e ter até 9 casas decimais." };
  }
  if (componentes.some((c) => (c.observacaoPorcao?.length ?? 0) > 120)) {
    return { error: "A porção alternativa pode ter no máximo 120 caracteres." };
  }
  if (new Set(componentes.map((c) => c.componenteId)).size !== componentes.length) {
    return { error: "Cada ingrediente só pode aparecer uma vez na composição." };
  }
  if (componentes.some((c) => c.componenteId === id)) {
    return { error: "Uma preparação não pode usar a si mesma como componente." };
  }

  let insumoId = id;

  try {
    if (configuracaoEtiqueta) {
      await prisma.configuracaoLoja.upsert({ where: { id: LOJA_ID }, create: { id: LOJA_ID }, update: {} });
    }
    if (id) {
      await prisma.$transaction(async (tx) => {
        await conferirUnidadesPorcoes(tx, componentes);
        await tx.$queryRaw`SELECT "id" FROM "Insumo" WHERE "id" = ${id} FOR UPDATE`;
        const anterior = await tx.insumo.findUniqueOrThrow({
          where: { id },
          select: {
            ativo: true,
            tipo: true,
            categoriaId: true,
            unidade: true,
            excluidoEm: true,
            conversoes: { select: { id: true } },
            etiquetaHabilitada: true,
            validadeSecoDias: true,
            validadeRefrigeradoDias: true,
            validadeCongeladoDias: true,
            validadeAposAbertoDias: true,
            conservacaoEtiquetaPadrao: true,
            versaoConfiguracaoEtiqueta: true,
          },
        });
        if (anterior.excluidoEm) throw new ErroInsumoExcluido("Este insumo foi excluído. Atualize a listagem.");
        if (anterior.unidade !== unidade && conversoes === undefined && anterior.conversoes.length > 0) {
          throw new Error("Revise as conversões ao alterar a unidade principal.");
        }
        const mudouEtiqueta = Boolean(configuracaoEtiqueta && (
          anterior.etiquetaHabilitada !== configuracaoEtiqueta.etiquetaHabilitada
          || anterior.validadeSecoDias !== configuracaoEtiqueta.validadeSecoDias
          || anterior.validadeRefrigeradoDias !== configuracaoEtiqueta.validadeRefrigeradoDias
          || anterior.validadeCongeladoDias !== configuracaoEtiqueta.validadeCongeladoDias
        ));
        const versaoEtiqueta = anterior.versaoConfiguracaoEtiqueta + (mudouEtiqueta ? 1 : 0);
        await tx.insumo.update({
          where: { id },
          data: {
            ...camposComuns,
            ...(mudouEtiqueta ? { versaoConfiguracaoEtiqueta: versaoEtiqueta, etiquetaAtualizadaPorId: sessao.userId } : {}),
            ...(dadosFoto ?? {}),
          },
        });
        if (mudouEtiqueta && configuracaoEtiqueta) {
          await tx.eventoAuditoriaEtiqueta.create({
            data: {
              lojaId: LOJA_ID,
              entidade: "Insumo",
              entidadeId: id,
              acao: "CONFIGURACAO_ETIQUETA_ALTERADA",
              usuarioId: sessao.userId,
              detalhes: {
                origem: origemConfiguracaoEtiqueta,
                versaoAnterior: anterior.versaoConfiguracaoEtiqueta,
                versaoNova: versaoEtiqueta,
                anterior: {
                  habilitada: anterior.etiquetaHabilitada,
                  validadeSecoDias: anterior.validadeSecoDias,
                  validadeRefrigeradoDias: anterior.validadeRefrigeradoDias,
                  validadeCongeladoDias: anterior.validadeCongeladoDias,
                  validadeAposAbertoDias: anterior.validadeAposAbertoDias,
                  conservacaoPadrao: anterior.conservacaoEtiquetaPadrao,
                },
                nova: configuracaoEtiqueta,
              },
            },
          });
        }
        if (conversoes !== undefined) {
          await tx.conversaoInsumo.deleteMany({ where: { insumoId: id } });
          if (conversoes.length) await tx.conversaoInsumo.createMany({ data: conversoes.map((conversao) => ({ insumoId: id, ...conversao })) });
        }
        await tx.composicaoInsumo.deleteMany({ where: { produtoId: id } });
        if (componentes.length > 0) {
          await tx.composicaoInsumo.createMany({
          data: componentes.map((c) => ({ produtoId: id, componenteId: c.componenteId, quantidade: c.quantidade, observacaoPorcao: c.observacaoPorcao, porcao: c.porcao ?? Prisma.DbNull })),
          });
        }
        await tx.insumoFornecedor.deleteMany({ where: { insumoId: id } });
        if (fornecedorIds.length > 0) {
          await tx.insumoFornecedor.createMany({
            data: fornecedorIds.map((fornecedorId) => ({ insumoId: id, fornecedorId })),
          });
        }
        const antes = { ativo: anterior.ativo, tipo: anterior.tipo, categoriaId: anterior.categoriaId, unidadeUso: anterior.unidade };
        const depois = { ativo: camposComuns.ativo, tipo: camposComuns.tipo, categoriaId: camposComuns.categoriaId, unidadeUso: camposComuns.unidade };
        const campos = (Object.keys(depois) as (keyof typeof depois)[]).filter(campo => antes[campo] !== depois[campo]);
        await registrarAtividade(tx, sessao, { modulo: "insumos", recurso: "insumos", acao: "INSUMO_EDITADO", entidade: "Insumo", entidadeId: id,
          resumo: "Cadastro de insumo ou preparação alterado.",
          ...(campos.length ? { antes: Object.fromEntries(campos.map(campo => [campo, antes[campo]])), depois: Object.fromEntries(campos.map(campo => [campo, depois[campo]])) } : {}),
        });
      });
    } else {
      await prisma.$transaction(async (tx) => {
        await conferirUnidadesPorcoes(tx, componentes);
        const criado = await tx.insumo.create({
          data: {
            ...camposComuns,
            ...(configuracaoEtiqueta ? { etiquetaAtualizadaPorId: sessao.userId } : {}),
            conversoes: { create: conversoes ?? [] },
            ...(dadosFoto ?? {}),
            componentes: {
              create: componentes.map((c) => ({ componenteId: c.componenteId, quantidade: c.quantidade, observacaoPorcao: c.observacaoPorcao, porcao: c.porcao ?? Prisma.DbNull })),
            },
          },
        });
        insumoId = criado.id;
        if (configuracaoEtiqueta) {
          await tx.eventoAuditoriaEtiqueta.create({
            data: {
              lojaId: LOJA_ID,
              entidade: "Insumo",
              entidadeId: criado.id,
              acao: "CONFIGURACAO_ETIQUETA_CRIADA",
              usuarioId: sessao.userId,
              detalhes: { origem: origemConfiguracaoEtiqueta, versaoNova: 1, nova: configuracaoEtiqueta },
            },
          });
        }
        if (fornecedorIds.length > 0) {
          await tx.insumoFornecedor.createMany({
            data: fornecedorIds.map((fornecedorId) => ({ insumoId: criado.id, fornecedorId })),
          });
        }
        await registrarAtividade(tx, sessao, { modulo: "insumos", recurso: "insumos", acao: "INSUMO_CRIADO", entidade: "Insumo", entidadeId: criado.id,
          resumo: "Insumo ou preparação criado.", depois: { ativo: camposComuns.ativo, tipo: camposComuns.tipo, categoriaId: camposComuns.categoriaId, unidadeUso: camposComuns.unidade } });
      });
    }
  } catch (error: unknown) {
    if (error instanceof ErroInsumoExcluido) return { error: error.message };
    if (error instanceof Error && ["Revise as conversões ao alterar a unidade principal.", ERRO_UNIDADE_PORCAO].includes(error.message)) return { error: error.message };
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { error: "Já existe um item com esse nome." };
    }
    return { error: "Não foi possível salvar o item. Tente novamente." };
  }

  revalidatePath("/insumos");
  revalidatePath("/compras");
  revalidatePath("/inventario", "layout");
  revalidatePath("/inventario/contagem", "layout");
  revalidatePath("/notas-fiscais");
  revalidatePath("/fornecedores");
  revalidatePath("/producao/etiquetas");
  const insumoSalvo = insumoId ? await prisma.insumo.findUnique({
    where: { id: insumoId },
    select: {
      id: true,
      nome: true,
      especificacao: true,
      unidade: true,
      custoMedio: true,
      categoriaId: true,
      fornecedorPrincipalId: true,
      fornecedoresHomologados: { select: { fornecedorId: true } },
    },
  }) : null;
  return {
    error: null,
    insumoId: insumoId || undefined,
    insumo: insumoSalvo ? {
      id: insumoSalvo.id,
      nome: insumoSalvo.nome,
      especificacao: insumoSalvo.especificacao,
      unidade: insumoSalvo.unidade,
      ...(podeConsultarCustos ? { custoMedio: Number(insumoSalvo.custoMedio) } : {}),
      categoriaId: insumoSalvo.categoriaId,
      fornecedorPrincipalId: insumoSalvo.fornecedorPrincipalId,
      fornecedorIds: [...new Set([
        ...insumoSalvo.fornecedoresHomologados.map((vinculo) => vinculo.fornecedorId),
        ...(insumoSalvo.fornecedorPrincipalId ? [insumoSalvo.fornecedorPrincipalId] : []),
      ])],
    } : undefined,
  };
}

export async function consultarExclusaoInsumoAction(id: string): Promise<{ error: string | null; vinculos?: VinculosExclusaoInsumo }> {
  await exigirPermissao("insumos", "excluir");
  try {
    const vinculos = (await consultarPlanoExclusaoInsumo(prisma, id))?.vinculos;
    return vinculos ? { error: null, vinculos } : { error: "Este item não está mais disponível. Atualize a listagem." };
  } catch {
    return { error: "Não foi possível verificar os vínculos. Volte e tente novamente." };
  }
}

export async function deleteInsumoAction(id: string, revisao?: string): Promise<{ error: string | null; vinculos?: VinculosExclusaoInsumo }> {
  const sessao = await exigirPermissao("insumos", "excluir");
  try {
    const resultado = await prisma.$transaction(tx => excluirInsumoPreservandoHistorico(tx, id, revisao, sessao), { timeout: 30000 });
    if (resultado.error) return resultado;
  } catch {
    return { error: "Não foi possível excluir. O item foi mantido. Atualize a página e tente novamente." };
  }
  revalidatePath("/insumos");
  revalidatePath("/fornecedores");
  revalidatePath("/compras");
  revalidatePath("/inventario", "layout");
  revalidatePath("/vendas", "layout");
  revalidatePath("/porcoes");
  revalidatePath("/producao/etiquetas");
  revalidatePath("/notas-fiscais");
  return { error: null };
}

export async function createCategoriaAction(nomeInput: string) {
  await exigirPermissao("insumos", "adicionar");
  const nome = nomeInput.trim();
  if (!nome) throw new Error("Informe um nome para a categoria.");
  const categoria = await prisma.categoria.upsert({ where: { nome }, update: {}, create: { nome } });
  revalidatePath("/insumos");
  return categoria;
}

export async function renameCategoriaAction(id: string, nomeInput: string) {
  await exigirPermissao("insumos", "editar");
  const nome = nomeInput.trim();
  if (!nome) throw new Error("Informe um nome para a categoria.");
  await prisma.categoria.update({ where: { id }, data: { nome } });
  revalidatePath("/insumos");
}

export async function deleteCategoriaAction(id: string): Promise<{ error: string | null }> {
  await exigirPermissao("insumos", "excluir");
  try {
    await prisma.categoria.delete({ where: { id } });
  } catch {
    return { error: "Não foi possível excluir. Verifique se não há itens usando esta categoria." };
  }
  revalidatePath("/insumos");
  return { error: null };
}

export async function createCentroCustoAction(nomeInput: string) {
  await exigirPermissao("insumos", "adicionar");
  const nome = nomeInput.trim();
  if (!nome) throw new Error("Informe um nome para o centro de custo.");
  const centroCusto = await prisma.centroCusto.upsert({ where: { nome }, update: {}, create: { nome } });
  revalidatePath("/insumos");
  return centroCusto;
}

export type ImportInsumoRow = {
  nome?: string;
  especificacao?: string;
  tipo?: string;
  categoria?: string;
  unidade?: string;
  centroCusto?: string;
  marca?: string;
  marcasHomologadas?: string;
  codigoEan?: string;
  perecivel?: string;
  validadePadraoDias?: string;
  estoqueMinimo?: string;
  estoqueMaximo?: string;
  custoMedio?: string;
  fornecedorPrincipal?: string;
  status?: string;
};

export type ImportSummary = {
  criados: number;
  atualizados: number;
  erros: { linha: number; mensagem: string }[];
};

function parseDecimalCsv(value: string | undefined) {
  const trimmed = (value ?? "").trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseIntCsv(value: string | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function importInsumosAction(rows: ImportInsumoRow[]): Promise<ImportSummary> {
  await exigirPermissao("insumos", "adicionar");
  await exigirPermissao("insumos", "editar");
  await exigirPermissao("financeiro.custos", "visualizar");
  const summary: ImportSummary = { criados: 0, atualizados: 0, erros: [] };
  const sessao = await getSession();
  if (!sessao) return { ...summary, erros: [{ linha: 0, mensagem: "Sua sessão expirou. Entre novamente." }] };

  for (let i = 0; i < rows.length; i++) {
    const linha = i + 2;
    const row = rows[i];
    const nome = (row.nome ?? "").trim();
    const tipoTexto = (row.tipo ?? "insumo").trim().toLowerCase();
    const unidade = (row.unidade ?? "").trim().toUpperCase() as UnidadeMedida;
    const statusTexto = (row.status ?? "").trim().toLowerCase();
    const fornecedorNome = (row.fornecedorPrincipal ?? "").trim();

    if (!nome) {
      summary.erros.push({ linha, mensagem: "Nome é obrigatório." });
      continue;
    }
    if ((row.especificacao?.trim().length ?? 0) > 300) {
      summary.erros.push({ linha, mensagem: "A especificação pode ter no máximo 300 caracteres." });
      continue;
    }
    const tipo: TipoProdutoGlobal = tipoTexto === "produto_intermediario" ? "PRODUTO_INTERMEDIARIO" : "INSUMO";
    if (!Object.values(UnidadeMedida).includes(unidade)) {
      summary.erros.push({ linha, mensagem: `Unidade inválida: "${row.unidade ?? ""}".` });
      continue;
    }

    const marcasInformadas = row.marcasHomologadas?.trim() ? lerMarcasJson(row.marcasHomologadas) : undefined;
    const marcasNovas = marcasInformadas ?? validarMarcas(row.marca?.trim() ? [row.marca] : []);
    if ("erro" in marcasNovas) {
      summary.erros.push({ linha, mensagem: marcasNovas.erro });
      continue;
    }

    try {
      let fornecedorPrincipalId: string | null = null;
      if (fornecedorNome) {
        const fornecedor = await prisma.fornecedor.findFirst({ where: { nome: fornecedorNome, tipoCadastro: "FORNECEDOR" } });
        if (!fornecedor) {
          summary.erros.push({ linha, mensagem: `Fornecedor "${fornecedorNome}" não encontrado.` });
          continue;
        }
        fornecedorPrincipalId = fornecedor.id;
      }

      const categoriaNome = (row.categoria ?? "").trim();
      const centroCustoNome = (row.centroCusto ?? "").trim();

      const categoriaId = categoriaNome
        ? (await prisma.categoria.upsert({ where: { nome: categoriaNome }, update: {}, create: { nome: categoriaNome } })).id
        : null;
      const centroCustoId = centroCustoNome
        ? (await prisma.centroCusto.upsert({ where: { nome: centroCustoNome }, update: {}, create: { nome: centroCustoNome } })).id
        : null;

      const data = {
        nome,
        especificacao: row.especificacao?.trim() || null,
        tipo,
        unidade,
        marca: marcasNovas.marcas[0] ?? null,
        marcasHomologadas: marcasNovas.marcas,
        codigoEan: row.codigoEan?.trim() || null,
        perecivel: (row.perecivel ?? "").trim().toLowerCase() === "sim",
        validadePadraoDias: parseIntCsv(row.validadePadraoDias),
        estoqueMinimo: parseDecimalCsv(row.estoqueMinimo) ?? 0,
        estoqueMaximo: parseDecimalCsv(row.estoqueMaximo),
        ...(tipo === "INSUMO" ? { custoMedio: parseDecimalCsv(row.custoMedio) ?? 0 } : {}),
        fornecedorPrincipalId,
        categoriaId,
        centroCustoId,
        ativo: statusTexto === "inativo" ? false : true,
      };

      const existente = await prisma.insumo.findFirst({ where: { nome, excluidoEm: null } });
      if (existente) {
        const atualizado = await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Insumo" WHERE "id" = ${existente.id} FOR UPDATE`;
          const atual = await tx.insumo.findUniqueOrThrow({ where: { id: existente.id, excluidoEm: null }, select: { unidade: true, marcasHomologadas: true, ativo: true, tipo: true, categoriaId: true } });
          if (atual.unidade !== unidade && await tx.conversaoInsumo.count({ where: { insumoId: existente.id } }) > 0) return { erro: "Edite a unidade e revise os fatores de conversão no cadastro do insumo." };
          // CSV antigo adiciona sua marca sem apagar outras homologações. A lista JSON explícita substitui o conjunto.
          const marcas = marcasInformadas ?? validarMarcas([...atual.marcasHomologadas, ...marcasNovas.marcas]);
          if ("erro" in marcas) return marcas;
          await tx.insumo.update({ where: { id: existente.id }, data: { ...data, marcasHomologadas: marcas.marcas, marca: marcas.marcas[0] ?? null } });
          const antes = { ativo: atual.ativo, tipo: atual.tipo, categoriaId: atual.categoriaId, unidadeUso: atual.unidade };
          const depois = { ativo: data.ativo, tipo: data.tipo, categoriaId: data.categoriaId, unidadeUso: data.unidade };
          const campos = (Object.keys(depois) as (keyof typeof depois)[]).filter(campo => antes[campo] !== depois[campo]);
          await registrarAtividade(tx, sessao, { modulo: "insumos", recurso: "insumos", acao: "INSUMO_IMPORTADO_EDITADO", entidade: "Insumo", entidadeId: existente.id,
            resumo: "Insumo atualizado por importação.",
            ...(campos.length ? { antes: Object.fromEntries(campos.map(campo => [campo, antes[campo]])), depois: Object.fromEntries(campos.map(campo => [campo, depois[campo]])) } : {}),
          });
          return { ok: true };
        });
        if ("erro" in atualizado) {
          summary.erros.push({ linha, mensagem: atualizado.erro });
          continue;
        }
        summary.atualizados++;
      } else {
        await prisma.$transaction(async tx => {
          const criado = await tx.insumo.create({ data });
          await registrarAtividade(tx, sessao, { modulo: "insumos", recurso: "insumos", acao: "INSUMO_IMPORTADO_CRIADO", entidade: "Insumo", entidadeId: criado.id,
            resumo: "Insumo criado por importação.", depois: { ativo: data.ativo, tipo: data.tipo, categoriaId: data.categoriaId, unidadeUso: data.unidade } });
        });
        summary.criados++;
      }
    } catch {
      summary.erros.push({ linha, mensagem: "Não foi possível salvar esta linha." });
    }
  }

  revalidatePath("/insumos");
  revalidatePath("/fornecedores");
  revalidatePath("/compras");
  return summary;
}
