# ABox 一盒 · 整体复查报告 v1.0（6 域全量只读体检）

> 生成：2026-10-04 · 触发：用户「不光是客服模块，是整体复查，避免因为某个模块的改动而导致其它连带问题出现」
> 性质：**只读体检**。本报告不修改任何产品代码；是否动手另按 §6 批次走。
> 状态：**α（`142887d`）+ β（`35ed4d4`）+ γ-楷体批 + γ 剩余项（本次）已执行，同为 2026-10-07**，见 §6.1 / §6.2 / §6.3 / **§6.4**；
> **γ 剩余项已拍板并落码**：协议正文（时刻加「以页面实时展示为准」兜底 + 「客服微信号」→「联系客服」）·
> 3.1 `total_out`（**裁定维持现状**，并把裁定写进代码防复发）· 26 探针收编进仓库 ·
> operator 可写范围（**维持**，回源确认注释已写明刻意）。
> **明确不做**：25 CI `fetch-depth: 0`（实测无任何门禁依赖 git 历史）· ⑫ 7 道门禁补覆盖面（低优先级）。
> 方法：6 个域并行排查 → **每条结论回代码复核**（读文件 / grep / 读构建产物）→ 定级 → 归三条根因。
> ⚠️ 文件名带 `_` 前缀是**刻意的**：真源链路匹配 `ABox一盒*.md`，带前缀才不会进 `sync-docs` 镜像（已机械复核 0 命中，见 §7）。

---

## 0. 方法与证据分级

| 项 | 说明 |
|---|---|
| 证据级别 | **【实证】**=已读代码/产物并附 `文件:行`；**【已登记】**=行为已在注释或真源文档裁定过；**【推断】**=未复核，只在 §附录，**禁止据此改代码** |
| 复核纪律 | subagent 的发现一律只当「去哪里看」的索引。**本报告 12 条 P1 全部由本人回源码复核过**，其中 3 条在复核中**下调了级别**（见 §3.1 / §3.4 的「复核修正」） |
| 定级口径 | P0/P1 = 数据错 / 钱错 / 权限错且**当前路径可达**；P2 = 真缺陷但被 mock / 未实装 / 外部条件掩盖，或**会产生假绿结论的基建缺陷**；P3 = 潜伏漂移源 / 死代码 / 卫生问题；P4 = 纯展示不一致。**每条都写「为什么现在测不出来」** |
| 门禁基线 | 本次复查时 `gate.mjs all` 24/24、`verify` 4/4（m1 114 / m2 150 / m3 1335）、`deep-kf` 34/34 —— 即**在一切全绿的前提下**挖出下列条目 |

### 明确不在范围（避免把已知项误诊成新缺陷）

1. 已登记未收口：F-10 写钱路径缺收款人身份闸门 · #80/#81（须真机复现）· D-1 `getNumber()` fallback 恒不生效 · 供应商端「我的菜品」说明页 · 合规清单 §七 row2。
2. 外部条件阻塞：线上 `PROVIDER_MODE=mock` · 8081 安全组待放行 · 小程序备案 / 食品经营许可证 · 服务器仍为 10-02 旧代码（含首次 DDL 迁移）。
3. 上一批刚收口、本次不再列：客服 `extInfo` P0（`a7625d5`）· 溯源页第三方信息（`1181a9b`）· 取消理由后台闭环（`9b871be`）。
4. 已裁定不做的：全站响应式（只做两条关键路径）、一级分销外的一切分销形态、小程序内第三方跳转/口令（已否）。

---

## 1. 结论速览

| # | 级别 | 一句话 | 域 |
|---|---|---|---|
| 1 | **P1** | `markPaid` 支付回调**无条件覆盖订单状态**，与取消/截单并发会把 `cancelled` 复活成 `paid` | 状态机 |
| 2 | **P1** | **operator 可执行 D10 改单 / D11 强制退款**——与项目自订的「operator 只在读侧」纪律相反 | 鉴权 |
| 3 | **P1** | D11 强制退款**不写 `cancel_source`**，与导出注释「空白=未取消」直接矛盾，取消归因少一整档 | 状态机 |
| 4 | **P1** | 取消路径 `ab_refund.amount` 只记微信实付（漏余额抵扣），与代退路径口径不一致 | 状态机 |
| 5 | **P1** | 出餐截止 **09:30** 是第二份时刻定义：不在 `order-timeline.ts`、不可配、用 `Date.now()` | 状态机 |
| 6 | **P1** | `actions.canAdjust/canForceRefund` 只算订单状态**不算角色** ⇒ operator 端「按钮亮着、点了真能改钱」 | 鉴权 |
| 7 | **P1** | `icons:lock` 的 14 条自证**只在 `--selftest` 下跑**，门禁路径从不带 ⇒ 自证在 CI 从未执行；且 0 样本恒绿 | 基建 |
| 8 | **P1** | e2e 断言数**只打印不断言**，`results.length === 0` 时输出「通过 0/0 · 全绿 ✅」并 exit 0 | 基建 |
| 9 | **P1** | 楷体 `ABoxKai` **在小程序端恒不生效**（`@font-face` 被 `#ifdef H5` 编译掉），同时 597 KB 字体文件被打进主包 | 前端 |
| 10 | **P1** | 取消页「电话」行调 `makePhoneCall` 传的是**脱敏号**且 `fail` 静默吞 ⇒ 点了毫无反应 | 前端 |
| 11 | **P1** | `gate:parity` 的「CI 全覆盖」只比对 `all`+`verify` 两个别名 ⇒ 3 道门禁永不在 CI 跑却仍报「全覆盖」 | 基建 |
| 12 | **P1** | 7 道门禁成功时**零输出**（lint / typecheck×3 / build:api / shared×2），「0 文件被 lint」永远发现不了 | 基建 |
| 13 | P2 | 截单后退款不回退 `total_out`，与截单前取消路径**口径相反**，而 `total_in/out` 是**下发给团长页**的可见字段 | 资金 |
| 14 | P2 | `ab_withdraw.version` 是死列，且 `approve` 的注释**谎称**用了它做乐观锁 | 资金 |
| 15 | P2 | 两处**未声明的迁移边**（L9 `delivering→completed`、D11 多起点→`refunded`），`state:audit` 只看状态不看边 | 状态机 |
| 16 | P2 | 团长代退的取消理由在后台/导出显示为**英文枚举名**（`quality`/`missing`…），正确文案表已 import 却没用 | 状态机 |
| 17 | P2 | 端上 6 处硬编码 `14:00`/`24:00` 时刻，违反本仓自订铁律；`dup:const` 只拦 `'11:30'` | 前端 |
| 18 | P2 | 后台 2 处残留 `@media (max-width:1100px)`（断点真源是 768），**无任何门禁扫 `@media`** | 前端 |
| 19 | P2 | 后台 9 处本地 `money()` 重抄 `fenToCny`，空值已分叉成 `¥0.00`（真源是 `—`） | 前端 |
| 20 | P2 | 余额详情页接口失败被渲染成「**¥0.00**」，与「余额真的是 0」无法区分 | 前端 |
| 21 | P2 | 后台列表接口失败**残留旧数据**（只弹 toast 不清空）⇒ 运营可能拿旧数据配新筛选做决策 | 前端 |
| 22 | P2 | 客服三档 `csMode` 在 e2e 中**零断言**；且本地 dev 库 `service.cs_mode` 已被人工写成 `garbage` | 契约 |
| 23 | P2 | `cancel_source` 三来源只测了 `user` 一条；`system`/`leader` 零回归（而它是取消统计的核心字段） | 契约 |
| 24 | P2 | `seed-demo` 自检仍**强制「一人一日一单」** ⇒ 演示环境永远看不到放开后的多单形态 | 状态机 |
| 25 | P2 | CI 用默认浅克隆（`fetch-depth` 未设）⇒ `security:scan` 的「完整 git 历史扫描」在 CI 上恒 N/A | 基建 |
| 26 | P2 | 5 支深度探针在**仓库之外** + 硬编码绝对路径 + 4 支无自证 + 2 支未进串跑 ⇒ 必然失传 | 基建 |
| 27 | P2 | 5 处判据缺「样本数 > 0」下限 ⇒ 扫描面变空时与「全对」同形 | 基建 |
| 28 | P3 | `refund-apply` 无传输层幂等；`ab_withdraw` 三次状态推进无占位；`CANCEL_NOTE_MAX` 注释谎报列长 | 多域 |
| 29 | P3 | 迁移 ↔ 实体的列 COMMENT 漂移 22 处；`dist` 孤儿 `dish-slot.*`；端上 `constants` 重抄真源且零消费 | 契约 |
| 30 | P3 | `e2e-m3` 两处头注释仍是「一人一日一单」旧口径；`tests/tools/README.md` 三处数字过期（18 道 / `_stale-build` / 146 端点） | 基建 |

