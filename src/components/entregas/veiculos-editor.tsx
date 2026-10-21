"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { StatusAtivo } from "@/components/status-ativo";
import { BotaoRemoverItem } from "@/components/remover-item";
import { EscolhaEntrega } from "./campos-entrega";
import type { ConfiguracaoEntregas } from "@/lib/vendas/entregas-dominio";

export function VeiculosEntregaEditor({ config: c, alterar, disabled }: { config: ConfiguracaoEntregas; alterar: (v: ConfiguracaoEntregas) => void; disabled: boolean }) {
  const veiculos = c.veiculos ?? [];
  function campo(id: string, valores: Partial<(typeof veiculos)[number]>) { alterar({ ...c, veiculos: veiculos.map(v => v.id === id ? { ...v, ...valores } : v) }); }
  return <Card><CardHeader><CardTitle>Veículos</CardTitle><CardDescription>A ocupação total dos produtos deve estar entre os slots mínimos e máximos de um único veículo ativo.</CardDescription></CardHeader><CardContent className="space-y-4">
    <fieldset disabled={disabled} className="min-w-0 space-y-4">
      <Table className="w-max table-fixed text-left"><colgroup><col className="w-56" /><col className="w-48" /><col className="w-32" /><col className="w-32" /><col className="w-32" /><col className="w-14" /></colgroup>
        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Perfil de rota</TableHead><TableHead>Slots mínimos</TableHead><TableHead>Slots máximos</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Remover</span></TableHead></TableRow></TableHeader>
        <TableBody>{veiculos.map((v, i) => <TableRow key={v.id}>
          <TableCell><Input aria-label={`Nome do veículo ${i + 1}`} maxLength={80} value={v.nome} onChange={e => campo(v.id, { nome: e.target.value })} /></TableCell>
          <TableCell><EscolhaEntrega nome={`Perfil de rota do veículo ${i + 1}`} ocultarRotulo valor={v.perfil} opcoes={[{ value: "MOTO", label: "Moto" }, { value: "CARRO", label: "Carro" }]} alterar={perfil => campo(v.id, { perfil: perfil as "MOTO" | "CARRO" })} disabled={disabled} /></TableCell>
          <TableCell><Input aria-label={`Slots mínimos do veículo ${i + 1}`} inputMode="numeric" restricao="inteiro" maxLength={6} value={v.slotsMinimos ?? ""} onChange={e => campo(v.id, { slotsMinimos: e.target.value === "" ? null : Number(e.target.value) })} /></TableCell>
          <TableCell><Input aria-label={`Slots máximos do veículo ${i + 1}`} inputMode="numeric" restricao="inteiro" maxLength={6} value={v.slotsMaximos ?? ""} onChange={e => campo(v.id, { slotsMaximos: e.target.value === "" ? null : Number(e.target.value) })} /></TableCell>
          <TableCell><StatusAtivo nome={v.nome || `veículo ${i + 1}`} ativo={v.ativo} onChange={ativo => campo(v.id, { ativo })} /></TableCell>
          <TableCell><BotaoRemoverItem nome={`Remover veículo ${v.nome || i + 1}`} disabled={disabled} onClick={() => alterar({ ...c, veiculos: veiculos.filter(a => a.id !== v.id), faixas: c.faixas.map(f => ({ ...f, precos: Object.fromEntries(Object.entries(f.precos ?? {}).filter(([id]) => id !== v.id)) })) })} /></TableCell>
        </TableRow>)}</TableBody>
      </Table>
      {!veiculos.length && <p className="text-sm text-muted-foreground">Nenhum veículo cadastrado.</p>}
      <Button type="button" variant="outline" disabled={disabled || veiculos.length >= 50} onClick={() => alterar({ ...c, veiculos: [...veiculos, { id: crypto.randomUUID(), nome: "", perfil: "MOTO", ativo: true, slotsMinimos: null, slotsMaximos: null }] })}>Adicionar veículo</Button>
    </fieldset>
  </CardContent></Card>;
}
