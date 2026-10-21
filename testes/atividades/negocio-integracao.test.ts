import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { criarBancoTeste, encerrarBancoTeste, executarBanco } from "./banco-teste";

const estado = vi.hoisted(() => ({ banco: null as unknown as PrismaClient, sessao: {
  userId: "autor-negocio-sintetico", nome: "Autor negócio sintético", email: "autor-negocio@example.invalid", admin: true, versao: 0,
} }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn(async () => estado.sessao) }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn(async () => estado.sessao) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, { get: (_alvo, propriedade) => {
  const valor = Reflect.get(estado.banco, propriedade);
  return typeof valor === "function" ? valor.bind(estado.banco) : valor;
} }) }));

import { saveFornecedorAction, salvarBeneficiarioAction, excluirBeneficiarioAction, deleteFornecedorAction, importFornecedoresAction } from "@/app/(protegido)/fornecedores/actions";
import { alterarStatusFornecedorAction } from "@/app/(protegido)/status-cadastros-actions";
import { saveInsumoAction, importInsumosAction, consultarExclusaoInsumoAction, deleteInsumoAction } from "@/app/(protegido)/insumos/actions";
import { salvarPedidoAction } from "@/app/(protegido)/compras/actions";
import { iniciarContagemAction, salvarItemContagemAction, finalizarContagemAction, excluirContagemAction } from "@/app/(protegido)/inventario/contagem/actions";

function formulario(dados: Record<string, string>) {
  const form = new FormData();
  for (const [chave, valor] of Object.entries(dados)) form.set(chave, valor);
  return form;
}
const serializar = (valor: unknown) => JSON.stringify(valor, (_campo, v) => typeof v === "bigint" ? v.toString() : v);

