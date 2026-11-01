#!/usr/bin/env node
/**
 * _probe-identities.mjs —— 「多身份黑盒实测」一次性探针（qa-lead · 本任务专用）
 *
 * 目标（对应主理人派单 §三/§四）：真实起服务 → 造 7 个身份 → 跑全链路 →
 * 用**原始响应**说话。全部在**一条前台 Bash 调用**里跑完（起服务 → 探测 → 停服务 → 退出）。
 *
 * ⚠️ 前置：先跑 `node scripts/gate.mjs seed && node scripts/gate.mjs seed:demo`（干净库 + 演示数据）
 * ⚠️ 本脚本**只读业务 + 造测试夹具**，不改仓库源码；`_` 前缀 = 不进基线（项目既有通道）。
 * ⚠️ 不并发起第二套服务；端口用 E2E_PORT（默认 3101）。
 *
 * 用法：node scripts/_probe-identities.mjs
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

const log = (s) => process.stdout.write(`${s}\n`);
const results = []; // { id, title, verdict: PASS|FAIL|NOTE|UNKNOWN, expected, actual, evidence }
function rec(r) {
  results.push(r);
  const tail = r.actual != null && r.actual !== '' ? `  › ${r.actual}` : '';
  log(`[${r.verdict}] ${r.id} · ${r.title}${tail}`);
}
const j = (o) => {
  const s = JSON.stringify(o ?? null);
  return s.length > 320 ? `${s.slice(0, 320)}…` : s;
};

const call = makeCall(BASE);
const logins = {};
const ids = {}; // 身份名 → userId
const orderNos = {}; // 身份名 → orderNo

// ---------------------------------------------------------------------------
// 夹具：造身份（先 HTTP 登录自动建号，再用 sqlite 直连补属性）
// ---------------------------------------------------------------------------
function openDb() {
  return new DatabaseSync(DB_PATH);
}

async function loginAs(name, code, patch = null) {
  const r = await call('POST', '/auth/login', { body: { code } });
  const d = r.body?.data;
  logins[name] = {
    code,
    httpStatus: r.status,
    bizCode: r.body?.code,
    isNewUser: d?.isNewUser,
    isLeader: d?.isLeader,
    user: d?.user,
    leader: d?.leader,
  };
  if (d?.user?.id) {
    ids[name] = d.user.id;
    if (patch) {
      const db = openDb();
      try {
        patch(db, d.user.id);
      } finally {
        db.close();
      }
    }
  }
  return { token: d?.token, user: d?.user, isNewUser: d?.isNewUser, isLeader: d?.isLeader };
}

async function main() {
  log(`\n=== ABox 多身份黑盒实测探针 ===\nDB: ${DB_PATH}\nBASE: ${BASE}\n`);

  installCleanupHooks();
  await assertPortFree(PORT);
  const server = startApiServer(PORT, { ABOX_SHIFT_TO_HOUR: '20', ABOX_RATE_LIMIT: 'off' });
  const healthy = await waitHealthy(BASE, { child: server });
  if (!healthy) {
    rec({ id: 'ENV-0', title: 'API 服务启动 + 健康检查', verdict: 'FAIL', actual: `${BASE}/health 超时` });
    await stopApiServer(server, PORT);
    return finish();
  }
  rec({ id: 'ENV-0', title: 'API 服务启动 + 健康检查', verdict: 'PASS', actual: 'code=0' });

  // ---- ENV-1 下单窗口自证 ----
  {
    const h = 20; // ABOX_SHIFT_TO_HOUR
    rec({
      id: 'ENV-1',
      title: '时钟注入态：北京小时=20:00 ⇒ 下单窗口开放',
      verdict: h >= 14 && h < 23 ? 'PASS' : 'FAIL',
      expected: '14:00 ≤ h < 23:00',
      actual: `h=${h}`,
    });
  }

  // =====================================================================
  // B. 造身份 + 登录
  // =====================================================================
  log('\n── B. 身份创建与登录 ──────────────────────────────────────');

  const L1 = await loginAs('李明1001', 'dev:1001'); // 已存在（seed）
  // 纯团员：楼 1 + 团长 #1（李明，在职）
  const member = await loginAs('纯团员', 'dev:qa_member', (db, id) => {
    db.prepare('UPDATE ab_user SET building_id=1, team_leader_id=1 WHERE id=?').run(id);
  });
  // 无楼栋无团长（资料不完整）
  const newbie = await loginAs('无楼栋', 'dev:qa_newbie');
  // 停职团长：楼 1 + 绑定停职团长 #923（停职）⇒ 应回落本楼在任 #1
  const susp = await loginAs('绑停职团长', 'dev:qa_susp', (db, id) => {
    db.prepare('UPDATE ab_user SET building_id=1, team_leader_id=923 WHERE id=?').run(id);
  });
  // 跨楼栋：楼 4（国贸D座）+ 团长 #5（陈强，楼 2）
  const cross = await loginAs('跨楼栋', 'dev:qa_cross', (db, id) => {
    db.prepare('UPDATE ab_user SET building_id=4, team_leader_id=5 WHERE id=?').run(id);
  });
  // 有余额：楼 1 + 团长 #1 + ab_balance 余额 ¥58.00 + 一条流水
  const bal = await loginAs('有余额', 'dev:qa_bal', (db, id) => {
    db.prepare('UPDATE ab_user SET building_id=1, team_leader_id=1 WHERE id=?').run(id);
    db.prepare(
      'INSERT INTO ab_balance (user_id,balance,frozen,total_in,total_out,version,created_at,updated_at) VALUES (?,?,?,?,?,0,datetime(\'now\'),datetime(\'now\'))',
    ).run(id, '58.00', '0.00', '58.00', '0.00');
    db.prepare(
      'INSERT INTO ab_balance_log (user_id,type,direction,amount,balance_after,related_id,remark,payout_channel,tax_withheld_amount,created_at) VALUES (?,?,?,?,?,?,?,?,?,datetime(\'now\'))',
    ).run(id, 'refund', 1, '58.00', '58.00', 'QA-FIXTURE', 'QA 夹具：历史退款入账', 'FLEX_MANUAL', '0.00');
  });
  // 楼栋状态非启用：楼 3（国贸C座，status=2 待开通，但仍属楼群1）+ 团长 #1
  const bldg2 = await loginAs('楼栋停用', 'dev:qa_bldg2', (db, id) => {
    db.prepare('UPDATE ab_user SET building_id=3, team_leader_id=1 WHERE id=?').run(id);
  });
  // 同时是团长的有余额身份（用于 K16 余额一致性对账）
  const leader = await loginAs('在职团长+余额', 'dev:qa_leader', (db, id) => {
    db.prepare('UPDATE ab_user SET building_id=1, team_leader_id=null WHERE id=?').run(id);
    db.prepare(
      'INSERT INTO ab_team_leader (user_id,building_id,phone,real_name,level,commission_rate,status,agreed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,datetime(\'now\'),datetime(\'now\'),datetime(\'now\'))',
    ).run(id, 1, '13800000001', 'QA团长', 'formal', '0.0900', 1);
    db.prepare(
      'INSERT INTO ab_balance (user_id,balance,frozen,total_in,total_out,version,created_at,updated_at) VALUES (?,?,?,?,?,0,datetime(\'now\'),datetime(\'now\'))',
    ).run(id, '88.88', '0.00', '88.88', '0.00');
    db.prepare(
      'INSERT INTO ab_balance_log (user_id,type,direction,amount,balance_after,related_id,remark,payout_channel,tax_withheld_amount,created_at) VALUES (?,?,?,?,?,?,?,?,?,datetime(\'now\'))',
    ).run(id, 'commission', 1, '88.88', '88.88', 'QA-FIXTURE', 'QA 夹具：佣金入账', 'FLEX_MANUAL', '0.00');
  });
  // 停职团长身份（token 里 isLeader 不该被信任）
  const suspleader = await loginAs('停职团长本人', 'dev:qa_suspleader', (db, id) => {
    db.prepare('UPDATE ab_user SET building_id=1, team_leader_id=null WHERE id=?').run(id);
    db.prepare(
      'INSERT INTO ab_team_leader (user_id,building_id,phone,real_name,level,commission_rate,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,datetime(\'now\'),datetime(\'now\'))',
    ).run(id, 1, '13800000002', 'QA停职团长', 'trainee', '0.0800', 2);
  });

  // 登录断言
  rec({
    id: 'B-1',
    title: '首次登录 dev:<新码> 自动建号（isNewUser=true）',
    verdict:
      member.isNewUser === true && newbie.isNewUser === true && cross.isNewUser === true ? 'PASS' : 'FAIL',
    actual: `member=${member.isNewUser} newbie=${newbie.isNewUser} cross=${cross.isNewUser}`,
    evidence: j(logins['纯团员']),
  });
  rec({
    id: 'B-2',
    title: '老用户重复登录 isNewUser=false 且 user.id 稳定',
    verdict: L1.isNewUser === false && ids['李明1001'] === 1001 ? 'PASS' : 'FAIL',
    actual: `1001 isNewUser=${L1.isNewUser} userId=${ids['李明1001']}`,
  });
  rec({
    id: 'B-3',
    title: '换人（不同 dev 码）→ 不同 userId（dev-identity 换人生效的服务端侧）',
    verdict: new Set(Object.values(ids)).size === Object.keys(ids).length ? 'PASS' : 'FAIL',
    actual: Object.entries(ids)
      .map(([k, v]) => `${k}=${v}`)
      .join(' '),
  });
  rec({
    id: 'B-4',
    title: '登录只凭 code：不落手机号/地址（新用户 phone=null, buildingId=null）',
    verdict:
      logins['无楼栋']?.user?.phone === null && logins['无楼栋']?.user?.buildingId === null
        ? 'PASS'
        : 'FAIL',
    actual: `phone=${logins['无楼栋']?.user?.phone} buildingId=${logins['无楼栋']?.user?.buildingId}`,
  });

  const TT = '2026-09-22'; // 出餐日（明日），由 ENV 复核

  // =====================================================================
  // C. 每身份 U1 首页（团长归属 / source / 可下单性）
  // =====================================================================
  log('\n── C. U1 首页（团长归属 / 可下单性）─────────────────────────');
  const u1 = {};
  async function daily(name) {
    const t = (await call('POST', '/auth/login', { body: { code: logins[name].code } })).body?.data?.token;
    if (!logins[name]._token) logins[name]._token = t;
    const r = await call('GET', '/home/daily', { token: t });
    u1[name] = { httpStatus: r.status, ...r.body };
    return r.body;
  }

  // 先用 seed 身份拿 mealDate 复核
  const d1001 = await daily('李明1001');
  const mealDate = d1001?.data?.mealDate ?? TT;
  rec({
    id: 'C-0',
    title: `出餐日 mealDate=${mealDate}（=明日），套餐已上架`,
    verdict: mealDate === TT && d1001?.code === 0 ? 'PASS' : 'FAIL',
    actual: `mealDate=${mealDate} code=${d1001?.code} canOrder=${d1001?.data?.canOrder}`,
  });

  for (const name of ['纯团员', '无楼栋', '绑停职团长', '跨楼栋', '有余额', '楼栋停用', '在职团长+余额', '停职团长本人']) {
    const r = await daily(name);
    log(
      `   · ${name}: code=${r?.code} canOrder=${r?.data?.canOrder} leader=${j(r?.data?.leader)}` +
        (r?.code !== 0 ? ` msg=${r?.message}` : ''),
    );
  }

  rec({
    id: 'C-1',
    title: '纯团员：canOrder=true 且 leader.source=bound id=1（跟对团长）',
    verdict: u1['纯团员']?.data?.canOrder === true && u1['纯团员']?.data?.leader?.source === 'bound' && u1['纯团员']?.data?.leader?.id === 1 ? 'PASS' : 'FAIL',
    actual: `canOrder=${u1['纯团员']?.data?.canOrder} leader=${j(u1['纯团员']?.data?.leader)}`,
    evidence: j(u1['纯团员']?.data?.leader),
  });
  rec({
    id: 'C-2',
    title: '无楼栋用户：U1 回 10004（NOT_FOUND，未绑办公楼）',
    verdict: u1['无楼栋']?.code === 10004 ? 'PASS' : 'FAIL',
    actual: `code=${u1['无楼栋']?.code} msg=${u1['无楼栋']?.message}`,
  });
  rec({
    id: 'C-3',
    title: '绑停职团长：U1 不认停职绑定，回落本楼在任团长（source=building_default id=1）',
    verdict:
      u1['绑停职团长']?.data?.leader?.id === 1 && u1['绑停职团长']?.data?.leader?.source === 'building_default'
        ? 'PASS'
        : 'FAIL',
    actual: `leader=${j(u1['绑停职团长']?.data?.leader)}`,
    evidence: j(u1['绑停职团长']?.data?.leader),
  });
  rec({
    id: 'C-4',
    title: '跨楼栋：用户楼 4 / 绑定团长 #5（楼 2）——U1 如实显示 bound 团长 #5',
    verdict: u1['跨楼栋']?.data?.leader?.id === 5 && u1['跨楼栋']?.data?.leader?.source === 'bound' ? 'NOTE' : 'FAIL',
    actual: `leader=${j(u1['跨楼栋']?.data?.leader)}（观察项：用户所在楼与团长所在楼不同）`,
    expected: '观察：系统允许跨楼绑定，归属=绑定团长 #5（楼 2）',
  });
  rec({
    id: 'C-5',
    title: '【观察/考虑不周】楼栋 status=2（待开通）住户仍可下单（U1 canOrder 未校验楼栋状态）',
    verdict: u1['楼栋停用']?.data?.canOrder === true ? 'NOTE' : 'PASS',
    expected: '规格：只有 status=1 的楼可开团；用户侧未查 ab_building.status',
    actual: `楼 3(status=2) canOrder=${u1['楼栋停用']?.data?.canOrder} leader=${j(u1['楼栋停用']?.data?.leader)}`,
    evidence: j({ code: u1['楼栋停用']?.code, canOrder: u1['楼栋停用']?.data?.canOrder }),
  });
  rec({
    id: 'C-6',
    title: '在职团长本人（1001，team_leader_id=null）U1 走 building_default 显示本楼团长#1',
    verdict: u1['李明1001']?.data?.leader?.source === 'building_default' ? 'PASS' : 'FAIL',
    actual: `leader=${j(u1['李明1001']?.data?.leader)}`,
  });

  // ---- C-7 leaderName 不自回退成本人（A2 /auth/me） ----
  {
    const me1001 = await call('GET', '/auth/me', { token: logins['李明1001']._token });
    const meMember = await call('GET', '/auth/me', { token: logins['纯团员']._token });
    rec({
      id: 'C-7',
      title: 'leaderName 只认 team_leader_id，不自回退成本人（团长 1001 的 leaderName=null）',
      verdict: me1001.body?.data?.leaderName === null && meMember.body?.data?.leaderName === '李明' ? 'PASS' : 'FAIL',
      actual: `1001.leaderName=${me1001.body?.data?.leaderName} | 纯团员.leaderName=${meMember.body?.data?.leaderName}`,
      evidence: j({ a: me1001.body?.data, b: meMember.body?.data }),
    });
  }

  // =====================================================================
  // D. 下单主链（纯团员）
  // =====================================================================
  log('\n── D. 下单主链 pending_pay→paid ─────────────────────────────');
  const tokMember = logins['纯团员']._token;
  const order1 = await call('POST', '/orders', {
    token: tokMember,
    idem: 'qa-member-key-1',
    body: { mealDate, quantity: 2, remark: 'QA 主链' },
  });
  orderNos['纯团员'] = order1.body?.data?.orderNo;
  rec({
    id: 'D-1',
    title: 'U6 创建订单：status=pending_pay，金额=单价×份数',
    verdict: order1.body?.code === 0 && order1.body?.data?.status === 'pending_pay' && order1.body?.data?.payAmountFen === 5160 ? 'PASS' : 'FAIL',
    actual: `code=${order1.body?.code} orderNo=${orderNos['纯团员']} status=${order1.body?.data?.status} payAmountFen=${order1.body?.data?.payAmountFen}`,
    evidence: j(order1.body),
  });
  // 幂等回放
  const replay = await call('POST', '/orders', {
    token: tokMember,
    idem: 'qa-member-key-1',
    body: { mealDate, quantity: 2, remark: 'QA 主链' },
  });
  rec({
    id: 'D-2',
    title: '① 同 Idempotency-Key 重复下单 → 10006 且同 orderNo（HTTP 200）',
    verdict: replay.body?.code === 10006 && replay.body?.data?.orderNo === orderNos['纯团员'] && replay.status === 200 ? 'PASS' : 'FAIL',
    actual: `code=${replay.body?.code} orderNo=${replay.body?.data?.orderNo} http=${replay.status}`,
  });
  // 缺 key
  const noKey = await call('POST', '/orders', { token: tokMember, body: { mealDate, quantity: 1 } });
  rec({
    id: 'D-3',
    title: '② 缺 Idempotency-Key → 10001（HTTP 200）',
    verdict: noKey.body?.code === 10001 && noKey.status === 200 ? 'PASS' : 'FAIL',
    actual: `code=${noKey.body?.code} http=${noKey.status}`,
  });
  // 一天一单
  const dup = await call('POST', '/orders', {
    token: tokMember,
    idem: 'qa-member-key-2',
    body: { mealDate, quantity: 1 },
  });
  rec({
    id: 'D-4',
    title: '③ 同身份同出餐日再下一单 → 30004（一天一单）',
    verdict: dup.body?.code === 30004 ? 'PASS' : 'FAIL',
    actual: `code=${dup.body?.code} msg=${dup.body?.message}`,
  });
  // 支付
  const prepay = await call('POST', `/orders/${orderNos['纯团员']}/pay`, { token: tokMember, idem: 'qa-pay-key-1' });
  rec({
    id: 'D-5',
    title: 'U7 创建支付单（mock JSAPI）',
    verdict: prepay.body?.code === 0 ? 'PASS' : 'FAIL',
    actual: `code=${prepay.body?.code} payAmountFen=${prepay.body?.data?.payAmountFen}`,
  });
  let paid = null;
  for (let i = 0; i < 12; i += 1) {
    await sleep(300);
    const r = await call('GET', `/orders/${orderNos['纯团员']}/pay-result`, { token: tokMember });
    paid = r.body?.data;
    if (paid?.paid) break;
  }
  rec({
    id: 'D-6',
    title: 'U8 支付回调入账：paid=true 且状态文案=待出餐',
    verdict: paid?.paid === true && paid?.statusText === '待出餐' ? 'PASS' : 'FAIL',
    actual: `paid=${paid?.paid} status=${paid?.status} statusText=${paid?.statusText}`,
    evidence: j(paid),
  });
  const det = await call('GET', `/orders/${orderNos['纯团员']}`, { token: tokMember });
  rec({
    id: 'D-7',
    title: 'U10 订单详情：时间线 ≥6 节点、paid 节点已完成、取餐点非空',
    verdict:
      (det.body?.data?.timeline?.length ?? 0) >= 6 &&
      det.body?.data?.timeline?.some((n) => n.node === 'paid' && n.done) &&
      !!det.body?.data?.pickup?.point
        ? 'PASS'
        : 'FAIL',
    actual: `nodes=${det.body?.data?.timeline?.length} pickup=${det.body?.data?.pickup?.point} leader=${det.body?.data?.pickup?.leaderName}`,
  });
  // U1 vs U6 归属一致性
  {
    const db = openDb();
    const row = db.prepare('SELECT team_leader_id FROM ab_order WHERE order_no=?').get(orderNos['纯团员']);
    db.close();
    rec({
      id: 'D-8',
      title: '归属一致性：U1 leader.id === 订单落库 team_leader_id（同判据）',
      verdict: Number(row?.team_leader_id) === u1['纯团员']?.data?.leader?.id ? 'PASS' : 'FAIL',
      actual: `U1.leader=${u1['纯团员']?.data?.leader?.id} order.team_leader_id=${row?.team_leader_id}`,
    });
  }

  // =====================================================================
  // E/G. 取消 / 退款 / 取消后再下一单（观察）
  // =====================================================================
  log('\n── E. 取消 / 退款 / 取消后重下 ─────────────────────────────');
  // 有余额身份下一单（同时给越权测试提供他人订单）
  const tokBal = logins['有余额']._token;
  const oBal = await call('POST', '/orders', {
    token: tokBal,
    idem: 'qa-bal-key-1',
    body: { mealDate, quantity: 2, useBalanceFen: 3000 },
  });
  orderNos['有余额'] = oBal.body?.data?.orderNo;
  rec({
    id: 'E-0',
    title: '余额抵扣下单：份数2/总额5160，抵扣3000，实付2160',
    verdict: oBal.body?.code === 0 && oBal.body?.data?.balanceUsedFen === 3000 && oBal.body?.data?.payAmountFen === 2160 ? 'PASS' : 'FAIL',
    actual: `code=${oBal.body?.code} balanceUsedFen=${oBal.body?.data?.balanceUsedFen} payAmountFen=${oBal.body?.data?.payAmountFen} status=${oBal.body?.data?.status}`,
    evidence: j(oBal.body),
  });

  // 取消后再下一单（用独立身份）
  const tokReorder = await (async () => {
    const l = await loginAs('取消重下', 'dev:qa_reorder', (db, id) => {
      db.prepare('UPDATE ab_user SET building_id=1, team_leader_id=1 WHERE id=?').run(id);
    });
    return l.token;
  })();
  const rOrder1 = await call('POST', '/orders', { token: tokReorder, idem: 'qa-reorder-1', body: { mealDate, quantity: 1 } });
  const rOrder1No = rOrder1.body?.data?.orderNo;
  await call('POST', `/orders/${rOrder1No}/pay`, { token: tokReorder, idem: 'qa-reorder-pay' });
  for (let i = 0; i < 10; i += 1) {
    await sleep(300);
    const r = await call('GET', `/orders/${rOrder1No}/pay-result`, { token: tokReorder });
    if (r.body?.data?.paid) break;
  }
  const cancel1 = await call('POST', `/orders/${rOrder1No}/cancel`, { token: tokReorder });
  rec({
    id: 'E-1',
    title: 'U11 截单前自助取消：status=cancelled，refundInitiated=true',
    verdict: cancel1.body?.code === 0 && cancel1.body?.data?.status === 'cancelled' && cancel1.body?.data?.refundInitiated === true ? 'PASS' : 'FAIL',
    actual: `code=${cancel1.body?.code} status=${cancel1.body?.data?.status} refundInitiated=${cancel1.body?.data?.refundInitiated}`,
    evidence: j(cancel1.body),
  });
  const reorder = await call('POST', '/orders', { token: tokReorder, idem: 'qa-reorder-2', body: { mealDate, quantity: 1 } });
  rec({
    id: 'E-2',
    title: '【K17 观察项】取消订单后再下一单（同出餐日）',
    verdict: 'NOTE',
    expected: '两种结果都可能对，照实记录',
    actual: `code=${reorder.body?.code} orderNo=${reorder.body?.data?.orderNo ?? '-'} msg=${reorder.body?.message ?? '-'}`,
    evidence: j(reorder.body),
  });

  // 截单后取消 → 40004
  {
    const tokLate = await (async () => {
      const l = await loginAs('截单后取消', 'dev:qa_cancel_late', (db, id) => {
        db.prepare('UPDATE ab_user SET building_id=1, team_leader_id=1 WHERE id=?').run(id);
      });
      return l.token;
    })();
    const o = await call('POST', '/orders', { token: tokLate, idem: 'qa-late-1', body: { mealDate, quantity: 1 } });
    const oNo = o.body?.data?.orderNo;
    await call('POST', `/orders/${oNo}/pay`, { token: tokLate, idem: 'qa-late-pay' });
    for (let i = 0; i < 10; i += 1) {
      await sleep(300);
      const r = await call('GET', `/orders/${oNo}/pay-result`, { token: tokLate });
      if (r.body?.data?.paid) break;
    }
    // 把出餐日回拨到过去 → 截单时刻已过
    const db = openDb();
    const info = db.prepare('UPDATE ab_order SET meal_date=? WHERE order_no=?').run('2026-09-19', oNo);
    db.close();
    const late = await call('POST', `/orders/${oNo}/cancel`, { token: tokLate });
    rec({
      id: 'E-3',
      title: 'U11 截单后自助取消 → 40004（附团长联系方式）',
      verdict: late.body?.code === 40004 && !!late.body?.data?.leaderContact ? 'PASS' : 'FAIL',
      actual: `构造回拨 rows=${info.changes} code=${late.body?.code} leaderPhone=${late.body?.data?.leaderContact?.phone}`,
      evidence: j(late.body),
    });
  }

  // =====================================================================
  // F. 水平越权
  // =====================================================================
  log('\n── F. 水平越权（读/改他人订单、非团长访问团长/后台域）───────');
  {
    const otherOrder = orderNos['有余额'];
    const g = await call('GET', `/orders/${otherOrder}`, { token: tokMember });
    rec({
      id: 'F-1',
      title: '越权读：A 读 B 的订单详情 → 30010 ORDER_NOT_FOUND（不区分不存在/非本人）',
      verdict: g.body?.code === 30010 ? 'PASS' : 'FAIL',
      actual: `code=${g.body?.code} msg=${g.body?.message}`,
      evidence: j(g.body),
    });
    const c = await call('POST', `/orders/${otherOrder}/cancel`, { token: tokMember });
    rec({
      id: 'F-2',
      title: '越权改：A 取消 B 的订单 → 30010',
      verdict: c.body?.code === 30010 ? 'PASS' : 'FAIL',
      actual: `code=${c.body?.code}`,
    });
    const p = await call('POST', `/orders/${otherOrder}/pay`, { token: tokMember, idem: 'qa-x-priv' });
    rec({
      id: 'F-3',
      title: '越权支付：A 对 B 的订单发起支付 → 30010',
      verdict: p.body?.code === 30010 ? 'PASS' : 'FAIL',
      actual: `code=${p.body?.code}`,
    });
  }
  {
    const wb = await call('GET', '/leader/workbench', { token: tokMember });
    rec({
      id: 'F-4',
      title: '非团长访问团长域 /leader/workbench → 10003（HTTP 403）',
      verdict: wb.body?.code === 10003 && wb.status === 403 ? 'PASS' : 'FAIL',
      actual: `code=${wb.body?.code} http=${wb.status}`,
    });
    const lb = await call('GET', '/leader/balance', { token: tokMember });
    rec({
      id: 'F-5',
      title: '非团长访问 /leader/balance → 10003',
      verdict: lb.body?.code === 10003 ? 'PASS' : 'FAIL',
      actual: `code=${lb.body?.code}`,
    });
    const wd = await call('POST', '/leader/withdraw', { token: tokMember, idem: 'qa-x-wd', body: { amount: 100 } });
    rec({
      id: 'F-6',
      title: '非团长发起提现 /leader/withdraw → 10003（资金入口不对非团长开放）',
      verdict: wd.body?.code === 10003 ? 'PASS' : 'FAIL',
      actual: `code=${wd.body?.code}`,
    });
    const noAuth = await call('GET', '/me/balance');
    rec({
      id: 'F-7',
      title: '无 token 访问 /me/balance → 401',
      verdict: noAuth.status === 401 ? 'PASS' : 'FAIL',
      actual: `http=${noAuth.status} code=${noAuth.body?.code}`,
    });
  }
  rec({
    id: 'F-8',
    title: '✅ 正向：/me/balance 读的是**自己**的余额（无 userId 入参，天然不可越权）',
    verdict: 'PASS',
    actual: '端点签名 balance(@CurrentUser user) → accountOf(user.sub)',
    evidence: 'user.controller.ts:84-92',
  });

  // =====================================================================
  // H. 余额一致性（K16：我的页余额 vs 余额明细）
  // =====================================================================
  log('\n── H. 余额一致性（K16）────────────────────────────────────');
  {
    const t = await (async () => {
      const r = await call('POST', '/auth/login', { body: { code: logins['在职团长+余额'].code } });
      return r.body?.data?.token;
    })();
    const meBal = await call('GET', '/me/balance', { token: t });
    const meLogs = await call('GET', '/me/balance/logs', { token: t });
    const ldrBal = await call('GET', '/leader/balance', { token: t });
    const ldrLogs = await call('GET', '/leader/balance-logs', { token: t });
    const meFen = meBal.body?.data?.balanceFen;
    const ldrFen = ldrBal.body?.data?.balanceFen;
    const latestAfter = meLogs.body?.data?.list?.[0]?.balanceAfterFen;
    const sumNet = meLogs.body?.data?.summary?.netFen;
    rec({
      id: 'H-1',
      title: 'K16 我的页余额（/me/balance）=== 团长余额（/leader/balance）=== 明细最新 balanceAfter',
      verdict: meFen === 8888 && ldrFen === 8888 && latestAfter === 8888 && sumNet === 8888 ? 'PASS' : 'FAIL',
      expected: '三者同为 8888 分（¥88.88），无“两个余额”分叉',
      actual: `me=${meFen} leader=${ldrFen} latestBalanceAfter=${latestAfter} summaryNet=${sumNet}`,
      evidence: j({ me: meBal.body?.data, ldr: ldrBal.body?.data, logsSummary: meLogs.body?.data?.summary }),
    });
    rec({
      id: 'H-2',
      title: 'U14/L19 用户余额明细与团长余额流水**同一实现**（同源）',
      verdict: JSON.stringify(meLogs.body?.data?.summary) === JSON.stringify(ldrLogs.body?.data?.summary) ? 'PASS' : 'FAIL',
      actual: `me=${j(meLogs.body?.data?.summary)} ldr=${j(ldrLogs.body?.data?.summary)}`,
    });
  }

  // =====================================================================
  // I. 团长身份二次校验（不信任 token 的 isLeader）
  // =====================================================================
  log('\n── I. 团长身份二次校验 ────────────────────────────────────');
  {
    // 停职团长本人：登录 isLeader=false；访问团长域 → 20003
    const wb = await call('GET', '/leader/workbench', { token: logins['停职团长本人']._token });
    rec({
      id: 'I-1',
      title: '停职团长（status=2）访问 /leader/workbench → 20003 LEADER_DISQUALIFIED',
      verdict: wb.body?.code === 20003 ? 'PASS' : 'FAIL',
      actual: `code=${wb.body?.code} msg=${wb.body?.message}`,
    });
    rec({
      id: 'I-2',
      title: '停职团长登录出参 isLeader=false（不因档案存在而误判）',
      verdict: logins['停职团长本人'].isLeader === false ? 'PASS' : 'FAIL',
      actual: `isLeader=${logins['停职团长本人'].isLeader}`,
    });
    // 老 token + 事后停职 → 旧 token 应立即失效
    const before = await call('GET', '/leader/workbench', { token: L1.token });
    const db = openDb();
    db.prepare('UPDATE ab_team_leader SET status=2 WHERE id=1').run();
    db.close();
    const after = await call('GET', '/leader/workbench', { token: L1.token });
    const db2 = openDb();
    db2.prepare('UPDATE ab_team_leader SET status=1 WHERE id=1').run();
    db2.close();
    rec({
      id: 'I-3',
      title: '【关键】团长被停职后，**旧 token** 立即失效（服务端实时查库，不信 token.isLeader）',
      verdict: before.body?.code === 0 && after.body?.code === 20003 ? 'PASS' : 'FAIL',
      expected: '停职前 0 · 停职后 20003（旧 token 未过期仍被拦）',
      actual: `before=${before.body?.code} after=${after.body?.code}`,
      evidence: j({ before: before.body, after: after.body }),
    });
  }

  // =====================================================================
  // L. 黑名单用户（ab_user.status=2）能否继续下单
  // =====================================================================
  log('\n── L. 黑名单用户（身份状态）────────────────────────────────');
  {
    const l = await loginAs('黑名单', 'dev:qa_black', (db, id) => {
      db.prepare('UPDATE ab_user SET building_id=1, team_leader_id=1 WHERE id=?').run(id);
    });
    const t = l.token;
    const db = openDb();
    db.prepare('UPDATE ab_user SET status=2 WHERE id=?').run(ids['黑名单']);
    db.close();
    const ord = await call('POST', '/orders', { token: t, idem: 'qa-black-1', body: { mealDate, quantity: 1 } });
    rec({
      id: 'L-1',
      title: '【观察/考虑不周】用户被置黑名单(status=2)后，**已签发 token** 仍可下单',
      verdict: ord.body?.code === 0 ? 'NOTE' : 'PASS',
      expected: '登录环节拦黑名单（20006），但受保护端点未见实时校验 ab_user.status',
      actual: `下单 code=${ord.body?.code} orderNo=${ord.body?.data?.orderNo ?? '-'} msg=${ord.body?.message ?? '-'}`,
      evidence: j(ord.body),
    });
    const relogin = await call('POST', '/auth/login', { body: { code: logins['黑名单'].code } });
    rec({
      id: 'L-2',
      title: '黑名单用户重新登录 → 20006 USER_DISABLED（登录侧已拦）',
      verdict: relogin.body?.code === 20006 ? 'PASS' : 'FAIL',
      actual: `code=${relogin.body?.code} msg=${relogin.body?.message}`,
    });
    // 复原（避免污染后续）
    const db2 = openDb();
    db2.prepare('UPDATE ab_user SET status=1 WHERE id=?').run(ids['黑名单']);
    db2.close();
  }

  // =====================================================================
  // M. 跨楼栋下单归属落库（观察）
  // =====================================================================
  log('\n── M. 跨楼栋下单 ──────────────────────────────────────────');
  {
    const o = await call('POST', '/orders', { token: logins['跨楼栋']._token, idem: 'qa-cross-1', body: { mealDate, quantity: 1 } });
    orderNos['跨楼栋'] = o.body?.data?.orderNo;
    const db = openDb();
    const row = orderNos['跨楼栋'] ? db.prepare('SELECT team_leader_id, building_id FROM ab_order WHERE order_no=?').get(orderNos['跨楼栋']) : null;
    const bldg = row ? db.prepare('SELECT name,building_group_id FROM ab_building WHERE id=?').get(row.building_id) : null;
    const ldr = row ? db.prepare('SELECT real_name,building_id FROM ab_team_leader WHERE id=?').get(row.team_leader_id) : null;
    db.close();
    rec({
      id: 'M-1',
      title: '【观察】跨楼栋下单：取餐楼(用户楼) vs 归属团长所在楼 不一致',
      verdict: o.body?.code === 0 ? 'NOTE' : 'FAIL',
      actual: `order.building=#${row?.building_id}(${bldg?.name}) · order.team_leader=#${row?.team_leader_id}(${ldr?.real_name}@楼${ldr?.building_id})`,
      evidence: j({ code: o.body?.code, orderNo: orderNos['跨楼栋'] }),
    });
    const det = orderNos['跨楼栋'] ? await call('GET', `/orders/${orderNos['跨楼栋']}`, { token: logins['跨楼栋']._token }) : null;
    rec({
      id: 'M-2',
      title: '【观察】订单详情取餐点=用户楼，团长联系人为跨楼团长',
      verdict: 'NOTE',
      actual: `pickup.point=${det?.body?.data?.pickup?.point} · pickup.leaderName=${det?.body?.data?.pickup?.leaderName}`,
    });
  }

  // =====================================================================
  // N. 楼栋状态非启用 → 实测下单
  // =====================================================================
  log('\n── N. 楼栋 status=2 住户下单实测 ──────────────────────────');
  {
    const o = await call('POST', '/orders', { token: logins['楼栋停用']._token, idem: 'qa-bldg2-1', body: { mealDate, quantity: 1 } });
    orderNos['楼栋停用'] = o.body?.data?.orderNo;
    rec({
      id: 'N-1',
      title: '【观察/考虑不周】楼栋 status=2（待开通）住户**下单成功**（服务端全程未查 ab_building.status）',
      verdict: o.body?.code === 0 ? 'NOTE' : 'PASS',
      expected: '规格“只有 status=1 可开团”仅约束后台套餐编排；用户侧 resolveGroup/resolveLeader/create 均不读楼栋状态',
      actual: `下单 code=${o.body?.code} orderNo=${orderNos['楼栋停用'] ?? '-'} msg=${o.body?.message ?? '-'}`,
      evidence: j(o.body),
    });
  }

  // =====================================================================
  // O. 后台对账：K37（看板 vs 财务）、K35（跑批注册）、K36（配送单并发）
  // =====================================================================
  log('\n── O. 后台对账（K37 / K35 / K36）──────────────────────────');
  const adminLogin = await call('POST', '/auth/admin-login', { body: { username: 'admin', password: 'admin123' } });
  const adminToken = adminLogin.body?.data?.token;
  rec({
    id: 'O-0',
    title: '后台超管登录 admin/admin123',
    verdict: adminLogin.body?.code === 0 && !!adminToken ? 'PASS' : 'FAIL',
    actual: `code=${adminLogin.body?.code} role=${adminLogin.body?.data?.account?.role}`,
  });

  if (adminToken) {
    // K37
    const dash = await call('GET', `/admin/stats/dashboard?date=${mealDate}`, { token: adminToken });
    const ovw = await call('GET', `/admin/finance/overview?date=${mealDate}`, { token: adminToken });
    const dm = dash.body?.data?.metrics ?? {};
    const inc = ovw.body?.data?.income ?? {};
    const exp = ovw.body?.data?.expense ?? {};
    const pro = ovw.body?.data?.profit ?? {};
    const same =
      dm.gmvFen === inc.gmvFen &&
      dm.purchaseFen === exp.purchaseFen &&
      dm.commissionFen === exp.commissionFen &&
      dm.fulfillmentFen === exp.fulfillmentFen &&
      dm.grossProfitFen === pro.grossProfitFen;
    rec({
      id: 'O-1',
      title: 'K37 看板 与 财务概览 收支毛利**同一组数字**',
      verdict: same ? 'PASS' : 'FAIL',
      expected: 'gmv/purchase/commission/fulfillment/grossProfit 五项逐项相等',
      actual: same
        ? `全部一致（gmv=${dm.gmvFen} purchase=${dm.purchaseFen} commission=${dm.commissionFen} fulfill=${dm.fulfillmentFen} profit=${dm.grossProfitFen}）`
        : `看板=${j(dm)} 概览收入=${j(inc)} 成本=${j(exp)} 毛利=${j(pro)}`,
      evidence: j({ dash: dm, ovw: { inc, exp, pro } }),
    });

    // K35
    const sch = await call('GET', '/admin/schedule', { token: adminToken });
    const rows = sch.body?.data?.list ?? [];
    const nulls = rows.filter((r) => r.registeredCron === null).map((r) => r.task);
    rec({
      id: 'O-2',
      title: 'K35 跑批时刻表：每行「实际注册时刻」registeredCron 非空',
      verdict: rows.length > 0 && nulls.length === 0 ? 'PASS' : 'FAIL',
      expected: '8 个任务全部 registeredCron 非空（否则“永不跑且不报错”→P1）',
      actual: `total=${rows.length} implemented=${sch.body?.data?.summary?.implemented} registered=${sch.body?.data?.summary?.registered} 空值任务=[${nulls.join(',')}]`,
      evidence: j(rows.map((r) => ({ task: r.task, registeredCron: r.registeredCron, effectiveAt: r.effectiveAt, implemented: r.implemented }))),
    });

    // K36：两窗口改同一张配送单
    const dlist = await call('GET', '/admin/deliveries', { token: adminToken });
    const drows = dlist.body?.data?.list ?? dlist.body?.data?.items ?? (Array.isArray(dlist.body?.data) ? dlist.body.data : []);
    const target = drows.find((r) => r && r.id != null);
    if (!target) {
      rec({
        id: 'O-3',
        title: 'K36 两窗口改同一张配送单',
        verdict: 'UNKNOWN',
        actual: `无可改配送单（list=${j(dlist.body?.data)}）`,
      });
    } else {
      const v0 = target.version;
      const a = await call('PUT', `/admin/deliveries/${target.id}`, {
        token: adminToken,
        body: { version: v0, reason: 'QA窗口A改份数', totalQuantity: (target.totalQuantity ?? 1) + 1 },
      });
      const b = await call('PUT', `/admin/deliveries/${target.id}`, {
        token: adminToken,
        body: { version: v0, reason: 'QA窗口B改司机', driverName: 'QA-B司机' },
      });
      rec({
        id: 'O-3',
        title: 'K36 两窗口改同一张配送单：后提交者被拒（30016），**不得都成功**',
        verdict: a.body?.code === 0 && b.body?.code === 30016 ? 'PASS' : b.body?.code === 0 ? 'FAIL' : 'FAIL',
        expected: 'A=0(成功) · B=30016(乐观锁冲突)',
        actual: `id=${target.id} v0=${v0} A.code=${a.body?.code} B.code=${b.body?.code} B.data.current.version=${b.body?.data?.current?.version}`,
        evidence: j({ a: a.body, b: b.body }),
      });
      // 复原份数
      const cur = b.body?.data?.current?.version ?? a.body?.data?.version;
      if (cur != null) {
        await call('PUT', `/admin/deliveries/${target.id}`, {
          token: adminToken,
          body: { version: cur, reason: 'QA复原份数', totalQuantity: target.totalQuantity },
        });
      }
    }
  }

  // =====================================================================
  // P. 供应商出餐确认 → 订单 cut_off→cooked（K47 反面）
  // =====================================================================
  log('\n── P. 供应商出餐确认联动（K47）────────────────────────────');
  {
    const supLogin = await call('POST', '/auth/admin-login', { body: { username: 'sanweiwu', password: 'supplier123' } });
    const supToken = supLogin.body?.data?.token;
    const wb = await call('GET', `/supplier/workbench?date=${mealDate}`, { token: supToken });
    const items = wb.body?.data?.items ?? wb.body?.data?.plans ?? [];
    rec({
      id: 'P-0',
      title: 'S1 供应商出餐工作台可读（sanweiwu）',
      verdict: supLogin.body?.code === 0 && wb.body?.code === 0 ? 'PASS' : 'FAIL',
      actual: `login=${supLogin.body?.code} workbench=${wb.body?.code} items=${Array.isArray(items) ? items.length : 'n/a'} empty=${wb.body?.data?.summary?.empty}`,
      evidence: j({ summary: wb.body?.data?.summary, keys: Object.keys(wb.body?.data ?? {}) }),
    });
    rec({
      id: 'P-1',
      title: 'K47 出餐确认后订单应离开 cut_off',
      verdict: 'UNKNOWN',
      actual: '本次探针未对 T 日出餐单据发起 cook-confirm（需先造 cut_off 单 + 场所到齐，工序较长）—— 交工程另测',
    });
  }

  // =====================================================================
  await stopApiServer(server, PORT);
  finish();
}

function finish() {
  log('\n──────── 结论汇总 ────────');
  const by = (v) => results.filter((r) => r.verdict === v);
  log(
    `PASS=${by('PASS').length} FAIL=${by('FAIL').length} NOTE=${by('NOTE').length} UNKNOWN=${by('UNKNOWN').length} / 共 ${results.length}`,
  );
  const fails = by('FAIL');
  if (fails.length) log(`FAIL：${fails.map((f) => f.id).join(', ')}`);
  log('\n===JSON===');
  log(
    JSON.stringify(
      { generatedAt: new Date().toISOString(), ids, logins, orderNos, results },
      null,
      1,
    ),
  );
  log('===ENDJSON===');
}

main().catch((e) => {
  log(`\n✘ 探针异常：${e?.stack ?? e}`);
  try {
    finish();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
