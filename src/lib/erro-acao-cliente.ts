"use client";

import { unstable_isUnrecognizedActionError } from "next/navigation";
import { toast } from "sonner";

/**
 * O Next invalida os identificadores das Server Actions quando uma nova versão
 * entra no ar. Uma aba aberta antes do deploy não consegue executar a ação, mas
 * a tentativa também não chega à regra de negócio no servidor.
 */
export function mostrarErroPaginaDesatualizada(erro: unknown): boolean {
  if (!unstable_isUnrecognizedActionError(erro)) return false;

  toast.error("A página ficou desatualizada", {
    description: "O sistema foi atualizado enquanto esta tela estava aberta. Esta tentativa não foi processada. Atualize a página e tente novamente.",
    duration: 15000,
    action: {
      label: "Atualizar página",
      onClick: () => window.location.reload(),
    },
  });
  return true;
}
