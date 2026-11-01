# ABox 一盒 · 产品官（gstack-product-reviewer）逻辑审查发现

- **审查人**：gstack-product-reviewer（产品官） · **时间**：2026-09-21 BJT
- **方式**：**纯静态审查 + 规格↔实现对照**。**未启动任何服务、未占用端口、未读写 `data/abox-dev.sqlite`、未改动任何源码/文档/清单**
  （与 `gstack-qa-lead` 的黑盒实测并行，互不争用）。
- **依据纪律**：每条结论均给「文件:行 + 原文片段」，逐条 grep 核对过；不凭记忆、不抄上一版数字。
- **已读并遵守的裁决口径**：`接口口径.md` 附录 A1–A11（**不推翻**）· `缺陷与陷阱.md` · `工程纪律.md` ·
  `_ABox一盒已知项与预期行为清单v1.0.md`（K01–K56 / R1–R11，含 §K-7「必须记 P1」五条例外）。
- **与 QA 的分工**：QA 交的是「黑盒实测阳性/阴性证据」；本文件交的是「**人想不到的地方**」——
  尤其本项目已反复踩过的「**同一件事两份表述，不被执行的那一份必然悄悄错掉**」这一族。
  与 `qa-缺陷清单.md`（OBS-1 楼栋状态未贯通 / OBS-2 拉黑旧 token / OBS-3 跨楼绑定 / OBS-4 K17 / OBS-5 K47 未测）
  **无重复**，且其 OBS-1 与本文 PR-07 是**同一根因的不同侧面**（见 PR-07 备注）。

---

## 0. 一句话结论

🟡 **核心判决**：**身份模型与权限矩阵本身是自洽的**（A2/A7/A9 三条不变量的代码实现与口径一致，
停职态在服务端是**零权限窗口**，菜单三清单机械对账**无单边漂移**）；
**但在 6 处「第二份表述」上仍然漏了**——其中 **PR-01（并发取消订单重复退余额）是唯一达到 P1 量级的资金风险**，
其余为「静默漂移风险 / 点了必报 10003 / 文案指向已不存在的入口」三类。

---

## 1. 审查发现总表

