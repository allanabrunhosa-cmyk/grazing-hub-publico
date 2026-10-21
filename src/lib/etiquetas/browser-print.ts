type DispositivoBrowserPrint = {
  name?: string;
  uid?: string;
  connection?: string;
  deviceType?: string;
  send(
    dados: string,
    sucesso: () => void,
    falha: (erro: unknown) => void,
  ): void;
};

type SdkBrowserPrint = {
  getLocalDevices(
    sucesso: (dispositivos: DispositivoBrowserPrint[]) => void,
    falha: (erro: unknown) => void,
    tipo: "printer",
  ): void;
  getDefaultDevice(
    tipo: "printer",
    sucesso: (dispositivo: DispositivoBrowserPrint | null) => void,
    falha: (erro: unknown) => void,
  ): void;
};

declare global {
  interface Window {
    BrowserPrint?: SdkBrowserPrint;
  }
}

export type ImpressoraLocal = {
  nome: string;
  identificador: string;
  conexao: string;
  dispositivo: DispositivoBrowserPrint;
};

function textoErro(erro: unknown) {
  if (erro instanceof Error) return erro.message;
  if (typeof erro === "string" && erro.trim()) return erro;
  return "O aplicativo local não respondeu.";
}

function dispositivoValido(valor: unknown): valor is DispositivoBrowserPrint {
  if (!valor || typeof valor !== "object") return false;
  const dispositivo = valor as DispositivoBrowserPrint;
  return typeof dispositivo.uid === "string" && !!dispositivo.uid.trim()
    && typeof dispositivo.connection === "string" && !!dispositivo.connection.trim()
    && dispositivo.deviceType === "printer" && typeof dispositivo.send === "function";
}

function consultarSdk<T>(consulta: (sucesso: (valor: T) => void, falha: (erro: unknown) => void) => void, tempoLimiteMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const tempo = window.setTimeout(() => reject(new Error("O Browser Print não respondeu. Verifique se o aplicativo está aberto e se o domínio de Validades está autorizado.")), tempoLimiteMs);
    try {
      consulta((valor) => { window.clearTimeout(tempo); resolve(valor); },
        (erro) => { window.clearTimeout(tempo); reject(new Error(textoErro(erro))); });
    } catch (erro) {
      window.clearTimeout(tempo);
      reject(new Error(textoErro(erro)));
    }
  });
}

export async function detectarImpressoraPadrao(tempoLimiteMs = 10_000): Promise<ImpressoraLocal> {
  const sdk = window.BrowserPrint;
  if (!sdk) {
    throw new Error("SDK do Zebra Browser Print não carregado neste computador.");
  }
  const resposta = await consultarSdk<DispositivoBrowserPrint[]>((sucesso, falha) => sdk.getLocalDevices(sucesso, falha, "printer"), tempoLimiteMs);
  const dispositivos = Array.isArray(resposta) ? resposta.filter(dispositivoValido) : [];
  if (!dispositivos.length) throw new Error("Nenhuma impressora disponível no Browser Print. Confira o cabo USB, a alimentação e a configuração no aplicativo Zebra.");
  let dispositivo: DispositivoBrowserPrint;
  if (dispositivos.length === 1) {
    dispositivo = dispositivos[0];
  } else {
    const padrao = await consultarSdk<DispositivoBrowserPrint | null>((sucesso, falha) => sdk.getDefaultDevice("printer", sucesso, falha), tempoLimiteMs);
    const encontrada = dispositivoValido(padrao) ? dispositivos.find((item) => item.uid === padrao.uid && item.connection === padrao.connection) : undefined;
    if (!encontrada) throw new Error("Há mais de uma impressora disponível. Selecione a impressora padrão no aplicativo Zebra Browser Print e detecte novamente.");
    dispositivo = encontrada;
  }
  return {
    nome: dispositivo.name?.trim() || dispositivo.uid!,
    identificador: dispositivo.uid!,
    conexao: dispositivo.connection!,
    dispositivo,
  };
}

export async function enviarZpl(
  impressora: ImpressoraLocal,
  zpl: string,
  tempoLimiteMs = 15_000,
) {
  if (!dispositivoValido(impressora.dispositivo)) throw new Error("A impressora selecionada é inválida. Clique em Detectar impressora antes de enviar.");
  return new Promise<void>((resolve, reject) => {
    let finalizado = false;
    const tempo = window.setTimeout(() => {
      if (finalizado) return;
      finalizado = true;
      reject(new Error("TEMPO_LIMITE_INCERTO"));
    }, tempoLimiteMs);
    impressora.dispositivo.send(
      zpl,
      () => {
        if (finalizado) return;
        finalizado = true;
        window.clearTimeout(tempo);
        resolve();
      },
      (erro) => {
        if (finalizado) return;
        finalizado = true;
        window.clearTimeout(tempo);
        reject(new Error(textoErro(erro)));
      },
    );
  });
}
