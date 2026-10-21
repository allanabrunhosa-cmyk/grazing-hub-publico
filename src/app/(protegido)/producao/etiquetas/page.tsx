import { EtiquetasClient } from "@/app/(protegido)/producao/etiquetas/etiquetas-client";
import { prisma } from "@/lib/prisma";
import { nomeArquivoZpl } from "@/lib/etiquetas/zpl";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { permissaoEfetiva } from "@/lib/permissoes/catalogo";
import { interfaceEtiquetasDedicada } from "@/lib/contexto-interface";
import { redirect } from "next/navigation";
import { CAMINHO_ETIQUETAS, HOST_ETIQUETAS } from "@/lib/hosts";
import { lerPlanejamentoRaspberry } from "@/lib/etiquetas/raspberry";
import { secaoEtiquetas, titulosSecoesEtiquetas } from "@/lib/etiquetas/navegacao";
import { condicaoValidade, filtroValidade } from "@/lib/etiquetas/gestao-validades";
import type { GestaoValidadesTela } from "./gestao-validades";
import { situacaoConector } from "@/lib/etiquetas/pontos-estado";
import type { PontoImpressaoTela } from "./pontos-impressao";

export default async function EtiquetasPage({ searchParams }: { searchParams: Promise<{ pagina?: string; secao?: string; situacao?: string; prazos?: string; aba?: string }> }) {
  const sessao = await exigirPermissao("producao");
  const dedicado = await interfaceEtiquetasDedicada();
  if (!dedicado) redirect(`https://${HOST_ETIQUETAS}${CAMINHO_ETIQUETAS}`);

  const parametros = await searchParams;
  const secao = secaoEtiquetas(parametros.secao);
  const paginaSolicitada = Number(parametros.pagina ?? "1");
  const pagina = Number.isInteger(paginaSolicitada) && paginaSolicitada > 0 ? paginaSolicitada : 1;
  const porPagina = 25;
  let gestaoValidades: GestaoValidadesTela | undefined;
  if (secao === "validades") {
    const agora = new Date();
    const filtro = filtroValidade(parametros.situacao);
    const where = { lojaId: "singleton" };
    const [itens, total, vencidas, proximas, vigentes] = await Promise.all([
      prisma.trabalhoEtiqueta.findMany({ where, select: {
        id: true, insumoId: true, insumo: { select: { fotoMimeType: true } }, produtoNome: true, categoriaNome: true, unidade: true, lote: true, quantidade: true,
        copiasBaixadas: true, validoAte: true, manipuladoEm: true, fusoHorario: true, responsavelManipulacao: true,
        conservacao: true, copias: true, status: true, lojaNome: true, lojaCnpj: true, lojaEndereco: true,
        marcaFornecedor: true, sif: true, validadeOriginal: true, codigoRastreio: true,
        resolucaoDpi: true, tamanho: true, mostrarHora: true,
      }, orderBy: [{ validoAte: "asc" }, { id: "asc" }] }),
      prisma.trabalhoEtiqueta.count({ where }),
      ...(["vencidas", "proximas", "vigentes"] as const).map((f) => prisma.trabalhoEtiqueta.count({ where: { lojaId: "singleton", validoAte: condicaoValidade(f, agora) } })),
    ]);
    gestaoValidades = { agora: agora.toISOString(), filtro, pagina, porPagina, total, vencidas, proximas, vigentes,
      itens: itens.map((item) => ({
        id: item.id,
        insumoId: item.insumoId,
        fotoUrl: item.insumo?.fotoMimeType ? `/api/etiquetas/produtos/${item.insumoId}/foto` : null,
        produtoNome: item.produtoNome,
        categoriaNome: item.categoriaNome,
        lote: item.lote,
        validoAte: item.validoAte.toISOString(),
        manipuladoEm: item.manipuladoEm.toISOString(),
        fusoHorario: item.fusoHorario,
        responsavelManipulacao: item.responsavelManipulacao,
        conservacao: item.conservacao,
        copias: item.copias,
        copiasBaixadas: item.copiasBaixadas,
        status: item.status,
        confirmado: item.status === "CONFIRMADO_PELO_OPERADOR",
        dados: {
          produtoNome: item.produtoNome,
          lojaNome: item.lojaNome,
          lojaCnpj: item.lojaCnpj,
          lojaEndereco: item.lojaEndereco,
          conservacao: item.conservacao,
          quantidade: item.quantidade?.toString() ?? null,
          unidade: item.unidade,
          lote: item.lote,
          marcaFornecedor: item.marcaFornecedor,
          sif: item.sif,
          validadeOriginal: item.validadeOriginal,
          codigoRastreio: item.codigoRastreio,
          responsavelManipulacao: item.responsavelManipulacao,
          manipuladoEm: item.manipuladoEm.toISOString(),
          validoAte: item.validoAte.toISOString(),
          fusoHorario: item.fusoHorario,
          resolucaoDpi: item.resolucaoDpi,
          tamanho: item.tamanho,
          mostrarHora: item.mostrarHora,
          copias: item.copias,
        },
      })) };
  }
  const [produtosDb, historicoDb, totalHistorico, lojaDb, perfilDb, responsaveis, pontosDb, enviosDb] = await Promise.all([
    prisma.insumo.findMany({
      select: {
        id: true,
        nome: true,
        especificacao: true,
        marcasHomologadas: true,
        fotoMimeType: true,
        tipo: true,
        unidade: true,
        ativo: true,
        etiquetaHabilitada: true,
        validadeSecoDias: true,
        validadeRefrigeradoDias: true,
        validadeCongeladoDias: true,
        validadeAposAbertoDias: true,
        conservacaoEtiquetaPadrao: true,
        versaoConfiguracaoEtiqueta: true,
        categoria: { select: { nome: true } },
        fornecedorPrincipal: { select: { nome: true } },
      },
      orderBy: [{ tipo: "asc" }, { nome: "asc" }],
    }),
    prisma.trabalhoEtiqueta.findMany({
      where: { lojaId: "singleton" },
      include: {
        emitidoPor: { select: { nome: true } },
        _count: { select: { tentativas: true } },
        enviosPonto: { select: { estado: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    prisma.trabalhoEtiqueta.count({ where: { lojaId: "singleton" } }),
    prisma.configuracaoLoja.findUnique({ where: { id: "singleton" } }),
    prisma.perfilImpressora.findFirst({ where: { lojaId: "singleton", ativo: true }, orderBy: { updatedAt: "desc" } }),
    prisma.usuario.findMany({ where: { ativo: true, excluidoEm: null }, select: { id: true, nome: true, responsavelEtiquetaHabilitado: true }, orderBy: [{ nome: "asc" }, { id: "asc" }] }),
    prisma.pontoImpressao.findMany({ where: { lojaId: "singleton", ...(sessao.admin ? {} : { excluidoEm: null }) }, include: { dispositivo: true, envios: { where: { estado: { in: ["PENDENTE", "INCERTO"] } }, select: { estado: true } }, mudancasWifi: { select: { estado: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: [{ padrao: "desc" }, { createdAt: "asc" }] }),
    prisma.envioPontoImpressao.findMany({ where: { lojaId: "singleton" }, select: { id: true, tipo: true, estado: true, createdAt: true, finalizadoEm: true, detalhe: true, ponto: { select: { nome: true } }, trabalho: { select: { produtoNome: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const cadastrosResponsaveis = await prisma.responsavelEtiqueta.findMany({ where: { lojaId: "singleton" }, select: { id: true, nome: true, ativo: true }, orderBy: { nome: "asc" } });
  const opcoesResponsaveis = [...responsaveis.filter(item => item.responsavelEtiquetaHabilitado), ...cadastrosResponsaveis.filter(item => item.ativo).map(item => ({ id: item.id, nome: item.nome, origem: "CADASTRO" as const }))];
  const pontos: PontoImpressaoTela[] = pontosDb.map((ponto) => ({
    id: ponto.id, excluidoEm: ponto.excluidoEm?.toISOString() ?? null, nome: ponto.nome, icone: ponto.icone, ativo: ponto.ativo, padrao: ponto.padrao,
    situacao: situacaoConector(ponto.dispositivo), vistoEm: ponto.dispositivo?.vistoEm?.toISOString() ?? null,
    impressoraDetectada: ponto.dispositivo?.impressoraDetectada ?? false, impressoraSelecionadaId: ponto.impressoraSelecionadaId,
    impressoras: sessao.admin && Array.isArray(ponto.dispositivo?.usbImpressoras) ? (ponto.dispositivo.usbImpressoras as { id: string; nome: string }[]) : [],
    wifiSsid: sessao.admin ? ponto.dispositivo?.wifiSsid ?? null : null, wifiFrequenciaMhz: sessao.admin ? ponto.dispositivo?.wifiFrequenciaMhz ?? null : null,
    wifiRedes: sessao.admin && Array.isArray(ponto.dispositivo?.wifiRedes) ? (ponto.dispositivo.wifiRedes as { ssid: string; frequenciaMhz: number }[]) : [],
    wifiMudancaEstado: sessao.admin ? ponto.mudancasWifi[0]?.estado ?? null : null,
    wifiEndereco: sessao.admin ? ponto.dispositivo?.wifiEndereco ?? null : null, ethernetEndereco: sessao.admin ? ponto.dispositivo?.ethernetEndereco ?? null : null,
    hostname: sessao.admin ? ponto.dispositivo?.hostname ?? null : null, modelo: sessao.admin ? ponto.dispositivo?.modelo ?? null : null,
    pendentes: ponto.envios.filter((envio) => envio.estado === "PENDENTE").length,
    incertos: ponto.envios.filter((envio) => envio.estado === "INCERTO").length,
  }));

  const produtos = produtosDb.map((produto) => ({
    id: produto.id,
    fotoUrl: produto.fotoMimeType ? `/api/etiquetas/produtos/${produto.id}/foto` : null,
    nome: produto.nome,
    especificacao: produto.especificacao,
    marcasFornecedor: [...new Set([
      ...(produto.marcasHomologadas ?? []),
      ...(produto.fornecedorPrincipal?.nome ? [produto.fornecedorPrincipal.nome] : []),
    ])],
    tipo: produto.tipo,
    unidade: produto.unidade,
    categoria: produto.categoria?.nome ?? null,
    ativo: produto.ativo,
    etiquetaHabilitada: produto.etiquetaHabilitada,
    validadeSecoDias: produto.validadeSecoDias,
    validadeRefrigeradoDias: produto.validadeRefrigeradoDias,
    validadeCongeladoDias: produto.validadeCongeladoDias,
    validadeAposAbertoDias: produto.validadeAposAbertoDias,
    conservacaoEtiquetaPadrao: produto.conservacaoEtiquetaPadrao,
    versaoConfiguracaoEtiqueta: produto.versaoConfiguracaoEtiqueta,
  }));

  const historico = historicoDb.map((trabalho) => {
    const dados = {
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
    return {
      id: trabalho.id,
      produtoNome: trabalho.produtoNome,
      conservacao: trabalho.conservacao,
      responsavelManipulacao: trabalho.responsavelManipulacao,
      emitidoPorNome: trabalho.emitidoPor.nome,
      manipuladoEm: trabalho.manipuladoEm.toISOString(),
      validoAte: trabalho.validoAte.toISOString(),
      fusoHorario: trabalho.fusoHorario,
      copias: trabalho.copias,
      status: trabalho.status,
      pontoEstado: trabalho.enviosPonto[0]?.estado ?? null,
      tamanho: trabalho.tamanho,
      zpl: trabalho.zpl,
      nomeArquivo: nomeArquivoZpl(trabalho.produtoNome, trabalho.id),
      dados,
      tentativas: trabalho._count.tentativas,
    };
  });

  return (
    <div className="validades-premium space-y-3">
      <header className="validades-cabecalho">
        <h1 className="text-display">{titulosSecoesEtiquetas[secao]}</h1>
        <p className="max-w-3xl text-muted-foreground">
          {secao === "validades" ? "Acompanhe prazos e registre baixas." : secao === "configuracoes" ? "Gerencie pontos, responsáveis e impressoras." : "Selecione o produto e imprima sua etiqueta."}
        </p>
      </header>
      <EtiquetasClient
        key={`${secao}-${pagina}-${parametros.situacao ?? "todas"}-${parametros.prazos ?? ""}`}
        dedicado={dedicado}
        secao={secao}
        mostrarPrazos={parametros.prazos === "1"}
        gestaoValidades={gestaoValidades}
        produtos={produtos}
        historico={historico}
        admin={sessao.admin}
        podeConfigurarValidades={sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, "producao.validades", "editar")}
        responsaveis={opcoesResponsaveis}
        configuracaoResponsaveis={sessao.admin ? { usuarios: responsaveis.map(item => ({ id: item.id, nome: item.nome, ativo: item.responsavelEtiquetaHabilitado })), cadastros: cadastrosResponsaveis } : undefined}
        caminhoBase={CAMINHO_ETIQUETAS}
        loja={{
          fusoHorario: lojaDb?.fusoHorario ?? "America/Sao_Paulo",
          maximoCopiasEtiqueta: lojaDb?.maximoCopiasEtiqueta ?? 30,
          nome: lojaDb?.nome?.trim() || "Grazing Table & Co",
          cnpj: lojaDb?.cnpj ?? null,
          endereco: lojaDb?.endereco ?? null,
        }}
        perfil={perfilDb ? {
          id: perfilDb.id,
          nome: perfilDb.nome,
          modelo: perfilDb.modelo,
          dpi: perfilDb.dpi,
          suporta60x40: perfilDb.suporta60x40,
          suporta60x60: perfilDb.suporta60x60,
          planejamentoRaspberry: lerPlanejamentoRaspberry(perfilDb.planejamentoRaspberry),
        } : null}
        pontos={pontos}
        enviosPonto={enviosDb.map((envio) => ({ id: envio.id, tipo: envio.tipo, estado: envio.estado, criadoEm: envio.createdAt.toISOString(), finalizadoEm: envio.finalizadoEm?.toISOString() ?? null, detalhe: envio.detalhe, pontoNome: envio.ponto.nome, produtoNome: envio.trabalho?.produtoNome ?? null }))}
        paginaHistorico={{ pagina, porPagina, total: totalHistorico }}
        abaInicial={parametros.pagina || parametros.aba === "historico" ? "historico" : "imprimir"}
      />
    </div>
  );
}
