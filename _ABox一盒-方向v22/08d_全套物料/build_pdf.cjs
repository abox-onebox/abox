const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CREAM = '#F6F0E5';
const BROWN = '#6E5435';
const BROWN_DK = '#574226';
const CREAM_LT = '#FBF8F1';
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
  return s.join(';');
}
function cellsOf(mode) {
  if (mode === 'reverse') return {
    A:{border:CREAM,bg:BROWN,letter:'solid-cream'},B:{border:CREAM,bg:BROWN,letter:'solid-cream'},
    o:{border:CREAM,bg:BROWN,letter:'solid-cream'},x:{border:CREAM,bg:CREAM,letter:'solid-brown'} };
  if (mode === 'mono') return {
    A:{border:BROWN,bg:'#FFFFFF',letter:'solid-brown'},B:{border:BROWN,bg:'#FFFFFF',letter:'solid-brown'},
    o:{border:BROWN,bg:'#FFFFFF',letter:'solid-brown'},x:{border:BROWN,bg:BROWN,letter:'solid-cream'} };
  return {
    A:{border:BROWN,bg:CREAM,letter:'solid-brown'},B:{border:BROWN,bg:CREAM,letter:'solid-brown'},
    o:{border:BROWN,bg:CREAM,letter:'solid-brown'},x:{border:BROWN,bg:BROWN,letter:'solid-cream'} };
}
function gridHtml(k, mode) {
  const c = cellsOf(mode);
  const cell = (ch, cc) => `<div style="${cellStyle(k, cc)}">${ch}</div>`;
  const px = v => (v * k) + 'px';
  return `<div style="display:grid;grid-template-columns:repeat(2,${px(150)});grid-template-rows:repeat(2,${px(150)});gap:${px(12)}">${cell('A',c.A)}${cell('B',c.B)}${cell('o',c.o)}${cell('x',c.x)}</div>`;
}
const uri = f => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;

