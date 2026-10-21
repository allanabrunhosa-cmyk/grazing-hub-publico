// Operação administrativa por SSH, sem endpoint público. A conferência é o padrão.
// npx tsx scripts/aplicar-fotos-insumos.ts --manifesto=<arquivo> --auditoria-dir=<pasta privada>
//   --quantidade-esperada=<N> [--aplicar | --reverter]
import { promises as fs } from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import {
  conferirReversaoFoto, hashFotoMd5, hashSha256, normalizarInstante, planejarFoto,
  resolverArquivoFoto, TAMANHO_MAXIMO_FOTO, validarArquivoFoto, validarManifestoFotos,
  type EstadoFotoInsumo, type ItemManifestoFoto,
} from "../src/lib/insumos/lote-fotos";

type LinhaFoto = EstadoFotoInsumo & { fotoData: Buffer | null; camposHash: string };
type FotoPreparada = { item: ItemManifestoFoto; bytes: Buffer };
type RegistroBackup = {
  original: Omit<LinhaFoto, "fotoData"> & { fotoBase64: string | null };
  aplicada: { acao: "aplicar" | "inalterado"; sha256: string; mimeType: string; updatedAt: string };
};
type Snapshot = {
  versao: 1; loteId: string; manifestoSha256: string; autorizacaoOperacional: string;
  preparadoEm: string; registros: RegistroBackup[];
};
type Recibo = {
  versao: 1; loteId: string; snapshotSha256: string;
  estado: "preparado" | "aplicado"; atualizadoEm: string;
};
type ReciboReversao = {
  versao: 1; loteId: string; snapshotSha256: string;
  estado: "preparado" | "revertido"; updatedAt: string;
};

function argumentos() {
  const args = process.argv.slice(2);
  const valores = new Map<string, string>();
  const flags = new Set<string>();
  for (let indice = 0; indice < args.length; indice++) {
    const arg = args[indice];
    if (arg === "--aplicar" || arg === "--reverter") {
      if (flags.has(arg)) throw new Error("Argumento repetido.");
      flags.add(arg);
      continue;
    }
    const [chave, ...resto] = arg.split("=");
    if (!["--manifesto", "--auditoria-dir", "--quantidade-esperada"].includes(chave) || valores.has(chave)) throw new Error("Argumento desconhecido ou repetido.");
    const valor = resto.length ? resto.join("=") : args[++indice];
    if (!valor || valor.startsWith("--")) throw new Error("Informe os valores de manifesto, auditoria e quantidade esperada.");
    valores.set(chave, valor);
  }
  if (flags.size > 1) throw new Error("Aplicação e reversão são operações exclusivas.");
  const manifesto = valores.get("--manifesto");
  const auditoriaDir = valores.get("--auditoria-dir");
  const quantidade = valores.get("--quantidade-esperada");
  if (!manifesto || !auditoriaDir || !path.isAbsolute(auditoriaDir) || !quantidade || !/^\d+$/.test(quantidade)) throw new Error("Informe --manifesto, --auditoria-dir absoluto e --quantidade-esperada.");
  return { manifesto: path.resolve(manifesto), auditoriaDir, quantidade: Number(quantidade), modo: flags.has("--reverter") ? "reverter" : flags.has("--aplicar") ? "aplicar" : "conferir" } as const;
}

async function syncPasta(destino: string) {
  // Windows não oferece fsync de diretório; a operação produtiva ocorre no Linux.
  if (process.platform === "win32") return;
  const pasta = await fs.open(destino, "r");
  try { await pasta.sync(); } finally { await pasta.close(); }
}

async function arquivoPrivado(destino: string, conteudo: string, criar = false) {
  const temporario = `${destino}.tmp-${process.pid}`;
  const handle = await fs.open(temporario, "wx", 0o600);
  try { await handle.writeFile(conteudo); await handle.sync(); }
  finally { await handle.close(); }
  try {
    if (criar) await fs.link(temporario, destino); // Nunca substitui um backup anterior.
    else await fs.rename(temporario, destino);
    await syncPasta(path.dirname(destino));
  } finally { await fs.unlink(temporario).catch(() => undefined); }
}

