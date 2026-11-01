const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';
const BROWN_DK = '#574226';   // 衍生深棕（仅用于阴影/描边层次）
const CREAM_LT = '#FBF8F1';   // 衍生浅米（仅用于层次）
const KAI = "KaiTi,楷体,STKaiti,serif";
const LAT = "'Helvetica Neue',Arial,sans-serif";

function cellStyle(k, c) {
  const px = v => (v * k) + 'px';
  const s = [
    `width:${px(150)};height:${px(150)};display:flex;align-items:center;justify-content:center`,
    `font-family:${LAT};font-weight:800;font-size:${px(96)};border-radius:${px(14)}`,
    `border:${px(5)} solid ${c.border};box-sizing:border-box`,
    `background:${c.bg}`,
  ];
  if (c.letter === 'solid-brown') s.push(`color:${BROWN}`);
  else if (c.letter === 'solid-cream') s.push(`color:${CREAM}`);
  else if (c.letter === 'hollow-cream') s.push(`color:transparent;-webkit-text-stroke:${px(c.stroke || 5)} ${CREAM}`);
  else if (c.letter === 'hollow-brown') s.push(`color:transparent;-webkit-text-stroke:${px(c.stroke || 5)} ${BROWN}`);
  return s.join(';');
}

function cellsOf(mode) {
  if (mode === 'reverse') {
    return {
      A:{ border:CREAM, bg:BROWN, letter:'solid-cream' },
      B:{ border:CREAM, bg:BROWN, letter:'solid-cream' },
      o:{ border:CREAM, bg:BROWN, letter:'solid-cream' },
      x:{ border:CREAM, bg:CREAM, letter:'solid-brown' },
    };
  }
  if (mode === 'mono') { // 单色（白纸棕墨，可印刷/盖章）
    return {
      A:{ border:BROWN, bg:'#FFFFFF', letter:'solid-brown' },
      B:{ border:BROWN, bg:'#FFFFFF', letter:'solid-brown' },
      o:{ border:BROWN, bg:'#FFFFFF', letter:'solid-brown' },
      x:{ border:BROWN, bg:BROWN, letter:'solid-cream' },
    };
  }
  if (mode === 'transparent') { // 透明底
    return {
      A:{ border:BROWN, bg:'transparent', letter:'solid-brown' },
      B:{ border:BROWN, bg:'transparent', letter:'solid-brown' },
      o:{ border:BROWN, bg:'transparent', letter:'solid-brown' },
      x:{ border:BROWN, bg:BROWN, letter:'solid-cream' },
    };
  }
  // normal
  return {
    A:{ border:BROWN, bg:CREAM, letter:'solid-brown' },
    B:{ border:BROWN, bg:CREAM, letter:'solid-brown' },
    o:{ border:BROWN, bg:CREAM, letter:'solid-brown' },
    x:{ border:BROWN, bg:BROWN, letter:'solid-cream' },
  };
}

function gridHtml(k, mode) {
  const c = cellsOf(mode);
  const cell = (ch, cc) => `<div style="${cellStyle(k, cc)}">${ch}</div>`;
  const px = v => (v * k) + 'px';
  return `<div style="display:grid;grid-template-columns:repeat(2,${px(150)});grid-template-rows:repeat(2,${px(150)});gap:${px(12)}">
      ${cell('A', c.A)}${cell('B', c.B)}${cell('o', c.o)}${cell('x', c.x)}
    </div>`;
}

async function shot(html, file, w, h, fullPage, omit, dsf) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dsf || 2 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  const opt = { path: file, fullPage: !!fullPage };
  if (omit) opt.omitBackground = true;
  await page.screenshot(opt);
  await browser.close();
}

const b64 = f => fs.readFileSync(f).toString('base64');
const uri = f => `data:image/png;base64,${b64(f)}`;

