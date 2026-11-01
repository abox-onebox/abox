// v18 定稿包 r2：修正缩小检验空字符 / 图标改反白竖排 / 应用板主次归位
const { chromium } = require('playwright-core');
const dir = __dirname;

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';
const KAI = '"KaiTi","STKaiti","楷体","simkai",serif';
const GRAIN = `background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`;
const DEBOSS = `0 1px 0 rgba(255,255,255,.82), 0 -1px 1px rgba(110,84,53,.5), 0 3px 6px rgba(110,84,53,.2)`;
const EMBOSS = `0 1px 2px rgba(0,0,0,.45), 0 -1px 0 rgba(255,255,255,.22)`;
const GRAD = `linear-gradient(150deg,#7C6244 0%,#6E5435 46%,#5A4226 100%)`;
const LIDG = `linear-gradient(180deg,#8C7050,#6E5435 52%,#55401F)`;

function stage(extra, bg = CREAM) {
  return `* { margin:0; box-sizing:border-box }
  html,body { height:100%; background:${bg}; display:flex; align-items:center; justify-content:center; font-family:${KAI} }
  .stage { width:1024px; height:1024px; position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; background:${bg} }
  .grain { position:absolute; inset:0; opacity:.045; mix-blend-mode:multiply; pointer-events:none; ${GRAIN} }
  ${extra}`;
}
function shot(html, file, w = 1024, h = 1024) {
  return (async () => {
    const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await p.setContent(html, { waitUntil: 'load' });
    await p.waitForTimeout(350);
    await p.screenshot({ path: file, fullPage: true });
    await b.close();
  })();
}

/* 竖排锁定（基准 470×262，盒 190） */
const LOCK_CSS = (color, shadow) => `
  .lock { position:relative; width:470px; height:262px }
  .lock .one { position:absolute; top:1px; left:50%; transform:translateX(-50%) scaleX(2.06) scaleY(.6);
    font-size:122px; font-weight:700; color:${color}; line-height:1; text-shadow:${shadow}; transform-origin:50% 50% }
  .lock .he { position:absolute; top:60px; left:50%; transform:translateX(-50%);
    font-size:190px; font-weight:700; color:${color}; line-height:1; text-shadow:${shadow} }
`;
const LOCK_HTML = `<div class="lock"><div class="one">一</div><div class="he">盒</div></div>`;

function lidmark(S) {
  const bw = S, bh = S * 0.80, lidH = S * 0.10, lidW = S * 1.10;
  const css = `
    .lm { position:relative; width:${lidW}px; height:${bh + lidH * 0.55}px }
    .lm .body { position:absolute; bottom:0; left:50%; transform:translateX(-50%);
      width:${bw}px; height:${bh}px; border-radius:${S * 0.115}px; background:${GRAD};
      box-shadow:0 ${S * 0.13}px ${S * 0.24}px -${S * 0.08}px rgba(74,54,32,.45), inset 0 ${S * 0.016}px ${S * 0.03}px rgba(255,255,255,.18), inset 0 -${S * 0.05}px ${S * 0.11}px rgba(0,0,0,.3) }
    .lm .body:before { content:""; position:absolute; inset:${S * 0.055}px; border:${Math.max(1.2, S * 0.0055)}px solid rgba(246,240,229,.16); border-radius:${S * 0.075}px }
    .lm .lid { position:absolute; top:0; left:50%; transform:translateX(-50%);
      width:${lidW}px; height:${lidH}px; border-radius:${S * 0.018}px; background:${LIDG};
      box-shadow:0 ${S * 0.024}px ${S * 0.045}px rgba(58,40,20,.5), inset 0 ${S * 0.008}px ${S * 0.01}px rgba(255,255,255,.4) }
  `;
  return { css, html: `<div class="lm"><div class="lid"></div><div class="body"></div></div>` };
}

/* ── 01 主标 · 竖排 ── */
function p1(color = BROWN, shadow = DEBOSS, bg = CREAM) {
  const css = stage(`${LOCK_CSS(color, shadow)}
    .wrap { display:flex; flex-direction:column; align-items:center; gap:18px }
    .sub { font-size:50px; color:${color}; letter-spacing:15px; opacity:.66; text-shadow:${shadow} }`, bg);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap">${LOCK_HTML}<div class="sub">ABOX</div></div>
  <div class="grain"></div></div></body></html>`;
}

/* ── 02 横排字标 ── */
function p2() {
  const css = stage(`
    .wrap { display:flex; flex-direction:column; align-items:center; gap:32px }
    .row { display:flex; align-items:baseline }
    .yi { font-size:116px; font-weight:700; color:${BROWN}; line-height:1; text-shadow:${DEBOSS}; transform:translateY(-10px) }
    .he { font-size:182px; font-weight:700; color:${BROWN}; line-height:1; margin-left:8px; text-shadow:${DEBOSS} }
    .sub { font-size:50px; color:${BROWN}; letter-spacing:16px; opacity:.6; text-shadow:${DEBOSS} }`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap">
    <div class="row"><div class="yi">一</div><div class="he">盒</div></div><div class="sub">ABOX</div>
  </div><div class="grain"></div></div></body></html>`;
}

