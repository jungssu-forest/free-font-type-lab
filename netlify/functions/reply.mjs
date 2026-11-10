// 주현호 「털어 놓아봐」 AI 답장 함수
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

export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  let msg = "";
  try { msg = String((await req.json()).msg || "").slice(0, 1000).trim(); } catch {}
  if (!msg) return Response.json({ error: "empty" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "no key" }, { status: 500 });

  // 사용량 제한
  const store = getStore("reply-limits");
  const now = new Date();
  const hourKey = `ip/${context.ip || "unknown"}/${now.toISOString().slice(0, 13)}`;
  const dayKey = `day/${now.toISOString().slice(0, 10)}`;
  const [h, d] = await Promise.all([store.get(hourKey, { type: "json" }), store.get(dayKey, { type: "json" })]);
  if ((h || 0) >= PER_HOUR || (d || 0) >= PER_DAY) return Response.json({ error: "busy" }, { status: 429 });
  await Promise.all([store.setJSON(hourKey, (h || 0) + 1), store.setJSON(dayKey, (d || 0) + 1)]);

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt(msg) }],
    }),
  });
  if (!r.ok) return Response.json({ error: "ai" }, { status: 502 });
  const data = await r.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  return Response.json({ text });
};

export const config = { path: "/api/reply" };
