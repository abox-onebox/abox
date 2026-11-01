/* ABox 一盒 · 小程序图标四方案 v3 —— 设计记号（负空间 / 书法 / 交叠 / 印章） */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';
const OUT = __dirname;

const CONCEPTS = [
  {
    n: 1,
    name: '楷笔一',
    tag: '书法·一笔',
    desc: '米纸上落一笔楷体「一」：起笔顿、收笔回锋，微微右上扬。这一笔同时是「一盒」的「一」和「周一」的「一」。四角只留两道角标框住它，像一枚闲章。暖、静、一眼记住。',
    rec: true,
    body: `<rect width="1024" height="1024" fill="${CREAM}"/>
<path d="M 322 568 Q 522 524 726 512" stroke="${BROWN}" stroke-width="84" stroke-linecap="round" fill="none" opacity="0.20"/>
<path d="M 312 556 Q 512 512 716 500" stroke="${BROWN}" stroke-width="84" stroke-linecap="round" fill="none"/>
<path d="M 300 392 L 300 322 Q 300 300 322 300 L 392 300" stroke="${BROWN}" stroke-width="26" fill="none" stroke-linecap="round"/>
<path d="M 724 632 L 724 702 Q 724 724 704 724 L 634 724" stroke="${BROWN}" stroke-width="26" fill="none" stroke-linecap="round"/>`
  },
  {
    n: 2,
    name: '折角封盒',
    tag: '折·封',
    desc: '一个方盒，右上角被折起来——是「封」也是「合」。折角是平面设计里最贵的那个动作：不动声色就把"盒饭 / 闭合 / 一周一封"说完了。比画一双筷子高级太多。',
    rec: false,
    body: `<rect width="1024" height="1024" fill="${BROWN}"/>
<rect x="300" y="320" width="424" height="424" rx="60" fill="${BROWN}" fill-opacity="0.30"/>
<rect x="290" y="308" width="424" height="424" rx="60" fill="${CREAM}"/>
<path d="M 714 308 L 714 436 L 586 308 Z" fill="${BROWN}"/>`
  },
  {
    n: 3,
    name: '双盒相拼',
    tag: '拼·合',
    desc: '两个方块交叠：一盒压着一盒，重叠处自然生出第三形。说的是「同事顺手拼一盒」——不是孤零零一个外卖，是大家凑成的团。交叠是 logo 里最耐看的关系语法。',
    rec: false,
    body: `<rect width="1024" height="1024" fill="${CREAM}"/>
<rect x="392" y="392" width="330" height="330" rx="56" fill="${BROWN}" fill-opacity="0.28"/>
<rect x="382" y="382" width="330" height="330" rx="56" fill="${BROWN}"/>
<rect x="300" y="300" width="330" height="330" rx="56" fill="${CREAM}" stroke="${BROWN}" stroke-width="6"/>`
  },
  {
    n: 4,
    name: '方印A',
    tag: '印·字',
    desc: '一枚双框方印，印心是 ABox 的 A。印章是品牌最该有的「信物感」，双框是篆刻的规矩。它把 A（品牌字母）和「一盒」的方印传统焊死在一起——别人抄不走。',
    rec: false,
    body: `<rect width="1024" height="1024" fill="${BROWN}"/>
<rect x="280" y="300" width="472" height="472" rx="100" fill="${BROWN}" fill-opacity="0.30"/>
<rect x="270" y="288" width="472" height="472" rx="100" fill="${CREAM}"/>
<rect x="306" y="324" width="400" height="400" rx="76" fill="${BROWN}"/>
<rect x="342" y="360" width="328" height="328" rx="60" fill="${CREAM}"/>
<path d="M 512 410 L 452 632" stroke="${BROWN}" stroke-width="62" stroke-linecap="round" fill="none"/>
<path d="M 512 410 L 572 632" stroke="${BROWN}" stroke-width="62" stroke-linecap="round" fill="none"/>
<rect x="462" y="566" width="100" height="48" rx="20" fill="${BROWN}"/>`
  }
];

const wrap = (c, attrs) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${attrs.w}" height="${attrs.h}" viewBox="0 0 1024 1024" preserveAspectRatio="xMidYMid meet">${c.body}</svg>`;
const inline = (c) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:100%">${c.body}</svg>`;

for (const c of CONCEPTS) {
  fs.writeFileSync(path.join(OUT, `方案${c.n}_${c.name}.svg`), wrap(c, { w: 1024, h: 1024 }), 'utf8');
}

