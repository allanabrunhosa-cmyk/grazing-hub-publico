import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

function obterIdentificadorDeploy() {
  if (process.env.NEXT_DEPLOYMENT_ID) return process.env.NEXT_DEPLOYMENT_ID;

  try {
    return readFileSync(".next-deployment-id", "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
}

const nextConfig: NextConfig = {
  // Ações administrativas podem receber segredos. O Next não deve registrar seus argumentos.
  logging: { serverFunctions: false, browserToTerminal: false },
  redirects() {
    // O cadastro antigo na raiz continua em Grupos; os destinos nunca retornam a Vendas.
    return [
      { source: "/financeiro/fiscal/numeracao", destination: "/financeiro/fiscal/configuracoes", permanent: true },
      { source: "/vendas/fiscal/regras-brasilnfe/:path*", destination: "/financeiro/fiscal/regras-brasilnfe/:path*", permanent: true },
      { source: "/vendas/fiscal/cobertura/:path*", destination: "/financeiro/fiscal/cobertura/:path*", permanent: true },
      { source: "/vendas/fiscal/vinculos/:path*", destination: "/financeiro/fiscal/vinculos/:path*", permanent: true },
      { source: "/vendas/fiscal/grupos/:path*", destination: "/financeiro/fiscal/grupos/:path*", permanent: true },
      { source: "/vendas/fiscal/:path*", destination: "/financeiro/fiscal/grupos/:path*", permanent: true },
    ];
  },
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  deploymentId: obterIdentificadorDeploy(),
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
