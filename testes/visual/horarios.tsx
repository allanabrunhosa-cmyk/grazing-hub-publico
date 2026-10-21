import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { HorariosEntregaForm } from "@/app/(protegido)/vendas/horarios/horarios-form";
import { HorarioEntregaCampo } from "@/app/(protegido)/vendas/pedidos/horario-entrega-campo";
import { horariosEntregaVazios } from "@/lib/vendas/horarios-entrega-dominio";
import { Input } from "@/components/ui/input";
import "@/app/globals.css";

const agenda = horariosEntregaVazios();
agenda.semana[0] = { fechado: false, horarios: [{ inicio: "09:05", fim: "12:30", texto: "Pela manhã" }, { inicio: "14:00", fim: "18:00", texto: "" }] };
agenda.semana[1] = { fechado: false, horarios: [{ inicio: "", fim: "", texto: "A combinar" }] };
agenda.desativadas = ["2026-10-12"];
agenda.especiais = [{ data: "2026-10-11", horarios: [{ inicio: "10:00", fim: "14:00", texto: "Entrega especial de domingo" }] }];
function Previa() {
  const [config, setConfig] = useState(agenda), [data, setData] = useState("2026-10-05"), [valor, setValor] = useState("");
  return <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6"><HorariosEntregaForm inicial={{ configuracao: agenda, versao: 1 }} editar salvar={async (configuracao, versao) => { setConfig(configuracao); return { ok: true, configuracao, versao: versao + 1 }; }} />
    <section className="space-y-3 rounded-[var(--ds-cartao-raio)] border bg-card p-4"><h2 className="font-heading text-title">Novo pedido fictício</h2><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm">Data prevista<Input type="date" value={data} onChange={e => { setData(e.target.value); setValor(""); }} /></label><HorarioEntregaCampo configuracao={config} data={data} valor={valor} alterar={setValor} /></div></section>
  </div>;
}
createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" defaultTheme="light"><Previa /></ThemeProvider>);