---

## 2. 详细条目（P1 全条 · 逐条六字段）

### ① P1 · `markPaid` 支付回调无条件覆盖订单状态

- **位置**：`apps/api-server/src/modules/order/order.service.ts:1194`（事务外快照读）、`:1225-1239`（事务内写入）
- **症状**：事务外 `if (order.status !== PENDING_PAY) return` 之后，事务内 `m.getRepository(Order).update({ id: order.id }, { status: PAID, ... })` —— **WHERE 只有 id**，没有 `status` 条件，`version` 也只是 `(order.version ?? 0) + 1` 的内存快照值。
- **证据**（已读原文）：
  ```ts
  await m.getRepository(Order).update(
    { id: order.id },                                   // ⭐ 无 status 条件
    { status: OrderStatus.PAID, paidAt: now, version: (order.version ?? 0) + 1 },
  );
  ```
  对照同文件 U11 自助取消（`:545-558`）是 `.where('id = :id AND status = :from')` + `version: () => 'version + 1'` + `affected` 判定 —— **全仓 11 处订单写入点，唯独这一处不带守卫**。
- **复核修正（下调级别）**：资金域原判 P0「余额双动」。我复核 `updateBalanceRow`（`:1485-1502`）**确实是 CAS**（`WHERE id=? AND version=?` + `affected=0` 抛 `BALANCE_CONCURRENT_MODIFIED`）⇒ 有余额抵扣时，`consumeBalance` 会撞 version 抛错、整事务回滚，**钱不会双动**。故下调为 P1，危害收窄为「**纯微信支付场景的状态错乱**」：用户已看到「已取消」，回调随后把订单写回 `paid`；同理可与截单跑批打架（已截单日里出现一张 `paid` 单，且 `autoConfirmByDate` 会把它计进履约异常永不收口）。
- **根因**：这是本仓反复收口的「先查后写」同族缺陷（#77/#80 在 `refund.service.ts:466`、`order.service.ts:511`、`reversal.service.ts:256` 三处修过），**`markPaid` 是漏网的第四处**。
- **影响面（为何测不出）**：e2e 全串行，`/pay/mock/paid` 与 `/orders/:no/cancel` 从不并发；`state:audit` 只判「状态有没有人写」，不判「写的时候有没有守卫」；`version` 内存自增使乐观锁完全失效。
- **修复**：改为 `.where('id = :id AND status = :st', { st: PENDING_PAY })` + `version: () => 'version + 1'`，`affected === 0` 时返回 `{ changed: false, reason: 'status_changed' }`（这是**幂等成功**不是错误）。并把 `balanceUsed` 改为事务内重读（`:701-710` 的 `cutoffByDate` 已立此纪律）。
- **机械防护**：`order-state-audit.ts` 增判据 —— 每个 `.update(Order)` / `createQueryBuilder().update(Order)` 的窗口内必须出现 `status =` 或 `status IN`；`version: (x ?? 0) + 1` 形态一律 FAIL。
- **【实证】**

### ② P1 · operator 可执行 D10 改单 / D11 强制退款（权限）

- **位置**：`apps/api-server/src/modules/order/order-admin.controller.ts:44`（类级）、`:93`（`@Post('manual-adjust')`）、`:123`（`@Post(':orderNo/force-refund')`，**两处均无方法级 `@Roles`**）
- **症状**：类级白名单 `@Roles('super_admin','admin','operator','finance')` 被写端点直接沿用 ⇒ 运营专员能强制退款（含佣金反冲 + 应付冲减）与改单（份数 / 取餐楼）。
- **证据**：
  ```ts
  // order-admin.controller.ts:44
  @Roles('super_admin', 'admin', 'operator', 'finance')
  // finance.constants.ts:23（项目自己写的纪律）
  // `operator` **只在读侧**：它的职责是「看见异常并上报」，不是「拍板把钱发出去」。
  // finance.constants.ts:43
  export const FUND_ACTION_ROLES = ['super_admin', 'admin', 'finance'] as const;   // 不含 operator
  ```
  财务域 6 个资金端点（`finance-admin.controller.ts:134/180/290/318/346`、`refund-admin.controller.ts:87/109`、`supplier-share-admin.controller.ts:86/103`）**全部**用 `FUND_ACTION_ROLES` 收窄；订单域这两个写端点没收窄。
- **根因**：类级白名单是按「谁能看订单」定的（注释：财务对账要看），写端点照抄；`finance.constants.ts` 那次「权限常量单一真相」收敛没覆盖订单域。
- **影响面（为何测不出）**：`route-audit.ts:90` 的 `READONLY_ROLES = ['viewer']` ⇒ 「资金写端点含只读角色」这条规则**只盯 viewer，永不看 operator**；`nav:consistency` 只比菜单不看接口；e2e 的 D10/D11 全用 `adminToken`，全脚本 `opToken` 只出现在 4 处（系统账号/角色/profile/团长），**无一处断言 operator 打 D10/D11 应 10003**。
- **修复**：两处加 `@Roles(...FUND_ACTION_ROLES)`（用常量不写字面量）。
- **机械防护**：`route-audit.ts` 增 R11 —— `isFund(path) && method !== 'GET'` 的端点，effective 白名单含 `operator` 即 FAIL 或须进显式豁免表；e2e 补「operator → 10003」断言。
- **【实证】**（是否刻意未登记，与自订纪律相反）

### ③ P1 · D11 强制退款不写 `cancel_source`

