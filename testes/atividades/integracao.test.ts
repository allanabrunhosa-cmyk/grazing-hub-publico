import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { criarBancoTeste, encerrarBancoTeste, executarBanco } from "./banco-teste";

const consulta = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, sessao: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return consulta.prisma; } }));
vi.mock("@/lib/session", () => ({ getSession: consulta.sessao }));
import { consultarAtividades, consultarDetalheAtividade } from "@/lib/atividades/consulta";

describe.skipIf(!executarBanco)("Atividades — PostgreSQL exclusivo, autoria e integridade", () => {
  let ambiente: Awaited<ReturnType<typeof criarBancoTeste>>;
  const autor = "atividade-autor-sintetico", afetado = "atividade-afetado-sintetico";
  const historico = async (id: string, acao = "Usuário atualizado") => ambiente.banco.query(`
    INSERT INTO "HistoricoAcesso" (id,"autorId",entidade,"entidadeId",acao,antes,depois)
    VALUES ($1,$2,'Usuário',$3,$4,$5::jsonb,$6::jsonb)`, [id, autor, afetado, acao, JSON.stringify({ ativo: true, senhaHash: "segredo-sintetico-nao-copiavel" }), JSON.stringify({ ativo: false, token: "token-sintetico-nao-copiavel" })]);
  beforeAll(async () => {
    ambiente = await criarBancoTeste("integracao");
    await ambiente.banco.query(`INSERT INTO "Usuario" (id,nome,email,"senhaHash",admin,ativo,"updatedAt")
      VALUES ($1,'Autor sintético','autor-atividades@example.invalid','sem-login',true,true,NOW()),
             ($2,'Pessoa afetada sintética','afetada-atividades@example.invalid','sem-login',false,true,NOW())`, [autor, afetado]);
    consulta.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: ambiente.url.toString(), options: `-c search_path=${ambiente.esquema}` }, { schema: ambiente.esquema }) });
    consulta.sessao.mockResolvedValue({ userId: autor, nome: "Autor sintético", email: "autor-atividades@example.invalid", admin: true, versao: 0, permissoes: {}, excecoes: {}, perfilNome: "Administrador" });
    vi.stubEnv("AUTH_SECRET", "segredo-sintetico-cursor-atividades-integracao");
  }, 120_000);
  afterAll(async () => { await consulta.prisma?.$disconnect(); vi.unstubAllEnvs(); await encerrarBancoTeste(ambiente); });

  it("distingue autor e cadastro afetado, data UTC e referência sem duplicar payload", async () => {
    const id = randomUUID(); await historico(id);
    const evento = (await ambiente.banco.query('SELECT * FROM "AtividadeUsuario" WHERE "fonteId"=$1', [id])).rows[0];
    expect(evento).toMatchObject({ autorId: autor, autorNome: "Autor sintético", atorTipo: "USUARIO", usuarioAfetadoId: afetado, modulo: "acessos", origem: "NAO_IDENTIFICADA", resultado: "SUCESSO", fonteTabela: "HistoricoAcesso", fonteId: id, antes: null, depois: null });
    expect(evento.ocorridoEm).toBeInstanceOf(Date);
    expect(JSON.stringify(evento)).not.toContain("segredo-sintetico-nao-copiavel");
    expect(JSON.stringify(evento)).not.toContain("token-sintetico-nao-copiavel");
    const origem = (await ambiente.banco.query('SELECT "createdAt" AT TIME ZONE \'UTC\' AS "createdAt" FROM "HistoricoAcesso" WHERE id=$1', [id])).rows[0];
    expect(evento.ocorridoEm.getTime()).toBe(origem.createdAt.getTime());
  });
  it("rollback da mudança e auditoria não deixa falso sucesso", async () => {
    const id = randomUUID(); await ambiente.banco.query("BEGIN");
    await ambiente.banco.query('UPDATE "Usuario" SET ativo=false WHERE id=$1', [afetado]); await historico(id);
    expect((await ambiente.banco.query('SELECT count(*)::int AS n FROM "AtividadeUsuario" WHERE "fonteId"=$1', [id])).rows[0].n).toBe(1);
    await ambiente.banco.query("ROLLBACK");
    expect((await ambiente.banco.query('SELECT ativo FROM "Usuario" WHERE id=$1', [afetado])).rows[0].ativo).toBe(true);
    expect((await ambiente.banco.query('SELECT count(*)::int AS n FROM "AtividadeUsuario" WHERE "fonteId"=$1', [id])).rows[0].n).toBe(0);
  });
  it("recuperação deduplica fonte/id sem colapsar fatos distintos correlacionados", async () => {
    const ids = [randomUUID(), randomUUID()]; await ambiente.banco.query("BEGIN");
    await ambiente.banco.query("SELECT set_config('grazing.atividade',$1,true)", [JSON.stringify({ origem: "API", correlacaoId: "operacao-sintetica-compartilhada" })]);
    for (const id of ids) await historico(id);
    await ambiente.banco.query("COMMIT");
    await ambiente.banco.query(`SELECT grazing_projetar_atividade('HistoricoAcesso',to_jsonb(h)) FROM "HistoricoAcesso" h WHERE id=ANY($1::text[])`, [ids]);
    const eventos = (await ambiente.banco.query('SELECT * FROM "AtividadeUsuario" WHERE "fonteId"=ANY($1::text[]) ORDER BY "fonteId"', [ids])).rows;
    expect(eventos).toHaveLength(2); expect(new Set(eventos.map(e => e.id)).size).toBe(2);
    expect(eventos.every(e => e.origem === "API" && e.correlacaoId === "operacao-sintetica-compartilhada")).toBe(true);
    const novo = randomUUID(); await historico(novo);
    expect((await ambiente.banco.query('SELECT origem FROM "AtividadeUsuario" WHERE "fonteId"=$1', [novo])).rows[0].origem).toBe("NAO_IDENTIFICADA");
  });
  it("conserva identidade histórica após inativação/exclusão lógica e ausência da entidade", async () => {
    const id = randomUUID(); await historico(id);
    await ambiente.banco.query('UPDATE "Usuario" SET ativo=false,"excluidoEm"=NOW(),nome=\'Nome atual alterado\' WHERE id=$1', [autor]);
    const evento = (await ambiente.banco.query('SELECT "autorId","autorNome","entidadeId" FROM "AtividadeUsuario" WHERE "fonteId"=$1', [id])).rows[0];
    expect(evento).toEqual({ autorId: autor, autorNome: "Autor sintético", entidadeId: afetado });
    await ambiente.banco.query('UPDATE "Usuario" SET ativo=true,"excluidoEm"=NULL,nome=\'Autor sintético\' WHERE id=$1', [autor]);
    const fantasma = randomUUID();
    await ambiente.banco.query(`INSERT INTO "HistoricoCadastroVenda" (id,entidade,"registroId","usuarioId","usuarioNome",depois) VALUES ($1,'PRODUTO','produto-que-nao-existe',$2,'Autor sintético','{"ativo":false}')`, [fantasma, autor]);
    expect((await ambiente.banco.query('SELECT "autorId","entidadeId" FROM "AtividadeUsuario" WHERE "fonteId"=$1', [fantasma])).rows[0]).toEqual({ autorId: autor, entidadeId: "produto-que-nao-existe" });
  });
  it("recuperações concorrentes da mesma fonte retornam um único evento durável", async () => {
    const id = randomUUID();
    await ambiente.banco.query('ALTER TABLE "HistoricoAcesso" DISABLE TRIGGER atividades_projetar_insert');
    try { await historico(id); } finally { await ambiente.banco.query('ALTER TABLE "HistoricoAcesso" ENABLE TRIGGER atividades_projetar_insert'); }
    const concorrentes = [new Client({ connectionString: ambiente.url.toString() }), new Client({ connectionString: ambiente.url.toString() })];
    try {
      for (const cliente of concorrentes) { await cliente.connect(); await cliente.query(`SET search_path TO "${ambiente.esquema}"`); }
      const respostas = await Promise.all(concorrentes.map(cliente => cliente.query(`SELECT grazing_projetar_atividade('HistoricoAcesso',to_jsonb(h)) AS id FROM "HistoricoAcesso" h WHERE id=$1`, [id])));
      expect(respostas[0].rows[0].id).toBe(respostas[1].rows[0].id);
      expect((await ambiente.banco.query('SELECT count(*)::int AS n FROM "AtividadeUsuario" WHERE "fonteId"=$1', [id])).rows[0].n).toBe(1);
    } finally { await Promise.all(concorrentes.map(cliente => cliente.end())); }
  });
  it("MCP projeta somente fatos de negócio validados, preservando autoria e resultado real", async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    await ambiente.banco.query(`INSERT INTO "McpEvento" (id,correlacao,"usuarioId",acao,ferramenta,resultado,"duracaoMs") VALUES
      ($1,'mcp-sintetico',$5,'NEGOCIO_PREPARADO','produtos_editar','OK',1),
      ($2,'mcp-sintetico',$5,'NEGOCIO_EXECUTADO','produtos_editar','ERRO',1),
      ($3,'mcp-sintetico',NULL,'TOKEN_INVALIDO',NULL,'ERRO',1),
      ($4,'mcp-sintetico',$5,'NEGOCIO_APROVADO_HUB','produtos_editar','OK',1)`, [...ids, autor]);
    const eventos = (await ambiente.banco.query('SELECT "autorId","origem","resultado" FROM "AtividadeUsuario" WHERE "fonteId"=ANY($1::text[]) ORDER BY "sequencia"', [ids])).rows;
    expect(eventos).toEqual([{ autorId: autor, origem: "MCP", resultado: "SOLICITADO" }, { autorId: autor, origem: "MCP", resultado: "FALHA" }, { autorId: autor, origem: "INTERFACE", resultado: "SUCESSO" }]);
  });
  it("rotina iFood tem ator integração e não atribui execução autônoma ao administrador legado", async () => {
    const estados: [string | null, string][] = [["CONFIRMADA", "CONFIRMADO"], ["RECUSADA", "NEGADO"], ["FALHA", "FALHA"], ...["PENDENTE", "ENVIANDO", "ENVIADA", "INCERTA", "AGUARDANDO_CONFERENCIA", "INTERVENCAO", "DESCONHECIDO"].map(estado => [estado, "SOLICITADO"] as [string, string]), [null, "SOLICITADO"]];
    for (const [estado, resultado] of estados) {
      const id = randomUUID();
      await ambiente.banco.query(`INSERT INTO "HistoricoCadastroVenda" (id,entidade,"registroId","usuarioId","usuarioNome",depois)
        VALUES ($1,'IFOOD_MERCHANT','loja-sintetica',$2,'Integração iFood',$3::jsonb)`, [id, autor, JSON.stringify({ estado })]);
      expect((await ambiente.banco.query('SELECT "autorId","autorNome","atorTipo","atorReferencia","iniciadorId",origem,resultado FROM "AtividadeUsuario" WHERE "fonteId"=$1', [id])).rows[0])
        .toEqual({ autorId: null, autorNome: null, atorTipo: "INTEGRACAO", atorReferencia: "IFOOD", iniciadorId: null, origem: "AUTOMACAO", resultado });
    }
    for (const [resultado, esperado] of [["CONFIRMADA", "CONFIRMADO"], ["RECUSADA", "NEGADO"], ["ENVIADA", "SOLICITADO"], ["INCERTA", "SOLICITADO"], ["DESCONHECIDO", "SOLICITADO"]]) {
      const id = randomUUID();
      await ambiente.banco.query("SELECT grazing_projetar_atividade('HistoricoPedidoVenda',$1::jsonb)", [JSON.stringify({ id, pedidoId: "pedido-ifood-sintetico", autorId: autor, autorNome: "Integração iFood", tipo: "IFOOD_RECONCILIACAO", createdAt: new Date().toISOString(), depois: { resultado } })]);
      expect((await ambiente.banco.query('SELECT "autorId","atorTipo",resultado FROM "AtividadeUsuario" WHERE "fonteId"=$1', [id])).rows[0]).toEqual({ autorId: null, atorTipo: "INTEGRACAO", resultado: esperado });
    }
  });
  it("recusa UPDATE, DELETE, TRUNCATE inclusive com flag de manutenção sem papel separado", async () => {
    const id = randomUUID(); await historico(id);
    for (const sql of ['UPDATE "AtividadeUsuario" SET resumo=\'Tentativa\' WHERE "fonteId"=$1', 'DELETE FROM "AtividadeUsuario" WHERE "fonteId"=$1']) {
      await expect(ambiente.banco.query(sql, [id])).rejects.toMatchObject({ code: "42501" });
    }
    await expect(ambiente.banco.query('TRUNCATE "AtividadeUsuario"')).rejects.toMatchObject({ code: "42501" });
    await ambiente.banco.query("SELECT set_config('grazing.atividade_manutencao','on',false)");
    await expect(ambiente.banco.query('DELETE FROM "AtividadeUsuario" WHERE "fonteId"=$1', [id])).rejects.toMatchObject({ code: "42501" });
    await ambiente.banco.query("RESET grazing.atividade_manutencao");
    expect((await ambiente.banco.query('SELECT count(*)::int AS n FROM "AtividadeUsuario" WHERE "fonteId"=$1', [id])).rows[0].n).toBe(1);
  });
  it("falha transacional da projeção reverte a operação junto com a evidência", async () => {
    const id = randomUUID(), usuarioNovo = "usuario-rollback-registro";
    await ambiente.banco.query(`ALTER TABLE "AtividadeUsuario" ADD CONSTRAINT atividade_falha_sintetica CHECK (acao <> 'FALHA_REGISTRO')`);
    try {
      await ambiente.banco.query("BEGIN");
      await ambiente.banco.query(`INSERT INTO "Usuario" (id,nome,email,"senhaHash","updatedAt") VALUES ($1,'Rollback sintético','rollback-atividades@example.invalid','sem-login',NOW())`, [usuarioNovo]);
      await expect(historico(id, "FALHA_REGISTRO")).rejects.toMatchObject({ code: "23514" });
      await ambiente.banco.query("ROLLBACK");
      expect((await ambiente.banco.query('SELECT count(*)::int AS n FROM "Usuario" WHERE id=$1', [usuarioNovo])).rows[0].n).toBe(0);
      expect((await ambiente.banco.query('SELECT count(*)::int AS n FROM "HistoricoAcesso" WHERE id=$1', [id])).rows[0].n).toBe(0);
      expect((await ambiente.banco.query('SELECT count(*)::int AS n FROM "AtividadeUsuario" WHERE "fonteId"=$1', [id])).rows[0].n).toBe(0);
    } finally { await ambiente.banco.query("ROLLBACK"); await ambiente.banco.query('ALTER TABLE "AtividadeUsuario" DROP CONSTRAINT atividade_falha_sintetica'); }
  });
  it("não aceita fonte arbitrária nem inventa autoria para registros sem identidade", async () => {
    await expect(ambiente.banco.query("SELECT grazing_projetar_atividade('Usuario',$1::jsonb)", [JSON.stringify({ id: "invalido", createdAt: new Date().toISOString() })])).rejects.toMatchObject({ code: "22023" });
    const r = await ambiente.banco.query("SELECT grazing_projetar_atividade('HistoricoAcesso',$1::jsonb) AS id", [JSON.stringify({ id: "sem-autoria", entidade: "Usuário", entidadeId: afetado, acao: "Usuário atualizado", createdAt: new Date().toISOString() })]);
    expect(r.rows[0].id).toBeNull();
  });
  it("diagnóstico administrativo mede pg_total_relation_size sem ler payloads nem executar retenção", async () => {
    const volumeFontes = async () => (await ambiente.banco.query('SELECT (SELECT count(*)::int FROM "AtividadeUsuario") AS atividades,(SELECT count(*)::int FROM "McpEvento") AS mcp')).rows[0];
    const volumeAntes = await volumeFontes();
    const { stdout } = await promisify(execFile)(process.execPath, ["scripts/atividades-diagnostico.mjs", "--schema", ambiente.esquema, "--contar"], {
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: "test", DATABASE_URL: ambiente.url.toString() }, timeout: 30_000,
    });
    const relatorio = JSON.parse(stdout);
    expect(relatorio.volume.contagemExata).toBe(true);
    expect(relatorio.volume.eventos).toBeGreaterThan(0);
    expect(relatorio.armazenamento.totalBytes).toBeGreaterThan(0);
    expect(relatorio.armazenamento.indicesBytes).toBeGreaterThan(0);
    expect(relatorio.armazenamento.incluiWAL).toBe(false);
    expect(relatorio.armazenamento.incluiBackups).toBe(false);
    expect(relatorio.fontes).toMatchObject({ contagemExata: false, incluiTabelaCentral: false, incluiWAL: false, incluiBackups: false });
    expect(relatorio.fontes.relacoes).toHaveLength(17);
    expect(relatorio.fontes.relacoes.find((fonte: { nome: string }) => fonte.nome === "McpEvento")).toMatchObject({ disponivel: true });
    expect(relatorio.fontes.relacoes.find((fonte: { nome: string }) => fonte.nome === "MovimentacaoEstoque")).toMatchObject({ disponivel: true });
    expect(relatorio.fontes.totais.totalBytes).toBeGreaterThan(0);
    expect(await volumeFontes()).toEqual(volumeAntes);
    expect(relatorio.retencao.expurgoAtivo).toBe(false);
    expect(relatorio.projecoes.map((p: { eventosDiarios: number }) => p.eventosDiarios)).toEqual([1000, 5000, 10000]);
    expect(stdout).not.toContain("segredo-sintetico-nao-copiavel");
    expect(stdout).not.toContain("example.invalid");
    expect((await ambiente.banco.query('SELECT count(*)::int AS n FROM "AtividadeUsuario"')).rows[0].n).toBe(relatorio.volume.eventos);
  });
  it("consulta real pagina 50/50/20 com empate, concorrência/backfill e filtros estáveis", async () => {
    const paginaAutor = "autor-paginacao-sintetico";
    await ambiente.banco.query(`INSERT INTO "Usuario" (id,nome,email,"senhaHash","updatedAt") VALUES ($1,'Autor paginação sintético','paginacao@example.invalid','sem-login',NOW())`, [paginaAutor]);
    await ambiente.banco.query("SELECT set_config('grazing.atividade',$1,false)", [JSON.stringify({ origem: "API", correlacaoId: "paginacao-sintetica" })]);
    try {
      await ambiente.banco.query(`INSERT INTO "HistoricoAcesso" (id,"autorId",entidade,"entidadeId",acao,antes,depois,"createdAt")
        SELECT 'paginacao-'||g::text,$1,'Usuário',$2,'Usuário atualizado','{"ativo":true}','{"ativo":false}',TIMESTAMP '2026-10-09 12:00:00' FROM generate_series(1,120) g`, [paginaAutor, afetado]);
      const filtros = { usuarioId: paginaAutor, de: "2026-10-01", ate: "2026-10-10", modulo: "acessos", acao: "USUARIO_ATUALIZADO", resultado: "SUCESSO", origem: "API" };
      const primeira = await consultarAtividades(filtros);
      expect(primeira.eventos).toHaveLength(50); expect(primeira.proximoCursor).toBeTruthy();
      await ambiente.banco.query(`INSERT INTO "HistoricoAcesso" (id,"autorId",entidade,"entidadeId",acao,depois,"createdAt") VALUES
        ('concorrente-novo',$1,'Usuário',$2,'Usuário atualizado','{"ativo":false}',TIMESTAMP '2026-10-09 12:00:00'),
        ('concorrente-backfill',$1,'Usuário',$2,'Usuário atualizado','{"ativo":false}',TIMESTAMP '2026-10-08 12:00:00')`, [paginaAutor, afetado]);
      const segunda = await consultarAtividades({ ...filtros, cursor: primeira.proximoCursor! });
      const terceira = await consultarAtividades({ ...filtros, cursor: segunda.proximoCursor! });
      expect(segunda.eventos).toHaveLength(50); expect(terceira.eventos).toHaveLength(20); expect(terceira.proximoCursor).toBeNull();
      const ids = [...primeira.eventos, ...segunda.eventos, ...terceira.eventos].map(e => e.id);
      expect(new Set(ids).size).toBe(120);
      const concorrentes = (await ambiente.banco.query('SELECT id FROM "AtividadeUsuario" WHERE "fonteId" IN (\'concorrente-novo\',\'concorrente-backfill\')')).rows.map(e => e.id);
      expect(ids.some(id => concorrentes.includes(id))).toBe(false);
      await expect(consultarAtividades({ ...filtros, origem: "INTERFACE", cursor: primeira.proximoCursor! })).rejects.toMatchObject({ status: 400 });
      expect((await consultarAtividades({ ...filtros, resultado: "FALHA" })).eventos).toHaveLength(0);
      expect((await consultarAtividades({ ...filtros, perspectiva: "cadastro" })).eventos).toHaveLength(0);
    } finally { await ambiente.banco.query("RESET grazing.atividade"); }
  });
  it("consulta real protege lista e detalhes por módulo, retornando somente diferenças permitidas", async () => {
    const fonteId = randomUUID();
    await ambiente.banco.query(`INSERT INTO "HistoricoAcesso" (id,"autorId",entidade,"entidadeId",acao,antes,depois)
      VALUES ($1,$2,'LANCAMENTO_FINANCEIRO','titulo-que-nao-existe','Cancelamento financeiro',
      '{"valor":100,"senhaHash":"segredo-nao-exibir","nome":"Pessoa privada"}',
      '{"valor":200,"token":"token-nao-exibir","nome":"Pessoa privada"}')`, [fonteId, autor]);
    const eventoId = (await ambiente.banco.query('SELECT id FROM "AtividadeUsuario" WHERE "fonteId"=$1', [fonteId])).rows[0].id;
    const adminDetalhe = await consultarDetalheAtividade(autor, eventoId);
    expect(adminDetalhe.alteracoes).toEqual([{ campo: "valor", antes: "100", depois: "200" }]); expect(adminDetalhe.link).toBeNull();
    expect(JSON.stringify(adminDetalhe)).not.toContain("segredo-nao-exibir"); expect(JSON.stringify(adminDetalhe)).not.toContain("Pessoa privada");
    const adminSessao = await consulta.sessao();
    try {
      consulta.sessao.mockResolvedValue({ ...adminSessao, admin: false, permissoes: { "configuracoes.usuarios": ["visualizar"], "configuracoes.usuarios.atividades": ["visualizar"] } });
      const lista = await consultarAtividades({ usuarioId: autor, de: "2026-01-01", ate: "2026-12-31" });
      expect(lista.eventos.some(e => e.id === eventoId)).toBe(false);
      await expect(consultarDetalheAtividade(autor, eventoId)).rejects.toMatchObject({ status: 404 });
      consulta.sessao.mockResolvedValue({ ...adminSessao, admin: false, permissoes: { "configuracoes.usuarios": ["visualizar"] } });
      await expect(consultarAtividades({ usuarioId: autor, de: "2026-01-01", ate: "2026-12-31" })).rejects.toMatchObject({ status: 403 });
      await expect(consultarDetalheAtividade(autor, eventoId)).rejects.toMatchObject({ status: 403 });
      consulta.sessao.mockResolvedValue(null);
      await expect(consultarAtividades({ usuarioId: autor, de: "2026-01-01", ate: "2026-12-31" })).rejects.toMatchObject({ status: 401 });
    } finally { consulta.sessao.mockResolvedValue(adminSessao); }
  });
  it("recuperação simula sem escrita, exige autorização e aplica referências idempotentes sem excluir fontes", async () => {
    const ids = ["recuperacao-a", "recuperacao-b"];
    await ambiente.banco.query('ALTER TABLE "HistoricoAcesso" DISABLE TRIGGER atividades_projetar_insert');
    try { for (const id of ids) await historico(id); } finally { await ambiente.banco.query('ALTER TABLE "HistoricoAcesso" ENABLE TRIGGER atividades_projetar_insert'); }
    const fonteAntes = (await ambiente.banco.query('SELECT id,md5(to_jsonb(h)::text) AS hash FROM "HistoricoAcesso" h WHERE id=ANY($1::text[]) ORDER BY id', [ids])).rows;
    const args = ["scripts/atividades-recuperar.mjs", "--schema", ambiente.esquema, "--fonte", "HistoricoAcesso", "--apos", "recuperacao-", "--limite", "2"];
    const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: "test" as const, DATABASE_URL: ambiente.url.toString() };
    const simulado = JSON.parse((await promisify(execFile)(process.execPath, args, { env, timeout: 30_000 })).stdout);
    expect(simulado).toMatchObject({ modo: "SIMULACAO", lidas: 2, referenciasProjetadasOuJaExistentes: null, proximoCursor: "recuperacao-b" });
    expect((await ambiente.banco.query('SELECT count(*)::int AS n FROM "AtividadeUsuario" WHERE "fonteId"=ANY($1::text[])', [ids])).rows[0].n).toBe(0);
    await expect(promisify(execFile)(process.execPath, [...args, "--aplicar"], { env, timeout: 30_000 })).rejects.toThrow("Aplicação exige autorização operacional explícita");
    const autorizado = { ...env, ATIVIDADES_RECUPERACAO_AUTORIZADA: "SIM" };
    const primeira = JSON.parse((await promisify(execFile)(process.execPath, [...args, "--aplicar"], { env: autorizado, timeout: 30_000 })).stdout);
    const eventoIds = (await ambiente.banco.query('SELECT id FROM "AtividadeUsuario" WHERE "fonteId"=ANY($1::text[]) ORDER BY id', [ids])).rows;
    expect(primeira).toMatchObject({ modo: "APLICACAO_AUTORIZADA", lidas: 2, referenciasProjetadasOuJaExistentes: 2 });
    expect(eventoIds).toHaveLength(2);
    await promisify(execFile)(process.execPath, [...args, "--aplicar"], { env: autorizado, timeout: 30_000 });
    expect((await ambiente.banco.query('SELECT id FROM "AtividadeUsuario" WHERE "fonteId"=ANY($1::text[]) ORDER BY id', [ids])).rows).toEqual(eventoIds);
    expect((await ambiente.banco.query('SELECT id,md5(to_jsonb(h)::text) AS hash FROM "HistoricoAcesso" h WHERE id=ANY($1::text[]) ORDER BY id', [ids])).rows).toEqual(fonteAntes);
  });
});
