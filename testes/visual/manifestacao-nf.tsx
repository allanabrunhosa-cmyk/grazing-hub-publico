import { useEffect, useState, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { NotasFiscaisTable } from "@/app/(protegido)/notas-fiscais/notas-fiscais-table";
import { ManifestoNfsView } from "@/app/(protegido)/financeiro/manifesto-nfs/manifesto-nfs-view";
import { registrarChamada } from "./manifestacao-nf-acoes";
import type { NotaFiscalRow } from "@/app/(protegido)/notas-fiscais/types";
import "@/app/globals.css";

const parametros = new URLSearchParams(location.search);
document.documentElement.classList.toggle("dark", parametros.has("escuro"));

const notaBase: NotaFiscalRow = {
  id: "retorno", chaveAcesso: "0".repeat(44), nsu: "000000000000001", tipo: "PROC_NFE",
  fornecedorNome: "Fornecedor fictício de equipamento", fornecedorCnpj: null, valorTotal: 100,
  dataEmissao: "2026-11-02T12:00:00.000Z", createdAt: "2026-11-02T12:00:00.000Z",
  ultimaManifestacao: null, temXmlCompleto: true, manifestacoes: [],
  tratamentoLocal: null, dataDevolucao: null, motivoTratamentoLocal: null,
  tratamentoLocalEm: null, tratamentoLocalVersao: 0,
};
const notasNfeIniciais: NotaFiscalRow[] = [
  notaBase,
  { ...notaBase, id: "consumo", chaveAcesso: "1".repeat(44), fornecedorNome: "Fornecedor fictício de material de consumo" },
  { ...notaBase, id: "ignorada", chaveAcesso: "2".repeat(44), fornecedorNome: "Documento ignorado de exemplo", tratamentoLocal: "IGNORADA", motivoTratamentoLocal: "Documento fora do controle de compras da loja.", tratamentoLocalEm: "2026-11-03T12:00:00.000Z", tratamentoLocalVersao: 1 },
  { ...notaBase, id: "devolvida", chaveAcesso: "3".repeat(44), fornecedorNome: "Devolução registrada de exemplo", ultimaManifestacao: "CONFIRMACAO_DA_OPERACAO", tratamentoLocal: "DEVOLUCAO_REGISTRADA", dataDevolucao: "2026-11-03", motivoTratamentoLocal: "Equipamento devolvido e conferido com o fornecedor.", tratamentoLocalEm: "2026-11-03T12:00:00.000Z", tratamentoLocalVersao: 1 },
];
type NotaNfs = ComponentProps<typeof ManifestoNfsView>["notas"][number];
const nfseBase: NotaNfs = {
  id: "nfse-pendente", identificador: "servico-ficticio-001", chaveAcesso: null, origem: "NACIONAL", status: "PENDENTE",
  numero: "42", serie: null, codigoVerificacao: null,
  prestadorNome: "Prestador fictício com descrição longa para conferir a quebra do formulário", prestadorCnpj: null, prestadorDados: null,
  tomadorNome: "Loja de exemplo", tomadorCnpj: null, tomadorDados: null, fornecedorNome: null,
  valorServico: 100, valorLiquido: 100, valorIss: 0, dataEmissao: "2026-11-02T12:00:00.000Z", dataCompetencia: null,
  dataVencimento: null, destinoFinanceiro: null, municipioNome: null, uf: null, lancada: false, temXml: true,
};
const categorias = [{ id: "categoria-visual", nome: "Material de consumo", grupo: "DESPESAS_OPERACIONAIS" as const }];

function App() {
  const [notasNfe, setNotasNfe] = useState(notasNfeIniciais);
  const [notasNfs, setNotasNfs] = useState<NotaNfs[]>([
    nfseBase,
    { ...nfseBase, id: "nfse-aceita", identificador: "servico-ficticio-002", prestadorNome: "Serviço aceito de exemplo", status: "ACEITA", dataVencimento: "2026-11-20" },
  ]);
  const [chamadas, setChamadas] = useState<unknown[]>([]);
  useEffect(() => {
    function aoSimular(evento: Event) {
      const detalhe = (evento as CustomEvent<{ acao: string; entrada: Record<string, unknown> }>).detail;
      setChamadas(anteriores => [...anteriores, detalhe]);
      if (parametros.has("erro") || parametros.has("pendente")) return;
      if (detalhe.acao === "SITUACAO_NFSE") {
        const { nfseId, decisao, destinoFinanceiro, dataVencimento } = detalhe.entrada;
        const destino = destinoFinanceiro === "FINANCEIRO" || destinoFinanceiro === "SOMENTE_FISCAL" ? destinoFinanceiro : null;
        setNotasNfs(anteriores => anteriores.map(nota => nota.id !== nfseId ? nota
          : decisao === "ALTERAR_DESTINO_FINANCEIRO" ? { ...nota, destinoFinanceiro: destino }
            : decisao === "ACEITAR" ? {
              ...nota, status: "ACEITA", destinoFinanceiro: destino,
              dataVencimento: typeof dataVencimento === "string" ? dataVencimento : null,
            } : { ...nota, status: "RECUSADA" }));
      }
      if (detalhe.acao === "TRATAR_NFE") {
        setNotasNfe(anteriores => anteriores.map(nota => nota.id === detalhe.entrada.notaFiscalId ? {
          ...nota,
          tratamentoLocal: detalhe.entrada.acao === "IGNORAR" ? "IGNORADA" : detalhe.entrada.acao === "DEVOLUCAO" ? "DEVOLUCAO_REGISTRADA" : null,
          ultimaManifestacao: detalhe.entrada.acao === "DEVOLUCAO" ? "CONFIRMACAO_DA_OPERACAO" : nota.ultimaManifestacao,
          dataDevolucao: typeof detalhe.entrada.dataDevolucao === "string" ? detalhe.entrada.dataDevolucao : null,
          motivoTratamentoLocal: detalhe.entrada.acao !== "REABRIR" && typeof detalhe.entrada.motivo === "string" ? detalhe.entrada.motivo : null,
          tratamentoLocalEm: detalhe.entrada.acao === "REABRIR" ? null : "2026-11-04T15:00:00.000Z", tratamentoLocalVersao: (nota.tratamentoLocalVersao ?? 0) + 1,
        } : nota));
      }
    }
    window.addEventListener("manifestacao-nf-fixture", aoSimular);
    return () => window.removeEventListener("manifestacao-nf-fixture", aoSimular);
  }, []);

  return <main className="mx-auto max-w-7xl space-y-4 p-4">
    <h1 className="text-2xl font-semibold">{parametros.get("tipo") === "nfse" ? "Manifesto de NFS-e" : "Manifesto de Notas"}</h1>
    <p className="text-sm text-muted-foreground">Prévia isolada com dados fictícios. Sem banco, SEFAZ ou pagamentos reais.</p>
    {parametros.get("tipo") === "nfse" ? <ManifestoNfsView notas={parametros.has("vazio") ? [] : notasNfs} categorias={categorias} cartoes={[]} podeImportar={false} podeLancar podeEditar /> : <NotasFiscaisTable
      notas={parametros.has("vazio") ? [] : notasNfe}
      locais={[{ id: "local-visual", nome: "Estoque de exemplo" }]}
      insumos={[{ id: "insumo-visual", nome: "Item de exemplo", unidade: "UN", custoMedio: 100 }]}
      categoriasInsumo={[]} centrosCustoInsumo={[]} fornecedoresInsumo={[]} todosInsumosCadastro={[]}
      categoriasFinanceiras={categorias} podeCadastrarFornecedor={false} podeCadastrarInsumo={false}
    />}
    <output className="sr-only" data-testid="chamadas-simuladas">{JSON.stringify(chamadas)}</output>
    <Toaster />
  </main>;
}

window.fetch = async (entrada, opcoes) => {
  const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url, location.origin);
  if (url.origin !== location.origin || !url.pathname.startsWith("/api/nfse/")) throw new Error("Rede bloqueada na prévia isolada.");
  if (url.pathname === "/api/nfse/situacao") {
    const corpo = JSON.parse(String(opcoes?.body ?? "{}"));
    registrarChamada("SITUACAO_NFSE", corpo);
    if (parametros.has("pendente")) await new Promise<never>(() => {});
    if (parametros.has("erro")) return Response.json({ erro: "Falha simulada. Os dados permanecem no formulário." }, { status: 400 });
    return Response.json({ ok: true });
  }
  registrarChamada("ROTA_NAO_SIMULADA", { caminho: url.pathname });
  throw new Error("Ação indisponível na prévia isolada.");
};

createRoot(document.getElementById("root")!).render(<App />);
