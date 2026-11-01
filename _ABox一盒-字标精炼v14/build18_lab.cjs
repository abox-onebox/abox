// v18 mark lab：6 种「盒+盖」造型对比（每格独立作用域）
const { chromium } = require('playwright-core');
const dir = __dirname;
const CREAM = '#F6F0E5', BROWN = '#6E5435';
const GRAD = `linear-gradient(150deg,#7C6244 0%,#6E5435 46%,#5A4226 100%)`;
const LIDG = `linear-gradient(180deg,#8C7050,#6E5435 52%,#55401F)`;

function shot(html, file, w, h) {
  return (async () => {
    const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await p.setContent(html, { waitUntil: 'load' });
    await p.waitForTimeout(300);
    await p.screenshot({ path: file, fullPage: true });
    await b.close();
  })();
}

const S = 180;

function make(p, name, bodyCss, extraCss, layers) {
  const css = `
    .${p} { position:absolute; bottom:0; left:50%; transform:translateX(-50%); width:${S}px; height:${S * 0.80}px;
      border-radius:${bodyCss.r}px; ${bodyCss.fill ? `background:${GRAD};` : `border:${S * 0.026}px solid ${BROWN};`}
      box-shadow:${bodyCss.fill ? `0 ${S * .13}px ${S * .24}px -${S * .08}px rgba(74,54,32,.45), inset 0 2px 5px rgba(255,255,255,.18), inset 0 -9px 18px rgba(0,0,0,.3)` : 'none'} }
    ${extraCss}
  `;
  return { css, html: layers };
}

const V = [];
// ① 胶囊盖·外挑（当前做法）
V.push({
  name: '①胶囊盖·外挑',
  ...make('v1', 'x',
    { r: S * 0.20, fill: true },
    `.v1-l{position:absolute;top:0;left:50%;transform:translateX(-50%);width:${S * 1.27}px;height:${S * .115}px;border-radius:${S * .057}px;background:${LIDG};box-shadow:0 4px 8px rgba(58,40,20,.5)}`,
    `<div class="v1-l"></div><div class="v1"></div>`)
});
// ② 方肩板盖·略宽于盒
V.push({
  name: '②方肩板盖',
  ...make('v2', 'x',
    { r: S * 0.115, fill: true },
    `.v2-l{position:absolute;top:0;left:50%;transform:translateX(-50%);width:${S * 1.1}px;height:${S * .10}px;border-radius:${S * .016}px;background:${LIDG};box-shadow:0 4px 8px rgba(58,40,20,.5), inset 0 1px 1px rgba(255,255,255,.35)}`,
    `<div class="v2-l"></div><div class="v2"></div>`)
});
// ③ 内嵌盖·窄于盒身
V.push({
  name: '③内嵌盖·窄于盒',
  ...make('v3', 'x',
    { r: S * 0.115, fill: true },
    `.v3-l{position:absolute;top:${S * .055}px;left:50%;transform:translateX(-50%);width:${S * .76}px;height:${S * .08}px;border-radius:${S * .014}px;background:${LIDG};box-shadow:0 3px 6px rgba(58,40,20,.45), inset 0 1px 1px rgba(255,255,255,.3)}`,
    `<div class="v3"></div><div class="v3-l"></div>`)
});
// ④ 仅盖缝 + 提舌
V.push({
  name: '④盖缝+提舌',
  ...make('v4', 'x',
    { r: S * 0.115, fill: true },
    `.v4-seam{position:absolute;top:${S * .175}px;left:${S * .065}px;right:${S * .065}px;height:${S * .016}px;border-radius:2px;background:rgba(246,240,229,.4)}
     .v4-tab{position:absolute;top:${S * .175}px;left:50%;transform:translateX(-50%);width:${S * .15}px;height:${S * .07}px;border-radius:0 0 7px 7px;background:rgba(246,240,229,.4)}`,
    `<div class="v4"></div><div class="v4-seam"></div><div class="v4-tab"></div>`)
});
// ⑤ 板盖 + 提手缺口
V.push({
  name: '⑤板盖+提手缺口',
  ...make('v5', 'x',
    { r: S * 0.115, fill: true },
    `.v5-l{position:absolute;top:0;left:50%;transform:translateX(-50%);width:${S * 1.06}px;height:${S * .11}px;border-radius:${S * .02}px;background:${LIDG};box-shadow:0 4px 8px rgba(58,40,20,.5), inset 0 1px 1px rgba(255,255,255,.35)}
     .v5-n{position:absolute;top:${S * .03}px;left:50%;transform:translateX(-50%);width:${S * .24}px;height:${S * .026}px;border-radius:3px;background:rgba(50,34,16,.6)}`,
    `<div class="v5-l"></div><div class="v5-n"></div><div class="v5"></div>`)
});
// ⑥ 线稿盒（无填充）
V.push({
  name: '⑥线稿盒',
  ...make('v6', 'x',
    { r: S * 0.115, fill: false },
    `.v6-l{position:absolute;top:0;left:50%;transform:translateX(-50%);width:${S * 1.08}px;height:${S * .095}px;border-radius:${S * .014}px;border:${S * .026}px solid ${BROWN};background:${CREAM};box-shadow:0 3px 6px rgba(74,54,32,.16)}`,
    `<div class="v6-l"></div><div class="v6"></div>`)
});

const cells = V.map(v => `
  <div class="cell">
    <div class="stage">${v.html}</div>
    <div class="cap">${v.name}</div>
    <style>${v.css}</style>
  </div>`).join('');

const html = `<!doctype html><html><head><meta charset=utf8><style>
  *{margin:0;box-sizing:border-box}
  body{background:${CREAM};font-family:"KaiTi","STKaiti",serif;color:${BROWN};padding:32px}
  .grid{width:1128px;display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
  .cell{background:rgba(255,255,255,.42);border:1px solid rgba(110,84,53,.18);border-radius:18px;padding:14px 10px 12px;display:flex;flex-direction:column;align-items:center}
  .stage{width:${S * 1.4}px;height:${S * 0.95}px;position:relative;margin:8px 0 6px}
  .cap{font-size:17px;letter-spacing:1px;opacity:.72}
</style></head><body><div class="grid">${cells}</div></body></html>`;

shot(html, `${dir}/_lab_盒盖造型.png`, 1200, 500).then(() => console.log('lab done')).catch(e => { console.error(e); process.exit(1); });
