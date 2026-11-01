# ABox 一盒 · 实现全量体检报告 v1.0

> 起因：「经过多次修改后仍出现问题」——故本次不做功能增量，只做**系统性排查**。
> 产出目标：**问题清单 + 根因 + 修复方案 + 防复发机制**，四件齐全。
>
> 体检时点：M5-19 已收口（`gate.mjs all verify` 22/22、`verify-manifest` 315/315、e2e 64/128/1055）。
> 体检范围：`abox-onebox/` 仓库代码 + 工作区根工具链（`tests/`）+ CI/Hook 配置。
> ⚠️ 本报告**只读**产出，未修改任何产品代码。

> ## ✅ 执行状态（2026-09-21 更新 · 勿重复执行）
>
> **α 批 + β 批已全部执行完毕**，执行记录见《ABox一盒开发基线冻结清单 v1.0》**修订 ㊶**。
> 结果：`gate.mjs all verify` **24/24**（先前 22/22 —— 新增两道门禁）· e2e m1 **64** / m2 **128** / m3 **1066**。
> **执行中纠正了本报告 3 处判断**（详见冻结清单 ㊶ 与 `2026-09-21.md` 日志）：
> ① **D4 不成立** —— `汤`（档位轴）与 `汤品`（品类轴）是**两条轴**、不是漂移，**按报告改会把正确表述改坏**；
> ② **E1/E6 范围更大** —— 删 `tests/tools/gate.mjs` 会连带打断《冻结清单》登记与手册教学；
> ③ **D1#1 低估** —— 不是「一处副本」，而是整个 `dish-slot.ts` 是死文件、且 4 处注释引用它。
> ⚠️ **γ 批（A1 `totalFen` 口径 · A2 真机微信相关 · A3 `reversal` 记账语义）仍未做** —— 需需求方裁定或真机环境。
> ⇒ 读到本报告的建议时，**先查冻结清单 ㊶ 是否已执行**，不要照着 §4 再跑一遍。

---

## 0. 方法与证据分级

**方法**：按 6 个域并行审计（资金账务 / 状态机与履约 / 认证授权 / 契约与端上一致性 / 前后端实现 / 测试与门禁基建），
再把每一条**可机械验证**的结论**回到代码原文逐条复核**（读文件、跑 grep、跑脚本），
不复核不采信。

**证据级别**（全文标注，不得混用）：

| 级别 | 含义 |
|---|---|
| 【实证】 | 本次体检**读过代码原文 / 跑过脚本**确认，附文件与行号 |
| 【已登记】 | 项目文档中已显式记录、属**已知**项，本报告只做交叉引用，**不算新发现** |
| 【推断】 | 未逐行复核，仅作候选线索，**禁止直接当结论使用** |

**明确不在本报告范围内的东西**（避免与既有登记重复、避免把「外部条件」误诊为「缺陷」）：
R1–R11 已登记风险 · #79/#80/#81/#82 收口留痕 · 「接口约定未实装 14 端点」 · 多实例 `currentTimeline` 漂移 ·
M5 主线外部阻塞（服务器/域名/HTTPS/微信商户号）· 账号注销入口（提审阻塞线）。

---

## 1. 结论速览

| 编号 | 严重度 | 一句话 | 域 |
|---|---|---|---|
| **A1** | **P2** | 微信退款的 `amount.total` 传的是「订单总额」而非「微信实付额」——**真通道上线即触发** | 资金 |
| **A2** | P3 | 应付出单幂等只写在**软件层**，无 DB 约束；并发/双入口重跑可出重复应付单 | 资金 |
| **A3** | P3【已登记】 | 佣金冲销只扣 `balance`、不动 `total_in/total_out` ⇒ 恒等式破；且该两字段会下发给团长 | 资金 |
| **C1** | **P2** | `admin` 角色**可以创建/提升 `super_admin`**——只守了「降级」没守「升权」 | 安全 |
| **C2** | P3 | `ERROR_MESSAGE` 缺 `30016`/`30017` 两条文案（当前靠调用点自带文案掩盖） | 安全/契约 |
| **D1** | **P2** | 「档位文案」在仓库里有 **3 份物理副本**，其中 1 份**已经悄悄漂移** | 一致性 |
| **D2** | P3 | `miniprogram` 声明依赖 `@abox/shared-utils`，而 `src/` 内引用数 = **0** | 一致性 |
| **D3** | P3 | 小程序首页**内联**写了 `utils/format.ts` 明确禁止的 `new Date('…T00:00:00')` | 一致性 |
| **E1** | **P2** | `tests/tools/gate.mjs` 是**陈旧副本**（12 道 vs 18 道），且自称「复刻 CI 全部作业」⇒ 可产出**假绿** | 基建 |
| **E2** | **P2** | CI 不跑任何 parity/audit/scan 门禁，也不跑 e2e ⇒ 18 道里 10 道**只在本机手动跑** | 基建 |
| **E3** | **P2** | 门禁**成功时吞掉子进程输出** + `jest --passWithNoTests` ⇒ 测试条数不可见，退化到 0 也是绿的 | 基建 |
| **E4** | P3 | 14 个 `.mjs`（**含全部门禁脚本**）不在 eslint / prettier / lint-staged 覆盖内 | 基建 |
| **E5** | P3 | `audit-contract.mjs` 硬编码本机绝对路径 ⇒ 换机器/改目录即失效 | 基建 |
| **E6** | P4 | `tests/tools/gate-result.txt`（42 KB · 9-16）陈旧证据文件与工具并列，会被误读为「最近一次结果」 | 基建 |

