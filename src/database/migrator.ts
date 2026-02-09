import { createPool, Pool, RowDataPacket } from "mysql2/promise";

export interface Migration {
  /** Nome único da migration (ex: "001_create_messages_table") */
  name: string;
  /** Descrição curta da migration */
  description: string;
  /**
   * SQL de verificação: se retornar alguma linha, a migration já foi aplicada e será pulada.
   * Se retornar 0 linhas, a migration será executada.
   */
  check: string;
  /** SQL(s) para aplicar a migration. Pode ser um array de SQLs que serão executados em sequência. */
  up: string | string[];
}

interface MigrationResult {
  name: string;
  status: "applied" | "skipped" | "failed";
  error?: string;
  durationMs: number;
}

export async function runMigrations(pool: Pool, migrations: Migration[]): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];
  const sortedMigrations = [...migrations].sort((a, b) => a.name.localeCompare(b.name));

  console.log(`\n🔄 [Migrations] Starting migration check (${sortedMigrations.length} migrations registered)`);

  for (const migration of sortedMigrations) {
    const start = Date.now();

    try {
      // 1. Executar SQL de verificação
      const [checkRows] = await pool.query<RowDataPacket[]>(migration.check);
      const alreadyApplied = checkRows.length > 0;

      if (alreadyApplied) {
        const duration = Date.now() - start;
        results.push({ name: migration.name, status: "skipped", durationMs: duration });
        console.log(`  ⏭️  ${migration.name} — skipped (already applied)`);
        continue;
      }

      // 2. Aplicar migration
      console.log(`  ⬆️  ${migration.name} — applying: ${migration.description}`);

      const statements = Array.isArray(migration.up) ? migration.up : [migration.up];

      for (const sql of statements) {
        const trimmed = sql.trim();
        if (!trimmed) continue;
        await pool.query(trimmed);
      }

      const duration = Date.now() - start;
      results.push({ name: migration.name, status: "applied", durationMs: duration });
      console.log(`  ✅ ${migration.name} — applied (${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - start;
      const errorMsg = error?.message || String(error);
      results.push({ name: migration.name, status: "failed", error: errorMsg, durationMs: duration });
      console.error(`  ❌ ${migration.name} — FAILED: ${errorMsg}`);
      // Interrompe ao primeiro erro para evitar migrations dependentes falharem em cascata
      break;
    }
  }

  const applied = results.filter((r) => r.status === "applied").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed").length;

  console.log(`\n📊 [Migrations] Summary: ${applied} applied, ${skipped} skipped, ${failed} failed\n`);

  if (failed > 0) {
    const failedMigration = results.find((r) => r.status === "failed");
    throw new Error(`Migration "${failedMigration?.name}" failed: ${failedMigration?.error}`);
  }

  return results;
}

/**
 * Conveniência: cria um pool temporário, roda as migrations e destrói o pool.
 * Útil para rodar as migrations antes de iniciar a aplicação.
 */
export async function runMigrationsWithConfig(config: {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  migrations: Migration[];
}): Promise<MigrationResult[]> {
  const pool = createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 2,
    multipleStatements: false,
  });

  try {
    return await runMigrations(pool, config.migrations);
  } finally {
    await pool.end();
  }
}
