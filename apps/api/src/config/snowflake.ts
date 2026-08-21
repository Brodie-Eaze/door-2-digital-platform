/**
 * Snowflake Data Marketplace connection.
 *
 * Required env vars:
 *   SNOWFLAKE_ACCOUNT   e.g. "xy12345.us-east-1"
 *   SNOWFLAKE_USERNAME  service-account user
 *   SNOWFLAKE_PASSWORD  service-account password
 *
 * Usage:
 *   const rows = await sfQuery<MyRow>('SELECT ... WHERE ID = ?', [id])
 *
 * Snowflake SDK doesn't support IN (?) with a single array bind — callers
 * must expand arrays into individual `?` placeholders before passing binds.
 */

import snowflake from 'snowflake-sdk';
import { env } from './env';
import { logger } from './logger';

let _conn: snowflake.Connection | undefined;

function snowflakeConn(): snowflake.Connection {
  if (!_conn) {
    _conn = snowflake.createConnection({
      account: env().SNOWFLAKE_ACCOUNT,
      username: env().SNOWFLAKE_USERNAME,
      password: env().SNOWFLAKE_PASSWORD,
      database: 'D2D_ENRICHMENT',
      warehouse: 'COMPUTE_WH',
      role: 'D2D_READER',
    });
  }
  return _conn;
}

function ensureConnected(): Promise<void> {
  return new Promise((resolve, reject) => {
    const conn = snowflakeConn();
    if ((conn as unknown as { isUp?: boolean }).isUp) {
      resolve();
      return;
    }
    conn.connect((err) => {
      if (err) {
        logger().error({ err }, 'snowflake: connection failed');
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export async function sfQuery<T>(sql: string, binds: unknown[] = []): Promise<T[]> {
  await ensureConnected();
  return new Promise((resolve, reject) => {
    snowflakeConn().execute({
      sqlText: sql,
      binds: binds as snowflake.Binds,
      complete: (err, _stmt, rows) => {
        if (err) {
          logger().error({ err, sql }, 'snowflake: query failed');
          reject(err);
        } else {
          resolve((rows ?? []) as T[]);
        }
      },
    });
  });
}
