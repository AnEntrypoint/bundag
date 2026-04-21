import { Graphiti } from './src/index.js';
import { getLLM } from './src/llm.js';
import { rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import assert from 'node:assert';
import { embedOne } from './src/embeddings.js';

const dbPath = resolve('.bundag-test.db');
if (existsSync(dbPath)) rmSync(dbPath);
if (existsSync(dbPath + '-wal')) rmSync(dbPath + '-wal');
if (existsSync(dbPath + '-shm')) rmSync(dbPath + '-shm');

console.log('[test] validation schemas');
const { validate, HttpSearchInput } = await import('./src/validation.js');
assert.equal(validate(HttpSearchInput, { query: 'x' }).ok, true);

console.log('[test] init graph');
const g = new Graphiti({ dbPath, groupId: 'test' });
await g.init();

console.log('[test] embed sanity');
const { EMBED_DIM } = await import('./src/embeddings.js');
const v = await embedOne('hello world');
assert.equal(v.length, EMBED_DIM);

if (process.env.BUNDAG_SKIP_LLM) {
  console.log('[test] OK (offline)');
  process.exit(0);
}

console.log('[test] addEpisode via LLM...');
const ep1 = await g.addEpisode({
  content: 'Alice Johnson joined Acme Corp as a software engineer in March 2024. She works from their Denver office.',
  source: 'text',
});
console.log('[test] result:', { nodes: ep1.nodes.length, edges: ep1.edges.length });
assert.ok(ep1.nodes.length >= 2 && ep1.edges.length >= 1, `Expected >=2 nodes + >=1 edge, got ${ep1.nodes.length} + ${ep1.edges.length}`);

console.log('[test] OK (full)');
process.exit(0);