(async () => {
  const D = __dirname;
  const F = {
    normal: path.join(D,'01_标志_正常版.png'), reverse: path.join(D,'02_标志_反白版.png'),
    mono: path.join(D,'03_标志_单色版.png'), transparent: path.join(D,'04_标志_透明底.png'),
    sq: path.join(D,'10_图标_方形1024.png'), circ: path.join(D,'11_图标_圆形安全区1024.png'),
    avatar: path.join(D,'12_图标_微信头像预览.png'), tab: path.join(D,'13_图标_tabBar243.png'),
    card: path.join(D,'20_应用_名片.png'), band: path.join(D,'21_应用_腰封.png'),
    box: path.join(D,'22_应用_包装正面.png'), mp: path.join(D,'23_应用_公众号头图.png'),
    seal: path.join(D,'24_应用_圆形封签.png'), leader: path.join(D,'25_应用_团长工牌.png'),
    splash: path.join(D,'26_应用_启动页.png'),
  };
  const img = (f, w, cls='') => `<img class="${cls}" style="width:${w}px;display:block" src="${uri(f)}"/>`;

  const css = `*{box-sizing:border-box;margin:0;padding:0}
    @page{size:A4;margin:0}
    html,body{background:${CREAM};font-family:${LAT};color:${BROWN};-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{width:794px;height:1123px;padding:56px 58px 46px;position:relative;overflow:hidden;background:${CREAM};page-break-after:always;display:flex;flex-direction:column}
    .page:last-child{page-break-after:auto}
    .hd{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:3px solid ${BROWN};padding-bottom:14px;margin-bottom:26px;flex:0 0 auto}
    .hd .t{font-size:24px;font-weight:800;letter-spacing:1px}
    .hd .t small{font-size:11px;font-weight:400;letter-spacing:2px;opacity:.5;margin-left:10px}
    .hd .n{font-size:11px;opacity:.5;letter-spacing:2px}
    .ft{flex:0 0 auto;margin-top:auto;border-top:1px solid rgba(110,84,53,.2);padding-top:12px;display:flex;justify-content:space-between;font-size:10px;opacity:.45;letter-spacing:.5px}
    .body{flex:1 1 auto}
    .g2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
    .g4{display:grid;grid-template-columns:1fr 1fr;gap:18px}
    .c3{background:#fff;border:1px solid rgba(110,84,53,.16);border-radius:12px;overflow:hidden;box-shadow:0 3px 12px rgba(110,84,53,.07)}
    .c3 .pv{display:flex;align-items:center;justify-content:center;padding:16px;height:170px}
    .c3 .ftx{padding:10px 14px;border-top:1px solid rgba(110,84,53,.14);font-size:11px;line-height:1.6}
    .c3 .ftx b{font-size:12px}
    .chip{display:flex;align-items:center;gap:14px;background:#fff;border:1px solid rgba(110,84,53,.16);border-radius:12px;padding:14px 16px;box-shadow:0 3px 12px rgba(110,84,53,.07)}
    .chip .dot{width:52px;height:52px;border-radius:10px;flex:0 0 auto}
    .chip .in{font-size:11px;line-height:1.6}
    .chip .in b{font-size:13px}
    .gb{display:grid;grid-template-columns:1fr 1fr;gap:18px}
    .gcell{background:#fff;border:1px solid rgba(110,84,53,.16);border-radius:12px;overflow:hidden;box-shadow:0 3px 12px rgba(110,84,53,.07)}
    .gcell .pv{height:150px;display:flex;align-items:center;justify-content:center;padding:12px;background:${CREAM_LT};overflow:hidden}
    .gcell .pv img{max-width:100%!important;max-height:100%!important;width:auto!important;height:auto!important}
    .gcell .cap{padding:8px 12px;font-size:11px;border-top:1px solid rgba(110,84,53,.14)}
    .note{font-size:11.5px;line-height:1.9}
    .note b{font-size:12.5px}
    .dash{border:2px dashed ${BROWN};padding:14px;border-radius:10px;display:inline-block}
    .mis{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .misf{background:#fff;border:1px solid rgba(110,84,53,.16);border-radius:10px;overflow:hidden}
    .misf .pv{height:110px;display:flex;align-items:center;justify-content:center;position:relative;padding:8px}
    .misf .pv:after{content:'✕';position:absolute;right:8px;top:4px;color:#C0392B;font-size:16px;font-weight:800}
    .misf .t{padding:8px 10px;border-top:1px solid rgba(110,84,53,.14);font-size:10.5px;line-height:1.45;color:#C0392B}`;

  // 封面
  const cover = `<div class="page" style="justify-content:center;align-items:center">
      <div style="display:flex;flex-direction:column;align-items:center;gap:30px">
        ${gridHtml(1.02,'normal')}
        <div style="font-size:60px;font-weight:800;letter-spacing:2px">ABox</div>
        <div style="font-family:${KAI};font-size:34px;font-weight:700;letter-spacing:12px;color:${BROWN}">一 盒</div>
      </div>
      <div style="position:absolute;left:58px;right:58px;bottom:48px;border-top:2px solid ${BROWN};padding-top:16px;display:flex;justify-content:space-between;font-size:11px;letter-spacing:2px">
        <div>品牌物料手册 · BRAND ASSET GUIDE</div><div style="text-align:right">北京巡礼之年科技<br/>一饭四菜 · 盲盒惊喜</div>
      </div>
    </div>`;

  // P2 核心标志
  const p2 = `<div class="page">
    <div class="hd"><div class="t">一 · 核心标志<small>CORE MARKS</small></div><div class="n">01 / 06</div></div>
    <div class="body"><div class="g2">
      <div class="c3"><div class="pv">${img(F.normal,240)}</div><div class="ftx"><b>正常版</b><br/>浅色背景通用。A/B/o 带框不填充实心棕字；x 棕填实挖（=盲盒）。</div></div>
      <div class="c3"><div class="pv" style="background:${BROWN}">${img(F.reverse,240)}</div><div class="ftx"><b>反白版</b><br/>深棕底色（腰封/深色物料）。深底实心奶字，x 反为米色实格。</div></div>
      <div class="c3"><div class="pv">${img(F.mono,240)}</div><div class="ftx"><b>单色版</b><br/>白纸棕墨，印刷/盖章/传真。保持框线与挖空关系。</div></div>
      <div class="c3"><div class="pv" style="background:${CREAM_LT}">${img(F.transparent,240)}</div><div class="ftx"><b>透明底（PNG）</b><br/>叠加场景用：棕保留、米底透明。</div></div>
    </div>
    <div class="note" style="margin-top:22px;background:${CREAM_LT};border-left:4px solid ${BROWN};padding:16px 18px;border-radius:8px">
      <b>结构铁律：</b>四个等大方块拼成 2×2 网格，读作「ABox」。<b>A / B / o</b> 为米底棕框、不填充、实心棕字；<b>x</b> 为棕填充框 + 奶色实挖，唯一有色块＝项目中的「盲盒」，天然被点出，不需额外说明。
    </div></div>
    <div class="ft"><div>ABox 一盒 · 品牌物料手册</div><div>01 核心标志</div></div>
  </div>`;

  // P3 配色与字体
  const p3 = `<div class="page">
    <div class="hd"><div class="t">二 · 配色与字体<small>PALETTE &amp; TYPOGRAPHY</small></div><div class="n">02 / 06</div></div>
    <div class="body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="chip"><div class="dot" style="background:${CREAM};border:1px solid rgba(110,84,53,.2)"></div><div class="in"><b>米色 CREAM</b><br/>#F6F0E5<br/><span style="opacity:.6">主底色 · 浅色背景</span></div></div>
        <div class="chip"><div class="dot" style="background:${BROWN}"></div><div class="in"><b>暖棕 BROWN</b><br/>#6E5435<br/><span style="opacity:.6">主色 · 文字/边框/填充</span></div></div>
        <div class="chip"><div class="dot" style="background:${BROWN_DK}"></div><div class="in"><b>深棕（衍生）</b><br/>#574226<br/><span style="opacity:.6">仅阴影/描边层次</span></div></div>
        <div class="chip"><div class="dot" style="background:${CREAM_LT};border:1px solid rgba(110,84,53,.2)"></div><div class="in"><b>浅米（衍生）</b><br/>#FBF8F1<br/><span style="opacity:.6">仅面板层次</span></div></div>
      </div>
      <div style="height:1px;background:rgba(110,84,53,.18);margin:28px 0"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
        <div class="c3" style="padding:22px 24px"><div style="font-size:46px;font-weight:800;letter-spacing:2px">ABox</div><div style="font-size:11px;opacity:.55;margin-top:12px">拉丁字标 · Helvetica / Arial 800（粗黑无衬线）</div></div>
        <div class="c3" style="padding:22px 24px"><div style="font-family:${KAI};font-size:40px;font-weight:700;letter-spacing:6px">一盒</div><div style="font-size:11px;opacity:.55;margin-top:12px">中文注脚 · 楷体（KaiTi / 楷体 / STKaiti）</div></div>
      </div>
    </div>
    <div class="ft"><div>ABox 一盒 · 品牌物料手册</div><div>02 配色与字体</div></div>
  </div>`;

  // P4 安全边距 + 禁用
  const p4 = `<div class="page">
    <div class="hd"><div class="t">三 · 使用规范<small>CLEAR SPACE &amp; MISUSE</small></div><div class="n">03 / 06</div></div>
    <div class="body">
      <div style="display:flex;gap:26px;align-items:center">
        <div class="dash">${img(F.normal,180)}</div>
        <div class="note"><b>安全边距：</b>标志四周保留 ≥ 1 格高度（约标志宽 1/4）的空白，不与其它元素贴边。<br/><b>最小尺寸：</b>网格宽度 ≥ 56px（再小 X 挖空会糊）；圆形头像请用「圆形安全区」版。<br/><b>禁止：</b>拉伸、改色、旋转单格、把 X 改为实心。</div>
      </div>
      <div style="height:1px;background:rgba(110,84,53,.18);margin:26px 0"></div>
      <div class="mis">
        <div class="misf"><div class="pv"><div style="transform:scaleX(1.4)">${gridHtml(0.3,'normal')}</div></div><div class="t">禁止拉伸变形</div></div>
        <div class="misf"><div class="pv"><div style="filter:hue-rotate(120deg) saturate(1.4)">${gridHtml(0.3,'normal')}</div></div><div class="t">禁止改换品牌色</div></div>
        <div class="misf"><div class="pv"><div style="display:grid;grid-template-columns:repeat(2,42px);grid-template-rows:repeat(2,42px);gap:4px">${['A','B','o','X'].map(ch=>`<div style="width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-family:${LAT};font-weight:800;font-size:26px;border:3px solid ${BROWN};border-radius:8px;box-sizing:border-box;background:${CREAM};color:${BROWN}">${ch}</div>`).join('')}</div></div><div class="t">X 不得实心（须棕填实挖）</div></div>
      </div>
    </div>
    <div class="ft"><div>ABox 一盒 · 品牌物料手册</div><div>03 使用规范</div></div>
  </div>`;

  // P5 小程序图标
  const p5 = `<div class="page">
    <div class="hd"><div class="t">四 · 小程序图标<small>APP ICON</small></div><div class="n">04 / 06</div></div>
    <div class="body"><div class="g2">
      <div class="c3"><div class="pv">${img(F.sq,190)}</div><div class="ftx"><b>方形 1024</b><br/>应用商店方标 / 非圆形场景。</div></div>
      <div class="c3"><div class="pv" style="background:${CREAM_LT}">${img(F.circ,190)}</div><div class="ftx"><b>圆形安全区 1024</b><br/>微信头像用：整体缩进，裁圆后四格完整。</div></div>
      <div class="c3"><div class="pv" style="background:${CREAM_LT}">${img(F.avatar,190)}</div><div class="ftx"><b>头像裁切预览</b><br/>满格方标被裁圆会丢四角——故另出安全区版。</div></div>
      <div class="c3"><div class="pv" style="background:${CREAM_LT}">${img(F.tab,120)}</div><div class="ftx"><b>tabBar 243</b><br/>小程序底栏图标（透明底）。</div></div>
    </div>
    <div class="note" style="margin-top:20px;background:${CREAM_LT};border-left:4px solid ${BROWN};padding:14px 18px;border-radius:8px"><b>推荐：</b>微信头像统一用「圆形安全区 1024」；方形 1024 只用于应用商店等非圆形位。tabBar 用小尺寸时，「一=盒盖」的细节会自然合并，属正常极限。</div></div>
    <div class="ft"><div>ABox 一盒 · 品牌物料手册</div><div>04 小程序图标</div></div>
  </div>`;

  // P6 应用预览
  const apps = [
    [F.card,'名片'],[F.band,'餐盒腰封'],[F.box,'包装正面'],[F.mp,'公众号头图'],
    [F.seal,'圆形封签'],[F.leader,'团长工牌'],[F.splash,'小程序启动页'],[F.tab,'tabBar 图标'],
  ];
  const p6 = `<div class="page">
    <div class="hd"><div class="t">五 · 应用预览<small>APPLICATIONS</small></div><div class="n">05 / 06</div></div>
    <div class="body"><div class="gb">${apps.map(([f,t])=>`<div class="gcell"><div class="pv">${img(f,300)}</div><div class="cap">${t}</div></div>`).join('')}</div></div>
    <div class="ft"><div>ABox 一盒 · 品牌物料手册</div><div>05 应用预览</div></div>
  </div>`;

  // P7 交付清单
  const p7 = `<div class="page">
    <div class="hd"><div class="t">六 · 交付清单<small>DELIVERABLES</small></div><div class="n">06 / 06</div></div>
    <div class="body">
      <div class="note" style="line-height:2.1">
        <b>核心标志</b>　01 正常版 / 02 反白版 / 03 单色版 / 04 透明底（480px，1x）<br/>
        <b>小程序图标</b>　10 方形 1024 / 11 圆形安全区 1024 / 12 头像裁切预览 / 13 tabBar 243<br/>
        <b>应用物料</b>　20 名片 / 21 腰封 / 22 包装正面 / 23 公众号头图 / 24 圆形封签 / 25 团长工牌 / 26 启动页<br/>
        <b>规范</b>　00 品牌规范总览（单页） · 本 PDF（六页 A4，可印刷）
      </div>
      <div style="height:1px;background:rgba(110,84,53,.18);margin:24px 0"></div>
      <div class="note">
        <b>色彩：</b>米色 #F6F0E5 · 暖棕 #6E5435（衍生 深棕 #574226 / 浅米 #FBF8F1，仅层次用）<br/>
        <b>字体：</b>拉丁 Helvetica/Arial 800 · 中文 楷体<br/>
        <b>调性：</b>安静的传统高级，不炸眼；靠网格与「X=盲盒」的记忆点取胜。
      </div>
      <div style="margin-top:40px;display:flex;align-items:center;gap:20px">
        ${gridHtml(0.5,'normal')}
        <div><div style="font-size:34px;font-weight:800">ABox</div><div style="font-family:${KAI};font-size:15px;letter-spacing:6px;opacity:.65;margin-top:4px">一饭四菜 · 盲盒惊喜</div></div>
      </div>
    </div>
    <div class="ft"><div>ABox 一盒 · 品牌物料手册</div><div>06 交付清单</div></div>
  </div>`;

  const html = `<!doctype html><html><head><meta charset=utf8><style>${css}</style></head><body>
    ${cover}${p2}${p3}${p4}${p5}${p6}${p7}
  </body></html>`;

  fs.writeFileSync(path.join(D, '_book.html'), html);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({ path: path.join(D, 'ABox_品牌物料手册.pdf'), format: 'A4', printBackground: true, margin: { top:0,right:0,bottom:0,left:0 } });
  await browser.close();
  console.log('PDF DONE');
})();
