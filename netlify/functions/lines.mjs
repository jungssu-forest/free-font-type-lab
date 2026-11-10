// 김가은 「Lacerif」 함께 쓴 문장 저장 함수 (Netlify Blobs 사용, 추가 가입 필요 없음)
import { getStore } from "@netlify/blobs";

const MAX_PER_PERSON = 8;   // 한 사람당 남는 문장 수
const MAX_LEN = 120;        // 문장 최대 길이
const okId = (v) => typeof v === "string" && /^[A-Za-z0-9.-]{8,64}$/.test(v);

export default async (req, context) => {
  const store = getStore({ name: "lace-lines", consistency: "strong" });   // 쓰자마자 바로 보이도록

  if (req.method === "GET") {
    const { blobs } = await store.list({ prefix: "u/" });
    const docs = (await Promise.all(blobs.map(async (b) => {
      const v = await store.get(b.key, { type: "json" });
      return v ? { id: b.key.slice(2), items: v.items || [], at: v.at || 0 } : null;
    }))).filter(Boolean).sort((a, b) => b.at - a.at).slice(0, 60);
    return Response.json({ docs }, { headers: { "cache-control": "no-store" } });
  }

  let body = {};
  try { body = await req.json(); } catch {}
  if (!okId(body.me)) return Response.json({ error: "bad id" }, { status: 400 });
  const key = `u/${body.me}`;
  const cur = (await store.get(key, { type: "json" })) || { items: [] };

  if (req.method === "POST") {
    const text = String(body.text || "").trim().slice(0, MAX_LEN);
    if (!text) return Response.json({ error: "empty" }, { status: 400 });
    const now = Date.now();
    if (cur.items[0] && now - cur.items[0].at < 5000) return Response.json({ error: "slow" }, { status: 429 });
    const items = [{ text, at: now }, ...cur.items].slice(0, MAX_PER_PERSON);
    await store.setJSON(key, { items, at: now });
    return Response.json({ ok: true });
  }

  if (req.method === "DELETE") {
    const items = cur.items.filter((it) => it.at !== body.at);
    if (items.length) await store.setJSON(key, { items, at: items[0].at });
    else await store.delete(key);
    return Response.json({ ok: true });
  }

  return new Response("Method Not Allowed", { status: 405 });
};

export const config = { path: "/api/lines" };
