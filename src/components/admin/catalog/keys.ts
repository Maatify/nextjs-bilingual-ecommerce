"use client";

import { useState } from "react";

let seq = 0;
const uid = () => `k${(++seq).toString(36)}`;

/**
 * Stable React keys for an editable array whose items have no id (colours,
 * sizes, list lines). Keep them in sync by calling the ops alongside your
 * data updates; if the length changes from outside (e.g. Discard) the keys
 * are re-derived positionally.
 */
export function useStableKeys(count: number) {
  const [keys, setKeys] = useState<string[]>(() => Array.from({ length: count }, uid));
  let cur = keys;
  if (keys.length !== count) {
    cur = Array.from({ length: count }, (_, i) => keys[i] ?? uid());
    setKeys(cur);
  }
  return {
    keys: cur,
    add: (n = 1) => setKeys((k) => [...k, ...Array.from({ length: n }, uid)]),
    remove: (i: number) => setKeys((k) => k.filter((_, j) => j !== i)),
    set: (next: string[]) => setKeys(next),
    reset: (n: number) => setKeys(Array.from({ length: n }, uid)),
  };
}

/** Reorder `items` to follow `nextKeys` (a permutation of `keys`). */
export function permute<T>(items: T[], keys: string[], nextKeys: string[]) {
  return nextKeys.map((k) => items[keys.indexOf(k)]);
}
