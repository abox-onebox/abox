const { chromium } = require('playwright-core');
const path = require('path');

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';
const KAI   = 'KaiTi,楷体,STKaiti';
const SERIF = 'Georgia,"Times New Roman",serif';

const D1 = { key:'d1', hero:`<div class="d1zh">一盒</div><div class="d1rule"></div><div class="d1en">ABOX</div>`,
  css: `.d1zh{font-family:${KAI};font-size:104px;color:${BROWN};letter-spacing:10px}
  .d1rule{width:170px;height:1px;background:${BROWN};opacity:.45}
  .d1en{font-family:${SERIF};font-size:19px;letter-spacing:11px;color:${BROWN};padding-left:11px}` };

const D2 = { key:'d2', hero:`<div class="d2wrap"><div class="d2zh">一</div><div class="d2zh">盒</div></div><div class="d2rule"></div><div class="d2en">ABOX</div>`,
  css: `.d2wrap{display:flex;flex-direction:column;align-items:center;gap:4px}
  .d2zh{font-family:${KAI};font-size:96px;color:${BROWN};line-height:1.02}
  .d2rule{width:1px;height:44px;background:${BROWN};opacity:.4}
  .d2en{font-family:${SERIF};font-size:16px;letter-spacing:8px;color:${BROWN}}` };

const D3 = { key:'d3', hero:`<div class="d3blk"><svg width="176" height="176" viewBox="0 0 200 200">
    <path d="M26 104 H174 A74 54 0 0 1 26 104 Z" fill="${CREAM}"/>
  </svg></div><div class="d3zh">一盒</div>`,
  css: `.d3blk{width:242px;height:242px;background:${BROWN};border-radius:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 14px 30px rgba(110,84,53,.25)}
  .d3zh{font-family:${KAI};font-size:28px;letter-spacing:9px;color:${BROWN}}` };

const D4 = { key:'d4', hero:`<div class="d4blk"><div class="d4zh">一盒</div><div class="d4en">ABOX</div></div>`,
  css: `.d4blk{width:242px;height:242px;background:${BROWN};border-radius:26px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;box-shadow:0 14px 30px rgba(110,84,53,.25)}
  .d4zh{font-family:${KAI};font-size:64px;color:${CREAM};letter-spacing:8px;line-height:1}
  .d4en{font-family:${SERIF};font-size:17px;letter-spacing:9px;color:${CREAM};opacity:.85}` };

const dirs = [D1, D2, D3, D4];
const names = ['D1_横排字标', 'D2_竖排字标', 'D3_负空间碗', 'D4_撞色块'];
const labels = ['横排楷体字标', '竖排楷体字标', '负空间碗 · 棕块镂空', '撞色块 lockup'];

const allCss = dirs.map(d => d.css).join('\n');

function sheet(d) {
  return `<!doctype html><html><head><meta charset=utf8><style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${CREAM};font-family:${KAI};min-height:100vh;display:flex;align-items:center;justify-content:center}
  .card{width:540px;height:700px;background:${CREAM};box-shadow:0 22px 54px rgba(74,56,35,.13);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px}
  ${allCss}
  </style></head><body><div class="card">${d.hero}</div></body></html>`;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 800 }, deviceScaleFactor: 2 });
  const dir = __dirname;
  for (let i = 0; i < 4; i++) {
    await page.setContent(sheet(dirs[i]), { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(dir, `${names[i]}.png`) });
  }

  const cols = dirs.map((d, i) => `<div class="bcol">
    <div class="bhero">${d.hero}</div>
    <div class="bname">${String.fromCharCode(65 + i)} · ${labels[i]}</div>
  </div>`).join('');

  const board = `<!doctype html><html><head><meta charset=utf8><style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#ECE2D0;font-family:${KAI};padding:40px 40px 24px}
  .head{text-align:center;font-size:29px;letter-spacing:8px;color:${BROWN}}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:22px;max-width:1400px;margin:26px auto 0}
  .bcol{background:${CREAM};border-radius:18px;padding:26px 20px 18px;box-shadow:0 16px 40px rgba(74,56,35,.14)}
  .bhero{height:380px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px}
  .bname{text-align:center;font-size:16px;letter-spacing:2px;color:${BROWN};opacity:.75;padding-top:14px;border-top:1px solid rgba(110,84,53,.16);margin-top:4px}
  ${allCss}
  </style></head><body><div class="head">一盒 · 四个扁平矢量方向</div><div class="grid">${cols}</div></body></html>`;
  await page.setViewportSize({ width: 1460, height: 720 });
  await page.setContent(board, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(dir, `00_四方向对比.png`), fullPage: true });

  await browser.close();
  console.log('done');
})();