> 一句话概括：**本次没有发现新的 P0/P1 功能性缺陷；真正的系统性风险集中在「同一件事多份表述」与「门禁自身的覆盖面/可见性无人审计」这两处 —— 而这正好就是「改了多次还出问题」的机制。**

---

## 2. 详细条目

### A. 资金与账务

#### A1 · 微信退款中的 `amount.total` 用错基数（P2 · 【实证】）

- **位置**：`apps/api-server/src/modules/finance/refund.service.ts:354`（`forceRefund`）、`:512`（`approveByAdmin`）、`:988`（`refundLatePayment`）→ 统一汇入 `attemptWxRefund():776`
- **症状**：`refundFen: payload.wxFen` 取的是 `order.payAmount`（**正确**，= 微信实收）；
  但 `totalFen: payload.totalFen` 三处都传 `toFen(Number(order.totalAmount))`（**订单总额**，含余额抵扣部分）。
- **证据**：`payment.service.ts:52-57` —— 下单时 `createPrepay({ amountFen: prep.payAmountFen })`，
  即**微信侧原订单金额 = `payAmount`**。而微信 V3 `/v3/refund/domestic/refunds` 的
  `amount.total` 语义是「原订单金额」，必须与交易单金额一致。凡订单用过余额抵扣
  （`balanceUsed > 0`），`totalAmount > payAmount`，两者不等 ⇒ 微信侧拒单。
- **根因**：「用户实付额」这件事有两个名字（`payAmount` / `totalAmount − discountAmount`），
  调用点各自挑了一个，**没有任何一处把「微信侧的那笔钱是多少」写成显式命名**。
- **影响面**：一期 mock 通道不校验 ⇒ **本机与 e2e 全绿，测不出来**；真通道上线后，
  **所有使用余额抵扣的订单退款全线失败**（且会走 `markWxRefundFailed` + 队列重试，表现为「一直重试、一直失败」）。
- **修复方案**：
  1. 把 `RefundInput` 的 `totalFen` 注释从「原订单总额（分）」改为
     **「原订单在微信侧的实收金额（分）＝ 下单时的 `payAmount`）」**，并在 provider 接口上写死这条语义；
  2. 三个调用点统一改为传 `toFen(Number(order.payAmount))`（与 `wxFen` 同源，二者应恒等）；
  3. 在 `attemptWxRefund` 入口加一条**自证断言**：`payload.totalFen === payload.wxFen`，
     不成立即 `throw`（这条不变量成立则「原订单全额退」语义清晰，且永远不可能传错基数）。
- **机械防护**：把「`refund()` 的 `totalFen` 只能来自 `payAmount`」写进 `tests/tools/audit-contract.mjs` 式的静态检查
  （扫 `totalFen:` 的实参表达式），或在 `mock-wx-pay.provider` 里**照样校验** `total === refund`，
  让本地也能红 —— 这是把「真通道才暴露的缺陷」提前到本机的最省事办法。
- **建议批次**：随「真微信支付接入」批次一并做，但**必须在联调前**。

#### A2 · 应付出单幂等只写在软件层（P3 · 【实证】）

- **位置**：`apps/api-server/src/modules/finance/supplier-share.service.ts:88-158`（`generate`）
- **症状**：幂等判据是「先 `find()` 出已存在的 `(payee, dish, mealDate)` 集合 → 内存比对 → `save()`」。
  两次并发进入（跑批 `T+1 02:00` 与运营同时点「生成应付」）会**各自读到空集合**，
  各写一行 `normal` ⇒ 同一 `(供应商, 菜品, 出餐日)` **出两张应付单**。
- **证据**：`shareRepo.find(...)` 与 `shareRepo.save(...)` 之间没有任何事务或约束；
  本文件 `:58-59` 注释明写「⚠️ 刻意把该键放在**软件层**而非 DB 唯一索引：本表还要容纳 `type='reversal'` 的负行」。
- **根因**：约束被放到了「不会被数据库强制执行」的那一层。理由（容纳负行）是**成立的**，
  但它推导出的是「需要**部分唯一**索引」，而不是「不需要索引」。
