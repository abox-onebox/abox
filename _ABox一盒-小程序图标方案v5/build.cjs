/* ABox 一盒 · 小程序图标十方案 v5c —— 全部锚定项目名 A / Box / 一 / 盒 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';
const OUT = __dirname;

const FRAME = `<rect width="1024" height="1024" fill="${BROWN}"/>
<rect x="42" y="42" width="940" height="940" rx="210" fill="none" stroke="${CREAM}" stroke-width="6" opacity="0.10"/>`;

const CONCEPTS = [
  {
    n: 1, name: 'A·盒', tag: 'A+Box',
    desc: '字母 A 嵌进一枚方框——字面就是 A Box。方框是「盒」，A 是品牌首字，两个符号一站位就讲清项目名。最直白也最不易错认。',
    body: `<rect x="250" y="250" width="524" height="524" rx="74" fill="none" stroke="${CREAM}" stroke-width="46"/>
<polygon points="512,330 330,712 452,712 512,548 572,712 694,712" fill="${CREAM}"/>
<rect x="428" y="520" width="168" height="46" fill="${CREAM}"/>`
  },
  {
    n: 2, name: '双框A印', tag: '印',
    desc: '双框方印，A 撑满印心、几乎顶到框沿。双框是篆刻的规矩，是「信物」的语法——这枚章盖在哪儿，哪儿就是 ABox。',
    body: `<rect x="242" y="242" width="540" height="540" rx="60" fill="none" stroke="${CREAM}" stroke-width="44"/>
<rect x="300" y="300" width="424" height="424" rx="44" fill="none" stroke="${CREAM}" stroke-width="22"/>
<polygon points="512,330 322,694 420,694 512,552 604,694 702,694" fill="${CREAM}"/>
<rect x="420" y="520" width="176" height="44" fill="${CREAM}"/>`
  },
  {
    n: 3, name: '负A盒', tag: 'Box→A',
    desc: '一枚米色方盒，中心透出棕色的 A。盒是体、A 是名，负空间让两者同时成立：你看到的是一盒，也是 ABox。比描边款更厚实。',
    body: `<rect x="250" y="250" width="524" height="524" rx="82" fill="${CREAM}"/>
<polygon points="512,332 332,712 452,712 512,548 572,712 692,712" fill="${BROWN}"/>
<rect x="430" y="520" width="164" height="46" fill="${BROWN}"/>`
  },
  {
    n: 4, name: '合', tag: '盒之音',
    desc: '几何化的「合」——人字顶、一横、一口。合即合团、合盒、合得来，也是「盒」的读音根。一个字把「同事凑一盒」讲尽。',
    body: `<path d="M 348 488 L 512 332 L 676 488" fill="none" stroke="${CREAM}" stroke-width="54" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="372" y="522" width="280" height="46" fill="${CREAM}"/>
<rect x="420" y="600" width="184" height="148" rx="22" fill="none" stroke="${CREAM}" stroke-width="46"/>`
  },
  {
    n: 5, name: '盒即A', tag: 'A on Box',
    desc: 'A 悬停在盒子上方——上方是字母 A，下方是方盒本体，中间留一道气。名字被拆成上下两截，一眼读懂「A 的盒子」。',
    body: `<rect x="300" y="578" width="424" height="174" rx="30" fill="${CREAM}"/>
<path d="M 512 300 L 348 540" stroke="${CREAM}" stroke-width="62" stroke-linecap="round" fill="none"/>
<path d="M 512 300 L 676 540" stroke="${CREAM}" stroke-width="62" stroke-linecap="round" fill="none"/>
<rect x="412" y="456" width="200" height="44" fill="${CREAM}"/>`
  },
  {
    n: 6, name: '一盖盒', tag: '一+盒',
    desc: '一道「一」悬在盒子上方——那是盒盖，也是「一」。上「一」下「盒」，竖着读就是「一盒」。最省笔的一款，却把名字读全了。',
    body: `<rect x="330" y="288" width="364" height="84" rx="14" fill="${CREAM}"/>
<rect x="356" y="452" width="312" height="270" rx="20" fill="${CREAM}"/>
<rect x="356" y="580" width="312" height="16" fill="${BROWN}"/>`
  },
  {
    n: 7, name: 'AB', tag: 'A+B(ox)',
    desc: 'ABox 的字母组合：左边 A，右边 B——而 B 的两个圈被换成两个方盒。A 加 Boxes，名字被一字不差地写进图标。',
    body: `<polygon points="430,330 330,690 392,690 430,560 468,690 530,690" fill="${CREAM}"/>
<rect x="366" y="534" width="128" height="40" fill="${CREAM}"/>
<rect x="560" y="330" width="44" height="360" fill="${CREAM}"/>
<rect x="604" y="330" width="160" height="170" rx="28" fill="${CREAM}"/>
<rect x="604" y="520" width="160" height="170" rx="28" fill="${CREAM}"/>`
  },
  {
    n: 8, name: '一笔A盒', tag: 'A+盒横',
    desc: '一道书法笔触勾出 A 的两腿，而它的横杠本身就是一只小盒。A 与 Box 在同一个笔画里完成，最像「手写签下的品牌名」。',
    body: `<path d="M 360 700 Q 440 480 512 330" fill="none" stroke="${CREAM}" stroke-width="60" stroke-linecap="round"/>
<path d="M 512 330 Q 584 480 664 700" fill="none" stroke="${CREAM}" stroke-width="60" stroke-linecap="round"/>
<rect x="416" y="506" width="192" height="76" rx="16" fill="${CREAM}"/>`
  },
  {
    n: 9, name: '盒', tag: '本字',
    desc: '直接用「盒」字本体：上合下皿，人顶、一横、一口、皿底。把品牌名最关键的那个字，做成一枚可缩放的记号。辨识度最高。',
    body: `<path d="M 360 300 L 512 232 L 664 300" fill="none" stroke="${CREAM}" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="372" y="330" width="280" height="40" fill="${CREAM}"/>
<rect x="420" y="388" width="184" height="150" rx="20" fill="none" stroke="${CREAM}" stroke-width="42"/>
<rect x="358" y="586" width="308" height="38" fill="${CREAM}"/>
<rect x="372" y="586" width="30" height="92" fill="${CREAM}"/>
<rect x="622" y="586" width="30" height="92" fill="${CREAM}"/>`
  },
  {
    n: 10, name: '套盒A', tag: 'Box→Box→A',
    desc: '盒套盒，一层裹一层，最中心的芯是 A。「一盒之中还有一盒」，最后落回品牌首字。最有纵深，也最像一枚可收藏的徽记。',
    body: `<rect x="266" y="266" width="492" height="492" rx="80" fill="${CREAM}"/>
<rect x="336" y="336" width="352" height="352" rx="58" fill="${BROWN}"/>
<rect x="406" y="406" width="212" height="212" rx="42" fill="${CREAM}"/>
<polygon points="512,448 458,586 490,586 512,538 534,586 566,586" fill="${BROWN}"/>
<rect x="490" y="536" width="44" height="20" fill="${BROWN}"/>`
  }
];

const wrap = (c, attrs) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${attrs.w}" height="${attrs.h}" viewBox="0 0 1024 1024" preserveAspectRatio="xMidYMid meet">${FRAME}${c.body}</svg>`;
const inline = (c) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:100%">${FRAME}${c.body}</svg>`;

for (const c of CONCEPTS) {
  fs.writeFileSync(path.join(OUT, `方案${c.n}_${c.name}.svg`), wrap(c, { w: 1024, h: 1024 }), 'utf8');
}

const card = (c) => `
  <article class="card">
    <div class="shot"><div class="icon-big">${inline(c)}</div></div>
    <div class="meta"><div class="name"><span class="num">0${c.n}</span>${c.name}</div><div class="tag">${c.tag}</div></div>
    <p class="desc">${c.desc}</p>
    <div class="small"><div class="icon-sm"><div class="inner">${inline(c)}</div></div><span>实际 40px 大小</span></div>
  </article>`;

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1340px; background:#EFE9DF; color:#2E2317;
    font-family:"KaiTi","STKaiti","楷体",serif; padding:54px 54px 42px; -webkit-font-smoothing:antialiased; }
  header { display:flex; align-items:flex-end; justify-content:space-between; padding-bottom:24px; border-bottom:1px solid #D8CBB6; }
  h1 { font-size:36px; font-weight:600; letter-spacing:.5px; }
  h1 em { font-style:normal; font-size:18px; color:#8C7A62; margin-left:14px; }
  .sub { font-size:14px; color:#8C7A62; text-align:right; line-height:1.9; }
  .sub b { color:#6E5435; font-weight:600; }
  .grid { display:grid; grid-template-columns:repeat(2,1fr); gap:28px; margin-top:32px; }
  .card { background:#fff; border:1px solid #E4D9C6; border-radius:18px; padding:26px 26px 20px; }
  .shot { display:flex; justify-content:center; padding:6px 0 20px; }
  .icon-big { width:248px; height:248px; border-radius:54px; overflow:hidden; box-shadow:0 14px 30px -16px rgba(46,35,23,.42); }
  .icon-big svg { display:block; width:248px; height:248px; }
  .meta { display:flex; align-items:baseline; gap:10px; }
  .name { font-size:23px; font-weight:600; letter-spacing:.5px; }
  .num { font-size:14px; color:#B3A28A; margin-right:8px; }
  .tag { font-size:12px; color:#6E5435; border:1px solid #D9CBB4; border-radius:999px; padding:2px 10px; }
  .desc { font-size:14px; line-height:1.85; color:#6B5B47; margin-top:12px; min-height:108px; }
  .small { display:flex; align-items:center; gap:12px; margin-top:6px; padding-top:13px; border-top:1px dashed #E4D9C6; font-size:12.5px; color:#A0917B; }
  .icon-sm { width:40px; height:40px; border-radius:9px; overflow:hidden; }
  .inner, .inner svg { display:block; width:40px; height:40px; }
  footer { margin-top:32px; display:flex; align-items:center; justify-content:space-between; padding-top:20px; border-top:1px solid #D8CBB6; font-size:13px; color:#8C7A62; }
  .note { line-height:1.8; }
</style></head>
<body>
  <header>
    <h1>ABox 一盒 · 小程序图标<em>十款 · 全锚定项目名</em></h1>
    <div class="sub">字根 A · Box · 一 · 盒 各占一款或几款<br>米纸 <b>#F6F0E5</b> × 暖棕墨 <b>#6E5435</b> · 满铺 tile</div>
  </header>
  <div class="grid">${CONCEPTS.map(card).join('')}</div>
  <footer>
    <div class="note">画布 1024×1024 · 纯双色 · 图形收在内切圆安全区 · 暖棕满铺 + 极淡米框做成品感</div>
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
  const sheet = await browser.newPage({ viewport: { width: 1340, height: 1200 }, deviceScaleFactor: 2 });
  await sheet.goto('file:///' + path.join(OUT, '_sheet.html').replace(/\\/g, '/'), { waitUntil: 'load' });
  await sheet.waitForTimeout(300);
  const sp = path.join(OUT, '方案总览.png');
  await sheet.screenshot({ path: sp, fullPage: true });
  console.log('sheet', fs.statSync(sp).size);
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