- **位置**：`apps/api-server/src/modules/finance/refund.service.ts:712-724`（`settleRefundDb` 的原子占位）
- **症状**：`.set({ status: REFUNDED, cancelledAt: now, version })` —— `cancel_source` / `cancel_reason` / `cancel_note` **一列都不写**，而 `CANCEL_SOURCE` 只有 `user/system/leader` 三值，**没有 `admin`**。
- **证据**（已读原文，占位段确无三列）：全仓 `cancelSource` 写入点仅 4 处——`order.service.ts:553`(user)、`:745`(system)、`refund.service.ts:232`(leader)、`:624`(驳回清 null)。
- **根因**：`settleRefundDb` 是 D41 与 D11 的**共用执行口**；D41 的 `cancel_source` 在申请段已写好（看不出问题），D11 从未写就直接暴露。
- **影响面（为何测不出）**：`order-admin.service.ts:491-492` 注释定义「空白 = 未取消」⇒ 运营取数时**后台强制退款这一整类被当成未取消漏掉**；`stats` 域完全不读该列。测不出：e2e 的 D11 用例只断言 refundNo/状态/金额，不查 `cancel_source`。
- **修复**：`forceRefund` 建单后补写三列（`admin` 需先入 `CANCEL_SOURCE` 与 `CANCEL_SOURCE_LABEL`，否则显示英文）；`cancel_reason` 列长 32、`cancel_note` 128，注意别写反。
- **机械防护**：不变量门禁 —— `status IN ('cancelled','refunded') AND cancelled_at IS NOT NULL` ⇒ `cancel_source IS NOT NULL`（历史行按迁移日期豁免并计数）。
- **【实证】**

### ④ P1 · 取消路径 `ab_refund.amount` 只记微信实付

- **位置**：`refund.service.ts:1067-1069`（`buildRefundRow`，服务取消 / 延迟到账）vs `:192`（`applyByLeader`，代退）
- **症状**：同一笔「用户实际付出去的钱」，代退记 `总额 − 优惠`（含余额抵扣），取消路径只记微信实付。
- **证据**：代退侧注释明写「⚠️ 修正（M3-3）：此前取 `order.payAmount`（仅微信实付），余额抵扣部分被漏记」；而 `buildRefundRow` 仍是 `amount: money(wxFen / 100)`。
- **根因**：M3-3 只修了代退那一条建单口，另一条（即时退款）没同步。
- **影响面（为何测不出）**：e2e 的取消用例都用纯微信支付（`balanceUsed=0`）⇒ 两口径恰好相等，**差异被夹具设计掩盖**。财务按 `ab_refund` 汇总时会系统性少算余额抵扣部分。
- **修复**：`buildRefundRow` 的 `amount` 改取 `refundableYuan(order)`（已有函数，`:1094`）。
- **机械防护**：不变量断言「对同一订单，任一路径建出的 `ab_refund.amount` = `total_amount − discount_amount`」+ 补一条 `balanceUsed > 0` 的取消用例（当前缺失）。
- **【实证】**

### ⑤ P1 · 出餐截止 09:30 = 第二份时刻定义

- **位置**：`apps/api-server/src/modules/supplier/supplier.service.ts:40-43`（3 个裸常量）、`:1011-1024`（`assertNotOverdue` 用 `Date.now()`）
- **症状**：业务硬闸时刻以裸常量写在业务文件里，不在 `BusinessTimeline`（9 个时刻里没有它）、不在 `TIMELINE_CONFIG_KEYS`（不可配）、不在 `TASK_SCHEDULES`。
- **证据**：真源 `order-timeline.ts:15` 自称「这些时刻的**唯一真相**是 `DEFAULT_TIMELINE`」，而 `:9-15` 登记的漂移源只有 3 处 —— **09:30 未被登记为第 4 处**。另 `time.ts:77-81` 明写「一切相对现在的判定都必须经由此函数（`now()`）」，此处用 `Date.now()` 违反。
- **根因**：#49 那次收口只扫了 `ab_config` / `TASK_SCHEDULES.cron` / `time.ts` 三个面，09:30 没有 cron 也没有 config 键 ⇒ 三个扫描面都碰不到它。
- **影响面（为何测不出）**：`dup:const` 只查 `'11:30'`；e2e 用「昨日必拒 / 明日必过」构造，与 09:30 的具体数值无关 ⇒ **即使改成 08:00，e2e 仍全绿**。运营改「送达时间」立刻生效，改不了出餐截止 ⇒ 「配了不生效」在另一个旋钮上复现。
- **修复**：`BusinessTimeline` 增 `cookConfirmDeadline`；`assertNotOverdue` 改用 `now()`。
- **机械防护**：`dup:const` 增 `timeline-const` 判据 —— 全仓（含 `.vue`）形如 `const XXX_HOUR = n` / `'_HH:mm_'` 的声明，凡不在 `order-timeline.ts` 内即 FAIL。
- **【实证】**

### ⑥ P1 · `actions.canAdjust / canForceRefund` 只算状态不算角色

- **位置**：`order-admin.service.ts:129`（`detail()` 连 `viewerRole` 入参都没有）、`:241-246`
- **症状**：控制器注释声称「按钮可用性口径唯一在服务端」，但服务端只算 `adjustBlockReason(order) === null`，不算角色 ⇒ operator 打开订单详情，改价/强制退款按钮亮着，点了就成功。
- **证据**：财务域同名字段是角色驱动的 —— `balance-admin.service.ts:76` `canAdjust: BALANCE_ADJUST_ROLES.includes(viewerRole)`、`withdraw-admin.service.ts:199` `canAudit: FUND_ACTION_ROLES.includes(viewerRole)`。**同项目两种互不相干的写法**。
- **影响面（为何测不出）**：admin-web 无按角色的按钮可用性测试；e2e 只断言 `actions` 是布尔；`nav:consistency` 不看接口出参。
- **修复**：`detail()` 加 `viewerRole` 入参，`canAdjust = blockReason === null && FUND_ACTION_ROLES.includes(role)`。
- **机械防护**：e2e 不变量 —— operator 拉详情断言 `canAdjust === false`，admin 断言 `true`。
- **【实证】**

### ⑦ P1 · `icons:lock` 自证空转 + 0 样本恒绿

- **位置**：`scripts/check-icon-lock.mjs:516-519`（`main()` 开关）、`:522-558`；对照 `gate.mjs:282`（cmd 无 `--selftest`）
- **症状**：`main()` 第一行 `if (process.argv.includes('--selftest')) return selftest()` ⇒ **不带参数就一行自证都不跑**，而门禁 cmd 从不带该参数。叠加 0 样本时 `bad_ === 0` ⇒ 打印「✅ 全部通过」exit 0。
- **证据**（已读原文）：
  ```js
  function main() {
    if (process.argv.includes('--selftest')) { console.log('---- 自证 ----'); return selftest() ? 0 : 2; }
    const files = walkVue(SRC);        // files=0 时后续全为 0
    ...
    console.log(`\n${bad_ === 0 ? '✅ 全部通过' : ...}`);   // 0 样本 = 全通过
  ```
  对照组：`check-design-spec.py:857` 与 `check-e2e-message-assert.mjs:179` 都**无条件先跑自证** ⇒ 本仓已有正确范式，`icons:lock` 是唯一漏网的。头注释自述「十四组合成样本…任一侧不符即 exit 2」，与代码行为矛盾。
- **根因**：自证被实现成「可选子命令」而非「前置断言」，且无任何判据检查「自证是否跑过」。
- **影响面（为何测不出）**：判据一旦失效（正则失配 / 承载方式变组件 / 路径变）表现为 0 命中 + exit 0 + 「✅ 全部通过」，**与全对完全同形**；且脚本内部其实会打印 `③ 覆盖率：X/Y`，但 `gate.mjs` 的 `REPORT_RE` 无对应正则，汇总只截最后一行 ⇒ `0/0` 永远不出现在人眼前。
- **修复**：`main()` 开头无条件跑自证；补 `files.length > 0` / `interpTotal > 0` 下限；`REPORT_RE` 补 `③ 覆盖率` 行。
- **机械防护**：新增**元门禁** —— 凡声明「自带自证」的 `scripts/check-*.mjs`，其 `main()` 必须在无条件路径调用自证，否则红。
- **【实证】**

