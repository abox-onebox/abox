const { chromium } = require('playwright-core');
const path = require('path');

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';
const DARK  = '#523E27';
const KAI   = 'KaiTi,楷体,STKaiti';
const SANS  = '"PingFang SC","Microsoft YaHei",sans-serif';

const BASE = `
*{box-sizing:border-box;margin:0;padding:0}
body{background:${CREAM};font-family:${KAI};display:flex;align-items:center;justify-content:center;min-height:100vh}
.sheet{width:520px;height:640px;background:${CREAM};display:flex;flex-direction:column;padding:34px}
.art{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px}
.ic{display:flex;align-items:center;justify-content:center}
.wm{font-family:${KAI};font-size:34px;letter-spacing:11px;color:${BROWN};line-height:1;padding-left:11px}
.cap{height:58px;display:flex;align-items:center;justify-content:center;color:${BROWN};font-size:25px;letter-spacing:7px;border-top:1px solid rgba(110,84,53,.18)}
`;

// n, t, icon(html), wm(是否带字标)
const C = [
  { n:'01', t:'暖碗', wm:true, icon:`<svg width="200" height="200" viewBox="0 0 210 210">
    <path d="M68 78 q -13 -17 0 -34 q 13 -17 0 -34" fill="none" stroke="${BROWN}" stroke-width="5.5" stroke-linecap="round" opacity=".4"/>
    <path d="M105 74 q -13 -17 0 -34 q 13 -17 0 -34" fill="none" stroke="${BROWN}" stroke-width="5.5" stroke-linecap="round" opacity=".62"/>
    <path d="M142 78 q -13 -17 0 -34 q 13 -17 0 -34" fill="none" stroke="${BROWN}" stroke-width="5.5" stroke-linecap="round" opacity=".4"/>
    <ellipse cx="105" cy="122" rx="70" ry="17" fill="${CREAM}" stroke="${BROWN}" stroke-width="6"/>
    <path d="M35 122 h140 a70 70 0 0 1 -140 0 Z" fill="${CREAM}" stroke="${BROWN}" stroke-width="6"/>
  </svg>` },

  { n:'02', t:'筷盒', wm:true, icon:`<svg width="200" height="200" viewBox="0 0 210 210">
    <rect x="58" y="92" width="96" height="82" rx="12" fill="${CREAM}" stroke="${BROWN}" stroke-width="6"/>
    <line x1="36" y1="58" x2="162" y2="104" stroke="${DARK}" stroke-width="8" stroke-linecap="round"/>
    <line x1="52" y1="50" x2="178" y2="96" stroke="${BROWN}" stroke-width="8" stroke-linecap="round"/>
  </svg>` },

  { n:'03', t:'便当格', wm:true, icon:`<svg width="200" height="200" viewBox="0 0 210 210">
    <rect x="26" y="46" width="158" height="128" rx="16" fill="${CREAM}" stroke="${BROWN}" stroke-width="6"/>
    <rect x="38" y="58" width="80" height="80" rx="11" fill="#EBE0CB"/>
    <rect x="126" y="58" width="46" height="37" rx="9" fill="#D8C39A"/>
    <rect x="126" y="101" width="46" height="37" rx="9" fill="#C9B187"/>
    <rect x="38" y="144" width="134" height="22" rx="8" fill="#D8C39A"/>
  </svg>` },

  { n:'04', t:'信封盒', wm:false, icon:`<svg width="200" height="200" viewBox="0 0 210 210">
    <rect x="32" y="72" width="146" height="100" rx="9" fill="${CREAM}" stroke="${BROWN}" stroke-width="6"/>
    <path d="M32 72 L105 138 L178 72" fill="none" stroke="${BROWN}" stroke-width="6"/>
    <path d="M32 72 L105 72 L105 138 Z" fill="${BROWN}"/>
  </svg>` },

  { n:'05', t:'火漆章', wm:false, icon:`<svg width="200" height="200" viewBox="0 0 210 210">
    <circle cx="105" cy="105" r="80" fill="${BROWN}"/>
    <circle cx="105" cy="105" r="65" fill="none" stroke="${CREAM}" stroke-width="3" opacity=".5"/>
    <text x="105" y="126" text-anchor="middle" font-family="${KAI}" font-size="56" fill="${CREAM}" letter-spacing="3">一盒</text>
  </svg>` },

  { n:'06', t:'猫送餐', wm:false, icon:`<svg width="200" height="200" viewBox="0 0 210 210">
    <path d="M62 96 L50 50 L92 80 Z" fill="${BROWN}"/>
    <path d="M148 96 L160 50 L118 80 Z" fill="${BROWN}"/>
    <circle cx="105" cy="118" r="56" fill="${CREAM}" stroke="${BROWN}" stroke-width="6"/>
    <circle cx="87" cy="114" r="6" fill="${BROWN}"/>
    <circle cx="123" cy="114" r="6" fill="${BROWN}"/>
    <path d="M95 138 q10 10 20 0" fill="none" stroke="${BROWN}" stroke-width="4.5" stroke-linecap="round"/>
    <rect x="74" y="170" width="62" height="30" rx="8" fill="${BROWN}"/>
  </svg>` },

  { n:'07', t:'熊抱盒', wm:false, icon:`<svg width="200" height="200" viewBox="0 0 210 210">
    <circle cx="66" cy="66" r="20" fill="${BROWN}"/>
    <circle cx="144" cy="66" r="20" fill="${BROWN}"/>
    <circle cx="105" cy="104" r="60" fill="${BROWN}"/>
    <circle cx="87" cy="100" r="6.5" fill="${CREAM}"/>
    <circle cx="123" cy="100" r="6.5" fill="${CREAM}"/>
    <circle cx="105" cy="124" r="8" fill="${DARK}"/>
    <rect x="72" y="140" width="66" height="56" rx="10" fill="${CREAM}" stroke="${BROWN}" stroke-width="5"/>
    <text x="105" y="180" text-anchor="middle" font-family="${KAI}" font-size="30" fill="${BROWN}">一</text>
  </svg>` },

  { n:'08', t:'ABox标', wm:false, icon:`<svg width="200" height="200" viewBox="0 0 210 210">
    <rect x="28" y="36" width="154" height="138" rx="16" fill="${BROWN}"/>
    <text x="105" y="112" text-anchor="middle" font-family="${SANS}" font-size="66" font-weight="700" fill="${CREAM}" letter-spacing="1">AB</text>
    <text x="107" y="150" text-anchor="middle" font-family="${SANS}" font-size="22" font-weight="500" fill="${CREAM}" letter-spacing="10" opacity=".85">OX</text>
  </svg>` },

  // 09 盖线盒：盖条压在盒沿上（无缝，不会读成提手/公文包）
  { n:'09', t:'盖线盒', wm:true, icon:`<svg width="200" height="200" viewBox="0 0 210 210">
    <rect x="52" y="74" width="106" height="86" rx="7" fill="${CREAM}" stroke="${BROWN}" stroke-width="6.5"/>
    <rect x="38" y="60" width="134" height="16" rx="5" fill="${BROWN}"/>
  </svg>` },

  { n:'10', t:'撞色块', wm:false, icon:`<div style="width:200px;height:200px;background:${BROWN};border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px">
    <div style="color:${CREAM};font-family:${KAI};font-size:60px;letter-spacing:8px;line-height:1">一盒</div>
    <div style="color:${CREAM};font-family:${SANS};font-size:18px;letter-spacing:10px;opacity:.8">ABOX</div>
  </div>` },

  // 11 日盒：一日一盒
  { n:'11', t:'日盒', wm:true, icon:`<svg width="200" height="200" viewBox="0 0 210 210">
    <rect x="54" y="42" width="102" height="126" rx="9" fill="${CREAM}" stroke="${BROWN}" stroke-width="6.5"/>
    <line x1="54" y1="105" x2="156" y2="105" stroke="${BROWN}" stroke-width="6.5"/>
  </svg>` },

  { n:'12', t:'一笔盒', wm:true, icon:`<svg width="200" height="200" viewBox="0 0 210 210">
    <path d="M52 96 h106 v72 h-106 Z M52 96 l53 -34 l53 34" fill="none" stroke="${BROWN}" stroke-width="7.5" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M52 132 h106" fill="none" stroke="${BROWN}" stroke-width="4" stroke-linecap="round" opacity=".45"/>
  </svg>` },

  { n:'13', t:'饭团', wm:true, icon:`<svg width="200" height="200" viewBox="0 0 210 210">
    <path d="M105 32 L172 150 Q176 160 164 160 L46 160 Q34 160 38 150 Z" fill="${CREAM}" stroke="${BROWN}" stroke-width="6" stroke-linejoin="round"/>
    <rect x="87" y="112" width="36" height="48" rx="4" fill="${BROWN}"/>
  </svg>` },

  { n:'14', t:'盖碗', wm:true, icon:`<svg width="200" height="200" viewBox="0 0 210 210">
    <path d="M30 136 a76 62 0 0 1 152 0 Z" fill="${CREAM}" stroke="${BROWN}" stroke-width="6"/>
    <rect x="34" y="140" width="142" height="12" rx="6" fill="${BROWN}"/>
    <circle cx="105" cy="66" r="9" fill="${BROWN}"/>
  </svg>` },

  { n:'15', t:'双色盒', wm:true, icon:`<svg width="200" height="200" viewBox="0 0 210 210">
    <rect x="40" y="52" width="130" height="112" rx="10" fill="${CREAM}" stroke="${BROWN}" stroke-width="6"/>
    <path d="M40 164 V106 L146 52 H170 V66 L40 164 Z" fill="${BROWN}"/>
  </svg>` },
];