/* ── 03 反白 ── */
const p3 = () => p1(CREAM, EMBOSS, BROWN).replace('opacity:.045', 'opacity:.03');

/* ── 04 图标三选 ── */
function p4() {
  const m = lidmark(118);
  const css = `* { margin:0; box-sizing:border-box }
    body { background:${CREAM}; font-family:${KAI}; color:${BROWN}; padding:44px 0 }
    .grain { position:fixed; inset:0; opacity:.045; mix-blend-mode:multiply; pointer-events:none; ${GRAIN} }
    .page { width:1120px; margin:0 auto; display:flex; flex-direction:column; gap:26px }
    .ttl { font-size:32px; letter-spacing:5px; padding-bottom:14px; border-bottom:2px solid rgba(110,84,53,.2) }
    .row { display:flex; gap:34px; justify-content:center }
    .item { display:flex; flex-direction:column; align-items:center; gap:16px }
    .ic { width:250px; height:250px; border-radius:56px; display:flex; align-items:center; justify-content:center;
      box-shadow:0 18px 34px -14px rgba(74,54,32,.45) }
    .ic.brown { background:${GRAD} }
    .ic.cream { background:${CREAM}; border:2px solid rgba(110,84,53,.3) }
    .cap { font-size:17px; opacity:.62; letter-spacing:1px }
    .mini { transform:scale(.44); transform-origin:center }
    .mini2 { transform:scale(.44); transform-origin:center }
    ${LOCK_CSS(BROWN, DEBOSS)}
    .rev .lock .one, .rev .lock .he { color:${CREAM}; text-shadow:${EMBOSS} }
    ${m.css}
    .small { transform:scale(1); transform-origin:center }
  `;
  const item = (cls, inner, cap) => `<div class="item"><div class="ic ${cls}">${inner}</div><div class="cap">${cap}</div></div>`;
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head><body>
  <div class="page"><div class="ttl">一盒 · 图标三选</div>
    <div class="row">
      ${item('brown rev', `<div class="mini">${LOCK_HTML}</div>`, 'A · 反白竖排（推荐）')}
      ${item('cream', `<div class="mini">${LOCK_HTML}</div>`, 'B · 米底棕字')}
      ${item('cream', `<div class="small">${m.html}</div>`, 'C · 盒盖标（备选）')}
    </div></div><div class="grain"></div></body></html>`;
}

/* ── 05 缩小检验（横向六档） ── */
function p5() {
  const base = { w: 470, h: 262 };
  const scales = [1, 0.62, 0.40, 0.26, 0.17, 0.11];
  const labels = ['190 / 主视觉', '118 / 名片', '76 / 腰封', '49 / 导航', '32 / 列表', '21 / 角标'];
  const items = scales.map((k, i) => `
    <div class="item">
      <div class="bx" style="width:${base.w * k}px;height:${base.h * k}px">
        <div class="sc" style="transform:scale(${k})">${LOCK_HTML}</div>
      </div>
      <div class="lb">${labels[i]}</div>
    </div>`).join('');
  const css = stage(`
    .page { width:100%; padding:0 84px; display:flex; flex-direction:column; gap:22px; align-items:flex-start }
    .ttl { font-size:32px; letter-spacing:5px; padding-bottom:13px; border-bottom:2px solid rgba(110,84,53,.2); width:100% }
    .item { display:flex; align-items:center; gap:26px; width:100%; position:relative }
    .bx { position:relative; flex:0 0 auto; overflow:visible }
    .sc { position:absolute; top:0; left:0; transform-origin:top left }
    .lb { position:absolute; left:520px; top:50%; transform:translateY(-50%); font-size:15px; opacity:.5; letter-spacing:.5px; white-space:nowrap }
    .note { font-size:15px; opacity:.48; letter-spacing:.5px; padding-top:10px; border-top:1px solid rgba(110,84,53,.14); width:100% }
    ${LOCK_CSS(BROWN, DEBOSS)}`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="page"><div class="ttl">一盒 · 缩小检验</div>
  ${items}
  <div class="note">21px 时「一」已并入盒身轮廓，属正常极限；实际最小使用尺寸建议 ≥ 32px（更小请用反白图标）。</div>
  </div><div class="grain"></div></div></body></html>`;
}

