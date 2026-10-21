import "server-only";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decifrar } from "@/lib/crypto";
import { MINUTOS_VALIDADE } from "./validacao";

async function configuracao() {
  const salvo = process.env.EMAIL_SMTP_HOST ? null : await prisma.configuracaoEmail.findUnique({ where: { id: "singleton" } });
  const host = process.env.EMAIL_SMTP_HOST || salvo?.host;
  const user = process.env.EMAIL_SMTP_USUARIO || salvo?.usuario;
  const pass = process.env.EMAIL_SMTP_SENHA || (salvo ? decifrar(salvo.senhaCifrada, "grazing-hub-email") : undefined);
  const from = process.env.EMAIL_REMETENTE || salvo?.remetente;
  const port = Number(process.env.EMAIL_SMTP_PORTA || salvo?.porta || 465);
  const origem = new URL(process.env.APP_URL || salvo?.origem || "https://grazinghub.com.br");
  if (!host || !user || !pass || !from || ![465, 587].includes(port) || origem.protocol !== "https:" || origem.username || origem.password) return null;
  return { host, user, pass, from, port, origem: origem.origin };
}

export async function emailConfigurado() {
  try { return await configuracao() !== null; } catch { return false; }
}

export async function enviarEmailRecuperacao(destinatario: string, token?: string, convite = false) {
  const config = await configuracao();
  if (!config) throw new Error("Envio de e-mail não configurado.");
  // O fragmento fica no navegador e não é enviado em URLs de requisição ou Referer.
  const link = `${config.origem}/login/redefinir#${token ?? ""}`;
  const titulo = token ? convite ? "Crie sua senha e confirme seu e-mail" : "Redefina sua senha" : "Sua senha foi alterada";
  const explicacao = token
    ? `${convite ? "Sua conta Grazing foi criada. Ao definir sua senha, você também confirma este e-mail. A mesma conta permite entrar no HUB, Gestor de Pedidos, Validades e Atendimento, conforme seu perfil de acesso." : "Recebemos uma solicitação para redefinir sua senha no Grazing HUB."} Use pelo menos 8 caracteres, uma letra maiúscula e um caractere especial. Este link é de uso único e vence em ${MINUTOS_VALIDADE} minutos.`
    : "A senha da sua conta no Grazing HUB foi alterada. As sessões anteriores foram encerradas. Se você não fez essa alteração, entre em contato com o administrador da empresa imediatamente.";
  const rodape = token ? convite ? "Se você não esperava este convite, entre em contato com o administrador. Nunca compartilhe este link." : "Se você não solicitou esta alteração, ignore esta mensagem. Sua senha continua a mesma." : "Nunca compartilhe sua senha ou links de recuperação.";
  const transporte = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.port === 465,
    requireTLS: true, auth: { user: config.user, pass: config.pass }, tls: { minVersion: "TLSv1.2" },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000, dnsTimeout: 10000,
    disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false });
  try {
    const resultado = await transporte.sendMail({ from: { name: "Grazing HUB", address: config.from }, to: destinatario,
      subject: `${titulo} — Grazing HUB`,
      text: `${titulo}\n\n${explicacao}\n\n${token ? `${link}\n\n` : ""}${rodape}`,
      html: `<div style="background:#f1f5f9;padding:32px 16px;font-family:Arial,sans-serif;color:#16314d"><div style="max-width:480px;margin:auto;background:white;padding:32px;border-radius:20px"><p style="font-weight:bold;font-size:18px">Grazing HUB</p><h1 style="font-size:24px">${titulo}</h1><p style="line-height:1.6">${explicacao}</p>${token ? `<p style="margin:28px 0"><a href="${link}" style="display:inline-block;background:#16314d;color:white;text-decoration:none;border-radius:10px;padding:14px 24px">Criar nova senha</a></p><p style="font-size:13px;line-height:1.6">Se o botão não abrir, copie este endereço no navegador:</p><p style="font-size:12px;word-break:break-all">${link}</p>` : ""}<hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0"><p style="font-size:13px;line-height:1.6;color:#475569">${rodape}</p></div></div>` });
    if (!resultado.accepted.length) throw new Error("Mensagem não aceita pelo serviço de e-mail.");
  } finally { transporte.close(); }
}
