# ABox 一盒 · 多身份黑盒实测 · 缺陷 / 观察清单

- **测试人**：gstack-qa-lead（质量门神） · **时间**：2026-09-21 BJT
- **范围**：单机多身份黑盒实测（9 身份 · 50 项断言）+ **追测 K47 出餐履约链（16 项断言）** + **H5 换人核验（9 项断言）**。
  原始证据见 `deliverables/gstack/_evidence/qa-多身份实测证据.md`（§1–§6 首轮 / §7 K47 / §8 H5）；
  探针 `abox-onebox/scripts/_probe-identities.mjs`、`_probe-k47.mjs`、`_probe-h5-identity.mjs`。
- **防误报**：已逐条对照 `_ABox一盒已知项与预期行为清单v1.0.md`（K01–K56 / R1–R11）。

## 结论速览
- **程序性硬缺陷（接口行为与设计判据相悖）**：**0 条**（三支探针累计 FAIL=0）。
- **设计取舍候选 / 观察项**：**5 条**（OBS-1 … OBS-4、OBS-7；均**未命中 K 码**，交工程判「是不是问题」）。
- **首轮「未测」已补齐**：**K47（§K-7 必测）已追测 = 绿**；**H5 换人**已做「接口层替代 + 产物级」核验（**非真浏览器**）。

| 严重度 | 条数 |
|---|---|
| P0 | 0 |
| P1 | 0 |
| P2 | 1 |
| P3 | 3 |
| 观察项（非缺陷） | 1（OBS-4 命中 K17） |

---

## 一、缺陷 / 观察清单

