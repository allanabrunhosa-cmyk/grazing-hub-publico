import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import {ThemeProvider} from "@/components/theme-provider";
import {InputComSufixo} from "@/components/ui/input-com-sufixo";
import {CurrencyInput} from "@/components/ui/currency-input";
import {FormasPagamentoVenda} from "@/app/(protegido)/vendas/formas-pagamento/formas-pagamento-client";
import "@/app/globals.css";
function Previa(){const[q,s]=useState("");const[v,sv]=useState("");return <main className="mx-auto max-w-3xl space-y-6 p-8"><h1 className="text-title">Padrão decimal do sistema</h1><p className="text-sm text-muted-foreground">Prévia isolada com dados fictícios · Em revisão visual. Digite ,5 para obter 0,5.</p><section className="grid gap-6 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium">Quantidade<InputComSufixo aria-label="Quantidade" sufixo="kg" inputMode="decimal" casasDecimais={3} maxLength={13} value={q} onChange={e=>s(e.target.value)}/></label><label className="space-y-2 text-sm font-medium">Valor<CurrencyInput aria-label="Valor" value={v} onValueChange={sv}/></label></section><p className="text-xs text-muted-foreground">Valores enviados: quantidade {q||"—"} · valor {v||"—"}</p><FormasPagamentoVenda formas={[]} adicionar editar/></main>}
createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" defaultTheme="light"><Previa/></ThemeProvider>);
