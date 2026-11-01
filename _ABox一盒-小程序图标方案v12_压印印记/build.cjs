// v12 — 压印印记：把"一盒"做成一枚真正盖进米纸的楷体印记
// 质感来自真实压印工艺（高光+暗影+纸纹），不是堆元素
const { chromium } = require('playwright-core');
const fs = require('fs');
const dir = __dirname;

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';
const KAI = '"KaiTi","STKaiti","楷体","simkai",serif';

const GRAIN = `background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`;

function glyphCSS(variant) {
  const onCream = variant === 'color';
  const stageBg = onCream ? CREAM : BROWN;
  const boxBg = onCream
    ? 'linear-gradient(150deg,#7C6244 0%,#6E5435 45%,#5A4226 100%)'
    : 'linear-gradient(150deg,#FBF7EF 0%,#F6F0E5 45%,#E9DFCE 100%)';
  const yiColor = onCream ? CREAM : BROWN;
  const seamColor = onCream ? 'rgba(246,240,229,.45)' : 'rgba(110,84,53,.40)';
  const boxShadow = onCream
    ? '0 30px 50px -10px rgba(74,54,32,.45), inset 0 4px 8px rgba(255,255,255,.22), inset 0 -10px 22px rgba(0,0,0,.32)'
    : '0 30px 50px -10px rgba(40,28,16,.45), inset 0 4px 8px rgba(255,255,255,.6), inset 0 -10px 22px rgba(110,84,53,.25)';
  return `
    *{margin:0;box-sizing:border-box}
    html,body{height:100%;background:${stageBg};display:flex;align-items:center;justify-content:center}
    .stage{width:1024px;height:1024px;position:relative;display:flex;align-items:center;justify-content:center;background:${stageBg}}
    .grain{position:absolute;inset:0;opacity:.06;mix-blend-mode:multiply;pointer-events:none;${GRAIN}}
    .box{position:relative;width:648px;height:648px;border-radius:104px;background:${boxBg};box-shadow:${boxShadow};
      display:flex;align-items:center;justify-content:center}
    .yi{position:absolute;top:21%;font-family:${KAI};font-size:340px;color:${yiColor};line-height:1;
      font-weight:700;text-shadow:0 6px 12px rgba(0,0,0,.35)}
    .seam{position:absolute;bottom:27%;width:60%;height:7px;border-radius:4px;background:${seamColor}}
  `;
}
function glyphHTML(variant) {
  return `<!doctype html><html><head><meta charset=utf8><style>${glyphCSS(variant)}</style></head>
  <body><div class="stage"><div class="box"><div class="yi">一</div><div class="seam"></div></div><div class="grain"></div></div></body></html>`;
}

function wordmarkHTML() {
  return `<!doctype html><html><head><meta charset=utf8><style>
    *{margin:0;box-sizing:border-box}
    html,body{height:100%;background:${CREAM};display:flex;align-items:center;justify-content:center}
    .stage{width:1024px;height:1024px;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${CREAM}}
    .grain{position:absolute;inset:0;opacity:.06;mix-blend-mode:multiply;pointer-events:none;${GRAIN}}
    .wm{font-family:${KAI};font-size:430px;color:${BROWN};line-height:1;font-weight:700;
      text-shadow:0 -2px 2px rgba(0,0,0,.30),0 2px 2px rgba(255,255,255,.65)}
    .sub{margin-top:36px;font-family:${KAI};font-size:96px;color:${BROWN};opacity:.78;letter-spacing:18px;
      text-shadow:0 -1px 1px rgba(0,0,0,.25),0 1px 1px rgba(255,255,255,.6)}
  </style></head><body><div class="stage"><div class="wm">一盒</div><div class="sub">A B o x</div><div class="grain"></div></div></body></html>`;
}

async function shot(html, file, w = 1024, h = 1024, scale = 1) {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await p.setContent(html, { waitUntil: 'load' });
  await p.waitForTimeout(300);
  await p.screenshot({ path: file, fullPage: true });
  await b.close();
}

