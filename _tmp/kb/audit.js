/* ══════════════════════════════════════════════════════════════════════
   四期「反哺」· 文档体检页
   数据 = audit.py 的确定性产物（纯本地计算，不联网、不用模型）
   独立源件：由 build2.py 读入后原样拼进产物 —— 不存在第二份真源
   ══════════════════════════════════════════════════════════════════════ */
let ADATA = null;
let AFILT = '全部';

function aEsc(s){ return esc(String(s == null ? '' : s)); }

/* 出处原文是从 .md 里截的，带 Markdown 标记与表格竖线 —— 轻清一下，别让用户读一屏 `**`。
   ⚠️ 只做「去掉标记」，**不动字**：删掉任何一个字都可能让出处与原文对不上。 */
function aTidy(s){
  return aEsc(s)
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/(?:｜\s*){2,}/g, '｜ ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function aCounts(){
  const c = ADATA.meta.counts;
  return c;
}

/* ── 顶部：一句话结论 + 五个检测器小结 ── */
function renderHero(){
  const c = aCounts(), m = ADATA.meta;
  const chips = [
    ['口径', '严格 ' + c.anchorsStrict + ' 项', c.anchorsBad ? (c.anchorsBad + ' 项不符') : '全部一致',
     !!c.anchorsBad],
    ['覆盖', (ADATA.terms.length) + ' 个术语', '0 命中 ' + c.termsZero + ' · 稀薄 ' + c.termsLow,
     (c.termsZero + c.termsLow) > 0],
    ['引用', '断引 ' + c.brokenDocs, '未定义卡号 ' + c.undefCodes, (c.brokenDocs + c.undefCodes) > 0],
    ['时效', '多版本 ' + c.versionFams + ' 组', '检索可能召回旧版', c.versionFams > 0],
    ['自述', '回验 ' + ADATA.claims.length + ' 条', c.claimsBad ? (c.claimsBad + ' 条不符') : '全部对得上',
     !!c.claimsBad],
  ];
  return '<div class="apanel">'
    + '<div class="ahero">文档体检 <b>' + c.tickets + '</b> 项 · '
    + '<span class="awarn">P1 ' + c.p1 + '</span> · P2 ' + c.p2 + ' · P3 ' + c.p3 + '</div>'
    + '<div class="asum">' + chips.map(x =>
        '<div class="achip' + (x[3] ? ' hot' : '') + '">' + aEsc(x[0]) + ' <b>' + aEsc(x[1]) + '</b>'
        + '<br>' + aEsc(x[2]) + '</div>').join('') + '</div>'
    + '<div class="anote">语料 <b>' + m.docs + '</b> 份 · ' + m.chars.toLocaleString() + ' 字符 · '
    + m.segs.toLocaleString() + ' 段 · 体检时点 ' + aEsc(m.builtAt)
    + '<br>全部结论由 <b>确定性计算</b> 得出（不联网、不用模型），每条都能点开看原文出处。'
    + '本页与「检索 / 问答 / 问数」共用同一份语料 —— 体检发现、检索定位、问答解释，是同一条链。'
    + '</div></div>';
}

/* ── 修订工单（主体） ── */
function renderTickets(){
  const areas = ['全部'].concat([...new Set(ADATA.tickets.map(t => t.area))]);
  const head = '<div class="asec">修订工单 <small>点任意一条展开原文出处；按 P1 → P3 排序</small></div>'
    + '<div class="afilt">' + areas.map(a =>
        '<span class="' + (a === AFILT ? 'on' : '') + '" data-a="' + aEsc(a) + '">' + aEsc(a)
        + (a === '全部' ? '（' + ADATA.tickets.length + '）'
           : '（' + ADATA.tickets.filter(t => t.area === a).length + '）') + '</span>').join('') + '</div>';
  const rows = ADATA.tickets.filter(t => AFILT === '全部' || t.area === AFILT).map(t =>
    '<div class="aitem ' + t.sev.toLowerCase() + '">'
    + '<div class="aihead"><span class="sev">' + aEsc(t.sev) + '</span>'
    + '<span class="ar">' + aEsc(t.area) + '</span>'
    + '<span class="tt">' + aEsc(t.title) + '</span>'
    + '<span class="wh">' + aEsc(t.where) + '</span></div>'
    + '<div class="aidet">' + aTidy(t.detail) + '</div></div>').join('');
  return head + rows;
}

