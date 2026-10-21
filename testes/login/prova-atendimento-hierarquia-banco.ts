import assert from "node:assert/strict";
import { Client } from "pg";
import { CAPACIDADES_ATENDIMENTO, NOVAS_CAPACIDADES_ATENDIMENTO, type CapacidadeAtendimento } from "../../src/lib/permissoes/atendimento";
import { resolverPermissoesAtendimento } from "../../src/lib/permissoes/atendimento-resolucao";
import type { Excecoes, Permissoes } from "../../src/lib/permissoes/catalogo";

const marcador = "atendimento-permissoes-hierarquia-20261021";
type Perfil = { id: string; permissoes: Permissoes; sistema?: string };
type Pessoa = { id: string; perfil: string | null; excecoes?: Excecoes; excluido?: boolean; ativo?: boolean };
type Linha = { id: string; permissoes: Permissoes | null; excecoes: Excecoes; perfilSistema: string | null; sessaoVersao: number; updatedAt: Date };
const bases: Perfil[] = [
  { id: "vazio", permissoes: { financeiro: ["visualizar"] } },
  { id: "consulta", permissoes: { crm: ["visualizar"], "vendas.produtos": ["visualizar"] } },
  { id: "atende", permissoes: { crm: ["visualizar", "editar"], "crm.atendimento.mensagens": ["visualizar", "adicionar"], "crm.atendimento.contatos": ["visualizar"], "crm.atendimento.modelos": ["visualizar"] } },
  { id: "configura", permissoes: { crm: ["visualizar", "editar"], "crm.atendimento.contatos": ["visualizar"], "crm.atendimento.mensagens": ["visualizar", "adicionar"], "crm.atendimento.configuracoes": ["visualizar", "editar"], "crm.atendimento.modelos": ["visualizar"] } },
  { id: "sem-mensagens", permissoes: { crm: ["visualizar", "editar"], "crm.atendimento.contatos": ["visualizar"], "crm.atendimento.mensagens": [] } },
  { id: "sem-contatos", permissoes: { crm: ["visualizar", "editar"], "crm.atendimento.contatos": [], "crm.atendimento.mensagens": ["visualizar", "adicionar"] } },
  { id: "config-sem-ver", permissoes: { crm: ["visualizar", "editar"], "crm.atendimento.configuracoes": ["editar"], "crm.atendimento.modelos": ["visualizar"] } },
  { id: "alias", permissoes: { crm: [], "crm.atendimento": ["visualizar", "editar"], "crm.atendimento.contatos": ["visualizar"], "crm.atendimento.mensagens": ["visualizar", "adicionar"] } },
  { id: "alias-negado", permissoes: { crm: ["visualizar", "editar"], "crm.atendimento": [] } },
  { id: "granular-vazio", permissoes: { crm: ["visualizar", "editar"], "crm.atendimento.modelos": [] } },
  { id: "legado-total", permissoes: { crm: ["visualizar", "editar"], "crm.atendimento.configuracoes": ["visualizar", "editar"] } },
  { id: "admin", sistema: "ADMINISTRADOR", permissoes: {} },
];
const pessoas: Pessoa[] = [
  ...bases.map(p => ({ id: `p-${p.id}`, perfil: p.id })),
  { id: "sem-perfil", perfil: null },
  { id: "extra-sem-perfil", perfil: null, excecoes: { crm: { visualizar: true, editar: true } } },
  { id: "veto-entrada", perfil: "configura", excecoes: { crm: { visualizar: false } } },
  { id: "veto-atender", perfil: "configura", excecoes: { crm: { editar: false } } },
  { id: "veto-sem-concessao", perfil: "consulta", excecoes: { crm: { editar: false } } },
  { id: "extra-atender", perfil: "consulta", excecoes: { crm: { editar: true } } },
  { id: "veto-config", perfil: "configura", excecoes: { "crm.atendimento.configuracoes": { editar: false } } },
  { id: "veto-modelos", perfil: "configura", excecoes: { "crm.atendimento.modelos": { visualizar: false } } },
  { id: "veto-mensagem", perfil: "configura", excecoes: { "crm.atendimento.mensagens": { adicionar: false } } },
  { id: "veto-contatos", perfil: "configura", excecoes: { "crm.atendimento.contatos": { visualizar: false } } },
  { id: "extra-contatos", perfil: "sem-contatos", excecoes: { "crm.atendimento.contatos": { visualizar: true } } },
  { id: "extra-config", perfil: "atende", excecoes: { "crm.atendimento.configuracoes": { visualizar: true, editar: true } } },
  { id: "fino-veto", perfil: "atende", excecoes: { "crm.atendimento": { visualizar: false } } },
  { id: "fino-editar-sem-ver", perfil: "atende", excecoes: { "crm.atendimento": { editar: true } } },
  { id: "crm-veto-ignorado-alias", perfil: "alias", excecoes: { crm: { visualizar: false, editar: false } } },
  { id: "crm-extra-ignorado-alias", perfil: "alias-negado", excecoes: { crm: { visualizar: true, editar: true } } },
  { id: "alias-extra", perfil: "consulta", excecoes: { "crm.atendimento": { visualizar: true, editar: true } } },
  { id: "excluida", perfil: "atende", excluido: true },
  { id: "inativa", perfil: "atende", ativo: false },
];

