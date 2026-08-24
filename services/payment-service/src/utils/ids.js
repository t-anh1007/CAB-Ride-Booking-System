import crypto from 'node:crypto';

export function generateId() {
  return crypto.randomUUID();
}

export function generateProviderRef(prefix = 'MOCK') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}
