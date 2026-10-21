"use server";

import { Prisma } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { emitirCodigoVinculo, LOJA_ETIQUETAS } from "@/lib/etiquetas/pontos";
import { cifrarSenhaWifi } from "@/lib/etiquetas/pontos-wifi";

const CAMINHO = "/producao/etiquetas";
type Retorno = { ok: true } | { erro: string };

function falhaSegura(erro: unknown, padrao: string) {
  return erro instanceof Error && !erro.name.startsWith("Prisma") ? erro.message : padrao;
}

async function exigirAdministrador() {
  const sessao = await getSession();
  if (!sessao?.admin) throw new Error("A gestão de pontos exige administrador ativo.");
  return sessao;
}

function nomeValido(valor: string) {
  const nome = valor.trim();
  if (!nome || nome.length > 80) throw new Error("Informe um nome de até 80 caracteres.");
  return nome;
}

export async function criarPontoImpressaoAction(nomeInformado: string, icone: string): Promise<Retorno> {
  await exigirPermissao("producao", "adicionar");
  try {
    await exigirAdministrador();
    const nome = nomeValido(nomeInformado);
    if (!["impressora", "cozinha", "etiqueta"].includes(icone)) return { erro: "Ícone inválido." };
    await prisma.configuracaoLoja.upsert({ where: { id: LOJA_ETIQUETAS }, create: { id: LOJA_ETIQUETAS }, update: {} });
    await prisma.pontoImpressao.create({ data: { lojaId: LOJA_ETIQUETAS, nome, icone } });
    revalidatePath(CAMINHO);
    return { ok: true };
  } catch (erro) { return { erro: falhaSegura(erro, "Falha ao criar ponto.") }; }
}

