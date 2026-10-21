import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { historico, salvarClienteNaTransacao, type Autor } from "./persistencia";
import { transacaoHistorica, type ContextoImportacaoHistorica } from "./historico-importacao";
import { hashCanonico, identidadeComprador, validarPacoteHistorico, ORIGEM_HISTORICA, LOJA_HISTORICA, type RegistroHistorico } from "./historico-dominio";
import { classificarNaturezaCliente, formatarNomeCliente } from "./clientes-identidade";
import { referenciaEmpresaHistorica, nomesEmpresariaisEquivalentes, validarManifestoEmpresasHistoricas, type EmpresaCorrecaoHistorica } from "./clientes-correcao-dominio";

type Tx = Prisma.TransactionClient;
type Cliente = Prisma.ClienteVendaGetPayload<Record<string, never>>;
type Contato = Prisma.ContatoClienteVendaGetPayload<Record<string, never>>;
type FontePedido = { id: string; chave: string; destinoId: string; resumoOrigem: string; versaoDestino: number; loteId: string | null; hashLinha: string | null; rawValores: unknown };
type Entrada = ContextoImportacaoHistorica & { pacote: unknown; manifesto: unknown };
type DadosCliente = Partial<Pick<Cliente, "nome" | "tipo" | "documento" | "razaoSocial" | "primeiroNome" | "sobrenome" | "nomeContato" | "sobrenomeContato" | "contato" | "ativo" | "unificadoEmId">>;
type Linha = { chave: string; clienteOrigemId: string; numerosOriginais: string[]; registro: RegistroHistorico;
  numerosVinculados: string[];
  companyRefs: string[]; empresa: EmpresaCorrecaoHistorica | null; natureza: "PF" | "PJ"; modificavel: boolean;
  pendencias: string[]; dados: DadosCliente; canonico: string | null; aliasSeguro: boolean; nomePessoal: string; primeiroNome: string | null; sobrenome: string | null };
type FotoFonte = { id: string; destinoId: string; resumoOrigem: string; versaoDestino: number };
type FotoPedido = { id: string; clienteId: string | null; versao: number };
type Recibo = { tipo: "CORRECAO_CLIENTES_HISTORICOS_V1"; loteId: string; hashEntrada: string; token: string;
  clientes: { antes: Cliente | null; depois: Cliente }[]; contatos: { antes: Contato | null; depois: Contato }[];
  pedidos: { antes: FotoPedido; depois: FotoPedido; fonteAntes: FotoFonte; fonteDepois: FotoFonte }[];
  fontesClientes: { antes: FotoFonte; depois: FotoFonte }[]; contagens: Record<string, number> };
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const obj = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const fonteFoto = (v: FotoFonte): FotoFonte => ({ id: v.id, destinoId: v.destinoId, resumoOrigem: v.resumoOrigem, versaoDestino: v.versaoDestino });
const pedidoFoto = (v: FotoPedido): FotoPedido => ({ id: v.id, clienteId: v.clienteId, versao: v.versao });
const mudou = (atual: Cliente, dados: DadosCliente) => Object.entries(dados).some(([k, v]) => hashCanonico(atual[k as keyof Cliente] ?? null) !== hashCanonico(v));

