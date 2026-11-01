# ABox 一盒 · 程序缺陷全面复查报告 v1.0

> 生成日期：2026-10-08
> 范围：**排除一切资质/备案/证照/ICP/食品经营许可类事项**，只查程序逻辑与 BUG
> 方法：4 位专家并行只读审查（后端 / 前端 / QA / 架构）+ team-lead 逐条回源核实
> 工作区：`abox-onebox`（审查期间全程只读，未改动任何源码，`git status` 干净）

---

## 一、结论速览

| 分级 | 条数 | 性质 |
|---|---|---|
| **P0** | **3** | 资金安全 / 越权 / 核心功能不可用 |
| **P1** | **13** | 脏数据 / 用户可见错误 / 双轨表述 / 门禁自欺 |
| P2 | 31 | 清理与技术债，不影响当前正确性 |
| **合计（去重后）** | **47** | 3 + 13 + 31 |

**最重要的一条**：三位专家从**三个互不相干的角度**打到了同一个点，串成一条完整缺陷链（P0-1）。这不是孤立 BUG，而是一个「评判规则写了、规则只是装饰、防守性测试恰巧永远执行不到」的**三合一产物**。

---

## 二、P0 —— 必须立即修复

### P0-1 · 团长「一键分发」允许 `delivering → completed` 并立即计佣（资金）

**这是资金安全问题，不是状态机洁癖。**

三处独立证据，原本应该互相印证，结果互相矛盾：

| 来源 | 位置 | 主张 |
|---|---|---|
| 生产代码 | `apps/api-server/src/modules/order/leader-order.service.ts:239` + `:262-270` | 收 `status IN ('delivering','delivered')`，直接 `SET status='completed'` + `accrueForOrders` 计佣 |
| 状态机声明 | `apps/api-server/src/modules/order/order-state-machine.ts:27` | `DELIVERING → [DELIVERED, REFUND_APPLYING]` —— **delivering 不能直接 completed** |
| e2e 自钉口径 | `apps/api-server/tests/e2e-m3.mjs:11025-11027` | 明写：服务端确实用 `IN ('delivered')` 严守；**显式 modeling decision**： deliverecord=0 的 delivering 单不许确认收货，**否则团长能伪造完成提前拿佣** |

**后果**：东西还在配送途中，团长点「一键分发」即可推 completed 并计佣 —— 佣金提前到账。

**为什么至今没炸**：e2e 的夹具直接把状态设成 `delivered`（`e2e-m3.mjs:10990-10995`），**这个分支从未被真正覆盖**；而检察 package 那边，状态机 `canTransit()` 是死代码（见 P1-9），没人实际执行这套规则。

**与 CEO 口径的关系**：本项目《上线需求》对 confirmation 的要求是配送送达后才 Completion。P0-1 违反的不是外部规定，是**项目自己写下的规则**。

**修法（二选一，建议前者）**：
- ① 收口为唯一 setsimer：**一键分发只收 `delivered`**（与 e2e 口径一致），delivering 单返回明确错误而非静默跳过
- ② 保留放行 delivering，但**拆开计佣**：只有 `delivered` 起的才计佣

**配套**：补 e2e 用例（delivering 单 + completed deliverecord=0 → 断言拒 / 不计佣），并把这个 Invariant 写进 e2e 而不是只留在 QQ 群聊里。

---

### P0-2 · 拉黑 / 注销用户凭旧签发的 token 仍可下单、退款（越权，约 7 天）

| 位置 | 事实 |
|---|---|
| `current-user.decorator.ts:31` | 从 JWT **直接读 trust_level**（JWT 里的东西，服务端治理状态的改动不知道） |
| `common/constants/admin-role.ts:28` | `role` 也是 JWT 内 claim ⇒ **服务端改角色也被 JWT 覆盖** |
| `jwt.strategy.ts:121` |  `/me/profile` 重新 login 才更新 roles ⇒ **tsanza exile_utils: Telegram @ampcsaaオ |

**四种组合中最危险的一条**：admin 把某恶意用户拉黑 → 用户手里那张 7 天有效期的 token 完全不受影响 → 继续正常下单、申请退款、继续 Optimization 一直到自然过期。

**修法（按顺序）**：
1. `jwt.strategy.ts` 的 `validate()` 里，对 `ab_user` 校验 `status !== 'disabled' && role !== 'banned'`（DB 读取，是当前 shuffle-wide mean 忽略的一步）
2. `JwtPayload` 删掉 `trustLevel` / `role` 两个 claim（只在通过 DB 校验后使用 DB 值）
3. 敏感 endpoints（下单 `POST /order`、提现、退款申请、敏感理赔）加**二次 DB 校验**（多看一次 DB 换取安全）

**验收硬指标**：拉黑即时实测 —— 拉黑后立即用旧 token 调 `POST /order`，必须返 **fail** 而非 200。

---

### P0-3 · `/leader/detail` 路由有、授权无 → 除超管外全员 403（功能不可用）

运营日常作业路径断链。

- `apps/admin-web/src/router/routes.ts:67` 路由在、`views/leader/detail.vue` 页面在、`views/leader/list.vue:583` 等 **3 处调用**在
- `apps/api-server/src/common/constants/admin-role.ts:37-38` 的 `ADMIN_MENU_KEYS` **只有 `/leader/list`、`/leader/apply`，没有 `/leader/detail`**
- `apps/admin-web/src/utils/permission.ts:26-30` 的 `canAccess` 是「精确匹配 or key + `/` 前缀」⇒ `/leader/detail` 对两者都不命中
- `apps/admin-web/src/router/guards.ts:63-65` ⇒ 重定向 `/403?from=`
- **服务端 `@Roles('super_admin','admin','operator')`（`leader-admin.controller.ts:36`）本来就放行 operator** —— 典型的「接口放行、入口拦死」

**全量基线（三方交叉核对后定稿）**：

| 项 | 数值 |
|---|---|
| `routes.ts` path 字面量 | 50 |
| 非业务（`/login` · `/` · `/403` · catchall） | −4 |
| **业务 path** | **46** |
| `ADMIN_MENU_KEYS` | **42** |
| `SUPPLIER_MENU_KEYS` | **6** |
| **差集（路由有、授权无）** | **1 —— `/leader/detail`** |
| 反向幽灵授权（授权有、路由无） | **0** |
| 自校验 | `46 = 42 + 3 + 1` ✔（3 = `/supplier/{workbench,cook-confirm,settlement}`） |

> **这条基线为什么可靠**：三位审查者各自写错了一遍抽取器 —— 有人把 42 误作 46，有人多抽 3 条注释里的 phantom key，有人把 `login/403` 计入业务 path —— **但差集三边都算出 1**。两个独立实现的误差互相抵消后结论仍一致，说明它对这个方向的计数误差天然鲁棒。
> 反过来，任何新加的判据都应做同样的**双向误差测试**。

#### ⚠ 修复陷阱（派工必读）：补 key 会让既有门禁立刻红，最顺手的消警动作是错的

实施方见到「`/leader/detail` 不在授权清单」，第一反应是补进 `ADMIN_MENU_KEYS`。**这一步做完，现有门禁马上红** —— `check-nav-consistency.mjs` 的方向②「授权无入口」会报 `[授权无入口] /leader/detail`（KEYS 有、NAV 无）。

这条判据本身是对的，它是为 M5-15 那类缺陷设计的。但此时为了消警，最容易走的路是**把它加进 `ADMIN_NAV`** —— 那就坏了：`/leader/detail` 是带 `?id=` 的下钻页，加进 NAV 会让侧边栏多出一个**点进去必然缺参**的顶级菜单项。等于用一个可见性缺陷换掉一个不可达缺陷，B1 没修好还多一条。

**正确修法：两步，缺一不可**

1. `ADMIN_MENU_KEYS` 增加 `/leader/detail` —— 解决守卫拦截（`permission.ts:26-30` 的 `canAccess` 需要命中）
2. `ADMIN_EXEMPT` 增加一条 `kind: 'drilldown'`、`via: 'views/leader/list.vue'`、why 写明「团长详情下钻页，由团长管理行内进入，不单列顶级菜单」 —— 让方向②不报，且与同类 `/leader/apply` 的既有处理保持一致

第 2 步同时被「豁免无据」判据管住：`via` 指向的 `views/leader/list.vue` 必须真的 `router.push('/leader/detail')`（`list.vue:583` 确实有），否则豁免腐烂会红。

**验收必须同时满足两条**：① 新判据差集归零；② **既有门禁保持全绿**（不能为消 B1 而引入新的 `[授权无入口]`）。只验第一条会漏掉「为消警而错加 NAV」这种修法。

---

## 三、P1 —— 应修复（脏数据 / 双轨 / 门禁自欺）

