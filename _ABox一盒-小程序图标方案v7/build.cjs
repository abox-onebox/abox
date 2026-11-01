/* ABox 一盒 · 小程序图标十方案 v7 —— 真楷体字标 + 印章（A 退场，主角「一 / 盒」） */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';
const OUT = __dirname;
const FONT = 'KaiTi,楷体,STKaiti,"Kaiti SC",serif';

const BASE_CSS = `*{margin:0;padding:0;box-sizing:border-box}
.tile{width:1024px;height:1024px;background:${CREAM};display:flex;align-items:center;justify-content:center;
  position:relative;overflow:hidden;font-family:${FONT};color:${BROWN};-webkit-font-smoothing:antialiased}
.seal{display:flex;align-items:center;justify-content:center}`;

const C = [
  {
    n: 1, name: '白文印·盒', tag: '阴刻 · 最像真印',
    desc: '棕底米字，阴刻（白文），像一枚盖在饭盒封条上的真印。“盒”是项目本体，楷体保留笔锋，印面微微歪一点——手盖的印从不端正。最厚重、最有信物感的一款。',
    inner: `<div style="width:646px;height:646px;background:${BROWN};border-radius:12px;display:flex;align-items:center;justify-content:center;transform:rotate(-0.8deg);box-shadow:0 12px 30px -16px rgba(46,35,23,.55)">
      <span style="font-size:466px;line-height:1;color:${CREAM};transform:translateY(28px);text-shadow:0 2px 0 rgba(0,0,0,.10)">盒</span>
    </div>`
  },
  {
    n: 2, name: '朱文印·盒', tag: '阳刻 · 清雅',
    desc: '米底棕框、棕字，阳刻（朱文），是白文的清雅版。框细、字实，放大做包装腰封、便签贴都不压迫，是最“轻”的一枚印。',
    inner: `<div style="width:624px;height:624px;border:9px solid ${BROWN};border-radius:5px;display:flex;align-items:center;justify-content:center">
      <span style="font-size:416px;line-height:1;transform:translateY(25px)">盒</span>
    </div>`
  },
  {
    n: 3, name: '圆印·盒', tag: '圆框 · 贴纸',
    desc: '同一枚“盒”装进圆印。方印专供小程序头像，圆印留给社媒头像、碗盖贴纸、封口贴——同一套记号，两个形状都不缺角。',
    inner: `<div style="width:648px;height:648px;border:9px solid ${BROWN};border-radius:50%;display:flex;align-items:center;justify-content:center">
      <span style="font-size:376px;line-height:1;transform:translateY(23px)">盒</span>
    </div>`
  },
  {
    n: 4, name: '竖排·一盒', tag: '老字号招牌',
    desc: '楷体“一盒”竖排，右侧一道细竖线收边。把中文名当正身，A 完全退场——像一块挂在门口的老字号招牌，竖读即“一盒”。',
    inner: `<div style="display:flex;align-items:center;gap:44px">
      <div style="writing-mode:vertical-rl;font-size:312px;line-height:1.08;letter-spacing:.02em;transform:translateY(10px)">一盒</div>
      <div style="width:3px;height:520px;background:${BROWN};opacity:.32"></div>
    </div>`
  },
  {
    n: 5, name: '横排·一盒', tag: '现代字标',
    desc: '横排“一盒”，下压一道细线与小字。最像现代 wordmark：条幅、名片、小程序启动页都稳，横着读一眼即认。',
    inner: `<div style="display:flex;flex-direction:column;align-items:center;gap:30px">
      <div style="font-size:292px;line-height:1;letter-spacing:0">一盒</div>
      <div style="width:446px;height:3px;background:${BROWN};opacity:.42"></div>
      <div style="font-size:32px;letter-spacing:.44em;opacity:.7;padding-left:.44em">一盒 · 周一开团</div>
    </div>`
  },
  {
    n: 6, name: '白文竖排·一盒', tag: '两字成印',
    desc: '棕块里竖排“一盒”（白文）。这是信息最全的一款：既有“一”也有“盒”，二字成印，盖在哪儿都是一句完整的项目名。',
    inner: `<div style="width:556px;height:672px;background:${BROWN};border-radius:12px;display:flex;align-items:center;justify-content:center;transform:rotate(-0.6deg);box-shadow:0 12px 30px -16px rgba(46,35,23,.5)">
      <div style="writing-mode:vertical-rl;font-size:300px;line-height:1.1;color:${CREAM};letter-spacing:.02em;transform:translateY(10px)">一盒</div>
    </div>`
  },
  {
    n: 7, name: '双框·合', tag: '合团 · 合盒',
    desc: '双框之内一个楷体“合”。合即合团、合盒、合得来，也是“盒”的声旁——一个“合”字，把“同事凑一盒”这件事说尽了。',
    inner: `<div style="position:relative;width:660px;height:660px;border:10px solid ${BROWN};display:flex;align-items:center;justify-content:center">
      <div style="position:absolute;inset:30px;border:4px solid ${BROWN};opacity:.85"></div>
      <span style="font-size:366px;line-height:1;transform:translateY(18px)">合</span>
    </div>`
  },
  {
    n: 8, name: '白文印·一', tag: '一字顶三句',
    desc: '棕方印里只留一道楷体“一”。“一”同时是周一、一盒、一饭四菜、一笔落墨——四个意思共用这一个字。最极简，也最有余味。',
    inner: `<div style="width:646px;height:646px;background:${BROWN};border-radius:12px;display:flex;align-items:center;justify-content:center;transform:rotate(-0.8deg);box-shadow:0 12px 30px -16px rgba(46,35,23,.55)">
      <span style="font-size:430px;line-height:1;color:${CREAM};transform:translateY(40px) scaleX(1.5);text-shadow:0 2px 0 rgba(0,0,0,.10)">一</span>
    </div>`
  },
  {
    n: 9, name: '竖排·周一', tag: '开团节奏',
    desc: '楷体“周一”竖排，旁附小字“一盒 · 周一开团”。直接把这个项目最重要的节奏——周一开团——写成标识，不再靠图形暗示。',
    inner: `<div style="display:flex;align-items:center;gap:46px">
      <div style="writing-mode:vertical-rl;font-size:306px;line-height:1.07;letter-spacing:.02em;transform:translateY(10px)">周一</div>
      <div style="writing-mode:vertical-rl;font-size:35px;letter-spacing:.34em;opacity:.85">一盒 · 周一开团</div>
    </div>`
  },
  {
    n: 10, name: '大字·盒', tag: '封面感',
    desc: '一个巨大的楷体“盒”撑满画面，右下角一枚小字品牌签。最像杂志封面、也最克制——把最核心的那个字放大到不容忽视。',
    inner: `<div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center">
      <span style="font-size:566px;line-height:1;transform:translateY(34px)">盒</span>
      <div style="position:absolute;right:98px;bottom:96px;writing-mode:vertical-rl;font-size:30px;letter-spacing:.36em;opacity:.66">ABox 一盒</div>
    </div>`
  }
];

