// v14 — 字标「一盒」精炼：中文缩小、比例克制，标记(方盒+盖线)承担记忆点
const { chromium } = require('playwright-core');
const dir = __dirname;

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';
const KAI = '"KaiTi","STKaiti","楷体","simkai",serif';

const GRAIN = `background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`;

const DEBOSS = `0 1px 0 rgba(255,255,255,.82), 0 -1px 1px rgba(110,84,53,.5), 0 3px 6px rgba(110,84,53,.2)`;
const EMBOSS = `0 1px 2px rgba(0,0,0,.45), 0 -1px 0 rgba(255,255,255,.22)`;
const BROWN_GRAD = `linear-gradient(150deg,#7C6244 0%,#6E5435 46%,#5A4226 100%)`;

function stage(extra) {
  return `* { margin:0; box-sizing:border-box }
  html,body { height:100%; background:${CREAM}; display:flex; align-items:center; justify-content:center; font-family:${KAI} }
  .stage { width:1024px; height:1024px; position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; background:${CREAM} }
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

/* 标记：方盒 + 一道盖线(一)。可独立使用，也可与字标组合 */
function emblem(size, opt = {}) {
  const lid = opt.lid === false ? '' :
    `<div class="lid"></div>`;
  const css = `
    .em { position:relative; width:${size}px; height:${size}px; border-radius:${size*0.21}px;
      background:${BROWN_GRAD}; box-shadow:0 26px 48px -14px rgba(74,54,32,.5), inset 0 3px 7px rgba(255,255,255,.22), inset 0 -10px 22px rgba(0,0,0,.32);
      display:flex; align-items:center; justify-content:center }
    .em:before { content:""; position:absolute; inset:${size*0.075}px; border:2px solid rgba(246,240,229,.42); border-radius:${size*0.15}px }
    .lid { position:absolute; top:${size*0.3}px; left:${size*0.2}px; right:${size*0.2}px; height:${size*0.052}px;
      border-radius:${size*0.026}px; background:${CREAM}; box-shadow:${EMBOSS} }
    .slot { position:absolute; bottom:${size*0.16}px; left:${size*0.27}px; right:${size*0.27}px; height:${size*0.05}px;
      border-radius:${size*0.025}px; background:rgba(246,240,229,.5) }
  `;
  return { css, html: `<div class="em">${lid}<div class="slot"></div></div>` };
}

/* ── 01 方印徽 + 横排小字标 ── */
function aHTML() {
  const e = emblem(280);
  const css = stage(`
    ${e.css}
    .wrap { display:flex; flex-direction:column; align-items:center; gap:46px }
    .row { display:flex; align-items:center; gap:40px }
    .yi { font-size:150px; font-weight:700; color:${BROWN}; line-height:1; text-shadow:${DEBOSS} }
    .he { font-size:200px; font-weight:700; color:${BROWN}; line-height:1; margin-left:-4px; text-shadow:${DEBOSS} }
    .sub { font-size:62px; color:${BROWN}; letter-spacing:18px; opacity:.66; text-shadow:${DEBOSS} }`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap">
    ${e.html}
    <div class="row"><div class="yi">一</div><div class="he">盒</div></div>
    <div class="sub">ABOX</div>
  </div><div class="grain"></div></div></body></html>`;
}

