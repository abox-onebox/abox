# T3 · 契约与文档一致性对账（09-23 ~ 09-25 未提交改动）

- **执行人**：gstack-product-reviewer（产品官）
- **范围**：`abox-onebox` HEAD `92b3df3` 之上 47 个未提交文件；重点为 4 份文档改动（接口规范 +140 / 基线冻结清单 +260−242 / 里程碑计划 +30−6 / 提审自检清单 +1−1）
- **方式**：只读。未修改任何文档、未 commit。所有结论附 `文件:行` 证据与**可证伪的反例条件**。
- **真源判据（本次不重新裁决）**：U19 / U20 / D67 / D68 / D69 · 迁移四支 · 表数 27 → 28 · 后台 8 组 / 34 入口 · 服务端授权 key 40 个
- **已登记项不重复报**：先查过《已知项与预期行为清单 v1.0》(K01–K56 + R1–R11) 与《悬而未决登记册》；命中的在文末「已登记/不算新发现」段落列出

---

## 〇、结论速览（按严重度）

| # | 严重度 | 一句话 | 关键证据 |
|---|--------|--------|----------|
| 1 | 🔴 P1 | 账号注销：**提审清单已同步 ✅，但《合规资质与协议清单》仍写 ❌ 待开发** —— 两份合规文档对同一事实给出相反结论 | `...提审自检清单v1.2.md:279` ✅ ↔ `ABox一盒合规资质与协议清单v1.0.md:225 / :101` ❌ |
| 2 | 🟠 P2 | 接口规范 §6.7 内部自相矛盾：§39 一处写 **25 条**、一处写 **26 条** | `ABox一盒接口规范v1.0.md:1515` vs `:1547`；实测 `e2e-m3.mjs:13580-13910` = 26 |
| 3 | 🟠 P2 | 契约↔代码机械对账对 **U19 / U20 / D69** 三行失配（加粗编号 + 加粗路径），保护失效但工具仍 exit 0 | `tests/tools/audit-contract.mjs:110` 正则 + `norm()`（`:95`） |
| 4 | 🟠 P2 | 基线冻结清单**漏登记 `rating.module.ts`**（本批 17 个新文件里唯一一个），且无任何门禁会发现 | `git status -uall` 17 项 vs `...基线冻结清单v1.0.md:345-352` 8 项；`verify-manifest.mjs:84-88` 覆盖性只扫根 + archive |
| 5 | 🟠 P2 | 表数口径：代码真源 28 张，ER / 部署手册仍写 27 张，ER 全文**无** `ab_dish_rating`；ER 自承诺「与 ALL_ENTITIES 逐张对齐」已被打破 | `entities/index.ts:13,63` = 28 ↔ `ABox一盒数据库ER设计v2.1.md:60,958,964` = 27 |
| 6 | 🟡 P3 | 迁移支数：实际四支，`项目目录结构 v2.0` 仍写「三支」且树里只列到第 3 支 | `migrations/` 4 个文件 ↔ `ABox一盒项目目录结构v2.0.md:385-388` |
| 7 | 🟡 P3 | 端点总数：规范硬编码「31 controller → 141 端点」，实测 **34 / 146** | `ABox一盒接口规范v1.0.md:221,223`、`tests/tools/README.md:56` |
| 8 | 🟢 观察 | 同天两批（F5 / U2）的文档行序与文件时间戳相反，致「F5 … 表数仍 27」易被误读 | `接口规范:33-34` vs 文件 mtime 00:56–01:48 / 12:09–12:33 |

---

## 一、契约 ↔ 代码（问题 1）

### 1.1 通过项（逐条已核）

