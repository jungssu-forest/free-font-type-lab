// 주현호 「털어 놓아봐」(동글주현호체) AI 답장 함수
// Netlify 환경 변수 ANTHROPIC_API_KEY 가 필요해요.
import { getStore } from "@netlify/blobs";

const PER_HOUR = 20;     // 한 사람(IP)이 1시간에 받을 수 있는 답장 수
const PER_DAY = 500;     // 사이트 전체가 하루에 받을 수 있는 답장 수 (요금 보호)

const prompt = (msg) => `너는 강 건너편에서 종이배에 답장을 실어 보내는 사람이야. 누군가 마음을 적어 종이비행기로 날려 보냈고, 너는 그 마음을 오래 품었다가 조용히 답장을 써.

이렇게 써 줘:
- 보낸 사람이 쓴 말 중 하나를 짚어서, 정말로 읽고 헤아렸다는 게 느껴지게 해.
- 위로를 늘어놓기보다, 그 마음을 있는 그대로 안아 주는 문장을 써. 가르치거나 해결책을 서두르지 마.
- 물결, 빛, 바람, 계절, 밤하늘 같은 자연의 이미지를 하나만, 억지스럽지 않게 빌려 와도 좋아.
- 마지막 문장은 읽고 나서 한참 마음에 남는 한마디로 맺어.
- 질문이면 답을 먼저 정확하고 짧게 건넨 뒤, 따뜻한 한마디로 맺어.
- 다정한 반말로, 꼭 2~3문장, 110자 안쪽. 뻔한 말(힘내, 괜찮아질 거야, 화이팅)은 피해.
- 한글, 숫자, 그리고 . , ! ? ~ … 만 써. 영어 알파벳, 이모지, 마크다운, 따옴표는 쓰지 마.
- 자신을 해치려는 마음이 보이면 그 마음을 소중히 받아 주고, 오늘 밤 혼자 견디지 말고 믿는 사람이나 109(자살예방 상담전화)에 꼭 닿아 보라고 부드럽게 권해.
- 답장 본문만 써.

보낸 글:
${msg}`;

const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

// Claude 호출 (9초 안에 답이 없으면 포기하고 미리 써 둔 편지로)
async function callClaude(content, maxTokens){
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 9000);
  const t0 = Date.now();
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL(), max_tokens: maxTokens, messages: [{ role: "user", content }] }),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t0, data: { error: { type: e.name === "AbortError" ? "timeout" : "network", message: String(e.message || e) } } };
  } finally { clearTimeout(t); }
}
const textOf = (data) => (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();

// 사용량 제한 (저장소에 문제가 생겨도 답장은 계속 나가도록)
async function overLimit(context){
  try {
    const store = getStore("reply-limits");
    const now = new Date();
    const hourKey = `ip/${context.ip || "unknown"}/${now.toISOString().slice(0, 13)}`;
    const dayKey = `day/${now.toISOString().slice(0, 10)}`;
    const [h, d] = await Promise.all([store.get(hourKey, { type: "json" }), store.get(dayKey, { type: "json" })]);
    if ((h || 0) >= PER_HOUR || (d || 0) >= PER_DAY) return { busy: true };
    store.setJSON(hourKey, (h || 0) + 1).catch(() => {}); store.setJSON(dayKey, (d || 0) + 1).catch(() => {});
    return { busy: false };
  } catch (e) { console.error("reply: 사용량 저장소 오류", String(e.message || e)); return { busy: false, err: String(e.message || e) }; }
}

export default async (req, context) => {
  // 연결 점검: 브라우저에서 /api/reply 를 열면 실제 답장과 같은 과정으로 시험해요 (키 값은 보여 주지 않아요)
  if (req.method === "GET") {
    if (!process.env.ANTHROPIC_API_KEY) return Response.json({ key: "없음 — Netlify 환경 변수 ANTHROPIC_API_KEY 를 확인하세요" });
    const t0 = Date.now();
    const lim = await overLimit(context);
    const limitMs = Date.now() - t0;
    const r = await callClaude(prompt("요즘 시험 때문에 잠을 잘 못 자."), 220);
    const text = r.ok ? textOf(r.data) : "";
    return Response.json({ key: "있음", model: MODEL(), ok: r.ok && !!text, status: r.status, claudeMs: r.ms, limitMs, limitError: lim.err || null, sample: text || null, error: r.ok ? (text ? null : "빈 답장") : (r.data.error || r.data) });
  }
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  let msg = "";
  try { msg = String((await req.json()).msg || "").slice(0, 1000).trim(); } catch {}
  if (!msg) return Response.json({ error: "empty" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) { console.error("reply: ANTHROPIC_API_KEY 없음"); return Response.json({ error: "no key" }, { status: 500 }); }

  const lim = await overLimit(context);
  if (lim.busy) return Response.json({ error: "busy" }, { status: 429 });

  const r = await callClaude(prompt(msg), 220);
  const text = r.ok ? textOf(r.data) : "";
  if (!text){ console.error("reply: 실패", r.status, r.ms + "ms", JSON.stringify(r.data.error || r.data).slice(0, 300)); return Response.json({ error: "ai", status: r.status, type: (r.data.error && r.data.error.type) || "empty" }, { status: 502 }); }
  return Response.json({ text });
};

export const config = { path: "/api/reply" };
