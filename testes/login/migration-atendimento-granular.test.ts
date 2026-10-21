import { expect, it } from "vitest";
import { Client } from "pg";
import { readFile } from "node:fs/promises";
import { CAPACIDADES_ATENDIMENTO, type CapacidadeAtendimento, type CapacidadeLegadaAtendimento } from "@/lib/permissoes/atendimento";
import { permissaoEfetiva, type Excecoes, type Permissoes } from "@/lib/permissoes/catalogo";

const executar = process.env.LOGIN_BANCO_TESTE === "1";
const marker = "atendimento-permissoes-granulares-20261013";
const acaoMigration = "DESMEMBRAR_PERMISSOES_ATENDIMENTO";
type Legado = Record<CapacidadeLegadaAtendimento, boolean>;
type Caso = { id: string; perfil: string | null; excecoes?: Excecoes; legado: Legado; overrides?: Partial<Record<CapacidadeAtendimento, boolean>>; admin?: boolean; excluido?: boolean };
const legado = (consultar: boolean, atender = false, configurar = false): Legado => ({ consultar, atender, configurar, conhecimento: configurar });

async function preparar(projecao = false) {
  const url = new URL(process.env.DATABASE_URL!);
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw Error("Somente banco local.");
  const schema = `teste_atendimento_granular_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const integracao = `${schema}_int`, papel = `${schema}_leitor`;
  if (!/^teste_atendimento_granular_\d+_[a-f0-9]+$/.test(schema)) throw Error("Schema inválido.");
  const banco = new Client({ connectionString: url.toString() });
  await banco.connect();
  await banco.query("BEGIN");
  try {
    await banco.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema};
      CREATE TABLE "PerfilAcesso" (id text PRIMARY KEY,sistema text,permissoes jsonb NOT NULL DEFAULT '{}',"updatedAt" timestamp NOT NULL DEFAULT now());
      CREATE TABLE "Usuario" (id text PRIMARY KEY,nome text,email text,"senhaHash" text,ativo boolean,"excluidoEm" timestamp,"sessaoVersao" integer NOT NULL DEFAULT 0,"perfilAcessoId" text,"permissoesPersonalizadas" jsonb NOT NULL DEFAULT '{}',"senhaDefinida" boolean,"emailVerificadoEm" timestamp,"updatedAt" timestamp NOT NULL DEFAULT now());
      CREATE TABLE "HistoricoAcesso" (id text PRIMARY KEY,"autorId" text,entidade text,"entidadeId" text,acao text,antes jsonb,depois jsonb,"createdAt" timestamp NOT NULL DEFAULT now());
      CREATE TABLE "McpEvento" (id text PRIMARY KEY,correlacao text,acao text,resultado text,"duracaoMs" integer,registros text[],"createdAt" timestamp NOT NULL DEFAULT now());
      CREATE SCHEMA ${integracao}; CREATE ROLE ${papel};
      CREATE VIEW ${integracao}.identidade WITH (security_barrier=true) AS
        SELECT u.id,u.nome,u.email,u."senhaHash",u.ativo,(u."excluidoEm" IS NOT NULL) AS excluido,u."sessaoVersao",u."perfilAcessoId" AS "perfilId",p.sistema AS "perfilSistema",p.permissoes,u."permissoesPersonalizadas" AS excecoes,u."senhaDefinida",u."emailVerificadoEm"
        FROM "Usuario" u LEFT JOIN "PerfilAcesso" p ON p.id=u."perfilAcessoId" WHERE false;
      REVOKE ALL ON ${integracao}.identidade FROM PUBLIC; GRANT SELECT ON ${integracao}.identidade TO ${papel};`);
    if (projecao) await banco.query(`
      CREATE TABLE "DelegacoesTeste" (id serial PRIMARY KEY,fonte text,registro jsonb);
      CREATE TABLE "AtividadeUsuario" (id text PRIMARY KEY DEFAULT md5(random()::text),"ocorridoEm" timestamptz,"autorId" text,"autorNome" text,"atorTipo" text,"atorReferencia" text,origem text,modulo text,recurso text,acao text,entidade text,"entidadeId" text,"usuarioAfetadoId" text,resumo text,resultado text,categoria text,"correlacaoId" text,"fonteTabela" text,"fonteId" text,UNIQUE("fonteTabela","fonteId"));
      CREATE FUNCTION grazing_projetar_atividade(fonte text,registro jsonb) RETURNS text LANGUAGE plpgsql AS $$ BEGIN
        INSERT INTO "DelegacoesTeste"(fonte,registro) VALUES(fonte,registro); RETURN 'delegado:'||fonte; END $$;
      CREATE FUNCTION grazing_atividade_apos_auditoria() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        PERFORM grazing_projetar_atividade(TG_TABLE_NAME,to_jsonb(NEW)); RETURN NEW; END $$;
      CREATE TRIGGER atividade_teste AFTER INSERT ON "HistoricoAcesso" FOR EACH ROW EXECUTE FUNCTION grazing_atividade_apos_auditoria();`);
    const migration = (await readFile("prisma/migrations/20261013170000_atendimento_permissoes_granulares/migration.sql", "utf8"))
      .replace(/^BEGIN;\r?$/m, "").replace(/^COMMIT;\r?$/m, "").replaceAll("atendimento_integracao", integracao);
    return { banco, migration, integracao, papel };
  } catch (erro) { await banco.query("ROLLBACK"); await banco.end(); throw erro; }
}

