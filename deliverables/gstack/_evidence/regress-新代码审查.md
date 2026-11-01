# T2 · 三块新代码真缺陷挖掘（rating / message / user-cancel）

> 排障手：gstack-investigator ｜ 范围：HEAD `92b3df3` 上 47 个未提交文件中 **09-23～09-25 新写的三块**
> 方式：**只读静态审查**为主 + 本机跑通两支新增单测（12/12 绿）为辅
> 纪律：报缺陷前查过 `_ABox一盒已知项与预期行为清单v1.0.md`（K53 三条预期行为已排除；K-6/K-7 已比对）
> 约定：每条发现都给 **判据**（怎么复现/怎么证真）+ **反例条件**（什么情况下本条不成立）

---

## §0 结论速览（按严重度）

| # | 严重度 | 一句话 | 主要证据 |
|---|--------|--------|----------|
| **F-01** | **P1** | `30020 / 30021` 只进了枚举、没进 `ERROR_MESSAGE` ⇒ 用户看到的是「业务异常」 | `rating.service.ts:189/201` + `error-code.ts:209/223`（`ERROR_MESSAGE` 无对应项，实测 `grep -c "[ErrorCode.RATING"` = **0**） |
| **F-02** | **P1** | 注销闸门**缺「待入账佣金」** ⇒ 有一条可达路径让佣金在注销次日入账到一个已注销、永不提现的账户 | `user.service.ts:108-126`（只有 3 道）vs `team-leader.service.ts:420-462`（4 道）；`order.service.ts:901-947` 计佣不校验团长状态 |
| **F-03** | **P1** | 通知编排受众**不排除已注销 / 黑名单用户** ⇒ 已注销的人仍被计入受众并被真实投递 | `message-orchestrator.service.ts:177-201`（只查 `ab_order`，无 `ab_user.status` 过滤）；`message.service.ts:115-128`（只取 openid） |
| **F-04** | **P1** | 编排端点**无幂等 / 无去重** ⇒ 同一「确认发送」连点两次，同一批人被投递两次（每条消耗一次订阅授权额度） | `message-admin.controller.ts:63-79`；`message-orchestrator.service.ts:116-133`；`message.service.ts:78-167` |
| **F-05** | P2 | 评价并发提交撞唯一键 → 未被翻译成 `30021`，落到 **HTTP 500 / 90001「系统繁忙」** | `rating.service.ts:196-204`（先查后写无锁）+ `:255-257`（事务 save）；唯一键 `uk_dish_rating_order_dish` |
| **F-06** | P2 | 注销「恢复走客服」**在系统内没有落点**：无后台用户端点/页面，`USER_STATUS_LABEL` 零引用 | 全仓 `grep USER_STATUS_LABEL` 仅 `user-status.ts:25` 定义处；`admin/*` 控制器清单无用户域 |
| **F-07** | P2 | 团长档案不随注销匿名化：`ab_team_leader.real_name / phone` 明文保留，与注销页承诺的「个人资料将被匿名化」不一致 | `user.service.ts:137-146` 只清 7 列；`leader.entity.ts:32/35`；注销页 `account-cancel.vue:175` |
| **F-08** | P2 | D69 页面标题写死「**本周**最差三道菜」，但区间可选 `30d` ⇒ 文案与数据不符 | `views/stats/dish-heat.vue`（Tab2 卡片 header） |
| **F-09** | P2（登记，不计缺陷） | 表数/场景数注释陈旧（27 张 / 5 场景）；**代码侧 28 张已全对齐** | `seed.ts:44`、`seed.ts:174`；`entities/index.ts` 已改 28 |

