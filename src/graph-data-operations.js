import { getDb } from './store.js';

export const EPISODE_WINDOW_LEN = 3;

export async function retrieveEpisodes({ groupIds, referenceTime = null, limit = EPISODE_WINDOW_LEN, source = null }) {
  const db = getDb();
  const parts = [];
  const args = [];
  if (groupIds?.length) {
    parts.push(`group_id IN (${groupIds.map(() => '?').join(',')})`);
    args.push(...groupIds);
  }
  if (referenceTime) { parts.push('valid_at < ?'); args.push(referenceTime); }
  if (source) { parts.push('source = ?'); args.push(source); }
  const where = parts.length ? 'WHERE ' + parts.join(' AND ') : '';
  args.push(limit);
  const r = await db.execute({
    sql: `SELECT * FROM episodic_node ${where} ORDER BY valid_at DESC LIMIT ?`,
    args,
  });
  return r.rows.reverse();
}

export async function buildIndicesAndConstraints() {
  // idempotent — schema already creates indices via CREATE IF NOT EXISTS in store.initStore
  return true;
}

export async function clearData(groupIds = null) {
  const db = getDb();
  const tables = ['entity_edge', 'episodic_edge', 'community_edge', 'entity_node_fts', 'episodic_node_fts', 'entity_edge_fts', 'entity_node', 'episodic_node', 'community_node'];
  for (const t of tables) {
    if (groupIds?.length && !t.endsWith('_fts')) {
      await db.execute({
        sql: `DELETE FROM ${t} WHERE group_id IN (${groupIds.map(() => '?').join(',')})`,
        args: groupIds,
      });
    } else {
      await db.execute({ sql: `DELETE FROM ${t}`, args: [] });
    }
  }
}