| # | 严重度 | 类别 | 位置（文件:行） | 发现 | 依据（原文片段） | 判定 | 上线后果 |
|---|---|---|---|---|---|---|---|
| **PR-01** | 🔴 **P1** | 账本/并发 | `apps/api-server/src/modules/order/order.controller.ts:59-65` · `order.service.ts:425-451` + `493-500` · `finance/refund.service.ts` `buildRefundRow` | **U11 自助取消（`POST /orders/{orderNo}/cancel`）既无 `@Idempotent`，事务内又是「无条件按 id 改状态、不校验 `affected`」** ⇒ 并发两次取消可**重复解冻/退回余额、并生成两张退款单** | ① 端点无幂等：`@Post(':orderNo/cancel')` 下**没有** `@Idempotent(...)`（对比同文件 `:34-36` 的 `POST /orders` 有 `@Idempotent({scope:'order'})`）；② 前置状态校验在**事务外**的快照读上：`const order = await this.loadOwnOrder(...)`（`:426`）→ `explainSelfCancelBlock(status, ...)`（`:429`）；③ 事务内无条件写：`await m.getRepository(Order).update({ id: order.id }, { status: OrderStatus.CANCELLED, cancelledAt: now, version: (order.version??0)+1 })`（`:493-500`）——**没有 `WHERE status = ?`、没有 `affected` 判定**；④ 余额退回在守卫之前无条件执行：`await this.releaseBalance(m, userId, balanceUsedFen, order.orderNo)`（`:466`）/ `await this.refundBalance(...)`（`:471`）；⑤ 退款单去重是**快照读**：`buildRefundRow` 内 `const existed = await m.findOne(Refund, { where: { orderId: ..., status: Not(RefundStatus.REJECTED) } }); if (existed) return null;`（MySQL REPEATABLE READ 下两个未提交事务互相看不见） | **冲突（真缺陷）** | 用户在断网/超时下重试、或双端同点「取消」⇒ **余额退两次、微信退款出两笔**（两笔 `out_refund_no` 不同 ⇒ 微信都会受理），账实不符且**任何门禁都不会红**。⚠️ **本项目已在同一文件里修过同族缺陷**：跑批侧注释原文 `改前是「先 findOne 复核状态、再无条件 update」—— 两条语句之间并发的用户自助取消（T4）可以插进来，后果是**重复解冻余额**`（`order.service.ts:626-629`），并把跑批改成 `… .andWhere('status = :st').execute(); if ((claim.affected ?? 0) === 0) continue;`（`:637-648`）。**改了一侧（跑批）漏了另一侧（T4 自己）** —— 正是本项目总结的「改一处漏一处」范式 |
| **PR-02** | 🟠 P2 | 时间 | `apps/api-server/src/common/utils/order-timeline.ts:44-47` + `:83-93` · `modules/team-leader/workbench.service.ts:135-136` · `modules/team-leader/share.service.ts:43` · `apps/admin-web/src/views/dashboard/index.vue:113` · `apps/miniprogram/src/constants/index.ts:116-127` + `pages/leader-invite/leader-invite.vue:31` · `pages/order-create/order-create.vue:75` · `pages/order-detail/order-detail.vue:119,238` | **「送达时刻」在唯一真源之外被手写了至少 8 处**，其中 **1 处是同一条出参里的两个不同值**（最硬的证据） | 真源：`arrival: { hour: 11, minute: 30 }`（`order-timeline.ts:86`，可被 `ab_config.set_meal.delivery_arrival_time` 覆写）。⚠️ 同文件明文禁止：**「在别处再写一遍数字（哪怕只是注释里当默认值用）＝重新制造 #49」**（`:44-47`）。实际存在：<br>· ⭐ **同 payload 双真相**：`expectAt: '11:30',` / `expectAtIso: toBjIso(arrivalAtOf(today)),`（`workbench.service.ts:135-136`）——**同一对象里一个字面量、一个派生值**；端上注释亦承认 `恒为字面量 '11:30'`（`apps/miniprogram/src/api/leader.ts:69`）<br>· 分享文案 `次日上午 11:30 送到楼下`（`share.service.ts:43`）<br>· 后台 `T-1 …:00（次日 11:30 送达）`（`dashboard/index.vue:113`，与同表达式的 `BIZ.cutoffHour` 混排）<br>· 端上 `TIME_ANCHOR = { … deliverArrive: '11:30', … }`（`constants/index.ts:122`）——**全仓 0 消费点**（grep 仅此一行）<br>· 端上页面硬编码 `明天 11:30 由团长统一取餐`（`order-create.vue:75`）等 4 处 | **冲突（表述漂移）** | 运营把 `set_meal.delivery_arrival_time` 改成 `12:00` 后：**配送单 `expectedAt` 与团长端「取餐时间」文案当场分裂**，同一屏可同时出现 11:30 与 12:00；用户端顶栏文案仍说 11:30。**全部不报错**（文案回退无声）。一期「时刻不可配」的默认值恰好等于 11:30，所以这处现在**看不出问题**——这正是漂移的典型潜伏形态 |
| **PR-03** | 🟠 P2 | 状态机/漂移 | `apps/api-server/src/modules/order/order-state-machine.ts:20-33` · `finance/refund.service.ts:105-109` + `673-699` · `ABox一盒订单状态机与全链路流转v1.0.md:76-77` | **状态机「声明」比实现少 5 条入边；且文档 T16 的目标状态与实现相反** | 声明侧只有 `[OrderStatus.REFUND_APPLYING]: [OrderStatus.REFUNDED]`（`order-state-machine.ts:30`）。实现侧：`CLAIMABLE_ORDER_STATUS = [...REFUNDABLE_STATUS, OrderStatus.REFUND_APPLYING]`（`refund.service.ts:109`，`REFUNDABLE_STATUS = [paid, cut_off, cooked, delivering, delivered, completed]`，`:78-82`），落库语句 `.set({ status: OrderStatus.REFUNDED, … }).where('id = :id AND status IN (:...ok)', { ok: CLAIMABLE_ORDER_STATUS })`（`:687-699`）⇒ 实现有 **6 条入边**（`paid/cut_off/cooked/delivering/delivered/completed/refund_applying → refunded`），声明只有 2 条。<br>⚠️ 且该常量**自称**与状态机一致：`它同时也是「订单状态机」里已声明的迁移边集合，与状态机对账时能直接对上`（`:106-107`）——**这句话与 `order-state-machine.ts` 不符**。<br>文档侧 T15「`refund_applying`→（回原状态）」、T16「任意非终态→**cancelled**」（`…流转v1.0.md:76-77`）；实现走的是 `→ refunded`（上引 `.set({status: OrderStatus.REFUNDED})`），且驳回的 `back` 是**动态值** `.set({ status: back, … })`（`refund.service.ts:603`） | **冲突（表述漂移）／T16 属文档错** | `canTransit()` 目前是死代码（仅单测引用，`order-state-machine.ts:8-10` 自述），故**今天没有功能性后果**；但一旦有人把 `canTransit()` 接进守门（这正是这张表的用途），**「后台驳回」与「强制退款」会立刻被拒**；门禁 `state:audit` **明确声明不查边**（`order-state-audit.ts:29-33`）⇒ 该偏离**永远不会被自动化发现** |
| **PR-04** | 🟠 P2 | 权限/入口 | `apps/admin-web/src/views/supplier/list.vue:206` vs `:121,207,210,216` · `apps/api-server/src/modules/supplier/supplier-admin.controller.ts:114-115,127-128` | **运营专员（`operator`）能看到并点开「编辑」供应商，改完保存必报 `10003`** —— 典型的「按钮亮着、点了 `10003`」 | 前端：`supplier/list.vue:206` `<el-button link type="primary" @click="goEdit(asRow(row).id)">编辑</el-button>` —— **没有 `:disabled="!canManage"`**；而同页 `:121`（新建供应商）、`:207`（资质审核）、`:210`（外卖链接）、`:216`（停用/启用）**全都有**该约束，`canManage` 来自服务端 `actions.canManage`（`:339,346`）。→ `goEdit()` 跳 `/supplier/form`（`:478-479`）。<br>后端：`@Put(':id') @Roles('super_admin','admin')`（`supplier-admin.controller.ts:127-128`）⇒ `operator` 被拒。<br>路由守卫**不会**拦住这一步：`/supplier/form` 在 `ADMIN_MENU_KEYS`（`admin-role.ts:48`）里，`operator` 菜单含它⇒`canAccessPath` 通过（`utils/permission.ts:26-30`） | **冲突（真缺陷·体验层）** | 用户在「编辑页」填完表单、点保存 → 才收到 `10003 无权限`，**前面所有输入白填**；而运营的原意（看供应商台账）完全正常。属项目自己定义的判据：「**按钮亮着、点了 `10003`**」（`finance.constants.ts:8-11` 明文列举该形态为必须消灭的目标） |
| **PR-05** | 🟡 P3 | 权限/漂移 | `apps/api-server/src/modules/finance/supplier-share-admin.controller.ts:39,76,93` · `finance/finance.constants.ts:34,43` · `finance/finance-admin.controller.ts:85,134` | **财务域「两级白名单单一真相」被同域的应付结算控制器绕过：又写了第 5 份字面量** | 真源：`FINANCE_READ_ROLES = ['super_admin','admin','finance','operator']`（`finance.constants.ts:34`）· `FUND_ACTION_ROLES = ['super_admin','admin','finance']`（`:43`）；`finance-admin.controller.ts` 用的是常量（`:85 @Roles(...FINANCE_VIEW_ROLES)`、`:134 @Roles(...FUND_ACTION_ROLES)`）。<br>但 `supplier-share-admin.controller.ts` **硬编码**：`:39 @Roles('super_admin','admin','finance','operator')` · `:76 @Roles('super_admin','admin','finance')` · `:93` 同 —— 值**今天恰好相等**，所以没有任何测试会红 | **冲突（漂移风险·值当前一致）** | 这正是该项目**反复记录**的失败机制：「四个副本的后果不是编译不过，而是**静默漂移**……二者都不报错，只在某次审计里才被发现」（`finance.constants.ts:7-11`）。一旦有人调整 `FUND_ACTION_ROLES`（如纳入 `operator` 复核应付），**应付结算不会跟随** ⇒ 「其余资金动作都给运营了、只有生成应付不给」这种说不清的口径。**反例条件**：只要这两个常量不再被修改，本条永不发作——故**不是**恒红项，需靠人工审阅 |
| **PR-06** | 🟡 P3 | 缺口/链路 | `apps/api-server/src/modules/order/order.service.ts:1244-1261` · `meal/meal.service.ts:254-276` · `common/services/leader-lookup.service.ts:71-77` · `admin/dashboard/dashboard.service.ts:13,140-163` | **「本楼有套餐、但在任团长数 = 0」时，住户下单必失败，且错误文案指向一个同样无效的动作；后台也没有任何告警能看到这个洞** | 归属回落链（A2 唯一顺序）：`① user.team_leader_id 且 ACTIVE → ② 本楼 ACTIVE 且 id ASC → ③ null`；③ 时下单抛 `throw new BizException(ErrorCode.LEADER_NOT_FOUND, '未绑定团长，请通过团长邀请链接进入')`（`order.service.ts:1261`）。<br>⚠️ **首页仍显示「可下单」**：`const canOrder = assignment.status === 'active' && isOrderable(targetDate, cutoffWindow);`（`meal.service.ts:98`）——判据**只看开团状态与时间窗**，不看「有没有可归属的团长」；`leader` 为 null 时仍回 `canOrder:true` + `leader:null`（`:124,135`，`resolveLeader` 在 `:276 if (!leader) return null;`）<br>而**停职/退出的团长**在邀请链接侧同样被拒：`if (!leader \|\| leader.status !== LeaderStatus.ACTIVE) throw new BizException(ErrorCode.LEADER_NOT_FOUND, \`团长邀请码 ${code} 无效\`)`（`leader-lookup.service.ts:71-77`）⇒ 文案让人「通过邀请链接进入」，但**能点到的链接全是无效的**。<br>后台待办**只有 4 个 key**：`'refundApplying' \| 'withdrawPending' \| 'tomorrowGroupsUnassigned' \| 'deliveriesLate'`（`dashboard.service.ts:13`）—— **不存在「有套餐但无在任团长的楼群」**。 | **缺失（覆盖缺口）／口径待确认** | 后台「停职某团长」或团长自助退出后，若该楼**没有第二个在任团长**，该楼**全体住户静默不可下单**，且**同一屏自相矛盾**：U1 返回 `canOrder:true`（`meal.service.ts:98` 不看团长）+ `leader:null`，用户点「立即下单」才在提交时收到 `30007 未绑定团长，请通过团长邀请链接进入` —— **一个他无法完成、且所有可达链接都无效的动作**；**运营看不到任何待办提醒**（后台 4 个待办里没有这一项）。与 K18「未绑定团长自动挂靠、下单照常成功」形成反差：**K18 只在「本楼有在任团长」时成立**。⚠️ 与 QA 的 `OBS-1`（`ab_building.status` 未贯通 · 实测 `canOrder=true` 且下单成功）**同族同形**：两条都是「主数据状态没贯通到用户侧交易链路」，且都表现为 **`canOrder` 与环境真实状态不一致**。**建议两条一并裁决**（是否在用户侧 `resolveGroup`/`create` 前加状态校验；是否给后台加一条「有套餐但无在任团长」待办） |
| **PR-07** | 🟡 P3 | 漂移/一致性 | `接口口径.md:1440-1441`（附录 A7）· `apps/api-server/src/modules/team-leader/team-leader.service.ts:366-371` | **「已裁决口径 A7」措辞与实现不符**：口径写「退出团长**只删** `ab_team_leader`」，实现是**置 `status=SUSPENDED` 保留档案** | 口径原文（A7）：`退出团长：**只删 ab_team_leader**；ab_user 与历史订单/佣金全留（leader.id 是关联键）。退出的是身份不是人`（`接口口径.md:1441`）。<br>实现：`await manager.getRepository(TeamLeader).update(Number(leader.id), { status: LeaderStatus.SUSPENDED })` + `await manager.getRepository(User).update(userId, { teamLeaderId: null })`（`team-leader.service.ts:367-371`）——**没有任何删除**；同文件注释亦写 `退出后 status=2`（`:349`） | **待确认（文档漂移；实现更安全）** | 实现其实**优于**口径措辞（删除会切断 `leader.id` 的历史关联，与「历史订单/佣金全留」自相矛盾）。风险在于**后来人照 A7 字面去「删」**：一旦真删，佣金/订单/审计的团长名与外键全部悬空。**裁决归属**：应由工程确认「以代码为准」并回写 A7 措辞，**不宜由测试人自行拍板** |
| **PR-08** | 🟡 P3 | 漂移/门禁强度 | `scripts/check-nav-consistency.mjs:219` + `:246-258` | **菜单门禁有两处覆盖缺口**：①「腐烂豁免」判据是**整文件子串匹配（含注释）**；②它**从不比对 `router/routes.ts`** | ① `if (!readFileSync(f, 'utf8').includes(e.key))`（`:219`）——只要 `via` 文件里**任何位置**（含注释、文档字符串）出现该 key，即判「仍被引用」，**门禁恒绿**。② `loadInput()` 只读两个文件：`ROLE_FILE`（`admin-role.ts`）+ `NAV_FILE`（`constants/index.ts`）（`:246-257`），**完全没有读 `apps/admin-web/src/router/routes.ts`** | **缺失（门禁覆盖缺口）** | 「**路由有、菜单/授权都无**」这一形态（页面存在但**任何人都到不了**、只能手输 URL）仍在门禁视野之外——正是本次实测到的 `/leader/detail` 所属形态（它靠 `leader/list.vue:589` 下钻侥幸可达）。「恒绿的检查比没有检查更糟」是本项目自定标准（`order-state-audit.ts:47`），此处适用于门禁自身 |
| **PR-09** | ⚪ P4 | 文案/漂移 | `apps/admin-web/src/views/supplier/dishes.vue:18` · `views/supplier/edit.vue:9,18,23` | **面向人的说明文案指向已不存在的侧边栏分组「业务」，并要求维护已停用的字段「类型」** | 侧边栏在 M5-16 已由 6 组重整为 8 组（`constants/index.ts:61-87`），**不存在名为「业务」的组**（`ADMIN_NAV` 的 group 依次为 概览/套餐/订单/团长与楼宇/供应商与出餐/财务/数据/系统）。<br>但说明页共 4 处写 `「业务 → 菜品库」`（`dishes.vue:18`）、`「业务 → 供应商管理 → 新建 / 编辑…」`（`edit.vue:9`）、`「业务 → 供应商管理…」`（`edit.vue:18`）、`「业务 → 菜品库」`（`edit.vue:23`）。另 `edit.vue:18` 列出「名称 / **类型** / 联系人 / 结算账户 / 资质证照」，而 `ab_supplier.type` 已停用（`supplier-admin.controller.ts:163-169`：D27 整条路由删除、D24/D25 不再收 `type`） | **冲突（文案陈旧）** | 「如实说明页」的价值就是**告诉人怎么绕**；指路指到不存在的分组，等于把「缺口已登记」变成「按提示也走不通」——正好落回该页想消灭的那种体验 |
| **PR-10** | ⚪ P4 | 账本/并发 | `apps/api-server/src/modules/order/order.controller.ts:59-65` · `api-server` 全仓 `@Idempotent` 清单 | **「状态变更类」端点里只有 U11 取消没有幂等保护**（全仓 16 处 `@Idempotent` 无一覆盖它） | 全仓 `@Idempotent(` 共 **16** 处（`order` / `pay` / `pickup-confirm` / `leader-quit` / `withdraw` / `withdraw-approve` / `withdraw-reject` / `withdraw-paid` / `withdraw-fail` / `refund-approve` / `refund-reject` / `commission-settle` / `balance-adjust` / `order-manual-adjust` / `order-force-refund` / `delivery-status`）。**唯独** `POST /orders/{orderNo}/cancel` 没有（`:59-65`），而它是**会动钱**的状态变更（解冻余额 → 可能建退款单 → 调外部通道） | **冲突（覆盖缺口）** | 与 PR-01 是同一处缺口的两个层：PR-01 说「服务层也没有 affected 判定」，本条说「控制器层也没有幂等键」。二者**任一层存在**即可兜住重复提交；**两层同时缺失**才让并发有缝。建议一并修（加 `@Idempotent({scope:'order-cancel'})` + 事务内 `WHERE id=? AND status IN (...)` + `affected` 判定） |

