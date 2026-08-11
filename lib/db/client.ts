import 'server-only';

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { readDatabaseEnv } from '../env';
import * as schema from './schema';

/**
 * Database access for the Account Platform.
 *
 * `server-only` above makes it a build error to import this from a client
 * component, so the connection string and the query layer cannot leak into a
 * browser bundle.
 *
 * The WebSocket pool driver is used rather than Neon's HTTP driver because
 * account creation writes the user and its audit event in one transaction, and
 * the HTTP driver cannot hold an interactive transaction open.
 */

// Node 22 has a global WebSocket, but the driver needs one supplied explicitly
// when running outside an edge runtime.
if (!neonConfig.webSocketConstructor) {
  neonConfig.webSocketConstructor = ws;
}

function connectionString(): string {
  // Same validation the CLI tooling uses, so the app and migrations agree on
  // what a valid configuration is — including that the pooled and direct URLs
  // must address the same database. Throws loudly rather than falling back; a
  // silent default would mean an account "created" against nothing.
  return readDatabaseEnv().url;
}

// Reused across hot reloads in development so a long dev session does not
// exhaust the connection limit.
const globalForDb = globalThis as unknown as { __accountDbPool?: Pool };

function getPool(): Pool {
  if (!globalForDb.__accountDbPool) {
    globalForDb.__accountDbPool = new Pool({ connectionString: connectionString() });
  }
  return globalForDb.__accountDbPool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

export { schema };