| 契约条目 | 文档落点 | 代码落点 | 结论 |
|---|---|---|---|
| U19 `POST /me/cancel` | 接口规范 `:429`、`:466` | `user.controller.ts:151,173` → `user.service.ts:cancelAccount` | ✅ 路径 / 方法 / 入参 `{confirmText, reason?}` / 出参 `{canceledAt,status,clearedFields,note}` 全对 |
| U19 二次确认词由服务端裁定 | 接口规范 `:471` | `user-cancel.dto.ts:20` `ACCOUNT_CANCEL_CONFIRM_TEXT='注销账号'` + `user.service.ts` 首段校验 | ✅ 两端各写一份、不等即 `10001`（可见失败，非静默） |
| U19 三闸门 → `20015` 带 `reasons[]` + `pendingOrders` | 接口规范 `:473`、`:1857` | `user.service.ts` 闸门①②③ + `BizException(..., {reasons, pendingOrders})`；`error-code.ts:ACCOUNT_CANCEL_BLOCKED=20015` | ✅ 三道全查一遍再报 |
| U19 原子占位（非读-再写） | 接口规范 `:475` | `user.service.ts` `update({id, status: Not(CANCELED)})` + `affected=0` → `20014` | ✅ |
| U19 再登录 `20014` 且排在黑名单 `20006` 之前 | 接口规范 `:469`、`:1856` | `auth.service.ts` diff：`else if (user.status === UserStatus.CANCELED)` 先于 `UserStatus.BLACKLIST` | ✅ 顺序与文案都对 |
| U20 `POST /orders/{orderNo}/rating` | 接口规范 `:430`、`:1410-1440` | `rating.controller.ts:64` → `rating.service.ts:submit` | ✅ 逐菜三键 / 一次定稿 / 菜属校验 `10001` / 快照 `dishName,supplierName,slot` / reason trim / 整批单事务 |
| U20 状态闸门 `30020` 回带 `status`+`allowed` | 接口规范 `:1877` | `rating.service.ts:187-192`；`error-code.ts:RATING_NOT_ALLOWED=30020` | ✅ |
| U20 已评 `30021` 回带 `ratedAt` | 接口规范 `:1878` | `rating.service.ts:196-203`；`RATING_ALREADY_SUBMITTED=30021` | ✅ 刻意不复用 `10006`（语义相反） |
| U10 补 `dishes[].dishId` + 内嵌 `rating{canRate,rated,ratedAt,items}` | 接口规范 `:1428` | `order.service.ts:410` `dishId` + `:418` `ratingService.orderRatingView()`；`shared-types/dto/order.dto.ts` 新增 `OrderRatingView` | ✅ `canRate = 未评 ∧ 状态可评 ∧ 有菜` |
| D69 `GET /admin/stats/dish-rating` | 接口规范 `:1369`、`:1410-1440` | `rating-admin.controller.ts:25` → `rating.service.ts:dishRating` | ✅ `redLineThreshold` 下发 / `worstThree` / `recentReasons` 3 条 id 降序 / 黑榜序 / `badCount` vs `monthBadCount` 分道 / 区间切 `meal_date` |
| D69 聚合为纯函数（可单测） | 接口规范 `:1440` | `rating.service.ts:65` 导出 `aggregateDishRatings()`；`test/unit/dish-rating-agg.spec.ts` 已建 | ✅ 不是「空头承诺」 |
| D67 `GET /admin/messages/reach` | 接口规范 `:1466`、`:1542-1570` | `message-admin.controller.ts:46` → `message-reach.service.ts` | ✅ `reachRate` 无记录 = `null`（`rateOf()`）、分母 = 已尝试投递、`MAX_RANGE_DAYS=90`、`orphanScenes` |
| D68 `POST /admin/messages/orchestrate` | 接口规范 `:1467`、`:1542-1570` | `message-admin.controller.ts:63` → `message-orchestrator.service.ts` | ✅ `dryRun` 缺省 true 定义在**服务层**（`:107` `input.dryRun !== false`），DTO 刻意不给默认值；受众只收预定义选择器 |
| D68 写操作日志 / D67 只读不写 | 接口规范 `:1569` | `message-admin.controller.ts:64` `@OperationLog`；`reach()` 无装饰器 | ✅ |
| 场景 6 → 7（`cutoff_remind` 追加末尾） | 接口规范 `:34`、`:1512` | `message-template.specs.ts:335`（第 7 行，末尾）；`NOTIFY_PAGES.orderCreate` 新增 | ✅ 保住「前 5 行 = 原型」 |
| 端上：`pages.json` 注册、`mine.vue` 第 5 项入口、`request.ts` `20014` 清态不重试 | 接口规范 `:476` | `pages.json` +4；`mine.vue:SETTINGS_ACTIONS` 第 5 项；`request.ts` `CODE_ACCOUNT_CANCELED=20014` 与 `10002` 分支合并但注释写明不重试 | ✅ |
| 前端 Tab 接线（无「给了按钮没接上线」） | 接口规范 `:1410`、`:1542` | `dish-heat.vue:9,66,196`（Tab2 口味评价 · 懒加载）；`message-template.vue:111`（Tab2 到达率与编排）、`:192-214`（预演 / 真发双按钮，真发二次确认） | ✅ 两处都真调接口 |

