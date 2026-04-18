import { Graphiti } from './src/index.js';
import { getLLM } from './src/llm.js';
import {
  NODE_HYBRID_SEARCH_RRF, NODE_HYBRID_SEARCH_MMR, EDGE_HYBRID_SEARCH_RRF,
  COMBINED_HYBRID_SEARCH_RRF,
} from './src/search-recipes.js';
import { rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import assert from 'node:assert';

const dbPath = resolve('.bundag-test.db');
if (existsSync(dbPath)) rmSync(dbPath);

console.log('[test] init');
const g = new Graphiti({ dbPath, groupId: 'test' });
await g.init();

console.log('[test] embed sanity');
const { embedOne, EMBED_DIM } = await import('./src/embeddings.js');
const v = await embedOne('hello world');
assert.equal(v.length, EMBED_DIM);

console.log('[test] store round-trip');
const { upsertEntityNode, vectorSearchNodes, ftsSearchNodes } = await import('./src/store.js');
await upsertEntityNode({
  uuid: 'n1', group_id: 'test', name: 'Alice', summary: '', labels: [], attributes: {},
  name_embedding: v, created_at: new Date().toISOString(),
});
assert.ok((await vectorSearchNodes(v, ['test'], 5)).length >= 1);
assert.ok((await ftsSearchNodes('Alice', ['test'], 5)).length >= 1);

if (process.env.BUNDAG_SKIP_LLM) {
  console.log('[test] skipping LLM tests'); try { await getLLM().close(); } catch {} process.exit(0);
}

console.log('[test] addEpisode via ACP...');
const r1 = await g.addEpisode({
  content: 'Alice Johnson joined Acme Corp as a software engineer in March 2024. She works from their Denver office.',
  source: 'text',
});
console.log('  ep1 uuid', r1.episode.uuid, 'nodes', r1.nodes.length, 'edges', r1.edges.length);
assert.ok(r1.nodes.length >= 2 && r1.edges.length >= 1);

const r2 = await g.addEpisode({
  content: 'Alice Johnson was promoted to senior engineer at Acme Corp in January 2025.',
  source: 'text',
});
console.log('  ep2', r2.episode.uuid, 'nodes', r2.nodes.length, 'edges', r2.edges.length);

console.log('[test] combined RRF search');
const combined = await g.search('What is Alice role?', { config: COMBINED_HYBRID_SEARCH_RRF, limit: 5 });
console.log('  nodes:', combined.nodes.map(n => n.name));
console.log('  edges:', combined.edges.map(e => e.fact));
assert.ok(combined.nodes.length + combined.edges.length > 0);

console.log('[test] search recipes: node MMR');
const mmrNodes = await g.search('Alice', { config: NODE_HYBRID_SEARCH_MMR, limit: 5 });
assert.ok(mmrNodes.nodes.length >= 1);

console.log('[test] addTriplet');
const t = await g.addTriplet({
  sourceName: 'Alice Johnson', relation: 'USES', targetName: 'Python',
  fact: 'Alice Johnson uses Python at work.',
});
assert.ok(t.edges.length === 1);

console.log('[test] buildCommunities');
const communities = await g.buildCommunities();
console.log('  communities:', communities.length);

console.log('[test] createSaga + episodes linkage');
const saga = await g.createSaga({ name: 'Alice at Acme' });
await g.addEpisode({
  content: 'Alice Johnson led the payments platform team at Acme Corp.',
  source: 'text', sagaUuid: saga.uuid,
});
const epsInSaga = await g.getSagaEpisodes(saga.uuid);
console.log('  saga episodes:', epsInSaga.length);
assert.ok(epsInSaga.length >= 1);

console.log('[test] summarizeSaga');
const summarized = await g.summarizeSaga(saga.uuid);
console.log('  summary:', summarized.summary?.slice(0, 80));

console.log('[test] searchEpisodes BM25');
const ep = await g.searchEpisodes('promoted');
assert.ok(ep.length >= 1);

console.log('[test] getNodesAndEdgesByEpisode');
const epDetail = await g.getNodesAndEdgesByEpisode(r1.episode.uuid);
assert.ok(epDetail.nodes.length >= 1);

try { await getLLM().close(); } catch {}
console.log('[test] OK');
process.exit(0);
