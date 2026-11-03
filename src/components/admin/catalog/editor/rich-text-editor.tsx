"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@/lib/format";
import { descriptionHtml, safeHref, sanitizeRichText } from "@/lib/rich-text";
import { AIcon } from "../../icons";
import { useT } from "../../i18n";
import { ease } from "../../ui";

/*
 * Small rich-text editor (no document.execCommand): a contenteditable surface whose
 * formatting commands are implemented with the Range/DOM APIs. Output is passed through
 * the same strict allowlist sanitizer the server applies before saving.
 */

type Inline = "strong" | "em" | "u";
type Block = "p" | "h2" | "h3";
type ListTag = "ul" | "ol";
type Fmt = Inline | "h2" | "h3" | ListTag | "a";

const LEAF = new Set(["P", "H2", "H3", "LI", "DIV"]);
const TOP = new Set(["P", "H2", "H3", "UL", "OL", "DIV"]);

function closest(node: Node | null, tag: string, root: HTMLElement): HTMLElement | null {
  for (let n: Node | null = node; n && n !== root; n = n.parentNode) if (n.nodeType === 1 && (n as HTMLElement).tagName === tag.toUpperCase()) return n as HTMLElement;
  return null;
}

function leafOf(node: Node | null, root: HTMLElement): HTMLElement | null {
  for (let n: Node | null = node; n && n !== root; n = n.parentNode) if (n.nodeType === 1 && LEAF.has((n as HTMLElement).tagName)) return n as HTMLElement;
  return null;
}

/** Wrap stray inline content at the top level into paragraphs. */
function normalizeRoot(root: HTMLElement) {
  let run: HTMLElement | null = null;
  for (const n of [...root.childNodes]) {
    const isBlock = n.nodeType === 1 && TOP.has((n as HTMLElement).tagName);
    if (isBlock) {
      run = null;
      continue;
    }
    if (n.nodeType === 3 && !n.textContent?.trim() && !run) {
      n.remove();
      continue;
    }
    if (!run) {
      run = document.createElement("p");
      root.insertBefore(run, n);
    }
    run.appendChild(n);
  }
  if (!root.childNodes.length) root.innerHTML = "<p><br></p>";
}

function unwrap(el: Element) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  el.remove();
}

function retag(el: HTMLElement, tag: string) {
  if (el.tagName === tag.toUpperCase()) return el;
  const next = document.createElement(tag);
  while (el.firstChild) next.appendChild(el.firstChild);
  el.replaceWith(next);
  return next;
}

/** Leaf blocks (p/h2/h3/li/div) touched by the range, in document order. */
function leaves(root: HTMLElement, r: Range): HTMLElement[] {
  const all = [...root.querySelectorAll<HTMLElement>("p,h2,h3,li,div")].filter((el) => ![...el.children].some((c) => LEAF.has(c.tagName) || c.tagName === "UL" || c.tagName === "OL"));
  const hit = all.filter((el) => r.intersectsNode(el));
  if (hit.length) return hit;
  const l = leafOf(r.startContainer, root);
  return l ? [l] : [];
}

/** Per-leaf sub-ranges so inline formatting never spans blocks. */
function segments(root: HTMLElement, r: Range): Range[] {
  const out: Range[] = [];
  for (const leaf of leaves(root, r)) {
    const s = document.createRange();
    s.selectNodeContents(leaf);
    if (leaf.contains(r.startContainer)) s.setStart(r.startContainer, r.startOffset);
    if (leaf.contains(r.endContainer)) s.setEnd(r.endContainer, r.endOffset);
    if (!s.collapsed) out.push(s);
  }
  return out;
}

