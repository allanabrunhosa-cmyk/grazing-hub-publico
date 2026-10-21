import { Prisma } from "@/generated/prisma/client";
import type { ClassificacaoFiscal } from "./tipos";
import { ErroEstruturaFiscal, textoFiscal } from "./validacao";

export type InsumoReferenciaFiscal = {
  id: string; nome: string; ativo: boolean; excluidoEm: Date | string | null;
  unidade: string; tipo: string;
};
export type ComponenteKitFiscal = NonNullable<ClassificacaoFiscal["componentesKit"]>[number];
type IdentidadeFiscal = Pick<ClassificacaoFiscal, "produtoId" | "referenciaInternaInsumoId">;
const identificador = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v);
const unidadeValida = (v: unknown): v is string => typeof v === "string" && /^[A-Z0-9]{1,6}$/.test(v);
function falha(mensagem: string): never { throw new ErroEstruturaFiscal(`Referência fiscal interna: ${mensagem}`); }

/** Identidade de emissão: o prefixo não cria um SKU comercial nem modifica o Insumo. */
export function chaveFiscalClassificacao(c: IdentidadeFiscal): string {
  if (!c || typeof c !== "object" || Array.isArray(c)) return falha("identidade ausente.");
  if (c.produtoId === null && identificador(c.referenciaInternaInsumoId)) return `INSUMO:${c.referenciaInternaInsumoId}`;
  if (identificador(c.produtoId) && c.referenciaInternaInsumoId === undefined) return c.produtoId;
  return falha("informar somente produto comercial ou insumo interno, com ID válido.");
}

function conferirClassificacao(c: ClassificacaoFiscal, insumo: InsumoReferenciaFiscal | null | undefined): string {
  const chave = chaveFiscalClassificacao(c);
  if (!c.referenciaInternaInsumoId || c.produtoId !== null) return falha("classificação não identifica um insumo interno.");
  if (!insumo || insumo.id !== c.referenciaInternaInsumoId) return falha("insumo ou preparação não existe para essa identidade.");
  if (insumo.ativo !== true || insumo.excluidoEm !== null) return falha("insumo ou preparação inativo ou excluído.");
  if (!unidadeValida(c.unidade) || !unidadeValida(insumo.unidade)) return falha("unidade fiscal ou de estoque inválida.");
  if (c.tratamento !== "NORMAL" || c.natureza === "SERVICO" || c.configuracaoNcm) return falha("a referência interna deve representar uma mercadoria individual.");
  const conversao = c.conversaoUnidade;
  if (c.unidade !== insumo.unidade && !conversao) return falha("unidade diferente do estoque exige conversão documentada.");
  if (conversao) {
    if (conversao.unidadeEstoque !== insumo.unidade) return falha("unidade de estoque da conversão diverge do cadastro atual.");
    const fator = conversao.quantidadeEstoquePorUnidadeFiscal;
    if (typeof fator !== "string" || !/^\d{1,9}(\.\d{1,9})?$/.test(fator) || new Prisma.Decimal(fator).lte(0)) return falha("fator positivo de estoque com até nove casas decimais é obrigatório.");
    textoFiscal(conversao.justificativa, "Justificativa da conversão fiscal", 2000);
    if (!Array.isArray(conversao.fontes) || !conversao.fontes.length || conversao.fontes.length > 50) return falha("fontes da conversão ausentes ou excessivas.");
    for (const fonte of conversao.fontes) textoFiscal(fonte, "Fonte da conversão fiscal", 2000);
  }
  // O parser e o serviço conferem códigos e tabelas. Esta guarda impede promover
  // uma identidade de estoque a mercadoria fiscal confirmada sem análise própria.
  if (c.estado === "CONFIRMADO" && (typeof c.ncm !== "string" || !/^\d{8}$/.test(c.ncm) || c.ncmAplicabilidade !== "APLICAVEL" || !c.analiseNcm || c.analiseNcm.confianca === "BAIXA" || !c.analiseNcm.descricaoNcm?.trim() || c.analiseNcm.pendenciasNcm.length || !c.analiseNcm.fontes.length)) return falha("NCM confirmado exige análise do produto final e fontes próprias.");
  return chave;
}

/** Validação pura do componente, independente de banco, sessão e quantidades de estoque. */
export function validarComponenteInterno(c: ClassificacaoFiscal, insumo: InsumoReferenciaFiscal | null | undefined, componente: ComponenteKitFiscal): void {
  conferirClassificacao(c, insumo);
  if (!componente || typeof componente !== "object" || Array.isArray(componente) || componente.produtoId !== undefined || componente.referenciaInternaInsumoId !== c.referenciaInternaInsumoId) return falha("componente e classificação devem apontar somente para o mesmo insumo.");
  if (componente.escolhas !== undefined) return falha("escolhas de produto comercial não pertencem a uma referência interna.");
  textoFiscal(componente.descricao, "Descrição fiscal do componente interno", 120);
  if (!unidadeValida(componente.unidade) || componente.unidade !== c.unidade) return falha("unidade do componente diverge da classificação fiscal.");
  for (const [nome, valor] of [["Quantidade", componente.quantidade], ["Peso do rateio", componente.pesoRateio]]) {
    if (typeof valor !== "string" || !/^\d{1,12}(\.\d{1,6})?$/.test(valor) || new Prisma.Decimal(valor).lte(0)) return falha(`${nome} precisa ser positivo, com até seis casas decimais.`);
  }
}

export function resolverReferenciaInterna(c: ClassificacaoFiscal, insumo: InsumoReferenciaFiscal | null | undefined, componente: ComponenteKitFiscal): { codigo: string; nome: string; unidade: string } {
  validarComponenteInterno(c, insumo, componente);
  const codigo = chaveFiscalClassificacao(c);
  if (codigo.length > 60) return falha("identidade não cabe no código fiscal de até60 caracteres; não truncar ou inventar SKU.");
  return { codigo, nome: textoFiscal(componente.descricao, "Descrição fiscal do componente interno", 120), unidade: componente.unidade! };
}

/** Recebe somente a transação já autorizada pelo serviço; não abre conexão nem escreve. */
export async function conferirReferenciaInterna(tx: Prisma.TransactionClient, c: ClassificacaoFiscal): Promise<void> {
  chaveFiscalClassificacao(c);
  if (!c.referenciaInternaInsumoId) return;
  const insumo = await tx.insumo.findUnique({ where: { id: c.referenciaInternaInsumoId }, select: { id: true, nome: true, ativo: true, excluidoEm: true, unidade: true, tipo: true } });
  conferirClassificacao(c, insumo);
}
