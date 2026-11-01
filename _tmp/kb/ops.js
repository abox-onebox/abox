/* ══════════════════════════════════════════════════════════════════════════════
   五期「操作草稿」 —— 自然语言 → 操作块 → 确定性校验 → 草稿预览（阶段 1：不执行）

   模式与「问数」一致：**语言模型只负责把人话翻成结构化操作块，绝不参与参数校验与
   路径拼接**；本引擎根据 op 代码**内部**映射出精确端点 / 方法 / 风险档，并做必填校验、
   雷点提示。端点绝不从 LLM 来 —— 防止「写错 /admin 一个字母就静默变用户端可访问」的红线。

   ⚠️ 阶段 1（本期交付）：只生成草稿、渲染预览，**确认执行按钮禁用**。真正的执行、CORS
   放行、受限 token、身份层，是阶段 2/3 的事（见《CORS 放行 + 身份层设计》）。
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── 操作目录（确定性真源；LLM 只填 op 代码，端点/方法/风险由这里给出） ── */
const OPS_CATALOG = {
  create_dish:        {label:'上架新菜品（新增商品）', method:'POST', endpoint:'/admin/dishes',
    risk:'admin', required:['supplierId','name','category','costPriceFen'],
    optional:['description','imageUrl','status'],
    notes:'供价 costPriceFen 为整数分（¥12.80 → 1280）。换供应商须新建商品，编辑不含 supplierId。',
    riskNote:'admin 专属高危：直接改供应商应付与平台毛利。'},
  batch_dish_status:  {label:'批量上下架菜品', method:'POST', endpoint:'/admin/dishes/batch-status',
    risk:'admin', required:['ids','status'], optional:['reason'],
    notes:'下架须填 reason；任一 id 不存在整体拒绝（404），不做部分成功。',
    riskNote:'admin 专属。'},
  edit_dish:          {label:'编辑菜品', method:'PUT', endpoint:'/admin/dishes/:id',
    risk:'admin', required:['id'], optional:['name','category','costPriceFen','description','imageUrl','status'],
    notes:'编辑不含 supplierId。', riskNote:'admin 专属。'},
  create_meal_template:{label:'组合套餐（存为模板）', method:'POST', endpoint:'/admin/meal/templates',
    risk:'operator', required:['name'], optional:['price','kind','items','sourceSetMealId','oneLiner','description','coverUrl'],
    notes:'不含 supplierId/costPrice（由商品反查，防口径漂移）。meal 强制「一饭四菜」（slot 1主荤/2半荤/3素菜/4汤/5主食），最多 8 项。',
    riskNote:'operator 可操作（中低风险）。'},
  edit_meal_template: {label:'编辑套餐模板', method:'PUT', endpoint:'/admin/meal/templates/:id',
    risk:'operator', required:['id'], optional:['name','price','items','kind','status'],
    notes:'items/price 在已被排期引用时冻结 → 30019；不传=不改，传 null=清空。',
    riskNote:'operator 可操作。'},
  assign_meal:        {label:'给楼分配套餐（创建分配）', method:'POST', endpoint:'/admin/meal/assignments',
    risk:'operator', required:['mealDate','buildingGroupId','setMealId'], optional:['distributionCenterId'],
    notes:'同一「出餐日×楼群」唯一，重复 → 30011；建出是 pending，需再上架。默认显式传「明天」mealDate 规避截单。',
    riskNote:'operator 可操作。'},
  publish_assignment: {label:'上架/下架套餐分配', method:'POST', endpoint:'/admin/meal/assignments/:id/publish',
    risk:'operator', required:['id','action'], optional:[],
    notes:'action = publish/unpublish。过截单时刻不许上架 → 30013；下架不设闸（紧急阀）；重复同向幂等。',
    riskNote:'operator 可操作。'},
  edit_assignment:    {label:'编辑套餐分配', method:'PUT', endpoint:'/admin/meal/assignments/:id',
    risk:'operator', required:['id'], optional:['setMealId','distributionCenterId'],
    notes:'已截单不可改 → 30003；改日期/楼群须删旧建新。', riskNote:'operator 可操作。'},
  copy_assignment:    {label:'批量复制套餐分配', method:'POST', endpoint:'/admin/meal/assignments/copy',
    risk:'operator', required:['fromDate','targetDates'], optional:['buildingGroupIds'],
    notes:'targetDates ≤ 14 个；不覆盖已存在；已截单目标日跳过。', riskNote:'operator 可操作。'},
  change_leader:      {label:'变更团长（等级/楼/层）', method:'PUT', endpoint:'/admin/leaders/:id',
    risk:'admin', required:['id','reason'], optional:['level','buildingId','floor'],
    notes:'改 level 同步写 commission_rate（等级是标签、费率才是钱）；改楼目标楼被占 → 20012。',
    riskNote:'admin 专属高危：直接改佣金费率。'},
  appoint_leader:     {label:'任命/转交团长', method:'POST', endpoint:'/admin/leaders',
    risk:'admin', required:['userId','buildingId','realName','phone','reason'],
    optional:['level','floor','transferFromLeaderId'],
    notes:'目标楼有在职团长须传 transferFromLeaderId，否则 20012；现任被停职非删除。',
    riskNote:'admin 专属。'},
  leader_audit:       {label:'团长资质补录（停职/恢复/补签）', method:'POST', endpoint:'/admin/leaders/:id/audit',
    risk:'admin', required:['id','action','reason'], optional:['agreementVersion'],
    notes:'action = suspend/restore/sign_agreement/note。补签须 agreementVersion 白名单（v1.0）。',
    riskNote:'admin 专属。'},
};

