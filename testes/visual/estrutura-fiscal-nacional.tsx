import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { EditorVersaoFiscal } from "@/app/(protegido)/vendas/fiscal/cobertura/versao-editor";
import { PRODUTO_DECLARACAO_FCI_GRAZING1 } from "@/lib/tributacao/declaracao-fci-contrato";
import type { ClassificacaoFiscal, PainelFiscal, VersaoFiscalDto } from "@/lib/tributacao/tipos";

/** A identidade delimita o contrato. Pessoas, fatos e provas são fictícios. */
export function CenarioOrigemFiscal({ nacional, repasse = false }: { nacional: boolean; repasse?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const dados: ClassificacaoFiscal = { produtoId: PRODUTO_DECLARACAO_FCI_GRAZING1, grupo: "GF01", natureza: "PREPARADO", tratamento: "NORMAL", ncm: "19059090", origem: nacional ? "0" : null, gtin: "SEM GTIN", cest: null, unidade: "UN", estado: nacional ? "CONFIRMADO" : "PENDENTE", evidencias: ["Declaração e produto exclusivamente sintéticos para conferir a interface."], pendencias: nacional ? [] : ["Origem ainda não definida no cenário sintético."], fotografiaTecnica: { algoritmo: "grazing.classificacao-fiscal.v1", principalHash: "b".repeat(64), materiais: { algoritmo: "grazing.material-fiscal.v1", insumos: [] } } };
  if (repasse) {
    dados.natureza = "FRACIONADO"; dados.origem = "5";
    dados.fci = { situacao: "EXIGIDA", numero: "ABCDEF12-3456-7890-ABCD-1234567890AB", periodoApuracao: null, conteudoImportacao: null, valorParcelaImportada: null, valorSaidaReferencia: null, apuracaoCompleta: false, justificativa: "FCI e documentos exclusivamente sintéticos para conferir a apresentação.", fontes: ["https://www.gov.br/fonte-sintetica"], evidencias: ["Documento fictício"], repasseFornecedor: { insumoId: "insumo-sintetico", registro: { algoritmo: "grazing.fci-fornecedor.v1", natureza: "FRACIONADO", ncm: "19059090", origem: "5", materiaisHash: "a".repeat(64), documentos: [{ itemId: "item-sintetico", numeroItem: 1, xmlHash: "b".repeat(64), dataEmissao: "2026-10-01" }] } } };
  }
  const versao: VersaoFiscalDto = { id: "classificacao-nacional-sintetica", tipo: "CLASSIFICACAO", chave: dados.produtoId!, versao: 5, vigenciaInicio: "2026-10-21", status: "ATIVO", dados, hash: "a".repeat(64), justificativa: "Registro exclusivamente sintético para verificar a apresentação da classificação atual.", fontes: ["FONTE_EXCLUSIVAMENTE_SINTETICA"], criadoPorNome: "Responsável fictício", createdAt: "2026-10-21T12:00:00.000Z" };
  const painel: PainelFiscal = { administrador: true, produtos: [{ id: dados.produtoId!, codigo: "PREPARO-DEMO", nome: "Preparação nacional demonstrativa", tipo: "PRODUCAO", papeis: ["PRINCIPAL"], grupo: "GF01", ncm: dados.ncm, status: nacional ? "APTO" : "PENDENTE", pendencias: dados.pendencias, evidencias: dados.evidencias, composicao: [] }], grupos: [{ id: "grupo-ficticio", nome: "GF01 — Preparação demonstrativa", ativo: true }], entradas: [], opcoes: [], versoes: [versao], resumo: { ativos: 1, aptos: nacional ? 1 : 0, pendentes: nacional ? 0 : 1, configuracoes: 0 } };
  return <><Button onClick={() => setAberto(true)}>Conferir classificação sintética</Button>{aberto && <EditorVersaoFiscal tipo="CLASSIFICACAO" versao={versao} painel={painel} fechar={() => setAberto(false)} />}</>;
}
