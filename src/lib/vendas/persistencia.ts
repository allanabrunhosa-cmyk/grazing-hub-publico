import "server-only";
import { herdarParametrosFiscais } from "@/lib/tributacao/heranca";
import { prisma } from "@/lib/prisma";
import { Prisma, type UnidadeMedida } from "@/generated/prisma/client";
import { ErroCadastroVenda, validarCategoria, validarCategoriaComercial, validarCliente, validarGrupo, validarProduto, validarFiscal, limitesEfetivos, decimal, opcoesEfetivas, lerAjustesOpcoes, type ComposicaoComplemento } from "./dominio";
import { validarOrdem, conferirOrdem } from "./ordem";
import { permissaoEfetiva, type Permissoes, type Excecoes } from "@/lib/permissoes/catalogo";
import { RECURSOS_STATUS_VENDA, type TipoStatusVenda } from "./status-cadastro";
import { historicoFiscalGrupoJsonb, historicoFiscalJsonb, lerFiscalGrupoTexto, lerFiscalTexto, mesclarFiscalGrupoJsonb, mesclarFiscalJsonb } from "./fiscal-jsonb";
import { formatarNomesClienteNovo, preservarNomesNaMudancaTipo } from "./clientes-identidade";
import { conferirIdentidadeCliente } from "./clientes-unicidade";
import { conferirPreparacaoCliente, prepararClienteParaSalvar } from "./cliente-cobranca-servidor";

