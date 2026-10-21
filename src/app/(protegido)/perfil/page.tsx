import { redirect } from "next/navigation";
import { BarraAcoes } from "@/components/padroes-operacionais";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { PerfilForm } from "@/app/(protegido)/perfil/perfil-form";

export default async function PerfilPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.userId },
    select: { id: true, nome: true, email: true, fotoData: true },
  });
  if (!usuario) redirect("/login");

  return (
    <div className="mx-auto max-w-xl space-y-1">
      <BarraAcoes titulo="Meu Perfil" descricao="Gerencie suas informações pessoais e segurança da conta." />
      <div className="pt-4">
        <PerfilForm usuario={{ id: usuario.id, nome: usuario.nome, email: usuario.email, temFoto: usuario.fotoData !== null }} />
      </div>
    </div>
  );
}