| # | 缺陷 | 位置 | 后果 | 修法 |
|---|---|---|---|---|
| P1-4 | 并发计佣：同一 UPDATE 重放回吐 affected=1，两笔 STATUS=1 都绕过开封补课，`ab_commission` 少一行 | `finance/commission.service.ts:333`、`finance/settlement.service.ts:98` | 少计佣 | 补多人刀 booked 下的 e2e 并发 Invariant 测试 |
| P1-5 | 改份数：两个独立事务串行处理同一个 dirtyDataDate 的 Mark dirty + 洗衣 update delivery_status ⇒ 乐观锁装饰性 | `leader-order.service.ts:242-247`+`:397-414`；`order.service.ts:658-676`+`:744-747` | 倏忽地LOCALIZE | 同一个 provider DataSource 收口；catch—切除术 easy manoeuvre 后 **re-throw 触发上层回滚** |
| P1-6 | `explainSelfCancelBlock` 走 120s TTL 缓存 ⇒ 订单状态变了仍返回旧口径 | `order-state-machine.ts:182-207` | 用户看到过期的不可取消提示 | 大事务成功提交后立刻 `cache.del('self-cancel-avail:' + orderNo)` |
| P1-7 | RedisCluster 全分片故障时 daily menu read 返回**空** ⇒ 用户看成今日无套餐 | `ab-cache.service.ts:53-56,100-104` | 故障时被静默放大 | 读不到时**抛 503**（不懂的背后<arg_value:opensource> |
| P1-8 | 团长协议版本号双轨：v1.0 / v1.1，都写服务端 | `leader-apply.vue:147,257`（v1.0）vs `profile.vue:487`（v1.1） | 新团长签 v1.0 落地，进资料页立刻被提示重签 v1.1；服务端留痕自相矛盾 | 服务端下发或单一常量 |
| P1-9 | **状态机 `canTransit` 生产零调用**（P0-1 的根因） | `order-state-machine.ts:10`、`order-state-audit.ts:11`（注释自认死代码） | 迁移合法性散落各 service 的手写 where，与声明表无机械对账 | 把 `canTransit` 收口，或补**边级对账**门禁（`{X→Y}` 实际写入边 ⊆ 声明边集） |
| P1-10 | `cancel_source` 的 `leader` / `admin` 两来源 e2e **零断言** | 探针 `deep-cancel.mjs` C19/C28 全绿但不在门禁里 | 回归时这两整类在用导出表里凭空消失 | C19/C28 判据搬进 `e2e:m2`/`m3` |
| P1-11 | `dup:const` 在 **0 样本时自证通过并 exit 0** | `116: samples.length===0` 提前 return；注释自认「恒 N/A 与恒绿同罪」却没落实 | 恒绿 = 没有检查 | `files.length===0` 判红（兄弟 `check-icon-lock.mjs:573` 有此判据，照抄即可） |
| P1-12 | `check-nav-consistency.mjs` **从不读 `routes.ts`**（P0-3 的根因） | `check-nav-consistency.mjs:64-69`：输入只有 ROLE/NAV/ICON 文件；`.vue` 只用于校验豁免的 `via` | 「路由有、授权无」永远ience-free | 新增判据：routes 每个业务 path ⊆ (KEYS ∪ NAV ∪ WHITE_LIST ∪ 显式豁免)，**必补双向自证样本** |
| P1-13 | 团长招募按钮文案双轨：三处「推荐新团长」vs 落地页「邀请同事拼饭」 | `share.vue:85` 注释明写原名「既踩发展下线表述红线，又与实际行为不符」；但 `commission.vue:67`、`profile.vue:108`、`workbench.vue:87` **三处未改** | 用户点「推荐新团长」进去看到「邀请同事拼饭」；对外显示的是被判红线那一份 | 三处统一为落地页口径 |
| P1-14 | 客服服务时间硬编码兜底「工作日 9:00 – 18:00」 | `account-cancel.vue:29`（`:22` 的「客服微信号」是**刻意保留**的终态屏，不动） | 违反「端上不写死任何时刻」铁律 | 无值时整行隐藏 |
| P1-15 | 团长端倒计时用**设备时钟** | `workbench.vue:296` `Date.parse(iso) - Date.now()`；对照 `index.vue` 走服务端 `countdownSec` | 同一产品两个时钟源，改系统时间即失准 | 复用 `useCountdown` |
| P1-16 | 订单列表四档计数**裸调**绕过 `useRequest` | `order-list.vue:141-157` 直接 `fetchOrders()`；`onShow:202-205` 与 `reload()` 并发；`request.ts:183-184` 对 401/10002 一律 `clearAuthStorage()` | 登录流程未完成时可能被副请求清掉登录态 | 改走 `run()` 或串行置于 `reload()` 之后 |

---

## 四、P2 —— 清理与技术债（31 条，不展开）

| 类别 | 代表项 |
|---|---|
| 时间源 | `schedule.service.ts:209` vs `:230` 默认时刻源不一致；`order-state-machine.ts:117-137` 模块加载期求值 |
| 重复表述 | 后台三张中文状态表手抄（`order-admin.service.ts:796-809`、`admin-web/src/api/order.ts:287-299`）；六页内联 `money`（已有 `utils/format.ts:fenToCny`） |
| 数据/索引 | `idx_order_refund_status` 与 `idx_order_status` 列完全相同且名字误导（`order.entity.ts:17-18`） |
| 部署 | `deploy.sh:207` 健康提示端口与实际探针不一致；`currentTimeline()` 进程级单例缺少单实例机器校验 |
| 前端清理 | `App.vue:57-59` 空 `onShow` 只有注释；`pages/leader/building.vue:168` 注释称「不做减法」代码却在减；`withdraw.vue:203` 展示 `toFixed(2)` 提交未取整；5 个零消费死常量 + 若干 `export {}` 空壳文件；`profile.vue` 三处提交无闸门 |
| 测试覆盖 | 18 条端点零断言（含 `POST /pay/notify` 免鉴权 + 写资金）；`security:scan` WARN 未转 FAIL（日志打 openid、手机号字面量）；`EXPECT_MIN` 是下限不是基线 ⇒ 3 条断言可静默删除；CI `fetch-depth:1` 使历史密钥扫描退化；SQLite 单连接结构性测不出并发 |

---

## 五、修复批次建议

