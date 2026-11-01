# ABox 一盒 · 替操作「阶段 2 前置」—— CORS 放行 + 身份层设计

> 配套文档：`_ABox一盒_知识助手替操作_阶段0调研.md`（四操作 API 白名单 · 雷点 · 权限现状）
> 本期交付：阶段 1「操作草稿（不执行）」已在知识助手 v4.0 落地（五期 · 操作 tab）。
> 本文只解决**阶段 2 真执行**之前必须就位的两条前置：① 跨域放行；② 身份 / 权限 / 审计。

---

## 零、一句话定位

阶段 1 已经把「AI 把人话翻成操作草稿 + 预览」做完了，**不碰后台、不需要 CORS、不需要身份**。
阶段 2 要「确认后真执行」，**这两条前置一日不到位，确认执行按钮一日不能开**。

---

## 一、CORS 放行（跨域调用后台 API）

### 1.1 为什么突然需要 CORS

阶段 1 不调后台，所以无所谓跨域。阶段 2 要让知识助手（`https://abox-kb.app.workbuddy.host`，WorkBuddy 发布的应用域名）
直接 `fetch` 你的后台管理 API（`api.xunlizhinian.cn` 或线上 `154.8.164.180:8080`），**两个不同源** ⇒ 浏览器按同源策略拦请求，除非后台显式放行。

> 若将来把知识助手 HTML 直接挂在 `admin.xunlizhinian.cn`（后台同一域名）下，就是同源、免 CORS——这是更省事的长期方案，见 §1.4。

### 1.2 放行的精确来源（白名单，禁止通配）

| 来源 | 是否放行 | 说明 |
|---|---|---|
| `https://abox-kb.app.workbuddy.host` | ✅ 必须 | 当前 WorkBuddy 发布域名（即 `CLOUD_CFG.endpoint` 的 origin） |
| 未来自定义域名（如有） | ✅ 追加 | 一旦把应用绑到自有域名，必须把那个 origin 也加进白名单 |
| `*` 通配 | ❌ 禁止 | 配 `*` 又带 `credentials:true` 会被浏览器拒；且等于对全网放开后台写接口，高危 |
| 本地 `file://` / `localhost` | ❌ 不必 | 阶段 1 不执行；阶段 2 执行只能走发布域名，本地副本继续只给检索/草稿 |

### 1.3 后台改动点（NestJS 侧）✅ 已落地（2026-10-18）

实际机制：`app.corsOrigins` 由环境变量 `CORS_ORIGINS` 驱动，`corsOriginOf()` 在生产环境是**严格白名单**。`enableCors` 已用 `credentials:true` + 暴露 `X-Request-Id`。

**已实施的改动**（`apps/api-server/src/main.ts` 的 `corsOriginOf`，在解析 `CORS_ORIGINS` 之后并入知识助手来源）：

```ts
const KB_OPS_ORIGIN = 'https://abox-kb.app.workbuddy.host';
if (!list.includes(KB_OPS_ORIGIN)) list.push(KB_OPS_ORIGIN);
```

> 等价地也可只在服务器 `CORS_ORIGINS` 环境变量追加该域名（纯配置）。代码内置是为保证重新部署即生效、不依赖远程 env。两者取其一即可，不要重复。
> ⚠️ 此改动为**源码级**，需重新部署 api-server 后才对线上生效（只改仓库代码、未部署 = 线上不生效）。

⚠️ **与路径前缀红线是两层**：CORS 是浏览器层、路径前缀 `ADMIN_SCOPE`（只认 `/admin`、`/supplier`）是后端鉴权层。两层都要有——CORS 拦不住 curl，真正的安全边界是后端的角色校验。所以**绝不能用"CORS 已放行"代替权限校验**。

### 1.4 更省事的长期方案（建议优先评估）

把知识助手 HTML 作为静态资源挂到 `admin.xunlizhinian.cn` 下的某个路径（如 `/kb/`），与后台同域 ⇒ 免 CORS、免单独令牌域名管理。代价是要走一遍后台前端的部署/构建流程。若评估成本可接受，**比在 API 层开跨域白名单更干净**。

---

## 二、身份层（谁在操作 · 凭什么执行 · 审计落点）

### 2.1 现状的硬缺口

