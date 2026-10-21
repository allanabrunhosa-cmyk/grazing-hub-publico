import { PainelAcesso } from "../painel-acesso";
import { RedefinirSenhaForm } from "../recuperacao-form";
import { identidadeDaInterface } from "@/lib/contexto-interface";

export async function generateMetadata() {
  const identidade = await identidadeDaInterface();
  return { title: `Redefinir senha | ${identidade === "pedidos" ? "Grazing Pedidos" : identidade === "etiquetas" ? "Grazing Validades" : "Grazing HUB"}`, robots: { index: false, follow: false }, referrer: "no-referrer" as const };
}
export default function RedefinirSenhaPage() {
  return <PainelAcesso titulo="Crie sua nova senha" descricao="Escolha uma senha exclusiva para proteger sua conta."><RedefinirSenhaForm /></PainelAcesso>;
}