/* ── D1 口径总览 ── */
function renderAnchors(){
  const flag = { ok: '<span class="aok">✅ 一致</span>',
                 mid: '<span class="awarn">🟡 不符（仅非真源文档）</span>',
                 high: '<span class="awarn">🔴 不符（真源文档内）</span>',
                 history: '<span class="awarn">📜 谱系（不判对错）</span>' };
  const cards = ADATA.anchors.map(a => {
    const rows = a.values.map(v =>
      '<tr class="' + (v.expected ? '' : 'bad') + '"><td class="v">' + aEsc(v.v)
      + (v.expected ? '' : ' ⚠️') + '</td><td>' + v.n + ' 次 · ' + (v.docs || 0) + ' 份</td></tr>').join('');
    const stale = a.staleOnly && a.staleOnly.length
      ? '<div class="astale">整篇只用旧值的文档：'
        + a.staleOnly.map(x => '<b>' + aEsc(x.doc.replace(/\.(md|html)$/, '')) + '</b>（' + aEsc(x.vals.join('/')) + '）').join('、')
        + '</div>' : '';
    return '<div class="acard"><h4>' + aEsc(a.name) + ' ' + flag[a.verdict] + '</h4>'
      + '<div class="aw">真源 <b>' + aEsc(a.expect.join('/')) + '</b> · ' + aEsc(a.why)
      + (a.mode === 'history' ? ' · <i>谱系模式</i>' : '') + '</div>'
      + '<table class="atbl">' + rows + '</table>' + stale + '</div>';
  }).join('');
  return '<div class="asec">D1 · 口径总览 <small>每个锚点带真源期望值；不符才报，避免恒红</small></div>'
    + '<div class="agrid">' + cards + '</div>';
}

/* ── D2 术语覆盖 ── */
function renderTerms(){
  const byDom = {};
  ADATA.terms.forEach(t => (byDom[t.domain] = byDom[t.domain] || []).push(t));
  const order = Object.keys(byDom).sort((x, y) =>
    Math.min(...byDom[x].map(t => t.segs)) - Math.min(...byDom[y].map(t => t.segs)));
  const blocks = order.map(d => {
    const list = byDom[d].slice().sort((x, y) => x.segs - y.segs);
    return '<div class="aterms"><h4>' + aEsc(d) + '</h4><div class="atags">'
      + list.map(t => '<span class="atag ' + t.level + '" title="' + aEsc(t.docNames.join(' / ')) + '">'
          + aEsc(t.term) + '<i>' + t.segs + ' 段</i></span>').join('')
      + '</div></div>';
  }).join('');
  return '<div class="asec">D2 · 术语覆盖 <small>数字 = 命中段数；≤3 段标黄、0 段标红。'
    + '悬停看命中的文档</small></div>' + blocks;
}

