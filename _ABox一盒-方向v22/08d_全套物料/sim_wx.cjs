const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const abox = fs.readFileSync(path.join(DIR, '11_图标_圆形安全区1024.png')).toString('base64');

// 微信下拉环境里的其他小程序（纯占位，非真实 logo）
const recent = [
  { name: 'ABox一盒', img: `data:image/png;base64,${abox}` },
  { name: '美团', c: '#FFC300', t: '美' },
  { name: '京东', c: '#E1251B', t: '京' },
  { name: '微信支付', c: '#07C160', t: '支' },
];
const mine = [
  { name: 'ABox一盒', img: `data:image/png;base64,${abox}` },
  { name: '腾讯文档', c: '#3B7CF5', t: '文' },
  { name: '美团', c: '#FFC300', t: '美' },
  { name: '京东', c: '#E1251B', t: '京' },
];

function appCell(a) {
  const ico = a.img
    ? `<div class="ico"><img src="${a.img}" style="width:100%;height:100%;object-fit:cover"></div>`
    : `<div class="ico" style="background:${a.c}">${a.t}</div>`;
  return `<div class="app">${ico}<div class="nm">${a.name}</div></div>`;
}

const sig = `<svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="1" fill="#222"/><rect x="4.5" y="5" width="3" height="6" rx="1" fill="#222"/><rect x="9" y="2.5" width="3" height="8.5" rx="1" fill="#222"/><rect x="13.5" y="0" width="3" height="11" rx="1" fill="#222"/></svg>`;
const wifi = `<svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.5c2.6 0 5 1 6.8 2.7l-1.4 1.5A7.8 7.8 0 0 0 8 4.6 7.8 7.8 0 0 0 2.6 6.7L1.2 5.2A9.9 9.9 0 0 1 8 2.5Zm0 3.4c1.5 0 2.9.6 4 1.6l-1.5 1.5A3.9 3.9 0 0 0 8 8.2a3.9 3.9 0 0 0-2.5.8L4 7.5A5.9 5.9 0 0 1 8 5.9Zm0 3.3c.6 0 1.2.3 1.6.7L8 11.3 6.4 9.9c.4-.4 1-.7 1.6-.7Z" fill="#222"/></svg>`;
const bat = `<svg width="25" height="12" viewBox="0 0 25 12"><rect x="0.5" y="0.5" width="21" height="11" rx="3" fill="none" stroke="#222" stroke-opacity=".4"/><rect x="2" y="2" width="16" height="8" rx="1.5" fill="#222"/><rect x="23" y="3.5" width="2" height="5" rx="1" fill="#222" fill-opacity=".4"/></svg>`;

const css = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#cfd2d6;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
  .phone{width:390px;height:844px;border-radius:44px;overflow:hidden;position:relative;background:
     linear-gradient(160deg,#e9ecef 0%,#dfe3e8 40%,#e7e2d8 100%);
     box-shadow:0 30px 60px rgba(0,0,0,.25)}
  .blur{position:absolute;inset:0;backdrop-filter:blur(2px);background:rgba(255,255,255,.12)}
  .content{position:relative;padding:14px 20px}
  .statusbar{height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 8px}
  .time{font-size:16px;font-weight:600;color:#1a1a1a;letter-spacing:.5px}
  .sys{display:flex;align-items:center;gap:6px}
  .search{margin:6px 4px 14px;height:36px;border-radius:18px;background:rgba(255,255,255,.72);
     display:flex;align-items:center;justify-content:center;gap:6px;color:#8a8a8a;font-size:14px}
  .search svg{width:15px;height:15px}
  .sec{font-size:13px;color:rgba(0,0,0,.45);margin:14px 4px 10px;font-weight:600}
  .grid{display:flex;gap:14px;padding:0 2px}
  .app{flex:0 0 64px;height:82px;display:flex;flex-direction:column;align-items:center;overflow:hidden}
  .ico{width:58px;height:58px;border-radius:50%;overflow:hidden;background:#fff;
     display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;font-weight:600;
     box-shadow:0 2px 6px rgba(0,0,0,.12)}
  .nm{margin-top:7px;font-size:11px;font-weight:500;color:rgba(0,0,0,.6);text-align:center;line-height:1.2;
     max-width:64px;height:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;

const html = `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head>
<body><div class="phone"><div class="blur"></div><div class="content">
  <div class="statusbar"><div class="time">22:34</div><div class="sys">${sig}${wifi}${bat}</div></div>
  <div class="search"><svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="#8a8a8a" stroke-width="2"/><line x1="16" y1="16" x2="21" y2="21" stroke="#8a8a8a" stroke-width="2" stroke-linecap="round"/></svg>搜索</div>
  <div class="sec">最近使用</div><div class="grid">${recent.map(appCell).join('')}</div>
  <div class="sec">我的小程序</div><div class="grid">${mine.map(appCell).join('')}</div>
</div></div></body></html>`;

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 884 }, deviceScaleFactor: 2 });
  await page.setContent(html);
  await page.screenshot({ path: path.join(DIR, 'sim_微信下拉.png'), clip: { x: 20, y: 20, width: 390, height: 844 } });
  await browser.close();
  console.log('OK sim_微信下拉.png');
})();
