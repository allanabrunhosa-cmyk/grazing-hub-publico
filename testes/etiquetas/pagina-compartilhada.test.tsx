import { beforeEach, expect, it, vi } from "vitest";
const s = vi.hoisted(() => ({ guarda: vi.fn(), dedicado: vi.fn(), insumos: vi.fn(), historico: vi.fn(), usuarios: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: s.guarda }));
vi.mock("@/lib/contexto-interface", () => ({ interfaceEtiquetasDedicada: s.dedicado }));
vi.mock("@/app/(protegido)/producao/etiquetas/etiquetas-client", () => ({ EtiquetasClient: () => null }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  insumo: { findMany: s.insumos }, trabalhoEtiqueta: { findMany: s.historico, count: async () => 0 },
  usuario: { findMany: s.usuarios }, configuracaoLoja: { findUnique: async () => null }, perfilImpressora: { findFirst: async () => null },
  responsavelEtiqueta: { findMany: async () => [] }, pontoImpressao: { findMany: async () => [] }, envioPontoImpressao: { findMany: async () => [] },
} }));
import Pagina from "@/app/(protegido)/producao/etiquetas/page";
beforeEach(() => {
  vi.resetAllMocks();
  s.dedicado.mockResolvedValue(true);
  s.guarda.mockResolvedValue({ userId: "u", admin: false, permissoes: { producao: ["visualizar"] }, excecoes: {} });
  s.insumos.mockResolvedValue([{ id: "mesmo-id", nome: "Produto atual", tipo: "INSUMO", categoria: null }]);
  s.historico.mockResolvedValue([]);
  s.usuarios.mockResolvedValue([{ id: "u", nome: "Ana", responsavelEtiquetaHabilitado: true }]);
});
it("a entrada antiga no HUB encaminha ao subdomínio sem consultar dados de etiquetas", async () => {
  s.dedicado.mockResolvedValue(false);
  await expect(Pagina({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({ digest: "NEXT_REDIRECT;replace;https://validades.grazinghub.com.br/producao/etiquetas;307;" });
  expect(s.insumos).not.toHaveBeenCalled();
  expect(s.historico).not.toHaveBeenCalled();
});
it("o subdomínio mantém os cadastros compartilhados e as permissões", async () => {
  s.dedicado.mockResolvedValue(true);
  const dedicado = (await Pagina({ searchParams: Promise.resolve({}) })).props.children[1];
  expect(dedicado.props.caminhoBase).toBe("/producao/etiquetas");
  expect(dedicado.props.loja.maximoCopiasEtiqueta).toBe(30);
  expect(dedicado.props.produtos[0].id).toBe("mesmo-id");
  expect(dedicado.props.responsaveis).toEqual([{ id: "u", nome: "Ana", responsavelEtiquetaHabilitado: true }]);
  expect(s.guarda).toHaveBeenCalledWith("producao");
  expect(s.usuarios).toHaveBeenCalledWith({ where: { ativo: true, excluidoEm: null }, select: { id: true, nome: true, responsavelEtiquetaHabilitado: true }, orderBy: [{ nome: "asc" }, { id: "asc" }] });
});
it("recusa leitura sem autorização antes de consultar qualquer catálogo", async () => {
  s.guarda.mockRejectedValue(new Error("REDIRECT:/sem-acesso"));
  await expect(Pagina({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/sem-acesso");
  expect(s.insumos).not.toHaveBeenCalled();
  expect(s.usuarios).not.toHaveBeenCalled();
});
it("carrega o conjunto completo de validades sem limitar as contagens à página", async () => {
  const pagina = await Pagina({ searchParams: Promise.resolve({ secao: "validades", situacao: "vencidas", pagina: "2" }) });
  expect(s.historico).toHaveBeenCalledWith(expect.objectContaining({ where: { lojaId: "singleton" } }));
  expect(s.historico.mock.calls[0][0]).not.toHaveProperty("take");
  expect(s.historico.mock.calls[0][0]).not.toHaveProperty("skip");
  expect(pagina.props.children[1].props.gestaoValidades).toMatchObject({ filtro: "vencidas", pagina: 2, itens: [] });
});
