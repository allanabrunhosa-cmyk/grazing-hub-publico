"use client";

import { SelecaoFormulario } from "@/components/ui/select";
import { Cpu, Laptop, FileDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { PlanejamentoRaspberry } from "@/lib/etiquetas/raspberry";

export function PreparacaoRaspberry({ valor, mudar }: { valor: PlanejamentoRaspberry | null; mudar: (valor: PlanejamentoRaspberry | null) => void }) {
  return <section className="space-y-5 border-t pt-5 md:col-span-2" aria-label="Conexão da impressora">
    <div><h3 className="text-title">Como a impressora será conectada</h3><p className="mt-1 text-sm text-muted-foreground">O perfil de mídia acima é compartilhado. A conexão física é configurada na estação da cozinha.</p></div>
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="rounded-xl border p-4"><Laptop className="mb-3 size-5 text-primary" /><h4 className="font-semibold">Computador + Browser Print</h4><p className="mt-2 text-sm text-muted-foreground">Use o aplicativo e a biblioteca oficial Zebra. Autorize o endereço de Validades e detecte a impressora na tela de impressão.</p><a className="mt-3 inline-block text-sm text-primary underline" href="https://www.zebra.com/us/en/support-downloads/software/printer-software/browser-print.html" target="_blank" rel="noreferrer">Documentação Zebra</a></div>
      <div className="rounded-xl border p-4"><FileDown className="mb-3 size-5 text-primary" /><h4 className="font-semibold">Arquivo ZPL</h4><p className="mt-2 text-sm text-muted-foreground">Alternativa disponível sem conexão automática. Baixe o arquivo e envie pelo software compatível da impressora.</p><p className="mt-3 text-xs text-muted-foreground">Download não comprova impressão.</p></div>
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4"><Cpu className="mb-3 size-5 text-primary" /><h4 className="font-semibold">Raspberry Pi</h4><p className="mt-2 text-sm text-muted-foreground">Cadastre e acompanhe a Raspberry na aba Pontos de impressão. Cada equipamento precisa de instalação e vínculo próprios.</p><span className="mt-3 inline-block rounded-full bg-muted px-2 py-1 text-xs font-medium">Gerenciar por ponto</span></div>
    </div>
    <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><Checkbox checked={valor !== null} onCheckedChange={(marcado) => mudar(marcado ? { estacao: "", fila: "", conexao: "USB" } : null)} /> Manter anotações de estação Raspberry no perfil</label>
    {valor && <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="raspberry-estacao">Nome da estação</Label><Input id="raspberry-estacao" value={valor.estacao} maxLength={80} placeholder="Ex.: Cozinha principal" onChange={(e) => mudar({ ...valor, estacao: e.target.value })} /></div>
      <div className="space-y-2"><Label htmlFor="raspberry-fila">Identificação da fila</Label><Input id="raspberry-fila" value={valor.fila} maxLength={80} placeholder="Ex.: zebra_cozinha" onChange={(e) => mudar({ ...valor, fila: e.target.value })} /></div>
      <div className="space-y-2"><Label htmlFor="raspberry-conexao">Conexão da impressora ao Raspberry Pi</Label><SelecaoFormulario id="raspberry-conexao" value={valor.conexao} onValueChange={(novoValor) => mudar({ ...valor, conexao: novoValor as "USB" | "REDE" })}><option value="USB">USB</option><option value="REDE">Rede local</option></SelecaoFormulario></div>
      <p className="self-center text-sm text-muted-foreground">Não informe IP público, senha ou token. Estas anotações não criam nem vinculam um ponto de impressão.</p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground sm:col-span-2"><li>Confirmar modelo, linguagem ZPL, resolução e conexão do equipamento.</li><li>Preparar Raspberry Pi OS e a fila local compatível com a impressora.</li><li>Instalar e integrar um conector autenticado antes de habilitar envio pelo HUB. Não expor portas da impressora na internet.</li><li>Homologar uma etiqueta de cada tamanho; conferir a saída física e o registro no histórico.</li></ol>
    </div>}
  </section>;
}