- **影响面**：重复应付单 ⇒ **重复付款**（财务按单转账）。概率低但后果不可逆（钱转出去追不回）。
- **修复方案**（择一）：
  1. **加一列 `normal_uk`**：仅 `type='normal'` 时写 `payeeId:dishId:mealDate`，`reversal` 行写 `NULL`
     ⇒ `UNIQUE(normal_uk)` 生效且**不挡负行**（MySQL/sqlite 的 `NULL` 均不参与唯一性比较）；
  2. 出单放进事务 + `INSERT ... ` 冲突即跳过（保留软件层判据，但由 DB 兜底）。
- **机械防护**：`index:parity` 已能覆盖「实体声明了索引、迁移没建」；本项只需把索引补进实体，门禁自动守住。
- **备注**：这一条与 #76/#79 同族（**声明层与执行层不一致**），但方向相反 —— 这里是「约束只写在代码里」。

#### A3 · 佣金冲销破坏账本恒等式（P3 · 【已登记】+ 新增可见性影响）

- **位置**：`apps/api-server/src/modules/finance/reversal.service.ts:323-328`（settled 分支）
- **事实**：`.set({ balance, version })` —— 只改 `balance`，**不减 `total_in`、不加 `total_out`**。
  于是 `total_in − total_out === balance + frozen` 在「发生过已结算佣金冲销」的账户上**必然不成立**。
- **⚠️ 这是已知项，不是新发现**：`apps/api-server/src/database/seeds/seed-demo.ts:912-924, 1941-1970`
  已**逐字记录**该行为，并把自检结果**明确归类为 `warning` 而非 `failed`**
  （原文：「现状如此（reversal 只扣 balance、不动 total_in/total_out）」）。
- **但有一条**新**的、值得裁定的影响**（本次实证）：
  `total_in` / `total_out` 并非内部字段 —— `common/services/leader-money.service.ts:77-78` 把
  `totalInFen` / `totalOutFen` 作为 `LeaderAccountSnapshot` **下发**（团长余额页 / 后台账户详情）。
  即：**团长会看到「累计入账」比「余额变动」多出被冲销的那一笔**。若产品口径把这两个数当「用户可核对的账」，
  这就是一处**用户可见的账实不符**。
- **修复方案**（需**需求方裁定**，二选一，不可含混）：
  1. **补记账**：冲销时同步 `total_out += 冲销额`（或 `total_in -= 冲销额`），恒等式恢复、下发的两个数自洽；
     代价：历史数据需要一次性回填（可用 `ab_commission.type='reversal'` 反推）。
  2. **改语义并显式声明**：认定 `total_in/total_out` 是「**毛入账/毛出账**（不含冲销）」，
     在 `leader-money.service.ts` 与端上文案里把标签改成「累计入账（未计冲销）」，
     并把 `verify-manifest` 式的自检从 `warning` 提升为**文档化的口径**。
- **备注**：本条的真正教训不是「漏了一行赋值」，而是**「同一件事（账户变动）有两套记账口径，而只有一套被展示给用户」**。

---

### C. 认证授权

#### C1 · `admin` 可创建 / 提升 `super_admin`（P2 · 【实证】）

- **位置**：`modules/admin/admin.controller.ts:42`（类级 `@Roles('super_admin','admin')`）
  → `modules/admin/admin-user/admin-user.service.ts:99`（`role: dto.role`）与 `:148`（`patch.role = dto.role`）
- **症状**：`admin` 角色调用 `POST /admin/accounts` 或 `PUT /admin/accounts/:id`，
  把 `role` 传成 `'super_admin'`，即可**给自己或任意账号提权到超级管理员**。
- **证据**：
  - `dto/admin.dto.ts:79 / :112` 的角色校验是 `@IsIn(ADMIN_ROLES)`，
    而 `common/constants/admin-role.ts:171` `ADMIN_ROLES = Object.keys(ROLE_MENUS)` **包含 `super_admin`**
    ⇒ DTO 层**放行**；
  - `admin-user.service.ts:119-137` 实现了 ①②③ 三条保护，但**全是「不能停用/降级」方向**
    （不能停自己、不能降自己、不能降掉最后一个 super_admin）—— **没有任何一条判「调用者能不能授予 super_admin」**。
- **根因**：**单向箭头只守了一半**。设计者显然意识到 super_admin 需要保护（写了三条），
  但把「保护」理解成了「防止**减少**」，漏掉了「防止**增加**」。同族形态见 D1（只守声明、不守副本）。
- **影响面**：越权链 —— `admin` 是**日常运营角色**（菜单里有账号管理），
  一次误点/一次被钓鱼即可把任意账号变成超管 ⇒ 等同于「运营账号 = 超管账号」，`@Roles` 分级**形同虚设**。
