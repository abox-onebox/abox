// v16 — A 长「一」作盖(竖排) / B 方盒+盖条标记 / C 反白
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

/* 盒盖标记：方盒 + 一根伸出盒沿的盖条 */
function lidmark(S) {
  const bw = S, bh = S * 0.82;
  const css = `
    .lm { position:relative; width:${bw * 1.24}px; height:${bh + S * 0.2}px; display:flex; justify-content:center; align-items:flex-end }
    .lm .body { position:relative; width:${bw}px; height:${bh}px; border-radius:${S * 0.19}px; background:${GRAD};
      box-shadow:0 ${S * 0.15}px ${S * 0.28}px -${S * 0.09}px rgba(74,54,32,.5), inset 0 ${S * 0.018}px ${S * 0.04}px rgba(255,255,255,.2), inset 0 -${S * 0.06}px ${S * 0.13}px rgba(0,0,0,.32) }
    .lm .body:before { content:""; position:absolute; inset:${S * 0.06}px; border:${Math.max(1.4, S * 0.006)}px solid rgba(246,240,229,.2); border-radius:${S * 0.14}px }
    .lm .lid { position:absolute; top:${S * 0.065}px; left:50%; transform:translateX(-50%);
      width:${bw * 1.2}px; height:${S * 0.115}px; border-radius:${S * 0.055}px;
      background:linear-gradient(180deg,#8A6E4C,#6E5435 55%,#54401F);
      box-shadow:0 ${S * 0.03}px ${S * 0.06}px rgba(60,42,22,.5), inset 0 2px 2px rgba(255,255,255,.35), inset 0 -2px 3px rgba(0,0,0,.3) }
  `;
  const html = `<div class="lm"><div class="lid"></div><div class="body"></div></div>`;
  return { css, html };
}

