/* ══════════════════════════════════════════════════════════════════════════════
   三期 · 问数  —— 指标字典 + 确定性查询引擎（由 build2.py 读入并拼进页面）

   一句话：**数字只能由这台引擎算出来，语言模型一个加减乘除都不许做。**

   它怎么工作：
     ① 用户问「上周一共多少单」——模型先把这句话翻成**取数块**（指标 / 口径 / 时间轴 /
        区间 / 分组），不自己算；
     ② 本引擎在**快照**上确定性执行，返回行集 + 合计 + **等价 SQL** + 命中行数；
     ③ 结果回灌给模型，它只负责把结果写成中文，并说明用的是哪个口径、哪条时间轴；
     ④ 页面上常驻一张「本次取数」卡：口径 · 时间轴 · 区间 · 等价 SQL · 命中行数
        —— 任何数字都能顺着这张卡回原样核对。

   为什么要这么绕：让模型直接算数，它会算错、还会编。口径（有效订单算不算取消单、
   佣金含不含冲销）一旦被"顺手四舍五入"，错误会藏在看起来最正常的句子里。

   ⚠️ 单一真源：口径、维度、时间轴**只在本文件的 METRICS 里声明一次**。snap.py 只搬原样行，
   不在这边过滤 —— 两边都定义口径，就必然出现两份互相矛盾的口径。
   ══════════════════════════════════════════════════════════════════════════════ */

let DATA = null, META = null, IDX = {};
const ymd = d => d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2)
               + '-' + ('0' + d.getDate()).slice(-2);

/* ⚠️ 口径坑：date 列（meal_date / share_date / produce_date）本来就是「业务日」；
   datetime 列（created_at / paid_at / settled_at / refunded_at）库里存的是 **UTC 文本**，
   这里按前 10 字符切片 —— 与界面上显示的北京时间可能差一天。标注出来，别让人踩。 */
const dimLabel = d => d.label + (d.utc ? '（UTC 文本）' : '');

/* ══════════ 维度集（可复用；t:1 表示还能当时间轴用） ══════════ */
const DIMS = {
  d_meal:     {id:'d_meal',     label:'出餐日',   col:'meal_date',   t:1},
  d_create:   {id:'d_create',   label:'下单日',   col:'created_at',  t:1, utc:1},
  d_paid:     {id:'d_paid',     label:'支付日',   col:'paid_at',     t:1, utc:1},
  d_settled:  {id:'d_settled',  label:'结算日',   col:'settled_at',  t:1, utc:1},
  d_share:    {id:'d_share',    label:'分账日',   col:'share_date',  t:1},
  d_produce:  {id:'d_produce',  label:'生产日',   col:'produce_date',t:1},
  d_refunded: {id:'d_refunded', label:'退款日',   col:'refunded_at', t:1, utc:1},
  d_wpaid:    {id:'d_wpaid',    label:'到账日',   col:'paid_at',     t:1, utc:1},

  o_status:   {id:'o_status',   label:'订单状态', col:'status'},
  o_building: {id:'o_building', label:'楼栋',     col:'building_id',       ref:'building'},
  o_group:    {id:'o_group',    label:'楼群',     col:'building_group_id', ref:'group'},
  o_leader:   {id:'o_leader',   label:'团长',     col:'team_leader_id',    ref:'leader'},
  o_setmeal:  {id:'o_setmeal',  label:'套餐',     col:'set_meal_id',       ref:'set_meal'},

  c_status:   {id:'c_status',   label:'佣金状态', col:'status'},
  c_type:     {id:'c_type',     label:'类型',     col:'type'},
  c_level:    {id:'c_level',    label:'团长等级', col:'leader_level'},
  c_leader:   {id:'c_leader',   label:'团长',     col:'team_leader_id',    ref:'leader'},

  s_status:   {id:'s_status',   label:'状态',     col:'status'},
  s_supplier: {id:'s_supplier', label:'供应商',   col:'payee_id',          ref:'supplier'},
  s_dish:     {id:'s_dish',     label:'菜品',     col:'dish_id',           ref:'dish'},

  w_status:   {id:'w_status',   label:'提现状态', col:'status'},
  w_leader:   {id:'w_leader',   label:'团长',     col:'leader_id',         ref:'leader'},

  r_status:   {id:'r_status',   label:'退款状态', col:'status'},
  r_type:     {id:'r_type',     label:'退款原因', col:'reason_type'},

  v_group:    {id:'v_group',    label:'楼群',     col:'building_group_id', ref:'group'},
  v_status:   {id:'v_status',   label:'配送状态', col:'status'},
  v_driver:   {id:'v_driver',   label:'司机',     col:'driver_name'},

  h_supplier: {id:'h_supplier', label:'供应商',   col:'supplier_id',       ref:'supplier'},
  h_dish:     {id:'h_dish',     label:'菜品',     col:'dish_id',           ref:'dish'},
  b_status:   {id:'b_status',   label:'菜心状态', col:'status'},

  m_group:    {id:'m_group',    label:'楼群',     col:'building_group_id', ref:'group'},
  m_center:   {id:'m_center',   label:'集散中心', col:'distribution_center_id'},
  m_status:   {id:'m_status',   label:'状态',     col:'status'},

  wd_status:  {id:'wd_status',  label:'菜心日态', col:'status'},
};

