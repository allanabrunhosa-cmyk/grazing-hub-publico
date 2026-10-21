"use client";
import { useEffect, useId, useState } from "react";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxInputGroup, ComboboxItem } from "@/components/ui/combobox";
import type { ConsultaTabelaFiscal, OpcaoFiscal, ResultadoTabelaFiscal } from "@/lib/fiscal/catalogos/tipos";

export function SeletorFiscal({ nome, valor, mudar, contexto, requerido = false, disabled = false, mostrarDescricao = true, id, "aria-describedby": descritoPor }: {
  nome: string; valor: string; mudar: (valor: string) => void; contexto: ConsultaTabelaFiscal;
  requerido?: boolean; disabled?: boolean; mostrarDescricao?: boolean; id?: string; "aria-describedby"?: string;
}) {
  const gerado = useId(), ajuda = `${gerado}-tabela`;
  const [busca, definirBusca] = useState("");
  const [digitando, definirDigitando] = useState(false);
  const [tentativa, definirTentativa] = useState(0);
  const [estado, definirEstado] = useState<{ resultado: ResultadoTabelaFiscal | null; erro: boolean; carregando: boolean; chave: string | null }>({ resultado: null, erro: false, carregando: true, chave: null });
  const params = new URLSearchParams(Object.entries({ ...contexto, selecionado: valor, busca }).flatMap(([k, v]) => v === undefined || v === null || v === "" ? [] : [[k, String(v)]]));
  const chave = params.toString();
  useEffect(() => {
    const abortar = new AbortController();
    let atual = true;
    const timer = setTimeout(async () => {
      definirEstado(s => ({ ...s, carregando: true, erro: false }));
      const limite = setTimeout(() => abortar.abort(), 5000);
      try {
        const resposta = await fetch(`/api/fiscal/tabelas?${chave}`, { signal: abortar.signal, credentials: "same-origin", cache: "no-store" });
        if (!resposta.ok) throw new Error("Tabela indisponível");
        const resultado = await resposta.json() as ResultadoTabelaFiscal;
        if (!Array.isArray(resultado.opcoes) || resultado.opcoes.length > 50 || typeof resultado.versao !== "string" || resultado.opcoes.some(o => typeof o.codigo !== "string" || typeof o.descricao !== "string")) throw new Error("Tabela inválida");
        if (atual) definirEstado({ resultado, erro: false, carregando: false, chave });
      } catch { if (atual) definirEstado({ resultado: null, erro: true, carregando: false, chave }); }
      finally { clearTimeout(limite); }
    }, busca ? 180 : 0);
    return () => { atual = false; clearTimeout(timer); abortar.abort(); };
  }, [chave, busca, tentativa]);
  const resultado = estado.chave === chave ? estado.resultado : null;
  const carregando = estado.carregando || estado.chave !== chave;
  const salvo = valor ? estado.resultado?.selecionado?.codigo === valor ? estado.resultado.selecionado : { codigo: valor, descricao: "Código salvo · descrição em consulta", vigente: false } : null;
  const opcoes: OpcaoFiscal[] = [{ codigo: "", descricao: "Manter pendente", vigente: !requerido }, ...(resultado?.opcoes ?? [])];
  const selecionado = salvo ?? null;
  const aviso = !carregando ? estado.erro ? "A tabela não carregou. O valor salvo foi preservado." : [salvo && resultado && !salvo.vigente ? "Código salvo fora da vigência ou do contexto; revise antes de aprovar." : "", resultado?.aviso].filter(Boolean).join(" ") : "";
  const exibirDescricao = mostrarDescricao || Boolean(aviso);
  return <div className="min-w-0 space-y-1.5">
    <Combobox items={opcoes} value={selecionado} disabled={disabled} required={requerido} inputValue={digitando ? busca : selecionado ? `${selecionado.codigo} · ${selecionado.descricao}` : ""}
      itemToStringLabel={opcao => opcao.codigo ? `${opcao.codigo} · ${opcao.descricao}` : ""}
      itemToStringValue={opcao => opcao.codigo}
      isItemEqualToValue={(a, b) => a.codigo === b.codigo}
      filter={null}
      onValueChange={opcao => { if (opcao && (opcao.vigente || opcao.codigo === "")) { mudar(opcao.codigo); definirBusca(""); definirDigitando(false); } }}
      onOpenChange={aberto => { if (!aberto) { definirBusca(""); definirDigitando(false); } else if (estado.erro) definirTentativa(n => n + 1); }}
      onInputValueChange={(texto, detalhes) => { if (detalhes.reason === "input-change") { definirBusca(texto.slice(0, 100)); definirDigitando(true); } }}>
      <ComboboxInputGroup><ComboboxInput id={id} aria-label={nome} aria-describedby={[descritoPor, exibirDescricao ? ajuda : null].filter(Boolean).join(" ") || undefined} aria-invalid={Boolean(salvo && resultado && !salvo.vigente)} placeholder="Buscar código ou descrição" maxLength={100} /></ComboboxInputGroup>
      <ComboboxContent emptyLabel={carregando ? "Consultando tabela local…" : estado.erro ? "Tabela indisponível. Tente novamente ao abrir o campo." : "Nenhum código encontrado."}>
        {(opcao: OpcaoFiscal) => <ComboboxItem key={opcao.codigo} value={opcao} disabled={!opcao.vigente && Boolean(opcao.codigo)} className="items-start">
          <span className="min-w-0 whitespace-normal break-words">{opcao.codigo && <span className="font-mono">{opcao.codigo} · </span>}{opcao.descricao}</span>
        </ComboboxItem>}
      </ComboboxContent>
    </Combobox>
    {exibirDescricao && <div id={ajuda} className="text-xs text-muted-foreground" role={estado.erro ? "alert" : "status"}>
      {!mostrarDescricao ? aviso : estado.erro && !carregando ? aviso : carregando ? "Consultando tabela oficial local…" : resultado && <>{resultado.total > resultado.limite ? `${resultado.total} resultados. Digite para refinar. ` : ""}Tabela {resultado.versao}.{salvo && !salvo.vigente && " Código salvo fora da vigência ou do contexto; revise antes de aprovar."}{resultado.aviso && ` ${resultado.aviso}`}</>}
    </div>}
  </div>;
}
