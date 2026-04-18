# bundag

Turnkey temporal context graph on libsql for AI agents. A faithful port of [Graphiti](https://github.com/getzep/graphiti) built on:

- **libsql** — single-file embedded graph + vector (F32_BLOB + `vector_top_k`) + FTS5 keyword search. Zero external servers.
- **Local embeddings** — `Xenova/all-MiniLM-L6-v2` (384d) via transformers.js. No API keys.
- **LLM via ACP** — entity/edge extraction, dedupe, and temporal resolution driven through the [Agent Client Protocol](https://agentclientprotocol.com) using `@agentclientprotocol/claude-agent-acp`. Uses your existing Claude Code / system authentication. **No ANTHROPIC_API_KEY env var required.**

## Quick start

```bash
bunx bundag add "Alice joined Acme Corp as a software engineer in March 2024."
bunx bundag add "Alice was promoted to senior engineer at Acme Corp."
bunx bundag search "What is Alice's current role?"
```

MCP server for Claude Code / Cursor:

```bash
bunx bundag mcp
# or add as a permanent MCP server:
claude mcp add -s user bundag -- bunx bundag mcp
```

## Commands

```
bundag mcp                       Run MCP stdio server
bundag add "content" [--group=G] [--source=message|text|json]
bundag search "query" [--group=G] [--limit=10]
bundag delete-episode <uuid>
bundag clear [--group=G]
```

Common flags:
- `--db <path>` — libsql file path (default `./bundag.db`)
- `--group <id>` — graph partition (default `default`)

## MCP tools

- `add_episode` — ingest content, extract entities + facts, apply temporal invalidation
- `search_nodes` — hybrid semantic+keyword entity search
- `search_facts` — hybrid fact (edge) search, excludes expired facts
- `search` — combined nodes + facts
- `delete_episode` — remove an episode by uuid
- `clear_graph` — wipe a group

## How it works

Each episode you add goes through:

1. **Entity extraction** — LLM extracts named entities via ACP
2. **Dedupe** — vector-similar existing nodes surfaced, LLM decides matches
3. **Edge extraction** — LLM extracts fact triples between the resolved entities with ISO-8601 validity windows
4. **Temporal resolution** — LLM detects contradictions with existing edges; contradicted edges get `expired_at` set, duplicates are skipped
5. **Persistence** — all nodes/edges written to libsql with vector + FTS indices

Search combines vector similarity (`vector_top_k` over F32 embeddings) with BM25 (FTS5) via Reciprocal Rank Fusion.

## Architecture vs. upstream Graphiti

| Aspect | Graphiti (Python) | bundag |
|---|---|---|
| Graph DB | Neo4j/Kuzu/FalkorDB/Neptune | libsql (single file) |
| Vector | Provider-specific | libsql F32_BLOB + vector_top_k |
| Keyword | Lucene/FTS | libsql FTS5 |
| LLM | OpenAI/Anthropic/Gemini/Groq SDK | ACP (system auth, no keys) |
| Embeddings | OpenAI/Voyage/Gemini | transformers.js (local, offline) |
| Runtime | Python 3.10+ | bun/node 18+ |

## License

Apache-2.0
