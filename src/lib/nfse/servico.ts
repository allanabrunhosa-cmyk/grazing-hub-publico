import { gunzipSync } from "zlib";
import { URL } from "url";
import { request } from "https";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { criarAgenteMTLS, obterCnpjConsulta } from "@/lib/sefaz/certificado";
import { resolverFornecedorNota } from "@/lib/notas-fiscais/fornecedor";
import { DATA_MINIMA_NFSE_DATE, extrairDadosNfse } from "./parse";
import { dataCalendarioValida, vencimentoCartao } from "@/lib/financeiro/cartoes";
import { criarIdentificadorDps } from "./dps";
import { conferirXmlMunicipal, localizarNfseMunicipal, type ConsultaMunicipalNfse } from "./municipal-sp";

import { interpretarRespostaAdn, resumirRespostaAdn } from "./resposta-distribuicao";
import { buscaAutomaticaNfseDevida, proximaBuscaDiariaNfse, INTERVALO_NFSE as HORA } from "./agenda";

const ADN_NFSE = "https://adn.nfse.gov.br/contribuintes/DFe";
const SEFIN_NFSE = "https://sefin.nfse.gov.br/sefinnacional";

export type ResumoNfse = {
  novas: number;
  atualizadas: number;
  eventos: number;
  nsuConsultado: string;
  motivo: string;
};

function texto(valor: unknown) {
  return typeof valor === "string" || typeof valor === "number" ? String(valor) : null;
}

function base64ParaXml(valor: string) {
  const bruto = Buffer.from(valor, "base64");
  try {
    const descompactado = gunzipSync(bruto).toString("utf8");
    if (descompactado.trim().startsWith("<")) return descompactado;
  } catch { /* Algumas respostas retornam XML em base64 sem gzip. */ }
  const xml = bruto.toString("utf8");
  if (xml.trim().startsWith("<")) return xml;
  throw new Error("A API nacional retornou um documento de NFS-e em formato não reconhecido.");
}

function arquivoXml(valor: unknown) {
  const bruto = texto(valor);
  if (!bruto) return null;
  return bruto.trim().startsWith("<") ? bruto : base64ParaXml(bruto);
}

function valorNsu(valor: unknown) {
  const textoNsu = texto(valor)?.replace(/\D/g, "") || "0";
  return BigInt(textoNsu || "0");
}

async function chamarAdn(caminho: string, cnpj: string) {
  const url = new URL(`${ADN_NFSE}/${caminho}`);
  url.searchParams.set("lote", "true");
  url.searchParams.set("cnpjConsulta", cnpj);
  const agent = await criarAgenteMTLS();
  return new Promise<{ status: number; corpo: string }>((resolve, reject) => {
    const req = request({ hostname: url.hostname, path: `${url.pathname}${url.search}`, method: "GET", agent,
      headers: { Accept: "application/json" }, timeout: 30_000 }, res => {
      const blocos: Buffer[] = [];
      res.on("data", bloco => blocos.push(bloco));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, corpo: Buffer.concat(blocos).toString("utf8") }));
    });
    req.on("timeout", () => req.destroy(new Error("Tempo esgotado ao consultar a distribuição nacional de NFS-e (30s).")));
    req.on("error", reject);
    req.end();
  });
}

async function chamarSefin(caminho: string, metodo: "GET" | "HEAD" = "GET") {
  const url = new URL(`${SEFIN_NFSE}/${caminho}`);
  const agent = await criarAgenteMTLS();
  return new Promise<{ status: number; corpo: string }>((resolve, reject) => {
    const req = request({ hostname: url.hostname, path: `${url.pathname}${url.search}`, method: metodo, agent,
      headers: { Accept: "application/json" }, timeout: 30_000 }, res => {
      const blocos: Buffer[] = [];
      res.on("data", bloco => blocos.push(bloco));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, corpo: Buffer.concat(blocos).toString("utf8") }));
    });
    req.on("timeout", () => req.destroy(new Error("Tempo esgotado ao consultar a Sefin Nacional (30s).")));
    req.on("error", reject);
    req.end();
  });
}

