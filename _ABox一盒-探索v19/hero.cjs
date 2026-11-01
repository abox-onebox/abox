const { chromium } = require('playwright-core');
const path = require('path');

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';
const DARK  = '#4A3823';
const KAI   = 'KaiTi,楷体,STKaiti';
const SANS  = '"PingFang SC","Microsoft YaHei",sans-serif';

const seal = `<svg viewBox="0 0 210 210">
  <circle cx="105" cy="105" r="80" fill="${CREAM}"/>
  <circle cx="105" cy="105" r="66" fill="none" stroke="${DARK}" stroke-width="3" opacity=".45"/>
  <text x="105" y="126" text-anchor="middle" font-family="${KAI}" font-size="56" fill="${DARK}" letter-spacing="3">一盒</text>
</svg>`;

const block = `<div style="width:190px;height:190px;background:${BROWN};border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;box-shadow:0 16px 34px rgba(110,84,53,.28)">
  <div style="color:${CREAM};font-family:${KAI};font-size:56px;letter-spacing:8px;line-height:1">一盒</div>
  <div style="color:${CREAM};font-family:${SANS};font-size:16px;letter-spacing:9px;opacity:.8">ABOX</div>
</div>`;

const onigiri = `<svg viewBox="0 0 210 210">
  <path d="M105 34 L174 152 Q178 162 166 162 L44 162 Q32 162 36 152 Z" fill="${CREAM}" stroke="${BROWN}" stroke-width="6.5" stroke-linejoin="round"/>
  <rect x="86" y="112" width="38" height="50" rx="4" fill="${BROWN}"/>
</svg>`;

const cloche = `<svg viewBox="0 0 210 210">
  <path d="M28 138 a77 64 0 0 1 154 0 Z" fill="${CREAM}" stroke="${BROWN}" stroke-width="6.5"/>
  <rect x="32" y="142" width="146" height="12" rx="6" fill="${BROWN}"/>
  <circle cx="105" cy="64" r="9" fill="${BROWN}"/>
</svg>`;

function panel(bg, inner, label, note, opts = {}) {
  return `<div class="p" style="background:${bg}">
    <div class="stage">${inner}</div>
    <div class="meta">
      <div class="lb" style="color:${opts.lc || BROWN}">${label}</div>
      <div class="nt" style="color:${opts.lc || BROWN}">${note}</div>
    </div>
  </div>`;
}

const html = `<!doctype html><html><head><meta charset=utf8><style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#EDE3D2;font-family:${KAI};padding:44px;display:flex;justify-content:center}
.wrap{max-width:1640px}
.head{font-size:32px;letter-spacing:9px;color:${BROWN};text-align:center}
.sub{font-size:16px;letter-spacing:3px;color:${BROWN};opacity:.55;text-align:center;margin:10px 0 32px}
.row{display:flex;gap:22px}
.p{width:392px;height:520px;border-radius:18px;display:flex;flex-direction:column;overflow:hidden;
   box-shadow:0 18px 40px rgba(74,56,35,.16)}
.stage{flex:1;display:flex;align-items:center;justify-content:center;position:relative}
.stage svg{width:210px;height:210px;filter:drop-shadow(0 10px 16px rgba(74,56,35,.18))}
.meta{padding:0 26px 26px;text-align:center}
.lb{font-size:22px;letter-spacing:5px}
.nt{font-size:14px;letter-spacing:2px;opacity:.62;margin-top:8px}
.sealwrap{background:rgba(246,240,229,.1);border-radius:16px;padding:18px}
.ava{position:absolute;top:22px;left:22px;width:56px;height:56px;border-radius:14px;overflow:hidden;
     box-shadow:0 6px 14px rgba(74,56,35,.2);display:flex;align-items:center;justify-content:center}
.ava svg{width:100%;height:100%}
</style></head><body><div class="wrap">
<div class="head">一盒 · 方向应用预览</div><div class="sub">v19 · 选中的方向可以做到这个完成度</div>
<div class="row">
  ${panel(DARK, `<div class="sealwrap">${seal}</div>`, '05 · 火漆章', '深底烫章 · 信物感', { lc: CREAM })}
  ${panel(CREAM, `<div class="ava" style="background:${BROWN}"><span style="color:${CREAM};font-family:${KAI};font-size:27px">盒</span></div>${block}`, '10 · 撞色块', '色块冲击 · 远距可读')}
  ${panel('#F1E7D6', onigiri, '13 · 饭团', '亲和童趣 · 记忆点强')}
  ${panel(CREAM, cloche, '14 · 盖碗', '器物感 · 高级克制')}
</div></div></body></html>`;

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1780, height: 760 }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(__dirname, '10_应用预览.png'), fullPage: true });
  await browser.close();
  console.log('done');
})();
