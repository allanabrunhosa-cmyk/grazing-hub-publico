import { createRoot } from "react-dom/client";
import { useState } from "react";
import { EditorVenda, Texto } from "@/app/(protegido)/vendas/componentes";
import { FiscalPreviewLayout } from "./fiscal-layout";
import { FiscalProdutoUnificado } from "@/app/(protegido)/financeiro/fiscal/ficha-produto";
import { OperacaoFiscal } from "@/app/(protegido)/financeiro/fiscal/configuracoes/operacao";
import { CentralConfiguracoesFiscais } from "@/app/(protegido)/financeiro/fiscal/configuracoes/central";
import { EmpresaFiscalResumo } from "@/app/(protegido)/financeiro/fiscal/configuracoes/empresa-resumo";
import { EditarPerfilEmpresa } from "@/app/(protegido)/financeiro/fiscal/empresa/editar-perfil";
import { GruposFiscais } from "@/app/(protegido)/vendas/fiscal/grupos-fiscais-client";
import { CadastrosFiscais, RegrasFiscaisVisiveis } from "@/app/(protegido)/financeiro/fiscal/cadastros-fiscais";
import { BrasilNfeForm } from "@/app/(protegido)/configuracoes/integracoes/brasilnfe/brasilnfe-form";
import { PreRequisitosBrasilNfeCard } from "@/app/(protegido)/configuracoes/integracoes/brasilnfe/pre-requisitos-card";
import { HabilitacaoEmissaoBrasilNfeCard } from "@/app/(protegido)/configuracoes/integracoes/brasilnfe/habilitacao-emissao-card";
import { NumeracaoFiscal } from "@/app/(protegido)/financeiro/fiscal/numeracao/numeracao-client";
import { CertificadoCard } from "@/app/(protegido)/configuracoes/certificado-card";
import { Button } from "@/components/ui/button";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { fichaKitUnificada, fichaUnificada, painelUnificado } from "./fiscal-unificado-dados";
import { destinoFiscal } from "./fiscal-unificado-navegacao";
import { configuracaoBrasilNfeFicticia } from "../fiscal-saida/brasilnfe-interface-dados";
import { controleEmissaoFicticio } from "../fiscal-saida/brasilnfe-habilitacao-dados";
import { preRequisitosBrasilNfeVazios } from "@/lib/fiscal-saida/brasilnfe/pre-requisitos-dominio";
import { consultarTabelaFiscal } from "@/lib/fiscal/catalogos/consulta";
import type { ConsultaTabelaFiscal } from "@/lib/fiscal/catalogos/tipos";
import type { NumeracaoFiscalBrasilNfeDto } from "@/lib/fiscal-saida/brasilnfe/numeracao-dto";
import "@/app/globals.css";

