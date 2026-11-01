#!/usr/bin/env node
/**
 * `_probe-k47.mjs` —— K47 补测一次性探针（**不进基线** · `_` 前缀是既定通道）
 *
 * 验证三件事（team-lead 指定）：
 *   1. **K47 主判据**：供应商出餐确认（`POST /supplier/meal/cook-confirm`）后，
 *      被截单（`cut_off`）的订单是否推进为 `cooked`。停在 `cut_off` ⇒ P1。
 *      · 连带验 **K44**：同一出餐确认原样再提交一遍应**不报错**、
 *        提示「新增确认 0 项，跳过 1 项」（`skipped` 长度 1、`confirmed` 长度 0）。
 *   2. **K47 连带半边**：履约链 `cooked → delivering → delivered`
 *      （`PATCH /admin/deliveries/:id/status` 三次推进），跳步应被拒（`30018`，见 K15）。
 *      送达后订单仍停在「配送中」(`delivering`) ⇒ P1。
 *   3. 时间口径「当天显示待入账」不涉及本探针。
 *
 * ## 为什么这样构造夹具（可复现的关键）
 * 单主体自营下 `ab_meal_assignment` 只有 group1（`sold_count=45`，`distribution_center_id=1`）
 * 有销量 ⇒ 截单（`cutoff`）触发 `freezeProducePlan` 时**只会**给「集散中心 1」生成
 * 4 家供应商各一道菜的生产计划明细（`ab_supplier_dish_center_daily`）。
 * 「菜到齐」判据是**该中心当日所有 effective 明细全部 confirmed**
 * ⇒ 必须 4 家供应商都确认本中心的菜，中心才「到齐」、订单才推进。
 * 但种子里只有 `sanweiwu`（supplier 1）有后台账号 ⇒ 探针**先复制一份
 * `sanweiwu` 的后台账号**给 supplier 2/3/4（`password_hash` 照抄，
 * 口令仍是 `supplier123`），再用真接口逐家确认 —— 全程走真实业务代码，不直改状态。
 *
 * ## 前置（本探针自行完成，幂等）
 *   · 把 `AB2026092177921925`（user 3529 · group1 · 09-22 · qty2）复位为 `paid`
 *   · 清空 09-22 的 `ab_supplier_dish_center_daily` 与 `ab_delivery_record`（让截单重生成）
 *   · 补齐 supplier 2/3/4 的后台账号
 *
 * ## 运行
 *   node scripts/_probe-k47.mjs
 */
import { DatabaseSync } from 'node:sqlite';

import {
  BASE,
  DB_PATH,
  PORT,
  assertPortFree,
  installCleanupHooks,
  makeCall,
  sleep,
  startApiServer,
  stopApiServer,
  waitHealthy,
} from './lib/e2e-server.mjs';

const DATE = '2026-09-22';
const ORDER_NO = 'AB2026092177921925';
const USER_CODE = 'dev:qa_member'; // → user 3529（openid mock_openid_qa_member）
const CENTER_ID = 1;
const GROUP_ID = 1;
const SUPPLIER_LOGINS = [
  ['sanweiwu', 1, '三味屋'],
  ['qa_sup2', 2, '四季鲜蔬'],
  ['qa_sup3', 3, '京味小馆'],
  ['qa_sup4', 4, '老李家'],
];

const assertions = [];
const rec = (id, title, verdict, actual, evidence) => {
  assertions.push({ id, title, verdict, actual, evidence });
  console.log(`[${verdict}] ${id} ${title}\n        actual: ${actual}`);
};
const trunc = (v, n = 1200) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s && s.length > n ? `${s.slice(0, n)}…(truncated)` : s;
};
/** 输出前一律抹掉令牌（避免证据文件里落 JWT） */
const redact = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === 'token' ? '[REDACTED]' : v)));

const logins = { user: null, admin: null, suppliers: {} };