describe.skipIf(!executarBanco)("Atividades — capturas de negócio e rollback no PostgreSQL sintético", () => {
  let ambiente: Awaited<ReturnType<typeof criarBancoTeste>>;
  const eventos = (id: string) => estado.banco.atividadeUsuario.findMany({ where: { entidadeId: id }, orderBy: { sequencia: "asc" } });
  beforeAll(async () => {
    ambiente = await criarBancoTeste("negocio");
    estado.banco = new PrismaClient({ adapter: new PrismaPg({ connectionString: ambiente.url.toString(), options: `-c search_path=${ambiente.esquema}` }, { schema: ambiente.esquema }) });
    const perfil = await estado.banco.perfilAcesso.findFirstOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    await estado.banco.usuario.createMany({ data: [
      { id: estado.sessao.userId, nome: estado.sessao.nome, email: estado.sessao.email, senhaHash: "sem-login", perfilAcessoId: perfil.id },
      { id: "responsavel-contagem-sintetico", nome: "Responsável sintético", email: "responsavel-contagem@example.invalid", senhaHash: "sem-login" },
    ] });
    await estado.banco.localEstoque.create({ data: { id: "local-negocio", nome: "Local sintético" } });
  }, 120_000);
  afterAll(async () => {
    await estado.banco?.$disconnect();
    await encerrarBancoTeste(ambiente);
  });

  it("captura CRUD de fornecedor/beneficiário com autoria servidor sem dados pessoais", async () => {
    const criado = await saveFornecedorAction({ error: null }, formulario({ nome: "Fornecedor sintético", ativo: "on", email: "privado@example.invalid", telefone: "11999999999", observacoes: "texto-privado-sintetico" }));
    expect(criado.error).toBeNull();
    const id = criado.fornecedor!.id;
    expect(await saveFornecedorAction({ error: null }, formulario({ id, nome: "Fornecedor revisado sintético" }))).toHaveProperty("error", null);
    await deleteFornecedorAction(id);
    expect(await estado.banco.fornecedor.findUnique({ where: { id } })).toBeNull();
    const auditoria = await eventos(id);
    expect(auditoria.map(e => e.acao)).toEqual(["FORNECEDOR_CRIADO", "FORNECEDOR_EDITADO", "FORNECEDOR_EXCLUIDO"]);
    expect(auditoria.every(e => e.autorId === estado.sessao.userId && e.origem === "INTERFACE" && e.resultado === "SUCESSO")).toBe(true);
    expect(auditoria[1]).toMatchObject({ antes: { ativo: true }, depois: { ativo: false } });
    expect(serializar(auditoria)).not.toContain("privado@example.invalid");
    expect(serializar(auditoria)).not.toContain("11999999999");
    expect(serializar(auditoria)).not.toContain("texto-privado-sintetico");
    const beneficiario = await salvarBeneficiarioAction(formulario({ nome: "Beneficiário sintético", ativo: "on" }));
    expect(beneficiario).toHaveProperty("ok", true);
    if (!("ok" in beneficiario)) throw Error(beneficiario.erro);
    const beneficiarioId = beneficiario.beneficiario.id;
    expect(await salvarBeneficiarioAction(formulario({ id: beneficiarioId, nome: "Beneficiário revisado sintético" }))).toHaveProperty("ok", true);
    expect(await excluirBeneficiarioAction(beneficiarioId)).toEqual({ ok: true });
    expect((await eventos(beneficiarioId)).map(e => e.acao)).toEqual(["BENEFICIARIO_CRIADO", "BENEFICIARIO_EDITADO", "BENEFICIARIO_EXCLUIDO"]);
  });
  it("importa fornecedores por linha efetiva e não registra linha rejeitada", async () => {
    const linha = { nome: "Fornecedor importação sintético", razaoSocial: "Razão sintética", cnpj: "12345678000190" };
    expect(await importFornecedoresAction([linha, { nome: "Linha inválida" }])).toMatchObject({ criados: 1, atualizados: 0, erros: [{ linha: 3 }] });
    expect(await importFornecedoresAction([{ ...linha, status: "inativo" }])).toEqual({ criados: 0, atualizados: 1, erros: [] });
    const fornecedor = await estado.banco.fornecedor.findUniqueOrThrow({ where: { cnpj: linha.cnpj } });
    const auditoria = await eventos(fornecedor.id);
    expect(auditoria.map(e => e.acao)).toEqual(["FORNECEDOR_IMPORTADO_CRIADO", "FORNECEDOR_IMPORTADO_EDITADO"]);
    expect(auditoria[1]).toMatchObject({ antes: { ativo: true }, depois: { ativo: false } });
    expect(serializar(auditoria)).not.toContain(linha.cnpj);
  });
  it("status concorrente igual gera um fato real; repetir sem alteração não cria atividade", async () => {
    const fornecedor = await estado.banco.fornecedor.create({ data: { nome: "Fornecedor status sintético" } });
    expect(await Promise.all([alterarStatusFornecedorAction(fornecedor.id, false), alterarStatusFornecedorAction(fornecedor.id, false)])).toEqual([{ ok: true }, { ok: true }]);
    expect(await alterarStatusFornecedorAction(fornecedor.id, false)).toEqual({ ok: true });
    expect(await eventos(fornecedor.id)).toMatchObject([{ acao: "INATIVACAO", autorId: estado.sessao.userId, antes: { ativo: true }, depois: { ativo: false } }]);
  });
  it("insumo preserva referência da exclusão, diferenças permitidas e idempotência", async () => {
    const criado = await saveInsumoAction({ error: null }, formulario({ nome: "Insumo atividade sintético", unidade: "KG", tipo: "INSUMO", ativo: "on" }));
    expect(criado.error).toBeNull();
    const id = criado.insumoId!;
    expect(await saveInsumoAction({ error: null }, formulario({ id, nome: "Insumo atividade sintético", unidade: "KG", tipo: "INSUMO" }))).toHaveProperty("error", null);
    expect(await importInsumosAction([{ nome: "Insumo atividade sintético", unidade: "KG", status: "ativo" }])).toEqual({ criados: 0, atualizados: 1, erros: [] });
    const previa = (await consultarExclusaoInsumoAction(id)).vinculos!.revisao;
    expect(await deleteInsumoAction(id, previa)).toEqual({ error: null });
    expect(await deleteInsumoAction(id, previa)).toEqual({ error: null });
    const auditoria = await eventos(id);
    expect(auditoria.map(e => e.acao)).toEqual(["INSUMO_CRIADO", "INSUMO_EDITADO", "INSUMO_IMPORTADO_EDITADO", "INSUMO_EXCLUIDO"]);
    expect(auditoria[1]).toMatchObject({ antes: { ativo: true }, depois: { ativo: false } });
    expect(auditoria[3]).toMatchObject({ antes: null, depois: null, deduplicacao: `insumo-excluido:${id}` });
    const excluido = await estado.banco.insumo.findUniqueOrThrow({ where: { id } });
    expect(excluido.exclusaoSnapshot).toMatchObject({ autorId: estado.sessao.userId });
    expect(serializar(auditoria)).not.toContain("exclusaoSnapshot");
  });
  it("criação/edição de compra registra data efetiva da atividade sem movimentar estoque", async () => {
    const entrada = { fornecedorId: null, fornecedorAvulso: "Loja avulsa sintética", usoConsumo: true, previsaoEntrega: "2026-10-12", observacoes: null,
      itens: [{ insumoId: null, descricao: "Papel sintético", quantidade: 2, unidadeCompra: "UN" as const, precoUnitario: 5 }] };
    const movimentos = await estado.banco.movimentacaoEstoque.count();
    const criado = await salvarPedidoAction(entrada);
    expect(criado).toHaveProperty("ok", true);
    if (!("ok" in criado)) throw Error(criado.erro);
    expect(await salvarPedidoAction({ ...entrada, pedidoId: criado.pedidoId, previsaoEntrega: "2026-10-13" })).toHaveProperty("ok", true);
    const auditoria = await eventos(criado.pedidoId);
    expect(auditoria.map(e => e.acao)).toEqual(["COMPRA_CRIADA", "COMPRA_EDITADA"]);
    expect(auditoria[1]).toMatchObject({ antes: { dataEntrega: new Date("2026-10-12T12:00:00").toISOString() }, depois: { dataEntrega: new Date("2026-10-13T12:00:00").toISOString() } });
    expect(await estado.banco.movimentacaoEstoque.count()).toBe(movimentos);
  });
  it("contagem usa autor da ação ao editar/finalizar/estornar e nunca o responsável alheio", async () => {
    const insumo = await estado.banco.insumo.create({ data: { nome: "Insumo contagem sintético", unidade: "KG" } });
    await estado.banco.saldoEstoque.create({ data: { insumoId: insumo.id, localId: "local-negocio", quantidadeAtual: 10 } });
    const criada = await iniciarContagemAction("local-negocio", { tipo: "ITENS", insumoIds: [insumo.id] });
    if (!("contagemId" in criada)) throw Error(criada.erro);
    const id = criada.contagemId;
    await estado.banco.inventarioContagem.update({ where: { id }, data: { responsavelId: "responsavel-contagem-sintetico" } });
    const item = await estado.banco.inventarioItem.findFirstOrThrow({ where: { contagemId: id } });
    expect(await salvarItemContagemAction(item.id, 12)).toEqual({ ok: true });
    expect(await salvarItemContagemAction(item.id, 12)).toEqual({ ok: true });
    expect(await finalizarContagemAction(id)).toEqual({ ok: true, ajustes: 1 });
    expect(await excluirContagemAction(id, { confirmarEstorno: true, motivo: "Correção sintética de contagem" })).toEqual({ ok: true });
    const auditoria = (await eventos(id)).filter(e => e.recurso === "inventario.contagem");
    expect(auditoria.map(e => e.acao)).toEqual(["CONTAGEM_INICIADA", "CONTAGEM_ITEM_ALTERADO", "CONTAGEM_FINALIZADA", "CONTAGEM_CANCELADA_COM_ESTORNO"]);
    expect(auditoria.every(e => e.autorId === estado.sessao.userId)).toBe(true);
    expect(auditoria[1]).toMatchObject({ antes: { quantidade: null }, depois: { quantidade: "12" } });
    expect(Number((await estado.banco.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: "local-negocio" } } })).quantidadeAtual)).toBe(10);
  });
  it("falha de persistência da atividade reverte o cadastro sem falso sucesso", async () => {
    await ambiente.banco.query(`CREATE FUNCTION falhar_atividade_negocio_teste() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.acao='FORNECEDOR_CRIADO' THEN RAISE EXCEPTION 'Falha sintética de atividade'; END IF; RETURN NEW; END; $$;
      CREATE TRIGGER falha_atividade_negocio_teste BEFORE INSERT ON "AtividadeUsuario" FOR EACH ROW EXECUTE FUNCTION falhar_atividade_negocio_teste()`);
    try {
      expect(await saveFornecedorAction({ error: null }, formulario({ nome: "Fornecedor rollback sintético", ativo: "on" }))).toHaveProperty("error", expect.any(String));
      expect(await estado.banco.fornecedor.count({ where: { nome: "FORNECEDOR ROLLBACK SINTÉTICO" } })).toBe(0);
    } finally {
      await ambiente.banco.query('DROP TRIGGER falha_atividade_negocio_teste ON "AtividadeUsuario"; DROP FUNCTION falhar_atividade_negocio_teste()');
    }
  });
});
