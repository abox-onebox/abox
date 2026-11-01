/* ─────────────────────────────────────────────────────────────
   E1 知识助手 · 问数引擎（calc.js）构建期自检

   ⚠️ 为什么要有这个：E1 走的是 `_tmp/kb/` 这条链，**没有** `selftest.py`，
      而其他 11 件单文件工具都有「构建期判据 + 负控」双闸门。本件补上同一道。

   三条不许偷懒的纪律（与 11 件同源）：
      ① 每条判据配**必报样本（负控）**，并断言它**真的变红** —— 恒绿与恒红同罪。
      ② 「必不报样本」用**真实且未改动**的源件本身，不凭空构造。
      ③ 变异锚点一律选**完整的单行**（多行结构当锚点会写出语法错误）。

   判据跑的是**源件** calc.js 的纯逻辑段（DIMS → grossQuery，DOM 依赖都在那之后）；
   另有一组「产物新鲜度」判据，确认修复真的进了两份产物且两处 sha256 一致。
   ───────────────────────────────────────────────────────────── */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const ROOT = 'C:/Users/herma/WorkBuddy/ABox小程序';
const KB = path.join(ROOT, '_tmp', 'kb');
const CUT = '/* ══════════ 结果 → 人话';
const RET = `
  return {setData:(d,m)=>{DATA=d;META=m||{};buildIdx();},
          DIMS, METRICS, runQuery, normDate, buildSql, fmtVal, scopeSql};
`;

const SRC = fs.readFileSync(path.join(KB, 'calc.js'), 'utf8');

function build(src) {
  const i = src.indexOf(CUT);
  if (i < 0) throw new Error('找不到纯逻辑段的分界注释 —— calc.js 结构变了，本自检会静默失效');
  return new Function(src.slice(0, i) + RET)();
}

const DATA = {
  order: [
    { id: 1, status: 'completed', meal_date: '2026-09-20', pay_amount: 25.8, total_amount: 25.8, quantity: 1, building_id: 1 },
    { id: 2, status: 'cancelled', meal_date: '2026-09-20', pay_amount: 25.8, total_amount: 25.8, quantity: 1, building_id: 1 },
    { id: 3, status: 'refunded', meal_date: '2026-09-21', pay_amount: 51.6, total_amount: 51.6, quantity: 2, building_id: 1 },
    { id: 4, status: 'refund_applying', meal_date: '2026-09-21', pay_amount: 25.8, total_amount: 25.8, quantity: 1, building_id: 1 },
    { id: 5, status: 'completed', meal_date: '2026-09-22', pay_amount: 77.4, total_amount: 77.4, quantity: 3, building_id: 1 },
    { id: 6, status: 'completed', meal_date: '', pay_amount: 999, total_amount: 999, quantity: 9, building_id: 1 },
  ],
  commission: [
    { id: 1, status: 'settled', meal_date: '2026-09-20', amount: 2.32 },
    { id: 2, status: 'pending', meal_date: '2026-09-21', amount: 9.99 },
    { id: 3, status: 'settled', meal_date: '2026-09-22', amount: 6.96 },
  ],
  share: [{ id: 1, meal_date: '2026-09-20', amount: 12.0 }, { id: 2, meal_date: '2026-09-22', amount: 36.0 }],
  balance: [{ id: 1, balance: 100, frozen: 5 }],
  withdraw: [{ id: 1, status: 'success', created_at: '2026-09-20T01:00:00Z', paid_at: '2026-09-21T01:00:00Z', amount: 30 }],
  refund: [{ id: 1, status: 'refunded', created_at: '2026-09-21T01:00:00Z', refunded_at: '2026-09-21T02:00:00Z', amount: 51.6 }],
  delivery: [{ id: 1, meal_date: '2026-09-20', total_quantity: 5 }],
  dish_daily: [{ id: 1, produce_date: '2026-09-20', plan_quantity: 10, actual_quantity: 9 }],
  assignment: [{ id: 1, meal_date: '2026-09-20', sold_count: 5 }],
  building: [{ id: 1, name: 'A 座' }],
};

const api = build(SRC);
api.setData(DATA, { snapshotAt: '2026-09-26T00:00:00', dbFile: 'dev.db', rows: {} });

