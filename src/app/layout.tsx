import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { identidadeDaInterface } from "@/lib/contexto-interface";
import { gerarCssTema } from "@/lib/design-system/gerar-css";
import { obterTemaPublicado } from "@/lib/design-system/servico";

export async function generateMetadata(): Promise<Metadata> {
  const identidade = await identidadeDaInterface();
  return {
    title: identidade === "pedidos" ? "Grazing Pedidos" : identidade === "etiquetas" ? "Grazing Validades" : "Grazing HUB",
    description: identidade === "pedidos" ? "Gestor de pedidos, by Grazing Table & Co" : identidade === "etiquetas"
      ? "Controle de validades, by Grazing Table & Co"
      : "Gestão de suprimentos do Grazing HUB, by Grazing Table & Co",
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [identidade, tema] = await Promise.all([identidadeDaInterface(), obterTemaPublicado()]);
  return (
    <html
      lang="pt-BR"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head><style id="tema-publicado-design">{gerarCssTema(tema.valores)}</style></head>
      <body data-identidade={identidade === "hub" ? undefined : identidade} className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
