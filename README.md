# bungraph

Turnkey temporal context graph on libsql for AI agents. A 1:1 JavaScript port of [Graphiti](https://github.com/getzep/graphiti) built on:

- **libsql** — single-file embedded graph + vector (F32_BLOB + `vector_top_k`) + FTS5 keyword search. Zero external servers.
- **Local embeddings** — `Xenova/all-MiniLM-L6-v2` (384d) via transformers.js. No API keys.
- **LLM via ACP** — entity/edge extraction, dedupe, temporal resolution, community summaries, saga summaries, and cross-encoder reranking driven through the [Agent Client Protocol](https://agentclientprotocol.com) using `@agentclientprotocol/claude-agent-acp`. Uses your existing Claude Code / system authentication. **No ANTHROPIC_API_KEY env var required.**

## Quick start

One command, three modes. Default is MCP.

```bash
# MCP stdio server (default — for Claude Code, Cursor, IDE plugins)
bunx bungraph
# or explicit:
bunx bungraph --mcp

# HTTP REST server (graphiti upstream server parity)
bunx bungraph --serve --port 8000

# CLI one-shots
bunx bungraph add "Alice Johnson joined Acme Corp as a software engineer in March 2024." --source text
bunx bungraph search "What is Alice's current role?"
```

Register as a permanent MCP server:

```bash
claude mcp add -s user bungraph -- bunx bungraph
```

## MCP tools (20)

Ingestion: `add_episode`, `add_episode_bulk`, `add_triplet`
Search: `search`, `search_nodes`, `search_facts`, `search_communities`, `search_episodes`
Retrieval: `get_episodes`, `get_node`, `get_edge`, `get_episode`
Communities: `build_communities`, `remove_communities`
Sagas: `create_saga`, `summarize_saga`
Mutation: `delete_episode`, `delete_entity_edge`, `delete_entity_node`, `clear_graph`

## HTTP endpoints

`POST /messages` · `POST /entity-node` · `DELETE /entity-edge/:uuid` · `DELETE /group/:gid` · `DELETE /episode/:uuid` · `POST /clear` · `POST /search` · `GET /entity-edge/:uuid` · `GET /episodes/:gid` · `POST /get-memory` · `POST /build-communities` · `POST /triplet` · `GET /healthcheck`

## Pipeline

Each episode goes through:

1. **Entity extraction** — LLM via ACP extracts named entities (message/text/json source-type-specific prompts)
2. **Semantic dedup** — vector-similar existing nodes surfaced via `vector_top_k`, exact/loose-name match first, then LLM dedupe prompt
3. **Edge extraction** — LLM extracts fact triples between resolved entities with ISO-8601 validity windows
4. **Temporal resolution** — LLM detects duplicates + contradictions against existing edges; contradicted edges get `expired_at` + `invalid_at` set
5. **Attribute + summary extraction** — per-entity attribute extraction (if schema provided) + batch entity summaries
6. **Persistence** — nodes/edges written to libsql with vector + FTS indices
7. **Episodic edges** — `MENTIONS` edges created from episode to each resolved node
8. **Optional** — saga linkage (`HAS_EPISODE` + `NEXT_EPISODE`), community refresh

## Search

Combines `vector_top_k` (F32 cosine) + FTS5 (BM25) via Reciprocal Rank Fusion. Rerankers: `rrf`, `mmr`, `node_distance`, `episode_mentions`, `cross_encoder` (via ACP).

16 recipes available from upstream: `NODE_HYBRID_SEARCH_RRF`, `NODE_HYBRID_SEARCH_MMR`, `NODE_HYBRID_SEARCH_NODE_DISTANCE`, `NODE_HYBRID_SEARCH_EPISODE_MENTIONS`, `NODE_HYBRID_SEARCH_CROSS_ENCODER`, `EDGE_HYBRID_SEARCH_*` (5 variants), `COMMUNITY_HYBRID_SEARCH_*` (3 variants), `COMBINED_HYBRID_SEARCH_*` (3 variants), `EPISODE_HYBRID_SEARCH_RRF`.

## Architecture vs. upstream Graphiti

| Aspect | Graphiti (Python) | bungraph |
|---|---|---|
| Graph DB | Neo4j / Kuzu / FalkorDB / Neptune | libsql (single file) |
| Vector | Provider-specific | libsql F32_BLOB + `vector_top_k` |
| Keyword | Provider-specific (Lucene/FTS) | libsql FTS5 |
| LLM | OpenAI / Anthropic / Gemini / Groq SDKs | ACP (no keys) |
| Embeddings | OpenAI / Voyage / Gemini / HF | transformers.js local (offline) |
| Cross-encoder | OpenAI / BGE / Gemini | ACP prompt |
| Runtime | Python 3.10+ | bun / node 18+ |

## License

Apache-2.0