**已验证为「没问题」的项**（同样给出，便于证伪）：
- 确认词两端**一致**（服务端 `user-cancel.dto.ts:20` `'注销账号'` = 端上 `api/user.ts` 同名常量）⇒ 不会出现「两端不一致报 `10001`」的可见失败。
- 迁移 `1700000000003-dish-rating.ts` 与实体 `DishRating` **逐列 + 三索引同名同序同唯一性**一致；`entities/index.ts:7-16` 域计数合计 28 ✓。
- 越权：评价 `order.userId !== userId → ORDER_NOT_FOUND`（`rating.service.ts:181-184`，不区分不存在/非本人）；注销只认 `user.sub`；通知编排 `AdminGuard + @Roles('super_admin','admin')`（`message-admin.controller.ts:38-39`），用户 token 走 `payload.typ !== 'admin' → 10003`。
- 资金：`ab_dish_rating` **无任何资金写点**（除 rating 模块与 `order.service.ts` 详情组装外，全仓零引用）⇒ 不影响佣金/结算基数；通知链路**不扣费、不发券**（`message.service.ts` 只 `wxNotify.send` + 写 `ab_message`）。
- 迁移列可空性：`nickname/avatar_url/phone/phone_hash/building_id/team_leader_id/subscribe_flag` 全为 nullable（`user.entity.ts` + `1700000000000-init.ts:31-37`）⇒ 注销写 `null` 不会触发 NOT NULL 报错。
- 新增单测：`test/unit/dish-rating-agg.spec.ts` + `test/unit/message-reach.spec.ts` **12/12 绿**（本机 `node node_modules/jest/bin/jest.js` 直跑，带 pipefix 垫片）。

---

## §1 逐条发现

### F-01 · P1 · `30020 / 30021` 没有默认文案，用户看到「业务异常」

**证据**
- 枚举已声明：`apps/api-server/src/common/constants/error-code.ts:209` `RATING_NOT_ALLOWED = 30020`、`:223` `RATING_ALREADY_SUBMITTED = 30021`。
- `ERROR_MESSAGE`（`error-code.ts:378` 起）里**没有这两项**：`:407` 是 `MEAL_TEMPLATE_IN_USE(30019)`，下一条直接跳到 `BALANCE_AMOUNT_INVALID(40002)`；全文件 `grep -c "\[ErrorCode.RATING"` = **0**。
- 两处抛点都**不传显式 message**：`rating.service.ts:189-192` `new BizException(ErrorCode.RATING_NOT_ALLOWED, undefined, undefined, {...})`、`:201-203` 同理。
- 兜底路径：`biz.exception.ts:24` `super(message ?? ERROR_MESSAGE[code] ?? '业务异常')` ⇒ 命中即回 **'业务异常'**。

**判据（可证真）**
对一张 `refunded`/`cancelled` 的订单 POST `/orders/:orderNo/rating` ⇒ 响应 `code=30020` 且 `message === '业务异常'`（而不是「当前订单状态不可评价」）；对已评过的单再提交 ⇒ `code=30021` 且 `message === '业务异常'`。
`30020/30021` 的 `data`（`status` / `allowed` / `ratedAt`）是对的，只有文案丢了。

**反例条件**
若后续在 `ERROR_MESSAGE` 补入两条，或抛点改为传显式 message（`new BizException(code, '该订单已评价过')`），本条即不成立。
⚠️ 也正因如此它**逃过了全部门禁**：`e2e-m1` 的 U20 断言只校验 `code === 30020 / 30021`（`scripts/e2e-m1.mjs` §U20），**不断言 message**；`jest` 也不覆盖 `ERROR_MESSAGE` 完备性（全仓无该门禁）。这正是「19 道门禁 + e2e 全绿却留死角」的同类形状。

---

### F-02 · P1 · 注销闸门缺「待入账佣金」，存在一条可达的资金悬空路径

**证据**
- 注销只有 3 道闸门：`user.service.ts:108-117` —— `leader`（在职团长）/ `balance`（`balanceFen || frozenFen > 0`）/ `orders`（非终态订单）。**没有佣金闸门**。
- 团长退出用的是 4 道：`team-leader.service.ts:420-462`，其中第 ③ 条 `COMMISSION_PENDING`（`ab_commission.status='pending'`）**注销侧完全没有对应项**。
- 佣金两段式：T 日 14:00 计佣写 `pending`（`commission.service.ts:502`），**T+1 02:00 才入账进余额**（`commission.service.ts:667-750`）。入账前余额恒为 0。
- 计佣侧**不校验团长状态**：`order.service.ts:901-947` 只做 `leaderRepo.findOne({ where: { id } })`，找不到才跳过；`status=2`（已退出）照样 `accrueForOrders(leader, ...)`。

