/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential.
 */

/**
 * Remise à zéro complète de la base PostgreSQL, puis reconstruction.
 *
 * ⚠️ DESTRUCTIF : supprime le schéma `public` (tables, données, vues,
 * triggers — y compris les protections du compte maître), recrée le schéma,
 * rejoue TOUTES les migrations TypeORM, puis recrée les comptes coursier de
 * test (`scripts/seed-test-couriers.ts`).
 *
 * La base visée est celle de `DATABASE_URL` (variable d'environnement, sinon
 * `fasofree-backend/.env`). Le mot de passe n'est jamais affiché.
 *
 * Usage :
 *   npm run db:reset            → affiche le plan et s'arrête (garde-fou)
 *   npm run db:reset -- --yes   → exécute réellement la remise à zéro
 */
import 'reflect-metadata';
import { spawnSync } from 'child_process';
import { join } from 'path';
import { Client } from 'pg';
import { DataSource } from 'typeorm';

const CONFIRM_FLAG = '--yes';

/** Charge `fasofree-backend/.env` si le shell ne fournit pas déjà l'URL. */
const loadEnvFile = () => {
  if (process.env.DATABASE_URL) return;
  try {
    process.loadEnvFile('.env');
  } catch {
    // Pas de .env : on s'appuie uniquement sur l'environnement du shell.
  }
};

const target = () => {
  const raw = (process.env.DATABASE_URL ?? '').trim();
  if (raw === '') {
    console.error(
      '\nDATABASE_URL absente. Renseignez-la dans fasofree-backend/.env ' +
        '(URL externe Render, avec ?sslmode=require) puis relancez.\n',
    );
    process.exit(1);
  }

  try {
    const url = new URL(raw);
    return {
      raw,
      host: `${url.hostname}:${url.port || 5432}`,
      database: url.pathname.replace(/^\//, '') || '(défaut)',
    };
  } catch {
    console.error(
      '\nDATABASE_URL illisible. Format attendu :\n' +
        '  postgresql://user:motdepasse@host:5432/base?sslmode=require\n',
    );
    process.exit(1);
  }
};

/**
 * Render impose TLS sur l'URL externe ; en local (`NODE_ENV` non-production,
 * pas de `sslmode`) on reste en clair. Même règle que `database.config.ts`
 * (`rejectUnauthorized: false` : certificat Render non vérifiable par Node).
 */
const sslOption = () => {
  const url = process.env.DATABASE_URL ?? '';
  const needsSsl =
    process.env.NODE_ENV === 'production' ||
    /sslmode=(require|verify)/i.test(url) ||
    /render\.com/i.test(url);
  return needsSsl ? { rejectUnauthorized: false } : false;
};

const dropEverything = async (connectionString: string) => {
  const client = new Client({ connectionString, ssl: sslOption() });
  await client.connect();

  try {
    // Les extensions (postgis, pgcrypto, uuid-ossp) vivent dans `public` : si on
    // ne les supprime pas, `CREATE EXTENSION IF NOT EXISTS` les croira
    // installées alors que leurs objets ont disparu avec le schéma.
    const extensions = await client.query<{ extname: string }>(
      "SELECT extname FROM pg_extension WHERE extname <> 'plpgsql'",
    );
    for (const { extname } of extensions.rows) {
      await client.query(`DROP EXTENSION IF EXISTS "${extname}" CASCADE`);
    }

    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
  } finally {
    await client.end();
  }
};

const runMigrations = async (connectionString: string) => {
  const dataSource = new DataSource({
    type: 'postgres',
    url: connectionString,
    ssl: sslOption(),
    entities: [],
    synchronize: false,
    migrations: [
      join(__dirname, '..', 'src', 'database', 'migrations', '*.ts'),
      join(__dirname, '..', 'src', 'database', 'migrations', '*.js'),
    ],
    logging: false,
  });

  await dataSource.initialize();
  try {
    const applied = await dataSource.runMigrations();
    return applied.length;
  } finally {
    await dataSource.destroy();
  }
};

const runSeed = () => {
  const seed = spawnSync('npm run seed:couriers', {
    stdio: 'inherit',
    shell: true,
    env: process.env,
    cwd: join(__dirname, '..'),
  });

  if (seed.status !== 0) {
    throw new Error('Le seed des comptes de test a échoué.');
  }
};

const run = async () => {
  loadEnvFile();
  const { raw, host, database } = target();

  console.log(`\nBase ciblée : ${database} @ ${host}`);

  if (!process.argv.includes(CONFIRM_FLAG)) {
    console.log(
      [
        '',
        'Cette commande est DESTRUCTIVE :',
        '  1. supprime les extensions et le schéma `public` (toutes les tables,',
        '     toutes les données) ;',
        '  2. recrée le schéma ;',
        '  3. rejoue toutes les migrations TypeORM ;',
        '  4. recrée les comptes coursier de test (livreur1..3@koliwa.test).',
        '',
        'Relancez avec le garde-fou pour exécuter :',
        '  npm run db:reset -- --yes',
        '',
      ].join('\n'),
    );
    return;
  }

  await dropEverything(raw);
  console.log('Schéma `public` recréé (base vidée).');

  const applied = await runMigrations(raw);
  console.log(`${applied} migration(s) appliquée(s).`);

  runSeed();

  console.log('\nBase prête : schéma à jour et comptes de test disponibles.\n');
};

run().catch((error) => {
  console.error(`\nÉchec de la remise à zéro : ${error.message}\n`);
  process.exitCode = 1;
});
