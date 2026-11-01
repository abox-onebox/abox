# ABox 一盒 · 知识助手「替操作」能力 · 阶段 0 调研

> 调研时间：2026-10-18
> 背景：用户希望后台操作（上架菜品 / 组合套餐 / 分配楼 / 提团长等级）由不懂技术的同事在「知识库（= 知识助手 v4.0）」里用自然语言提出，AI 不仅教操作、更能**替他执行**，同事只补资料。
> 数据来源：`_tmp/kb/`（知识助手构建体系）、`abox-onebox/apps/api-server/src/modules/**`（后台源码，实拉）

---

## 零、结论先行

1. **对象确认**：用户说的「知识库」 = `_tmp/kb/` 构建的**知识助手 v4.0**（已发布应用 `abox-kb`，单文件 HTML + cloud-service LLM），不是 12 个交付物里的文档稿。
2. **可行性：能做，且复用现有架构**——知识助手当操作前台，NestJS 后台当执行大脑（呼应「路线 B 不迁后端」的正确性）。
3. **关键利好**：后台已内置 `super_admin/admin/operator` 角色白名单 + 每个写操作挂 `@OperationLog` 审计；知识助手已有「LLM 翻指令 → 确定性引擎执行」的雏形（问数模块），模式可直接改造成「替操作」。
4. **四个操作权限分两档**：组合套餐 / 分配楼 = `operator` 即可（中低风险）；上架菜品 / 提团长等级 = 方法级收窄到 `super_admin/admin`（高危，涉及供价与佣金费率）。
5. **必须先解决**：权限 token 下发、操作预览+二次确认、跨域 CORS 放行、路径精确（防静默失效红线）。

---

## 一、知识助手 v4.0 现状（已确认）

| 项 | 现状 |
|---|---|
| 形态 | 单文件 HTML（`_app/abox-kb/index.html` + 发布版 `_ABox一盒知识助手v4.0.html`），单文件离线自包含 |
| 云服务用法 | 只用 **LLM API**（CDN 形式 `WorkBuddyCloud.createWorkBuddyCloud`），**未用** Database/Auth/Storage |
| 四个 tab | 问答（RAG+LLM，挂出处）/ 问数（确定性引擎）/ 体检（语料自检）/ 检索（离线） |
| 问数引擎 | LLM 只把用户的话翻成「取数块」，由本地 `calc.js` 引擎确定性执行（连等价 SQL 都给）——**查本地快照，不调后台** |
| 来源校验 | 按 exact Origin 放行，必须从发布域名打开；本地副本只能用检索 |
| 鉴权/身份 | **无用户登录、无身份**——任何人从发布链接打开都是同一身份 |

**改造切入点**：把「问数块」模式扩展为「操作块」——LLM 把自然语言翻成结构化的操作指令，引擎去调后台管理 API，二次确认后执行。知识助手当前无任何用户身份，加「替操作」必须补身份/权限层。

---

## 二、后台可替操作 API 白名单（四操作 · 实拉自源码）

> 通用约束（**AI 调参必须内建**）：
> - 路径前缀必须是 `/admin` 或 `/supplier`，否则 `JwtAuthGuard` 的 ADMIN_SCOPE **静默失效**（变成用户端可访问）——致命红线。
> - 全局 `ValidationPipe` 开 `forbidNonWhitelisted`：DTO 未声明字段直接 `10001`（不是静默忽略），AI 不能瞎加字段。
> - 金额入参用**整数分**（`*Fen`）。
> - 所有写操作已挂 `@OperationLog`，可复用做审计。

### 操作 1：上架 / 维护菜品
| 接口 | 方法 | 权限 | 必填 / 选填 | 雷点 |
|---|---|---|---|---|
| `POST /admin/dishes` 新增商品 | — | `super_admin`/`admin`（**operator 不能**） | 必：supplierId（须存在 50006）、name(≥2字)、category(main/half/veg/soup/staple)、costPriceFen(>0 整数分)；选：description、imageUrl、status(1/0) | 供价逐菜协商（C9），改一个数字就改供应商应付与平台毛利；**换供应商须新建商品**（编辑不含 supplierId） |
| `POST /admin/dishes/batch-status` 批量上下架 | — | `super_admin`/`admin` | 必：ids[]、status(1/0)；选：reason（下架必填） | 有任一 id 不存在整体拒绝（404），不做部分成功 |
| `PUT /admin/dishes/:id` 编辑 | — | `super_admin`/`admin` | 选：name、category、costPriceFen、description、imageUrl、status | 不含 supplierId |