/* 订单类指标共用的一组口径（避免 6 个指标各抄一遍而抄歪） */
const SC_ORDER = {
  '有效':   {desc:'status ∉ {cancelled, refunded}（业务上真正成立的单）', spec:{status:{notIn:['cancelled','refunded']}}},
  '全部':   {desc:'不过滤任何状态（含已取消、已退款）', spec:null},
  '已完成': {desc:'status = completed', spec:{status:{eq:'completed'}}},
  '履约中': {desc:'status ∈ {cut_off, cooked, delivering, delivered}',
             spec:{status:{in:['cut_off','cooked','delivering','delivered']}}},
  '已取消': {desc:'status = cancelled', spec:{status:{eq:'cancelled'}}},
  '已退款': {desc:'status = refunded', spec:{status:{eq:'refunded'}}},
};
const DIM_ORDER = ['d_meal','d_create','d_paid','o_status','o_building','o_group','o_leader','o_setmeal'];

/* ══════════ 指标字典（口径唯一真源） ══════════ */
const METRICS = [
  {id:'order_count', name:'订单量', unit:'单', tbl:'order', measure:{agg:'count'},
   default_scope:'有效', scopes:SC_ORDER, dims:DIM_ORDER,
   q:'上周一共多少单？'},

  {id:'order_qty', name:'份数', unit:'份', tbl:'order', measure:{agg:'sum', col:'quantity'},
   default_scope:'有效', scopes:SC_ORDER, dims:DIM_ORDER,
   q:'上周卖了多少份？'},

  {id:'revenue', name:'实收金额', unit:'元', tbl:'order', measure:{agg:'sum', col:'pay_amount'},
   default_scope:'有效', scopes:SC_ORDER, dims:DIM_ORDER,
   q:'上周的实收金额是多少？'},

  {id:'gmv', name:'订单金额', unit:'元', tbl:'order', measure:{agg:'sum', col:'total_amount'},
   default_scope:'有效', scopes:SC_ORDER, dims:DIM_ORDER,
   q:'各楼群的订单金额分别是多少？'},

  {id:'aov', name:'客单价', unit:'元', tbl:'order',
   measure:{rate:{num:{agg:'sum', col:'pay_amount'}, den:{agg:'count'}}},
   default_scope:'有效', scopes:SC_ORDER, dims:DIM_ORDER,
   q:'上周的客单价是多少？'},

  {id:'commission', name:'佣金', unit:'元', tbl:'commission', measure:{agg:'sum', col:'amount'},
   default_scope:'已结算',
   scopes:{
     '已结算': {desc:'status = settled（**含 reversal 冲销行，它是负数** ⇒ 这就是应付给团长的净额）',
                spec:{status:{eq:'settled'}}},
     '全部':   {desc:'不过滤（含 pending 待结算与 cancelled 已取消）', spec:null},
     '待结算': {desc:'status = pending', spec:{status:{eq:'pending'}}},
     '已取消': {desc:'status = cancelled', spec:{status:{eq:'cancelled'}}},
   },
   dims:['d_meal','d_create','d_settled','c_status','c_type','c_level','c_leader'],
   q:'各等级团长的佣金分别是多少？'},

  {id:'payable', name:'应付供应商采购款', unit:'元', tbl:'share', measure:{agg:'sum', col:'amount'},
   default_scope:'全部',
   scopes:{
     '全部': {desc:'全部供应商分账（自营口径下，应付只剩这一项；场所摊销/打包/配送是自身成本、不出付款单）', spec:null},
     '待付': {desc:'status = pending', spec:{status:{eq:'pending'}}},
     '已付': {desc:'status = success', spec:{status:{eq:'success'}}},
   },
   dims:['d_share','d_meal','s_supplier','s_dish','s_status'],
   q:'待付供应商的采购款一共多少？'},

  {id:'balance', name:'用户余额合计', unit:'元', tbl:'balance', measure:{agg:'sum', col:'balance'},
   default_scope:'全部',
   scopes:{'全部':{desc:'ab_balance 全表合计。⚠️ 用户余额与团长佣金**同一张表**，这里是两者合计，不区分', spec:null}},
   dims:[],
   q:'用户余额一共还剩多少？'},

  {id:'frozen', name:'冻结余额合计', unit:'元', tbl:'balance', measure:{agg:'sum', col:'frozen'},
   default_scope:'全部',
   scopes:{'全部':{desc:'ab_balance.frozen 全表合计', spec:null}},
   dims:[],
   q:'冻结的余额一共多少？'},

  {id:'withdraw', name:'提现', unit:'元', tbl:'withdraw', measure:{agg:'sum', col:'amount'},
   default_scope:'全部',
   scopes:{
     '全部':   {desc:'不过滤状态', spec:null},
     '已到账': {desc:'status = success', spec:{status:{eq:'success'}}},
     '已批待付':{desc:'status = approved', spec:{status:{eq:'approved'}}},
     '待审':   {desc:'status = pending', spec:{status:{eq:'pending'}}},
     '已驳回': {desc:'status = rejected', spec:{status:{eq:'rejected'}}},
     '失败':   {desc:'status = failed', spec:{status:{eq:'failed'}}},
   },
   dims:['d_create','d_wpaid','w_status','w_leader'],
   q:'已到账的提现一共多少？'},

  {id:'refund_amount', name:'退款金额', unit:'元', tbl:'refund', measure:{agg:'sum', col:'amount'},
   default_scope:'已退款',
   scopes:{
     '已退款': {desc:'status = refunded（钱真的退出去的）', spec:{status:{eq:'refunded'}}},
     '全部':   {desc:'不过滤（含申请中、已驳回）', spec:null},
     '申请中': {desc:'status ∈ {applying, approved}', spec:{status:{in:['applying','approved']}}},
     '已驳回': {desc:'status = rejected', spec:{status:{eq:'rejected'}}},
   },
   dims:['d_create','d_refunded','r_status','r_type'],
   q:'一共退了多少钱？'},

  {id:'dish_plan', name:'计划备餐份数', unit:'份', tbl:'dish_daily',
   measure:{agg:'sum', col:'plan_quantity'},
   default_scope:'全部',
   scopes:{'全部':{desc:'ab_supplier_dish_daily.plan_quantity 合计', spec:null}},
   dims:['d_produce','h_supplier','h_dish','b_status'],
   q:'各供应商的计划备餐份数分别是多少？'},

  {id:'dish_actual', name:'实际出餐份数', unit:'份', tbl:'dish_daily',
   measure:{agg:'sum', col:'actual_quantity'},
   default_scope:'全部',
   scopes:{'全部':{desc:'ab_supplier_dish_daily.actual_quantity 合计', spec:null}},
   dims:['d_produce','h_supplier','h_dish','b_status'],
   q:'实际出餐了多少份？'},

  {id:'trip_count', name:'配送趟次', unit:'趟', tbl:'delivery', measure:{agg:'count'},
   default_scope:'全部',
   scopes:{'全部':{desc:'ab_delivery_record 行数（一趟 = 一条记录）', spec:null}},
   dims:['d_meal','v_group','v_status','v_driver'],
   q:'一共送了几趟？'},

  {id:'trip_qty', name:'配送份数', unit:'份', tbl:'delivery', measure:{agg:'sum', col:'total_quantity'},
   default_scope:'全部',
   scopes:{'全部':{desc:'ab_delivery_record.total_quantity 合计', spec:null}},
   dims:['d_meal','v_group','v_status','v_driver'],
   q:'各楼群配送了多少份？'},

  {id:'sold_seats', name:'成团售出份数', unit:'份', tbl:'assignment',
   measure:{agg:'sum', col:'sold_count'},
   default_scope:'全部',
   scopes:{'全部':{desc:'ab_meal_assignment.sold_count 合计（这是开团台账上的数，与订单表可能不一致）', spec:null}},
   dims:['d_meal','m_group','m_center','m_status'],
   q:'各楼群的成团售出份数是多少？'},

  {id:'gross_profit', name:'平台毛利', unit:'元', tbl:'-', custom:'gross',
   default_scope:'全部',
   scopes:{'全部':{desc:'售价 − 供应商采购款 − 已结算佣金。⚠️ 三张表粒度不同（订单 / 菜品·日 / 佣金行），'
                   +'**只在「出餐日」这一层对齐后相减**，不是逐单毛利', spec:null}},
   dims:['d_meal'],
   q:'上周的毛利是多少？'},
];

