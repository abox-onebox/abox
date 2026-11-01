# ABox 一盒 · 项目长期事实（纯索引 · 动手前先 Read 分册）

> 分册（`ref/`）：`接口口径` · `缺陷与陷阱` · `工程纪律` · `部署与外网测试` · `资质与合规` · `设计替换` · `进度与留痕` · `商业与单位经济`。
> 留痕写 `YYYY-MM-DD.md`（append-only）。原文归档 `ref/_MEMORY原文归档-20261027.md`。⚠️ 勿删 ref 附录 A/B/C/D。
> ⚑ **根仓 2026-11-01 已建**（`main` · 首 commit `a9820c8` · 849 文件 / pack 97MiB）：
> `abox-onebox/` 与 `_app/abox-kb/` 是 **submodule**（非普通目录），根仓只记 gitlink。
> 代码改动仍在 `abox-onebox/` 内用**它自己的分支**提交并推它自己的远端，别在根仓 `add` 子仓文件。
> 旧说「工作区根 `.git` 是空壳、别在那儿敲 git」**已失效**（空壳改名 `.git-empty-shell-bak-20261101-194425`）。

## 0 速查铁律（最高频）
- 英文名恒为 **ABox**；禁 ABOX/abox。
- 单一套餐：用户表单**只有份数**；禁口味/选餐/备注输入；当日菜单只读展示。
- 交付=团长送到工位；禁「自提」；也禁写成「爬楼/苦力」（顺手带）。
- 招募文案：一屏一次 CTA；收益中性语（禁躺赚/零花钱）；金额标「测算示例」；一栋楼可多团长。
- 改 `packages/shared-types` 后必须 `npm run build`（api 解析 `dist/`）。
- 判「有没有值」用 `Boolean(x)`，**别用 `!== null`**（`undefined !== null` 为 true）。
- TypeORM 不自动转 snake_case ⇒ 多词列必须显式 `name: 'x_y'`。
- 时间三件套：`toBjIso()` / `now()` / `bjDateTime(d,24)`=次日0点。
- 报错一律 `BizException(ErrorCode.*)`（裸 Error 逃过 200+code）；新码须登记 enum+ERROR_MESSAGE。
- 判并发要同时查悲观锁与**乐观锁**（本项目写钱路径用 `version+1` + `where version=:v`）。
- 重构前先查「谁按文件名盯你」+「它盯不盯得到」；判据跟真源改指，不放宽。
- 门禁全绿 ≠ 功能可用；行数登记取 prettier 之后的值。
- ⭐⭐ `@InjectRepository(X)` 必须能在「本模块 + CommonModule」的 `forFeature` 里找到 —— **tsc 与单测都拦不住**（2026-10-27 生产启动即崩）。投递前跑 `node scripts/check-di-forfeature.mjs`。

## 一、业务口径 → `ref/接口口径.md`
- 主体=北京巡礼之年科技；「巡礼之年」不作供应商名。¥25.80/份；T-1 24:00 截单→次日 11:30 达；佣金 8/9/10/12%。
- ⭐⭐ 2026-10-21 路线=**预包装快消品**（不做餐饮自营）⇒ 食品经营许可/EDI/ICP 全不需要。⚠️ 细则**不在** `ref/资质与合规`§第十三（该分册**无第十三章**，旧索引已失效）；现行细则 = 分册 **§十一** + `2026-10-21.md` 留痕。⛔ 分册 §一/§二/§五 仍按 2026-09-16 **旧自营餐饮**口径，**已被取代，引用前必先看 §十一**。
- ⭐⭐ 余额**唯一真源 = `ab_balance`（user_id 维度）**，佣金同表；
  ⛔ `ab_team_leader.balance / total_commission` **只是统计快照，`balance` 列从不更新（恒 0）** ——
  **不可用于展示或判断**。用它判「团长有没有钱」会得到假亏损（2026-10-28 实测踩第二次，见 `ref/接口口径` §真源）。
  用户与团长共用身份；供应商无独立系统。
- 代金券：`ab_coupon`+`ab_user_coupon`，下单自动选最优一张；**退券三处**（自助取消/截单兜底/refund 审批通过）。
  ⭐ 2026-10-29 起可**批量发**（`/admin/coupon/grant-batch`：四种人群 + **先试算后实发** + 幂等键；
  幂等锚 = 唯一索引 `uk_user_coupon_batch_user`，NULL 不受约束故单人可反复发）；
  发错可**回收**（`grants/:id/revoke`）—— ⛔ **只有 `unused` 可撤**（`used` 已随订单抵扣，撤了=白拿）。
  券状态自此三态 `unused/used/revoked`；单批上限 2000；限量按**整批**判。细节见 `2026-10-29.md` §二十五。