知识助手**当前没有任何用户登录、没有任何身份**——任何人从发布链接打开都是同一个匿名身份。阶段 1 没关系（不执行）；阶段 2 真执行时，这会变成两个致命问题：

1. **操作人无法定位**：审计日志里找不到"是谁让 AI 上的架"，出事追责无门。
2. **令牌不能下发给前端**：前端代码（单文件 HTML）是公开的，把 admin 超级令牌写进去等于把后台钥匙贴在门上。

### 2.2 两条路线（阶段 0 已对比过，这里落到可执行的细节）

| 方案 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| **A｜新增「授权操作员」受限角色**（推荐） | 后台加一个 `operator_lite` 或复用 `operator` 子集：白名单仅开放套餐/分配类写操作；**上架菜品 / 提团长等级（admin 专属）在阶段 2 仍锁死**，需负责人复核 | 权限最小、误操面最小；复用现有 `FUND_ACTION_ROLES` 两级白名单 | 需动后端加角色 + 签发该角色的 JWT |
| **B｜统一 admin 令牌 + 确认兜底** | 知识助手带 admin 令牌直连；靠预览+二次确认+审计兜底 | 上线快、不动后端角色模型 | admin 权限过大，仅靠"预览确认"挡误操作风险高；令牌泄露=全后台沦陷 |

**建议**：阶段 2 走 **A**。理由——阶段 0 已确认后台 `operator` 角色天然只覆盖套餐/分配（中低风险），admin 专属的高危操作（上架/提级）本来就该走人工复核，不必让 AI 直连 admin。

### 2.3 知识助手侧的身份补录（因助手无登录）

助手本身没有登录态，**执行前必须让同事自报身份**，以便审计：在「操作」tab 的执行确认区加一个**必填「操作人」输入框**（姓名/工号）。该值随请求头或请求体带上，落进 `@OperationLog` 的 `operator` 字段。

> 这是"无登录系统"下的务实折中：宁可多一个输入框，也不能让审计日志里出现"匿名操作员"。

### 2.4 令牌如何安全下发（方案 A 的具体落地）

- 后台为"授权操作员"账号签发**短时效 JWT**（如 2 小时过期，可刷新），`scope` 限定为 `operator` 子集。
- 该 JWT **不写死在前端源码**——改为首次使用由负责人在后台"生成操作员令牌"页签发，同事粘贴进知识助手（存 `localStorage`，随会话过期）。
- 这样即使前端代码公开，泄露的也只是"一个有时效、仅 operator 权限"的令牌，且所有操作全留痕。
- 高危 admin 操作**阶段 2 不开放自动执行**：草稿卡上的"确认执行"对 admin 类操作保持禁用，提示"请有 admin 权限的负责人在后台执行此草稿"。

### 2.5 审计落点（复用现有 `@OperationLog`）

每个执行动作除现有 `module/action/target` 外，**追加三字段**：

- `operator`：同事自报的操作人（§2.3）
- `nlIntent`：同事说的自然语言原文（"给量子大厦5号楼上架明天的新套餐"）
- `opBlock`：阶段 1 生成的**操作块 JSON**（op / 校验后参数 / 风险档），保证"AI 到底想干嘛"可回放

这三条让"AI 替操作"全程可审计、可复现、可追责，也是阶段 3 做高危审批的前提。

---

## 三、阶段 2 执行流程（前置就位后）

```
同事自然语言 → [LLM 翻操作块] → [ops.js 确定性校验+补问] → 预览卡（参数/影响/待补资料）
     ↓ 同事填「操作人」+ 补齐资料 + 点「确认执行」（仅 operator 类可用）
[带受限 JWT + operator 字段 + opBlock] → 后台写 API → 回执 + @OperationLog 留痕
     ↓ admin 类操作在此步仍禁用 → 提示交负责人后台执行
```

关键纪律（写进工具调用层，不靠 AI 临场发挥）：
- **端点绝不从 LLM / 前端拼接**——由 `OPS_CATALOG` 按 `op` 代码内部映射，防"写错 /admin 一个字母静默变用户端可访问"的红线（阶段 0 已列）。
- **必填真实主键（supplierId / setMealId / buildingGroupId 等）AI 不编造**，缺就进 `missing` 让同事补。
- **金额整数分**、**mealDate 默认明天**（规避截单硬闸 30013）、**matrix 参数名 startDate/endDate** 等雷点，已由 `validateOp` 内部处理并在草稿卡预警。

