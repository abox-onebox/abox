# ABox 一盒 · 多身份黑盒实测 · 原始证据

- **测试人**：gstack-qa-lead（质量门神）
- **测试时间**：2026-09-21（北京时间，凌晨）
- **仓库**：`C:\Users\herma\WorkBuddy\ABox小程序\abox-onebox`
- **库**：`data/abox-dev.sqlite`（sqlite · 全环境共用）
- **探针脚本**：`scripts/_probe-identities.mjs`（`_` 前缀 = 不进基线；一次性「起服务→探测→停服务→退出」）
- **复现命令**：
  ```bash
  export PATH="/c/Users/herma/.workbuddy/binaries/PortableGit/versions/1.2.0/cmd:/c/Users/herma/.workbuddy/binaries/PortableGit/versions/1.2.0/usr/bin:/c/Windows/System32:$PATH"
  cd "/c/Users/herma/WorkBuddy/ABox小程序/abox-onebox"
  node scripts/gate.mjs seed && node scripts/gate.mjs seed:demo   # 干净库 + 演示数据（约 45s）
  node scripts/_probe-identities.mjs                              # 本证据全部来源（约 55s）
  ```
- **环境事实（复核无误）**：`db=sqlite · queue=memory · provider=mock`；时钟注入 `ABOX_SHIFT_TO_HOUR=20`（任何时候可下单）；限流本探针显式关（`ABOX_RATE_LIMIT=off`）；出餐日 = 明日 `2026-09-22`。

> ⚠️ 防误报纪律：动手前已通读 `_ABox一盒已知项与预期行为清单v1.0.md`（K01–K56 + R1–R11），
> 并单列 §K-7「必须记 P1」五条做**反向验证**（见下 §5）。命中已知项者**不记为缺陷**。

---

## 0. 探针总结果（原文汇总行）

```
──────── 结论汇总 ────────
PASS=42 FAIL=0 NOTE=7 UNKNOWN=1 / 共 50
FAIL：（无）
```

- **FAIL = 0**：本轮黑盒未发现「程序性硬缺陷」（接口返回与设计判据不一致）。
- **NOTE = 7**：观察项 / 设计取舍候选（见缺陷清单）。
- **UNKNOWN = 1**：~~K47 出餐确认联动未测~~ → **已补测为绿（见 §7）**。

---

## 1. 造出来的身份（×9）与登录返回

`dev:<码>` 首次登录自动建号（openid = `mock_openid_<码>`），再 sqlite 直连补属性。
**换人 = 换 dev 码 ⇒ 不同 userId**（服务端侧验证；H5 端侧见 §3）。

| 身份名 | 登录 code | userId | isNewUser | isLeader | 楼栋 | team_leader_id | 说明 |
|---|---|---|---|---|---|---|---|
| 李明1001 | `dev:1001` | 1001 | false | true | 1 | null | seed 内置 · 首席团长 12% |
| 纯团员 | `dev:qa_member` | 3529 | true | false | 1 | 1 | 有楼栋+在职团长 |
| 无楼栋 | `dev:qa_newbie` | 3530 | true | false | null | null | 资料不完整 |
| 绑停职团长 | `dev:qa_susp` | 3531 | true | false | 1 | 923 | 923 已停职(status=2) |
| 跨楼栋 | `dev:qa_cross` | 3532 | true | false | 4 | 5 | 用户在楼4、团长在楼2 |
| 有余额 | `dev:qa_bal` | 3533 | true | false | 1 | 1 | ab_balance ¥58.00 + 1 条流水 |
| 楼栋停用 | `dev:qa_bldg2` | 3534 | true | false | 3 | 1 | 楼3 status=2（待开通） |
| 在职团长+余额 | `dev:qa_leader` | 3535 | true | true | 1 | null | 现造团长(id924)+余额 ¥88.88 |
| 停职团长本人 | `dev:qa_suspleader` | 3536 | true | **false** | 1 | null | 现造停职团长(id925, status=2) |
| 取消重下 | `dev:qa_reorder` | 3537 | true | false | 1 | 1 | 用于 K17 |
| 截单后取消 | `dev:qa_cancel_late` | 3538 | true | false | 1 | 1 | 用于 40004 |
| 黑名单 | `dev:qa_black` | 3539 | true | false | 1 | 1 | 登录后置 status=2 |

