# ABox 一盒 · 替操作「阶段 3」—— 高危审批 + 审计可视化

> 配套：阶段 0 调研 · 阶段 1 草稿（v4.0 已落地）· 阶段 2 前置（B1 CORS / B2 身份 / B3 审计三字段，均已部署 + 固化 `origin/main` c583558）
> 本文只解决 **admin 高危操作的两步走审批** 与 **全量审计可视化**，不涉及 operator 类直执行（阶段 2 已可助手内确认执行）。

---

## 零、前提与硬阻塞（必须先知道）

1. **api 域名未就绪**：`ops.js` 里 `KB_API_BASE='https://api.xunlizhinian.cn'`，但 `nslookup api.xunlizhinian.cn` = NXDOMAIN（域名没解析），线上 api 实际在 `http://154.8.164.180:8080`（裸 IP HTTP）。
   ⇒ **助手侧任何 fetch 后台目前都跑不通**（混合内容/证书/域名全缺）。阶段 3 的「助手提交申请」UI 上线卡域名；**后台实体 + admin-web 审批页 + 审计可视化不依赖域名，可先开发**。
2. **后台无审批流**：grep 命中的"审批"全是退款/提现等既有业务，替操作的「操作申请」需从零建。
3. **B3 三字段已就位**：`ab_operation_log` 的 `kb_operator/kb_nl_intent/kb_op_block` 可直接复用到审批单，保证"AI 到底想干啥"可回放。

---

## 一、目标

- **admin 高危操作不走「甩回后台手工做」，改走「助手/后台提交申请 → 负责人审批 → 执行」两步**，全程留痕。
- **全量操作日志可视化**：谁、何时、自然语言原文、操作块 JSON、回执、审批人，可查可导出。
- **零新增风险面**：复用现有 `AdminGuard` + `@Roles` 两级白名单；审批执行复用既有目标接口（不另写一份业务逻辑）。

---

## 二、数据模型（新实体 `ab_operation_request`）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK | 自增 |
| op_code | varchar(48) | OPS_CATALOG 的 op 代码（如 `change_leader`） |
| op_label | varchar(96) | 操作中文名（冗余存，便于列表展示） |
| risk | enum('operator','admin') | 危险档（本期仅 admin 进审批流） |
| params | json | 校验后的真实参数（不含 `?`/missing，提交前已补齐） |
| status | enum('pending','approved','rejected','executed') | 状态机见 §三 |
| submitter_kb | varchar(64) | 自报操作人（`kb_operator`，来自助手） |
| submitter_admin_id | int NULL | 若是后台手动建单，记建单人 admin_user_id |
| submitter_nl | text NULL | 自然语言原文（`kb_nl_intent`） |
| submitter_op_block | json NULL | 操作块（`kb_op_block`） |
| approver_id | int NULL | 审批人 admin_user_id |
| approved_at | datetime NULL | 审批时间 |
| reject_reason | varchar(255) NULL | 驳回理由 |
| snapshot | json NULL | 执行回执（成功后回填目标接口返回值） |
| created_at / updated_at | datetime | — |

> ⚠️ `ab_operation_request` 与 `ab_operation_log` 是**两条线**：request 是"申请单"（待审/已执行），oplog 是"每一次写操作的审计行"。审批通过后**执行**那一步仍会写一条 `ab_operation_log`（B3 三字段自动带入 request 的 submitter 信息），二者靠 `request_id` 关联（oplog 已有 `snapshot`，可把 `request_id` 塞进 snapshot 或单独加列——见 §六）。

---

## 三、状态机

```
       提交申请
  ───────────────▶  pending
                      │  ① 负责人审批
          ┌───────────┴───────────┐
      驳回 │                       │ 通过
           ▼                       ▼
       rejected                approved ──② 执行（调原目标接口）──▶ executed
           │                       │
           └── 可重新提交新单 ──────┘（executed 不可再改）
```

- **pending**：待审。列表默认展示。
- **approved**：通过但未执行（执行由审批人点"执行"，或自动执行）。
- **executed**：执行成功，snapshot 回填回执。
- **rejected**：驳回，记 reason；不可再执行。

---

## 四、接口设计（全在 `/admin` 作用域，复用 AdminGuard）

| 方法 | 路径 | 类级 Roles | 方法级 Roles | 说明 |
|---|---|---|---|---|
| POST | `/admin/operation-requests` | super_admin,admin,operator | — | 提交申请（助手用 operator 令牌；后台手动建也走这） |
| GET | `/admin/operation-requests` | super_admin,admin,operator | — | 列表（query: status / op_code / 时间），operator 仅看自己 submitter |
| POST | `/admin/operation-requests/:id/approve` | — | super_admin,admin | 审批通过 → 立即调原目标接口执行 → 回填 snapshot → status=executed |
| POST | `/admin/operation-requests/:id/reject` | — | super_admin,admin | 驳回，记 reason |
| GET | `/admin/operation-requests/:id` | super_admin,admin,operator | — | 详情（含 oplog 关联） |

