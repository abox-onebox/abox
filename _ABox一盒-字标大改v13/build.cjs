// v13i — 字标「一盒」定稿组：竖印章 / 横匾 / 素横排（一缩到盒七成、垂直居中）+ 应用板
const { chromium } = require('playwright-core');
const fs = require('fs');
const dir = __dirname;

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';
const KAI = '"KaiTi","STKaiti","楷体","simkai",serif';

const GRAIN = `background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`;

const DEBOSS = `0 1px 0 rgba(255,255,255,.82), 0 -1px 1px rgba(110,84,53,.5), 0 3px 6px rgba(110,84,53,.2)`;
const EMBOSS = `0 1px 2px rgba(0,0,0,.45), 0 -1px 0 rgba(255,255,255,.22)`;

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

/* ── 01 方印 · 竖排（一 作盖沿） ── */
function aHTML() {
  const css = stage(`
    .frame { position:relative; width:700px; height:730px; border:7px solid ${BROWN}; border-radius:50px;
      display:flex; align-items:center; justify-content:center; box-shadow:${DEBOSS} }
    .frame:before { content:""; position:absolute; inset:18px; border:2px solid rgba(110,84,53,.38); border-radius:32px }
    .v { position:relative; display:flex; flex-direction:column; align-items:center; transform:translateY(14px) }
    .yi { font-size:340px; font-weight:700; color:${BROWN}; line-height:1; transform:scaleX(1.1); text-shadow:${DEBOSS} }
    .he { font-size:372px; font-weight:700; color:${BROWN}; line-height:1; margin-top:-128px; text-shadow:${DEBOSS} }
    .sub { margin-top:46px; font-size:80px; color:${BROWN}; letter-spacing:24px; opacity:.72; text-shadow:${DEBOSS} }`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="frame"><div class="v"><div class="yi">一</div><div class="he">盒</div></div></div>
  <div class="sub">ABOX</div><div class="grain"></div></div></body></html>`;
}

/* ── 02 横匾 · 棕底横印 ── */
function bHTML() {
  const css = stage(`
    .wrap { display:flex; flex-direction:column; align-items:center }
    .plaque { position:relative; width:860px; height:330px; border-radius:44px;
      background:linear-gradient(150deg,#7C6244 0%,#6E5435 46%,#5A4226 100%);
      box-shadow:0 32px 58px -16px rgba(74,54,32,.5), inset 0 4px 9px rgba(255,255,255,.22), inset 0 -12px 26px rgba(0,0,0,.34);
      display:flex; align-items:center; justify-content:center }
    .plaque:before { content:""; position:absolute; inset:18px; border:2px solid rgba(246,240,229,.4); border-radius:30px }
    .row { display:flex; align-items:center; position:relative }
    .yi { font-size:200px; font-weight:700; color:${CREAM}; line-height:1; text-shadow:${EMBOSS} }
    .he { font-size:296px; font-weight:700; color:${CREAM}; line-height:1; margin-left:14px; text-shadow:${EMBOSS} }
    .sub { margin-top:44px; font-size:76px; color:${BROWN}; letter-spacing:24px; opacity:.7; text-shadow:${DEBOSS} }`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap"><div class="plaque"><div class="row"><div class="yi">一</div><div class="he">盒</div></div></div>
  <div class="sub">ABOX</div></div><div class="grain"></div></div></body></html>`;
}

/* ── 03 素横排（一 缩到盒七成、垂直居中） ── */
function cHTML() {
  const css = stage(`
    .wrap { display:flex; flex-direction:column; align-items:center }
    .row { display:flex; align-items:center }
    .yi { font-size:300px; font-weight:700; color:${BROWN}; line-height:1; transform:translateY(20px); text-shadow:${DEBOSS} }
    .he { font-size:420px; font-weight:700; color:${BROWN}; line-height:1; margin-left:-6px; text-shadow:${DEBOSS} }
    .rule { width:640px; height:2px; background:rgba(110,84,53,.32); margin-top:26px }
    .sub { margin-top:26px; font-size:74px; color:${BROWN}; letter-spacing:16px; opacity:.7; text-shadow:${DEBOSS} }`);
  return `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
  <body><div class="stage"><div class="wrap"><div class="row"><div class="yi">一</div><div class="he">盒</div></div>
  <div class="rule"></div><div class="sub">ABOX</div></div><div class="grain"></div></div></body></html>`;
}

/* ── 04 应用板 ── */
function boardHTML() {
  return `<!doctype html><html><head><meta charset=utf8><style>
    * { margin:0; box-sizing:border-box }
    body { background:${CREAM}; font-family:${KAI}; color:${BROWN} }
    .grain { position:fixed; inset:0; opacity:.05; mix-blend-mode:multiply; pointer-events:none; ${GRAIN} }
    .page { width:1200px; padding:60px 72px 76px }
    .hd { display:flex; justify-content:space-between; align-items:baseline; border-bottom:2px solid rgba(110,84,53,.22); padding-bottom:18px }
    .hd .t { font-size:42px; letter-spacing:6px }
    .hd .s { font-size:21px; opacity:.6; letter-spacing:2px }
    .hero { display:flex; justify-content:center; margin:40px 0 46px }
    .frame { position:relative; width:360px; height:376px; border:4px solid ${BROWN}; border-radius:26px;
      display:flex; align-items:center; justify-content:center; box-shadow:${DEBOSS} }
    .frame:before { content:""; position:absolute; inset:10px; border:1.4px solid rgba(110,84,53,.38); border-radius:16px }
    .v { display:flex; flex-direction:column; align-items:center; transform:translateY(8px) }
    .v .yi { font-size:176px; font-weight:700; line-height:1; transform:scaleX(1.1); text-shadow:${DEBOSS} }
    .v .he { font-size:192px; font-weight:700; line-height:1; margin-top:-66px; text-shadow:${DEBOSS} }
    .row { display:flex; flex-direction:column; gap:20px }
    .cell { border:1px solid rgba(110,84,53,.2); border-radius:20px; padding:24px 26px; background:rgba(255,255,255,.35) }
    .cell .cap { font-size:20px; opacity:.65; letter-spacing:2px; margin-bottom:18px }
    /* 名片：横排字标 */
    .card { height:160px; border-radius:14px; background:linear-gradient(150deg,#FBF7EF,#F6F0E5 55%,#E9DFCE);
      box-shadow:0 10px 22px -8px rgba(74,54,32,.35), inset 0 2px 4px rgba(255,255,255,.6);
      display:flex; align-items:center; justify-content:center; gap:44px; padding:0 40px }
    .card .row2 { display:flex; align-items:center }
    .card .yi { font-size:76px; font-weight:700; line-height:1; text-shadow:${DEBOSS} }
    .card .he { font-size:104px; font-weight:700; line-height:1; margin-left:6px; text-shadow:${DEBOSS} }
    .card .div { width:1.5px; height:86px; background:rgba(110,84,53,.25) }
    .card .tg { font-size:18px; opacity:.6; letter-spacing:2px; line-height:1.8 }
    /* 腰封 */
    .band { height:130px; border-radius:12px; background:linear-gradient(150deg,#7C6244,#6E5435 46%,#5A4226);
      box-shadow:0 10px 24px -8px rgba(74,54,32,.5), inset 0 2px 5px rgba(255,255,255,.2);
      display:flex; align-items:center; justify-content:center; gap:40px }
    .band .row2 { display:flex; align-items:center }
    .band .yi { font-size:64px; font-weight:700; color:${CREAM}; line-height:1; text-shadow:${EMBOSS} }
    .band .he { font-size:92px; font-weight:700; color:${CREAM}; line-height:1; margin-left:8px; text-shadow:${EMBOSS} }
    .band .d { font-size:19px; color:rgba(246,240,229,.75); letter-spacing:4px }
    /* 图标 */
    .phone { width:180px; height:300px; border-radius:26px; background:#2c2c2e; padding:12px; margin:0 auto }
    .phone .scr { width:100%; height:100%; border-radius:18px; background:${CREAM}; display:flex; align-items:center; justify-content:center }
    .phone .ic { width:122px; height:122px; border-radius:30px;
      background:linear-gradient(150deg,#7C6244,#6E5435 46%,#5A4226);
      box-shadow:inset 0 3px 6px rgba(255,255,255,.22), inset 0 -8px 16px rgba(0,0,0,.32);
      display:flex; flex-direction:column; align-items:center; justify-content:center }
    .phone .ic .yi { font-size:60px; font-weight:700; color:${CREAM}; line-height:1; transform:scaleX(1.08); text-shadow:${EMBOSS} }
    .phone .ic .he { font-size:66px; font-weight:700; color:${CREAM}; line-height:1; margin-top:-22px; text-shadow:${EMBOSS} }
  </style></head><body><div class="page">
    <div class="hd"><div class="t">一盒 · 字标</div><div class="s">ABox 一盒 视觉应用</div></div>
    <div class="hero"><div class="frame"><div class="v"><div class="yi">一</div><div class="he">盒</div></div></div></div>
    <div class="row">
      <div class="cell"><div class="cap">名片 / 落款</div>
        <div class="card"><div class="row2"><div class="yi">一</div><div class="he">盒</div></div>
        <div class="div"></div><div class="tg">周一开团 · 11:30 热乎<br>团长送到你工位</div></div></div>
      <div class="cell"><div class="cap">包装腰封</div>
        <div class="band"><div class="row2"><div class="yi">一</div><div class="he">盒</div></div>
        <div class="d">一饭四菜 · 周一开团</div></div></div>
      <div class="cell"><div class="cap">小程序图标</div>
        <div class="phone"><div class="scr"><div class="ic"><div class="yi">一</div><div class="he">盒</div></div></div></div></div>
    </div>
  </div><div class="grain"></div></body></html>`;
}

(async () => {
  await shot(aHTML(), `${dir}/01_方印_竖排.png`);
  await shot(bHTML(), `${dir}/02_横匾.png`);
  await shot(cHTML(), `${dir}/03_素横排.png`);
  await shot(boardHTML(), `${dir}/04_应用板.png`, 1200, 1000);
  console.log('v13i done');
})().catch(e => { console.error(e); process.exit(1); });