/* 枚举（仅用于草稿卡里给同事提示，不强制 LLM 遵守） */
const OPS_ENUMS = {
  category: ['main(主荤)','half(半荤)','veg(素菜)','soup(汤)','staple(主食)'],
  kind: ['meal','fmcg'],
  level: ['trainee(见习)','formal(正式)','gold(金牌)','chief(首席)'],
  status: ['1(上架)','0(下架)'],
  action_assign: ['publish(上架)','unpublish(下架)'],
  action_audit: ['suspend(停职)','restore(恢复)','sign_agreement(补签)','note(备注)'],
};

/* ── 阶段 2：执行配置（本地，令牌绝不写死进源码） ── */
const KB_API_BASE = 'https://api.xunlizhinian.cn';  // 后台管理 API 基址；若改走 admin 同域代理，只改这一行
function kbCfg(){
  try {
    return {
      operator: (localStorage.getItem('kb_op_operator') || '').trim(),
      token: (localStorage.getItem('kb_op_token') || '').trim(),
    };
  } catch (e){ return {operator:'', token:''}; }
}
function kbSaveCfg(op, tk){
  try {
    if (op !== undefined) localStorage.setItem('kb_op_operator', op);
    if (tk !== undefined) localStorage.setItem('kb_op_token', tk);
  } catch (e){}
}
let opsLastText = '';  // 最近一次自然语言原文，执行时作为审计载荷

