import {beforeEach,it,expect,vi} from "vitest";
const sim=vi.hoisted(()=>({sessao:vi.fn(),pode:vi.fn(),foto:vi.fn()}));
vi.mock("@/lib/session",()=>({getSession:sim.sessao}));vi.mock("@/lib/permissoes/servidor",()=>({podeAcessar:sim.pode}));vi.mock("@/lib/prisma",()=>({prisma:{insumo:{findUnique:sim.foto}}}));
import {GET} from "@/app/api/etiquetas/produtos/[id]/foto/route";
const consultar=()=>GET(new Request("http://localhost/api/etiquetas/produtos/ficticio/foto"),{params:Promise.resolve({id:"ficticio"})});
beforeEach(()=>{vi.clearAllMocks();sim.sessao.mockResolvedValue({userId:"u"});sim.pode.mockResolvedValue(true);sim.foto.mockResolvedValue({fotoMimeType:"image/png",fotoData:Buffer.from([1,2,3])});});
it("não consulta fotos sem sessão",async()=>{sim.sessao.mockResolvedValue(null);expect((await consultar()).status).toBe(401);expect(sim.foto).not.toHaveBeenCalled();});
it("exige acesso a Produção",async()=>{sim.pode.mockResolvedValue(false);expect((await consultar()).status).toBe(403);expect(sim.foto).not.toHaveBeenCalled();});
it("retorna foto privada já cadastrada",async()=>{const r=await consultar();expect(r.status).toBe(200);expect(r.headers.get("cache-control")).toBe("private, no-store");expect(r.headers.get("x-content-type-options")).toBe("nosniff");expect(sim.pode).toHaveBeenCalledWith("producao");});
it.each([null,{fotoData:Buffer.from("svg"),fotoMimeType:"image/svg+xml"}])("não devolve foto ausente ou formato ativo",async foto=>{sim.foto.mockResolvedValue(foto);expect((await consultar()).status).toBe(404);});

it("recusa identificador inválido antes de consultar foto", async () => {
  sim.sessao.mockResolvedValue({userId:"ficticio"}); sim.pode.mockResolvedValue(true);
  expect((await GET(new Request("http://localhost"),{params:Promise.resolve({id:"../segredo"})})).status).toBe(404);
  expect(sim.foto).not.toHaveBeenCalled();
});
