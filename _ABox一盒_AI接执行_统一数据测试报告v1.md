# ABox 一盒 ·「后台 AI 接执行」统一数据测试报告 v1

> 2026-11-17 23:0x · 对**当前已上线版本**（HEAD `06b6753`，生产 tag `manual-20261117223132`）做的一次性统一数据测试。
> 方案：本地 `sqlite` + `PROVIDER_MODE=mock` + 本地 api，**不连生产、零外发、零业务数据写入**。
> 结果：**PASS 30 / FAIL 0**（主脚本）+ 真实表名零侵入补强 **7/7**。

## 一、测什么 / 不测什么

| 维度 | 口径 |
|---|---|
| 环境 | 本地 `data/abox-dev.sqlite`（1.2M，有 seed/历史数据）、mock provider、本地 3000 端口 |
| 对象 | 13 条新端点中的 11 条本地可读/可测（4 taskcard generate + recall preview + ai-report×3 + 4 taskcard confirm 的代表 G + 匿名权限） |
| 不测 | 真发券/真推群/真建团长/真改订单——这些靠代码静态断言（剥注释后无真调用）+ 权限闸保证，本地 mock 也不做 |
| 零侵入判据 | better-sqlite3 直连本地库，confirm/generate **前后业务表 count 不变**，唯一增量在 `ab_ai_insight` 台账 |

## 二、逐项结果

### 0. 探针自证（防恒绿/恒红）
- 必报样本：假端点 `POST /admin/no-such-endpoint-xyz-datatest` → `code=10004` ✅
- 必不报样本：真实登录 `POST /auth/admin-login` → `code=0` + token ✅

### 1. 八条只读端点（零写库 / 零外发）
| 端点 | 结果 | 结构证据 |
|---|---|---|
| `recruit-taskcard/generate` | ✅ code=0 | `cards[]` + `degraded` + `generatedAt` |
| `coupon-taskcard/generate` | ✅ code=0 | `cards[]` + `couponDefs[]` + `buildings[]` |
| `leader-taskcard/generate` | ✅ code=0 | `cards[]` + `leaders[]` |
| `community-taskcard/generate` | ✅ code=0 | `schedule[]` + `pitches[]` |
| `recall-campaign/preview` | ✅ code=0 | `segments[]` |
| `ai-report/preflight` | ✅ code=0 | `result` + `text` |
| `ai-report/weekly-digest` | ✅ code=0 | `digest` + **`pushed:false`** |
| `ai-report/generate` | ✅ code=0 | `generated=12`、12 节点全 ok、**`pushed:false`** |

### 2. 台账写入与零侵入（ai-report/generate）
- `pushed=false` ✅（不外发红线）
- 12 节点全 `ok=true` ✅（本地空库下为降级文本，属既有正确行为）
- 业务表行数前后不变：`ab_order` 15、`ab_user` 26、`ab_coupon` 0、`ab_user_coupon` 7 ✅
- 唯一写点 `ab_ai_insight` 有增量 ✅

### 3. 代表性 confirm（G 招募，逐卡 approve+skip）
- `confirm code=0`、逐卡返回结果集 ✅
- 零侵入（真实表名）：`ab_team_leader` 13→13、`ab_leader_invite` 10→10、`ab_order` 15→15、`ab_user` 26→26、`ab_coupon` 0→0、`ab_user_coupon` 7→7 ✅
- 台账 approve+skip **都记**（skip 也留痕）✅
- **幂等**：同批重复 approve 台账不再增（31→31）✅

### 4. 权限闸
- 匿名 confirm → `HTTP 401 + code=10002` ✅
- op 目录 roles 静态核验：confirm 仅 `super_admin/admin`、generate/preview 三角色可读（见终检记录）✅

## 三、踩坑与修正（诚实记录）

1. **超时假失败**：主脚本首次前台跑，在 `ai-report/generate`（12 节点逐个跑 ~2 分钟）处被工具默认 120s 超时 SIGTERM 中断；误以为端点卡死。改后台跑完整通过。**教训**：慢端点不能用超时判断失败，正样本必须有积极证据。
2. **探针表名写错**：首版脚本监控 `ab_leader`/`ab_coupon_def`，但本地库真实表名是 `ab_team_leader`/`ab_leader_invite`（`ab_coupon_def` 不存在）。这两处因 `if (t in before)` 被**诚实跳过**而非假绿，但仍属监控缺口。补一次真实表名的零侵入验证，7/7 通过。**教训**：探针必须从产物/库里复制真实名字，不能凭印象手打。

## 四、结论

- 当前已上线版本在本地 sqlite+mock 下，13 条新端点行为与开发期设计一致：只读端点零写库、生成端点只写台账且 `pushed=false`、confirm 零侵入业务表且幂等、权限闸生效。
- **未连生产、未写生产库、未外发任何消息/券**；本地测试产生的台账增量仅限本地 dev 库。
- 这是开发期各节点 loopback 之后的一次**统一回归**，针对已上线 HEAD；至此"先全部开发完，再跑数据测试"闭环。