export const DDL_MINIMA_ATENDIMENTO_HIERARQUIA = `
 CREATE TABLE "PerfilAcesso"(id text PRIMARY KEY,sistema text,permissoes jsonb NOT NULL DEFAULT '{}',"updatedAt" timestamp NOT NULL DEFAULT '2026-01-01');
 CREATE TABLE "Usuario"(id text PRIMARY KEY,nome text,email text,"senhaHash" text,ativo boolean,"excluidoEm" timestamp,"sessaoVersao" integer NOT NULL DEFAULT 7,"perfilAcessoId" text,"permissoesPersonalizadas" jsonb NOT NULL DEFAULT '{}',"senhaDefinida" boolean,"emailVerificadoEm" timestamp,"updatedAt" timestamp NOT NULL DEFAULT '2026-01-01');
 CREATE TABLE "HistoricoAcesso"(id text PRIMARY KEY,"autorId" text,entidade text,"entidadeId" text,acao text,antes jsonb,depois jsonb,"createdAt" timestamp NOT NULL DEFAULT now());
 CREATE TABLE "McpEvento"(id text PRIMARY KEY,correlacao text,acao text,resultado text,"duracaoMs" integer,registros text[],"createdAt" timestamp NOT NULL DEFAULT now());
 CREATE TABLE "DelegacoesTeste"(id serial PRIMARY KEY,fonte text,registro jsonb);
 CREATE TABLE "AtividadeUsuario"(id text PRIMARY KEY DEFAULT md5(random()::text),"ocorridoEm" timestamptz,"autorId" text,"autorNome" text,"atorTipo" text,"atorReferencia" text,origem text,modulo text,recurso text,acao text,entidade text,"entidadeId" text,"usuarioAfetadoId" text,resumo text,resultado text,categoria text,"correlacaoId" text,"fonteTabela" text,"fonteId" text,UNIQUE("fonteTabela","fonteId"));
 CREATE FUNCTION grazing_projetar_atividade(fonte text,registro jsonb) RETURNS text LANGUAGE plpgsql AS $$ BEGIN INSERT INTO "DelegacoesTeste"(fonte,registro) VALUES(fonte,registro); RETURN 'delegado:'||fonte; END $$;
 CREATE FUNCTION grazing_atividade_apos_auditoria() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM grazing_projetar_atividade(TG_TABLE_NAME,to_jsonb(NEW)); RETURN NEW; END $$;
 CREATE TRIGGER atividade_teste AFTER INSERT ON "HistoricoAcesso" FOR EACH ROW EXECUTE FUNCTION grazing_atividade_apos_auditoria();
`;