### ⑧ P1 · e2e 断言数只打印不断言，0 条也绿

- **位置**：`scripts/e2e-m1.mjs:1047-1048`、`e2e-m2.mjs:1341/1344`、`e2e-m3.mjs:15652`
- **症状**：收尾 `log('通过 X/Y')` 后 `process.exit(failed.length ? 1 : 0)` ⇒ `Y === 0` 时打印「通过 0/0 · 全绿 ✅」并 exit 0。基线 114/150/1335 **只写在文档里**，无任何机械断言。
- **证据**（已 grep 到源码行）：`e2e-m3.mjs:15652` 确为该形态；全仓 grep `results.length === 0` 无命中。
- **根因**：「条数」被当账本数字而非断言；本仓在 `check-gate-parity.mjs:59` 已为门禁条数做过标记校验，e2e 断言数没有对应机制。
- **影响面（为何测不出）**：某次改动让一节被跳过时，`1335` 静默掉到 1300 而照样全绿；极端掉到 0 也绿。**这正是「一条 e2e 断言恒红 17 天」的镜像面**——那次是恒红被淹没，这次是缩水/恒绿被淹没。
- **修复**：三份收尾加 `if (results.length === 0) exit 1`，并加下限常量（只允许上升）。
- **机械防护**：`gate.mjs` 加 `EXPECT_MIN = { 'e2e:m1':114, 'e2e:m2':150, 'e2e:m3':1335 }`，解析 `通过 (\d+)/(\d+)` 后小于阈值即整道判红（阈值放 `gate.mjs`，不写进文档）。
- **【实证】**

### ⑨ P1 · 楷体在小程序端恒不生效 + 597 KB 死文件进包

- **位置**：`apps/miniprogram/src/styles/tokens.scss:105-113`；产物 `apps/miniprogram/dist/build/mp-weixin/`
- **症状**：`@font-face` 被 `/* #ifdef H5 */` 包住 ⇒ mp 端 `'ABoxKai'` 无定义，整条字体栈落空回退系统黑体；而字体文件仍被打进小程序包。
- **证据**（**读构建产物取证**）：
  ```
  app.wxss:  grep -c "@font-face" → 1        ← 只有 ABoxIcons 那一条（base64）
             grep -o "ABoxKai"    → 仅出现在 font-family 栈，无 @font-face 定义
  static/fonts/ab-kaiti.woff2 → 597,044 字节（主包 2MB 配额的 29%，零引用）
  ```
  自相矛盾的邻文件：`icons.scss:7-9` 明写「小程序 @font-face 的 src **不支持本地文件路径**，只接受网络地址或 base64」⇒ 即便去掉条件编译，`url()` 也无效。
- **根因**：注释里写的「对策：自带子集字体」实际只对 H5 生效，**主端恰恰没生效**，而注释继续宣称对策已落地。
- **影响面（为何测不出）**：`#ifdef` 是 uni-app 合法条件编译，构建全绿；无门禁问「字体是否注册成功」；**只有真渲染**（`document.fonts.check` + 量 `getBoundingClientRect`）才取证得到，本报告是靠读产物 wxss 间接坐实。
- **修复**：二选一 ——(a) 产出 base64 内嵌版子集（与 `icons.scss` 同款，需进一步子集化到仅标题字）；(b) 承认小程序端不用楷体，把字体移出小程序工程并改掉那句「对策已生效」的注释。
- **机械防护**：`font:registered` 判据 —— wxss 里 `font-family` 栈出现的自定义字体名，必须能在同批 wxss 找到 `@font-face`；`static/` 下零引用字体文件即报死资源。
- **【实证】**（源码 + 产物双证据）

### ⑩ P1 · 取消页「电话」点了没反应（拨脱敏号 + 静默吞失败）

- **位置**：`apps/miniprogram/src/pages/order-cancel/order-cancel.vue:254-257`、`:198-199`
- **症状**：蓝色链接样式的「电话 138****0001」行，点击**无任何反馈**。
- **证据**（已 grep 到原文）：
  ```ts
  uni.makePhoneCall({ phoneNumber: leaderPhone.value, fail: () => undefined });
  ```
  而 `leaderPhone` 由 `maskPhone()` 派生（服务端 `order.service.ts:417/451/490` 恒脱敏）。**禁用依据就写在隔壁页**：`order-detail.vue:266-268`「团长手机号在出参里**已脱敏**…故『联系团长』**不做 `makePhoneCall`**（拨一个 `138****0001` 只会失败）」，且 `order-detail.vue:447-453` 正确实现了引导走微信群/客服。
- **根因**：同一件事有两份结论；取消页是 10-04 批次改动的页面，改了取消原因、**没同步这条口径**。
- **影响面（为何测不出）**：类型完美匹配（string→string）；`fail: () => undefined` 把微信的失败**静默吞掉**，既不弹错也不打日志；开发者工具里拨号本就不可用，测试会当「工具限制」放过。
- **修复**：照 `order-detail.vue:447-453` 改成弹 toast 引导；`fail` 至少 `console.warn`。
- **机械防护**：判据一 —— `makePhoneCall` 的实参若由 `maskPhone(...)` 派生即报；判据二 —— 全仓禁止 `fail: () => undefined` 空回调。
- **【实证】**（口径已登记于 `order-detail.vue:266-268`；违反点未登记）

### ⑪ P1 · `gate:parity` 的「CI 全覆盖」只比对两个别名

- **位置**：`scripts/check-gate-parity.mjs:153-159`；对照 `gate.mjs:424-467`
- **症状**：输出「定义 31 道 · all 24 · verify 4 · **CI 已全覆盖**」，而 CI 实际只跑 28 道 —— `format:write`（写命令）、`seed:demo`、`design:docs`（只在 `design` 别名，CI 不调）**永不在 CI 执行**。
- **证据**：判据只遍历 `['all','verify']` 的成员做差集，全程没有 `truth.gates`（31 全集）与 `covered` 的差集。
- **根因**：判据的**声明口径（全量门禁）与实现口径（两个别名的成员）不是同一份表述** —— 正是这条门禁自述要治的那条病根。
- **影响面（为何测不出）**：未来任何人往 `GATES` 加一道却忘了塞进别名 ⇒ 该门禁**从第一次提交起永不在 CI 执行**而 `gate:parity` 依旧绿；自证 14 个样本没有一个覆盖「新增了不属于任何别名的门禁」。
- **修复**：补 `orphan = truth.gates.filter(g => !covered.has(g))`，非空即报；对刻意排除的建显式豁免表并校验「表内条目仍存在于 `truth.gates`」（防腐烂豁免）；输出文案不许再无条件打印「已全覆盖」。
- **【实证】**

### ⑫ P1 · 7 道门禁成功时零输出（「无输出即通过」）