window.fetch = async input => {
  const url = new URL(String(input), location.origin);
  if (url.pathname !== "/api/fiscal/tabelas") throw new Error("Rede externa bloqueada na prévia sintética.");
  const p = url.searchParams;
  return Response.json(consultarTabelaFiscal({ ...Object.fromEntries(p), tabela: p.get("tabela") as ConsultaTabelaFiscal["tabela"], crt: p.has("crt") ? Number(p.get("crt")) as 1 | 2 | 3 | 4 : null, modelo: p.has("modelo") ? Number(p.get("modelo")) as 55 | 65 : undefined }));
};
document.addEventListener("click", e => { const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href^='/']"); if (a && !a.pathname.endsWith(".html")) { e.preventDefault(); location.assign(destinoFiscal(a.getAttribute("href")!)); } });
const rota = new URLSearchParams(location.search).get("rota") ?? "/vendas/produtos";
function ProdutoNoEditor() {
  const [aberto, setAberto] = useState(false), [fiscal, setFiscal] = useState(false);
  return <><Button type="button" onClick={() => setAberto(true)}>Editar produto de demonstração</Button>{aberto && <EditorVenda titulo="Editar produto de demonstração" descricao="Prévia sintética do formulário comercial e da ficha fiscal independente." fechar={() => setAberto(false)} salvar={async () => ({ erro: "Prévia isolada: nenhum produto real foi salvo." })}
    cabecalho={<GrupoAcoes><Button type="button" variant="outline" onClick={() => setFiscal(false)}>Identificação</Button><Button type="button" variant="outline" onClick={() => setFiscal(true)}>Fiscal</Button></GrupoAcoes>}
    exibirIndependente={fiscal} conteudoIndependente={<FiscalProdutoUnificado produtoId={fichaUnificada.produto.id} inicial={fichaUnificada} />}>
    <Texto nome="Nome do produto *" required maxLength={120} defaultValue="Produto exclusivamente fictício" />
  </EditorVenda>}</>;
}
const config = { ...configuracaoBrasilNfeFicticia, versao: 1, configuracaoSalva: true, tokenConfigurado: true, userTokenConfigurado: true, validacaoExterna: { ...configuracaoBrasilNfeFicticia.validacaoExterna, pendencias: ["Prévia isolada, sem verificação externa."] } };
const requisitos = preRequisitosBrasilNfeVazios(1), controle = controleEmissaoFicticio();
const numeracao: NumeracaoFiscalBrasilNfeDto = { versaoConfiguracao: 1, emitente: { nome: "EMPRESA EXCLUSIVAMENTE FICTÍCIA", cnpj: "00000000000000" }, consulta: { situacao: "CONCLUIDA", consultadoEm: new Date().toISOString(), httpStatus: 200, falha: null, avisosPresentes: false }, linhas: ([1, 2] as const).flatMap(ambiente => ([55, 65] as const).map(modelo => ({ modelo, ambiente, serie: modelo === 55 ? "6" : "7", proximoNumero: modelo === 55 ? "42" : "18", padrao: true, ultimaAutorizadaLocal: null, divergencia: null }))), pendencias: [] };
const empresa = <EmpresaFiscalResumo campos={[{ nome: "Regime", valor: "Simples Nacional" }, { nome: "CRT", valor: "1" }, { nome: "Inscrição estadual", valor: "123456789012" }, { nome: "Vigência", valor: "01/01/2026" }, { nome: "Endereço", valor: "Rua de demonstração, 100 · São Paulo/SP" }]} pendencias={[]}><EditarPerfilEmpresa versoes={painelUnificado.versoes.filter(v => v.tipo === "PERFIL")} /></EmpresaFiscalResumo>;
const emissor = <div className="space-y-4"><BrasilNfeForm inicial={config} editar salvar={async () => ({ ok: true, dados: config })} validar={async () => ({ ok: true, dados: config })} /><PreRequisitosBrasilNfeCard inicial={requisitos} editar registrar={async () => ({ ok: true, dados: requisitos })} verificar={async () => ({ ok: true, dados: requisitos })} /><HabilitacaoEmissaoBrasilNfeCard inicial={controle} editar salvar={async () => ({ ok: true, dados: controle })} /></div>;
createRoot(document.getElementById("root")!).render(<FiscalPreviewLayout><div className="space-y-5">
  <GrupoAcoes className="flex-wrap">{[["Produto", "/financeiro/fiscal/vinculos"], ["Grupos fiscais", "/financeiro/fiscal/grupos"], ["Configurações", "/financeiro/fiscal/configuracoes"]].map(([nome, url]) => <Button type="button" variant="outline" nativeButton={false} render={<a href={destinoFiscal(url)} />} key={url}>{nome}</Button>)}</GrupoAcoes>
  {rota.endsWith("configuracoes") ? <CentralConfiguracoesFiscais operacao={<OperacaoFiscal administrarAcessos administradorFiscal />} empresa={empresa} emissor={emissor} certificado={<CertificadoCard podeEditar podeExcluir certificado={{ arquivoNome: "certificado-demonstracao.pfx", titular: "EMPRESA EXCLUSIVAMENTE FICTÍCIA", validoAte: "2026-12-31T12:00:00Z", diasParaVencer: 71, updatedAt: "2026-10-21T12:00:00Z", atualizadoPorNome: "Equipe fictícia" }} />} numeracao={<NumeracaoFiscal semCabecalho inicial={numeracao} podeConsultar consultar={async () => ({ ok: true, dados: numeracao })} atualizar={async () => ({ ok: false, erro: "Simulação: contadores reais preservados." })} />} />
    : rota.endsWith("grupos") ? <><GruposFiscais editar crt={1} grupos={painelUnificado.grupos.map(g => ({ ...g, versao: 1, fiscal: {}, produtos: [] }))} painel={painelUnificado} /><RegrasFiscaisVisiveis painel={painelUnificado} /></>
      : rota.endsWith("vinculos") ? <CadastrosFiscais painel={painelUnificado} produtoInicial={fichaUnificada.produto.id} /> : new URLSearchParams(location.search).has("editor") ? <ProdutoNoEditor /> : new URLSearchParams(location.search).has("kit") ? <FiscalProdutoUnificado produtoId={fichaKitUnificada.produto.id} inicial={fichaKitUnificada} /> : <FiscalProdutoUnificado produtoId={fichaUnificada.produto.id} inicial={fichaUnificada} />}
</div></FiscalPreviewLayout>);
