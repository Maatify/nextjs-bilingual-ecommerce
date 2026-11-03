import type { StoreSnapshot } from "./types";

/**
 * Isomorphic access to the live store snapshot (products, collections, settings,
 * content, published reviews).
 *
 * - Server: `src/server/store.ts` installs a reader on globalThis that builds the
 *   snapshot from SQLite and caches it until the next admin write.
 * - Client: <StoreDataProvider> (rendered by the root layout) hands the server's
 *   snapshot to `hydrateSnapshot` before any child renders.
 *
 * Never call these at module scope — only during render / inside functions.
 */

type Reader = { snapshot: () => StoreSnapshot };
const g = globalThis as typeof globalThis & { __verdaStore?: Reader };

let clientSnapshot: StoreSnapshot | null = null;

export function hydrateSnapshot(s: StoreSnapshot) {
  if (!clientSnapshot || clientSnapshot.version !== s.version) clientSnapshot = s;
}

export function snapshot(): StoreSnapshot {
  if (typeof window === "undefined") {
    if (!g.__verdaStore) throw new Error("[verda] store not booted — import \"@/server/boot\" in this server entry");
    return g.__verdaStore.snapshot();
  }
  if (!clientSnapshot) throw new Error("[verda] snapshot not hydrated — render inside <StoreDataProvider>");
  return clientSnapshot;
}

export const getSettings = () => snapshot().settings;
export const getContent = () => snapshot().content;

const publicCache = new WeakMap<StoreSnapshot, StoreSnapshot>();
/**
 * The snapshot that is serialised to the browser: personal promo codes (review rewards), switched-off codes,
 * unpublished content pages and the private bookkeeping on reviews (order / link ids,
 * reward codes) never leave the server.
 */
export function publicSnapshot(): StoreSnapshot {
  const s = snapshot();
  let out = publicCache.get(s);
  if (!out) {
    out = {
      ...s,
      settings: { ...s.settings, promoCodes: s.settings.promoCodes.filter((c) => !c.private && c.active) },
      content: { ...s.content, pages: s.content.pages.filter((p) => p.published !== false) },
      // No storefront CLIENT component reads snapshot().reviews (review lists, ratings and JSON-LD are all built
      // server-side and passed as props), so they're not shipped at all — this was ~60 KB of JSON inlined into
      // every page's HTML. Product rating / reviewCount still travel on each product.
      reviews: [],
    };
    publicCache.set(s, out);
  }
  return out;
}