### 1.2 机械对账直跑结果

`node tests/tools/audit-contract.mjs --report-only`（工作区根）：

- 代码侧 **146** 个端点 · 规范侧 **95** 个 · 匹配 81
- 【规范有、代码无】14 个 → **全部已声明**（U4/U12/U15/U16 + S4–S8/S10–S14），**未声明缺口 0**
- 【代码有、规范未列】65 个（存量噪声，含本批 U19/U20/D69 —— 见问题 3）

即：**没有发现「文档写了但代码没实装」的新增缺口**，也没有「代码实装了文档完全没写」的新增项（三个新端点都已在契约表登记）。

---

## 二、编号落点（问题 2）

| 编号 | 契约文档 | 代码侧（API） | 代码侧（前端/其它） | 判定 |
|---|---|---|---|---|
| U19 | 接口规范 `:429`、`:466`、`:1816`、`:1856` | `user.controller.ts:151,173` · `user.service.ts` · `user-cancel.dto.ts:5` · `auth.service.ts` · `error-code.ts` | `miniprogram/api/user.ts` · `request.ts` · `mine.vue` · `account-cancel.vue` | ✅ 双侧可查 |
| U20 | 接口规范 `:430`、`:1410`、`:1877-1878` | `rating.controller.ts:46,64` · `rating.service.ts:28,175` · `rating.constants.ts` · `error-code.ts` | `miniprogram/api/order.ts` · `order-detail.vue` · `shared-types/dto/rating.dto.ts` | ✅ 双侧可查 |
| D67 | 接口规范 `:1466`、`:1542`、`:1826` | `message-admin.controller.ts:48` | `admin-web/api/system.ts:348` · `constants/index.ts:361` | ✅ 双侧可查 |
| D68 | 接口规范 `:1467`、`:1542`、`:1826` | `message-admin.controller.ts:66` | `admin-web/api/system.ts:356,379` · `constants/index.ts:361` · `message-template.vue:192` | ✅ 双侧可查 |
| D69 | 接口规范 `:1369`、`:1410`、`:1825` | `rating-admin.controller.ts:10,27` · `rating.service.ts:290` · `rating.module.ts:15` · `stats.constants.ts:111` | `admin-web/api/stats.ts:158` · `constants/index.ts:322,327` · `dish-heat.vue:5,66` | ✅ 双侧可查 |

> ⭐ **历史教训已收口**：D67/D68「只写在契约文档、代码侧查不到」这一条，本批已在**后端**（`@ApiOperation.summary` 前置 D 号）与**前端**（`constants/index.ts:361` `module: 'D59/D60 · D67/D68'`）两处补齐，并在基线清单 ㊸ 段显式记录（基线清单 `:3`）。本次复核确认落点真实存在。

---

## 三、基线冻结清单（问题 3）

### 3.1 本批 17 个新增文件的登记情况