function mensagemSefin(resposta: Record<string, unknown>) {
  if (!resposta || typeof resposta !== "object") return null;
  const erro = resposta.erro ?? resposta.erros;
  if (erro && typeof erro === "object") {
    const registro = Array.isArray(erro) ? erro[0] : erro;
    if (registro && typeof registro === "object") {
      const dados = registro as Record<string, unknown>;
      const mensagem = texto(dados.mensagem ?? dados.Mensagem ?? dados.descricao ?? dados.Descricao ?? dados.complemento ?? dados.Complemento);
      if (mensagem) return mensagem;
    }
  }
  return texto(resposta.mensagem ?? resposta.Mensagem ?? resposta.motivo ?? resposta.Motivo) ?? null;
}

export async function importarNfsePorDps(input: { cpfCnpj: string; serie: string; numero: string; municipioCodigo: string; autor: string | null }) {
  try {
    const idDps = criarIdentificadorDps(input);
    // O XML usa "DPS" + 42 dígitos, mas GET e HEAD /dps/{id} recebem só os 42 dígitos.
    // Manter idDps completo para conferir a identidade do XML antes de persistir.
    const caminhoDps = `dps/${idDps.slice(3)}`;
    const respostaDps = await chamarSefin(caminhoDps);
    let dadosDps: Record<string, unknown> = {};
    try { dadosDps = JSON.parse(respostaDps.corpo) as Record<string, unknown>; } catch { /* erro abaixo com status HTTP */ }
    if (respostaDps.status >= 400) {
      const mensagem = mensagemSefin(dadosDps);
      if (respostaDps.status === 404) {
        // O GET pode ocultar a chave por sigilo fiscal. O HEAD informa apenas
        // se a DPS existe e permite diferenciar os dois casos para o usuário.
        const verificacao = await chamarSefin(caminhoDps, "HEAD");
        if (verificacao.status === 200) {
          throw new Error("A Sefin Nacional não liberou a chave para os dados consultados. Isso não confirma um problema no certificado. Se você informou um RPS municipal, use Importar municipal (São Paulo), a chave nacional ou o XML oficial.");
        }
        throw new Error("Nenhuma NFS-e nacional foi encontrada para esses dados. Confirme a série, o número, o município de emissão e se a nota foi emitida pelo Emissor Nacional.");
      }
      if (respostaDps.status === 403) throw new Error("A Sefin Nacional recusou o acesso à consulta da DPS. Confira se os dados são de uma DPS nacional; RPS municipais devem ser consultados pela integração municipal, chave nacional ou XML oficial.");
      throw new Error(mensagem ? `A Sefin Nacional recusou a consulta: ${mensagem}` : `A Sefin Nacional retornou HTTP ${respostaDps.status}.`);
    }
    const chave = texto(dadosDps.chaveAcesso ?? dadosDps.ChaveAcesso);
    if (!chave || !/^\d{50}$/.test(chave)) throw new Error("A Sefin Nacional não retornou uma chave de acesso válida para esta DPS.");
    const respostaNfse = await chamarSefin(`nfse/${encodeURIComponent(chave)}`);
    let dadosNfse: Record<string, unknown> = {};
    try { dadosNfse = JSON.parse(respostaNfse.corpo) as Record<string, unknown>; } catch { /* erro abaixo com status HTTP */ }
    if (respostaNfse.status >= 400) {
      const mensagem = mensagemSefin(dadosNfse);
      throw new Error(mensagem ? `A NFS-e foi localizada, mas o XML não pôde ser baixado: ${mensagem}` : `A NFS-e foi localizada, mas a Sefin Nacional retornou HTTP ${respostaNfse.status} ao baixar o XML.`);
    }
    const xmlCodificado = texto(dadosNfse.nfseXmlGZipB64 ?? dadosNfse.NfseXmlGZipB64 ?? dadosNfse.xmlGZipB64 ?? dadosNfse.XmlGZipB64);
    if (!xmlCodificado) throw new Error("A Sefin Nacional não retornou o XML completo da NFS-e.");
    const xml = base64ParaXml(xmlCodificado);
    const dados = extrairDadosNfse(xml, await obterCnpjConsulta());
    if (dados.dpsIdentificador && dados.dpsIdentificador !== idDps) throw new Error("A NFS-e retornada não corresponde aos dados da DPS informados.");
    return await persistirDocumento(xml, "NACIONAL", null, input.autor);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível importar a NFS-e pelos dados da DPS." };
  }
}