---

## 四、阶段 3（高危审批 + 全量审计，略述）

- 提团长等级 / 上架菜品等 admin 操作：开放"提交申请 → 负责人审批 → 执行"两步走，审批留痕。
- 全量操作日志可视化（谁、何时、自然语言、操作块、回执），导出备查。
- 必要时给"授权操作员"令牌加 IP / 时间段限制。

---

## 五、两项决策（已拍板 · 2026-10-18）

1. **CORS：采用「API 层跨域白名单」**（非挂 admin 同域）。理由：只给 `app.corsOrigins` 追加 KB 发布域名，零代码、可逆、不动小程序；挂同域列为可选后续加固。
2. **身份：方案 A**。受限 `operator` 角色 + 同事自报操作人 + 短时效 JWT 粘贴进助手（不写死源码）；admin 高危操作在助手内始终禁用，交负责人后台执行。

> 决策后已落地「本地侧」阶段 2：知识助手操作 tab 的「确认执行」已升级为 operator 类可点、admin 类锁死，并接通真实 fetch + 审计头（见 `ops.js`）。
> **后台改动进度（2026-10-18）：**
> - **B1 CORS ✅ 已部署并验证**：`main.ts` 并入 `https://abox-kb.app.workbuddy.host`；已 `docker cp` 源码进容器、`tsc` 重编 `dist`、`docker restart abox-api-prod` 重新生效。实测 `GET /health` 带该 Origin → 回 `Access-Control-Allow-Origin: https://abox-kb.app.workbuddy.host`；未知 Origin → 不回该头（默认拒绝）。preflight 因容器 `busybox wget` 不支持 `--method=OPTIONS` 无法在容器内直接验证，但 `enableCors` 未限制 `allowedHeaders`/`methods`，浏览器实际预检会反射放行自定义头 `X-KB-*` 与 POST。⚠️ **持久性**：改动目前落在运行容器 `dist` 的可写层（overlay），`docker restart`/宿主机重启均保留；若日后按镜像重建容器则丢失，需把 `main.ts` 改动提交 `origin/main` 并重建镜像方为永久。
> - **B2 操作员令牌 ✅ 已创建并登录验证**：账号 `operator1`（id=4，role=`operator`，status=1，supplier_id=NULL）已写入生产库 `abox_onebox.ab_admin_user`；用初始口令经 `POST /api/v1/auth/admin-login` 实测返回 `code:0` + JWT（payload `role:operator`，`sub:4`），证明 scrypt 哈希与现有 `hashPassword()` 一致、可正常鉴权。**初始口令：`4b2787f89ff2a083`（请尽快转交同事并促其改密）**。同事登录后把 JWT 粘贴进助手「操作人令牌」框即可。
> - **B3 审计三字段 ✅ 已实现 + 部署 + 验证（2026-10-18 晚）**：`ab_operation_log` 增三可空列 `kb_operator` / `kb_nl_intent` / `kb_op_block`；`OperationLogInterceptor` 从请求头 `X-KB-Operator` / `X-KB-NL` / `X-KB-OpBlock` 读取并入库（`operation-log.service` D56 视图已透出）。迁移文件 `1700000000008-kb-audit-fields.ts` + 生产库 ALTER 脚本 `_tmp/kb/add-oplog-columns.mjs`（幂等）已落库三列。⚠️ **关键修正**：`fetch` 请求头只允许 Latin1，中文等非 ASCII 内容**必须 base64(UTF-8) 编码**——知识助手 `execOp` 已改 `b64u()` 编码三头，后端拦截器 `decodeKbHeader` 解码（纯 ASCII 值回编不一致则回落原值）。验证：operator1 带 base64 三头调 `POST /api/v1/admin/meal/templates`（空 body→400 不建实体），审计行 id=63 三字段正确解码入库（零污染）。KB 已重构建并重新发布（`b64u` 已注入）。
>   注意：`X-KB-*` 头**仅**在知识助手调用时存在，普通后台操作恒为 NULL，向后兼容。
> 以上均仅作用于 `/admin` 作用域，与小程序用户端 `/api` 隔离，**不影响 ABox 一盒小程序**。