async function reciboExistente(tx: Tx, loteId: string) {
  const eventos = await tx.historicoCadastroVenda.findMany({ where: { entidade: "IMPORTACAO", registroId: loteId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const execucoes = eventos.filter(e => obj(e.depois).tipo === "CORRECAO_CLIENTES_HISTORICOS_V1");
  if (execucoes.length > 1) throw Error("CORRECAO_RECIBO_AMBIGUO");
  const evento = execucoes[0];
  const revertido = eventos.some(e => obj(e.depois).tipo === "REVERSAO_CLIENTES_HISTORICOS_V1");
  return { evento, recibo: evento?.depois as unknown as Recibo | undefined, revertido };
}

async function preparar(tx: Tx, entrada: Entrada) {
  const pacote = validarPacoteHistorico(entrada.pacote), manifesto = validarManifestoEmpresasHistoricas(entrada.manifesto);
  if (entrada.loteId === manifesto.loteHistoricoId) throw Error("CORRECAO_EXIGE_NOVO_LOTE");
  const hashEntrada = hashCanonico({ manifesto, fonte: pacote.metadados.sha256, linhas: pacote.registros.map(r => ({ numero: r.numero_original, hash: r.hash_linha })) });
  const execucao = await reciboExistente(tx, entrada.loteId);
  if (execucao.recibo) {
    if (execucao.recibo.hashEntrada !== hashEntrada || execucao.revertido) throw Error("CORRECAO_LOTE_JA_UTILIZADO");
    return { repeticao: true as const, token: execucao.recibo.token, hashEntrada, linhas: [] as Linha[], manifesto, pacote, recibo: execucao.recibo };
  }
  const [clientes, fontesClientes, fontesPedidos, contatos] = await Promise.all([
    tx.clienteVenda.findMany({ orderBy: { id: "asc" } }),
    tx.identidadeExternaVenda.findMany({ where: { origem: ORIGEM_HISTORICA, loja: LOJA_HISTORICA, entidade: "CLIENTE_HISTORICO" }, orderBy: { id: "asc" } }),
    tx.$queryRaw<FontePedido[]>(Prisma.sql`SELECT "id","chave","destinoId","resumoOrigem","versaoDestino",
      "dadosOrigem"#>>'{hub,loteId}' AS "loteId", "dadosOrigem"#>>'{registro,hash_linha}' AS "hashLinha",
      "dadosOrigem"#>'{registro,raw,valores}' AS "rawValores" FROM "IdentidadeExternaVenda"
      WHERE "origem"=${ORIGEM_HISTORICA} AND "loja"=${LOJA_HISTORICA} AND "entidade"='PEDIDO_HISTORICO' ORDER BY "id"`),
    tx.contatoClienteVenda.findMany({ orderBy: { id: "asc" } }),
  ]);
  const idsOrigem = fontesClientes.map(f => f.destinoId);
  const [pedidos, auditorias, creditos] = await Promise.all([
    tx.pedidoVenda.findMany({ where: { OR: [{ id: { in: fontesPedidos.map(f => f.destinoId) } }, { clienteId: { in: idsOrigem } }] }, select: { id: true, clienteId: true, versao: true, status: true, origem: true, referenciaOrigem: true, referenciaEstabelecimento: true, referenciaPedido: true }, orderBy: { id: "asc" } }),
    tx.historicoCadastroVenda.findMany({ where: { entidade: "CLIENTE", registroId: { in: idsOrigem } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    tx.creditoClienteMovimento.groupBy({ by: ["clienteId"], where: { clienteId: { in: idsOrigem } }, _count: { _all: true } }),
  ]);
  const atividades = await tx.atividadeUsuario.findMany({ where: { fonteTabela: "HistoricoCadastroVenda", fonteId: { in: auditorias.map(a => a.id) } }, select: { fonteId: true, origem: true, correlacaoId: true }, orderBy: { id: "asc" } });
  const grupos = new Map<string, RegistroHistorico[]>();
  for (const r of pacote.registros) { const chave = identidadeComprador(r).chave; grupos.set(chave, [...grupos.get(chave) ?? [], r]); }
  if (manifesto.vinculos.some(v => !grupos.has(v.chaveClienteHistorico))) throw Error("CORRECAO_VINCULO_FORA_DA_FONTE");
  const dominios = new Set(manifesto.empresas.flatMap(e => e.dominiosCorporativos));
  const linhas: Linha[] = [];
  for (const [chave, registros] of grupos) {
    const fonte = fontesClientes.find(f => f.chave === chave), cliente = clientes.find(c => c.id === fonte?.destinoId);
    if (!fonte || !cliente || cliente.unificadoEmId) throw Error("CORRECAO_CLIENTE_ORIGEM_DIVERGENTE");
    const numeros = registros.map(r => r.numero_original).sort();
    const vinculos = manifesto.vinculos.filter(v => v.chaveClienteHistorico === chave);
    const refs = [...new Set(registros.flatMap(r => r.comprador.empresa?.trim() ? [referenciaEmpresaHistorica(r.comprador.empresa)] : []))];
    const pendencias: string[] = [];
    if (refs.length > 1) pendencias.push("MULTIPLAS_EMPRESAS_NO_COMPRADOR");
    for (const v of vinculos) for (const numero of v.numerosOriginais) {
      const r = registros.find(r => r.numero_original === numero);
      if (!r || v.regra === "COMPANY_EXATA" && referenciaEmpresaHistorica(r.comprador.empresa ?? "") !== v.companyRef) throw Error("CORRECAO_COMPANY_DIVERGENTE");
      if (v.regra === "DOMINIO_TITULAR_UNICO") {
        const empresa = manifesto.empresas.find(e => e.companyRef === v.companyRef)!;
        const hosts = identidadeComprador(r).emails.map(e => e.split("@")[1]);
        if (r.comprador.empresa?.trim() || !empresa.dominiosCorporativos.some(d => hosts.includes(d))
          || empresa.dominiosCorporativos.some(d => hosts.includes(d) && manifesto.empresas.some(outra => outra.companyRef !== empresa.companyRef && outra.dominiosCorporativos.includes(d)))) throw Error("CORRECAO_DOMINIO_AMBIGUO");
      }
    }
    const vinculados = [...new Set(vinculos.map(v => v.companyRef))];
    const empresa = vinculados.length === 1 && refs.length <= 1 ? manifesto.empresas.find(e => e.companyRef === vinculados[0])! : null;
    const numerosVinculados = [...new Set(vinculos.flatMap(v => v.numerosOriginais))].sort();
    if (empresa && numerosVinculados.length !== numeros.length) pendencias.push("PEDIDOS_SEM_VINCULO_EMPRESARIAL_PRESERVADOS");
    if (empresa?.decisao === "PJ_CNPJ_COMPROVADO" && refs.length === 1 && !empresa.provas.some(p => p.cnpjObservado === empresa.cnpj && p.nomeEmpresarialObservado && registros.some(r => r.comprador.empresa && nomesEmpresariaisEquivalentes(p.nomeEmpresarialObservado!, r.comprador.empresa)))) pendencias.push("CNPJ_SEM_CORROBORACAO_COMPANY");
    const natureza = registros.some(r => classificarNaturezaCliente({ empresa: r.comprador.empresa, nome: r.comprador.nome_cobranca, emails: identidadeComprador(r).emails }, dominios).tipo === "PJ") ? "PJ" : "PF";
    const meusAudits = auditorias.filter(a => a.registroId === cliente.id), primeiro = meusAudits[0];
    const camposProtegidos = ["nome", "primeiroNome", "sobrenome", "razaoSocial", "documento", "email", "telefone", "contato", "nomeContato", "sobrenomeContato", "tipo"] as const;
    const modificavel = meusAudits.length === 1 && !primeiro.antes && Number(obj(primeiro.depois).versao) === cliente.versao
      && camposProtegidos.every(k => hashCanonico(cliente[k] ?? null) === hashCanonico(obj(primeiro.depois)[k] ?? null))
      && atividades.some(a => a.fonteId === primeiro.id && a.origem === "AUTOMACAO" && a.correlacaoId === manifesto.loteHistoricoId);
    if (!modificavel) pendencias.push("NOMES_ATUAIS_PRESERVADOS");
    if (cliente.documento) pendencias.push("DOCUMENTO_ATUAL_PRESERVADO");
    const nomePessoal = modificavel ? formatarNomeCliente(registros[0].comprador.nome_cobranca ?? cliente.nome) : cliente.nome;
    const partes = nomePessoal.split(/\s+/), nomeAtual = cliente.primeiroNome || partes[0] || null, sobrenomeAtual = cliente.sobrenome || partes.slice(1).join(" ") || null;
    const primeiroNome = modificavel && nomeAtual ? formatarNomeCliente(nomeAtual) : nomeAtual, sobrenome = modificavel && sobrenomeAtual ? formatarNomeCliente(sobrenomeAtual) : sobrenomeAtual;
    const dados: DadosCliente = modificavel ? { nome: nomePessoal, primeiroNome, sobrenome } : {};
    if (natureza === "PJ" && !cliente.documento) Object.assign(dados, { tipo: "PJ", ...(modificavel ? {
      nome: refs.length === 1 ? formatarNomeCliente(registros.find(r => r.comprador.empresa?.trim())!.comprador.empresa!) : nomePessoal,
      nomeContato: cliente.nomeContato ? formatarNomeCliente(cliente.nomeContato) : primeiroNome, sobrenomeContato: cliente.sobrenomeContato ? formatarNomeCliente(cliente.sobrenomeContato) : sobrenome,
      contato: cliente.contato ? formatarNomeCliente(cliente.contato) : nomePessoal,
    } : {}) });
    const comprovada = empresa?.decisao === "PJ_CNPJ_COMPROVADO" && !pendencias.includes("CNPJ_SEM_CORROBORACAO_COMPANY") && refs.length <= 1;
    const existente = comprovada ? clientes.find(c => c.documento === empresa.cnpj) : null;
    if (existente && (existente.tipo !== "PJ" || existente.unificadoEmId)) throw Error("CORRECAO_CANONICO_INCOMPATIVEL");
    if (existente && !existente.ativo) pendencias.push("CANONICO_INATIVO_PRESERVADO");
    const canonico = comprovada && (!existente || existente.ativo) ? existente?.id ?? `CNPJ:${empresa.cnpj}` : null;
    if (contatos.some(c => c.clienteId === (canonico ?? cliente.id) && c.origem === ORIGEM_HISTORICA && c.chaveOrigem === chave && !c.ativo)) throw Error("CORRECAO_CONTATO_INATIVO_EXISTENTE");
    if (natureza === "PJ" && !canonico) pendencias.push(refs.length > 1 ? "UNIFICACAO_NAO_APURADA" : empresa?.motivoPendente ?? "CNPJ_NAO_COMPROVADO");
    for (const r of registros) {
      const f = fontesPedidos.find(f => f.chave === r.numero_original), p = pedidos.find(p => p.id === f?.destinoId);
      if (!f || !p || f.loteId !== manifesto.loteHistoricoId || f.hashLinha !== r.hash_linha || hashCanonico(f.rawValores) !== r.hash_linha
        || f.versaoDestino !== p.versao || p.clienteId !== cliente.id || p.origem !== "HISTORICO_LEGADO" || p.referenciaOrigem !== ORIGEM_HISTORICA || p.referenciaEstabelecimento !== LOJA_HISTORICA || p.referenciaPedido !== r.numero_original) throw Error("CORRECAO_PEDIDO_ORIGEM_DIVERGENTE");
      if (p.status !== "HISTORICO") pendencias.push("PEDIDO_NAO_ATIVO_PRESERVADO");
    }
    const idsMover = numerosVinculados.map(numero => fontesPedidos.find(f => f.chave === numero)!.destinoId).filter(id => pedidos.find(p => p.id === id)?.status === "HISTORICO");
    const aliasSeguro = !!canonico && canonico !== cliente.id && !pedidos.some(p => p.clienteId === cliente.id && !idsMover.includes(p.id))
      && !creditos.some(c => c.clienteId === cliente.id && c._count._all > 0) && !contatos.some(c => c.clienteId === cliente.id || c.clienteOrigemId === cliente.id)
      && !clientes.some(c => c.unificadoEmId === cliente.id);
    if (canonico && !aliasSeguro && canonico !== cliente.id) pendencias.push("CLIENTE_ORIGEM_COM_RELACOES_PRESERVADO");
    linhas.push({ chave, clienteOrigemId: cliente.id, numerosOriginais: numeros, numerosVinculados, registro: registros[0], companyRefs: refs, empresa: empresa ?? null, natureza, modificavel,
      pendencias: [...new Set(pendencias)].sort(), dados, canonico, aliasSeguro, nomePessoal, primeiroNome, sobrenome });
  }
  const token = hashCanonico(json({ hashEntrada, clientes, fontesClientes: fontesClientes.map(fonteFoto), fontesPedidos: fontesPedidos.map(f => ({ ...fonteFoto(f), loteId: f.loteId, hashLinha: f.hashLinha, hashRaw: hashCanonico(f.rawValores) })), contatos, pedidos, auditorias: auditorias.map(a => ({ id: a.id, depois: hashCanonico(a.depois) })), atividades, creditos }));
  return { repeticao: false as const, token, hashEntrada, linhas, manifesto, pacote, clientes, fontesClientes, fontesPedidos, contatos, pedidos };
}

function contagens(linhas: Linha[]) { return { compradores: linhas.length, pf: linhas.filter(l => l.natureza === "PF").length, pj: linhas.filter(l => l.natureza === "PJ").length,
  cnpjComprovado: linhas.filter(l => l.canonico).length, cnpjPendente: linhas.filter(l => l.natureza === "PJ" && !l.canonico).length,
  canonicosNovos: new Set(linhas.filter(l => l.canonico?.startsWith("CNPJ:")).map(l => l.canonico)).size,
  aliasesPlanejados: linhas.filter(l => l.aliasSeguro).length, nomesPreservados: linhas.filter(l => !l.modificavel).length }; }
export async function prepararCorrecaoClientesHistoricos(entrada: Entrada) {
  return transacaoHistorica(entrada, async tx => { const p = await preparar(tx, entrada); return { token: p.token, hashEntrada: p.hashEntrada, repeticao: p.repeticao,
    contagens: p.repeticao ? p.recibo.contagens : contagens(p.linhas), linhas: p.linhas.map(({ registro: _registro, ...l }) => ({ ...l, linhaFonte: _registro.linha })) }; }, true);
}

async function atualizarCliente(tx: Tx, autor: Autor, antes: Cliente, dados: DadosCliente) {
  if (!mudou(antes, dados)) return null;
  const n = await tx.clienteVenda.updateMany({ where: { id: antes.id, versao: antes.versao }, data: { ...dados, versao: { increment: 1 } } });
  if (n.count !== 1) throw Error("CORRECAO_CAS_CLIENTE");
  const depois = await tx.clienteVenda.findUniqueOrThrow({ where: { id: antes.id } });
  await historico(tx, autor, "CLIENTE", antes.id, antes, depois); return { antes, depois };
}
async function atualizarFonte(tx: Tx, antes: FotoFonte, destinoId: string, versaoDestino: number) {
  const n = await tx.identidadeExternaVenda.updateMany({ where: { id: antes.id, destinoId: antes.destinoId, versaoDestino: antes.versaoDestino, resumoOrigem: antes.resumoOrigem }, data: { destinoId, versaoDestino } });
  if (n.count !== 1) throw Error("CORRECAO_CAS_FONTE");
  return fonteFoto(await tx.identidadeExternaVenda.findUniqueOrThrow({ where: { id: antes.id } }));
}
export async function executarCorrecaoClientesHistoricos(entrada: Entrada & { tokenPrevia: string }) {
  if (process.env.CLIENTES_CORRECAO_AUTORIZADA !== "SIM") throw Error("CORRECAO_NAO_AUTORIZADA");
  return transacaoHistorica(entrada, async (tx, autor) => {
    const p = await preparar(tx, entrada);
    if (p.repeticao) return { aplicados: 0, mantidos: p.recibo.contagens.compradores, contagens: p.recibo.contagens, loteId: entrada.loteId };
    if (entrada.tokenPrevia !== p.token) throw Error("CORRECAO_PREVIA_DESATUALIZADA");
    const recibo: Recibo = { tipo: "CORRECAO_CLIENTES_HISTORICOS_V1", loteId: entrada.loteId, hashEntrada: p.hashEntrada, token: p.token, clientes: [], contatos: [], pedidos: [], fontesClientes: [], contagens: contagens(p.linhas) };
    const canonicos = new Map<string, Cliente>();
    for (const l of p.linhas.filter(l => l.canonico)) {
      if (canonicos.has(l.canonico!)) continue;
      let cliente = p.clientes.find(c => c.id === l.canonico);
      if (!cliente) {
        const contatoPrimario = p.clientes.find(c => c.id === l.clienteOrigemId)!;
        const id = await salvarClienteNaTransacao(tx, { id: "", versao: 0, nome: l.empresa!.nomeFantasia || l.empresa!.razaoSocial!, tipo: "PJ", documento: l.empresa!.cnpj,
          razaoSocial: l.empresa!.razaoSocial, primeiroNome: l.primeiroNome, sobrenome: l.sobrenome, nomeContato: l.primeiroNome, sobrenomeContato: l.sobrenome,
          contato: l.nomePessoal, email: contatoPrimario.email, telefone: contatoPrimario.telefone, observacoes: null, ativo: true, enderecos: [] }, autor, "LEGADO");
        cliente = await tx.clienteVenda.findUniqueOrThrow({ where: { id } }); recibo.clientes.push({ antes: null, depois: cliente });
      }
      canonicos.set(l.canonico!, cliente);
    }
    for (const l of p.linhas) {
      const original = p.clientes.find(c => c.id === l.clienteOrigemId)!;
      const canonico = l.canonico ? canonicos.get(l.canonico)! : original;
      const dados = { ...l.dados, ...(l.aliasSeguro ? { unificadoEmId: canonico.id, ativo: false } : {}) };
      const alteracao = await atualizarCliente(tx, autor, original, dados);
      if (alteracao) recibo.clientes.push(alteracao);
      const origemAtual = alteracao?.depois ?? original;
      if (l.natureza === "PJ" && (l.canonico ? canonico : origemAtual).tipo === "PJ") {
        const existente = p.contatos.find(c => c.clienteId === canonico.id && c.origem === ORIGEM_HISTORICA && c.chaveOrigem === l.chave);
        if (existente && !existente.ativo) throw Error("CORRECAO_CONTATO_INATIVO_EXISTENTE");
        if (!existente) {
          const pessoa = identidadeComprador(l.registro);
          const depois = await tx.contatoClienteVenda.create({ data: { clienteId: canonico.id, clienteOrigemId: original.id, nome: l.nomePessoal,
            primeiroNome: l.primeiroNome, sobrenome: l.sobrenome, email: original.email, telefone: original.telefone,
            origem: ORIGEM_HISTORICA, chaveOrigem: l.chave, ativo: true, proveniencia: json({ loteId: entrada.loteId, loteHistoricoId: p.manifesto.loteHistoricoId,
              chaveClienteHistorico: l.chave, numerosOriginais: l.numerosOriginais, empresas: l.companyRefs, emailsOriginais: pessoa.emails, telefonesOriginais: pessoa.telefones,
              nomeOriginal: l.registro.comprador.nome_cobranca, particaoNome: "PRIMEIRO_TOKEN_RESTANTE_QUANDO_CAMPOS_AUSENTES", hashManifesto: hashCanonico(p.manifesto), inferenciaNatureza: l.pendencias }) } });
          recibo.contatos.push({ antes: null, depois });
          await historico(tx, autor, "CLIENTE", canonico.id, null, { tipo: "CONTATO_HISTORICO_ADICIONADO", contatoId: depois.id, clienteId: canonico.id, clienteOrigemId: original.id, loteId: entrada.loteId });
        }
      }
      if (l.canonico) for (const numero of l.numerosVinculados) {
        const fonte = p.fontesPedidos.find(f => f.chave === numero)!, pedido = p.pedidos.find(p => p.id === fonte.destinoId)!;
        if (pedido.status !== "HISTORICO" || pedido.clienteId === canonico.id) continue;
        const n = await tx.pedidoVenda.updateMany({ where: { id: pedido.id, versao: pedido.versao, clienteId: original.id, status: "HISTORICO", origem: "HISTORICO_LEGADO", referenciaOrigem: ORIGEM_HISTORICA }, data: { clienteId: canonico.id, versao: { increment: 1 } } });
        if (n.count !== 1) throw Error("CORRECAO_CAS_PEDIDO");
        const depois = { id: pedido.id, clienteId: canonico.id, versao: pedido.versao + 1 }, fonteDepois = await atualizarFonte(tx, fonte, pedido.id, depois.versao);
        recibo.pedidos.push({ antes: pedidoFoto(pedido), depois, fonteAntes: fonteFoto(fonte), fonteDepois });
        await tx.historicoPedidoVenda.create({ data: { pedidoId: pedido.id, tipo: "HISTORICO_CLIENTE_CORRIGIDO", chaveOperacao: `correcao-cliente:${hashCanonico({ loteId: entrada.loteId, pedidoId: pedido.id })}`, hashOperacao: p.hashEntrada,
          usuarioId: autor.userId, usuarioNome: autor.nome, versaoAnterior: pedido.versao, versaoNova: depois.versao, antes: json(pedidoFoto(pedido)), depois: json({ ...depois, loteId: entrada.loteId }), motivo: "Correção de cadastro histórico comprovada. Snapshots e saldos preservados." } });
      }
      const fonteCliente = p.fontesClientes.find(f => f.chave === l.chave)!;
      const destino = l.aliasSeguro ? canonico : origemAtual;
      if (destino.id !== fonteCliente.destinoId || destino.versao !== fonteCliente.versaoDestino) recibo.fontesClientes.push({ antes: fonteFoto(fonteCliente), depois: await atualizarFonte(tx, fonteCliente, destino.id, destino.versao) });
    }
    const alteracoes = recibo.clientes.length + recibo.contatos.length + recibo.pedidos.length + recibo.fontesClientes.length;
    if (alteracoes) await historico(tx, autor, "IMPORTACAO", entrada.loteId, null, recibo);
    return { aplicados: alteracoes, loteId: entrada.loteId, contagens: recibo.contagens, clientesAlterados: recibo.clientes.length, contatosCriados: recibo.contatos.length, pedidosReligados: recibo.pedidos.length,
      registros: p.linhas.map(l => ({ chave: l.chave, clienteOrigemId: l.clienteOrigemId, clienteCanonicoId: l.canonico ? canonicos.get(l.canonico)!.id : l.clienteOrigemId, numerosOriginais: l.numerosOriginais, natureza: l.natureza, pendencias: l.pendencias })) };
  });
}

async function conferirReversao(tx: Tx, entrada: ContextoImportacaoHistorica) {
  const execucao = await reciboExistente(tx, entrada.loteId);
  if (!execucao.recibo || !execucao.evento) throw Error("CORRECAO_LOTE_NAO_ENCONTRADO");
  if (execucao.revertido) return { repeticao: true as const, token: hashCanonico({ loteId: entrada.loteId, revertido: true }) };
  const r = execucao.recibo;
  const [clientes, contatos, pedidos, fontes] = await Promise.all([
    tx.clienteVenda.findMany({ where: { id: { in: r.clientes.map(c => c.depois.id) } }, orderBy: { id: "asc" } }),
    tx.contatoClienteVenda.findMany({ where: { id: { in: r.contatos.map(c => c.depois.id) } }, orderBy: { id: "asc" } }),
    tx.pedidoVenda.findMany({ where: { id: { in: r.pedidos.map(p => p.depois.id) } }, select: { id: true, clienteId: true, versao: true, status: true, origem: true, referenciaOrigem: true }, orderBy: { id: "asc" } }),
    tx.identidadeExternaVenda.findMany({ where: { id: { in: [...r.pedidos.map(p => p.fonteDepois.id), ...r.fontesClientes.map(f => f.depois.id)] } }, select: { id: true, destinoId: true, resumoOrigem: true, versaoDestino: true }, orderBy: { id: "asc" } }),
  ]);
  const digest = (v: unknown) => hashCanonico(json(v));
  for (const c of r.clientes) if (digest(clientes.find(a => a.id === c.depois.id) ?? null) !== digest(c.depois)) throw Error("CORRECAO_REVERSAO_CLIENTE_ALTERADO");
  for (const c of r.contatos) if (digest(contatos.find(a => a.id === c.depois.id) ?? null) !== digest(c.depois)) throw Error("CORRECAO_REVERSAO_CONTATO_ALTERADO");
  for (const p of r.pedidos) {
    const atual = pedidos.find(a => a.id === p.depois.id);
    if (!atual || atual.status !== "HISTORICO" || atual.origem !== "HISTORICO_LEGADO" || atual.referenciaOrigem !== ORIGEM_HISTORICA || digest(pedidoFoto(atual)) !== digest(p.depois)) throw Error("CORRECAO_REVERSAO_PEDIDO_ALTERADO");
  }
  for (const f of [...r.pedidos.map(p => p.fonteDepois), ...r.fontesClientes.map(f => f.depois)]) if (digest(fontes.find(a => a.id === f.id) ?? null) !== digest(f)) throw Error("CORRECAO_REVERSAO_FONTE_ALTERADA");
  const novos = r.clientes.filter(c => !c.antes).map(c => c.depois.id);
  const [outrosPedidos, outrosContatos, outrosCreditos, outrosAliases] = await Promise.all([
    tx.pedidoVenda.findMany({ where: { clienteId: { in: novos }, id: { notIn: r.pedidos.map(p => p.depois.id) } }, select: { id: true, clienteId: true }, orderBy: { id: "asc" } }),
    tx.contatoClienteVenda.findMany({ where: { clienteId: { in: novos }, ativo: true, id: { notIn: r.contatos.map(c => c.depois.id) } }, select: { id: true, clienteId: true }, orderBy: { id: "asc" } }),
    tx.creditoClienteMovimento.groupBy({ by: ["clienteId"], where: { clienteId: { in: novos } }, _count: { _all: true } }),
    tx.clienteVenda.findMany({ where: { unificadoEmId: { in: novos }, id: { notIn: r.clientes.map(c => c.depois.id) } }, select: { id: true, unificadoEmId: true }, orderBy: { id: "asc" } }),
  ]);
  const compartilhados = novos.filter(id => outrosPedidos.some(p => p.clienteId === id) || outrosContatos.some(c => c.clienteId === id)
    || outrosCreditos.some(c => c.clienteId === id && c._count._all > 0) || outrosAliases.some(c => c.unificadoEmId === id));
  const token = digest({ loteId: entrada.loteId, reciboId: execucao.evento.id, hashEntrada: r.hashEntrada, clientes, contatos, pedidos, fontes, outrosPedidos, outrosContatos, outrosCreditos, outrosAliases });
  return { repeticao: false as const, token, recibo: r, reciboId: execucao.evento.id, clientes, contatos, pedidos, fontes, compartilhados };
}
export async function prepararReversaoClientesHistoricos(entrada: ContextoImportacaoHistorica) {
  return transacaoHistorica(entrada, async tx => {
    const p = await conferirReversao(tx, entrada);
    return { token: p.token, repeticao: p.repeticao, loteId: entrada.loteId, contagens: p.repeticao ? { pedidos: 0, clientes: 0, contatos: 0, canonicosCompartilhados: 0 }
      : { pedidos: p.recibo.pedidos.length, clientes: p.recibo.clientes.length, contatos: p.recibo.contatos.length, canonicosCompartilhados: p.compartilhados.length } };
  }, true);
}
export async function reverterCorrecaoClientesHistoricos(entrada: ContextoImportacaoHistorica & { tokenPrevia: string }) {
  if (process.env.CLIENTES_CORRECAO_AUTORIZADA !== "SIM") throw Error("CORRECAO_NAO_AUTORIZADA");
  return transacaoHistorica(entrada, async (tx, autor) => {
    const p = await conferirReversao(tx, entrada);
    if (p.repeticao) return { revertidos: 0, loteId: entrada.loteId };
    if (entrada.tokenPrevia !== p.token) throw Error("CORRECAO_PREVIA_REVERSAO_DESATUALIZADA");
    const mudancas: { entidade: string; id: string; versao: number }[] = [];
    for (const f of p.recibo.pedidos) {
      const n = await tx.pedidoVenda.updateMany({ where: { id: f.depois.id, clienteId: f.depois.clienteId, versao: f.depois.versao, status: "HISTORICO" }, data: { clienteId: f.antes.clienteId, versao: { increment: 1 } } });
      if (n.count !== 1) throw Error("CORRECAO_CAS_PEDIDO_REVERSAO");
      const versao = f.depois.versao + 1;
      await atualizarFonte(tx, f.fonteDepois, f.fonteAntes.destinoId, versao);
      await tx.historicoPedidoVenda.create({ data: { pedidoId: f.depois.id, tipo: "HISTORICO_CLIENTE_RESTAURADO", chaveOperacao: `reversao-correcao-cliente:${hashCanonico({ loteId: entrada.loteId, pedidoId: f.depois.id })}`, hashOperacao: p.recibo.hashEntrada,
        usuarioId: autor.userId, usuarioNome: autor.nome, versaoAnterior: f.depois.versao, versaoNova: versao, antes: json(f.depois), depois: json({ clienteId: f.antes.clienteId, versao, loteId: entrada.loteId }), motivo: "Reversão da correção cadastral. Snapshots e saldos preservados." } });
      mudancas.push({ entidade: "PEDIDO", id: f.depois.id, versao });
    }
    for (const c of p.recibo.contatos) {
      // Cadastros e auditoria permanecem. Somente os contatos novos deste lote são inativados.
      if (c.antes) throw Error("CORRECAO_REVERSAO_CONTATO_NAO_SUPORTADO");
      const n = await tx.contatoClienteVenda.updateMany({ where: { id: c.depois.id, versao: c.depois.versao, ativo: c.depois.ativo }, data: { ativo: false, versao: { increment: 1 } } });
      if (n.count !== 1) throw Error("CORRECAO_CAS_CONTATO_REVERSAO");
      await historico(tx, autor, "CLIENTE", c.depois.clienteId, { contatoId: c.depois.id, ativo: true }, { tipo: "CONTATO_HISTORICO_INATIVADO", contatoId: c.depois.id, ativo: false, loteId: entrada.loteId });
      mudancas.push({ entidade: "CONTATO", id: c.depois.id, versao: c.depois.versao + 1 });
    }
    const campos = ["nome", "tipo", "documento", "razaoSocial", "primeiroNome", "sobrenome", "nomeContato", "sobrenomeContato", "contato", "ativo", "unificadoEmId"] as const;
    for (const c of [...p.recibo.clientes].reverse()) {
      if (!c.antes && p.compartilhados.includes(c.depois.id)) continue;
      const atual = p.clientes.find(a => a.id === c.depois.id)!;
      const dados: DadosCliente = c.antes ? Object.fromEntries(campos.map(k => [k, c.antes![k]])) : { ativo: false };
      const alteracao = await atualizarCliente(tx, autor, atual, dados);
      if (alteracao) mudancas.push({ entidade: "CLIENTE", id: atual.id, versao: alteracao.depois.versao });
    }
    for (const f of p.recibo.fontesClientes) {
      const cliente = await tx.clienteVenda.findUniqueOrThrow({ where: { id: f.antes.destinoId }, select: { versao: true } });
      await atualizarFonte(tx, f.depois, f.antes.destinoId, cliente.versao);
      mudancas.push({ entidade: "FONTE_CLIENTE", id: f.antes.id, versao: cliente.versao });
    }
    await historico(tx, autor, "IMPORTACAO", entrada.loteId, null, { tipo: "REVERSAO_CLIENTES_HISTORICOS_V1", reciboId: p.reciboId, hashEntrada: p.recibo.hashEntrada, loteId: entrada.loteId, mudancas, canonicosCompartilhadosPreservados: p.compartilhados });
    return { revertidos: mudancas.length, loteId: entrada.loteId, pedidosRestaurados: p.recibo.pedidos.length, contatosInativados: p.recibo.contatos.length, canonicosCompartilhadosPreservados: p.compartilhados.length };
  });
}
