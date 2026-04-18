#!/usr/bin/env node
import { Graphiti } from '../src/graph.js';
import { getLLM } from '../src/llm.js';
import { resolve } from 'path';

function parseArgs(argv) {
  const a = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith('--')) {
      const [k, v] = t.slice(2).split('=');
      a.flags[k] = v !== undefined ? v : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true);
    } else a._.push(t);
  }
  return a;
}

function help() {
  console.log(`bungraph — turnkey temporal context graph (Graphiti port on libsql + ACP)

Default with no args: runs MCP stdio server.

Modes:
  bungraph                              Run MCP stdio server (default)
  bungraph --mcp                        Run MCP stdio server (explicit)
  bungraph --serve [--port 8000]        Run HTTP REST server

Subcommands:
  bungraph add "content" [--name N] [--source message|text|json] [--saga UUID]
  bungraph bulk-add <json-file>
  bungraph triplet "source" "REL" "target" [--fact F]
  bungraph search "query" [--limit 10]
  bungraph search-nodes "q" [--limit N]
  bungraph search-facts "q" [--limit N]
  bungraph search-communities "q"
  bungraph search-episodes "q"
  bungraph episodes [--limit 3]
  bungraph get-node <uuid>
  bungraph get-edge <uuid>
  bungraph get-episode <uuid>
  bungraph build-communities
  bungraph remove-communities
  bungraph create-saga "name"
  bungraph summarize-saga <uuid>
  bungraph delete-episode <uuid>
  bungraph delete-edge <uuid>
  bungraph delete-node <uuid>
  bungraph clear

Common flags:
  --db <path>    libsql file (default ./bungraph.db)
  --group <id>   graph partition (default "default")

No API keys required — uses ACP via @agentclientprotocol/claude-agent-acp with system Claude auth.`);
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const cmd = a._[0];
  const dbPath = resolve(a.flags.db || 'bungraph.db');
  const group = a.flags.group || 'default';

  if (a.flags.help || cmd === 'help') { help(); return; }

  // Default: MCP server. Also triggered by --mcp or `mcp` subcommand.
  if (!cmd && !a.flags.serve && !a.flags.http || a.flags.mcp || cmd === 'mcp') {
    const { startMcpServer } = await import('../mcp.js');
    await startMcpServer(dbPath);
    return;
  }

  if (a.flags.serve || a.flags.http || cmd === 'serve' || cmd === 'http') {
    const { startHttpServer } = await import('../src/http-server.js');
    await startHttpServer({ port: Number(a.flags.port) || 8000, dbPath });
    return;
  }

  const g = new Graphiti({ dbPath, groupId: group });
  await g.init();

  try {
    if (cmd === 'add') {
      const content = a._[1] || a.flags.content;
      if (!content) throw new Error('content required');
      const r = await g.addEpisode({
        name: a.flags.name || content.slice(0, 60),
        content, source: a.flags.source || 'message',
        sourceDescription: a.flags['source-description'] || '',
        sagaUuid: a.flags.saga || null,
        updateCommunities: Boolean(a.flags['update-communities']),
      });
      console.log(JSON.stringify({ episode: r.episode.uuid, nodes: r.nodes.length, edges: r.edges.length }, null, 2));
    } else if (cmd === 'bulk-add') {
      const { readFileSync } = await import('fs');
      const episodes = JSON.parse(readFileSync(a._[1] || 'episodes.json', 'utf8'));
      const r = await g.addEpisodeBulk({ episodes });
      console.log(JSON.stringify({ episodes: r.episodes.length, nodes: r.nodes.length, edges: r.edges.length }, null, 2));
    } else if (cmd === 'triplet') {
      const r = await g.addTriplet({ sourceName: a._[1], relation: a._[2], targetName: a._[3], fact: a.flags.fact });
      console.log(JSON.stringify(r, null, 2));
    } else if (cmd === 'search') {
      const q = a._[1]; if (!q) throw new Error('query required');
      const r = await g.search(q, { limit: Number(a.flags.limit) || 10 });
      console.log(JSON.stringify(r, null, 2));
    } else if (cmd === 'search-nodes') {
      console.log(JSON.stringify(await g.searchNodes(a._[1], { limit: Number(a.flags.limit) || 10 }), null, 2));
    } else if (cmd === 'search-facts') {
      console.log(JSON.stringify(await g.searchEdges(a._[1], { limit: Number(a.flags.limit) || 10 }), null, 2));
    } else if (cmd === 'search-communities') {
      console.log(JSON.stringify(await g.searchCommunities(a._[1], { limit: Number(a.flags.limit) || 3 }), null, 2));
    } else if (cmd === 'search-episodes') {
      console.log(JSON.stringify(await g.searchEpisodes(a._[1], { limit: Number(a.flags.limit) || 10 }), null, 2));
    } else if (cmd === 'episodes') {
      console.log(JSON.stringify(await g.retrieveEpisodes({ limit: Number(a.flags.limit) || 3 }), null, 2));
    } else if (cmd === 'get-node') { console.log(JSON.stringify(await g.getNodeByUuid(a._[1]), null, 2)); }
    else if (cmd === 'get-edge') { console.log(JSON.stringify(await g.getEdgeByUuid(a._[1]), null, 2)); }
    else if (cmd === 'get-episode') { console.log(JSON.stringify(await g.getNodesAndEdgesByEpisode(a._[1]), null, 2)); }
    else if (cmd === 'build-communities') { console.log(JSON.stringify(await g.buildCommunities(), null, 2)); }
    else if (cmd === 'remove-communities') { await g.removeCommunities(); console.log('ok'); }
    else if (cmd === 'create-saga') { console.log(JSON.stringify(await g.createSaga({ name: a._[1] }), null, 2)); }
    else if (cmd === 'summarize-saga') { console.log(JSON.stringify(await g.summarizeSaga(a._[1]), null, 2)); }
    else if (cmd === 'delete-episode') { await g.deleteEpisode(a._[1]); console.log('deleted'); }
    else if (cmd === 'delete-edge') { await g.deleteEntityEdge(a._[1]); console.log('deleted'); }
    else if (cmd === 'delete-node') { await g.deleteEntityNode(a._[1]); console.log('deleted'); }
    else if (cmd === 'clear') { await g.clearGraph({ groupIds: [group] }); console.log(`cleared ${group}`); }
    else { help(); process.exit(1); }
  } finally {
    try { await getLLM().close(); } catch {}
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