### 操作 2：组合套餐（建模板）
| 接口 | 方法 | 权限 | 必填 / 选填 | 雷点 |
|---|---|---|---|---|
| `POST /admin/meal/templates` 存为模板 | — | 类级 `operator` 即可（方法级未收窄） | 必：name；选：price(元，默认25.8)、kind(meal/fmcg，默认meal)、items[]（itemId+slot 1–5）、sourceSetMealId(另存)、oneLiner、description、coverUrl | **不含 supplierId/costPrice**（由商品反查，防口径漂移）；`meal` 强制「一饭四菜」（slot 主荤/半荤/素菜/汤/主食，机械判据），`fmcg` 不强制；最多 8 项 |
| `PUT /admin/meal/templates/:id` 编辑 | — | 类级 `operator` | 选：name、price、items(整组替换)、kind、status 等 | **items/price 在已被排期引用时冻结 → 30019**；不传=不改，传 null=清空 |

### 操作 3：给楼分配套餐
| 接口 | 方法 | 权限 | 必填 / 选填 | 雷点 |
|---|---|---|---|---|
| `GET /admin/meal/matrix` 日期×楼群矩阵 | — | 类级 `operator` | 选：startDate、endDate(YYYY-MM-DD，跨度≤31天) | **参数名是 startDate/endDate**（传 fromDate/toDate 静默返回 data=null）；无分配的格子 assignmentId=null |
| `POST /admin/meal/assignments` 创建分配 | D2 | 类级 `operator` | 必：mealDate(YYYY-MM-DD)、buildingGroupId、setMealId；选：distributionCenterId | 同一「出餐日×楼群」唯一，重复→**30011**；建出是 pending，需 D4 上架 |
| `POST /admin/meal/assignments/:id/publish` 上架/下架 | D4 | 类级 `operator` | 必：action(publish/unpublish) | **过截单时刻不许上架 → 30013**；下架不设闸（紧急阀）；重复同向幂等 |
| `PUT /admin/meal/assignments/:id` 编辑 | D3 | 类级 `operator` | 选：setMealId、distributionCenterId | **已截单不可改 → 30003**；改日期/楼群须删旧建新 |
| `POST /admin/meal/assignments/copy` 批量复制 | D5 | 类级 `operator` | 必：fromDate、targetDates[](≤14)；选：buildingGroupIds | 不覆盖已存在；已截单目标日跳过 |

### 操作 4：提团长等级 / 团长管理
| 接口 | 方法 | 权限 | 必填 / 选填 | 雷点 |
|---|---|---|---|---|
| `PUT /admin/leaders/:id` 变更团长（D21） | — | **`super_admin`/`admin`**（operator 不能） | 选：level(trainee/formal/gold/chief 见习/正式/金牌/首席)、buildingId、floor；必：reason(≥2字) | **改 level 同步写 commission_rate**（等级是标签、费率才是钱）；改楼目标楼被占→20012；刻意不含 status |
| `POST /admin/leaders` 任命/转交（D20） | — | `super_admin`/`admin` | 必：userId(须已注册)、buildingId、realName、phone、reason；选：level、floor、transferFromLeaderId | 目标楼有在职团长须传 transferFromLeaderId 否则 20012；现任被停职非删除 |
| `POST /admin/leaders/:id/audit` 资质补录（D22） | — | `super_admin`/`admin` | 必：action(suspend/restore/sign_agreement/note)、reason；选：agreementVersion(白名单) | C3 口径：申请即生效无审核，本接口只留痕纠偏 |

---

## 三、权限与审计现状（好消息 · 轮子现成）

- 后台角色：`super_admin` / `admin` / `operator` / `finance` / `viewer` / `supplier`。
- **两级白名单设计已存在**：类级放 `operator`（运营看名录/对账供价），写操作（改等级、新增商品）方法级收窄到 `super_admin`/`admin`——「看得见点不了」正合「替操作」的权限分层需求。
- 每个写操作挂 `@OperationLog({module, action, targetParam})`——**审计留痕现成**，无需从零造。
- `finance`/`viewer`/`supplier` 对团长域/商品写域一律 `10003`（财务不进团长域）。

