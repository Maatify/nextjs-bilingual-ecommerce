/**
 * The store's previous name. Data written before the rename is still read so existing deployments keep working:
 * the `<NAME>_DB` env var and a `data/<name>.db` file (src/server/store.ts), the storefront and admin language cookies
 * and the admin theme cookie, and the browser-storage keys (cart, checkout draft, …). New data is always written
 * under the current name.
 */
export const LEGACY_NAME = "verda";

const PREFIXES = [`${LEGACY_NAME}:`, `${LEGACY_NAME}_`];

/** Moves localStorage / sessionStorage entries saved under the old prefix to the new one, once, never overwriting. */
export function migrateLegacyStorage() {
  if (typeof window === "undefined") return;
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      for (const key of Object.keys(store)) {
        if (!PREFIXES.some((p) => key.startsWith(p))) continue;
        const next = `vedra${key.slice(LEGACY_NAME.length)}`;
        const value = store.getItem(key);
        if (value !== null && store.getItem(next) === null) store.setItem(next, value);
        store.removeItem(key);
      }
    } catch {}
  }
}

/** The legacy spelling of a cookie / key name: `vedra_lang` → the old prefix + `_lang`. */
export const legacyKey = (name: string) => name.replace(/^vedra/, LEGACY_NAME);