**可达路径（4 步，全部落在已实现代码上）**
1. 团长在 T 日 14:00 前**退出团长**：此时 `balance=0 / frozen=0 / pending 佣金=0`（佣金还没生成）⇒ `collectQuitBlockers` 空 ⇒ 退出成功，`status=2`。
2. 他名下已送达（`delivered`）的订单在 T 日 14:00 被自动确认 → `completed` → 写 `ab_commission(status='pending')`，`teamLeaderId` 仍是他的（订单绑定不变）。
3. T 日 14:00 后、T+1 02:00 前他注销：`leader.status=2 ≠ ACTIVE`（不拦）、`balance=0`（佣金未入账，不拦）、订单已 `completed`（终态，不拦）⇒ **`POST /me/cancel` 返回成功**。
4. T+1 02:00 跑批把佣金入账 → 钱进一个**已注销、已匿名化、无法登录、无法提现**的账户；且 `20015` 的 `reasons` 里根本没有这一项，用户**看不到任何提示**。

**判据（可证真）**
构造：用户 U 有 `ab_team_leader(status=2)`、`ab_commission(status='pending', teamLeaderId=U)`、`ab_balance.balance=frozen=0`、无非终态订单 → `POST /me/cancel {confirmText:'注销账号'}` ⇒ 返回 `code=0`（注销成功）。对照 `quit` 同数据 ⇒ `20008` 且 `blockers` 含 `COMMISSION_PENDING`。

**反例条件**
若 ①该用户仍是 ACTIVE 团长（`leader` 闸门拦下）、②佣金已入账（`balance` 闸门拦下）、③计佣点改为要求 `leader.status === ACTIVE`（`order.service.ts:947` 前加判），任一成立则本条不成立。当前三者都不成立。
> 注：**在途提现不漏** —— `withdraw.service.ts:82-120` 申请即把金额从 `balance` 移入 `frozen`，被 `balance` 闸门的 `frozenFen > 0` 覆盖。这一条我判定为「不是缺陷」，反例是：若某天出现「提现单仍在 `pending/approved/paying` 但余额已解冻」的不一致数据，则闸门会漏。

---

### F-03 · P1 · 编排受众不排除已注销 / 黑名单用户

**证据**
- `message-orchestrator.service.ts:177-201` `resolveAudience()` 两张查询都只按 `ab_order.mealDate + status`，**全程不 join / 不过滤 `ab_user.status`**。
- 投递侧也不过滤：`message.service.ts:115-128` 只按 `userId` 取 `openid`，不查用户状态。
- 注销**保留 openid**（`user.service.ts` 头注明确，唯一索引在 openid 上）⇒ openid 取得到 ⇒ 真发得出去。
- 注销**不删订单** ⇒ 该用户近 14 天的订单仍在 `history` 里 ⇒ 命中受众。

**判据（可证真）**
用户 A 有近 14 天有效订单 → 注销（status=3）→ 后台 `POST /admin/messages/orchestrate {scene:'cutoff_remind', audience:'cutoff_remind_pending', dryRun:true}` ⇒ `audienceSize` **包含** A；改为 `dryRun:false` 且场景已启用 ⇒ A 会出现在 `delivered` 计数里（一期因模板 ID 为空恒为 0，见下）。

**反例条件**
若 `resolveAudience` 加了 `user.status = 1` 过滤，或 `MessageService.notify` 加「已注销用户跳过」分支，本条不成立。当前两者都没有。
⚠️ 一期可观测性：`wechatTemplateId` 全空 ⇒ 启用闸门拦住 ⇒ `delivered=0`。所以**现在只能看到 `audienceSize` 虚高**；接入微信模板后立刻变成真实的「给已注销用户推送」。另：黑名单（status=2）用户同理被计入，但黑名单属平台处罚，是否推送另议。

---

### F-04 · P1 · 编排端点无幂等 / 无去重，重复触发 = 重复投递

**证据**
- `message-admin.controller.ts:63-79` `POST orchestrate` **没有** `@Idempotent()`（对比：`order.service.ts` / `team-leader.service.ts` 的写操作都用了幂等键）。
- `message-orchestrator.service.ts:116-133` 逐条 `message.notify()`，**没有「同一用户同一场景同一 mealDate 已投过就跳过」的任何判定**。
- `message.service.ts:78-167` `notify()` 内也无去重，只按场景开关 + 模板 ID + openid 判定。
- 端上二次确认只挡「误点」，**不挡「确认后连点两次 / 两个运营各发一次」**：`views/system/message-template.vue` 的 `runOrchestrate(false)` 每次都真的发。

