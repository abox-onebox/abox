const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';

// base art frame shared by every single-mark page
const BASE = `.art{width:600px;height:600px;background:${CREAM};display:flex;align-items:center;justify-content:center;overflow:hidden}`;

// 10 fresh flat-vector directions built on the correct wordmark "ABox"
const marks = [
  { n: '01_FrameBox', label: '01 · Frame Box',
    css: `.fb{font-family:'Helvetica Neue',Arial,sans-serif;font-weight:800;font-size:128px;color:${BROWN};letter-spacing:6px;display:inline-flex;align-items:center;border:9px solid ${BROWN};padding:34px 46px;line-height:1}
  .fb .o{display:inline-block;width:.46em;height:.46em;background:${BROWN};border-radius:4px;margin:0 .15em;vertical-align:middle}`,
    html: `<div class="fb"><span>A</span><span>B</span><span class="o">o</span><span>x</span></div>` },

  { n: '02_LidBase', label: '02 · Lid & Base',
    css: `.la{display:flex;flex-direction:column;align-items:center}
  .la .lid{width:300px;height:11px;background:${BROWN};border-radius:6px}
  .la .w{font-family:'Georgia',serif;font-weight:700;font-size:138px;color:${BROWN};letter-spacing:5px;margin:-4px 0}
  .la .base{width:392px;height:13px;background:${BROWN};border-radius:6px}`,
    html: `<div class="la"><div class="lid"></div><div class="w">ABox</div><div class="base"></div></div>` },

  { n: '03_DiagonalTile', label: '03 · Diagonal Tile',
    css: `.ds{width:392px;height:392px;background:linear-gradient(135deg,${BROWN} 0 50%,${CREAM} 50% 100%);display:flex;align-items:center;justify-content:center;border-radius:16px}
  .ds .pill{background:${CREAM};padding:28px 42px;border-radius:10px;font-family:'Helvetica Neue',Arial;font-weight:800;font-size:84px;color:${BROWN};letter-spacing:3px}`,
    html: `<div class="ds"><div class="pill">ABox</div></div>` },

  { n: '04_BrownTile', label: '04 · Brown Tile',
    css: `.tl{width:392px;height:392px;background:${BROWN};border-radius:28px;display:flex;align-items:center;justify-content:center}
  .tl .w{font-family:'Georgia',serif;font-weight:700;font-size:122px;color:${CREAM};letter-spacing:3px}
  .tl .o{color:transparent;-webkit-text-stroke:7px ${CREAM}}`,
    html: `<div class="tl"><span class="w">A</span><span class="w">B</span><span class="w o">o</span><span class="w">x</span></div>` },

  { n: '05_Outline', label: '05 · Outline',
    css: `.ol{font-family:'Helvetica Neue',Arial;font-weight:800;font-size:146px;color:transparent;-webkit-text-stroke:5px ${BROWN};letter-spacing:4px}
  .ol .o{color:${BROWN};-webkit-text-stroke:0}`,
    html: `<div class="ol"><span>A</span><span>B</span><span class="o">o</span><span>x</span></div>` },

  { n: '06_ChopstickX', label: '06 · Chopstick X',
    css: `.cx{font-family:'Helvetica Neue',Arial;font-weight:800;font-size:132px;color:${BROWN};letter-spacing:7px;display:inline-flex;align-items:center}
  .cx .x{display:inline-flex;align-items:center;justify-content:center;width:.6em;height:.92em;margin-left:2px}
  .cx .x svg{width:100%;height:100%}`,
    html: `<span class="cx"><span>A</span><span>B</span><span>o</span><span class="x"><svg viewBox="0 0 70 96"><line x1="9" y1="9" x2="61" y2="87" stroke="${BROWN}" stroke-width="12" stroke-linecap="round"/><line x1="61" y1="9" x2="9" y2="87" stroke="${BROWN}" stroke-width="12" stroke-linecap="round"/></svg></span></span>` },

  { n: '07_PillLabel', label: '07 · Pill Label',
    css: `.pl{display:inline-flex;align-items:center;gap:20px;background:${CREAM};border:6px solid ${BROWN};border-radius:90px;padding:28px 56px}
  .pl .w{font-family:'Georgia',serif;font-weight:700;font-size:106px;color:${BROWN};letter-spacing:2px}
  .pl .dot{width:22px;height:22px;background:${BROWN};border-radius:50%}`,
    html: `<div class="pl"><span class="w">ABox</span><span class="dot"></span></div>` },

  { n: '08_GridFour', label: '08 · Grid Four',
    css: `.g4{display:grid;grid-template-columns:repeat(2,156px);grid-template-rows:repeat(2,156px);gap:10px}
  .g4 .c{display:flex;align-items:center;justify-content:center;font-family:'Helvetica Neue',Arial;font-weight:800;font-size:100px;border-radius:14px}
  .g4 .a{background:${CREAM};color:${BROWN};border:5px solid ${BROWN};box-sizing:border-box}
  .g4 .b{background:${BROWN};color:${CREAM}}
  .g4 .o{background:${CREAM};color:transparent;-webkit-text-stroke:5px ${BROWN};border:5px solid ${BROWN};box-sizing:border-box}
  .g4 .x{background:${CREAM};color:${BROWN};border:5px solid ${BROWN};box-sizing:border-box}`,
    html: `<div class="g4"><div class="c a">A</div><div class="c b">B</div><div class="c o">o</div><div class="c x">x</div></div>` },

  { n: '09_AoverBox', label: '09 · A over Box',
    css: `.cap{display:flex;flex-direction:column;align-items:center}
  .cap .a{font-family:'Helvetica Neue',Arial;font-weight:800;font-size:100px;color:${BROWN};margin-bottom:-12px}
  .cap .box{background:${BROWN};color:${CREAM};font-family:'Helvetica Neue',Arial;font-weight:800;font-size:100px;padding:14px 32px;border-radius:12px;letter-spacing:2px}`,
    html: `<div class="cap"><div class="a">A</div><div class="box">Box</div></div>` },

  { n: '10_SlabBlocks', label: '10 · Slab Blocks',
    css: `.sb{display:inline-flex}
  .sb .c{width:124px;height:154px;display:flex;align-items:center;justify-content:center;font-family:'Helvetica Neue',Arial;font-weight:800;font-size:86px}
  .sb .a{background:${BROWN};color:${CREAM}}
  .sb .b{background:${CREAM};color:${BROWN};border:4px solid ${BROWN};box-sizing:border-box}
  .sb .o{background:${BROWN};color:${CREAM}}
  .sb .x{background:${CREAM};color:${BROWN};border:4px solid ${BROWN};box-sizing:border-box}`,
    html: `<div class="sb"><div class="c a">A</div><div class="c b">B</div><div class="c o">o</div><div class="c x">x</div></div>` },
];