const card = (c) => `
  <article class="card${c.rec ? ' card--rec' : ''}">
    ${c.rec ? '<span class="badge">推荐</span>' : ''}
    <div class="shot"><div class="icon-big">${inline(c)}</div></div>
    <div class="meta"><div class="name"><span class="num">0${c.n}</span>${c.name}</div><div class="tag">${c.tag}</div></div>
    <p class="desc">${c.desc}</p>
    <div class="small"><div class="icon-sm"><div class="inner">${inline(c)}</div></div><span>实际 40px 大小</span></div>
  </article>`;

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1320px; background:#EFE9DF; color:#2E2317;
    font-family:"KaiTi","STKaiti","楷体",serif; padding:56px 56px 44px; -webkit-font-smoothing:antialiased; }
  header { display:flex; align-items:flex-end; justify-content:space-between; padding-bottom:26px; border-bottom:1px solid #D8CBB6; }
  h1 { font-size:37px; font-weight:600; letter-spacing:.5px; }
  h1 em { font-style:normal; font-size:19px; color:#8C7A62; margin-left:14px; }
  .sub { font-size:14.5px; color:#8C7A62; text-align:right; line-height:1.9; }
  .sub b { color:#6E5435; font-weight:600; }
  .grid { display:grid; grid-template-columns:repeat(2,1fr); gap:30px; margin-top:34px; }
  .card { position:relative; background:#fff; border:1px solid #E4D9C6; border-radius:18px; padding:28px 28px 22px; }
  .card--rec { border-color:#6E5435; box-shadow:0 14px 34px -16px rgba(110,84,53,.55); }
  .badge { position:absolute; top:16px; right:16px; background:#6E5435; color:#F6F0E5; font-size:12px; padding:4px 11px; border-radius:999px; letter-spacing:1px; }
  .shot { display:flex; justify-content:center; padding:8px 0 22px; }
  .icon-big { width:264px; height:264px; border-radius:58px; overflow:hidden; box-shadow:0 16px 34px -16px rgba(46,35,23,.45); }
  .icon-big svg { display:block; width:264px; height:264px; }
  .meta { display:flex; align-items:baseline; gap:10px; }
  .name { font-size:24px; font-weight:600; letter-spacing:.5px; }
  .num { font-size:14px; color:#B3A28A; margin-right:8px; }
  .tag { font-size:12px; color:#6E5435; border:1px solid #D9CBB4; border-radius:999px; padding:2px 10px; }
  .desc { font-size:14.5px; line-height:1.9; color:#6B5B47; margin-top:14px; min-height:120px; }
  .small { display:flex; align-items:center; gap:12px; margin-top:6px; padding-top:14px; border-top:1px dashed #E4D9C6; font-size:12.5px; color:#A0917B; }
  .icon-sm { width:40px; height:40px; border-radius:9px; overflow:hidden; }
  .inner, .inner svg { display:block; width:40px; height:40px; }
  footer { margin-top:34px; display:flex; align-items:center; justify-content:space-between; padding-top:22px; border-top:1px solid #D8CBB6; font-size:13px; color:#8C7A62; }
  .note { line-height:1.8; }
</style></head>
<body>
  <header>
    <h1>ABox 一盒 · 小程序图标<em>四款设计记号</em></h1>
    <div class="sub">不再是「画个盒子」，而是「做个记号」<br>米纸 <b>#F6F0E5</b> × 暖棕墨 <b>#6E5435</b> · 加一层淡影做厚度</div>
  </header>
  <div class="grid">${CONCEPTS.map(card).join('')}</div>
  <footer>
    <div class="note">画布 1024×1024 · 纯双色（墨色加 28% 透明度做投影，不出第三色）· 图形收在内切圆 r=340 安全区</div>
  </footer>
</body></html>`;
fs.writeFileSync(path.join(OUT, '_sheet.html'), html, 'utf8');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  for (const c of CONCEPTS) {
    const svg = wrap(c, { w: 1024, h: 1024 });
    await page.setContent(`<style>html,body{margin:0;padding:0}#i{width:1024px;height:1024px;line-height:0}</style><div id="i">${svg}</div>`, { waitUntil: 'load' });
    const p = path.join(OUT, `方案${c.n}_${c.name}_1024.png`);
    await page.locator('#i').screenshot({ path: p });
    console.log('png', c.n, fs.statSync(p).size);
  }
  const sheet = await browser.newPage({ viewport: { width: 1320, height: 1200 }, deviceScaleFactor: 2 });
  await sheet.goto('file:///' + path.join(OUT, '_sheet.html').replace(/\\/g, '/'), { waitUntil: 'load' });
  await sheet.waitForTimeout(300);
  const sp = path.join(OUT, '方案总览.png');
  await sheet.screenshot({ path: sp, fullPage: true });
  console.log('sheet', fs.statSync(sp).size);
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