/* ── 系统提示：操作助手（独立于问答 SYS_PROMPT，不污染文档问答） ── */
const OPS_SYS_PROMPT = [
'你是「ABox 一盒」后台的**操作助手**。你的工作：把同事用大白话说的后台操作请求，翻成一份',
'**结构化的操作草稿**（JSON 块），并说明将调哪个接口、传什么参数、影响什么。',
'',
'⚠️ 阶段 1 铁律：**你只生成草稿，绝不执行，也不要假装已执行**。任何地方都不要写',
'「已上架 / 已创建 / 已完成」这类完成态 —— 只能写「将调用 / 拟创建 / 待确认」。',
'',
'你能覆盖的后台操作（op 代码 → 说明 → 必填 → 选填）：',
'1. create_dish 上架新菜品：必填 supplierId, name(≥2字), category, costPriceFen(整数分)；选填 description, imageUrl, status(1/0)。',
'2. batch_dish_status 批量上下架：必填 ids[](商品id数组), status(1/0)；选填 reason(下架必填)。',
'3. edit_dish 编辑菜品：必填 id；选填 name, category, costPriceFen, description, imageUrl, status（编辑不含 supplierId）。',
'4. create_meal_template 组合套餐(存模板)：必填 name；选填 price(元,默认25.8), kind(meal/fmcg), items[](itemId+slot 1主荤/2半荤/3素菜/4汤/5主食,最多8), sourceSetMealId, oneLiner, description, coverUrl（不含 supplierId/costPrice）。',
'5. edit_meal_template 编辑套餐：必填 id；选填 name, price, items(整组替换), kind, status。',
'6. assign_meal 给楼分配套餐：必填 mealDate(YYYY-MM-DD), buildingGroupId, setMealId；选填 distributionCenterId。',
'7. publish_assignment 上架/下架分配：必填 id, action(publish/unpublish)。',
'8. edit_assignment 编辑分配：必填 id；选填 setMealId, distributionCenterId。',
'9. copy_assignment 批量复制分配：必填 fromDate, targetDates[](≤14)；选填 buildingGroupIds[]。',
'10. change_leader 变更团长：必填 id, reason(≥2字)；选填 level(trainee/formal/gold/chief), buildingId, floor。',
'11. appoint_leader 任命/转交团长：必填 userId, buildingId, realName, phone, reason；选填 level, floor, transferFromLeaderId。',
'12. leader_audit 团长资质补录：必填 id, action(suspend/restore/sign_agreement/note), reason；选填 agreementVersion。',
'',
'输出格式：在回答里写一行操作块（可只有一块，最多两块），用 <<OP>> 与 <</OP>> 包住 JSON：',
'<<OP>>{"op":"create_dish","summary":"上架新菜品 红烧排骨","params":{"supplierId":"?","name":"红烧排骨","category":"main","costPriceFen":"?","description":"","imageUrl":"?"},"missing":["supplierId","costPriceFen","imageUrl"],"notes":"需确认供应商与供价(整数分)及菜品图"}<</OP>>',
'',
'规则：',
'· 能确定的字段填真实值；**不确定的真实主键/金额一律写 "?" 并放进 missing** —— 严禁编造',
'  supplierId / setMealId / buildingGroupId / id / userId / costPriceFen 等后台真实值。',
'· 金额 costPriceFen 用**整数分**（¥12.80 → 1280）。',
'· missing 列出同事还须补充的资料；notes 用一句说明这个操作的影响与注意点。',
'· 先用一两句话向同事确认你理解的需求，再给操作块。',
'· 如果用户的话模糊到无法确定 op（如"帮我弄一下菜品"），就列出可能对应的操作让他选，',
'  说明各需什么资料，**不要**硬翻成某一块。',
'· 路径前缀写死为 /admin（已由系统内置，不要自己拼路径）。',
].join('\n');

/* ── 解析操作块（与问数 extractPlans 同思路） ── */
function extractOps(s){
  const out = [];
  const re = /<<OP>>([\s\S]*?)<<\/OP>>/g;
  let m;
  while ((m = re.exec(s))){
    const t = m[1].trim();
    try { out.push(JSON.parse(t)); } catch (e){ out.push({__parse_error:t}); }
  }
  return out.slice(0, 2);
}
/* 流式显示时藏起操作块，避免丑 JSON 在屏幕上滚 */
function maskOp(s){
  return s.replace(/<<OP>>[\s\S]*?<<\/OP>>/g, '').replace(/<<OP>>[\s\S]*$/, '');
}