const tile = (c) => `<div class="tile">${c.inner}</div>`;
const pageHTML = (c) => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body>${tile(c)}</body></html>`;

/* 总览 */
const card = (c) => `
  <article class="card">
    <div class="shot"><div class="scaled">${tile(c)}</div></div>
    <div class="meta"><div class="name"><span class="num">0${c.n}</span>${c.name}</div><div class="tag">${c.tag}</div></div>
    <p class="desc">${c.desc}</p>
    <div class="small"><div class="mini">${tile(c)}</div><span>实际 40px 大小</span></div>
  </article>`;

const sheet = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><style>
${BASE_CSS}
body{width:1340px;background:#ECE5D8;color:#2E2317;font-family:${FONT};padding:54px 54px 42px;-webkit-font-smoothing:antialiased}
header{display:flex;align-items:flex-end;justify-content:space-between;padding-bottom:24px;border-bottom:1px solid #D8CBB6}
h1{font-size:36px;font-weight:600;letter-spacing:.5px}
h1 em{font-style:normal;font-size:18px;color:#8C7A62;margin-left:14px}
.sub{font-size:14px;color:#8C7A62;text-align:right;line-height:1.9}
.sub b{color:${BROWN};font-weight:600}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:28px;margin-top:32px}
.card{background:#fff;border:1px solid #E4D9C6;border-radius:18px;padding:26px 26px 20px}
.shot{display:flex;justify-content:center;padding:6px 0 20px}
.scaled{width:248px;height:248px;border-radius:54px;overflow:hidden;position:relative;box-shadow:0 14px 30px -16px rgba(46,35,23,.42)}
.scaled .tile{position:absolute;top:0;left:0;transform:scale(.2421875);transform-origin:top left}
.meta{display:flex;align-items:baseline;gap:10px}
.name{font-size:23px;font-weight:600;letter-spacing:.5px}
.num{font-size:14px;color:#B3A28A;margin-right:8px}
.tag{font-size:12px;color:${BROWN};border:1px solid #D9CBB4;border-radius:999px;padding:2px 10px}
.desc{font-size:14px;line-height:1.85;color:#6B5B47;margin-top:12px;min-height:112px}
.small{display:flex;align-items:center;gap:12px;margin-top:6px;padding-top:13px;border-top:1px dashed #E4D9C6;font-size:12.5px;color:#A0917B}
.mini{width:40px;height:40px;border-radius:9px;overflow:hidden;position:relative;flex:0 0 auto}
.mini .tile{position:absolute;top:0;left:0;transform:scale(.0390625);transform-origin:top left}
footer{margin-top:32px;display:flex;align-items:center;justify-content:space-between;padding-top:20px;border-top:1px solid #D8CBB6;font-size:13px;color:#8C7A62}
.note{line-height:1.8}
</style></head><body>
  <header>
    <h1>ABox 一盒 · 小程序图标<em>十款 · 真楷体字标 + 印章</em></h1>
    <div class="sub">A 退场，主角换成<b>「一 / 盒」</b>（周一 · 一盒 · 一饭四菜）<br>米纸 <b>#F6F0E5</b> × 暖棕墨 <b>#6E5435</b> · 真楷体渲染，保留笔锋</div>
  </header>
  <div class="grid">${C.map(card).join('')}</div>
  <footer><div class="note">画布 1024×1024 · 纯双色 · 真楷体字库渲染（SimKai）· 图形收在内切圆安全区</div></footer>
</body></html>`;

fs.writeFileSync(path.join(OUT, '_sheet.html'), sheet, 'utf8');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  for (const c of C) {
    await page.setContent(pageHTML(c), { waitUntil: 'load' });
    await page.waitForTimeout(120);
    const p = path.join(OUT, `方案${c.n}_${c.name}_1024.png`);
    await page.locator('.tile').screenshot({ path: p });
    console.log('png', c.n, fs.statSync(p).size);
  }
  const sp = await browser.newPage({ viewport: { width: 1340, height: 1200 }, deviceScaleFactor: 2 });
  await sp.goto('file:///' + path.join(OUT, '_sheet.html').replace(/\\/g, '/'), { waitUntil: 'load' });
  await sp.waitForTimeout(400);
  const sheetP = path.join(OUT, '方案总览.png');
  await sp.screenshot({ path: sheetP, fullPage: true });
  console.log('sheet', fs.statSync(sheetP).size);
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
