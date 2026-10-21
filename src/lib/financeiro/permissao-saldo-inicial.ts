import "server-only";
import { podeAcessar } from "@/lib/permissoes/servidor";
export async function podeEditarSaldoInicial(): Promise<boolean> { return podeAcessar("financeiro.saldo", "editar"); }