**登录返回要点（原文摘）**
- `B-1` 首次登录 → `isNewUser=true`（member/newbie/cross 均 true）。
- `B-2` 老用户重复登录 → `isNewUser=false`，`userId` 稳定（1001）。
- `B-4` 新用户 `phone=null`、`buildingId=null`（登录不取手机号/地址，C3/L9）。
- 停职团长本人：`isLeader=false`（`auth.service.ts:93` 实时判 `leader.status === ACTIVE`）。

---

## 2. 探针 stdout 原文（可读段）

```
=== ABox 多身份黑盒实测探针 ===
DB: C:\Users\herma\WorkBuddy\ABox小程序\abox-onebox\data\abox-dev.sqlite
BASE: http://localhost:3101/api/v1

[PASS] ENV-0 · API 服务启动 + 健康检查  › code=0
[PASS] ENV-1 · 时钟注入态：北京小时=20:00 ⇒ 下单窗口开放  › h=20

── B. 身份创建与登录 ──────────────────────────────────────
[PASS] B-1 · 首次登录 dev:<新码> 自动建号（isNewUser=true）  › member=true newbie=true cross=true
[PASS] B-2 · 老用户重复登录 isNewUser=false 且 user.id 稳定  › 1001 isNewUser=false userId=1001
[PASS] B-3 · 换人（不同 dev 码）→ 不同 userId  › 李明1001=1001 纯团员=3529 无楼栋=3530 绑停职团长=3531 跨楼栋=3532 有余额=3533 楼栋停用=3534 在职团长+余额=3535 停职团长本人=3536
[PASS] B-4 · 登录只凭 code：不落手机号/地址  › phone=null buildingId=null

── C. U1 首页（团长归属 / 可下单性）─────────────────────────
[PASS] C-0 · 出餐日 mealDate=2026-09-22（=明日），套餐已上架  › code=0 canOrder=true
   · 纯团员: code=0 canOrder=true leader={"id":1,"name":"李明","building":"国贸三期 A 座","source":"bound"}
   · 无楼栋: code=10004 msg=你还未绑定办公楼，请通过团长邀请链接进入
   · 绑停职团长: code=0 canOrder=true leader={"id":1,"name":"李明","source":"building_default"}
   · 跨楼栋: code=0 canOrder=true leader={"id":5,"name":"陈强","building":"国贸三期 B 座","source":"bound"}
   · 楼栋停用: code=0 canOrder=true leader={"id":1,"name":"李明","source":"bound"}
   · 停职团长本人: code=0 canOrder=true leader={"id":1,"name":"李明","source":"building_default"}
[PASS] C-1 · 纯团员：canOrder=true 且 leader.source=bound id=1
[PASS] C-2 · 无楼栋用户：U1 回 10004（NOT_FOUND，未绑办公楼）
[PASS] C-3 · 绑停职团长：U1 不认停职绑定，回落本楼在任团长（building_default id=1）
[NOTE] C-4 · 跨楼栋：用户楼4 / 绑定团长#5（楼2）——U1 如实显示 bound 团长#5
[NOTE] C-5 · 楼栋 status=2（待开通）住户仍可下单（U1 canOrder 未校验楼栋状态）
[PASS] C-6 · 在职团长本人（1001，team_leader_id=null）U1 走 building_default 显示本楼团长#1
[PASS] C-7 · leaderName 只认 team_leader_id，不自回退成本人  › 1001.leaderName=null | 纯团员.leaderName=李明

── D. 下单主链 pending_pay→paid ─────────────────────────────
[PASS] D-1 · U6 创建订单：status=pending_pay，金额=单价×份数  › code=0 orderNo=AB2026092177921925 status=pending_pay payAmountFen=5160
[PASS] D-2 · ① 同 Idempotency-Key 重复下单 → 10006 且同 orderNo（HTTP 200）
[PASS] D-3 · ② 缺 Idempotency-Key → 10001（HTTP 200）
[PASS] D-4 · ③ 同身份同出餐日再下一单 → 30004  › msg=你已提交过 2026-09-22 的订单，请勿重复下单
[PASS] D-5 · U7 创建支付单（mock JSAPI）  › code=0 payAmountFen=5160
[PASS] D-6 · U8 支付回调入账：paid=true 且状态文案=待出餐
[PASS] D-7 · U10 订单详情：时间线 6 节点、paid 节点已完成、取餐点=国贸三期 A 座 1 楼大堂
[PASS] D-8 · 归属一致性：U1 leader.id === 订单落库 team_leader_id（同判据）  › 1 === 1

── E. 取消 / 退款 / 取消后重下 ─────────────────────────────
[PASS] E-0 · 余额抵扣下单：份数2/总额5160，抵扣3000，实付2160
[PASS] E-1 · U11 截单前自助取消：status=cancelled，refundInitiated=true
[NOTE] E-2 · 【K17 观察项】取消订单后再下一单（同出餐日）  › code=0 orderNo=AB2026092167263387
[PASS] E-3 · U11 截单后自助取消 → 40004（附团长联系方式）  › 构造回拨 rows=1 code=40004 leaderPhone=186****0001

── F. 水平越权 ────────────────────────────────────────────
[PASS] F-1 · 越权读：A 读 B 的订单详情 → 30010 ORDER_NOT_FOUND
[PASS] F-2 · 越权改：A 取消 B 的订单 → 30010
[PASS] F-3 · 越权支付：A 对 B 的订单发起支付 → 30010
[PASS] F-4 · 非团长访问团长域 /leader/workbench → 10003（HTTP 403）
[PASS] F-5 · 非团长访问 /leader/balance → 10003
[PASS] F-6 · 非团长发起提现 /leader/withdraw → 10003
[PASS] F-7 · 无 token 访问 /me/balance → 401（code=10002）

── H. 余额一致性（K16）────────────────────────────────────
[PASS] H-1 · K16 我的页余额(/me/balance) === 团长余额(/leader/balance) === 明细最新 balanceAfter  › me=8888 leader=8888 latestBalanceAfter=8888 summaryNet=8888
[PASS] H-2 · U14/L19 用户余额明细与团长余额流水**同一实现**  › me={"inFen":8888,"outFen":0,"netFen":8888,"count":1} ldr=同值

── I. 团长身份二次校验 ────────────────────────────────────
[PASS] I-1 · 停职团长(status=2)访问 /leader/workbench → 20003 LEADER_DISQUALIFIED
[PASS] I-2 · 停职团长登录出参 isLeader=false
[PASS] I-3 · 【关键】团长被停职后，**旧 token** 立即失效  › before=0 after=20003

── L. 黑名单用户（身份状态）────────────────────────────────
[NOTE] L-1 · 用户被置黑名单(status=2)后，**已签发 token** 仍可下单  › 下单 code=0 orderNo=AB2026092176346087
[PASS] L-2 · 黑名单用户重新登录 → 20006 USER_DISABLED

── M. 跨楼栋下单 ──────────────────────────────────────────
[NOTE] M-1 · 跨楼栋下单：order.building=#4(国贸三期 D 座) · order.team_leader=#5(陈强@楼2)
[NOTE] M-2 · 订单详情取餐点=国贸三期 D 座 1 楼大堂 · pickup.leaderName=陈强

── N. 楼栋 status=2 住户下单实测 ──────────────────────────
[NOTE] N-1 · 楼栋 status=2（待开通）住户**下单成功**  › code=0 orderNo=AB2026092156699804

── O. 后台对账（K37 / K35 / K36）──────────────────────────
[PASS] O-0 · 后台超管登录 admin/admin123  › role=super_admin
[PASS] O-1 · K37 看板 与 财务概览 收支毛利**同一组数字**  › gmv=150040 purchase=56000 commission=1935 fulfill=0 profit=92105（五项逐项相等）
[PASS] O-2 · K35 跑批时刻表：8 行 registeredCron **全部非空**  › total=8 implemented=8 registered=8 空值任务=[]
[PASS] O-3 · K36 两窗口改同一张配送单：后提交者被拒  › id=658 v0=0 A.code=0 B.code=30016 current.version=1

── P. 供应商出餐确认联动（K47）────────────────────────────
[PASS] P-0 · S1 供应商出餐工作台可读（sanweiwu）  › login=0 workbench=0
[UNKNOWN] P-1 · K47 出餐确认后订单应离开 cut_off  › 本次探针未对 T 日出餐单据发起 cook-confirm
```