/* ══════════ 取值 / 过滤 / 标签 ══════════ */
const num = v => { const x = typeof v === 'number' ? v : parseFloat(v); return isFinite(x) ? x : 0; };
function normDate(s){
  if (!s) return '';
  const m = String(s).trim().match(/^(\d{4})[-/.]?(\d{1,2})[-/.]?(\d{1,2})/);
  if (!m) return '';
  return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
}
function matchSpec(r, spec){
  if (!spec) return true;
  for (const col in spec){
    const cond = spec[col], got = r[col];
    for (const op in cond){
      const v = cond[op];
      if (op === 'in' && !v.includes(got)) return false;
      if (op === 'notIn' && v.includes(got)) return false;
      if (op === 'eq' && got !== v) return false;
      if (op === 'ne' && got === v) return false;
      if (op === 'notNull' && (got === null || got === undefined || got === '')) return false;
      if (op === 'isNull' && !(got === null || got === undefined || got === '')) return false;
    }
  }
  return true;
}
function labelOf(r, dim){
  let v = r[dim.col];
  if (v === null || v === undefined || v === '') return '（未填）';
  if (dim.ref && IDX[dim.ref]) v = IDX[dim.ref].get(String(v)) || ('#' + v);
  if (dim.t) v = String(v).slice(0, 10);
  return String(v);
}
function buildIdx(){
  const mk = (t, key, val) => {
    const m = new Map();
    for (const r of (DATA[t] || [])) m.set(String(r[key]), r[val]);
    return m;
  };
  IDX.building = mk('building', 'id', 'name');
  IDX.group    = mk('group',    'id', 'name');
  IDX.leader   = mk('leader',   'id', 'real_name');
  IDX.supplier = mk('supplier', 'id', 'name');
  IDX.set_meal = mk('set_meal', 'id', 'name');
  IDX.dish     = mk('dish',     'id', 'name');
}

