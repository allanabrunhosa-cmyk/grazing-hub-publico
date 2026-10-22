import { redirect } from "next/navigation";
import { exigirPermissao } from "@/lib/permissoes/servidor";
export default async function CoberturaFiscalPage() { await exigirPermissao("vendas.fiscal"); return redirect("/financeiro/fiscal/vinculos"); }
