import { ESTADOS_DEMONSTRACAO, PADROES_DESIGN, type EstadoDemonstracao } from "./grupos";
import type { ValoresTemaResolvidos } from "./registro";
import { validarValoresTema } from "./validacao";
import type { IdentidadeInterface } from "../hosts";

export type ConfiguracaoLaboratorio = {
  canal: "grazing-design-lab"; tipo: "configurar";
  identidade: IdentidadeInterface; modo: "claro" | "escuro";
  estado: EstadoDemonstracao; padrao: string; aplicado: boolean; reinicio: number;
  valores: ValoresTemaResolvidos;
};

export function configuracaoPreviaValida(valor: unknown): valor is ConfiguracaoLaboratorio {
  if (!valor || typeof valor !== "object") return false;
  const m = valor as Partial<ConfiguracaoLaboratorio>;
  try { validarValoresTema(m.valores); } catch { return false; }
  return m.canal === "grazing-design-lab" && m.tipo === "configurar"
    && (m.identidade === "hub" || m.identidade === "etiquetas" || m.identidade === "pedidos") && (m.modo === "claro" || m.modo === "escuro")
    && ESTADOS_DEMONSTRACAO.some(e => e === m.estado) && PADROES_DESIGN.some(p => p.id === m.padrao)
    && typeof m.aplicado === "boolean" && Number.isSafeInteger(m.reinicio) && m.reinicio! >= 0;
}