// ===========================================================================
// 夹具：起服务前用 sqlite 直连准备（避免与服务并发写）
// ===========================================================================
function prepareFixture() {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA busy_timeout = 8000;');

  const back = db.prepare(`SELECT status FROM ab_order WHERE order_no = ?`).get(ORDER_NO);
  db.prepare(`UPDATE ab_order SET status = 'paid' WHERE order_no = ?`).run(ORDER_NO);

  const delDetails = db
    .prepare(`DELETE FROM ab_supplier_dish_center_daily WHERE produce_date = ?`)
    .run(DATE);
  const delDelivery = db
    .prepare(`DELETE FROM ab_delivery_record WHERE meal_date = ?`)
    .run(DATE);

  let createdAccounts = 0;
  for (const [username, supplierId, realName] of SUPPLIER_LOGINS) {
    if (supplierId === 1) continue;
    const ex = db.prepare(`SELECT id FROM ab_admin_user WHERE username = ?`).get(username);
    if (ex) continue;
    db.prepare(
      `INSERT INTO ab_admin_user
         (username, password_hash, real_name, role, supplier_id, phone, status, version, created_at, updated_at)
       SELECT ?, password_hash, ?, role, ?, phone, status, version, created_at, updated_at
         FROM ab_admin_user WHERE username = 'sanweiwu'`,
    ).run(username, realName, supplierId);
    createdAccounts += 1;
  }

  const fixture = {
    orderPrevStatus: back?.status ?? null,
    deletedCenterDaily: delDetails.changes,
    deletedDelivery: delDelivery.changes,
    createdSupplierAccounts: createdAccounts,
  };
  console.log('== 夹具准备 ==\n' + JSON.stringify(fixture, null, 1));
  return { db, fixture };
}

