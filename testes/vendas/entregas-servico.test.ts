import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessaoAtual } from "@/lib/session";
import { Prisma } from "@/generated/prisma/client";
const s=vi.hoisted(()=>({loja:vi.fn()}));vi.mock("server-only",()=>({}));vi.mock("@/lib/prisma",()=>({prisma:{configuracaoLoja:{findUnique:s.loja}}}));
import { calcularEntrega, validarFretePedido } from "@/lib/vendas/entregas";
import { assinarEntrega, verificarEntrega, assinaturaEntradas } from "@/lib/vendas/entregas-recibo";
import { entregasVazias } from "@/lib/vendas/entregas-dominio";
import { FalhaMapas } from "@/lib/vendas/entregas-mapas";
const configSlots = () => ({ ...entregasVazias(), modelo: "SLOTS", ativo: true, origemTipo: "PERSONALIZADA", origemNome: "Origem sintética", origem: endereco,
 veiculos: [{ id: "m", nome: "Moto", perfil: "MOTO", ativo: true, slotsMinimos: 0, slotsMaximos: 3 }, { id: "c", nome: "Carro", perfil: "CARRO", ativo: true, slotsMinimos: 4, slotsMaximos: 20 }],
 faixas: [{ id: "a", limiteMetros: 2000, preco: "0", precos: { m: "22.00", c: "24.00" } }] });
