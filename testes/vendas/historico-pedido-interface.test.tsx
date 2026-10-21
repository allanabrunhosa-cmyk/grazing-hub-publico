// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,render,screen,within} from "@testing-library/react";
import {ConteudoHistoricoPedido,PainelHistoricoPedido} from "@/app/(protegido)/vendas/pedidos/historico-pedido-conteudo";
import {criarHistoricoPedidoFixture} from "../visual/historico-pedido-fixture";
import {DetalheHistoricoPedido} from "@/app/(protegido)/vendas/pedidos/detalhe-historico-pedido";
import {SPREADSHEET_ENTREGAS_HISTORICAS,SHEET_ENTREGAS_HISTORICAS} from "@/lib/vendas/entregas-historicas-dominio";
const fontes=vi.hoisted(()=>({buscar:vi.fn()}));
vi.mock("@/lib/prisma",()=>({prisma:{identidadeExternaVenda:{findFirst:fontes.buscar}}}));
vi.mock("next/navigation",()=>({useRouter:()=>({replace:vi.fn()})}));
afterEach(()=>{cleanup();fontes.buscar.mockReset();});
function entregaComProva(enderecoOriginal:string|null="Rua de entrega sintética, 42\nReferência original preservada") {
 return {versao:1,origem:"google-sheets-shipping",modalidade:enderecoOriginal?"ENTREGA_INFORMADA":"RETIRADA",criterioModalidade:enderecoOriginal?"CAMPO_FULL_ADDRESS_SHIPPING":"USUARIO_2026_10_15_SEM_SHIPPING_RETIRADA_SEM_FRETE",enderecoOriginal,provas:{},proveniencia:{spreadsheetId:SPREADSHEET_ENTREGAS_HISTORICAS,sheetId:SHEET_ENTREGAS_HISTORICAS,aba:"Orders",colunaEndereco:"I",cabecalhoEndereco:"Full Address (Shipping)",colunaNumero:"J",linha:2,numeroOriginal:"900001",fonteSha256:"a".repeat(64),conteudoSha256:"b".repeat(64),linhaSha256:"c".repeat(64)}};
}
describe("consulta do pedido histórico",()=>{
 it("identifica os itens recuperados sem trocar sua origem pela planilha",()=>{
  const registro=criarHistoricoPedidoFixture();registro.itens=[...registro.itens,{...registro.itens[0],bloco:11}];
  render(<ConteudoHistoricoPedido registro={registro} itensComplementares={1}/>);
  expect(screen.getByText(/Inclui 1 item recuperado no WooCommerce/)).toBeTruthy();
  expect(screen.getByText("WooCommerce 1")).toBeTruthy();
 });
 it("mostra número original e não oferece ações operacionais",()=>{
  render(<PainelHistoricoPedido registro={criarHistoricoPedidoFixture()}/>);
  expect(screen.getByRole("heading",{name:"Pedido histórico #900001"})).toBeTruthy();
  for(const acao of [/Imprimir/i,/Produzir/i,/Emitir/i,/Confirmar/i,/Receber/i,/Editar/i,/Cancelar pedido/i])expect(screen.queryByRole("button",{name:acao})).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();expect(screen.queryByText(/Entrega imediata/i)).toBeNull();
 });
 it("conserva comprador, destinatário e todos contatos originais sem atribuição cruzada",()=>{
  render(<ConteudoHistoricoPedido registro={criarHistoricoPedidoFixture()}/>);const regiao=screen.getByRole("region",{name:"Comprador e destinatário"});
  for(const t of ["Comprador: Compradora Fictícia de Demonstração","Destinatário: Destinatária Fictícia de Presente","E-mail (BE): compradora.com.identificacao.extensa@exemplo.invalid","E-mail (BG): alternativo.compradora@exemplo.invalid","Telefone (G): +55 (11) 90000-0001","Telefone (BF): +55 (11) 90000-0002"])expect(within(regiao).getByText(t)).toBeTruthy();
  expect(within(regiao).getByText(/contato do destinatário não foi informado/)).toBeTruthy();
 });
 it("C e H ficam separados como cobrança e não viram endereço de entrega",()=>{
  render(<ConteudoHistoricoPedido registro={criarHistoricoPedidoFixture()}/>);const regiao=screen.getByRole("region",{name:"Endereços de cobrança"});
  expect(within(regiao).getByText("Endereço original C")).toBeTruthy();expect(within(regiao).getByText("Endereço original H")).toBeTruthy();expect(within(regiao).getByText(/destino da entrega não está confirmado/)).toBeTruthy();
 });
 it("itens repetidos mantêm blocos distintos e desconto aparece sem nova subtração",()=>{
  render(<ConteudoHistoricoPedido registro={criarHistoricoPedidoFixture()}/>);const tabela=screen.getByRole("table",{name:"Itens históricos conhecidos"});
  expect(within(tabela).getAllByRole("row")).toHaveLength(3);expect(within(tabela).getAllByText(/Caixa fictícia com embalagem/)).toHaveLength(2);expect(within(tabela).getByText("10")).toBeTruthy();
  const valores=screen.getByRole("region",{name:"Valores originais"});expect(within(valores).getByText(/2\.219,00/)).toBeTruthy();expect(screen.getByText(/desconto histórico não é aplicado novamente/)).toBeTruthy();
 });
 it("observações ficam como texto React escapado, sem scripts ou HTML executado",()=>{
  const {container}=render(<ConteudoHistoricoPedido registro={criarHistoricoPedidoFixture()}/>);expect(screen.getByText(/<script>window\.__historicoExecutado = true<\/script>/)).toBeTruthy();expect(container.querySelector("script")).toBeNull();
 });
 it("estado vazio mantém ausências sem fabricar itens ou observações",()=>{
  const registro=criarHistoricoPedidoFixture();registro.itens=[];registro.notas_originais=null;registro.excecoes=[];registro.metodo_pagamento_original=null;registro.transaction_id_original=null;
  render(<ConteudoHistoricoPedido registro={registro}/>);expect(screen.getByText("Não há itens detalhados na fonte.")).toBeTruthy();expect(screen.getByText("Sem observações")).toBeTruthy();expect(screen.getByText("Forma de pagamento informada: Não informada")).toBeTruthy();expect(screen.queryByRole("table")).toBeNull();
 });
 it("zero e ajuste negativo permanecem visíveis",()=>{
  const registro=criarHistoricoPedidoFixture();registro.totais.frete_ajuste_original="-2197";registro.totais.total_original="0";
  render(<ConteudoHistoricoPedido registro={registro}/>);const regiao=screen.getByRole("region",{name:"Valores originais"});expect(within(regiao).getByText(/-R\$\s*2\.197,00/)).toBeTruthy();expect(within(regiao).getAllByText(/R\$\s*0,00/).length).toBeGreaterThan(0);
 });
 it("projeta o Shipping comprovado e preserva C e H somente como cobrança",async()=>{
  const registro=criarHistoricoPedidoFixture(),entrega=entregaComProva();
  fontes.buscar.mockResolvedValue({dadosOrigem:{registro,hub:{entregaHistorica:entrega,metadadoPrivado:"Não projetar"}}});
  const painel=await DetalheHistoricoPedido({id:"pedido-sintetico"});
  expect(painel.props.entregaOriginal).toEqual({modalidade:"ENTREGA",enderecoOriginal:entrega.enderecoOriginal});
  render(painel);
  const destino=screen.getByRole("region",{name:"Entrega original"});
  expect(within(destino).getByText(entrega.enderecoOriginal!,{normalizer:texto=>texto})).toBeTruthy();
  expect(within(destino).queryByText("Endereço original C")).toBeNull();
  const cobranca=screen.getByRole("region",{name:"Endereços de cobrança"});
  for(const rotulo of ["Endereço original C","Endereço original H"])expect(within(cobranca).getByText(rotulo)).toBeTruthy();
  expect(screen.queryByText(/destino da entrega não está confirmado/)).toBeNull();
  expect(screen.getByText("Modalidade de entrega: Entrega informada na origem.")).toBeTruthy();
  expect(screen.getByText("Data da entrega: não informada.")).toBeTruthy();
  expect(screen.queryByText("Não projetar")).toBeNull();expect(screen.queryByRole("textbox")).toBeNull();
 });
 it("apresenta retirada somente quando a proveniência comprova Shipping vazio",async()=>{
  fontes.buscar.mockResolvedValue({dadosOrigem:{registro:criarHistoricoPedidoFixture(),hub:{entregaHistorica:entregaComProva(null)}}});
  render(await DetalheHistoricoPedido({id:"pedido-sintetico"}));
  expect(within(screen.getByRole("region",{name:"Entrega original"})).getByText("Retirada conforme a fonte histórica.")).toBeTruthy();
  expect(screen.getByText("Modalidade de entrega: Retirada.")).toBeTruthy();
  expect(screen.queryByText(/destino da entrega não está confirmado/)).toBeNull();
 });
 it.each([
  ["ausente",undefined],
  ["origem de cobrança",{...entregaComProva(),origem:"cobranca"}],
  ["outro número",{...entregaComProva(),proveniencia:{...entregaComProva().proveniencia,numeroOriginal:"900002"}}],
  ["outra coluna",{...entregaComProva(),proveniencia:{...entregaComProva().proveniencia,colunaEndereco:"C"}}],
  ["hash inválido",{...entregaComProva(),proveniencia:{...entregaComProva().proveniencia,fonteSha256:"invalido"}}],
  ["retirada com Shipping",{...entregaComProva(),modalidade:"RETIRADA",criterioModalidade:"USUARIO_2026_10_15_SEM_SHIPPING_RETIRADA_SEM_FRETE"}],
  ["texto inválido",{...entregaComProva(),enderecoOriginal:{logradouro:"Não é texto original"}}],
  ["texto vazio",{...entregaComProva(),enderecoOriginal:"   "}],
 ])("mantém ausência do destino para metadado %s",async(_nome,entrega)=>{
  fontes.buscar.mockResolvedValue({dadosOrigem:{registro:criarHistoricoPedidoFixture(),hub:{entregaHistorica:entrega}}});
  render(await DetalheHistoricoPedido({id:"pedido-sintetico"}));
  expect(screen.queryByRole("region",{name:"Entrega original"})).toBeNull();
  expect(screen.getByText(/destino da entrega não está confirmado/)).toBeTruthy();
  expect(screen.getByText("Data e modalidade de entrega: não informadas.")).toBeTruthy();
 });
 it("mostra o texto de Shipping escapado e não executa HTML da fonte",async()=>{
  const original="Rua sintética\n<script>window.__entregaExecutada=true</script>";
  fontes.buscar.mockResolvedValue({dadosOrigem:{registro:criarHistoricoPedidoFixture(),hub:{entregaHistorica:entregaComProva(original)}}});
  const{container}=render(await DetalheHistoricoPedido({id:"pedido-sintetico"}));
  expect(within(screen.getByRole("region",{name:"Entrega original"})).getByText(original,{normalizer:texto=>texto})).toBeTruthy();
  expect(container.querySelector("script")).toBeNull();
 });
});