(async () => {
  const D = __dirname;
  const out = (n) => path.join(D, n);

  // ===== 一、核心标志四版 =====
  await shot(`<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0}</style></head>
    <body style="background:${CREAM}"><div style="width:480px;height:480px;display:flex;align-items:center;justify-content:center;overflow:hidden">${gridHtml(1,'normal')}</div></body></html>`,
    out('01_标志_正常版.png'), 480, 480, false, false, 1);
  await shot(`<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0}</style></head>
    <body style="background:${BROWN}"><div style="width:480px;height:480px;display:flex;align-items:center;justify-content:center;overflow:hidden">${gridHtml(1,'reverse')}</div></body></html>`,
    out('02_标志_反白版.png'), 480, 480, false, false, 1);
  await shot(`<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0;background:#fff}</style></head>
    <body><div style="width:480px;height:480px;display:flex;align-items:center;justify-content:center;overflow:hidden">${gridHtml(1,'mono')}</div></body></html>`,
    out('03_标志_单色版.png'), 480, 480, false, false, 1);
  await shot(`<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0;background:transparent}</style></head>
    <body><div style="width:480px;height:480px;display:flex;align-items:center;justify-content:center;overflow:hidden">${gridHtml(1,'transparent')}</div></body></html>`,
    out('04_标志_透明底.png'), 480, 480, false, true, 1);
  console.log('flags done');

  // ===== 二、小程序图标包 =====
  // 2.1 方形标准 1024（满格，用于非圆形场景/应用商店方标）
  await shot(`<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0;background:${CREAM}}</style></head>
    <body><div style="width:1024px;height:1024px;display:flex;align-items:center;justify-content:center;overflow:hidden">${gridHtml(2.85,'normal')}</div></body></html>`,
    out('10_图标_方形1024.png'), 1024, 1024, false, false, 1);
  // 2.2 圆形安全区 1024（整体缩进，保证被裁成圆后仍完整）
  await shot(`<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0;background:transparent}</style></head>
    <body><div style="width:1024px;height:1024px;display:flex;align-items:center;justify-content:center;overflow:hidden">${gridHtml(2.2,'transparent')}</div></body></html>`,
    out('11_图标_圆形安全区1024.png'), 1024, 1024, false, true, 1);
  // 2.3 微信头像裁切预览（满格方标 + 圆形遮罩示意）
  await shot(`<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0;background:${CREAM_LT}}</style></head>
    <body><div style="width:1024px;height:1024px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.28;background:${BROWN}">${gridHtml(2.85,'normal')}</div>
      <div style="position:relative;width:1024px;height:1024px;border-radius:50%;overflow:hidden;box-shadow:0 0 0 6px ${CREAM_LT},0 12px 40px rgba(87,66,38,.25)">${gridHtml(2.85,'normal')}</div>
    </div></body></html>`,
    out('12_图标_微信头像预览.png'), 1024, 1024, false, false, 1);
  // 2.4 小程序 tabBar 小图标（透明底，81pt@3x=243）
  await shot(`<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0;background:transparent}</style></head>
    <body><div style="width:243px;height:243px;display:flex;align-items:center;justify-content:center;overflow:hidden">${gridHtml(0.62,'transparent')}</div></body></html>`,
    out('13_图标_tabBar243.png'), 243, 243, false, true, 1);
  console.log('icons done');

  // ===== 三、应用物料 =====
  // 3.1 名片
  await shot(`<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0;background:${CREAM}}</style></head>
    <body><div style="width:460px;height:252px;background:#fff;border:1px solid rgba(110,84,53,.18);border-radius:14px;box-shadow:0 6px 22px rgba(110,84,53,.10);padding:28px 30px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;font-family:${LAT};color:${BROWN}">
      <div style="display:flex;align-items:center;gap:18px">${gridHtml(0.42,'normal')}<div><div style="font-size:38px;font-weight:800;letter-spacing:1px">ABox</div><div style="font-size:12px;opacity:.55;letter-spacing:3px;margin-top:4px">LUNCH · DELIVERED</div></div></div>
      <div style="height:2px;background:${BROWN};opacity:.28"></div>
      <div style="font-size:13px;opacity:.7;line-height:1.75">北京巡礼之年科技　|　工作日 11:30 达<br/>一饭四菜 · 盲盒惊喜</div>
    </div></body></html>`,
    out('20_应用_名片.png'), 460, 252);
  // 3.2 腰封（深色底必须用反白版）
  await shot(`<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0;background:${CREAM}}</style></head>
    <body><div style="width:700px;height:148px;background:${BROWN};border-radius:12px;display:flex;align-items:center;justify-content:space-between;padding:0 38px;box-sizing:border-box;font-family:${LAT}">
      <div style="display:flex;align-items:center;gap:20px">${gridHtml(0.36,'reverse')}<div style="color:${CREAM};font-size:36px;font-weight:800">ABox</div></div>
      <div style="color:${CREAM};font-size:13px;opacity:.85;letter-spacing:3px">一饭四菜 · 盲盒惊喜</div>
    </div></body></html>`,
    out('21_应用_腰封.png'), 700, 148);
  // 3.3 包装正面
  await shot(`<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0;background:${CREAM}}</style></head>
    <body><div style="width:600px;height:420px;background:${CREAM_LT};border:2px solid ${BROWN};border-radius:16px;box-sizing:border-box;padding:34px 38px;display:flex;flex-direction:column;justify-content:space-between;font-family:${LAT};color:${BROWN}">
      <div style="display:flex;align-items:center;gap:18px">${gridHtml(0.5,'normal')}<div style="font-size:46px;font-weight:800;letter-spacing:1px">ABox</div></div>
      <div style="height:2px;background:${BROWN};opacity:.25"></div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end">
        <div style="font-family:${KAI};font-size:26px;letter-spacing:6px">一饭四菜 · 盲盒惊喜</div>
        <div style="font-size:12px;opacity:.6;letter-spacing:2px;text-align:right">工作日 11:30 达<br/>北京巡礼之年科技</div>
      </div>
    </div></body></html>`,
    out('22_应用_包装正面.png'), 600, 420);
  // 3.4 公众号头图 900x383
  await shot(`<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0;background:${BROWN}}</style></head>
    <body><div style="width:900px;height:383px;background:${BROWN};display:flex;align-items:center;justify-content:space-between;padding:0 70px;box-sizing:border-box;font-family:${LAT}">
      <div style="display:flex;align-items:center;gap:26px">${gridHtml(0.62,'reverse')}<div style="color:${CREAM};font-size:64px;font-weight:800;letter-spacing:2px">ABox</div></div>
      <div style="text-align:right;color:${CREAM}"><div style="font-family:${KAI};font-size:30px;letter-spacing:6px;opacity:.95">一饭四菜</div><div style="font-size:15px;letter-spacing:4px;opacity:.7;margin-top:10px">盲盒惊喜 · 工作日 11:30 达</div></div>
    </div></body></html>`,
    out('23_应用_公众号头图.png'), 900, 383);
  // 3.5 圆形封签/贴纸
  await shot(`<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0;background:transparent}</style></head>
    <body><div style="width:300px;height:300px;position:relative;overflow:hidden">
      <div style="position:absolute;inset:0;border-radius:50%;background:${BROWN}"></div>
      <div style="position:absolute;inset:18px;border-radius:50%;background:${CREAM}"></div>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">
        ${gridHtml(0.4,'normal')}
        <div style="font-family:${LAT};color:${BROWN};font-size:18px;font-weight:800;letter-spacing:3px">ABox 一盒</div>
      </div>
    </div></body></html>`,
    out('24_应用_圆形封签.png'), 300, 300, false, true);
  // 3.6 团长工牌
  await shot(`<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0;background:${CREAM}}</style></head>
    <body><div style="width:420px;height:260px;background:#fff;border:2px solid ${BROWN};border-radius:16px;box-sizing:border-box;padding:24px 26px;display:flex;flex-direction:column;justify-content:space-between;font-family:${LAT};color:${BROWN}">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:14px">${gridHtml(0.36,'normal')}<div style="font-size:30px;font-weight:800">ABox</div></div>
        <div style="font-family:${KAI};font-size:20px;letter-spacing:4px">团长</div>
      </div>
      <div style="height:2px;background:${BROWN};opacity:.25"></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;opacity:.72">
        <div>姓名：__________<br/>工号：__________</div>
        <div style="text-align:right">工作日 11:30 达<br/>一饭四菜 · 盲盒惊喜</div>
      </div>
    </div></body></html>`,
    out('25_应用_团长工牌.png'), 420, 260);
  // 3.7 小程序启动页
  await shot(`<!doctype html><html><head><meta charset=utf8><style>html,body{margin:0;background:${CREAM}}</style></head>
    <body><div style="width:375px;height:667px;background:${CREAM};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;font-family:${LAT};color:${BROWN}">
      ${gridHtml(0.95,'normal')}
      <div style="font-size:30px;font-weight:800;letter-spacing:3px">ABox</div>
      <div style="font-family:${KAI};font-size:15px;letter-spacing:5px;opacity:.6">一饭四菜 · 盲盒惊喜</div>
    </div></body></html>`,
    out('26_应用_启动页.png'), 375, 667);
  console.log('apps done');

  // ===== 四、品牌规范总览页 =====
  const F = {
    normal: out('01_标志_正常版.png'),
    reverse: out('02_标志_反白版.png'),
    mono: out('03_标志_单色版.png'),
    transparent: out('04_标志_透明底.png'),
    sq: out('10_图标_方形1024.png'),
    circ: out('11_图标_圆形安全区1024.png'),
    avatar: out('12_图标_微信头像预览.png'),
    tab: out('13_图标_tabBar243.png'),
    card: out('20_应用_名片.png'),
    band: out('21_应用_腰封.png'),
    box: out('22_应用_包装正面.png'),
    mp: out('23_应用_公众号头图.png'),
    seal: out('24_应用_圆形封签.png'),
    leader: out('25_应用_团长工牌.png'),
    splash: out('26_应用_启动页.png'),
  };
  const embed = (f, w) => `<img style="width:${w}px;display:block" src="${uri(f)}"/>`;

  const sheetCss = `*{box-sizing:border-box}
    body{margin:0;background:${CREAM};font-family:${LAT};color:${BROWN};padding:0}
    .pg{width:1040px;padding:48px 50px 60px;margin:0 auto}
    .top{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:3px solid ${BROWN};padding-bottom:18px;margin-bottom:34px}
    .top .nm{font-size:40px;font-weight:800;letter-spacing:1px}
    .top .sub{font-size:13px;letter-spacing:4px;opacity:.55;margin-top:6px}
    .top .ed{font-size:13px;opacity:.6;letter-spacing:2px;text-align:right}
    .sec{margin-bottom:40px}
    .sec .t{font-size:18px;font-weight:800;letter-spacing:2px;margin-bottom:16px;display:flex;align-items:center;gap:10px}
    .sec .t:before{content:'';width:14px;height:14px;background:${BROWN};border-radius:3px;display:inline-block}
    .sec .t small{font-size:12px;font-weight:400;opacity:.5;letter-spacing:1px}
    .rowflex{display:flex;gap:22px;flex-wrap:wrap}
    .card3{width:215px;background:#fff;border:1px solid rgba(110,84,53,.16);border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(110,84,53,.08)}
    .card3 .pv{display:flex;align-items:center;justify-content:center;padding:18px}
    .card3 .ft{padding:12px 16px;border-top:1px solid rgba(110,84,53,.14);font-size:12px;line-height:1.6}
    .card3 .ft b{font-size:13px}
    .sw{display:flex;gap:16px;flex-wrap:wrap}
    .chip{width:200px;border-radius:12px;overflow:hidden;border:1px solid rgba(110,84,53,.16);box-shadow:0 4px 16px rgba(110,84,53,.08)}
    .chip .c{height:84px}
    .chip .m{padding:10px 12px;background:#fff;font-size:12px;line-height:1.5}
    .chip .m b{font-size:13px}
    .type2{display:flex;gap:22px}
    .type2 .tb{flex:1;background:#fff;border:1px solid rgba(110,84,53,.16);border-radius:12px;padding:20px 22px;box-shadow:0 4px 16px rgba(110,84,53,.08)}
    .type2 .tb .lat{font-family:${LAT};font-weight:800;font-size:40px;letter-spacing:2px}
    .type2 .tb .zh{font-family:${KAI};font-size:34px;font-weight:700;letter-spacing:4px;margin-top:6px}
    .type2 .tb .d{font-size:11px;opacity:.55;margin-top:12px;letter-spacing:.5px}
    .safe{display:flex;gap:30px;align-items:center}
    .safe .box{position:relative;border:2px dashed ${BROWN};padding:18px;border-radius:10px;opacity:.85}
    .safe .note{font-size:13px;line-height:1.9;max-width:420px}
    .safe .note b{font-size:14px}
    .mis{display:flex;gap:18px;flex-wrap:wrap}
    .misf{width:240px;background:#fff;border:1px solid rgba(110,84,53,.16);border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(110,84,53,.08)}
    .misf .pv{display:flex;align-items:center;justify-content:center;padding:20px;position:relative}
    .misf .pv:after{content:'✕';position:absolute;right:10px;top:8px;color:#C0392B;font-size:20px;font-weight:800}
    .misf .ft{padding:10px 14px;border-top:1px solid rgba(110,84,53,.14);font-size:12px;line-height:1.5;color:#C0392B}
    .gallery{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
    .gcell{background:#fff;border:1px solid rgba(110,84,53,.16);border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(110,84,53,.08)}
    .gcell .pv{display:flex;align-items:center;justify-content:center;padding:14px;background:${CREAM_LT};height:150px;overflow:hidden}
    .gcell .pv img{max-width:100%!important;max-height:100%!important;width:auto!important;height:auto!important}
    .gcell .ft{padding:9px 12px;font-size:12px;border-top:1px solid rgba(110,84,53,.14)}
    .foot{margin-top:30px;border-top:1px solid rgba(110,84,53,.2);padding-top:18px;font-size:11px;opacity:.5;letter-spacing:.5px;line-height:1.7}`;

  // 配色 chips
  const chips = [
    { c: CREAM, n:'米色 CREAM', v:'#F6F0E5', d:'主底色 · 浅色背景' },
    { c: BROWN, n:'暖棕 BROWN', v:'#6E5435', d:'主色 · 文字/边框/填充' },
    { c: BROWN_DK, n:'深棕（衍生）', v:'#574226', d:'仅阴影/描边层次' },
    { c: CREAM_LT, n:'浅米（衍生）', v:'#FBF8F1', d:'仅面板层次' },
  ].map(ch => `<div class="chip"><div class="c" style="background:${ch.c}"></div><div class="m"><b>${ch.n}</b><br/>${ch.v}<br/><span style="opacity:.6">${ch.d}</span></div></div>`).join('');

  // 禁用示例（用内联网格做变形）
  const mis = [
    { html:`<div style="transform:scaleX(1.4)">${gridHtml(0.32,'normal')}</div>`, t:'禁止拉伸变形（保持等比）' },
    { html:`<div style="filter:hue-rotate(120deg) saturate(1.4)">${gridHtml(0.32,'normal')}</div>`, t:'禁止改换品牌色' },
    { html:`<div style="display:grid;grid-template-columns:repeat(2,48px);grid-template-rows:repeat(2,48px);gap:4px">${['A','B','o','X'].map(ch=>`<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;font-family:${LAT};font-weight:800;font-size:30px;border:3px solid ${BROWN};border-radius:9px;box-sizing:border-box;background:${CREAM};color:${BROWN}">${ch}</div>`).join('')}</div>`, t:'X 不得实心（X=盲盒，须为棕填实挖）' },
  ].map(m => `<div class="misf"><div class="pv">${m.html}</div><div class="ft">${m.t}</div></div>`).join('');

  const gallery = [
    { f:F.card, t:'名片' }, { f:F.band, t:'餐盒腰封' }, { f:F.box, t:'包装正面' },
    { f:F.mp, t:'公众号头图' }, { f:F.seal, t:'圆形封签' }, { f:F.leader, t:'团长工牌' },
    { f:F.splash, t:'小程序启动页' }, { f:F.tab, t:'tabBar 图标' },
  ].map(g => `<div class="gcell"><div class="pv">${embed(g.f, 220)}</div><div class="ft">${g.t}</div></div>`).join('');

  const html = `<!doctype html><html><head><meta charset=utf8><style>${sheetCss}</style></head><body>
  <div class="pg">
    <div class="top">
      <div><div class="nm">ABox 一盒</div><div class="sub">BRAND ASSET GUIDE · 08c 定稿</div></div>
      <div class="ed">北京巡礼之年科技<br/>一饭四菜 · 盲盒惊喜</div>
    </div>

    <div class="sec">
      <div class="t">一 · 核心标志 <small>CORE MARKS</small></div>
      <div class="rowflex">
        <div class="card3"><div class="pv">${embed(F.normal,170)}</div><div class="ft"><b>正常版</b><br/>浅色背景通用。A/B/o 带框不填充实心棕字；x 棕填实挖（盲盒）。</div></div>
        <div class="card3"><div class="pv" style="background:${BROWN}">${embed(F.reverse,170)}</div><div class="ft"><b>反白版</b><br/>深棕底色（腰封/深色物料）。深底实心奶字，x 反为米色实格。</div></div>
        <div class="card3"><div class="pv">${embed(F.mono,170)}</div><div class="ft"><b>单色版</b><br/>白纸棕墨，印刷/盖章/传真。保持框线与挖空关系。</div></div>
        <div class="card3"><div class="pv" style="background:${CREAM_LT}">${embed(F.transparent,170)}</div><div class="ft"><b>透明底</b><br/>叠加场景用（PNG·透明）。棕保留、米底透明。</div></div>
      </div>
    </div>

    <div class="sec">
      <div class="t">二 · 配色 <small>PALETTE</small></div>
      <div class="sw">${chips}</div>
    </div>

    <div class="sec">
      <div class="t">三 · 字体 <small>TYPOGRAPHY</small></div>
      <div class="type2">
        <div class="tb"><div class="lat">ABox</div><div class="d">拉丁字标 · Helvetica / Arial 800（粗黑无衬线）</div></div>
        <div class="tb"><div class="zh">一盒</div><div class="d">中文注脚 · 楷体（KaiTi / 楷体 / STKaiti）</div></div>
      </div>
    </div>

    <div class="sec">
      <div class="t">四 · 安全边距与最小尺寸 <small>CLEAR SPACE</small></div>
      <div class="safe">
        <div class="box">${embed(F.normal,200)}</div>
        <div class="note"><b>安全边距：</b>标志四周保留 ≥ 1 格高度（约标志宽 1/4）的空白，不与其它元素贴边。<br/><b>最小尺寸：</b>网格宽度 ≥ 56px（再小 X 挖空会糊）；圆形头像请用「圆形安全区」版。<br/><b>禁止：</b>拉伸、改色、旋转单格、替 X 为实心。</div>
      </div>
    </div>

    <div class="sec">
      <div class="t">五 · 小程序图标 <small>APP ICON</small></div>
      <div class="rowflex">
        <div class="card3"><div class="pv">${embed(F.sq,170)}</div><div class="ft"><b>方形 1024</b><br/>应用商店方标 / 非圆形场景。</div></div>
        <div class="card3"><div class="pv" style="background:${CREAM_LT}">${embed(F.circ,170)}</div><div class="ft"><b>圆形安全区 1024</b><br/>微信头像用：整体缩进，裁圆后完整。</div></div>
        <div class="card3"><div class="pv" style="background:${CREAM_LT}">${embed(F.avatar,170)}</div><div class="ft"><b>头像裁切预览</b><br/>满格方标被圆形裁切，四角会丢——故另出安全区版。</div></div>
        <div class="card3"><div class="pv" style="background:${CREAM_LT}">${embed(F.tab,128)}</div><div class="ft"><b>tabBar 243</b><br/>小程序底栏图标（透明底）。</div></div>
      </div>
    </div>

    <div class="sec">
      <div class="t">六 · 应用预览 <small>APPLICATIONS</small></div>
      <div class="gallery">${gallery}</div>
    </div>

    <div class="sec">
      <div class="t">七 · 禁用示例 <small>MISUSE</small></div>
      <div class="mis">${mis}</div>
    </div>

    <div class="foot">本规范基于 08c 定稿（用户选③奶色实填 X=盲盒）。所有物料由扁平矢量生成，可无损放大。交付文件见同目录：01–04 标志 / 10–13 图标 / 20–26 应用。修改须保持「A/B/o 带框不填充实心、x 棕填实挖」的铁律。</div>
  </div></body></html>`;

  await shot(html, out('00_品牌规范总览.png'), 1040, 1500, true);
  console.log('sheet done');
  console.log('ALL DONE');
})();
