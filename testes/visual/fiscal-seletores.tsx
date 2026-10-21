import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { CamposClassificacaoFiscal } from "@/components/fiscal/campos-classificacao";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { consultarTabelaFiscal } from "@/lib/fiscal/catalogos/consulta";
import type { ConsultaTabelaFiscal } from "@/lib/fiscal/catalogos/tipos";
import { Button } from "@/components/ui/button";
import { ThemeProvider } from "@/components/theme-provider";
import { FciClassificacaoForm } from "@/app/(protegido)/vendas/fiscal/cobertura/fci-classificacao-form";
import type { DecisaoFciFiscal } from "@/lib/tributacao/tipos";
import "@/app/globals.css";
// Somente esta prévia. Catálogos públicos são reais; cadastro, ações e contexto são sintéticos.
window.fetch = async input => {
  const u = new URL(String(input), location.origin), p = u.searchParams;
  if (u.pathname !== "/api/fiscal/tabelas") return new Response(null, { status: 404 });
  return Response.json(consultarTabelaFiscal({ ...Object.fromEntries(p.entries()), tabela: p.get("tabela") as ConsultaTabelaFiscal["tabela"], crt: p.has("crt") ? Number(p.get("crt")) as 1 | 2 | 3 | 4 : null, modelo: p.has("modelo") ? Number(p.get("modelo")) as 55 | 65 : undefined }));
};
function Previa() {
  const [fiscal, mudar] = useState<Record<string, string>>({}), [salvo, salvar] = useState(false);
  const [fci, mudarFci] = useState<DecisaoFciFiscal | undefined>(undefined);
  const parametroOrigem = new URLSearchParams(location.search).get("origem"), origemFci = ["0", "3", "5", "8"].includes(parametroOrigem ?? "") ? parametroOrigem! : "3";
  if (new URLSearchParams(location.search).has("fci")) return <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-8"><h1 className="text-2xl font-semibold">FCI da classificação demonstrativa</h1><p className="text-sm text-muted-foreground">Prévia isolada. Origem {origemFci} sintética para demonstrar os campos. Nenhuma decisão é salva, aprovada ou transmitida.</p><Card><CardHeader><CardTitle>Decisão por item e operação</CardTitle><CardDescription>O número deve vir do canal oficial. Valores normativos não são calculados pelo pedido.</CardDescription></CardHeader><CardContent><FciClassificacaoForm origem={origemFci} valor={fci} mudar={mudarFci} /></CardContent></Card></main>;
  return <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-8"><h1 className="text-2xl font-semibold">Fiscal do produto demonstrativo</h1><p className="text-sm text-muted-foreground">Prévia isolada. Dados fictícios. Nenhum salvamento em banco ou documento fiscal.</p><Card><CardHeader><CardTitle>Classificação e parâmetros</CardTitle><CardDescription>CRT 1 fictício. Busque códigos nas tabelas oficiais. A escolha exige fundamento e revisão.</CardDescription></CardHeader><CardContent><CamposClassificacaoFiscal fiscal={fiscal} mudar={v => { mudar(v); salvar(false); }} crt={1} modelo={55} dia="2026-10-14" /><div className="mt-5 flex justify-end"><Button type="button" onClick={() => salvar(true)}>Simular salvamento local</Button></div>{salvo && <p role="status" className="mt-3 text-sm">Simulação concluída. Nenhuma regra foi aprovada ou transmitida.</p>}</CardContent></Card></main>;
}
createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" defaultTheme="light"><Previa /></ThemeProvider>);
