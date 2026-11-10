// 방문자 통계 보기 (관리용). /api/stats?key=비밀번호
// Netlify 환경 변수 STATS_KEY 에 정한 비밀번호가 맞을 때만 보여요.
import { getStore } from "@netlify/blobs";

const LABEL = {
  "home": "첫 화면", "exhibition": "EXHIBITION", "archive": "ARCHIVE", "process": "PROCESS",
  "download": "DOWNLOAD", "about": "ABOUT",
  "work-01": "EXP_01 상세", "work-02": "EXP_02 상세", "work-03": "EXP_03 상세", "work-04": "EXP_04 상세",
  "site-01": "김은빈 인터랙티브", "site-02": "김가은 인터랙티브", "site-03": "주현호 인터랙티브", "site-04": "나효린 인터랙티브",
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export default async (req) => {
  const url = new URL(req.url);
  const need = process.env.STATS_KEY;
  if (!need) return new Response("STATS_KEY 환경 변수를 먼저 설정해 주세요.", { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
  if (url.searchParams.get("key") !== need) return new Response("비밀번호가 맞지 않아요.", { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });

  const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get("days") || "30", 10) || 30));
  const store = getStore({ name: "visits", consistency: "strong" });
  const today = new Date(Date.now() + 9 * 3600e3);
  const keys = Array.from({ length: days }, (_, i) => new Date(today - i * 864e5).toISOString().slice(0, 10));
  const docs = await Promise.all(keys.map((k) => store.get(`d/${k}`, { type: "json" })));

  let tv = 0, tu = 0; const pages = {};
  const rows = keys.map((k, i) => {
    const d = docs[i] || { views: 0, uniques: 0, pages: {} };
    tv += d.views; tu += d.uniques;
    for (const [p, n] of Object.entries(d.pages || {})) pages[p] = (pages[p] || 0) + n;
    return { k, ...d };
  });
  const max = Math.max(1, ...rows.map((r) => r.views));
  const top = Object.entries(pages).sort((a, b) => b[1] - a[1]);

  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>방문자 통계 · TYPE LAB</title>
<style>
body{margin:0;background:#07060d;color:#eee;font:15px/1.5 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;padding:24px}
h1{font-size:20px;margin:0 0 4px}p.s{color:#a99fd0;margin:0 0 20px;font-size:13px}
.k{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:22px}.k div{border:1px solid #c7b3ff55;border-radius:12px;padding:12px 16px;min-width:130px}
.k b{display:block;font-size:26px;color:#fff}.k span{font-size:12px;color:#a99fd0}
h2{font-size:14px;color:#c7b3ff;letter-spacing:.06em;margin:24px 0 8px}
table{border-collapse:collapse;width:100%;max-width:720px}td,th{padding:6px 8px;border-bottom:1px solid #ffffff14;text-align:left;font-size:14px}
th{color:#a99fd0;font-weight:500}td.n{text-align:right;font-variant-numeric:tabular-nums;width:80px}
.bar{height:8px;border-radius:4px;background:linear-gradient(90deg,#9b7dff,#c7b3ff)}
nav a{color:#c7b3ff;margin-right:12px;font-size:13px}
</style></head><body>
<h1>방문자 통계</h1><p class="s">FREE FONT _ TYPE LAB · 최근 ${days}일 · 한국 시간 기준 · 같은 사람이 하루에 여러 번 와도 방문자는 1명으로 세요</p>
<nav><a href="?key=${esc(need)}&days=7">7일</a><a href="?key=${esc(need)}&days=30">30일</a><a href="?key=${esc(need)}&days=90">90일</a></nav>
<div class="k" style="margin-top:14px"><div><span>오늘 방문자</span><b>${rows[0].uniques}</b></div><div><span>오늘 조회수</span><b>${rows[0].views}</b></div>
<div><span>${days}일 방문자 합계</span><b>${tu}</b></div><div><span>${days}일 조회수 합계</span><b>${tv}</b></div></div>
<h2>페이지별 조회수</h2><table><tr><th>페이지</th><th class="n">조회</th></tr>
${top.length ? top.map(([p, n]) => `<tr><td>${esc(LABEL[p] || p)}</td><td class="n">${n}</td></tr>`).join("") : `<tr><td colspan="2">아직 기록이 없어요</td></tr>`}</table>
<h2>날짜별</h2><table><tr><th>날짜</th><th class="n">방문자</th><th class="n">조회</th><th></th></tr>
${rows.map((r) => `<tr><td>${r.k}</td><td class="n">${r.uniques}</td><td class="n">${r.views}</td><td><div class="bar" style="width:${Math.round(r.views / max * 100)}%"></div></td></tr>`).join("")}</table>
</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
};

export const config = { path: "/api/stats" };
