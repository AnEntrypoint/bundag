#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { Graphiti } from './src/graph.js';

let g = null;
async function ensure(dbPath) {
  if (g) return g;
  g = new Graphiti({ dbPath });
  await g.init();
  return g;
}

const tools = [
  { name: 'add_episode', description: 'Add an episode to the temporal context graph. Extracts entities + facts, dedupes, invalidates contradicted facts.', inputSchema: { type: 'object', required: ['content'], properties: { content: { type: 'string' }, name: { type: 'string' }, source: { type: 'string', enum: ['message', 'text', 'json'] }, group_id: { type: 'string' }, source_description: { type: 'string' }, valid_at: { type: 'string' }, saga_uuid: { type: 'string' }, update_communities: { type: 'boolean' } } } },
  { name: 'add_episode_bulk', description: 'Bulk add episodes with cross-episode dedupe.', inputSchema: { type: 'object', required: ['episodes'], properties: { episodes: { type: 'array', items: { type: 'object', properties: { content: { type: 'string' }, name: { type: 'string' }, source: { type: 'string' }, valid_at: { type: 'string' } } } }, group_id: { type: 'string' } } } },
  { name: 'add_triplet', description: 'Add a source-relation-target triplet directly.', inputSchema: { type: 'object', required: ['sourceName', 'relation', 'targetName'], properties: { sourceName: { type: 'string' }, relation: { type: 'string' }, targetName: { type: 'string' }, fact: { type: 'string' }, group_id: { type: 'string' }, valid_at: { type: 'string' } } } },
  { name: 'search', description: 'Combined hybrid search over nodes + edges + communities + episodes.', inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, group_id: { type: 'string' }, limit: { type: 'number' }, center_node_uuids: { type: 'array', items: { type: 'string' } }, reranker: { type: 'string', enum: ['rrf', 'mmr', 'node_distance', 'episode_mentions', 'cross_encoder'] } } } },
  { name: 'search_nodes', description: 'Hybrid search for entity nodes.', inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, group_id: { type: 'string' }, limit: { type: 'number' }, center_node_uuids: { type: 'array' }, reranker: { type: 'string' } } } },
  { name: 'search_facts', description: 'Hybrid search for entity edges (facts). Excludes expired.', inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, group_id: { type: 'string' }, limit: { type: 'number' }, center_node_uuids: { type: 'array' }, reranker: { type: 'string' } } } },
  { name: 'search_communities', description: 'Search community summaries.', inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, group_id: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'search_episodes', description: 'Search episode content via BM25.', inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, group_id: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'get_episodes', description: 'Retrieve most recent episodes.', inputSchema: { type: 'object', properties: { group_id: { type: 'string' }, limit: { type: 'number' }, reference_time: { type: 'string' } } } },
  { name: 'get_node', description: 'Fetch node by uuid.', inputSchema: { type: 'object', required: ['uuid'], properties: { uuid: { type: 'string' } } } },
  { name: 'get_edge', description: 'Fetch edge by uuid.', inputSchema: { type: 'object', required: ['uuid'], properties: { uuid: { type: 'string' } } } },
  { name: 'get_episode', description: 'Fetch episode by uuid with its nodes and edges.', inputSchema: { type: 'object', required: ['uuid'], properties: { uuid: { type: 'string' } } } },
  { name: 'build_communities', description: 'Run label propagation to build/refresh communities.', inputSchema: { type: 'object', properties: { group_id: { type: 'string' } } } },
  { name: 'remove_communities', description: 'Delete all communities in a group.', inputSchema: { type: 'object', properties: { group_id: { type: 'string' } } } },
  { name: 'create_saga', description: 'Create a saga (conversation thread).', inputSchema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, group_id: { type: 'string' }, summary: { type: 'string' } } } },
  { name: 'summarize_saga', description: 'Summarize a saga from its episodes.', inputSchema: { type: 'object', required: ['uuid'], properties: { uuid: { type: 'string' } } } },
  { name: 'delete_episode', description: 'Delete an episode by uuid.', inputSchema: { type: 'object', required: ['uuid'], properties: { uuid: { type: 'string' } } } },
  { name: 'delete_entity_edge', description: 'Delete an entity edge by uuid.', inputSchema: { type: 'object', required: ['uuid'], properties: { uuid: { type: 'string' } } } },
  { name: 'delete_entity_node', description: 'Delete an entity node and its incident edges.', inputSchema: { type: 'object', required: ['uuid'], properties: { uuid: { type: 'string' } } } },
  { name: 'clear_graph', description: 'Delete all data in a group (or entire db).', inputSchema: { type: 'object', properties: { group_id: { type: 'string' } } } },
];