/* ══════════ 判据（必不报样本 = 当前源件） ══════════ */
const rows = [];
const add = (name, ok, detail) => rows.push({ name, ok: !!ok, detail: detail || '' });

{
  const o = api.runQuery({ metric: 'order_count', scope: '有效' });
  add('① 有效口径 ∉{cancelled, refunded} ⇒ refund_applying 仍计入（与真源 leader-order.ts:185 一致）',
    o.total === 4, '实得 ' + o.total);
}
{
  const o = api.runQuery({ metric: 'aov', scope: '有效' });
  const want = (25.8 + 25.8 + 77.4 + 999) / 4;
  add('② 客单价分母是「单量」不是列名（此处曾恒为 0）',
    o.total.toFixed(2) === want.toFixed(2), o.total.toFixed(2) + ' vs ' + want.toFixed(2));
}
{
  const o = api.runQuery({ metric: 'order_count', scope: '有效', timeField: 'd_meal', from: '2026-09-20', to: '2026-09-22' });
  add('③ 限区间后空日期行被排除', o.total === 3, '实得 ' + o.total);
}
{
  const o = api.runQuery({ metric: 'order_count', scope: '有效', filters: { status: { eq: 'completed' } } });
  add('④ ⭐ 附加筛选必须进等价 SQL（页面承诺「可照着复核」）',
    /status = 'completed'/.test(o.sql), o.sql.indexOf("status = 'completed'") >= 0 ? 'SQL 含该条件' : 'SQL 里没有');
}
{
  const o = api.runQuery({ metric: 'order_count', scope: '有效', timeField: 'o_leader', from: '2026-09-20' });
  add('⑤ 传非时间维度作 timeField ⇒ 回退到第一个时间维度', o.timeField === 'd_meal', o.timeField);
}
{
  const o = api.runQuery({ metric: 'gross_profit' });
  const blanks = o.rows.filter(r => r.label === '');
  add('⑥b ⭐ 毛利表里空出餐日不得留白（要标成「（无出餐日）」）',
    blanks.length === 0, blanks.length ? '仍有 ' + blanks.length + ' 行空白' : '无空白行');
  add('⑬ ⭐ matched 单位分野：flatQuery 是「行」、grossQuery 是「天」',
    api.runQuery({ metric: 'order_count', scope: '有效' }).matchedUnit === '行'
    && o.matchedUnit === '天',
    'flat=' + api.runQuery({ metric: 'order_count', scope: '有效' }).matchedUnit + ' · gross=' + o.matchedUnit);
}
{
  const o = api.runQuery({ metric: 'order_count', scope: '有效', timeField: 'o_leader', from: '2026-09-20' });
  add('⑭ ⭐ 时间轴被换掉时必须有提示（不许静默换口径）',
    !!o.timeNote && o.timeNote.indexOf('o_leader') >= 0, o.timeNote || '（空）');
}
{
  const o = api.runQuery({ metric: 'gross_profit' });
  const want = (25.8 + 25.8 + 77.4 + 999) - (12 + 36) - (2.32 + 6.96);
  add('⑦ 毛利 = 售价 − 采购款 − 已结算佣金', o.total.toFixed(2) === want.toFixed(2),
    o.total.toFixed(2) + ' vs ' + want.toFixed(2));
}
{
  const o = api.runQuery({ metric: 'gross_profit', from: '2026-09-21', to: '2026-09-22' });
  add('⑧ 毛利限区间 ⇒ 天数收敛，且 SQL 里带着区间',
    o.rows.length === 2 && /BETWEEN/.test(o.sql), o.rows.length + ' 天 · SQL 含 BETWEEN=' + /BETWEEN/.test(o.sql));
}
{
  const o = api.runQuery({ metric: 'order_count', scope: '有效', timeField: 'd_meal', from: '2030-01-01', to: '2030-01-02' });
  add('⑩ 零命中 ⇒ matched=0 且不伪装成有数', o.matched === 0, 'matched=' + o.matched);
}
{
  const o = api.runQuery({ metric: 'order_count', scope: '有效', groupBy: ['o_building'] });
  add('⑪ 分组键按 ref 翻译成名字', o.rows[0] && o.rows[0].key[0] === 'A 座', o.rows[0] ? o.rows[0].key[0] : '（无行）');
}
add('⑫ 未知指标 ⇒ 报错而不是给数',
  api.runQuery({ metric: 'nope' }).ok === false && api.runQuery({ __parse_error: '{bad' }).ok === false);