- **位置**：`scripts/gate.mjs:516-524`（`REPORT_RE` 只覆盖 6 道）、`:528`（兜底提示）、`:588`（成败只看 exit code）
- **症状**：`shared:types`、`shared:utils`、`lint`、`typecheck:api/admin/mp`、`build:api` 汇总行一律是「（无输出 —— 该门禁应自报覆盖面）」**且照旧计绿**。
- **证据**（实跑日志 `gate-all7.log`）：7 条该提示；其中 `lint` 跑了 23 秒，但**没人知道它扫了多少文件、启用了多少规则**。
- **根因**：2026-09-21 的「门禁自报覆盖面」对策只解决了「成功时保留 stdout」，没解决「`tsc`/`eslint`/`nest build` 静默成功时本来就没有 stdout」；缺覆盖面不是失败条件。
- **影响面（为何测不出）**：`eslint` 若因配置问题实际 0 文件命中（如 `--ext` 写错、`ignorePatterns` 误伤），输出同样为空且 exit 0 ⇒ 「0 文件被 lint」与「300 文件全通过」在汇总里**长得一样**。
- **修复**：给零输出门禁补覆盖面来源（`eslint --format json` 计数 / `tsc --listFiles | wc -l` / 产物文件数）；`reportOf` 命中占位串时记 `COVERAGE_MISSING` 并让汇总退出非零。
- **【实证】**（对策已登记；「实施后仍有 7 道无输出且不算失败」这一残余未登记）

---

## 3. P2 重点条目（其余见表）

### 3.1 资金：截单后退款不回退 `total_out`（P2）

`reversal.service.ts:154-171` 只 `SET balance`，而截单前取消路径 `order.service.ts:1583-1606` 会回退 `totalOut`；且 `reversal.service.ts:102-103` 的注释**宣称两者同口径**（只对了「流水类型」一半）。
- **为何是用户可见**：`totalInFen/totalOutFen` 由 `leader-money.service.ts:77-78` 下发给团长余额页与后台账户详情。
- **为何测不出**：e2e 的会计恒等式只在提现链路（§31）跑，退款链路一次都不跑；种子没构造「余额抵扣 + 截单后退款」组合。
- **⚠️ 与已登记的 A3（佣金冲销只扣 balance）是同一族，必须同批裁定**：只修一条恒等式仍然破。要么都补记账，要么都改语义并显式声明。
- **【实证】**（A3 已登记；本条未登记）

### 3.2 状态机：两处未声明的迁移边 + 取消理由显示英文（P2）

- L9 `delivering → completed`（`leader-order.service.ts:262-270`）未进 `ORDER_TRANSITIONS`；`order.service.ts:882-885` 注释登记了「宽严不同是刻意的」，但**唯一被机器执行的那份（声明表）仍是旧的**。
- D11 可把 6 个非终态一步推到 `refunded`，而声明表里 `refunded` 的入边只有 `refund_applying`/`refunding`；真源文档 T16 还写的是 `cancelled` ⇒ 三份表述不一致。
- 后台/导出的「取消理由」对代退单显示英文枚举名（`order-admin.service.ts:672-674` 用 `CANCEL_REASON_LABEL`，而 `REFUND_REASON_LABEL` **已在本文件 import 却没用**）。
- **为何测不出**：`state:audit` 是**状态级不是边级**（其源码自述「本门禁不验证『边』」）；导出断言只验列数与行数。

### 3.3 契约：客服三档零断言 + 本地库脏值（P2）

- 全仓 e2e `grep csMode` ⇒ **零命中**；而「非 `wechat_kf` 档两参数恒 null」是三档功能**唯一的正确性保证**，无一条回归。若有人改成无条件下发，`=== 33` 仍成立 ⇒ 门禁全绿。
- 本地 `data/abox-dev.sqlite` 里 `service.cs_mode = 'garbage'`（`cs_corpid='ww_contact_mode'`）—— 不来自种子（种子落 `'none'`），是人工直连改库后未还原；读侧静默降级为 `none`，**无任何告警**。这正是「运营以为配了微信客服、用户实际拿到复制微信号」的形态。
- `cancel_source` 三来源只测了 `user`；`system`/`leader` 零回归 —— 而 DTO 头注自己点明这是取消统计的**核心字段**。

### 3.4 基建：CI 浅克隆 / 探针失传 / 样本下限缺失（P2）

- `ci.yml:45` 未设 `fetch-depth: 0` ⇒ `security:scan` 的「完整 git 历史扫描」在 CI 上只覆盖 1 个 commit，而 `security-scan.ts:369` 的 `catch { return [] }` 是**静默降级**，注释承诺的「由调用方记录『历史未扫』」在 `main()` 里**并未兑现**。
- 5 支探针在工作区根 `_tmp/dt/`（**不在仓库**）、硬编码 `C:/Users/...` 绝对路径、`deep-kf` 之外 4 支无自证、`deep-kf`/`audit-wx-compliance` 未进 `run-layer3` 串跑 ⇒ 换机即失传，而没有任何门禁会喊。
- 5 处判据（`check-dup-const`、`index-parity`、`route-audit`、`check-error-code-message`、`check-icon-lock`）缺「样本数 > 0」下限 ⇒ 扫描面变空时与全对同形。同仓 `check-md-tables.mjs:126`、`check-nav-consistency.mjs:289`、`check-e2e-message-assert.mjs:146` 都已做对 ⇒ 是**未铺满的残留**。

---

## 4. 已核对确认无问题（防过度修复）

| 项 | 核对方式 | 结论 |
|---|---|---|
| `ab_balance` 的 7 个写钱点 | 逐个读 `SET`/`WHERE`/`affected` | **全部**正确使用 `WHERE id=? AND version=?` CAS ✅（本次复核确认：`order.service.ts:1490-1502` 确为 CAS） |
| 代退驳回清三列 | 读 `refund.service.ts:619-630` | `cancelSource/cancelReason/cancelNote` 一起置 null，且 `back` 缺值即 `40014` 不猜 ✅ |
| 横向越权（用户/团长/供应商三层） | 读 `loadOwnOrder` / `applyScope` / `loadSupplier` | 三层都按归属收窄；「不存在 vs 非本人」合并成同一 `ORDER_NOT_FOUND`（防订单号探测，加分项）✅ |
| 停职团长仍可调团长接口 | 读 `leader.guard.ts:37-56` + e2e-m2:1276 | 守卫**每请求查库**，区分 10003/20003 ✅ |
| 后台账号升权自保护 | 读 `admin-user.service.ts:128-200` | 三条规则齐备 + `adminRevokeKey` 使旧令牌立即失效 ✅ |
| 服务端 9 个时刻单一真相 | 读 `order-timeline.ts` + `time.ts:162-188` | 无硬编码（**09:30 除外**，见 ⑤）✅ |
| 端上禁用写法 | grep `<ab-icon>` / script 段 `I.xxx` / 端上 `@media` / 渲染区 emoji | **0 命中**；39 个图标名全部命中 82 名真源表 ✅ |
| 页面清单 ↔ 实际跳转 | 29 处跳转字面路径逐条比对 `pages.json` 28 条 | 29/29 命中，无断链 ✅ |
| e2e 无跳过用例 / 无自证式断言 | grep `.skip\|.only\|xit\|fit`；复核 `e2e-m1.mjs:1057-1065` | 0 命中；且已主动规避自证（独立复刻 SQL 做期望）✅ |
| 门禁执行器唯一 | find 全仓 `gate`/`runner` | 只有 `scripts/gate.mjs`；CI 只调别名，无第二份清单 ✅ |
| 财务域资金端点收窄 | 逐个 grep `@Roles(...FUND_ACTION_ROLES)` | 6 处全收窄（**订单域 D10/D11 漏网**，见 ②）✅ |
| shared-types `dist` ↔ `src` | mtime 比对 + 运行时 `require` 实测导出值 | 一致（客服枚举、`PayoutChannel` 大写、费率门槛逐项相同）✅ |
| D57 配置条目数 33 | 数 `CONFIG_SPECS` 条目 + 分组 + unwired | 33 / 7 / 4 全部自洽，客服三键已同步 ✅ |

