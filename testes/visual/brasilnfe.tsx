import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { BrasilNfeForm } from "@/app/(protegido)/configuracoes/integracoes/brasilnfe/brasilnfe-form";
import { HabilitacaoEmissaoBrasilNfeCard } from "@/app/(protegido)/configuracoes/integracoes/brasilnfe/habilitacao-emissao-card";
import { controleEmissaoFicticio } from "../fiscal-saida/brasilnfe-habilitacao-dados";
import { BarraAcoes } from "@/components/padroes-operacionais";
import { configuracaoBrasilNfeFicticia, configuracaoBrasilNfeServicosPendentesFicticia, criarDetalhesDiagnosticoServicosFicticios } from "../fiscal-saida/brasilnfe-interface-dados";
import "@/app/globals.css";

const parametros = new URLSearchParams(location.search);
const somenteLeitura = parametros.has("leitura");
const detalhesSimulados = parametros.get("estado") === "detalhes";
const habilitacaoSimulada = parametros.get("estado")?.startsWith("habilitacao") === true;
const controleFicticio = controleEmissaoFicticio();
if (parametros.get("estado") === "habilitacao65") {
  controleFicticio.habilitacaoManualDisponivel = true;
  controleFicticio.producao = { id: "habilitacao55-sintetica", revisao: 1, ambiente: "PRODUCAO", habilitada: true, modelos: [55], versaoConfiguracao: 1, emitenteHash: "a".repeat(64), criadaEm: "2026-10-20T12:00:00.000Z" };
  controleFicticio.correspondentes.producao = true;
  controleFicticio.documentosHomologados = [{ id: "prova55-sintetica", modelo: 55, numero: "1", serie: "6" }];
  controleFicticio.requisitos = controleFicticio.requisitos.map(r => ({ ...r, pendencias: r.ambiente === "HOMOLOGACAO" && r.modelo === 65 ? ["CSC de homologação ausente — estado exclusivamente sintético."] : [], ...(r.ambiente === "PRODUCAO" && r.modelo === 65 ? { homologacaoNaoComprovada: true, permiteAceiteAdministrativo: true } : {}) }));
}
const dados = parametros.get("estado") === "servicos-pendentes" || detalhesSimulados ? configuracaoBrasilNfeServicosPendentesFicticia : { ...configuracaoBrasilNfeFicticia, versao: 1, tokenConfigurado: true, configuracaoSalva: true, validacaoExterna: { ...configuracaoBrasilNfeFicticia.validacaoExterna, pendencias: ["Validação externa ainda não realizada.", "Regras tributárias aguardam definição da Confirp."] } };
createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" defaultTheme={parametros.get("tema") === "escuro" ? "dark" : "light"}><div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6"><BarraAcoes titulo="Brasil NFe" descricao="Prévia isolada — empresa fictícia, ações simuladas e nenhuma consulta externa." />{habilitacaoSimulada ? <HabilitacaoEmissaoBrasilNfeCard inicial={controleFicticio} editar={!somenteLeitura} salvar={async () => parametros.get("estado") === "habilitacao-erro" ? { ok: false, erro: "Falha exclusivamente simulada. Conferir a revisão antes de habilitar." } : { ok: true, dados: { ...controleFicticio, homologacao: { id: "evento-ficticio", revisao: 1, ambiente: "HOMOLOGACAO", habilitada: true, modelos: [55], versaoConfiguracao: 1, emitenteHash: "a".repeat(64), criadaEm: "2026-10-14T12:00:00.000Z" }, correspondentes: { homologacao: true, producao: false } } }} /> : <BrasilNfeForm inicial={dados} editar={!somenteLeitura}
  salvar={async entrada => ({ ok: true, dados: { ...dados, versao: entrada.versao + 1, userTokenConfigurado: Boolean(entrada.userTokenSubstituicao) } })}
  validar={async () => detalhesSimulados ? { ok: true, dados, detalhesDiagnostico: criarDetalhesDiagnosticoServicosFicticios(dados.versao) } : ({ ok: true, dados: { ...dados, validacaoExterna: { ...dados.validacaoExterna, situacao: "PARCIAL", verificadaEm: "2026-10-10T12:30:00.000Z", acessoAutenticado: true, pendencias: ["Homologação fiscal pendente.", "Regras tributárias aguardam definição da Confirp."], consultasIndisponiveis: ["Consulta cadastral da empresa: UserToken não configurado."] } } })}
  />}</div></ThemeProvider>);