**判据（可证真）**
在场景已启用 + 模板 ID 已配置的前提下，连发两次 `dryRun:false` ⇒ 两次 `delivered` 相同且非 0；`ab_message` 里同一 `openid + scene` 出现两条 `sent_at` 相近的记录。
（也可证伪：**当前** `delivered` 恒 0，两次调用结果一致地"什么都没发"—— 这正是它被门禁漏掉的原因。）

**反例条件**
若后续加了 `Idempotency-Key` 要求，或在 `orchestrate` 内加「本次 mealDate 已编排过则拒绝/幂等返回」的去重键，本条不成立。
> 顺带结论（资金维度）：通知链路**不存在扣费或发券路径**（`message.service.ts` 只有 `wxNotify.send` + `logRepo.save`），所以本条的损失是**订阅授权额度 + 用户被骚扰**，不是钱。

---

### F-05 · P2 · 评价并发提交撞唯一键 → 500，而不是 `30021`

**证据**
- `rating.service.ts:196-204`：先 `findOne` 查该单是否已有评价行（**事务外、无锁**），无行才继续。
- `rating.service.ts:255-257`：`dataSource.transaction` 里 `em.save(DishRating, rows)`。
- 唯一键 `uk_dish_rating_order_dish (order_id, dish_id)`：`1700000000003-dish-rating.ts:43` + `order.entity.ts` `@Index(..., { unique: true })`。
- 并发两个请求都通过第 196 行的检查 ⇒ 第二个 `save` 抛 `QueryFailedError` ⇒ `all-exceptions.filter.ts:76-82` 落到 **HTTP 500 + `90001`「系统繁忙，请稍后再试」**。

**判据（可证真）**
同一 token、同一 `orderNo`、同一 `items`，并发（不等第一个返回）发两次 ⇒ 至少一个响应是 `HTTP 500 / code 90001`（而不是 `30021`）。

**反例条件**
端上 `ratingSubmitting` + `canSubmit` 已经挡住单页双击（`order-detail.vue` `submitRating`），单设备串行提交不会出现；若服务层把 `QueryFailedError`（唯一键冲突）翻译成 `30021`，本条不成立。
> 语义备注：「一次定稿不可改」这条裁决**靠唯一键兜住了**（数据不会真的重复），缺的只是把冲突翻译成业务码 —— 所以定 P2 而非 P1。

---

### F-06 · P2 · 「恢复走客服」在系统内无落点

**证据**
- 全仓 `grep USER_STATUS_LABEL` 只有定义处 `user-status.ts:25-29`，**零引用**（后台根本没有用户页）。
- 后台控制器清单里**没有用户域**：`admin/system`、`admin/orders`、`admin/buildings`、`admin/finance`、`admin/meal`、`admin/dishes`、`admin/stats`、`admin/messages` … 无 `admin/users`。
- 注销页明确对用户承诺「如需恢复，请联系客服」（`account-cancel.vue:20/28/223`），服务端 `note` 也写「如需恢复，请联系客服」（`user.service.ts` 返回体 `note`）。
- 客服拿到请求后：**系统内没有任何入口能把 `status` 从 3 改回 1**（登录侧被 `auth.service.ts:84` 硬拦，拿不到会话）。

**判据（可证真）**
注销任一账号后，在后台任何页面都找不到该用户、也找不到「恢复」按钮；全仓不存在写 `ab_user.status` 的后台端点。

**反例条件**
若「恢复」被定义为纯人工流程（DBA 直连改库 + 人工核验身份），则它是流程缺口而非代码缺陷 —— 但注销页对用户的承诺在系统内没有支撑，两处说法对不上，仍应登记。

---

### F-07 · P2 · 团长档案未随注销匿名化

**证据**
- `user.service.ts:137-146` 只清 `ab_user` 的 7 列（nickname/avatarUrl/phone/phoneHash/buildingId/teamLeaderId/subscribeFlag）。
- `ab_team_leader` 保留 `real_name`（`leader.entity.ts:35`）、`phone`（`:32`，脱敏存储）、`floor` 等，**不在清理范围**。
- 注销页 `CONSEQUENCES` 第 2 条写「个人资料将被匿名化：昵称、头像、手机号、所属办公楼与团长绑定都会被清空」（`account-cancel.vue:175`）—— 只对 `ab_user` 成立。