- **修复方案**：
  1. `create()` / `update()` 增加**调用者身份参数**（把 `@CurrentAdmin()` 传进来），
     判据：`dto.role === 'super_admin' && caller.role !== 'super_admin'` ⇒ 抛 `20010 ADMIN_ACCOUNT_PROTECTED`
     （复用现有码，文案「只有超级管理员能授予超级管理员」）；
  2. 同时补一条对称保护：**不能把账号提升为 super_admin 的操作对 `admin` 隐藏**（前端同步，但**服务端为准**）。
- **机械防护**：`route:audit` 现在只检查「有没有写 `@Roles`」，检查不了「**同一控制器内不同动作需要不同角色**」。
  建议扩一条轻量检查：凡 `@Roles(...)` 里同时含 `super_admin` 与 `admin` 的控制器，
  其 service 若存在「写 `role` 字段」的方法，必须在方法签名上带 caller 参数（否则报告待人工确认）。
- **建议批次**：**独立小批，优先做**（改动 < 20 行，无迁移，无兼容问题）。

---

### D. 契约与端上一致性（本项目的历史重灾区）

#### D1 · 「档位文案」在仓库里有 3 份物理副本，其中 1 份已漂移（P2 · 【实证】）

真源：`packages/shared-utils/src/biz.ts:64` `SET_MEAL_SLOT_LABEL = { 1:'主荤', 2:'半荤', 3:'素菜', 4:'汤', 5:'主食' }`

| # | 位置 | 内容 | 状态 |
|---|---|---|---|
| 1 | `packages/shared-types/src/enums/dish-slot.ts:10` `DISH_SLOT_LABEL` | `主菜/素菜/配菜/汤品/主食` | ⚠️ **内容已漂移**，且全仓**零引用**（仅自身 + `dist/`）＝死代码 |
| 2 | `apps/miniprogram/src/utils/format.ts:27` `SLOT_LABEL` | `主荤/半荤/素菜/汤/主食` | 内容一致，但**多了一份物理副本** |
| 3 | `apps/api-server/src/modules/order/order-admin.service.ts:697` `SLOT_LABEL` | `主荤/半荤/素菜/汤/主食` | 内容一致，但**在服务端**再抄一遍（同 app 已有 `meal.dto.ts:47` 再导出真源的先例） |

- **证据**：`grep -rn "主荤"` 全仓结果；`grep -rn "DISH_SLOT_LABEL"` 仅命中定义与 `dist/`。
- **症状分级**：
  - #1 是**真漂移**（`主菜` vs `主荤`、`配菜` vs `半荤`）—— 只要将来有人 import 它，端上立刻出现两套档位名；
  - #2/#3 是**休眠漂移源**—— 今天内容对得上，**改真源时它们不会跟着改，且没有任何门禁会红**。
- **根因**：同一个概念「档位」同时有**两条轴**：数值轴 `slot: 1–5` 与字符串轴 `category: main/half/veg/soup/staple`
  （见 `shared-types/src/enums/supplier-admin.ts:161-174` `DISH_CATEGORY_LABEL`）。
  两条轴各有一套标签，且**轴本身没有被声明为同一件事** ⇒ 副本必然繁殖。
- **修复方案**：
  1. **删** `DISH_SLOT_LABEL`（死代码，直接删除；如怕外部引用，可先标 `@deprecated` 一轮）；
  2. `miniprogram/utils/format.ts` 的 `SLOT_LABEL` 改为从 `@abox/shared-utils` 再导出（依赖已声明）；
  3. `order-admin.service.ts` 的 `SLOT_LABEL` 改为 `import { SET_MEAL_SLOT_LABEL as SLOT_LABEL } from '@abox/shared-utils'`
     （**与 `meal.dto.ts:47` 完全同款**，成本一行）；
  4. 在 `biz.ts` 真源注释里显式写出**「数值轴 ↔ 字符串轴」的对应关系**，让下一个人知道它们是同一件事。
- **机械防护**（关键）：新增门禁 `dup-const`：**禁止真源文件之外出现档位/费率/时刻的语义字面量**。
  实现极简（不含正则陷阱）——扫 `.ts/.vue`，命中形如 `'主荤'`、`'半荤'` 的字符串且在真源文件外出现 ⇒ 报告。
  同理可覆盖费率（`0.08/0.09/0.10/0.12`）与送达时刻（`11:30`）。
  > 这条门禁的价值最高：它把「D1 这一类」从**靠人记得**变成**机器每次拦**。
- **建议批次**：随「设计替换 S 系列」或任一 UI 批次顺手做（改动 ~10 行 + 1 个门禁脚本）。

#### D2 · 声明了依赖却没有使用（P3 · 【实证】）

- **位置**：`apps/miniprogram/package.json` dependencies 含 `"@abox/shared-utils": "workspace:*"`；
  `grep -rn "@abox/shared-utils" apps/miniprogram/src` ⇒ **0 命中**。
