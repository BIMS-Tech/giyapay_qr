/**
 * Tiny in-process TTL cache.
 *
 * Cloud Run gives every container instance its own copy, so a value can be up
 * to its TTL stale and is never shared between instances. That is the trade
 * we accept: it costs nothing to run and removes the repeated aggregate
 * queries that dominate the database bill, and none of the cached data needs
 * to be exact to the second.
 *
 * Anything that must be immediately consistent (a QR code's payment status,
 * auth checks) must NOT go through here.
 */

const store = new Map();

// Guards against unbounded growth if keys are ever derived from user input.
const MAX_ENTRIES = 1000;

export const cacheGet = (key) => {
  const entry = store.get(key);
  if (!entry) return undefined;

  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }

  return entry.value;
};

export const cacheSet = (key, value, ttlMs) => {
  if (store.size >= MAX_ENTRIES) {
    // Cheapest useful eviction: drop the oldest insertion.
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }

  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
};

/**
 * Read-through helper. Concurrent callers for a cold key share one in-flight
 * promise, so a burst of dashboard loads produces a single database query.
 */
const inFlight = new Map();

export const cached = async (key, ttlMs, produce) => {
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const value = await produce();
      cacheSet(key, value, ttlMs);
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
};

/** Drop every entry whose key starts with prefix - used after a write. */
export const invalidatePrefix = (prefix) => {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
};

export const cacheStats = () => ({ entries: store.size, inFlight: inFlight.size });

// Sweep expired entries so an idle instance does not hold memory forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}, 60 * 1000).unref();