const endereco={cep:"01234567",logradouro:"Rua Fictícia",numero:"1",complemento:"",bairro:"Centro",cidade:"São Paulo",uf:"SP"};
const c=()=>({...entregasVazias(),ativo:true,origemTipo:"PERSONALIZADA",origem:endereco,veiculo:"MOTO",maximoMetros:2000,faixas:[{id:"a",limiteMetros:2000,preco:"5.00"}]});
const sessao={userId:"u",versao:0}as SessaoAtual, entrada=()=>({clienteId:"c",atendimento:"ENTREGA"as const,endereco,subtotalProdutos:"100.00"});
const rota={provedor:"GOOGLE_MAPS"as const,distanciaMetros:1501,duracaoSegundos:123,origem:{placeId:"o",descricao:"Origem fictícia",precisao:"ROOFTOP"},destino:{placeId:"d",descricao:"Destino fictício",precisao:"ROOFTOP"},polyline:"teste"};
beforeEach(()=>{vi.stubEnv("AUTH_SECRET","segredo-sintetico-apenas-testes-entregas");vi.stubEnv("GOOGLE_MAPS_API_KEY","sintetica");vi.stubEnv("GOOGLE_MAPS_ENTREGAS_ATIVADO","1");s.loja.mockResolvedValue({id:"singleton",endereco:"Rua fictícia, 1",versaoEntregas:1,entregas:c()});});afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers();});
describe("Motor compartilhado e aprovação comercial",()=>{
 it("simulador e pedido por slots escolhem o perfil e a coluna de preço corretos",async()=>{
   s.loja.mockResolvedValue({versaoEntregas:1,entregas:configSlots()});
   const p={calcular:vi.fn(async()=>rota)};
   const pedido=await calcularEntrega({...entrada(),slotsOcupados:4},sessao,p);
   const simulado=await calcularEntrega({...entrada(),clienteId:null,subtotalProdutos:"0.00",veiculoEntregaId:"c"},sessao,p);
   expect(pedido.memoria.frete).toBe("24.00");expect(simulado.memoria.frete).toBe(pedido.memoria.frete);
   expect(p.calcular).toHaveBeenCalledWith(expect.any(String),endereco,"CARRO",expect.any(Function));expect(pedido.selecaoVeiculo).toMatchObject({id:"c",escolha:"SLOTS",slotsOcupados:4});
   const tx={$executeRaw:vi.fn(),$queryRaw:vi.fn(),configuracaoLoja:{findUnique:s.loja}}as unknown as Prisma.TransactionClient;
   const d={...entrada(),prazo:"IMEDIATO"as const,previsaoData:null,previsaoJanela:null,destinatario:null,observacoes:"",desconto:"0",frete:"24",canalId:"canal",itens:[],entrega:{metodo:"AUTOMATICO"as const,recibo:pedido.recibo,motivo:"",excecaoCobertura:false,motivoCobertura:""}};
   expect((await validarFretePedido(tx,d,"100",sessao,undefined,[],4)).frete).toBe("24.00");
   await expect(validarFretePedido(tx,d,"100",sessao,undefined,[],5)).rejects.toThrow("outras entradas");
 });
 it("ocupação pendente e capacidade excedida não chamam mapas nem fabricam frete",async()=>{
   s.loja.mockResolvedValue({versaoEntregas:1,entregas:configSlots()});const p={calcular:vi.fn()};
   for(const slotsOcupados of [null,21]){const r=await calcularEntrega({...entrada(),slotsOcupados},sessao,p);expect(r.memoria.frete).toBeNull();expect(r.selecaoVeiculo?.perfil).toBeNull();}
   expect(p.calcular).not.toHaveBeenCalled();
 });
 it("retirada não chama mapas e tem frete zero mesmo sem configuração",async()=>{s.loja.mockResolvedValue(null);const p={calcular:vi.fn()};const r=await calcularEntrega({...entrada(),atendimento:"RETIRADA",endereco:null},sessao,p);expect(r.memoria.frete).toBe("0.00");expect(p.calcular).not.toHaveBeenCalled();});
 it("não mascara credencial ausente, configuração incompleta ou endereço incompleto",async()=>{const p={calcular:vi.fn()};vi.stubEnv("GOOGLE_MAPS_API_KEY","");expect((await calcularEntrega(entrada(),sessao,p)).memoria.estado).toBe("PROVEDOR_INDISPONIVEL");s.loja.mockResolvedValue({versaoEntregas:1,entregas:entregasVazias()});expect((await calcularEntrega(entrada(),sessao,p)).memoria.estado).toBe("CONFIGURACAO_INCOMPLETA");expect((await calcularEntrega({...entrada(),endereco:{...endereco,numero:""}},sessao,p)).memoria.estado).toBe("ENDERECO_PENDENTE");expect(p.calcular).not.toHaveBeenCalled();});
 it("bloqueio explícito é resolvido antes da rota",async()=>{s.loja.mockResolvedValue({versaoEntregas:1,entregas:{...c(),excecoes:[{id:"b",nome:"Bloqueio",ativo:true,tipo:"CEP",cepInicio:endereco.cep,cepFim:"",bairro:"",cidade:"",uf:"",bloquear:true,fixo:null,acrescimo:null,freteMinimo:null,pedidoMinimo:null}]}});const p={calcular:vi.fn()};expect((await calcularEntrega(entrada(),sessao,p)).memoria.estado).toBe("BLOQUEADO");expect(p.calcular).not.toHaveBeenCalled();});
 it("simulador e pedido usam o mesmo resultado; deduplica chamadas em andamento",async()=>{const p={calcular:vi.fn(async()=>rota)};const [a,b]=await Promise.all([calcularEntrega(entrada(),sessao,p),calcularEntrega(entrada(),sessao,p)]);expect(a).toEqual(b);expect(p.calcular).toHaveBeenCalledTimes(1);const simulacao=await calcularEntrega({...entrada(),clienteId:null},sessao,p);expect(simulacao.memoria).toEqual(a.memoria);const payload=JSON.parse(Buffer.from(a.recibo.split(".")[1],"base64url").toString());expect(JSON.stringify(payload)).not.toMatch(/distanciaMetros|duracaoSegundos|polyline|Origem fictícia/);});
 it.each(["PROVEDOR_INDISPONIVEL","SEM_ROTA","ENDERECO_PENDENTE"]as const)("preserva estado %s",async(estado)=>{const r=await calcularEntrega(entrada(),sessao,{calcular:vi.fn(async()=>{throw new FalhaMapas(estado);})});expect(r.memoria.estado).toBe(estado);expect(r.memoria.frete).toBeNull();expect(r.rota).toBeNull();});
 it("rejeita recibo adulterado, de outro vínculo e vencido",async()=>{vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-01T01:00:00Z"));const token=await assinarEntrega({vinculo:"a"});expect((await verificarEntrega(token,"a")).vinculo).toBe("a");await expect(verificarEntrega(token,"b")).rejects.toThrow("outras entradas");await expect(verificarEntrega(token+"x","a")).rejects.toThrow();vi.setSystemTime(new Date("2026-10-01T01:11:00Z"));await expect(verificarEntrega(token,"a")).rejects.toThrow("vencido");});
 it.each(["endereco","clienteId","subtotalProdutos"]as const)("não reutiliza cálculo após alterar %s",async(campo)=>{const r=await calcularEntrega(entrada(),sessao,{calcular:vi.fn(async()=>rota)});const tx={ $executeRaw:vi.fn(),$queryRaw:vi.fn(),configuracaoLoja:{findUnique:s.loja}}as unknown as Prisma.TransactionClient;const d={...entrada(),prazo:"IMEDIATO"as const,previsaoData:null,previsaoJanela:null,destinatario:{nome:"Fictício",contato:""},observacoes:"",desconto:"0",frete:"5",canalId:"canal",itens:[],entrega:{metodo:"AUTOMATICO"as const,recibo:r.recibo,motivo:"",excecaoCobertura:false,motivoCobertura:""}};await expect(validarFretePedido(tx,{...d,...(campo==="endereco"?{endereco:{...endereco,numero:"2"}}:campo==="clienteId"?{clienteId:"outro"}:{})},campo==="subtotalProdutos"?"99":"100",sessao)).rejects.toThrow("outras entradas");});
 it("aceita cálculo anterior ao cadastro do cliente, mas mantém endereço, subtotal e usuário vinculados",async()=>{
   const r=await calcularEntrega({...entrada(),clienteId:null},sessao,{calcular:vi.fn(async()=>rota)});
   const tx={$executeRaw:vi.fn(),$queryRaw:vi.fn(),configuracaoLoja:{findUnique:s.loja}}as unknown as Prisma.TransactionClient;
   const d={...entrada(),prazo:"IMEDIATO"as const,previsaoData:null,previsaoJanela:null,destinatario:null,observacoes:"",desconto:"0",frete:"5",canalId:"canal",itens:[],entrega:{metodo:"AUTOMATICO"as const,recibo:r.recibo,motivo:"",excecaoCobertura:false,motivoCobertura:""}};
   expect((await validarFretePedido(tx,d,"100",sessao)).frete).toBe("5.00");
   await expect(validarFretePedido(tx,{...d,endereco:{...endereco,numero:"2"}},"100",sessao)).rejects.toThrow("outras entradas");
   await expect(validarFretePedido(tx,d,"99",sessao)).rejects.toThrow("outras entradas");
   await expect(validarFretePedido(tx,d,"100",{...sessao,userId:"outro"})).rejects.toThrow("outras entradas");
 });
 it("mudanças de configuração não recalculam snapshot confirmado quando entradas comerciais são iguais",async()=>{const d={...entrada(),prazo:"IMEDIATO"as const,previsaoData:null,previsaoJanela:null,destinatario:{nome:"Fictício",contato:""},observacoes:"",desconto:"0",frete:"5",canalId:"canal",itens:[],entrega:null};const snapshot={metodo:"AUTOMATICO",assinaturaComercial:assinaturaEntradas({cliente:"c",atendimento:"ENTREGA",endereco,subtotalProdutos:"100.00",frete:"5.00"}),versao:1};s.loja.mockResolvedValue({versaoEntregas:22,entregas:{...c(),faixas:[{id:"novo",limiteMetros:2000,preco:"200"}]}});const tx={$executeRaw:vi.fn(),$queryRaw:vi.fn(),configuracaoLoja:{findUnique:s.loja}}as unknown as Prisma.TransactionClient;expect((await validarFretePedido(tx,d,"100",sessao,{entregaSnapshot:snapshot,frete:new Prisma.Decimal("5")})).snapshot).toEqual(snapshot);});
 it.each(["versao","usuario","origem","veiculo","preco"])("recusa cálculo incompatível com %s na confirmação",async(campo)=>{
  const r=await calcularEntrega(entrada(),sessao,{calcular:vi.fn(async()=>rota)});
  const d={...entrada(),prazo:"IMEDIATO"as const,previsaoData:null,previsaoJanela:null,destinatario:{nome:"Fictício",contato:""},observacoes:"",desconto:"0",frete:campo==="preco"?"0":"5",canalId:"canal",itens:[],entrega:{metodo:"AUTOMATICO"as const,recibo:r.recibo,motivo:"",excecaoCobertura:false,motivoCobertura:""}};
  if(campo==="versao")s.loja.mockResolvedValue({versaoEntregas:2,entregas:c()});
  if(campo==="origem")s.loja.mockResolvedValue({versaoEntregas:1,entregas:{...c(),origem:{...endereco,numero:"99"}}});
  if(campo==="veiculo")s.loja.mockResolvedValue({versaoEntregas:1,entregas:{...c(),veiculo:"CARRO"}});
  const tx={$executeRaw:vi.fn(),$queryRaw:vi.fn(),configuracaoLoja:{findUnique:s.loja}}as unknown as Prisma.TransactionClient;
  await expect(validarFretePedido(tx,d,"100",campo==="usuario"?{...sessao,userId:"outro"}:sessao)).rejects.toThrow(campo==="preco"?"Frete divergente":"outras entradas");
 });
 it("conserva revisões do fluxo legado enquanto Entregas nunca foi configurada",async()=>{
  s.loja.mockResolvedValue(null);const d={...entrada(),prazo:"IMEDIATO"as const,previsaoData:null,previsaoJanela:null,destinatario:{nome:"Fictício",contato:""},observacoes:"",desconto:"0",frete:"12",canalId:"canal",itens:[],entrega:null};
  const tx={$executeRaw:vi.fn(),$queryRaw:vi.fn(),configuracaoLoja:{findUnique:s.loja}}as unknown as Prisma.TransactionClient;
  expect((await validarFretePedido(tx,d,"200",sessao,{entregaSnapshot:{metodo:"MANUAL_LEGADO",assinaturaComercial:"antiga"},frete:new Prisma.Decimal("5")})).frete).toBe("12");
 });
 it("preserva frete histórico sem snapshot após configurar Entregas, mas exige validação para endereço alterado",async()=>{
  const d={...entrada(),prazo:"IMEDIATO"as const,previsaoData:null,previsaoJanela:null,destinatario:{nome:"Fictício",contato:""},observacoes:"Revisão apenas da observação",desconto:"0",frete:"12",canalId:"canal",itens:[],entrega:null};
  const anterior={entregaSnapshot:null,frete:new Prisma.Decimal("12"),clienteId:"c",atendimento:"ENTREGA",enderecoSnapshot:endereco,subtotal:new Prisma.Decimal("100"),desconto:new Prisma.Decimal("0")};
  const tx={$executeRaw:vi.fn(),$queryRaw:vi.fn(),configuracaoLoja:{findUnique:s.loja}}as unknown as Prisma.TransactionClient;
  expect(await validarFretePedido(tx,d,"100",sessao,anterior)).toMatchObject({frete:"12.00",snapshot:{metodo:"MANUAL_LEGADO",cobertura:"NAO_VALIDADA"}});
  await expect(validarFretePedido(tx,{...d,endereco:{...endereco,numero:"99"}},"100",sessao,anterior)).rejects.toThrow("Calcule o frete");
 });
});
