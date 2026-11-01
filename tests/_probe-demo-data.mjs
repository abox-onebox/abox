/**
 * ABox · 演示数据集「可用性」探针（M5-9）
 *
 * 目的：`seed-demo.ts` 的自检只证明「数据**自己**自洽」；本探针进一步证明
 *      **这些数据真的能被页面取到** —— 即人工测试清单里的 A2/A7b/A11–A18
 *      打开时**不是空的**。两件事不同：数据对，不等于接口给得出。
 *
 * 做法：真实起 API（独立端口）→ 用 `admin` 账号登后台 → 打各页背后的接口
 *      → 断言「有行、行数够、关键枚举齐、金额非零」。
 *
 * ⚠️ 跑之前必须先 `gate.mjs seed` + `gate.mjs seed:demo`（本探针**只读**；
 *    仅 `/admin/packing-tasks` 会顺带补生产计划，那是该接口自身的幂等行为）。
 * ⚠️ 端口刻意用 3121（避开 e2e 的 3101/3102/3103 与开发服务的 3000），
 *    且**不混用** `lib/e2e-server.mjs` 导出的 `PORT/BASE`（那是给 e2e 的默认值）——
 *    混用会出「服务起 A 端口、探针探 B 端口」的假故障。
 *
 * ⚠️ 本探针**刻意测「默认视图」**（不传 date/range），因为测试人是**打开页面就看**、
 *    不会先去挑日期。默认视图为空 = 会被记成缺陷，即使库里其实有数据。
 *
 * 用法：
 *   node tests/_probe-demo-data.mjs
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  installCleanupHooks,
  makeCall,
  startApiServer,
  stopApiServer,
  waitHealthy,
} from '../abox-onebox/scripts/lib/e2e-server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
void resolve(HERE, '..');

/** 本探针专用端口（不与其他任何套件共用） */
const PROBE_PORT = Number(process.env.PROBE_PORT ?? 3121);
const BASE = `http://localhost:${PROBE_PORT}/api/v1`;

// ---------------------------------------------------------------------------
// 断言器
// ---------------------------------------------------------------------------
let passCount = 0;
let failCount = 0;
const failures = [];

