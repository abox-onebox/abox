/**
 * 临时探针（用完即删）：**退款账务效果能否被双执行**（P1-1 的边界探底）
 *
 * 背景：P1-1 只把「佣金冲销」改成了原子占位（`UPDATE ab_commission WHERE id=? AND status=?`）。
 * 但 `ReversalService.refundBalancePart()` 是**无条件** `balance += amount`，
 * 而 `approveByAdmin` 对 `ab_refund` 行的状态判定是**先读后写**（无原子占位）。
 * 两者叠加 → 「同一张单被处理两次时，余额会被退两次」。
 *
 * 做法：给同一张订单**插两条 `applying` 退款单**，然后**并发**调两次 approve
 * （无需真实并发窗口也行 —— 两条单各自通过自己的状态闸门，等价于两次执行）。
 * 纯余额单（`pay_amount = 0`）→ 不碰微信通道，只暴露 DB 账务不变量。
 *
 * 判据：
 *   · 余额只增一次 → 现实现已安全（或 sqlite 串行化挡住了）
 *   · 余额增了两次 → **真实缺陷**：同一单被退两次，且无任何报错
 */
process.env.E2E_PORT = '3199';
process.env.ABOX_SHIFT_TO_HOUR = '20';
process.env.QUEUE_DRIVER = 'memory';
process.env.QUEUE_BACKOFF_BASE_MS = '20';

import { createRequire } from 'node:module';

const m = await import('../abox-onebox/scripts/lib/e2e-server.mjs');
// ESM 不认 NODE_PATH：从仓库根解析 better-sqlite3
const require = createRequire(`${m.ROOT}/package.json`);
const Database = require('better-sqlite3');
const db = new Database(m.DB_PATH);

await m.assertPortFree(m.PORT);
const child = m.startApiServer(m.PORT, { ABOX_RATE_LIMIT: 'off' });
if (!(await m.waitHealthy(m.BASE, { child }))) {
  console.log('服务未就绪');
  await m.stopApiServer(child, m.PORT);
  process.exit(1);
}

