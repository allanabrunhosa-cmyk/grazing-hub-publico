import { afterEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ transaction: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: fake.transaction } }));
import { cifrarSenhaWifi, entregarMudancaWifi } from "@/lib/etiquetas/pontos-wifi";

afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

describe("troca de Wi-Fi sem vazar credencial", () => {
  it("recusa criar solicitação quando não existe chave de proteção", () => {
    vi.stubEnv("ETIQUETAS_WIFI_KEY", "");
    expect(() => cifrarSenhaWifi("senha-ficticia")).toThrow("não foi configurada");
  });
  it("entrega senha somente uma vez e apaga o campo cifrado do registro", async () => {
    vi.stubEnv("ETIQUETAS_WIFI_KEY", Buffer.alloc(32, 7).toString("base64"));
    const cifra = cifrarSenhaWifi("senha-ficticia");
    expect(cifra).not.toContain("senha-ficticia");
    fake.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({ mudancaWifiPonto: { updateMany: fake.updateMany, findFirst: fake.findFirst } }));
    fake.findFirst.mockResolvedValueOnce({ id: "pedido-1", ssid: "Rede própria", segredoCifrado: cifra }).mockResolvedValueOnce(null);
    fake.updateMany.mockResolvedValue({ count: 1 });
    expect(await entregarMudancaWifi("ponto-1")).toEqual({ id: "pedido-1", ssid: "Rede própria", senha: "senha-ficticia" });
    expect(fake.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: "ENTREGUE", segredoCifrado: null }) }));
    expect(await entregarMudancaWifi("ponto-1")).toBeNull();
  });
});
