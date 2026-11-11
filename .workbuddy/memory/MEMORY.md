# ABox 一盒 · 项目长期事实（纯索引 · 动手前先 Read 分册）

> 分册（`ref/`）：`接口口径`·`缺陷与陷阱`·`工程纪律`·`部署与外网测试`·`资质与合规`·`设计替换`·`进度与留痕`·`商业与单位经济`·**`企微助手`**。
> 留痕写 `YYYY-MM-DD.md`（append-only）。原文归档 `ref/_MEMORY原文归档-20261027.md`。⚠️ 勿删 ref 附录 A/B/C/D。
> ⚑ 根仓 2026-11-01 建（`main`·首 commit `a9820c8`）：`abox-onebox/` 与 `_app/abox-kb/` 是 **submodule**；代码改动只在 `abox-onebox/` 内提交推它自己远端。旧说「根 `.git` 是空壳」已失效。

## 0 速查铁律
- 英文名恒 **ABox**（禁 ABOX/abox）。单一套餐用户表单**只有份数**；禁口味/选餐/备注。交付=团长送工位，禁「自提/爬楼」。
- 招募文案：一屏一次 CTA、收益中性语、金额标「测算示例」、一栋楼可多团长。
- 改 `packages/shared-types` 后必须 `npm run build`。判「有值」用 `Boolean(x)` 非 `!== null`。
- TypeORM 不转 snake_case ⇒ 多词列显式 `name:'x_y'`。时间三件套：`toBjIso()`/`now()`/`bjDateTime(d,24)`。
- ⭐⭐ **DAO 返回类型≠实体声明**：mysql2 把 `DATE`→JS `Date`、`DECIMAL`→string ⇒ 取到即用 `toBizDateStr()` 归一（走本地分量，绝不用 `toISOString`），比较/解析前必先归一。
- 报错一律 `BizException(ErrorCode.*)`；判并发同时查悲观锁+乐观锁（`version+1`+`where version=:v`）。
- ⭐⭐ `@InjectRepository(X)` 须能在「本模块+CommonModule」`forFeature` 找到，**tsc/单测拦不住** ⇒ 投递前跑 `node scripts/check-di-forfeature.mjs`。

## 一、业务口径 → `ref/接口口径.md`
- 主体=北京巡礼之年科技；¥25.80/份；T-1 24:00 截单→次日 11:30 达；佣金 8/9/10/12%。
- ⭐⭐ 2026-10-21 起=**预包装快消品**（非餐饮自营）⇒ 食安/EDI/ICP 均不需要；细则以分册 **§十一**+`2026-10-21.md` 为准（§一/§二/§五 旧自营口径已废）。
- ⭐⭐ 余额真源=`ab_balance`（user_id 维度）；`ab_team_leader.balance` 只是**恒 0 快照，禁用于展示/判断**。用户与团长共用身份；供应商无独立系统。
- 代金券 `ab_coupon`+`ab_user_coupon` 下单自动选最优；退券三处；仅 `unused` 可批量撤。X 盲盒 `ab_order.blind_box_name` 送达后揭晓、终态整行消失。
- 团长协议 `leader-agreement.ts` **v1.1**（端上 `agreements.ts` v1.1）。门禁 `admin:coverage` 防「接口做了页面没做」，加门禁后须 `npm run docs:sync`。

## 二、技术与环境 → `ref/工程纪律.md`
- uni-app+NestJS+MySQL8/Redis7+Vue3；**表 37**（parity 权威，以 `ALL_ENTITIES` 长度为准，禁 `grep` 手写）。
- ⭐⭐ 数表扫：全仓扫（实体可住 `modules/*/`）、`@Entity` 两种写法都扫、`grep -E` 不支持 `\s`；命中 0 先让探针自证。
- 后台 DTO 经 `toXxxResult()` 转整数分；判成败看 `body.code`（业务错恒 HTTP 200+code；**鉴权失败=401+10002**）。
- 单测：`apps/api-server` 下 `node ../../node_modules/jest/bin/jest.js test/unit`。本机无 Node/pnpm（托管路径）；`.mjs` 门禁用 `node --check`。
- `nest start` 清 dist 撞钩子 ⇒ mv 旧产物→`nest build`→`node dist/main.js`。

## 三、进度与门禁 → `ref/进度与留痕.md`
- 门禁 35 道（`gate.mjs all`）+ `verify` 6 道；易漏 `nav:consistency`/`doc:tables`/`gate:parity`/`audit-contract`。
- ⭐ 改 `gen-wecom-catalog.mjs` 或控制器/DTO 注解后顺序：`format:write`→`gen-wecom-catalog`→`format:write`（产物也要 prettier）。
- ⛔ `gate verify/full` **跨午夜必假红**（只平移小时不动日期）⇒ 别在 23:50 后启动。基线重冻每批收尾必跑。
- 历史缺口（详见分册）：F-10/#80/#81/D-1 已收口；`lastRun.tip` 文案 bug（硬写「自动对账」缺 trigger）仍待修；**124 号令已收口**（2026-11-10 `b069353`，旧说「端上未实装」作废）：`GET /ai-cs/compliance/124` 下发六项资质 + 8 项 GB 7718 标签字段，端上「我的-关于我们」`pages/about/about.vue` 已实装且打进正式包，443 回读 `code=0`。