---

## 3. 关键请求 / 响应原文（节选）

### 3.1 水平越权（最有价值方向之一）——全部被拦
| 请求 | 响应原文 | 判据 |
|---|---|---|
| A(`纯团员`) `GET /orders/AB2026092163224880`（B`有余额`的单） | `{"code":30010,"message":"订单不存在"}` | `order.service.ts:1227 loadOwnOrder` 对「不存在」与「非本人」返回同一码（不泄露订单是否存在） |
| A `POST /orders/<B>/cancel` | `code=30010` | 同上 |
| A `POST /orders/<B>/pay` | `code=30010` | `preparePrepay→loadOwnOrder` |
| 非团长 `GET /leader/workbench` | `{"code":10003,"message":"无权限访问该资源"}` HTTP 403 | `leader.guard.ts`：无 `ab_team_leader` 记录 → 10003 |
| 非团长 `POST /leader/withdraw` | `code=10003` | 资金入口不对非团长开放 |
| 无 token `GET /me/balance` | HTTP 401 `code=10002` | JWT 守卫 |

### 3.2 团长身份二次校验（不信 token 的 isLeader）
- 旧 token（登录时 isLeader=true）→ 团长被 `UPDATE ab_team_leader SET status=2` → **同一 token** 再调 `/leader/workbench`：`before=0 → after=20003`。
- 结论：`LeaderGuard` 每次都实时查 `ab_team_leader.status`，token 内 `isLeader` 不被信任（符合《接口规范》§1.5）。

