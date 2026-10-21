import React from "react";
import { createRoot } from "react-dom/client";
import { VinculosFiscais, type ItemFiscal } from "@/app/(protegido)/vendas/fiscal/vinculos/vinculos-client";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { Sidebar } from "@/components/layout/sidebar";
import { CabecalhoConteudo } from "@/components/layout/cabecalho-conteudo";
import { ThemeProvider } from "@/components/theme-provider";
import "@/app/globals.css";
import type { AnaliseNcm } from "@/lib/tributacao/tipos";

const base: ItemFiscal = { id: "produto", nome: "Tábua fictícia para duas pessoas", codigo: "P001", fotoUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23c99959'/%3E%3Ccircle cx='40' cy='40' r='25' fill='%23f6e6b8'/%3E%3C/svg%3E", categorias: [{ id: "cat", nome: "Tábuas de demonstração", ativo: true }], classificacoes: ["PRINCIPAL"], ativo: true, versao: 1, fiscal: { ncm: "04069020" }, fiscalRevisado: false, grupoFiscalId: "producao" };
const produtos = [base, { ...base, id: "outro", nome: "Caixa de demonstração com um nome longo para conferir a leitura", codigo: "P002", fotoUrl: null, categorias: [], fiscal: {}, grupoFiscalId: null }, { ...base, id: "complemento", nome: "Porção fictícia de queijo", codigo: "C001", classificacoes: ["COMPLEMENTO"], fiscal: {}, grupoFiscalId: null }];
const analise: AnaliseNcm = { fundamento: "DOCUMENTAL", confianca: "MEDIA", descricaoNcm: "Descrição oficial exclusivamente fictícia", dataAnalise: "2026-10-12", justificativa: "Classificação sintética com referência documental específica para testar a leitura, a edição explícita e a apresentação da confiança.", fontes: ["Documento fictício de entrada, item 1", "https://www.gov.br/receitafederal"], pendenciasNcm: [] };
base.analiseFiscal = { ncm: "04069020", ncmAplicabilidade: "APLICAVEL", analiseNcm: analise, versao: { numero: 2, inicio: "2026-10-12", autor: "Autor fictício", atualizadaEm: "2026-10-12T12:00:00Z" } };
produtos.push({ ...base, id: "configuracao", nome: "Escolha de sabor sem venda independente", codigo: "OPT-DEMO", classificacoes: ["COMPLEMENTO"], fiscal: {}, analiseFiscal: { ncm: null, ncmAplicabilidade: "NAO_APLICAVEL", analiseNcm: { ...analise, descricaoNcm: null, justificativa: "Escolha sintética incorporada ao produto principal, sem linha fiscal independente." } } });
const grupos = [{ id: "producao", nome: "Produção", ativo: true, fiscal: { ncm: "04069020", cfop: "5101" } }];
createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" defaultTheme="light"><ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}><div className="estrutura-sistema"><Sidebar /><div className="painel-sistema"><CabecalhoConteudo sessao={{ nome: "Prévia isolada", email: "teste@example.invalid", admin: true }} /><main className="conteudo-sistema"><VinculosFiscais produtos={produtos} grupos={grupos} editar /></main></div></div></ProvedorAcesso></ThemeProvider>);