/* ── 确定性校验：端点/方法/风险内部映射，必填校验，雷点提示 ── */
function normalizeDate(s){
  if (!s) return '';
  const m = String(s).trim().match(/^(\d{4})[-/.]?(\d{1,2})[-/.]?(\d{1,2})/);
  if (!m) return '';
  return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
}
function validateOp(block){
  if (!block || block.__parse_error)
    return {ok:false, err:'操作块不是合法 JSON：' + String(block && block.__parse_error || '').slice(0, 120)};
  const op = block.op;
  const cat = OPS_CATALOG[op];
  if (!cat)
    return {ok:false, err:'不支持的操作类型：' + (op || '（缺 op 字段）'),
            known: Object.keys(OPS_CATALOG).join(' · ')};
  const params = block.params || {};
  const supplied = {}, missing = [];
  for (const k of cat.required){
    const v = params[k];
    if (v === undefined || v === null || v === '?' || v === '')
      missing.push(k);
    else supplied[k] = v;
  }
  for (const k of cat.optional)
    if (params[k] !== undefined && params[k] !== null && params[k] !== '?') supplied[k] = params[k];

  /* 雷点：套餐类操作遇 mealDate ≤ 今天 → 截单硬闸提示（不执行，仅预警） */
  const today = new Date(); today.setHours(0,0,0,0);
  const warnings = [];
  const mealOps = ['assign_meal','publish_assignment','edit_assignment','copy_assignment'];
  if (mealOps.includes(op)){
    const d = normalizeDate(params.mealDate) || normalizeDate(params.fromDate);
    if (d){
      const dt = new Date(d + 'T00:00:00');
      if (dt <= today)
        warnings.push('mealDate ' + d + ' 不在明天及以后 —— 过截单时刻后上架/改会被后端拒（30013/30003）。建议改到明天及以后。');
    } else {
      warnings.push('未给出明确 mealDate —— 默认应显式传「明天」，否则易撞截单硬闸 30013。');
    }
  }
  return {ok:true, op, cat, summary:block.summary || cat.label,
          supplied, missing, notes:block.notes || cat.notes,
          warnings, allParams:params};
}

