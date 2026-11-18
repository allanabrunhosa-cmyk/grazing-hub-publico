import React from "react";
import { createRoot } from "react-dom/client";
import { GestaoMcp } from "@/app/(protegido)/configuracoes/integracoes/mcp/gestao";
import { MolduraIntegracoes, conexaoMcpInicial, type ResumoIntegracoes } from "@/app/(protegido)/configuracoes/integracoes/seletor";
import { dadosMcpFicticios, dadosMcpFicticiosEmUso } from "../mcp/fixture-gestao";
import "@/app/globals.css";
const parametros = new URLSearchParams(location.search);
document.documentElement.className = parametros.get("tema") === "escuro" ? "dark" : "light";
const dados = parametros.get("cenario") === "uso" ? dadosMcpFicticiosEmUso : dadosMcpFicticios;
const resumo: ResumoIntegracoes = { brasilnfe: true, certificado: { resumo: "Válido até 01/01/2027", tom: "roxo" },
  mcp: { endereco: dados.endereco, ativo: dados.ativo, configurado: dados.configurado, editar: true, conexoes: dados.autorizacoes.map(a => ({ id: a.id, nome: a.nome, clienteNome: a.clienteNome, situacao: a.situacao })) } };
const selecao = parametros.get("conexao") ?? conexaoMcpInicial(resumo.mcp!);
createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-7xl space-y-4 p-6"><p className="text-sm text-muted-foreground">Prévia isolada · dados fictícios · sem gravação · Em revisão visual</p><MolduraIntegracoes resumo={resumo} ativa={`mcp:${selecao}`}><GestaoMcp dados={dados} editar selecao={selecao} /></MolduraIntegracoes></main>);
