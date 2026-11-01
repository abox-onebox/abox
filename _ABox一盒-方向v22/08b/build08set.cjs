const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';

function cellStyle(c) {
  const s = [];
  s.push('width:150px;height:150px;display:flex;align-items:center;justify-content:center');
  s.push("font-family:'Helvetica Neue',Arial,sans-serif;font-weight:800;font-size:96px;border-radius:14px");
  if (c.bg === 'cream') s.push(`background:${CREAM}`);
  else if (c.bg === 'brown') s.push(`background:${BROWN}`);
  if (c.border) s.push(`border:5px solid ${BROWN};box-sizing:border-box`);
  if (c.letter === 'solid-brown') s.push(`color:${BROWN}`);
  else if (c.letter === 'solid-cream') s.push(`color:${CREAM}`);
  else if (c.letter === 'hollow-brown') s.push(`color:transparent;-webkit-text-stroke:5px ${BROWN}`);
  else if (c.letter === 'hollow-cream') s.push(`color:transparent;-webkit-text-stroke:5px ${CREAM}`);
  return s.join(';');
}

// each variant: 4 cells + label. mix explores fill on/off × solid/hollow
const variants = [
  { id: '1', name: '全描边', label: '01 · 全描边（米底棕框·字母空心）',
    A:{bg:'cream',border:true,letter:'hollow-brown'}, B:{bg:'cream',border:true,letter:'hollow-brown'},
    o:{bg:'cream',border:true,letter:'hollow-brown'}, x:{bg:'cream',border:true,letter:'hollow-brown'} },
  { id: '2', name: '全实心', label: '02 · 全实心（米底棕框·字母实心）',
    A:{bg:'cream',border:true,letter:'solid-brown'}, B:{bg:'cream',border:true,letter:'solid-brown'},
    o:{bg:'cream',border:true,letter:'solid-brown'}, x:{bg:'cream',border:true,letter:'solid-brown'} },
  { id: '3', name: '原版混搭', label: '03 · 原版混搭（B 棕填·o 空心）',
    A:{bg:'cream',border:true,letter:'solid-brown'}, B:{bg:'brown',border:false,letter:'solid-cream'},
    o:{bg:'cream',border:true,letter:'hollow-brown'}, x:{bg:'cream',border:true,letter:'solid-brown'} },
  { id: '4', name: '列分色', label: '04 · 列分色（左米右棕填）',
    A:{bg:'cream',border:true,letter:'solid-brown'}, B:{bg:'brown',border:false,letter:'solid-cream'},
    o:{bg:'cream',border:true,letter:'solid-brown'}, x:{bg:'brown',border:false,letter:'solid-cream'} },
  { id: '5', name: '行分色', label: '05 · 行分色（上米下棕填）',
    A:{bg:'cream',border:true,letter:'solid-brown'}, B:{bg:'cream',border:true,letter:'solid-brown'},
    o:{bg:'brown',border:false,letter:'solid-cream'}, x:{bg:'brown',border:false,letter:'solid-cream'} },
  { id: '6', name: '棕底空心', label: '06 · 棕底空心（棕填·字母镂空）',
    A:{bg:'brown',border:false,letter:'hollow-cream'}, B:{bg:'brown',border:false,letter:'hollow-cream'},
    o:{bg:'brown',border:false,letter:'hollow-cream'}, x:{bg:'brown',border:false,letter:'hollow-cream'} },
  { id: '7', name: '棋盘格', label: '07 · 棋盘格（A/x 棕填·B/o 米描边）',
    A:{bg:'brown',border:false,letter:'solid-cream'}, B:{bg:'cream',border:true,letter:'solid-brown'},
    o:{bg:'cream',border:true,letter:'hollow-brown'}, x:{bg:'brown',border:false,letter:'solid-cream'} },
  { id: '8', name: 'o作焦点', label: '08 · o 作焦点（o 棕填镂空·余米实心）',
    A:{bg:'cream',border:true,letter:'solid-brown'}, B:{bg:'cream',border:true,letter:'solid-brown'},
    o:{bg:'brown',border:false,letter:'hollow-cream'}, x:{bg:'cream',border:true,letter:'solid-brown'} },
];

function pageHtml(v) {
  const cell = (ch, c) => `<div style="${cellStyle(c)}">${ch}</div>`;
  const css = `.art{width:600px;height:600px;background:${CREAM};display:flex;align-items:center;justify-content:center;overflow:hidden}
  .lock{display:flex;flex-direction:column;align-items:center}
  .grid{display:grid;grid-template-columns:repeat(2,150px);grid-template-rows:repeat(2,150px);gap:12px}
  .cn{font-family:'KaiTi','楷体','STKaiti',serif;color:${BROWN};font-size:46px;letter-spacing:12px;margin-top:24px;text-align:center;font-weight:400}`;
  const body = `<div class="lock"><div class="grid">${cell('A',v.A)}${cell('B',v.B)}${cell('o',v.o)}${cell('x',v.x)}</div><div class="cn">一盒</div></div>`;
  return `<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0;padding:0}${css}</style></head><body><div class="art">${body}</div></body></html>`;
}

async function render(html, file) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({ path: file });
  await browser.close();
}

(async () => {
  for (const v of variants) {
    const file = path.join(__dirname, `08set_${v.id}_${v.name}.png`);
    await render(pageHtml(v), file);
    console.log('rendered', v.id, v.name);
  }

  // board
  const imgs = variants.map(v => {
    const b = fs.readFileSync(path.join(__dirname, `08set_${v.id}_${v.name}.png`)).toString('base64');
    return `data:image/png;base64,${b}`;
  });
  const cells = variants.map((v, i) => `<div class="cell"><img src="${imgs[i]}"/><div class="cap">${v.label}</div></div>`).join('');
  const boardCss = `body{margin:0;background:${CREAM};font-family:'Helvetica Neue',Arial,sans-serif}
  .wrap{padding:38px}
  h1{color:${BROWN};font-size:26px;letter-spacing:2px;margin:0 0 22px;font-weight:800}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
  .cell{background:#fff;border:1px solid rgba(110,84,53,.16);border-radius:10px;overflow:hidden}
  .cell img{display:block;width:100%;height:auto}
  .cap{font-size:12px;color:${BROWN};padding:8px 10px;letter-spacing:.3px;line-height:1.4}`;
  const boardHtml = `<!doctype html><html><head><meta charset=utf8><style>${boardCss}</style></head><body><div class="wrap"><h1>ABox · 08 衍生八款（一盒为无框副标）</h1><div class="grid">${cells}</div></div></body></html>`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 640 }, deviceScaleFactor: 2 });
  await page.setContent(boardHtml, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(__dirname, '08set_八款对比.png'), fullPage: true });
  await browser.close();
  console.log('rendered board');
})();
