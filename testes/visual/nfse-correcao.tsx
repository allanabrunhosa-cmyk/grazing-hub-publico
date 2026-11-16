import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { ManifestoNfsView } from "@/app/(protegido)/financeiro/manifesto-nfs/manifesto-nfs-view";
import "@/app/globals.css";

const parametros = new URLSearchParams(location.search);
if (parametros.has("escuro")) document.documentElement.classList.add("dark");
const cartoes = [{ id: "cartao-ficticio", nome: "Cartão de teste", contaBancariaId: "conta-ficticia", contaBancariaNome: "Banco de teste", diaFechamento: 10, diaVencimento: 20, ativo: true }];
const parcela = { id: "parcela-ficticia", numero: "001", valor: 100, dataVencimento: "2026-11-20", formaPagamento: "CARTAO", cartaoCreditoId: "cartao-ficticio", dataCompra: "2026-11-05", parcelaCartao: 1 };
window.fetch = async (_requisicao, opcoes) => opcoes?.method === "PATCH"
  ? Response.json(parametros.has("erro") ? { erro: "A parcela foi alterada. Reabra a nota para conferir os dados." } : { ok: true }, { status: parametros.has("erro") ? 409 : 200 })
  : Response.json({ versao: "versao-ficticia", categoriaId: "categoria-ficticia", descricao: "Serviço de manutenção — exemplo fictício", dataVencimento: parcela.dataVencimento, parcelas: [parcela] });
const nota = {
  id: "nota-ficticia", identificador: "exemplo-ficticio", chaveAcesso: null, origem: "NACIONAL", status: "LANCADA", numero: "42", serie: null,
  codigoVerificacao: null, prestadorNome: "Prestador de serviços de teste", prestadorCnpj: null, prestadorDados: null,
  tomadorNome: "Tomador de teste", tomadorCnpj: null, tomadorDados: null, fornecedorNome: "Prestador de serviços de teste",
  valorServico: 100, valorLiquido: 100, valorIss: 0, dataEmissao: "2026-11-05T12:00:00Z", dataCompetencia: null, municipioNome: null, uf: null,
  lancada: true, temXml: true, dataVencimento: "2026-11-20", destinoFinanceiro: "FINANCEIRO" as const,
};
createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-6xl space-y-4 p-4">
  <h1 className="text-2xl font-semibold">Correção de NFS-e aceita</h1>
  <p className="text-sm text-muted-foreground">Prévia com dados fictícios. As ações são simuladas.</p>
  <ManifestoNfsView notas={[nota]} categorias={[{ id: "categoria-ficticia", nome: "Manutenção", grupo: "DESPESAS_OPERACIONAIS" }]} cartoes={cartoes} podeImportar={false} podeLancar podeEditar />
  <Toaster />
</main>);
