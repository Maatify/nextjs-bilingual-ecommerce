import { isCrossSite } from "./rate-limit";

/**
 * Read a multipart/form-data body with a hard size cap (streamed — Content-Length can be absent or wrong).
 * Returns the parsed FormData, or a 4xx shape like readJsonBody().
 */
export async function readFormBody(req: Request, maxBytes: number): Promise<{ ok: true; data: FormData } | { ok: false; status: 400 | 403 | 413 | 415; error: string }> {
  if (isCrossSite(req)) return { ok: false, status: 403, error: "Cross-site request blocked" };
  const type = req.headers.get("content-type") ?? "";
  if (!type.startsWith("multipart/form-data")) return { ok: false, status: 415, error: "Send multipart/form-data" };
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return { ok: false, status: 413, error: "Request too large" };
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    const reader = req.body?.getReader();
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          return { ok: false, status: 413, error: "Request too large" };
        }
        chunks.push(value);
      }
    }
    const data = await new Response(Buffer.concat(chunks), { headers: { "content-type": type } }).formData();
    return { ok: true, data };
  } catch {
    return { ok: false, status: 400, error: "Invalid request" };
  }
}