| # | 新增文件 | 是否登记 | 清单行 |
|---|---|---|---|
| 1 | `common/constants/user-status.ts` | ✅ | `:455` |
| 2 | `database/migrations/1700000000003-dish-rating.ts` | ✅ | `:350` |
| 3 | `modules/message/dto/message-f5.dto.ts` | ✅ | `:344` |
| 4 | `modules/message/message-admin.controller.ts` | ✅ | `:343` |
| 5 | `modules/message/message-orchestrator.service.ts` | ✅ | `:341` |
| 6 | `modules/message/message-reach.service.ts` | ✅ | `:342` |
| 7 | `modules/rating/rating.constants.ts` | ✅ | `:345` |
| 8 | `modules/rating/rating.service.ts` | ✅ | `:346` |
| 9 | `modules/rating/rating.controller.ts` | ✅ | `:347` |
| 10 | `modules/rating/rating-admin.controller.ts` | ✅ | `:348` |
| 11 | `modules/rating/dto/rating.dto.ts` | ✅ | `:349` |
| 12 | **`modules/rating/rating.module.ts`** | **❌ 漏登** | **全文 0 命中** |
| 13 | `modules/user/dto/user-cancel.dto.ts` | ✅ | `:457` |
| 14 | `test/unit/dish-rating-agg.spec.ts` | ✅ | `:352` |
| 15 | `test/unit/message-reach.spec.ts` | ✅ | `:217` |
| 16 | `miniprogram/pages/account-cancel/account-cancel.vue` | ✅ | `:458` |
| 17 | `packages/shared-types/src/dto/rating.dto.ts` | ✅ | `:351` |

`rating.module.ts`：1,480 字节 · sha256 前 12 = `ee2d3b658216`（磁盘实读）。

### 3.2 为什么这个漏登不会被任何告警抓到（重点）

- `tests/tools/verify-manifest.mjs:84-88` 的「覆盖性」检查**只扫工作区根 `*.md|*.html` 与 `archive/`**；工程骨架段用的是生成器里的**硬编码清单**（`tests/baseline_manifest.py` 的 `SCAFFOLD`），磁盘上有而清单里没有的文件**不产生任何输出**。
- 直跑结果：`✔ 全表 338/338 行字节 + SHA-256 一致` · `根目录 39 份 → 未登记 0` · `archive/ 7 份 → 未登记 0 ✔` —— **全绿**。
- `scaffold_files=663`（`baseline_manifest.py:863` `scaffold_stats()` walk 实盘）**含** `rating.module.ts`，而清单表格只有 280 行 —— 两个数字本来就不同源，故也不能靠它发现漏登。
- 项目自己立的防线是「**本批新增文件恰好 N 个 ⇒ 表增量 N**」的收尾机械比对（此前批次均有，见 `baseline_manifest.py:610,645-646,670,710-718`）。而 **U2 批次块（`baseline_manifest.py:336-343`）既没有 `# ── 批次 ──` 注释头，也没有这段收尾比对记录**（该 8 行甚至缩进为 0，与上下文风格不一致）。

**反例条件**：若 `rating.module.ts` 出现在清单表格中（应在 `:345-352` 之间），或 U2 块带有「本批新增文件恰好 N 个 / 表增量 N」的比对记录，则本条不成立。

---

## 四、权限矩阵（问题 4）

本批 **未新增任何菜单 / 授权 key** —— D67/D68/D69 全部落在既有页面（P36 通知模板页、P35 菜品热度页）的**第二个 Tab**，`constants/index.ts` 只改了两处 `module` 标注字段，未动 `path`：

- `apps/admin-web/src/constants/index.ts:327` `module: 'M36-03 · D69'`
- `apps/admin-web/src/constants/index.ts:361` `module: 'D59/D60 · D67/D68'`

三处对账：

| 端 | D69（`/admin/stats/dish-rating`） | D67/D68（`/admin/messages/*`） |
|---|---|---|
| `ADMIN_MENU_KEYS` | `/stats/dish-heat`（`admin-role.ts`）—— 页面级复用，无需新增 | `/system/message-template`（`admin-role.ts`）—— 同上 |
| `ADMIN_NAV` 侧边栏 | `constants/index.ts:319-327`（Tab2 口味评价） | `constants/index.ts:355-361`（Tab2 到达率与编排） |
| 服务端 `@Roles` | `rating-admin.controller.ts:21` = `super_admin, admin, finance, operator, viewer`（与 `stats-admin.controller.ts:26` 逐字一致） | `message-admin.controller.ts:39` = `super_admin, admin` |

角色可见性复核（`admin-role.ts:ROLE_MENUS`）：

