#!/usr/bin/env node
import { Graphiti } from './src/index.js';
import { rmSync, existsSync } from 'fs';
import { resolve } from 'path';

const dbPath = resolve('.epoch-research-full.db');
['', '-wal', '-shm'].forEach(ext => {
  const p = dbPath + ext;
  if (existsSync(p)) rmSync(p);
});

const g = new Graphiti({ dbPath, groupId: 'tiger-research' });
await g.init();

const epochs = [
  'Bengal tigers are the most common tiger subspecies found across India, Bangladesh, and Nepal.',
  'Tigers are solitary apex predators that hunt large ungulates like deer, wild boar, and sambar.',
  'A single tiger needs a territory of 50-100 km² depending on prey density and forest type.',
  'Tigers are excellent swimmers and can cross rivers up to 10 km wide.',
  'Tiger cubs stay with their mother for 2-3 years learning hunting and survival skills.',
  'White tigers are rare color variants caused by recessive genes found mainly in captivity.',
  'The Siberian tiger is the largest tiger subspecies weighing up to 300 kg.',
  'Tiger populations have declined by 93% in the past century due to habitat loss and poaching.',
  'A tiger\'s roar can be heard up to 3 km away and serves to mark territory.',
  'Tigers have unique stripe patterns like human fingerprints used for individual identification.'
];

console.log('=== 10-EPOCH TIGER RESEARCH ===\n');
const results = [];
let totalNodes = 0;
let totalEdges = 0;

for (let i = 0; i < epochs.length; i++) {
  const start = Date.now();
  try {
    const ep = await g.addEpisode({ content: epochs[i], source: 'text' });
    const elapsed = Date.now() - start;
    totalNodes += ep.nodes.length;
    totalEdges += ep.edges.length;
    results.push({
      epoch: i + 1,
      nodes: ep.nodes.length,
      edges: ep.edges.length,
      elapsed,
      nodeNames: ep.nodes.map(n => n.name),
    });
    console.log(`[epoch ${i+1}] ✓ ${ep.nodes.length}n ${ep.edges.length}e (${elapsed}ms)`);
  } catch (e) {
    console.log(`[epoch ${i+1}] ✗ ERROR: ${e.message}`);
    process.exit(1);
  }
}

console.log('\n=== SUMMARY ===');
console.log(`Total epochs: ${epochs.length}`);
console.log(`Total nodes: ${totalNodes} (avg: ${(totalNodes/epochs.length).toFixed(1)})`);
console.log(`Total edges: ${totalEdges} (avg: ${(totalEdges/epochs.length).toFixed(1)})`);

console.log('\nPer-epoch breakdown:');
results.forEach(r => {
  console.log(`  Epoch ${r.epoch}: ${r.nodes}n ${r.edges}e (${r.elapsed}ms) - ${r.nodeNames.join(', ')}`);
});

if (totalNodes < epochs.length * 2) {
  console.log('\n⚠ WARNING: Low node extraction (expected >=2 per epoch)');
  process.exit(1);
}

console.log('\n✓ Test passed');
process.exit(0);