async function pastaPrivada(destino: string, criar: boolean) {
  if (criar) {
    const pendentes: string[] = [];
    let atual = path.resolve(destino);
    while (true) {
      try { await fs.lstat(atual); break; }
      catch (erro) {
        if ((erro as NodeJS.ErrnoException).code !== "ENOENT") throw erro;
        pendentes.push(atual);
        const pai = path.dirname(atual);
        if (pai === atual) throw new Error("Raiz da pasta de auditoria não encontrada.");
        atual = pai;
      }
    }
    for (const pasta of pendentes.reverse()) {
      try { await fs.mkdir(pasta, { mode: 0o700 }); }
      catch (erro) { if ((erro as NodeJS.ErrnoException).code !== "EEXIST") throw erro; }
      const estado = await fs.lstat(pasta);
      if (!estado.isDirectory() || estado.isSymbolicLink()) throw new Error("Pasta de auditoria alterada durante a criação.");
      // Torna cada entrada recém-criada durável antes de criar seus descendentes.
      await syncPasta(path.dirname(pasta));
    }
  }
  const estado = await fs.lstat(destino);
  if (!estado.isDirectory() || estado.isSymbolicLink() || (process.platform !== "win32" && (estado.mode & 0o077) !== 0)) throw new Error("A pasta de auditoria deve ser privada e não pode ser um link.");
}

async function lerPrivado(destino: string) {
  const estado = await fs.lstat(destino);
  if (!estado.isFile() || estado.isSymbolicLink() || (process.platform !== "win32" && (estado.mode & 0o077) !== 0)) throw new Error("Arquivo de auditoria sem proteção privada.");
  return fs.readFile(destino, "utf8");
}

async function existe(destino: string) {
  try { await fs.access(destino); return true; }
  catch (erro) { if ((erro as NodeJS.ErrnoException).code === "ENOENT") return false; throw erro; }
}

async function lerFotos(manifestoDir: string, itens: ItemManifestoFoto[]): Promise<FotoPreparada[]> {
  const baseReal = await fs.realpath(manifestoDir);
  const fotos: FotoPreparada[] = [];
  for (const item of itens) {
    const nome = resolverArquivoFoto(manifestoDir, item.foto.arquivo);
    const real = await fs.realpath(nome);
    if (!real.startsWith(`${baseReal}${path.sep}`)) throw new Error("Uma foto aponta para fora da pasta do manifesto.");
    const estado = await fs.stat(real);
    if (!estado.isFile() || estado.size > TAMANHO_MAXIMO_FOTO) throw new Error("Arquivo de foto inválido ou acima de 5 MiB.");
    const bytes = await fs.readFile(real);
    validarArquivoFoto(bytes, item.foto);
    fotos.push({ item, bytes });
  }
  return fotos;
}

async function lerInsumos(cliente: PoolClient, ids: string[], travar: boolean): Promise<LinhaFoto[]> {
  // A guarda INSUMO é independente do conteúdo do manifesto e também existe no UPDATE.
  const resultado = await cliente.query<{
    id: string; nome: string; especificacao: string | null; tipo: string; updatedAt: string;
    fotoData: Buffer | null; fotoMimeType: string | null; fotoHashMd5: string | null; camposHash: string;
  }>(`
    SELECT i."id", i."nome", i."especificacao", i."tipo", i."fotoData", i."fotoMimeType",
      to_char(i."updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt",
      md5(encode(i."fotoData", 'hex')) AS "fotoHashMd5",
      md5((to_jsonb(i) - 'fotoData' - 'fotoMimeType' - 'updatedAt')::text) AS "camposHash"
    FROM "Insumo" i WHERE i."tipo" = 'INSUMO' AND i."id" = ANY($1::text[])
    ORDER BY i."id" ${travar ? "FOR UPDATE" : ""}
  `, [ids]);
  if (resultado.rows.length !== ids.length) throw new Error("Quantidade de insumos mudou ou o lote contém preparação; operação bloqueada.");
  return resultado.rows.map(linha => ({ ...linha, fotoSha256: linha.fotoData === null ? null : hashSha256(linha.fotoData) }));
}

