/* ABox 一盒 · 小程序图标方案 v10
 * 关键升级：01 便当格做成「1 大格饭 + 4 小格菜」= 一饭四菜的字面；
 * 其余修掉 v9 的误读（X/笑脸/包），全部保留不可错认的食物线索。
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';

const marks = [
  {
    n: 1, name: '一饭四菜', tag: '俯视便当',
    desc: '俯看一只便当盒：左边一大格盛饭，右边四小格放菜。不看字，也知道这是「一饭四菜」。',
    bg: 'cream',
    body: `
<rect x="340" y="340" width="344" height="344" rx="44" fill="${BROWN}"/>
<rect x="556" y="340" width="30" height="344" fill="${CREAM}"/>
<rect x="586" y="404" width="98" height="30" fill="${CREAM}"/>
<rect x="586" y="497" width="98" height="30" fill="${CREAM}"/>
<rect x="586" y="590" width="98" height="30" fill="${CREAM}"/>`
  },
  {
    n: 2, name: '满溢', tag: '实在',
    desc: '饭堆得高过碗沿——「一饭四菜」的量，看一眼就觉得吃得饱。',
    bg: 'cream',
    body: `
<path d="M 297 570 A 215 215 0 0 0 727 570 Z" fill="${BROWN}"/>
<path d="M 334 554 Q 512 388 690 554 Z" fill="${BROWN}"/>`
  },
  {
    n: 3, name: '盖缝热气', tag: '热乎',
    desc: '盖沿一道缝，两缕热气正往外冒——封着、热着、刚到。',
    bg: 'cream',
    body: `
<path d="M 478 300 C 448 262 508 240 478 196" stroke="${BROWN}" stroke-width="18" stroke-linecap="round" fill="none"/>
<path d="M 552 300 C 522 262 582 240 552 196" stroke="${BROWN}" stroke-width="18" stroke-linecap="round" fill="none"/>
<rect x="310" y="332" width="404" height="58" rx="26" fill="${BROWN}"/>
<rect x="336" y="402" width="352" height="286" rx="34" fill="${BROWN}"/>`
  },
  {
    n: 4, name: '提盒', tag: '送到',
    desc: '一只带提手的饭盒，两层叠着——提起来就送到你工位。',
    bg: 'cream',
    body: `
<path d="M 442 372 L 442 330 Q 442 300 472 300 L 552 300 Q 582 300 582 330 L 582 372" stroke="${BROWN}" stroke-width="26" stroke-linecap="round" fill="none"/>
<rect x="372" y="372" width="280" height="92" rx="28" fill="${BROWN}"/>
<rect x="344" y="476" width="336" height="110" rx="32" fill="${BROWN}"/>`
  },
  {
    n: 5, name: '碗筷', tag: '开饭',
    desc: '一双筷搁在碗口上——最家常的那句「开饭了」，没有一道多余的笔。',
    bg: 'cream',
    body: `
<path d="M 300 596 A 212 212 0 0 0 724 596 Z" fill="${BROWN}"/>
<path d="M 372 380 L 716 506" stroke="${BROWN}" stroke-width="26" stroke-linecap="round" fill="none"/>
<path d="M 356 430 L 700 556" stroke="${BROWN}" stroke-width="26" stroke-linecap="round" fill="none"/>`
  },
  {
    n: 6, name: '拼', tag: '同事',
    desc: '两只一模一样的盒，各挪半步贴在一起——一个人张罗，一群人拼。',
    bg: 'cream',
    body: `
<rect x="296" y="352" width="198" height="304" rx="44" fill="${BROWN}"/>
<rect x="530" y="388" width="198" height="304" rx="44" fill="${BROWN}"/>`
  },
  {
    n: 7, name: '套盒', tag: '一盒',
    desc: '一只盒里还套着一只——「一盒」本身就是层层收拢，越往里越稳。',
    bg: 'cream',
    body: `
<rect x="320" y="320" width="384" height="384" rx="52" fill="none" stroke="${BROWN}" stroke-width="34"/>
<rect x="428" y="428" width="168" height="168" rx="28" fill="${BROWN}"/>`
  },
  {
    n: 8, name: '叠碗', tag: '多份',
    desc: '一只碗上再搁一只——多份就是叠起来，简单、干净，一眼就是吃饭。',
    bg: 'cream',
    body: `
<path d="M 340 626 A 172 172 0 0 0 684 626 Z" fill="${BROWN}"/>
<path d="M 366 522 A 146 146 0 0 0 658 522 Z" fill="${BROWN}"/>`
  },
  {
    n: 9, name: '热气一柱', tag: '现做',
    desc: '一碗刚盛出来的饭，热气直直往上走——「现做的」不用写，也看得见。',
    bg: 'cream',
    body: `
<path d="M 332 618 A 180 180 0 0 0 692 618 Z" fill="${BROWN}"/>
<path d="M 512 594 C 466 524 558 484 512 414 C 476 356 528 326 512 282" stroke="${BROWN}" stroke-width="30" stroke-linecap="round" fill="none"/>`
  },
  {
    n: 10, name: '盒中碗', tag: '一体',
    desc: '一只盒里，稳稳坐着一只碗——盒是「一盒」，碗是「一饭」，两件事收在一个形里。',
    bg: 'cream',
    body: `
<rect x="316" y="316" width="392" height="392" rx="52" fill="none" stroke="${BROWN}" stroke-width="32"/>
<path d="M 386 544 A 126 126 0 0 0 638 544 Z" fill="${BROWN}"/>`
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
<h1>ABox 一盒 · 小程序图标 v10</h1>
<p class="sub">每个记号都留一个不可错认的食物线索：格 · 热气 · 碗 · 提手 · 套盒。双色 #F6F0E5 / #6E5435，不画任何字符。</p>
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
  console.log('v10 done:', marks.length, 'marks');
})().catch(e => { console.error(e); process.exit(1); });
