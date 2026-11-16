const MAX_BYTES = 300 * 1024;
const KEY_RE = /^[A-Za-z0-9_-]{24,128}$/;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequest({ request, env }) {
  if (!env.SYNC_KV) return json({ error: "Chưa gắn KV SYNC_KV" }, 500);
  const code = request.headers.get("x-sync-key") || "";
  if (!KEY_RE.test(code)) return json({ error: "Mã đồng bộ không hợp lệ" }, 401);
  const kvKey = "d:" + (await sha256Hex(code));

  if (request.method === "GET") {
    const cur = await env.SYNC_KV.get(kvKey, "json");
    return cur ? json({ found: true, ...cur }) : json({ found: false });
  }

  if (request.method === "PUT") {
    const raw = await request.text();
    if (raw.length > MAX_BYTES) return json({ error: "Dữ liệu quá lớn" }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: "JSON không hợp lệ" }, 400); }
    if (!body || typeof body.data !== "object" || body.data === null) return json({ error: "Thiếu data" }, 400);

    const cur = await env.SYNC_KV.get(kvKey, "json");
    const curRev = cur ? cur.rev : 0;
    if ((Number(body.baseRev) || 0) !== curRev) {
      return json({ conflict: true, ...cur }, 409);
    }
    const next = { data: body.data, rev: curRev + 1, updatedAt: new Date().toISOString() };
    await env.SYNC_KV.put(kvKey, JSON.stringify(next));
    return json({ ok: true, rev: next.rev, updatedAt: next.updatedAt });
  }

  return json({ error: "Method not allowed" }, 405);
}