### 3.3 一单一天 / 幂等
- 同 `Idempotency-Key` 重放：`{"code":10006,"data":{"orderNo":"AB2026092177921925",…}}` HTTP 200。
- 缺 key：`{"code":10001}` HTTP 200。
- 同身份同出餐日换 key 再下：`{"code":30004,"message":"你已提交过 2026-09-22 的订单（AB2026092177921925），请勿重复下单"}`。

### 3.4 队长归属一致性（U1 显示 vs U6 落库）
- `纯团员`：U1 `leader.id=1` ⇔ 订单 `team_leader_id=1`（同判据，含 `source`）。
- `绑停职团长`（绑定 923 已停职）：U1 回落 `building_default id=1`；订单落库亦为 1。
- 结论：`MealService.resolveLeader` 与 `OrderService.resolveLeader` 判据一致（缺陷⑫ 已收口）。

### 3.5 K16 余额一致性（原「我的页 vs 余额明细」踩坑点）
| 读点 | 值（分） |
|---|---|
| A2 登录 `leader.balanceFen` | 8888 |
| U13 `GET /me/balance.balanceFen` | 8888 |
| L11 `GET /leader/balance.balanceFen` | 8888 |
| U14 `GET /me/balance/logs.list[0].balanceAfterFen` | 8888 |
| U14 summary `netFen` | 8888 |
→ **无「两个余额」分叉**，本条 P1 反向检查**通过**。

### 3.6 K37 看板 vs 财务概览（原文数值）
`GET /admin/stats/dashboard` 与 `GET /admin/finance/overview`（date=2026-09-22）：
`gmv=150040 · purchase=56000 · commission=1935 · fulfillment=0 · grossProfit=92105` **五项逐项相等**
（实现上 `FinanceService.overview` 直接消费 `StatsService.dashboard` 的 `metrics`，函数级同源）。

### 3.7 K36 配送单并发（两窗口同写）
```
GET /admin/deliveries → row id=658 version=0 totalQuantity=6
窗口A PUT /admin/deliveries/658 {version:0, reason:"QA窗口A改份数", totalQuantity:7} → code=0
窗口B PUT /admin/deliveries/658 {version:0, reason:"QA窗口B改司机", driverName:"QA-B司机"} → code=30016, data.current.version=1
```
→ 后提交者被乐观锁拒绝（**不是「都成功」**），K36 反面检查通过。测试后已复原（`totalQuantity=6, driverName=演示·郑师傅, version=2`）。