export async function atualizarPontoImpressaoAction(pontoId: string, entrada: { nome: string; icone: string; ativo: boolean; padrao: boolean }): Promise<Retorno> {
  await exigirPermissao("producao", "editar");
  try {
    await exigirAdministrador();
    const nome = nomeValido(entrada.nome);
    if (!["impressora", "cozinha", "etiqueta"].includes(entrada.icone)) return { erro: "Ícone inválido." };
    if (entrada.padrao && !entrada.ativo) return { erro: "O ponto padrão precisa estar ativo." };
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${pontoId}))::text AS trava`);
      const existe = await tx.pontoImpressao.findFirst({ where: { id: pontoId, lojaId: LOJA_ETIQUETAS, excluidoEm: null } });
      if (!existe) throw new Error("Ponto não encontrado.");
      if (entrada.padrao) await tx.pontoImpressao.updateMany({ where: { lojaId: LOJA_ETIQUETAS, padrao: true }, data: { padrao: false } });
      await tx.pontoImpressao.update({ where: { id: pontoId }, data: { nome, icone: entrada.icone, ativo: entrada.ativo, padrao: entrada.padrao } });
    });
    revalidatePath(CAMINHO);
    return { ok: true };
  } catch (erro) { return { erro: falhaSegura(erro, "Falha ao salvar ponto.") }; }
}

export async function emitirCodigoPontoAction(pontoId: string) {
  await exigirPermissao("producao", "editar");
  try {
    const usuario = await exigirAdministrador();
    const resultado = await emitirCodigoVinculo(pontoId, usuario.userId);
    return { ok: true as const, ...resultado, codigo: resultado.codigo };
  } catch (erro) { return { erro: falhaSegura(erro, "Não foi possível emitir o código.") }; }
}

export async function revogarPontoAction(pontoId: string): Promise<Retorno> {
  await exigirPermissao("producao", "editar");
  try {
    await exigirAdministrador();
    await prisma.$transaction(async (tx) => {
      const ponto = await tx.pontoImpressao.findFirst({ where: { id: pontoId, lojaId: LOJA_ETIQUETAS, excluidoEm: null } });
      if (!ponto) throw new Error("Ponto não encontrado.");
      await tx.dispositivoImpressao.updateMany({ where: { pontoId, revogadoEm: null }, data: { revogadoEm: new Date() } });
      await tx.codigoVinculoImpressao.updateMany({ where: { pontoId, usadoEm: null }, data: { usadoEm: new Date() } });
      await tx.envioPontoImpressao.updateMany({ where: { pontoId, estado: "RESERVADO" }, data: { estado: "INCERTO", detalhe: "Vínculo revogado durante reserva.", finalizadoEm: new Date() } });
    });
    revalidatePath(CAMINHO);
    return { ok: true };
  } catch (erro) { return { erro: falhaSegura(erro, "Falha ao revogar.") }; }
}

export async function selecionarImpressoraPontoAction(pontoId: string, impressoraId: string): Promise<Retorno> {
  await exigirPermissao("producao", "editar");
  try {
    await exigirAdministrador();
    const ponto = await prisma.pontoImpressao.findFirst({ where: { id: pontoId, lojaId: LOJA_ETIQUETAS, excluidoEm: null }, include: { dispositivo: true } });
    if (!ponto?.dispositivo || ponto.dispositivo.revogadoEm) return { erro: "Vincule o equipamento primeiro." };
    const encontradas = Array.isArray(ponto.dispositivo.usbImpressoras) ? ponto.dispositivo.usbImpressoras as Array<{ id?: string }> : [];
    if (!encontradas.some((item) => item.id === impressoraId)) return { erro: "A impressora não foi detectada nesse equipamento." };
    await prisma.pontoImpressao.update({ where: { id: pontoId }, data: { impressoraSelecionadaId: impressoraId } });
    revalidatePath(CAMINHO);
    return { ok: true };
  } catch { return { erro: "Não foi possível selecionar a impressora." }; }
}

export async function enfileirarPontoAction(entrada: { pontoId: string; trabalhoId: string; chaveIdempotencia: string; reimpressao: boolean }): Promise<Retorno> {
  await exigirPermissao("producao.imprimir", "adicionar");
  try {
    const usuario = await getSession();
    if (!usuario || !/^[a-f0-9-]{36}$/i.test(entrada.chaveIdempotencia)) return { erro: "Solicitação inválida." };
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${entrada.pontoId}))::text AS trava`);
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`envio:${entrada.trabalhoId}`}))::text AS trava`);
      const existente = await tx.envioPontoImpressao.findUnique({ where: { lojaId_chaveIdempotencia: { lojaId: LOJA_ETIQUETAS, chaveIdempotencia: entrada.chaveIdempotencia } } });
      if (existente) { if (existente.solicitadoPorId !== usuario.userId || existente.trabalhoId !== entrada.trabalhoId || existente.pontoId !== entrada.pontoId) throw new Error("Chave de solicitação já utilizada."); return; }
      const [ponto, trabalho, enviados] = await Promise.all([
        tx.pontoImpressao.findFirst({ where: { id: entrada.pontoId, lojaId: LOJA_ETIQUETAS, ativo: true, excluidoEm: null }, include: { dispositivo: true } }),
        tx.trabalhoEtiqueta.findFirst({ where: { id: entrada.trabalhoId, lojaId: LOJA_ETIQUETAS } }),
        tx.envioPontoImpressao.count({ where: { trabalhoId: entrada.trabalhoId, lojaId: LOJA_ETIQUETAS } }),
      ]);
      if (!ponto?.dispositivo || ponto.dispositivo.revogadoEm || !ponto.impressoraSelecionadaId) throw new Error("Ponto sem conector e impressora selecionada.");
      if (!trabalho || trabalho.tamanho !== "MM_60X60" || trabalho.resolucaoDpi !== 203) throw new Error("Trabalho incompatível com o perfil 60×60, 203 dpi.");
      if (trabalho.copiasBaixadas > 0) throw new Error("Trabalho com baixa registrada. Prepare uma nova etiqueta.");
      if (trabalho.status !== "PREPARADO" && !entrada.reimpressao) throw new Error("Este trabalho já foi utilizado. Confirme uma reimpressão explícita.");
      if (enviados > 0 && !entrada.reimpressao) throw new Error("Este trabalho já foi enviado. Confirme uma reimpressão explícita.");
      if (Date.now() - trabalho.createdAt.getTime() > 30 * 24 * 60 * 60_000 && !entrada.reimpressao) throw new Error("Trabalho antigo exige reimpressão explícita.");
      await tx.envioPontoImpressao.create({ data: { lojaId: LOJA_ETIQUETAS, pontoId: ponto.id, trabalhoId: trabalho.id, solicitadoPorId: usuario.userId, chaveIdempotencia: entrada.chaveIdempotencia, reimpressao: entrada.reimpressao, zpl: trabalho.zpl } });
    });
    revalidatePath(CAMINHO);
    return { ok: true };
  } catch (erro) { return { erro: falhaSegura(erro, "Falha ao enviar à fila.") }; }
}

export async function imprimirTestePontoAction(pontoId: string): Promise<Retorno> {
  await exigirPermissao("producao", "adicionar");
  try {
    const usuario = await exigirAdministrador();
    await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${pontoId}))::text AS trava`);
      const ponto = await tx.pontoImpressao.findFirst({ where: { id: pontoId, lojaId: LOJA_ETIQUETAS, ativo: true, excluidoEm: null }, include: { dispositivo: true } });
    if (!ponto?.dispositivo || ponto.dispositivo.revogadoEm || !ponto.impressoraSelecionadaId) throw new Error("Vincule o equipamento e selecione a impressora.");
    const zpl = "^XA\n^CI27\n^PW480\n^LL480\n^LH0,0\n^FO40,60^A0N,38,38^FDGRAZING VALIDADES^FS\n^FO40,140^A0N,30,30^FDTESTE 60 X 60 MM^FS\n^FO40,210^A0N,24,24^FDCONFERIR SAIDA FISICA^FS\n^PQ1,0,1,N\n^XZ";
    await tx.envioPontoImpressao.create({ data: { lojaId: LOJA_ETIQUETAS, pontoId, solicitadoPorId: usuario.userId, chaveIdempotencia: randomUUID(), tipo: "TESTE", zpl } });
    });
    revalidatePath(CAMINHO);
    return { ok: true };
  } catch { return { erro: "Não foi possível criar o teste." }; }
}

