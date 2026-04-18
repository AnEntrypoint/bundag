import {
  SearchConfig, NodeSearchConfig, EdgeSearchConfig, CommunitySearchConfig, EpisodeSearchConfig,
  NodeReranker, EdgeReranker, CommunityReranker, NodeSearchMethod, EdgeSearchMethod, CommunitySearchMethod,
} from './search-config.js';

export const NODE_HYBRID_SEARCH_RRF = new SearchConfig({
  nodeConfig: new NodeSearchConfig({ reranker: NodeReranker.rrf }),
  limit: 10,
});

export const NODE_HYBRID_SEARCH_MMR = new SearchConfig({
  nodeConfig: new NodeSearchConfig({ reranker: NodeReranker.mmr, mmr_lambda: 0.5 }),
  limit: 10,
});

export const NODE_HYBRID_SEARCH_NODE_DISTANCE = new SearchConfig({
  nodeConfig: new NodeSearchConfig({ reranker: NodeReranker.node_distance }),
  limit: 10,
});

export const NODE_HYBRID_SEARCH_EPISODE_MENTIONS = new SearchConfig({
  nodeConfig: new NodeSearchConfig({ reranker: NodeReranker.episode_mentions }),
  limit: 10,
});

export const NODE_HYBRID_SEARCH_CROSS_ENCODER = new SearchConfig({
  nodeConfig: new NodeSearchConfig({ reranker: NodeReranker.cross_encoder }),
  limit: 10,
});

export const EDGE_HYBRID_SEARCH_RRF = new SearchConfig({
  edgeConfig: new EdgeSearchConfig({ reranker: EdgeReranker.rrf }),
  limit: 10,
});

export const EDGE_HYBRID_SEARCH_MMR = new SearchConfig({
  edgeConfig: new EdgeSearchConfig({ reranker: EdgeReranker.mmr, mmr_lambda: 0.5 }),
  limit: 10,
});

export const EDGE_HYBRID_SEARCH_NODE_DISTANCE = new SearchConfig({
  edgeConfig: new EdgeSearchConfig({ reranker: EdgeReranker.node_distance }),
  limit: 10,
});

export const EDGE_HYBRID_SEARCH_EPISODE_MENTIONS = new SearchConfig({
  edgeConfig: new EdgeSearchConfig({ reranker: EdgeReranker.episode_mentions }),
  limit: 10,
});

export const EDGE_HYBRID_SEARCH_CROSS_ENCODER = new SearchConfig({
  edgeConfig: new EdgeSearchConfig({ reranker: EdgeReranker.cross_encoder }),
  limit: 10,
});

export const COMMUNITY_HYBRID_SEARCH_RRF = new SearchConfig({
  communityConfig: new CommunitySearchConfig({ reranker: CommunityReranker.rrf }),
  limit: 3,
});

export const COMMUNITY_HYBRID_SEARCH_MMR = new SearchConfig({
  communityConfig: new CommunitySearchConfig({ reranker: CommunityReranker.mmr }),
  limit: 3,
});

export const COMMUNITY_HYBRID_SEARCH_CROSS_ENCODER = new SearchConfig({
  communityConfig: new CommunitySearchConfig({ reranker: CommunityReranker.cross_encoder }),
  limit: 3,
});

export const COMBINED_HYBRID_SEARCH_RRF = new SearchConfig({
  nodeConfig: new NodeSearchConfig({ reranker: NodeReranker.rrf }),
  edgeConfig: new EdgeSearchConfig({ reranker: EdgeReranker.rrf }),
  communityConfig: new CommunitySearchConfig({ reranker: CommunityReranker.rrf }),
  limit: 10,
});

export const COMBINED_HYBRID_SEARCH_MMR = new SearchConfig({
  nodeConfig: new NodeSearchConfig({ reranker: NodeReranker.mmr, mmr_lambda: 0.5 }),
  edgeConfig: new EdgeSearchConfig({ reranker: EdgeReranker.mmr, mmr_lambda: 0.5 }),
  communityConfig: new CommunitySearchConfig({ reranker: CommunityReranker.mmr }),
  limit: 10,
});

export const COMBINED_HYBRID_SEARCH_CROSS_ENCODER = new SearchConfig({
  nodeConfig: new NodeSearchConfig({ reranker: NodeReranker.cross_encoder }),
  edgeConfig: new EdgeSearchConfig({ reranker: EdgeReranker.cross_encoder }),
  communityConfig: new CommunitySearchConfig({ reranker: CommunityReranker.cross_encoder }),
  limit: 10,
});

export const EPISODE_HYBRID_SEARCH_RRF = new SearchConfig({
  episodeConfig: new EpisodeSearchConfig({ reranker: 'rrf' }),
  limit: 10,
});
