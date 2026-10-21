import { beforeEach, describe, expect, it, vi } from "vitest";
const s=vi.hoisted(()=>({permissao:vi.fn(),salvar:vi.fn(),calcular:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/permissoes/servidor",()=>({exigirPermissao:s.permissao}));
vi.mock("@/lib/vendas/entregas",()=>({salvarEntregas:s.salvar,calcularEntrega:s.calcular}));
vi.mock("@/lib/vendas/cep",()=>({consultarCepVenda:vi.fn()}));
import { salvarEntregasAction, simularEntregaAction } from "@/app/(protegido)/vendas/area-entrega/actions";
beforeEach(()=>{vi.clearAllMocks();s.permissao.mockResolvedValue({userId:"ficticio"});s.salvar.mockResolvedValue({versao:1});s.calcular.mockResolvedValue({});});
describe("Ações do frete por slots",()=>{
 it("impede um formulário antigo de reativar o modelo anterior",async()=>{
  expect(await salvarEntregasAction({ativo:true,veiculo:"CARRO"},0)).toMatchObject({erro:expect.stringContaining("Reabra")});expect(s.salvar).not.toHaveBeenCalled();
  await salvarEntregasAction({modelo:"SLOTS"},0);expect(s.permissao).toHaveBeenCalledWith("vendas.area-entrega","editar");expect(s.salvar).toHaveBeenCalled();
 });
 it("simulação descarta subtotal, retirada, slots e embalagens enviados pelo cliente",async()=>{
  await simularEntregaAction({clienteId:"outro",atendimento:"RETIRADA",endereco:null,subtotalProdutos:"999",slotsOcupados:100,tiposEmbalagemIds:["caixa"],veiculoEntregaId:"m"});
  expect(s.calcular.mock.calls[0][0]).toEqual({clienteId:null,atendimento:"ENTREGA",endereco:null,subtotalProdutos:"0.00",veiculoEntregaId:"m"});
  expect(await simularEntregaAction({clienteId:null,atendimento:"ENTREGA",endereco:null,subtotalProdutos:"0"})).toMatchObject({erro:expect.stringContaining("veículo")});
 });
});
