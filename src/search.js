import { embedOne } from './embeddings.js';
import {
  vectorSearchNodes, vectorSearchEdges, ftsSearchNodes, ftsSearchEdges,
  getEntityNodesByUuids, graphWalk,
} from './store.js';

const RRF_K = 60;

function rrf(lists) {
  const scores = new Map();
  const rows = new Map();
  for (const list of lists) {
    list.forEach((row, rank) => {
      const uuid = row.uuid;
      rows.set(uuid, row);
      scores.set(uuid, (scores.get(uuid) || 0) + 1 / (RRF_K + rank + 1));
    });
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([uuid, score]) => ({ ...rows.get(uuid), _score: score }));
}

export async function searchNodes({ query, groupIds, limit = 10, centerNodeUuids = null }) {
  const qvec = await embedOne(query);
  const [vec, fts] = await Promise.all([
    vectorSearchNodes(qvec, groupIds, limit * 2),
    ftsSearchNodes(query, groupIds, limit * 2),
  ]);
  let merged = rrf([vec, fts]);

  if (centerNodeUuids?.length) {
    const neighbors = await graphWalk(centerNodeUuids, 2, groupIds);
    const boost = new Set(neighbors.map(n => n.uuid));
    merged = merged.map(r => boost.has(r.uuid) ? { ...r, _score: r._score * 1.5 } : r)
      .sort((a, b) => b._score - a._score);
  }

  return merged.slice(0, limit);
}

export async function searchEdges({ query, groupIds, limit = 10, centerNodeUuids = null }) {
  const qvec = await embedOne(query);
  const [vec, fts] = await Promise.all([
    vectorSearchEdges(qvec, groupIds, limit * 2),
    ftsSearchEdges(query, groupIds, limit * 2),
  ]);
  let merged = rrf([vec, fts]);

  if (centerNodeUuids?.length) {
    const uuidSet = new Set(centerNodeUuids);
    merged = merged.map(r =>
      uuidSet.has(r.source_node_uuid) || uuidSet.has(r.target_node_uuid)
        ? { ...r, _score: r._score * 1.5 } : r
    ).sort((a, b) => b._score - a._score);
  }

  return merged.slice(0, limit);
}

export async function search({ query, groupIds, limit = 10, centerNodeUuids = null }) {
  const [nodes, edges] = await Promise.all([
    searchNodes({ query, groupIds, limit, centerNodeUuids }),
    searchEdges({ query, groupIds, limit, centerNodeUuids }),
  ]);
  return { nodes, edges };
}