class ErroConsultaNfseNacional extends Error {
  constructor(readonly status: number, mensagem: string) {
    super(mensagem);
    this.name = "ErroConsultaNfseNacional";
  }
}

async function baixarXmlNfsePorChave(chaveAcesso: string) {
    const chave = chaveAcesso.replace(/\D/g, "");
    if (!/^\d{50}$/.test(chave)) throw new Error("A chave de acesso da NFS-e deve conter 50 dígitos.");
    const resposta = await chamarSefin(`nfse/${encodeURIComponent(chave)}`);
    let dados: Record<string, unknown> = {};
    try { dados = JSON.parse(resposta.corpo) as Record<string, unknown>; } catch { /* erro abaixo com status HTTP */ }
    if (resposta.status >= 400) {
      const mensagem = mensagemSefin(dados);
      if (resposta.status === 403) throw new ErroConsultaNfseNacional(resposta.status, "A Sefin Nacional não permite consultar esta NFS-e com o certificado configurado. Ele precisa pertencer ao prestador, tomador ou intermediário da nota.");
      if (resposta.status === 404) throw new ErroConsultaNfseNacional(resposta.status, "A chave de acesso não foi encontrada na Sefin Nacional. Confirme os 50 dígitos e se a nota é de padrão nacional.");
      throw new ErroConsultaNfseNacional(resposta.status, mensagem ? `A Sefin Nacional recusou a consulta: ${mensagem}` : `A Sefin Nacional retornou HTTP ${resposta.status} ao consultar a chave.`);
    }
    const xmlCodificado = texto(dados.nfseXmlGZipB64 ?? dados.NfseXmlGZipB64 ?? dados.xmlGZipB64 ?? dados.XmlGZipB64);
    if (!xmlCodificado) throw new Error("A Sefin Nacional não retornou o XML completo da NFS-e.");
    return base64ParaXml(xmlCodificado);
}

export async function importarNfsePorChave(chaveAcesso: string, autor: string | null = null) {
  try {
    const resultado = await persistirDocumento(await baixarXmlNfsePorChave(chaveAcesso), "NACIONAL", null, autor);
    return { ...resultado, nova: resultado.nova };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível importar a NFS-e pela chave." };
  }
}

export async function importarNfseMunicipal(input: ConsultaMunicipalNfse, autor: string | null = null) {
  try {
    const cnpj = await obterCnpjConsulta();
    const nota = await localizarNfseMunicipal(input, cnpj);
    try {
      const xml = await baixarXmlNfsePorChave(nota.chave);
      conferirXmlMunicipal(xml, nota, cnpj);
      // Reutiliza a identidade e o XML nacional, inclusive quando a mesma nota já foi
      // importada por chave/DPS/distribuição. Preserva decisões e vínculos existentes.
      return await persistirDocumento(xml, "NACIONAL", null, autor);
    } catch (erro) {
      // Algumas NFS-e municipais já exibem a chave nacional, mas o documento ainda não
      // existe no endpoint de download da Sefin. Nesse único caso, preserva e importa o
      // registro oficial isolado que a própria Prefeitura acabou de devolver e conferir.
      if (!(erro instanceof ErroConsultaNfseNacional) || erro.status !== 404) throw erro;
      return await persistirDocumento(nota.xmlMunicipal, "MUNICIPAL", null, autor);
    }
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível importar a NFS-e municipal." };
  }
}

