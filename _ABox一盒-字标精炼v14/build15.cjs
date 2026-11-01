// v15 — 三条轴：A「一」作盖压在「盒」上 / B 便当格(一饭四菜) / C 素字标留白
// 中文统一缩小到 1024 画布的 ~15-19%，靠结构而非字号取分量
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
  .grain { position:absolute; inset:0; opacity:.05; mix-blend-mode:multiply; pointer-events:none; ${GRAIN} }
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

/* ── 便当格：左一格饭 + 右四格菜（一饭四菜） ── */
function bento(S, opt = {}) {
  const fill = opt.fill || GRAD;
  const line = opt.line || CREAM;
  const pad = S * 0.093;
  const inner = S - pad * 2;
  const t = S * 0.020;
  const leftW = inner * 0.40;
  const rightW = inner - leftW - t;
  const rightHalf = (rightW - t) / 2;
  const css = `
    .bento { position:relative; width:${S}px; height:${S}px; border-radius:${S * 0.225}px;
      background:${fill};
      box-shadow:0 26px 50px -16px rgba(74,54,32,.52), inset 0 3px 7px rgba(255,255,255,.2), inset 0 -10px 22px rgba(0,0,0,.32) }
    .bento i { position:absolute; display:block; background:${line}; border-radius:${t / 2}px;
      box-shadow:0 1px 1px rgba(0,0,0,.28) }
    .bento .v1 { left:${pad + leftW}px; top:${pad}px; width:${t}px; height:${inner}px }
    .bento .v2 { left:${pad + leftW + t + rightHalf}px; top:${pad}px; width:${t}px; height:${inner}px }
    .bento .h  { left:${pad + leftW + t}px; top:${pad + (inner - t) / 2}px; width:${rightW}px; height:${t}px }
    .bento .rim { position:absolute; inset:${S * 0.045}px; border:${Math.max(1.5, S * 0.005)}px solid rgba(246,240,229,.22); border-radius:${S * 0.185}px; background:none; box-shadow:none }
  `;
  const html = `<div class="bento"><i class="v1"></i><i class="v2"></i><i class="h"></i><i class="rim"></i></div>`;
  return { css, html };
}