### 3.8 K35 跑批时刻表
`GET /admin/schedule` → `summary={total:8, implemented:8, registered:8}`；
逐行 `registeredCron` 全部非空（`空值任务=[]`）⇒ 「某行实际注册时刻为空」的真缺陷信号**未出现**。

---

## 4. 未测 / 测不了（如实登记）

1. **K47 供应商出餐确认 → 订单 `cut_off→cooked`**：~~本次未测~~ → **已补测（2026-09-21 追测）**，结论**绿**，见 **§7**（探针 `scripts/_probe-k47.mjs`）。
2. **K36「两个浏览器窗口」**：用「同一 admin token 连续两次 PUT（同一 stale version）」模拟，未用两个真实浏览器会话（结果等价，但如实标注非真双窗）。
3. **H5 浏览器端 `?devCode=1002` 换人 / 清旧登录态**：~~仅代码走查~~ → **已补做「接口层等价 + 产物级」核验**（**非真浏览器渲染** —— 本机无任何 headless 浏览器），见 **§8**。代码走查结论不变：
   `App.vue:47 applyDevIdentity(readDevCode(options)) === true → clearAuthStorage()` → `restore()` 读不到旧 token → 下次 `ensureLogin()` 重新授权。
4. **楼栋 `status=3`（已暂停）单独复现**：楼 10 属楼群 4，而楼群 4 在 T 日（2026-09-22）的分配为 `pending`（未上架）⇒ 该楼住户下单会先被 `30005 未开团` 拦下，无法单独复现；其**结构与 status=2 完全同源**（用户侧均不读 `ab_building.status`），见缺陷清单 OBS-1。
5. **环境测不了**：真微信登录/支付、HTTPS/域名/ICP、真推送（订阅消息）、真机兼容、压测、（K01/K02/R4–R7）。
6. **后台两窗口改同一张配送单的「真人」验证**、以及**后台账务补跑（D35 佣金入账）后 K16 是否仍一致**：未覆盖。

---

## 5. §K-7「必须记 P1」五条 · 反向验证结果（全部为绿）

| K码 | 判据 | 本轮结果 | 原始依据 |
|---|---|---|---|
| **K16** | 「我的」页余额 vs 余额明细不一致 | ✅ **一致**（全 8888 分） | §3.5 |
| **K35** | 跑批时刻表某行「实际注册时刻」为空 | ✅ **8/8 全非空** | §3.8 |
| **K37** | 看板 vs 财务概览数字不同组 | ✅ **同一组** | §3.6 |
| **K47** | 出餐确认后订单仍停「已截单」 | ✅ **推进为 `cooked`（绿）** | §7 |
| **K36 反面** | 两窗口改同一配送单都显示成功 | ✅ **后写被拒 30016** | §3.7 |

> 结论：K-7 五条**全部可测项均未出现真缺陷信号**；K47 已于 **§7 补测为绿**（含连带半边「送达后不停在配送中」）。

---

## 6. 事后 DB 复核（夹具与终态落库，原文）