/* ── 草稿卡渲染 ── */
function renderDraft(d, i){
  if (!d.ok)
    return '<div class="op-card"><div class="op-head"><span class="op-name">操作草稿没生成</span></div>'
      + '<div class="op-miss"><b>原因：</b>' + esc(d.err)
      + (d.known ? '<br>可用 op：' + esc(d.known) : '') + '</div></div>';
  const cat = d.cat;
  const riskCls = cat.risk === 'admin' ? 'admin' : 'operator';
  const riskTxt = cat.risk === 'admin' ? '高危 · admin 专属' : '中低危 · operator 可操作';
  const rows = [];
  for (const k of cat.required)
    rows.push(opRow(k, d.supplied[k], true));
  for (const k of cat.optional)
    if (k in d.allParams) rows.push(opRow(k, d.supplied[k], false));
  const tbl = rows.length
    ? '<table class="op-ptbl"><thead><tr><th>参数</th><th>值</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>'
    : '<div class="op-sub">（该操作无具体参数需填）</div>';

  const missHtml = d.missing.length
    ? '<div class="op-miss"><b>待同事补充的资料：</b>' + d.missing.map(x => esc(x)).join('、')
      + '<br>这些是后台真实主键 / 金额，不能由 AI 编造，须同事从后台或实物上确认后提供。</div>'
    : '';
  const warnHtml = d.warnings.length
    ? '<div class="op-warn"><b>⚠ 雷点提示：</b><br>' + d.warnings.map(x => '· ' + esc(x)).join('<br>') + '</div>'
    : '';
  const head = (i ? '操作草稿 ' + (i + 1) + ' · ' : '操作草稿 · ');
  /* 阶段 2：草稿卡主体由下方统一 return（含执行按钮区） */
  const isAdmin = cat.risk === 'admin';
  const hasMiss = d.missing.length > 0;
  const blocked = !isAdmin && d.warnings.some(w => w.indexOf('截单') >= 0);
  let execBtn;
  if (isAdmin)
    execBtn = '<button class="op-exec" disabled>🔒 需 admin 负责人在后台执行</button>';
  else if (hasMiss)
    execBtn = '<button class="op-exec" disabled>✏️ 补全待补资料后可执行</button>';
  else if (blocked)
    execBtn = '<button class="op-exec" disabled>⛔ 雷点拦截（见上方提示）</button>';
  else
    execBtn = '<button class="op-exec live" data-i="' + (i||0) + '">✅ 确认执行</button>';
  const lockHtml = isAdmin
    ? '<div class="op-lock"><b>admin 专属：</b>上架菜品 / 提团长等级属高危操作，本助手在阶段 2 不开放自动执行。请点「复制草稿给负责人」，由有 admin 权限的人在后台执行。</div>'
    : '<div class="op-lock"><b>执行说明：</b>点「确认执行」将带操作员令牌真实调用后台写接口（' + esc(cat.method) + ' ' + esc(cat.endpoint) + '）。操作全程记入 @OperationLog（操作人 / 自然语言原文 / 操作块 JSON）。</div>';
  return '<div class="op-card">'
    + '<div class="op-head"><span class="op-name">' + head + esc(d.summary) + '</span>'
    + '<span class="op-badge ' + riskCls + '">' + esc(riskTxt) + '</span>'
    + '<span class="op-badge draft">草稿→执行</span></div>'
    + '<div class="op-ep"><b>拟调用</b> ' + esc(cat.method) + ' ' + esc(cat.endpoint) + '</div>'
    + '<div class="op-sub">' + esc(cat.notes) + '</div>'
    + tbl + missHtml + warnHtml
    + '<div class="op-note"><b>影响说明：</b>' + esc(d.notes) + '</div>'
    + '<div class="op-actions">'
    + execBtn
    + '<button class="op-copy" data-i="' + (i||0) + '">复制草稿给负责人</button>'
    + '</div>'
    + lockHtml
    + '</div>';
}
function opRow(k, v, req){
  const miss = (v === undefined || v === '?');
  const tag = req ? '<span class="tag req">必填</span>' : '<span class="tag opt">选填</span>';
  const val = miss ? '<span class="miss">待提供 ?</span>' : esc(String(v));
  return '<tr><td class="k">' + esc(k) + tag + '</td><td class="v' + (miss ? ' miss' : '') + '">' + val + '</td></tr>';
}

/* ── 复制到剪贴板（让同事把草稿发给真负责人） ── */
function copyDraft(d){
  if (!d || !d.ok) return;
  const cat = d.cat;
  const L = [];
  L.push('【ABox 后台操作草稿】' + d.summary);
  L.push('拟调用：' + cat.method + ' ' + cat.endpoint + '（' + (cat.risk === 'admin' ? '高危·admin' : '中低·operator') + '）');
  L.push('参数：');
  for (const k of cat.required) L.push('  ' + k + ' = ' + ((d.supplied[k] !== undefined ? d.supplied[k] : '待提供 ?')));
  for (const k of cat.optional) if (k in d.allParams) L.push('  ' + k + ' = ' + ((d.supplied[k] !== undefined ? d.supplied[k] : '待提供 ?')));
  if (d.missing.length) L.push('待补充：' + d.missing.join('、'));
  L.push('影响：' + d.notes);
  if (d.warnings.length) L.push('雷点：' + d.warnings.join('；'));
  L.push('（本草稿由知识助手「操作」tab 生成，阶段 1 未执行）');
  const txt = L.join('\n');
  try {
    navigator.clipboard.writeText(txt);
    return '已复制草稿到剪贴板';
  } catch (e){
    return '复制失败，请手动选择文本复制';
  }
}

