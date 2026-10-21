"use client";
import { FiltroOpcoesContadas } from "@/components/filtro-opcoes-contadas";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Receipt, Download, Loader2 } from "lucide-react";
import { CampoBusca } from "@/components/campo-busca";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";
import { BadgeNota as Badge } from "./badge-nota";
import { Button } from "@/components/ui/button";
import { FiltroPeriodo } from "@/components/filtro-periodo";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, SortableTableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NotaFiscalDialog } from "@/app/(protegido)/notas-fiscais/nota-fiscal-dialog";
import { exportarXmlPorDataAction } from "@/app/(protegido)/notas-fiscais/actions";
import {
  categoriaDaNota,
  categoriaNotaLabels,
  CATEGORIA_BADGE_VARIANT,
  type CategoriaNota,
  type NotaFiscalRow,
  type LocalOption,
} from "@/app/(protegido)/notas-fiscais/types";
import type { InsumoOption } from "@/app/(protegido)/inventario/types";
import type { SimpleOption, FornecedorOption, InsumoOption as InsumoOptionCadastro } from "@/app/(protegido)/insumos/types";
import type { CategoriaOption } from "@/app/(protegido)/financeiro/types";

function normalizar(valor: string) {
  const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");
  return valor.toLowerCase().normalize("NFD").replace(DIACRITICOS, "");
}

function apenasDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

const FILTROS: { valor: "TODAS" | CategoriaNota; label: string }[] = [
  { valor: "TODAS", label: "Todas" },
  { valor: "PENDENTE", label: "Pendentes" },
  { valor: "AUTORIZADA", label: "Aceitas" },
  { valor: "RECUSADA", label: "Recusadas" },
];

