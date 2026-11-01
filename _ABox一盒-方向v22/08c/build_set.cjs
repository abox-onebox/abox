const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';

function cellStyle(k, c) {
  const px = v => (v * k) + 'px';
  const s = [
    `width:${px(150)};height:${px(150)};display:flex;align-items:center;justify-content:center`,
    `font-family:'Helvetica Neue',Arial,sans-serif;font-weight:800;font-size:${px(96)};border-radius:${px(14)}`,
    `border:${px(5)} solid ${c.border};box-sizing:border-box`,
    `background:${c.bg}`,
  ];
  if (c.letter === 'solid-brown') s.push(`color:${BROWN}`);
  else if (c.letter === 'solid-cream') s.push(`color:${CREAM}`);
  else if (c.letter === 'hollow-cream') s.push(`color:transparent;-webkit-text-stroke:${px(c.stroke || 5)} ${CREAM}`);
  else if (c.letter === 'hollow-brown') s.push(`color:transparent;-webkit-text-stroke:${px(c.stroke || 5)} ${BROWN}`);
  return s.join(';');
}

function cellsOf(mode) {
  if (mode === 'reverse') {
    return {
      A:{ border:CREAM, bg:BROWN, letter:'solid-cream' },
      B:{ border:CREAM, bg:BROWN, letter:'solid-cream' },
      o:{ border:CREAM, bg:BROWN, letter:'solid-cream' },
      x:{ border:CREAM, bg:CREAM, letter:'solid-brown' },
    };
  }
  return {
    A:{ border:BROWN, bg:CREAM, letter:'solid-brown' },
    B:{ border:BROWN, bg:CREAM, letter:'solid-brown' },
    o:{ border:BROWN, bg:CREAM, letter:'solid-brown' },
    x:{ border:BROWN, bg:BROWN, letter:'solid-cream' },
  };
}

function gridHtml(k, mode) {
  const c = cellsOf(mode);
  const cell = (ch, cc) => `<div style="${cellStyle(k, cc)}">${ch}</div>`;
  const px = v => (v * k) + 'px';
  return `<div style="display:grid;grid-template-columns:repeat(2,${px(150)});grid-template-rows:repeat(2,${px(150)});gap:${px(12)}">
      ${cell('A', c.A)}${cell('B', c.B)}${cell('o', c.o)}${cell('x', c.x)}
    </div>`;
}

async function shot(html, file, w, h, fullPage) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({ path: file, fullPage: !!fullPage });
  await browser.close();
}

