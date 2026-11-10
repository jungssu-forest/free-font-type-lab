// 방문 기록 (관리용). 쿠키·개인정보 없이 하루 단위 숫자만 세요.
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless/i;
const okPage = (p) => typeof p === "string" && /^[a-z0-9-]{1,40}$/.test(p);

export default async (req, context) => {
  if (req.method !== "POST") return new Response(null, { status: 204 });
  const ua = req.headers.get("user-agent") || "";
  if (BOT.test(ua)) return new Response(null, { status: 204 });
  let page = "home";
  try { const b = JSON.parse(await req.text()); if (okPage(b.p)) page = b.p; } catch {}

  try {
    const store = getStore({ name: "visits", consistency: "strong" });
    // 한국 시간 기준 날짜
    const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const who = createHash("sha256").update(`${context.ip || ""}|${ua}|${day}|type-lab`).digest("hex").slice(0, 20);
    const seenKey = `seen/${day}/${who}`;
    const [doc, seen] = await Promise.all([store.get(`d/${day}`, { type: "json" }), store.get(seenKey)]);
    const d = doc || { views: 0, uniques: 0, pages: {} };
    d.views += 1;
    d.pages[page] = (d.pages[page] || 0) + 1;
    const tasks = [];
    if (!seen){ d.uniques += 1; tasks.push(store.set(seenKey, "1")); }
    tasks.push(store.setJSON(`d/${day}`, d));
    await Promise.all(tasks);
  } catch (e) { console.error("hit:", String(e.message || e)); }
  return new Response(null, { status: 204 });
};

export const config = { path: "/api/hit" };