```
== 本次探针造的用户 (id>=3529) ==
[{"id":3529,"openid":"mock_openid_qa_member","building_id":1,"team_leader_id":1,"status":1},
 {"id":3530,"openid":"mock_openid_qa_newbie","building_id":null,"team_leader_id":null,"status":1},
 {"id":3531,"openid":"mock_openid_qa_susp","building_id":1,"team_leader_id":923,"status":1},
 {"id":3532,"openid":"mock_openid_qa_cross","building_id":4,"team_leader_id":5,"status":1},
 {"id":3533,"openid":"mock_openid_qa_bal","building_id":1,"team_leader_id":1,"status":1},
 {"id":3534,"openid":"mock_openid_qa_bldg2","building_id":3,"team_leader_id":1,"status":1},
 {"id":3535,"openid":"mock_openid_qa_leader","building_id":1,"team_leader_id":null,"status":1},
 {"id":3536,"openid":"mock_openid_qa_suspleader","building_id":1,"team_leader_id":null,"status":1},
 {"id":3537,"openid":"mock_openid_qa_reorder","building_id":1,"team_leader_id":1,"status":1},
 {"id":3538,"openid":"mock_openid_qa_cancel_late","building_id":1,"team_leader_id":1,"status":1},
 {"id":3539,"openid":"mock_openid_qa_black","building_id":1,"team_leader_id":1,"status":1}]   # 已复原为1

== 探针造的团长 ==
[{"id":924,"user_id":3535,"building_id":1,"real_name":"QA团长","level":"formal","commission_rate":0.09,"status":1},
 {"id":925,"user_id":3536,"building_id":1,"real_name":"QA停职团长","level":"trainee","commission_rate":0.08,"status":2}]

== 探针造/动过的订单 ==
[{"order_no":"AB2026092177921925","user_id":3529,"team_leader_id":1,"building_id":1,"meal_date":"2026-09-22","quantity":2,"status":"paid","balance_used":0,"pay_amount":51.6},
 {"order_no":"AB2026092163224880","user_id":3533,"team_leader_id":1,"building_id":1,"meal_date":"2026-09-22","quantity":2,"status":"pending_pay","balance_used":30,"pay_amount":21.6},
 {"order_no":"AB2026092146669633","user_id":3537,"meal_date":"2026-09-22","status":"cancelled"},
 {"order_no":"AB2026092167263387","user_id":3537,"meal_date":"2026-09-22","status":"pending_pay"},   # E-2 取消后重下
 {"order_no":"AB2026092187910879","user_id":3538,"meal_date":"2026-09-19","status":"paid"},          # 回拨构造截单后取消
 {"order_no":"AB2026092176346087","user_id":3539,"meal_date":"2026-09-22","status":"pending_pay"},   # 黑名单 token 仍下单
 {"order_no":"AB2026092143647807","user_id":3532,"team_leader_id":5,"building_id":4,"meal_date":"2026-09-22","status":"pending_pay"},  # 跨楼栋
 {"order_no":"AB2026092156699804","user_id":3534,"team_leader_id":1,"building_id":3,"meal_date":"2026-09-22","status":"pending_pay"}]  # 楼栋 status=2

== 探针余额 ==
[{"user_id":3533,"balance":28,"frozen":30,"total_in":58,"total_out":0},
 {"user_id":3535,"balance":88.88,"frozen":0,"total_in":88.88,"total_out":0}]
# 3533：下单抵扣 30 分 → 可用 58−30=28、冻结 30（freeze 语义正确）

== 配送单 658 复原后 ==
[{"id":658,"meal_date":"2026-09-21","total_quantity":6,"driver_name":"演示·郑师傅","version":2}]
```

> ⚠️ 复原说明：本探针为**测试试验场**，造了若干用户/订单/余额并改过配送单；要回到干净态执行 `node scripts/gate.mjs seed && node scripts/gate.mjs seed:demo` 重跑即可（K03）。

---

## 7. 【追测】K47 出餐确认 → 订单推进 → 履约链（team-lead 指定补测）

- **探针**：`scripts/_probe-k47.mjs`（一次性 · 起服务→全部探测→停服务→退出 · 输出令牌已脱敏）
- **复现**：
  ```bash
  export PATH="/c/Users/herma/.workbuddy/binaries/PortableGit/versions/1.2.0/cmd:/c/Users/herma/.workbuddy/binaries/PortableGit/versions/1.2.0/usr/bin:/c/Windows/System32:$PATH"
  cd "/c/Users/herma/WorkBuddy/ABox小程序/abox-onebox"
  node scripts/_probe-k47.mjs      # 约 40s（含 ts-node 冷编译）
  ```
- **结果**：**断言 16/16 全 PASS，FAIL=0**。→ **K47 判据全部为绿（不是 P1）**。

### 7.1 夹具构造（可复现的关键）
- 目标单：`AB2026092177921925`（user 3529 · 楼群1 · 09-22 · qty2），复位为 `paid`。
- 清空 09-22 的 `ab_supplier_dish_center_daily` 与 `ab_delivery_record`（让截单重生成）。
- ⚠️ **只确认 1 家供应商不够**：`advanceOrdersToCooked` 的「菜到齐」判据 = 该集散中心当日**所有 effective 明细**（应送>0）全部 `confirmed`。本日「集散中心 1」的明细来自 **4 家供应商各一道菜**（套餐 1 = 红烧肉/卤蛋/清炒时蔬/酸辣汤，分别属供应商 1/3/2/4），故 **4 家都确认**、中心才「到齐」。
- 种子里只有 `sanweiwu`（supplier 1）有后台账号 ⇒ 探针**复制一份 sanweiwu 的后台账号**给 supplier 2/3/4（`password_hash` 照抄 → 口令仍 `supplier123`），之后**全程走真接口**逐家确认，不直改订单状态。