**判据（可证真）**
一个**已退出团长**（`status=2`）的用户注销后，`SELECT real_name, phone FROM ab_team_leader WHERE user_id = ?` 仍返回明文。

**反例条件**
若把团长档案认定为「依法保留的经营记录」（与订单/佣金同类），则属预期 —— 但那样注销页的「个人资料将被匿名化」就是**虚假告知**，两端必须对齐其一。

---

### F-08 · P2 · D69 标题写死「本周」，但区间可选 30d

**证据**：`views/stats/dish-heat.vue` Tab2 卡片 header 为「本周最差三道菜（P1 验收口径）」，而工具栏区间是 `STATS_RANGE_OPTIONS = today / 7d / 30d`；服务端 `worstThree` 是**区间内**最差（`rating.service.ts:145-148`）。

**判据（可证真）**：切到「近 30 日」Tab，标题仍写「本周最差三道菜」，内容已变成 30 天口径。
**反例条件**：若把「本周」当成「当前区间」的口语简称（P1 验收判据原文确实是「本周」），则属文案瑕疵 —— 定 P2。

---

### F-09 · 登记不计缺陷 · 表数/场景数注释陈旧（代码侧已对齐）

- `seed.ts:44`「清空全部表（当前 27 张）」、`:174`「通知模板（5 场景）」—— 但 `seed` 的 `wipeAll()` 遍历 `ALL_ENTITIES`、模板播种由 `MESSAGE_TEMPLATE_SPECS` 派生，**代码行为正确，只是注释过期**。
- `docs/` 下 ER v2.1、基线冻结清单等仍写 27 张 —— 属 T3（契约/文档对账）范围。
- 代码侧 `entities/index.ts:7-16` 各域计数合计 **28** ✓，迁移与实体 parity ✓（逐列 + 三索引同名同序同唯一性）。
- 未发现「别处写死 27」导致的功能性问题。

---

## §2 逐项对照任务清单

| 任务项 | 结论 |
|--------|------|
| 1 幂等 | 评价：无幂等键，靠「已有行即 `30021`」+ 唯一键兜底，但**并发冲突落到 500**（F-05）。注销：**刻意不幂等**，重复 → `20014`（设计，K53 已登记为预期，端上正确处理）。通知：**无幂等，重复即重复投递**（F-04）。 |
| 2 越权 | 三块**均无越权口**：评价校验 `order.userId === userId`（不区分不存在/非本人，防探测）；注销只认 `user.sub`；通知编排 `AdminGuard + @Roles(super_admin/admin)`，非后台 token → `10003`。另：已注销用户**不能被任命为团长**（`leader-admin.service.ts:436`）。 |
| 3 状态机与闸门 | 评价 `30020` 按 `RATING_ALLOWED_STATUSES=[delivered, completed]` 真实生效 ✓（e2e 已锚 cancelled→30020）。注销闸门**4 缺 1**：在途提现 ✓（冻结覆盖）、非终态订单 ✓（含 `refund_applying/refunding`，fail-closed）、余额/冻结 ✓、**待入账佣金 ✗**（F-02）。 |
| 4 资金 | `ab_dish_rating` 零资金引用 ✓ 不影响佣金/结算。通知**不扣费不发券** ✓，但重复触达消耗订阅额度（F-04）。注销会让待入账佣金悬空（F-02）。 |
| 5 不可逆兜底 | 确认词服务端校验**已落实** ✓（`user.service.ts:88-95`），两端常量一致 ✓。缺口在**恢复通道**（F-06）与**团长档案未匿名化**（F-07）。 |
| 6 迁移 | 第 4 支迁移与实体 **parity 一致**（列/类型/可空/注释 + 3 索引同名同序同唯一性）✓；表数 28 在 `entities/index.ts` 已同步 ✓；无代码写死 27（仅注释/文档陈旧，F-09）。 |
| 7 ⭐ 可达性 | 死角三条：`USER_STATUS_LABEL` 零引用（F-06）、`ab_dish_rating.slot / order_no` 写而不读（低）、`ab_user.deleted_at` 写入后**无任何查询读取**（注释自称「双证据」，实为仅供人工 SQL；低）。另 F-01 属「错误码加了但文案没加」的同类死角。 |

