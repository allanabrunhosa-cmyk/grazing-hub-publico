import type { ClassificacaoFiscal, DadosVersaoFiscal, PainelFiscal, PerfilFiscal, RegraFiscal, TipoVersaoFiscal, VersaoFiscalDto } from "@/lib/tributacao/tipos";
import type { FichaFiscalDados } from "@/app/(protegido)/financeiro/fiscal/ficha-produto";
const dia = "2026-10-21";
export const perfilUnificado: PerfilFiscal = { estabelecimento: "singleton", cnpj: "00000000000000", uf: "SP", codigoMunicipio: "3550308", inscricaoEstadual: "123456789012", regime: "SIMPLES_NACIONAL", crt: 1, confirmado: true, evidenciaEnquadramento: "Cadastro exclusivamente fictício", modelos: ["55", "65"], emissor: "BRASIL_NFE", reforma: "DISPENSADO_SIMPLES_2026", beneficioOpcional: null };
const classificacao: ClassificacaoFiscal = { produtoId: "produto-demonstracao", grupo: null, grupoFiscalId: "grupo-demonstracao", natureza: "PREPARADO", tratamento: "NORMAL", ncm: "19059090", origem: "0", cest: null, unidade: "UN", gtin: "SEM GTIN", estado: "CONFIRMADO", evidencias: ["Formulação exclusivamente fictícia"], pendencias: [] };
const tributo = (cst: string) => ({ cst, aliquota: null, reducaoBase: "0", modalidade: "SEM_DESTAQUE" as const, justificativa: "Fundamento exclusivamente fictício" });
const regra: RegraFiscal = { estabelecimento: "singleton", regime: "SIMPLES_NACIONAL", operacao: "VENDA", ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL", grupo: null, grupoFiscalId: "grupo-demonstracao", produtoId: null, natureza: null, ncm: null, cfop: "5101", csosn: "102", icms: tributo("00"), pis: tributo("49"), cofins: tributo("49"), ipi: null, st: "NAO_APLICAVEL", cest: null, segregacaoReceita: "PREPARACAO_SINTETICA", reforma: null, seletivo: "NAO_APLICAVEL" };
export function versaoUnificada(tipo: TipoVersaoFiscal, chave: string, dados: DadosVersaoFiscal): VersaoFiscalDto {
  return { id: `${tipo}-${chave}`, tipo, chave, dados, versao: 1, status: "ATIVO", vigenciaInicio: "2026-01-01", criadoPorNome: "Equipe fictícia", createdAt: "2026-10-20T12:00:00Z", hash: "a".repeat(64), justificativa: "Configuração exclusivamente sintética da prévia visual", fontes: ["https://www.gov.br/receitafederal"] };
}
export const painelUnificado: PainelFiscal = {
  administrador: true, grupos: [{ id: "grupo-demonstracao", nome: "Preparações", ativo: true }, { id: "grupo-bebidas", nome: "Bebidas de demonstração", ativo: true }], opcoes: [], entradas: [], insumos: [],
  produtos: [{ id: classificacao.produtoId!, nome: "Tábua de demonstração para duas pessoas", codigo: "DEMO-01", tipo: "PRODUCAO", papeis: ["PRINCIPAL"], grupo: "Preparações", ncm: "19059090", status: "APTO", pendencias: [], composicao: [], evidencias: [] }],
  resumo: { ativos: 1, aptos: 1, pendentes: 0, configuracoes: 0 },
  versoes: [versaoUnificada("PERFIL", "singleton", perfilUnificado), versaoUnificada("CLASSIFICACAO", classificacao.produtoId!, classificacao), versaoUnificada("REGRA", "preparacoes-demonstracao", regra)],
};
export const fichaUnificada: FichaFiscalDados = { painel: painelUnificado, dia, produto: { id: classificacao.produtoId!, nome: "Tábua de demonstração para duas pessoas", unidade: "UN", fiscal: { ncm: "19059090", cfop: "5101" }, grupoFiscalId: "grupo-demonstracao" } };

const painelKit = structuredClone(painelUnificado);
const fruta: ClassificacaoFiscal = { ...classificacao, produtoId: "fruta-demonstracao", natureza: "REVENDA", ncm: "08061000" };
const kit: ClassificacaoFiscal = { ...classificacao, produtoId: "kit-demonstracao", grupoFiscalId: null, natureza: "REVENDA", tratamento: "KIT_COMPOSTO", ncm: null, origem: null, gtin: null,
  componentesKit: [{ produtoId: classificacao.produtoId!, descricao: "Preparação de demonstração", quantidade: "1", unidade: "UN", pesoRateio: "1" }, { produtoId: fruta.produtoId!, descricao: "Fruta de demonstração", quantidade: "1", unidade: "UN", pesoRateio: "1" }] };
painelKit.versoes.push(versaoUnificada("CLASSIFICACAO", fruta.produtoId!, fruta), versaoUnificada("CLASSIFICACAO", kit.produtoId!, kit), versaoUnificada("REGRA", "fruta-demonstracao", { ...regra, produtoId: fruta.produtoId!, grupoFiscalId: null, cfop: "5102" }));
painelKit.produtos.push({ ...painelKit.produtos[0], id: fruta.produtoId!, nome: "Fruta de demonstração", ncm: fruta.ncm }, { ...painelKit.produtos[0], id: kit.produtoId!, nome: "Kit de demonstração", ncm: null });
painelKit.resumo = { ...painelKit.resumo, ativos: 3, aptos: 3 };
export const fichaKitUnificada: FichaFiscalDados = { painel: painelKit, dia, produto: { id: kit.produtoId!, nome: "Kit de demonstração", unidade: "UN", fiscal: {}, grupoFiscalId: null } };