- **意义**：这不是「多装了个包」这么轻 —— 它**恰好解释了 D1#2 为什么存在**：
  端上宁可手抄一份 `SLOT_LABEL`，也不用已经装好的共享真源。
  即：**依赖层面的「唯一真相」已经建好了，使用层面的「唯一真相」没有跟上**。
- **修复方案**：随 D1 一并解决（改 import 后 D2 自动消失）。
- **机械防护**：可加一条「声明但未引用」检查（`knip` 或 20 行自研脚本），但优先级低于 `dup-const`。

#### D3 · 小程序首页内联了被明令禁止的日期解析（P3 · 【实证】）

- **位置**：`apps/miniprogram/src/pages/index/index.vue:232-239`
  ```ts
  const dt = new Date(`${raw}T00:00:00`);
  ```
- **对照**：同项目 `apps/miniprogram/src/utils/format.ts:56-68` 已提供 `formatMealDate()`，
  且其注释**逐字写明禁令**：「⚠️ 不用 `new Date('2026-09-16')`：该写法按 UTC 解析…**此处手动解析，杜绝时区歧义**」。
  首页却内联重写了一遍，并**正好用了被禁的那种写法**。
- **当前影响**：在东八区（`'YYYY-MM-DDT00:00:00'` 按 ES2016+ 视为**本地时间**）结果正确 ⇒ **暂无可见 bug**。
  风险在于：① 引擎实现差异（旧 WebView/JSCore 有按 UTC 解析的历史行为）；② 与 `formatMealDate` **格式耦合**——
  两份实现在「格式化 + 缺省兜底」上已经不同（内联版返回 `raw`，`formatMealDate` 返回 `mealDate`），
  将来任一处改动会**单边生效**。
- **修复方案**：首页 `mealDateCn` 直接用 `formatMealDate(daily.value.mealDate)`，删除内联实现（净减 ~6 行）。
- **机械防护**：`dup-const` 门禁的姊妹条 —— 禁止 `.vue` 内出现 `new Date(\`` + `T00:00:00` 组合字面量。
- **建议批次**：随手做（1 分钟）。

#### D4 · UI 文案「汤 / 汤品」漂移（P4 · 【实证】）

- **位置**：`apps/admin-web/src/views/supplier/dish-library.vue:3`（标题写 `汤品`）·
  `apps/miniprogram/src/components/ab-supplier-card/index.vue:70`（注释写 `汤品`）·
  `traceability.vue:198`（注释写 `汤品`）vs 真源 `'汤'`。
- **性质**：纯展示层硬编码文案，不影响逻辑；但**同一道菜在后台叫「汤品」、在配置页叫「汤」**，
  对人工测试人是实打实的困惑源。
- **修复方案**：随 D1 的 `dup-const` 门禁一并覆盖（把 `'汤品'` 列入禁词）。

---

### E. 测试与门禁基建 —— **「为什么改了多次还有问题」的直接答案**

> 这一节是本报告的重点。前面 A–D 加起来共 9 条，而 E 节说明的是**为什么前 9 条能长期存在而无人发现**。

#### E1 · `tests/tools/gate.mjs` 是陈旧副本，可产出**假绿**（P2 · 【实证】）

- **位置**：`tests/tools/gate.mjs`（7,126 B · 9-16）vs `abox-onebox/scripts/gate.mjs`（23,439 B · 现行）
- **症状**：旧副本自称「逐条复刻 CI 的**全部作业**」，输出「门禁汇总：通过 **12** / 失败 0」，
  但其 `STEPS` **完全不含** M5 期新增的 7 道门禁：
  `schema:parity` · `index:parity` · `state:audit` · `route:audit` · `security:scan` · `nav:consistency` · `doc:tables`。
- **证据**：`grep -n "schema:parity|index:parity|..." tests/tools/gate.mjs` ⇒ **0 命中**；两份文件 sha256 不同。
- **影响面**：**外部测试方 / 下一轮的我**若运行这份工具，会得到一份**「全绿」的验收结论**，
  而它实际只覆盖了 12/18 道（且**恰好漏掉的都是「声明 ↔ 实现」对账类**，即最容易悄悄错的那一类）。
  这正是本项目已多次记录的形态：**「同一件事多份表述，而不被自动化执行的那一份必然是错的」** ——
  只不过这次错的是一份**验收工具**。
- **修复方案**：
  1. **删除** `tests/tools/gate.mjs`（应只有一个 gate 运行器）；
  2. 若确需在工作区根运行，改为一行**转发**：`node abox-onebox/scripts/gate.mjs "$@"`（不复制逻辑）。
- **机械防护**：`tests/tools/README.md` 里登记「本目录不允许出现 gate 运行器的第二份实现」。
- **建议批次**：**立刻做**（删除一个文件）。

