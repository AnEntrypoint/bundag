import { v4 as uuidv4 } from 'uuid';
import { getDb } from './store.js';
import { getLLM } from './llm.js';
import { promptLibrary } from './prompts/index.js';
import { MAX_SUMMARY_CHARS, truncateAtSentence } from './text-utils.js';

function nowIso() { return new Date().toISOString(); }

export async function upsertSaga({ uuid = null, groupId, name, summary = '' }) {
  const db = getDb();
  const id = uuid || uuidv4();
  await db.execute({
    sql: `INSERT INTO saga_node(uuid,group_id,name,summary,created_at) VALUES(?,?,?,?,?)
          ON CONFLICT(uuid) DO UPDATE SET name=excluded.name, summary=excluded.summary`,
    args: [id, groupId, name, summary, nowIso()],
  });
  return { uuid: id, group_id: groupId, name, summary };
}

export async function addEpisodeToSaga({ sagaUuid, episodeUuid, groupId, previousEpisodeUuid = null }) {
  const db = getDb();
  await db.execute({
    sql: `INSERT OR REPLACE INTO has_episode_edge(uuid,group_id,source_node_uuid,target_node_uuid,created_at) VALUES(?,?,?,?,?)`,
    args: [uuidv4(), groupId, sagaUuid, episodeUuid, nowIso()],
  });
  if (previousEpisodeUuid) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO next_episode_edge(uuid,group_id,source_node_uuid,target_node_uuid,created_at) VALUES(?,?,?,?,?)`,
      args: [uuidv4(), groupId, previousEpisodeUuid, episodeUuid, nowIso()],
    });
  }
}

export async function getSagaEpisodes(sagaUuid) {
  const db = getDb();
  const r = await db.execute({
    sql: `SELECT e.* FROM episodic_node e
          JOIN has_episode_edge h ON h.target_node_uuid = e.uuid
          WHERE h.source_node_uuid = ? ORDER BY e.valid_at ASC`,
    args: [sagaUuid],
  });
  return r.rows;
}

export async function summarizeSaga({ sagaUuid }) {
  const db = getDb();
  const s = await db.execute({ sql: `SELECT * FROM saga_node WHERE uuid = ?`, args: [sagaUuid] });
  if (!s.rows.length) return null;
  const saga = s.rows[0];
  const episodes = await getSagaEpisodes(sagaUuid);
  const llm = getLLM();
  const prompt = promptLibrary.summarize_sagas.summarize_saga({
    saga_name: saga.name,
    existing_summary: saga.summary || '',
    episodes: episodes.map(e => e.content),
  });
  let res;
  try { res = await llm.generate(prompt.system, prompt.user); }
  catch { return saga; }
  const summary = truncateAtSentence(res?.summary || saga.summary, MAX_SUMMARY_CHARS);
  await db.execute({ sql: `UPDATE saga_node SET summary = ? WHERE uuid = ?`, args: [summary, sagaUuid] });
  return { ...saga, summary };
}