/* ── A1 素横排（中文缩小） ── */
function a1() {
  const css = stage(`
    .wrap { display:flex; flex-direction:column; align-items:center; gap:40px }
    .row { display:flex; align-items:baseline }
    .yi { font-size:132px; font-weight:700; color:${BROWN}; line-height:1; text-shadow:${DEBOSS}; transform:translateY(-6px) }
    .he { font-size:186px; font-weight:700; color:${BROWN}; line-height:1; margin-left:2px; text-shadow:${DEBOSS} }
    .sub { font-size:56px; color:${BROWN}; letter-spacing:17px; opacity:.62; text-shadow:${DEBOSS} }`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap">
    <div class="row"><div class="yi">一</div><div class="he">盒</div></div>
    <div class="sub">ABOX</div></div><div class="grain"></div></div></body></html>`;
}

/* ── A2 横排 + 「一」作盖线压在盒顶（对齐盒宽、贴紧） ── */
function a2() {
  const css = stage(`
    .wrap { display:flex; flex-direction:column; align-items:center; gap:40px }
    .row { position:relative; display:flex; align-items:flex-end }
    .yi { font-size:132px; font-weight:700; color:${BROWN}; line-height:1; text-shadow:${DEBOSS}; transform:translateY(-4px) }
    .heWrap { position:relative; margin-left:6px }
    .he { font-size:186px; font-weight:700; color:${BROWN}; line-height:1; text-shadow:${DEBOSS} }
    .lid { position:absolute; left:50%; transform:translateX(-50%); top:-22px; width:196px; height:13px;
      border-radius:3px; background:${BROWN}; box-shadow:${DEBOSS} }
    .sub { font-size:56px; color:${BROWN}; letter-spacing:17px; opacity:.62; text-shadow:${DEBOSS} }`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap">
    <div class="row"><div class="yi">一</div><div class="heWrap"><div class="lid"></div><div class="he">盒</div></div></div>
    <div class="sub">ABOX</div></div><div class="grain"></div></div></body></html>`;
}

/* ── A3 竖印：一贴紧盒顶(不留缝)，细框 ── */
function a3() {
  const css = stage(`
    .frame { position:relative; width:470px; height:520px; border:4px solid ${BROWN}; border-radius:34px;
      display:flex; align-items:center; justify-content:center; box-shadow:${DEBOSS} }
    .frame:before { content:""; position:absolute; inset:12px; border:1.4px solid rgba(110,84,53,.34); border-radius:24px }
    .v { position:relative; display:flex; flex-direction:column; align-items:center; transform:translateY(6px) }
    .yi { font-size:128px; font-weight:700; color:${BROWN}; line-height:1; text-shadow:${DEBOSS} }
    .he { font-size:152px; font-weight:700; color:${BROWN}; line-height:1; margin-top:-46px; text-shadow:${DEBOSS} }
    .sub { position:absolute; bottom:40px; font-size:48px; color:${BROWN}; letter-spacing:14px; opacity:.6; text-shadow:${DEBOSS} }`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="frame"><div class="v"><div class="yi">一</div><div class="he">盒</div></div>
  <div class="sub">ABOX</div></div><div class="grain"></div></div></body></html>`;
}

/* ── B1 便当格 + 横排小字标 ── */
function b1() {
  const m = bento(300);
  const css = stage(`
    ${m.css}
    .wrap { display:flex; flex-direction:column; align-items:center; gap:44px }
    .row { display:flex; align-items:baseline }
    .yi { font-size:110px; font-weight:700; color:${BROWN}; line-height:1; text-shadow:${DEBOSS}; transform:translateY(-5px) }
    .he { font-size:156px; font-weight:700; color:${BROWN}; line-height:1; margin-left:2px; text-shadow:${DEBOSS} }
    .sub { font-size:52px; color:${BROWN}; letter-spacing:16px; opacity:.6; text-shadow:${DEBOSS} }`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap">${m.html}
    <div class="row"><div class="yi">一</div><div class="he">盒</div></div>
    <div class="sub">ABOX</div></div><div class="grain"></div></div></body></html>`;
}

/* ── B2 便当格单标（图标候选） ── */
function b2() {
  const m = bento(440);
  const css = stage(`${m.css}`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage">${m.html}<div class="grain"></div></div></body></html>`;
}

/* ── C 反白素字标 ── */
function c1() {
  const css = stage(`
    .wrap { display:flex; flex-direction:column; align-items:center; gap:36px }
    .row { display:flex; align-items:baseline }
    .yi { font-size:128px; font-weight:700; color:${CREAM}; line-height:1; text-shadow:${EMBOSS}; transform:translateY(-6px) }
    .he { font-size:180px; font-weight:700; color:${CREAM}; line-height:1; margin-left:2px; text-shadow:${EMBOSS} }
    .sub { font-size:54px; color:${CREAM}; letter-spacing:16px; opacity:.72; text-shadow:${EMBOSS} }`, BROWN);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap">
    <div class="row"><div class="yi">一</div><div class="he">盒</div></div>
    <div class="sub">ABOX</div></div><div class="grain"></div></div></body></html>`;
}

/* ── 应用板 ── */
function board() {
  const m = bento(150);
  return `<!doctype html><html><head><meta charset=utf8><style>
    * { margin:0; box-sizing:border-box }
    body { background:${CREAM}; font-family:${KAI}; color:${BROWN} }
    .grain { position:fixed; inset:0; opacity:.05; mix-blend-mode:multiply; pointer-events:none; ${GRAIN} }
    .page { width:1200px; padding:54px 72px 70px }
    .hd { display:flex; justify-content:space-between; align-items:baseline; border-bottom:2px solid rgba(110,84,53,.22); padding-bottom:15px }
    .hd .t { font-size:38px; letter-spacing:6px }
    .hd .s { font-size:19px; opacity:.6; letter-spacing:2px }
    .hero { display:flex; gap:74px; justify-content:center; align-items:center; margin:44px 0 42px }
    ${m.css}
    .hero .txt { display:flex; flex-direction:column; align-items:center; gap:16px }
    .hero .row { display:flex; align-items:baseline }
    .hero .yi { font-size:86px; font-weight:700; line-height:1; text-shadow:${DEBOSS}; transform:translateY(-4px) }
    .hero .he { font-size:120px; font-weight:700; line-height:1; text-shadow:${DEBOSS} }
    .hero .sub { font-size:38px; letter-spacing:11px; opacity:.62; text-shadow:${DEBOSS} }
    .cards { display:flex; flex-direction:column; gap:16px }
    .cell { border:1px solid rgba(110,84,53,.2); border-radius:20px; padding:20px 24px; background:rgba(255,255,255,.35) }
    .cell .cap { font-size:18px; opacity:.65; letter-spacing:2px; margin-bottom:14px }
    .card { height:112px; border-radius:14px; background:linear-gradient(150deg,#FBF7EF,#F6F0E5 55%,#E9DFCE);
      box-shadow:0 10px 22px -8px rgba(74,54,32,.35), inset 0 2px 4px rgba(255,255,255,.6);
      display:flex; align-items:center; justify-content:center; gap:28px; padding:0 34px }
    .card .row2 { display:flex; align-items:baseline }
    .card .yi { font-size:44px; font-weight:700; line-height:1; text-shadow:${DEBOSS}; transform:translateY(-3px) }
    .card .he { font-size:62px; font-weight:700; line-height:1; text-shadow:${DEBOSS} }
    .card .div { width:1.5px; height:58px; background:rgba(110,84,53,.25) }
    .card .tg { font-size:15px; opacity:.6; letter-spacing:2px; line-height:1.7 }
    .band { height:100px; border-radius:12px; background:${GRAD};
      box-shadow:0 10px 24px -8px rgba(74,54,32,.5), inset 0 2px 5px rgba(255,255,255,.2);
      display:flex; align-items:center; justify-content:center; gap:28px }
    .band .row2 { display:flex; align-items:baseline }
    .band .yi { font-size:40px; font-weight:700; color:${CREAM}; line-height:1; text-shadow:${EMBOSS}; transform:translateY(-3px) }
    .band .he { font-size:56px; font-weight:700; color:${CREAM}; line-height:1; text-shadow:${EMBOSS} }
    .band .d { font-size:16px; color:rgba(246,240,229,.78); letter-spacing:4px }
    .phone { width:150px; height:252px; border-radius:26px; background:#2c2c2e; padding:11px; margin:0 auto }
    .phone .scr { width:100%; height:100%; border-radius:18px; background:${CREAM}; display:flex; align-items:center; justify-content:center }
    .phone .ic { width:104px; height:104px; position:relative; border-radius:24px; background:${GRAD};
      box-shadow:inset 0 3px 6px rgba(255,255,255,.22), inset 0 -8px 16px rgba(0,0,0,.32) }
    .phone .ic i { position:absolute; background:${CREAM}; border-radius:2px }
    .phone .ic .v1 { left:38px; top:14px; width:3px; height:76px }
    .phone .ic .v2 { left:69px; top:14px; width:3px; height:76px }
    .phone .ic .h { left:41px; top:50px; width:52px; height:3px }
  </style></head><body><div class="page">
    <div class="hd"><div class="t">一盒 · 三条轴</div><div class="s">ABox 一盒 视觉应用</div></div>
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
        <div class="phone"><div class="scr"><div class="ic"><i class="v1"></i><i class="v2"></i><i class="h"></i></div></div></div></div>
    </div>
  </div><div class="grain"></div></body></html>`;
}

(async () => {
  await shot(a1(), `${dir}/A1_素横排.png`);
  await shot(a2(), `${dir}/A2_一作盖.png`);
  await shot(a3(), `${dir}/A3_竖印.png`);
  await shot(b1(), `${dir}/B1_便当格.png`);
  await shot(b2(), `${dir}/B2_便当格单标.png`);
  await shot(c1(), `${dir}/C_反白.png`);
  await shot(board(), `${dir}/D_应用板.png`, 1200, 1000);
  console.log('v15 done');
})().catch(e => { console.error(e); process.exit(1); });
