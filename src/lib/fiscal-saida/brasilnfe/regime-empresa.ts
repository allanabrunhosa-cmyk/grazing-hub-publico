import "server-only";
import type { RegraFiscalBrasilNfe, VersaoRegraFiscalBrasilNfe } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { conferirProvaInterna } from "./regras-tributarias";
import { dataCivilRegraBrasilNfe, hashRegraFiscalBrasilNfe, hojeCivilRegraBrasilNfe, validarConteudoRegraFiscalBrasilNfe, vigenteRegraFiscalBrasilNfe } from "./regras-tributarias-dominio";
import { conferirFundamentacaoAprovavelBrasilNfe, validarFundamentacaoFiscalBrasilNfe, type FundamentacaoFiscalBrasilNfe } from "./fundamentacao-dominio";
import type { ParametrosPayloadLocalBrasilNfe } from "./payload-local-tipos";
import type { SessaoAtual } from "@/lib/session";
import { permissaoEfetiva, type Permissoes, type Excecoes } from "@/lib/permissoes/catalogo";
import { hashFiscal } from "@/lib/tributacao/servico";
import { validarDadosFiscais } from "@/lib/tributacao/validacao";
import type { PerfilFiscal } from "@/lib/tributacao/tipos";

export const DESCRICOES_CRT = { 1: "Simples Nacional", 2: "Simples Nacional — excesso de sublimite de receita bruta", 3: "Regime normal", 4: "Simples Nacional — Microempreendedor Individual (MEI)" } as const;
export type RegimeFiscalEmpresaBrasilNfe = {
  dia: string; regime: string | null; crt: 1 | 2 | 3 | 4 | null; descricaoCrt: string | null; ie: string | null;
  vigenteDesde: string | null; vigenteAte: string | null;
  modelos: { 55: string | null; 65: string | null }; pendencias: string[];
  verificacoes: { modelo: 55 | 65; versaoId: string; revisao: number; aprovadoEm: string; fontes: { titulo: string; referencia: string; consultadoEm: string }[] }[];
};
export function regimeFiscalEmpresaPendente(dia = hojeCivilRegraBrasilNfe()): RegimeFiscalEmpresaBrasilNfe {
  return { dia, regime: null, crt: null, descricaoCrt: null, ie: null, vigenteDesde: null, vigenteAte: null, modelos: { 55: null, 65: null }, pendencias: ["Revisar e aprovar a configuração fiscal da empresa com vigência para a operação."], verificacoes: [] };
}

/** PERFIL é a autoridade vigente do motor. EMPRESA permanece somente para a
 * leitura histórica de ambientes anteriores à estrutura fiscal versionada. */