// ===========================================================================
// 主流程
// ===========================================================================
async function main() {
  const { db, fixture } = prepareFixture();

  installCleanupHooks();
  await assertPortFree(PORT);
  const child = startApiServer(PORT);
  const call = makeCall(BASE);

  try {
    const healthy = await waitHealthy(BASE, { child, timeoutMs: 90_000 });
    if (!healthy) throw new Error('API 未就绪（90s 超时）—— 见上方 [api:err]');
    const health = await call('GET', '/health');
    console.log(`[health] ${trunc(health.body, 200)}`);

    // ---------------------------------------------------------------- 登录
    const adminLg = await call('POST', '/auth/admin-login', {
      body: { username: 'admin', password: 'admin123' },
    });
    const adminTok = adminLg.body?.data?.accessToken ?? adminLg.body?.data?.token ?? null;
    logins.admin = { code: adminLg.body?.code, role: adminLg.body?.data?.account?.role };
    if (!adminTok) throw new Error(`admin 登录失败：${trunc(adminLg.body)}`);

    const userLg = await call('POST', '/auth/login', { body: { code: USER_CODE } });
    const userTok = userLg.body?.data?.token ?? null;
    logins.user = { code: userLg.body?.code, id: userLg.body?.data?.user?.id };
    if (!userTok) throw new Error(`用户登录失败：${trunc(userLg.body)}`);

    for (const [username, supplierId] of SUPPLIER_LOGINS) {
      const r = await call('POST', '/auth/admin-login', {
        body: { username, password: 'supplier123' },
      });
      logins.suppliers[supplierId] = {
        username,
        code: r.body?.code,
        supplierId: r.body?.data?.account?.supplierId ?? null,
        token: r.body?.data?.accessToken ?? r.body?.data?.token ?? null,
      };
    }
    console.log('== 登录 ==\n' + JSON.stringify(redact(logins), null, 1));

    // ---------------------------------------------------- A. 截单前订单 = paid
    const d0 = await call('GET', `/orders/${ORDER_NO}`, { token: userTok });
    rec(
      'A-1',
      '截单前订单状态 = paid',
      d0.body?.data?.status === 'paid' ? 'PASS' : 'FAIL',
      `GET /orders/${ORDER_NO} → code=${d0.body?.code} status=${d0.body?.data?.status}`,
      trunc(d0.body?.data),
    );

    // ---------------------------------------------------- B. 跑截单 → cut_off
    const cut = await call('POST', '/admin/schedule/cutoff/run', {
      token: adminTok,
      body: { date: DATE },
    });
    rec(
      'B-0',
      '截单任务执行成功',
      cut.body?.code === 0 ? 'PASS' : 'FAIL',
      `POST /admin/schedule/cutoff/run → code=${cut.body?.code} cut.locked=${cut.body?.data?.result?.cut?.locked?.count} plan.createdDetails=${cut.body?.data?.result?.plan?.createdDetails}`,
      trunc(cut.body?.data?.result),
    );
    const d1 = await call('GET', `/orders/${ORDER_NO}`, { token: userTok });
    rec(
      'B-1',
      '截单后订单状态 = cut_off',
      d1.body?.data?.status === 'cut_off' ? 'PASS' : 'FAIL',
      `status=${d1.body?.data?.status}`,
      trunc(d1.body?.data),
    );

    // ------------------------------------------- C. 读出「中心 1」生产计划明细
    const rows = db
      .prepare(
        `SELECT id, supplier_id, dish_id, distribution_center_id, plan_quantity, status
           FROM ab_supplier_dish_center_daily
          WHERE produce_date = ? AND distribution_center_id = ?
          ORDER BY supplier_id`,
      )
      .all(DATE, CENTER_ID);
    console.log(`== 中心 ${CENTER_ID} 生产计划明细（${rows.length} 行）==\n` + JSON.stringify(rows));
    rec(
      'C-1',
      `中心 ${CENTER_ID} 当日有生产计划明细且初始均未确认`,
      rows.length > 0 && rows.every((r) => r.status !== 'confirmed') ? 'PASS' : 'NOTE',
      `rows=${rows.length} statuses=${JSON.stringify(rows.map((r) => r.status))}`,
      JSON.stringify(rows),
    );

    // ----------------------------------------------- D. 逐家出餐确认（触发 T7）
    const advanceBySup = [];
    for (const r of rows) {
      const tok = logins.suppliers[r.supplier_id]?.token;
      if (!tok) {
        advanceBySup.push({ supplierId: r.supplier_id, error: 'no token' });
        continue;
      }
      const res = await call('POST', '/supplier/meal/cook-confirm', {
        token: tok,
        body: { date: DATE, items: [{ dishId: r.dish_id, distributionCenterId: CENTER_ID }] },
      });
      advanceBySup.push({
        supplierId: r.supplier_id,
        dishId: r.dish_id,
        code: res.body?.code,
        confirmedLen: res.body?.data?.confirmed?.length ?? null,
        skippedLen: res.body?.data?.skipped?.length ?? null,
        orderAdvance: res.body?.data?.orderAdvance ?? null,
      });
      console.log(
        `[cook-confirm] supplier=${r.supplier_id} dish=${r.dish_id} → code=${res.body?.code} ` +
          `orderAdvance=${trunc(res.body?.data?.orderAdvance, 200)}`,
      );
    }
    const cookedByApi = advanceBySup.reduce((s, a) => s + (a.orderAdvance?.cooked ?? 0), 0);
    const readyCenters = Math.max(
      ...advanceBySup.map((a) => a.orderAdvance?.readyCenterCount ?? 0),
      0,
    );
    rec(
      'D-1',
      '出餐确认回执报告了订单推进（orderAdvance.cooked ≥ 1）',
      cookedByApi >= 1 ? 'PASS' : 'FAIL',
      `合计 cooked=${cookedByApi} readyCenterCount(max)=${readyCenters}`,
      trunc(advanceBySup),
    );

    // ------------------------------------------- E. K47 主判据：订单是否 cooked
    const d2 = await call('GET', `/orders/${ORDER_NO}`, { token: userTok });
    const k47main = d2.body?.data?.status === 'cooked';
    rec(
      'K47-main',
      '出餐确认后订单推进为 cooked（停在 cut_off ⇒ P1）',
      k47main ? 'PASS' : 'FAIL',
      `status=${d2.body?.data?.status}`,
      trunc(d2.body?.data),
    );

    // ----------------------------------------------- F. K44 幂等：原样再提交一遍
    const last = rows[rows.length - 1];
    let k44ok = false;
    if (last) {
      const idem = await call('POST', '/supplier/meal/cook-confirm', {
        token: logins.suppliers[last.supplier_id]?.token,
        body: { date: DATE, items: [{ dishId: last.dish_id, distributionCenterId: CENTER_ID }] },
      });
      k44ok =
        idem.body?.code === 0 &&
        (idem.body?.data?.confirmed?.length ?? -1) === 0 &&
        (idem.body?.data?.skipped?.length ?? -1) === 1;
      rec(
        'K44',
        '出餐确认原样重复提交：不报错、新增 0 项 / 跳过 1 项',
        k44ok ? 'PASS' : 'FAIL',
        `code=${idem.body?.code} confirmed=${idem.body?.data?.confirmed?.length} skipped=${idem.body?.data?.skipped?.length} summary=${trunc(idem.body?.data?.summary, 160)}`,
        trunc(idem.body?.data),
      );
    }

    // ---------------------------------------------- G. 生成配送单（D 日 00:30）
    const gen = await call('POST', '/admin/schedule/delivery-generate/run', {
      token: adminTok,
      body: { date: DATE },
    });
    rec(
      'G-0',
      '配送单生成任务执行成功',
      gen.body?.code === 0 ? 'PASS' : 'FAIL',
      `code=${gen.body?.code} created=${gen.body?.data?.result?.created} warning=${gen.body?.data?.result?.warning}`,
      trunc(gen.body?.data?.result),
    );
    const list1 = await call('GET', `/admin/deliveries?date=${DATE}`, { token: adminTok });
    const row = (list1.body?.data?.list ?? []).find((r) => r.buildingGroupId === GROUP_ID);
    rec(
      'G-1',
      `楼群 ${GROUP_ID} 配送单存在（待叫车 pending）`,
      row && row.status === 'pending' ? 'PASS' : 'FAIL',
      row
        ? `id=${row.id} status=${row.status} version=${row.version} qty=${row.totalQuantity} orderQty=${row.orderQuantity} breakdown=${trunc(row.orderStatusBreakdown, 200)}`
        : 'not found',
      trunc(row),
    );
    if (!row) throw new Error(`未找到楼群 ${GROUP_ID} 的配送单，后续履约链无法继续`);

    // ---------------------------------------------- H. K15 跳步应被拒（pending→en_route）
    const jump = await call('PATCH', `/admin/deliveries/${row.id}/status`, {
      token: adminTok,
      body: { to: 'en_route', version: row.version },
    });
    rec(
      'K15-jump',
      'K15：配送单跳级 pending→en_route 被拒（30018）',
      jump.body?.code === 30018 ? 'PASS' : 'FAIL',
      `code=${jump.body?.code} message=${trunc(jump.body?.message, 120)} allowed=${JSON.stringify(jump.body?.data?.allowed)}`,
      trunc(jump.body),
    );

    // ---------------------------------------------- I. pending → called（订单应不动）
    const s1 = await call('PATCH', `/admin/deliveries/${row.id}/status`, {
      token: adminTok,
      body: { to: 'called', version: row.version },
    });
    const calledOk = s1.body?.code === 0 && s1.body?.data?.orderTransition === null;
    rec(
      'T8-pre',
      'pending→called 成功，且订单刻意不动（orderTransition=null）',
      calledOk ? 'PASS' : 'FAIL',
      `code=${s1.body?.code} to=${s1.body?.data?.to} orderTransition=${JSON.stringify(s1.body?.data?.orderTransition)} version=${s1.body?.data?.version}`,
      trunc(s1.body?.data),
    );

    // ---------------------------------------------- J. called → en_route（T8）
    const s2 = await call('PATCH', `/admin/deliveries/${row.id}/status`, {
      token: adminTok,
      body: { to: 'en_route', version: s1.body?.data?.version },
    });
    const t8adv = s2.body?.data?.orderTransition?.advanced ?? -1;
    rec(
      'T8',
      'en_route：联动订单 cooked → delivering（advanced ≥ 1）',
      s2.body?.code === 0 && t8adv >= 1 ? 'PASS' : 'FAIL',
      `code=${s2.body?.code} advanced=${t8adv} remaining=${trunc(s2.body?.data?.orderTransition?.remaining, 160)} version=${s2.body?.data?.version}`,
      trunc(s2.body?.data),
    );
    const d3 = await call('GET', `/orders/${ORDER_NO}`, { token: userTok });
    rec(
      'K47-T8',
      '订单状态 = delivering',
      d3.body?.data?.status === 'delivering' ? 'PASS' : 'FAIL',
      `status=${d3.body?.data?.status}`,
      trunc(d3.body?.data),
    );

    // ---------------------------------------------- K. en_route → arrived（T9）
    const s3 = await call('PATCH', `/admin/deliveries/${row.id}/status`, {
      token: adminTok,
      body: { to: 'arrived', version: s2.body?.data?.version },
    });
    const t9adv = s3.body?.data?.orderTransition?.advanced ?? -1;
    rec(
      'T9',
      'arrived：联动订单 delivering → delivered（advanced ≥ 1）',
      s3.body?.code === 0 && t9adv >= 1 ? 'PASS' : 'FAIL',
      `code=${s3.body?.code} advanced=${t9adv} actualAt=${s3.body?.data?.actualAt} remaining=${trunc(s3.body?.data?.orderTransition?.remaining, 160)}`,
      trunc(s3.body?.data),
    );
    const d4 = await call('GET', `/orders/${ORDER_NO}`, { token: userTok });
    rec(
      'K47-half',
      'K47 连带半边：送达后订单 = delivered（仍停在 delivering ⇒ P1）',
      d4.body?.data?.status === 'delivered' ? 'PASS' : 'FAIL',
      `status=${d4.body?.data?.status}`,
      trunc(d4.body?.data),
    );

    // ---------------------------------------------- L. 送达后再次跳步/终点保护
    const end = await call('PATCH', `/admin/deliveries/${row.id}/status`, {
      token: adminTok,
      body: { to: 'arrived', version: s3.body?.data?.version },
    });
    rec(
      'L-1',
      '已送达（终态）再推进被拒（30018，allowed=[]）',
      end.body?.code === 30018 ? 'PASS' : 'FAIL',
      `code=${end.body?.code} allowed=${JSON.stringify(end.body?.data?.allowed)}`,
      trunc(end.body),
    );

    // ---------------------------------------------- 汇总
    const counts = assertions.reduce((m, a) => ((m[a.verdict] = (m[a.verdict] ?? 0) + 1), m), {});
    console.log('\n== 断言汇总 ==\n' + JSON.stringify(counts));
  } catch (err) {
    console.error('!! 探针异常：', err?.stack ?? err);
    assertions.push({ id: 'ERR', title: '探针异常', verdict: 'FAIL', actual: String(err?.message ?? err), evidence: null });
  } finally {
    await stopApiServer(child, PORT);
    await sleep(200);

    // --------------------------------------------------- 终态复核（停服务后读库）
    let finalState = null;
    try {
      finalState = {
        order: db.prepare(`SELECT order_no, status FROM ab_order WHERE order_no = ?`).get(ORDER_NO),
        centerDaily: db
          .prepare(
            `SELECT supplier_id, dish_id, status FROM ab_supplier_dish_center_daily
              WHERE produce_date = ? AND distribution_center_id = ? ORDER BY supplier_id`,
          )
          .all(DATE, CENTER_ID),
        delivery: db
          .prepare(
            `SELECT id, status, version, actual_at FROM ab_delivery_record
              WHERE meal_date = ? AND building_group_id = ?`,
          )
          .get(DATE, GROUP_ID),
      };
      console.log('\n== 终态复核（sqlite 直查）==\n' + JSON.stringify(finalState, null, 1));
    } catch (e) {
      console.error('终态复核失败：', e?.message ?? e);
    }
    db.close();

    const counts = assertions.reduce((m, a) => ((m[a.verdict] = (m[a.verdict] ?? 0) + 1), m), {});
    console.log('===JSON===');
    console.log(
      JSON.stringify({ fixture, logins: redact(logins), assertions, finalState, counts }, null, 1),
    );
    console.log('===ENDJSON===');
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