export async function solicitarMudancaWifiPontoAction(entrada: { pontoId: string; ssid: string; senha: string; confirmacao: boolean }): Promise<Retorno> {
  await exigirPermissao("producao", "editar");
  try {
    await exigirAdministrador();
    if (!entrada.confirmacao) return { erro: "Confirme que existe alguém disponível para recuperar a conexão na unidade." };
    const ssid = entrada.ssid.trim();
    if (!ssid || Buffer.byteLength(ssid, "utf8") > 32 || /[\x00-\x1f]/.test(ssid)) return { erro: "SSID inválido." };
    if (!(/^[\x20-\x7e]{8,63}$/.test(entrada.senha) || /^[a-f0-9]{64}$/i.test(entrada.senha))) return { erro: "Senha WPA deve ter 8 a 63 caracteres imprimíveis, ou 64 dígitos hexadecimais." };
    const ponto = await prisma.pontoImpressao.findFirst({ where: { id: entrada.pontoId, lojaId: LOJA_ETIQUETAS, ativo: true, excluidoEm: null }, include: { dispositivo: true } });
    if (!ponto?.dispositivo || ponto.dispositivo.revogadoEm || !ponto.dispositivo.vistoEm || Date.now() - ponto.dispositivo.vistoEm.getTime() > 90_000) return { erro: "A Raspberry precisa estar comunicando para receber uma mudança de rede." };
    if (!ponto.dispositivo.wifiEndereco) return { erro: "Não há Wi-Fi associado. Faça a mudança com acompanhamento local." };
    const segredoCifrado = cifrarSenhaWifi(entrada.senha);
    await prisma.mudancaWifiPonto.create({ data: { pontoId: ponto.id, ssid, segredoCifrado, expiraEm: new Date(Date.now() + 5 * 60_000) } });
    revalidatePath(CAMINHO);
    return { ok: true };
  } catch { return { erro: "Não foi possível preparar a mudança. Verifique a proteção de credenciais e se já existe outra mudança pendente." }; }
}

export async function confirmarSaidaFisicaPontoAction(envioId: string): Promise<Retorno> {
  await exigirPermissao("producao.imprimir", "adicionar");
  const usuario = await getSession();
  if (!usuario) return { erro: "Sessão expirada." };
  const atualizado = await prisma.envioPontoImpressao.updateMany({
    where: { id: envioId, lojaId: LOJA_ETIQUETAS, estado: { in: ["ENVIADO_USB", "INCERTO"] } },
    data: { estado: "CONFIRMADO", confirmadoPorId: usuario.userId, confirmadoEm: new Date(), detalhe: "Saída física confirmada pelo operador." },
  });
  if (!atualizado.count) return { erro: "Envio não encontrado ou sem resultado que possa ser confirmado." };
  revalidatePath(CAMINHO);
  return { ok: true };
}