| # | 严重度 | 类别 | 位置(接口/页面/表) | 现象 | 复现步骤 | 证据(原文片段) | 预期 vs 实际 | 是否命中K码 |
|---|---|---|---|---|---|---|---|---|
| **OBS-1** | **P2** | 业务完整性/状态机 | `GET /home/daily`（`meal.service.ts:222 resolveUserGroup`）· `POST /orders`（`order.service.ts:1264 resolveGroup`）· 表 `ab_building.status` | **楼栋 `status≠1`（待开通/已暂停）的在册住户仍能查看菜单并成功下单**；服务端用户侧全程未读 `ab_building.status`，套餐分配只按楼群(`building_group`)判定，暂停一栋楼 ≠ 该楼停止供餐 | ① `UPDATE ab_user SET building_id=3, team_leader_id=1`（楼3 status=2，属楼群1，楼群1 T日有 active 分配）；② `GET /home/daily` → `code=0 canOrder=true`；③ `POST /orders {mealDate:"2026-09-22",quantity:1}` → 成功 | `N-1 · 下单 code=0 orderNo=AB2026092156699804`；`order.building_id=3`（库复核） | **预期**：后台规格「只有 `status=1` 的楼可开团」应贯通到用户侧 ⇒ 该楼住户 `canOrder=false`／下单被拦；**实际**：`canOrder=true` 且下单成功 | 否（K 码未覆盖此场景） |
| **OBS-2** | **P3** | 鉴权边界（潜在） | 所有受保护端点（`jwt.strategy` / 各 guard）· 表 `ab_user.status` | **用户被置黑名单(`status=2`)后，其已签发的旧 JWT 仍可正常下单**；`ab_user.status` 只在 `POST /auth/login` 校验一次（`auth.service.ts:83-85`），业务端点不复查（7 天有效期内拉黑不生效） | ① 新身份 `dev:qa_black` 登录得 token；② `UPDATE ab_user SET status=2`；③ 用**旧 token** `POST /orders` → 成功 | `L-1 · 下单 code=0 orderNo=AB2026092176346087`；`L-2 · 重新登录 code=20006 USER_DISABLED` | **预期**（若黑名单是有效风控）：拉黑后受保护写操作应即时被拒；**实际**：旧 token 照常下单。⚠️ **当前全仓无「拉黑 ab_user」的后台入口**（`status=2` 仅在种子出现）⇒ 属**潜在隐患**，非线上可触发 | 否 |
| **OBS-3** | **P3** | 数据一致性/业务口径 | `bindInvite`（`auth.service.ts:149`）· `ab_user.building_id` / `team_leader_id` | **允许「跨楼栋绑定」**：用户所在楼 ≠ 其团长所在楼。下单后 **取餐点=用户楼**，而 **佣金归属=跨楼团长**，两者楼栋不一致 | ① 造 `dev:qa_cross`：`building_id=4, team_leader_id=5`（团长#5 在楼2）；② `POST /orders`；③ 查 `ab_order` 与订单详情 | `M-1 · order.building=#4(国贸三期D座) · order.team_leader=#5(陈强@楼2)`；`M-2 · pickup.point=国贸三期D座1楼大堂 · pickup.leaderName=陈强` | **预期**：取决于业务——若团长可发展外楼团员则合理（按现设计：换团长不换楼，**故意**如此）；**实际**：系统放行。**照实记录交工程判**，不判为缺陷 | 否（也与 K18「自动挂靠」口径不同） |
| **OBS-4** | 观察项（非缺陷） | 状态机 | `POST /orders/:orderNo/cancel` + `POST /orders` | **取消订单后，同出餐日可再下一单**（`30004` 查重排除 `cancelled`） | ① 下单+支付 → ② 截单前取消（`cancelled`）→ ③ 同 `mealDate` 再下单 → 成功 | `E-2 · code=0 orderNo=AB2026092167263387` | **预期**：**两种结果都可能对（K17 明示观察项）**；实际=放行 | 命中 **K17**（观察项，**不记缺陷**） |
| **OBS-7** | **P3** | 运维告警误报（口径） | `delivery.service.generateByDate` 的 `warning` 判据 · `POST /admin/schedule/delivery-generate/run` | **若在「生成配送单」之前已跑过出餐确认**，该日订单已全部 `cut_off→cooked`，于是 `count(status='cut_off')==0` 触发告警「未发现任何已截单订单 —— 请确认截单任务是否已执行」，但截单其实跑过（订单只是推进了） | ① 截单 → ② 出餐确认（4 家供应商，订单 `cooked`）→ ③ 跑 `delivery-generate` → 读 `warning` | §7 `G-0`：`warning=「生成配送单时未发现任何「已截单」订单（date=2026-09-22）…」` | **预期**：告警应只在「截单真没跑」时出现；**实际**：正常的「订单已推进」也会触发。⚠️ 生产跑批顺序（截单 00:00 → 配送单 00:30 → 出餐确认 09:30）下**不触发**，仅**手动补跑顺序颠倒**时误导 | 否 |
| **OBS-5** | ~~未测~~ → **已验证（绿）** | 供应商/履约 | `POST /supplier/meal/cook-confirm`（S2）· 订单 T7/T8/T9 | **K47 已补测**：出餐确认后订单 `cut_off→cooked`；链路继续 `cooked→delivering→delivered`；跳级被拒 `30018`；K44 幂等不报错 | `node scripts/_probe-k47.mjs`（16/16 PASS） | §7 全表 | **K47 判据全部满足 ⇒ 绿（非 P1）**；连带半边「送达后停在配送中」也不成立 | **对应 K47（§K-7 必测项）→ 绿** |
| **OBS-6** | ~~未测~~ → **接口层替代 + 产物级（非真浏览器）** | 端上 | `App.vue:47` · `utils/dev-identity.ts` | H5 `?devCode=1002` 换人：**无浏览器可用**，改验「接口层身份隔离 + 被服务 bundle 含换人机制」 | `node scripts/_probe-h5-identity.mjs`（9 PASS + 1 INFO） | §8 全表：`dev:1001→1001 / dev:1002→1002` 互不串号；bundle 含 `devCode`/`abox_dev_identity`/清态分支 | **服务端身份隔离与产物机制均正确**；**真浏览器 UI 动作仍未验**（如实标注） | 否 |

---

## 二、已**正向验证为绿**的关键项（负向证据，同等重要）

> 这些是「本来就该对」的点，实测确认没坏；尤其 §K-7 五条里可测的 4 条**都没有出现真缺陷信号**。

