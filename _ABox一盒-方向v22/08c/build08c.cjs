const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';

function cellStyle(c) {
  const s = [];
  s.push('width:150px;height:150px;display:flex;align-items:center;justify-content:center');
  s.push("font-family:'Helvetica Neue',Arial,sans-serif;font-weight:800;font-size:96px;border-radius:14px");
  s.push(`border:5px solid ${BROWN};box-sizing:border-box`);
  s.push(c.bg === 'brown' ? `background:${BROWN}` : `background:${CREAM}`);
  if (c.letter === 'solid-brown') s.push(`color:${BROWN}`);
  else if (c.letter === 'solid-cream') s.push(`color:${CREAM}`);
  else if (c.letter === 'hollow-cream') s.push(`color:transparent;-webkit-text-stroke:${c.stroke || 5}px ${CREAM}`);
  else if (c.letter === 'hollow-brown') s.push(`color:transparent;-webkit-text-stroke:${c.stroke || 5}px ${BROWN}`);
  return s.join(';');
}

const A = { bg:'cream', letter:'solid-brown' };
const B = { bg:'cream', letter:'solid-brown' };
const O = { bg:'cream', letter:'solid-brown' };

const X_HOLLOW_8 = { bg:'brown', letter:'hollow-cream', stroke:8 }; // 主推：真空心·加粗描边
const X_HOLLOW_5 = { bg:'brown', letter:'hollow-cream', stroke:5 }; // 细描边空心
const X_SOLID    = { bg:'brown', letter:'solid-cream' };            // 奶色实填（挖空感）

function lockHtml(xCell) {
  const cell = (ch, c) => `<div style="${cellStyle(c)}">${ch}</div>`;
  const css = `.lock{display:flex;flex-direction:column;align-items:center}
  .grid{display:grid;grid-template-columns:repeat(2,150px);grid-template-rows:repeat(2,150px);gap:12px}`;
  const body = `<div class="lock"><div class="grid">${cell('A',A)}${cell('B',B)}${cell('o',O)}${cell('x',xCell)}</div></div>`;
  return `<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0;padding:0}${css}</style></head><body><div class="art" style="width:480px;height:480px;background:${CREAM};display:flex;align-items:center;justify-content:center;overflow:hidden">${body}</div></body></html>`;
}

async function render(html, file, w = 480, h = 480) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({ path: file });
  await browser.close();
}

(async () => {
  const items = [
    { file:'08c_1_空心粗描边.png', cell:X_HOLLOW_8, cap:'① 真空心 · 描边 8px（主推）' },
    { file:'08c_2_空心细描边.png', cell:X_HOLLOW_5, cap:'② 真空心 · 描边 5px（更轻）' },
    { file:'08c_3_实填挖空.png',   cell:X_SOLID,    cap:'③ 奶色实填 · 挖空感（最稳）' },
  ];
  for (const it of items) {
    await render(lockHtml(it.cell), path.join(__dirname, it.file));
    console.log('rendered', it.file);
  }

  const cell = items.map(it => {
    const b64 = fs.readFileSync(path.join(__dirname, it.file)).toString('base64');
    return `<div class="cell"><img src="data:image/png;base64,${b64}"/><div class="cap">${it.cap}</div></div>`;
  }).join('');

  const boardCss = `body{margin:0;background:${CREAM};font-family:'Helvetica Neue',Arial,sans-serif}
  .wrap{padding:34px}
  h1{color:${BROWN};font-size:24px;letter-spacing:1px;margin:0 0 8px;font-weight:800}
  .sub{color:${BROWN};font-size:14px;opacity:.7;margin:0 0 20px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
  .cell{background:#fff;border:1px solid rgba(110,84,53,.16);border-radius:10px;overflow:hidden}
  .cell img{display:block;width:100%;height:auto}
  .cap{font-size:13px;color:${BROWN};padding:10px 12px;letter-spacing:.3px;line-height:1.4}`;
  const boardHtml = `<!doctype html><html><head><meta charset=utf8><style>${boardCss}</style></head><body><div class="wrap"><h1>ABox · 08c · X 空心方案（A/B/o 带框不填充·实心棕字）</h1><div class="sub">X = 盲盒：框体棕色填充，字母空心　|　去汉字</div><div class="grid">${cell}</div></div></body></html>`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1050, height: 520 }, deviceScaleFactor: 2 });
  await page.setContent(boardHtml, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(__dirname, '08c_X对比.png'), fullPage: true });
  await browser.close();
  console.log('rendered board');
})();