(async () => {
  const D = __dirname;

  // 1) 主视觉
  await shot(`<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0}</style></head>
    <body><div style="width:480px;height:480px;background:${CREAM};display:flex;align-items:center;justify-content:center;overflow:hidden">${gridHtml(1,'normal')}</div></body></html>`,
    path.join(D, '08c_set_主视觉.png'), 480, 480);
  console.log('main');

  // 2) 图标 1024
  await shot(`<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0}</style></head>
    <body><div style="width:1024px;height:1024px;background:${CREAM};display:flex;align-items:center;justify-content:center;overflow:hidden">${gridHtml(2.85,'normal')}</div></body></html>`,
    path.join(D, '08c_set_图标1024.png'), 1024, 1024);
  console.log('icon');

  // 3) 反白版
  await shot(`<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0}</style></head>
    <body><div style="width:480px;height:480px;background:${BROWN};display:flex;align-items:center;justify-content:center;overflow:hidden">${gridHtml(1,'reverse')}</div></body></html>`,
    path.join(D, '08c_set_反白版.png'), 480, 480);
  console.log('reverse');

  // 4) 缩小检验（每格留 12px 边，避免描边被裁）
  const sizes = [200, 150, 110, 80, 56];
  const smallPngs = [];
  for (const g of sizes) {
    const G = g + 24;
    const kk = g / 312;
    const f = path.join(D, `08c_scale_${g}.png`);
    await shot(`<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0}</style></head>
      <body><div style="width:${G}px;height:${G}px;background:${CREAM};display:flex;align-items:center;justify-content:center;overflow:hidden">${gridHtml(kk,'normal')}</div></body></html>`,
      f, G, G);
    smallPngs.push({ g, G, b64: fs.readFileSync(f).toString('base64') });
  }
  const scaleCells = smallPngs.map(p => `<div class="cell"><img style="width:${p.G}px;height:${p.G}px;display:block" src="data:image/png;base64,${p.b64}"/><div class="cap">${p.g}px 网格</div></div>`).join('');
  const scaleCss = `body{margin:0;background:${CREAM};font-family:'Helvetica Neue',Arial,sans-serif}
    .wrap{padding:34px}.h{color:${BROWN};font-size:22px;font-weight:800;margin:0 0 18px;letter-spacing:1px}
    .grid{display:flex;gap:16px;align-items:flex-end}
    .cell{background:#fff;border:1px solid rgba(110,84,53,.16);border-radius:10px;overflow:hidden;display:flex;flex-direction:column;align-items:center}
    .cap{font-size:12px;color:${BROWN};padding:8px 10px;letter-spacing:.3px;white-space:nowrap}`;
  await shot(`<!doctype html><html><head><meta charset=utf8><style>${scaleCss}</style></head>
    <body><div class="wrap"><div class="h">ABox · 08c 缩小检验（X=盲盒·奶色实填）</div><div class="grid">${scaleCells}</div></div></body></html>`,
    path.join(D, '08c_set_缩小检验.png'), 900, 320, true);
  console.log('scale');

  // 5) 应用板：名片 + 腰封
  const appCss = `body{margin:0;background:${CREAM};font-family:'Helvetica Neue',Arial,sans-serif;color:${BROWN}}
    .wrap{padding:40px;display:flex;flex-direction:column;gap:32px;width:840px;box-sizing:border-box}
    .h{font-size:22px;font-weight:800;letter-spacing:1px}
    .card{width:460px;height:252px;background:#fff;border:1px solid rgba(110,84,53,.18);border-radius:14px;box-shadow:0 6px 22px rgba(110,84,53,.10);padding:28px 30px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between}
    .card .top{display:flex;align-items:center;gap:18px}
    .wm{font-size:38px;font-weight:800;letter-spacing:1px}
    .tag{font-size:12px;opacity:.55;letter-spacing:3px;margin-top:4px}
    .rule{height:2px;background:${BROWN};opacity:.28}
    .meta{font-size:13px;opacity:.7;line-height:1.75}
    .band{width:700px;height:148px;background:${BROWN};border-radius:12px;display:flex;align-items:center;justify-content:space-between;padding:0 38px;box-sizing:border-box}
    .band .wm{color:${CREAM};font-size:36px}
    .band .t{color:${CREAM};font-size:13px;opacity:.85;letter-spacing:3px}`;
  const cardHtml = `<div class="card"><div class="top">${gridHtml(0.42,'normal')}<div><div class="wm">ABox</div><div class="tag">LUNCH · DELIVERED</div></div></div><div class="rule"></div><div class="meta">北京巡礼之年科技　|　工作日 11:30 达<br/>一饭四菜 · 盲盒惊喜</div></div>`;
  const bandHtml = `<div class="band"><div style="display:flex;align-items:center;gap:20px">${gridHtml(0.36,'reverse')}<div class="wm">ABox</div></div><div class="t">一饭四菜 · 盲盒惊喜</div></div>`;
  await shot(`<!doctype html><html><head><meta charset=utf8><style>${appCss}</style></head>
    <body><div class="wrap"><div class="h">ABox · 08c 应用预览</div>${cardHtml}${bandHtml}</div></body></html>`,
    path.join(D, '08c_set_应用板.png'), 840, 720, true);
  console.log('appboard');
})();
