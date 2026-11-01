// v17 — 定稿候选：盖条压盒沿(无缝) + 竖排节奏收紧
const { chromium } = require('playwright-core');
const dir = __dirname;

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';
const KAI = '"KaiTi","STKaiti","楷体","simkai",serif';
const GRAIN = `background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`;
const DEBOSS = `0 1px 0 rgba(255,255,255,.82), 0 -1px 1px rgba(110,84,53,.5), 0 3px 6px rgba(110,84,53,.2)`;
const EMBOSS = `0 1px 2px rgba(0,0,0,.45), 0 -1px 0 rgba(255,255,255,.22)`;
const GRAD = `linear-gradient(150deg,#7C6244 0%,#6E5435 46%,#5A4226 100%)`;

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

/* 盒盖标记 v2：盖条压住盒沿(重叠 40%)，盒口留一道细亮缝 */
function lidmark(S, opt = {}) {
  const bw = S;
  const bh = S * 0.80;
  const lidH = S * 0.115;
  const over = S * 0.135;
  const cw = bw + over * 2;
  const ch = bh + lidH * 0.62;
  const bwid = opt.bw || '';
  const css = `
    .lm { position:relative; width:${cw}px; height:${ch}px }
    .lm .body { position:absolute; bottom:0; left:50%; transform:translateX(-50%);
      width:${bw}px; height:${bh}px; border-radius:${S * 0.20}px; background:${GRAD};
      box-shadow:0 ${S * 0.14}px ${S * 0.26}px -${S * 0.085}px rgba(74,54,32,.48), inset 0 ${S * 0.016}px ${S * 0.036}px rgba(255,255,255,.18), inset 0 -${S * 0.055}px ${S * 0.12}px rgba(0,0,0,.3) }
    .lm .body:before { content:""; position:absolute; inset:${S * 0.058}px; border:${Math.max(1.3, S * 0.0055)}px solid rgba(246,240,229,.18); border-radius:${S * 0.145}px }
    .lm .body:after { content:""; position:absolute; top:${S * 0.052}px; left:${S * 0.075}px; right:${S * 0.075}px;
      height:${Math.max(2, S * 0.014)}px; border-radius:${S * 0.007}px; background:rgba(246,240,229,.30) }
    .lm .lid { position:absolute; top:0; left:50%; transform:translateX(-50%);
      width:${cw}px; height:${lidH}px; border-radius:${lidH * 0.5}px;
      background:linear-gradient(180deg,#8C7050,#6E5435 52%,#55401F);
      box-shadow:0 ${S * 0.022}px ${S * 0.045}px rgba(58,40,20,.5), inset 0 ${S * 0.012}px ${S * 0.016}px rgba(255,255,255,.4), inset 0 -2px 3px rgba(0,0,0,.32) }
  `;
  const html = `<div class="lm"><div class="lid"></div><div class="body"></div></div>`;
  return { css, html };
}

/* 竖排锁定：长「一」作盖 */
function vlock(color, shadow) {
  return `
    .lock { position:relative; width:470px; height:262px }
    .one { position:absolute; top:1px; left:50%; transform:translateX(-50%) scaleX(2.06) scaleY(.6);
      font-size:122px; font-weight:700; color:${color}; line-height:1; text-shadow:${shadow}; transform-origin:50% 50% }
    .he { position:absolute; top:60px; left:50%; transform:translateX(-50%);
      font-size:190px; font-weight:700; color:${color}; line-height:1; text-shadow:${shadow} }
  `;
}
function vhtml() {
  return `<div class="lock"><div class="one">一</div><div class="he">盒</div></div>`;
}

