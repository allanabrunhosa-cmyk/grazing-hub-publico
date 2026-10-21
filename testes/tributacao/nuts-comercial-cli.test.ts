import { describe, expect, it, vi } from "vitest";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
const cli = vi.hoisted(() => ({ banco: null as unknown, salvarGrupo: null as unknown }));
vi.mock("@/lib/prisma", () => ({ get bancoPrincipal() { return cli.banco; } }));
vi.mock("@/lib/vendas/persistencia", () => ({ get salvarGrupoNaTransacao() { return cli.salvarGrupo; } }));
import { argumentosNuts, criarPlanoCorrecaoNuts, executarCliNuts, executarTransacaoNuts, IDENTIDADES_NUTS, type DependenciasCorrecaoNuts, type SnapshotNuts } from "../../scripts/estrutura-fiscal-nuts-comercial";

const ids = { grupoId: "grupo-ficticio", opcaoId: "opcao-ficticia", aliasId: "alias-ficticio", principalId: "principal-ficticio", insumoId: "insumo-ficticio" };
function fixture(): SnapshotNuts {
  return { grupo: { id: ids.grupoId, nome: "Grupo fictício", tipo: "COMPLEMENTAR", categoriaId: null, ativo: true, minimo: 0, maximo: 99, repetir: true, versao: 3 }, opcoes: [
    { id: "outra-ficticia", grupoId: ids.grupoId, nome: "Outro adicional fictício", preco: "27.00", produtoId: "outro-produto", quantidade: "1", composicao: null, usarPrecoPadrao: false, ordem: 0, ativo: true },
    { id: ids.opcaoId, grupoId: ids.grupoId, nome: "Porção fictícia120g", preco: "45.00", produtoId: ids.aliasId, quantidade: "1", composicao: [{ insumoId: ids.insumoId, unidade: "KG", quantidade: "0.12", exibirFicha: true, porcao: null, observacaoPorcao: null }], usarPrecoPadrao: false, ordem: 1, ativo: true }
  ], produtos: [
    { id: ids.aliasId, preco: "45.00", unidade: "UN", ativo: false, versao: 4, classificacoes: ["OPCAO"] },
    { id: ids.principalId, preco: "12.90", unidade: "UN", ativo: true, versao: 7, classificacoes: ["PRINCIPAL"] },
    { id: "outro-produto", preco: "27.00", unidade: "UN", ativo: true, versao: 1, classificacoes: ["PRINCIPAL"] }
  ], insumoNuts: { id: ids.insumoId, unidade: "KG", ativo: true, excluidoEm: null } };
}
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
function bancoFicticio(inicial = fixture()) {
  let estado = clone(inicial), eventos: unknown[] = [], papel = "ADMINISTRADOR", versao = 2;
  const salvar = vi.fn();
  const tx = { $queryRaw: vi.fn(async () => []), usuario: { findUnique: vi.fn(async () => ({ id: "admin-ficticio", nome: "Autor fictício", ativo: true, excluidoEm: null, sessaoVersao: versao, perfilAcesso: { sistema: papel } })) }, historicoCadastroVenda: { findMany: vi.fn(async () => eventos) } } as unknown as Prisma.TransactionClient;
  const deps: DependenciasCorrecaoNuts = { fotografar: async () => clone(estado), salvarGrupo: async (_tx, entrada, autor) => {
    salvar(entrada, autor); const dto = entrada as SnapshotNuts["grupo"] & { opcoes: Omit<SnapshotNuts["opcoes"][number], "grupoId" | "ordem">[] };
    const antes = { ...estado.grupo, opcoes: clone(estado.opcoes) };
    estado.grupo = { ...dto, versao: dto.versao + 1 }; delete (estado.grupo as unknown as { opcoes?: unknown }).opcoes;
    estado.opcoes = dto.opcoes.map((o, ordem) => ({ ...o, ordem, grupoId: dto.id }));
    eventos.push({ usuarioId: autor.userId, antes, depois: { ...estado.grupo, opcoes: clone(estado.opcoes) } });
  } };
  const cliente = { $transaction: async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) => { const anterior = clone(estado), h = clone(eventos); try { return await cb(tx); } catch (e) { estado = anterior; eventos = h; throw e; } } } as unknown as Pick<PrismaClient, "$transaction">;
  return { cliente, deps, salvar, get estado() { return estado; }, get eventos() { return eventos; }, negar: () => { papel = "OPERADOR"; }, revogar: () => { versao++; }, alterarPreco: () => { estado.produtos[0].preco = "99.00"; } };
}
const autor = { userId: "admin-ficticio", versao: 2 };
describe("Correção Nuts: fixtures inteiramente fictícias, sem banco externo", () => {
  it("muda somente a referência da opção e congela o mesmo valor comercial", () => {
    const original = fixture(), copia = clone(original), p = criarPlanoCorrecaoNuts(original, ids);
    expect(original).toEqual(copia); expect(p.evidencias).toMatchObject({ precoEfetivoAntes: "45.00", precoEfetivoDepois: "45.00", quantidadeEstoqueKg: "0.12" });
    expect(p.depois.opcoes[1]).toEqual({ ...p.antes.opcoes[1], produtoId: null, usarPrecoPadrao: false });
    expect(p.depois.opcoes[0]).toEqual(p.antes.opcoes[0]); expect(p.depois.produtos).toEqual(p.antes.produtos);
    expect(p.depois.grupo.versao).toBe(4); expect(p.hashPlano).toHaveLength(64);
  });
  it("preserva preço efetivo quando a opção herda preço do alias", () => { const e = fixture(); e.opcoes[1].usarPrecoPadrao = true; e.opcoes[1].preco = "13.00"; e.produtos[0].preco = "47.90"; const p = criarPlanoCorrecaoNuts(e, ids); expect(p.depois.opcoes[1].preco).toBe("47.90"); expect(p.depois.opcoes[1].usarPrecoPadrao).toBe(false); });
  it.each(["0.055", "0.13"])('nega massa física divergente %s', q => { const e = fixture(); (e.opcoes[1].composicao as { quantidade: string }[])[0].quantidade = q; expect(() => criarPlanoCorrecaoNuts(e, ids)).toThrow(/120g/); });
  it("nega reordenamento implícito, fonte ativa e principal inativo", () => {
    const e = fixture(); e.opcoes[0].ordem = 4; expect(() => criarPlanoCorrecaoNuts(e, ids)).toThrow(/Ordem/);
    const f = fixture(); f.produtos[0].ativo = true; expect(() => criarPlanoCorrecaoNuts(f, ids)).toThrow(/referência/);
    const g = fixture(); g.produtos[1].ativo = false; expect(() => criarPlanoCorrecaoNuts(g, ids)).toThrow(/referência/);
  });
  it("prévia chama serviço e reverte estado e histórico integralmente", async () => { const b = bancoFicticio(), antes = clone(b.estado), p = criarPlanoCorrecaoNuts(antes, ids); const r = await executarTransacaoNuts(b.cliente, p, autor, false, undefined, b.deps); expect(r.aplicado).toBe(false); expect(b.salvar).toHaveBeenCalledOnce(); expect(b.estado).toEqual(antes); expect(b.eventos).toEqual([]); });
  it("aplica uma vez e reenvio idempotente exige prova histórica do mesmo autor", async () => { const b = bancoFicticio(), p = criarPlanoCorrecaoNuts(b.estado, ids); await executarTransacaoNuts(b.cliente, p, autor, true, p.hashPlano, b.deps); const r = await executarTransacaoNuts(b.cliente, p, autor, true, p.hashPlano, b.deps); expect(r.aplicadoAnteriormente).toBe(true); expect(b.salvar).toHaveBeenCalledOnce(); expect(b.eventos).toHaveLength(1); });
  it("nega autor não administrador e sessão revogada antes do serviço", async () => { const b = bancoFicticio(), p = criarPlanoCorrecaoNuts(b.estado, ids); b.negar(); await expect(executarTransacaoNuts(b.cliente, p, autor, true, p.hashPlano, b.deps)).rejects.toThrow(/Administrador/); expect(b.salvar).not.toHaveBeenCalled(); const c = bancoFicticio(); c.revogar(); await expect(executarTransacaoNuts(c.cliente, p, autor, false, undefined, c.deps)).rejects.toThrow(/sessão/); expect(c.salvar).not.toHaveBeenCalled(); });
  it("nega preço/versionamento alterado e hash de plano divergente", async () => { const b = bancoFicticio(), p = criarPlanoCorrecaoNuts(b.estado, ids); b.alterarPreco(); await expect(executarTransacaoNuts(b.cliente, p, autor, true, p.hashPlano, b.deps)).rejects.toThrow(/mudaram/); const c = bancoFicticio(); await expect(executarTransacaoNuts(c.cliente, p, autor, true, "f".repeat(64), c.deps)).rejects.toThrow(/mudaram/); expect(c.salvar).not.toHaveBeenCalled(); });
  it("reverte se o serviço tocar outra opção", async () => { const b = bancoFicticio(), antes = clone(b.estado), p = criarPlanoCorrecaoNuts(antes, ids), original = b.deps.salvarGrupo; b.deps.salvarGrupo = async (...args) => { await original(...args); b.estado.opcoes[0].preco = "99.00"; }; await expect(executarTransacaoNuts(b.cliente, p, autor, true, p.hashPlano, b.deps)).rejects.toThrow(/além/); expect(b.estado).toEqual(antes); expect(b.eventos).toEqual([]); });
  it("dry-run é padrão e apply conflita com dry-run explícito", () => { expect(argumentosNuts(["--entrada=.tmp/fiscal/ficticio.json", "--usuario-id=admin-ficticio"]).aplicar).toBe(false); expect(() => argumentosNuts(["--apply", "--dry-run", "--entrada=ficticio", "--usuario-id=admin-ficticio"])).toThrow(); expect(() => argumentosNuts(["--entrada=ficticio"])).toThrow(); });
  it("CLI grava recibo imutável no apply e replay sem falso conflito ou segunda alteração", async () => {
    // Somente identificadores do contrato; todo o conteúdo e o banco são fictícios em memória.
    const substituir = (v: unknown): unknown => Array.isArray(v) ? v.map(substituir) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k,v]) => [k,substituir(v)])) : typeof v === "string" ? Object.entries(ids).find(([,id]) => id === v) ? IDENTIDADES_NUTS[Object.entries(ids).find(([,id]) => id === v)![0] as keyof typeof ids] : v : v;
    const e = substituir(fixture()) as SnapshotNuts, b = bancoFicticio(e), plano = criarPlanoCorrecaoNuts(e);
    const conexao = b.cliente as unknown as Record<string, unknown>;
    const txCli = { $queryRaw: async () => [], usuario: { findUnique: async () => ({ id: autor.userId, nome: "Autor fictício", ativo: true, excluidoEm: null, sessaoVersao: autor.versao, perfilAcesso: { sistema: "ADMINISTRADOR" } }) }, grupoComplementoVenda: { findUniqueOrThrow: async () => ({ ...b.estado.grupo, opcoes: b.estado.opcoes }) }, produtoVenda: { findMany: async () => b.estado.produtos }, insumo: { findUniqueOrThrow: async () => b.estado.insumoNuts }, historicoCadastroVenda: { findMany: async () => b.eventos } } as unknown as Prisma.TransactionClient;
    const transacao = b.cliente.$transaction; conexao.$transaction = async (f: (tx: Prisma.TransactionClient) => Promise<unknown>) => transacao(async () => f(txCli));
    conexao.usuario = { findUniqueOrThrow: async () => ({ id: autor.userId, sessaoVersao: autor.versao }) }; conexao.$disconnect = vi.fn(async () => {});
    cli.banco = conexao; cli.salvarGrupo = b.deps.salvarGrupo;
    const raiz = path.resolve(".tmp/fiscal"), dir = path.join(raiz, `teste-nuts-cli-${randomUUID().replaceAll("-", "")}`);
    if (!dir.startsWith(raiz + path.sep) || !/^teste-nuts-cli-[a-f0-9]{32}$/.test(path.basename(dir))) throw new Error("Diretório fictício fora da área privada.");
    const urlAnterior = process.env.DATABASE_URL, flagAnterior = process.env.CORRECAO_NUTS_COMERCIAL_APLICACAO_AUTORIZADA, codigoAnterior = process.exitCode;
    const stdout = vi.spyOn(console, "log").mockImplementation(() => {}), stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await mkdir(dir, { recursive: true, mode: 0o700 }); await writeFile(path.join(dir,"entrada.json"), JSON.stringify(e)); await writeFile(path.join(dir,"backup.json"), JSON.stringify({ verificado: true, autorizacaoImplantacao: true, hashDump: "a".repeat(64), criadoEm: new Date().toISOString() }));
      process.env.DATABASE_URL = "postgresql://fixture-sem-conexao.invalid/teste"; process.env.CORRECAO_NUTS_COMERCIAL_APLICACAO_AUTORIZADA = "SIM";
      const args = ["--apply", `--entrada=${path.join(dir,"entrada.json")}`, `--usuario-id=${autor.userId}`, `--saida=${path.join(dir,"recibos")}`, `--hash-plano=${plano.hashPlano}`, `--backup-comprovante=${path.join(dir,"backup.json")}`];
      await executarCliNuts(args); expect(JSON.parse(String(stdout.mock.calls.at(-1)![0]))).toMatchObject({ aplicado: true, aplicadoAnteriormente: false, reciboGravado: true, documentosTransmitidos: 0 }); const recibo = await readFile(path.join(dir,"recibos",`recibo-${plano.hashPlano}.json`),"utf8");
      await executarCliNuts(args); expect(JSON.parse(String(stdout.mock.calls.at(-1)![0]))).toMatchObject({ aplicado: false, aplicadoAnteriormente: true, reciboGravado: true, documentosTransmitidos: 0 }); expect(await readFile(path.join(dir,"recibos",`recibo-${plano.hashPlano}.json`),"utf8")).toBe(recibo); expect(JSON.parse(recibo)).toEqual({ hashPlano: plano.hashPlano, hashDepois: plano.hashDepois }); expect(b.salvar).toHaveBeenCalledTimes(2); expect(b.eventos).toHaveLength(1); expect(stderr).not.toHaveBeenCalled(); expect(process.exitCode).toBe(codigoAnterior);
    } finally {
      stdout.mockRestore(); stderr.mockRestore(); cli.banco = null; cli.salvarGrupo = null; if (urlAnterior === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = urlAnterior; if (flagAnterior === undefined) delete process.env.CORRECAO_NUTS_COMERCIAL_APLICACAO_AUTORIZADA; else process.env.CORRECAO_NUTS_COMERCIAL_APLICACAO_AUTORIZADA = flagAnterior; process.exitCode = codigoAnterior;
      // Alvo absoluto validado acima, pertencente exclusivamente à fixture.
      await rm(dir, { recursive: true, force: true });
    }
  });
});