---

## 5. 横向根因（把 30 条压到 3 条机制）

1. **同一件事有 N 份表述，而约束只写在「不被执行」的那一份。**
   本次实例：结算公式 3 份（真源 + 后台转发 + 端上抄本）· 时刻定义 2 份（`order-timeline` + 09:30 裸常量 + 端上 6 处硬编码）· 状态机 3 份（声明表 + 文档 T16 + 实现）· 权限 2 份（`finance.constants` 纪律 + `order-admin` 实际白名单）· 门禁清单 2 份（31 道定义 vs 别名子集）· 金额格式化 10 份。**规律完全复刻**：不被机器执行的那份必然错掉。
2. **门禁只报「过/不过」，不报「查了什么、查了多少」。**
   7 道零输出仍计绿；`icons:lock` 自证不跑 + 0 样本恒绿；e2e 条数只打印不断言；`security:scan` 浅克隆下静默降级。**门禁自身的退化不在任何失败路径上** —— 这是本次 P1 里基建占 5 条的原因，也是历史上「恒红 17 天」的同族。
3. **单向箭头只守一半。**
   守「取消要写 cancel_source」没守「强制退款也要写」；守「代退要清三列」没守「申请时也要清第三列」；守「送达时刻要收口」没守「开团/截单时刻也要收口」；守「财务写端点要收窄」没守「订单写端点也要收窄」；守「0 样本不得记 OK」没守「恒 N/A 要被追」。

### 三条对策（都必须可机械执行）

| 对策 | 本项目落地形式 |
|---|---|
| ① **扩大 `dup:const` 的语义面** | 现有只有 `slot-map`/`arrival-literal`/`date-parse` 三条（只查 `'11:30'`）。扩为：任意独立 `'HH:mm'` 字面量 · 时刻常量声明（`XXX_HOUR = n`）· 金额格式化同形函数（`¥${…/100…toFixed(2)}` 全仓计数须 == 1）· `@media` 零命中。一次编写，永久拦截整类漂移 |
| ② **门禁自报覆盖面 + 自证不可跳过** | 见 ⑦⑧⑫；统一 `assertCoverage(name, n)` 辅助（0 即抛错）；新增**元门禁**扫 `scripts/check-*` 的四问：自证是否在主流程无条件跑 / 是否上报样本数 / 0 样本是否失败 / 是否进了别名 |
| ③ **边级与角色级的双向闭合** | `state:audit` 增边级判据；`route-audit` 增 R11（资金写端点白名单含 operator 即 FAIL 或登记）；`gate:parity` 补全量差集；e2e 增「operator 视角」与「三来源」断言 |

---

## 6. 建议修复批次

| 批次 | 内容 | 风险 |
|---|---|---|
| **α（≈1h，零产品行为变更）** | ② D10/D11 加 `@Roles(...FUND_ACTION_ROLES)`；3.2 取消理由改按来源选文案表；⑧ e2e 加 0 条下限 + `EXPECT_MIN`；⑦ `icons:lock` 自证改无条件跑 + 样本下限；⑪ `gate:parity` 补全量差集；`CANCEL_NOTE_MAX` 注释改准；`pages.json` 客服页标题去「客服微信号」；⑩ 拨号改引导 + `fail` 不再静默 | 极低 |
| **β（半天，需跑全量门禁 + e2e）** | ① `markPaid` 占位 + `version` 表达式；③ D11 写 `cancel_source`（含 `CANCEL_SOURCE` 增 `admin`）；④ `buildRefundRow` 口径；⑤ 09:30 收口进 `BusinessTimeline`；⑥ `actions.can*` 并入角色；⑨ 楷体（内嵌子集 或 移出小程序工程）；⑰ 端上时刻改从响应取；⑱ `@media` 改 `.is-narrow`；3.3 e2e 补 `csMode` 与三来源断言 + 本地库脏值还原 | 中（改行为，须 e2e 兜） |
| **γ（需裁定或真环境）** | 3.1 `total_out` 恒等式裁定（补记账 vs 改语义，**必须与已登记 A3 同批**）；operator 可写范围裁定（D62/D63 是否刻意）；26 探针收编进仓库 + 去绝对路径 + 纳入串跑；25 CI `fetch-depth: 0`；⑫ 7 道门禁补覆盖面；27 五处样本下限；29 迁移 COMMENT 对齐（先 ℹ 提示、清零后转红） | 需用户拍板 |

### 6.1 执行记录

| 批次 | 日期 | 提交 | 结果 |
|---|---|---|---|
| **α** | 2026-10-07 | `142887d` | **8/8 完成**。回归：all 24/24 · verify 4/4（m1 114 / m2 150 / m3 1335）· deep-kf 34/34 · deep-cancel 22→**24** · format:write 1/1 |
| **β** | 2026-10-07 | `35ed4d4` | **10/10 完成**（⑨ 只做零风险的一半，死资源处置转 γ）。回归：all 24/24 · verify 4/4（m1 114 / m2 **152** / m3 **1336**）· deep-kf 34/34 · deep-cancel 24→**33** · typecheck(api+mp)/lint 3/3 |
| **γ-楷体批** | 2026-10-07 | `476ea60` | **4/4 完成**（含 1 项**原 γ 清单外**的新发现：字体源是微软授权字体）。回归：lint / typecheck(api+mp) / format 全 0 · jest 7 suites / 51 tests · build:mp EXIT=0 + `mp:no-font` 0 字体（165 文件）· build:h5 EXIT=0（字体在、url 正确）· e2e m1 114 / m2 152 / m3 **1336** 全绿 |

α 实际落码（与上方清单逐项对应）：

1. **②** `order-admin.controller.ts` 的 D10 / D11 加方法级 `@Roles(...FUND_ACTION_ROLES)`（`getAllAndOverride` ⇒ 方法级覆盖类级），类级注释改为「两级白名单（勿合并）」。
2. **3.2** `decorate()` 的 `cancelReasonText` 改按 `cancelSource` 分派：leader → `REFUND_REASON_LABEL`，其余 → `CANCEL_REASON_LABEL`；两张都查不到时回退原值。**单点修复即同时修好列表 / 详情 / 导出三处**（导出复用 `decorate` 结果）。
3. **⑧** 三份 e2e 收尾加 `results.length === 0` 即 exit 1；`gate.mjs` 加 `EXPECT_MIN`（114 / 150 / 1335，只许上升）。
4. **⑦** `icons:lock` 自证改为**无条件前置** + `files.length` / `interpTotal` 下限；`REPORT_RE` 补「自证汇总」「覆盖率」两行（现已能在 `all` 汇总里看到 `14/14` 与 `143/143`）。
5. **⑪** `gate:parity` 补全量差集 + `CI_EXEMPT` 豁免表（3 道：format:write / seed:demo / design:docs）+ 防腐烂豁免；输出改为「CI 覆盖 28 道（豁免 3 道：…）」，不再无条件声称「已全覆盖」。
6. **CANCEL_NOTE_MAX** 注释更正（原「与列长一致」是错的：列 `VARCHAR(128)`，校验卡 100 是刻意留余量）。
7. **`pages.json`** 客服页标题「联系客服（U17 · 客服微信号）」→「联系客服」。
8. **⑩** 取消页 `makePhoneCall`（拨脱敏号 + 静默吞失败）→ 与 `order-detail.vue` 同款引导；生产代码 `makePhoneCall` 归零。