/* ── 阶段 2：真实执行（带操作员令牌 + 审计载荷；admin 类永不走这里） ── */

/** UTF-8 安全的 base64（fetch 头不允许中文等非 Latin1 字符，知识助手统一 base64 后由后端拦截器解码；见 B3） */
function b64u(s){
  const bytes = new TextEncoder().encode(String(s == null ? '' : s));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

async function execOp(d){
  if (!d || !d.ok) return;
  const cfg = kbCfg();
  if (!cfg.operator) { alert('请先在上方填写「操作人」姓名 / 工号。'); return; }
  if (!cfg.token)    { alert('请先在上方粘贴「操作员令牌」（由负责人签发，仅 operator 权限）。'); return; }
  const cat = d.cat;
  const url = KB_API_BASE + cat.endpoint.replace(':id',
    encodeURIComponent(d.supplied.id != null ? d.supplied.id : ''));
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + cfg.token,
    'X-KB-Operator': b64u(cfg.operator),
    'X-KB-NL': b64u(opsLastText.slice(0, 500)),
    'X-KB-OpBlock': b64u(JSON.stringify({op: d.op, params: d.supplied})),
  };
  opsCtl = new AbortController();
  const init = {method: cat.method, headers, signal: opsCtl.signal};
  if (cat.method !== 'GET') init.body = JSON.stringify(d.supplied);
  const ok = confirm('确认以「' + cfg.operator + '」身份执行：\n'
    + cat.method + ' ' + cat.endpoint + '\n\n参数已列在上方草稿卡。'
    + '此操作将真实写入后台并留痕，确定？');
  if (!ok) return;
  const out = document.getElementById('oout');
  try {
    const resp = await fetch(url, init);
    const text = await resp.text();
    let body; try { body = JSON.parse(text); } catch (e){ body = null; }
    const msg = (typeof body === 'object' && body && body.message) ? body.message : String(text).slice(0, 300);
    if (resp.ok){
      out.insertAdjacentHTML('afterbegin',
        '<div class="op-card op-ok"><div class="op-head"><span class="op-name">✅ 执行成功</span></div>'
        + '<div class="op-sub">接口 ' + esc(cat.method) + ' ' + esc(cat.endpoint) + ' 已返回 2xx，操作已记入后台审计日志（操作人：' + esc(cfg.operator) + '）。</div>'
        + (typeof body === 'object' && body ? '<div class="op-note">回执：' + esc(JSON.stringify(body)).slice(0, 400) + '</div>' : '') + '</div>');
    } else {
      out.insertAdjacentHTML('afterbegin',
        '<div class="op-card op-err"><div class="op-head"><span class="op-name">❌ 执行被后台拒绝</span></div>'
        + '<div class="op-sub">HTTP ' + resp.status + '：' + esc(msg) + '</div>'
        + '<div class="op-note">常见原因：令牌无效 / 过期、或触发后台业务校验（如 30013 截单硬闸）。请核对后重试，或复制草稿交负责人。</div></div>');
    }
  } catch (e){
    out.insertAdjacentHTML('afterbegin',
      '<div class="op-card op-err"><div class="op-head"><span class="op-name">⚠️ 请求未送达</span></div>'
      + '<div class="op-sub">网络 / CORS 错误：' + esc(errBrief(e)) + '</div>'
      + '<div class="op-note">若提示 CORS，说明后台尚未把本发布域名加入跨域白名单（需负责人在 api-server 的 enableCors 追加 origin）。</div></div>');
  }
}

/* ── 流式调用（独立控制器，不与问答/问数共用 ctl） ── */
let opsCtl = null;
async function opsStream(messages, outEl, metaEl, model){
  let out = '';
  opsCtl = new AbortController();
  const stream = cloud.llm.chat.completions.create({
    model: model.id, messages: messages, stream: true,
    temperature: 0.2, conversationId: ('ops-' + CONV), signal: opsCtl.signal,
  });
  for await (const chunk of stream){
    const dd = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
    if (dd && dd.content){ out += dd.content; outEl.innerHTML = md2html(maskOp(out)); }
    if (chunk.usage) metaEl.textContent = '本次用量 ' + chunk.usage.total_tokens + ' tokens';
  }
  return out;
}

