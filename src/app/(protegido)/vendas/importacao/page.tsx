import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { ImportacaoCatalogo } from "./importacao-client";

export default async function ImportacaoPage() {
  await exigirPermissao("vendas.importacao");
  await exigirPermissao("vendas.produtos");
  await exigirPermissao("vendas.catalogo");
  const permissoes = await Promise.all([
    podeAcessar("vendas.importacao", "adicionar"), podeAcessar("vendas.produtos", "adicionar"),
    podeAcessar("vendas.produtos", "editar"), podeAcessar("vendas.catalogo", "adicionar"), podeAcessar("vendas.catalogo", "editar"),
  ]);
  return <ImportacaoCatalogo aplicar={permissoes.every(Boolean)} />;
}