async function ler(banco: Client): Promise<Linha[]> {
  return (await banco.query(`SELECT u.id,p.permissoes,u."permissoesPersonalizadas" AS excecoes,p.sistema AS "perfilSistema",u."sessaoVersao",u."updatedAt"
    FROM "Usuario" u LEFT JOIN "PerfilAcesso" p ON p.id=u."perfilAcessoId" ORDER BY u.id`)).rows;
}
async function snapshot(banco: Client) {
  const resultado = [];
  for (const tabela of ["PerfilAcesso", "Usuario", "HistoricoAcesso", "McpEvento", "AtividadeUsuario"])
    resultado.push((await banco.query(`SELECT * FROM "${tabela}" ORDER BY id`)).rows);
  return resultado;
}
function efetivas(linha: Linha, granulares: boolean, hierarquia: boolean) {
  return resolverPermissoesAtendimento({ ...linha, permissoesGranulares: granulares, permissoesHierarquia: hierarquia });
}
async function preparar(banco: Client, sinal: boolean | "ausente" | "inusitado") {
  const sufixo = `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  const schema = `teste_atendimento_hierarquia_${sufixo}`, integracao = `${schema}_int`, papel = `${schema}_leitor`;
  assert.match(schema, /^teste_atendimento_hierarquia_\d+_[a-f0-9]+$/);
  await banco.query("BEGIN");
  await banco.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema}; ${DDL_MINIMA_ATENDIMENTO_HIERARQUIA}
    CREATE SCHEMA ${integracao}; CREATE ROLE ${papel};
    CREATE VIEW ${integracao}.identidade WITH(security_barrier=true) AS SELECT u.id,u.nome,u.email,u."senhaHash",u.ativo,(u."excluidoEm" IS NOT NULL) AS excluido,
      u."sessaoVersao",u."perfilAcessoId" AS "perfilId",p.sistema AS "perfilSistema",p.permissoes,u."permissoesPersonalizadas" AS excecoes,u."senhaDefinida",u."emailVerificadoEm"
      ${sinal === "ausente" ? "" : `,${sinal === "inusitado" ? "(u.ativo AND true)" : sinal ? "true" : "false"} AS "permissoesGranulares"`}
      FROM "Usuario" u LEFT JOIN "PerfilAcesso" p ON p.id=u."perfilAcessoId" WHERE u."excluidoEm" IS NULL AND (p.sistema='ADMINISTRADOR' OR
        CASE WHEN (p.permissoes ? 'crm.atendimento') OR ((u."permissoesPersonalizadas"->'crm.atendimento') ? 'visualizar')
        THEN COALESCE((u."permissoesPersonalizadas"->'crm.atendimento'->>'visualizar')::boolean,(p.permissoes->'crm.atendimento') ? 'visualizar',false)
        ELSE COALESCE((u."permissoesPersonalizadas"->'crm'->>'visualizar')::boolean,(p.permissoes->'crm') ? 'visualizar',false) END);
    REVOKE ALL ON ${integracao}.identidade FROM PUBLIC; GRANT SELECT ON ${integracao}.identidade TO ${papel};`);
  for (const p of bases) await banco.query('INSERT INTO "PerfilAcesso"(id,sistema,permissoes) VALUES($1,$2,$3)', [p.id, p.sistema ?? null, JSON.stringify(p.permissoes)]);
  for (const p of pessoas) await banco.query('INSERT INTO "Usuario"(id,nome,email,"senhaHash",ativo,"excluidoEm","perfilAcessoId","permissoesPersonalizadas","senhaDefinida","emailVerificadoEm") VALUES($1,$2,$3,$4,$5,$6,$7,$8,true,now())',
    [p.id, "Pessoa fictícia confidencial", `${p.id}@example.invalid`, "hash-ficticio-nao-copiar", p.ativo ?? true, p.excluido ? new Date() : null, p.perfil, JSON.stringify(p.excecoes ?? {})]);
  return { schema, integracao, papel };
}