- **finance / viewer** 的菜单含 `/stats/dish-heat` ⇒ 与 D69 的 `@Roles`（含二者）**同向** ✅；D69 与 D47–D50 同类级白名单 ✅
- **operator** 菜单 = `ADMIN_MENU_KEYS.filter(!/system/)` ⇒ **不含** `/system/message-template`，与 D67/D68 仅 `super_admin/admin` **同向** ✅
- **finance / viewer / supplier / 小程序 token** 一律不含 `/system/*` ⇒ 与文档「`10003`」一致 ✅
- **结论**：三处对得上，无「菜单能点、点了 10003」，也无「授权无入口」。`/leader/detail` 既有门禁盲区**本批未扩大**（无新增菜单项，`nav:consistency` 不受影响）。

---

## 五、表数与迁移数（问题 5）

### 5.1 真源

- `apps/api-server/src/database/entities/index.ts:13` 头注「合计 **28** 张」；`:63` `ALL_ENTITIES` 含 `DishRating`；`:16` 订单与支付域 4 → 5
- `apps/api-server/src/database/migrations/`：**四支**（`1700000000000-init` / `...1-parity-fix` / `...2-index-commission-meal` / **`...3-dish-rating`**）

### 5.2 仍写旧值的文档

| 文档:行 | 现值 | 应为 | 说明 |
|---|---|---|---|
| `ABox一盒数据库ER设计v2.1.md:60` | 「ER 总览（**27 张表**）」 | 28 | 标题级，最显眼 |
| `ABox一盒数据库ER设计v2.1.md:132` | ER 图注「通知模板（M3-12 · **27 张表**）」 | 28 | |
| `ABox一盒数据库ER设计v2.1.md:958` | 「**合计** \| **27 张表**」 | 28 | 汇总行 |
| `ABox一盒数据库ER设计v2.1.md:964` | 「**合计 27 张表** —— 与 `entities/index.ts` 的 `ALL_ENTITIES` **逐张对齐**」 | 28 | ⭐ 该句是 ER 自己的承诺，现已被打破 |
| `ABox一盒数据库ER设计v2.1.md:974` | 增补说明「……**27 张**」 | 28 | |
| **`ABox一盒数据库ER设计v2.1.md` 全文** | **无任何 `ab_dish_rating`**（`grep -i` 0 命中） | 应有 §3.x 章节 | ⚠️ 第 28 张表在 ER 里完全不存在 |
| `ABox一盒数据库ER设计v2.1.md:133` / `:409` | 「通知模板 **5 场景**」 | **7 场景** | 与 `message-template.specs.ts:186,208,241,262,286,310,335` 不符 |
| `ABox一盒部署运维手册v1.0.md:524` / `:552` | 「全库 **27 表** / 394 列」 | 28 表 | 与 `schema:parity` 口径同源的陈述 |
| `ABox一盒接口规范v1.0.md:4` | 依据行「ER v2.1（**23 张表**）」 | 28 | 存量更旧值（M3 期），本批未触及 |
| `ABox一盒项目目录结构v2.0.md:385` | 「数据库迁移（**三支**合并推演才等于实体结构）」 | **四支** | 同段 `:386-388` 的树也只列到 `1700000000002` |

**反例条件**：若 ER 已增补 `ab_dish_rating` 章节并把合计改为 28、项目目录结构改为「四支」并列出第 4 支文件、部署手册改为 28 表，则本条不成立。

> ⚠️ 按纪律「发现数字口径不一致时**只举证、不自行改文档**」，以上均未修改。

---

## 六、里程碑计划 M5-20 验收条目 ↔ 实现（问题 6）

子批次表（`ABox一盒开发里程碑计划v1.0.md:622-641`）12 项，逐项核对：

