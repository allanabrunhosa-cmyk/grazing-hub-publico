import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const senha = process.env.ADMIN_PASSWORD;
  const nome = process.env.ADMIN_NOME?.trim() || "Administrador";

  if (!email || !senha) {
    throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD antes de rodar este script.");
  }

  const senhaHash = await hashPassword(senha);
  const perfil = await prisma.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });

  const usuario = await prisma.usuario.upsert({
    where: { email },
    update: { senhaHash, admin: true, ativo: true, nome, perfilAcessoId: perfil.id, permissoesPersonalizadas: {}, excluidoEm: null, sessaoVersao: { increment: 1 } },
    create: { email, senhaHash, admin: true, ativo: true, nome, perfilAcessoId: perfil.id },
  });

  console.log(`Usuário administrador pronto: ${usuario.email} (id: ${usuario.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