#### E2 · CI 与本地门禁严重不对等（P2 · 【实证】）

- **位置**：`.github/workflows/ci.yml`（仅 4 个 job：Lint&Format / Typecheck / Unit Test / Build）
- **症状**：`gate.mjs all` 的 18 道里，**只有 8 道**进了 CI；以下 **10 道每次提交都只在本机手动跑、且靠人记得**：
  `shared:types` · `shared:utils` · `schema:parity` · `index:parity` · `state:audit` · `route:audit` ·
  `security:scan` · `nav:consistency` · `doc:tables` · `verify`（seed + e2e×3 全部 4 道）。
- **根因**：CI 是按「通用 Node 项目模板」写的，**门禁是按项目特有风险长出来的**；
  两边的清单**从未对账**。于是「门禁强了」这件事在 CI 上**完全不可见**。
- **修复方案**：CI 增加一个 job：`node abox-onebox/scripts/gate.mjs all`（把 18 道一把跑掉），
  e2e 单独一个 job 跑 `gate.mjs verify`。这样**门禁清单**成为唯一真相，CI 不再维护第二份。
- **备注**：这也解释了 E1 —— 有人需要一份「在 CI 里跑全部门禁」的东西，
  才会去写 `tests/tools/gate.mjs`；正确解法是让 CI 直接调用仓库内那唯一一份。

#### E3 · 门禁「成功即静默」+ `--passWithNoTests` ⇒ 覆盖面不可见（P2 · 【实证】）

- **位置**：`scripts/gate.mjs:374-388`
  ```js
  const stdout = (r.stdout ?? '').trim();
  ...
  return { name, ok, code: r.status ?? -1, ms, out: ok ? stdout : '' };   // ← 成功时输出被丢弃
  ```
- **症状**：跑完 `gate.mjs all` 只看到 `✔ jest (4310ms)`。**jest 到底跑了几条测试？不知道。**
  而 `apps/api-server/package.json` 的 `test` 脚本带 `--passWithNoTests`
  ⇒ 若某天 5 个 spec 文件被重命名/误删，**门禁依旧全绿**，且输出里没有任何线索。
- **当前真实状态**（本次实测，供基线使用）：`apps/api-server/test/unit/` 下 **5 个 spec**
  （`idempotent` · `order-no` · `order-state-machine` · `order-timeline` · `time-anchor`），
  `jest` 配置在 `apps/api-server/package.json` 的 `jest` 键内（`testRegex: "(src|test)/.*\\.spec\\.ts$"`），
  cwd = `apps/api-server` ⇒ **确实在跑，不是空转**。风险是**它退化时没人会知道**。
- **修复方案**：
  1. `gate.mjs` 汇总行打印每个门禁的**关键计数**（jest: `Tests: N passed`；e2e: 断言数；
     `doc:tables`: 扫描 N 份；`nav:consistency`: 检查 N 项）——
     实现方式：`run()` 保留 stdout，用一条**每门禁自带的正则**抽取计数并打印；
  2. 把 `--passWithNoTests` 从 **门禁路径**移除（保留在纯开发者 `pnpm test` 里），
     让「0 测试」在门禁上**必定为红**。
- **这条的元价值**：它是 E1/E3 的共同病根 ——**门禁只报「过/不过」，不报「查了什么、查了多少」**，
  于是门禁自身的退化**不在任何失败路径上**。

#### E4 · `.mjs` 不在任何静态检查覆盖内（P3 · 【实证】）

- **位置**：`scripts/gate.mjs:76` `eslint . --ext .ts,.vue` · `:77` `prettier --check "**/*.{ts,vue,json,md,scss}"` ·
  `lint-staged.config.cjs`（仅 `*.{ts,vue}` 与 `*.{json,md,scss,css}`）
- **事实**：仓库内 `scripts/*.mjs` 共 **10 个**（含 `gate.mjs` / `check-md-tables.mjs` / `check-nav-consistency.mjs` /
  `sync-docs.mjs` / 三个 e2e / `local-test.mjs` / `make-qr.mjs` / `setup-husky.mjs`），
  工作区根 `tests/` 另有 `.mjs` ⇒ 合计 14 个，**全部逃过 eslint、prettier 与 pre-commit 钩子**。
- **缓解事实**（如实记录，避免高估风险）：这些是**门禁脚本**，语法错误 → `exit≠0` → **门禁变红（响亮）**，
  不会静默。真正的问题是：**做门禁的人自己被 lint 排除在外**，与「门禁自证」的文化不匹配。
- **修复方案**：`--ext .ts,.vue,.mjs`；prettier glob 加 `.mjs`；`lint-staged` 加 `*.mjs` 条目。
  注意：加 `.mjs` 后**存量 14 个文件会出现一批格式差异**，需先跑一次 `prettier --write` 再提交（否则门禁自红）。