---

## 2. 三份菜单清单机械对账表（**逐项**）

> 三份来源：① 服务端授权 `ADMIN_MENU_KEYS`（`apps/api-server/src/common/constants/admin-role.ts:26-91`，**40** 条）
> ② 前端侧边栏 `ADMIN_NAV`（`apps/admin-web/src/constants/index.ts:88-238`，**34** 项）
> ③ 路由 `apps/admin-web/src/router/routes.ts`（去 `/login`、`/`、`/403`、404 兜底后 **44** 条）
> 对账方法：脚本化抽取三份清单的 path 后做集合差（抽法同门禁 `stripComments` + 正则），**非人工比对**。

**机器结论**：`ADMIN_MENU_KEYS(40)` ↔ `ADMIN_NAV(34)`：**授权无入口 6 条（全部已在门禁豁免表）· 入口未授权 0 条**；
`ADMIN_NAV` 全部有路由（**0 缺**）；`ADMIN_MENU_KEYS` 全部有路由（**0 缺**）；
`routes.ts` 有 4 条不在任何菜单里（**2 条属供应商侧正常**、**1 条下钻**、**1 条错误页**）。
供应商侧 `SUPPLIER_MENU_KEYS(6)` ↔ `SUPPLIER_NAV(6)`：**双向全等、零豁免**。

