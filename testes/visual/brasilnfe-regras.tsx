import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { RegrasBrasilNfeClient } from "@/app/(protegido)/vendas/fiscal/regras-brasilnfe/regras-client";
import { PreRequisitosBrasilNfeCard } from "@/app/(protegido)/configuracoes/integracoes/brasilnfe/pre-requisitos-card";
import { restaurarPreRequisitosBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/pre-requisitos-dominio";
import { catalogosRegrasFicticios, regrasFicticias } from "./brasilnfe-regras-dados";
import "@/app/globals.css";

const parametros = new URLSearchParams(location.search);
const dataFicticia = "2026-10-11T12:00:00.000Z";
const requisitosFicticios = restaurarPreRequisitosBrasilNfe({ evidenciaPainel: { origem: "PAINEL_BRASIL_NFE", observadoEm: dataFicticia, registradoEm: dataFicticia, servicoNfeNfceAtivo: true, homologacaoInformadaPeloUsuario: true, certificadoValidade: "2026-11-07", csc: { homologacao: { codigo: false, identificador: false }, producao: { codigo: false, identificador: false } } }, verificadoEm: dataFicticia, empresaCorrespondente: true, emitenteExterno: { ie: true, crt: true, endereco: false }, certificado: { situacao: "NAO_CONFIRMADO", httpStatus: 200, falha: { categoria: "CONTRATO", httpStatus: 200, etapaContrato: "CERTIFICADO_DATA" } }, csc: { homologacao: { codigo: false, identificador: false }, producao: { codigo: false, identificador: false } } }, 1);
const acaoFicticia = async () => ({ ok: false as const, erro: "Prévia visual: ação simulada, sem consulta externa ou salvamento." });
createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" defaultTheme="light"><main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6"><p className="text-sm text-muted-foreground">Prévia visual isolada: dados fictícios, sem banco, aprovação real ou transmissão.</p>{parametros.has("requisitos") ? <PreRequisitosBrasilNfeCard inicial={requisitosFicticios} editar={!parametros.has("leitura")} registrar={acaoFicticia} verificar={acaoFicticia} /> : <RegrasBrasilNfeClient regras={parametros.has("vazio") ? [] : regrasFicticias} editar={!parametros.has("leitura")} catalogos={catalogosRegrasFicticios} responsaveis={{ "usuario-ficticio": "Responsável fictício" }} />}</main></ThemeProvider>);