| 项 | 内容 | 实现 | 判定 |
|---|---|---|---|
| ① | U19 + 原生页，入口「我的 → 设置 → 账号注销」 | `user.controller.ts:173` + `account-cancel.vue` 存在 + `mine.vue` 第 5 项 | ✅ |
| ② | `status=3` + `deleted_at` + 昵称改「已注销用户」+ 清 7 字段 | `user.service.ts` 落库段；`user-status.ts:21,39`；`user.entity.ts:25,32,58,76` 字段齐备 | ✅ |
| ③ | 再登录 `20014`，与 `20006` 分码且先判 | `auth.service.ts` diff | ✅ |
| ④ | 三闸门 → `20015` + `reasons[]` + `pendingOrders`，全查再报 | `user.service.ts` 闸门段 | ✅ |
| ⑤ | 确认词服务端裁定 | `user-cancel.dto.ts:20` + 服务端校验 | ✅ |
| ⑥ | 原子占位（自查修掉的「读-再写」） | `update({status: Not(CANCELED)})` + `affected=0` | ✅ |
| ⑦ | 不删 `ab_commission` / `ab_balance_log` / `ab_order` | 实现中无任何 delete | ✅ |
| ⑧ | `clearedFields` + `note` 服务端下发，note 写明「依法保留」 | `user.service.ts` 返回体 | ✅ |
| ⑨ | 终态屏不提供返回；`request.ts` 清态不重试；协议 §五 改自助路径 | `request.ts` 分支 + `agreements.ts` diff | ✅ |
| ⑩ | 旧 token 边界写成断言 | `e2e-m1.mjs` §9（24 条） | ✅（条数由 T1 直跑复核） |
| ⑪ | e2e §9 新增 24 条，m1 64 → 88 | `e2e-m1.mjs` 已改；文档与基线清单一致 | ✅（同上） |
| ⑫ | **文档同步清单** | 接口规范 ✅ · §八映射表 ✅ · §九错误码 ✅ · K53 ✅ · 提审清单第 10 条 ✅ · 登记册 ⑳ ✅ · M5-19 ⑧ 编号映射 ✅ · **《合规资质与协议清单》§七 row 2 —— 未列、也未改** | ⚠️ 见问题 1 |

**结论：未发现「写了已验收但代码没做」的项。**唯一的缺口在 ⑫ 的文档同步范围上（漏了一份合规文档）。

---

## 七、⭐ 提审自检清单结论（问题 7）

### 7.1 已同步的部分

| 产物 | 落点 | 状态 |
|---|---|---|
| 《外卖小程序最快上线路径与提审自检清单 v1.2》**第 10 条** | `abox-onebox/docs/...v1.2.md:279`（工作区根同名文件同内容） | ✅ 已改为「**✅ 已实装（M5-20 · 2026-09-23）** —— 端上「我的 → 设置 → 账号注销」（原生页），后端 `POST /me/cancel`；三条拦阻属**预期行为**，e2e `§9` 24 条断言钉死」 |
| 《已知项与预期行为清单 v1.0》**K53** | `_ABox一盒已知项与预期行为清单v1.0.md:106` | ✅ 「✅ **已收口（M5-20 · 2026-09-23）** —— 不再是已知项」 |
| K53 与第 10 条的交叉引用 | `_ABox一盒已知项与预期行为清单v1.0.md:180` | ✅ 「K53 与第 10 条「缺失不通过」对上」 |
| 《悬而未决登记册》提审前置核查行 | `_ABox一盒悬而未决登记册.md:23` | ✅ **RESOLVED**，指向 §决议留痕 ⑳（`:230`） |
| 协议页（第 11 条） | M5-18 已收口 | ✅（本次未改，无回归） |

### 7.2 未同步的部分（🔴）

**《ABox一盒合规资质与协议清单 v1.0.md》本批未被修改**（不在 47 个未提交文件里；工作区根与 `abox-onebox/docs/` 镜像 `cmp` 完全一致），仍写着：

- `:225` §七 row 2：`| 2 | 用户注销入口 | ❌ **待开发（提审前置 · 未排期）** | 隐私合规硬要求，《提审自检清单 v1.2》第 10 条「缺失不通过」……一期现状 = 隐私政策正文里引导走**人工客服**申请注销（**不谎称有自助注销入口**）`
- `:101`：`| ⚠️ 同批硬阻塞 | §七 第 2 项「用户注销入口」仍需开发（清单第 10 条「缺失不通过」）—— **两条都补齐才能提审**`
- `:72` §用户权利：仍写「（**必须提供注销入口**，否则审核不通过）」（这句本身没错，但与 `:225` 的 ❌ 并置即矛盾）

