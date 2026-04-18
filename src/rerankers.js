import { getLLM } from './llm.js';
import { cos, mmr, rrf, nodeDistanceRerank, episodeMentionsRerank } from './search-utils.js';

export async function crossEncoderRerank(query, items, textField = 'fact') {
  if (!items.length) return items;
  if (items.length <= 1) return items;
  const llm = getLLM();
  const indexed = items.map((it, i) => ({ idx: i, text: it[textField] || it.name || '' }));
  const system = 'You are a relevance ranker. Given a QUERY and a list of ITEMS, return the items ordered from most to least relevant to the query. Respond with ONLY valid JSON.';
  const user = `<QUERY>
${query}
</QUERY>

<ITEMS>
${JSON.stringify(indexed)}
</ITEMS>

Return JSON: {"ranked":[{"idx":0,"score":1.0}]} ordered best-first, all idx included exactly once.`;
  let res;
  try { res = await llm.generate(system, user); }
  catch { return items; }
  const ranked = Array.isArray(res?.ranked) ? res.ranked : [];
  if (!ranked.length) return items;
  const seen = new Set();
  const ordered = [];
  for (const r of ranked) {
    const i = Number(r.idx);
    if (!seen.has(i) && i >= 0 && i < items.length) {
      seen.add(i);
      ordered.push({ ...items[i], _score: Number(r.score) || (1 - ordered.length / items.length) });
    }
  }
  for (let i = 0; i < items.length; i++) if (!seen.has(i)) ordered.push(items[i]);
  return ordered;
}

export { cos, mmr, rrf, nodeDistanceRerank, episodeMentionsRerank };