| 分组 | path | ①`ADMIN_MENU_KEYS` | ②`ADMIN_NAV` | ③`routes.ts` | 结论 |
|---|---|---|---|---|---|
| 概览 | `/dashboard` | ✅ | ✅ | ✅ | 三处均有 |
| 套餐 | `/meal/matrix` | ✅ | ✅ | ✅ | 三处均有 |
| 套餐 | `/meal/edit` | ✅ | ✅ | ✅ | 三处均有 |
| 套餐 | `/meal/template` | ✅ | ✅ | ✅ | 三处均有 |
| 订单 | `/order/list` | ✅ | ✅ | ✅ | 三处均有 |
| 订单 | `/order/detail` | ✅ | ✅ | ✅ | 三处均有 |
| 订单 | `/order/delivery` | ✅ | ✅ | ✅ | 三处均有 |
| 团长与楼宇 | `/leader/list` | ✅ | ✅ | ✅ | 三处均有 |
| 团长与楼宇 | `/leader/apply` | ✅ | ❌ | ✅ | **缺②**（豁免·`drilldown` via `views/leader/list.vue:593` 申请流水按钮） |
| 团长与楼宇 | `/building/overview` | ✅ | ✅ | ✅ | 三处均有 |
| 团长与楼宇 | `/building/list` | ✅ | ✅ | ✅ | 三处均有 |
| 团长与楼宇 | `/building/groups` | ✅ | ✅ | ✅ | 三处均有 |
| 团长与楼宇 | `/building/leader-binding` | ✅ | ✅ | ✅ | 三处均有 |
| 团长与楼宇 | `/building/delivery-map` | ✅ | ✅ | ✅ | 三处均有 |
| 供应商与出餐 | `/supplier/list` | ✅ | ✅ | ✅ | 三处均有 |
| 供应商与出餐 | `/supplier/form` | ✅ | ❌ | ✅ | **缺②**（豁免·`drilldown` via `views/supplier/list.vue:479`） |
| 供应商与出餐 | `/supplier/dish-library` | ✅ | ✅ | ✅ | 三处均有 |
| 供应商与出餐 | `/supplier/distribution-center` | ✅ | ❌ | ✅ | **缺②**（豁免·`drilldown` via `views/supplier/list.vue:491`） |
| 供应商与出餐 | `/supplier/takeout-links` | ✅ | ❌ | ✅ | **缺②**（豁免·`drilldown` via `views/supplier/list.vue:483`，逐家带 `supplierId`） |
| 供应商与出餐 | `/supplier/edit` | ✅ | ❌ | ✅ | **缺②**（豁免·`legacy-duplicate`：**商家端** P24 的 key，运营端刻意无入口） |
| 供应商与出餐 | `/supplier/dishes` | ✅ | ❌ | ✅ | **缺②**（同上·商家端 P23 的 key） |
| 供应商与出餐 | `/supplier/packing-center` | ✅ | ✅ | ✅ | 三处均有（⚠️ M5-15 前是**死入口**，已补） |
| 供应商与出餐 | `/supplier/workbench` | ❌ | ❌ | ✅ | 供应商侧（`SUPPLIER_NAV` ✅ / `SUPPLIER_MENU_KEYS` ✅）· 运营侧**刻意**无 |
| 供应商与出餐 | `/supplier/cook-confirm` | ❌ | ❌ | ✅ | 同上（供应商侧三处齐） |
| 供应商与出餐 | `/supplier/settlement` | ❌ | ❌ | ✅ | 同上（供应商侧三处齐） |
| 财务 | `/finance/overview` | ✅ | ✅ | ✅ | 三处均有 |
| 财务 | `/finance/commission` | ✅ | ✅ | ✅ | 三处均有 |
| 财务 | `/finance/balance` | ✅ | ✅ | ✅ | 三处均有 |
| 财务 | `/finance/supplier-share` | ✅ | ✅ | ✅ | 三处均有 |
| 财务 | `/finance/refund` | ✅ | ✅ | ✅ | 三处均有 |
| 财务 | `/finance/withdrawal` | ✅ | ✅ | ✅ | 三处均有 |
| 财务 | `/finance/reconciliation` | ✅ | ✅ | ✅ | 三处均有 |
| 财务 | `/finance/invoices` | ✅ | ✅ | ✅ | 三处均有 |
| 数据 | `/stats/core-metrics` | ✅ | ✅ | ✅ | 三处均有 |
| 数据 | `/stats/building-rank` | ✅ | ✅ | ✅ | 三处均有 |
| 数据 | `/stats/dish-heat` | ✅ | ✅ | ✅ | 三处均有 |
| 数据 | `/stats/retention` | ✅ | ✅ | ✅ | 三处均有 |
| 系统 | `/system/config` | ✅ | ✅ | ✅ | 三处均有 |
| 系统 | `/system/admin-user` | ✅ | ✅ | ✅ | 三处均有 |
| 系统 | `/system/role` | ✅ | ✅ | ✅ | 三处均有 |
| 系统 | `/system/operation-log` | ✅ | ✅ | ✅ | 三处均有 |
| 系统 | `/system/message-template` | ✅ | ✅ | ✅ | 三处均有 |
| 系统 | `/system/schedule` | ✅ | ✅ | ✅ | 三处均有 |
| —（非菜单） | `/leader/detail` | ❌ | ❌ | ✅ | **仅下钻**：`leader/list.vue:589` / `leader/apply.vue:271` / `detail.vue:343` 三处 push；**不在任何清单** ⇒ **属 PR-08 指出的门禁盲区**（今天可达，但没有机械保证） |
| —（非菜单） | `/403` | ❌ | ❌ | ✅ | 权限兜底页（`guards.ts:53,60,64` 三处引用）—— 刻意不入菜单 |

