
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { prisma } from "@/lib/prisma";
import { EntradaAvulsaForm } from "@/app/(protegido)/inventario/entrada-avulsa/entrada-avulsa-form";
import type { InsumoOption, LocalOption } from "@/app/(protegido)/inventario/types";
import type { ContaBancariaOption, FornecedorOption } from "@/app/(protegido)/financeiro/types";
import { permissaoEfetiva } from "@/lib/permissoes/catalogo";
import type { CartaoOption } from "@/lib/financeiro/cartoes";

export default async function EntradaAvulsaPage({
  searchParams,
}: {
  searchParams: Promise<{ insumoId?: string }>;
}) {
  const sessao = await exigirPermissao("inventario.entrada");
  const pode = (recurso: string) => sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, recurso, "adicionar");
  const { insumoId } = await searchParams;

  const [insumos, locais, fornecedores, contasBancarias, cartoes] = await Promise.all([
    prisma.insumo.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, especificacao: true, unidade: true, custoMedio: true },
    }),
    prisma.localEstoque.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.fornecedor.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.contaBancaria.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.cartaoCredito.findMany({
      where: { ativo: true, contaBancaria: { ativo: true } },
      include: { contaBancaria: { select: { nome: true } } },
      orderBy: { nome: "asc" },
    }),
  ]);

  const insumosOptions: InsumoOption[] = insumos.map((i) => ({ ...i, custoMedio: Number(i.custoMedio) }));
  const locaisOptions: LocalOption[] = locais;
  const fornecedoresOptions: FornecedorOption[] = fornecedores;
  const contasOptions: ContaBancariaOption[] = contasBancarias;
  const cartoesOptions: CartaoOption[] = cartoes.map((cartao) => ({
    id: cartao.id,
    nome: cartao.nome,
    contaBancariaId: cartao.contaBancariaId,
    contaBancariaNome: cartao.contaBancaria.nome,
    diaFechamento: cartao.diaFechamento,
    diaVencimento: cartao.diaVencimento,
    ativo: cartao.ativo,
  }));

  return (
    <EntradaAvulsaForm
      insumos={insumosOptions}
      locais={locaisOptions}
      fornecedores={fornecedoresOptions}
      contasBancarias={contasOptions}
      cartoes={cartoesOptions}
      insumoIdPreselecionado={insumoId ?? null}
      podeCadastrarFornecedor={pode("fornecedores")}
      podeCadastrarInsumo={pode("insumos")}
    />
  );
}