async function gravarFoto(cliente: PoolClient, atual: LinhaFoto, bytes: Buffer | null, mimeType: string | null, updatedAt: string) {
  const alterada = await cliente.query(`
    UPDATE "Insumo" SET "fotoData" = $1::bytea, "fotoMimeType" = $2, "updatedAt" = $3::timestamp
    WHERE "id" = $4 AND "tipo" = 'INSUMO' AND "updatedAt" = $5::timestamp
      AND md5(encode("fotoData", 'hex')) IS NOT DISTINCT FROM $6::text
  `, [bytes, mimeType, updatedAt, atual.id, atual.updatedAt, atual.fotoHashMd5]);
  if (alterada.rowCount !== 1) throw new Error("Insumo alterado durante a operação; lote desfeito.");
}

function novaVersao(linhas: LinhaFoto[]) {
  return normalizarInstante(new Date(Math.max(Date.now(), ...linhas.map(linha => Date.parse(linha.updatedAt) + 1))).toISOString());
}

async function conferirPreservacao(cliente: PoolClient, antes: LinhaFoto[], esperadas: Map<string, Pick<EstadoFotoInsumo, "fotoSha256" | "fotoMimeType" | "updatedAt">>) {
  const depois = await lerInsumos(cliente, antes.map(linha => linha.id), false);
  const hashes = new Map(antes.map(linha => [linha.id, linha.camposHash]));
  if (depois.some(linha => hashes.get(linha.id) !== linha.camposHash)) throw new Error("Um campo fora das fotos mudou; lote desfeito.");
  if (depois.some(linha => {
    const esperada = esperadas.get(linha.id);
    return !esperada || linha.fotoSha256 !== esperada.fotoSha256 || linha.fotoMimeType !== esperada.fotoMimeType || linha.updatedAt !== esperada.updatedAt;
  })) throw new Error("Foto gravada diverge do plano; lote desfeito.");
}

