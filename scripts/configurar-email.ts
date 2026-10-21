// Manutenção administrativa via SSH. JSON privado exclusivamente por stdin, nunca argumentos.
import { prisma } from "../src/lib/prisma";
import { cifrar } from "../src/lib/crypto";
import nodemailer from "nodemailer";

async function configurar() {
  let entrada = "";
  for await (const parte of process.stdin) { entrada += parte.toString(); if (entrada.length > 16384) throw new Error("Entrada inválida"); }
  const dados = JSON.parse(entrada) as Record<string, unknown>;
  const campos = ["host", "usuario", "senha", "remetente", "origem"];
  if (campos.some(c => typeof dados[c] !== "string" || !(dados[c] as string).trim()) || ![465, 587].includes(Number(dados.porta))) throw new Error("Configuração inválida");
  const { host, usuario, senha, remetente, origem } = dados as Record<string, string>;
  const url = new URL(origem);
  if (url.protocol !== "https:" || url.username || url.password || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(remetente)) throw new Error("Configuração inválida");
  const porta = Number(dados.porta);
  const transporte = nodemailer.createTransport({ host, port: porta, secure: porta === 465, requireTLS: true,
    auth: { user: usuario, pass: senha }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000, logger: false, debug: false });
  try { await transporte.verify(); } finally { transporte.close(); }
  const salvar = { host, porta, usuario, senhaCifrada: cifrar(senha, "grazing-hub-email"), remetente, origem: url.origin };
  await prisma.configuracaoEmail.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...salvar }, update: salvar });
  console.log("Configuração de e-mail salva com senha cifrada. Autenticação SMTP validada; nenhum e-mail enviado.");
}
configurar().catch(() => { console.error("Não foi possível validar e salvar o e-mail. Confira os dados e a conectividade SMTP."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