## 四、部署 → `ref/部署与外网测试.md` §12
- 腾讯云 `154.8.164.180:/opt/abox-onebox`；**服务器无 .git** ⇒ 投递=`git archive`→scp→`tar xzf`→`deploy.sh --tag manual-<ts>`。
- 投递前铁律：`tsc --noEmit` + `check-di-forfeature`；部署前双备份（db+代码）；SSH 断≠失败（看 `.deploy-state`）。
- ⭐ `deploy.sh` **只 build api/admin**；h5 变更须单独 `build h5`+`up -d h5`。8080=admin/8081=h5 反代 `/api/`；小程序走 8081。
- 线上 `PROVIDER_MODE=mock`；生产库不跑 seed；「明日开团」手动 SOP（禁自动定时）。

## 五、小程序端 → §8/§11
- 未备案不阻体验版；须 `--mode development` 构建，上线重传 production。端内禁第三方平台名/链接/口令；出参读 `takeout_links`。

## 六、两端 UI → `ref/设计替换.md`
- 主色 `#6E5435`/`#F6F0E5` 不动；mp 禁字体二进制进包（楷体子集 `src/assets/fonts/`）。
- ✅ **楷体授权待办已收口**（2026-10-07）：源字体已由 `simkai.ttf` 换为霞鹜文楷 LXGW WenKai v1.522（SIL OFL 1.1 可商用可分发）；mp 端 `@font-face` 被条件编译排除、字体不进包。⚠️ 但《提审说明》§十第 6 条仍写「上线前须换字体」，属**文档失真**未同步。
- ⭐ **`design:spec` 门禁第 3 条**：状态原色不作文字色（warning 文字须用 `$c-warn-fg` 而非 `$c-warning`）；B 提交(`8d3f175`)误用已修（`44f7a21`）。

## 六·五、企微操作助手 → `ref/企微助手.md`
- 同事说人话就干活（非文档问答）；端点目录 143 条（`op-catalog.generated.ts`），`wecom:catalog` 盯重生成；可用数引用前先实测。
- 放权=`tier`+`granted_ops`；管理端点挂 `/api/v1/admin/wecom-kb/*`（仅回调免前缀）；新增实体须进 `ALL_ENTITIES`。
- ⭐ **回调已通（2026-11-10 `e983a70`）**：企微后台填 `https://api.xunlizhinian.cn/wecom/kb/callback`；
  **23:03 后台已保存且企微真实握手 `200+18B` 明文回显**（负样本恒 0B）；
  链路 `443 → 8080(admin nginx) → api:3000`，**不是 8081**（h5 无 `/wecom/` 块+有 Cookie 闸门）。
  ⛔ 旧说「收 IP 被阻 ⇒ 只能用 simulate 试跑」已废；`simulate` 仍是零副作用首选入口（真写库）。
- ⭐⭐ 别只修 nginx：**三处叠加缺陷**才导致「GET 握手过、POST 永不回」——
  ①裸路径不在 `forRoutes('*')` 作用域 ②请求体中间件不解析 XML ③`xmlTag` 不剥 CDATA（签名恒不符）。
  详见 `ref/企微助手.md` §九。验收纪律：日志用「增量」定位、正样本须有积极证据、探针复用产物实现。

## 七、AI 助手与门户
- 知识助手 `_app/abox-kb`；门户 `python collect.py && python build.py`。
- **`ab_ai_insight`（第 37 表，2026-11-04 上线）**：本仓首张 ai 表；`AiInsightService.record()` 写库失败不连带 AI 回复失败；后台 4 端点+`stats/ai-insight.vue`。⚠️ 跨模块 DI 坑：B 加 `WecomTokenService` 注入、A 在 `MealModule` 重复声明 ⇒ 启动崩；修复 `55a8488`（`WecomKbModule` export + `MealModule` import）。

## 七·五、AI 社交战略（阿波西）
- 阶段论：工具(N,在做)→社交(下一真窗口)→电商(终局:无人车+AI操盘)。阿波西卡社交位。
- 命名：品牌/操盘AI=**ABox**(英文)；楼层级传话筒=**阿波西**(A+Box中文音译,原"楼灵"因拗口+恐怖感废弃)；口语简称"阿波"。
- 阿波西=可信中继(用户对用户传,非对全楼播)；v1最小信任原型角色卡见 `ref/阿波西-角色卡-v1.md`。
- 战略位:打 no-choice 模型留存命门；用户自愿披露=自造信号；非营收线,先立"可信"(信任不可逆)。

## 八、跨轮纪律
- 上轮「事实」也要回源复验；专家报告 `文件:行` 会幻觉。Git Bash 转路径 `MSYS_NO_PATHCONV=1`；改 A 照亮 B。