async function persistirDocumento(xml: string, origem: "NACIONAL" | "MUNICIPAL" | "ARQUIVO", nsu: string | null, autor: string | null) {
  const cnpj = await obterCnpjConsulta();
  const dados = extrairDadosNfse(xml, cnpj);
  if (!dados.dataEmissao) throw new Error("A NFS-e precisa conter uma data de emissão válida.");
  const fornecedor = await resolverFornecedorNota(prisma, dados.prestadorCnpj);
  const registro = {
    identificador: dados.identificador,
    chaveAcesso: dados.chaveAcesso,
    nsu,
    origem,
    importadaManualmente: true,
    xml,
    numero: dados.numero,
    serie: dados.serie,
    codigoVerificacao: dados.codigoVerificacao,
    prestadorCnpj: dados.prestadorCnpj,
    prestadorNome: dados.prestadorNome,
    prestadorDados: dados.prestadorDados ? dados.prestadorDados as Prisma.InputJsonValue : Prisma.JsonNull,
    tomadorCnpj: dados.tomadorCnpj,
    tomadorNome: dados.tomadorNome,
    tomadorDados: dados.tomadorDados ? dados.tomadorDados as Prisma.InputJsonValue : Prisma.JsonNull,
    valorServico: dados.valorServico,
    valorLiquido: dados.valorLiquido,
    valorIss: dados.valorIss,
    dataEmissao: dados.dataEmissao,
    dataCompetencia: dados.dataCompetencia,
    municipioCodigo: dados.municipioCodigo,
    municipioNome: dados.municipioNome,
    uf: dados.uf,
    fornecedorId: fornecedor?.id ?? null,
    criadoPorNome: autor,
  } satisfies Prisma.NotaFiscalServicoUncheckedCreateInput;
  const existente = await prisma.notaFiscalServico.findUnique({ where: { identificador: dados.identificador }, select: { id: true, xml: true } });
  if (!existente) {
    await prisma.notaFiscalServico.create({ data: registro });
    return { dados, nova: true };
  }
  // A inclusão manual também torna visível uma nota antiga já armazenada, sem duplicá-la
  // nem sobrescrever seu XML, decisões, vínculos financeiros ou NSU.
  await prisma.notaFiscalServico.update({ where: { id: existente.id }, data: existente.xml ? { importadaManualmente: true } : registro });
  return { dados, nova: false };
}

export async function importarNfseXml(xml: string, origem: "MUNICIPAL" | "ARQUIVO" = "ARQUIVO", autor: string | null = null) {
  try {
    return await persistirDocumento(xml, origem, null, autor);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível importar a NFS-e." };
  }
}