⚠️ α 顺带暴露、**留给 β 的同类残留**：`utils/router.ts:24/35` 两处 `fail: () => undefined`；`account-cancel.vue` 与协议正文里的「客服微信号」字样。

### 6.2 β 实际落码（与上方清单逐项对应）

1. **①** `order.service.ts` 的 `markPaid`：事务内改为 `.where('id = :id AND status = :from')` + `version: () => 'version + 1'`；`affected === 0` ⇒ **不扣余额、不写流水**，返回 `reason: 'status_changed:<当前状态>'`；`balanceUsed` 改事务内重读。全仓裸 `getRepository(Order).update(` 归零。
2. **③** `CANCEL_SOURCE` 增 `ADMIN: 'admin'`（+ `CANCEL_SOURCE_LABEL`）；`settleRefundDb` 增**可选** `cancelMeta`，与占位**同一次写**三列，仅 D11 传。文案分派改「按来源选主表 + 兜底另一张」（原只按 leader，新增 admin 会再次退化成英文）。
3. **④** `buildRefundRow` 的 `amount` 改取 `refundableYuan(order)`；删除已无用的 `wxFen` 参数（微信实付由 `payload.wxFen` 带），两处调用同步。
4. **⑤** `BusinessTimeline` 增 `cookConfirmDeadline`（第 10 个时刻，**刻意不可配**），漂移表补登记第 4 处；`supplier.service.ts` 三裸常量删除，`Date.now()` ×2 改走 `now()`（含报告未列的一处 `overdue` 判据）。
5. **⑥** `detail(orderNo, viewerRole)`；`canAdjust/canForceRefund` = 状态允许 && `FUND_ACTION_ROLES.includes(role)`，`blockReason` 在角色不足时给中文原因（与守卫同一真源）。
6. **⑰** 首页 / 下单页 / 支付结果页改从 `daily.cutoffAt` / `result.cutoffAt` 派生（**取不到整行不显示**，不回落写死值）；为此新增下发字段 `PayResultView.cutoffAt`。取消页 / 邀请页无下发源 ⇒ 退化为不含时刻的表述。**协议正文 `24:00` / `11:30` 未动**（合规文档，需人工过目）。
7. **⑱** `groups.vue` / `overview.vue` 的 `@media (max-width:1100px)` 改挂 `.ab-layout.is-narrow`（真源 `NARROW_MAX = 768`，原值还不一样）。
8. **⑨** `tokens.scss`：注释如实更正（mp 端 `ABoxKai` **无定义**）+ mp 字体栈显式不写 `ABoxKai`（产物实测 0 命中）。**597 KB 死资源未处置，转 γ**。
9. **3.3** e2e-m2 +2（`csMode` 为真源枚举之一 —— 期望集合**从 `customer-service.ts` 读**；非 `wechat_kf` 档两参数恒 null）；e2e-m3 +1（截单取消写全 `system` / `timeout_unpaid`）。
10. **α 残留**：`router.ts` 降级链最后一级不再静默；`account-cancel.vue` 复核后**判定为刻意固定**（账号已注销 ⇒ 客服会话不可用，加微信是唯一通道）⇒ 不改，加注释说明。

✅ **γ-楷体批已执行**（2026-10-07 · `476ea60`，明细见 §6.3）：拍板选 **(b)**，并额外挖出一条
**否决 (a) 的新事实** —— 字体源是 `C:\Windows\Fonts\simkai.ttf`（**微软授权字体，不可随产品分发**），
项目里早有登记（《小程序提审说明》§6 /《开发里程碑计划》「生产前必办」）却一直没做。

✅ **γ 剩余项已拍板并落码**（2026-10-07 · 明细见 §6.4）：协议正文（时刻加兜底句 + 「客服微信号」
改中性表述）· 3.1 `total_out`（**维持现状**并写进代码）· 26 探针收编 · operator 维持。
**明确不做**：25 CI `fetch-depth: 0` · ⑫ 7 道门禁补覆盖面。

### 6.3 γ-楷体批 实际落码

1. **换源字体（新发现，不在原 γ 清单里）**：`make-font-subset.py` 的 `FONT` 由
   `C:\Windows\Fonts\simkai.ttf` 改为**霞鹜文楷 LXGW WenKai v1.522（SIL OFL 1.1 · 可商用 / 可分发 /
   可嵌入）**，46867 字形、同为楷体风格，视觉口径不变。源字体 24.4 MB 放 `scripts/.font-cache/`
   （已 gitignore，不进仓库）。重跑子集：3927 字请求 → **3919 字覆盖**，缺的 8 个全是 emoji 类符号
   （`🍛🍱🏪⭐️✅❌⋙`）—— 本就不该由楷体提供（项目纪律：渲染面零 emoji）。
2. **(b) 落地：字体移出小程序包** —— 实测**光移目录不够**，分两步才成：
   - 字体 `src/static/fonts/` → `src/assets/fonts/`（CSS 改 `url('@/assets/fonts/…')`，实测 alias 可解析）。
   - ⚠️ 但 mp 产物**照样**打出 `assets/ab-kaiti.49404bd2.woff2`，主包反而涨到 **1668 KB**。
     根因：**条件编译是生效的**（产物 wxss 里 `ABoxKai` 命中 **0** 次、无任何 wxss 引用 `ab-kaiti`），
     但 **vite 收集 CSS 的 `url()` 发生在条件编译之前** ⇒ 字体被当成 asset 产出，只是没人引用。
   - ⇒ 在 `vite.config.ts` 加插件 `abox:mp-no-font-asset`，`generateBundle` 阶段剔除 mp 端的
     woff/woff2/ttf/otf asset：**主包 1400 KB → 816 KB**（省 584 KB）。
     可无差别删的依据：wxss 的 `src` 只接受网络地址或 base64；图标字体是 base64 内嵌、不是独立 asset。
3. **新增门禁 `mp:no-font`（防复发）**：扫 mp 产物里的字体二进制；**产物目录缺失时报红而不是报「通过」**
   （把「目录不存在」当「0 个字体」放行 = 恒绿陷阱）。自带自证 4 条（必报 ×2 / 必不报 ×1 / 判据 null ×1），
   与主流程**共用同一个判据函数**。已注册 `GATES` + `all` 别名（**必须排在 `build:mp` 之后**）+ `REPORT_RE`。
4. **文档条数标记对齐**：`all` 24 → **25** 道（CI 覆盖 28 → 29 道），《本地开发手册》真源 +
   `docs/` 镜像同步更新（走 `sync-docs`，不手改镜像）。

⚠️ **本机环境限制（非本次改动引入）**：`gate.mjs` 执行门禁依赖 `spawnSync`，本机稳定报 **EBUSY**
（`spawnSync … node.exe EBUSY`）—— 连既有门禁 `icons:lock` 也 `exit=null` ⇒ **`gate:parity` 本机跑不了**。
已改为**手工核对真源**：`gate.mjs --json` 实测「门禁定义 32 道 · `all` 25 道（含 `mp:no-font`）·
`verify` 4 道」，`CI_EXEMPT` 未动且其条目仍在 `GATES`，文档标记已对齐 ⇒ parity 判据逐条满足
（CI 为 Linux，不受此限）。

### 6.4 γ 剩余项（拍板后）实际落码