/** Prova transacional. Não lê .env, não envia rede e remove apenas seus schemas/roles por ROLLBACK. */
export async function provarAtendimentoHierarquia({ url, sql, conferencia }: { url: string; sql: string; conferencia?: string }) {
  const destino = new URL(url);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(destino.hostname), "Somente PostgreSQL localhost isolado.");
  const banco = new Client({ connectionString: url });
  await banco.connect();
  let cenarios = 0, comparacoes = 0;
  const migration = (integracao: string) => sql.replace(/^BEGIN;\r?$/m, "").replace(/^COMMIT;\r?$/m, "").replaceAll("atendimento_integracao", integracao);
  try {
    for (const sinal of [true, false, "ausente"] as const) {
      const { integracao, papel } = await preparar(banco, sinal);
      try {
        const g = sinal === true, antes = await ler(banco), esperadas = new Map(antes.map(p => [p.id, efetivas(p, g, false)]));
        const viewAntes = (await banco.query(`SELECT relowner,relacl,reloptions FROM pg_class WHERE oid='${integracao}.identidade'::regclass`)).rows[0];
        const idsAntes = (await banco.query(`SELECT id FROM ${integracao}.identidade ORDER BY id`)).rows;
        const resumoAntes = conferencia ? (await banco.query(conferencia.replaceAll("atendimento_integracao", integracao))).rows[0] : null;
        await banco.query(migration(integracao));
        const depois = await ler(banco);
        for (const linha of depois) {
          assert.deepEqual(efetivas(linha, g, true).sort(), esperadas.get(linha.id)!.sort(), `${sinal}:${linha.id}`);
          assert.equal(linha.sessaoVersao, 7, "A migração não deve encerrar sessões humanas.");
          comparacoes += Object.keys(CAPACIDADES_ATENDIMENTO).length;
        }
        assert.deepEqual((await banco.query(`SELECT id FROM ${integracao}.identidade ORDER BY id`)).rows, idsAntes, "Filtro da view precisa permanecer igual.");
        assert.deepEqual((await banco.query(`SELECT relowner,relacl,reloptions FROM pg_class WHERE oid='${integracao}.identidade'::regclass`)).rows[0], viewAntes);
        assert.equal((await banco.query(`SELECT has_table_privilege('${papel}','${integracao}.identidade','SELECT') AS pode`)).rows[0].pode, true);
        assert.equal((await banco.query(`SELECT bool_and("permissoesHierarquia") AS pronto FROM ${integracao}.identidade`)).rows[0].pronto, true);
        if (resumoAntes && conferencia) {
          const resumoDepois = (await banco.query(conferencia.replaceAll("atendimento_integracao", integracao))).rows[0];
          for (const campo of Object.keys(resumoAntes).filter(c => c.endsWith("_sha256"))) assert.equal(resumoDepois[campo], resumoAntes[campo], `Conferência privada: ${campo}`);
          assert.equal(Number(resumoDepois.capacidades_por_identidade), 57);
          assert.equal(resumoDepois.hierarquia, true);
        }
        const colunas = (await banco.query(`SELECT attname FROM pg_attribute WHERE attrelid='${integracao}.identidade'::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum`)).rows;
        assert.equal(colunas.at(-1).attname, "permissoesHierarquia");
        const snap = await snapshot(banco), [perfisDepois, , historico, eventos, atividades] = snap;
        assert.equal(eventos.length, 1); assert.equal(eventos[0].id, marcador); assert.ok(eventos[0].registros.includes("sessoes-preservadas"));
        assert.ok(historico.length > 0); assert.equal(atividades.length, historico.length);
        for (const atividade of atividades) {
          assert.equal(atividade.autorId, null); assert.equal(atividade.atorTipo, "SISTEMA");
          assert.equal(atividade.atorReferencia, "MIGRACAO_ATENDIMENTO"); assert.equal(atividade.fonteTabela, "HistoricoAcesso");
        }
        for (const segredo of ["@example.invalid", "hash-ficticio-nao-copiar", "Pessoa fictícia confidencial", "senhaHash"])
          assert.ok(!JSON.stringify({ historico, eventos, atividades }).includes(segredo));
        for (const perfil of bases) {
          const posterior = perfisDepois.find(p => p.id === perfil.id)!;
          if (perfil.sistema !== "ADMINISTRADOR") {
            const capacidadesPerfil = resolverPermissoesAtendimento({ permissoes: perfil.permissoes, permissoesGranulares: g });
            assert.equal(posterior.permissoes.crm.includes("visualizar"), capacidadesPerfil.includes("consultar"));
            assert.equal(posterior.permissoes.crm.includes("editar"), capacidadesPerfil.includes("atender"));
          }
          assert.deepEqual(posterior.permissoes["crm.atendimento"], perfil.permissoes["crm.atendimento"]);
          assert.deepEqual(posterior.permissoes.financeiro, perfil.permissoes.financeiro);
          assert.deepEqual(posterior.permissoes["vendas.produtos"], perfil.permissoes["vendas.produtos"]);
        }
        await banco.query(migration(integracao)); assert.deepEqual(await snapshot(banco), snap, "Reexecução precisa preservar dados, auditoria e versões.");
        await banco.query('INSERT INTO "PerfilAcesso"(id,permissoes) VALUES($1,$2)', ["posterior", JSON.stringify({ crm: ["visualizar", "editar"] })]);
        const semChaves = resolverPermissoesAtendimento({ permissoes: { crm: ["visualizar", "editar"] }, permissoesGranulares: g, permissoesHierarquia: true });
        for (const c of Object.keys(NOVAS_CAPACIDADES_ATENDIMENTO)) assert.ok(!semChaves.includes(c as CapacidadeAtendimento), "Perfil novo não herda ações novas.");
        const snapPosterior = await snapshot(banco); await banco.query(migration(integracao)); assert.deepEqual(await snapshot(banco), snapPosterior);
        const veto = depois.find(p => p.id === "veto-sem-concessao")!;
        assert.equal(veto.excecoes["crm.atendimento.atalhos"].editar, false, "Veto anterior precisa continuar explícito mesmo se o perfil já negava.");
        const futuro = { ...veto, permissoes: { ...veto.permissoes, "crm.atendimento.atalhos": ["visualizar", "editar"] } as Permissoes };
        assert.ok(!efetivas(futuro, g, true).includes("atalhos.editar"));
        const comum = { id: "fiscal-ficticio", usuarioId: "autor-ficticio", tipo: "RASCUNHO" };
        assert.equal((await banco.query('SELECT grazing_projetar_atividade($1,$2::jsonb) AS id', ["EventoEstruturaFiscal", JSON.stringify(comum)])).rows[0].id, "delegado:EventoEstruturaFiscal");
        cenarios++;
      } finally { await banco.query("ROLLBACK"); }
    }

    for (const tipo of ["perfil", "excecao", "readiness"] as const) {
      const { integracao } = await preparar(banco, tipo === "readiness" ? "inusitado" : true);
      try {
        if (tipo === "perfil") await banco.query('UPDATE "PerfilAcesso" SET permissoes=permissoes||$1::jsonb WHERE id=$2', [JSON.stringify({ "crm.atendimento.atalhos": [] }), "configura"]);
        if (tipo === "excecao") await banco.query('UPDATE "Usuario" SET "permissoesPersonalizadas"=$1::jsonb WHERE id=$2', [JSON.stringify({ "crm.atendimento.atalhos": { editar: false } }), "p-configura"]);
        const antes = await snapshot(banco);
        await banco.query("SAVEPOINT validar_conflito");
        await assert.rejects(banco.query(migration(integracao)), tipo === "readiness" ? /ATENDIMENTO_READINESS_ESTRUTURA_NAO_RECONHECIDA/ : /ATENDIMENTO_HIERARQUIA_DECISAO_FORWARD_CONFLITANTE/);
        await banco.query("ROLLBACK TO SAVEPOINT validar_conflito");
        assert.deepEqual(await snapshot(banco), antes, "Conflito deve abortar antes de gravar permissões/auditoria.");
        assert.equal((await banco.query(`SELECT count(*)::int AS total FROM pg_attribute WHERE attrelid='${integracao}.identidade'::regclass AND attname='permissoesHierarquia' AND NOT attisdropped`)).rows[0].total, 0);
        cenarios++;
      } finally { await banco.query("ROLLBACK"); }
    }
    return { cenarios, pessoasPorCenario: pessoas.length, capacidades: Object.keys(CAPACIDADES_ATENDIMENTO).length, comparacoes, dadosReais: 0, sessoesPreservadas: true };
  } finally { await banco.end(); }
}
