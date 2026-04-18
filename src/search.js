import { embedOne } from './embeddings.js';
import {
  vectorSearchNodes, vectorSearchEdges, ftsSearchNodes, ftsSearchEdges, getDb, graphWalk,
} from './store.js';
import {
  rrf, mmr, nodeDistanceRerank, episodeMentionsRerank, cos,
} from './search-utils.js';
import { crossEncoderRerank } from './rerankers.js';
import {
  SearchConfig, NodeSearchConfig, EdgeSearchConfig, CommunitySearchConfig, EpisodeSearchConfig,
  NodeReranker, EdgeReranker, CommunityReranker, DEFAULT_SEARCH_LIMIT,
} from './search-config.js';
import { SearchFilters } from './search-filters.js';

async function runReranker(query, items, reranker, { queryVec = null, mmrLambda = 0.5, centerNodeUuids = null, field = 'name_embedding', limit = 10 } = {}) {
  if (!items.length) return items;
  switch (reranker) {
    case 'mmr':
      return mmr(items, queryVec, mmrLambda, limit, field).slice(0, limit);
    case 'node_distance':
      return nodeDistanceRerank(items, centerNodeUuids).slice(0, limit);
    case 'episode_mentions':
      return (await episodeMentionsRerank(items, centerNodeUuids || [])).slice(0, limit);
    case 'cross_encoder':
      return (await crossEncoderRerank(query, items, field.includes('fact') ? 'fact' : 'name')).slice(0, limit);
    case 'rrf':
    default:
      return items.slice(0, limit);
  }
}

async function searchCommunitiesVec(queryVec, groupIds, limit) {
  const db = getDb();
  const r = await db.execute({
    sql: `SELECT * FROM community_node WHERE group_id IN (${groupIds.map(() => '?').join(',')}) LIMIT ?`,
    args: [...groupIds, limit],
  });
  return r.rows;
}

async function searchCommunitiesFts(query, groupIds, limit) {
  // community table not in FTS; fallback to LIKE
  const db = getDb();
  const r = await db.execute({
    sql: `SELECT * FROM community_node WHERE group_id IN (${groupIds.map(() => '?').join(',')}) AND (name LIKE ? OR summary LIKE ?) LIMIT ?`,
    args: [...groupIds, `%${query}%`, `%${query}%`, limit],
  });
  return r.rows;
}

async function searchEpisodesFts(query, groupIds, limit) {
  const db = getDb();
  const ftsQ = query.replace(/"/g, '""').split(/\s+/).filter(Boolean).map(t => `"${t}"*`).join(' OR ') || query;
  const r = await db.execute({
    sql: `SELECT e.*, bm25(episodic_node_fts) AS score
          FROM episodic_node_fts f JOIN episodic_node e ON e.uuid = f.uuid
          WHERE episodic_node_fts MATCH ?
          ${groupIds?.length ? `AND e.group_id IN (${groupIds.map(() => '?').join(',')})` : ''}
          ORDER BY score LIMIT ?`,
    args: [ftsQ, ...(groupIds || []), limit],
  });
  return r.rows;
}

export async function search({ query, groupIds = null, config = null, centerNodeUuids = null, filters = null, limit = null } = {}) {
  const sc = config || new SearchConfig({
    nodeConfig: new NodeSearchConfig({}),
    edgeConfig: new EdgeSearchConfig({}),
  });
  const qLimit = limit || sc.limit || DEFAULT_SEARCH_LIMIT;

  const qvec = await embedOne(query);

  const out = { nodes: [], edges: [], communities: [], episodes: [] };

  if (sc.nodeConfig) {
    const [vec, fts] = await Promise.all([
      sc.nodeConfig.search_methods.includes('cosine') ? vectorSearchNodes(qvec, groupIds, qLimit * 2) : [],
      sc.nodeConfig.search_methods.includes('bm25') ? ftsSearchNodes(query, groupIds, qLimit * 2) : [],
    ]);
    let merged = rrf([vec, fts]);
    merged = await runReranker(query, merged, sc.nodeConfig.reranker, {
      queryVec: qvec, mmrLambda: sc.nodeConfig.mmr_lambda, centerNodeUuids,
      field: 'name_embedding', limit: qLimit,
    });
    out.nodes = merged.slice(0, qLimit);
  }

  if (sc.edgeConfig) {
    const [vec, fts] = await Promise.all([
      sc.edgeConfig.search_methods.includes('cosine') ? vectorSearchEdges(qvec, groupIds, qLimit * 2) : [],
      sc.edgeConfig.search_methods.includes('bm25') ? ftsSearchEdges(query, groupIds, qLimit * 2) : [],
    ]);
    let merged = rrf([vec, fts]);
    merged = await runReranker(query, merged, sc.edgeConfig.reranker, {
      queryVec: qvec, mmrLambda: sc.edgeConfig.mmr_lambda, centerNodeUuids,
      field: 'fact_embedding', limit: qLimit,
    });
    out.edges = merged.slice(0, qLimit);
  }

  if (sc.communityConfig) {
    const [vec, fts] = await Promise.all([
      sc.communityConfig.search_methods.includes('cosine') ? searchCommunitiesVec(qvec, groupIds || ['default'], qLimit * 2) : [],
      sc.communityConfig.search_methods.includes('bm25') ? searchCommunitiesFts(query, groupIds || ['default'], qLimit * 2) : [],
    ]);
    let merged = rrf([vec, fts]);
    merged = await runReranker(query, merged, sc.communityConfig.reranker, {
      queryVec: qvec, mmrLambda: 0.5, field: 'name_embedding', limit: qLimit,
    });
    out.communities = merged.slice(0, qLimit);
  }

  if (sc.episodeConfig) {
    const eps = await searchEpisodesFts(query, groupIds, qLimit);
    out.episodes = eps;
  }

  return out;
}

export async function searchNodes(args) {
  const sc = new SearchConfig({ nodeConfig: new NodeSearchConfig({}), limit: args.limit || DEFAULT_SEARCH_LIMIT });
  const r = await search({ ...args, config: sc });
  return r.nodes;
}

export async function searchEdges(args) {
  const sc = new SearchConfig({ edgeConfig: new EdgeSearchConfig({}), limit: args.limit || DEFAULT_SEARCH_LIMIT });
  const r = await search({ ...args, config: sc });
  return r.edges;
}

export async function searchCommunities(args) {
  const sc = new SearchConfig({ communityConfig: new CommunitySearchConfig({}), limit: args.limit || 3 });
  const r = await search({ ...args, config: sc });
  return r.communities;
}

export async function searchEpisodes(args) {
  const sc = new SearchConfig({ episodeConfig: new EpisodeSearchConfig({}), limit: args.limit || DEFAULT_SEARCH_LIMIT });
  const r = await search({ ...args, config: sc });
  return r.episodes;
}
