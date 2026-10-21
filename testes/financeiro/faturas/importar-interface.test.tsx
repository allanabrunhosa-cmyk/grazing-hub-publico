// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportarFatura } from "@/app/(protegido)/financeiro/cartoes/importar";
const m=vi.hoisted(()=>({identificar:vi.fn(),preparar:vi.fn(),importar:vi.fn(),push:vi.fn(),refresh:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:m.push,refresh:m.refresh})}));
vi.mock("@/components/layout/acesso-contexto",()=>({useAcesso:()=>({pode:()=>true})}));
vi.mock("@/app/(protegido)/financeiro/cartoes/actions",()=>({identificarFaturaAction:m.identificar,prepararFaturaAction:m.preparar,importarFaturaAction:m.importar}));
const valores={competencia:"2026-09",total:"150.00",inicio:"2026-08-03",fim:"2026-09-02",fechamento:"2026-09-02",vencimento:"2026-09-15",final:"1234"};
const identificacao={cartaoId:"cartao",formato:"PDF",quantidade:1,cabecalho:{banco:"ITAU",conflitos:[],dados:Object.fromEntries(Object.entries(valores).map(([k,v])=>[k,{valor:v,origem:"PDF",evidencia:"Documento sintético"}]))}};
const previa={token:"token",cartao:"Cartão fictício",totalExtraido:15000,totalInformado:15000,naoReconhecidas:[],avisos:[],arquivoRepetido:false,linhas:[{linha:1,data:"2026-09-01",descricao:"COMPRA FICTÍCIA",valor:15000,totalParcelas:1,existente:false,possivelDuplicada:false,revisar:true}]};
beforeEach(()=>{vi.resetAllMocks();m.identificar.mockResolvedValue({identificacao});m.preparar.mockResolvedValue({previa});m.importar.mockResolvedValue({id:"f"});});
afterEach(cleanup);
async function abrir(){const u=userEvent.setup();render(<ImportarFatura cartoes={[{id:"cartao",nome:"Cartão fictício",ativo:true}]}/>);await u.click(screen.getByRole("button",{name:"Importar fatura"}));return u;}
const arquivo=()=>new File(["%PDF-1.4 fictício"],"exemplo.pdf",{type:"application/pdf"});
it("começa pelo arquivo sem obrigar cabeçalho antes de ler",async()=>{
  const u=await abrir();expect(screen.queryByLabelText("Competência")).toBeNull();
  await u.upload(screen.getByLabelText("Arquivo da fatura"),arquivo());
  await screen.findByRole("heading",{name:"Conferir detalhamento"});
  expect(m.identificar).toHaveBeenCalledOnce();expect(m.preparar).toHaveBeenCalledOnce();expect(m.importar).not.toHaveBeenCalled();
  const f=m.preparar.mock.calls[0][0] as FormData;
  expect(f.get("total")).toBe("150.00");expect(f.get("cartaoId")).toBe("cartao");expect(f.get("vencimento")).toBe("2026-09-15");
  await u.click(screen.getByRole("button",{name:"Confirmar importação"}));
  await waitFor(()=>expect(m.push).toHaveBeenCalledWith("/financeiro/cartoes/faturas/f"));
});
it("pede senha somente quando necessário e não confirma automaticamente",async()=>{
  m.identificar.mockResolvedValueOnce({erro:"PDF protegido",senhaNecessaria:true});const u=await abrir();
  await u.upload(screen.getByLabelText("Arquivo da fatura"),arquivo());
  const senha=await screen.findByLabelText("Senha deste PDF");await u.type(senha,"senha-ficticia");await u.click(screen.getByRole("button",{name:"Abrir PDF"}));
  await screen.findByRole("heading",{name:"Conferir detalhamento"});
  expect((m.identificar.mock.calls[1][0] as FormData).get("senhaPdf")).toBe("senha-ficticia");
  expect(m.importar).not.toHaveBeenCalled();expect(sessionStorage.length).toBe(0);expect(localStorage.length).toBe(0);
});
it("campo ausente fica para revisão, sem preencher com zero ou data atual",async()=>{
  const incompleta=structuredClone(identificacao);delete incompleta.cabecalho.dados.total;
  m.identificar.mockResolvedValue({identificacao:incompleta});const u=await abrir();
  await u.upload(screen.getByLabelText("Arquivo da fatura"),arquivo());await screen.findByLabelText("Total informado");
  expect(screen.getByLabelText("Total informado")).toHaveProperty("value","");expect(m.preparar).not.toHaveBeenCalled();
});
it("cadastro ambíguo não é escolhido por nome ou posição",async()=>{
  m.identificar.mockResolvedValue({identificacao:{...identificacao,cartaoId:null}});const u=await abrir();
  await u.upload(screen.getByLabelText("Arquivo da fatura"),arquivo());await screen.findByRole("combobox",{name:"Cartão da fatura"});
  expect(screen.getByRole("button",{name:"Conferir compras"})).toHaveProperty("disabled",true);expect(m.preparar).not.toHaveBeenCalled();
});
it("trocar o arquivo invalida os dados e a prévia anteriores",async()=>{
  const u=await abrir();await u.upload(screen.getByLabelText("Arquivo da fatura"),arquivo());await screen.findByRole("heading",{name:"Conferir detalhamento"});
  await u.click(screen.getByRole("button",{name:"Conferir dados"}));
  m.identificar.mockResolvedValue({erro:"PDF protegido",senhaNecessaria:true});
  await u.upload(screen.getByLabelText("Arquivo da fatura"),new File(["%PDF outro"],"outro.pdf",{type:"application/pdf"}));
  await screen.findByLabelText("Senha deste PDF");expect(screen.queryByLabelText("Competência")).toBeNull();expect(screen.queryByRole("button",{name:"Confirmar importação"})).toBeNull();
});