async function inserirPerfil(banco: Client, id: string, permissoes: Permissoes, sistema: string | null = null) {
  await banco.query('INSERT INTO "PerfilAcesso"(id,sistema,permissoes) VALUES($1,$2,$3)', [id, sistema, JSON.stringify(permissoes)]);
}
async function inserirUsuario(banco: Client, caso: Pick<Caso, "id" | "perfil" | "excecoes" | "excluido">) {
  await banco.query('INSERT INTO "Usuario"(id,nome,email,"senhaHash",ativo,"excluidoEm","perfilAcessoId","permissoesPersonalizadas","senhaDefinida","emailVerificadoEm") VALUES($1,$2,$3,$4,true,$5,$6,$7,true,now())',
    [caso.id, "Pessoa fictícia confidencial", `${caso.id}@example.invalid`, "hash-ficticio-nao-copiar", caso.excluido ? new Date() : null, caso.perfil, JSON.stringify(caso.excecoes ?? {})]);
}
function consultaLegada(base: Permissoes, excecoes: Excecoes) {
  const fino = Object.hasOwn(base, "crm.atendimento") || Object.hasOwn(excecoes["crm.atendimento"] ?? {}, "visualizar");
  return permissaoEfetiva(base, excecoes, fino ? "crm.atendimento" : "crm", "visualizar");
}
function atendeLegado(base: Permissoes, excecoes: Excecoes) {
  const fino = Object.hasOwn(base, "crm.atendimento") || Object.hasOwn(excecoes["crm.atendimento"] ?? {}, "visualizar") || Object.hasOwn(excecoes["crm.atendimento"] ?? {}, "editar");
  return consultaLegada(base, excecoes) && permissaoEfetiva(base, excecoes, fino ? "crm.atendimento" : "crm", "editar");
}
function depois(base: Permissoes, excecoes: Excecoes, capacidade: CapacidadeAtendimento, admin = false) {
  if (admin) return true;
  if (!consultaLegada(base, excecoes)) return false;
  if (capacidade === "consultar") return true;
  if (capacidade === "atender") return atendeLegado(base, excecoes);
  const { recurso, acao } = CAPACIDADES_ATENDIMENTO[capacidade];
  return permissaoEfetiva(base, excecoes, recurso, acao);
}
async function snapshot(banco: Client) {
  const perfis = await banco.query('SELECT * FROM "PerfilAcesso" ORDER BY id');
  const usuarios = await banco.query('SELECT * FROM "Usuario" ORDER BY id');
  const historico = await banco.query('SELECT * FROM "HistoricoAcesso" ORDER BY id');
  const eventos = await banco.query('SELECT * FROM "McpEvento" ORDER BY id');
  return { perfis: perfis.rows, usuarios: usuarios.rows, historico: historico.rows, eventos: eventos.rows };
}

