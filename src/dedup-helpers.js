const MIN_NAME_LEN = 2;
const EXACT_MATCH_BONUS = 1.0;
const TOP_K_NAMES = 10;

export function normalizeExact(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeLoose(s) {
  return normalizeExact(s).replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
}

export function buildCandidateIndexes(existingNodes) {
  const byUuid = new Map();
  const byExact = new Map();
  const byLoose = new Map();
  for (const n of existingNodes) {
    byUuid.set(n.uuid, n);
    const e = normalizeExact(n.name);
    const l = normalizeLoose(n.name);
    if (!byExact.has(e)) byExact.set(e, n);
    if (!byLoose.has(l)) byLoose.set(l, n);
  }
  return { existingNodes, byUuid, byExact, byLoose };
}

export function promoteResolvedNode(extracted, existing) {
  return {
    ...existing,
    name: existing.name.length >= extracted.name.length ? existing.name : extracted.name,
    labels: Array.from(new Set([...(existing.labels || []), ...(extracted.labels || [])])),
    attributes: { ...(existing.attributes || {}), ...(extracted.attributes || {}) },
  };
}

export function resolveWithSimilarity(extractedNodes, indexes, state) {
  for (let i = 0; i < extractedNodes.length; i++) {
    const n = extractedNodes[i];
    const exact = indexes.byExact.get(normalizeExact(n.name));
    if (exact) {
      state.resolvedNodes[i] = promoteResolvedNode(n, exact);
      state.uuidMap[n.uuid] = exact.uuid;
      if (exact.uuid !== n.uuid) state.duplicatePairs.push([n, exact]);
      continue;
    }
    const loose = indexes.byLoose.get(normalizeLoose(n.name));
    if (loose && normalizeLoose(n.name).length >= MIN_NAME_LEN) {
      state.resolvedNodes[i] = promoteResolvedNode(n, loose);
      state.uuidMap[n.uuid] = loose.uuid;
      if (loose.uuid !== n.uuid) state.duplicatePairs.push([n, loose]);
      continue;
    }
  }
}

export function createDedupState(size) {
  return { resolvedNodes: new Array(size).fill(null), uuidMap: {}, unresolvedIndices: [], duplicatePairs: [] };
}
