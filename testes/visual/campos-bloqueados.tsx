import React from "react";
import { createRoot } from "react-dom/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { InputComSufixo } from "@/components/ui/input-com-sufixo";
import { SelecaoFormulario } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { MultiselecaoCombobox } from "@/components/multiselecao-combobox";
import { SeletorVisualizacaoOperacional } from "@/components/seletor-visualizacao-operacional";
import { DemonstracaoPadrao } from "@/components/design-system/demonstracao-padrao";
import "@/app/globals.css";

const tema = new URLSearchParams(location.search).get("tema") === "escuro" ? "dark" : "light";
document.documentElement.className = tema;
createRoot(document.getElementById("root")!).render(<main className="space-y-6 p-6">
  <h1 className="text-title">Campos não editáveis · {tema === "dark" ? "escuro" : "claro"}</h1>
  <p className="text-sm text-muted-foreground">Dados sintéticos · Referência Em revisão · Sem gravação</p>
  <div className="grid gap-6 lg:grid-cols-3">{["hub", "pedidos", "etiquetas"].map(marca => <form key={marca} data-identidade={marca} className="space-y-4 rounded-xl border bg-background p-4">
    <h2 className="text-title">{marca}</h2>
    <label className="grid gap-2 text-sm">Editável<Input aria-label={`${marca} editável`} name="editavel" defaultValue="Informação editável" /></label>
    <label className="grid gap-2 text-sm">Somente leitura<Input aria-label={`${marca} leitura`} name="leitura" defaultValue="Informação confirmada" readOnly /></label>
    <label className="grid gap-2 text-sm">Indisponível<Input aria-label={`${marca} indisponível`} name="indisponivel" placeholder="Indisponível no momento" disabled /></label>
    <label className="grid gap-2 text-sm">Observação<Textarea aria-label={`${marca} observação`} name="observacao" readOnly defaultValue="Observação confirmada" /></label>
    <label className="grid gap-2 text-sm">Total calculado<CurrencyInput aria-label={`${marca} total`} name="total" readOnly value="149.90" /></label>
    <label className="grid gap-2 text-sm">Quantidade<InputComSufixo aria-label={`${marca} quantidade`} disabled value="0,125" sufixo="kg" /></label>
    <label className="grid gap-2 text-sm">Local<SelecaoFormulario aria-label={`${marca} local`} name="local" value="producao" disabled><option value="producao">Produção</option></SelecaoFormulario></label>
    <MultiselecaoCombobox ariaLabel={`${marca} categorias`} placeholder="Categorias" disabled opcoes={[{ id: "queijos", nome: "Queijos" }]} selecionadosIds={["queijos"]} aoMudar={() => {}} />
    <div className="space-y-2"><p className="text-sm">Visualização indisponível</p><SeletorVisualizacaoOperacional valor="quadros" aoMudar={() => {}} disabled /></div>
    <fieldset disabled className="space-y-2"><legend className="text-sm">Grupo indisponível</legend><Input aria-label={`${marca} grupo`} defaultValue="Bloqueado pelo grupo" /></fieldset>
    <div className="flex gap-4"><label className="flex items-center gap-2 text-sm"><Checkbox disabled checked />Marcado</label><label className="flex items-center gap-2 text-sm"><Switch disabled checked />Ativo</label></div>
  </form>)}</div>
  <section className="space-y-4"><h2 className="text-title">Central · somente leitura</h2><DemonstracaoPadrao componente="campos" estado="somente-leitura" aplicado={false} /></section>
</main>);
