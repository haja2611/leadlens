const cache = new Map();
const TTL = 24 * 60 * 60 * 1000; // 24 hours

export function get(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL) { cache.delete(key); return null; }
  return entry.value;
}

export function set(key, value) {
  cache.set(key, { value, ts: Date.now() });
}

/** Remove a key from the in-memory Map (does NOT touch any CSV file) */
export function del(key) {
  cache.delete(key);
}