- X 盲盒：`ab_order.blind_box_name`，下单随机落库、**送达后揭晓**；**终态（取消/退款）整行消失**；判据真源 `common/utils/blind-box.ts::blindBoxView()`（纯函数+单测），作废态由 `ORDER_TERMINAL_STATUS` 派生。
- 取消核心 `cancel_source`（user/system/leader/admin）。团长协议真源 `leader-agreement.ts` **v1.1**（2026-10-28 法务出具；v1.0 移入历史白名单，勿删）。端上协议 `agreements.ts` version **1.1**。
- ⭐⭐ 门禁 **`admin:coverage`**（`scripts/check-admin-capability-coverage.mjs`，2026-10-30 加，all=**32**）：
  防「**接口做了、页面没做**」—— 后端端点在**任一前端**零引用即报；已知缺口单列 `KNOWN_GAPS`（每次打印、自收紧）。
  代金券批量/回收（10-29）与页面停留读侧（10-30）是同一类缺陷的两次**人工**发现，故立此门禁。
  ✅ **2026-10-30 当日 14 条缺口全部补齐、`KNOWN_GAPS` 已清零**（空表=正常态，新缺口报 `[新增缺口]`、
  补好忘删报 `[缺口已修·请删条目]`）。编号以 `KNOWN_GAPS` 为准：
  **#40 禁止清单 / #42 改口令 / #46 结算账户 / #41 撤回 / #43 filter-options ×3 /
  #44 企微绑定 / #45 六个孤儿方法 / #47 往期菜单**。四条最易再犯的：
  · 改口令与撤回的入口都**不能**放进「仅管理员可见」区（前者被强制改密者进不去业务页，
    后者 operator 撤不了自己提交的单 —— 入口要跟着**谁有权用**走，不是跟着页面分区走）；
  · 结算账户的真缺口是 `form.vue` 三个输入框**填了不提交**（D25 不写那三列），已改只读+指路；
  · 企微绑定**不走 `/api/v1` 前缀**（`setGlobalPrefix` 带 `exclude:['wecom/(.*)']`），
    前端必须显式 `{ baseURL: '' }`，否则 10004 且**不报网络错**、只表现为「点了没反应」；
  · 令牌「不传=不改」与「传 `''`=清空」必须分开（空串不是 nullish，会真写进去）。
  ⚠️ 加门禁后必须 `npm run docs:sync`（文档 `gate-count` 标记由 `gate:parity` 盯）。
- 埋点匿名：`POST /track/page-duration` 只写；`ab_page_track`；180 天清理任务每日 03:30。
  ✅ 2026-10-30 起**有读侧**了：`GET /admin/stats/page-duration`（D77，入参 `range` 仅 today/7d/30d，
  ⚠️ 出参时长字段是 `avgMs/medianMs/maxMs`），后台看板第五页；只有 PV 类指标（匿名无用户维度）。
  ⭐⭐ 纠偏：所谓「库里有 2026-10-27 畸形日期」**是假的、不存在**（计数实测 2026-10-27/07 月均 0 行，
  真实值是合法的 2026-10-27）。别凭印象往注释写「有某脏数据」，写前先取数；**取数用计数不用肉眼读日期串**。

## 二、技术与环境 → `ref/工程纪律.md`
- uni-app+NestJS+MySQL8/Redis7+Vue3；**表 36**（parity 权威，2026-10-29 实 bidirectional 差集为空），旧记的 33 已过期。订单 11 态；只有「明日」可下单。
- ⭐⭐ 数表别用 `grep -oE` 挑文件名/正则手写 —— 本项目已因此误判一次（见 `ref/部署与外网测试` §12.6）：
  ① **必须全仓扫**（实体可住在 `modules/*/` 下，不在 `database/entities/`）；
  ② **`@Entity` 两种写法**都要扫（字符串式 `@Entity('ab_x')` + 对象式 `@Entity({name:'ab_x'})`）；
  ③ `grep -E` **不支持 `\s`**（用 `[ ]*` 或 `grep -P`）。
  ⇒ **「没找到」不等于「没有」**：命中 0 时先让探针在已知样本上自证。
- 时间真相=`order-timeline.ts`（`currentTimeline()` 进程单例 ⇒ 一期单 API 实例）；端上时刻一律取响应。
- 后台 DTO 不可直吐实体（DECIMAL 字符串）⇒ `toXxxResult()` 转整数分。
- 判成败一律看 `body.code`；**业务**错误恒 HTTP 200 + `body.code`（⚠️ 2026-10-29 实测校准：
  **鉴权失败 = HTTP 401 + `body.code=10002`，不是 200**；登录时账号密码错 = 200 + `20005`。
  响应外层统一 `{code,message,data,requestId,timestamp}`）。