export async function sincronizarNfse(autor: string | null = null, opcoes: { automatica?: boolean } = {}): Promise<ResumoNfse | { erro: string }> {
  const cnpj = await obterCnpjConsulta();
  await prisma.nfseDistribuicaoEstado.upsert({ where: { cnpj }, create: { cnpj }, update: {} });
  return prisma.$transaction(async tx => {
    const [trava] = await tx.$queryRaw<{ obtida: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext('distribuicao-nfse'), hashtext(${cnpj})) AS obtida`;
    if (!trava.obtida) return { novas: 0, atualizadas: 0, eventos: 0, nsuConsultado: "0", motivo: "Uma busca de NFS-e já está em andamento." };
    const estado = await tx.nfseDistribuicaoEstado.findUniqueOrThrow({ where: { cnpj } });
    if (opcoes.automatica && !buscaAutomaticaNfseDevida(estado, new Date())) return { novas: 0, atualizadas: 0, eventos: 0, nsuConsultado: estado.nsuConsulta, motivo: "A busca automática de NFS-e ainda não está no horário previsto." };
    if (estado.proximaBuscaEm && estado.proximaBuscaEm > new Date()) return { novas: 0, atualizadas: 0, eventos: 0, nsuConsultado: estado.nsuConsulta, motivo: `Próxima consulta permitida após ${estado.proximaBuscaEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.` };
    const iniciadaEm = new Date();
    await tx.nfseDistribuicaoEstado.update({ where: { cnpj }, data: {
      emConsulta: true, ultimaExecucaoEm: iniciadaEm,
      ...(opcoes.automatica ? { ultimaBuscaAutomaticaEm: iniciadaEm } : {}),
    } });
    let diagnostico: Prisma.InputJsonValue = { etapa: "COMUNICACAO" };
    try {
      const respostaHttp = await chamarAdn(estado.nsuConsulta, cnpj);
      diagnostico = resumirRespostaAdn(respostaHttp.status, respostaHttp.corpo).diagnostico;
      const { documentos, nenhum, status } = interpretarRespostaAdn(respostaHttp.status, respostaHttp.corpo);
      let novas = 0; let atualizadas = 0; let eventos = 0; let maiorNsu = valorNsu(estado.nsuConsulta);
      for (const documento of documentos) {
        const nsuOriginal = documento.NSU ?? documento.nsu;
        const nsu = texto(nsuOriginal) ?? "";
        if (!/^\d+$/.test(nsu) || (typeof nsuOriginal === "number" && !Number.isSafeInteger(nsuOriginal))) {
          throw new Error("O ADN retornou um NSU inválido. O cursor foi preservado para não perder documentos.");
        }
        const xml = arquivoXml(documento.ArquivoXml ?? documento.arquivoXml ?? documento.XML ?? documento.xml);
        if (!xml) throw new Error(`O documento NSU ${nsu} veio sem XML. O cursor foi preservado para nova consulta.`);
        if (valorNsu(nsu) > maiorNsu) maiorNsu = valorNsu(nsu);
        const tipoEvento = texto(documento.TipoEvento ?? documento.tipoEvento);
        const chave = texto(documento.ChaveAcesso ?? documento.chaveAcesso);
        if (tipoEvento && !xml.includes("infNFSe")) {
          const identificador = `EVENTO-${nsu}-${chave ?? "sem-chave"}`;
          await tx.eventoNfse.upsert({ where: { identificador }, update: {}, create: { identificador, chaveAcesso: chave, nsu, tipo: tipoEvento, xml, criadoPorNome: autor } });
          eventos++;
          continue;
        }
        const dados = extrairDadosNfse(xml, cnpj);
        if (!dados.dataEmissao || dados.dataEmissao < DATA_MINIMA_NFSE_DATE) continue;
        const existente = await tx.notaFiscalServico.findUnique({ where: { identificador: dados.identificador }, select: { id: true, xml: true } });
        const fornecedor = await resolverFornecedorNota(tx, dados.prestadorCnpj);
        const base = { identificador: dados.identificador, chaveAcesso: dados.chaveAcesso, nsu, origem: "NACIONAL" as const, xml, numero: dados.numero, serie: dados.serie, codigoVerificacao: dados.codigoVerificacao, prestadorCnpj: dados.prestadorCnpj, prestadorNome: dados.prestadorNome, prestadorDados: dados.prestadorDados ? dados.prestadorDados as Prisma.InputJsonValue : Prisma.JsonNull, tomadorCnpj: dados.tomadorCnpj, tomadorNome: dados.tomadorNome, tomadorDados: dados.tomadorDados ? dados.tomadorDados as Prisma.InputJsonValue : Prisma.JsonNull, valorServico: dados.valorServico, valorLiquido: dados.valorLiquido, valorIss: dados.valorIss, dataEmissao: dados.dataEmissao, dataCompetencia: dados.dataCompetencia, municipioCodigo: dados.municipioCodigo, municipioNome: dados.municipioNome, uf: dados.uf, fornecedorId: fornecedor?.id ?? null, criadoPorNome: autor };
        if (!existente) { await tx.notaFiscalServico.create({ data: base }); novas++; }
        else if (!existente.xml) { await tx.notaFiscalServico.update({ where: { id: existente.id }, data: base }); atualizadas++; }
      }
      const motivo = nenhum
        ? "Consulta concluída: nenhuma nova NFS-e ou evento disponível no Ambiente Nacional. Isso não inclui notas ainda não compartilhadas pelos municípios."
        : `Consulta concluída: ${novas} NFS-e nova(s), ${atualizadas} atualizada(s) e ${eventos} evento(s).`;
      const proximaBuscaEm = new Date(Date.now() + (nenhum ? HORA : 5 * 60_000));
      await tx.nfseDistribuicaoEstado.update({ where: { cnpj }, data: {
        emConsulta: false, nsuConsulta: maiorNsu.toString(), ultimoStatus: status,
        ultimoMotivo: motivo, resultadoExecucao: motivo, proximaBuscaEm,
        ultimaRespostaJson: diagnostico,
        ...(opcoes.automatica ? {
          resultadoBuscaAutomatica: motivo,
          proximaBuscaAutomaticaEm: nenhum ? proximaBuscaDiariaNfse(new Date()) : proximaBuscaEm,
        } : {}),
      } });
      return { novas, atualizadas, eventos, nsuConsultado: maiorNsu.toString(), motivo };
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : "Falha ao consultar o ADN NFS-e.";
      await tx.nfseDistribuicaoEstado.update({ where: { cnpj }, data: {
        emConsulta: false, ultimoStatus: "FALHA_CONSULTA", ultimoMotivo: motivo, resultadoExecucao: motivo,
        ultimaRespostaJson: diagnostico, proximaBuscaEm: new Date(Date.now() + HORA),
        ...(opcoes.automatica ? { resultadoBuscaAutomatica: motivo, proximaBuscaAutomaticaEm: proximaBuscaDiariaNfse(new Date()) } : {}),
      } });
      return { erro: motivo };
    }
  }, { timeout: 120_000, maxWait: 5_000 });
}

export type ParcelaNfseInput = {
  numero: string;
  valor: number;
  dataVencimento: string;
  formaPagamento: "BOLETO" | "PIX" | "CARTAO";
  cartaoCreditoId?: string | null;
  dataCompra?: string | null;
  parcelaCartao?: number;
};

export async function lancarNfse(input: {
  nfseId: string;
  categoriaId: string;
  descricao: string;
  dataVencimento: string;
  autorId: string;
  autorNome: string;
  parcelas?: ParcelaNfseInput[];
}) {
  const descricao = input.descricao.trim();
  if (!descricao) return { erro: "Informe uma descrição para a despesa." };
  if (descricao.length > 160) return { erro: "A descrição deve ter no máximo 160 caracteres." };
  const dataVencimento = new Date(`${input.dataVencimento}T12:00:00.000Z`);
  if (!dataCalendarioValida(input.dataVencimento)) return { erro: "Informe uma data de vencimento válida." };
  const parcelaSintetica = !input.parcelas?.length;
  const parcelas = parcelaSintetica ? [{ numero: "001", valor: 0, dataVencimento: input.dataVencimento, formaPagamento: "BOLETO" as const }] : input.parcelas!;
  if (parcelas.length > 36) return { erro: "A despesa pode ter no máximo 36 parcelas." };
  if (parcelas.some(parcela => !/^\d{3}$/.test(parcela.numero) || (!parcelaSintetica && (!Number.isFinite(parcela.valor) || parcela.valor <= 0)) || !dataCalendarioValida(parcela.dataVencimento))) return { erro: "Preencha todas as parcelas com valor e vencimento válidos." };
  return prisma.$transaction(async tx => {
    const nota = await tx.notaFiscalServico.findUnique({ where: { id: input.nfseId }, include: { lancamentos: true } });
    if (!nota) return { erro: "NFS-e não encontrada." };
    if (nota.lancamentos.length) return { erro: "Esta NFS-e já está lançada no financeiro." };
    if (nota.status !== "ACEITA") return { erro: "Aceite a NFS-e antes de lançá-la no financeiro." };
    const categoria = await tx.categoriaFinanceira.findUnique({ where: { id: input.categoriaId } });
    if (!categoria || !categoria.ativo || categoria.excluidoEm) return { erro: "Selecione uma categoria financeira ativa." };
    const valor = Number(nota.valorLiquido ?? nota.valorServico ?? 0);
    if (!Number.isFinite(valor) || valor <= 0) return { erro: "A NFS-e não possui um valor de serviço válido." };
    const valores = parcelas.length === 1 && parcelas[0].valor === 0
      ? [{ ...parcelas[0], valor }]
      : parcelas;
    const soma = valores.reduce((total, parcela) => total + parcela.valor, 0);
    if (Math.round(soma * 100) !== Math.round(valor * 100)) return { erro: "A soma das parcelas precisa fechar com o valor da NFS-e." };
    for (const parcela of valores) {
      if (parcela.formaPagamento === "CARTAO") {
        if (!parcela.cartaoCreditoId || !parcela.dataCompra || !dataCalendarioValida(parcela.dataCompra)) return { erro: "Informe o cartão e a data da compra em todas as parcelas do cartão." };
        const cartao = await tx.cartaoCredito.findUnique({ where: { id: parcela.cartaoCreditoId }, select: { diaFechamento: true, diaVencimento: true, ativo: true, contaBancaria: { select: { ativo: true } } } });
        if (!cartao?.ativo || !cartao.contaBancaria.ativo) return { erro: "Selecione um cartão ativo vinculado a uma conta ativa." };
        try {
          const esperado = vencimentoCartao(parcela.dataCompra, cartao.diaFechamento, cartao.diaVencimento, parcela.parcelaCartao ?? 1);
          if (esperado !== parcela.dataVencimento) return { erro: "O vencimento não corresponde à fatura do cartão selecionado." };
        } catch { return { erro: "Confira a data da compra e a parcela do cartão." }; }
      }
    }
    const reservada = await tx.notaFiscalServico.updateMany({
      where: { id: nota.id, status: "ACEITA", lancamentos: { none: {} } },
      data: { status: "LANCADA" },
    });
    if (reservada.count !== 1) return { erro: "A situação da nota mudou. Atualize a página antes de lançar." };
    const grupo = valores.length > 1 ? randomUUID() : null;
    for (const parcela of valores) {
      const nomeForma = parcela.formaPagamento === "CARTAO" ? "Cartão de crédito" : parcela.formaPagamento === "PIX" ? "Pix" : "Boleto";
      const forma = await tx.formaPagamento.upsert({ where: { nome: nomeForma }, create: { nome: nomeForma }, update: {} });
      const lancamento = await tx.lancamentoFinanceiro.create({ data: { tipo: "DESPESA", valor: parcela.valor, descricao: valores.length > 1 ? `${descricao} (${parcela.numero}/${valores.length})` : descricao, categoriaId: categoria.id, dataCompetencia: nota.dataCompetencia ?? nota.dataEmissao ?? dataVencimento, dataVencimento: new Date(`${parcela.dataVencimento}T12:00:00.000Z`), fornecedorId: nota.fornecedorId, contraparteNome: nota.fornecedorId ? null : nota.prestadorNome, status: "PENDENTE", formaPagamentoId: forma.id, cartaoCreditoId: parcela.cartaoCreditoId ?? null, recorrenciaGrupoId: grupo, criadoPorId: input.autorId } });
      await tx.notaFiscalServicoLancamento.create({ data: { notaFiscalServicoId: nota.id, lancamentoFinanceiroId: lancamento.id, criadoPorId: input.autorId, criadoPorNome: input.autorNome } });
    }
    return { ok: true as const };
  });
}