/* ── D3 引用完整性 + D4 自述 + D5 多版本 ── */
function renderRest(){
  let h = '<div class="asec">D3 · 引用完整性 <small>断引 = 引用的文档名在语料里找不到</small></div>';
  const bd = ADATA.refs.brokenDocs, uc = ADATA.refs.undefCodes;
  h += '<div class="agrid">';
  if (!bd.length && !uc.length) h += '<div class="acard"><h4>✅ 无断引、无未定义卡号</h4></div>';
  bd.forEach(b => h += '<div class="acard"><h4>断引 · ' + aEsc(b.ref) + '</h4>'
    + '<div class="aw">被引用 ' + b.n + ' 次</div>'
    + '<table class="atbl">' + b.where.map(w => '<tr><td>' + aEsc(w.doc.replace(/\.(md|html)$/, ''))
      + ':' + w.line + '</td></tr>').join('') + '</table>'
    + '<div class="aw" style="margin-top:6px">' + aTidy(b.where[0].ctx) + '</div></div>');
  uc.forEach(u => h += '<div class="acard"><h4>未定义卡号 · ' + aEsc(u.code) + '</h4>'
    + '<div class="aw">被引用 ' + u.n + ' 次，但《指引》（定义真源，' + u.nDef + ' 个卡号）里没有</div>'
    + '<table class="atbl">' + u.where.map(w => '<tr><td>' + aEsc(w.doc.replace(/\.(md|html)$/, ''))
      + ':' + w.line + '</td></tr>').join('') + '</table>'
    + '<div class="aw" style="margin-top:6px">' + aTidy(u.where[0].ctx) + '</div></div>');
  h += '</div>';

  h += '<div class="asec">D4 · 自述统计回验 <small>文档自己写「X …… N 次」，回语料实算</small></div>';
  h += '<div class="agrid">';
  ADATA.claims.forEach(c => h += '<div class="acard"><h4>' + (c.ok ? '✅ ' : '⚠️ ')
    + aEsc(c.term) + '</h4><div class="aw">' + aEsc(c.file) + ' 自称 ' + c.said + ' 次 · 实测 <b>'
    + c.actual + '</b> 次</div></div>');
  (ADATA.claimFixed || []).forEach(f => h += '<div class="acard" style="border-color:#E2BFBF">'
    + '<h4>🏆 战果留证（已修）</h4><div class="aw">' + aEsc(f.what) + '<br>原文：' + aEsc(f.said)
    + '<br>实测：' + aEsc(f.actual) + '</div><div class="aw">' + aEsc(f.spread) + '</div></div>');
  h += '</div>';

  h += '<div class="asec">D5 · 多版本共存 <small>同名不同版本同时在语料里 ⇒ 检索可能召回旧版</small></div>';
  h += '<div class="agrid">' + ADATA.versions.map(v => '<div class="acard"><h4>' + aEsc(v.base) + '</h4>'
    + '<div class="aw">' + v.docs.map(d => aEsc(d)).join('<br>') + '</div></div>').join('') + '</div>';

  h += '<div class="asec">判据说明 <small>这一页凭什么可信</small></div>'
    + '<div class="apanel"><div class="anote" style="border-top:none;padding-top:0">'
    + '<b>① 每条都能回原文</b>：工单里的出处是 <code>文档:行</code>，回到「检索」搜同一句即可定位。<br>'
    + '<b>② 锚点带真源期望值</b>：裸扫数值在中文技术文档里必然恒红（「见习→正式 23%」是进度、'
    + '「金牌 11%」是测试故意值）—— 恒红与恒绿同罪，都等于没有检查。<br>'
    + '<b>③ 谱系锚点不假装能判</b>：像「实体表数」在文档里合法存在历史叙述（阶段目标「24 张表建齐」、'
    + '冻结快照「26 张表」），检测器无法机械区分「合法历史叙述」与「未更新残留」⇒ 只摊谱系，判由人做。<br>'
    + '<b>④ 双向自证</b>：跑 <code>audit.py selftest</code> —— 基线必须<u>必不报</u>，'
    + '人为改坏期望值 / 注入假断引 / 喂回错断言时<u>必须报</u>。<br>'
    + '<b>⑤ 阈值是约定不是真理</b>：术语「≤3 段 = 缺口候选」是人定的；改 <code>audit.py</code> 里的 '
    + '<code>GAP_LOW</code> 即可。<br>'
    + '</div></div>';
  return h;
}

function renderAudit(){
  const el = document.getElementById('view-audit');
  if (!el) return;
  el.innerHTML = renderHero() + renderTickets() + renderAnchors() + renderTerms() + renderRest();
  el.querySelectorAll('.aitem').forEach(x => x.onclick = () => x.classList.toggle('open'));
  el.querySelectorAll('.afilt span').forEach(x => x.onclick = () => {
    AFILT = x.dataset.a;
    renderAudit();
  });
}