- 深度测试三层 `all(25)/verify(4)`；动后端须补 `verify`。
- 单测跑法：`apps/api-server` 下 `node ../../node_modules/jest/bin/jest.js test/unit`（jest 配置在包 `package.json`，无独立 config 文件）。⚠️ **全仓无 `order.service` 单测** ⇒ 服务层判据要抽纯函数才有人拦。
- 本机无 Node/pnpm（用托管路径）；`.mjs` 门禁=`node --check`。
- `nest start` 清 dist 撞钩子 ⇒ mv 旧产物→`nest build`→`node dist/main.js`。
- 本地 H5 打本地 api 须在 `apps/api-server/.env` 登记 `CORS_ORIGINS`。

## 三、进度与门禁 → `ref/进度与留痕.md`
- 门禁 35 道（all31+verify4）；四道易漏：`nav:consistency`/`doc:tables`/`gate:parity`/`audit-contract.mjs`。
- 基线重冻=每批收尾必跑（verify-manifest 不在门禁 ⇒ 停更即静默腐烂）。
- 文档真源=工作区根 `ABox一盒*.md`；`abox-onebox/docs/` 是 sync-docs 产物。
- 未收口：F-10 写钱路径闸 · #80/#81 · D-1 `getNumber` fallback · 供应商「我的菜品」页 ·
  `lastRun.tip` 写「最近一次**自动**对账」却用于 manual 补跑（trigger 有值没进文案）。
- ✅ 已修（`2de5dd4`，2026-10-29 部署）：对账误报不平 —— 当日付当日退的流水现按订单维度剔除
  （判据纯函数 `common/utils/reconciliation-refund.ts`：**已退款 且 订单不在当日已付款清单**才剔；
  只剔金额口径与「流水→订单」检测，**重复交易号仍看全量**）。剔除后 `logFen` ≠ 流水原额，
  故出参 `refundDroppedTip` 非空必展示。
- ⭐ 未收口（合规 · 见 `ref/资质与合规` §十一）：**124 号令已 2026-05-20 施行** ⇒ ① 缺**仅销售预包装食品备案编号**（北京政务平台自助补录）；② 端上**主页面资质公示 + 销售页食品标签展示**未实装；③ 企业食安制度 / 食品安全员 / 日管控周排查月调度未建。
  ✅ 已关闭：「食品销售 vs 食品经营」字样等效疑虑 —— 执照逐字即现行规范条目，前提不成立。

## 四、服务器与部署 → `ref/部署与外网测试.md` §12（冲突时以 §12 为准）
- 腾讯云 `154.8.164.180:/opt/abox-onebox`；**服务器无 .git** ⇒ 投递=`git archive`→scp→`tar xzf`→`deploy.sh --tag manual-<ts>`。
- 投递前铁律 **先 `tsc --noEmit` + `check-di-forfeature.mjs`**；部署前双备份（db+代码）；SSH 断≠失败（看 `.deploy-state`）。
- ⭐ `deploy.sh` **只 build api/admin** ⇒ 前端变更后 h5 要单独 `build h5` + `up -d h5`，否则端上还是旧包。
- 8080=admin、8081=h5，都反代 `/api/`→`api:3000`；**小程序走 8081，h5 容器不能停**。
- 线上 `PROVIDER_MODE=mock`（切 real 会连带换支付 provider ⇒ 缺商户号必挂）。
- 生产库不跑 seed；「明日开团」手动 SOP（祝总禁自动任务，勿建定时）。
- ⭐⭐ 合回 main 前：`git rev-list --count <feat>..main` 须为 0 才 ff；本仓 main 零 merge commit ⇒ `--ff-only`；推完回读 `ls-remote` 并切回原分支。

## 五、小程序端 → `ref/部署与外网测试.md` §8/§11
- 未备案不阻体验版；异地同事走体验版+调试态；必须 `--mode development` 构建，上线重传 production。
- 小程序内不得现第三方平台名/链接/口令；出参永读 `takeout_links`；客服叫法真源 `csEntryLabel(mode)`。

## 六、两端 UI → `ref/设计替换.md`
- 主色 `#6E5435`/`#F6F0E5` 不动；端上只写 `<text class="abi abi-16">{{I.chart}}</text>`，script 段禁 `I.xxx`。
- mp 端禁字体二进制进包（`mp:no-font`）；楷体子集在 `src/assets/fonts/`。

## 七、AI 助手与门户 → `ref/进度与留痕.md`
- 知识助手 `_app/abox-kb`；重发须用户当轮明确要求。门户刷新：`python collect.py && python build.py`（数字禁手写）。

## 八、跨轮纪律 → `ref/缺陷与陷阱.md` 附录 D
- 自己上轮「事实」也要回源复验；专家报告 `文件:行` 会幻觉，必回源。
- Git Bash 转路径 `MSYS_NO_PATHCONV=1`；渲染面零 emoji；改 A 照亮 B。
