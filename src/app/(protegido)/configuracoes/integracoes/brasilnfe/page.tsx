import { redirect } from "next/navigation";
import { exigirPermissao } from "@/lib/permissoes/servidor";
export default async function BrasilNfePage() { await exigirPermissao("configuracoes.brasilnfe"); return redirect("/financeiro/fiscal/configuracoes#emissor"); }