async function render(html, file, w = 600, h = 600, full = false) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({ path: file, fullPage: full });
  await browser.close();
}

(async () => {
  for (const m of marks) {
    const css = `${BASE}\n${m.css}`;
    const html = `<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0;padding:0}${css}</style></head><body><div class="art">${m.html}</div></body></html>`;
    await render(html, path.join(__dirname, `${m.n}.png`));
    console.log('rendered', m.n);
  }

  // build overview board from the 10 PNGs (data URIs to avoid path issues)
  const imgs = marks.map(m => {
    const b = fs.readFileSync(path.join(__dirname, `${m.n}.png`)).toString('base64');
    return `data:image/png;base64,${b}`;
  });
  const cells = marks.map((m, i) => `<div class="cell"><img src="${imgs[i]}"/><div class="cap">${m.label}</div></div>`).join('');
  const boardCss = `body{margin:0;background:${CREAM};font-family:'Helvetica Neue',Arial,sans-serif}
  .wrap{padding:38px}
  h1{color:${BROWN};font-size:26px;letter-spacing:2px;margin:0 0 22px;font-weight:800}
  .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
  .cell{background:#fff;border:1px solid rgba(110,84,53,.16);border-radius:10px;overflow:hidden}
  .cell img{display:block;width:100%;height:auto}
  .cap{font-size:12.5px;color:${BROWN};padding:8px 10px;letter-spacing:.4px}`;
  const boardHtml = `<!doctype html><html><head><meta charset=utf8><style>${boardCss}</style></head><body><div class="wrap"><h1>ABox · 十方向探索板</h1><div class="grid">${cells}</div></div></body></html>`;
  await render(boardHtml, path.join(__dirname, '00_十方向对比.png'), 1240, 720, true);
  console.log('rendered board');
})();