/* ══════════ 等价 SQL（给人看的，可核对口径） ══════════ */
const QT = v => "'" + String(v).replace(/'/g, "''") + "'";
const TBL = {order:'ab_order', commission:'ab_commission', share:'ab_supplier_share',
             balance:'ab_balance', withdraw:'ab_withdraw', refund:'ab_refund',
             delivery:'ab_delivery_record', dish_daily:'ab_supplier_dish_daily',
             assignment:'ab_meal_assignment'};
function scopeSql(spec){
  const p = [];
  for (const col in spec) for (const op in spec[col]){
    const v = spec[col][op];
    if (op === 'in')      p.push(col + ' IN (' + v.map(QT).join(', ') + ')');
    if (op === 'notIn')   p.push(col + ' NOT IN (' + v.map(QT).join(', ') + ')');
    if (op === 'eq')      p.push(col + ' = ' + QT(v));
    if (op === 'ne')      p.push(col + ' <> ' + QT(v));
    if (op === 'notNull') p.push(col + ' IS NOT NULL');
    if (op === 'isNull')  p.push(col + ' IS NULL');
  }
  return p.join(' AND ');
}
function aggSql(m){
  const a = m.measure;
  if (a.agg === 'count') return 'count(*)';
  if (a.agg === 'sum')   return 'sum(' + a.col + ')';
  if (a.agg === 'avg')   return 'avg(' + a.col + ')';
  if (a.rate) return 'sum(' + a.rate.num.col + ') / count(*)';
  return '?';
}
/* ⚠️ filters 必须进 SQL：页面明说「上面是这次取数的等价 SQL —— 可照着复核」，
   而 filters 是**真的会过滤行**的（见 flatQuery 里 `matchSpec(r, p.filters)`）。
   原先它只改数字、不进 SQL 也不上卡 ⇒ 用户照 SQL 复核会得到**另一个数**，
   却找不到差异从哪来 —— 这比算错更难发现。 */
function buildSql(m, sc, tf, from, to, gids, filters){
  const sel = gids.map(g => g.col + (g.ref ? '   -- → ' + g.ref + '.name' : ''));
  sel.push(aggSql(m) + ' AS 值');
  const w = [];
  const push = s => { if (s) w.push(s); };
  push(sc && sc.spec ? scopeSql(sc.spec) : '');
  push(filters ? scopeSql(filters) : '');
  if (tf && (from || to))
    push("substr(" + tf.col + ", 1, 10) BETWEEN " + QT(from || '0000-00-00') + " AND " + QT(to || '9999-99-99'));
  let s = 'SELECT ' + sel.join(', ') + '\n  FROM ' + TBL[m.tbl];
  if (w.length) s += '\n WHERE ' + w.join('\n   AND ');
  if (gids.length) s += '\n GROUP BY ' + gids.map(g => g.col).join(', ');
  return s;
}

/* ══════════ 引擎 ══════════ */
function fmtVal(v, m){
  if (!isFinite(v)) return '—';
  if (m.unit === '元') return v.toFixed(2);
  if (m.measure && m.measure.rate) return v.toFixed(2);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}
function accAdd(a, m, r){
  a.n++;
  const mz = m.measure;
  if (mz.agg === 'count') a.v += 1;
  else if (mz.agg === 'sum' || mz.agg === 'avg') a.v += num(r[mz.col]);
  else if (mz.rate){
    a.num += num(r[mz.rate.num.col]);
    /* ⚠️ 分母可能是 count（没有列名）—— 第一版这里直接取 mz.rate.den.col，取到 undefined ⇒ 分母恒 0
       ⇒ 客单价恒等于 0，而页面照样印出来。是独立对拍（crosscheck.py）抓出来的。 */
    a.den += (mz.rate.den.agg === 'count') ? 1 : num(r[mz.rate.den.col]);
  }
}
function accVal(a, m){
  if (m.measure && m.measure.rate) return a.den > 0 ? a.num / a.den : 0;
  if (m.measure && m.measure.agg === 'avg') return a.n > 0 ? a.v / a.n : 0;
  return a.v;
}

function runQuery(p){
  if (!DATA) return {ok:false, err:'数据快照尚未载入，稍候再试'};
  if (p && p.__parse_error)
    return {ok:false, err:'取数块不是合法 JSON：' + String(p.__parse_error).slice(0, 80)};
  const m = METRICS.find(x => x.id === ((p && p.metric) || ''));
  if (!m)
    return {ok:false, err:'没有这个指标：' + ((p && p.metric) || '（缺 metric 字段）'),
            known: METRICS.map(x => x.id).join(' · ')};
  if (m.custom === 'gross') return grossQuery(p, m);
  return flatQuery(p, m);
}

function flatQuery(p, m){
  const rows0 = DATA[m.tbl] || [];
  const scopeName = (p.scope && m.scopes[p.scope]) ? p.scope : m.default_scope;
  const sc = m.scopes[scopeName] || {desc:'不过滤', spec:null};
  const dims = m.dims.map(id => DIMS[id]).filter(Boolean);
  const from = normDate(p.from), to = normDate(p.to);
  const wantTime = !!(from || to);
  let tf = dims.find(d => d.t && d.id === p.timeField) || dims.find(d => d.t) || null;
  /* ⚠️ 请求的时间轴这个指标没有 ⇒ 旧实现**静默**回退到第一个时间维度。
     结果卡上虽然印着实际用的 timeField，但那行很小，而模型会照它自己写的那条去解释
     ⇒ 显式给一句提示，让它不再是「悄悄换了个口径」。 */
  const timeNote = (p.timeField && tf && tf.id !== p.timeField)
    ? '请求的时间轴「' + p.timeField + '」这个指标没有，已改用「' + tf.label + '」'
    : '';
  if (wantTime && !tf)
    return {ok:false, err:'指标「' + m.name + '」没有可用的时间轴，无法按日期筛选 —— 请去掉起止日期',
            metric:m};
  const rawG = Array.isArray(p.groupBy) ? p.groupBy : [];
  const gids = rawG.map(id => dims.find(d => d.id === id)).filter(Boolean);
  const badG = rawG.filter(id => !dims.some(d => d.id === id));

  const acc = new Map(); const tot = {n:0, v:0, num:0, den:0};
  for (const r of rows0){
    if (!matchSpec(r, sc.spec)) continue;
    if (tf){
      const d = String(r[tf.col] === null || r[tf.col] === undefined ? '' : r[tf.col]).slice(0, 10);
      if (from && (!d || d < from)) continue;
      if (to && (!d || d > to)) continue;
    }
    if (p.filters && !matchSpec(r, p.filters)) continue;
    accAdd(tot, m, r);
    const key = gids.map(g => labelOf(r, g));
    const ks = gids.length ? key.join('\u241F') : '';
    let a = acc.get(ks);
    if (!a){ a = {key:key, n:0, v:0, num:0, den:0}; acc.set(ks, a); }
    accAdd(a, m, r);
  }
  let out = [];
  for (const a of acc.values()) out.push({key:a.key, label:a.key.join(' / '), value:accVal(a, m), n:a.n});
  const allTime = gids.length > 0 && gids.every(g => g.t);
  out.sort(allTime ? (x, y) => (x.key.join() < y.key.join() ? -1 : 1) : (x, y) => y.value - x.value);

  return {
    ok:true, metric:m, metricName:m.name, unit:m.unit,
    scope:scopeName, scopeDesc:sc.desc,
    timeLabel:tf ? dimLabel(tf) : '', timeField:tf ? tf.id : '',
    from, to, groupBy:gids.map(g => ({id:g.id, label:g.label})),
    badGroup:badG, rows:out, matched:tot.n,
    /* ⚠️ matched 的单位：flatQuery 是**明细行**，grossQuery 是**天**（三表按日汇总后相减）。
       卡上原来一律写「命中 N 行」⇒ gross 那张卡在说谎。带上单位，显示处照它写。 */
    matchedUnit:'行',
    filters:p.filters || null, timeNote:timeNote,
    total:accVal(tot, m),
    sql:buildSql(m, sc, tf, from, to, gids, p.filters),
  };
}

/* 平台毛利：三表粒度不同，只在「出餐日」这一层对齐后相减（config: settlement.gross_profit_policy = residual） */
function grossQuery(p, m){
  const from = normDate(p.from), to = normDate(p.to);
  const inR = d => (!from || (d && d >= from)) && (!to || (d && d <= to));
  const at = (r, c) => String(r[c] === null || r[c] === undefined ? '' : r[c]).slice(0, 10);
  const rev = new Map(), cost = new Map(), cm = new Map();
  const add = (mp, d, v) => mp.set(d, (mp.get(d) || 0) + v);
  for (const r of (DATA.order || [])){
    if (!matchSpec(r, SC_ORDER['有效'].spec)) continue;
    const d = at(r, 'meal_date'); if (!inR(d)) continue;
    add(rev, d, num(r.pay_amount));
  }
  for (const r of (DATA.share || [])){
    const d = at(r, 'meal_date'); if (!inR(d)) continue;
    add(cost, d, num(r.amount));
  }
  for (const r of (DATA.commission || [])){
    if (r.status !== 'settled') continue;
    const d = at(r, 'meal_date'); if (!inR(d)) continue;
    add(cm, d, num(r.amount));
  }
  const days = Array.from(new Set([...rev.keys(), ...cost.keys(), ...cm.keys()])).sort();
  const rows = days.map(d => ({
    /* ⚠️ 不限区间时，meal_date 为空的行会被凑成「空字符串那一天」，label 也就成了空白
       ⇒ 用户看到一行没有日期的毛利，无从判断它是什么。标出来，别留白。 */
    key:[d], label:d || '（无出餐日）',
    value:(rev.get(d) || 0) - (cost.get(d) || 0) - (cm.get(d) || 0),
    n:0, parts:{售价:rev.get(d) || 0, 采购款:cost.get(d) || 0, 佣金:cm.get(d) || 0},
  }));
  const S = f => days.reduce((s, d) => s + f(d), 0);
  const total = S(d => (rev.get(d) || 0) - (cost.get(d) || 0) - (cm.get(d) || 0));
  const tf = {id:'d_meal', label:'出餐日', col:'meal_date', t:1};
  /* ⚠️ 区间也要进 SQL：旧实现把三条 SELECT 写死了，限了 from/to 而 SQL 上没有任何痕迹
     ⇒ 同样是「照着复核会得到另一个数」。 */
  const rngCond = (from || to)
    ? 'substr(meal_date,1,10) BETWEEN ' + QT(from || '0000-00-00') + ' AND ' + QT(to || '9999-99-99')
    : '';
  const whereOf = (...parts) => {
    const p = parts.filter(Boolean).join(' AND ');
    return p ? '\n WHERE ' + p : '';
  };
  const sql = '-- 三表按出餐日分别汇总后相减（粒度不同，不对齐到单）\n'
    + 'SELECT substr(meal_date,1,10) AS 日, sum(pay_amount) AS 售价 FROM ab_order'
    + whereOf("status NOT IN ('cancelled','refunded')", rngCond) + '\n GROUP BY 1;\n'
    + 'SELECT substr(meal_date,1,10) AS 日, sum(amount) AS 采购款 FROM ab_supplier_share'
    + whereOf(rngCond) + '\n GROUP BY 1;\n'
    + 'SELECT substr(meal_date,1,10) AS 日, sum(amount) AS 佣金 FROM ab_commission'
    + whereOf("status = 'settled'", rngCond) + '\n GROUP BY 1;';
  return {
    ok:true, metric:m, metricName:m.name, unit:m.unit,
    scope:'全部', scopeDesc:m.scopes['全部'].desc,
    timeLabel:'出餐日', timeField:'d_meal', from, to,
    groupBy:[{id:'d_meal', label:'出餐日'}],
    /* ⚠️ 与 flatQuery 对齐：这里 matched 是**天数**不是明细行数，单位必须换。 */
    badGroup:[], rows, matched:days.length, matchedUnit:'天', timeNote:'', filters:null, total,
    parts:{售价:S(d => rev.get(d) || 0), 采购款:S(d => cost.get(d) || 0), 佣金:S(d => cm.get(d) || 0)},
    sql,
  };
}

/* ══════════ 结果 → 人话（给模型看，也给页面看） ══════════ */
function briefOut(o, i){
  const head = (i ? '【取数 ' + i + '】' : '');
  if (!o.ok) return head + '（取数失败：' + o.err + '）';
  const L = [];
  L.push(head + o.metricName + '（单位：' + o.unit + '）');
  L.push('· 口径：' + o.scope + ' —— ' + o.scopeDesc.replace(/\*\*/g, ''));
  if (o.timeLabel) L.push('· 时间轴：按「' + o.timeLabel + '」'
    + (o.from || o.to ? '，区间 ' + (o.from || '最早') + ' ~ ' + (o.to || '最新') + '（闭区间）' : '（未限区间）'));
  /* ⚠️ 这两句原来是缺的：时间轴被悄悄换掉、或额外加了筛选条件，模型拿到的数变了却不知道 */
  if (o.timeNote) L.push('· ⚠ ' + o.timeNote);
  if (o.filters) L.push('· 附加筛选：' + scopeSql(o.filters));
  L.push('· 命中' + (o.matchedUnit || '行') + '：' + o.matched);
  if (o.parts) L.push('· 构成：' + Object.keys(o.parts).map(k => k + ' ' + o.parts[k].toFixed(2)).join('，'));
  if (o.rows.length){
    if (o.groupBy.length)
      L.push('· 分组（' + o.groupBy.map(g => g.label).join(' × ') + '）：');
    else
      L.push('· 未分组，直接是合计：');
    for (const r of o.rows) L.push('    ' + r.label + ' = ' + fmtVal(r.value, o.metric));
  }
  L.push('· 合计 = ' + fmtVal(o.total, o.metric) + ' ' + o.unit);
  if (o.badGroup && o.badGroup.length)
    L.push('⚠ 以下维度这个指标没有，已忽略：' + o.badGroup.join('、'));
  return L.join('\n');
}

/* ══════════ 页面上的「本次取数」卡 ══════════ */
function resultCard(outs){
  const blocks = outs.map((o, i) => {
    if (!o.ok)
      return '<div class="warnbox">取数没成功：' + esc(o.err)
        + (o.known ? '<br>可用指标：' + esc(o.known) : '') + '</div>';
    const gs = o.groupBy.map(g => g.label);
    let tbl = '';
    if (o.rows.length){
      tbl = '<table><thead><tr>' + (gs.length ? gs.map(g => '<th>' + esc(g) + '</th>').join('') : '<th>合计</th>')
        + '<th class="num">' + esc(o.metricName) + '（' + esc(o.unit) + '）</th></tr></thead><tbody>'
        + o.rows.map(r => '<tr>' + (gs.length
            ? r.key.map((k, k2) => '<td>' + esc(r.key[k2]) + '</td>').join('')
            : '<td>' + esc(o.metricName) + ' 合计</td>')
          + '<td class="num">' + fmtVal(r.value, o.metric) + '</td></tr>').join('')
        + (gs.length ? '<tr class="tot"><td colspan="' + gs.length + '">合计</td><td class="num">'
            + fmtVal(o.total, o.metric) + '</td></tr>' : '')
        + '</tbody></table>';
    } else {
      tbl = '<div class="warnbox">这一组条件没有命中任何记录 —— 区间或口径可能选得太窄。</div>';
    }
    return '<div class="calcbox">'
      + '<div><b>指标</b> ' + esc(o.metricName) + '（' + esc(o.unit) + '）'
      + '<span class="kv" style="float:right">命中 ' + o.matched + ' '
      + esc(o.matchedUnit || '行') + '</span></div>'
      + '<div><b>口径</b> ' + esc(o.scope) + ' —— ' + esc(o.scopeDesc.replace(/\*\*/g, '')) + '</div>'
      + (o.timeLabel ? '<div><b>时间轴</b> ' + esc(o.timeLabel) + esc(o.from || o.to
          ? '，' + (o.from || '最早') + ' ~ ' + (o.to || '最新') + '（闭区间）' : '（未限区间）') + '</div>' : '')
      + (o.timeNote ? '<div class="warnbox" style="margin:4px 0">⚠ ' + esc(o.timeNote) + '</div>' : '')
      /* ⚠️ 附加筛选必须上卡：它改了数，却原来既不在 SQL 里也不在卡上 ⇒ 数字无从解释 */
      + (o.filters ? '<div><b>附加筛选</b> ' + esc(scopeSql(o.filters)) + '</div>' : '')
      + (o.parts ? '<div><b>构成</b> ' + Object.keys(o.parts).map(k =>
          esc(k) + ' ' + o.parts[k].toFixed(2)).join(' · ') + '</div>' : '')
      + '<div><b>合计</b> <span class="big" style="font-size:17px">'
      + fmtVal(o.total, o.metric) + '</span> ' + esc(o.unit) + '</div>'
      + tbl
      + '<pre>' + esc(o.sql) + '</pre>'
      + '<div style="margin-top:6px">上面是这次取数的等价 SQL —— 口径、时间轴、分组都在里面，可照着复核。</div>'
      + '</div>';
  }).join('');
  return '<div class="evcard"><div class="t">本次取数（数字由本页引擎算，模型不参与计算）</div>'
    + blocks + '</div>';
}

/* ══════════ 模型侧：取数块协议 ══════════ */
function extractPlans(s){
  const out = [];
  const re = /<<Q>>([\s\S]*?)<<\/Q>>/g;
  let m;
  while ((m = re.exec(s))){
    const t = m[1].trim();
    try { out.push(JSON.parse(t)); } catch (e){ out.push({__parse_error:t}); }
  }
  return out.slice(0, 3);
}
/* 流式显示时要把取数块藏起来 —— 否则用户会看到一行丑 JSON 在屏幕上滚。
   未闭合的尾巴也一并截掉，避免半截 JSON 闪出来。 */
function maskQ(s){
  return s.replace(/<<Q>>[\s\S]*?<<\/Q>>/g, '').replace(/<<Q>>[\s\S]*$/, '');
}
function briefForModel(outs){
  return '【取数结果】（由页面引擎在数据快照上确定算出，数字请照抄，不要改写或再计算）\n\n'
    + outs.map((o, i) => briefOut(o, outs.length > 1 ? i + 1 : 0)).join('\n\n')
    + '\n\n请据此作答：先给结论，再说明你用的是哪个口径、哪条时间轴；'
    + '若某项取数失败，就说明这一项查不到，不要用别的数替代。';
}

/* ══════════ 系统提示的「业务数据」段（由指标字典生成，不手写第二份） ══════════ */
function dataPrompt(){
  const L = [];
  L.push('【业务数据】');
  L.push('⚠️ 优先级（先读这条）：问题问的是**业务数量 / 金额 / 比例 / 排名 / 合计**时，必须**先去取数** ——');
  L.push('「资料里没有这个数」**绝不是**不取数的理由（资料是文档，业务数在数据快照里，两者不是一回事）。');
  L.push('只有取数本身失败（指标不存在 / 区间内无命中）时，才说查不到。');
  L.push('除文档外，你还能查项目**开发库快照**里的业务数据。但只要问题要"算数"（数量、金额、比例、');
  L.push('排名、对比、合计），你**一个加减乘除都不许做** —— 必须先在回答里单独写一行取数块，由系统去算：');
  L.push('');
  L.push('<<Q>>{"metric":"order_count","scope":"有效","timeField":"d_meal","from":"2026-09-18","to":"2026-09-24","groupBy":["d_meal"]}<</Q>>');
  L.push('');
  L.push('取数字段：metric 指标 id · scope 口径名 · timeField 时间轴 id · from/to 闭区间（YYYY-MM-DD，可省）'
       + ' · groupBy 维度 id 数组（可省；省掉就是合计一个数）。一次最多 3 个取数块，写在正文里即可。');
  L.push('系统算完会把结果回给你，你再据结果作答。数字一律照抄，不要改写、不要四舍五入、不要自己加总。');
  L.push('');
  L.push('可用指标（id ｜ 名称 ｜ 单位 ｜ 默认口径）：');
  for (const m of METRICS){
    const scs = Object.keys(m.scopes).join('/');
    const dms = m.dims.map(id => dimLabel(DIMS[id]) + '(' + id + ')').join('、') || '无';
    L.push('· ' + m.id + ' ｜ ' + m.name + ' ｜ ' + m.unit + ' ｜ 默认「' + m.default_scope + '」');
    L.push('    口径：' + scs);
    L.push('    维度/时间轴：' + dms + '（带"日"字的可作 timeField）');
  }
  L.push('');
  L.push('数据快照时间：' + (META ? META.snapshotAt : '') + '。快照来自' + (META ? META.dbFile : '')
       + '，**是开发库**（含演示种子与人工测试数据），不是生产数据，回答里要讲清这一点。');
  L.push('相对时间（今天 / 昨天 / 本周 / 上周 / 近 7 天）先按快照日换算成 from/to 再写进取数块；'
       + '你换算出哪段区间，取数卡上就显示哪段，用户看得见，所以别猜。');
  L.push('⚠️ 带「（UTC 文本）」的时间轴（下单日/支付日/结算日/退款日/到账日）取自 datetime 列，'
       + '按日期前缀切片，可能与界面上的北京时间差一天 —— 能用「出餐日」（meal_date）就别用这几个；'
       + '非用不可时，在答案里点明这一条。');
  L.push('跨表合并的派生指标，本页只提供 gross_profit 这一个（其余要自己拼的合并一律不做，直说做不到）；'
       + '快照里没有的指标（复购率、留存率等）→ 直说"快照里没有这个指标"，不要用别的数凑。');
  L.push('若问题既能用文档答、又能用数据答（比如"结算周期是多久"是文档，"上周结了多少"是数据），'
       + '按问题的真实意图选一条路；两者都需要时可以同时给。');
  return L.join('\n');
}

/* ══════════ 「问数」页：指标口径卡 + 直接计算（不耗模型额度） ══════════ */
let calcInit = false;
function showCalc(){
  if (!calcInit) buildCalcForm();
  renderMetricCards();
}

function buildCalcForm(){
  const sel = document.getElementById('cm');
  sel.innerHTML = METRICS.map(m => '<option value="' + esc(m.id) + '">'
    + esc(m.name) + '（' + esc(m.unit) + '）</option>').join('');
  sel.onchange = syncCalcControls;
  document.getElementById('cs').onchange = () => calc();
  document.getElementById('ct').onchange = () => calc();
  document.getElementById('cfrom').onchange = () => calc();
  document.getElementById('cto').onchange = () => calc();
  document.getElementById('cgo').onclick = () => calc();
  document.getElementById('cquick').onclick = () => {
    const day = META ? META.snapshotAt.slice(0, 10) : '';
    if (!day) return;
    const t = new Date(day + 'T00:00:00');
    t.setDate(t.getDate() - 6);
    document.getElementById('cfrom').value = ymd(t);   // ⚠️ 不能用 toISOString：那是 UTC，东部时区会差一天
    document.getElementById('cto').value = day;
    calc();
  };
  calcInit = true;
  syncCalcControls();
}

const curMetric = () => METRICS.find(m => m.id === document.getElementById('cm').value) || METRICS[0];

function syncCalcControls(){
  const m = curMetric();
  const cs = document.getElementById('cs');
  cs.innerHTML = Object.keys(m.scopes).map(k =>
    '<option value="' + esc(k) + '"' + (k === m.default_scope ? ' selected' : '') + '>'
    + esc(k) + '</option>').join('');
  const dims = m.dims.map(id => DIMS[id]).filter(Boolean);
  const times = dims.filter(d => d.t);
  const ct = document.getElementById('ct');
  ct.innerHTML = times.map(d => '<option value="' + esc(d.id) + '">' + esc(dimLabel(d)) + '</option>').join('')
    || '<option value="">（无时间轴）</option>';
  ct.disabled = !times.length;
  document.getElementById('cfrom').disabled = !times.length;
  document.getElementById('cto').disabled = !times.length;
  document.getElementById('cg').innerHTML = '<span class="t">分组：</span>' + (dims.length
    ? dims.map(d => '<label><input type="checkbox" value="' + esc(d.id) + '">' + esc(d.label)
        + '</label>').join('')
    : '<span class="t">（这个指标没有维度，只能算合计）</span>');
  for (const el of document.querySelectorAll('#cg input')) el.onchange = () => calc();
  calc();
}

function calc(){
  const m = curMetric();
  const tf = document.getElementById('ct').value;
  const plan = {
    metric: m.id,
    scope: document.getElementById('cs').value,
    timeField: tf,
    from: document.getElementById('cfrom').value,
    to: document.getElementById('cto').value,
    groupBy: Array.from(document.querySelectorAll('#cg input:checked')).map(x => x.value),
  };
  const o = runQuery(plan);
  const head = '<div class="hint">' + esc(o.ok
    ? o.metricName + ' · ' + o.matched + ' ' + (o.matchedUnit || '行') + '命中'
    : '没算成') + '</div>';
  document.getElementById('cout').innerHTML = head + resultCard([o]);
}

function renderMetricCards(){
  const box = document.getElementById('cmlist');
  if (!box) return;
  box.innerHTML = METRICS.map(m => {
    const scs = Object.keys(m.scopes).map(k =>
      '<span class="pill' + (k === m.default_scope ? '' : ' d') + '">' + esc(k) + '</span>').join('');
    const dms = m.dims.map(id => dimLabel(DIMS[id])).join('、') || '无';
    return '<div class="mcard"><div class="mh"><span class="mn">' + esc(m.name) + '</span>'
      + '<span class="mu">单位 ' + esc(m.unit) + ' · 默认口径「' + esc(m.default_scope) + '」</span>'
      + '<span class="tag k" style="margin-left:auto">' + esc(m.id) + '</span></div>'
      + '<div class="mt"><b>口径</b>（加粗的是默认）：' + scs + '</div>'
      + '<div class="mt"><b>维度</b>：' + esc(dms) + '</div>'
      + '<div class="mt"><b>口径说明</b>：' + esc(m.scopes[m.default_scope].desc.replace(/\*\*/g, '')) + '</div>'
      + (m.q ? '<div class="mq" data-q="' + esc(m.q) + '">试问：' + esc(m.q) + '　→</div>' : '')
      + '</div>';
  }).join('');
  for (const el of box.querySelectorAll('.mq'))
    el.onclick = () => {
      for (const t of document.querySelectorAll('.tab'))
        if (t.dataset.v === 'ask') t.click();
      document.getElementById('qi').value = el.dataset.q;
      document.getElementById('qi').focus();
    };
}

/* ══════════ 载入与注入 ══════════ */
async function bootCalc(){
  try {
    const b64 = document.getElementById('metrics').textContent.replace(/\s+/g, '');
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const txt = await new Response(
      new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))
    ).text();
    const d = JSON.parse(txt);
    DATA = d.t; META = d.meta;
    buildIdx();
    const rows = Object.keys(META.rows).reduce((s, k) => s + META.rows[k], 0);
    document.getElementById('meta2').textContent =
      '业务数据 ' + rows.toLocaleString() + ' 行 · 快照 ' + META.snapshotAt + ' · 开发库（非生产）';
    /* 把「业务数据」段接进系统提示。SYS_PROMPT 在 build2.py 里声明为 let，故可追加 */
    SYS_PROMPT += '\n\n' + dataPrompt();
    SUGGESTIONS.push('上周一共多少单？', '各等级团长的佣金分别是多少？', '待付供应商的采购款一共多少？');
    document.getElementById('sug').innerHTML =
      SUGGESTIONS.map(s => '<span>' + esc(s) + '</span>').join('');
  } catch (e){
    document.getElementById('meta2').textContent = '业务数据载入失败：' + e.message + '（问数不可用，检索与问答不受影响）';
    DATA = null;
  }
}

/* 注入给 build2.py 那边的 ask() 用：hideQ 负责藏取数块，Q 是引擎入口 */
hideQ = maskQ;
Q = {extract: extractPlans, run: runQuery, card: resultCard, brief: briefForModel};

bootCalc();