export type Autor = { userId: string; nome: string; versao?: number };
type Banco = Prisma.TransactionClient;
const fotografia = (valor: unknown) => JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
export async function historico(tx: Banco, autor: Autor, entidade: string, registroId: string, antes: unknown, depois: unknown) {
  await tx.historicoCadastroVenda.create({ data: { entidade, registroId, usuarioId: autor.userId, usuarioNome: autor.nome, antes: antes == null ? Prisma.DbNull : fotografia(antes), depois: fotografia(depois) } });
}
function conferirVersao(antes: { versao: number } | null, id: string, versao: number) {
  if (id && !antes) throw new ErroCadastroVenda("Cadastro não encontrado.");
  if (antes && antes.versao !== versao) throw new ErroCadastroVenda("Este cadastro foi alterado em outra tela. Reabra para conferir antes de salvar.");
}
export async function transacao<T>(operacao: (tx: Banco) => Promise<T>, timeout = 20000, conferirAcessos = false) {
  return prisma.$transaction(async tx => {
    if (conferirAcessos) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
    // Serializa vínculos, regras compartilhadas e ordenação, inclusive verificações de ciclos.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))::text`;
    return operacao(tx);
  }, { timeout });
}
export async function salvarCliente(entrada: unknown, autor: Autor) {
  const preparado = await prepararClienteParaSalvar(entrada);
  return transacao(tx => salvarClienteNaTransacao(tx, preparado.entrada, autor, "CADASTRO", preparado.comprovacao));
}
export async function salvarClienteNaTransacao(tx: Banco, entrada: unknown, autor: Autor, origem: "CADASTRO" | "LEGADO" = "CADASTRO", comprovacao?: object) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))::text`;
  let cliente = formatarNomesClienteNovo(validarCliente(entrada));
  const antes = cliente.id ? await tx.clienteVenda.findUnique({ where: { id: cliente.id } }) : null;
  if (!cliente.email && ((!cliente.id && origem !== "LEGADO") || antes?.email)) throw new ErroCadastroVenda("Informe o e-mail para identificar o cliente.");
  if (antes?.unificadoEmId) throw new ErroCadastroVenda("Este cadastro foi unificado. Abra o cadastro da empresa para editar.");
  if (antes) cliente = validarCliente(preservarNomesNaMudancaTipo({ ...antes, tipo: antes.tipo === "PJ" ? "PJ" : "PF" }, cliente));
  const { id, versao, regrasPagamento, entregaPadrao, ...validado } = cliente;
  conferirVersao(antes, id, versao);
  if (origem === "CADASTRO") conferirPreparacaoCliente(cliente, antes, comprovacao);
  await conferirIdentidadeCliente(tx, cliente);
  const dados = { ...validado, ...(entregaPadrao !== undefined ? { entregaPadrao: entregaPadrao === null ? Prisma.DbNull : fotografia(entregaPadrao) } : {}), ...(validado.dataNascimento !== undefined ? { dataNascimento: validado.dataNascimento ? new Date(`${validado.dataNascimento}T00:00:00Z`) : null } : {}) };
    if (regrasPagamento?.formasPagamentoIds?.length) {
      const formas = await tx.formaPagamentoVenda.count({ where: { id: { in: regrasPagamento.formasPagamentoIds } } });
      if (formas !== regrasPagamento.formasPagamentoIds.length) throw new ErroCadastroVenda("Há formas de pagamento indisponíveis. Reabra o cliente antes de salvar.");
    }
    // Entradas legadas não podem limpar restrições que desconhecem.
    const regras = regrasPagamento === undefined ? {} : { formasPagamentoHabilitadas: regrasPagamento.formasPagamentoIds ?? Prisma.DbNull,
      boletoDiasAposEntrega: regrasPagamento.boletoDiasAposEntrega, limiteCreditoAberto: regrasPagamento.limiteCreditoAberto };
    const depois = id ? await tx.clienteVenda.update({ where: { id }, data: { ...dados, ...regras, versao: { increment: 1 } } }) : await tx.clienteVenda.create({ data: { ...dados, ...regras } });
    await historico(tx, autor, "CLIENTE", depois.id, antes, depois);
    return depois.id;
}
export async function salvarCategoria(entrada: unknown, autor: Autor) {
  const { id, versao, ...dados } = validarCategoriaComercial(entrada);
  return transacao(async tx => {
    const antes = id ? await tx.categoriaVenda.findUnique({ where: { id } }) : null;
    conferirVersao(antes, id, versao);
    if (antes && dados.escopo && dados.escopo !== antes.escopo) throw new ErroCadastroVenda("O escopo da categoria não pode ser alterado.");
    const maior = await tx.categoriaVenda.aggregate({ where: { escopo: dados.escopo ?? antes?.escopo ?? "PRODUTO" }, _max: { ordem: true } });
    const depois = id ? await tx.categoriaVenda.update({ where: { id }, data: { ...dados, versao: { increment: 1 } } }) : await tx.categoriaVenda.create({ data: { ...dados, ordem: (maior._max.ordem ?? -1) + 1 } });
    await historico(tx, autor, "CATEGORIA", depois.id, antes, depois);
    return depois.id;
  });
}
export async function salvarCategoriaGrupo(entrada: unknown, autor: Autor) {
  const { id, versao, ...dados } = validarCategoria(entrada);
  return transacao(async tx => {
    const antes = id ? await tx.categoriaGrupoComplementoVenda.findUnique({ where: { id } }) : null;
    conferirVersao(antes, id, versao);
    const maior = await tx.categoriaGrupoComplementoVenda.aggregate({ _max: { ordem: true } });
    const depois = id ? await tx.categoriaGrupoComplementoVenda.update({ where: { id }, data: { ...dados, versao: { increment: 1 } } }) : await tx.categoriaGrupoComplementoVenda.create({ data: { ...dados, ordem: (maior._max.ordem ?? -1) + 1 } });
    await historico(tx, autor, "CATEGORIA_GRUPO", depois.id, antes, depois);
    return depois.id;
  });
}
export async function reordenarCategorias(entrada: unknown, autor: Autor, escopo = "PRODUTO") {
  if (!["PRODUTO", "COMPLEMENTO"].includes(escopo)) throw new ErroCadastroVenda("Escopo de categoria inválido.");
  const itens = validarOrdem(entrada);
  const ids = itens.map(i => i.id);
  return transacao(async tx => {
    const antes = await tx.categoriaVenda.findMany({ where: { escopo }, orderBy: [{ ordem: "asc" }, { id: "asc" }] });
    conferirOrdem(itens, antes);
    for (const [ordem, id] of ids.entries()) await tx.categoriaVenda.update({ where: { id }, data: { ordem, versao: { increment: 1 } } });
    await historico(tx, autor, "ORDEM_CATEGORIAS", "catalogo", antes.map(c => c.id), ids);
  });
}
export async function reordenarProdutos(categoriaId: string, entrada: unknown, autor: Autor) {
  if (typeof categoriaId !== "string" || !categoriaId || categoriaId.length > 100) throw new ErroCadastroVenda("Categoria inválida.");
  const itens = validarOrdem(entrada);
  return transacao(async tx => {
    const antes = await tx.produtoCategoriaVenda.findMany({ where: { categoriaId }, include: { produto: { select: { versao: true } } }, orderBy: [{ ordem: "asc" }, { produtoId: "asc" }] });
    conferirOrdem(itens, antes.map(v => ({ id: v.produtoId, versao: v.produto.versao })));
    if (!await tx.categoriaVenda.count({ where: { id: categoriaId } })) throw new ErroCadastroVenda("Categoria não encontrada.");
    for (const [ordem, item] of itens.entries()) {
      await tx.produtoCategoriaVenda.update({ where: { produtoId_categoriaId: { produtoId: item.id, categoriaId } }, data: { ordem } });
      await tx.produtoVenda.update({ where: { id: item.id }, data: { versao: { increment: 1 } } });
    }
    await historico(tx, autor, "ORDEM_PRODUTOS", categoriaId, antes.map(v => v.produtoId), itens.map(i => i.id));
  });
}
async function conferirComposicaoComplemento(tx: Banco, componentes: ComposicaoComplemento) {
  const insumos = await tx.insumo.findMany({ where: { id: { in: componentes.map(c => c.insumoId) } }, select: { id: true, ativo: true, unidade: true } });
  if (componentes.some(c => !insumos.some(i => i.id === c.insumoId && i.ativo && i.unidade === c.unidade))) throw new ErroCadastroVenda("Ingrediente indisponível ou unidade alterada na composição do complemento.");
}
export async function salvarGrupo(entrada: unknown, autor: Autor) {
  return transacao(tx => salvarGrupoNaTransacao(tx, entrada, autor));
}
/** Transação externa já autorizada: preserva a validação e auditoria do serviço comercial. */
export async function salvarGrupoNaTransacao(tx: Banco, entrada: unknown, autor: Autor) {
  const { id, versao, opcoes, ...dados } = validarGrupo(entrada);
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))::text`;
    const antes = id ? await tx.grupoComplementoVenda.findUnique({ where: { id }, include: { opcoes: true } }) : null;
    conferirVersao(antes, id, versao);
    if (dados.categoriaId && !await tx.categoriaGrupoComplementoVenda.count({ where: { id: dados.categoriaId, ativo: true } })) throw new ErroCadastroVenda("Categoria de complementos indisponível.");
    if (antes?.tipo === "EXTRAS" && dados.tipo !== "EXTRAS") throw new ErroCadastroVenda("O grupo padrão de Extras deve permanecer opcional e ilimitado.");
    const destinos = opcoes.map(o => o.produtoId).filter((v): v is string => !!v);
    const vinculosProprios = id ? await tx.produtoGrupoVenda.findMany({ where: { grupoId: id, produtoId: { in: destinos } } }) : [];
    if (vinculosProprios.some(v => opcoes.some(o => o.ativo && o.produtoId === v.produtoId && (!o.id || !v.opcoesExcluidas.includes(o.id))))) throw new ErroCadastroVenda("Um produto não pode ser opção de um grupo que ele mesmo contém.");
    const produtos = await tx.produtoVenda.findMany({ where: { id: { in: destinos } }, include: { _count: { select: { grupos: true } } } });
    if (destinos.some(destino => !produtos.some(p => p.id === destino && (p.ativo || antes?.opcoes.some(o => o.produtoId === destino))))) throw new ErroCadastroVenda("Vincule opções a produtos ativos. Vínculos existentes inativos são preservados para revisão.");
    if (opcoes.some(o => o.id && !antes?.opcoes.some(a => a.id === o.id))) throw new ErroCadastroVenda("Uma opção não pertence a este grupo.");
    const depois = id ? await tx.grupoComplementoVenda.update({ where: { id }, data: { ...dados, versao: { increment: 1 } } }) : await tx.grupoComplementoVenda.create({ data: dados });
    // Opções retiradas ficam inativas, preservando identidade e histórico.
    await tx.opcaoComplementoVenda.updateMany({ where: { grupoId: depois.id, id: { notIn: opcoes.map(o => o.id).filter(Boolean) } }, data: { ativo: false } });
    for (const [ordem, opcao] of opcoes.entries()) {
      const { id: opcaoId, composicao, ...base } = opcao;
      const valores = { ...base, ...(composicao === undefined ? {} : { composicao: composicao === null ? Prisma.DbNull : fotografia(composicao) }) };
      if (composicao) await conferirComposicaoComplemento(tx, composicao);
      if (opcaoId) await tx.opcaoComplementoVenda.update({ where: { id: opcaoId }, data: { ...valores, ordem } });
      else await tx.opcaoComplementoVenda.create({ data: { ...valores, grupoId: depois.id, ordem } });
    }
    if (dados.tipo === "EXTRAS") await tx.produtoGrupoVenda.updateMany({ where: { grupoId: depois.id }, data: { usarPadrao: true, minimo: 0, maximo: null } });
    await historico(tx, autor, "GRUPO", depois.id, antes, await tx.grupoComplementoVenda.findUnique({ where: { id: depois.id }, include: { opcoes: true } }));
    return depois.id;
}
export async function salvarProduto(entrada: unknown, autor: Autor, dadosFiscais?: { fiscal: unknown; revisado: boolean; grupoFiscalId: string | null }) {
  if (dadosFiscais && (typeof dadosFiscais.revisado !== "boolean" || (dadosFiscais.grupoFiscalId != null && (typeof dadosFiscais.grupoFiscalId !== "string" || !dadosFiscais.grupoFiscalId || dadosFiscais.grupoFiscalId.length > 100)))) throw new ErroCadastroVenda("Grupo fiscal inválido.");
  const { id, versao, categorias, grupos, componentes, novoVinculoComplemento, pausasComplementos, ...dados } = validarProduto(entrada);
  const fiscal = dadosFiscais ? validarFiscal(dadosFiscais.fiscal, dadosFiscais.revisado) : undefined;
  return transacao(async tx => {
    const antes = id ? await tx.produtoVenda.findUnique({ where: { id }, include: { categorias: true, grupos: true, componentes: true } }) : null;
    conferirVersao(antes, id, versao);
    const fiscalAntesTexto = id ? await lerFiscalTexto(tx, id) : null;
    if (dados.tipoEmbalagemId && !await tx.tipoEmbalagemVenda.count({ where: { id: dados.tipoEmbalagemId, ...(dados.tipoEmbalagemId === antes?.tipoEmbalagemId ? {} : { ativo: true }) } })) throw new ErroCadastroVenda("Escolha um tipo de embalagem ativo existente.");
    if (dados.fotoUrl && !await tx.fotoProdutoVenda.count({ where: { id: dados.fotoUrl.split("/").pop() } })) throw new ErroCadastroVenda("Foto não encontrada. Envie a imagem novamente.");
    const categoriasAtuais = await tx.categoriaVenda.findMany({ where: { id: { in: categorias } } });
    const escopo = dados.classificacoes?.includes("PRINCIPAL") ? "PRODUTO" : "COMPLEMENTO";
    if (categoriasAtuais.some(c => c.escopo !== escopo)) throw new ErroCadastroVenda("Escolha categorias da classificação do cadastro.");
    if (categorias.some(c => !categoriasAtuais.some(a => a.id === c && (a.ativo || antes?.categorias.some(v => v.categoriaId === c))))) throw new ErroCadastroVenda("Escolha categorias ativas existentes.");
    const gruposAtuais = await tx.grupoComplementoVenda.findMany({ where: { id: { in: grupos.map(g => g.grupoId) } }, include: { opcoes: true } });
    if (grupos.some(g => !gruposAtuais.some(a => a.id === g.grupoId && (a.ativo || antes?.grupos.some(v => v.grupoId === g.grupoId))))) throw new ErroCadastroVenda("Escolha grupos ativos existentes.");
    if (id && grupos.some(v => gruposAtuais.some(g => g.id === v.grupoId && g.opcoes.some(o => o.ativo && o.produtoId === id && !v.opcoesExcluidas?.includes(o.id))))) throw new ErroCadastroVenda("Um produto não pode ser opção de um grupo que ele mesmo contém.");
    for (const vinculo of grupos) {
      const grupo = gruposAtuais.find(g => g.id === vinculo.grupoId)!;
      if (vinculo.opcoesExcluidas?.some(id => !grupo.opcoes.some(o => o.id === id))) throw new ErroCadastroVenda("Uma opção desmarcada não pertence ao grupo informado.");
      const ajustes = vinculo.ajustesOpcoes ?? lerAjustesOpcoes(antes?.grupos.find(g => g.grupoId === vinculo.grupoId)?.ajustesOpcoes);
      vinculo.ajustesOpcoes = ajustes;
      if (ajustes.some(a => !grupo.opcoes.some(o => o.id === a.opcaoId))) throw new ErroCadastroVenda("Um ajuste não pertence ao grupo informado.");
      for (const a of ajustes) if (a.composicao) await conferirComposicaoComplemento(tx, a.composicao);
      const disponiveis = opcoesEfetivas(grupo.opcoes.map(o => ({ ...o, preco: o.preco.toString() })), vinculo).filter(o => o.ativo);
      const limites = limitesEfetivos(grupo, vinculo);
      if (limites.minimo > 0 && (!disponiveis.length || (!grupo.repetir && limites.minimo > disponiveis.length))) throw new ErroCadastroVenda(`${grupo.nome}: o mínimo excede as opções disponíveis neste produto.`);
    }
    const grupoDestino = novoVinculoComplemento ? await tx.grupoComplementoVenda.findUnique({ where: { id: novoVinculoComplemento.grupoId }, include: { opcoes: true } }) : null;
    if (novoVinculoComplemento && (!grupoDestino?.ativo || !dados.classificacoes?.includes("COMPLEMENTO"))) throw new ErroCadastroVenda("Escolha um grupo ativo para o complemento.");
    if (grupoDestino?.opcoes.some(o => o.nome.toLocaleLowerCase("pt-BR") === dados.nome.toLocaleLowerCase("pt-BR"))) throw new ErroCadastroVenda("Este grupo já contém uma opção com esse nome. Edite o vínculo pelo grupo.");
    const insumos = await tx.insumo.findMany({ where: { id: { in: componentes.map(c => c.insumoId) } }, select: { id: true, ativo: true, unidade: true } });
    for (const c of componentes) {
      const insumo = insumos.find(i => i.id === c.insumoId);
      if (!insumo?.ativo || insumo.unidade !== c.unidade) throw new ErroCadastroVenda("Ingrediente indisponível ou unidade alterada. Confira a composição; quantidades usam a unidade de controle do insumo.");
    }
    if (dadosFiscais?.grupoFiscalId && !await tx.grupoFiscalVenda.count({ where: { id: dadosFiscais.grupoFiscalId, ...(dadosFiscais.grupoFiscalId === antes?.grupoFiscalId ? {} : { ativo: true }) } })) throw new ErroCadastroVenda("Grupo fiscal indisponível.");
    if (id && fiscal) await mesclarFiscalJsonb(tx, id, fiscal);
    const dadosCompletos = { ...dados, ...(dadosFiscais ? { ...(!id ? { fiscal } : {}), fiscalRevisado: dadosFiscais.revisado, grupoFiscalId: dadosFiscais.grupoFiscalId } : {}) };
    const depois = id ? await tx.produtoVenda.update({ where: { id }, data: { ...dadosCompletos, versao: { increment: 1 } } }) : await tx.produtoVenda.create({ data: dadosCompletos });
    if (dadosFiscais) await historicoFiscalJsonb(tx, autor, "FISCAL", depois.id, antes ? { revisado: antes.fiscalRevisado, grupoFiscalId: antes.grupoFiscalId } : null, { revisado: dadosFiscais.revisado, grupoFiscalId: dadosFiscais.grupoFiscalId }, fiscalAntesTexto);
    if (grupoDestino && novoVinculoComplemento) {
      await tx.opcaoComplementoVenda.create({ data: { grupoId: grupoDestino.id, produtoId: depois.id, nome: dados.nome, preco: novoVinculoComplemento.preco, quantidade: 1, ordem: Math.max(-1, ...grupoDestino.opcoes.map(o => o.ordem)) + 1 } });
      await tx.grupoComplementoVenda.update({ where: { id: grupoDestino.id }, data: { versao: { increment: 1 } } });
      await historico(tx, autor, "GRUPO", grupoDestino.id, grupoDestino, await tx.grupoComplementoVenda.findUnique({ where: { id: grupoDestino.id }, include: { opcoes: true } }));
    }
    if (pausasComplementos?.length) {
      const usuario = await tx.usuario.findUnique({ where: { id: autor.userId }, include: { perfilAcesso: true } });
      if (!usuario?.ativo || usuario.excluidoEm || (autor.versao !== undefined && usuario.sessaoVersao !== autor.versao)) throw new ErroCadastroVenda("Sua sessão foi encerrada.");
      if (usuario.perfilAcesso?.sistema !== "ADMINISTRADOR" && !["vendas.catalogo", "vendas.produtos"].every(r => permissaoEfetiva((usuario.perfilAcesso?.permissoes ?? {}) as Permissoes, usuario.permissoesPersonalizadas as Excecoes, r, "editar"))) throw new ErroCadastroVenda("Seu acesso não permite pausar em todos os produtos.");
      const afetados = new Map<string, Awaited<ReturnType<typeof tx.grupoComplementoVenda.findUniqueOrThrow>>>();
      const operacoes = [];
      const alvos = new Set<string>();
      for (const pausa of pausasComplementos) {
        const opcao = await tx.opcaoComplementoVenda.findUnique({ where: { id: pausa.opcaoId } });
        if (!opcao || !gruposAtuais.some(g => g.opcoes.some(o => o.id === opcao.id))) throw new ErroCadastroVenda("Complemento indisponível neste produto.");
        const alvo = opcao.produtoId ?? opcao.id;
        if (alvos.has(alvo)) throw new ErroCadastroVenda("Há decisões repetidas para o mesmo complemento.");
        alvos.add(alvo);
        const opcoes = await tx.opcaoComplementoVenda.findMany({ where: opcao.produtoId ? { produtoId: opcao.produtoId } : { id: opcao.id } });
        const ids = [...new Set(opcoes.map(o => o.grupoId))];
        if (ids.length !== pausa.grupos.length || pausa.grupos.some(g => !ids.includes(g.id))) throw new ErroCadastroVenda("Os vínculos do complemento mudaram. Reabra o produto.");
        for (const ref of pausa.grupos) {
          const grupo = await tx.grupoComplementoVenda.findUniqueOrThrow({ where: { id: ref.id }, include: { opcoes: true } });
          conferirVersao(grupo, ref.id, ref.versao);
          afetados.set(grupo.id, grupo);
        }
        operacoes.push({ opcoes, ativo: pausa.ativo });
      }
      for (const operacao of operacoes) await tx.opcaoComplementoVenda.updateMany({ where: { id: { in: operacao.opcoes.map(o => o.id) } }, data: { ativo: operacao.ativo } });
      for (const [grupoId, antesGrupo] of afetados) {
        await tx.grupoComplementoVenda.update({ where: { id: grupoId }, data: { versao: { increment: 1 } } });
        await historico(tx, autor, "PAUSA_COMPLEMENTO_GLOBAL", grupoId, antesGrupo, await tx.grupoComplementoVenda.findUniqueOrThrow({ where: { id: grupoId }, include: { opcoes: true } }));
      }
    }
    const ordens = new Map(antes?.categorias.map(c => [c.categoriaId, c.ordem]));
    await tx.produtoCategoriaVenda.deleteMany({ where: { produtoId: depois.id } });
    await tx.produtoGrupoVenda.deleteMany({ where: { produtoId: depois.id } });
    await tx.componenteProdutoVenda.deleteMany({ where: { produtoId: depois.id } });
    for (const categoriaId of categorias) {
      const ordem = ordens.get(categoriaId) ?? ((await tx.produtoCategoriaVenda.aggregate({ where: { categoriaId }, _max: { ordem: true } }))._max.ordem ?? -1) + 1;
      await tx.produtoCategoriaVenda.create({ data: { produtoId: depois.id, categoriaId, ordem } });
    }
    for (const [ordem, g] of grupos.entries()) {
      const grupo = gruposAtuais.find(a => a.id === g.grupoId)!;
      await tx.produtoGrupoVenda.create({ data: { ...g, ajustesOpcoes: fotografia(g.ajustesOpcoes ?? []), ...limitesEfetivos(grupo, g), usarPadrao: grupo.tipo === "EXTRAS", produtoId: depois.id, ordem } });
    }
    for (const [ordem, c] of componentes.entries()) await tx.componenteProdutoVenda.create({ data: { ...c, porcao: c.porcao ?? Prisma.DbNull, unidade: c.unidade as UnidadeMedida, produtoId: depois.id, ordem } });
    await historicoFiscalJsonb(tx, autor, "PRODUTO", depois.id, antes, await tx.produtoVenda.findUnique({ where: { id: depois.id }, include: { categorias: true, grupos: true, componentes: true } }), fiscalAntesTexto);
    return depois.id;
  }, 20000, Boolean(pausasComplementos?.length));
}
export async function alterarSituacaoProduto(id: string, versao: number, ativo: boolean, autor: Autor) {
  return alterarStatusCadastroVenda("PRODUTO", id, versao, ativo, autor);
}

