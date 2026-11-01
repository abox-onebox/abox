/**
 * 临时探针（用完即删）：限流中间件到底**注册上了没有**
 *
 * 必须显式 `ABOX_RATE_LIMIT=on`：e2e 启动器默认给子进程 `off`（见 lib/e2e-server.mjs）。
 *
 * 判别方法：
 *   A. 对 `/auth/admin-login` 连打 12 次（**不同账号**，避开账号维度）→ 第 11 次起应 429（IP 上限 10）
 *   B. 同一账号连打 6 次 → 第 6 次应 429（账号上限 5）→ 证明 `req.body` 已解析（body-parser 顺序对）
 */
process.env.E2E_PORT = '3199';
process.env.ABOX_SHIFT_TO_HOUR = '20';
process.env.QUEUE_DRIVER = 'memory';
process.env.QUEUE_BACKOFF_BASE_MS = '20';

const m = await import('../abox-onebox/scripts/lib/e2e-server.mjs');

await m.assertPortFree(m.PORT);
const child = m.startApiServer(m.PORT, { ABOX_RATE_LIMIT: 'on' });
const up = await m.waitHealthy(m.BASE, { child });
if (!up) {
  console.log('服务未就绪');
  await m.stopApiServer(child, m.PORT);
  process.exit(1);
}

const hit = async (username) => {
  const r = await fetch(`${m.BASE}/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'badpassword' }),
  });
  const b = await r.json().catch(() => null);
  return `${r.status}/${b?.code}`;
};

// ⚠️ 顺序有讲究：两组都打同一个 IP，IP 额度（10）用光后第二组必然全 429。
//    故**账号维度先测**（此时 IP 计数 0→6，账号计数 6 > 5 → 第 6 次红），
//    再重启实例（计数清零）测 IP 维度。
const b = [];
for (let i = 1; i <= 6; i += 1) b.push(await hit(`probe_acct_nobody`));

await m.stopApiServer(child, m.PORT);
const child2 = m.startApiServer(m.PORT, { ABOX_RATE_LIMIT: 'on' });
const up2 = await m.waitHealthy(m.BASE, { child: child2 });
if (!up2) {
  console.log('第二台实例未就绪');
  await m.stopApiServer(child2, m.PORT);
  process.exit(1);
}

const a = [];
for (let i = 1; i <= 12; i += 1) a.push(await hit(`probe_${i}_nobody`));

const h = await fetch(`${m.BASE}/health`);
const health = `${h.status}`;

console.log(`\nB · 同账号 6 次（期望第 6 次 429/10005 · 账号维度 + body 已解析）：\n  ${b.join('  ')}`);
console.log(`A · 12 次不同账号（期望第 11 次起 429/10005 · IP 维度）：\n  ${a.join('  ')}`);
console.log(`C · /health 跳过限流（期望 200，且不消耗额度）：${health}`);
console.log(
  a[10] === '429/10005' && b[5] === '429/10005' && health === '200'
    ? '\n✅ 双维度均生效：中间件已挂在请求链上，且 body-parser 在它之前'
    : '\n❌ 未达预期 —— IP/账号维度或中间件注册仍有问题',
);

await m.stopApiServer(child2, m.PORT);
process.exit(0);
