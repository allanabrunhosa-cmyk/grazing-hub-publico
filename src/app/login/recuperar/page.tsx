import { PainelAcesso } from "../painel-acesso";
import { SolicitarRecuperacaoForm } from "../recuperacao-form";
import { identidadeDaInterface } from "@/lib/contexto-interface";

export async function generateMetadata() {
  const identidade = await identidadeDaInterface();
  return { title: `Recuperar senha | ${identidade === "pedidos" ? "Grazing Pedidos" : identidade === "etiquetas" ? "Grazing Validades" : "Grazing HUB"}`, robots: { index: false, follow: false }, referrer: "no-referrer" as const };
}
export default function RecuperarSenhaPage() {
  return <PainelAcesso titulo="Esqueceu sua senha?" descricao="Informe o e-mail da sua conta para receber um link de recuperação."><SolicitarRecuperacaoForm /></PainelAcesso>;
}