it.skipIf(!executar)("migration preserva 38 capacidades, decisões anteriores, sessões, readiness e grants sem expor dados pessoais", async () => {
  const { banco, migration, integracao, papel } = await preparar();
  try {
    const perfis: Record<string, Permissoes> = {
      consulta: { crm: ["visualizar"] }, atender: { crm: ["visualizar", "editar"] },
      configurar: { crm: ["visualizar"], "crm.atendimento.configuracoes": ["visualizar", "editar"] },
      vazio: {}, "config-sem-ver": { crm: ["visualizar"], "crm.atendimento.configuracoes": ["editar"] },
      "fino-ver": { crm: ["visualizar", "editar"], "crm.atendimento": ["visualizar"] },
      "fino-editar": { crm: [], "crm.atendimento": ["visualizar", "editar"] },
      "fino-negado": { crm: ["visualizar", "editar"], "crm.atendimento": [] },
      "novo-vazio": { crm: ["visualizar", "editar"], "crm.atendimento.mensagens": [] },
      "novo-definido": { crm: ["visualizar", "editar"], "crm.atendimento.mensagens": ["visualizar", "adicionar"] },
      admin: {},
    };
    for (const [id, permissoes] of Object.entries(perfis)) await inserirPerfil(banco, id, permissoes, id === "admin" ? "ADMINISTRADOR" : null);
    const casos: Caso[] = [
      { id: "consulta", perfil: "consulta", legado: legado(true) },
      { id: "atender", perfil: "atender", legado: legado(true, true) },
      { id: "configurar", perfil: "configurar", legado: legado(true, false, true) },
      { id: "config-sem-ver", perfil: "config-sem-ver", legado: legado(true), overrides: { "configuracao.visualizar": false } },
      { id: "sem-perfil", perfil: null, legado: legado(false) },
      { id: "sem-acesso", perfil: "vazio", legado: legado(false) },
      { id: "veto-base-false", perfil: "vazio", excecoes: { crm: { visualizar: false } }, legado: legado(false) },
      { id: "fino-ver", perfil: "fino-ver", legado: legado(true) },
      { id: "fino-editar", perfil: "fino-editar", legado: legado(true, true) },
      { id: "fino-negado", perfil: "fino-negado", legado: legado(false) },
      { id: "veto-consulta", perfil: "atender", excecoes: { crm: { visualizar: false } }, legado: legado(false) },
      { id: "veto-atender", perfil: "atender", excecoes: { crm: { editar: false } }, legado: legado(true) },
      { id: "veto-ja-negado", perfil: "consulta", excecoes: { crm: { editar: false } }, legado: legado(true) },
      { id: "extra-atender", perfil: "consulta", excecoes: { crm: { editar: true } }, legado: legado(true, true) },
      { id: "extra-sem-perfil", perfil: null, excecoes: { crm: { visualizar: true, editar: true } }, legado: legado(true, true) },
      { id: "fine-veto", perfil: "atender", excecoes: { "crm.atendimento": { visualizar: false } }, legado: legado(false) },
      { id: "fine-extra", perfil: "vazio", excecoes: { "crm.atendimento": { visualizar: true, editar: true } }, legado: legado(true, true) },
      { id: "fine-editar-sem-ver", perfil: "atender", excecoes: { "crm.atendimento": { editar: true } }, legado: legado(true) },
      { id: "extra-config", perfil: "consulta", excecoes: { "crm.atendimento.configuracoes": { visualizar: true, editar: true } }, legado: legado(true, false, true) },
      { id: "config-extra-sem-ver", perfil: "consulta", excecoes: { "crm.atendimento.configuracoes": { editar: true } }, legado: legado(true), overrides: { "configuracao.visualizar": false } },
      { id: "config-veto", perfil: "configurar", excecoes: { "crm.atendimento.configuracoes": { editar: false } }, legado: legado(true) },
      { id: "novo-vazio", perfil: "novo-vazio", legado: legado(true, true), overrides: { "mensagens.visualizar": false, "mensagens.adicionar": false } },
      { id: "novo-veto", perfil: "novo-definido", excecoes: { "crm.atendimento.mensagens": { adicionar: false } }, legado: legado(true, true), overrides: { "mensagens.adicionar": false } },
      { id: "novo-sem-ver", perfil: "atender", excecoes: { "crm.atendimento.mensagens": { adicionar: true } }, legado: legado(true, true), overrides: { "mensagens.visualizar": false, "mensagens.adicionar": false } },
      { id: "novo-extra", perfil: "consulta", excecoes: { "crm.atendimento.notas": { visualizar: true, adicionar: true } }, legado: legado(true), overrides: { "notas.adicionar": true } },
      { id: "admin", perfil: "admin", excecoes: { "crm.atendimento": { visualizar: false } }, legado: legado(true, true, true), admin: true },
      { id: "excluido", perfil: "atender", legado: legado(true, true), excluido: true },
    ];
    for (const caso of casos) await inserirUsuario(banco, caso);
    const ownerAntes = (await banco.query(`SELECT relowner FROM pg_class WHERE oid='${integracao}.identidade'::regclass`)).rows[0].relowner;
    await banco.query(migration);
    const linhas = (await banco.query('SELECT u.id,u."sessaoVersao",u."permissoesPersonalizadas" AS excecoes,p.permissoes FROM "Usuario" u LEFT JOIN "PerfilAcesso" p ON p.id=u."perfilAcessoId"')).rows;
    expect(Object.keys(CAPACIDADES_ATENDIMENTO)).toHaveLength(38);
    for (const caso of casos) {
      const linha = linhas.find(l => l.id === caso.id)!;
      for (const [capacidade, metadados] of Object.entries(CAPACIDADES_ATENDIMENTO)) {
        const nome = capacidade as CapacidadeAtendimento;
        const esperado = caso.overrides?.[nome] ?? caso.legado[metadados.origemLegada];
        expect(depois(linha.permissoes ?? {}, linha.excecoes, nome, caso.admin), `${caso.id}: ${capacidade}`).toBe(esperado);
      }
      expect(linha.sessaoVersao).toBe(caso.id === "admin" || caso.id === "sem-perfil" ? 0 : 1);
    }
    expect(linhas.find(l => l.id === "novo-vazio")!.permissoes["crm.atendimento.mensagens"]).toEqual([]);
    expect(linhas.find(l => l.id === "novo-veto")!.excecoes["crm.atendimento.mensagens"]).toEqual({ adicionar: false });
    expect(linhas.find(l => l.id === "novo-sem-ver")!.excecoes["crm.atendimento.mensagens"]).toEqual({ adicionar: true, visualizar: false });
    expect(linhas.find(l => l.id === "config-extra-sem-ver")!.excecoes["crm.atendimento.configuracoes"]).toEqual({ editar: true, visualizar: false });
    expect(linhas.find(l => l.id === "veto-ja-negado")!.excecoes["crm.atendimento.notas"].adicionar).toBe(false);
    expect(linhas.find(l => l.id === "veto-base-false")!.excecoes["crm.atendimento.notas"].visualizar).toBe(false);
    const view = (await banco.query(`SELECT id,"permissoesGranulares" FROM ${integracao}.identidade ORDER BY id`)).rows;
    expect(view.map(l => l.id)).toEqual(casos.filter(c => c.legado.consultar && !c.excluido).map(c => c.id).sort());
    expect(view.every(l => l.permissoesGranulares === true)).toBe(true);
    expect((await banco.query(`SELECT has_table_privilege('${papel}','${integracao}.identidade','SELECT') AS permitido`)).rows[0].permitido).toBe(true);
    const classe = (await banco.query(`SELECT relowner,reloptions FROM pg_class WHERE oid='${integracao}.identidade'::regclass`)).rows[0];
    expect(classe.relowner).toBe(ownerAntes); expect(classe.reloptions).toContain("security_barrier=true");
    const primeiro = await snapshot(banco);
    expect(primeiro.eventos).toHaveLength(1); expect(primeiro.eventos[0]).toMatchObject({ id: marker, acao: acaoMigration });
    expect(primeiro.historico.length).toBeGreaterThan(0);
    const auditoria = JSON.stringify({ historico: primeiro.historico, eventos: primeiro.eventos });
    for (const segredo of ["@example.invalid", "hash-ficticio-nao-copiar", "Pessoa fictícia confidencial", "senhaHash"]) expect(auditoria).not.toContain(segredo);
    await banco.query(migration); expect(await snapshot(banco)).toEqual(primeiro);
    await inserirPerfil(banco, "perfil-posterior", { crm: ["visualizar", "editar"] });
    await inserirUsuario(banco, { id: "posterior", perfil: "perfil-posterior" });
    const posterior = await snapshot(banco);
    await banco.query(migration); expect(await snapshot(banco)).toEqual(posterior);
    const novo = posterior.usuarios.find(u => u.id === "posterior")!;
    expect(depois({ crm: ["visualizar", "editar"] }, novo.permissoesPersonalizadas, "mensagens.adicionar")).toBe(false);
    await banco.query('UPDATE "PerfilAcesso" SET permissoes=permissoes||$1::jsonb WHERE id=$2', [JSON.stringify({ "crm.atendimento.notas": ["visualizar", "adicionar"] }), "consulta"]);
    const futuro = (await banco.query('SELECT p.permissoes,u."permissoesPersonalizadas" AS excecoes FROM "Usuario" u JOIN "PerfilAcesso" p ON p.id=u."perfilAcessoId" WHERE u.id=$1', ["veto-ja-negado"])).rows[0];
    expect(futuro.permissoes["crm.atendimento.notas"]).toContain("adicionar");
    expect(depois(futuro.permissoes, futuro.excecoes, "notas.adicionar")).toBe(false);
  } finally { await banco.query("ROLLBACK"); await banco.end(); }
}, 30_000);