function baixarArquivoBase64(nomeArquivo: string, conteudoBase64: string, tipo: string) {
  const bytes = Uint8Array.from(atob(conteudoBase64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: tipo });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Mantém o arquivo disponível enquanto o navegador inicia o download.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function NotasFiscaisTable({
  notas,
  locais,
  insumos,
  categoriasInsumo,
  centrosCustoInsumo,
  fornecedoresInsumo,
  todosInsumosCadastro,
  categoriasFinanceiras,
  podeCadastrarFornecedor,
  podeCadastrarInsumo,
}: {
  notas: NotaFiscalRow[];
  locais: LocalOption[];
  insumos: InsumoOption[];
  categoriasInsumo: SimpleOption[];
  centrosCustoInsumo: SimpleOption[];
  fornecedoresInsumo: FornecedorOption[];
  todosInsumosCadastro: InsumoOptionCadastro[];
  categoriasFinanceiras: CategoriaOption[];
  podeCadastrarFornecedor?: boolean;
  podeCadastrarInsumo?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<"TODAS" | CategoriaNota>("PENDENTE");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [exportando, startExportacao] = useTransition();
  const [ordenacao, setOrdenacao] = useState<{ coluna: "fornecedor" | "valor" | "emissao" | "manifestacao"; direcao: "asc" | "desc" } | null>(
    null
  );

  function alternarOrdenacao(coluna: "fornecedor" | "valor" | "emissao" | "manifestacao") {
    setOrdenacao((atual) => {
      if (atual?.coluna !== coluna) return { coluna, direcao: "asc" };
      if (atual.direcao === "asc") return { coluna, direcao: "desc" };
      return null;
    });
  }

  const totalPendentes = notas.filter((nota) => categoriaDaNota(nota.ultimaManifestacao) === "PENDENTE").length;

  const porBuscaEPeriodo = useMemo(() => {
    const termo = normalizar(query.trim());
    const termoDigitos = apenasDigitos(query);
    const resultado = notas.filter((nota) => {
      const dataNota = nota.dataEmissao ? nota.dataEmissao.slice(0, 10) : null;
      if (dataInicio && (!dataNota || dataNota < dataInicio)) return false;
      if (dataFim && (!dataNota || dataNota > dataFim)) return false;
      if (!termo) return true;
      const alvoTexto = normalizar(nota.fornecedorNome ?? "");
      const alvoDigitos = apenasDigitos([nota.fornecedorCnpj ?? "", nota.chaveAcesso].join(""));
      return alvoTexto.includes(termo) || (termoDigitos.length > 0 && alvoDigitos.includes(termoDigitos));
    });

    return resultado;
  }, [query, dataInicio, dataFim, notas]);

  const filtradas = useMemo(() => {
    const resultado = porBuscaEPeriodo.filter(nota => filtro === "TODAS" || categoriaDaNota(nota.ultimaManifestacao) === filtro);
    if (!ordenacao) return resultado;
    const sinal = ordenacao.direcao === "asc" ? 1 : -1;
    return [...resultado].sort((a, b) => {
      switch (ordenacao.coluna) {
        case "fornecedor":
          return sinal * (a.fornecedorNome ?? "").localeCompare(b.fornecedorNome ?? "", "pt-BR");
        case "valor":
          return sinal * ((a.valorTotal ?? 0) - (b.valorTotal ?? 0));
        case "emissao":
          return sinal * (a.dataEmissao ?? "").localeCompare(b.dataEmissao ?? "");
        case "manifestacao":
          return (
            sinal *
            categoriaNotaLabels[categoriaDaNota(a.ultimaManifestacao)].localeCompare(
              categoriaNotaLabels[categoriaDaNota(b.ultimaManifestacao)],
              "pt-BR"
            )
          );
      }
    });
     
  }, [porBuscaEPeriodo, filtro, ordenacao]);

  function handleExportar() {
    startExportacao(async () => {
      try {
        const resultado = await exportarXmlPorDataAction(dataInicio, dataFim);
        if ("erro" in resultado) {
          toast.error(resultado.erro);
          return;
        }
        baixarArquivoBase64(resultado.nomeArquivo, resultado.conteudoBase64, "application/zip");
        toast.success(`${resultado.quantidade} nota(s) exportada(s) em XML.`);
        if (resultado.semXml > 0) toast.warning(`${resultado.semXml} nota(s) ficaram fora do arquivo porque ainda não têm XML completo. Aguarde a recuperação ou importe o XML do fornecedor.`, { duration: 10000 });
      } catch {
        toast.error("Não foi possível baixar os XMLs. Tente novamente.");
      }
    });
  }

  return (
    <Card className="gap-4 py-4">
      <div className="flex items-center justify-between gap-3 border-b px-4 pb-4">
        <div>
          <p className="font-semibold">Total de notas pendentes</p>
          <p className="text-xs text-muted-foreground">Em todas as notas recebidas, independentemente dos filtros.</p>
        </div>
        <Badge variant="warning" className="h-9 min-w-12 px-3 text-lg tabular-nums" aria-label={`${totalPendentes} notas pendentes no total`}>{totalPendentes}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4">
        <CampoBusca
          value={query}
          onChange={setQuery}
          placeholder="Buscar por fornecedor, CNPJ ou chave de acesso..."
        />
        <FiltroOpcoesContadas nome="Situação das notas fiscais" valor={filtro} onValueChange={setFiltro}
          opcoes={FILTROS.map(opcao => ({ valor: opcao.valor, nome: opcao.label,
            quantidade: porBuscaEPeriodo.filter(nota => opcao.valor === "TODAS" || categoriaDaNota(nota.ultimaManifestacao) === opcao.valor).length }))} />
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4">
        <FiltroPeriodo de={dataInicio} ate={dataFim} aoAlterar={periodo => { setDataInicio(periodo.de); setDataFim(periodo.ate); }} />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={exportando}
          onClick={handleExportar}
          className="ml-auto h-9! gap-1.5"
        >
          {exportando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {exportando ? "Exportando..." : "Exportar XML"}
        </Button>
      </div>

      <p className="px-4 text-xs text-muted-foreground">
        O ZIP inclui os XMLs disponíveis de todas as notas{dataInicio || dataFim ? " do período" : ""}, independentemente da busca e do status. Sem datas, exporta todo o histórico.
      </p>

      {notas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <Receipt className="size-8 text-muted-foreground" />
          <p className="font-medium">Nenhuma nota fiscal recebida ainda.</p>
          <p className="text-sm text-muted-foreground">Clique em &quot;Buscar novas notas&quot; pra consultar a SEFAZ.</p>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhuma nota encontrada{query ? ` para "${query}"` : ""}.
        </div>
      ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    active={ordenacao?.coluna === "fornecedor"}
                    direction={ordenacao?.direcao}
                    onClick={() => alternarOrdenacao("fornecedor")}
                  >
                    Fornecedor
                  </SortableTableHead>
                  <SortableTableHead
                    className="hidden sm:table-cell"
                    active={ordenacao?.coluna === "valor"}
                    direction={ordenacao?.direcao}
                    onClick={() => alternarOrdenacao("valor")}
                  >
                    Valor
                  </SortableTableHead>
                  <SortableTableHead
                    className="hidden md:table-cell"
                    active={ordenacao?.coluna === "emissao"}
                    direction={ordenacao?.direcao}
                    onClick={() => alternarOrdenacao("emissao")}
                  >
                    Emissão
                  </SortableTableHead>
                  <TableHead className="hidden lg:table-cell">Documento</TableHead>
                  <SortableTableHead
                    active={ordenacao?.coluna === "manifestacao"}
                    direction={ordenacao?.direcao}
                    onClick={() => alternarOrdenacao("manifestacao")}
                  >
                    Manifestação
                  </SortableTableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((nota) => (
                  <TableRow key={nota.id}>
                    <TableCell>
                      <div className="font-medium">{nota.fornecedorNome ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{nota.fornecedorCnpj ?? nota.chaveAcesso}</div>
                      <div className="mt-1 lg:hidden"><Badge variant={nota.temXmlCompleto ? "secondary" : "muted"}>{nota.temXmlCompleto ? "Completo" : "Resumo"}</Badge></div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {nota.valorTotal != null ? formatarMoeda(nota.valorTotal) : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {nota.dataEmissao ? new Date(nota.dataEmissao).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant={nota.temXmlCompleto ? "secondary" : "muted"}>{nota.temXmlCompleto ? "Completo" : "Resumo"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={CATEGORIA_BADGE_VARIANT[categoriaDaNota(nota.ultimaManifestacao)]}>
                        {categoriaNotaLabels[categoriaDaNota(nota.ultimaManifestacao)]}
                      </Badge>
                      {nota.ultimaManifestacao === "CIENCIA_DA_OPERACAO" && (
                        <div className="mt-1 max-w-36 text-xs leading-tight text-muted-foreground">
                          Ciência enviada · ainda aguarda aceite ou recusa
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <NotaFiscalDialog
                        nota={nota}
                        locais={locais}
                        insumos={insumos}
                        categoriasInsumo={categoriasInsumo}
                        centrosCustoInsumo={centrosCustoInsumo}
                        fornecedoresInsumo={fornecedoresInsumo}
                        todosInsumosCadastro={todosInsumosCadastro}
                        categoriasFinanceiras={categoriasFinanceiras}
                        podeCadastrarFornecedor={podeCadastrarFornecedor}
                        podeCadastrarInsumo={podeCadastrarInsumo}
                        trigger={
                          <Button variant="outline" size="sm">
                            Ver nota
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
      )}
    </Card>
  );
}