1. **协议正文三处**（`apps/miniprogram/src/constants/agreements.ts`）：
   - `24:00` 截单 / `11:30` 送达：**数字保留**（删掉会削弱告知的明确性 —— 用户看协议就是要知道大概几点），
     两行**句末统一加**「具体时刻以小程序下单页实时展示为准」⇒ 数字降格为**解释性示例**，
     **页面的实时值才是执行口径**。效果：后台改 `ab_config.set_meal.delivery_arrival_time`
     后即使忘了同步本文件，**也不再构成「告知与实际不一致」**（审核比对的就是这一条）。
     ⚠️ 但**仍应同步**（数字长期对不上会让用户困惑）—— 已在注释里写明，人工同步点的性质不变。
   - 第 222 行「我的 → **客服微信号**」→「我的 → **联系客服**」：切到微信客服档
     （`csMode = wechat_kf` / `contact`）后，「我的」里那个入口**不再叫**「客服微信号」，
     原措辞会**给用户指错路**。改为只说功能、不预设形态的中性表述后，**三档降级都成立**。
     文件头第 2 条口径说明同步更新。
   - 两份 `updatedAt` `2026-09-20` → **`2026-10-07`**（正文改了，日期跟着走；版本仍为 `1.0-draft`）。
2. **3.1 `total_out` 恒等式 —— 裁定「维持现状」**（`seed-demo.ts` ⑨ 段）：判据三档不动
   （相等→passed / 差额恰好 = reversal 冲销额→**warnings 显式容忍** / 否则→failed），
   但把**裁定本身写进代码**：reversal 是「应付转回」，**本就没有钱流出平台**，
   硬补进 `total_out` 反而**虚增累计支出**；影响面只有「累计支出」这一枚统计口径，
   `balance` / `frozen` 由逐笔重演得出、**均正确**；改成严格恒等须同时动历史数据与
   `ab_commission` 写入路径，**风险大于收益**。⇒ 以后别再当 bug 提。
3. **26 探针收编**（P1 —— 真实资产丢失风险）：`_tmp/dt/` 下 8 个 `.mjs`（约 2000 行，**不进 git、随时会丢**）
   搬入 **`abox-onebox/scripts/probes/`**，另加本次新增的协议正文复核探针，共 **9 个**。
   - 改造：清掉 7 处本机绝对路径（改为 `import.meta.url` **相对本文件推导**，换机器无需改一行）；
     `pipefix.cjs`（**其自述「勿入仓库」**）改为**可选** —— 设 `ABOX_PIPEFIX=<路径>` 才启用，
     未设就不加 `--require`（正常机器与 CI 的 Linux 本就不需要）。
   - **刻意不挂进 `gate.mjs`**：这些探针要起真实服务 + seed、依赖 3101 端口与本机环境，
     稳定性不适合当门禁（与既有纪律「一次性探针刻意不进 CI 门禁」一致）。
     用途 / 清单 / 跑法写进 `scripts/probes/README.md`。
   - 收编脚本自带**期望命中数断言**（不符即抛错、不写盘），写盘后逐个 `node --check`（9/9 通过）。
4. **operator 可写范围 —— 维持**：回源确认 `admin-role.ts:35` 注释已写明刻意
   （配送要打电话叫车、填司机车牌，故 operator 必须能用），且配送不涉及钱（α 已收窄资金端点）⇒ 自洽，不动。
5. **明确不做**：25 CI `fetch-depth: 0`（实测全仓只有 `deploy.sh` 用 git，**无任何门禁依赖提交历史**）·
   ⑫ 7 道门禁补覆盖面（低优先级；本机 `gate.mjs` 受 EBUSY 限制跑不了，价值也不高）。
6. ⭐ **顺带修掉一个漏改（本次新发现，不在原清单里）**：γ 批把字体从 `src/static/fonts/`
   迁到 `src/assets/fonts/`，但 **`make-font-subset.py` 的 `OUT_DIR` 没跟着改** ⇒
   重跑子集会把字体**写回 `static/`**，而 `static/` 由 uni **原样全量复制**、**不走 vite asset 管线**
   ⇒ **躲得过 `abox:mp-no-font-asset` 剔除插件**，直接污染 mp 主包（+851 KB），
   且门禁原理上抓不到。已改为 `assets/`，并把「⛔ 产出目录必须是 assets、不能是 static」写进文件头。
7. **UI 客服入口跟着「随档位分流」**（同批追加，主理人同意）：协议改成中性措辞后，
   **入口却还写死「客服微信号」** ⇒ 同一条路两种叫法。已改三处，真源统一到新增的 `csEntryLabel()`：
   - `use-customer-service.ts` 新增 **`csEntryLabel(mode)`**（与既有 `csActionLabel` 分开：**入口名词** vs
     **按钮动作** —— 后者的 `none` 档是「复制微信号」，当菜单标题读起来很怪）。
     `wechat_kf` / `contact` →「在线客服」· `none` →「客服微信号」· **取不到 → 中性「联系客服」**
     （不回落成写死的某一档形态）。
     ⚠️ 顺带把该文件的 `import type { CustomerServiceMode }` 改成**值导入**（要用枚举值比较）；
     ⛔ 别为了绕开它去写 `'wechat_kf'` 字面量 —— 那会被 `dup:const` 判成「真源字面量外溢」。
   - `mine.vue`：菜单项与设置面板第 0 项都改用 `csEntryText`；onShow 里 **best-effort** 拉一次
     `GET /me/support`（**静默失败**，取不到就显示中性「联系客服」——「我的」页不该因客服接口弹 toast）。
   - `balance-detail.vue` 指路句「我的 → 客服微信号」→「我的 → **联系客服**」。
   - ⛔ **`account-cancel.vue` 刻意不改**：那里的「客服微信号」出现在**已注销终态屏** ——
     账号已注销 ⇒ 用户已登出，微信客服会话 / 原生客服消息**都要登录态**、唤不起来；
     写「在线客服」反而是错的（点了没反应）。故此处**固定**写微信号（注释已说明理由）。

---

## 7. 附录

### 7.1 本轮未能验证（【推断】，禁止据此改代码）
- MySQL 真并发下 `markPaid` 与取消的报错先后（本机 sqlite 单连接不构成证据）。
- `purchaseGenerated` 用「净额非零」代替「有没有出单」在真实数据上的触发频率（正负相抵为 0 的情形）。
- `EITHER_SCOPE` 端点（`/auth/profile`、`/logout`）绕过 `AdminGuard` 吊销检查的将来风险（现状自己查库，无实证违规）。
- 分享配置只覆盖 1/28 页是否违反「合规整改（分享）」的未成文要求。
- 后台 `supplier/packing-center.vue:39` 的 `money(fen: number)` 无空值兜底是否会渲染 `¥NaN`（未找到触发路径）。

### 7.2 自检（写盘后机械复核）
- 文件名带 `_` 前缀 ⇒ 不匹配真源 glob `ABox一盒*.md`；`sync-docs` 后 `docs/` 内 0 命中（已复核）。
- 报告内表格无空行截断（`doc:tables` 对 `docs/` 生效；本文件不在扫描面，已人工确认表格连续）。
- 所有数字（24/24、4/4、114/150/1335、31/24/4、154、597044）均取自实跑日志或实读源码，非估算。

---

## 8. 一句话总结

**门禁全绿是真的，但「绿」覆盖不到的地方有 30 处，其中 12 处是 P1**：最危险的三类是——operator 能拍板退钱（权限）、支付回调能把已取消的订单复活（状态）、以及**五道门禁自身的自证/覆盖面根本没在跑**（基建，会让下一次同类缺陷照样全绿）。它们共同的形状就一条：**同一件事写了 N 份，而约束只写在没人执行的那一份**。
