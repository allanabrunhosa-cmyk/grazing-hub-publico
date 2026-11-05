import { afterEach, beforeEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ autenticar: vi.fn(), reservar: vi.fn(), assinar: vi.fn(), fechar: vi.fn(), aguardar: vi.fn() }));
vi.mock("@/lib/etiquetas/pontos", () => ({ autenticarDispositivo: fake.autenticar, reservarProximoEnvio: fake.reservar }));
vi.mock("@/lib/etiquetas/pontos-espera", () => ({ assinarFilaPonto: fake.assinar }));
import { GET } from "@/app/api/etiquetas/conector/trabalhos/route";
const dispositivo = { pontoId: "ponto-ficticio", ponto: { lojaId: "singleton", impressoraSelecionadaId: "usb-ficticia" }, impressoraDetectada: true };
const request = () => new Request("https://etiquetas.grazinghub.com.br/api/etiquetas/conector/trabalhos?espera=20");
beforeEach(() => {
  vi.resetAllMocks();
  fake.autenticar.mockResolvedValue(dispositivo);
  fake.reservar.mockResolvedValue(null);
  fake.assinar.mockResolvedValue({ fechar: fake.fechar, aguardar: fake.aguardar, intervaloRevisao: () => 5000 });
});
afterEach(() => vi.restoreAllMocks());

it("recusa credencial inválida antes de abrir uma espera", async () => {
  fake.autenticar.mockResolvedValue(null);
  expect((await GET(request())).status).toBe(401);
  expect(fake.assinar).not.toHaveBeenCalled();
});
it("entrega trabalho que já existe sem esperar e preserva clientes antigos", async () => {
  fake.reservar.mockResolvedValue({ id: "envio", zpl: "^XA^XZ" });
  const resposta = await GET(new Request("https://etiquetas.grazinghub.com.br/api/etiquetas/conector/trabalhos"));
  expect(await resposta.json()).toMatchObject({ trabalho: { id: "envio", impressoraId: "usb-ficticia" } });
  expect(fake.assinar).not.toHaveBeenCalled();
  expect(fake.aguardar).not.toHaveBeenCalled();
});
it("acorda por sinal, revalida a identidade e entrega sem aguardar o intervalo", async () => {
  let acordar!: () => void;
  fake.aguardar.mockImplementation(() => new Promise<void>(r => { acordar = r; }));
  fake.reservar.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "novo", zpl: "^XA^XZ" });
  const resultado = GET(request());
  await vi.waitFor(() => expect(fake.aguardar).toHaveBeenCalledOnce());
  acordar();
  expect(await (await resultado).json()).toMatchObject({ trabalho: { id: "novo" }, esperaAtiva: true });
  expect(fake.autenticar).toHaveBeenCalledTimes(3);
  expect(fake.fechar).toHaveBeenCalledOnce();
});
it("não entrega um trabalho se a credencial foi revogada durante a espera", async () => {
  fake.autenticar.mockResolvedValueOnce(dispositivo).mockResolvedValueOnce(dispositivo).mockResolvedValueOnce(null);
  expect((await GET(request())).status).toBe(401);
  expect(fake.reservar).toHaveBeenCalledOnce();
  expect(fake.fechar).toHaveBeenCalledOnce();
});
it("limita a espera a vinte segundos e libera a inscrição", async () => {
  let agora = 0;
  vi.spyOn(Date, "now").mockImplementation(() => agora);
  fake.aguardar.mockImplementation(async (ms: number) => { agora += ms; });
  const resposta = await GET(request());
  expect(await resposta.json()).toEqual({ trabalho: null, esperaAtiva: true });
  expect(agora).toBe(20_000);
  expect(fake.fechar).toHaveBeenCalledOnce();
});
it("aborto não reserva nem mantém a inscrição aberta", async () => {
  const abort = new AbortController(); abort.abort();
  expect((await GET(new Request(request(), { signal: abort.signal }))).status).toBe(499);
  expect(fake.reservar).not.toHaveBeenCalled();
  expect(fake.fechar).toHaveBeenCalledOnce();
});
it("limita solicitações simultâneas do mesmo ponto", async () => {
  fake.assinar.mockResolvedValue(null);
  expect((await GET(request())).status).toBe(429);
  expect(fake.reservar).not.toHaveBeenCalled();
});
