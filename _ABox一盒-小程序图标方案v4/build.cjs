/* ABox 一盒 · 小程序图标十方案 v4 —— 十个设计记号，十个方向 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';
const OUT = __dirname;

const CONCEPTS = [
  {
    n: 1, name: '楷笔一', tag: '书法',
    desc: '米纸落一笔楷体「一」，起笔顿、收笔回锋、微微上扬。一盒之「一」、周一之「一」，一笔双关。最暖、最静、最抓眼。',
    body: `<rect width="1024" height="1024" fill="${CREAM}"/>
<path d="M 322 568 Q 522 524 726 512" stroke="${BROWN}" stroke-width="84" stroke-linecap="round" fill="none" opacity="0.18"/>
<path d="M 312 556 Q 512 512 716 500" stroke="${BROWN}" stroke-width="84" stroke-linecap="round" fill="none"/>
<path d="M 300 392 L 300 322 Q 300 300 322 300 L 392 300" stroke="${BROWN}" stroke-width="26" fill="none" stroke-linecap="round"/>
<path d="M 724 632 L 724 702 Q 724 724 704 724 L 634 724" stroke="${BROWN}" stroke-width="26" fill="none" stroke-linecap="round"/>`
  },
  {
    n: 2, name: '折角封盒', tag: '折',
    desc: '方盒右上折起一角，是「封」也是「合」。平面设计里最克制也最贵的那个动作——不动声色把盒饭 / 闭合 / 一周一封说完了。',
    body: `<rect width="1024" height="1024" fill="${BROWN}"/>
<rect x="300" y="320" width="424" height="424" rx="60" fill="${BROWN}" fill-opacity="0.30"/>
<rect x="290" y="308" width="424" height="424" rx="60" fill="${CREAM}"/>
<path d="M 714 308 L 714 436 L 586 308 Z" fill="${BROWN}"/>`
  },
  {
    n: 3, name: '双盒相拼', tag: '拼',
    desc: '两盒交叠，重合处自然生出第三形。说的是「同事顺手拼一盒」——不是孤零零一个外卖，是大家凑成的团。交叠是 logo 里最耐看的关系语法。',
    body: `<rect width="1024" height="1024" fill="${CREAM}"/>
<rect x="392" y="392" width="330" height="330" rx="56" fill="${BROWN}" fill-opacity="0.28"/>
<rect x="382" y="382" width="330" height="330" rx="56" fill="${BROWN}"/>
<rect x="300" y="300" width="330" height="330" rx="56" fill="${CREAM}" stroke="${BROWN}" stroke-width="6"/>`
  },
  {
    n: 4, name: '方印A', tag: '印',
    desc: '一枚双框方印，印心是 ABox 的 A。印章自带信物感，双框是篆刻的规矩。把品牌字母焊进「一盒」方印传统，别人抄不走。',
    body: `<rect width="1024" height="1024" fill="${BROWN}"/>
<rect x="280" y="300" width="472" height="472" rx="100" fill="${BROWN}" fill-opacity="0.30"/>
<rect x="270" y="288" width="472" height="472" rx="100" fill="${CREAM}"/>
<rect x="306" y="324" width="400" height="400" rx="76" fill="${BROWN}"/>
<rect x="342" y="360" width="328" height="328" rx="60" fill="${CREAM}"/>
<path d="M 512 410 L 452 632" stroke="${BROWN}" stroke-width="62" stroke-linecap="round" fill="none"/>
<path d="M 512 410 L 572 632" stroke="${BROWN}" stroke-width="62" stroke-linecap="round" fill="none"/>
<rect x="462" y="566" width="100" height="48" rx="20" fill="${BROWN}"/>`
  },
  {
    n: 5, name: '合', tag: '字',
    desc: '几何化的「合」——人字顶、一横、一口。合即合团、合盒、合得来。一个字把「办公楼里相熟的同事凑一盒」讲尽，只此一家。',
    body: `<rect width="1024" height="1024" fill="${BROWN}"/>
<path d="M 340 492 L 512 332 L 684 492 Z" fill="${BROWN}" fill-opacity="0.30"/>
<path d="M 332 480 L 512 320 L 692 480 Z" fill="${CREAM}"/>
<rect x="376" y="540" width="272" height="44" rx="20" fill="${CREAM}"/>
<rect x="452" y="616" width="120" height="100" rx="18" fill="${CREAM}"/>`
  },
  {
    n: 6, name: '热乎一笔', tag: '气',
    desc: '一道上扬的暖笔，是热气也是温度。不画盒、不画筷，只留那口「11:30 送到还是热的」气韵——越空，越让人想靠近。',
    body: `<rect width="1024" height="1024" fill="${CREAM}"/>
<path d="M 522 700 C 432 616 432 512 516 472 C 602 432 620 346 544 318 C 498 302 466 330 480 366" stroke="${BROWN}" stroke-width="68" stroke-linecap="round" fill="none" opacity="0.18"/>
<path d="M 512 690 C 422 606 422 502 506 462 C 592 422 610 336 534 308 C 488 292 456 320 470 356" stroke="${BROWN}" stroke-width="68" stroke-linecap="round" fill="none"/>`
  },
  {
    n: 7, name: '一饭四菜', tag: '点',
    desc: '一大点居中、四小点环抱，按四角排布。把「一饭四菜」压成最纯的点阵语言——不画格子、不画饭，点到即止。',
    body: `<rect width="1024" height="1024" fill="${BROWN}"/>
<circle cx="518" cy="518" r="96" fill="${BROWN}" fill-opacity="0.30"/>
<circle cx="512" cy="512" r="96" fill="${CREAM}"/>
<circle cx="360" cy="360" r="46" fill="${CREAM}"/>
<circle cx="664" cy="360" r="46" fill="${CREAM}"/>
<circle cx="360" cy="664" r="46" fill="${CREAM}"/>
<circle cx="664" cy="664" r="46" fill="${CREAM}"/>`
  },
  {
    n: 8, name: '周一环', tag: '环',
    desc: '一圈是「周」，顶上一点是「周一」。固定一周一盒的节奏，一个记号讲完。最极简，也最经得起缩小。',
    body: `<rect width="1024" height="1024" fill="${CREAM}"/>
<circle cx="512" cy="512" r="208" fill="none" stroke="${BROWN}" stroke-width="44"/>
<circle cx="512" cy="316" r="70" fill="${BROWN}"/>`
  },
  {
    n: 9, name: '升', tag: '升',
    desc: '一盒加一道向上的笔，便是「送上楼」。不画人、不画楼，只画那股把饭托到你工位的劲——服务的全部都在这一笔里。',
    body: `<rect width="1024" height="1024" fill="${BROWN}"/>
<rect x="392" y="566" width="240" height="176" rx="34" fill="${BROWN}" fill-opacity="0.30"/>
<rect x="392" y="558" width="240" height="176" rx="34" fill="${CREAM}"/>
<path d="M 452 474 L 512 414 L 572 474" stroke="${CREAM}" stroke-width="40" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="496" y="414" width="32" height="120" rx="16" fill="${CREAM}"/>`
  },
  {
    n: 10, name: '套盒', tag: '套',
    desc: '方套方，一层裹一层。一盒之中还有一盒，是容器也是深度。最安静的一款，却最有「装得下一周一盒」的厚实感。',
    body: `<rect width="1024" height="1024" fill="${CREAM}"/>
<rect x="276" y="276" width="472" height="472" rx="100" fill="${BROWN}"/>
<rect x="336" y="336" width="352" height="352" rx="76" fill="${CREAM}"/>
<rect x="396" y="396" width="232" height="232" rx="52" fill="${BROWN}"/>`
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
    <h1>ABox 一盒 · 小程序图标<em>十款设计记号</em></h1>
    <div class="sub">十个方向，十个语法<br>米纸 <b>#F6F0E5</b> × 暖棕墨 <b>#6E5435</b> · 加淡影做厚度</div>
  </header>
  <div class="grid">${CONCEPTS.map(card).join('')}</div>
  <footer>
    <div class="note">画布 1024×1024 · 纯双色（墨加 28–30% 透明做投影，不出第三色）· 图形收在内切圆 r=340 安全区</div>
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
