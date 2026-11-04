import "server-only";
import { Client } from "pg";

const CANAL = "grazing_etiquetas_fila";
type Ouvinte = () => void;

/** Uma conexão LISTEN por processo, sem manter transação/reserva durante a espera. */
export class AvisosFila {
  private cliente: Client | null = null;
  private conectando: Promise<void> | null = null;
  private ouvintes = new Map<string, Set<Ouvinte>>();
  constructor(private connectionString = process.env.DATABASE_URL) {}

  async encerrar() {
    const cliente = this.cliente;
    this.cliente = null;
    for (const grupo of this.ouvintes.values()) for (const ouvir of grupo) ouvir();
    this.ouvintes.clear();
    await cliente?.end();
  }

  private async conectar() {
    if (this.conectando) return this.conectando;
    if (this.cliente) return;
    const cliente = new Client({ connectionString: this.connectionString, application_name: "etiquetas-espera", connectionTimeoutMillis: 3000, keepAlive: true });
    cliente.on("notification", aviso => {
      if (aviso.channel === CANAL && aviso.payload) for (const ouvir of this.ouvintes.get(aviso.payload) ?? []) ouvir();
    });
    const desconectar = () => {
      if (this.cliente === cliente) { this.cliente = null; void cliente.end().catch(() => {}); }
      for (const grupo of this.ouvintes.values()) for (const ouvir of grupo) ouvir();
    };
    cliente.on("error", desconectar);
    cliente.on("end", desconectar);
    this.conectando = (async () => {
      try {
        await cliente.connect();
        await cliente.query(`LISTEN ${CANAL}`);
        this.cliente = cliente;
      } catch {
        await cliente.end().catch(() => {});
        // A fila continua disponível pelo fallback de consulta limitada.
      } finally { this.conectando = null; }
    })();
    return this.conectando;
  }

  async assinar(pontoId: string, signal: AbortSignal) {
    await this.conectar();
    const grupo = this.ouvintes.get(pontoId) ?? new Set<Ouvinte>();
    if (grupo.size >= 2) return null;
    this.ouvintes.set(pontoId, grupo);
    let pendente = false;
    let acordar: Ouvinte | undefined;
    const ouvir = () => { pendente = true; acordar?.(); };
    grupo.add(ouvir);
    const fechar = () => {
      grupo.delete(ouvir);
      if (!grupo.size) this.ouvintes.delete(pontoId);
      signal.removeEventListener("abort", ouvir);
      acordar?.();
    };
    signal.addEventListener("abort", ouvir, { once: true });
    return {
      intervaloRevisao: () => this.cliente ? 5000 : 500,
      aguardar: async (ms: number) => {
        if (pendente || signal.aborted) { pendente = false; return; }
        await new Promise<void>(resolve => {
          const timer = setTimeout(() => { acordar = undefined; resolve(); }, ms);
          acordar = () => { clearTimeout(timer); acordar = undefined; resolve(); };
        });
        pendente = false;
      },
      fechar,
    };
  }
}

const estado = globalThis as typeof globalThis & { avisosFilaEtiquetas?: AvisosFila };
const avisos = estado.avisosFilaEtiquetas ??= new AvisosFila();
export const assinarFilaPonto = (pontoId: string, signal: AbortSignal) => avisos.assinar(pontoId, signal);
