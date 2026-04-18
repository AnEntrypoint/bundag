#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { Graphiti } from './src/graph.js';
import { search } from './src/search.js';
import { deleteEpisode, clearGroup } from './src/store.js';

let g = null;

async function ensure(dbPath) {
  if (g) return g;
  g = new Graphiti({ dbPath });
  await g.init();
  return g;
}

const tools = [
  {
    name: 'add_episode',
    description: 'Add an episode of content to the temporal context graph. Extracts entities and relationships, applies temporal invalidation to conflicting facts.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Episode content' },
        name: { type: 'string', description: 'Short name for the episode' },
        source: { type: 'string', enum: ['message', 'text', 'json'], description: 'Content format' },
        group_id: { type: 'string', description: 'Graph partition id' },
        source_description: { type: 'string' },
        valid_at: { type: 'string', description: 'ISO 8601 timestamp' },
      },
      required: ['content'],
    },
  },
  {
    name: 'search_nodes',
    description: 'Hybrid semantic+keyword search for entity nodes.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        group_id: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_facts',
    description: 'Hybrid search for entity edges (facts). Excludes expired/invalidated facts.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        group_id: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search',
    description: 'Combined hybrid search over nodes and facts.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        group_id: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'delete_episode',
    description: 'Delete an episode by uuid.',
    inputSchema: {
      type: 'object',
      properties: { uuid: { type: 'string' } },
      required: ['uuid'],
    },
  },
  {
    name: 'clear_graph',
    description: 'Delete all nodes and edges in a group.',
    inputSchema: {
      type: 'object',
      properties: { group_id: { type: 'string' } },
    },
  },
];

function text(payload) {
  return { content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2) }] };
}
function err(msg) { return { content: [{ type: 'text', text: msg }], isError: true }; }

export async function startMcpServer(dbPath = resolve('bundag.db')) {
  const server = new Server({ name: 'bundag', version: '0.1.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    try {
      const graph = await ensure(dbPath);
      const gid = args.group_id || 'default';

      if (name === 'add_episode') {
        const r = await graph.addEpisode({
          content: args.content, name: args.name,
          source: args.source || 'message',
          sourceDescription: args.source_description || '',
          validAt: args.valid_at, groupId: gid,
        });
        return text({ episode_uuid: r.episode.uuid, nodes: r.nodes, edges: r.edges });
      }
      if (name === 'search_nodes') {
        const r = await search({ query: args.query, groupIds: [gid], limit: args.limit || 10 });
        return text(r.nodes);
      }
      if (name === 'search_facts') {
        const r = await search({ query: args.query, groupIds: [gid], limit: args.limit || 10 });
        return text(r.edges);
      }
      if (name === 'search') {
        const r = await search({ query: args.query, groupIds: [gid], limit: args.limit || 10 });
        return text(r);
      }
      if (name === 'delete_episode') { await deleteEpisode(args.uuid); return text({ deleted: args.uuid }); }
      if (name === 'clear_graph') { await clearGroup(gid); return text({ cleared: gid }); }

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
