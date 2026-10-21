import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { cifrar, decifrar } from "@/lib/crypto";
import type { SessaoAtual } from "@/lib/session";
import { chamarIfood, FalhaHttpIfood, lerToken } from "./cliente";
import { ErroIfood, objeto, texto } from "./dominio";
import { acessoIfood, exigirConta } from "./acesso";
import { conferirTransporteAcompanhamento } from "./acompanhamento";

export const contextoSegredo = "grazing-hub-ifood-v1";
export const cifrarIfood = (v: unknown) => cifrar(JSON.stringify(v), contextoSegredo);
export const decifrarIfood = (v: string): unknown => JSON.parse(decifrar(v, contextoSegredo));
export function credenciais(ambiente: string, clientId: string) {
  if (!["TESTE", "PRODUCAO"].includes(ambiente)) throw new ErroIfood("Ambiente inválido.");
  const id = process.env[`IFOOD_${ambiente}_CLIENT_ID`], secret = process.env[`IFOOD_${ambiente}_CLIENT_SECRET`];
  if (!id || id !== clientId || !secret) throw new ErroIfood("Configure as credenciais deste ambiente no servidor.");
  return { clientId: id, clientSecret: secret };
}
export async function obterToken(integracaoId: string, rejeitado?: string) {
  try { return await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"ifood-token:" + integracaoId}))`;
    const i = await tx.integracaoIfood.findUniqueOrThrow({ where: { id: integracaoId } }); exigirConta(i.contaId);
    if (i.tokenCifrado && i.tokenExpiraEm && i.tokenExpiraEm.getTime() > Date.now()) {
      const atual = String(decifrarIfood(i.tokenCifrado));
      if (!rejeitado || rejeitado !== atual) return atual;
    }
    const formulario = { ...credenciais(i.ambiente, i.clientId), ...(i.modalidade === "CENTRALIZADO" ? { grantType: "client_credentials" } : i.refreshCifrado ? { grantType: "refresh_token", refreshToken: String(decifrarIfood(i.refreshCifrado)) } : {}) };
    if (!("grantType" in formulario)) throw new ErroIfood("Autorize novamente o aplicativo distribuído.");
    const t = lerToken((await chamarIfood("/authentication/v1.0/oauth/token", { metodo: "POST", formulario })).dados);
    await tx.integracaoIfood.update({ where: { id: i.id }, data: { tokenCifrado: cifrarIfood(t.token), refreshCifrado: t.refresh ? cifrarIfood(t.refresh) : i.refreshCifrado, tokenExpiraEm: t.expiraEm, ultimoErro: null } });
    return t.token;
  }, { timeout: 20000, maxWait: 20000 }); }
  catch (e) {
    if (e instanceof FalhaHttpIfood && e.status >= 400 && e.status < 500 && e.status !== 429) {
      await prisma.integracaoIfood.updateMany({ where: { id: integracaoId, contaId: "singleton" }, data: { ultimoErro: "Autenticação recusada; confira credenciais/permissões e refaça o vínculo" } });
      await prisma.lojaIfood.updateMany({ where: { integracaoId, integracao: { contaId: "singleton" } }, data: { autorizada: false, ultimoErro: "Autenticação recusada; intervenção administrativa necessária" } });
    }
    throw e;
  }
}
export async function requisicaoAutorizada(integracaoId: string, caminho: string, op: Omit<NonNullable<Parameters<typeof chamarIfood>[1]>, "token"> & { lojaId?: string } = {}) {
  await conferirTransporteAcompanhamento(integracaoId, caminho, op);
  const token = await obterToken(integracaoId);
  await conferirTransporteAcompanhamento(integracaoId, caminho, op);
  try { return await chamarIfood(caminho, { ...op, token }); }
  catch (e) {
    if (!(e instanceof FalhaHttpIfood) || e.status !== 401) throw e;
    const novo = await obterToken(integracaoId, token);
    await conferirTransporteAcompanhamento(integracaoId, caminho, op);
    return chamarIfood(caminho, { ...op, token: novo });
  }
}
export async function iniciarVinculo(integracaoId: string, sessao: SessaoAtual, marcaSessao: string) {
  return prisma.$transaction(async tx => {
    await acessoIfood(tx, sessao, undefined, true);
    const i = await tx.integracaoIfood.findUniqueOrThrow({ where: { id: integracaoId } }); exigirConta(i.contaId);
    if (i.modalidade !== "DISTRIBUIDO") throw new ErroIfood("O aplicativo centralizado é autorizado no Portal do Parceiro.");
    const d = objeto((await chamarIfood("/authentication/v1.0/oauth/userCode", { metodo: "POST", formulario: { clientId: credenciais(i.ambiente, i.clientId).clientId } })).dados);
    if (typeof d.expiresIn !== "number" || d.expiresIn <= 0 || !texto(d.authorizationCodeVerifier) || !/^[A-Z0-9-]{4,32}$/.test(texto(d.userCode))) throw new ErroIfood("Código de vínculo fora do contrato.");
    let url: URL;
    try { url = new URL(String(d.verificationUrl)); } catch { throw new ErroIfood("Endereço de autorização fora do contrato."); }
    if (url.protocol !== "https:" || !url.hostname.endsWith(".ifood.com.br") || url.username || url.password || url.search || url.hash) throw new ErroIfood("Endereço de autorização fora do contrato.");
    const id = randomUUID();
    await tx.integracaoIfood.update({ where: { id: i.id }, data: { autorizacaoId: id, autorizacaoUsuarioId: sessao.userId, autorizacaoSessaoVersao: sessao.versao ?? 0, verificadorCifrado: cifrarIfood({ verificador: d.authorizationCodeVerifier, sessao: marcaSessao }), autorizacaoExpiraEm: new Date(Date.now() + d.expiresIn * 1000) } });
    return { id, userCode: String(d.userCode), verificationUrl: url.toString(), expiraEm: new Date(Date.now() + d.expiresIn * 1000).toISOString() };
  }, { timeout: 20000 });
}
export async function concluirVinculo(integracaoId: string, solicitacaoId: string, codigo: string, sessao: SessaoAtual, marcaSessao: string) {
  if (!/^[a-zA-Z0-9_-]{1,512}$/.test(codigo)) throw new ErroIfood("Código de autorização inválido.");
  await prisma.$transaction(async tx => {
    await acessoIfood(tx, sessao, undefined, true);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"ifood-token:" + integracaoId}))`;
    const i = await tx.integracaoIfood.findUniqueOrThrow({ where: { id: integracaoId } }); exigirConta(i.contaId);
    if (i.modalidade !== "DISTRIBUIDO" || i.autorizacaoId !== solicitacaoId || i.autorizacaoUsuarioId !== sessao.userId || i.autorizacaoSessaoVersao !== (sessao.versao ?? 0) || !i.verificadorCifrado || !i.autorizacaoExpiraEm || i.autorizacaoExpiraEm <= new Date()) throw new ErroIfood("Vínculo expirado ou solicitado por outra sessão.");
    const verificador = objeto(decifrarIfood(i.verificadorCifrado));
    if (verificador.sessao !== marcaSessao) throw new ErroIfood("Conclua o vínculo na sessão que o iniciou.");
    const t = lerToken((await chamarIfood("/authentication/v1.0/oauth/token", { metodo: "POST", formulario: { ...credenciais(i.ambiente, i.clientId), grantType: "authorization_code", authorizationCode: codigo, authorizationCodeVerifier: String(verificador.verificador) } })).dados);
    await tx.integracaoIfood.update({ where: { id: i.id }, data: { tokenCifrado: cifrarIfood(t.token), refreshCifrado: t.refresh ? cifrarIfood(t.refresh) : null, tokenExpiraEm: t.expiraEm, autorizacaoId: null, verificadorCifrado: null, autorizacaoExpiraEm: null, ultimoErro: null } });
  }, { timeout: 20000 });
}