/* ── 主流程 ── */
let opsBusy = false, opsInit = false;
function showOps(){
  if (!opsInit){
    const tip = document.getElementById('otip');
    if (tip) tip.innerHTML = '用大白话告诉它你想做的后台操作 —— 例如「给量子大厦 5 号楼上架一个明天的新套餐」「把团长张三升到金牌」。<br>'
      + '它会翻成<b>操作草稿</b>（调哪个接口、传什么参数、影响什么），并标出你还须补的资料。<b>阶段 1 只出草稿、不执行</b>。';
    buildOpsUI();
    opsInit = true;
  }
  const qi = document.getElementById('oqi');
  if (qi) qi.focus();
}
function buildOpsUI(){
  const box = document.getElementById('oview');
  if (!box) return;
  box.innerHTML =
    '<div class="op-input"><textarea id="oqi" rows="1" placeholder="说你想做的后台操作…"></textarea>'
    + '<button class="btn gh" id="ostop" hidden>停止</button>'
    + '<button class="btn" id="osend">生成草稿</button></div>'
    + '<div class="op-sug" id="osug"></div>'
    + '<div class="op-stage"><b>阶段 2（执行）</b> · operator 类操作（套餐 / 分配）可在此确认执行；'
    + 'admin 类（上架菜品 / 提团长等级）属高危，本助手不开放自动执行，请复制草稿交负责人在后台操作。'
    + '执行前请先在下方填写「操作人」与「操作员令牌」（令牌由负责人签发，仅 operator 权限、有时效）。</div>'
    + '<div class="op-meta" id="ometa">'
    + '  <div class="op-meta-row"><label>操作人</label><input id="omop" placeholder="你的姓名 / 工号" autocomplete="off"></div>'
    + '  <div class="op-meta-row"><label>操作员令牌</label><input id="omtk" type="password" placeholder="粘贴负责人签发的 operator 令牌" autocomplete="off"></div>'
    + '  <div class="op-meta-note">令牌仅存于本机浏览器（localStorage），不会上传到任何地方，也不写进助手源码。离职 / 离岗后请清空。</div>'
    + '</div>'
    + '<div class="res" id="oout"></div>';
  const sug = ['给某楼分配明天的套餐', '组合一个新套餐模板', '上架一个新菜品', '把某团长升到金牌'];
  document.getElementById('osug').innerHTML = sug.map(s => '<span>' + esc(s) + '</span>').join('');
  document.getElementById('osug').onclick = e => {
    if (e.target.tagName !== 'SPAN') return;
    const qi = document.getElementById('oqi'); qi.value = e.target.textContent; qi.focus();
  };
  /* 操作人 / 令牌：从 localStorage 回填，输入即存 */
  const omop = document.getElementById('omop'), omtk = document.getElementById('omtk');
  const cfg0 = kbCfg();
  if (omop){ omop.value = cfg0.operator; omop.oninput = () => kbSaveCfg(omop.value, undefined); }
  if (omtk){ omtk.value = cfg0.token; omtk.oninput = () => kbSaveCfg(undefined, omtk.value); }
  document.getElementById('osend').onclick = () => opsAsk(document.getElementById('oqi').value);
  document.getElementById('ostop').onclick = () => { if (opsCtl) opsCtl.abort(); };
  const qi = document.getElementById('oqi');
  qi.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing){ e.preventDefault(); opsAsk(qi.value); }
  });
  qi.addEventListener('input', e => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(150, e.target.scrollHeight) + 'px';
  });
}

