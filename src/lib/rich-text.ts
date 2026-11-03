/*
 * Product description rich text — a strict allowlist HTML sanitizer with no DOM
 * dependency, so the exact same function runs in server actions (before saving)
 * and while rendering the storefront (defence in depth).
 *
 * Allowed: <p> <strong> <em> <u> <h2> <h3> <ul> <ol> <li> <br> and
 * <a href="http(s)|mailto"> (always rel="noopener noreferrer nofollow", target=_blank).
 * Everything else is dropped (its text kept), except the content of script-like
 * elements which is removed entirely. Attributes other than <a href> are removed.
 */

const ALLOWED = new Set(["p", "strong", "em", "u", "h2", "h3", "ul", "ol", "li", "br", "a"]);
const ALIAS: Record<string, string> = { b: "strong", i: "em", div: "p", h1: "h2", h4: "h3", h5: "h3", h6: "h3" };
const BLOCK = new Set(["p", "h2", "h3", "ul", "ol"]);
/** Elements whose whole content is discarded. */
const DROP_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "noscript", "template", "textarea", "select", "svg", "math", "title", "head", "xmp", "noembed", "noframes", "plaintext"]);

const ENTITY = /^&(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/i;

/** Escape text, keeping well-formed entities (they came from the browser's serializer). */
function escText(t: string) {
  let out = "";
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === "&") {
      const m = ENTITY.exec(t.slice(i, i + 40));
      if (m) {
        out += m[0];
        i += m[0].length - 1;
      } else out += "&amp;";
    } else if (ch === "<") out += "&lt;";
    else if (ch === ">") out += "&gt;";
    else if (ch === '"') out += "&quot;";
    else out += ch;
  }
  return out;
}

const decodeAttr = (v: string) =>
  v
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16) || 32))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(Number(d) || 32))
    .replace(/&colon;/gi, ":")
    .replace(/&tab;|&newline;/gi, "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/** Only absolute http(s) and mailto links; returns the attribute-safe href or null. */
export function safeHref(raw: string): string | null {
  // strip control chars / whitespace browsers ignore inside schemes ("java\nscript:")
  const v = decodeAttr(raw).replace(/[\u0000- \u007f-\u009f]/g, "").trim();
  if (!/^(https?:\/\/[^\s"'<>]+|mailto:[^\s"'<>]+)$/i.test(v)) return null;
  if (v.length > 2000) return null;
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function attr(attrs: string, name: string): string | null {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
  const m = re.exec(attrs);
  return m ? (m[1] ?? m[2] ?? m[3] ?? "") : null;
}

const TOKEN = /<!--[\s\S]*?(?:-->|$)|<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>|<![^>]*>|<\?[^>]*>/g;

export function sanitizeRichText(input: string, maxLen = 20000): string {
  if (typeof input !== "string" || !input) return "";
  const src = input.slice(0, maxLen * 2);
  let out = "";
  const stack: string[] = [];
  let dropDepth = 0;
  let dropTag = "";
  let last = 0;

  const emitText = (t: string) => {
    if (dropDepth || !t) return;
    // stray text at the top level goes into a paragraph
    if (!stack.length && t.trim()) {
      out += "<p>";
      stack.push("p");
    }
    out += escText(t);
  };
  const close = (tag: string) => {
    const i = stack.lastIndexOf(tag);
    if (i < 0) return;
    while (stack.length > i) out += `</${stack.pop()}>`;
  };

  for (const m of src.matchAll(TOKEN)) {
    emitText(src.slice(last, m.index));
    last = m.index + m[0].length;
    const raw = m[1]?.toLowerCase();
    if (!raw) continue; // comment, doctype, PI
    const closing = m[0][1] === "/";
    if (dropDepth) {
      if (raw === dropTag) dropDepth += closing ? -1 : 1;
      continue;
    }
    if (DROP_CONTENT.has(raw)) {
      if (!closing && !/\/>$/.test(m[0])) {
        dropDepth = 1;
        dropTag = raw;
      }
      continue;
    }
    const tag = ALIAS[raw] ?? raw;
    if (!ALLOWED.has(tag)) continue;
    if (tag === "br") {
      if (!closing) out += "<br>";
      continue;
    }
    if (closing) {
      close(tag);
      continue;
    }
    if (BLOCK.has(tag)) {
      // blocks don't nest (except lists inside <li>): close open inline/blocks first
      if ((tag === "ul" || tag === "ol") && stack.at(-1) === "li") {
        /* nested list — allowed */
      } else while (stack.length && stack.at(-1) !== "li") out += `</${stack.pop()}>`;
    }
    if (tag === "li" && !stack.some((t) => t === "ul" || t === "ol")) {
      while (stack.length) out += `</${stack.pop()}>`;
      out += "<ul>";
      stack.push("ul");
    }
    if (tag === "li") while (stack.length && stack.at(-1) !== "ul" && stack.at(-1) !== "ol") out += `</${stack.pop()}>`;
    if (tag === "a") {
      if (stack.includes("a")) continue;
      const href = safeHref(attr(m[2] ?? "", "href") ?? "");
      if (!href) continue;
      if (!stack.length) (out += "<p>"), stack.push("p");
      out += `<a href="${href}" rel="noopener noreferrer nofollow" target="_blank">`;
      stack.push("a");
      continue;
    }
    if (!BLOCK.has(tag) && tag !== "li" && !stack.length) (out += "<p>"), stack.push("p");
    out += `<${tag}>`;
    stack.push(tag);
  }
  emitText(src.slice(last));
  while (stack.length) out += `</${stack.pop()}>`;
  // drop empty blocks the editor leaves behind
  out = out.replace(/<(p|h2|h3|li|strong|em|u|a)(?:\s[^>]*)?>(?:\s|&nbsp;|<br>)*<\/\1>/g, "").replace(/<(ul|ol)>\s*<\/\1>/g, "");
  return out.length > maxLen ? "" : out;
}

/** Does this description contain markup (vs. legacy plain text)? */
export const isRichText = (s: string) => /<\/?(p|strong|em|u|h2|h3|ul|ol|li|br|a|b|i|div)\b[^>]*>/i.test(s);

/** Safe HTML for any stored description: sanitized rich text, or plain text as paragraphs. */
export function descriptionHtml(desc: string | undefined | null): string {
  if (!desc?.trim()) return "";
  if (isRichText(desc)) return sanitizeRichText(desc);
  return desc
    .trim()
    .split(/\n\s*\n/)
    .map((para) => `<p>${escText(para.replace(/&/g, "&amp;")).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Plain text (for meta tags / JSON-LD). */
export function richTextToPlain(desc: string | undefined | null): string {
  if (!desc) return "";
  if (!isRichText(desc)) return desc.trim();
  return sanitizeRichText(desc)
    .replace(/<\/(p|h2|h3|li)>|<br>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
