import { pipeline, env } from '@huggingface/transformers';

try {
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.ort = null;
} catch {}

let modelCache = null;

async function getModel() {
  if (modelCache) return modelCache;
  console.error('[bundag] loading embeddings model (first run downloads ~90MB)...');
  modelCache = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  return modelCache;
}

export async function embed(texts) {
  if (!Array.isArray(texts)) texts = [texts];
  if (!texts.length) return [];
  const clean = texts.map(t => (t || '').replace(/\n/g, ' ').slice(0, 8000));
  const model = await getModel();
  const out = await model(clean, { pooling: 'mean', normalize: true });
  const result = [];
  if (out?.data && out.dims?.length === 2) {
    const [bs, d] = out.dims;
    const arr = Array.from(out.data);
    for (let i = 0; i < bs; i++) result.push(arr.slice(i * d, (i + 1) * d));
  } else {
    result.push(Array.from(out.data || out));
  }
  return result;
}

export async function embedOne(text) {
  const [v] = await embed([text]);
  return v;
}

export const EMBED_DIM = 384;
