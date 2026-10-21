import { createRoot } from "react-dom/client";
import { PainelAcesso } from "@/app/login/painel-acesso";
import { LoginForm } from "@/app/login/login-form";
import { SolicitarRecuperacaoForm, RedefinirSenhaForm } from "@/app/login/recuperacao-form";
import "@/app/globals.css";
const etapa = new URLSearchParams(location.search).get("etapa");
if (etapa === "redefinir" && !location.hash) history.replaceState(null, "", `${location.href}#${"a".repeat(43)}`);
createRoot(document.getElementById("root")!).render(<PainelAcesso titulo={etapa === "recuperar" ? "Esqueceu sua senha?" : etapa === "redefinir" ? "Crie sua nova senha" : "Bem-vindo de volta"} descricao={etapa === "recuperar" ? "Informe o e-mail da sua conta para receber um link de recuperação." : etapa === "redefinir" ? "Escolha uma senha exclusiva para proteger sua conta." : "Entre com sua conta para acessar sua operação."}>{etapa === "recuperar" ? <SolicitarRecuperacaoForm /> : etapa === "redefinir" ? <RedefinirSenhaForm /> : <LoginForm />}</PainelAcesso>);