---

# 附录 A · F-02 同族扫描：「写钱不校验收款人身份状态」是一类 bug

> 触发：team-lead 追问 F-02（计佣侧不校验团长状态）是**孤例还是系统性**。
> 范围：**纯静态**（未启服务、未跑 seed、未改库、未改源码）。
> 扫描对象：所有「向团长 / 用户**写钱**」的路径，逐类给 **路径 · 是否校验状态 · 不校验的可达后果 · 反例条件**。
> ⭐ 核心区分：**「真会写钱进死账户」**（与 F-02 同族，合并）vs **「没校验但事实上不可达」**（不算缺陷，不虚报）。

## A.0 一句话结论

**F-02 是一类 bug，不是孤例。** 系统性根因：

> **所有写钱动作都只以「账户行 / 团长行存在」为唯一判据，从不校验「这个人还是不是一个能收钱的人」。**

三处真落点：**计佣跑批（F-02 的根）→ 佣金入账（F-02 的钱真正落袋处）→ 退款退回余额（新发现，且比 F-02 更易达）**。
**提现**经查为「**没校验但不可达**」，**不计缺陷**（上一轮结论维持）。

---

## A.1 计佣（写 `ab_commission`）

| 路径 | 入口 | 是否校验状态 | 判定 |
|------|------|--------------|------|
| **A1 · L9 团长确认收货** | `leader-order.service.ts:273` ← `leader-order.controller.ts:89` | ✅ **间接校验**：入口挂 `LeaderGuard`，`leader.guard.ts:50` 判 `status !== ACTIVE → 20003` | **不是缺陷** |
| **A2 · 4.4 自动确认兜底跑批**（T 日 14:00） | `order.service.ts:901-947` | ❌ 只 `leaderRepo.findOne({ where: { id } })` 判**存在性**，不看 `ab_team_leader.status`，也不看 `ab_user.status` | ⭐ **同族（F-02 的根）** |

**A2 的后果**：已退出团长（`status=2`）名下已送达的订单，在 T 日 14:00 被自动确认 → 照样 `accrueForOrders` 写 `pending` 佣金（`commission.service.ts:502`）。
**反例条件**：若跑批加 `leader.status === ACTIVE` 判据（或订单无归属团长时改走 orphan 分支），A2 不成立。

---

## A.2 ⭐ 佣金入账（pending → settled，**钱真正落袋**）

- 实现：`commission.service.ts:731-737`（跑批唯一执行口 `settlePending`，与手动补跑共用）—— `m.findOne(TeamLeader, { where: { id } })`，**只判团长行存在**；
- 落袋：`creditCommissions`（`commission.service.ts:568-611`）—— `m.findOne(Balance, { where: { userId: Number(leader.userId) } })` 然后加 `balance` + 写 `ab_balance_log`，**不查 `ab_team_leader.status`、不查 `ab_user.status`**。

**后果**：`user.status=3`（已注销）的用户，其 `pending` 佣金在 T+1 02:00 **照样入账**；而提现入口必须过 `LeaderGuard`（ACTIVE 团长），已注销用户**永远拿不到提现入口** ⇒ **钱永久悬空，且无任何提示**。这就是 F-02 的实际落点（A2 只是把钱写成 pending，A.2 才让它真正进死账户）。

**⚠️ 必须区分的一条（别误报）**：**已停职团长（`ab_team_leader.status=2`）的佣金照常入账 —— 这是设计，不是缺陷**。`team-leader.service.ts` 退出口径明确写着「历史佣金 / 推荐关系全部保留 —— 换人不该抹掉别人已经赚到的钱」。死账户的判据是 **`ab_user.status=3`（注销）**，不是团长停职。

**反例条件**：若入账侧加「`user.status ≠ 3` 否则跳过并进人工队列」，或注销闸门补上 `commission` 项（F-02 的修法），本条不成立。

