/* ABox 一盒 · 小程序图标方案 v8
 * 思路：彻底离开「字符」——不画 A、不画 盒、不画 一。
 * 用纯形态语言承载项目的「神」：
 *   暖拥(被照顾) · 一饭四菜(实在) · 周一环(节奏) · 升托(省心)
 *   合隙(连接) · 暖弧(温度) · 聚点(同事) · 叠形(盒即结构) · 圆熟(圆满) · 一笔( invite)
 * 双色 #F6F0E5 / #6E5435，米纸落墨，单一自信手势，40px 立得住。
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';

// 每款：名称 / 标签 / 描述 / 背景(cream or brown) / 图形(forms 颜色已内联)
const marks = [
  {
    n: 1, name: '暖拥', tag: '被照顾',
    desc: '一圈奶白把中间的餐环轻轻托住——你不用动手，自有人替你张罗好。',
    bg: 'brown',
    body: `
<circle cx="512" cy="512" r="150" fill="none" stroke="${CREAM}" stroke-width="34"/>
<path d="M 250 662 Q 512 912 774 662 L 774 726 Q 512 976 250 726 Z" fill="${CREAM}"/>`
  },
  {
    n: 2, name: '一饭四菜', tag: '实在',
    desc: '一只方盒里安着四颗小圆——不用写菜名，套餐结构一眼就懂。',
    bg: 'cream',
    body: `
<rect x="312" y="320" width="400" height="404" rx="52" fill="${BROWN}"/>
<rect x="312" y="392" width="400" height="16" fill="${CREAM}" opacity="0.45"/>
<circle cx="398" cy="430" r="46" fill="${CREAM}"/>
<circle cx="626" cy="430" r="46" fill="${CREAM}"/>
<circle cx="398" cy="624" r="46" fill="${CREAM}"/>
<circle cx="626" cy="624" r="46" fill="${CREAM}"/>`
  },
  {
    n: 3, name: '周一环', tag: '节奏',
    desc: '一整圈是「一周」，其中一瓣点亮——那就是开团的那一天。',
    bg: 'brown',
    body: `
<circle cx="512" cy="512" r="250" fill="none" stroke="${CREAM}" stroke-width="40"/>
<path d="M 512 512 L 512 262 A 250 250 0 0 1 728 387 Z" fill="${CREAM}"/>`
  },
  {
    n: 4, name: '升托', tag: '省心',
    desc: '一道浅碗托着餐，尾端轻轻上扬——送到你工位，你零走动。',
    bg: 'cream',
    body: `
<path d="M 300 520 Q 512 772 724 520" stroke="${BROWN}" stroke-width="56" fill="none" stroke-linecap="round"/>
<path d="M 724 520 L 752 426" stroke="${BROWN}" stroke-width="56" fill="none" stroke-linecap="round"/>
<circle cx="512" cy="556" r="56" fill="${BROWN}"/>`
  },
  {
    n: 5, name: '合隙', tag: '连接',
    desc: '两片相向而不相碰，中间那道缝隙，就是同事之间刚好合得来的距离。',
    bg: 'cream',
    body: `
<path d="M 372 348 Q 248 512 372 676 Q 482 512 372 348 Z" fill="${BROWN}"/>
<path d="M 652 348 Q 776 512 652 676 Q 542 512 652 348 Z" fill="${BROWN}"/>`
  },
  {
    n: 6, name: '暖弧', tag: '温度',
    desc: '一笔上扬的暖弧，像刚揭盖那口热气，也像一句「开饭了」。',
    bg: 'brown',
    body: `
<path d="M 280 584 Q 512 360 744 584 Q 512 504 280 584 Z" fill="${CREAM}"/>
<path d="M 432 404 Q 512 326 592 404 Q 512 366 432 404 Z" fill="${CREAM}" opacity="0.55"/>`
  },
  {
    n: 7, name: '聚点', tag: '同事',
    desc: '一个核，五六个点围拢过来——一个人张罗，一圈人顺手拼。',
    bg: 'cream',
    body: `
<circle cx="512" cy="512" r="62" fill="${BROWN}"/>
<circle cx="512" cy="297" r="34" fill="${BROWN}"/>
<circle cx="698" cy="405" r="34" fill="${BROWN}"/>
<circle cx="698" cy="619" r="34" fill="${BROWN}"/>
<circle cx="512" cy="727" r="34" fill="${BROWN}"/>
<circle cx="326" cy="619" r="34" fill="${BROWN}"/>
<circle cx="326" cy="405" r="34" fill="${BROWN}"/>
<path d="M 512 512 L 512 297" stroke="${BROWN}" stroke-width="14" opacity="0.4"/>`
  },
  {
    n: 8, name: '叠形', tag: '结构',
    desc: '盖、身、座三层依次收分——盒本身就是最稳的形体语言。',
    bg: 'cream',
    body: `
<rect x="362" y="300" width="300" height="92" rx="32" fill="${BROWN}"/>
<rect x="322" y="432" width="380" height="120" rx="34" fill="${BROWN}"/>
<rect x="372" y="602" width="280" height="80" rx="28" fill="${BROWN}"/>`
  },
  {
    n: 9, name: '圆熟', tag: '圆满',
    desc: '一只圆润的满，顶上一道缝——封着、热着、刚刚好。',
    bg: 'brown',
    body: `
<circle cx="512" cy="512" r="240" fill="${CREAM}"/>
<path d="M 312 436 Q 512 482 712 436" stroke="${BROWN}" stroke-width="22" fill="none" stroke-linecap="round"/>`
  },
  {
    n: 10, name: '一笔', tag: '邀你',
    desc: '一个自信的圆角方框，独留一角未合——门为你开着，进来便是一盒。',
    bg: 'cream',
    body: `
<path d="M 360 420 L 360 372 Q 360 332 400 332 L 624 332 Q 664 332 664 372 L 664 596 Q 664 636 624 636 L 420 636 Q 380 636 380 596" stroke="${BROWN}" stroke-width="56" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
  }
];

// 软投影：奶白底上的棕形浮起一层，不出第三色
const SHADOW = `<filter id="sh" x="-25%" y="-25%" width="150%" height="150%">
  <feDropShadow dx="0" dy="16" stdDeviation="22" flood-color="${BROWN}" flood-opacity="0.20"/>
</filter>`;

let browser;

function fullSvg(m) {
  const bg = m.bg === 'brown' ? BROWN : CREAM;
  const inner = m.bg === 'cream'
    ? `<g filter="url(#sh)">${m.body}</g>`
    : m.body;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs>${SHADOW}</defs>
<rect width="1024" height="1024" fill="${bg}"/>${inner}</svg>`;
}

(async () => {
  const outDir = __dirname;
  // 1) 逐款光栅化 1024 PNG
  for (const m of marks) {
    const html = `<!doctype html><meta charset="utf-8"><body style="margin:0">${fullSvg(m)}</body>`;
    const p = await pageFor(html);
    await p.screenshot({ path: path.join(outDir, `方案${m.n}_${m.name}_1024.png`) });
    await p.close();
  }
  // 2) 总览表
  await buildSheet(marks, outDir);
  console.log('v8 done:', marks.length, 'marks');
})();

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
      <div class="meta"><span class="num">0${m.n}</span><span class="nm">${m.name}</span><span class="tg">${m.tag}</span></div>
      <p class="desc">${m.desc}</p>
      <div class="small"><div class="mini">${fullSvg(m)}</div><span>实际 40px</span></div>
    </div>`).join('\n');
  const html = `<!doctype html><meta charset="utf-8">
<body>
<h1>ABox 一盒 · 小程序图标 v8</h1>
<p class="sub">不画字、只造形：暖拥 · 节奏 · 同事 · 托举 · 圆满。双色 #F6F0E5 / #6E5435，主体占 66%，最细笔画 ≥ 34px。</p>
<div class="grid">${cards}</div>
<style>
  body{margin:0;background:#EFE7D8;color:#4A3A24;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;padding:40px}
  h1{font-weight:700;letter-spacing:2px;margin:0 0 6px}
  .sub{margin:0 0 28px;opacity:.7;font-size:14px;max-width:760px;line-height:1.6}
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
  if (browser) await browser.close();
}