/** Altera exclusivamente o booleano já editável; não propaga para vínculos nem regrava cadastros. */
export async function alterarStatusCadastroVenda(tipo: TipoStatusVenda, id: string, versao: number, ativo: boolean, autor: Autor) {
  if (typeof id !== "string" || !id || id.length > 100 || !Number.isSafeInteger(versao) || versao < 1 || typeof ativo !== "boolean") throw new ErroCadastroVenda("Situação do produto inválida.");
  if (!Object.hasOwn(RECURSOS_STATUS_VENDA, tipo)) throw new ErroCadastroVenda("Tipo de cadastro inválido.");
  return transacao(async tx => {
    const modelos = { PRODUTO: tx.produtoVenda, CLIENTE: tx.clienteVenda, CATEGORIA: tx.categoriaVenda, GRUPO: tx.grupoComplementoVenda, CATEGORIA_GRUPO: tx.categoriaGrupoComplementoVenda, GRUPO_FISCAL: tx.grupoFiscalVenda, FORMA_PAGAMENTO: tx.formaPagamentoVenda };
    // Adaptadores concretos preservam os tipos Prisma sem aceitar nome de tabela do cliente.
    const selecionar = {
      FORMA_PAGAMENTO: () => modelos.FORMA_PAGAMENTO.findUnique({ where: { id } }),
      PRODUTO: () => modelos.PRODUTO.findUnique({ where: { id } }), CLIENTE: () => modelos.CLIENTE.findUnique({ where: { id } }),
      CATEGORIA: () => modelos.CATEGORIA.findUnique({ where: { id } }), GRUPO: () => modelos.GRUPO.findUnique({ where: { id } }),
      CATEGORIA_GRUPO: () => modelos.CATEGORIA_GRUPO.findUnique({ where: { id } }), GRUPO_FISCAL: () => modelos.GRUPO_FISCAL.findUnique({ where: { id } }),
    };
    const data = { ativo, versao: { increment: 1 } };
    const atualizar = {
      FORMA_PAGAMENTO: () => modelos.FORMA_PAGAMENTO.update({ where: { id }, data }),
      PRODUTO: () => modelos.PRODUTO.update({ where: { id }, data }), CLIENTE: () => modelos.CLIENTE.update({ where: { id }, data }),
      CATEGORIA: () => modelos.CATEGORIA.update({ where: { id }, data }), GRUPO: () => modelos.GRUPO.update({ where: { id }, data }),
      CATEGORIA_GRUPO: () => modelos.CATEGORIA_GRUPO.update({ where: { id }, data }), GRUPO_FISCAL: () => modelos.GRUPO_FISCAL.update({ where: { id }, data }),
    };
    const antes = await selecionar[tipo]();
    if (tipo === "CLIENTE" && antes && "unificadoEmId" in antes && antes.unificadoEmId) throw new ErroCadastroVenda("Este cadastro foi unificado. Abra o cadastro principal para alterar sua situação.");
    conferirVersao(antes, id, versao);
    const depois = await atualizar[tipo]();
    await historico(tx, autor, `SITUACAO_${tipo}`, id, antes, depois);
    return { versao: depois.versao, ativo: depois.ativo };
  });
}
export async function criarCanalVenda(nomeEntrada: unknown, autor: Autor) {
  const nome = typeof nomeEntrada === "string" ? nomeEntrada.trim().toLocaleUpperCase("pt-BR") : "";
  if (!nome || nome.length > 60) throw new ErroCadastroVenda("Informe o nome do canal, com até 60 caracteres.");
  return transacao(async tx => {
    if (await tx.canalVenda.count({ where: { nome } })) throw new ErroCadastroVenda("Este canal já está cadastrado.");
    const maior = await tx.canalVenda.aggregate({ _max: { ordem: true } });
    const canal = await tx.canalVenda.create({ data: { nome, ordem: (maior._max.ordem ?? -1) + 1 } });
    await historico(tx, autor, "CANAL", canal.id, null, canal);
    return canal;
  });
}
export async function alterarPrecoProduto(id: string, versao: number, valor: string, autor: Autor) {
  if (typeof id !== "string" || !id || !Number.isSafeInteger(versao) || versao < 1) throw new ErroCadastroVenda("Preço do produto inválido.");
  const preco = decimal(valor, "Preço", true);
  return transacao(async tx => {
    const antes = await tx.produtoVenda.findUnique({ where: { id } });
    conferirVersao(antes, id, versao);
    const depois = await tx.produtoVenda.update({ where: { id }, data: { preco, versao: { increment: 1 } } });
    await historico(tx, autor, "PRECO_PRODUTO", id, { preco: antes!.preco.toString(), versao }, { preco, versao: depois.versao });
    return { versao: depois.versao };
  });
}
export async function salvarFiscalProduto(id: string, versao: number, entrada: unknown, revisado: boolean, autor: Autor, grupoFiscalId: string | null = null) {
  return transacao(tx => salvarFiscalProdutoNaTransacao(tx, id, versao, entrada, revisado, autor, grupoFiscalId));
}
/** Reutiliza validação, controle de versão e auditoria em cargas fiscais atômicas. */
export async function salvarFiscalProdutoNaTransacao(tx: Banco, id: string, versao: number, entrada: unknown, revisado: boolean, autor: Autor, grupoFiscalId: string | null = null, opcoes?: { preservarNcm?: boolean }) {
  if (typeof id !== "string" || !id || !Number.isInteger(versao) || typeof revisado !== "boolean") throw new ErroCadastroVenda("Dados fiscais inválidos.");
  const fiscal = validarFiscal(entrada, revisado);
  const patch = opcoes?.preservarNcm ? Object.fromEntries(Object.entries(fiscal).filter(([k]) => k !== "ncm")) : fiscal;
    const antes = await tx.produtoVenda.findUnique({ where: { id } });
    conferirVersao(antes, id, versao);
    if (grupoFiscalId && !await tx.grupoFiscalVenda.count({ where: { id: grupoFiscalId, ativo: true } })) throw new ErroCadastroVenda("Grupo fiscal indisponível.");
    const fiscalAntesTexto = await lerFiscalTexto(tx, id);
    await mesclarFiscalJsonb(tx, id, patch);
    const depois = await tx.produtoVenda.update({ where: { id }, data: { fiscalRevisado: revisado, grupoFiscalId, versao: { increment: 1 } } });
    await historicoFiscalJsonb(tx, autor, "FISCAL", id, { revisado: antes!.fiscalRevisado, grupoFiscalId: antes!.grupoFiscalId }, { revisado, grupoFiscalId }, fiscalAntesTexto);
    return { id: depois.id, versao: depois.versao };
}

