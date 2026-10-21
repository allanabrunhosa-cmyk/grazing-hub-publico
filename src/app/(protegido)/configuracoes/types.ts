export type CertificadoInfo = {
  arquivoNome: string;
  titular: string | null;
  validoAte: string | null;
  // Calculado no servidor (Server Component) no momento da renderização — evita
  // chamar Date.now() dentro do componente client, que o lint de pureza do React proíbe.
  diasParaVencer: number | null;
  atualizadoPorNome: string | null;
  updatedAt: string;
} | null;