function ok(cond, label, detail = '') {
  if (cond) {
    passCount += 1;
    console.log(`  ✔ ${label}${detail ? ` —— ${detail}` : ''}`);
  } else {
    failCount += 1;
    failures.push(label);
    console.log(`  ✘ ${label}${detail ? ` —— ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n──── ${title} ────`);
}

// ---------------------------------------------------------------------------
// 日期工具（与 seed-demo.ts 的 todayBj() 同口径：北京日历日）
// ---------------------------------------------------------------------------
const todayBj = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

function shift(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// 响应体形状读取
// ---------------------------------------------------------------------------
/**
 * 取 `body.data.<key>` 的数组（按候选 key 依次尝试）。
 * 各页出参不统一（`list` / `items` / `groups` / `centers` …），
 * 硬编码单一字段名会写出一堆**与被测对象无关**的假红。
 */
function rowsAt(body, keys = ['list', 'items', 'rows', 'records']) {
  const d = body?.data;
  if (Array.isArray(d)) return { path: 'data[]', rows: d };
  if (d && typeof d === 'object') {
    for (const k of keys) if (Array.isArray(d[k])) return { path: `data.${k}`, rows: d[k] };
  }
  return { path: '(无数组)', rows: [] };
}

function okRows(body, label, min = 1, keys) {
  const { path, rows } = rowsAt(body, keys);
  ok(rows.length >= min, label, `${path} · ${rows.length} 行`);
  return rows;
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * 只保留**演示数据集**的行。
 *
 * ⚠️ 为什么必须收敛：dev 库是**多个套件共用**的 —— `gate.mjs all verify` 结尾的
 *    每个 e2e 都会往库里写自己那批订单 / 配送单（别的楼群、别的日期，甚至「明日」）。
 *    若断言直接看全库的「默认视图」，跑过 e2e 之后再跑本探针就会红 ——
 *    而**红的原因与演示数据无关**（那是 e2e 残留）。故凡涉及「默认视图」的断言，
 *    一律先收敛到演示单号前缀 / 演示备注。
 */
const isDemoRow = (row) => {
  const s = JSON.stringify(row);
  return s.includes('AB0000') || s.includes('演示数据（seed:demo）');
};
const demoRows = (rows) => rows.filter(isDemoRow);

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
async function main() {
  const TODAY = todayBj();
  const d = (n) => shift(TODAY, n);

  installCleanupHooks();

  console.log('ABox 演示数据集可用性探针');
  console.log(`  今天（北京）= ${TODAY} · 演示出餐日区间 = ${d(-9)} ~ ${TODAY}`);
  console.log(`  探针端口 = ${PROBE_PORT}`);
  console.log('  说明：不传 date/range，尽量走**页面默认视图**\n');

  const child = startApiServer(PROBE_PORT, {
    ABOX_SHIFT_TO_HOUR: '20',
    QUEUE_DRIVER: 'memory',
  });
  const healthy = await waitHealthy(BASE, { child, timeoutMs: 120_000 });
  if (!healthy) {
    console.error('✖ API 未能就绪，探针中止。');
    await stopApiServer(child, PROBE_PORT);
    process.exit(1);
  }

  const call = makeCall(BASE);
  const login = await call('POST', '/auth/admin-login', {
    body: { username: 'admin', password: 'admin123' },
  });
  const token = login.body?.data?.token;
  if (!token) {
    console.error('✖ admin 登录失败：', JSON.stringify(login.body).slice(0, 300));
    await stopApiServer(child, PROBE_PORT);
    process.exit(1);
  }
  const auth = { token };
  console.log('  · admin 登录成功');

  // ---- 前置体检：库里是否混入非演示数据（e2e 残留）----
  {
    const rows = rowsAt((await call('GET', '/admin/orders?pageSize=200', auth)).body).rows;
    const foreign = rows.filter((r) => !isDemoRow(r));
    if (foreign.length) {
      console.log(
        `  ⚠ 库里有 ${foreign.length} 张**非演示**订单（多半是 e2e 残留）—— ` +
          `「默认视图」类断言已尽量按演示单号前缀收敛，但想要干净结论请先跑 ` +
          `gate.mjs seed + gate.mjs seed:demo`,
      );
    }
  }

  // =========================================================================
  section('A2 · 核心指标看板（D47–D50）');
  // =========================================================================
  {
    // ⭐ 页面默认档是 7d，所以这里**不传 range**
    const r = await call('GET', '/admin/stats/dashboard', auth);
    const m = r.body?.data?.metrics;
    ok(r.status === 200 && r.body?.code === 0, 'GET /admin/stats/dashboard 正常返回（走默认区间）');
    ok(!!m, '看板出参含 metrics');
    if (m) {
      console.log(
        `      区间 ${r.body?.data?.range?.label ?? r.body?.data?.range?.range ?? '?'} · 订单 ${m.orderCount} · 份数 ${m.quantity} · ` +
          `GMV ¥${(m.gmvFen / 100).toFixed(2)} · 客单价 ¥${(m.avgOrderAmountFen / 100).toFixed(2)} · ` +
          `待支付 ${m.pendingPayCount} · 活跃团长 ${m.activeLeaderCount} · 活跃楼栋 ${m.activeBuildingCount}`,
      );
      ok(m.orderCount >= 20, '默认区间看板订单数不是 0', `${m.orderCount}`);
      ok(m.gmvFen > 0, 'GMV 非零（页面不会显示「—」）', `¥${(m.gmvFen / 100).toFixed(2)}`);
      ok(m.pendingPayCount >= 1, '待支付计数 ≥1', `${m.pendingPayCount}`);
      ok(m.activeLeaderCount >= 2, '活跃团长 ≥2（L1/L2 在职）', `${m.activeLeaderCount}`);
      ok(m.commissionFen > 0, '佣金支出非零', `¥${(m.commissionFen / 100).toFixed(2)}`);
      ok((r.body?.data?.trend ?? []).length >= 5, '逐日趋势 ≥5 天', `${r.body?.data?.trend?.length} 天`);
    }

    // ⭐ 今天这一档（新增 T 日演示数据就是为了它）
    const rt0 = await call('GET', '/admin/stats/dashboard?range=today', auth);
    const mt0 = rt0.body?.data?.metrics;
    ok(
      num(mt0?.orderCount) > 0,
      '看板「今日」档有数（默认切到今日也不空）',
      `订单 ${mt0?.orderCount} · GMV ¥${(num(mt0?.gmvFen) / 100).toFixed(2)}`,
    );

    const br = await call('GET', '/admin/stats/building-rank', auth);
    const g = rowsAt(br.body, ['groups']).rows;
    const b = rowsAt(br.body, ['buildings']).rows;
    ok(g.length >= 2 && b.length >= 2, 'D48 楼群/楼栋榜单有行', `楼群 ${g.length} · 楼栋 ${b.length}`);
    ok(
      JSON.stringify(g).includes('华贸') || JSON.stringify(g).includes('远洋'),
      'D48 榜单里能认出演示楼群（华贸/远洋光华）',
    );

    okRows(
      (await call('GET', '/admin/stats/dish-heat', auth)).body,
      'D49 菜品热度有行',
      1,
      ['items', 'list'],
    );
    const rt = await call('GET', '/admin/stats/retention', auth);
    ok(rt.status === 200 && rt.body?.code === 0, 'D50 留存分析正常返回');
  }

  // =========================================================================
  section('订单流（D8 · 11 态可按状态筛出）');
  // =========================================================================
  {
    const all = await call('GET', '/admin/orders?pageSize=100', auth);
    const rows = rowsAt(all.body).rows;
    const demoRows = rows.filter((x) => JSON.stringify(x).includes('AB0000'));
    ok(rows.length >= 30, '订单列表有行', `${rows.length} 行`);
    ok(demoRows.length >= 30, '列表里能取到演示订单（订单号含 AB0000）', `${demoRows.length} 行`);

    for (const [st, min] of [
      ['pending_pay', 1],
      ['paid', 2],
      ['cut_off', 3],
      ['cooked', 1],
      ['delivering', 1],
      ['delivered', 2],
      ['completed', 10],
      ['cancelled', 1],
      ['refund_applying', 2],
      ['refunded', 1],
    ]) {
      const r = await call('GET', `/admin/orders?status=${st}&pageSize=100`, auth);
      const n = rowsAt(r.body).rows.length;
      ok(n >= min, `订单按 status=${st} 可筛出 ≥${min} 张`, `${n} 张`);
    }

    const kw = await call('GET', `/admin/orders?keyword=${encodeURIComponent('演示·')}&pageSize=100`, auth);
    const kwN = rowsAt(kw.body).rows.length;
    ok(kwN >= 30, '按昵称关键词「演示·」可命中演示用户订单', `${kwN} 行`);
  }

  // =========================================================================
  section('演示单号能过「读取侧」校验（#93 回归护栏）');
  // =========================================================================
  /**
   * ⚠️ 这一节回答的是**另一个问题**：不是「数据自洽吗」，而是「这批单号进得了门吗」。
   *
   * 缺陷 #93（2026-09-18）：种子单号曾是 `ABDEMO2026091830`（含字母、长度 14），
   * 而 `OrderNoParamDto` / `PayOrderNoParamDto` / `MockPaidDto` 三处都校验 `^AB\\d{16}$`
   * → **点开任何演示订单都直接 `10001`**（用户端 P5 与后台 D9 详情**同时**打不开），
   * 而 seed 的自检**全绿**、探针当时也没覆盖「按单号取详情」这一步。
   *
   * ⭐ 判据：**造数器与校验器是两个人写的** —— 自检看写入侧还不够，
   *    要让种子单号真的**走一遍读取侧的路由参数校验**。故本节的断言成对出现：
   *    ① 正证：合法单号必须**不再**报 `10001`；
   *    ② 反证：旧格式单号必须**仍**报 `10001`（否则「不报 10001」可能只是这道校验没生效）。
   */
  {
    const rows = demoRows(rowsAt((await call('GET', '/admin/orders?pageSize=100', auth)).body).rows);
    const sample = rows.find((r) => typeof r?.orderNo === 'string')?.orderNo;
    ok(!!sample, '能取到一张演示订单的单号做样本', String(sample ?? '(无)'));

    if (sample) {
      ok(/^AB\d{16}$/.test(sample), '演示单号形状满足 `^AB\\d{16}$`', sample);

      // ① 后台 D9 详情 —— 与用户端 P5 用的是**同一个** `OrderNoParamDto`
      const detail = await call('GET', `/admin/orders/${sample}`, auth);
      ok(
        detail.body?.code === 0,
        '后台按单号打开演示订单详情（D9）不再被 10001 拦下',
        `code=${detail.body?.code}`,
      );

      // ② 用户端 `/orders/:orderNo` 是**另一份** DTO 实例 —— 单独验一次
      const login = await call('POST', '/auth/login', { body: { code: 'dev:1001' } });
      const userToken = login.body?.data?.token;
      ok(!!userToken, 'mock 通道可用 dev:1001 登录（李明）');

      if (userToken) {
        const ua = { token: userToken };
        // 李明名下没有演示订单 → 预期「订单不存在」，但**不能**是 10001（格式错）
        const mine = await call('GET', `/orders/${sample}`, ua);
        ok(
          mine.body?.code !== 10001,
          '用户端按单号取详情通过**格式校验**（非本人 → 订单不存在，而非 10001）',
          `code=${mine.body?.code}`,
        );

        const legacy = await call('GET', '/orders/ABDEMO2026091830', ua);
        ok(
          legacy.body?.code === 10001,
          '反证：旧格式单号 `ABDEMO…` 仍被 10001 拒 —— 证明这道校验确实在看单号',
          `code=${legacy.body?.code}`,
        );
      }
    }
  }

  // =========================================================================
  section('财务 · 佣金（A12/A13 · 默认看**今天**）');
  // =========================================================================
  {
    // ⭐ 佣金明细页 `date` 缺省 = 今日 —— 这正是「必须有 T 日数据」的原因
    const today = await call('GET', '/admin/finance/commissions?pageSize=100', auth);
    ok(today.body?.data?.date === TODAY, '佣金明细默认日期 = 今天', String(today.body?.data?.date));
    const tRows = demoRows(rowsAt(today.body).rows);
    ok(tRows.length >= 2, '默认视图（今天）有**演示**佣金行', `${tRows.length} 行`);

    const pendToday = await call('GET', '/admin/finance/commissions?status=pending&pageSize=100', auth);
    const pn = demoRows(rowsAt(pendToday.body).rows).length;
    ok(pn >= 2, '今天可筛出 ≥2 条**待结算**佣金（两段式第一段 · 明天才入账）', `${pn} 条`);

    // settled 必须出现在「昨天及更早」—— 今天的不可能是 settled（结算跑批 T+1 02:00 才跑）
    const settledToday = await call('GET', '/admin/finance/commissions?status=settled&pageSize=100', auth);
    const sToday = demoRows(rowsAt(settledToday.body).rows).length;
    ok(
      sToday === 0,
      '今天**没有**已结算的**演示**佣金（账期未到）',
      `${sToday} 条`,
    );

    const c6 = await call(`GET`, `/admin/finance/commissions?date=${d(-6)}&pageSize=100`, auth);
    okRows(c6.body, `T-6（${d(-6)}）佣金明细有行`, 3);
    const s6 = await call('GET', `/admin/finance/commissions?date=${d(-6)}&status=settled&pageSize=100`, auth);
    ok(demoRows(rowsAt(s6.body).rows).length >= 3, 'T-6 佣金 ≥3 条已结算', `${demoRows(rowsAt(s6.body).rows).length} 条`);

    const c3 = await call('GET', `/admin/finance/commissions?date=${d(-3)}&status=cancelled&pageSize=100`, auth);
    const c3n = demoRows(rowsAt(c3.body).rows).length;
    ok(c3n >= 1, `T-3（${d(-3)}）能筛出「已冲销」佣金（退款冲销样本）`, `${c3n} 条`);

    const sum = c6.body?.data?.summary;
    ok(!!sum && num(sum.count) > 0, '佣金明细带 summary（供页面顶部合计）');
  }

  // =========================================================================
  section('财务 · 余额与提现（A14/A15）');
  // =========================================================================
  {
    const bal = await call('GET', '/admin/finance/balances?pageSize=100', auth);
    const rows = rowsAt(bal.body).rows;
    ok(rows.length >= 3, '余额账户 ≥3 个', `${rows.length} 个`);
    ok(JSON.stringify(rows).includes('演示'), '余额列表里能取到演示团长账户');
    const frozen = Math.max(0, ...rows.map((x) => num(x.frozenFen)));
    ok(frozen > 0, '存在冻结额 >0 的账户（在途提现 · A15 的冻结口径）', `¥${(frozen / 100).toFixed(2)}`);
    const liability = bal.body?.data?.liability;
    ok(num(liability?.netFen) > 0, '余额页「平台负债」合计非零', `¥${(num(liability?.netFen) / 100).toFixed(2)}`);

    const wd = await call('GET', '/admin/finance/withdrawals?tab=all&pageSize=100', auth);
    const wrows = rowsAt(wd.body).rows;
    ok(wrows.length >= 6, '提现单 ≥6 张', `${wrows.length} 张`);
    const wblob = JSON.stringify(wrows);
    for (const st of ['pending', 'approved', 'success', 'rejected', 'failed']) {
      ok(wblob.includes(`"${st}"`), `提现覆盖状态 ${st}`);
    }
    okRows(
      (await call('GET', '/admin/finance/withdrawals?tab=review&pageSize=100', auth)).body,
      '提现「待审核」Tab 有行（A15 要审的那张在这里）',
    );
  }

  // =========================================================================
  section('财务 · 退款（A16）与对账');
  // =========================================================================
  {
    const rf = await call('GET', '/admin/finance/refunds?tab=all&pageSize=100', auth);
    const rows = rowsAt(rf.body).rows;
    ok(rows.length >= 4, '退款单 ≥4 张', `${rows.length} 张`);
    const blob = JSON.stringify(rows);
    for (const st of ['applying', 'approved', 'refunded', 'rejected']) {
      ok(blob.includes(`"${st}"`), `退款覆盖状态 ${st}`);
    }
    okRows(
      (await call('GET', '/admin/finance/refunds?tab=pending&pageSize=100', auth)).body,
      '退款「待审批」Tab 有行',
    );

    // ⚠️ 对账的 `date` 是**支付日**（不是出餐日）—— 出餐日 T-6 的单在 T-7 支付
    const rec = await call('GET', `/admin/finance/reconciliation?date=${d(-7)}&pageSize=100`, auth);
    const s = rec.body?.data?.summary;
    ok(rec.status === 200 && rec.body?.code === 0, '对账接口正常返回');
    ok(rec.body?.data?.anchor === 'paidAt', '对账口径锚在「支付日」（不是出餐日）');
    ok(num(s?.matchedCount) >= 3, `对账按**支付日** ${d(-7)} 能对上 ≥3 单`, `matchedCount=${s?.matchedCount}`);
    ok(num(s?.diffFen) === 0 && s?.balanced === true, '对账账实相符（diffFen=0 · balanced）');
    ok(
      rowsAt(rec.body).rows.length === 0,
      '对账无差异时差异明细为空 —— 这是**正确**语义（该列表只装差异行）',
    );
  }

  // =========================================================================
  section('财务 · 发票三态（A17）与总览');
  // =========================================================================
  {
    const ov = await call('GET', '/admin/finance/overview?range=30d', auth);
    ok(ov.status === 200 && ov.body?.code === 0, '财务总览正常返回');
    ok(!!ov.body?.data, '财务总览出参非空');

    const month = d(-1).slice(0, 7);
    const inv = await call('GET', `/admin/finance/invoices?month=${month}&pageSize=100`, auth);
    const sm = inv.body?.data?.summary;
    const rows = rowsAt(inv.body).rows;
    ok(rows.length >= 4, `发票列表有行（${month}）`, `${rows.length} 行`);
    console.log(
      `      发票三态计数：未开 ${sm?.noneCount} · 部分开 ${sm?.partialCount} · 已开 ${sm?.fullCount}`,
    );
    ok(num(sm?.noneCount) > 0, '发票三态齐备 · 未开票');
    ok(num(sm?.partialCount) > 0, '发票三态齐备 · 部分开票');
    ok(num(sm?.fullCount) > 0, '发票三态齐备 · 已开票');
  }

  // =========================================================================
  section('供应链 · 采购应付（A11）');
  // =========================================================================
  {
    okRows((await call('GET', '/admin/supplier-shares?pageSize=100', auth)).body, '采购应付列表有行（不传 date = 全部）');
    const r = await call('GET', `/admin/supplier-shares?date=${d(-6)}&pageSize=100`, auth);
    okRows(r.body, `采购应付按出餐日 ${d(-6)} 有行`, 1);
    const ex = await call('GET', `/admin/supplier-shares/exceptions?date=${d(-6)}`, auth);
    ok(ex.status === 200 && ex.body?.code === 0, '应付异常页正常返回');
  }

  // =========================================================================
  section('履约 · 配送单（A7b/A7c/A7d）与打包任务（A7）');
  // =========================================================================
  {
    // 默认不传 date → 服务层取「最近一个有配送记录的日期」。
    // ⚠️ 该日期是**全库**最新 —— e2e 残留（会造「明日」的单）可能把它推走，故只断言「非空」。
    const dl = await call('GET', '/admin/deliveries', auth);
    ok(
      rowsAt(dl.body).rows.length >= 1,
      '配送单默认视图非空',
      `日期 ${dl.body?.data?.date} · ${rowsAt(dl.body).rows.length} 行`,
    );

    // ⭐ 明确指定今天：演示数据保证 2 行（楼群 4 已送达 / 楼群 5 一步未推）
    const dl0 = await call('GET', `/admin/deliveries?date=${TODAY}`, auth);
    const r0 = demoRows(rowsAt(dl0.body).rows);
    ok(r0.length >= 2, `今天（${TODAY}）有 ≥2 行**演示**配送单`, `${r0.length} 行`);
    const b0 = JSON.stringify(r0);
    ok(b0.includes('pending'), '今天有「待推进」的配送单 —— A7b 可当场练叫车 → 发车 → 送达');
    ok(b0.includes('arrived'), '今天有「已送达」的配送单（终态样本）');

    const d2 = demoRows(rowsAt((await call('GET', `/admin/deliveries?date=${d(-2)}`, auth)).body).rows);
    ok(d2.length >= 2, `T-2（${d(-2)}）有 ≥2 行**演示**配送单`, `${d2.length} 行`);

    const pk = await call('GET', `/admin/packing-tasks?date=${TODAY}`, auth);
    const centers = rowsAt(pk.body, ['centers']).rows;
    ok(centers.length >= 1, `打包任务（${TODAY}）返回加工场所`, `${centers.length} 个场所`);
    const withQty = centers.filter((c) => (c.routes ?? []).some((x) => num(x.quantity) > 0));
    ok(
      withQty.length >= 1,
      '今天至少一个加工场所有份数 >0（打包份数取自当日已售）',
      `${withQty.length} 个场所`,
    );
    okRows(
      (await call('GET', `/admin/packing-tasks?date=${d(-2)}`, auth)).body,
      `T-2（${d(-2)}）打包任务有行`,
      1,
      ['centers'],
    );
  }

  // =========================================================================
  section('团长名录（A19/A20）');
  // =========================================================================
  {
    const ld = await call('GET', '/admin/leaders?pageSize=100', auth);
    const blob = JSON.stringify(rowsAt(ld.body).rows);
    ok(blob.includes('演示·华贸一号团长'), '名录含演示团长 L1（正式 9%）');
    ok(blob.includes('演示·华贸二号团长'), '名录含演示团长 L2（金牌 10%）');
    ok(blob.includes('停职'), '名录含停职团长 L3（状态边界）');
    const act = await call('GET', '/admin/leaders?status=1&pageSize=100', auth);
    ok(act.status === 200 && act.body?.code === 0, '团长按状态筛选可用');
  }

  // =========================================================================
  console.log('\n──────── 汇总 ────────');
  console.log(`通过 ${passCount} · 失败 ${failCount}`);
  if (failCount) {
    console.log('\n失败项：');
    for (const f of failures) console.log(`  ✘ ${f}`);
  } else {
    console.log('演示数据集对「页面可用性」的支撑：全绿 ✅');
  }

  await stopApiServer(child, PROBE_PORT);
  process.exit(failCount ? 1 : 0);
}

main().catch(async (err) => {
  console.error('✖ 探针异常：', err);
  process.exit(1);
});
