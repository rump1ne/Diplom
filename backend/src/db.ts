import { Pool, PoolClient, QueryResultRow } from 'pg';
import { config } from './config';

const shouldUseTls = /sslmode=require/i.test(config.databaseUrl) || process.env.PGSSLMODE === 'require';
const shouldSkipTlsVerify =
  process.env.PG_SSL_NO_VERIFY === 'true' ||
  process.env.PGSSLMODE === 'no-verify' ||
  process.env.NODE_ENV === 'production';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: shouldUseTls
    ? {
        rejectUnauthorized: !shouldSkipTlsVerify
      }
    : undefined
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[] }> {
  const client = await pool.connect();
  try {
    const result = await client.query<T>(text, params);
    return { rows: result.rows };
  } finally {
    client.release();
  }
}

/**
 * Выполняет несколько запросов в одной транзакции.
 * При любой ошибке автоматически делает ROLLBACK.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
