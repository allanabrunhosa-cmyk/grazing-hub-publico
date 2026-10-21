"use client";
import { Button } from "@/components/ui/button";

export function SelecaoCanalVenda({ canais, valor, alterar, disabled = false }: { canais: { id: string; nome: string }[]; valor: string | null; alterar: (id: string) => void; disabled?: boolean }) {
  return <div role="group" aria-label="Canal" className="flex flex-wrap gap-2">{canais.map(c => {
    const nome = c.nome.trim().toUpperCase();
    const token = nome === "SITE" ? "--ds-canal-site" : nome === "IFOOD" ? "--ds-canal-ifood" : ["GF", "GIULIANA FLORES"].includes(nome) ? "--ds-canal-gf" : null;
    const selecionado = valor === c.id;
    return <Button key={c.id} type="button" size="sm" variant={selecionado ? "default" : "outline"} disabled={disabled} aria-pressed={selecionado} title={c.nome} style={selecionado && token ? { backgroundColor: `var(${token})`, color: "var(--ds-canal-texto)" } : undefined} onClick={() => alterar(c.id)}>{["GF", "GIULIANA FLORES"].includes(nome) ? "GF" : c.nome}</Button>;
  })}</div>;
}
