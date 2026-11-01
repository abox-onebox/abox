/* ABox 一盒 · 小程序图标方案 v9
 * 原则：每个记号必须带一个「不可错认的食物线索」（格 / 热气 / 碗 / 层 / 封条），
 * 才能既高级又不被读成通用 UI 图标。不画任何字符。
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';

const marks = [
  {
    n: 1, name: '一格独大', tag: '俯视便当',
    desc: '俯看一只便当盒：一格盛饭特别大，几格放菜。不用解释，谁都知道这是顿饭。',
    bg: 'cream',
    body: `
<rect x="340" y="340" width="344" height="344" rx="46" fill="${BROWN}"/>
<rect x="586" y="340" width="18" height="344" fill="${CREAM}"/>
<rect x="340" y="432" width="344" height="18" fill="${CREAM}"/>`
  },
  {
    n: 2, name: '满溢', tag: '实在',
    desc: '饭堆得高过碗沿——「一饭四菜」的量，看一眼就觉得吃得饱。',
    bg: 'cream',
    body: `
<path d="M 292 566 A 220 220 0 0 0 732 566 Z" fill="${BROWN}"/>
<path d="M 330 550 Q 512 372 694 550 Z" fill="${BROWN}"/>`
  },
  {
    n: 3, name: '碗筷', tag: '开饭',
    desc: '一只碗，一双筷搁在边上一段——最家常的「开饭了」。',
    bg: 'cream',
    body: `
<path d="M 300 592 A 212 212 0 0 0 724 592 Z" fill="${BROWN}"/>
<path d="M 384 384 L 640 556" stroke="${BROWN}" stroke-width="34" stroke-linecap="round" fill="none"/>
<path d="M 640 384 L 384 556" stroke="${BROWN}" stroke-width="34" stroke-linecap="round" fill="none"/>`
  },
  {
    n: 4, name: '盖缝热气', tag: '热乎',
    desc: '盖沿一道缝，两缕热气正往外冒——封着、热着、刚到。',
    bg: 'cream',
    body: `
<path d="M 476 300 C 446 256 506 236 476 192" stroke="${BROWN}" stroke-width="18" stroke-linecap="round" fill="none"/>
<path d="M 556 300 C 526 256 586 236 556 192" stroke="${BROWN}" stroke-width="18" stroke-linecap="round" fill="none"/>
<rect x="308" y="326" width="408" height="62" rx="28" fill="${BROWN}"/>
<rect x="336" y="398" width="352" height="292" rx="34" fill="${BROWN}"/>`
  },
  {
    n: 5, name: '碗盖', tag: '现开',
    desc: '碗在上，盖儿被掀起来悬着——刚揭开的那一下，热气全在。',
    bg: 'cream',
    body: `
<path d="M 312 604 A 200 200 0 0 0 712 604 Z" fill="${BROWN}"/>
<ellipse cx="512" cy="512" rx="206" ry="40" fill="${BROWN}"/>
<circle cx="512" cy="486" r="24" fill="${BROWN}"/>`
  },
  {
    n: 6, name: '三层食盒', tag: '多菜',
    desc: '三层叠起来的提盒，一层比一层宽——底下最沉，装得最满。',
    bg: 'cream',
    body: `
<path d="M 458 340 Q 512 300 566 340" stroke="${BROWN}" stroke-width="22" stroke-linecap="round" fill="none"/>
<rect x="372" y="350" width="280" height="82" rx="30" fill="${BROWN}"/>
<rect x="350" y="444" width="324" height="90" rx="32" fill="${BROWN}"/>
<rect x="328" y="548" width="368" height="100" rx="34" fill="${BROWN}"/>`
  },
  {
    n: 7, name: '拼', tag: '同事',
    desc: '两只一模一样的盒，各自挪了半步贴在一起——一个人张罗，一群人拼。',
    bg: 'cream',
    body: `
<rect x="298" y="356" width="196" height="300" rx="42" fill="${BROWN}"/>
<rect x="530" y="392" width="196" height="300" rx="42" fill="${BROWN}"/>`
  },
  {
    n: 8, name: '封条', tag: '封着',
    desc: '一道竖封条压过盒面，正中一枚小印——封住了，才叫送到你手上。',
    bg: 'cream',
    body: `
<rect x="336" y="338" width="352" height="348" rx="44" fill="${BROWN}"/>
<rect x="486" y="338" width="52" height="348" fill="${CREAM}"/>
<circle cx="512" cy="512" r="30" fill="${BROWN}"/>`
  },
  {
    n: 9, name: '一笔碗', tag: '手势',
    desc: '一笔下去就是一只碗，底厚沿薄——像提笔写的一个「一」，又收成了碗。',
    bg: 'cream',
    body: `
<path d="M 300 520 Q 328 704 512 726 Q 696 704 724 520 L 690 520 Q 666 660 512 676 Q 358 660 334 520 Z" fill="${BROWN}"/>`
  },
  {
    n: 10, name: '方碗', tag: '一体',
    desc: '上头是方的（盒），底下收成圆的（碗）——一只盒，也是一个碗。一个形，两种读法。',
    bg: 'cream',
    body: `
<path d="M 322 408 L 322 470 Q 322 752 512 752 Q 702 752 702 470 L 702 408 Z" fill="${BROWN}"/>`
  }
];

const SHADOW = `<filter id="sh" x="-25%" y="-25%" width="150%" height="150%">
  <feDropShadow dx="0" dy="16" stdDeviation="22" flood-color="${BROWN}" flood-opacity="0.20"/>
</filter>`;

let browser;

function fullSvg(m) {
  const bg = m.bg === 'brown' ? BROWN : CREAM;
  const inner = m.bg === 'cream' ? `<g filter="url(#sh)">${m.body}</g>` : m.body;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs>${SHADOW}</defs>
<rect width="1024" height="1024" fill="${bg}"/>${inner}</svg>`;
}

async function pageFor(html) {
  if (!browser) browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  return page;
}

async function buildSheet(marks, outDir) {
  const cards = marks.map(m => `
    <div class="card">
      <div class="big">${fullSvg(m)}</div>
      <div class="meta"><span class="num">${String(m.n).padStart(2, '0')}</span><span class="nm">${m.name}</span><span class="tg">${m.tag}</span></div>
      <p class="desc">${m.desc}</p>
      <div class="small"><div class="mini">${fullSvg(m)}</div><span>实际 40px</span></div>
    </div>`).join('\n');
  const html = `<!doctype html><meta charset="utf-8">
<body>
<h1>ABox 一盒 · 小程序图标 v9</h1>
<p class="sub">每个记号都留一个不可错认的食物线索：格 · 热气 · 碗 · 层 · 封条。双色 #F6F0E5 / #6E5435，不画任何字符。</p>
<div class="grid">${cards}</div>
<style>
  body{margin:0;background:#EFE7D8;color:#4A3A24;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;padding:40px}
  h1{font-weight:700;letter-spacing:2px;margin:0 0 6px}
  .sub{margin:0 0 28px;opacity:.7;font-size:14px;max-width:800px;line-height:1.6}
  .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:22px}
  .card{background:#FBF7EE;border:1px solid #E3D8C2;border-radius:18px;padding:18px 20px 20px;box-shadow:0 6px 20px rgba(110,84,53,.10)}
  .big{width:200px;height:200px;margin:0 auto 12px}
  .big svg{width:100%;height:100%;border-radius:14px}
  .meta{display:flex;align-items:baseline;gap:8px;justify-content:center}
  .num{font-size:13px;color:#A98E66;font-weight:700}
  .nm{font-size:21px;font-weight:700;color:#6E5435}
  .tg{font-size:12px;color:#9A8156;background:#F0E7D4;padding:2px 9px;border-radius:20px}
  .desc{font-size:13px;line-height:1.7;color:#6B5A40;margin:10px 4px 14px;min-height:60px}
  .small{display:flex;align-items:center;gap:10px;border-top:1px dashed #E3D8C2;padding-top:12px}
  .mini{width:40px;height:40px;border-radius:9px;overflow:hidden;box-shadow:0 2px 6px rgba(110,84,53,.18)}
  .mini svg{width:100%;height:100%}
  .small span{font-size:12px;color:#9A8156}
</style>
</body>`;
  const p = await pageFor(html);
  await p.screenshot({ path: path.join(outDir, '方案总览.png'), fullPage: true });
  await p.close();
}

(async () => {
  const outDir = __dirname;
  for (const m of marks) {
    const html = `<!doctype html><meta charset="utf-8"><body style="margin:0">${fullSvg(m)}</body>`;
    const p = await pageFor(html);
    await p.screenshot({ path: path.join(outDir, `方案${m.n}_${m.name}_1024.png`) });
    await p.close();
  }
  await buildSheet(marks, outDir);
  if (browser) await browser.close();
  console.log('v9 done:', marks.length, 'marks');
})().catch(e => { console.error(e); process.exit(1); });
