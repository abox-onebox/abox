const { chromium } = require('playwright-core');
const path = require('path');

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';
const DARK  = '#523E27';
const KAI   = 'KaiTi,楷体,STKaiti';
const SERIF = 'Georgia,"Times New Roman",serif';
const SANS  = '"PingFang SC","Microsoft YaHei",sans-serif';

function sheet(inner) {
  return `<!doctype html><html><head><meta charset=utf8><style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${CREAM};font-family:${KAI};min-height:100vh;display:flex;align-items:center;justify-content:center}
  .card{width:560px;height:720px;background:${CREAM};box-shadow:0 24px 60px rgba(74,56,35,.14);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;position:relative}
  .grain{position:absolute;inset:0;background:radial-gradient(rgba(110,84,53,.05) 1px,transparent 1px);background-size:5px 5px;opacity:.5;pointer-events:none}
  ${inner.css}
  </style></head><body><div class="card">${inner.body}<div class="grain"></div></div></body></html>`;
}

// A 印 · 字标压印
const A = { css: `
  .tag{font-size:19px;letter-spacing:10px;color:${BROWN};opacity:.6}
  .zh{font-family:${KAI};font-size:172px;color:${BROWN};letter-spacing:6px;
      text-shadow:0 -1.5px 1px rgba(74,56,35,.4),0 1.5px 0 rgba(255,255,255,.55)}
  .rule{width:200px;height:2px;background:${BROWN};opacity:.4}
  .en{font-family:${SERIF};font-size:30px;letter-spacing:14px;color:${BROWN};padding-left:14px}
  `,
  body: `<div class="tag">鲜食 · 每日一盒</div>
  <div class="zh">一盒</div>
  <div class="rule"></div>
  <div class="en">ABOX</div>` };

// B 徽 · 圆形印章
const B = { css: `
  .sealtxt{font-family:${KAI};font-size:62px;fill:${BROWN};letter-spacing:4px}
  .arc{font-family:${SERIF};font-size:15px;fill:${BROWN};letter-spacing:5px}
  .tag{font-size:17px;letter-spacing:8px;color:${BROWN};opacity:.6;margin-top:18px}
  `,
  body: `<svg width="300" height="300" viewBox="0 0 300 300">
    <defs>
      <path id="topArc" d="M55 150 a95 95 0 0 1 190 0"/>
      <path id="botArc" d="M250 165 a95 95 0 0 1 -190 0"/>
    </defs>
    <circle cx="150" cy="150" r="118" fill="none" stroke="${BROWN}" stroke-width="3"/>
    <circle cx="150" cy="150" r="104" fill="none" stroke="${BROWN}" stroke-width="1" opacity=".4"/>
    <text class="arc"><textPath href="#topArc" startOffset="50%" text-anchor="middle">ABOX · FRESH MEAL</textPath></text>
    <text class="arc"><textPath href="#botArc" startOffset="50%" text-anchor="middle">每 日 一 盒</textPath></text>
    <text x="150" y="172" text-anchor="middle" class="sealtxt">一盒</text>
    <path d="M112 198 q38 20 76 0" fill="none" stroke="${BROWN}" stroke-width="3" stroke-linecap="round" opacity=".55"/>
  </svg>
  <div class="tag">一盒鲜食</div>` };

// C 块 · 色块组合
const C = { css: `
  .row{display:flex;align-items:center;gap:34px}
  .sq{width:170px;height:170px;background:${BROWN};border-radius:20px;display:flex;align-items:center;justify-content:center;box-shadow:0 14px 30px rgba(110,84,53,.28)}
  .zh{font-family:${KAI};font-size:74px;color:${BROWN};letter-spacing:8px}
  .en{font-family:${SERIF};font-size:22px;letter-spacing:11px;color:${BROWN};padding-left:11px;margin-top:6px}
  `,
  body: `<div class="row">
    <div class="sq"><svg width="96" height="96" viewBox="0 0 100 100">
      <path d="M22 60 a28 22 0 0 1 56 0" fill="none" stroke="${CREAM}" stroke-width="6"/>
      <line x1="20" y1="60" x2="80" y2="60" stroke="${CREAM}" stroke-width="6" stroke-linecap="round"/>
    </svg></div>
    <div><div class="zh">一盒</div><div class="en">ABOX</div></div>
  </div>` };

const dirs = [A, B, C];
const names = ['A_印_字标压印', 'B_徽_圆形印章', 'C_块_色块组合'];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 800 }, deviceScaleFactor: 2 });
  const dir = __dirname;
  for (let i = 0; i < 3; i++) {
    await page.setContent(sheet(dirs[i]), { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(dir, `d${i + 1}_${names[i]}.png`) });
  }

  // board
  const cols = [A, B, C].map((d, i) => `<div class="col">
    <div class="hero">${d.body.replace(/<\/?div class="grain">/g, '')}</div>
    <div class="name">${String.fromCharCode(65 + i)} · ${['印 · 字标压印','徽 · 圆形印章','块 · 色块组合'][i]}</div>
  </div>`).join('');

  const boardCss = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#ECE2D0;font-family:${KAI};padding:40px;display:flex;justify-content:center}
  .head{position:absolute;top:40px;left:0;right:0;text-align:center;font-size:30px;letter-spacing:8px;color:${BROWN}}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;max-width:1280px;margin-top:60px}
  .col{background:${CREAM};border-radius:18px;padding:30px 24px 22px;box-shadow:0 16px 40px rgba(74,56,35,.14)}
  .hero{height:360px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px}
  .name{text-align:center;font-size:17px;letter-spacing:3px;color:${BROWN};opacity:.7;padding-top:14px;border-top:1px solid rgba(110,84,53,.16);margin-top:6px}
  ${A.css} ${B.css} ${C.css}
  `;
  const board = `<!doctype html><html><head><meta charset=utf8><style>${boardCss}</style></head>
  <body><div class="head">一盒 · 三个方向</div><div class="grid">${cols}</div></body></html>`;
  await page.setViewportSize({ width: 1360, height: 760 });
  await page.setContent(board, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(dir, `00_三方向对比.png`), fullPage: true });

  await browser.close();
  console.log('done');
})();
