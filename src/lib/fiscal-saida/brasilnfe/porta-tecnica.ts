import "server-only";
import { prisma } from "@/lib/prisma";
import { permissaoEfetiva, type Excecoes, type Permissoes } from "@/lib/permissoes/catalogo";
import type { SessaoAtual } from "@/lib/session";
import type { IdentidadeFiscalSaida } from "../contrato";
import { ErroAdaptadorBrasilNfe, type PortaOperacaoBrasilNfe } from "./adaptador";
import { conferirIdentidadeBrasilNfe } from "./consulta";
import { normalizarCnpjBrasilNfe } from "./mapeamento";
import { obterComplementosAprovadosDocumentoBrasilNfe } from "./regras-tributarias";
import { hashRegraFiscalBrasilNfe } from "./regras-tributarias-dominio";
import { conferirAutorizacaoBrasilNfe } from "./resposta-fiscal";

export class ErroPortaTecnicaBrasilNfe extends Error {
  constructor(readonly codigo: "ACESSO_NEGADO" | "VINCULO_INVALIDO" | "PLANO_PENDENTE") {
    super(codigo === "ACESSO_NEGADO" ? "Seu acesso não permite conferir esta preparação fiscal." : codigo === "PLANO_PENDENTE" ? "O documento não possui um plano fiscal aprovado e completo." : "Documento, fotografia e identidade fiscal não correspondem à preparação aprovada.");
    this.name = "ErroPortaTecnicaBrasilNfe";
  }
}
const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};

/** Ponte de leitura para a fila existente. Liga decisões aprovadas e evidência
 * durável, mas não concede autorização de transmissão por sessão, credenciais,
 * configuração preenchida ou criação desta porta. O registro segue ausente. */
export function criarPortaTecnicaBrasilNfe(sessao: SessaoAtual, ambiente: "HOMOLOGACAO" | "PRODUCAO" = "HOMOLOGACAO"): PortaOperacaoBrasilNfe {
  const ler = async (identidade: IdentidadeFiscalSaida, editar: boolean) => {
    const i = conferirIdentidadeBrasilNfe(identidade);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
      const u = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
      const admin = u?.perfilAcesso?.sistema === "ADMINISTRADOR";
      const pode = (recurso: string, acao: "visualizar" | "editar") => admin || permissaoEfetiva((u?.perfilAcesso?.permissoes ?? {}) as Permissoes, (u?.permissoesPersonalizadas ?? {}) as Excecoes, recurso, acao);
      if (!u?.ativo || u.excluidoEm || u.sessaoVersao !== (sessao.versao ?? 0) || !pode("vendas.pedidos", "visualizar") || !pode("vendas.fiscal", editar ? "editar" : "visualizar")) throw new ErroPortaTecnicaBrasilNfe("ACESSO_NEGADO");
      const d = await tx.documentoFiscalSaida.findUnique({ where: { id: i.documentoId }, select: {
        id: true, ambiente: true, provedor: true, modeloDocumento: true, status: true, hashPayload: true, payload: true,
        chaveFiscal: true, numero: true, serie: true, protocolo: true, protocoloCancelamento: true, cancelamentoPendente: true,
      } });
      let cnpj: string;
      try { cnpj = normalizarCnpjBrasilNfe(objeto(objeto(d?.payload).emitente).cnpj); } catch { throw new ErroPortaTecnicaBrasilNfe("VINCULO_INVALIDO"); }
      if (!d || d.ambiente !== ambiente || d.modeloDocumento !== i.modeloDocumento || cnpj !== i.emitenteCnpj || (d.provedor !== null && d.provedor !== "BRASIL_NFE")) throw new ErroPortaTecnicaBrasilNfe("VINCULO_INVALIDO");
      return d;
    });
  };
  return {
    async autorizar() { throw new ErroAdaptadorBrasilNfe(); },
    async preparar(identidade, fotografia) {
      const d = await ler(identidade, true);
      // Comparação estrutural, sem recomputar o hash histórico cuja ordem JSONB
      // pode diferir da ordem na criação. Nenhuma fotografia é reescrita.
      if (hashRegraFiscalBrasilNfe(fotografia) !== hashRegraFiscalBrasilNfe(d.payload)) throw new ErroPortaTecnicaBrasilNfe("VINCULO_INVALIDO");
      const aprovado = await obterComplementosAprovadosDocumentoBrasilNfe(d.id, sessao);
      if (!aprovado || !aprovado.resultado.montagemConcluida || aprovado.resultado.documentoId !== d.id || aprovado.resultado.hashPayload !== d.hashPayload || aprovado.modelo !== identidade.modeloDocumento) throw new ErroPortaTecnicaBrasilNfe("PLANO_PENDENTE");
      return aprovado.resultado;
    },
    async obterAutorizacao(identidade) {
      const d = await ler(identidade, false);
      if (d.provedor !== "BRASIL_NFE" || !["AUTORIZADO", "CANCELADO", "PENDENTE_CONFERENCIA"].includes(d.status)
        || (d.status === "PENDENTE_CONFERENCIA" && !d.cancelamentoPendente && !d.protocoloCancelamento)
        || !d.chaveFiscal || !d.numero || !d.serie || !d.protocolo) return null;
      return conferirAutorizacaoBrasilNfe(identidade, { chave: d.chaveFiscal, numero: d.numero, serie: d.serie, protocolo: d.protocolo,
        ...(d.protocoloCancelamento ? { protocoloCancelamento: d.protocoloCancelamento } : {}), cancelamentoPendente: d.cancelamentoPendente });
    },
  };
}
