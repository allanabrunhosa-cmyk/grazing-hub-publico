import React from "react";
import { createRoot } from "react-dom/client";
import { Card, CardContent } from "@/components/ui/card";
import { MolduraIntegracoes, type ResumoIntegracoes } from "@/app/(protegido)/configuracoes/integracoes/seletor";
import { PainelAsaas } from "@/app/(protegido)/configuracoes/integracoes/asaas/painel";
import { PainelSite } from "@/app/(protegido)/configuracoes/integracoes/site/painel";
import { CobrancaAsaasPedido, type AcoesCobrancaAsaas } from "@/app/(protegido)/vendas/pedidos/cobranca-asaas";
import type { CobrancaAsaasInterface } from "@/lib/asaas/cobrancas";
import type { EstadoAsaas } from "@/lib/asaas/painel";
import type { EstadoSite } from "@/lib/site/configuracao";
import "@/app/globals.css";

// Prévia isolada: dados fictícios, ações simuladas, nenhuma chamada a servidor, Asaas ou site.
const parametros = new URLSearchParams(location.search);
document.documentElement.className = parametros.get("tema") === "escuro" ? "dark" : "light";
const tela = parametros.get("tela") ?? "asaas", cenario = parametros.get("cenario") ?? "ativo";
const espera = () => new Promise(r => setTimeout(r, 300));

const asaasAtivo: EstadoAsaas = { ambiente: "SANDBOX", ativo: true, ligado: true, chave: true, webhook: true, producaoAutorizada: false, pendentes: 0, falhos: 1, semVinculo: 2, incertas: 0, ultimoEvento: "2026-11-23T17:40:00.000Z" };
const asaasVazio: EstadoAsaas = { ambiente: "SANDBOX", ativo: false, ligado: false, chave: false, webhook: false, producaoAutorizada: false, pendentes: 0, falhos: 0, semVinculo: 0, incertas: 0, ultimoEvento: null };
const canais = [{ id: "canal-site", nome: "Site" }, { id: "canal-ifood", nome: "iFood" }, { id: "canal-gf", nome: "Giuliana Flores" }];
const siteAtivo: EstadoSite = { loja: "loja.example.invalid", configurado: true, ligado: true, operando: true, webhook: true, integracao: { ativa: true, canalId: "canal-site", lojaVinculada: "loja.example.invalid", ultimaColeta: "2026-11-23T17:44:00.000Z", ultimoRecebimento: "2026-11-23T17:31:00.000Z", ultimoErro: null }, pendentes: 0, falhos: 0, pedidos: 128, comPendencia: 3, canais };
const siteVazio: EstadoSite = { loja: null, configurado: false, ligado: false, operando: false, webhook: false, integracao: null, pendentes: 0, falhos: 0, pedidos: 0, comPendencia: 0, canais };
const sitePausado: EstadoSite = { ...siteAtivo, operando: false, integracao: { ...siteAtivo.integracao!, ativa: false, ultimoErro: "O site recusou a chave de acesso. Confira a chave e a permissão de leitura." }, falhos: 4 };

const cobranca = (extra: Partial<CobrancaAsaasInterface>): CobrancaAsaasInterface => ({ id: "c1", ambiente: "SANDBOX", origem: "HUB", forma: "PIX", valor: "315.00", vencimento: "2026-11-25", estado: "ATIVA", situacao: "AGUARDANDO", link: "https://sandbox.asaas.com/i/ficticio", boleto: null, liquido: null, pagoEm: null, erro: null, criadaEm: "2026-11-23T17:00:00.000Z", ...extra });
const cobrancas: Record<string, CobrancaAsaasInterface[]> = {
  vazio: [], aberta: [cobranca({})], paga: [cobranca({ situacao: "PAGA", pagoEm: "2026-11-23", liquido: "311.87" })],
  incerta: [cobranca({ estado: "INCERTA", link: null, erro: "Resposta incerta do Asaas. O HUB confere automaticamente antes de permitir nova cobrança." })],
  historico: [cobranca({ id: "c3", forma: "BOLETO" }), cobranca({ id: "c2", situacao: "REMOVIDA", link: null }), cobranca({ id: "c1", estado: "FALHOU", link: null, erro: "CPF/CNPJ inválido." })],
  site: [cobranca({ origem: "SITE", situacao: "PAGA", pagoEm: "2026-11-23", liquido: "311.87", ambiente: "PRODUCAO" })],
};
const acoes: AcoesCobrancaAsaas = {
  gerar: async (_p, entrada) => { await espera(); return parametros.get("erro") ? { erro: "Informe o CPF ou CNPJ do titular da cobrança no pedido antes de cobrar pelo Asaas." } : { ok: true, cobranca: cobranca({ id: "nova", forma: entrada.forma, vencimento: entrada.vencimento }) }; },
  cancelar: async id => { await espera(); return { ok: true, cobranca: cobranca({ id, situacao: "REMOVIDA", link: null }) }; },
  pix: async () => { await espera(); return { ok: true, pix: { copiaCola: "00020126580014br.gov.bcb.pix0136codigo-ficticio-para-previa-visual5204000053039865802BR6304ABCD", imagem: null, expiraEm: null } }; },
};
const resumo: ResumoIntegracoes = { mcp: null, brasilnfe: true, certificado: { resumo: "Válido até 01/01/2027", tom: "roxo" },
  asaas: cenario === "vazio" ? { resumo: "Desativado no servidor", tom: "neutro" } : { resumo: "Ativo em ambiente de testes", tom: "ambar" },
  site: cenario === "vazio" ? { resumo: "Sem chave de acesso", tom: "neutro" } : cenario === "pausado" ? { resumo: "Recepção pausada", tom: "ambar" } : { resumo: "Recebendo pedidos", tom: "verde" } };

