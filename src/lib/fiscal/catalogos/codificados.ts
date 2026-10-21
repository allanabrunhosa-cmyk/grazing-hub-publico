/** Tabelas codificadas normativas. Um código existente não é uma classificação aprovada. */
const fonteIcms = "https://www.confaz.fazenda.gov.br/legislacao/ajustes/sinief/cvsn_70";
const fonteIpi = "https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=J+I+v4eN00E=";
const origem = [
 ["0", "Nacional, exceto as indicadas nos códigos 3, 4, 5 e 8"],
 ["1", "Estrangeira · importação direta, exceto a indicada no código 6"],
 ["2", "Estrangeira · adquirida no mercado interno, exceto a indicada no código 7"],
 ["3", "Nacional · conteúdo de importação superior a 40% e inferior ou igual a 70%"],
 ["4", "Nacional · produção conforme processos produtivos básicos previstos na legislação"],
 ["5", "Nacional · conteúdo de importação inferior ou igual a 40%"],
 ["6", "Estrangeira · importação direta, sem similar nacional na lista CAMEX ou gás natural"],
 ["7", "Estrangeira · adquirida no mercado interno, sem similar nacional na lista CAMEX ou gás natural"],
 ["8", "Nacional · conteúdo de importação superior a 70%"],
];
const contribuicoes = [
 ["01", "Operação tributável · alíquota básica"], ["02", "Operação tributável · alíquota diferenciada"], ["03", "Operação tributável · alíquota por unidade de medida"],
 ["04", "Operação tributável monofásica · revenda a alíquota zero"], ["05", "Operação tributável por substituição tributária"], ["06", "Operação tributável a alíquota zero"], ["07", "Operação isenta da contribuição"], ["08", "Operação sem incidência da contribuição"], ["09", "Operação com suspensão da contribuição"], ["49", "Outras operações de saída"],
 ["50", "Crédito · receita tributada no mercado interno"], ["51", "Crédito · receita não tributada no mercado interno"], ["52", "Crédito · receita de exportação"], ["53", "Crédito · receitas tributadas e não tributadas no mercado interno"], ["54", "Crédito · receitas tributadas no mercado interno e de exportação"], ["55", "Crédito · receitas não tributadas no mercado interno e de exportação"], ["56", "Crédito · receitas tributadas, não tributadas e de exportação"],
 ["60", "Crédito presumido · aquisição vinculada à receita tributada no mercado interno"], ["61", "Crédito presumido · aquisição vinculada à receita não tributada no mercado interno"], ["62", "Crédito presumido · aquisição vinculada à receita de exportação"], ["63", "Crédito presumido · receitas tributadas e não tributadas no mercado interno"], ["64", "Crédito presumido · receitas tributadas no mercado interno e de exportação"], ["65", "Crédito presumido · receitas não tributadas no mercado interno e de exportação"], ["66", "Crédito presumido · receitas tributadas, não tributadas e de exportação"], ["67", "Crédito presumido · outras operações"],
 ["70", "Aquisição sem direito a crédito"], ["71", "Aquisição com isenção"], ["72", "Aquisição com suspensão"], ["73", "Aquisição a alíquota zero"], ["74", "Aquisição sem incidência"], ["75", "Aquisição por substituição tributária"], ["98", "Outras operações de entrada"], ["99", "Outras operações"],
];
const ipi = [["00", "Entrada com recuperação de crédito"], ["01", "Entrada tributada a alíquota zero"], ["02", "Entrada isenta"], ["03", "Entrada não tributada"], ["04", "Entrada imune"], ["05", "Entrada com suspensão"], ["49", "Outras entradas"], ["50", "Saída tributada"], ["51", "Saída tributada a alíquota zero"], ["52", "Saída isenta"], ["53", "Saída não tributada"], ["54", "Saída imune"], ["55", "Saída com suspensão"], ["99", "Outras saídas"]];
const hashes = { origem: "7eeb4e45976812c2951d190c158b6d2da77c282e115376f620e2a74c5527d190", pis: "5eb4cf2010b10b0b62f78197c4eb64025f24535d4c6e61158bc7806dd008f55d", cofins: "5eb4cf2010b10b0b62f78197c4eb64025f24535d4c6e61158bc7806dd008f55d", ipi: "5eb4cf2010b10b0b62f78197c4eb64025f24535d4c6e61158bc7806dd008f55d" };
const tabela = (id: keyof typeof hashes, fonte: string, versao: string, linhas: string[][]) => ({ id, fonte, versao, obtidoEm: "2026-10-14", sha256Origem: hashes[id], registros: linhas.map(([codigo, descricao]) => ({ codigo, descricao, inicio: null, fim: null })) });
export const TABELAS_CODIFICADAS = {
 origem: tabela("origem", fonteIcms, "SINIEF · Tabela A, Ajustes 20/12 e 15/13", origem),
 pis: tabela("pis", fonteIpi, "MOC 7.0 · CST PIS / Tabela 4.3.3", contribuicoes),
 cofins: tabela("cofins", fonteIpi, "MOC 7.0 · CST COFINS / Tabela 4.3.4", contribuicoes),
 ipi: tabela("ipi", fonteIpi, "MOC 7.0 · CST IPI / Tabela 4.3.2", ipi),
};