function text(payload) { return { content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2) }] }; }
function err(msg) { return { content: [{ type: 'text', text: msg }], isError: true }; }

export async function startMcpServer(dbPath = resolve('bundag.db')) {
  const server = new Server({ name: 'bundag', version: '0.2.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    try {
      const graph = await ensure(dbPath);
      const gid = args.group_id;

      if (name === 'add_episode') {
        const r = await graph.addEpisode({
          content: args.content, name: args.name,
          source: args.source || 'message',
          sourceDescription: args.source_description || '',
          validAt: args.valid_at, groupId: gid,
          sagaUuid: args.saga_uuid, updateCommunities: args.update_communities || false,
        });
        return text({ episode_uuid: r.episode.uuid, nodes: r.nodes, edges: r.edges });
      }
      if (name === 'add_episode_bulk') {
        const r = await graph.addEpisodeBulk({ episodes: args.episodes, groupId: gid });
        return text({ episodes: r.episodes.length, nodes: r.nodes.length, edges: r.edges.length });
      }
      if (name === 'add_triplet') {
        const r = await graph.addTriplet({
          sourceName: args.sourceName, relation: args.relation, targetName: args.targetName,
          fact: args.fact, groupId: gid, validAt: args.valid_at,
        });
        return text(r);
      }
      if (name === 'search') {
        const r = await graph.search(args.query, {
          groupIds: gid ? [gid] : undefined, limit: args.limit || 10,
          centerNodeUuids: args.center_node_uuids,
        });
        return text(r);
      }
      if (name === 'search_nodes') {
        return text(await graph.searchNodes(args.query, { groupIds: gid ? [gid] : undefined, limit: args.limit || 10, centerNodeUuids: args.center_node_uuids }));
      }
      if (name === 'search_facts') {
        return text(await graph.searchEdges(args.query, { groupIds: gid ? [gid] : undefined, limit: args.limit || 10, centerNodeUuids: args.center_node_uuids }));
      }
      if (name === 'search_communities') {
        return text(await graph.searchCommunities(args.query, { groupIds: gid ? [gid] : undefined, limit: args.limit || 3 }));
      }
      if (name === 'search_episodes') {
        return text(await graph.searchEpisodes(args.query, { groupIds: gid ? [gid] : undefined, limit: args.limit || 10 }));
      }
      if (name === 'get_episodes') {
        return text(await graph.retrieveEpisodes({ groupIds: gid ? [gid] : undefined, limit: args.limit || 3, referenceTime: args.reference_time }));
      }
      if (name === 'get_node') return text(await graph.getNodeByUuid(args.uuid));
      if (name === 'get_edge') return text(await graph.getEdgeByUuid(args.uuid));
      if (name === 'get_episode') return text(await graph.getNodesAndEdgesByEpisode(args.uuid));
      if (name === 'build_communities') return text(await graph.buildCommunities({ groupIds: gid ? [gid] : undefined }));
      if (name === 'remove_communities') { await graph.removeCommunities({ groupIds: gid ? [gid] : undefined }); return text({ ok: true }); }
      if (name === 'create_saga') return text(await graph.createSaga({ name: args.name, groupId: gid, summary: args.summary }));
      if (name === 'summarize_saga') return text(await graph.summarizeSaga(args.uuid));
      if (name === 'delete_episode') { await graph.deleteEpisode(args.uuid); return text({ deleted: args.uuid }); }
      if (name === 'delete_entity_edge') { await graph.deleteEntityEdge(args.uuid); return text({ deleted: args.uuid }); }
      if (name === 'delete_entity_node') { await graph.deleteEntityNode(args.uuid); return text({ deleted: args.uuid }); }
      if (name === 'clear_graph') { await graph.clearGraph({ groupIds: gid ? [gid] : null }); return text({ cleared: gid || 'all' }); }

      return err(`Unknown tool: ${name}`);
    } catch (e) {
      return err(`Error: ${e.message}\n${e.stack}`);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[bundag] MCP server ready');
}

const isMain = process.argv[1] && (
  process.argv[1] === fileURLToPath(import.meta.url) ||
  process.argv[1].endsWith('mcp.js') ||
  process.argv[1].endsWith('bundag-mcp')
);

if (isMain) {
  const dbPath = process.env.BUNDAG_DB || resolve('bundag.db');
  startMcpServer(dbPath).catch((e) => { console.error(e); process.exit(1); });
}
