#!/usr/bin/env node
import { Graphiti } from '../src/graph.js';
import { search } from '../src/search.js';
import { deleteEpisode, clearGroup, getDb } from '../src/store.js';
import { getLLM } from '../src/llm.js';
import { join, resolve } from 'path';

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
  console.log(`bundag - turnkey temporal context graph (libsql + ACP)

Usage:
  bundag mcp                       Run MCP stdio server
  bundag add "content" [--group=G] [--source=message|text|json]
  bundag search "query" [--group=G] [--limit=10]
  bundag delete-episode <uuid>
  bundag clear [--group=G]

Common:
  --db <path>   libsql file path (default ./bundag.db)

LLM backend: ACP (Agent Client Protocol) via claude-agent-acp using system auth.
No API keys required in env — relies on Claude Code / Anthropic system config.`);
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const cmd = a._[0];
  const dbPath = resolve(a.flags.db || 'bundag.db');
  const group = a.flags.group || 'default';

  if (!cmd || cmd === 'help' || a.flags.help) { help(); return; }
  if (cmd === 'mcp' || a.flags.mcp) {
    const { startMcpServer } = await import('../mcp.js');
    await startMcpServer(dbPath);
    return;
  }

  const g = new Graphiti({ dbPath, groupId: group });
  await g.init();

  if (cmd === 'add') {
    const content = a._[1] || a.flags.content;
    if (!content) { console.error('add: content required'); process.exit(1); }
    const r = await g.addEpisode({
      name: a.flags.name || content.slice(0, 60),
      content, source: a.flags.source || 'message',
      sourceDescription: a.flags['source-description'] || '',
    });
    console.log(JSON.stringify({ episode: r.episode.uuid, nodes: r.nodes.length, edges: r.edges.length }, null, 2));
  } else if (cmd === 'search') {
    const query = a._[1] || a.flags.query;
    if (!query) { console.error('search: query required'); process.exit(1); }
    const r = await search({ query, groupIds: [group], limit: Number(a.flags.limit) || 10 });
    console.log(JSON.stringify(r, null, 2));
  } else if (cmd === 'delete-episode') {
    const uuid = a._[1];
    if (!uuid) { console.error('delete-episode: uuid required'); process.exit(1); }
    await deleteEpisode(uuid);
    console.log('deleted');
  } else if (cmd === 'clear') {
    await clearGroup(group);
    console.log(`cleared group ${group}`);
  } else {
    help(); process.exit(1);
  }

  try { await getLLM().close(); } catch {}
}

main().catch((e) => { console.error(e); process.exit(1); });