function cellPage(c) {
  return `<!doctype html><html><head><meta charset=utf8><style>${BASE}</style></head>
  <body><div class="sheet"><div class="art">
    <div class="ic">${c.icon}</div>${c.wm ? '<div class="wm">一盒</div>' : ''}
  </div><div class="cap">${c.n} · ${c.t}</div></div></body></html>`;
}

const cells = C.map(c => `<div class="cell"><div class="ic">${c.icon}</div><div class="cap">${c.n} · ${c.t}</div></div>`).join('');

const boardCss = `
*{box-sizing:border-box;margin:0;padding:0}
body{background:${CREAM};font-family:${KAI};padding:36px 30px 20px}
.head{font-size:33px;letter-spacing:9px;color:${BROWN};text-align:center}
.sub{font-size:16px;letter-spacing:3px;color:${BROWN};opacity:.55;text-align:center;margin:10px 0 30px}
.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;max-width:1500px;margin:0 auto}
.cell{background:${CREAM};border:1px solid rgba(110,84,53,.16);border-radius:14px;overflow:hidden}
.ic{height:200px;display:flex;align-items:center;justify-content:center}
.ic svg{width:168px;height:168px}
.ic>div{transform:scale(.84)}
.cap{height:48px;display:flex;align-items:center;justify-content:center;color:${BROWN};font-size:18px;letter-spacing:3px;border-top:1px solid rgba(110,84,53,.16);white-space:nowrap}
`;
const boardHtml = `<!doctype html><html><head><meta charset=utf8><style>${boardCss}</style></head>
<body><div class="head">一盒 · 标志探索</div><div class="sub">v19 · 15 个方向</div>
<div class="grid">${cells}</div></body></html>`;

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 600, height: 760 }, deviceScaleFactor: 2 });
  const dir = __dirname;
  for (const c of C) {
    await page.setContent(cellPage(c), { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(dir, `c${c.n}_${c.t}.png`) });
  }
  await page.setViewportSize({ width: 1540, height: 1200 });
  await page.setContent(boardHtml, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(dir, `00_探索板.png`), fullPage: true });
  await browser.close();
  console.log('done');
})();
