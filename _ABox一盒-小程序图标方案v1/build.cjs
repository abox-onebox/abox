/* ABox 一盒 · 小程序图标六方案 —— 生成 SVG / PNG / 总览图 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';
const OUT = __dirname;

const CONCEPTS = [
  {
    n: 1,
    name: '盖身分离',
    tag: '产品形',
    desc: '宽盖压窄身，肩上留一道台阶 —— 天地盖盒的真实剪影。没有任何线条，只靠轮廓就把「盒」说清楚。',
    rec: false,
    body: `<rect width="1024" height="1024" fill="${CREAM}"/>
<rect x="320" y="345" width="384" height="64" rx="10" fill="${BROWN}"/>
<rect x="352" y="409" width="320" height="270" rx="10" fill="${BROWN}"/>`
  },
  {
    n: 2,
    name: '一线盒',
    tag: '极简',
    desc: '一个方框，一道盖缝横线贯穿。只有两个笔画，却把「盒」和「一」同时说完了。最省墨的一款。',
    rec: false,
    body: `<rect width="1024" height="1024" fill="${BROWN}"/>
<rect x="321" y="321" width="382" height="382" rx="36" fill="none" stroke="${CREAM}" stroke-width="58"/>
<rect x="292" y="420" width="440" height="58" fill="${CREAM}"/>`
  },
  {
    n: 3,
    name: 'A 字',
    tag: '品牌字',
    desc: '只留 ABox 的首字母，粗笔画、圆角收口。横杠略高于中线，重心稳，缩到 40px 依然是一眼认出的 A。',
    rec: false,
    body: `<rect width="1024" height="1024" fill="${CREAM}"/>
<path d="M 512 312 L 328 712 M 512 312 L 696 712" stroke="${BROWN}" stroke-width="84" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
<rect x="400" y="548" width="224" height="60" rx="30" fill="${BROWN}"/>`
  },
  {
    n: 4,
    name: 'A 入盒',
    tag: '直译',
    desc: 'A 装进方框，字面就是「A Box」。这一款双关最直接，也最像一个 App 图标：一个框、一个字母，没有任何多余笔画。',
    rec: true,
    body: `<rect width="1024" height="1024" fill="${BROWN}"/>
<rect x="314" y="314" width="396" height="396" rx="44" fill="none" stroke="${CREAM}" stroke-width="52"/>
<path d="M 512 386 L 402 636 M 512 386 L 622 636" stroke="${CREAM}" stroke-width="62" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
<rect x="435" y="560" width="154" height="44" rx="22" fill="${CREAM}"/>`
  },
  {
    n: 5,
    name: '热气一盒',
    tag: '现做',
    desc: '三条不等高的热气从盒里升起，说「现做、热的」。六款里唯一带温度感的一版，适合想强调「11:30 送到还是热的」。',
    rec: false,
    body: `<rect width="1024" height="1024" fill="${CREAM}"/>
<path d="M 430 426 Q 402 396 430 366 T 430 320" stroke="${BROWN}" stroke-width="34" stroke-linecap="round" fill="none"/>
<path d="M 512 426 Q 480 390 512 354 T 512 292" stroke="${BROWN}" stroke-width="34" stroke-linecap="round" fill="none"/>
<path d="M 594 426 Q 566 398 594 370 T 594 330" stroke="${BROWN}" stroke-width="34" stroke-linecap="round" fill="none"/>
<rect x="340" y="446" width="344" height="60" rx="10" fill="${BROWN}"/>
<rect x="370" y="506" width="284" height="228" rx="10" fill="${BROWN}"/>`
  },
  {
    n: 6,
    name: '掀盖',
    tag: '动作',
    desc: '盖被掀开一角，盒还热着。六款里唯一有"动作"的一版，说的是"揭开就吃"那一刻，比静态的盒更有食欲。',
    rec: false,
    body: `<rect width="1024" height="1024" fill="${CREAM}"/>
<rect x="352" y="468" width="320" height="230" rx="10" fill="${BROWN}"/>
<rect x="320" y="359" width="384" height="60" rx="10" fill="${BROWN}" transform="rotate(10 512 389)"/>`
  }
];

const wrap = (c, attrs) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${attrs.w}" height="${attrs.h}" viewBox="0 0 1024 1024" preserveAspectRatio="xMidYMid meet">${c.body}</svg>`;

/* 内联到 HTML 用的版本：不带固定宽高，交给 CSS 控制 */
const inline = (c) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:100%">${c.body}</svg>`;

/* ---------- 1. 写 SVG 源文件 ---------- */
const files = [];
for (const c of CONCEPTS) {
  const fn = `方案${c.n}_${c.name}.svg`;
  fs.writeFileSync(path.join(OUT, fn), wrap(c, { w: 1024, h: 1024 }), 'utf8');
  files.push(fn);
}