| 批次 | 内容 | 理由 |
|---|---|---|
| **第一批** | P0-1、P0-2、P0-3 | 资金 / 越权 / 核心功能不可用，任何一条上线即事故 |
| **第二批** | P1-8、P1-13、P1-14、P1-15、P1-16 | 用户可见的错误与双轨，改动小、风险低 |
| **第三批** | P1-9、P1-10、P1-11、P1-12 | **防复发机制** —— 这正是 P0-1 和 P0-3 能藏住的根因；建议与前两批同 wafer |
| 第四批 | P1-4、P1-5、BE-05 | 并发与缓存，需真 MySQL 环境验证（本机 SQLite 测不出）。⚠️ 原列 `P1-4 ~ P1-7`；**P1-6 / P1-7 已于 2026-10-09 核销（回源证实缺陷不存在），不是漏写** —— 见 [第十四节 · 已核销](#十四已核销回源证实缺陷不存在2026-10-09) |
| 第五批 | P2 清理 | 不影响正确性，可排后 |

> ⚠️ 第四批的并发类缺陷**本机结构性不可测**（SQLite `DatabaseSync` 同步单连接，事务串行化，`Promise.all` 全仓仅 1 处且非同资源争用）。
> 要在 CI 加一个 MySQL job 才能真正验证。

---

## 六、已核实为「通过」的领域（不必再投入）

| 领域 | 结论 |
|---|---|
| 时间真源 `order-timeline.ts` | 10 个时刻唯一声明、`cookConfirmDeadline` 刻意不可配、单例代价如实登记 —— **本项目最扎实的部分** |
| 端上不写死时刻 | 全仓 grep 运行时时刻仅命中注释 1 处；`index/order-create/pay-result/order-detail` 全部「取不到即隐藏」 |
| 配置系统 `config.specs.ts` | 5 项 master 配置中 4 项标 `unwired` + 理由，不给假承诺 |
| emoji 铁律 | 154 个前端源码文件按码点精确扫描，**真 emoji 0 处**；唯一瑕疵是后台 `meal/template.vue:179` 提示文案一处 `⭐` |
| 图标纪律 | 82 个图标码位全仓引用 100% 命中真源，0 幽灵图标名；无 `<ab-icon>` 组件调用 |
| `pages.json` | 纯 JSON 零注释；27 个声明页文件全在；27 个跳转目标全已声明，无孤儿路由 |
| 类型层 | `vue-tsc --noEmit` 退出码 0 零诊断 |
| 登录/幂等底座 | `ensureLogin` 并发去重 + 401 重试一次；`10006` 幂等按成功处理；订单与支付两个独立幂等作用域 |
| 金额单位 | 端上元 vs 服务端分，两侧各自内部一致 |
| 分页终止 | 5 处分页均为 `hasMore` 闸门 + `loading` 双保险，无重复追加 |
| 跨端契约 | csMode 三态、cancel_source 四源、订单 11 态、角色枚举三方对齐 |
| 金额/筹资安全 | 6 处抽奖/抽奖/改价/退款/退款/退款 dry-run 审计路径均有 admin/≥finance 角色限制 |

---

## 七、审查过程的元发现

1. **三位专家各自报错了计数，结论却一致** —— 说明该方向判据对误差天然鲁棒（详见 §P0-3）。但反过来，任何新加的判据都应做同样的双向误差测试。
2. **P0-1 与 P0-3 同属「规则写了、但规则不生效」形态**：一个是指不和 anchoring、一个是 CAṂ 不去 tsunai-tei。它们逃过 29 道门禁 + 1602 条 e2e，靠的都是同一件事 —— **检验者看守的资源，与被检验者实际违反的资源，不是同一处**。
3. 已实证：这轮新写的 4 个探针（`deep-cancel` 33/33、`deep-round2` 32/32、`selftest-e2e-zero` 9/9、`selftest-expect-min` 10/10）**质量没问题，问题是它们不在门禁里**。约 65 条真实 HTTP 断言游离在外。

---

## 八、δ 批次修复留痕（2026-10-08 · 提交 `3a6802d`）

> 用户拍板「开始修吧」后执行的第一批。**范围按用户要求排除一切资质/备案/ICP/食品经营许可类。**
> 附录会随着后续批次继续更新；动手前先看这一节，别重复修。

### 已修 ✅

| 原编号 | 修复要点 |
|---|---|
| P0-1 | L9 一键分发：源状态收敛为常量 `CONFIRMABLE_FROM_STATUSES=[delivered]`；`delivering` 不再被顺手推进 `completed`、也不再静默消失（改以 `skippedDeliveringCount` 下发）；计佣入参改**逐单 CAS 收集 `affected=1`**，替代「集合 UPDATE + 二次取数」 |
| P0-1 连带 | `pickupToday.canConfirm` 原写死 `[delivering, delivered]`，与 L9 口径不一致（按钮亮着、点下去却被告知货还在路上）⇒ 改引同一常量 |
| P0-3 | `ADMIN_MENU_KEYS` 补 `/leader/detail`；`check-nav-consistency.mjs` 的 `ADMIN_EXEMPT` 补 drilldown 条目消警。**双向验证**：摘豁免→原话报 `[授权无入口] /leader/detail`；恢复→绿 |
| P1-8 | 抽单一真源 `packages/shared-types/src/constants/leader-agreement.ts`（当前值 + 历史值 + `@IsIn` 白名单），**四处**共引；三处 DTO 追加校验（10001）。**修的过程中又揪出两处**（服务端后台任命、后台 audit 表单），见下方元发现 ② |
| P1-13 | 「推荐新团长」→「邀请同事拼饭」×3（`commission.vue` / `profile.vue` / `workbench.vue`） |
| P1-14 | `account-cancel.vue` 去掉硬编码客服时间，无值整行隐藏 |
| P1-15 | 团长工作台倒计时改用服务端 `countdownSec`；**实现中发现同一个 `useCountdown` 组合式还有第二条缺陷**（`await` 取数期间切走页面 ⇒ 晚到的 `start()` 起表后无人清理，后台永久 1s 空转），护栏下沉到 `use-countdown.ts` 内部，三个调用点零侵入 |
| P2 | 删除后台 `meal/template.vue` 提示文案中唯一真正渲染的 `⭐` |

### 裁定不改 ⛔

| 原编号 | 裁定理由 |
|---|---|
| P0-2 | 回源核实发现：专家报告引用的 `current-user.decorator.ts:31` / `trustLevel` / `jwt.strategy.ts:121` **三处均不成立**（文件不存在 / 字段全仓零命中 / 文件仅 26 行）；且 `user.service.ts:60-68` 证明项目**早已裁决「一期不值当」** ⇒ 降级为已知项，不推翻上一轮裁决 |

### 剩余（下一批再做时从这看）

| 批 | 剩余条目 | 阻塞原因 |
|---|---|---|
| 第四批 | P1-4 / P1-5 / BE-05 · **`P1-6` / `P1-7` 已于 2026-10-09 核销**（回源证实缺陷不存在，**不是漏写**）—— 见 [第十四节 · 已核销](#十四已核销回源证实缺陷不存在2026-10-09) | 并发与缓存类，**本机 SQLite 结构性不可测**，需 CI 加 MySQL job。⚠️ 本表为**当时快照**：P1-5 / BE-05 已于 2026-10-09 收口（真 CAS + `lock:version` 门禁），见第十五节 |
| 第三批 | P1-9 / P1-10 / P1-11 / P1-12 | 防复发机制 —— 正是 P0-1、P0-3 能藏住的根因。P1-11 的「0 样本时自证通过」尤其该先做 |
| 第二批 | **P1-16** | 订单列表四档计数裸调绕过 `useRequest`，未修（本次未及） |
| 第五批 | P2 剩余约 30 条 | 不影响正确性，可排后 |

### 本批的三条元发现（写在 implementations 过程中，值得沉淀）

1. **专家报告的 `文件:行` 也会幻觉** —— P0-2 三处引用全部不成立。⇒ 收录进断言之前必须回源；而回源往往还能发现该结论早已被上轮裁决否掉。
2. **测试脚本会配合缺陷期待它** —— P1-8 的期望值被写死在 e2e 里（`e2e-m2.mjs` 6 处、`e2e-m3.mjs` 3 处，其中 m3 还校验数据库真值）。加了正确校验后它们是「正确地变红」的。⇒ 改被验对象前先看断言认不认这个行为。
3. **改 A 会照亮 B** —— 服务端加上白名单之后，后台 `admin-web/list.vue` 里三份手写默认值**才**变成新破裂点：升版后它会拿过期默认值去请求并被挡回。⇒ 写完一侧要反查「被这次改动夺去容错的是谁」。

### 本批复验结果

- `gate.mjs all` **25/25 全绿**（含 `build:api` / `build:admin` / `build:mp` 三个真构建）
- `gate.mjs verify` **4/4 全绿**：`e2e:m1` **114**/114 · `e2e:m2` **157**/157（基线 152，+5） · `e2e:m3` **1338**/1338（基线 1336，+2）
- 新增 7 条断言均为真实 HTTP + 真实 DTO 校验：未知版本号 `v9.9` 在**三个入口**（申请 / 补签 / 后台 audit）均返回 10001 **且不落库**
- `prettier --check "**/*.{ts,vue,json,md,scss}"` 全绿（**门禁真实口径不含 `.mjs`**）
- 全仓源码侧协议版本号字面量 **0 处**
- ⚠️ 提交后 `git status -sb` = `## main...origin/main [ahead 1]` ⇒ **commit 已落地、尚未 push**（随后已推：`f114e6b..3a6802d → main`）

---

## 九、ε 批次修复留痕（2026-10-08 · 第二批）

> 主题：**让缺陷修完不会悄悄回来**。δ 批修的是「缺陷本身」，ε 批修的是「缺陷为什么能藏住」。

### 已修 ✅

| 原编号 | 修复要点 |
|---|---|
| **P1-16** | 订单列表四档计数（`ALL/paid/completed/cancelled`）用 `Promise.all` 并发裸调 `fetchOrders`，4 条腿**各带旧 token 回来** ⇒ 每条都判「真拒」并清登录态，先回来的那腿把后回来的**刚重登写入的新 token 也清掉**（踩踏式清态，实测 4 次）。修法：`api/request.ts` 新增 `keepAuthState` —— **默认 `false`，只包住清态分支**，不动其余任何逻辑；`api/order.ts` 透传；`order-list.vue:156` 四连调用传 `true` |
| **P1-10** | 取消来源 `cancel_source` 的 `leader` / `admin` 两档在 e2e 里**只比接口回显、从不查库** ⇒ 服务端写错也全绿。补 `readDb` 断言读库真值（m2 +1、m3 +1）。**破坏性实验**：把 `refund.service.ts:232` / `:741` 改成 `null` ⇒ m2 / m3 **各只红那一条**，字节还原后复绿、仓库零残留 |
| **P1-11** | `check-dup-const.mjs` 在**样本为 0 时会「自证通过」** ⇒ 插入两条 `noSample`（文件 0 个 / 单规则 0 样本）⇒ `exit 2`。两种变异均 `EXIT=2`，真实仓库 `EXIT=0` |
| **P1-12** | `check-nav-consistency.mjs` 新增**判据⑦**：后台**路由表** ↔ 菜单 KEY 对账（原先只查「菜单 ↔ 页面文件」，漏掉「登记了路由却没有菜单入口」这一整类）。路由 50 / 业务 46 / **差集 0**；自证两层（判据层 12 例 + 解析层对真实文件断言）；端到端探针：插幽灵路由 `EXIT=1`、删 KEY 留豁免 `EXIT=1` |
| **P1-16 加固** | 新增门禁 **`mp:auth-state`**（`scripts/check-mp-auth-state.mjs`，6.3s，进 `all`）。判据 = 对**当前源码**断言三条不变量：① 真拒（携带的确实是当时最新 token）⇒ **恰好**清态 1 次（防过度修复）；② 4 个计数请求带旧 token、新 token 写入后才回来 ⇒ 0 次清态（本体）；③ 正常路径 5 请求 / 0 重登 / token 不动 / 四档各拿自己 total（防功能回归）。样本为 0 ⇒ 报 `instrumentation broken` 并**非零退出** |
| 附带 | `mine.vue` 顺序约定不变量注释（见「裁定不改」②） |

### 裁定不改 ⛔（附理由，勿重复提）

| 项 | 裁定理由 |
|---|---|
| ① **Tier B 四个页面**（`balance-detail` / `leader/balance-log` / `leader/profile` / `leader/withdraw`） | 同类并发，**但有重试兜底 ⇒ 踩了能自愈**。实测最坏交错：一次 token 过期 ⇒ **2 次完整重登**，中间夹 ~159ms 无 token 窗口。**不给它们标 `keepAuthState`**：那会把余额 / 流水 / 档案这类**主干数据**也排除出 session 裁决，正是该开关头注里要守住的边界；花两条 Authorization 换一次少重登，性价比不好且扩大语义面 |
| ② **`mine.vue` 不改代码，只加注释** | 它今天安全靠的是**顺序约定**（`onShow` 里 `await loadProfile()` 排在裸调之前），不是结构。已加注释钉死：⛔ 改成 `Promise.all` / 去掉 `await` / 在 `loadProfile` 前插裸调 ⇒ 窗口重开、复发 P1-16 |
| ③ **P1-16 原方案 (a)「改走 `useRequest`」被推翻** | 前端实测否决：`use-request.ts:31-33,54` 的 `loading`/`error` 是**单实例共享 ref**，`Promise.all` 里并发调两次 `run()` ⇒ 快腿的 `finally` 把 `loading` 提前置回 false；且 `run()` 抛 `ApiError` 会破坏「计数失败不弹错」 |
| ④ **`--scenario=` CLI 分支删除**（不是保留） | 默认已跑两个场景，而显式 `--scenario=ok` **只跑一个还能拿绿** ⇒ 将来谁图快只跑单场景，会拿到「不完整但全绿」的结论且无人拦。死代码无害，**能骗人的死代码有害** |

### 剩余（下一批从这看）

| 批 | 剩余条目 | 阻塞 / 说明 |
|---|---|---|
| 第三批 | **P1-9**（`canTransit` 生产零调用，正是 P0-1 的根因） | 需新增门禁，单独做 |
| 第四批 | P1-4 / P1-5 / BE-05 · **`P1-6` / `P1-7` 已于 2026-10-09 核销**（回源证实缺陷不存在，**不是漏写**）—— 见 [第十四节 · 已核销](#十四已核销回源证实缺陷不存在2026-10-09) | 并发与缓存类，**本机 SQLite 结构性不可测**，需 CI 加 MySQL job。⚠️ 本表为**当时快照**：P1-5 / BE-05 已于 2026-10-09 收口（真 CAS + `lock:version` 门禁），见第十五节 |
| 第五批 | 10 个「主路径 + 疑似裸调旁路」页面逐条人工复核 | 静态下界已分好 Tier A/B/C，需人读，约 30–40 分钟 |
| P2 | Tier B 降级风险 | ⚠️ 全仓 `retryOnUnauthorized` 只有 `use-request.ts:30` 一处默认 `true`、**无任何调用点传过 `false`** ⇒ Tier B 今天成立；**将来谁给某条腿传 `false`，那一页当场降级成 Tier A（永久掉线）** |
| P2 | 单实例共享 ref 的 loading 闪烁 | `leader/profile` / `leader/withdraw` / `leader/balance-log` 三个页面共用一个 `useRequest` 实例并发 `run()` 两次 ⇒ loading 提前熄灭、两条腿 error 互相覆盖。纯观感，不影响正确性 |

### 本批的三条元发现

1. **「冻结改前源码做对照」的探针不能进门禁** —— 一次性取证成立，进门禁就会烂：哪天有人**正当**改了 `request.ts`，冻结副本不跟着变，门禁就变成拿「虚构的过去」跟「现在」比。这正是恒绿的温床。**正确做法是对当前源码断言不变量。**
2. **多人并发改同一批文件时，门禁结果要挑源码稳定的时刻看** —— 本轮 QA 两次抓到「守卫缺失」的红，都不是判据问题，是前端正在改 `request.ts` 的中间态。
3. **「停手」指令必须先回执** —— QA 与前端**同时写同一个 untracked 文件**，QA 的版本被覆盖且**无 git 历史可回滚**，靠人工合并才救回。已要求：收到停手先回「已停手 + 当前进度 + 有无未落盘产物」。

### 本批复验结果

- `gate.mjs verify` **4/4 全绿**：`e2e:m1` **114**/114 · `e2e:m2` **158**/158（+1）· `e2e:m3` **1339**/1339（+1），`EXIT=0`
- `mp:auth-state` **EXIT=0**；`gate-count` 同步为 `all=26 verify=4`（真源手册 + `docs/` 镜像两处，机械复核「新值在 / 旧值消失 / 全文仅 1 处」）后 `gate:parity` **EXIT=0**
- `gate.mjs all` **26/26 全绿**（含 `build:api` / `build:admin` / `build:mp` 三个真构建）
- 已提交推送：commit **`1d9b581`**（11 文件 +1103/-21），`3a6802d..1d9b581 → main`

### ⚠️ 本批的一次事故：修复差点以「被撤销」的形态推上远端

提交推送之后，我发现 `apps/miniprogram/src/api/request.ts:205` 的 `!keepAuthState &&` 守卫**被删掉且没还原**（23:04:40 落盘），等价于 QA 的必报变异 R1 留在了工作区。运气好：删除发生在提交之后，且我提交前跑的那次 `all` 26/26 跑的是删除**前**的源码，所以推上去的 `1d9b581` 是干净的。已 `git checkout` 还原并复核守卫在位（`:205`）。

**但运气不是机制。** 如果删除早 5 分钟，我会把一个「P1-16 修复被悄悄撤销」的版本推到 origin/main，而当时门禁是绿的 —— 因为**门禁跑的是删除前的源码**。

⇒ 沉淀两条纪律（已写进分册）：
1. **还原必须用 `git diff HEAD --exit-code`，不能只用 `git diff --exit-code`。** 后者是「工作区 vs **索引**」，而 `git checkout -- <file>` 恢复的也是**索引** —— 若污染曾被 `git add`，还原出来的仍是污染版，而这条命令会返回 0 **谎报干净**。两条都要看。
2. **破坏性实验做完，还原的验证必须是内容比对，不是印象。** 这次就是有人以为改回去了。

---

## 十、ζ 批次（第三批 · 进行中）

> 主题延续：**把「能藏住缺陷」的结构补上**。这一批的门禁**首跑即抓出真缺陷**，反证了前两批的方向是对的。

### P1-9：订单状态迁移边级对账 —— 首跑即报出**两处真问题**

新门禁 `order:edges`（`scripts/check-order-edges.mjs`，741 行，进 `all`，约 2 秒）。判据：`ORDER_TRANSITIONS` 笛卡尔展开 = 声明边集；全仓所有真正的订单状态迁移写入点 = 实际边集；**实际 ⊆ 声明**，越界报红并点名 `文件:行`。声明边集由**运行时反射**真模块取得，**绝不抄进脚本**。自带 18 条自证（判据层 / 取真度 / 恒绿反作弊）+ 四个变异针。

**首跑结果（真仓库基准）**：实际边 **34** / 声明边 **19** / 越界 **0** / 声明未覆盖 **15**。

| 编号 | 发现 | 处置 |
|---|---|---|
| **D9-1** | **D11 后台强制退款的 6 条边（`paid`/`cut_off`/`cooked`/`delivering`/`delivered`/`completed` → `refunded`）`ORDER_TRANSITIONS` 从未声明**，而实现从 M2 起一直在写 | **裁定：补进 `ORDER_TRANSITIONS`**，不加豁免 |
| **D9-2** | `refund.service.ts:110` 注释与实现不符 | ⚠️ **曾误记为「已改」，实际未改** —— 我把架构师「**报告**的错误」当成了「**已修**的动作」，回源才发现磁盘上还是原样（本项目那条「回执与印象不可信」的纪律，我自己踩了一次）。补边后该句**近似成立但仍差保留态 `refunding`** ⇒ 已派改：补半句注明刻意排除保留态 |
| **D9-3** | T16 文档说强制退款 → `cancelled`，代码 → `refunded`，两者不一致 | **裁定：以代码为准（`→refunded`）**，文档滞后待修 |
| **D9-4** | `refund.service.ts:628` 回退边目标由 `order_status_before` 动态决定，不在声明表 | 待办（需先确定可能取值） |
（原记有一条 D9-5「`ab_order.sort_code` 三个空档」，经全仓 grep **零命中** ⇒ 系记录时的幻觉，已作废，不作为待办。架构师主动指出「这不是我报的」，拦住了这条。）

**D9-1 裁定「补声明」而非「加豁免」的安全论据**（我逐条核实过，`ORDER_TRANSITIONS` 不只是被零调用的 `canTransit` 读）：

| 消费方 | 补这 6 条边的影响 |
|---|---|
| `canTransit()`（`order-state-machine.ts:78`） | 生产零调用 ⇒ 无影响 |
| `state:audit`（`order-state-audit.ts:74,78,310,413,498`） | `refunded` 早已是声明目标、6 个源状态也早已在表内 ⇒ `DECLARED_STATES`/`DECLARED_TARGETS` **都不新增任何值** ⇒ 无影响 |
| `CONFIRMABLE_FROM_STATUSES`（`leader-order.service.ts:34-35`，P0-1 那个常量） | 补的是 `→refunded` **不含 `COMPLETED`** ⇒ 仍只有 `delivered` ⇒ 不会把 P0-1 重新打开 |
| 单测（`order-state-machine.spec.ts:49-68`） | 三条断言（一步到 `refunded` / 任何 `from` 不含 `refunding` / `pending_pay` 无入边）**全不违反** |

文档侧依据同样充分：状态机文档 §三「`completed` 只能通过退款分支降级为 `refunded`」、§七「强制退款走 D11、跳审批直接执行」、Func-19「任意非终态 → `refunded`（强制退款）」。⇒ **这不是改变契约，是把契约补完整。**

### mine.vue：前端加注释时**挖出一个残余缺陷**（P1-16 同型）

前端在落 `mine.vue` 注释时发现我给他的稿里那句「`loadProfile()` 是**唯一**能触发重登的路径」是**假断言** —— `useRequest` 的 `run()` 被**两条**路径共用（`loadProfile()` 与 `loadSupport()`），而 `onShow` 扇出里 `loadOrderTotal()` 与 `loadSupport()` **两个都不 await ⇒ 并发**。

他用场景 C（会话二次轮转：另一台设备在首屏取数在途时登录）实测：

| 变体 | 陈旧裁决 | 最终 token |
|---|---|---|
| `/orders` 慢 520ms | **4 次** | **空（掉线）** |
| `/orders` 恢复常速（对照） | **3 次** | **空（掉线）** |

第二行是关键：**把慢的那个请求改回常速照样踩 3 次** ⇒ 不是调时序调出来的假象，是结构性的。

**裁定：选 (b) 串行化，不选 (a) 加 `keepAuthState`。** 理由：①(a) 要把 mine.vue 的 **BALANCE（余额，主干数据）** 也纳入豁免，与我们对 Tier B 刚裁定的「主干数据不标」**自相矛盾** —— 同一条口径在两处取相反值，正是本项目反复犯的病；②关键洞察：**会触发重登的只有 `useRequest` 的 `run()` 那两条路径**，裸调自己不会重登 ⇒ 只要把两条 `run()` 路径串行化，后面所有裸调自然拿最新 token，**不需要任何一处豁免**，语义边界一点没扩大。代价只是首屏多一跳串行（`loadSupport` 是客服联系方式，数据量小）。

### 实现中撞到的两条坑（都是「自证自己会腐烂」的类型，值得单列）

1. **自证不能依赖「被验对象非空」** —— 架构师原先把 S2 写成「取豁免表第一条 → 删掉它的写入点 → 必须报过期」。补边后豁免表清空，**S2 自己就红了**。这等于用「自证必须过」**倒逼「豁免表不许空」**，正是豁免腐烂的入口（补边当天就红给他看了）。已改成用**自造探针 key**，不依赖豁免表非空。
2. **自证样本会过期** —— S5e 原本拿 `paid→refunded` 当「非法边」样本，补边后它**变合法了** ⇒ 自证当场失败（拿一条合法边去证明非法边会被报）。已换成 `pending_pay→completed`，并加**样本自检**：样本一旦被声明，明确报「需换一条声明集外的边」，而不是让人误判成判据坏了。

⇒ 合起来是一条通则：**自证也是代码，它会随被验对象一起漂移；自证必须自带「样本失效」的自检，否则它会在某次正当改动后变成假红，然后被人「修」成假绿。**

### 门禁已同步

`order:edges` 已注册进 `gate.mjs`（`GATES` / `ALIASES.all` / `REPORT_RE`），`gate-count` 真源手册与 `docs/` 镜像两处同步为 **`all=27 verify=4`**。实测 `gate:parity` **EXIT=0**：定义 **34** 道 · `all` **27** 道 · `verify` 4 道 · **无孤儿门禁** · 文档标记 1/1 对齐 ⇒ `order:edges` **不需要**进 `CI_EXEMPT`。

---

## 十一、一条来源不明的 P0 指控 —— 已撤销（含我自己的流程错误）

**指控内容**：`keepAuthState` 会让「该清态时不清态」⇒ 用户停留在失效 session 上 ⇒ 页面产出错误数据，**修复后的代码在旧代码能通过的冲击场景下反而更糟**，据此要求回滚方案。

**三方核证后撤销**：

| 核证 | 结果 |
|---|---|
| 产物 | `_mpauth-impact-c.mjs` / `.log` 全目录 `find -iname "*impact*"` **零命中** |
| 作者 | 署名的 QA **不认领**，并自查其报告全文「冲击 / impact / totalClears / 余额不足 / 数据新鲜度」**零命中**，声明未做过该实验 |
| 技术判据 | **不成立** —— 其场景里请求携带 `T2-fresh` 而进程已持有 `T3-after-rotation`，这**正是「陈旧裁决」的定义**；那 4 次 10002 说的是「已被取代的旧 token 不被接受」，对当前 session 没有信息量 ⇒ 不清态是**修复的预期效果**，不是回归。它把旧代码的踩踏式清态（P1-16 的临床表现）误当成了「保守正确」 |

⚠️ **我自己的流程错误**：我在**未确证来源**的情况下，就把它当成 QA 的结论去质问。正确顺序是**先查来源、再判断内容**。已记录，不遮掩。

---

## 十二、真拒实验：判据补第 4 条，`keepAuthState` 保留

**决定性场景**（QA 构造）：让旁路请求携带**当时最新**的 token 却仍被拒（真拒，非陈旧裁决）—— 主路径 40ms 就回 200（成功 ⇒ 不会再触发重登），服务端 200ms 才作废该 token。

| 阶段 | 实测 | 判定 |
|---|---|---|
| 阶段 1（真拒当下） | 主路径 1 次 200 · 旁路真拒 **4 次** · **清态 0 次** | 无人清态 —— 这是 `keepAuthState` 的**设计**，不判红 |
| 阶段 2（下次主请求） | **清态 2 次** · 重登 1 次 · 最终 token 空 | **有人清态** ⇒ 非永久停留 ⇒ **P0 撤销，不回滚** |

**判据④（新增，已收编进 `mp:auth-state`）**：真拒之后，**下一次主请求必须发现并清态**（不许永远没人清）。阶段 1 无人清态不判红；判红的是「阶段 2 仍没人清」。

⭐ **必报 C 的牙齿来自一个事实发现**：`api/request.ts:208` 是全仓请求层**唯一**的 `clearAuthStorage()` 调用点，`useRequest` 只负责重登、**自己不清态** ⇒ **兜底路径只有一条** ⇒ 必报样本就是摘掉它（实测 EXIT=1，带 `__MUT_REQ2` 运行时哨兵证明变异真被执行）。

`mp:auth-state` 耗时 **6.3s → 13.5s**，接受不优化：砍掉阶段 1 会丢掉「真拒 4 次」的样本下限，而样本下限正是这道门禁区别于「恒绿断言」的地方。

### ⭐⭐ `keepAuthState` 的真实代价 —— 已裁定接受

> **死会话会留到用户下一次主请求才被发现**（订单列表页最长 = 用户在该页停留的时长）。
> 用「**延迟发现**」换「**不再误杀**」。

接受理由：
- **误杀**（踩踏式清态）是**每次 token 过期都发生**，表现为「用户正在正常使用时被无故登出」⇒ 明确错误；
- **延迟发现**只在用户停留期间影响旁路计数，而主路径在**切 tab / 下拉刷新 / 重进页面**时就会补上 ⇒ 这些操作高频，窗口短；
- 判据④已**机械地**保证「不会永远没人清」⇒ 这个代价**有下限、有兜底**，不是开口风险。

⇒ 这句话要留给下一个动 `keepAuthState` 的人：**先看见代价，再动手**。

### 探针静默退化的两个形态（QA 构造过程中踩到，值得单列）

1. `revokeAt` 用了 main 的全局 `t0`（前面场景已耗数秒）⇒ 一开局就是 revoked ⇒ 主路径永不成功；
2. 作废判定做在**请求发出时**（88ms）而非**响应到达时**（395ms）⇒ 旁路一路 200 ⇒ 真拒 0 次。

共同点：**场景根本没造出来，而脚本照样报「通过」**。这正是「只验绿、不验红」的另一种表现形式 —— 探针退化时它是**静默**的。已要求把这两条写进 QA 报告的「第五批次」节。

---

## 十三、第四批候选：全仓 26 页按**新判别式**重扫（只报未改）

### 判别式换了（这是本轮的方法论产出）

> **旧**：看页面里有没有「主请求 + 旁路」那个形 ⇒ 漏掉一整类。
> **新**：**看一个页面实际有几个 `run()` 调用点**。因为重登只可能由 `useRequest` 的 `run()` 发起（请求层 `request.ts:160-166` 只是挂 Authorization 头就发，**自己不会去重登**）⇒ **`run()` 调用点数 = 本页重登源数**。

推论：**减少 `run()` 调用点，比给它们排序更根本** —— 这也是 (b′) 优于 (b) 的理论根据。

### 扫描脚本自身会踩的两个坑（已处理，下一个人会再踩）

1. **必须先剥注释再数** —— 前端上一轮的注释里提了 6 次 `run()`，差点把 mine.vue 数成 7 个调用点；
2. **别名实例也算** —— `balance-detail.vue:136` 是 `const { run: runLogs } = useRequest()`，只数 `run(` 字面会把「两个并发 run()」漏成 1 个。

### 同型 7 页（未修）

| 页面 | run() 点 | 形状 | 并发点 | 严重度 |
|---|---|---|---|---|
| `leader/balance-log` | 2 | **run × raw** | `:172 Promise.all([run(fetchLeaderBalance), fetchPage(1)])` | **raw 腿无重试 ⇒ 被踩即永久掉线** |
| `pages/order-cancel` | 2 | **raw × run** | onLoad `:293-294 void subscribe.preload(); void load();` | **同上**（新增） |
| `pages/leader-apply` | 2 | **raw × run** | onLoad `:287-288 void subscribe.preload(); void refresh();` | **同上**（新增） |
| `pages/balance-detail` | 2（`run` + `runLogs` 两个实例） | run × run | onShow `:185-186` 两条 `void` | 自愈，代价 2 次重登 + 159ms 空窗 |
| `leader/profile` | 6 | run × run | `:428-431 Promise.all([run, run])` | 自愈（另 4 个 run 点是用户动作，非并发） |
| `leader/withdraw` | 4 | run × run | `:162-165 Promise.all([run, run])` | 自愈（另 2 个是提现动作） |
| `leader/orders` | 4 | run × run | `:257-261 await fetchPage(1)` 后 `void loadAbnormal(); void loadSummary();` | 自愈（**新增**，旧判别式漏） |

### ⭐ 新增 3 页里最值得留的一条

`order-cancel` / `leader-apply` 的 raw 腿来自 **`use-subscribe-message.ts:72` 的 `fetchSubscribeTemplates()`** —— 它**不住在页面里**。

⇒ **任何「只看页面」的 grep / 只数页面 `run()` 点的口径，都必然漏掉跨 composable 的并发腿。** 这是旧判别式的盲区类型，不只是「少了 3 页」。（全仓只有这 2 处调用 `subscribe.preload()`。）

### 严重度分档的依据（已复核兜底仍活着）

全仓 `retryOnUnauthorized` 只有 `use-request.ts:18/30/39` 三处定义，**调用点传 `false` 的数量 = 0** ⇒

- **`run()` 腿被踩 ⇒ 能自愈**（自带重登重试），代价是重复重登 + 空窗；
- **raw 腿被踩 ⇒ 不能自愈**，且它会去清态 ⇒ **永久掉线**。

### 已闭环 2 页

| 页面 | 处置 |
|---|---|
| `order-list` | `:217-218` —— 已用 `keepAuthState` 修掉，门禁 `mp:auth-state` 守着 |
| `mine` | 第三批按 **(b′)** 改（把 `loadSupport()` 从 `run()` 改成裸调 ⇒ 本页重登源 2 → 1） |

### 不同型 17 页

`leader/pickup` `leader/share` `order-create` `pay-result` `leader/refund` `account-cancel` `leader/building` `leader/commission` `leader/workbench` `index` `order-detail` `building/switch` `leader-invite` `supplier/detail` `supplier/list` `support/contact` `traceability`

其中一类值得单列：**`commission` / `workbench` / `building` 是先 `await` 一个 `run()`、再 `await Promise.allSettled([...raw...])`** —— 批次里全是 raw 且排在 `run()` 之后 ⇒ 拿着新 token ⇒ 不同型。这三页按旧口径很容易被误判。

---

## 十四、已核销（回源证实缺陷不存在，2026-10-09）

> ⚠️ 措辞：以下条目是「**回源证实缺陷不存在**」—— 原报告描述所指向的代码**根本不具备**该失效路径。
> 这**不是**「降级」、不是「暂缓」、也不是「本机测不出所以先放下」。
> ⚠️ 每条证据都附了**可复验的命令与范围** —— 报告正文里的 `文件:行` 会幻觉，反过来我们自己写的核销
> 证据也必须能让后人一条命令跑出来核对，否则核销本身就变成了又一处不可复验的断言。

| # | 报告原说法 | 核销结论 |
|---|---|---|
| **P1-6** | `explainSelfCancelBlock` 走 120s TTL 缓存 ⇒ 订单状态变了仍返回旧口径（`order-state-machine.ts:182-207`；修法要求 `cache.del('self-cancel-avail:' + orderNo)`） | ❌ **缺陷不存在**：该函数是**纯函数**，全仓**不存在**任何 `self-cancel-avail` 缓存键，order 模块**不注入** `KvService` |
| **P1-7** | RedisCluster 全分片故障时 daily menu read 返回**空** ⇒ 用户看成今日无套餐（`ab-cache.service.ts:53-56,100-104`） | ❌ **缺陷不存在**：`ab-cache.service.ts` **文件不存在**；全仓唯一缓存实现的失败路径是**降级到内存**不是返回空；`daily()` **直读 DB 无缓存**，合法「没配套餐」是显式抛 `MEAL_NOT_PUBLISHED` |

### P1-6 核销证据（三条独立，任一即可否证原说法）

| # | 证据 | 命令（在 `abox-onebox/` 下执行） | 实测 |
|---|---|---|---|
| ① | 缓存键 `self-cancel-avail` **全仓 0 命中** | `grep -rn "self-cancel-avail" apps/` | **0 命中**（exit 1）。范围含 `api-server/src` 与 `api-server/test` —— 即「写入方」和「读取方」两侧都没有 |
| ② | `explainSelfCancelBlock` 是**纯函数** | 见 `apps/api-server/src/modules/order/order-state-machine.ts:111-117` | 函数体仅两条 `return`（`isAfterCutoff` → `'cutoff'`；否则 `USER_SELF_CANCEL_ALLOWED.includes(status)` → `'ok'`/`'status'`）⇒ **无 IO、无注入、无缓存、无状态** ⇒ 输入相同则输出必然相同，不存在「返回旧口径」的物理可能 |
| ③ | order 模块**不在 `KvService` 注入方里** | `grep -rn "KvService" --include="*.ts" apps/api-server/src/` | 注入方共 8 处构造器注入（`admin.guard.ts:29`、`idempotent.interceptor.ts:45`、`rate-limit.middleware.ts:197`、`admin-user.service.ts:61`、`auth.service.ts:55`、`message-orchestrator.service.ts:73`、`schedule.service.ts:70`、`app.module.ts:73`）+ 2 处 provider 登记（`common.module.ts:69,83`）—— **无一处落在 `modules/order/`**；补验 `grep -rn "cache\|Cache\|redis\|Redis" apps/api-server/src/modules/order/` 亦 **0 命中** |

⇒ 原修法「大事务成功提交后立刻 `cache.del('self-cancel-avail:' + orderNo)`」**无处可执行**（没有这个键、
没有这个缓存、也没有注入缓存的模块）。**核销。**

### P1-7 核销证据（三条独立）

| # | 证据 | 命令（在 `abox-onebox/` 下执行） | 实测 |
|---|---|---|---|
| ① | `ab-cache.service.ts` **文件不存在** | `find apps -name "ab-cache*"` | **空**（exit 0）。补验字面量 `grep -rn "ab-cache\|abCache\|AbCache" apps/` 亦 **0 命中** ⇒ 原报告引用的 `文件:行` 指向一个不存在的文件 |
| ② | 全仓**唯一**缓存实现的失败路径是**降级到内存**，不是返回空 | 见 `apps/api-server/src/common/cache/kv.service.ts` | `:18-19` 注释明写降级策略；`:46-49` `redis.on('error')` ⇒ 打 WARN 并降级；`:53-55` 初始化失败 ⇒ 打 WARN 并降级；`:60` `degraded` 标记；`:25` `private readonly memory = new Map<...>()` ⇒ **内存实现是真实备胎**，读不到是 cache miss 而非空响应。旁证 `common/queue/queue.types.ts:17-19`：「`KvService` 在 Redis 连不上时自动降级为进程内 Map 并打 WARN」 |
| ③ | `daily()` **直读 DB，根本没有缓存**；合法「没配套餐」是**显式抛错**不是返回空 | 见 `apps/api-server/src/modules/meal/meal.service.ts:73-87` | `:73 daily()` 内直接 `this.assignmentRepo.findOne(...)`（`:81-83`），无 `kv` / 无 `cache` 调用；`:85-87` `if (!assignment) throw new BizException(ErrorCode.MEAL_NOT_PUBLISHED, ...)` ⇒ 没配套餐走的是**显式业务码**，前端可区分「今日无套餐」与「服务故障」，不存在「故障被静默看成无套餐」的通道 |

⇒ 原修法「读不到时抛 503」所针对的失效路径**不存在**：这条读路径既不经过缓存，也不返回空。
**核销。**（另注：`:75-76` 的 `bizConfig.unitPriceFen()` / `cutoffWindowMinutes()` 是配置读取，不是菜单缓存。）

### ⚠️ 两条顺带影响（编号差异已澄清 · §5 批次表已按裁定订正）

1. **编号**：这两条在本报告里的编号是 **P1-6 / P1-7**（见第三节表 `:119-120`），不是 P1-16 / P1-17 —— P1-16 是
   「订单列表四档计数裸调」（`order-list.vue:141-157`），**已闭环**（见第十三节「已闭环 2 页」）；本报告中
   **不存在 P1-17**。本核销节按**证据实际指向的缺陷**取号。
2. **第五节「修复批次建议」第四批**原列 `P1-4 ~ P1-7`。P1-6 / P1-7 核销后，第四批实际只剩
   **`P1-4`、`P1-5`、`BE-05`**（并发类，本机 SQLite 结构性不可测，需 MySQL CI job）。
   ✅ **已按 team-lead 裁定订正**（2026-10-09），并在该行补了指向本节的指针 —— 免得读表的人
   以为 P1-6 / P1-7 是**漏写**而不是**核销**。
3. ⚠️ 同一口径的**另外两处早期批次快照表**（`:216`、`:267`）此前仍是旧的 `P1-4 / P1-5 / P1-6 / P1-7`
   —— 与 `:153` 自相矛盾（读者会在同一份报告里读到「§5 说已核销」和「§X 说还剩」）。
   ✅ **已于 2026-10-09 一并订正**：条目列改为 `P1-4 / P1-5 / BE-05` + 核销指针，**P1-6 / P1-7 两行保留不删**
   （它们是历史留痕，删了就查不到当初这一批定了什么）；并在阻塞原因里加了「本表为当时快照」的标注
   —— 因为 P1-5 / BE-05 已在第十五节收口，再写「不可测」会变成又一处过期事实。

---

## 十五、装饰性乐观锁收口 + 静态门禁（2026-10-09 · 第四批实做留痕）

> 本节记录 **P1-5 / BE-05 的收口实做**（第十三、十四节只做了「判存在 / 不存在」，本节是「改完了什么、
> 用什么证明它不会再回来」）。所有 `文件:行` 均为**改后**行号，改前行号用 `HEAD:` 前缀标注。

### 15.0 前置核查 —— 它决定了改法只有一种形态

| 核查项 | 证据（可复验） | 结论 |
|---|---|---|
| `ab_order.version` 是否可空 | 迁移 `apps/api-server/src/database/migrations/1700000000000-init.ts:243`（该行含 `cancelled_at` ⇒ 确为 `ab_order`）写 `\`version\` INT UNSIGNED NOT NULL DEFAULT 0`；实体 `apps/api-server/src/database/entities/order.entity.ts:156-157` `@Column({ type: 'int', default: 0 }) version!: number`；后续迁移 `grep -rn "version" apps/api-server/src/database/migrations/*.ts` 无一处改这一列 | **列值不可能为 NULL** |
| ⇒ 谓词要不要 `?? 0` 兜底 | —— | **不要**。兜底会把「快照缺失」伪装成 `version = 0` ⇒ 该行**永远更新不了**（静默失败，比丢更新更糟）。不兜底则会当场报错，反而安全 |
| 同一行一次事务能 bump 几次 `version` | —— | **只许一次**。若 `syncFrozenBalance` 在调用方已 CAS 占位后再 bump，调用方那条 `WHERE version = :v` 会失配 ⇒ 永久更新不了。故传入 `m` 时 `versionBump = false` |

### 15.1 A · 4 处装饰性乐观锁 → 真 CAS

| # | 位置（改后 / `HEAD:` 改前） | 改前 | 改后 |
|---|---|---|---|
| A-1 | `refund.service.ts:646-660`（`HEAD:637`） | `.set({…, version: (order.version ?? 0) + 1}).where('id = :id AND status = :from', …)` | `.set({…, version: () => 'version + 1'}).where('id = :id AND status = :from AND version = :v', {…, v: order.version })` —— **双重谓词**：`status` 是业务占位、`version` 是**并发**占位 |
| A-2 | `order-admin.service.ts:379-404`（`HEAD:365`）改份数 | `this.orderRepo.update({ id }, { quantity, totalAmount, payAmount, version: (order.version ?? 0) + 1 })` | `m.createQueryBuilder().update(Order).set({…, version: () => 'version + 1'}).where('id = :id AND version = :v AND status = :st', …)` + `if (!claimed.affected) throw ORDER_CONCURRENT_MODIFIED` |
| A-3 | `order-admin.service.ts:453-472`（`HEAD:405`）改取餐楼 ← 即 **BE-05** | `this.orderRepo.update({ id }, { buildingId, version: (order.version ?? 0) + 1 })` | 同上范式：`WHERE id = :id AND version = :v AND status = :st` + `affected === 0 ⇒ 抛错` |
| A-4 | `order.service.ts:1378-1382`（`HEAD:1350`）<br>`syncFrozenBalance` 的 `balanceUsed` | `{ balanceUsed, version: (order.version ?? 0) + 1 }` | `versionBump ? { balanceUsed, version: () => 'version + 1' } : { balanceUsed }`（见 15.2） |

新增错误码 **`ORDER_CONCURRENT_MODIFIED = 30022`**（`error-code.ts:255`，文案 `:466`）：
刻意**不复用** `30003 ORDER_STATUS_ILLEGAL`（那条说「状态不允许」，本条说「**值过期**」，状态可能仍合法，
排查入口不同），也**不复用** `40018 BALANCE_CONCURRENT_MODIFIED`（那是**余额行**的锁，本仓口径是
「每张单有自己的排查入口」）。

### 15.2 B · 改单的「钱」与「单」进同一个事务

`syncFrozenBalance` 签名改为 `(orderId, newBalanceUsedFen, m?: EntityManager)`（`order.service.ts:1349-1388`）：

- **传 `m`**：复用调用方事务，**不 bump `version`**（行已被调用方 CAS 占位，理由见 15.0）；
- **不传 `m`**：自开事务并自行 bump（保持旧调用方语义不变）；
- `order-admin.service.ts:367-408` 的 `change_quantity` 改为 `this.dataSource.transaction(async (m) => {…})`，
  顺序**刻意**是「先占位订单行、再动钱」—— 占位失败时一分钱都还没动，不存在「钱冻了但单没改成」的中间态。
  改前这两件事分处**两个独立事务**（`syncFrozenBalance` 先提交、调用方再写第二次），中间失败即账实不符。

### 15.3 C · 3 处**刻意保留**旧写法（不改码，只加原地注释）

| 位置 | 字段 | 保留理由（三条，写在代码原地） |
|---|---|---|
| `order.service.ts:1161-1177` | `soldCount` | ① 写的是**重算值**（按当日订单聚合）而非读-改-写，方法幂等；② 单写者（跑批 + 幂等补跑）；③ 改真 CAS 会把回归面扩到备货链路，收益不匹配 |
| `supplier.service.ts:815-828` | `planQuantity`（daily） | ① 写**派生值**（由计划重算），幂等；② 带 `status = DAILY_PENDING` 闸门；③ 单写者 |
| `supplier.service.ts:852-856` | `planQuantity`（detail） | 同上方（同一键名） |

⚠️ 三处注释都写了**失效条件**：「若将来出现**第二个**会动该列的写点，第 ① 条即失效，那时必须改真 CAS」。

### 15.4 D · 静态门禁 `lock:version`

- **脚本**：`scripts/check-optimistic-lock.mjs`（新增）；**注册**：`scripts/gate.mjs` 的 `GATES`（`:337-353` 注释 + `:354` 条目）、`all` 数组（`:564-565`）、`REPORT_RE`（`:590-591`）。
- **判据**：SET 里出现 `version: (X.version ?? 0) + 1` ⇒ 红并点名 `文件:行`。
- ⚠️ **先剥注释再扫**：本仓大量 JSDoc 会**引用**旧写法来讲解它（15.1 表格里就有四处），不剥注释会把每处「讲解」判成违规 —— 那是假阳性，且会逼着后人不敢在注释里引用旧写法。
- ⚠️ **白名单不许悄悄放行**，三条硬约束：① 每条**必须写明理由**（空理由 ⇒ 红）；② 每条**必须真被命中**（未命中 ⇒ 红：要么代码已修好该删白名单、要么键写错了在假装放行）；③ 会被**显式打印**（含理由）。

**双样本实测**（不是「我说是这样」，是跑出来的）：

| 样本 | 注入方式 | 期望 | 实测 |
|---|---|---|---|
| 必报① | 真实源码注入 `apps/api-server/src/__tmp_lock_probe.ts`（装饰性写法 1 处） | 红 | `命中 4 处` + `✘ 装饰性乐观锁（无白名单依据）：__tmp_lock_probe.ts:2 …` ⇒ `通过 4/5`，**exit 1** |
| 必不报② | 删除该探针 | 绿 | `通过 5/5 · 全绿 ✅`，**exit 0** |
| 必不报③ | 只把装饰性写法写进**注释**（`__tmp_lock_comment_probe.ts`） | 绿（证明剥注释生效） | `命中 3 处`（未增加）⇒ `5/5`，**exit 0** |
| 常规 | 当前仓库 | 3 命中全在白名单 | `扫描 250 个源文件 · 命中装饰性写法 3 处` + 白名单 2 条显式打印 ⇒ `5/5`，**exit 0** |

脚本内还常驻 4 条自证（合成样本：装饰性必报 / 正确写法必不报 / 白名单外必报 / 白名单未命中必报），
每次运行都先验自己；扫到 **0 个源文件**会报 `判据空转` 而不是静默通过。

**条数同步**（新增一道门禁必须走完这一步，否则 `gate:parity` 会红）：

- `gate.mjs --json`：`gates` 34 → **35**，`all` 27 → **28**，`verify` 仍 4；
- 《本地开发手册》**工作区根**真源 `ABox一盒本地开发手册v1.0.md:234`：`<!-- gate-count: all=27 verify=4 -->` → **`all=28 verify=4`**；
- 跑 `node scripts/sync-docs.mjs`（43 份同步）⇒ `docs/` 镜像与真源 **sha256 一致**；
- `gate:parity` 变异对拍：标记改回 `all=27` ⇒ **必报**（`✘ … 写的是 all=27 verify=4，实算是 all=28 verify=4`）；改回 `28` ⇒ **绿**（`✔ 门禁清单一致：定义 35 道 · all 28 道 · verify 4 道 … 文档标记 1/1 对齐`）。

### 15.5 命中数对账（回应「是 7 处不是 8 处」）

```bash
cd abox-onebox
grep -rn "version: (.* ?? 0) + 1" apps/api-server/src --include=*.ts          # 当前
git grep -n "version: (.* ?? 0) + 1" HEAD -- 'apps/api-server/src'            # 收口前
```

- **收口前**：9 行命中，其中 `order.service.ts:1229`、`:1514` 是**注释** ⇒ **真实代码 7 处**（不是 8 处 —— 此前误报 8 处会把门禁期望值定错，收口后永远差 1 ⇒ 恒红）。
- **收口后**：7 行命中，其中 `order-admin.service.ts:371,446`、`order.service.ts:1243,1548` 是**注释** ⇒ **真实代码 3 处**，与门禁报告的 3 处**逐条一致**，且全在白名单。

### 15.6 本机环境阻塞与**最终真跑结果**（先说怎么坏的，再说怎么收的）

**① 坏在哪**：本批交付时本机出现 **`node` 创建子进程全局失败** —— 机器级「**无法为子进程创建匿名管道**」：

```
spawnSync(process.execPath, ['-v'])              ⇒ status null  err EBUSY
spawnSync('cmd.exe', ['/c','echo','hi'])         ⇒ status null  err EBUSY
spawnSync('bash',    ['-c','echo hi'])           ⇒ status null  err EBUSY
spawnSync(process.execPath+' -v', {shell:true})  ⇒ status null  err EBUSY
（换 cwd / 多套一层 bash -c / 关沙箱 —— 全部同样 EBUSY）
```

⇒ **`gate.mjs` 一度一道门禁都代跑不了**（它内部全靠 `spawnSync`），输出形态是
`✘ <gate> ✘ exit=null (1ms)` —— ⚠️ 它**看起来是红的、不会假绿**，但**任何把 `exit=null` 当 0 的包装层都会拿到假结论**。

**② 中间态自验（未经 `gate.mjs`，特此标注）**：拿到垫片之前，我用「各工具直接以 `node` 执行、不经 spawn」的方式自验 ——
`tsc --noEmit` / `jest --runInBand` / `eslint` / `prettier --check` / `check-error-code-message.mjs` /
`check-order-edges.mjs` / `check-md-tables.mjs` / `check-optimistic-lock.mjs` 全过；`gate:parity` 用了
判据**逐字不变**的临时离线变体（只把 `loadTruth()` 换成读 `gate.mjs --json` 的输出，用完**已删除**）。

**③ 最终真跑**（QA 提供垫片 `_tmp/gatepipe/pipefix.cjs`：把 `stdio:'pipe'` 透明改写成「临时文件重定向 + 退出后回读」）：

```bash
cd abox-onebox
export NODE_OPTIONS="--require C:/Users/herma/WorkBuddy/ABox小程序/_tmp/gatepipe/pipefix.cjs"
node scripts/gate.mjs lock:version gate:parity errcode:message order:edges \
     state:audit route:audit doc:tables typecheck:api jest lint security:scan format
```

| 门禁 | 真跑结果（`gate.mjs`，**真实退出码**） |
|---|---|
| `lock:version` | ✔ **737ms** · `[自证] 4/4 通过` · `扫描 250 个源文件 · 命中装饰性写法 3 处` |
| `gate:parity` | ✔ **1526ms**（真跑；不再需要离线变体） |
| `errcode:message` | ✔ 412ms · 声明 84 码 / 文案 84 条 · 无幽灵码 |
| `order:edges` | ✔ 2032ms · 自证 11/11 · 实际 14 边 ⊆ 声明 21 边 |
| `state:audit` / `route:audit` / `doc:tables` | ✔ 4593ms / 29838ms / 400ms |
| `typecheck:api` / `jest` | ✔ 10478ms / 16584ms · **7 suites / 51 tests 全过** |
| `lint` / `security:scan` | ✔ 22752ms / 9112ms |
| `format` | ✔ 15959ms |

⇒ **全部真实退出码 0、真实耗时、覆盖面打出来了，没有一条 `exit=null`**。
**15.4 的门禁结论因此从「等价自验」升级为「经 `gate.mjs` 真跑」** —— 上一版我自己记的 blocking 项在此关闭。

**④ 一条我上一版报错了的事，在此更正**（我自己跑出来打自己的脸，记下来免得后人再踩）：

> 上一版我写「`scripts/gate.mjs` 在 HEAD 已有 2 处 prettier 违规 ⇒ `format` 门禁在 HEAD 是红的」。**这条是错的。**
> 单独跑 `prettier --check scripts/gate.mjs` 确实报 2 处（HEAD 既有、非本批引入），但 `format` 门禁的 glob 是
> `"**/*.{ts,vue,json,md,scss}"` —— **不含 `.mjs`**。实测
> `node node_modules/prettier/bin/prettier.cjs --check "**/*.{ts,vue,json,md,scss}"` ⇒ **exit 0 · All matched files use Prettier code style!**

⇒ 所以 `format` 在 HEAD **不是红的**，本批也**没有引入任何格式回归**。

**⑤ 但更正之后剩下一个真的覆盖面缺口**（advisory，**只报未改**）：

`scripts/` 下的 `.mjs` 门禁脚本**两不沾** —— `format` 的 glob 不列 `.mjs`，`lint` 的 `--ext` 只列 `.ts,.vue`。
即：**写门禁的代码本身不受格式与 lint 约束**。与本项目反复治的病同族（「检查覆盖不到的地方必然悄悄错」），
但改 glob 会一次扫进整个 `scripts/`，属于跨批次改动 —— **我只报不改，交 team-lead 裁定**。


### 15.7 未做 / 待放行

| 项 | 状态 | 说明 |
|---|---|---|
| **E** · e2e 并发断言 | ✅ **已做并已跑绿**（但**结论被实测推翻**，见 15.8 ①） | 原裁定「断言必有一路被拒 `30022`」首跑**失败**：实测 `codes=[0,0]` —— 两路**都成功**。已据实改写成「确定性机理探针 + 不丢更新不变量」，见 15.8 ① |
| **P1-4** · 两次 settle 不变量断言 | ✅ **已做并已跑绿**（4/4） | 只补断言不改码；注释已如实标注「SQLite 序列化 ⇒ 证明的是**不变量**，不是竞态触发」，见 15.8 ② |
| 三端 `build:*`（`build:api` / `build:admin` / `build:mp`）+ `mp:no-font` | 本批未跑 | 非静态门禁、耗时长，且本批改动只落在 `apps/api-server/src` 与 `scripts/`，**不触及** admin / mp 与构建产物；留给放行后的整轮 `all` |
| `seed` / `e2e:m1` / `e2e:m2` / `e2e:m3` | ✅ **已跑**（`verify` 首跑 + 改写后复跑，见 15.8 ③） | 不再阻塞 |

> 上一版 15.7 里写的「`state:audit` / `route:audit` / `security:scan` 未重跑」已在 15.6 ③ 中**补齐并全部真跑为绿**，
> 此处不再列为待办。

### 15.8 E / P1-4 落断言 + `verify` 首跑（2026-10-09 · 放行后）

#### ① E · 并发改单 —— **原裁定被实测推翻，已据实改写**

原裁定写的是「`Promise.all` 两路 `POST /admin/orders/manual-adjust` 打同一单，断言**必有一路被拒** `30022`」。
**首跑实测：失败** —— `codes=[0,0]`，两路**都成功了**。

取证（`ab_operation_log`，`request_data LIKE '%并发改单%'`）：**两条 op-log 都在，且都没有 `error` 字段**
（`changed:false` / `before.quantity:3`）。

根因（**不是锁没生效**）：better-sqlite3 是**同步单连接**，两个请求被**整段串行化** ——
B 路是在 A 路写完之后才去读订单的 ⇒ 两路各自拿到的都是**当时的最新 version**，
**压根没产生过期快照** ⇒ 没有可被拦住的对象。
⇒ 「必有一路 30022」在**本机结构性跑不出来**，与 15.6 里那条「SQLite 结构性不可测」是同一件事。

改写后（`scripts/e2e-m3.mjs:2246-2343`，共 **6** 条断言，**全部无条件**，不随结果分支 ⇒ `Y` 稳定）：

| # | 断言 | 位置 | 性质 |
|---|---|---|---|
| E① | 事务内用**过期 version** 直写订单行 ⇒ **0 行受影响** | `e2e-m3.mjs:2294-2298` | **确定性**，这正是 `30022` 得以触发的**机理** |
| E①对照组 | 用**当前 version** 写一次 ⇒ **恰好 1 行** | `:2299-2303` | 没有它，上一条的「0 行」可能只是 SQL 写错 |
| E② | 并发两路返回码**只允许 `0` / `30022`** | `:2324-2328` | 冒第三类码 = 并发路径走了别的分支 |
| E② | **`version` 增量 == 成功路数**（不丢更新） | `:2329-2333` | 真发生「后写者整行覆盖」时是 2 成功 / 只 +1 ⇒ 当场红 |
| E② | 至少一路成功 | `:2334-2338` | 两路都被拒本身即回归 |
| E② | 最终份数 = 目标值 4 | `:2339-2343` | 不丢更新 |

两条探针都在 `BEGIN … ROLLBACK` 里跑 ⇒ **零落库副作用**。
⚠️ **如实标注各自的边界**：E① 证明「谓词真会拦住过期快照」（确定性、每次都跑）；
E② 在本机实测是「2 成功 / +2」，**拦不住装饰性锁** —— 装饰性锁由静态门禁 `lock:version` 兜；
「真 MySQL 下竞态被触发并拦住」仍需 CI 的 MySQL job。
⚠️ 目标值取 **4** 而非 3：前文「电话要求加 1 份」已把本单改成 3，再用 3 是**空操作**（实测 `changed:false`）。

本轮落库证据：`{"orderNo":"AB2026100961865931","quantity":4,"version":4}`，A/B 两路各一条 op-log（均无 `error`）。

#### ② P1-4 · 两次 settle 不变量（只补断言，不改码）

`scripts/e2e-m2.mjs:751-756`（首次入账基线）+ `:768-814`（四条不变量）：

1. `:789-793` 两次 settle 后佣金行仍是 **1 条 `settled`**、`settled_at` 非空
2. `:794-798` 第二次 settle **不改写** `settled_at`
3. `:799-807` `ab_balance_log` 中 `type='commission'` **只 1 条**
4. `:808-814` `ab_balance.total_in` = **1548 分**（不是 2 倍）

四条**全绿**。注释已按第十四节口径如实标注：SQLite 序列化 ⇒ 证明的是**不变量**（重复入账不重复加钱），
**不是**「竞态被触发并拦住」。

#### ③ `verify` 首跑 + 改写后复跑（机器实算值）

首跑 `EXIT=1`（`e2e:m3` 1341/1342，即上面 ① 的失败）；改写后复跑：

```
EXIT=0
✔ seed     9880ms
✔ e2e:m1  24966ms  通过 114/114   · 全绿 ✅
✔ e2e:m2  23644ms  通过 162/162   · 全绿 ✅
✔ e2e:m3  83613ms  通过 1345/1345 · 全绿 ✅
通过 4/4 · 全绿 ✅
```

`grep "exit=null"` ⇒ **0 命中**（整轮无「子进程没跑起来却被记成通过」）。

⚠️ **`Y`（总数）对账 —— 只许上升，不许缩水**：

| 档 | 基线 Y | 本轮 Y | Δ | 来源 |
|---|---|---|---|---|
| m1 | 114 | 114 | 0 | 未动 |
| m2 | 158 | **162** | **+4** | P1-4 四条不变量 |
| m3 | 1339 | **1345** | **+6** | D10-E 六条断言 |

三档 **Y 全部上升或持平，无一处缩水** ⇒ 断言规模没有偷偷变小。

顺带复跑（与本次改动同源的两道）：`lock:version` ✔ 694ms —— `[自证] 4/4 通过`、
`扫描 250 个源文件 · 命中装饰性写法 3 处`（**白名单 2 条**，`supplier.service.ts:planQuantity`
一条键覆盖 daily/detail 两处命中）；`gate:parity` ✔ 1393ms。

### 15.9 P1-4 变异实测（2026-10-09 · 补齐「四条是不是恒绿」这最后一项证据）

15.8 ② 里那句「若改回集读集写，③④ 会当场红」是**推理**。推理不算数，故补做变异实测。

**变异改法**（单点、最小化）：`commission.service.ts` 入账段
`.set({ status: 'settled', settledAt: now })` → `.set({ settledAt: now })`。
⇒ **入账但不占位** —— 佣金行留在 `pending`，第二次跑批又捞到它、又加一次钱，
正是原缺陷描述的「重复加钱」。

**实测**：`node scripts/gate.mjs seed && node scripts/gate.mjs e2e:m2`
⇒ **EXIT=1 · 通过 151/162**，失败清单里**本组四条全部命中**：

```
P1-4 不变量①：两次 settle 后佣金行仍是 1 条 settled、settled_at 非空
P1-4 不变量②：第二次 settle 不改写 settled_at
P1-4 不变量③：佣金入账只留 1 条余额流水
P1-4 不变量④：累计入账 total_in = ¥15.48（不是 2 倍）
```

（外加既有的 M4-2 两段式②×2、M2-③、L11×2、L19×2 等，共 11 条红。）

**两个结论**：
1. 四条**都不是恒绿**。
2. 敏感性比原注释写的**更宽** —— 原以为只有 ③④ 会红，实测 **①②③④ 四条全红**：
   ①红是因为状态没被置 `settled`；②红是因为 `settled_at` 被第二次跑批刷新。
   ⇒ 注释已按实测改写（原推理句已删除），不再留推理冒充证据。

**同条件对照**：未变异时同一条命令 `通过 162/162 · 全绿`，EXIT=0。
**变异已还原**：`git diff apps/api-server/src/modules/finance/commission.service.ts` ⇒ 空。

### 15.10 `verify` 自验终值（2026-10-09）

```
EXIT=0
✔ seed     9883ms
✔ e2e:m1  25652ms  通过 114/114   · 全绿 ✅
✔ e2e:m2  23790ms  通过 162/162   · 全绿 ✅
✔ e2e:m3  85647ms  通过 1346/1346 · 全绿 ✅
通过 4/4 · 全绿 ✅
```

`exit=null` 命中数 **0**。
⚠️ m3 的 **1346** 而非 1345：team-lead 在 15.8 之后又补了 version-0 前置守卫（+1 条断言），**不是回归**。

---

## 十六、同一个数字写死在多处 —— 三轮翻车与正解（2026-10-09 沉淀）

本批同一个病翻了三次车，且三次的**形状完全相同**：**拿一处的值，冒充另一处的口径**。
它每次都能通过「看起来很合理的自查」，故单列沉淀。

### 16.1 三次翻车

| # | 现场 | 错在哪 | 谁抓到的 |
|---|---|---|---|
| ① | `format` 门禁是否红 | 我拿**自己的取数口径**（单独跑 `prettier --check scripts/gate.mjs`）顶替**门禁的取数口径**（glob 只含 `{ts,vue,json,md,scss}`，`.mjs` 不在内）⇒ 报了「HEAD 是红的」，**结论错** | 我自己（第二次栽同一形状时抓到） |
| ①b | 上条的**第二次** | 我把基线 `git show HEAD:` 倒到 `_tmp/`（**仓库外**）⇒ prettier 找不到 `.prettierrc.json` ⇒ **等于用另一套配置在测** ⇒ 得出「HEAD 基线 0 hunk 干净」的**假结论**（真值：`e2e-m2` 45 个违规 hunk、`e2e-m3` 200+） | 我自己 |
| ② | 报告四批表快照 | 我报「`:153`/`:216`/`:267` 三处仍写 P1-4~P1-7」⇒ **`:153` 早已订正**，只有 `:216`/`:267` 是旧的 ⇒ 我报的处数**不准** | team-lead 回源核过 |
| ③ | `EXPECT_MIN` ↔ 自证探针 | 抬 `EXPECT_MIN`（m2 150→162、m3 1335→1345）后，`selftest-expect-min.mjs` 里**写死的样本值**（1335 / 160）落到阈值下方 ⇒ 「必不报」样本**翻成必报** ⇒ **自证自己红了**（EXIT=1 · 9 通过 / 1 失败） | 我补连带损伤时实测抓到 |

### 16.2 ③ 特别值得记：坏消息伪装成另一种坏消息

③ 的坏处不止是「红了」。它红的形态是**「必不报样本报错」**，看起来**像判据坏了** ——
很容易被误读成要去改 `checkMinAssertions`，而**判据一点没坏**。
⇒ 自证的价值就在于「它红 ⇒ 判据有问题」这条推理链；**一旦自证会因为无关原因变红，这条链就断了**，
自证比没有自证更糟（它给人虚假的安全感，并在真正出事那天浪费排查时间）。

### 16.3 正解：**不是同步，是派生**

我第一版修 ③ 是「把 1335 改成 1345」—— 治标。改完 **160 立刻接着红**（160 < 162）。
逐个改数字治不好这个病：只要还有第二处手写值，下次抬阈值照样翻。

⭐ **正解是让其中一处根本没有独立的值**：

```js
const at = (k) => `${EXPECT_MIN[k]}/${EXPECT_MIN[k]}`;
const above = (k, n) => `${EXPECT_MIN[k] + n}/${EXPECT_MIN[k] + n}`;
ok(`m3 刚好 ${at('e2e:m3')} → 不报`, ...);
ok(`m2 上升 ${above('e2e:m2', 8)} → 不报`, ...);
```

**同步**是让两个手写值保持一致（漂移点从一处变两处，且要人记得同步）；
**派生**是让其中一个根本没有独立的值（漂移点归零）。
⇒ 阈值再抬多少次，自证都不会被带红。复跑：EXIT=0，**10/10 全绿**。

### 16.4 三条可执行的判据

1. **数字类断言的样本值，一律从真源派生，不写第二份。** 写死了就是给未来埋一次「自证莫名变红」。
2. **门禁的取数口径 ≠ 我随手跑一条命令的口径。** 判断「某道门禁是否红」只能用门禁自己的命令与 glob；
   单独跑一条等价命令得出的结论，必须先核对 glob / `--ext` / 配置文件**能不能被解析到**（①b 的 `_tmp/` 陷阱）。
3. **涉及「第几处 / 共几处」的陈述，先 `grep -n` 数一遍再写。** ② 就是没数就报。

> 本节三次翻车全部由同一人（后端）制造，其中两次是自己抓到的 —— 记下来不是追责，
> 是因为**这个病每次都长得像「我已经核对过了」**。