async function executar() {
  const opcoes = argumentos();
  const conteudoManifesto = await fs.readFile(opcoes.manifesto);
  const manifesto = validarManifestoFotos(JSON.parse(conteudoManifesto.toString("utf8")), opcoes.quantidade);
  const manifestoSha256 = hashSha256(conteudoManifesto);
  const fotos = opcoes.modo === "reverter" ? [] : await lerFotos(path.dirname(opcoes.manifesto), manifesto.itens);
  const pastaLote = path.join(opcoes.auditoriaDir, manifesto.loteId);
  const snapshotPath = path.join(pastaLote, "snapshot.json");
  const reciboPath = path.join(pastaLote, "recibo.json");
  const reversaoPath = path.join(pastaLote, "reversao.json");
  if (opcoes.modo !== "conferir") {
    await pastaPrivada(opcoes.auditoriaDir, opcoes.modo === "aplicar");
    await pastaPrivada(pastaLote, opcoes.modo === "aplicar");
  }
  let snapshot: Snapshot | null = null;
  let snapshotSha256: string | null = null;
  if (opcoes.modo !== "conferir" && await existe(snapshotPath)) {
    const conteudo = await lerPrivado(snapshotPath);
    snapshot = JSON.parse(conteudo) as Snapshot;
    snapshotSha256 = hashSha256(Buffer.from(conteudo));
    if (snapshot.versao !== 1 || snapshot.loteId !== manifesto.loteId || snapshot.manifestoSha256 !== manifestoSha256 || snapshot.registros.length !== opcoes.quantidade) throw new Error("O backup existente não pertence a este manifesto.");
    if (await existe(reciboPath)) {
      const recibo = JSON.parse(await lerPrivado(reciboPath)) as Recibo;
      if (recibo.versao !== 1 || recibo.loteId !== manifesto.loteId || recibo.snapshotSha256 !== snapshotSha256) throw new Error("O recibo diverge do backup privado.");
    }
  }
  if (opcoes.modo === "reverter" && !snapshot) throw new Error("Backup privado do lote não encontrado.");
  if (!process.env.DATABASE_URL) throw new Error("Conexão administrativa não configurada.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000 });
  const cliente = await pool.connect().catch(async () => {
    await pool.end();
    throw new Error("Não foi possível abrir a conexão administrativa.");
  });
  let emTransacao = false;
  let alteradas = 0;
  let inalteradas = 0;
  try {
    await cliente.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    emTransacao = true;
    await cliente.query("SET LOCAL statement_timeout = '30s'");
    await cliente.query("SET LOCAL lock_timeout = '10s'");
    const atuais = await lerInsumos(cliente, manifesto.itens.map(item => item.id), opcoes.modo !== "conferir");
    const porId = new Map(atuais.map(linha => [linha.id, linha]));
    const esperadas = new Map(atuais.map(linha => [linha.id, { fotoSha256: linha.fotoSha256, fotoMimeType: linha.fotoMimeType, updatedAt: linha.updatedAt }]));
    if (opcoes.modo === "reverter") {
      const backup = snapshot!;
      let reversao: ReciboReversao = {
        versao: 1, loteId: manifesto.loteId, snapshotSha256: snapshotSha256!,
        estado: "preparado", updatedAt: novaVersao(atuais),
      };
      if (await existe(reversaoPath)) {
        reversao = JSON.parse(await lerPrivado(reversaoPath)) as ReciboReversao;
        if (reversao.versao !== 1 || reversao.loteId !== manifesto.loteId || reversao.snapshotSha256 !== snapshotSha256) throw new Error("Recibo de reversão divergente.");
        normalizarInstante(reversao.updatedAt);
      }
      const restaurar: { atual: LinhaFoto; bytes: Buffer | null; mimeType: string | null }[] = [];
      for (const registro of backup.registros) {
        const atual = porId.get(registro.original.id);
        if (!atual) throw new Error("Insumo do backup ausente; reversão bloqueada.");
        if (registro.aplicada.acao === "inalterado") { inalteradas++; continue; }
        const bytes = registro.original.fotoBase64 === null ? null : Buffer.from(registro.original.fotoBase64, "base64");
        if ((bytes === null ? null : hashFotoMd5(bytes)) !== registro.original.fotoHashMd5 || (bytes === null ? null : hashSha256(bytes)) !== registro.original.fotoSha256) throw new Error("Integridade da foto anterior inválida.");
        if (atual.fotoSha256 === registro.original.fotoSha256 && atual.fotoMimeType === registro.original.fotoMimeType && normalizarInstante(atual.updatedAt) === reversao.updatedAt) { inalteradas++; continue; }
        conferirReversaoFoto(atual, registro.aplicada);
        restaurar.push({ atual, bytes, mimeType: registro.original.fotoMimeType });
      }
      // A versão futura e os hashes já estão duráveis antes do primeiro UPDATE.
      if (!await existe(reversaoPath)) await arquivoPrivado(reversaoPath, `${JSON.stringify(reversao, null, 2)}\n`, true);
      for (const registro of restaurar) {
        await gravarFoto(cliente, registro.atual, registro.bytes, registro.mimeType, reversao.updatedAt);
        esperadas.set(registro.atual.id, { fotoSha256: registro.bytes === null ? null : hashSha256(registro.bytes), fotoMimeType: registro.mimeType, updatedAt: reversao.updatedAt });
        alteradas++;
      }
      await conferirPreservacao(cliente, atuais, esperadas);
      await cliente.query("COMMIT");
      emTransacao = false;
      reversao.estado = "revertido";
      await arquivoPrivado(reversaoPath, `${JSON.stringify(reversao, null, 2)}\n`).catch(() => { throw new Error("Reversão confirmada no banco; confira o plano privado e repita --reverter para concluir o recibo."); });
    } else {
      const plano = fotos.map(foto => ({ ...foto, atual: porId.get(foto.item.id)! }));
      const acoes = plano.map(foto => planejarFoto(foto.item, foto.atual));
      alteradas = acoes.filter(acao => acao === "aplicar").length;
      inalteradas = acoes.length - alteradas;
      if (opcoes.modo === "conferir") {
        await cliente.query("ROLLBACK");
        emTransacao = false;
      } else {
        if (await existe(reversaoPath)) throw new Error("Este lote tem reversão registrada; use um novo inventário e lote.");
        if (!snapshot) {
          const updatedAt = novaVersao(atuais);
          snapshot = {
            versao: 1, loteId: manifesto.loteId, manifestoSha256, autorizacaoOperacional: manifesto.autorizacaoOperacional,
            preparadoEm: updatedAt,
            registros: plano.map((foto, indice) => {
              const { fotoData, ...original } = foto.atual;
              return {
                original: { ...original, fotoBase64: fotoData === null ? null : fotoData.toString("base64") },
                aplicada: { acao: acoes[indice], sha256: foto.item.foto.sha256, mimeType: foto.item.foto.mimeType, updatedAt: acoes[indice] === "aplicar" ? updatedAt : original.updatedAt },
              };
            }),
          };
          const conteudo = `${JSON.stringify(snapshot, null, 2)}\n`;
          await arquivoPrivado(snapshotPath, conteudo, true);
          snapshotSha256 = hashSha256(Buffer.from(conteudo));
        }
        const registros = new Map(snapshot.registros.map(registro => [registro.original.id, registro]));
        const recibo: Recibo = { versao: 1, loteId: manifesto.loteId, snapshotSha256: snapshotSha256!, estado: "preparado", atualizadoEm: new Date().toISOString() };
        if (!await existe(reciboPath)) await arquivoPrivado(reciboPath, `${JSON.stringify(recibo, null, 2)}\n`, true);
        for (let indice = 0; indice < plano.length; indice++) {
          const foto = plano[indice];
          const registro = registros.get(foto.item.id);
          if (!registro || registro.aplicada.sha256 !== foto.item.foto.sha256 || registro.aplicada.mimeType !== foto.item.foto.mimeType) throw new Error("Plano aplicado diverge do backup.");
          if (acoes[indice] === "aplicar") {
            if (registro.aplicada.acao !== "aplicar" || registro.original.updatedAt !== foto.atual.updatedAt || registro.original.fotoHashMd5 !== foto.atual.fotoHashMd5) throw new Error("Insumo alterado após preparar o backup; aplicação bloqueada.");
            await gravarFoto(cliente, foto.atual, foto.bytes, foto.item.foto.mimeType, registro.aplicada.updatedAt);
            esperadas.set(foto.atual.id, { fotoSha256: foto.item.foto.sha256, fotoMimeType: foto.item.foto.mimeType, updatedAt: registro.aplicada.updatedAt });
          }
        }
        await conferirPreservacao(cliente, atuais, esperadas);
        await cliente.query("COMMIT");
        emTransacao = false;
        recibo.estado = "aplicado";
        await arquivoPrivado(reciboPath, `${JSON.stringify(recibo, null, 2)}\n`).catch(() => { throw new Error("Aplicação confirmada no banco; confira o plano privado e repita --aplicar para concluir o recibo."); });
      }
    }
    console.log(JSON.stringify({ modo: opcoes.modo, loteId: manifesto.loteId, quantidade: manifesto.itens.length, alteradas, inalteradas, outrosCamposPreservados: true }));
  } catch (erro) {
    if (emTransacao) await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
    await pool.end();
  }
}

executar().catch(erro => {
  console.error(erro instanceof Error ? erro.message : "Falha na operação de fotos. Confira o recibo privado antes de repetir.");
  process.exitCode = 1;
});