### 7.2 逐项断言（原文 actual）

| # | 断言 | 结果 | 原文 actual |
|---|---|---|---|
| A-1 | 截单前订单 = `paid` | PASS | `GET /orders/AB2026092177921925 → code=0 status=paid` |
| B-0 | 截单任务成功 | PASS | `POST /admin/schedule/cutoff/run → code=0 cut.locked=1 plan.createdDetails=4` |
| B-1 | 截单后订单 = `cut_off` | PASS | `status=cut_off` |
| C-1 | 中心1 有 4 行生产明细、初始均未确认 | PASS | `rows=4 statuses=["pending","pending","pending","pending"]` |
| **D-1** | **出餐确认回执报告订单推进** | **PASS** | 4 家依次确认：前 3 家 `orderAdvance.cooked=0`，**第 4 家** `{"cooked":1,"readyCenterCount":1,"readyCenters":[{"centerId":1,"centerName":"集散中心 1（国贸/建外）"}],"stillCutOff":1}` |
| **K47-main** | **出餐确认后订单 = `cooked`** | **PASS（绿）** | `status=cooked` |
| **K44** | 出餐确认原样重复提交不报错 | **PASS** | `code=0 confirmed=0 skipped=1 summary={"submitted":1,"confirmed":0,"skipped":1,"allDone":true}` |
| G-0 | 配送单生成成功 | PASS | `code=0 created=1`（附 warning，见 §7.4） |
| G-1 | 楼群1 配送单 = `pending` | PASS | `id=668 status=pending version=0 qty=2 orderQty=2 breakdown=[{"status":"cooked","orderCount":1,"quantity":2}]` |
| **K15-jump** | 跳级 `pending→en_route` 被拒 | **PASS** | `code=30018 …当前可推进到：已叫车 allowed=["called"]` |
| T8-pre | `pending→called` 成功、订单**刻意不动** | PASS | `code=0 to=called orderTransition=null version=1` |
| **T8** | `en_route` 联动订单 `cooked→delivering` | **PASS** | `code=0 advanced=1 … version=2` |
| K47-T8 | 订单 = `delivering` | PASS | `status=delivering` |
| **T9** | `arrived` 联动订单 `delivering→delivered` | **PASS** | `code=0 advanced=1 actualAt=2026-09-21T11:22:05+08:00` |
| **K47-half** | **送达后订单 = `delivered`（不停在配送中）** | **PASS（绿）** | `status=delivered` |
| L-1 | 终态（已送达）再推进被拒 | PASS | `code=30018 allowed=[]` |

### 7.3 终态复核（停服务后 sqlite 直查，原文）
```
order:        {"order_no":"AB2026092177921925","status":"delivered"}
centerDaily:  sup1/dish1=confirmed, sup2/dish4=confirmed, sup3/dish6=confirmed, sup4/dish7=confirmed
delivery:     {"id":668,"status":"arrived","version":3,"actual_at":"2026-09-21 03:22:05.661"}
```

### 7.4 ⚠️ 顺带观察（**非 K47 缺陷**，记 OBS-7 · P3）
`G-0` 出参 `warning` 原文：
> 「生成配送单时未发现任何「已截单」订单（date=2026-09-22）—— 请确认截单任务是否已执行。份数可能偏小，建议核对后重跑 `cutoff`。」

- 成因：`delivery.service.generateByDate` 的告警判据是 `count(订单 where status='cut_off') == 0`；
  而本探针在 `delivery-generate` **之前**已跑完出餐确认 ⇒ 该单已 `cut_off→cooked` ⇒ 计数为 0 ⇒ 告警**误报**。
- 严重度低（**P3**）：生产跑批顺序是 **截单(T 00:00) → 生成配送单(T 00:30) → 出餐确认(T 09:30)**，
  正常情况下生成配送单时订单仍是 `cut_off`，不触发；只有**手动补跑顺序颠倒**（先 cook-confirm 后 delivery-generate）才会看到这句误导性告警。