/* ── 06 应用板 ── */
function board() {
  return `<!doctype html><html><head><meta charset=utf8><style>
    * { margin:0; box-sizing:border-box }
    body { background:${CREAM}; font-family:${KAI}; color:${BROWN} }
    .grain { position:fixed; inset:0; opacity:.045; mix-blend-mode:multiply; pointer-events:none; ${GRAIN} }
    .page { width:1200px; padding:48px 72px 60px }
    .hd { display:flex; justify-content:space-between; align-items:baseline; border-bottom:2px solid rgba(110,84,53,.22); padding-bottom:13px }
    .hd .t { font-size:35px; letter-spacing:6px }
    .hd .s { font-size:18px; opacity:.6; letter-spacing:2px }
    .hero { display:flex; gap:64px; justify-content:center; align-items:flex-end; margin:34px 0 30px }
    ${LOCK_CSS(BROWN, DEBOSS)}
    .hero .lock { transform:scale(.92); transform-origin:bottom center }
    .hero .col { display:flex; flex-direction:column; align-items:center; gap:10px }
    .hero .sub { font-size:28px; letter-spacing:9px; opacity:.6; text-shadow:${DEBOSS} }
    .rev { padding:22px 34px; border-radius:34px; background:${GRAD}; box-shadow:0 18px 34px -16px rgba(74,54,32,.5) }
    .rev .lock .one, .rev .lock .he { color:${CREAM}; text-shadow:${EMBOSS} }
    .rev .lock { transform:scale(.34) translateY(22px); transform-origin:center }
    .rev { width:200px; height:200px; display:flex; align-items:center; justify-content:center }
    .cards { display:flex; flex-direction:column; gap:13px }
    .cell { border:1px solid rgba(110,84,53,.2); border-radius:20px; padding:15px 24px; background:rgba(255,255,255,.35) }
    .cell .cap { font-size:16px; opacity:.65; letter-spacing:2px; margin-bottom:10px }
    .card { height:98px; border-radius:14px; background:linear-gradient(150deg,#FBF7EF,#F6F0E5 55%,#E9DFCE);
      box-shadow:0 10px 22px -8px rgba(74,54,32,.35), inset 0 2px 4px rgba(255,255,255,.6);
      display:flex; align-items:center; justify-content:center; gap:22px; padding:0 28px }
    .card .row2 { display:flex; align-items:baseline }
    .card .yi { font-size:34px; font-weight:700; line-height:1; text-shadow:${DEBOSS}; transform:translateY(-4px) }
    .card .he { font-size:54px; font-weight:700; line-height:1; text-shadow:${DEBOSS} }
    .card .div { width:1.5px; height:50px; background:rgba(110,84,53,.25) }
    .card .tg { font-size:13px; opacity:.6; letter-spacing:2px; line-height:1.7 }
    .band { height:88px; border-radius:12px; background:${GRAD};
      box-shadow:0 10px 24px -8px rgba(74,54,32,.5), inset 0 2px 5px rgba(255,255,255,.2);
      display:flex; align-items:center; justify-content:center; gap:22px }
    .band .row2 { display:flex; align-items:baseline }
    .band .yi { font-size:32px; font-weight:700; color:${CREAM}; line-height:1; text-shadow:${EMBOSS}; transform:translateY(-4px) }
    .band .he { font-size:48px; font-weight:700; color:${CREAM}; line-height:1; text-shadow:${EMBOSS} }
    .band .d { font-size:13px; color:rgba(246,240,229,.78); letter-spacing:4px }
    .phone { width:138px; height:232px; border-radius:25px; background:#2c2c2e; padding:10px; margin:0 auto }
    .phone .scr { width:100%; height:100%; border-radius:17px; background:${CREAM}; display:flex; align-items:center; justify-content:center }
    .phone .cw { width:96px; height:96px; border-radius:23px; background:${GRAD}; display:flex; align-items:center; justify-content:center; box-shadow:inset 0 2px 4px rgba(255,255,255,.18) }
    .phone .cw .lock { transform:scale(.17) translateY(46px); transform-origin:center }
    .phone .cw .lock .one, .phone .cw .lock .he { color:${CREAM}; text-shadow:none }
  </style></head><body><div class="page">
    <div class="hd"><div class="t">一盒 · 字标 v18</div><div class="s">ABox 一盒 视觉应用</div></div>
    <div class="hero">
      <div class="col"><div class="lock"><div class="one">一</div><div class="he">盒</div></div><div class="sub">ABOX</div></div>
      <div class="rev"><div class="lock"><div class="one">一</div><div class="he">盒</div></div></div>
    </div>
    <div class="cards">
      <div class="cell"><div class="cap">名片 / 落款</div>
        <div class="card"><div class="row2"><div class="yi">一</div><div class="he">盒</div></div>
        <div class="div"></div><div class="tg">周一开团 · 11:30 热乎<br>团长送到你工位</div></div></div>
      <div class="cell"><div class="cap">包装腰封</div>
        <div class="band"><div class="row2"><div class="yi">一</div><div class="he">盒</div></div>
        <div class="d">一饭四菜 · 周一开团</div></div></div>
      <div class="cell"><div class="cap">小程序图标</div>
        <div class="phone"><div class="scr"><div class="cw"><div class="lock"><div class="one">一</div><div class="he">盒</div></div></div></div></div></div>
    </div>
  </div><div class="grain"></div></body></html>`;
}

(async () => {
  await shot(p1(), `${dir}/01_主标_竖排.png`);
  await shot(p2(), `${dir}/02_字标_横排.png`);
  await shot(p3(), `${dir}/03_反白.png`);
  await shot(p4(), `${dir}/04_图标三选.png`, 1200, 460);
  await shot(p5(), `${dir}/05_缩小检验.png`);
  await shot(board(), `${dir}/06_应用板.png`, 1200, 1000);
  console.log('v18 r2 done');
})().catch(e => { console.error(e); process.exit(1); });
