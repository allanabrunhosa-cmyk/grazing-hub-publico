import "server-only";
import { decifrarIfood } from "./tokens";
import { horariosPedidoIfood } from "./horarios";

export function horariosSnapshotIfood(cifra: string | undefined, fuso: string) {
  if (!cifra) return null;
  const snapshot = decifrarIfood(cifra);
  const registro = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot as Record<string, unknown> : null;
  const criadoEm = typeof registro?.createdAt === "string" ? new Date(registro.createdAt) : null;
  return { ...horariosPedidoIfood(snapshot, fuso), criadoEm: criadoEm && Number.isFinite(criadoEm.getTime()) ? criadoEm : null };
}