export async function salvarGrupoFiscal(entrada: { id: string; versao: number; nome: string; fiscal: unknown; ativo: boolean; atualizarVinculados?: boolean }, autor: Autor) {
  return transacao(tx => salvarGrupoFiscalNaTransacao(tx, entrada, autor));
}
/** O chamador do lote confere autorização e os mesmos locks antes da escrita. */
export async function salvarGrupoFiscalNaTransacao(tx: Banco, entrada: { id: string; versao: number; nome: string; fiscal: unknown; ativo: boolean; atualizarVinculados?: boolean }, autor: Autor) {
  const nome = entrada && typeof entrada.nome === "string" ? entrada.nome.trim() : "";
  if (!nome || nome.length > 120 || !Number.isSafeInteger(entrada.versao) || typeof entrada.ativo !== "boolean") throw new ErroCadastroVenda("Informe nome e situação do grupo fiscal.");
  const fiscal = validarFiscal(entrada.fiscal, false);
    const antes = entrada.id ? await tx.grupoFiscalVenda.findUnique({ where: { id: entrada.id } }) : null;
    conferirVersao(antes, entrada.id, entrada.versao);
    const fiscalGrupoAntes = antes ? await lerFiscalGrupoTexto(tx, antes.id) : null;
    if (antes) await mesclarFiscalGrupoJsonb(tx, antes.id, fiscal);
    const depois = entrada.id ? await tx.grupoFiscalVenda.update({ where: { id: entrada.id }, data: { nome, ativo: entrada.ativo, versao: { increment: 1 } } }) : await tx.grupoFiscalVenda.create({ data: { nome, fiscal, ativo: entrada.ativo } });
    if (entrada.atualizarVinculados && antes) {
      const vinculados = await tx.produtoVenda.findMany({ where: { grupoFiscalId: depois.id } });
      for (const produto of vinculados) {
        const fiscalAntesTexto = await lerFiscalTexto(tx, produto.id), individual = JSON.parse(fiscalAntesTexto) as Record<string, string>;
        const herdado = herdarParametrosFiscais(fiscal, individual);
        const patch = Object.fromEntries(Object.keys(fiscal).filter(k => herdado[k] !== individual[k]).map(k => [k, herdado[k]]));
        await mesclarFiscalJsonb(tx, produto.id, patch);
        await tx.produtoVenda.update({ where: { id: produto.id }, data: { fiscalRevisado: false, versao: { increment: 1 } } });
        await historicoFiscalJsonb(tx, autor, "FISCAL", produto.id, { revisado: produto.fiscalRevisado, grupoFiscalId: depois.id }, { revisado: false, grupoFiscalId: depois.id }, fiscalAntesTexto);
      }
    }
    await historicoFiscalGrupoJsonb(tx, autor, depois.id, antes, depois, fiscalGrupoAntes);
    return depois.id;
}
export async function excluirCadastroVenda(tipo: "PRODUTO" | "CATEGORIA" | "GRUPO" | "CATEGORIA_GRUPO" | "GRUPO_FISCAL", id: string, versao: number, autor: Autor) {
  if (!id || typeof id !== "string" || id.length > 100 || !Number.isSafeInteger(versao) || versao < 1) throw new ErroCadastroVenda("Cadastro para exclusão inválido.");
  return transacao(async tx => {
    if (tipo === "PRODUTO") {
      const antes = await tx.produtoVenda.findUnique({ where: { id }, include: { categorias: true, grupos: true, componentes: true, comoOpcao: true } });
      conferirVersao(antes, id, versao);
      if (antes!.comoOpcao.length) throw new ErroCadastroVenda("Este produto participa de grupos de complementos. Retire esses vínculos antes de excluí-lo.");
      if (await tx.itemPedidoVenda.count({ where: { produtoId: id } })) throw new ErroCadastroVenda("Este produto já integra pedidos. Inative-o para preservar o histórico comercial.");
      await tx.produtoCategoriaVenda.deleteMany({ where: { produtoId: id } });
      await tx.produtoGrupoVenda.deleteMany({ where: { produtoId: id } });
      await tx.precoProdutoVenda.deleteMany({ where: { produtoId: id } });
      await tx.componenteProdutoVenda.deleteMany({ where: { produtoId: id } });
      await tx.identidadeExternaVenda.deleteMany({ where: { entidade: "PRODUTO", destinoId: id } });
      await tx.produtoVenda.delete({ where: { id } });
      await historico(tx, autor, "EXCLUSAO_PRODUTO", id, antes, { excluido: true });
    } else if (tipo === "CATEGORIA") {
      const antes = await tx.categoriaVenda.findUnique({ where: { id }, include: { produtos: true } });
      conferirVersao(antes, id, versao);
      for (const vinculo of antes!.produtos) {
        await tx.produtoCategoriaVenda.delete({ where: { produtoId_categoriaId: { produtoId: vinculo.produtoId, categoriaId: id } } });
        await tx.produtoVenda.update({ where: { id: vinculo.produtoId }, data: { versao: { increment: 1 } } });
      }
      await tx.identidadeExternaVenda.deleteMany({ where: { entidade: "CATEGORIA", destinoId: id } });
      await tx.categoriaVenda.delete({ where: { id } });
      await historico(tx, autor, "EXCLUSAO_CATEGORIA", id, antes, { excluido: true, produtosDesvinculados: antes!.produtos.map(p => p.produtoId) });
    } else if (tipo === "GRUPO") {
      const antes = await tx.grupoComplementoVenda.findUnique({ where: { id }, include: { produtos: true, opcoes: true } });
      conferirVersao(antes, id, versao);
      if (antes!.tipo === "EXTRAS") throw new ErroCadastroVenda("O grupo padrão Extras não pode ser excluído.");
      await tx.produtoGrupoVenda.deleteMany({ where: { grupoId: id } });
      await tx.opcaoComplementoVenda.deleteMany({ where: { grupoId: id } });
      await tx.identidadeExternaVenda.deleteMany({ where: { entidade: { in: ["GRUPO", "OPCAO"] }, destinoId: { in: [id, ...antes!.opcoes.map(o => o.id)] } } });
      await tx.grupoComplementoVenda.delete({ where: { id } });
      await historico(tx, autor, "EXCLUSAO_GRUPO", id, antes, { excluido: true });
    } else if (tipo === "CATEGORIA_GRUPO") {
      const antes = await tx.categoriaGrupoComplementoVenda.findUnique({ where: { id }, include: { grupos: { select: { id: true } } } });
      conferirVersao(antes, id, versao);
      await tx.grupoComplementoVenda.updateMany({ where: { categoriaId: id }, data: { categoriaId: null } });
      await tx.categoriaGrupoComplementoVenda.delete({ where: { id } });
      await historico(tx, autor, "EXCLUSAO_CATEGORIA_GRUPO", id, antes, { excluido: true });
    } else {
      const antes = await tx.grupoFiscalVenda.findUnique({ where: { id }, include: { produtos: { select: { id: true } } } });
      conferirVersao(antes, id, versao);
      if (antes!.codigo) throw new ErroCadastroVenda("Grupo operacional fiscal não pode ser excluído; inative-o preservando a organização e o histórico.");
      await tx.produtoVenda.updateMany({ where: { grupoFiscalId: id }, data: { grupoFiscalId: null, versao: { increment: 1 } } });
      await tx.grupoFiscalVenda.delete({ where: { id } });
      await historico(tx, autor, "EXCLUSAO_GRUPO_FISCAL", id, antes, { excluido: true });
    }
  });
}
export function mensagemErroCadastro(erro: unknown) {
  if (erro instanceof ErroCadastroVenda) return erro.message;
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") return "Já existe um cadastro com esse nome, documento ou código. Confira antes de salvar.";
  return "Não foi possível salvar. O preenchimento foi preservado; atualize a página se houver uma publicação em andamento.";
}