it.skipIf(!executar)("projeção da migration usa SISTEMA, preserva usuário afetado e não duplica atividade", async () => {
  const { banco, migration } = await preparar(true);
  try {
    await inserirPerfil(banco, "consulta", { crm: ["visualizar"] });
    await inserirUsuario(banco, { id: "extra", perfil: "consulta", excecoes: { crm: { editar: true } } });
    await banco.query(migration);
    const historico = (await banco.query('SELECT * FROM "HistoricoAcesso" ORDER BY id')).rows;
    const atividades = (await banco.query('SELECT * FROM "AtividadeUsuario" ORDER BY id')).rows;
    expect(historico.length).toBeGreaterThan(1); expect(atividades).toHaveLength(historico.length);
    for (const atividade of atividades) {
      expect(atividade).toMatchObject({ autorId: null, autorNome: null, atorTipo: "SISTEMA", atorReferencia: "MIGRACAO_ATENDIMENTO", origem: "AUTOMACAO", fonteTabela: "HistoricoAcesso", correlacaoId: "migration:atendimento" });
      expect(atividade.usuarioAfetadoId).toBe(atividade.entidade === "Usuário" ? "extra" : null);
    }
    const usuario = historico.find(h => h.entidade === "Usuário")!;
    expect(usuario).toBeTruthy();
    const primeiro = await banco.query('SELECT grazing_projetar_atividade($1,$2::jsonb) AS id', ["HistoricoAcesso", JSON.stringify(usuario)]);
    const segundo = await banco.query('SELECT grazing_projetar_atividade($1,$2::jsonb) AS id', ["HistoricoAcesso", JSON.stringify(usuario)]);
    expect(primeiro.rows[0].id).toBe(segundo.rows[0].id);
    expect((await banco.query('SELECT count(*)::int AS total FROM "AtividadeUsuario"')).rows[0].total).toBe(atividades.length);
    await banco.query(migration);
    expect((await banco.query('SELECT * FROM "AtividadeUsuario" ORDER BY id')).rows).toEqual(atividades);
    expect((await banco.query('SELECT count(*)::int AS total FROM "DelegacoesTeste"')).rows[0].total).toBe(0);
  } finally { await banco.query("ROLLBACK"); await banco.end(); }
}, 30_000);

it.skipIf(!executar)("wrapper preserva a função anterior para auditorias comuns e outras fontes", async () => {
  const { banco, migration } = await preparar(true);
  try {
    await banco.query(migration);
    const registros = [
      { fonte: "HistoricoAcesso", registro: { id: "normal", autorId: "pessoa-ficticia", acao: "Usuário atualizado", entidade: "Usuário" } },
      { fonte: "OutraAuditoria", registro: { id: "outra", autorId: "migration:atendimento", acao: acaoMigration, antes: { situacao: "anterior" } } },
    ];
    for (const { fonte, registro } of registros) {
      expect((await banco.query('SELECT grazing_projetar_atividade($1,$2::jsonb) AS id', [fonte, JSON.stringify(registro)])).rows[0].id).toBe(`delegado:${fonte}`);
    }
    expect((await banco.query('SELECT fonte,registro FROM "DelegacoesTeste" ORDER BY id')).rows).toEqual(registros);
    expect((await banco.query('SELECT count(*)::int AS total FROM "AtividadeUsuario"')).rows[0].total).toBe(0);
  } finally { await banco.query("ROLLBACK"); await banco.end(); }
}, 30_000);