> **关键纪律（复用阶段 0/2 红线）**：approve 时**调原目标接口**，端点由 `op_code` 经服务端内部映射（绝不让 LLM/前端拼 `/admin/xxx`），复用现有 controller 的写方法（如 `LeaderAdminController.appoint/update`），不另写业务。这样"审批执行"与"人工在后台点"走完全相同的代码路径，无双份逻辑。

---

## 五、admin-web 改动（新增审批页 + 审计增强）

1. **新页 `views/system/operation-request/`**：
   - `list.vue`：申请单列表（状态筛选、操作人、自然语言摘要、操作块预览）。
   - `detail.vue`：详情 + 「通过/驳回」按钮（admin 角色可见可点；operator 仅看）。
2. **路由 + 菜单**：`router/routes.ts` 加 `/system/operation-request`；`admin-role.ts` 的 `ADMIN_MENU_KEYS` 加该 key（admin 角色）；**operator 不进审批菜单**（只能提交、不能审批——符合最小权限）。
3. **审计可视化增强**：扩展现有 `/system/operation-log` 列表，新增列展示 `kb_operator / kb_nl_intent / kb_op_block`（B3 已落库），并提供"导出 CSV"。

> ⚠️ 改 `admin-role.ts` 的菜单数组 + `routes.ts` 必须**同步**（现状反复踩"注释对数组漏"的坑），且服务端 `@Roles` 必须同向。

---

## 六、与 B3 审计的关系

- 提交申请时把 `kb_operator/kb_nl_intent/kb_op_block` 写入 `ab_operation_request`（submitter_* 列）。
- approve 执行那一步，拦截器 `X-KB-*` 头由**服务端内部生成**（从 request 行取，不依赖助手头），保证 oplog 也带齐三字段。
- 关联键：在 `ab_operation_log.snapshot` 里写入 `request_id`（或给 oplog 加列，待定——倾向塞 snapshot，避免再动 oplog 表）。

---

## 七、分期（应对域名阻塞）

- **阶段 3-1（先做，不卡域名）**：`ab_operation_request` 实体 + 迁移 + 4 个接口 + admin-web 审批页 + 审计可视化增强。操作申请可由**负责人在后台手动建单**（选 op、填参数、提交），走完整"申请→审批→执行"闭环。即使助手侧没接，admin 高危操作也已规范化、可审计。
- **阶段 3-2（等 api 域名 HTTPS 就绪）**：知识助手侧提交申请 UI（读 OPS_CATALOG 的 admin 类 op → 生成申请草稿 → `POST /admin/operation-requests`），并轮询/查看状态。届时 `KB_API_BASE` 改指向就绪的域名（或阶段 2 方案 D 挂 admin 同域）。

---

## 八、后台改动清单（⚠️ 会动后台，需你确认授权）

1. `database/entities/system.entity.ts`：新增 `OperationRequest` 实体。
2. `database/migrations/1700000000009-operation-request.ts`：建表（幂等）。
3. `modules/admin/operation-request/`：新 controller + service + dto（提交/列表/详情/审批/驳回）。
4. `app.module.ts`：注册新模块。
5. `common/constants/admin-role.ts`：菜单数组加 `/system/operation-request`（admin 角色）。
6. `apps/admin-web`：新审批页 + 路由 + 审计页增强（Vue3 前端，需重新构建后台）。
7. （可选）`ab_operation_log.snapshot` 写入 `request_id`（纯逻辑，不改表）。

> 以上 1–6 全部在 `/admin` 作用域，与小程序用户端 `/api` 隔离，**不影响 ABox 一盒小程序**。

---

## 九、验证计划

- 3-1 完成后：在后台手动建一个 `change_leader` 申请单 → admin 审批通过 → 确认团长等级/费率真变 + oplog 三字段带入 + request 状态=executed。
- 3-2 完成后：助手内对一个 admin 类 op 点"提交申请" → 后台看到 pending → 审批 → 执行。
- 门禁：`all` + `verify`（动后端/角色/菜单必补 `verify`）。

---

## 十、待你拍板

1. 是否同意**分期**（3-1 先动后台 + admin-web，3-2 等域名）？
2. 是否授权我动后台（清单 §八）？
3. api 域名 HTTPS 的推进节奏（这决定 3-2 何时能上线）—— 域名 10-13 购，备案需实名满 3 天，当前约第 5 天，备案号可能还需等待。
4. 审批执行是否**自动执行**（approve 即调接口），还是**approve 后仍要再点一次执行**（两步更稳但多一次点击）？
