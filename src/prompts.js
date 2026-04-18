const J = (x) => JSON.stringify(x, null, 2);

export function extractNodesMessage(ctx) {
  const previous = ctx.previous_episodes || [];
  const types = ctx.entity_types || [{ entity_type_id: 0, entity_type_name: 'Entity', entity_type_description: 'Any named real-world entity.' }];
  return {
    system: 'You are an AI assistant that extracts entity nodes from conversational messages. Your primary task is to extract and classify the speaker and other significant entities mentioned in the conversation. Respond with ONLY valid JSON, no prose.',
    user: `<PREVIOUS_MESSAGES>
${J(previous)}
</PREVIOUS_MESSAGES>

<CURRENT_MESSAGE>
${ctx.episode_content}
</CURRENT_MESSAGE>

<ENTITY_TYPES>
${J(types)}
</ENTITY_TYPES>

${ctx.custom_prompt || ''}

Given the above conversation, extract entities explicitly or implicitly mentioned.
Guidelines:
1. ALWAYS extract the speaker/actor if present.
2. Extract other significant entities, concepts, actors.
3. Provide concise, specific, unambiguous names.
4. Do NOT create nodes for relationships or actions (those are edges).
5. Do NOT create nodes for temporal information like dates.
6. Classify each into an entity_type_id from the list above.

Return ONLY JSON matching:
{"extracted_entities":[{"name":"string","entity_type_id":0}]}`,
    schema: 'extracted_entities',
  };
}

export function extractTextNodesMessage(ctx) {
  const types = ctx.entity_types || [{ entity_type_id: 0, entity_type_name: 'Entity', entity_type_description: 'Any named real-world entity.' }];
  return {
    system: 'You are an AI assistant that extracts entity nodes from text. Your primary task is to extract and classify significant entities mentioned in the text. Respond with ONLY valid JSON, no prose.',
    user: `<TEXT>
${ctx.episode_content}
</TEXT>

<ENTITY_TYPES>
${J(types)}
</ENTITY_TYPES>

${ctx.custom_prompt || ''}

Extract all significant entities from the text. Respond with JSON:
{"extracted_entities":[{"name":"string","entity_type_id":0}]}`,
    schema: 'extracted_entities',
  };
}

export function extractJsonNodesMessage(ctx) {
  const types = ctx.entity_types || [{ entity_type_id: 0, entity_type_name: 'Entity', entity_type_description: 'Any named real-world entity.' }];
  return {
    system: 'You are an AI assistant that extracts entity nodes from JSON. Respond with ONLY valid JSON.',
    user: `<SOURCE_DESCRIPTION>${ctx.source_description}</SOURCE_DESCRIPTION>
<JSON>
${ctx.episode_content}
</JSON>

<ENTITY_TYPES>
${J(types)}
</ENTITY_TYPES>

${ctx.custom_prompt || ''}

Extract significant entities from the JSON. Respond with:
{"extracted_entities":[{"name":"string","entity_type_id":0}]}`,
    schema: 'extracted_entities',
  };
}

export function dedupeNodesMessage(ctx) {
  const n = (ctx.extracted_nodes || []).length;
  return {
    system: 'You are an entity deduplication assistant. NEVER fabricate entity names or mark distinct entities as duplicates. Respond with ONLY valid JSON.',
    user: `<PREVIOUS_MESSAGES>
${J(ctx.previous_episodes || [])}
</PREVIOUS_MESSAGES>

<CURRENT_MESSAGE>
${ctx.episode_content}
</CURRENT_MESSAGE>

<ENTITIES>
${J(ctx.extracted_nodes)}
</ENTITIES>

<EXISTING_ENTITIES>
${J(ctx.existing_nodes)}
</EXISTING_ENTITIES>

ENTITIES contains ${n} entities with IDs 0 through ${n - 1}.
Your response MUST include EXACTLY ${n} resolutions. Do not skip or add IDs.

Entities are duplicates ONLY if they refer to the SAME real-world object or concept.
For each entity provide: id (int), name (best full name), duplicate_candidate_id (candidate_id of match, or -1).

Return ONLY:
{"entity_resolutions":[{"id":0,"name":"string","duplicate_candidate_id":-1}]}`,
    schema: 'entity_resolutions',
  };
}