(async () => {
  await shot(glyphHTML('color'), `${dir}/01_印记_正色.png`, 1024, 1024, 1);
  await shot(glyphHTML('reversed'), `${dir}/02_印记_反白.png`, 1024, 1024, 1);
  await shot(wordmarkHTML(), `${dir}/03_字标_一盒.png`, 1024, 1024, 1);
  console.log('v12 base renders done');
  // 品牌应用板
  const board = `<!doctype html><html><head><meta charset=utf8><style>
    *{margin:0;box-sizing:border-box}
    body{background:${CREAM};font-family:${KAI};color:${BROWN}}
    .page{width:1200px;padding:72px 80px 88px}
    .hd{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid rgba(110,84,53,.25);padding-bottom:22px}
    .hd .t{font-size:46px;letter-spacing:6px}
    .hd .s{font-size:24px;opacity:.6;letter-spacing:2px}
    .hero{display:flex;justify-content:center;margin:54px 0 64px}
    .hero .box{width:430px;height:430px;border-radius:70px;background:linear-gradient(150deg,#7C6244,#6E5435 45%,#5A4226);
      box-shadow:0 24px 44px -8px rgba(74,54,32,.5),inset 0 3px 7px rgba(255,255,255,.22),inset 0 -8px 18px rgba(0,0,0,.32);
      position:relative;display:flex;align-items:center;justify-content:center}
    .hero .yi{position:absolute;top:21%;font-size:228px;color:${CREAM};text-shadow:0 5px 10px rgba(0,0,0,.35)}
    .hero .seam{position:absolute;bottom:27%;width:60%;height:5px;border-radius:3px;background:rgba(246,240,229,.45)}
    .row{display:flex;flex-direction:column;gap:26px;margin-top:8px}
    .cell{flex:1;border:1px solid rgba(110,84,53,.2);border-radius:24px;padding:30px 26px;background:rgba(255,255,255,.35)}
    .cell .cap{font-size:22px;opacity:.65;letter-spacing:2px;margin-bottom:22px}
    /* 手机 */
    .phone{width:176px;height:300px;border-radius:28px;background:#2c2c2e;padding:12px;margin:0 auto}
    .phone .scr{width:100%;height:100%;border-radius:20px;background:${CREAM};display:flex;align-items:center;justify-content:center}
    .phone .ic{width:120px;height:120px;border-radius:30px;background:linear-gradient(150deg,#7C6244,#6E5435 45%,#5A4226);
      box-shadow:inset 0 3px 6px rgba(255,255,255,.22),inset 0 -7px 14px rgba(0,0,0,.32);position:relative;display:flex;align-items:center;justify-content:center}
    .phone .ic .y{position:absolute;top:22%;font-size:62px;color:${CREAM};text-shadow:0 2px 4px rgba(0,0,0,.35)}
    .phone .ic .s{position:absolute;bottom:24%;width:58%;height:3px;border-radius:2px;background:rgba(246,240,229,.45)}
    /* 封条 */
    .seal{width:210px;height:210px;border-radius:50%;background:linear-gradient(150deg,#7C6244,#6E5435 45%,#5A4226);
      box-shadow:0 12px 24px -6px rgba(74,54,32,.5),inset 0 3px 6px rgba(255,255,255,.2),inset 0 -7px 14px rgba(0,0,0,.3);
      margin:0 auto;position:relative;display:flex;align-items:center;justify-content:center}
    .seal .y{position:absolute;top:21%;font-size:112px;color:${CREAM};text-shadow:0 4px 8px rgba(0,0,0,.35)}
    .seal .s{position:absolute;bottom:24%;width:56%;height:4px;border-radius:2px;background:rgba(246,240,229,.45)}
    /* 名片 */
    .card{height:128px;border-radius:16px;background:linear-gradient(150deg,#FBF7EF,#F6F0E5 55%,#E9DFCE);
      box-shadow:0 10px 22px -8px rgba(74,54,32,.35),inset 0 2px 4px rgba(255,255,255,.6);
      display:flex;align-items:center;justify-content:space-between;padding:0 30px}
    .card .wm{font-size:60px;color:${BROWN};text-shadow:0 -1px 1px rgba(0,0,0,.28),0 1px 1px rgba(255,255,255,.6)}
    .card .tg{font-size:18px;opacity:.6;letter-spacing:2px;text-align:right;line-height:1.5}
  </style></head><body><div class="page">
    <div class="hd"><div class="t">一盒 · 品牌印记</div><div class="s">ABox 一盒 视觉应用</div></div>
    <div class="hero"><div class="box"><div class="yi">一</div><div class="seam"></div></div></div>
    <div class="row">
      <div class="cell"><div class="cap">小程序头像</div><div class="phone"><div class="scr"><div class="ic"><div class="y">一</div><div class="s"></div></div></div></div></div></div>
      <div class="cell"><div class="cap">包装封条</div><div class="seal"><div class="y">一</div><div class="s"></div></div></div></div>
      <div class="cell"><div class="cap">名片 / 落款</div><div class="card"><div class="wm">一盒</div><div class="tg">周一开团 · 11:30 热乎<br>送到你工位</div></div></div></div>
    </div>
  </div></body></html>`;
  await shot(board, `${dir}/04_品牌应用板.png`, 1200, 980, 1);
  console.log('v12 board done');
})().catch(e => { console.error(e); process.exit(1); });