⇒ **同一事实在两份合规文档里给出相反结论**：提审清单说 ✅ 已实装，合规清单说 ❌ 待开发（且明确写「未排期」）。对照 M5-20 ⑫ 的文档同步清单可见根因：**⑫ 逐条列了接口规范 / 映射表 / 错误码 / K53 / 提审清单 / 登记册，**唯独没有列《合规资质与协议清单》§七 row 2**（`ABox一盒开发里程碑计划v1.0.md:641`）。

这正是「两份表述必有一份会错」的第 N 形态，且落在**提审合规**这条最不能错的线上。

**反例条件**：若 §七 row 2 已改为「✅ 已实装」且 `:101` 的「仍需开发」已删除，则本条不成立。

---

## 八、编号与端到端口径的其它观察项

### 8.1 §39 断言条数自相矛盾（🟠）

- `ABox一盒接口规范v1.0.md:1515`（§6.7 M3-12 小节验收行）：「**F5 补强另见 §39**（**25 条** · 编排 + 到达率 + 截单提醒场景）」
- `ABox一盒接口规范v1.0.md:1547`（F5 实现口径小节）：「验收 `scripts/e2e-m3.mjs` **§39**（**26 条**断言）」
- 实测：`scripts/e2e-m3.mjs:13580-13910`（§39 段）**26** 处顶层 `assert(`；§40 段（`:13911-14128`）**18** 处 —— 与文档「§40 · 18 条」一致。

⇒ 26 是对的，25 是错的。基线清单 row 25（`:69`）与 `:3` ㊸ 段都写 26，与 `:1547` 一致 ⇒ **只有 `:1515` 一处错**。

**反例条件**：若 `e2e-m3.mjs` §39 段实测顶层 `assert(` 站点数为 25，或 `:1515` 已改为 26，则本条不成立。

### 8.2 契约↔代码对账的加粗盲区（🟠）