> ⭐ **给修复方案的一条硬约束**：`settlePending` 是**整批单事务**（`commission.service.ts:724`，注释明写「要么全入账、要么全不入账」）。所以对已注销用户的处理**必须走现有的 `skippedReasons` / `skipped` 机制（`:731-737` 已有先例）**，**绝不能抛 BizException** —— 一处抛错会让**当天所有团长的佣金全部回滚**，那是比钱悬空严重得多的生产事故。

---

## A.3 ⭐ 退款退回余额（**新发现的同族落点，比 F-02 更易达**）

- 可退状态集合：`refund.service.ts:75-81` `REFUNDABLE_STATUS = [paid, cut_off, cooked, delivering, delivered, **completed**]` —— **`completed` 在可退集合里**。
- 执行链：`settleRefundDb`（`refund.service.ts:677-728`）→ `reversal.applyRefundEffects` → `refundBalancePart`（`reversal.service.ts:100-150`）：`m.findOne(Balance, { where: { userId: Number(order.userId) } })` 后**直接加余额**，**全程不校验 `ab_user.status`**；账户不存在才 fail-closed（`:107-118`），而**已注销用户的 `ab_balance` 行仍在**（注销不清余额账户）。

**为什么它比 F-02 更易达（无需构造时序巧合）**：
注销的闸门之一是「无非终态订单」（`user.service.ts:113-116`）⇒ **已注销用户的订单必然是 `completed / cancelled / refunded`**，而 `completed` **正好在可退集合内**。于是：
> 团长代退（`applyByLeader`）或后台强制退款（`forceRefund`，客诉兜底通道）对一张**已注销用户的历史 `completed` 单**发起退款 ⇒ 退款额中的「余额抵扣」部分**直接退回一个死账户**，且 `reversal` 不会因用户已注销而给出任何告警。

**后果**：死账户余额增加（微信实付部分原路退微信、不受影响，故悬空的是**余额抵扣那部分**）；用户拿不回来、系统无提示。客服处理客诉时极易触发（「帮我退上个月的订单」）。

**反例条件**：若 `REFUNDABLE_STATUS` 剔除 `completed`、或退款侧加 `user.status` 校验并改走人工退款，本条不成立。
**⚠️ 别虚报的那一条**：**用户自助退款**（截单前取消，`order.service.refundBalance`）对已注销用户**不可达** —— 注销后没有在途订单可退。旧 token 虽然还能调接口（已登记设计），但**没有可退的单**，构不成路径。

---

## A.4 提现（上一轮结论复核）

- 发起：`withdraw.service.ts:59` `apply(leader, dto)` 自身**不校验 `user.status`**；但入口 `leader-finance.controller.ts:61-64` 挂 **`LeaderGuard`（`leader.guard.ts:50` 校验 `leader.status === ACTIVE`）** + `@Idempotent({ scope: 'withdraw' })`。
- 而 **ACTIVE 团长不可能已注销**：注销闸门 `user.service.ts:108-109` 对 `LeaderStatus.ACTIVE` 直接拦（`reasons.push('leader')`）。

⇒ **判定：没校验，但事实上不可达，不是缺陷。** 上一轮「在途提现被 `frozenFen` 覆盖、不是缺陷」的结论**维持**（`withdraw.service.ts:82-120` 申请即冻结）。
**反例条件**：若将来开放「普通用户（非团长）余额提现」入口而不加 `user.status` 校验，本条立刻升级为真缺陷 —— 建议把这条写进「未来入口的检查清单」。

**边界（不并入 P1）**：退款时的**佣金反冲**（`reversal.service.ts:303-350`）也不校验状态，可把团长余额扣成**负**并只在 `notes` 留一句「形成欠款由后续佣金抵扣」（`:350`）。已注销团长不会再有后续佣金 ⇒ 负余额永久挂账。但触发条件苛刻（佣金已 settled **且**已提完 ⇒ 余额 0 ⇒ 才允许注销 ⇒ 注销之后该单又被退款），判 **边界 · P2**。

---

## A.5 附：后台调账（`balance-admin.service.ts:177-213`）

只查用户存在性，**不校验 `status`** ⇒ 可以给已注销用户加/减余额。
**判定：可接受（不计缺陷）** —— 人工动作 + 全程 `ab_operation_log`，且它是目前**唯一**能碰死账户钱的工具。
但它**不能解决** A.2/A.3 的悬空：只能改余额数字，**钱出不去**（提现必须走团长通道 + `LeaderGuard`），最终仍要靠线下转账 + 人工登记。这一点应写进 F-06「恢复通道缺失」的补充说明。

