export const DEFAULT_SEARCH_LIMIT = 20;
export const DEFAULT_MIN_SCORE = 0.0;

export const NodeSearchMethod = { bm25: 'bm25', cosine: 'cosine' };
export const EdgeSearchMethod = { bm25: 'bm25', cosine: 'cosine' };
export const CommunitySearchMethod = { bm25: 'bm25', cosine: 'cosine' };
export const EpisodeSearchMethod = { bm25: 'bm25' };

export const NodeReranker = { rrf: 'rrf', mmr: 'mmr', node_distance: 'node_distance', cross_encoder: 'cross_encoder', episode_mentions: 'episode_mentions' };
export const EdgeReranker = { rrf: 'rrf', mmr: 'mmr', node_distance: 'node_distance', cross_encoder: 'cross_encoder', episode_mentions: 'episode_mentions' };
export const CommunityReranker = { rrf: 'rrf', mmr: 'mmr', cross_encoder: 'cross_encoder' };

export class SearchConfig {
  constructor({
    nodeConfig = null,
    edgeConfig = null,
    communityConfig = null,
    episodeConfig = null,
    limit = DEFAULT_SEARCH_LIMIT,
    reranker_min_score = DEFAULT_MIN_SCORE,
  } = {}) {
    this.nodeConfig = nodeConfig;
    this.edgeConfig = edgeConfig;
    this.communityConfig = communityConfig;
    this.episodeConfig = episodeConfig;
    this.limit = limit;
    this.reranker_min_score = reranker_min_score;
  }
}

export class NodeSearchConfig {
  constructor({ search_methods = [NodeSearchMethod.bm25, NodeSearchMethod.cosine], reranker = NodeReranker.rrf, mmr_lambda = 0.5 } = {}) {
    this.search_methods = search_methods;
    this.reranker = reranker;
    this.mmr_lambda = mmr_lambda;
  }
}

export class EdgeSearchConfig {
  constructor({ search_methods = [EdgeSearchMethod.bm25, EdgeSearchMethod.cosine], reranker = EdgeReranker.rrf, mmr_lambda = 0.5 } = {}) {
    this.search_methods = search_methods;
    this.reranker = reranker;
    this.mmr_lambda = mmr_lambda;
  }
}

export class CommunitySearchConfig {
  constructor({ search_methods = [CommunitySearchMethod.bm25, CommunitySearchMethod.cosine], reranker = CommunityReranker.rrf } = {}) {
    this.search_methods = search_methods;
    this.reranker = reranker;
  }
}

export class EpisodeSearchConfig {
  constructor({ search_methods = [EpisodeSearchMethod.bm25], reranker = 'rrf' } = {}) {
    this.search_methods = search_methods;
    this.reranker = reranker;
  }
}
