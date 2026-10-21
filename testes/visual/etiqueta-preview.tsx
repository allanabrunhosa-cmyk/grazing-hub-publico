import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { EtiquetaPreview } from "@/app/(protegido)/producao/etiquetas/etiqueta-preview";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DadosEtiqueta } from "@/lib/etiquetas/tipos";
import "../../src/app/globals.css";

const parametros = new URLSearchParams(location.search);
const dados: DadosEtiqueta = {
  produtoNome: "Produto fictício",
  lojaNome: "Loja fictícia",
  lojaCnpj: "00.000.000/0001-00",
  conservacao: "REFRIGERADO",
  quantidade: null,
  unidade: "KG",
  lote: null,
  marcaFornecedor: null,
  sif: null,
  codigoRastreio: "A1B2C3",
  responsavelManipulacao: "Pessoa fictícia",
  manipuladoEm: "2026-10-14T12:00:00.000Z",
  validoAte: "2026-10-16T12:00:00.000Z",
  fusoHorario: "America/Sao_Paulo",
  resolucaoDpi: 203,
  tamanho: parametros.get("compacta") === "1" ? "MM_60X40" : "MM_60X60",
  mostrarHora: true,
  copias: 1,
};

function EnsaioPrevia() {
  const [endereco, setEndereco] = useState(parametros.get("normal") === "1"
    ? "Rua fictícia, 10"
    : parametros.get("erro") === "1"
      ? `Avenida ${"nome fictício muito extenso ".repeat(12)}`
      : "Avenida das Palmeiras, 123, sala 4, Jardim Fictício, Cidade Exemplo - SP, 12345-678, Brasil");
  return <main data-identidade="etiquetas" className="min-h-screen bg-background p-4 text-foreground">
    <section className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-title">Prévia de etiqueta</h1>
      <p className="text-sm text-muted-foreground">Ensaio isolado com dados fictícios. Nenhum envio à impressora.</p>
      <div className="space-y-2"><Label htmlFor="endereco-ficticio">Endereço fictício da loja</Label><Input id="endereco-ficticio" maxLength={160} value={endereco} onChange={(evento) => setEndereco(evento.target.value)} /></div>
      <EtiquetaPreview dados={{ ...dados, lojaEndereco: endereco }} />
    </section>
  </main>;
}

createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" forcedTheme={parametros.get("tema") === "escuro" ? "dark" : "light"}><EnsaioPrevia /></ThemeProvider>);
