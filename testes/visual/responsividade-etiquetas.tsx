import { createRoot } from "react-dom/client";
import { EtiquetasClient, type ProdutoEtiquetaTela } from "@/app/(protegido)/producao/etiquetas/etiquetas-client";
import { CabecalhoConteudo } from "@/components/layout/cabecalho-conteudo";
import { Sidebar } from "@/components/layout/sidebar";
import { MenuEtiquetas } from "@/components/layout/menu-etiquetas";
import { secaoEtiquetas, titulosSecoesEtiquetas } from "@/lib/etiquetas/navegacao";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import type { PontoImpressaoTela } from "@/app/(protegido)/producao/etiquetas/pontos-impressao";
import "@/app/globals.css";

const parametros = new URLSearchParams(location.search);
const dedicado = !parametros.has("principal");
const secao = secaoEtiquetas(parametros.get("secao"));
if (dedicado) document.body.dataset.identidade = "etiquetas";
const admin = !parametros.has("leitor");
const produto: ProdutoEtiquetaTela = { id: "ficticio", nome: "Salame fatiado", marcasFornecedor: ["Marca fictícia A", "Marca fictícia B"], tipo: "PRODUTO_INTERMEDIARIO", unidade: "KG", categoria: "Preparações", ativo: true, etiquetaHabilitada: true, validadeSecoDias: null, validadeRefrigeradoDias: 15, validadeCongeladoDias: 30, validadeAposAbertoDias: null, conservacaoEtiquetaPadrao: "REFRIGERADO", versaoConfiguracaoEtiqueta: 1 };
const pontos: PontoImpressaoTela[] = [{ id: "ponto-ficticio", nome: "Cozinha principal", icone: "cozinha", ativo: true, padrao: true, situacao: "RECENTE", vistoEm: new Date().toISOString(), impressoraDetectada: true, impressoraSelecionadaId: "usb-ficticia", impressoras: [{ id: "usb-ficticia", nome: "Zebra ZD220 fictícia" }], wifiSsid: "Rede fictícia", wifiFrequenciaMhz: 2412, wifiRedes: [{ ssid: "Rede fictícia", frequenciaMhz: 2412 }], wifiMudancaEstado: null, wifiEndereco: "192.0.2.20", ethernetEndereco: null, hostname: "raspberry-ficticia", modelo: "Pi 3 B", pendentes: 2, incertos: 1 }];

createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" defaultTheme="light" enableSystem><ProvedorAcesso acesso={{ admin, permissoes: { producao: ["visualizar"] }, excecoes: {} }}>
  <div className="estrutura-sistema">{dedicado ? <MenuEtiquetas /> : <Sidebar />}<div className="painel-sistema"><CabecalhoConteudo dedicado={dedicado} sessao={{ nome: "Equipe fictícia", perfilNome: admin ? "Administrador" : "Consulta" }} />
    <main className="conteudo-sistema"><div className="space-y-6"><header><h1 className="text-display">{titulosSecoesEtiquetas[secao]}</h1><p className="text-muted-foreground">Prévia fictícia: sem banco de dados e sem impressão real.</p></header>
      <EtiquetasClient dedicado={dedicado} secao={secao} pontos={pontos} gestaoValidades={{ agora: "2026-09-16T12:00:00Z", filtro: "todas", pagina: 1, porPagina: 25, total: 1, vencidas: 0, proximas: 1, vigentes: 0, itens: [{ id: "teste", produtoNome: "Salame fatiado", categoriaNome: "Preparações", lote: "TESTE", manipuladoEm: "2026-09-16T12:00:00Z", validoAte: "2026-10-01T12:00:00Z", fusoHorario: "America/Sao_Paulo", responsavelManipulacao: "Ana", conservacao: "REFRIGERADO", copias: 1, status: "PREPARADO", confirmado: false, dados: { produtoNome: "Salame fatiado", lojaNome: "Grazing Table & Co", lojaCnpj: "00.000.000/0000-00", lojaEndereco: "Endereço fictício", conservacao: "REFRIGERADO", quantidade: null, unidade: "KG", lote: "TESTE", marcaFornecedor: "Marca fictícia A", sif: "953", codigoRastreio: "000000", responsavelManipulacao: "Ana", manipuladoEm: "2026-09-16T12:00:00Z", validoAte: "2026-10-01T12:00:00Z", fusoHorario: "America/Sao_Paulo", resolucaoDpi: 203, tamanho: "MM_60X60", mostrarHora: true, copias: 1 } }] }} produtos={Array.from({ length: 35 }, (_, i) => ({ ...produto, id: `etiqueta-ficticia-${i}`, nome: `Ingrediente fictício ${i + 1} para manipulação` }))} historico={[]} admin={admin} responsaveis={[{ id: "ana", nome: "Responsável fictício" }, { id: "joao", nome: "João da produção" }]} caminhoBase={dedicado ? "/" : "/producao/etiquetas"} loja={{ fusoHorario: "America/Sao_Paulo", maximoCopiasEtiqueta: 10, nome: "Grazing Table & Co", cnpj: "00.000.000/0000-00", endereco: "Endereço fictício" }} perfil={{ id: "perfil", nome: "Zebra teste", modelo: null, dpi: 203, suporta60x40: true, suporta60x60: true }} paginaHistorico={{ pagina: 1, total: 0, porPagina: 25 }} abaInicial="imprimir" />
    </div></main></div></div><Toaster />
</ProvedorAcesso></ThemeProvider>);
