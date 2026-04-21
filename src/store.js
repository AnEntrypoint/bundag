import { createClient } from '@libsql/client';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { SCHEMA, PRAGMAS, MIGRATIONS } from './store-schema.js';
import { logger } from './logger.js';
import { register } from './debug-registry.js';

const log = logger.child('store');

let db = null;
let dbUrl = null;

register('store', () => ({ initialized: !!db, url: dbUrl }));

export async function initStore(dbPath) {
  if (dbPath && !existsSync(dirname(dbPath))) mkdirSync(dirname(dbPath), { recursive: true });
  const url = `file:${dbPath}`;
  db = createClient({ url });
  dbUrl = url;
  for (const p of PRAGMAS) {
    try { await db.execute(p); } catch (e) { log.warn('pragma failed', { pragma: p, err: e.message }); }
  }
  for (const q of SCHEMA) await db.execute(q);
  for (const m of MIGRATIONS) {
    try { await db.execute(m); } catch (e) {
      if (!/duplicate column name|already exists/i.test(e.message)) throw e;
    }
  }
  try { await db.execute(`PRAGMA optimize`); } catch {}
  log.info('store initialized', { path: dbPath });
  return db;
}

export function getDb() {
  if (!db) throw new Error('Store not initialized');
  return db;
}

export function vecLit(arr) {
  if (!arr) return null;
  return `vector32('[${Array.from(arr).map(Number).join(',')}]')`;
}

export async function checkpoint(mode = 'PASSIVE') {
  if (!db) return null;
  if (mode === 'TRUNCATE') {
    try {
      await db.execute('DELETE FROM entity_node');
      await db.execute('DELETE FROM episodic_node');
      await db.execute('DELETE FROM community_node');
      await db.execute('DELETE FROM saga_node');
      await db.execute('DELETE FROM entity_edge');
      await db.execute('DELETE FROM episodic_edge');
      await db.execute('DELETE FROM community_edge');
      await db.execute('DELETE FROM has_episode_edge');
      await db.execute('DELETE FROM next_episode_edge');
      for (const idx of [
        'entity_node_vec', 'entity_edge_vec', 'community_node_vec'
      ]) {
        try { await db.execute(`DROP INDEX IF EXISTS ${idx}`); } catch {}
      }
      await db.execute('VACUUM');
      for (const [tbl, col] of [
        ['entity_node', 'name_embedding'],
        ['entity_edge', 'fact_embedding'],
        ['community_node', 'name_embedding'],
      ]) {
        try { await db.execute(`CREATE INDEX IF NOT EXISTS ${tbl}_vec ON ${tbl}(libsql_vector_idx(${col}))`); } catch {}
      }
      await db.execute('PRAGMA wal_checkpoint(RESTART)');
    } catch (e) { log.warn('truncate failed', { err: e.message }); }
    return null;
  }
  try { return await db.execute(`PRAGMA wal_checkpoint(${mode})`); } catch (e) { log.warn('checkpoint failed', { err: e.message }); }
}

export async function closeStore() {
  if (db) { db.close(); db = null; dbUrl = null; }
}

export {
  upsertEntityNode, upsertEpisodicNode, upsertEntityEdge, upsertEpisodicEdge,
  upsertCommunityNode, expireEdge, deleteEpisode, clearGroup,
} from './store-write.js';

export {
  vectorSearchNodes, vectorSearchEdges, ftsSearchNodes, ftsSearchEdges,
  vectorSearchCommunities, ftsSearchCommunities, getEntityNodesByUuids,
  getEntityEdgesByUuids, getEdgesBetween, getRecentEpisodes, graphWalk,
} from './store-read.js';
