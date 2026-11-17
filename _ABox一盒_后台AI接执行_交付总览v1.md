# ABox 一盒 ·「后台 AI 接执行」交付总览 v1

> 2026-11-17 收口。范围 = 后台（api + admin），**小程序端 / h5 一行未改**。
> 定位：AI 出结构化卡 → 运营逐卡确认 → 只吐执行清单 + 台账；真动作仍由人去原后台点。
> 状态：2026-11-17 22:36 已上线生产（tag `manual-20261117223132`）；终检 35/35 全绿、投后验收全过。回滚 `./scripts/rollback.sh` → `manual-20261111-194112`。

## 一、六个节点全景（A 已上线 / G M H N P 已上线）

| 节点 | 功能 | 后台页 | 关键端点 | AI 出什么 | 真动作谁做 | 提交 | 状态 |
|---|---|---|---|---|---|---|---|
| A | 套餐模板草稿 | 招募-模板草稿 | `/admin/meal/template-draft/generate` + `/confirm` | 模板 JSON（itemId 白名单） | confirm 真建模板（负责人确认） | `075a93e`（早已上线） | ✅ 生产验收通过（模板 9→9、闸口拦假 id） |
| G | 招募任务卡 | `/recruit/taskcard-draft` | `/admin/recruit-taskcard/generate` + `/confirm` | 缺口楼 + 话术卡 | 运营拿清单去投放申请链接 | `a1e63c3` | ✅ 已上线 |
| M | 用户召回 | `/user/recall-campaign` | `/admin/recall-campaign/preview` + `/confirm` | 复购/流失两档圈人 | confirm 真建券+发券（默认 dryRun=true，负责人二次确认） | `338fb32` | ✅ 已上线 |
| H | 发券策略卡 | `/user/coupon-taskcard` | `/admin/coupon-taskcard/generate` + `/confirm` | 四类券策略卡 | 运营拿清单去券管理页人工发 | `c7d80f8`+`fbf3b38` | ✅ 已上线 |
| N | 团长处置卡 | `/leader/taskcard` | `/admin/leader-taskcard/generate` + `/confirm` | 四类处置卡（含 suspend 红边警示） | 运营拿清单去 D22 人工处置 | `48b58df` | ✅ 已上线 |
| P | 社群排期卡 | `/user/community-taskcard` | `/admin/community-taskcard/generate` + `/confirm` | 一周排期 + 4 档话术 | 运营拿清单去群里手动发 | `0392774` | ✅ 已上线 |

## 二、统一安全模型（五节点同构，红线均写死）

1. **generate / preview 只读**：类级 `@Roles('super_admin','admin','operator')`，operator 可看卡、不写库。
2. **confirm 方法级收紧**：`@Roles('super_admin','admin')`，operator 点不动；前端再叠勾选档位 + ElMessageBox 二次确认 + `canConfirm`。
3. **唯一写点 = `ab_ai_insight` 台账**：skip 也记；同 kind 同日幂等（查 `meta.input`/`meta.payload`）；`actorId` = JWT.sub；confirm 里 `await` 落库。
4. **实时复核闸**：AI 改不动事实字段（楼名/单量/面额/话术合规），确认时服务端用同一纯函数再过一遍；不存在的 id / 非法枚举 / 禁用词一律拦。
5. **金额一律标「测算示例」**，分→元前端换算，页面不可改数字。

### 各自的「绝不」（机械断言已验证，剥注释后无真调用）

| 节点 | 不做什么 |
|---|---|
| G | 不发消息、不建团长、`ref` 恒 null（只给裸申请路径）、AI 不得编造楼名 |
| M | 默认 dryRun；真发也只走既有 confirm；不新增发券入口 |
| H | 全链路不调 `grantBatch`/`createDef`/`grant`，不建券种、不碰用户账户 |
| N | 不调 `leaderAdmin.audit`，不停用、不改状态、不清归属（suspend 卡只提示红边） |
| P | 不调 `sendText`、不发群、不发券、不加好友；话术禁第三方平台名（含**快团团**）/链接口令/既成事实 |

## 三、草稿器自证（本地实测，零副作用）

| 脚本 | selftest | 覆盖要点 |
|---|---|---|
| `gen-recruit-taskcard.mjs` | 8/8 | 编造楼/非法话术/重复/白名单非恒空 |
| `gen-coupon-taskcard.mjs` | 8/8 | 券种 id 白名单、停用券、金额篡改、scope 白名单 |
| `gen-leader-taskcard.mjs` | 9/9 | 编造团长/非法动作/红线话术/缺理由/重复 |
| `gen-community-taskcard.mjs` | 11/11 | 第三方平台名/链接口令/「已经发券了」变体/重复日 |

## 四、最终核验（本轮收口实测）

| 项 | 结果 |
|---|---|
| 全量门禁 `gate.mjs all` | ✅ 35/35 全绿（jest 58 套件/818 测试，三端 build，design:spec/wecom:catalog 在内） |
| DI 对账 `check-di-forfeature.mjs` | ✅ 209 注入点 / 12 全局实体 / 30 模块目录，无遗漏 |
| op 目录解码核对 | ✅ 156 端点；10 条新端点 roles 全对（generate=3、confirm=2） |
| git tracked 残留 | ✅ 无（历史遗留 `??` 文件一律未 add） |
| 端侧零改动 | ✅ 6 commit 未碰 miniprogram / h5 |
| selftest 实跑 | ✅ 8/8、8/8、9/9、11/11 |

## 五、剩余节点为何不做（回源判定，非遗漏）

- **K 风控对账**：只出报告不改账，脚本已能出，接执行无真写动作可接，增量低。
- **J A/B 实验**：连实验实体都没有，新建实体 + 迁移改动最大，风险收益不匹配。
- **F 套餐文案**：与 A 模板页重叠。

## 六、下一步

✅ 2026-11-17 22:36 已投递上线（G+M+H+N+P + 报告中心/口语卡/数据体检/周报，共 10 commit），tag `manual-20261117223132`。
终检 35/35 全绿、启动守护闸 226 路由 13 新端点全映射；投后 8080/8081 ready、13 端点鉴权生效、h5 未重建 ⇒ 小程序零感。
回滚：`cd /opt/abox-onebox && ./scripts/rollback.sh`（回 `manual-20261111-194112`）。详见当日 memory 日志。