/* ── 01 素横排（小字标） ── */
function p1() {
  const css = stage(`
    .wrap { display:flex; flex-direction:column; align-items:center; gap:36px }
    .row { display:flex; align-items:baseline }
    .yi { font-size:118px; font-weight:700; color:${BROWN}; line-height:1; text-shadow:${DEBOSS}; transform:translateY(-10px) }
    .he { font-size:184px; font-weight:700; color:${BROWN}; line-height:1; margin-left:8px; text-shadow:${DEBOSS} }
    .sub { font-size:52px; color:${BROWN}; letter-spacing:17px; opacity:.6; text-shadow:${DEBOSS} }`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap">
    <div class="row"><div class="yi">一</div><div class="he">盒</div></div><div class="sub">ABOX</div>
  </div><div class="grain"></div></div></body></html>`;
}

/* ── 02 长「一」作盖 · 竖排 ── */
function p2(color, shadow, bg) {
  const css = stage(`
    .wrap { display:flex; flex-direction:column; align-items:center; gap:16px }
    ${vlock(color, shadow)}
    .sub { font-size:50px; color:${color}; letter-spacing:15px; opacity:.66; text-shadow:${shadow} }`, bg);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap">${vhtml()}
    <div class="sub">ABOX</div></div><div class="grain"></div></div></body></html>`;
}

/* ── 03 盒盖标 + 字标（左标右字） ── */
function p3() {
  const m = lidmark(176);
  const css = stage(`
    ${m.css}
    .wrap { display:flex; align-items:center; gap:56px }
    .txt { display:flex; flex-direction:column; align-items:flex-start; gap:10px }
    .row { display:flex; align-items:baseline }
    .yi { font-size:92px; font-weight:700; color:${BROWN}; line-height:1; text-shadow:${DEBOSS}; transform:translateY(-8px) }
    .he { font-size:146px; font-weight:700; color:${BROWN}; line-height:1; margin-left:6px; text-shadow:${DEBOSS} }
    .sub { font-size:42px; color:${BROWN}; letter-spacing:13px; opacity:.58; text-shadow:${DEBOSS} }`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap">${m.html}
    <div class="txt"><div class="row"><div class="yi">一</div><div class="he">盒</div></div>
    <div class="sub">ABOX</div></div></div><div class="grain"></div></div></body></html>`;
}

/* ── 04 盒盖标 图标（单标） ── */
function p4() {
  const m = lidmark(360);
  const css = stage(`${m.css}`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage">${m.html}<div class="grain"></div></div></body></html>`;
}

/* ── 05 盒盖标 组合（上标下字） ── */
function p5() {
  const m = lidmark(190);
  const css = stage(`
    ${m.css}
    .wrap { display:flex; flex-direction:column; align-items:center; gap:34px }
    .row { display:flex; align-items:baseline }
    .yi { font-size:96px; font-weight:700; color:${BROWN}; line-height:1; text-shadow:${DEBOSS}; transform:translateY(-8px) }
    .he { font-size:150px; font-weight:700; color:${BROWN}; line-height:1; margin-left:5px; text-shadow:${DEBOSS} }
    .sub { font-size:44px; color:${BROWN}; letter-spacing:14px; opacity:.58; text-shadow:${DEBOSS} }`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap">${m.html}
    <div class="row"><div class="yi">一</div><div class="he">盒</div></div>
    <div class="sub">ABOX</div></div><div class="grain"></div></div></body></html>`;
}

/* ── 06 反白 · 长一作盖 ── */
function p6() {
  return p2(CREAM, EMBOSS, BROWN).replace('opacity:.045', 'opacity:.035');
}

/* ── 07 应用板 ── */
function board() {
  const m = lidmark(118);
  return `<!doctype html><html><head><meta charset=utf8><style>
    * { margin:0; box-sizing:border-box }
    body { background:${CREAM}; font-family:${KAI}; color:${BROWN} }
    .grain { position:fixed; inset:0; opacity:.045; mix-blend-mode:multiply; pointer-events:none; ${GRAIN} }
    .page { width:1200px; padding:50px 72px 66px }
    .hd { display:flex; justify-content:space-between; align-items:baseline; border-bottom:2px solid rgba(110,84,53,.22); padding-bottom:14px }
    .hd .t { font-size:36px; letter-spacing:6px }
    .hd .s { font-size:18px; opacity:.6; letter-spacing:2px }
    .hero { display:flex; gap:64px; justify-content:center; align-items:center; margin:38px 0 34px }
    ${m.css}
    .hero .txt { display:flex; flex-direction:column; align-items:flex-start; gap:10px }
    .hero .row { display:flex; align-items:baseline }
    .hero .yi { font-size:68px; font-weight:700; line-height:1; text-shadow:${DEBOSS}; transform:translateY(-6px) }
    .hero .he { font-size:106px; font-weight:700; line-height:1; text-shadow:${DEBOSS} }
    .hero .sub { font-size:32px; letter-spacing:10px; opacity:.6; text-shadow:${DEBOSS} }
    .cards { display:flex; flex-direction:column; gap:14px }
    .cell { border:1px solid rgba(110,84,53,.2); border-radius:20px; padding:16px 24px; background:rgba(255,255,255,.35) }
    .cell .cap { font-size:17px; opacity:.65; letter-spacing:2px; margin-bottom:11px }
    .card { height:100px; border-radius:14px; background:linear-gradient(150deg,#FBF7EF,#F6F0E5 55%,#E9DFCE);
      box-shadow:0 10px 22px -8px rgba(74,54,32,.35), inset 0 2px 4px rgba(255,255,255,.6);
      display:flex; align-items:center; justify-content:center; gap:24px; padding:0 30px }
    .card .row2 { display:flex; align-items:baseline }
    .card .yi { font-size:36px; font-weight:700; line-height:1; text-shadow:${DEBOSS}; transform:translateY(-4px) }
    .card .he { font-size:56px; font-weight:700; line-height:1; text-shadow:${DEBOSS} }
    .card .div { width:1.5px; height:52px; background:rgba(110,84,53,.25) }
    .card .tg { font-size:14px; opacity:.6; letter-spacing:2px; line-height:1.7 }
    .band { height:90px; border-radius:12px; background:${GRAD};
      box-shadow:0 10px 24px -8px rgba(74,54,32,.5), inset 0 2px 5px rgba(255,255,255,.2);
      display:flex; align-items:center; justify-content:center; gap:24px }
    .band .row2 { display:flex; align-items:baseline }
    .band .yi { font-size:34px; font-weight:700; color:${CREAM}; line-height:1; text-shadow:${EMBOSS}; transform:translateY(-4px) }
    .band .he { font-size:50px; font-weight:700; color:${CREAM}; line-height:1; text-shadow:${EMBOSS} }
    .band .d { font-size:14px; color:rgba(246,240,229,.78); letter-spacing:4px }
    .phone { width:142px; height:238px; border-radius:26px; background:#2c2c2e; padding:10px; margin:0 auto }
    .phone .scr { width:100%; height:100%; border-radius:18px; background:${CREAM}; display:flex; align-items:center; justify-content:center }
    .phone .cw { position:relative; width:96px; height:88px }
    .phone .cw .bd { position:absolute; bottom:0; left:7px; width:82px; height:66px; border-radius:16px; background:${GRAD};
      box-shadow:inset 0 2px 4px rgba(255,255,255,.18), inset 0 -5px 10px rgba(0,0,0,.3) }
    .phone .cw .bd:after { content:""; position:absolute; top:5px; left:7px; right:7px; height:2px; background:rgba(246,240,229,.32); border-radius:1px }
    .phone .cw .ld { position:absolute; top:0; left:0; width:96px; height:11px; border-radius:6px;
      background:linear-gradient(180deg,#8C7050,#6E5435 52%,#55401F); box-shadow:0 2px 4px rgba(58,40,20,.45) }
  </style></head><body><div class="page">
    <div class="hd"><div class="t">一盒 · 定稿候选</div><div class="s">ABox 一盒 视觉应用</div></div>
    <div class="hero">${m.html}
      <div class="txt"><div class="row"><div class="yi">一</div><div class="he">盒</div></div><div class="sub">ABOX</div></div>
    </div>
    <div class="cards">
      <div class="cell"><div class="cap">名片 / 落款</div>
        <div class="card"><div class="row2"><div class="yi">一</div><div class="he">盒</div></div>
        <div class="div"></div><div class="tg">周一开团 · 11:30 热乎<br>团长送到你工位</div></div></div>
      <div class="cell"><div class="cap">包装腰封</div>
        <div class="band"><div class="row2"><div class="yi">一</div><div class="he">盒</div></div>
        <div class="d">一饭四菜 · 周一开团</div></div></div>
      <div class="cell"><div class="cap">小程序图标</div>
        <div class="phone"><div class="scr"><div class="cw"><div class="ld"></div><div class="bd"></div></div></div></div></div>
    </div>
  </div><div class="grain"></div></body></html>`;
}

(async () => {
  await shot(p1(), `${dir}/01_素横排.png`);
  await shot(p2(BROWN, DEBOSS, CREAM), `${dir}/02_长一作盖.png`);
  await shot(p3(), `${dir}/03_盒盖标_左标右字.png`);
  await shot(p4(), `${dir}/04_盒盖标_图标.png`);
  await shot(p5(), `${dir}/05_盒盖标_上标下字.png`);
  await shot(p6(), `${dir}/06_反白.png`);
  await shot(board(), `${dir}/07_应用板.png`, 1200, 1000);
  console.log('v17 done');
})().catch(e => { console.error(e); process.exit(1); });
