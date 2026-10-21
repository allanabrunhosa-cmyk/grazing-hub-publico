// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { detectarImpressoraPadrao, enviarZpl } from "@/lib/etiquetas/browser-print";

const biblioteca = readFileSync("public/browser-print/BrowserPrint.min.js", "utf8");
const usb = { name: "ZD220 teste", uid: "usb-teste", connection: "usb", deviceType: "printer", manufacturer: "Zebra Technologies" };

// Executa o SDK oficial com transporte simulado: nenhum acesso à rede ou impressão real.
function instalarSdk(disponiveis: unknown[], padrao: unknown = {}, erroListagem = false) {
  const chamadas: Array<{ url: string; corpo?: string }> = [];
  class Transporte {
    static DONE = 4;
    withCredentials = false;
    readyState = 0;
    status = 200;
    responseType = "";
    responseText = "";
    response = "";
    url = "";
    onreadystatechange = () => {};
    open(_metodo: string, url: string) { this.url = url; }
    send(corpo?: string) {
      chamadas.push({ url: this.url, corpo });
      if (this.url.endsWith("available")) {
        this.responseText = JSON.stringify({ printer: disponiveis });
        if (erroListagem) { this.status = 500; this.response = "USB indisponível"; }
      } else if (this.url.includes("default")) {
        this.responseText = JSON.stringify(padrao);
      }
      this.readyState = 4;
      this.onreadystatechange();
    }
  }
  window.BrowserPrint = new Function("XMLHttpRequest", "navigator", "location", `${biblioteca}\nreturn BrowserPrint;`)(Transporte, { userAgent: "Chrome" }, { protocol: "https:" });
  return chamadas;
}

afterEach(() => { delete window.BrowserPrint; vi.useRealTimers(); });

it("usa a única USB real mesmo sem padrão e envia os identificadores pelo SDK oficial", async () => {
  const chamadas = instalarSdk([usb], {});
  const impressora = await detectarImpressoraPadrao();
  expect(impressora).toMatchObject({ nome: "ZD220 teste", identificador: "usb-teste", conexao: "usb" });
  await enviarZpl(impressora, "^XA^FDTESTE^FS^XZ");
  const envio = chamadas.find((item) => item.url.endsWith("write"));
  expect(JSON.parse(envio!.corpo!)).toMatchObject({ device: usb, data: "^XA^FDTESTE^FS^XZ" });
  expect(chamadas.some((item) => item.url.includes("default"))).toBe(false);
});

it("rejeita objeto vazio que o SDK transforma em Device com método send", async () => {
  instalarSdk([{}], {});
  await expect(detectarImpressoraPadrao()).rejects.toThrow("Nenhuma impressora disponível");
});

it("não escolhe arbitrariamente entre duas impressoras sem padrão", async () => {
  instalarSdk([usb, { ...usb, uid: "segunda" }], {});
  await expect(detectarImpressoraPadrao()).rejects.toThrow("Há mais de uma impressora");
});

it("respeita a padrão quando ela está entre os dispositivos disponíveis", async () => {
  instalarSdk([{ ...usb, uid: "segunda" }, usb], usb);
  expect((await detectarImpressoraPadrao()).identificador).toBe(usb.uid);
});

it("recusa padrão antigo que não está disponível", async () => {
  instalarSdk([usb, { ...usb, uid: "segunda" }], { ...usb, uid: "desconectada" });
  await expect(detectarImpressoraPadrao()).rejects.toThrow("Selecione a impressora padrão");
});

it("expõe falha do serviço local", async () => {
  instalarSdk([], {}, true);
  await expect(detectarImpressoraPadrao()).rejects.toThrow("USB indisponível");
});

it("encerra a detecção quando o SDK não responde", async () => {
  vi.useFakeTimers();
  window.BrowserPrint = { getLocalDevices: vi.fn(), getDefaultDevice: vi.fn() };
  const verificacao = expect(detectarImpressoraPadrao(100)).rejects.toThrow("O Browser Print não respondeu");
  await vi.advanceTimersByTimeAsync(100);
  await verificacao;
});

it("bloqueia envio de seleção inválida antes de chamar o transporte", async () => {
  const send = vi.fn();
  await expect(enviarZpl({ nome: "Impressora Zebra", identificador: "dispositivo-local", conexao: "local", dispositivo: { send } }, "^XA^XZ")).rejects.toThrow("impressora selecionada é inválida");
  expect(send).not.toHaveBeenCalled();
});
