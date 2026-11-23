import "server-only";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { configuracaoEnvioEmail } from "@/lib/recuperacao-senha/email";
import { consultarRevisoesNcmPendentes, registrarAlertaRevisoesNcm, revisoesNcmSemAlerta, type RevisaoNcmPendente } from "./revisao-ncm";

const escapar = (v: string) => v.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function montarEmailRevisaoNcm(pendentes: RevisaoNcmPendente[], origem: string) {
  const link = `${origem}/financeiro/fiscal#revisao-ncm`, n = pendentes.length;
  const titulo = n === 1 ? "1 produto precisa de revisão de NCM" : `${n} produtos precisam de revisão de NCM`;
  const explicacao = "A composição destes produtos mudou depois da análise fiscal. As notas continuam saindo com o NCM atual; ele só muda com a sua decisão. Confira cada produto e escolha manter ou alterar o NCM.";
  const itens = pendentes.slice(0, 30).map(p => ({ nome: p.nome, ncm: p.ncms.join(", ") || "sem NCM", mudancas: p.mudancas.slice(0, 6) }));
  const resto = n > itens.length ? `e mais ${n - itens.length} produto(s) no painel.` : "";
  const text = `${titulo}\n\n${explicacao}\n\n${itens.map(i => `- ${i.nome} (NCM ${i.ncm})\n${i.mudancas.map(m => `    · ${m}`).join("\n")}`).join("\n")}\n${resto ? `\n${resto}\n` : ""}\nRevisar no painel fiscal: ${link}`;
  const html = `<div style="background:#f1f5f9;padding:32px 16px;font-family:Arial,sans-serif;color:#16314d"><div style="max-width:560px;margin:auto;background:white;padding:32px;border-radius:20px"><p style="font-weight:bold;font-size:18px">Grazing HUB</p><h1 style="font-size:22px">${escapar(titulo)}</h1><p style="line-height:1.6">${escapar(explicacao)}</p>${itens.map(i => `<div style="border-top:1px solid #e2e8f0;padding:12px 0"><p style="margin:0;font-weight:bold">${escapar(i.nome)}</p><p style="margin:4px 0;font-size:13px;color:#475569">NCM atual: ${escapar(i.ncm)}</p><ul style="margin:6px 0 0;padding-left:18px;font-size:13px;line-height:1.6">${i.mudancas.map(m => `<li>${escapar(m)}</li>`).join("")}</ul></div>`).join("")}${resto ? `<p style="font-size:13px">${escapar(resto)}</p>` : ""}<p style="margin:28px 0"><a href="${link}" style="display:inline-block;background:#16314d;color:white;text-decoration:none;border-radius:10px;padding:14px 24px">Revisar no painel fiscal</a></p><hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0"><p style="font-size:13px;line-height:1.6;color:#475569">Aviso automático enviado aos administradores. Cada alteração é avisada uma única vez.</p></div></div>`;
  return { subject: `${titulo} — Grazing HUB`, text, html };
}

let emAndamento: Promise<void> | null = null;

/** Confere as pendências e avisa por e-mail somente as que ainda não foram avisadas.
 * O aviso é registrado depois do envio aceito: sem e-mail configurado, tenta de novo depois. */
export async function verificarEAlertarRevisoesNcm(pendentesConhecidos?: RevisaoNcmPendente[]) {
  if (emAndamento) return emAndamento;
  emAndamento = (async () => {
    const novos = await revisoesNcmSemAlerta(pendentesConhecidos ?? await consultarRevisoesNcmPendentes());
    if (!novos.length) return;
    const config = await configuracaoEnvioEmail(); if (!config) return;
    const administradores = await prisma.usuario.findMany({ where: { ativo: true, excluidoEm: null, emailVerificadoEm: { not: null }, perfilAcesso: { sistema: "ADMINISTRADOR" } }, select: { email: true } });
    if (!administradores.length) return;
    const mensagem = montarEmailRevisaoNcm(novos, config.origem);
    const transporte = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.port === 465, requireTLS: true, auth: { user: config.user, pass: config.pass }, tls: { minVersion: "TLSv1.2" },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000, dnsTimeout: 10000, disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false });
    try {
      const resultado = await transporte.sendMail({ from: { name: "Grazing HUB", address: config.from }, to: administradores.map(a => a.email), ...mensagem });
      if (!resultado.accepted.length) return;
    } finally { transporte.close(); }
    await registrarAlertaRevisoesNcm(novos, administradores.length);
  })().finally(() => { emAndamento = null; });
  return emAndamento;
}