#### E5 · `audit-contract.mjs` 硬编码本机绝对路径（P3 · 【实证】）

- **位置**：`tests/tools/audit-contract.mjs:21-25`
  ```js
  const REPO = 'C:/Users/herma/WorkBuddy/ABox小程序/abox-onebox';
  const SPEC_FILE = process.env.ABOX_SPEC ?? 'C:/Users/herma/WorkBuddy/ABox小程序/ABox一盒接口规范v1.0.md';
  ```
- **症状**：换机器 / 改目录名 / 解压到别处 ⇒ 工具直接失效（好在是响亮失败）。
  与同一目录下 `verify-manifest.mjs`（用 `fileURLToPath` 相对定位）**风格不一致**。
- **修复方案**：改为 `resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')` 相对定位；
  规范文件默认值同样相对化，仍允许 `ABOX_SPEC` 覆盖。
- **备注**：这条与「自包含交付包」纪律直接相关 —— 交给外部方的工具**不允许**含本机绝对路径。

#### E6 · 陈旧证据文件与工具并列（P4 · 【实证】）

- **位置**：`tests/tools/gate-result.txt`（42,350 B · 9-16）、`tests/tools/README.md`（8,465 B · 9-20）
- **症状**：`gate-result.txt` 是一份 9-16 的旧跑批日志，静静躺在工具目录里。
  收件方（外测/交接）**很容易把它当成本轮结论**（文件名毫无时点提示）。
- **修复方案**：删除或改名带时点（`gate-result-20260916.txt`）；或在 README 首行写「本目录不保留跑批产物」。

---

## 3. 已核对、确认**无问题**（防止「过度修复」）

| 项 | 核对方式 | 结论 |
|---|---|---|
| `doc:tables` 只扫 `docs/`、不扫工作区根 | 读 `check-md-tables.mjs:35-46,193` + `sync-docs.mjs:56-61` | **不是缺陷**。根契约文档 → `docs/` 由 `sync-docs.mjs` 保证字节一致，`verify-manifest.mjs` 复核；漏跑 sync 会**响亮地**红在 `verify-manifest` 上 |
| mock 支付调试端点（免鉴权） | `payment.service.ts:122-129` | 已 fail-closed（非 mock 抛 `10004`），M5-3 已收口 |
| 退款并发 / 余额乐观锁 / 余额账户缺失 | `refund.service.ts:687-705`（原子占位）· `reversal.service.ts:128-139,323-334` · `:115-119` | 三点均已 fail-closed，`affected` 判据可信（#77/#80/#81/#82 收口成果，**勿回改**） |
| 佣金冲销的两段式分支（`pending` vs `settled`） | `reversal.service.ts:199-276` | 白名单写法正确（注释已论证「其余一律按 settled」的陷阱） |
| `reversal.service` **不冲减**供应商应付 | `reversal.service.ts:67-70` + `supplier-share.service.ts:41-43` | 自营口径裁定一致，两端表述**同源**（这是本项目做对了的正面样例） |
| 时间轴单一真相 | `order-timeline.ts` 全文 + `state:audit` 门禁 | #49 已根治；`DEFAULT_TIMELINE.arrival` 为唯一真源 |
| `refundableYuan` 口径 | `refund.service.ts:1069-1071` | 「用户实付 = total − discount」，与 `payAmount + balanceUsed` 一期恒等（`discountAmount` 恒 0），**无问题** |

---

## 4. 横向根因（回答「怎样才能不再犯」）

把 14 条压到根上，只有**三条机制**：

### 根因一：**同一件事有多份表述，而约束只写在「不被执行」的那一份**
历史实例（本项目已登记）：`11:30` 出现 13 处 · 等级→费率两源 · `login` 路径 · `mine.level` ·
演示单号前缀 · `NOTIFY_PAGES` vs `pages.json` · 菜单三方不一致 · #79 状态机声明 vs 生产写入点。
**本次新增**：D1（档位文案 3 份）· D2（依赖声明了却手抄）· E2（CI 清单 vs 门禁清单）· E1（gate 运行器 2 份）。

### 根因二：**门禁只报「过/不过」，不报「查了什么、查了多少」**
于是**门禁自身的退化不在任何失败路径上**：删掉测试文件仍绿（E3）、旧运行器少跑 7 道仍绿（E1）、
CI 少跑 10 道无人知（E2）。这与根因一同源：门禁的**覆盖面**是「一件事」，它也只有**手动维护的一份表述**。

### 根因三：**单向箭头只守一半**
- C1：守了「不能降级 super_admin」，没守「不能升级为 super_admin」；
- A3：守了「余额不能凭空多」，没守「累计入账是否会与余额背离」；
- D1#1：守了「真源要写对」，没守「副本不能存在」。

### 三条对策（都可机械执行，不必依赖人）