/* ── A1 素横排（缩小·光学对齐） ── */
function a1() {
  const css = stage(`
    .wrap { display:flex; flex-direction:column; align-items:center; gap:38px }
    .row { display:flex; align-items:baseline }
    .yi { font-size:118px; font-weight:700; color:${BROWN}; line-height:1; text-shadow:${DEBOSS}; transform:translateY(-10px) }
    .he { font-size:184px; font-weight:700; color:${BROWN}; line-height:1; margin-left:8px; text-shadow:${DEBOSS} }
    .sub { font-size:54px; color:${BROWN}; letter-spacing:17px; opacity:.6; text-shadow:${DEBOSS} }`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap">
    <div class="row"><div class="yi">一</div><div class="he">盒</div></div>
    <div class="sub">ABOX</div></div><div class="grain"></div></div></body></html>`;
}

/* ── A2 竖排·长「一」作盖（拉长压扁的笔锋，贴住盒顶） ── */
function a2() {
  const css = stage(`
    .wrap { display:flex; flex-direction:column; align-items:center; gap:44px }
    .lock { position:relative; width:460px; height:330px }
    .one { position:absolute; top:0; left:50%; transform:translateX(-50%) scaleX(2.0) scaleY(.62);
      font-size:120px; font-weight:700; color:${BROWN}; line-height:1; text-shadow:${DEBOSS};
      transform-origin:50% 50% }
    .he { position:absolute; top:74px; left:50%; transform:translateX(-50%);
      font-size:186px; font-weight:700; color:${BROWN}; line-height:1; text-shadow:${DEBOSS} }
    .sub { font-size:54px; color:${BROWN}; letter-spacing:17px; opacity:.6; text-shadow:${DEBOSS} }`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap">
    <div class="lock"><div class="one">一</div><div class="he">盒</div></div>
    <div class="sub">ABOX</div></div><div class="grain"></div></div></body></html>`;
}

/* ── B1 盒盖标记 + 小字标（上标下字） ── */
function b1() {
  const m = lidmark(210);
  const css = stage(`
    ${m.css}
    .wrap { display:flex; flex-direction:column; align-items:center; gap:40px }
    .row { display:flex; align-items:baseline }
    .yi { font-size:104px; font-weight:700; color:${BROWN}; line-height:1; text-shadow:${DEBOSS}; transform:translateY(-9px) }
    .he { font-size:160px; font-weight:700; color:${BROWN}; line-height:1; margin-left:6px; text-shadow:${DEBOSS} }
    .sub { font-size:48px; color:${BROWN}; letter-spacing:15px; opacity:.58; text-shadow:${DEBOSS} }`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap">${m.html}
    <div class="row"><div class="yi">一</div><div class="he">盒</div></div>
    <div class="sub">ABOX</div></div><div class="grain"></div></div></body></html>`;
}

/* ── B2 盒盖标记 横排锁定（标左字右） ── */
function b2() {
  const m = lidmark(190);
  const css = stage(`
    ${m.css}
    .wrap { display:flex; align-items:center; gap:52px }
    .txt { display:flex; flex-direction:column; align-items:flex-start; gap:14px }
    .row { display:flex; align-items:baseline }
    .yi { font-size:96px; font-weight:700; color:${BROWN}; line-height:1; text-shadow:${DEBOSS}; transform:translateY(-8px) }
    .he { font-size:148px; font-weight:700; color:${BROWN}; line-height:1; margin-left:6px; text-shadow:${DEBOSS} }
    .sub { font-size:44px; color:${BROWN}; letter-spacing:14px; opacity:.58; text-shadow:${DEBOSS} }`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap">${m.html}
    <div class="txt"><div class="row"><div class="yi">一</div><div class="he">盒</div></div>
    <div class="sub">ABOX</div></div></div><div class="grain"></div></div></body></html>`;
}

/* ── B3 盒盖标记 单标 ── */
function b3() {
  const m = lidmark(400);
  const css = stage(`${m.css}`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage">${m.html}<div class="grain"></div></div></body></html>`;
}

/* ── C 反白（长一竖排） ── */
function c1() {
  const css = stage(`
    .wrap { display:flex; flex-direction:column; align-items:center; gap:40px }
    .lock { position:relative; width:460px; height:330px }
    .one { position:absolute; top:0; left:50%; transform:translateX(-50%) scaleX(2.0) scaleY(.62);
      font-size:120px; font-weight:700; color:${CREAM}; line-height:1; text-shadow:${EMBOSS}; transform-origin:50% 50% }
    .he { position:absolute; top:74px; left:50%; transform:translateX(-50%);
      font-size:186px; font-weight:700; color:${CREAM}; line-height:1; text-shadow:${EMBOSS} }
    .sub { font-size:54px; color:${CREAM}; letter-spacing:17px; opacity:.72; text-shadow:${EMBOSS} }`, BROWN);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap">
    <div class="lock"><div class="one">一</div><div class="he">盒</div></div>
    <div class="sub">ABOX</div></div><div class="grain"></div></div></body></html>`;
}

/* ── 应用板 ── */
function board() {
  const m = lidmark(132);
  return `<!doctype html><html><head><meta charset=utf8><style>
    * { margin:0; box-sizing:border-box }
    body { background:${CREAM}; font-family:${KAI}; color:${BROWN} }
    .grain { position:fixed; inset:0; opacity:.045; mix-blend-mode:multiply; pointer-events:none; ${GRAIN} }
    .page { width:1200px; padding:52px 72px 68px }
    .hd { display:flex; justify-content:space-between; align-items:baseline; border-bottom:2px solid rgba(110,84,53,.22); padding-bottom:14px }
    .hd .t { font-size:37px; letter-spacing:6px }
    .hd .s { font-size:18px; opacity:.6; letter-spacing:2px }
    .hero { display:flex; gap:70px; justify-content:center; align-items:center; margin:40px 0 38px }
    ${m.css}
    .hero .txt { display:flex; flex-direction:column; align-items:flex-start; gap:12px }
    .hero .row { display:flex; align-items:baseline }
    .hero .yi { font-size:74px; font-weight:700; line-height:1; text-shadow:${DEBOSS}; transform:translateY(-6px) }
    .hero .he { font-size:114px; font-weight:700; line-height:1; text-shadow:${DEBOSS} }
    .hero .sub { font-size:34px; letter-spacing:11px; opacity:.6; text-shadow:${DEBOSS} }
    .cards { display:flex; flex-direction:column; gap:15px }
    .cell { border:1px solid rgba(110,84,53,.2); border-radius:20px; padding:18px 24px; background:rgba(255,255,255,.35) }
    .cell .cap { font-size:17px; opacity:.65; letter-spacing:2px; margin-bottom:12px }
    .card { height:106px; border-radius:14px; background:linear-gradient(150deg,#FBF7EF,#F6F0E5 55%,#E9DFCE);
      box-shadow:0 10px 22px -8px rgba(74,54,32,.35), inset 0 2px 4px rgba(255,255,255,.6);
      display:flex; align-items:center; justify-content:center; gap:26px; padding:0 32px }
    .card .row2 { display:flex; align-items:baseline }
    .card .yi { font-size:40px; font-weight:700; line-height:1; text-shadow:${DEBOSS}; transform:translateY(-4px) }
    .card .he { font-size:60px; font-weight:700; line-height:1; text-shadow:${DEBOSS} }
    .card .div { width:1.5px; height:56px; background:rgba(110,84,53,.25) }
    .card .tg { font-size:14px; opacity:.6; letter-spacing:2px; line-height:1.7 }
    .band { height:96px; border-radius:12px; background:${GRAD};
      box-shadow:0 10px 24px -8px rgba(74,54,32,.5), inset 0 2px 5px rgba(255,255,255,.2);
      display:flex; align-items:center; justify-content:center; gap:26px }
    .band .row2 { display:flex; align-items:baseline }
    .band .yi { font-size:38px; font-weight:700; color:${CREAM}; line-height:1; text-shadow:${EMBOSS}; transform:translateY(-4px) }
    .band .he { font-size:54px; font-weight:700; color:${CREAM}; line-height:1; text-shadow:${EMBOSS} }
    .band .d { font-size:15px; color:rgba(246,240,229,.78); letter-spacing:4px }
    .phone { width:146px; height:246px; border-radius:26px; background:#2c2c2e; padding:11px; margin:0 auto }
    .phone .scr { width:100%; height:100%; border-radius:18px; background:${CREAM}; display:flex; align-items:center; justify-content:center }
    .phone .icw { position:relative; width:112px; height:100px }
    .phone .icw .bd { position:absolute; bottom:0; left:11px; width:90px; height:74px; border-radius:18px; background:${GRAD};
      box-shadow:inset 0 2px 4px rgba(255,255,255,.2), inset 0 -6px 12px rgba(0,0,0,.32) }
    .phone .icw .ld { position:absolute; top:0; left:0; width:112px; height:13px; border-radius:6px;
      background:linear-gradient(180deg,#8A6E4C,#6E5435 55%,#54401F); box-shadow:0 2px 4px rgba(60,42,22,.45) }
  </style></head><body><div class="page">
    <div class="hd"><div class="t">一盒 · 盒盖标记</div><div class="s">ABox 一盒 视觉应用</div></div>
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
        <div class="phone"><div class="scr"><div class="icw"><div class="ld"></div><div class="bd"></div></div></div></div></div>
    </div>
  </div><div class="grain"></div></body></html>`;
}

(async () => {
  await shot(a1(), `${dir}/A1_素横排.png`);
  await shot(a2(), `${dir}/A2_竖排长一作盖.png`);
  await shot(b1(), `${dir}/B1_盒盖标_上标下字.png`);
  await shot(b2(), `${dir}/B2_盒盖标_左标右字.png`);
  await shot(b3(), `${dir}/B3_盒盖标_单标.png`);
  await shot(c1(), `${dir}/C_反白.png`);
  await shot(board(), `${dir}/D_应用板.png`, 1200, 1000);
  console.log('v16 done');
})().catch(e => { console.error(e); process.exit(1); });