- 解析器：`tests/tools/audit-contract.mjs:110` 正则 `^\|\s*([UADQSP][0-9]+[a-z]?)\s*\|…` —— 编号列写成 `**U19**` 时首字符是 `*`，**不匹配**；
- 归一化 `norm()`（`:95-101`）只 `replace(/`/g,'')`，**不去 `**`** ⇒ 路径列写成 `` **`/me/cancel`** `` 时得到 `**/me/cancel**`，与代码侧 `/me/cancel` 不等。
- 全仓同写法 **17 行**（U18 / S9 / D36–D46 / S1 / S2 / D66 / Q1）+ **本批新增 3 行**（U19 `:429` / U20 `:430` / D69 `:1369`）= **20 行在盲区**。
- 本批 D67 `:1466` / D68 `:1467` 用的是**不加粗**写法 ⇒ 能被解析。**同批两种写法并存**，这也是问题本身的一部分。
- 后果：这 20 个编号**既进不了规范侧计数**（95 vs 真实 100+），也**失去「规范有、代码无」的保护**（代码被删也不报）；同时它们被误列入「代码有、规范未列」的 65 条噪声里。工具仍 `exit 0` —— 恒绿。
- **反证（已实跑，负向自证）**：
  1. 仅去掉 U19/U20/D69 三行的**编号**加粗 → 规范侧 95→**98**，但报「**未声明缺口 3**」（假红，因为路径仍加粗）。
  2. 同时去掉编号与路径加粗 → 规范侧 **98**、匹配 81→**84**、未声明缺口 **0**、三条从「代码有、规范未列」中**消失**。
  ⇒ 修法必须**两处同时改**，只改一处会把一个假绿变成假红。

**反例条件**：若解析器正则与 `norm()` 已兼容 `**`（或这 20 行改为不加粗写法），则本条不成立。

### 8.3 端点总数硬编码过期（🟡）

- `ABox一盒接口规范v1.0.md:221`：「实测 **31 个 `*.controller.ts` → 141 个端点**」；`:223`：「两法端点集合**完全相等**（141 = 141 · 交集 141 · 双向差额 0）」
- `tests/tools/README.md:56` 同口径
- 实测：`find apps/api-server/src -name "*.controller.ts" | wc -l` = **34**（本批 +3：`rating.controller.ts` / `rating-admin.controller.ts` / `message-admin.controller.ts`）；静态对账代码侧端点 = **146**（141 + 5）
- ⚠️ `route:audit`（NestJS 运行时反射）本次直跑 `exit=null` 无输出（需 `ts-node`，本机依赖状态由 T1 复核），故「两法仍相等」这一句**暂不能证实**，但静态侧的 141 已确定过期。

### 8.4 同天两批的顺序与时间戳不一致（🟢 观察）

- 文件 mtime：F5（`message-orchestrator.service.ts` 00:59 / `message-admin.controller.ts` 01:48）**早于** U2（`rating/` 12:09–12:33）
- 但接口规范「最近修订」表把 **U2 行排在 `:33`、F5 行排在 `:34`**；基线清单 row 25 同序
- ⇒ 「F5 … **表数仍 27**」（`:34`）在文档里读起来像是「U2 已把表数推到 28 之后 F5 还说 27」。按时间戳它没错（F5 先落），但**读者无从判断**，属可核对性缺陷。

---

## 九、已登记 / 不算新发现（按纪律不重复报）

| 事项 | 登记处 | 状态 |
|---|---|---|
| 《项目目录结构 v2.0》§十 端-页-模块映射表「接口」列过期（含全表 0 处 D66），未随 F5 补 D67/D68 | `_ABox一盒悬而未决登记册.md:30`（2026-09-25 F5 收口 · 文档一致性） | OPEN · 刻意不手工补单行，改「单列一批回填 M5-15…M5-20 + F5」 |
| 企业微信 / 短信两通道一期不做 | `_ABox一盒悬而未决登记册.md:29` | OPEN（已裁决） |
| 账号注销入口（提审前置） | `_ABox一盒悬而未决登记册.md:23` + 决议留痕 ⑳ | RESOLVED |
| `/leader/detail` 有路由无菜单无授权 | 上轮对账已知门禁盲区 | 本批未扩大 |
| 授权 key 40 个、差集 6 个判为「授权无入口」 | 上轮对账结论 | 本批未新增菜单项，结论不变 |

---

## 十、给 team-lead 的建议处置顺序（不改文档，只给方向）

1. 🔴 **先补《合规资质与协议清单 v1.0》§七 row 2 + `:101`**（与提审清单第 10 条对齐）—— 这是祝总那条线唯一还没合上的口子。
2. 🟠 **修 `接口规范:1515` 的「25 条 → 26 条」**（单点、零风险）。
3. 🟠 **把 U19/U20/D69 三行的编号与路径加粗同时去掉**（或改解析器正则 + `norm()` 兼容 `**`）；建议顺手把存量 17 行一并处理，让 20 个编号重新进入机械保护。
4. 🟠 **把 `rating.module.ts` 补进基线清单 + 生成器 `SCAFFOLD`**，并按既有纪律给 U2 块补「本批新增文件恰好 N 个 ⇒ 表增量 N」的收尾比对记录。
5. 🟠 **表数 / 迁移数**：ER 增补 `ab_dish_rating` 章节 + 合计改 28 + 场景 5→7；部署手册 27→28；项目目录结构「三支 → 四支」并列出第 4 支。
6. 🟡 端点总数 31/141 → 34/146（三处：接口规范 `:221`、`:223`、`tests/tools/README.md:56`），并等 T1 的 `route:audit` 结果确认两法仍相等。

---

## 附：本次实跑的只读命令（供复现）

```
git -C abox-onebox status --porcelain -uall
git -C abox-onebox diff --numstat -- docs/
node tests/tools/audit-contract.mjs --report-only          # 静态契约对账
node tests/tools/verify-manifest.mjs                        # 基线清单 338/338 + 覆盖性
find abox-onebox/apps/api-server/src -name "*.controller.ts" | wc -l
git -C abox-onebox diff -U3 -- docs/ apps/api-server/src/modules/user ...
# 负向自证（临时副本，已删除）：
#   ABOX_SPEC=<temp copy>  node tests/tools/audit-contract.mjs --report-only
```