/* ── 02 圆章徽 + 竖排小字标 ── */
function bHTML() {
  const css = stage(`
    .wrap { display:flex; flex-direction:column; align-items:center; gap:40px }
    .seal { position:relative; width:300px; height:300px; border-radius:50%; background:${BROWN_GRAD};
      box-shadow:0 26px 48px -14px rgba(74,54,32,.5), inset 0 3px 7px rgba(255,255,255,.22), inset 0 -10px 22px rgba(0,0,0,.32);
      display:flex; align-items:center; justify-content:center }
    .seal:before { content:""; position:absolute; inset:20px; border:2px solid rgba(246,240,229,.42); border-radius:50% }
    .seal .l { position:absolute; top:96px; left:66px; right:66px; height:13px; border-radius:6px; background:${CREAM}; box-shadow:${EMBOSS} }
    .seal .s { position:absolute; bottom:60px; left:96px; right:96px; height:11px; border-radius:5px; background:rgba(246,240,229,.5) }
    .v { position:relative; display:flex; flex-direction:column; align-items:center }
    .yi { font-size:150px; font-weight:700; color:${BROWN}; line-height:1; text-shadow:${DEBOSS} }
    .he { font-size:170px; font-weight:700; color:${BROWN}; line-height:1; margin-top:-56px; text-shadow:${DEBOSS} }`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap">
    <div class="seal"><div class="l"></div><div class="s"></div></div>
    <div class="v"><div class="yi">一</div><div class="he">盒</div></div>
  </div><div class="grain"></div></div></body></html>`;
}

/* ── 03 横排 + 盒上加一道盖线(一) ── */
function cHTML() {
  const css = stage(`
    .wrap { display:flex; flex-direction:column; align-items:center; gap:48px }
    .row { position:relative; display:flex; align-items:center }
    .yi { font-size:140px; font-weight:700; color:${BROWN}; line-height:1; transform:translateY(18px); text-shadow:${DEBOSS} }
    .he { font-size:205px; font-weight:700; color:${BROWN}; line-height:1; margin-left:-4px; text-shadow:${DEBOSS} }
    .cap { position:absolute; top:-6px; left:50%; transform:translateX(-50%); width:${230}px; height:8px; border-radius:4px; background:${BROWN}; opacity:.85; box-shadow:${DEBOSS} }
    .rule { width:520px; height:2px; background:rgba(110,84,53,.3) }
    .sub { font-size:60px; color:${BROWN}; letter-spacing:18px; opacity:.66; text-shadow:${DEBOSS} }`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap">
    <div class="row"><div class="cap"></div><div class="yi">一</div><div class="he">盒</div></div>
    <div class="rule"></div><div class="sub">ABOX</div>
  </div><div class="grain"></div></div></body></html>`;
}

/* ── 04 竖排 + 大量留白(中文缩小、居中) ── */
function dHTML() {
  const css = stage(`
    .frame { position:relative; width:560px; height:560px; border:5px solid ${BROWN}; border-radius:40px;
      display:flex; align-items:center; justify-content:center; box-shadow:${DEBOSS} }
    .frame:before { content:""; position:absolute; inset:14px; border:1.6px solid rgba(110,84,53,.36); border-radius:26px }
    .v { position:relative; display:flex; flex-direction:column; align-items:center; transform:translateY(10px) }
    .yi { font-size:150px; font-weight:700; color:${BROWN}; line-height:1; text-shadow:${DEBOSS} }
    .he { font-size:166px; font-weight:700; color:${BROWN}; line-height:1; margin-top:-58px; text-shadow:${DEBOSS} }
    .sub { position:absolute; bottom:54px; font-size:54px; color:${BROWN}; letter-spacing:16px; opacity:.62; text-shadow:${DEBOSS} }`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="frame"><div class="v"><div class="yi">一</div><div class="he">盒</div></div>
  <div class="sub">ABOX</div></div><div class="grain"></div></div></body></html>`;
}

/* ── 05 反白版(棕底米字·小字标) ── */
function eHTML() {
  const css = stage(`
    .stage { background:${BROWN} }
    .wrap { display:flex; flex-direction:column; align-items:center; gap:42px }
    .row { display:flex; align-items:center; gap:34px }
    .yi { font-size:140px; font-weight:700; color:${CREAM}; line-height:1; text-shadow:${EMBOSS} }
    .he { font-size:196px; font-weight:700; color:${CREAM}; line-height:1; margin-left:-3px; text-shadow:${EMBOSS} }
    .sub { font-size:60px; color:${CREAM}; letter-spacing:18px; opacity:.72; text-shadow:${EMBOSS} }`);
  const st = css.replace('.grain {', '.grain { opacity:.04;');
  return `<!doctype html><html><head><meta charset=utf8><style>${st}</style></head>
  <body><div class="stage"><div class="wrap">
    <div class="row"><div class="yi">一</div><div class="he">盒</div></div>
    <div class="sub">ABOX</div>
  </div><div class="grain"></div></div></body></html>`;
}

/* ── 06 极简线框(描边版·单色) ── */
function fHTML() {
  const css = stage(`
    .wrap { display:flex; flex-direction:column; align-items:center; gap:44px }
    .row { display:flex; align-items:center; gap:36px }
    .yi { font-size:140px; font-weight:700; color:${BROWN}; line-height:1; -webkit-text-stroke:2px ${BROWN}; text-shadow:none }
    .he { font-size:196px; font-weight:700; color:${BROWN}; line-height:1; margin-left:-3px; -webkit-text-stroke:2px ${BROWN}; text-shadow:none }
    .eml { position:relative; width:150px; height:150px; border:5px solid ${BROWN}; border-radius:30px }
    .eml:before { content:""; position:absolute; top:48px; left:24px; right:24px; height:6px; border-radius:3px; background:${BROWN} }
    .sub { font-size:58px; color:${BROWN}; letter-spacing:16px; opacity:.66 }`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap">
    <div class="row"><div class="yi">一</div><div class="he">盒</div></div>
    <div class="eml"></div>
    <div class="sub">ABOX</div>
  </div><div class="grain"></div></div></body></html>`;
}

/* ── 07 应用板 ── */
function boardHTML() {
  const e = emblem(150);
  return `<!doctype html><html><head><meta charset=utf8><style>
    * { margin:0; box-sizing:border-box }
    body { background:${CREAM}; font-family:${KAI}; color:${BROWN} }
    .grain { position:fixed; inset:0; opacity:.05; mix-blend-mode:multiply; pointer-events:none; ${GRAIN} }
    .page { width:1200px; padding:56px 72px 72px }
    .hd { display:flex; justify-content:space-between; align-items:baseline; border-bottom:2px solid rgba(110,84,53,.22); padding-bottom:16px }
    .hd .t { font-size:40px; letter-spacing:6px }
    .hd .s { font-size:20px; opacity:.6; letter-spacing:2px }
    .hero { display:flex; gap:60px; justify-content:center; align-items:center; margin:42px 0 46px }
    ${e.css}
    .hero .txt { display:flex; flex-direction:column; align-items:center; gap:18px }
    .hero .row { display:flex; align-items:center; gap:18px }
    .hero .yi { font-size:96px; font-weight:700; line-height:1; text-shadow:${DEBOSS} }
    .hero .he { font-size:128px; font-weight:700; line-height:1; text-shadow:${DEBOSS} }
    .hero .sub { font-size:42px; letter-spacing:12px; opacity:.66; text-shadow:${DEBOSS} }
    .row { display:flex; flex-direction:column; gap:18px }
    .cell { border:1px solid rgba(110,84,53,.2); border-radius:20px; padding:22px 26px; background:rgba(255,255,255,.35) }
    .cell .cap { font-size:19px; opacity:.65; letter-spacing:2px; margin-bottom:16px }
    .card { height:120px; border-radius:14px; background:linear-gradient(150deg,#FBF7EF,#F6F0E5 55%,#E9DFCE);
      box-shadow:0 10px 22px -8px rgba(74,54,32,.35), inset 0 2px 4px rgba(255,255,255,.6);
      display:flex; align-items:center; justify-content:center; gap:30px; padding:0 36px }
    .card .row2 { display:flex; align-items:center; gap:8px }
    .card .yi { font-size:52px; font-weight:700; line-height:1; text-shadow:${DEBOSS} }
    .card .he { font-size:70px; font-weight:700; line-height:1; text-shadow:${DEBOSS} }
    .card .div { width:1.5px; height:64px; background:rgba(110,84,53,.25) }
    .card .tg { font-size:16px; opacity:.6; letter-spacing:2px; line-height:1.7 }
    .band { height:104px; border-radius:12px; background:${BROWN_GRAD};
      box-shadow:0 10px 24px -8px rgba(74,54,32,.5), inset 0 2px 5px rgba(255,255,255,.2);
      display:flex; align-items:center; justify-content:center; gap:30px }
    .band .row2 { display:flex; align-items:center; gap:8px }
    .band .yi { font-size:46px; font-weight:700; color:${CREAM}; line-height:1; text-shadow:${EMBOSS} }
    .band .he { font-size:64px; font-weight:700; color:${CREAM}; line-height:1; text-shadow:${EMBOSS} }
    .band .d { font-size:17px; color:rgba(246,240,229,.78); letter-spacing:4px }
    .phone { width:160px; height:268px; border-radius:26px; background:#2c2c2e; padding:11px; margin:0 auto }
    .phone .scr { width:100%; height:100%; border-radius:18px; background:${CREAM}; display:flex; align-items:center; justify-content:center }
    .phone .ic { width:104px; height:104px; border-radius:26px; background:${BROWN_GRAD};
      box-shadow:inset 0 3px 6px rgba(255,255,255,.22), inset 0 -8px 16px rgba(0,0,0,.32);
      display:flex; align-items:center; justify-content:center }
    .phone .ic .l { position:absolute; top:30px; left:24px; right:24px; height:5px; border-radius:3px; background:${CREAM} }
    .phone .ic .s { position:absolute; bottom:22px; left:32px; right:32px; height:4px; border-radius:2px; background:rgba(246,240,229,.5) }
    .phone .ic { position:relative }
  </style></head><body><div class="page">
    <div class="hd"><div class="t">一盒 · 字标精炼</div><div class="s">ABox 一盒 视觉应用</div></div>
    <div class="hero">
      ${e.html}
      <div class="txt"><div class="row"><div class="yi">一</div><div class="he">盒</div></div><div class="sub">ABOX</div></div>
    </div>
    <div class="row">
      <div class="cell"><div class="cap">名片 / 落款</div>
        <div class="card"><div class="row2"><div class="yi">一</div><div class="he">盒</div></div>
        <div class="div"></div><div class="tg">周一开团 · 11:30 热乎<br>团长送到你工位</div></div></div>
      <div class="cell"><div class="cap">包装腰封</div>
        <div class="band"><div class="row2"><div class="yi">一</div><div class="he">盒</div></div>
        <div class="d">一饭四菜 · 周一开团</div></div></div>
      <div class="cell"><div class="cap">小程序图标</div>
        <div class="phone"><div class="scr"><div class="ic"><div class="l"></div><div class="s"></div></div></div></div></div>
    </div>
  </div><div class="grain"></div></body></html>`;
}

(async () => {
  await shot(aHTML(), `${dir}/01_方印徽_横排小字标.png`);
  await shot(bHTML(), `${dir}/02_圆章徽_竖排小字标.png`);
  await shot(cHTML(), `${dir}/03_横排_盒上盖线.png`);
  await shot(dHTML(), `${dir}/04_竖排_留白.png`);
  await shot(eHTML(), `${dir}/05_反白版.png`);
  await shot(fHTML(), `${dir}/06_极简线框.png`);
  await shot(boardHTML(), `${dir}/07_应用板.png`, 1200, 1000);
  console.log('v14 done');
})().catch(e => { console.error(e); process.exit(1); });
