import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { EntregasForm } from "@/app/(protegido)/vendas/area-entrega/entregas-form";
import { FretePedido } from "@/app/(protegido)/vendas/pedidos/frete-pedido";
import { DadosLojaForm } from "@/app/(protegido)/configuracoes/dados-loja-form";
import { entregasVazias, type ConfiguracaoEntregas } from "@/lib/vendas/entregas-dominio";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CamposEnderecoEntrega } from "@/components/entregas/endereco-entrega";
import type { PedidoEntrada } from "@/lib/vendas/pedidos-dominio";
import "@/app/globals.css";
const endereco = { cep: "00000000", logradouro: "Rua sintética", numero: "12", complemento: "", bairro: "Centro fictício", cidade: "São Paulo", uf: "SP" };
const config: ConfiguracaoEntregas = { ...entregasVazias(), modelo: "SLOTS", veiculos: [{ id: "m", nome: "Moto", perfil: "MOTO", ativo: true, slotsMinimos: 0, slotsMaximos: 3 }, { id: "c", nome: "Carro", perfil: "CARRO", ativo: true, slotsMinimos: 4, slotsMaximos: 20 }], faixas: [{ id: "7", limiteMetros: 7000, preco: "0", precos: { m: "22.00", c: "24.00" } }, { id: "8", limiteMetros: 8000, preco: "0", precos: { m: "24.00", c: "27.00" } }], origemTipo: "LOJA", origemNome: "" };
const inicial = { config, versao: 1, nomeLoja: "Grazing Table & Co", origemLoja: "Rua sintética, 12, São Paulo - SP", enderecoLoja: endereco, mapasProntos: false, pendencias: ["Prévia sintética — mapas não configurados"] };
function Previa() {
  const [slots, setSlots] = useState(2);
  const parametros = new URLSearchParams(window.location.search), configPedido = { ...config, veiculos: parametros.has("sem-veiculos") ? [] : config.veiculos?.map(v => ({ ...v, nome: parametros.has("nomes-longos") ? `${v.nome} de entrega com identificação sintética extensa` : v.nome })) };
  const [pedido, setPedido] = useState<PedidoEntrada>({ clienteId: "c", canalId: "canal", atendimento: "ENTREGA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, destinatario: { nome: "Fictício", contato: "" }, endereco, observacoes: "", desconto: "0", frete: "0", itens: [{ produtoId: "p", quantidade: "1", escolhas: {}, precoManual: null }] });
  if (new URLSearchParams(window.location.search).has("empresa")) return <ThemeProvider attribute="class" defaultTheme="light"><main className="mx-auto max-w-4xl p-6"><DadosLojaForm config={{nome:"Empresa fictícia",cnpj:"",endereco:"Rua sintética, 12",enderecoEstruturado:endereco,telefone:"",emailContato:""}} /></main></ThemeProvider>;
  if (new URLSearchParams(window.location.search).has("automatico")) return <ThemeProvider attribute="class" defaultTheme="light"><main className="mx-auto max-w-4xl p-6"><Card>
    <CardHeader><CardTitle>Frete automático — prévia com dados fictícios</CardTitle></CardHeader><CardContent className="space-y-6">
      <CamposEnderecoEntrega valor={pedido.endereco!} alterar={valor => setPedido(atual => ({ ...atual, endereco: valor }))} consultarCep={async () => ({ endereco })} />
      <FretePedido dados={pedido} alterar={setPedido} manual={false} aprovarCobertura={false} configuracaoExistente veiculos={configPedido} slotsOcupados={parametros.has("sem-slots") ? null : slots} calculoAutomatico configuracaoAtiva mostrarConfiguracao={false} />
    </CardContent></Card></main></ThemeProvider>;
  return <ThemeProvider attribute="class" defaultTheme="light"><main className="mx-auto max-w-7xl space-y-6 p-6">
    <EntregasForm inicial={inicial} editar />
    <Card><CardHeader><CardTitle>Prévia da linha de frete no pedido</CardTitle></CardHeader><CardContent className="space-y-4">
      <label className="block max-w-32 space-y-2 text-sm"><span>Slots fictícios</span><Input inputMode="numeric" maxLength={6} value={slots} onChange={e => setSlots(Number(e.target.value))} /></label>
      <FretePedido dados={pedido} alterar={setPedido} manual={false} aprovarCobertura={false} configuracaoExistente veiculos={config} slotsOcupados={slots} />
    </CardContent></Card>
  </main></ThemeProvider>;
}
createRoot(document.getElementById("root")!).render(<Previa />);