### 2.1 权限白名单 ↔ 菜单 的方向性核对（**未发现单边漂移**）

| 角色 | 菜单来源 | 反向接口白名单 | 核对结论 |
|---|---|---|---|
| `viewer` | `admin-role.ts:149-155`：`/dashboard` + 4 个 `/stats/*` | `dashboard.controller.ts:34` 含 `viewer` · `stats-admin.controller.ts:26` 含 `viewer`；其余控制器**均不含** | ✅ 一致（**看板族含 viewer** 的方向正确） |
| `operator` | `admin-role.ts:126`：`ADMIN_MENU_KEYS.filter(k => !k.startsWith('/system/'))` | `order-admin.controller.ts:44` 含 · `meal-admin.controller.ts:45` 含 · `building/delivery/supplier/dish/packing/leader-admin/stats/dashboard` 均含 | ✅ 一致；`/system/*` 三处方法级白名单亦为 `super_admin/admin`（`admin.controller.ts:42`） |
| 资金族 | `/finance/*` **不在** `viewer` 菜单 | `finance.constants.ts:34/43`：`FINANCE_READ_ROLES` 含 `operator`、`FUND_ACTION_ROLES` **不含** `operator` | ✅ 方向正确（**资金族不含 viewer/operator 拍板**）；⚠️ 但 **PR-05** 指应付结算另写字面量 |
| `admin`/`operator` | 菜单**含** `/supplier/dishes`、`/supplier/edit`（`admin-role.ts:52-53`，因它们是 `ADMIN_MENU_KEYS` 成员） | 这两个 key 同时属 `SUPPLIER_MENU_KEYS`（`:113-114`） | ⚠️ **潜在单边漂移**：今天靠「`ADMIN_NAV` 里没有这两项」而不显示。**若将来有人把任一 key 补进 `ADMIN_NAV`**，`admin`/`operator` 会看到指向 `/supplier/*` 的入口，而页面对后台 token 恒 `10004`（`routes.ts:78-82` 明文警告过） |