- 建议：判据改为「`cut_off` 或更靠后的履约态（cooked/delivering/delivered/completed）任一存在」即视为截单已跑。

---

## 8. 【追测】H5 `?devCode=1002` 换人核验（**接口层替代 + 产物级** · 非真浏览器）

- **探针**：`scripts/_probe-h5-identity.mjs` · **复现**：`node scripts/_probe-h5-identity.mjs`（约 40s）
- **结果**：**断言 9 PASS + 1 INFO，FAIL=0**。
- **⚠️ 性质声明**：本机**未安装任何 headless 浏览器**（`playwright`/`puppeteer` 均 `missing`；`ms-playwright` 缓存为空）⇒ **没有真实渲染页面**。按 team-lead 授权退回**接口层等价验证**，并**额外补做产物级核验**（证明换人机制确实随 H5 产物发布）。

| # | 断言 | 结果 | 原文 actual |
|---|---|---|---|
| H5-1 | 两次不同 devCode 落到不同 user | PASS | `dev:1001→1001 , dev:1002→1002 , dev:newbie→3540` |
| H5-2 | 各自 token 的 `/auth/me` 只回自己 | PASS | `meA(id=1001,building=1,leader=null)` vs `meB(id=1002,building=4,leader=李明)` |
| H5-3 | 换到全新用户无残留 | PASS | `isLeader=false leaderName=null buildingName=null (userId=3540)` |
| H5-4 | 伪造/缺失 token → 401 | PASS | `bogus status=401 code=10002 ; no-token status=401 code=10002` |
| H5-5 | `?devCode=1002` 能取到应用外壳 | PASS | `GET /?devCode=1002 → status=200 hasAppDiv=true` |
| H5-6 | **被服务的 bundle 含换人机制** | PASS | `bundle=/assets/index-BsTPm6vR.js size=239352 devCode=true abox_dev_identity=true clearState=true` |
| H5-7 | bundle 内含 onLaunch 的 devCode 读取+清态分支 | PASS | 取证片段：`/[\?&]devCode=([^&#]+)/.exec(e) … }(e))&&Gv(), Kv().restore(), r_().restore()` |
| H5-8 | 同源代理 `:5280/api/v1/*` 打通后端 | PASS | `GET :5280/api/v1/health → status=200 code=0` |
| H5-9 | 经代理的 `dev:1002` 登录成功（页面真实请求路径） | PASS | `via proxy login code=0 userId=1002（应=1002）` |

**登录返回要点（原文）**
```
[login] dev:1001 → userId=1001 isLeader=true  me.nickname=李明 me.leaderName=null me.buildingName=国贸三期 A 座
[login] dev:1002 → userId=1002 isLeader=true  me.nickname=王芳 me.leaderName=李明 me.buildingName=国贸三期 D 座
[login] dev:newbie → userId=3540 isLeader=false me.nickname=微信用户 me.leaderName=null me.buildingName=null
```

**做法补充**
- 起了一个**只绑 `127.0.0.1`**（`host:'127.0.0.1'`，非 `0.0.0.0`）的静态服务托管既有 `dist-h5`，代理 `/api` 到本地 API（`startStaticApp` + `lib/e2e-server.mjs`）。**未走 `0.0.0.0`**（沙箱对全接口绑定更严；且无浏览器，绑定面越大越无收益）。

**明确未覆盖（如实登记）**
- 真浏览器里「切到『我的』页当面看到昵称从李明变成王芳」、「`localStorage.abox_token` 被 `clearAuthStorage()` 抹掉」——**未验**（无浏览器）。本节只证明：① 服务端对两个 devCode 返回**互不串号**的身份；② 「换人→清旧登录态」那段代码**确实在被服务的 bundle 里**。

---

> **§7 / §8 的探针同属「测试试验场」**：§7 造了 supplier 2/3/4 的后台账号（`qa_sup2/3/4`，口令 `supplier123`）并把 `AB2026092177921925` 推到 `delivered`、中心1 明细置 `confirmed`。要回干净态：`node scripts/gate.mjs seed && node scripts/gate.mjs seed:demo`。
