import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { LRUCache } from 'lru-cache';
import { logger } from './logger.js';
import { register } from './debug-registry.js';

const log = logger.child('embeddings');
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
export const EMBED_DIM = 384;

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_MODELS_DIR = process.env.BUNGRAPH_MODELS_DIR || resolve(PKG_ROOT, 'models');
const DTYPE = process.env.BUNGRAPH_EMBED_DTYPE || 'fp32';

let modelCache = null;
const state = { loaded: false, calls: 0, cacheHits: 0, cacheMisses: 0, stub: false };
register('embeddings', () => ({ ...state, cacheSize: cache.size }));

async function getModel() {
  if (modelCache) return modelCache;
  if (process.env.BUNGRAPH_STUB_EMBEDDINGS === '1') {
    state.stub = true;
    state.loaded = true;
    modelCache = { stub: true };
    return modelCache;
  }
  const modelPath = resolve(LOCAL_MODELS_DIR, MODEL_ID);
  if (!existsSync(modelPath)) {
    throw new Error(`Embedding model not found at ${modelPath}. Set BUNGRAPH_MODELS_DIR or reinstall bungraph (models/ should ship with the package).`);
  }
  log.info('loading model', { id: MODEL_ID, path: modelPath, dtype: DTYPE });
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = LOCAL_MODELS_DIR;
  try { env.backends.onnx.wasm.numThreads = 1; env.backends.onnx.ort = null; } catch {}
  modelCache = await pipeline('feature-extraction', MODEL_ID, { dtype: DTYPE });
  state.loaded = true;
  return modelCache;
}

function keyFor(text) {
  return createHash('sha256').update(MODEL_ID).update('\0').update(text.normalize('NFC')).digest('hex');
}

function stubVector(text) {
  const h = createHash('sha256').update(text).digest();
  const out = new Float32Array(EMBED_DIM);
  let norm = 0;
  for (let i = 0; i < EMBED_DIM; i++) { const b = h[i % h.length]; out[i] = (b - 128) / 128; norm += out[i] * out[i]; }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < EMBED_DIM; i++) out[i] /= norm;
  return Array.from(out);
}

const cache = new LRUCache({
  max: 5000,
  fetchMethod: async (_key, _stale, { context }) => {
    state.cacheMisses++;
    const model = await getModel();
    if (model.stub) return stubVector(context.text);
    const out = await model([context.text], { pooling: 'mean', normalize: true });
    const [, d] = out.dims;
    return Array.from(out.data).slice(0, d);
  },
});

export async function embed(texts) {
  if (!Array.isArray(texts)) texts = [texts];
  if (!texts.length) return [];
  state.calls += texts.length;
  const clean = texts.map(t => (t || '').replace(/\n/g, ' ').slice(0, 8000));
  return Promise.all(clean.map(async (text) => {
    const key = keyFor(text);
    const hit = cache.has(key);
    if (hit) state.cacheHits++;
    return cache.fetch(key, { context: { text } });
  }));
}

export async function embedOne(text) {
  const [v] = await embed([text]);
  return v;
}