| 项 | 验证结果 | 证据 |
|---|---|---|
| **K16** 「我的」页余额 vs 余额明细 | ✅ 四读点全部 8888 分，**无分叉** | 证据 md §3.5 / H-1,H-2 |
| **K37** 看板 vs 财务概览 | ✅ gmv/purchase/commission/fulfillment/profit **五项逐项相等** | 证据 md §3.6 / O-1 |
| **K35** 跑批「实际注册时刻」 | ✅ 8/8 `registeredCron` 非空 | 证据 md §3.8 / O-2 |
| **K36 反面** 双窗口改配送单 | ✅ 后写者 `30016`，**不是都成功** | 证据 md §3.7 / O-3 |
| 水平越权（读/改/支付他人订单） | ✅ A 对 B 的 `GET/POST cancel/POST pay` 全部 `30010` | F-1~F-3 |
| 非团长访问团长/资金域 | ✅ `/leader/workbench|balance|withdraw` 全 `10003`；无 token `401` | F-4~F-7 |
| 团长身份二次校验（不信 token） | ✅ 停职后**旧 token** 立即 `20003`；停职者登录 `isLeader=false` | I-1~I-3 |
| 一天一单 / 幂等 / 缺 key | ✅ `30004` / `10006+同单号` / `10001` | D-2~D-4 |
| 下单主链 `pending_pay→paid` + 详情时间线 | ✅ paid=true、状态文案=待出餐、时间线 6 节点 | D-1,D-5~D-7 |
| 截单前取消 / 截单后取消 | ✅ 前=`cancelled`+退款发起；后=`40004`+团长联系方式 | E-1,E-3 |
| 团长归属**显示=落库**同判据（含绑停职团长回落） | ✅ U1 `leader.id` == `ab_order.team_leader_id` | D-8, C-3 |
| `leaderName` 只认 `team_leader_id`、不自回退本人 | ✅ 团长1001 的 `leaderName=null` | C-7 |
| 未绑楼栋新用户 | ✅ U1 回 `10004`（不静默放行） | C-2 |
| **K47** 出餐确认 → 订单 `cut_off→cooked` | ✅ **推进为 `cooked`**（第 4 家供应商确认使中心「到齐」后触发） | 证据 md §7 / D-1,K47-main |
| **K44** 出餐确认幂等（原样重提） | ✅ `code=0`、`confirmed=0 / skipped=1`、**不报错** | 证据 md §7 / K44 |
| **K15** 配送单跳级 | ✅ `pending→en_route` 被拒 `30018`（`allowed=["called"]`）；终态再推 `30018` | 证据 md §7 / K15-jump,L-1 |
| **T8/T9** 配送单推进联动订单 | ✅ `en_route→delivering`、`arrived→delivered` 各 `advanced=1` | 证据 md §7 / T8,T9 |
| **K47 连带半边** 送达后不停「配送中」 | ✅ 送达后订单 = `delivered` | 证据 md §7 / K47-half |
| H5 换人（服务端侧） | ✅ `dev:1001/1002/newbie` 身份互不串号；伪造/缺 token 401 | 证据 md §8 / H5-1~H5-4 |
| H5 换人机制在产物内 | ✅ 被服务 bundle 含 `devCode` 解析 / `abox_dev_identity` / 清态分支 | 证据 md §8 / H5-6,H5-7 |

---

## 三、处置建议（给工程 / 主理人）

1. **OBS-1（P2）建议决策**：是否要「暂停/待开通楼栋自动停供」。
   - 若要：在用户侧 `resolveGroup`（`OrderService`/`MealService`）与 `create` 前置加一条 `ab_building.status === 1` 校验（失败文案区分「本楼暂停/待开通」）；或在「暂停楼栋」操作时联动处理其住户（重绑/清 `building_id`）。
   - 若不要：请在《接口规范》/已知项清单中显式登记「用户侧不按楼栋状态限流」为**设计如此**，避免被第三方测试反复记为缺陷。
2. **OBS-2（P3）建议**：`ab_user.status` 的**响应端实时校验**应随「用户拉黑」功能一起做（否则该功能一上线即形同虚设：拉黑只在对方**下次登录**时才生效）。当前无拉黑入口，列为**待随功能补齐**。
3. **OBS-3（P3）建议**：明确「跨楼绑定」是否为合法业务；若是，建议首页/订单详情对「取餐楼 ≠ 团长楼」给一句说明；若否，应在绑定链路加同楼校验。
4. **OBS-4**：K17 观察项，本轮观察到「可再下一单」。按 K17「照实记录交工程判」——**建议工程确认口径**后回写已知项清单。
5. **OBS-5 → 已闭合**：K47 已于追测中验证为**绿**（`node scripts/_probe-k47.mjs`，16/16 PASS），无需再补；连带半边（送达后不停「配送中」）亦绿。
6. **OBS-6 → 部分闭合**：H5 换人已做「接口层 + 产物级」核验（`node scripts/_probe-h5-identity.mjs`，9 PASS），服务端隔离与产物机制均正确。**唯一遗留**：真浏览器里「切到『我的』页当面看昵称变化 + `localStorage` 清态」**未验**（本机无 headless 浏览器）——**建议**在能装浏览器的机器上用 `node scripts/local-test.mjs --only=api,h5` + Playwright 补一次端到端点击验证。
7. **OBS-7（P3）建议**：`delivery-generate` 的「未发现已截单订单」告警判据应从 `status='cut_off'` 放宽为「存在 `cut_off` **及更靠后**履约态（cooked/delivering/delivered/completed）」，避免手动补跑顺序颠倒时误报「截单没跑」。

---

*本清单为 QA 实测所得；命中已知项者不记为缺陷。所有结论均可按证据 md 顶部命令复现。*