/* ---------- 2. 总览图 HTML ---------- */
const card = (c) => `
  <article class="card${c.rec ? ' card--rec' : ''}">
    ${c.rec ? '<span class="badge">推荐</span>' : ''}
    <div class="shot">
      <div class="icon-big">${inline(c)}</div>
    </div>
    <div class="meta">
      <div class="name"><span class="num">0${c.n}</span>${c.name}</div>
      <div class="tag">${c.tag}</div>
    </div>
    <p class="desc">${c.desc}</p>
    <div class="small">
      <div class="icon-sm"><div class="inner">${inline(c)}</div></div>
      <span>实际 40px 大小</span>
    </div>
  </article>`;

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:1400px; background:#FAF7F2; color:#3B2E20;
    font-family:"KaiTi","STKaiti","楷体",serif;
    padding:56px 56px 44px;
    -webkit-font-smoothing:antialiased;
  }
  header { display:flex; align-items:flex-end; justify-content:space-between; padding-bottom:26px; border-bottom:1px solid #E4D9C6; }
  h1 { font-size:37px; font-weight:600; letter-spacing:.5px; }
  h1 em { font-style:normal; font-size:19px; color:#8C7A62; margin-left:14px; letter-spacing:0; }
  .sub { font-size:14.5px; color:#8C7A62; text-align:right; line-height:1.9; }
  .sub b { color:#6E5435; font-weight:600; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:26px; margin-top:32px; }
  .card { position:relative; background:#fff; border:1px solid #E9E0D0; border-radius:16px; padding:24px 24px 20px; }
  .card--rec { border-color:#6E5435; box-shadow:0 10px 28px -14px rgba(110,84,53,.5); }
  .badge { position:absolute; top:14px; right:14px; background:#6E5435; color:#F6F0E5; font-size:12px; padding:4px 10px; border-radius:999px; letter-spacing:1px; }
  .shot { display:flex; justify-content:center; padding:6px 0 20px; }
  .icon-big { width:236px; height:236px; border-radius:53px; overflow:hidden; box-shadow:0 12px 26px -14px rgba(59,46,32,.42); }
  .icon-big svg { display:block; width:236px; height:236px; }
  .meta { display:flex; align-items:baseline; gap:10px; }
  .name { font-size:23px; font-weight:600; letter-spacing:.5px; }
  .num { font-size:14px; color:#B3A28A; margin-right:8px; letter-spacing:0; }
  .tag { font-size:12px; color:#6E5435; border:1px solid #D9CBB4; border-radius:999px; padding:2px 9px; }
  .desc { font-size:14px; line-height:1.85; color:#6B5B47; margin-top:12px; min-height:78px; }
  .small { display:flex; align-items:center; gap:12px; margin-top:6px; padding-top:14px; border-top:1px dashed #EAE1D1; font-size:12.5px; color:#A0917B; }
  .icon-sm { width:40px; height:40px; border-radius:9px; overflow:hidden; }
  .inner, .inner svg { display:block; width:40px; height:40px; }
  footer { margin-top:34px; display:flex; align-items:center; justify-content:space-between; padding-top:22px; border-top:1px solid #E4D9C6; font-size:13px; color:#8C7A62; }
  .sw { display:flex; gap:16px; align-items:center; }
  .chip { display:flex; align-items:center; gap:8px; }
  .dot { width:18px; height:18px; border-radius:5px; border:1px solid rgba(0,0,0,.08); }
  .note { line-height:1.8; }
</style></head>
<body>
  <header>
    <h1>ABox 一盒 · 小程序图标<em>六款方向</em></h1>
    <div class="sub">
      米底 <b>#F6F0E5</b> × 暖棕 <b>#6E5435</b> · 纯双色<br>
      所有图形收在内切圆 r=340 安全区内，圆形/圆角遮罩都不缺角
    </div>
  </header>
  <div class="grid">${CONCEPTS.map(card).join('')}</div>
  <footer>
    <div class="sw">
      <span class="chip"><i class="dot" style="background:#F6F0E5"></i>#F6F0E5</span>
      <span class="chip"><i class="dot" style="background:#6E5435"></i>#6E5435</span>
      <span class="chip"><i class="dot" style="background:#fff"></i>#FFFFFF</span>
    </div>
    <div class="note">画布 1024×1024 · 主体占位约 66% · 最细笔画 34px（40px 显示下 ≈1.3px，不断线）</div>
  </footer>
</body></html>`;

fs.writeFileSync(path.join(OUT, '_sheet.html'), html, 'utf8');

/* ---------- 3. 光栅化 ---------- */
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

  const sheet = await browser.newPage({ viewport: { width: 1400, height: 1200 }, deviceScaleFactor: 2 });
  await sheet.goto('file:///' + path.join(OUT, '_sheet.html').replace(/\\/g, '/'), { waitUntil: 'load' });
  await sheet.waitForTimeout(300);
  const sp = path.join(OUT, '方案总览.png');
  await sheet.screenshot({ path: sp, fullPage: true });
  console.log('sheet', fs.statSync(sp).size);

  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
