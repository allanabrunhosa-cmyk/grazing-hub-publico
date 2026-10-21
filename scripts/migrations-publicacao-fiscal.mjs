import pg from 'pg';
import { aplicarPlanoMigrationsFiscais, planejarMigrationsFiscais, resumoPlanoMigrationsFiscais } from './lib/plano-migrations-fiscais.mjs';
const argumentos = process.argv.slice(2), bootstrap = argumentos.length === 1 && argumentos[0] === '--bootstrap';
const falhaSegura = () => { console.error('Publicação fiscal: plano ausente, não aprovado ou banco incompatível. Executar o planejamento e o ritual de backup; nenhuma credencial é exibida.'); process.exitCode = 1; };
let cliente;
try {
  if (argumentos.length > 1 || argumentos.length && !['--bootstrap', '--planejar'].includes(argumentos[0])) throw Error('Modo de migrations inválido.');
  const conexao = process.env.DATABASE_URL;
  if (!conexao || conexao.trim() !== conexao) throw Error('Destino PostgreSQL explícito obrigatório.');
  const destino = new URL(conexao);
  if (!['postgres:', 'postgresql:'].includes(destino.protocol) || !destino.hostname || destino.pathname.length <= 1) throw Error('Destino PostgreSQL explícito obrigatório.');
  cliente = new pg.Client({ connectionString: conexao });
  await cliente.connect();
  const plano = await planejarMigrationsFiscais(cliente);
  console.log(JSON.stringify(resumoPlanoMigrationsFiscais(plano)));
  if (bootstrap && plano.pendentes.length) {
    // A aprovação é vinculada ao conteúdo exato do plano, não uma flag permanente.
    await aplicarPlanoMigrationsFiscais(cliente, plano, process.env.MIGRACOES_FISCAIS_PLANO_APROVADO);
    console.log('Migrations aplicadas conforme plano fiscal aprovado.');
  }
} catch { falhaSegura(); }
finally { try { await cliente?.end(); } catch { falhaSegura(); } }