| 对策 | 落地形式 | 覆盖 | 工作量 |
|---|---|---|---|
| **① 新增 `dup-const` 门禁** | 扫 `.ts/.vue/.mjs`，真源文件外出现 `'主荤'`/`'半荤'`/`'汤品'`/`11:30`/`25.80`/费率字面量 ⇒ 红 | D1·D3·D4 及**全部未来副本** | 半天（含自证） |
| **② 门禁自报覆盖面** | `gate.mjs` 汇总行打印每道门禁的**关键计数**；移除门禁路径上的 `--passWithNoTests` | E3，并让 E1/E2 的缺项**可见** | 2 小时 |
| **③ CI 直接调用唯一 gate 运行器** | `ci.yml` 增加 `gate.mjs all` + `gate.mjs verify` 两个 job；删 `tests/tools/gate.mjs` | E1·E2 | 1 小时 |

> 这三条做完，「同一件事多份表述」类缺陷会在**提交时**被机械拦下，
> 而不是等人工测试或外部专家团发现 —— 这是本报告对「尽量避免后续再出现类似问题」的正面回答。

---

## 5. 建议的修复批次

**批次 α（立刻，合计 < 1 小时，零风险）**
1. C1 提权闸门（~20 行 + caller 参数）—— 唯一一条**安全类**，优先
2. E1 删除 `tests/tools/gate.mjs`（+ E6 删除/改名 `gate-result.txt`）
3. D1 三处副本改 import 真源 + 删死代码 `DISH_SLOT_LABEL`
4. D3 首页改用 `formatMealDate`

**批次 β（半天）**
5. 对策 ① `dup-const` 门禁（含自证：构造必报/必不报样本）
6. 对策 ② 门禁自报覆盖面 + 去掉 `--passWithNoTests`
7. 对策 ③ CI 接入 `gate.mjs all` / `verify`
8. C2 补 `ERROR_MESSAGE` 的 30016/30017
9. E4 `.mjs` 纳入 eslint/prettier/lint-staged（先 `--write` 一轮）
10. E5 `audit-contract.mjs` 路径相对化

**批次 γ（需裁定 / 需真环境）**
11. A1 `totalFen` 基数修正 + `mock-wx-pay` 同款校验 —— **必须在真微信联调前**；本机验证手段：mock 校验
12. A3 账本口径裁定（补记账 or 改语义）—— **需求方决策**
13. A2 应付单部分唯一索引（实体 + 迁移）—— 依 §2/A2 择一
14. #80/#81 真机 MySQL 复现（已登记，仍需真环境）

**收尾纪律（不可省）**：每批完成后
`node scripts/gate.mjs all` → `node scripts/gate.mjs verify`（**单跑先 `seed`**）→
改契约文档则重跑 `sync-docs.mjs` + `baseline_manifest.py` + `verify-manifest` →
**字节级复核**（不要用 `diff -q`，用字节数/sha256）。

---

## 6. 附录 · 本轮**未能验证**的候选（【推断】，禁止当结论）

以下由分域审计提出、我**未逐行复核**，仅登记供后续排查，**不得据此动代码**：

- 资金域：`withdraw` 系列在「批准 → 到账」两步之间的 `frozen` 释放是否所有分支都覆盖；
  `invoice` 三态的金额勾稽是否与 `ab_supplier_share` 对账。
- 履约域：`order.service.cancel`（截单前自助取消）与 `forceRefund`（D11，允许对 `paid` 单强制退）
  两条路径在同一 `paid` 订单上并发时的互斥性 —— **需读 `order.service.ts` 的 `cancel` 全段**。
- 安全域：`security:scan` 已扫日志脱敏，但未复核「操作日志 `snapshot` 是否含手机号全量」。
- 端上域：`admin-web` 是否存在与 `constants/index.ts` 并行的第二份口径常量（未全量扫视图层）。
- 基建域：`install-cron.sh` / `ops-daily.sh` 等运维脚本从未真机执行（**已登记 R11**），本报告不重复。

> 处理原则：本附录的条目若要转正，**必须**先完成与第 2 节同级别的代码复核，补上「位置 + 证据」两栏。

---

## 7. 一句话总结

> 本次体检**没有发现新的 P0/P1 功能缺陷**；19 道既有门禁确实守住了它们该守的东西。
> 但发现 **1 条 P2 资金口径缺陷（真通道触发）**、**1 条 P2 越权缺陷**、**1 条 P2 一致性缺陷**、
> **3 条 P2 基建缺陷** —— 其中**基建那 3 条（E1/E2/E3）是「改了多次仍出问题」的机制性原因**：
> 门禁只覆盖了 12/18 道、CI 只看 8/18 道、且门的覆盖面与测试条数**从不被打印**。
> 修复建议按 §5 的 α/β/γ 三批推进；**α 批（4 项，< 1 小时）建议立即执行**。