const post = async (path, body, token) => {
  const r = await fetch(`${m.BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const login = await post('/auth/admin-login', { username: 'admin', password: 'admin123' });
const token = login.body?.data?.token;
if (!token) {
  console.log('后台登录失败：', JSON.stringify(login.body));
  await m.stopApiServer(child, m.PORT);
  process.exit(1);
}

// ---------------------------------------------------------------- 夹具
const order = db
  .prepare(
    `SELECT id, order_no, user_id, total_amount, discount_amount, pay_amount, balance_used, status
     FROM ab_order WHERE status IN ('refunded','cancelled') ORDER BY id DESC LIMIT 1`,
  )
  .get();
if (!order) {
  console.log('库里找不到可用的历史订单，先跑 seed');
  await m.stopApiServer(child, m.PORT);
  process.exit(1);
}

const userId = Number(order.user_id);
const amount = Number(order.total_amount) - Number(order.discount_amount);
const balRow = db.prepare('SELECT id, balance FROM ab_balance WHERE user_id = ?').get(userId);
if (!balRow) {
  db.prepare(
    `INSERT INTO ab_balance (user_id, balance, frozen, total_in, total_out, version, created_at, updated_at)
     VALUES (?, '0.00', '0.00', '0.00', '0.00', 1, datetime('now'), datetime('now'))`,
  ).run(userId);
}

// 还原用快照
const snap = {
  order,
  balance: db.prepare('SELECT balance, frozen FROM ab_balance WHERE user_id = ?').get(userId),
  logIds: db.prepare('SELECT MAX(id) mx FROM ab_balance_log').get().mx,
  refundIds: db.prepare('SELECT MAX(id) mx FROM ab_refund').get().mx,
  commIds: db.prepare('SELECT MAX(id) mx FROM ab_commission').get().mx,
};

// 把订单改成「纯余额实付 + 退款申请中」
db.prepare(
  `UPDATE ab_order SET status = 'refund_applying', pay_amount = '0.00',
     balance_used = ?, total_amount = ?, discount_amount = '0.00' WHERE id = ?`,
).run(String(amount), String(amount), order.id);
db.prepare("UPDATE ab_balance SET balance = '0.00' WHERE user_id = ?").run(userId);

const stamp = String(Date.now()).slice(-6);
const r1 = db
  .prepare(
    `INSERT INTO ab_refund (refund_no, order_id, order_no, user_id, amount, reason_type, reason,
       status, order_status_before, reversed, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'missing', 'probe A', 'applying', 'paid', 0, 0, datetime('now'), datetime('now'))`,
  )
  .run(`PBA${stamp}`, order.id, order.order_no, userId, String(amount));
const r2 = db
  .prepare(
    `INSERT INTO ab_refund (refund_no, order_id, order_no, user_id, amount, reason_type, reason,
       status, order_status_before, reversed, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'missing', 'probe B', 'applying', 'paid', 0, 0, datetime('now'), datetime('now'))`,
  )
  .run(`PBB${stamp}`, order.id, order.order_no, userId, String(amount));

console.log(
  `\n夹具：order=${order.order_no} user=${userId} 纯余额 ¥${amount} · 两条 applying 退款单 #${r1.lastInsertRowid} #${r2.lastInsertRowid}`,
);

// ---------------------------------------------------------------- 并发双执行
const [a, b] = await Promise.all([
  post(`/admin/finance/refunds/${r1.lastInsertRowid}/approve`, { remark: 'probe A' }, token),
  post(`/admin/finance/refunds/${r2.lastInsertRowid}/approve`, { remark: 'probe B' }, token),
]);

const after = db.prepare('SELECT balance FROM ab_balance WHERE user_id = ?').get(userId);
const logs = db
  .prepare(
    "SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM ab_balance_log WHERE user_id = ? AND type = 'refund' AND id > ?",
  )
  .get(userId, snap.logIds ?? 0);
const reversals = db
  .prepare("SELECT COUNT(*) c FROM ab_commission WHERE order_id = ? AND type = 'reversal'")
  .get(order.id);

console.log(`\nA：${a.status}/${a.body?.code}  ${a.body?.message ?? ''}`);
console.log(`B：${b.status}/${b.body?.code}  ${b.body?.message ?? ''}`);
console.log(`\n余额：0 → ${after?.balance}（期望 ${amount}）`);
console.log(`退款流水：${logs?.c} 条 · 合计 ¥${logs?.s}（期望 1 条 / ¥${amount}）`);
console.log(`佣金冲销行：${reversals?.c} 条（本夹具未计佣 → 期望 0）`);

const doubled = Number(after?.balance) > amount + 0.001;
console.log(
  doubled
    ? '\n❌ **双执行可致双退**：余额被退了两次，且两条请求都返回成功、无任何报错'
    : '\n✅ 余额只退一次（本次未复现双退；注意 sqlite 单连接可能串行化了两次事务）',
);

// ---------------------------------------------------------------- 还原
db.prepare("DELETE FROM ab_refund WHERE id > ?").run(snap.refundIds ?? 0);
db.prepare("DELETE FROM ab_balance_log WHERE id > ?").run(snap.logIds ?? 0);
db.prepare("DELETE FROM ab_commission WHERE id > ?").run(snap.commIds ?? 0);
db.prepare(
  `UPDATE ab_order SET status = ?, pay_amount = ?, balance_used = ?, total_amount = ?, discount_amount = ? WHERE id = ?`,
).run(
  snap.order.status,
  snap.order.pay_amount,
  snap.order.balance_used,
  snap.order.total_amount,
  snap.order.discount_amount,
  snap.order.id,
);
db.prepare('UPDATE ab_balance SET balance = ? WHERE user_id = ?').run(
  snap.balance?.balance ?? '0.00',
  userId,
);
console.log('\n（夹具已还原）');

db.close();
await m.stopApiServer(child, m.PORT);
process.exit(0);