async function opsAsk(text){
  text = (text || '').trim();
  opsLastText = text;
  if (opsBusy || !text) return;
  const oout = document.getElementById('oout');
  if (CLOUD_STATE !== 'ok'){
    oout.innerHTML = '<div class="op-card"><div class="op-miss">操作助手需要联网并从<b>发布链接</b>打开'
      + '（云服务按来源域名放行）。当前不是发布地址，请改用发布链接使用本功能。</div></div>';
    return;
  }
  if (!rateOk()){ oout.innerHTML = '<div class="op-card"><div class="op-miss">一分钟内问得太多（上限 12 次），稍后再试。</div></div>'; return; }
  const model = MODELS.find(m => m.id === document.getElementById('model').value) || MODEL;
  oout.innerHTML = '<div class="op-card"><div class="op-sub">正在理解你的需求并生成草稿…</div></div>';
  const meta = document.createElement('div'); meta.className = 'hint'; meta.style.cssText = 'font-size:12.5px;margin-top:6px';
  oout.appendChild(meta);
  opsBusy = true; opsCtl = new AbortController();
  const send = document.getElementById('osend'), stop = document.getElementById('ostop');
  if (send) send.disabled = true; if (stop) stop.hidden = false;
  try {
    const full = await opsStream(
      [{role:'system', content:OPS_SYS_PROMPT}, {role:'user', content:text}],
      oout.querySelector('.op-sub'), meta, model);
    const blocks = extractOps(full);
    oout.innerHTML = '';
    if (!blocks.length){
      oout.innerHTML = '<div class="op-card"><div class="op-head"><span class="op-name">没翻出操作块</span></div>'
        + '<div class="op-sub">' + esc(full || '（模型没有返回可解析的操作块）') + '</div>'
        + '<div class="op-note">如果需求模糊，试着说更具体些，比如「给 X 楼分配明天的 Y 套餐」，'
        + '或明确要哪个操作。</div></div>';
    } else {
      const ds = blocks.map(b => validateOp(b));
      oout.innerHTML = ds.map((d, i) => renderDraft(d, ds.length > 1 ? i : null)).join('');
      for (const el of oout.querySelectorAll('.op-copy'))
        el.onclick = () => {
          const i = parseInt(el.dataset.i, 10) || 0;
          const msg = copyDraft(ds[i]);
          el.textContent = msg;
          setTimeout(() => { el.textContent = '复制草稿给负责人'; }, 1600);
        };
      for (const el of oout.querySelectorAll('.op-exec.live'))
        el.onclick = () => execOp(ds[parseInt(el.dataset.i, 10) || 0]);
    }
  } catch (e){
    oout.innerHTML = '<div class="op-card"><div class="op-miss">生成中断：' + esc(errBrief(e)) + '</div></div>';
  } finally {
    opsBusy = false; if (send) send.disabled = false; if (stop) stop.hidden = true;
  }
}

/* ── 给问答用的轻量提示（可选：在问答里被问到"怎么操作后台"时指路） ── */
function opsPrompt(){
  return '【后台操作】若用户问"怎么上架菜品 / 怎么给楼分配套餐 / 怎么提团长等级 / 怎么组合套餐"，'
    + '告诉他去「操作」tab：用大白话描述要做的操作，AI 会生成操作草稿（调哪个接口、参数、影响）并标出待补资料。'
    + '注意：阶段 1 的操作 tab 只出草稿不执行。';
}

/* 暴露给 build2.py 那边的规则段（问答可指路）；showOps 已挂在 tab 切换上 */
OPS = { prompt: opsPrompt, catalog: OPS_CATALOG };
bootOps();

async function bootOps(){
  /* 不依赖数据快照；仅确保全局变量就绪后即可用。把操作指路接进系统提示（问答 tab 用）。 */
  try { SYS_PROMPT += '\n\n' + opsPrompt(); } catch (e){ /* SYS_PROMPT 在 build2.py 声明为 let，必存在 */ }
}