/* ══════════ 产物新鲜度：修复真的进去了，且两份产物一致 ══════════ */
const MARKERS = [
  ['④ 的修复', "push(filters ? scopeSql(filters) : '');"],
  ['⑥b 的修复', "label:d || '（无出餐日）'"],
  ['⑬ 的修复', "matchedUnit:'天'"],
  ['⑭ 的修复', "'请求的时间轴「'"],
];
const PRODS = [
  path.join(ROOT, '_ABox一盒知识助手v4.0.html'),
  path.join(ROOT, '_app', 'abox-kb', 'index.html'),
];
const sha = {};
for (const p of PRODS) {
  if (!fs.existsSync(p)) { add('产物存在：' + path.basename(p), false, '找不到 ' + p); continue; }
  const s = fs.readFileSync(p, 'utf8');
  sha[p] = crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
  const miss = MARKERS.filter(m => s.indexOf(m[1]) < 0).map(m => m[0]);
  add('⑮ 产物含全部 4 处修复：' + path.basename(p), miss.length === 0,
    miss.length ? ('缺：' + miss.join('、')) : '4/4 · sha256 ' + sha[p]);
}
if (Object.keys(sha).length === 2) {
  const [a, b] = Object.values(sha);
  add('⑯ 两份产物 sha256 一致（工作区根 ↔ _app/abox-kb）', a === b, a + ' vs ' + b);
}

/* ══════════ 负控：每条 ⭐ 判据都要能真的变红 ══════════ */
const neg = [];
function negCase(name, oldStr, newStr, check) {
  const n = SRC.split(oldStr).length - 1;
  if (n !== 1) { neg.push({ name, fired: false, detail: '锚点命中 ' + n + ' 次（要求恰好 1 次）' }); return; }
  let fired = false, detail = '';
  try {
    const a2 = build(SRC.replace(oldStr, newStr));
    a2.setData(DATA, { snapshotAt: '2026-09-26T00:00:00', dbFile: 'dev.db', rows: {} });
    fired = check(a2) === false;   // 判据必须转成 false
    detail = fired ? '已变红' : '判据仍为绿（负控没点着火）';
  } catch (e) { detail = '负控抛异常：' + (e && e.message); }
  neg.push({ name, fired, detail });
}

negCase('④ SQL 里不再拼 filters（回到旧实现）',
  "  push(filters ? scopeSql(filters) : '');", "  push('');",
  a2 => /status = 'completed'/.test(a2.runQuery({ metric: 'order_count', scope: '有效', filters: { status: { eq: 'completed' } } }).sql));

negCase('⑥b 空出餐日 label 恢复成留白',
  "    key:[d], label:d || '（无出餐日）',", '    key:[d], label:d,',
  a2 => a2.runQuery({ metric: 'gross_profit' }).rows.filter(r => r.label === '').length === 0);

negCase('⑬ gross 的 matchedUnit 谎报成「行」',
  "matchedUnit:'天'", "matchedUnit:'行'",
  a2 => a2.runQuery({ metric: 'gross_profit' }).matchedUnit === '天');

negCase('⑭ 时间轴被换掉时不给提示（回到静默回退）',
  '(p.timeField && tf && tf.id !== p.timeField)', '(false)',
  a2 => {
    const o = a2.runQuery({ metric: 'order_count', scope: '有效', timeField: 'o_leader', from: '2026-09-20' });
    return !!o.timeNote && o.timeNote.indexOf('o_leader') >= 0;
  });

/* ══════════ 输出 ══════════ */
const bad = rows.filter(r => r.ok === false).length;
const negFired = neg.filter(n => n.fired).length;
console.log('判据 ' + (rows.length - bad) + '/' + rows.length + ' · 负控 ' + negFired + '/' + neg.length);
for (const r of rows) console.log((r.ok ? '✔ ' : '✗ ') + r.name + (r.detail ? '  —— ' + r.detail : ''));
for (const n of neg) console.log((n.fired ? '✔ ' : '✗ ') + '负控 ' + n.name + ' —— ' + n.detail);
process.exit(bad || negFired !== neg.length ? 1 : 0);
