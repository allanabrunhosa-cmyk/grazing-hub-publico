/** O máximo pertence à soma das quantidades do grupo, não a cada opção. */
export function limiteQuantidadeEscolha(opcoes: { id: string }[], escolhas: Record<string, number>, opcaoId: string, maximo: number | null, repetir: boolean) {
  const outras = opcoes.reduce((soma, opcao) => soma + (opcao.id === opcaoId ? 0 : escolhas[opcao.id] ?? 0), 0);
  return Math.max(0, Math.min(1000, repetir ? 1000 : 1, maximo === null ? 1000 : maximo - outras));
}
