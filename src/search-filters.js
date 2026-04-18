export class SearchFilters {
  constructor({
    nodeLabels = null,
    edgeTypes = null,
    validAt = null,
    invalidAt = null,
    createdAt = null,
    expiredAt = null,
  } = {}) {
    this.nodeLabels = nodeLabels;
    this.edgeTypes = edgeTypes;
    this.validAt = validAt;
    this.invalidAt = invalidAt;
    this.createdAt = createdAt;
    this.expiredAt = expiredAt;
  }
}

export function dateFilterClause(field, range) {
  if (!range) return { sql: '', args: [] };
  const parts = [];
  const args = [];
  if (range.gte) { parts.push(`${field} >= ?`); args.push(range.gte); }
  if (range.lte) { parts.push(`${field} <= ?`); args.push(range.lte); }
  if (range.gt) { parts.push(`${field} > ?`); args.push(range.gt); }
  if (range.lt) { parts.push(`${field} < ?`); args.push(range.lt); }
  return { sql: parts.join(' AND '), args };
}