export function extractEdgesMessage(ctx) {
  return {
    system: 'You are an expert fact extractor that extracts fact triples from text. Treat the CURRENT TIME as the time the CURRENT MESSAGE was sent. Respond with ONLY valid JSON.',
    user: `<PREVIOUS_MESSAGES>
${J(ctx.previous_episodes || [])}
</PREVIOUS_MESSAGES>

<CURRENT_MESSAGE>
${ctx.episode_content}
</CURRENT_MESSAGE>

<ENTITIES>
${J(ctx.nodes)}
</ENTITIES>

<REFERENCE_TIME>
${ctx.reference_time}
</REFERENCE_TIME>

${ctx.custom_prompt || ''}

Extract factual relationships. Rules:
- source_entity_name/target_entity_name MUST be names from the ENTITIES list.
- Two DISTINCT entities per fact.
- Closely paraphrase the source, do not verbatim quote.
- Use ISO 8601 UTC "Z" for dates. If ongoing, valid_at = REFERENCE_TIME. If change/terminate, set invalid_at. Null if unstated.
- relation_type in SCREAMING_SNAKE_CASE.

Return ONLY:
{"edges":[{"source_entity_name":"","target_entity_name":"","relation_type":"","fact":"","valid_at":null,"invalid_at":null}]}`,
    schema: 'edges',
  };
}

export function resolveEdgeMessage(ctx) {
  return {
    system: 'You are a fact deduplication assistant. NEVER mark facts with key differences as duplicates. Respond with ONLY valid JSON.',
    user: `<EXISTING_FACTS>
${J(ctx.existing_edges)}
</EXISTING_FACTS>

<FACT_INVALIDATION_CANDIDATES>
${J(ctx.edge_invalidation_candidates)}
</FACT_INVALIDATION_CANDIDATES>

<NEW_FACT>
${J(ctx.new_edge)}
</NEW_FACT>

idx values are continuous across both lists (INVALIDATION CANDIDATES start where EXISTING FACTS end).
- duplicate_facts: ONLY idx from EXISTING_FACTS range.
- contradicted_facts: idx from EITHER list.

Return ONLY:
{"duplicate_facts":[],"contradicted_facts":[]}`,
    schema: 'resolve_edge',
  };
}

export function summarizeNodeMessage(ctx) {
  return {
    system: 'You summarize entities from conversation and prior summaries. Keep under 250 chars. Respond with ONLY valid JSON.',
    user: `<PREVIOUS_SUMMARY>
${ctx.previous_summary || ''}
</PREVIOUS_SUMMARY>

<ENTITY_NAME>${ctx.name}</ENTITY_NAME>

<NEW_CONTEXT>
${ctx.new_context}
</NEW_CONTEXT>

Produce an updated summary synthesizing prior summary + new context, focused on the entity. Return ONLY:
{"summary":"string"}`,
    schema: 'summary',
  };
}

export function extractAttributesMessage(ctx) {
  return {
    system: 'You extract attribute values from facts. NEVER hallucinate. Respond with ONLY valid JSON.',
    user: `<FACT>${ctx.fact}</FACT>
<REFERENCE_TIME>${ctx.reference_time}</REFERENCE_TIME>
<EXISTING_ATTRIBUTES>${J(ctx.existing_attributes)}</EXISTING_ATTRIBUTES>
<ATTRIBUTE_DESCRIPTIONS>${J(ctx.attribute_descriptions || {})}</ATTRIBUTE_DESCRIPTIONS>

Return ONLY: {"attributes":{}}`,
    schema: 'attributes',
  };
}

export function communityNodeMessage(ctx) {
  return {
    system: 'You name and summarize a community of related entities. Respond with ONLY valid JSON.',
    user: `<ENTITIES>
${J(ctx.entities)}
</ENTITIES>

Produce a short name and 1-2 sentence summary capturing what unites them. Return ONLY:
{"name":"string","summary":"string"}`,
    schema: 'community',
  };
}
