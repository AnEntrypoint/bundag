export class NodeNamespace {
  constructor(groupId) { this.groupId = groupId; }
  toString() { return this.groupId; }
}

export class EdgeNamespace {
  constructor(groupId) { this.groupId = groupId; }
  toString() { return this.groupId; }
}

export function getDefaultGroupId() { return 'default'; }

export function validateGroupId(groupId) {
  if (!groupId || typeof groupId !== 'string') throw new Error('group_id must be a non-empty string');
  if (!/^[a-zA-Z0-9_\-.]+$/.test(groupId)) throw new Error('group_id may only contain letters, numbers, underscores, hyphens, and dots');
  return groupId;
}