---

## 3. 按审查任务的逐项交代（哪些查了、结论是什么）

| 任务项 | 结论 | 关键依据 |
|---|---|---|
| **T3-1 身份的叠加与歧义** | **服务端读路径自洽**：`leaderName` 只认 `team_leader_id`、**不自回退本人**（`auth.service.ts:211-233`，并留了「原写法 `user.teamLeaderId ?? leader?.id ?? null` 制造身份错乱」的修复注释）· `isLeader` 两处（登录 `auth.service.ts:93` / A2 `:234`）**均为 `status === ACTIVE` 实时判**· 停职态 **零权限窗口**（`leader.guard.ts:50-52` 抛 `20003`）· 余额真源 = `ab_balance`（**用户维度、与团长共用一行**，`finance.entity.ts:298-305` `uk_balance_user` 唯一），`ab_team_leader.balance/withdrawn_amount/pending_amount` 已转历史字段（`leader.entity.ts:180`） | 见「三处读路径」引用；**A7/A2 未发现冲突** |
| **T3-1b 停职团长在各端一致性** | **基本一致**：`/leader/*` → `20003`；A1/A2 → `isLeader:false`；U1 → 回落本楼在任团长并下发 `source`；邀请码 → `30007`。⚠️ **一处不一致**：A1/A2 的 `leader` 子对象（含 level/commissionRate/balance）在**停职时仍会下发**（`auth.service.ts:118-125` / `:235-244` 只判 `leader` 存在，不判 status）；端上靠 `res.isLeader && res.leader` 双判才不误显（`utils/auth.ts:48`、`mine.vue:249`）⇒ **是「调用方必须记得双判」的隐性契约**，`leader: {...} \|\| null` 的语义在停职态下是「非空但不可用」 | `auth.service.ts:93,118-125,234-235` · `utils/auth.ts:48` · `mine.vue:249` |
| **T3-2 权限两级白名单** | 财务域**方向正确**（读含 `operator`、资金动作不含；看板族与之相反），但 **PR-05**：应付结算控制器硬编码第 5 份字面量。菜单↔白名单**未发现单边漂移**（见 §2.1） | `finance.constants.ts:34,43` · `supplier-share-admin.controller.ts:39,76,93` |
| **T3-3 菜单三份表述** | **已机械对账，见 §2**。`nav:consistency` 门禁有效（自证 6/6），但 **PR-08** 两处覆盖缺口 | `check-nav-consistency.mjs:180-244`（判定逻辑）· `:219`（子串判据）· `:246-258`（不读 routes） |
| **T3-4 订单 11 态状态机** | 11 态 × 三视角文案**齐全**（`shared-types/src/enums/order-status.ts:70-85`，无静默回退）；**所有生产写入点都带 `WHERE status = ?` 或 `IN (...)` 守卫**（`delivery.service.ts:866-868,919-921` · `order.service.ts:641,704-706,860-862,935-937` · `supplier.service.ts:546-548` · `refund.service.ts:219-220,603-604,691-695`）——**唯一例外是 PR-01 的 U11 取消**；**PR-03** 声明表缺 5 条入边 + 文档 T16 错；`refunding` 为显式登记的保留态（`order-state-machine.ts:55`）；`set({status: back})` 动态值**已被门禁显式列为待人工确认**（`order-state-audit.ts:514-524`，非静默跳过） | 见 PR-01 / PR-03 |
| **T3-5 时间口径** | 真源机制**正确且写得好**（`DEFAULT_TIMELINE` 唯一声明 + `TASK_SCHEDULES.cron`/`time.ts` 锚点两处派生 + 配置热重载 + 读表失败**绝不回落**；`isOrderable` 上界 = `cutoffAtOf − cutoff_window_minutes`，确为**算出来的**，`time.ts:195-204`）。**但 PR-02：送达时刻在 8 处被手写**，其中 `workbench.service.ts:135-136` 是同一 payload 内的双真相 | `order-timeline.ts:44-47,83-93,148-166,286-323` · `time.ts:163-204` |
| **T3-6 账本与并发** | 两层齐备的**良好范例**很多（`commission-settle`/`balance-adjust`/四路提现/退款审批/强制退款/手动改单/团长退出/取餐确认/支付/下单 均有 `@Idempotent`；资金动作另有 `WHERE id=? AND status=?` + `affected`，`order.service.ts:637-648` 有完整推理论证）。**缺口 = PR-01 + PR-10**（U11 取消，两层同时缺） | 见 PR-01 / PR-10 |
| **T4-7 功能缺失与规格漂移** | 三类分开交代见 §4 | §4 |
| **T4-8 验收=「人能点到」** | 已专项核查，**发现 3 类「静默不存在」**：① PR-04 按钮亮着点进去 `10003`；② PR-08 门禁盲区（`/leader/detail` 形态）；③ §2 表里 `routes.ts` 有而菜单无的项。**未发现**「页面在但入口藏起来」的存量（M5-15/M5-16 已修 building 四页 / 菜品库 / 4 个统计页 / packing-center） | `dishes.vue`（如实说明页·零 API 调用）/ `template.vue:77-78`（D7b 编辑入口在） |
| **T4-9 点名未排期项** | 见 §4.2 | `agreements.ts:191` 等 |