**对「替操作」的启示**：可给同事一个受限身份，但需注意——用户想要的「上架菜品」「提等级」恰是 `super_admin/admin` 才有的高危权限，现成 `operator` 覆盖不了。需新增一个「授权操作员」子集，或让替操作系统走 admin 令牌 + 二次确认 + 审计兜底。

---

## 四、AI 调用必须内建的雷点（拦路虎 #3 的具体化）

| 雷点 | 表现 | 对策（写进工具调用层，不能靠 AI 临场发挥） |
|---|---|---|
| 截单硬闸 30013 | 分配套餐默认今天撞截单，publish 失败 | 替操作默认显式传「明天」mealDate；返回 30013 时提示改期 |
| matrix 参数名 | 传 fromDate/toDate 静默返回 data=null | 写死 startDate/endDate |
| 同出餐日×楼群唯一 30011 | 重复创建分配被拒 | 先查 matrix 看已分配，再决定新建或改已有 |
| 已截单不可改 30003 | 编辑分配失败 | 先判截单态，提示删旧建新 |
| 改等级联动费率 | 只改 level 不写 rate 会错算佣金 | 引擎只传 level，由后端保证联动（**不要**前端算 rate） |
| 协议版本号白名单 | 手填错版本号失举证价值 | 复用 `LEADER_AGREEMENT_VERSIONS` 白名单 |
| 路径前缀静默失效 | 写错 /admin→/adminx 变用户端可访问 | 工具层内置精确端点常量，禁止拼接 |

---

## 五、落地技术路线（复用问数引擎模式）

```
同事自然语言 → [LLM 翻成「操作块」] → [操作引擎：参数校验+补问+预览]
                                    ↓ 同事确认
                            [调后台管理 API（Bearer token）] → [回执 + 审计]
```

- **操作块** = 复用问数块的「LLM 翻指令 → 引擎执行」结构，只是执行目标从「本地算数」换成「调后台写 API」。
- **参数收集**：缺 supplierId / setMealId / buildingGroupId 等，引擎先反问同事要（如「你要上架到哪个供应商？现有：A/B/C」），或先查列表再让选。
- **预览+确认**：生成「将调用 POST /admin/dishes，参数 {…}，影响：新增商品 X」→ 同事点确认才发请求（高危操作如提等级，确认框再加一级说明）。
- **审计**：每次执行带 `@OperationLog` 同款留痕 + 操作人（同事身份）+ 自然语言原文。

---

## 六、四大拦路虎 · 现状对照

| 拦路虎 | 阶段 0 前判断 | 现状（已核实） | 难度 |
|---|---|---|---|
| 权限 / token | 不能给同事超级令牌 | 角色体系+两级白名单+审计**现成**；但上架/提级恰是 admin 专属，需新增「授权操作员」子集或走 admin 令牌+确认兜底 | 中 |
| 误操作防护 | 必须预览+确认 | 引擎模式天然支持「先预览后执行」；需设计确认 UI + 高危分级 | 中（模式已有） |
| API 雷点 | AI 必踩 | 已逐条列出（§四），写进工具层即可 | 中（已知） |
| 知识助手升级 | 纯问答→带工具调用 | v4.0 已有「LLM翻块→引擎执行」雏形，扩展成本可控；但需补**用户身份层**+**跨域 CORS 放行**（后台须把知识助手发布域名加入 CORS 白名单，否则浏览器拦请求） | 中 |

---

## 七、阶段 1 / 2 / 3 推进建议

- **阶段 1（只生成不执行 · 低风险）**：在知识助手加「操作」tab，AI 输出「操作草稿」（调哪个接口、参数、影响），同事看了说「去执行」才动。先覆盖 operator 即可的操作（组合套餐、分配楼）。
- **阶段 2（确认后真执行）**：接后台 API（需先解决 CORS + 受限 token），白名单 + 预览 + 二次确认，真正写生产。
- **阶段 3（高危审批 + 审计）**：提级/上架等 admin 操作加审批 + 全量操作日志（复用 `@OperationLog`）。

---

## 八、下一步

阶段 0 已完成：知识助手现状 + 后台四操作 API 白名单 + 权限/审计现状 + 雷点 + 落地路线。
待用户拍板后进入阶段 1：先定「授权操作员」身份方案（受限 token vs admin 令牌+确认），再动手改知识助手。