export async function obterRegimeFiscalEmpresaBrasilNfe(dia = hojeCivilRegraBrasilNfe(), sessao?: SessaoAtual): Promise<RegimeFiscalEmpresaBrasilNfe> {
  dataCivilRegraBrasilNfe(dia, "dataOperacao");
  if (sessao) {
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
      const u = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
      if (!u?.ativo || u.excluidoEm || u.sessaoVersao !== (sessao.versao ?? 0)
        || (u.perfilAcesso?.sistema !== "ADMINISTRADOR" && !["vendas.fiscal", "financeiro.fiscal.painel"].some(r => permissaoEfetiva((u.perfilAcesso?.permissoes ?? {}) as Permissoes, (u.permissoesPersonalizadas ?? {}) as Excecoes, r, "visualizar")))) throw new Error("Acesso à configuração fiscal não permitido.");
    });
  } else await exigirPermissao(await podeAcessar("vendas.fiscal") ? "vendas.fiscal" : "financeiro.fiscal.painel");
  const loja = await prisma.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { nome: true, cnpj: true, enderecoEstruturado: true } });
  const vazio = regimeFiscalEmpresaPendente(dia);
  if (!loja) return vazio;
  const [estrutura] = await prisma.$queryRaw<{ existe: boolean }[]>`SELECT to_regclass('"VersaoEstruturaFiscal"') IS NOT NULL AS existe`;
  if (estrutura?.existe) {
    const v = await prisma.versaoEstruturaFiscal.findFirst({ where: { tipo: "PERFIL", chave: "singleton", status: "ATIVO", vigenciaInicio: { lte: new Date(`${dia}T00:00:00Z`) } }, orderBy: [{ vigenciaInicio: "desc" }, { versao: "desc" }], include: { eventos: { where: { tipo: "ATIVACAO" }, orderBy: { createdAt: "desc" }, take: 1 } } });
    if (!v) return vazio;
    try {
      const perfil = validarDadosFiscais("PERFIL", v.dados) as PerfilFiscal;
      const evento = v.eventos[0], prova = evento?.dados as { hashConteudo?: string } | undefined;
      if (!perfil.confirmado || !perfil.evidenciaEnquadramento || perfil.cnpj !== loja.cnpj?.replace(/\D/g, "") || hashFiscal(perfil) !== v.hash || prova?.hashConteudo !== v.hash) return vazio;
      const fontes = (v.fontes as string[]).filter(f => typeof f === "string").map(f => ({ titulo: "Evidência do perfil fiscal", referencia: f, consultadoEm: v.vigenciaInicio.toISOString().slice(0, 10) }));
      return { dia, regime: perfil.regime === "SIMPLES_NACIONAL" ? "Simples Nacional" : "Lucro Presumido", crt: perfil.crt ?? null, descricaoCrt: perfil.crt ? DESCRICOES_CRT[perfil.crt] : null, ie: perfil.inscricaoEstadual, vigenteDesde: v.vigenciaInicio.toISOString().slice(0, 10), vigenteAte: null,
        modelos: { 55: perfil.modelos.includes("55") ? v.id : null, 65: perfil.modelos.includes("65") ? v.id : null },
        pendencias: perfil.crt ? [] : ["Regime vigente confirmado. Registrar o CRT comprovado em nova versão do perfil; o nome do regime não define o CRT."],
        verificacoes: perfil.modelos.map(m => ({ modelo: Number(m) as 55 | 65, versaoId: v.id, revisao: v.versao, aprovadoEm: evento.createdAt.toISOString(), fontes })) };
    } catch { return { ...vazio, pendencias: ["A versão vigente do perfil exige revisão da prova cadastral e da aprovação."] }; }
  }
  const regras = await prisma.regraFiscalBrasilNfe.findMany({ where: { lojaId: "singleton", alvo: "EMPRESA", modelo: { in: [55, 65] } }, include: { versoes: { orderBy: { revisao: "desc" }, take: 1 } } });
  const confirmadas: { v: VersaoRegraFiscalBrasilNfe; r: RegraFiscalBrasilNfe; emitente: ParametrosPayloadLocalBrasilNfe["emitente"]; fundamento: FundamentacaoFiscalBrasilNfe; aprovadoEm: string }[] = [];
  for (const r of regras) {
    const v = r.versoes[0];
    if (!v || v.revisao !== r.revisao || !vigenteRegraFiscalBrasilNfe(v, dia) || v.emitenteHash !== hashRegraFiscalBrasilNfe(loja)) continue;
    try {
      conferirProvaInterna(v, r);
      const conteudo = validarConteudoRegraFiscalBrasilNfe(v.conteudo, "EMPRESA");
      const fundamento = validarFundamentacaoFiscalBrasilNfe(v.fundamentacaoFiscal);
      if (conteudo.tipo !== "EMPRESA" || hashRegraFiscalBrasilNfe(conteudo) !== v.conteudoHash || hashRegraFiscalBrasilNfe(fundamento) !== v.fundamentacaoHash || fundamento.contexto.operacao !== r.operacao) continue;
      conferirFundamentacaoAprovavelBrasilNfe(fundamento, conteudo, r.operacao as "NF_E_VENDA" | "NFC_E_VENDA", dia);
      const aprovacao = v.aprovacaoInterna as unknown as { aprovadoEm: string };
      confirmadas.push({ v, r, emitente: conteudo.emitente, fundamento, aprovadoEm: aprovacao.aprovadoEm });
    } catch { /* Uma evidência inválida não é convertida em regime confirmado. */ }
  }
  if (!confirmadas.length) return vazio;
  const primeira = confirmadas[0];
  if (confirmadas.some(c => hashRegraFiscalBrasilNfe(c.emitente) !== hashRegraFiscalBrasilNfe(primeira.emitente) || c.fundamento.contexto.regime !== primeira.fundamento.contexto.regime)
    || [55, 65].some(m => confirmadas.filter(c => c.r.modelo === m).length > 1)) {
    return { ...vazio, pendencias: ["Há configurações EMPRESA divergentes ou sobrepostas. Revise o regime central antes de emitir."] };
  }
  const regime = primeira.fundamento.contexto.regime;
  const { crt, ie } = primeira.emitente;
  const nome = regime === "SIMPLES_NACIONAL" ? "Simples Nacional" : regime === "LUCRO_PRESUMIDO" ? "Lucro Presumido" : regime === "LUCRO_REAL" ? "Lucro Real" : null;
  if (!nome || ((crt === 1 || crt === 2 || crt === 4) !== (regime === "SIMPLES_NACIONAL"))) return { ...vazio, pendencias: ["O regime fundamentado e o CRT aprovado são incompatíveis. Revise a configuração da empresa."] };
  return { dia, regime: nome, crt, descricaoCrt: DESCRICOES_CRT[crt], ie,
    vigenteDesde: confirmadas.map(c => c.v.vigenteDesde).sort().at(-1)!,
    vigenteAte: confirmadas.map(c => c.v.vigenteAte).filter((v): v is string => !!v).sort()[0] ?? null,
    modelos: { 55: confirmadas.find(c => c.r.modelo === 55)?.v.id ?? null, 65: confirmadas.find(c => c.r.modelo === 65)?.v.id ?? null }, pendencias: [],
    verificacoes: confirmadas.map(c => ({ modelo: c.r.modelo as 55 | 65, versaoId: c.v.id, revisao: c.v.revisao, aprovadoEm: c.aprovadoEm, fontes: c.fundamento.fontes.filter(f => c.fundamento.confianca.find(v => v.campo === "EMITENTE")?.fontes.includes(f.id)).map(f => ({ titulo: f.titulo, referencia: f.referencia, consultadoEm: f.consultadoEm })) })),
  };
}