export function RichTextEditor({ id, value, onChange, placeholder, labelledBy, dir, lang }: { id?: string; value: string; onChange: (html: string) => void; placeholder?: string; labelledBy?: string; /** text direction of the content (e.g. "rtl" for Arabic copy) */ dir?: "rtl" | "ltr"; lang?: string }) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null>(null);
  const saved = useRef<Range | null>(null);
  const [active, setActive] = useState<Set<Fmt>>(new Set());
  const [empty, setEmpty] = useState(!value.trim());
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState("https://");
  const [urlError, setUrlError] = useState(false);

  // load external value (first render, discard, server refresh) — never while it's our own echo
  useEffect(() => {
    const root = ref.current;
    if (!root || value === emitted.current) return;
    root.innerHTML = descriptionHtml(value) || "<p><br></p>";
    emitted.current = value;
    setEmpty(!root.textContent?.trim());
  }, [value]);

  const range = useCallback(() => {
    const root = ref.current;
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (!root || !sel?.rangeCount) return null;
    const r = sel.getRangeAt(0);
    return root.contains(r.commonAncestorContainer) ? r : null;
  }, []);

  const refreshActive = useCallback(() => {
    const root = ref.current;
    const r = range();
    if (!root || !r) return setActive(new Set());
    const n = r.startContainer;
    const s = new Set<Fmt>();
    (["strong", "em", "u", "h2", "h3", "a"] as const).forEach((t) => closest(n, t, root) && s.add(t));
    if (closest(n, "b", root)) s.add("strong");
    if (closest(n, "i", root)) s.add("em");
    const li = closest(n, "li", root);
    if (li?.parentElement) s.add(li.parentElement.tagName === "OL" ? "ol" : "ul");
    setActive(s);
  }, [range]);

  useEffect(() => {
    document.addEventListener("selectionchange", refreshActive);
    return () => document.removeEventListener("selectionchange", refreshActive);
  }, [refreshActive]);

  const emit = () => {
    const root = ref.current;
    if (!root) return;
    const html = sanitizeRichText(root.innerHTML);
    setEmpty(!root.textContent?.trim());
    if (html === emitted.current) return;
    emitted.current = html;
    onChange(html);
  };

  const run = (fn: (root: HTMLElement, r: Range) => void) => {
    const root = ref.current;
    if (!root) return;
    const r = range() ?? saved.current;
    if (!r) {
      root.focus();
      return;
    }
    fn(root, r);
    normalizeRoot(root);
    root.focus();
    emit();
    refreshActive();
  };

  const select = (r: Range) => {
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  };

  const toggleInline = (tag: Inline) =>
    run((root, r) => {
      if (r.collapsed) return;
      const alias = tag === "strong" ? "b" : tag === "em" ? "i" : null;
      const on = !!closest(r.startContainer, tag, root) || (!!alias && !!closest(r.startContainer, alias, root));
      if (on) {
        // remove the format from every matching element the selection touches
        [...root.querySelectorAll(alias ? `${tag},${alias}` : tag)].filter((el) => r.intersectsNode(el)).forEach(unwrap);
        return;
      }
      const segs = segments(root, r);
      let first: Node | null = null;
      let last: Node | null = null;
      for (const s of segs) {
        const frag = s.extractContents();
        frag.querySelectorAll(alias ? `${tag},${alias}` : tag).forEach(unwrap);
        const el = document.createElement(tag);
        el.appendChild(frag);
        s.insertNode(el);
        first ??= el;
        last = el;
      }
      if (first && last) {
        const nr = document.createRange();
        nr.setStartBefore(first);
        nr.setEndAfter(last);
        select(nr);
      }
    });

  const setBlock = (tag: Block) =>
    run((root, r) => {
      const ls = leaves(root, r).filter((l) => l.tagName !== "LI");
      const target = ls.length && ls.every((l) => l.tagName === tag.toUpperCase()) ? "p" : tag;
      ls.forEach((l) => retag(l, target));
    });

  const toggleList = (tag: ListTag) =>
    run((root, r) => {
      const ls = leaves(root, r);
      if (!ls.length) return;
      const allLi = ls.every((l) => l.tagName === "LI");
      if (allLi && ls.every((l) => l.parentElement?.tagName === tag.toUpperCase())) {
        // unlist: split the list around each item and turn it into a paragraph
        for (const li of ls) {
          const list = li.parentElement!;
          const after = document.createElement(list.tagName.toLowerCase());
          while (li.nextSibling) after.appendChild(li.nextSibling);
          const p = document.createElement("p");
          while (li.firstChild) p.appendChild(li.firstChild);
          li.remove();
          list.after(p);
          p.after(after);
          if (!list.children.length) list.remove();
          if (!after.children.length) after.remove();
        }
        return;
      }
      if (allLi) {
        new Set(ls.map((l) => l.parentElement!)).forEach((list) => retag(list, tag));
        return;
      }
      const list = document.createElement(tag);
      const firstTop = [...root.children].find((c) => c.contains(ls[0])) ?? ls[0];
      root.insertBefore(list, firstTop);
      for (const l of ls) {
        if (l.tagName === "LI") list.appendChild(l);
        else {
          const li = document.createElement("li");
          while (l.firstChild) li.appendChild(l.firstChild);
          l.remove();
          list.appendChild(li);
        }
      }
      root.querySelectorAll("ul,ol").forEach((x) => !x.children.length && x.remove());
    });

  const clearFormatting = () =>
    run((root, r) => {
      for (const l of leaves(root, r)) {
        l.querySelectorAll("strong,b,em,i,u,a,span").forEach(unwrap);
        if (l.tagName !== "LI") retag(l, "p");
      }
    });

  const openLink = () => {
    const root = ref.current;
    const r = range();
    if (!root) return;
    const a = r ? closest(r.startContainer, "a", root) : null;
    if (a) {
      run(() => unwrap(a));
      return;
    }
    saved.current = r ? r.cloneRange() : null;
    setUrl("https://");
    setUrlError(false);
    setLinking(true);
  };

  const applyLink = () => {
    const href = safeHref(url.trim());
    if (!href) return setUrlError(true);
    const clean = url.trim();
    setLinking(false);
    const r = saved.current;
    saved.current = null;
    if (!r) return;
    select(r);
    run((root, rr) => {
      if (rr.collapsed) {
        const a = document.createElement("a");
        a.href = clean;
        a.textContent = clean.replace(/^mailto:/, "");
        rr.insertNode(a);
        return;
      }
      for (const s of segments(root, rr)) {
        const frag = s.extractContents();
        frag.querySelectorAll("a").forEach(unwrap);
        const a = document.createElement("a");
        a.href = clean;
        a.appendChild(frag);
        s.insertNode(a);
      }
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    const map: Record<string, () => void> = { b: () => toggleInline("strong"), i: () => toggleInline("em"), u: () => toggleInline("u"), k: openLink };
    if (map[k]) {
      e.preventDefault();
      map[k]();
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    // paste as text (formatting from other sites is never trusted); blank lines become paragraphs
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    run((root, r) => {
      r.deleteContents();
      const frag = document.createDocumentFragment();
      text.split(/\r?\n/).forEach((line, i) => {
        if (i) frag.appendChild(document.createElement("br"));
        if (line) frag.appendChild(document.createTextNode(line));
      });
      const lastNode = frag.lastChild;
      r.insertNode(frag);
      if (lastNode) {
        const nr = document.createRange();
        nr.setStartAfter(lastNode);
        nr.collapse(true);
        select(nr);
      }
    });
  };

  const onTool = (key: string) => {
    if (key === "b") toggleInline("strong");
    else if (key === "i") toggleInline("em");
    else if (key === "u") toggleInline("u");
    else if (key === "h2" || key === "h3") setBlock(key);
    else if (key === "ul" || key === "ol") toggleList(key);
    else if (key === "a") openLink();
    else if (key === "clear") clearFormatting();
  };

  const tools: { key: string; label: string; on?: boolean; node: React.ReactNode; sep?: boolean }[] = [
    { key: "b", label: t("products.rte.bold"), on: active.has("strong"), node: <span className="text-[13px] font-bold">B</span> },
    { key: "i", label: t("products.rte.italic"), on: active.has("em"), node: <span className="font-serif text-[14px] italic">I</span> },
    { key: "u", label: t("products.rte.underline"), on: active.has("u"), node: <span className="text-[13px] underline underline-offset-2">U</span> },
    { key: "h2", label: t("products.rte.heading"), on: active.has("h2"), node: <span className="text-[12px] font-semibold">H2</span>, sep: true },
    { key: "h3", label: t("products.rte.subheading"), on: active.has("h3"), node: <span className="text-[12px] font-semibold">H3</span> },
    {
      key: "ul",
      label: t("products.rte.bullets"),
      on: active.has("ul"),
      sep: true,
      node: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M9 6h11M9 12h11M9 18h11" />
          <circle cx="4.5" cy="6" r="1" fill="currentColor" />
          <circle cx="4.5" cy="12" r="1" fill="currentColor" />
          <circle cx="4.5" cy="18" r="1" fill="currentColor" />
        </svg>
      ),
    },
    {
      key: "ol",
      label: t("products.rte.numbers"),
      on: active.has("ol"),
      node: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M10 6h10M10 12h10M10 18h10" />
          <path d="M4 5l1.5-1v5M3.5 14.5c.4-.6 2.6-.9 2.5.6 0 1-2.5 2-2.5 3h2.6" strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      key: "a",
      label: active.has("a") ? t("products.rte.removeLink") : t("products.rte.link"),
      on: active.has("a") || linking,
      sep: true,
      node: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
          <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
        </svg>
      ),
    },
    {
      key: "clear",
      label: t("products.rte.clear"),
      node: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M6 5h12M12 5l-4 14M4 20l16-16" />
        </svg>
      ),
    },
  ];

  return (
    <div className="rounded-[12px] border border-a-line bg-a-panel-2 transition has-[[contenteditable]:focus]:border-a-violet/70 has-[[contenteditable]:focus]:ring-[3px] has-[[contenteditable]:focus]:ring-a-violet/20">
      <div role="toolbar" aria-label={t("products.rte.formatting")} aria-controls={id} className="flex flex-wrap items-center gap-0.5 border-b border-a-line px-1.5 py-1.5">
        {tools.map((t) => (
          <span key={t.key} className="flex items-center">
            {t.sep ? <span className="mx-1 h-4 w-px bg-a-line" aria-hidden /> : null}
            <button
              type="button"
              title={t.label}
              aria-label={t.label}
              aria-pressed={t.on ?? undefined}
              // keep the editor's selection when clicking the toolbar
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onTool(t.key)}
              className={cx("fx-press grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-a-dim transition hover:bg-a-hover hover:text-a-text", t.on && "bg-a-violet/15 text-a-accent")}
            >
              {t.node}
            </button>
          </span>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {linking ? (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease }}
            className="overflow-hidden border-b border-a-line"
            onSubmit={(e) => {
              e.preventDefault();
              applyLink();
            }}
          >
            <div className="flex items-center gap-2 px-2.5 py-2">
              <AIcon name="globe" size={14} className="shrink-0 text-a-faint" />
              <input
                autoFocus
                dir="ltr"
                aria-label={t("products.rte.linkUrl")}
                aria-invalid={urlError}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setUrlError(false);
                }}
                onKeyDown={(e) => e.key === "Escape" && (e.preventDefault(), setLinking(false))}
                placeholder="https://… or mailto:…"
                className={cx("h-8 min-w-0 flex-1 rounded-md bg-a-panel px-2 text-[13px] outline-none ring-1 ring-a-line focus:ring-a-violet/60", urlError && "ring-a-danger")}
              />
              <button type="submit" className="h-8 rounded-md bg-a-ink/[0.08] px-3 text-[12.5px] font-medium hover:bg-a-ink/[0.12]">
                {t("products.rte.addLink")}
              </button>
              <button type="button" onClick={() => setLinking(false)} className="h-8 rounded-md px-2 text-[12.5px] text-a-dim hover:text-a-text">
                {t("common.cancel")}
              </button>
            </div>
            {urlError ? <p className="px-3 pb-2 text-[12px] text-a-danger">{t("products.rte.badLink")}</p> : null}
          </motion.form>
        ) : null}
      </AnimatePresence>

      <div className="relative" dir={dir} lang={lang}>
        {empty && placeholder ? <span className="pointer-events-none absolute start-3.5 top-3 text-[13.5px] text-a-faint">{placeholder}</span> : null}
        <div
          ref={ref}
          id={id}
          dir={dir}
          lang={lang}
          role="textbox"
          aria-multiline
          aria-labelledby={labelledBy}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onKeyUp={refreshActive}
          className="a-scroll max-h-[460px] min-h-[160px] overflow-y-auto px-3.5 py-3 text-[13.5px] leading-relaxed text-a-text outline-none [&_a]:text-a-accent [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mb-1.5 [&_h2]:mt-3 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-2.5 [&_h3]:text-[15px] [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:my-1.5 [&_strong]:font-semibold [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:ps-5 [&>*:first-child]:mt-0"
        />
      </div>
    </div>
  );
}