const aviso = <p className="text-sm text-muted-foreground">Prévia isolada · dados fictícios · sem gravação · Em revisão visual</p>;
const conteudo = tela === "cobranca"
  ? <main className="mx-auto max-w-xl space-y-4 p-4">{aviso}<Card size="sm"><CardContent className="space-y-2"><p className="text-sm">Pix</p><p className="text-sm text-muted-foreground">Pagamento acompanhado no sistema de origem.</p>
      <CobrancaAsaasPedido pedidoId="pedido-ficticio" total="315.00" hoje="2026-11-23" cobrancas={cobrancas[cenario] ?? []} podeCobrar={parametros.get("leitura") !== "1" && cenario !== "site"} motivoBloqueio="Seu perfil não gera cobranças no Asaas."
        site={cenario === "site" ? { numero: "4521", status: "processing", pendencia: "Data de entrega não identificada no pedido do site; 2 itens sem produto vinculado no HUB" } : null} acoes={acoes} /></CardContent></Card></main>
  : <main className="mx-auto max-w-7xl space-y-4 p-6">{aviso}<MolduraIntegracoes resumo={resumo} ativa={tela}>
      <section aria-label={tela === "site" ? "Site" : "Asaas"} className="space-y-3">
        <div><p className="text-label uppercase text-muted-foreground">Integração</p><h2 className="font-heading text-title">{tela === "site" ? "Site" : "Asaas"}</h2><p className="text-sm text-muted-foreground">{tela === "site" ? "Pedidos da loja virtual recebidos automaticamente em Pedidos, no canal escolhido." : "Cobrança por Pix, boleto ou cartão a partir do pedido, com o pagamento registrado automaticamente."}</p></div>
        {tela === "site"
          ? <PainelSite inicial={cenario === "vazio" ? siteVazio : cenario === "pausado" ? sitePausado : siteAtivo} webhook="https://grazinghub.com.br/api/integracoes/site/webhook" editar={parametros.get("leitura") !== "1"}
              salvar={async (canalId, ativa) => { await espera(); return { ok: true, estado: { ...siteAtivo, operando: ativa, integracao: { ...siteAtivo.integracao!, ativa, canalId } } }; }}
              testar={async () => { await espera(); return { ok: true, pedidos: 1842, metas: ["_billing_cpf", "_billing_number", "_billing_neighborhood", "_delivery_date", "_delivery_time", "__ASAAS_ORDER__"], dataEntrega: "_delivery_date", pagamento: "asaas-pix" }; }}
              reprocessar={async () => { await espera(); return { ok: true, quantidade: 4, estado: siteAtivo }; }} />
          : <PainelAsaas inicial={cenario === "vazio" ? asaasVazio : asaasAtivo} webhook="https://grazinghub.com.br/api/integracoes/asaas/webhook" editar={parametros.get("leitura") !== "1"}
              testar={async () => { await espera(); return { ok: true, ambiente: "SANDBOX" }; }} reprocessar={async () => { await espera(); return { ok: true, quantidade: 3, estado: { ...asaasAtivo, falhos: 0, semVinculo: 0, pendentes: 3 } }; }} />}
      </section>
    </MolduraIntegracoes></main>;
createRoot(document.getElementById("root")!).render(conteudo);
