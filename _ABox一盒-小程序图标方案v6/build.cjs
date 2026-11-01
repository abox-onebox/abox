/* ABox 一盒 · 小程序图标十方案 v6 —— A 退场，主角「一 / 盒」 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';
const OUT = __dirname;

/* 书法「一」：主笔上拱 + 两端顿笔 + 轻微右上扬
   调用约定：brushI(x起, x止, 中线y, 粗细, 颜色, 倾斜) */
function brushI(x1, x2, cy, w, color, tilt = -3) {
  const y1 = cy + w * 0.06;   // 起笔略低
  const y2 = cy - w * 0.06;   // 收笔略高（右上扬）
  const mx = (x1 + x2) / 2, my = cy - w * 0.22; // 中段上拱
  const main = `<path d="M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}" stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
  const sD = w * 0.52;
  const start = `<ellipse cx="${x1}" cy="${y1}" rx="${sD * 1.06}" ry="${sD * 0.82}" fill="${color}" transform="rotate(-24 ${x1} ${y1})"/>`;
  const end = `<ellipse cx="${x2}" cy="${y2}" rx="${sD * 0.86}" ry="${sD * 0.8}" fill="${color}" transform="rotate(12 ${x2} ${y2})"/>`;
  return `<g transform="rotate(${tilt} 512 512)">${main}${start}${end}</g>`;
}
/* 天地盖方盒（描边留白） */
function box(lidW, bodyW, top, sw = 44, seam = true) {
  const cx = 512, lidX = cx - lidW / 2, bodyX = cx - bodyW / 2, bodyY = top + 86, bodyH = 300;
  const lid = `<rect x="${lidX}" y="${top}" width="${lidW}" height="80" rx="16" fill="none" stroke="${BROWN}" stroke-width="${sw}"/>`;
  const body = `<rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="${bodyH}" rx="22" fill="none" stroke="${BROWN}" stroke-width="${sw}"/>`;
  const seamLine = seam ? `<rect x="${bodyX + sw / 2}" y="${bodyY - sw * 0.18}" width="${bodyW - sw}" height="${sw * 0.62}" rx="${sw * 0.31}" fill="${BROWN}"/>` : '';
  return lid + body + seamLine;
}

const CONCEPTS = [
  {
    n: 1, name: '一卧盒上', tag: '一+盒',
    desc: '书法「一」横卧在天地盖方盒的上沿。上是「一」、下是「盒」，竖读即「一盒」。笔画有起收顿、微微右上扬，是楷体精神的直接延伸。',
    body: box(440, 384, 452) + brushI(300, 724, 432, 74, BROWN, -3)
  },
  {
    n: 2, name: '一封', tag: '封/合',
    desc: '方盒描边，盒口处一道「一」作封条——一周一封、周一开团即「封盒」。一同时是封条、是周一、是「一盒」的那一横。',
    body: box(440, 384, 452, 44, false) + brushI(322, 702, 542, 66, BROWN, -2)
  },
  {
    n: 3, name: '一入盒', tag: '一在盒中',
    desc: '方盒留白，盒心悬一道「一」。盒是体、一是名，负空间让两者同时成立：你看见一盒，也看见里头那份「一」。',
    body: box(440, 384, 452, 44, false) + brushI(346, 678, 614, 62, BROWN, -2)
  },
  {
    n: 4, name: '天地盖', tag: '纯盒',
    desc: '没有字，只有一只天地盖：盖略宽于身、中间一道米缝。这是「盒」最诚实的几何——也是之前唯一立住的盒形语言，这次做厚做准。',
    body: `<rect x="272" y="430" width="480" height="86" rx="18" fill="${BROWN}"/>
<rect x="306" y="540" width="412" height="300" rx="24" fill="${BROWN}"/>
<rect x="306" y="552" width="412" height="14" fill="${CREAM}"/>`
  },
  {
    n: 5, name: '合字印', tag: '合=人+一+口',
    desc: '几何化的「合」：人字顶、一道一、一个口。合即合团、合盒、合得来，也是「盒」的读音根。双框是篆刻的规矩，是一枚可盖的信物。',
    body: `<rect x="242" y="242" width="540" height="540" rx="60" fill="none" stroke="${BROWN}" stroke-width="44"/>
<rect x="300" y="300" width="424" height="424" rx="44" fill="none" stroke="${BROWN}" stroke-width="20"/>
<path d="M 360 470 L 512 362 L 664 470" fill="none" stroke="${BROWN}" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/>
${brushI(372, 652, 514, 46, BROWN, -1)}
<rect x="420" y="560" width="184" height="162" rx="20" fill="none" stroke="${BROWN}" stroke-width="46"/>`
  },
  {
    n: 6, name: '一饭四点', tag: '套餐结构',
    desc: '中心一大点（饭）+ 四角四小点（菜），正是「一饭四菜」。不画饭盒、不写字，用点阵把套餐结构本身当成记号。',
    body: `<circle cx="512" cy="540" r="96" fill="${BROWN}"/>
<circle cx="356" cy="392" r="42" fill="${CREAM}" stroke="${BROWN}" stroke-width="20"/>
<circle cx="668" cy="392" r="42" fill="${CREAM}" stroke="${BROWN}" stroke-width="20"/>
<circle cx="356" cy="688" r="42" fill="${CREAM}" stroke="${BROWN}" stroke-width="20"/>
<circle cx="668" cy="688" r="42" fill="${CREAM}" stroke="${BROWN}" stroke-width="20"/>`
  },
  {
    n: 7, name: '开盒', tag: '揭开就吃',
    desc: '棕盒右上角被掀开一角，米色三角里露出一道「一」——那是盒里那份饭。一个动作讲清「周一开团、揭开就吃」，比画热气高级得多。',
    body: `<rect x="300" y="430" width="424" height="320" rx="26" fill="${BROWN}"/>
<path d="M 612 430 L 724 430 L 724 542 Z" fill="${CREAM}"/>
${brushI(346, 678, 566, 62, CREAM, -2)}`
  },
  {
    n: 8, name: '套一盒', tag: 'Box in Box',
    desc: '外方裹内方，一层套一层，最中心是一枚小「一」。盒套盒是容器的诗意，芯里的「一」落回名字：一盒之中，还是那一盒。',
    body: `<rect x="262" y="262" width="500" height="500" rx="84" fill="none" stroke="${BROWN}" stroke-width="46"/>
<rect x="362" y="362" width="300" height="300" rx="52" fill="none" stroke="${BROWN}" stroke-width="40"/>
${brushI(432, 592, 512, 40, BROWN, -2)}`
  },
  {
    n: 9, name: '周一点', tag: '周一开团',
    desc: '环形七点是一周，顶端那点实心 = 周一开团；环心一方盒 = 一周一盒。把「周一」和「盒」两个节奏压进一个环。',
    body: (() => {
      let s = '';
      const cx = 512, cy = 512, r = 214;
      for (let i = 0; i < 7; i++) {
        const a = (-90 + i * 360 / 7) * Math.PI / 180;
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        if (i === 0) s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="48" fill="${BROWN}"/>`;
        else s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="34" fill="none" stroke="${BROWN}" stroke-width="16"/>`;
      }
      s += `<rect x="452" y="452" width="120" height="120" rx="22" fill="none" stroke="${BROWN}" stroke-width="22"/>`;
      return s;
    })()
  },
  {
    n: 10, name: '楷一印', tag: '一笔落印',
    desc: '双框方印里，一笔楷体「一」落定。没有 A、没有盒形，只剩项目名最关键的那个字——「一」。最克制，也最像一枚盖在包装上的印。',
    body: `<rect x="242" y="242" width="540" height="540" rx="64" fill="none" stroke="${BROWN}" stroke-width="44"/>
<rect x="297" y="297" width="430" height="430" rx="44" fill="none" stroke="${BROWN}" stroke-width="20"/>
${brushI(300, 724, 512, 98, BROWN, -3)}`
  }
];

const FILTER = `<defs><filter id="lp" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="9" stdDeviation="1.5" flood-color="#4A3826" flood-opacity="0.20"/></filter></defs>`;
const FRAME = `<rect width="1024" height="1024" fill="${CREAM}"/>
<rect x="42" y="42" width="940" height="940" rx="210" fill="none" stroke="${BROWN}" stroke-width="6" opacity="0.10"/>`;

const wrap = (c, attrs) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${attrs.w}" height="${attrs.h}" viewBox="0 0 1024 1024" preserveAspectRatio="xMidYMid meet">${FILTER}${FRAME}<g filter="url(#lp)">${c.body}</g></svg>`;
const inline = (c) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:100%">${FILTER}${FRAME}<g filter="url(#lp)">${c.body}</g></svg>`;

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
  body { width:1340px; background:#ECE5D8; color:#2E2317;
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
    <h1>ABox 一盒 · 小程序图标<em>十款 · A 退场，主角「一 / 盒」</em></h1>
    <div class="sub">字根<b>一 · 盒 · 方</b> 为主，A 不再做视觉主角<br>米纸 <b>#F6F0E5</b> × 暖棕墨 <b>#6E5435</b> · 书法笔意 + 描边留白</div>
  </header>
  <div class="grid">${CONCEPTS.map(card).join('')}</div>
  <footer>
    <div class="note">画布 1024×1024 · 纯双色 · 图形收在内切圆安全区 · 米纸落墨 + letterpress 淡影做厚度</div>
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