---

## 4. T4 · 三类缺口的分类交代（**区分「如实取舍 / 真缺失 / 灰色地带」**）

### 4.1 ① **已如实标注的取舍 —— 不是缺陷**（不记缺陷，但需在报告点名）

| 项 | 登记处 | 静态复核结论 |
|---|---|---|
| 契约未实装 14 条（13 未实装 + `U12` 刻意不设） | `接口规范v1.0.md:209-239`（§1.8） | ✅ 与 K50 明细逐条一致；`U12` 由 A2 `GET /auth/me` 承担（`auth.service.ts:170-179` 有明文说明） |
| K50–K56 | 已知项清单 | ✅ 抽查无矛盾。`K55`（`手机测试指南.md` 讲的是 HTML 原型、与本快照无关）为**误报源提醒**，与本次审查无关 |
| K51 T9 取餐通知走人工 | 同上 | ✅ `…流转v1.0.md:70`「取餐通知一期走微信群人工发」 |
| K52 供应商端「我的菜品」后端 | 同上 | ✅ `views/supplier/dishes.vue` 确为**如实说明页**（`:1-45`，全页零 API 调用、明确写「一期未实装」） |
| K53 **账号注销入口** | 同上 | ✅ **确认缺失**：全仓 grep `注销` 只有 2 处**文案**（`miniprogram/src/constants/agreements.ts:191`「通过「我的 → 客服微信号」联系我们申请注销」· `pages/agreement/agreement.vue:37`），**无页面、无接口、无菜单项**。属「已在册、未排期」，⚠️ **但提审前置（自检清单第 10 条「缺失不通过」）⇒ 必须点名** |
| K56 Redis 缓存层未实装 | 同上 | ✅ 与代码一致（仓库内 Redis 仅作队列驱动） |
| R1–R11 遗留风险 | `部署运维手册v1.0 §十一` | ✅ 属「未验证」，不进缺陷栏；其中 **R10（一期只允许一个 API 实例）** 与 PR-02/PR-03 的漂移风险同族（多实例会静默分叉） |

### 4.2 ② **真缺失（能力没有）** —— 需工程排期

