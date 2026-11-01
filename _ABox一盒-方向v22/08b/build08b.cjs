const { chromium } = require('playwright-core');
const path = require('path');

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';

const css = `.art{width:600px;height:600px;background:${CREAM};display:flex;align-items:center;justify-content:center;overflow:hidden}
.g4{display:grid;grid-template-columns:repeat(2,156px);grid-template-rows:repeat(3,156px);gap:10px}
.g4 .c{display:flex;align-items:center;justify-content:center;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:800;font-size:100px;border-radius:14px}
.g4 .a{background:${CREAM};color:${BROWN};border:5px solid ${BROWN};box-sizing:border-box}
.g4 .b{background:${BROWN};color:${CREAM}}
.g4 .o{background:${CREAM};color:transparent;-webkit-text-stroke:5px ${BROWN};border:5px solid ${BROWN};box-sizing:border-box}
.g4 .x{background:${CREAM};color:${BROWN};border:5px solid ${BROWN};box-sizing:border-box}
.g4 .y{background:${CREAM};color:${BROWN};border:5px solid ${BROWN};box-sizing:border-box;font-family:'KaiTi','楷体','STKaiti',serif;font-weight:400}
.g4 .h{background:${CREAM};color:${BROWN};border:5px solid ${BROWN};box-sizing:border-box;font-family:'KaiTi','楷体','STKaiti',serif;font-weight:400}`;

const html = `<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0;padding:0}${css}</style></head><body><div class="art"><div class="g4">
  <div class="c a">A</div><div class="c b">B</div>
  <div class="c o">o</div><div class="c x">x</div>
  <div class="c y">一</div><div class="c h">盒</div>
</div></div></body></html>`;

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(__dirname, '08b_GridFour_一盒.png') });
  await browser.close();
  console.log('done');
})();