---

## A.6 合并后的缺陷登记建议

**新增 / 合并为一条系统性缺陷：`F-10 · 写钱路径缺「收款人身份状态」闸门（P1）`**

| 落点 | 文件:行 | 是否并入 F-10 |
|------|---------|---------------|
| 计佣（自动确认跑批） | `order.service.ts:901-947` | ✅ 并入（根） |
| 佣金入账（pending→settled） | `commission.service.ts:731-737` + `:568-611` | ✅ 并入（钱真正落袋） |
| 退款退回余额 | `refund.service.ts:75-81` + `reversal.service.ts:100-150` | ✅ 并入（新发现，更易达） |
| 佣金反冲扣负 | `reversal.service.ts:303-350` | ⭕ 边界（P2，条件苛刻） |
| 提现发起 | `withdraw.service.ts:59` + `leader-finance.controller.ts:61-64` | ❌ 不计（不可达） |
| 后台调账 | `balance-admin.service.ts:177-213` | ❌ 不计（人工 + 有日志） |

**修法建议（别在三处各写一个 if）**：收敛出一个单一判定（如 `canReceiveMoney(userId): { ok: boolean; reason?: string }`），在 **计佣 / 入账 / 退余额** 三处调用；对「不可收」的处理统一为 **跳过 + 进人工队列 + 如实回带原因**（入账侧复用现成 `skippedReasons`，退余额侧需新增），**不得抛异常打断整批事务**（见 A.2 的硬约束）。

---

## §3 我跑过的验证（非门禁，仅供溯源）

```
cd abox-onebox/apps/api-server
PIPEFIX_QUIET=1 NODE_OPTIONS="--require <...>/_tmp/gatepipe/pipefix.cjs" \
  node node_modules/jest/bin/jest.js test/unit/dish-rating-agg.spec.ts test/unit/message-reach.spec.ts
→ Test Suites: 2 passed, 2 total / Tests: 12 passed, 12 total
```
> 注：`node_modules/.bin/jest` 在 Windows 下是 shell 脚本，直接 `node` 跑会 SyntaxError；须走 `node_modules/jest/bin/jest.js`。
> 两支新增单测**钉住了本次最易碎的两条口径**：`badCount`(区间) 与 `monthBadCount`(锚点月) 分道（`dish-rating-agg.spec.ts:34-48`）、`reachRate` 无记录为 `null` 不是 `0`（`message-reach.spec.ts:16-26`）—— 这两条**确实没问题**。

---

## §4 建议的修复批次（供 team-lead 排期；我只报不改）

1. **F-01（5 分钟）**：`error-code.ts` 的 `ERROR_MESSAGE` 补 `[ErrorCode.RATING_NOT_ALLOWED]` / `[ErrorCode.RATING_ALREADY_SUBMITTED]` 两条文案；并在 e2e 里补一条 **message 断言**（只断言 code 的门禁抓不到这类「码对了文案没了」）。
2. **F-02（小改）**：`UserService.cancelAccount` 增加第 4 道闸门 `commission`（复用 `ab_commission.status='pending'` 的计数，口径抄 `collectQuitBlockers` 的 `COMMISSION_PENDING`，含 `type='reversal'` 的取舍要一并抄对），并补 `REASON_TEXT.commission`。
3. **F-03（小改）**：`resolveAudience` 增加「排除 `ab_user.status ≠ 1`」（注销 3 / 黑名单 2），并在 `note` 里如实说明排除了多少人。
4. **F-04（小改）**：给 `orchestrate` 加去重键（`scene + audience + mealDate` 已投递名单或 `@Idempotent()`），或在出参里如实回带「本日已编排过 N 人」。
5. **F-05（小改）**：`submit` 捕获唯一键冲突（`QueryFailedError` / sqlite 的 `SQLITE_CONSTRAINT`）→ 转 `30021`。
6. **F-06 / F-07 / F-08**：依次为「后台恢复入口（或把注销页文案改成『恢复需人工核实』）」「团长档案同步匿名化」「标题随区间改字」。