/* ── 给问答用的「文档体检」段（插进系统提示，随问题一起送模型） ── */
function auditPrompt(){
  const c = aCounts(), m = ADATA.meta;
  const L = [];
  L.push('【文档体检】（四期反哺 · 确定性计算 · 体检时点 ' + m.builtAt + ' · 语料 ' + m.docs + ' 份）');
  L.push('汇总：体检 ' + c.tickets + ' 项 = P1 ' + c.p1 + ' / P2 ' + c.p2 + ' / P3 ' + c.p3 + '。');
  L.push('· 口径：严格锚点 ' + c.anchorsStrict + ' 项，不符 ' + c.anchorsBad + '；谱系锚点 '
    + c.anchorsHistory + ' 项（实体表数 23–27，含历史叙述，不判对错）');
  const z = ADATA.terms.filter(t => t.level === 'zero').map(t => t.term);
  const lw = ADATA.terms.filter(t => t.level === 'low').map(t => t.term + '(' + t.segs + '段)');
  L.push('· 覆盖：' + ADATA.terms.length + ' 个核心环节词 —— 0 命中：' + (z.join('、') || '无')
    + '；稀薄：' + (lw.join('、') || '无'));
  L.push('· 引用：断引 ' + c.brokenDocs + '（' + ADATA.refs.brokenDocs.map(b => '《' + b.ref + '》').join('')
    + '）；未定义卡号 ' + c.undefCodes + '（' + ADATA.refs.undefCodes.map(u => u.code).join('') + '）');
  L.push('· 时效：多版本共存 ' + c.versionFams + ' 组（' + ADATA.versions.map(v => v.base).join('；') + '）');
  L.push('工单明细（回答时原样引用，不许自己推断、不许补造条目）：');
  ADATA.tickets.forEach(t => L.push('  [' + t.sev + '·' + t.area + '] ' + t.title + '  @ ' + t.where));
  L.push('规则：被问到「文档有哪些缺口 / 不一致 / 过时 / 该改什么」时，依据本段作答，'
    + '数字与结论原样引用并标注 P 级与出处；本段没覆盖的，直接说「体检项里没有」，不要另行推断。');
  return L.join('\n');
}

async function bootAudit(){
  try{
    const el = document.getElementById('audit');
    if (!el) return;
    const b64 = el.textContent.replace(/\s+/g, '');
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const txt = await new Response(
      new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))
    ).text();
    ADATA = JSON.parse(txt);
    renderAudit();
    SYS_PROMPT += '\n\n' + auditPrompt();
    SUGGESTIONS.push('文档里有哪些不一致或缺口？');
    /* ⚠️ bootCalc 也在往 SUGGESTIONS 里加项、并在自己那边重绘 #sug —— 它解压的是 1.25MB，
       比本页（12KB）慢，会在稍后**覆盖**这里的重绘。所以等它落地（DATA 就绪）后再补一次。
       实测症状：加了建议却不显示，而 SUGGESTIONS 数组里明明有。 */
    const drawSug = () => {
      const el = document.getElementById('sug');
      if (el) el.innerHTML = SUGGESTIONS.map(s => '<span>' + esc(s) + '</span>').join('');
    };
    drawSug();
    const afterCalc = () => {
      if (typeof DATA !== 'undefined' && DATA) drawSug();
      else setTimeout(afterCalc, 120);
    };
    setTimeout(afterCalc, 120);
  } catch (e){
    const el2 = document.getElementById('view-audit');
    if (el2) el2.innerHTML = '<div class="apanel">体检结果载入失败：' + aEsc(e.message)
      + '（检索 / 问答 / 问数 不受影响）</div>';
  }
}

AUDIT = { data: () => ADATA, prompt: auditPrompt };
bootAudit();