| 项 | 状态 | 依据 |
|---|---|---|
| **账号注销入口**（K53） | ❌ 无实现 | 见 §4.1 |
| 供应商端「我的菜品 / 商家资料」**后端** | ❌ 无实现（端上已改如实说明页） | `dishes.vue:1-45` · `edit.vue:1-30` · `接口规范 §1.8` S4–S6 / S7 / S12–S13 |
| **「有套餐但无在任团长」的运营可见性** | ❌ 无实现（后台无此待办） | **PR-06**（`dashboard.service.ts:13` 仅 4 key） |

### 4.3 ③ **灰色地带（能力有、入口无 / 入口在、能力无）** —— 待工程裁决

| 项 | 形态 | 依据 |
|---|---|---|
| `/leader/detail` | **能力有（页面+接口）、入口仅下钻、不在任何清单** | `routes.ts:66-70`；三处 `router.push({path:'/leader/detail'})`（`leader/list.vue:589` 等）；**不在** `ADMIN_MENU_KEYS` / `ADMIN_NAV`，且门禁不查 routes（**PR-08**） |
| `/supplier/dishes`·`/supplier/edit` | **同一 key 挂两个角色**（平台端与商家端共名） | `admin-role.ts:52-53` 与 `:113-114` 重叠；靠「`ADMIN_NAV` 无此项」才不显示（§2.1 末行） |
| 端上 `TIME_ANCHOR` / `COMMISSION_RATE` / `LEVEL_UP_RULE` / `calcSettlement` | **能力有（常量齐备）、零消费点** —— 与 A9「等级→费率真源 = `ab_config`」形成**第二份口径** | `apps/miniprogram/src/constants/index.ts:35-64,70-113,116-127`；全仓 0 引用 |
| `ab_leader_invite`（首次） vs `ab_user.team_leader_id`（末次） | **两个口径不同源**：`bindOnInvite` 遇已存在即返回（`invite.service.ts:65-66`「邀请人是历史事实」），而 `bindInvite` **每次带邀请码登录都会改写 `team_leader_id`**（`auth.service.ts:152-153`）⇒ 「我邀请来的人」（C2 晋级审计用它，见 `invite.service.ts` 头注）与「实际给我产生佣金的人」（用 `team_leader_id`）可能不是同一批 | `auth.service.ts:140-168` · `invite.service.ts:57-77` · **待工程确认是否为刻意口径** |

---

## 5. 判定纪律自检（「恒红/恒过 = 没有判断」）

为免结论退化成「无信息」，每条给**反例条件**（什么情况下该条不成立）：

| # | 反例条件（该条不成立的情形） |
|---|---|
| PR-01 | 若客户端在请求未返回前**强制禁用取消按钮**、且不存在任何自动重试/多端同时操作 ⇒ 并发窗口不可达，**不复现**。本项目为**一期单实例**、开发环境用 SQLite（写串行）⇒ **本地实测极可能测不出来**，需 MySQL + 真并发才现形。故本条**不能**用「e2e 全绿」反驳 |
| PR-02 | 若**从未**修改 `set_meal.delivery_arrival_time`（默认 11:30）⇒ 8 处字面量与真源恰好相等，**无任何可观察后果**。改一次该配置即立刻分裂 |
| PR-03 | `canTransit()` 保持死代码、且后端筛选项不再扩展 ⇒ 无功能性后果。一旦接入守门或被 e2e 断言 ⇒ 立刻阻断「驳回 / 强制退款」 |
| PR-04 | 只有 `operator`（`canManage=false`）会踩；`admin`/`super_admin` 正常。若该页**仅由 admin 使用**（运营不碰供应商编辑）⇒ 复现概率低，但按钮仍在 |
| PR-05 | 只要 `FINANCE_READ_ROLES` / `FUND_ACTION_ROLES` 的值不再变动 ⇒ 永不发作（**这是「静默漂移」类缺陷的通性：靠一致性维护而非测试发现**） |
| PR-06 | 只要每个在营楼群**始终至少有 1 名在任团长** ⇒ 不可达。试运营若每楼配正副两人可缓解；但**停职/退出没有单碍**（无「本楼将失去唯一团长」告警） |
| PR-07 | 只要不真按 A7 字面去「删除」`ab_team_leader` 记录 ⇒ 无后果 |
| PR-08 | 只要有人**手工**审阅豁免表与 routes.ts ⇒ 缺口可用人工补上。门禁的两处缺口不会自己变红 |
| PR-09 / PR-10 | 无后果型（文案）/ 与 PR-01 同源（可合并修） |

---

## 6. 给人看的三句话（若只看一段）

1. **本项目最擅长的那类缺陷，这次仍然存在，而且仍在「资金动作」上** —— PR-01 是「跑批侧已按 `affected` 判定修好了，T4 自助取消自己没有」的**改一处漏一处**；本项目自己在 `order.service.ts:626-635` 写下过完整的危害推理，只是没回头检查 T4 自身。
2. **「时刻唯一真相」的机制是对的，纪律没执行** —— PR-02 里 `workbench.service.ts:135-136` 是**同一条出参里两个字面量/派生值并存**，比注释里的默认值更难被发现；一旦运营碰一次配置就分裂。
3. **身份模型（祝总最关心的那一块）是自洽的**，真正「考虑不周」的一处在**归属回落链的终点**：**停职/退出本楼唯一团长 ⇒ 该楼全体住户静默不可下单，提示语还指着一个同样无效的动作，且后台 4 个待办里没有一个能看见它**（PR-06）。

---

*本文件为静态审查产物；全部结论可 grep 复现。未修改任何仓库文件、未启服务、未占端口、未触碰 sqlite。*
