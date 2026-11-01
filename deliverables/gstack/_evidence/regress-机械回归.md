# ABox 一盒机械回归报告

## 一、执行结论

| 项目 | 结果 |
| --- | --- |
| 测试日期 | 2026-09-25（UTC+8） |
| 被测仓库 | `C:\Users\herma\WorkBuddy\ABox小程序\abox-onebox` |
| 被测提交 | `92b3df33be9c33db37a5a6f390ef319fc063d717`（`2026-09-22 14:08:16 +0800`） |
| 被测状态 | 未提交工作区，测试前后均为 47 个变更/未跟踪文件；未修改源码、未提交、未重冻基线 |
| Node | `v22.22.2` |
| 测试层级 | Regression / Standard，机械门禁、构建、单测、真实 HTTP e2e |
| `all` | **22/22 绿**，墙钟耗时 6m42s |
| `verify` | **4/4 绿**，墙钟耗时 2m26s |
| 合并唯一门禁 | **26/26 绿** |
| 独立 Jest 复跑 | **7/7 suites，51/51 tests，绿**，21.174s |
| 健康分 | **100/100（仅限本次机械回归范围）** |
| 红项 | **0** |

**结论：本次未提交工作区改动通过既定 26 道机械门禁。未观察到真实失败、`exit=null` 无输出型 EBUSY 假红，亦无需要更新基线才能解释的红项。**

本结论不是生产发布放行：项目一期尚未部署；已知清单 R1–R11（MySQL/Redis 驱动差异、真实微信支付、HTTPS/域名、压测、单实例约束等）仍属于未验证范围。

## 二、运行前核对

### 2.1 `gate.mjs` 别名真源

运行前已读取 `scripts/gate.mjs:384-422`，没有凭记忆猜测：

- `all` 展开为 22 项：
  `shared:types`、`shared:utils`、`lint`、`format`、`typecheck:api`、`typecheck:admin`、`typecheck:mp`、`schema:parity`、`index:parity`、`state:audit`、`route:audit`、`security:scan`、`nav:consistency`、`doc:tables`、`dup:const`、`gate:parity`、`icons:lock`、`design:spec`、`jest`、`build:api`、`build:admin`、`build:mp`。
- `verify` 展开为 4 项：`seed`、`e2e:m1`、`e2e:m2`、`e2e:m3`。
- 门禁定义总数由 `gate:parity` 实测为 29；`all=22`、`verify=4`，CI 覆盖与文档标记一致。

### 2.2 环境垫片

所有 `gate.mjs` 调用均使用：

```bash
PIPEFIX_QUIET=1 NODE_OPTIONS="--require C:/Users/herma/WorkBuddy/ABox小程序/_tmp/gatepipe/pipefix.cjs" node scripts/gate.mjs <alias>
```

每次 Bash 执行前均先补入 PortableGit `cmd`、`usr/bin` 与 `System32` 到 `PATH`。`NODE_OPTIONS` 已穿透到孙进程；本轮无 `status=null`、无 EBUSY、无静默失败。

## 三、逐项红绿清单

### 3.1 `all`（22 项）

| # | 门禁 | 结果 | 耗时 | 覆盖/关键输出 |
| ---: | --- | :---: | ---: | --- |
| 1 | `shared:types` | 绿 | 14.252s | TypeScript 构建退出码 0 |
| 2 | `shared:utils` | 绿 | 4.199s | TypeScript 构建退出码 0 |
| 3 | `lint` | 绿 | 58.228s | ESLint 退出码 0，`--max-warnings 0` |
| 4 | `format` | 绿 | 17.775s | `All matched files use Prettier code style!` |
| 5 | `typecheck:api` | 绿 | 24.871s | `tsc --noEmit` 退出码 0 |
| 6 | `typecheck:admin` | 绿 | 45.390s | `vue-tsc --noEmit` 退出码 0 |
| 7 | `typecheck:mp` | 绿 | 10.832s | `vue-tsc --noEmit -p tsconfig.json` 退出码 0 |
| 8 | `schema:parity` | 绿 | 16.433s | 28 表 / 407 列一致；292 个尺寸维度一致 |
| 9 | `index:parity` | 绿 | 6.398s | 68 个索引逐名逐列一致 |
| 10 | `state:audit` | 绿 | 4.374s | 状态写入全登记、豁免 0、自证 4/4 |
| 11 | `route:audit` | 绿 | 47.831s | 146 个端点均有明确白名单 |
| 12 | `security:scan` | 绿 | 13.101s | FAIL 级命中 0；有 2 项 WARN 待人工确认，不构成门禁红项 |
| 13 | `nav:consistency` | 绿 | 0.402s | 运营 40 授权 ↔ 34 入口（豁免 6）；供应商 6 ↔ 6；自证 9/9 |
| 14 | `doc:tables` | 绿 | 0.407s | 扫描 31 份，表格截断 0 |
| 15 | `dup:const` | 绿 | 0.926s | 真源字面量外溢 0 |
| 16 | `gate:parity` | 绿 | 1.494s | 定义 29；`all` 22；`verify` 4；CI 与文档标记一致 |
| 17 | `icons:lock` | 绿 | 0.499s | 全部规则通过 |
| 18 | `design:spec` | 绿 | 3.209s | 35/35 通过 |
| 19 | `jest` | 绿 | 26.908s | 7/7 suites；51/51 tests |
| 20 | `build:api` | 绿 | 23.137s | Nest 构建退出码 0 |
| 21 | `build:admin` | 绿 | 29.767s | Vite 构建退出码 0；仅有 chunk size 建议 |
| 22 | `build:mp` | 绿 | 29.962s | 小程序构建退出码 0；末行是样式定位信息，非错误 |

`all` 汇总：**通过 22/22，失败 0。**

### 3.2 `verify`（4 项）

`gate.mjs` 自动注入 `ABOX_SHIFT_TO_HOUR=20`、`QUEUE_DRIVER=memory`、`QUEUE_BACKOFF_BASE_MS=20`，并分别使用 e2e 端口 3101/3102/3103。

| # | 门禁 | 结果 | 耗时 | 覆盖/关键输出 |
| ---: | --- | :---: | ---: | --- |
| 1 | `seed` | 绿 | 9.364s | 基础种子完成；测试登录样例可用 |
| 2 | `e2e:m1` | 绿 | 28.872s | **通过 105/105** |
| 3 | `e2e:m2` | 绿 | 23.719s | **通过 128/128** |
| 4 | `e2e:m3` | 绿 | 83.428s | **通过 1110/1110** |

`verify` 汇总：**通过 4/4，失败 0。**

又复跑一次 `node scripts/gate.mjs seed e2e:m1 e2e:m3` 做交叉核对：退出码 0，m1 仍为 105/105、m3 仍为 1110/1110。

#### 3.2.1 断言数「没变」的核对（回答「新增 919 行为什么计数不动」）

不是漏跑，也不是门禁吞掉结果，核对数据如下：

| 项 | 数值 | 说明 |
| --- | ---: | --- |
| `scripts/e2e-m1.mjs` 工作区 `assert(` 调用点 | 105 | 与实测 105/105 完全对齐 |
| `scripts/e2e-m1.mjs` HEAD `assert(` 调用点 | 63 | 说明 HEAD 之上确实新增了 41 个调用点 |
| m1 diff 新增行中的 `assert(` | 41 | 新增断言确实存在 |
| `scripts/e2e-m3.mjs` 工作区 `assert(` 调用点 | 1105 | 实测 1110，多出的 5 条来自循环内重复执行的调用点 |
| `scripts/e2e-m3.mjs` HEAD `assert(` 调用点 | 1060 | 新增 44 个调用点 |
| m3 diff 新增行中的 `assert(` | 44 | 新增断言确实存在 |

判定：m1/m3 的实测总数**已经包含**本次新增的 41 / 44 个断言调用点，故与给定基线数字相同。也就是说给定基线是在这些 e2e 扩充**已落地之后**记录的；本次没有观察到「新增断言被跳过」的证据（`results` 只在 `assert/ok/fail` 里入栈，无静默跳过路径）。若要拿到「改动前后差值」，需要把 e2e 脚本回退到 HEAD 再跑一次 —— 本轮为保持工作区原样，**未做回退**。

#### 3.2.2 e2e 必须先 `seed` 的反证（不是缺陷，是环境前提）

为验证「数字不是靠跳过得来的」，曾不带 `seed` 直接跑 `node scripts/e2e-m1.mjs`（带同样的时钟/队列 env）：结果 **69/91，退出码 1**。失败项集中在 U6/U7/U9/U10 与 U20 前置（`orderNo=undefined`），原因是上一轮 `verify` 留下的脏数据让「同用户同出餐日」重复下单被 `30004` 拦住，后续断言级联拿不到订单号。

这条反证说明两点：① 单跑 e2e 必须先 `seed`，否则会得到与产品无关的环境型假红；② 门禁 `verify` 之所以 105/105，是因为它按 `seed → m1 → m2 → m3` 顺序执行。已按 K 码纪律处理：这是**环境前提**，不记为缺陷。

### 3.3 Jest 独立复跑

| 门禁 | 结果 | 耗时 | 关键输出 |
| --- | :---: | ---: | --- |
| `jest`（独立复跑，不计入 26 道唯一门禁） | 绿 | 21.174s | `Test Suites: 7 passed, 7 total`；`Tests: 51 passed, 51 total` |

独立复跑与 `all` 内 Jest 结果一致，排除了偶发通过。

## 四、与给定基线逐项比对

| 指标 | 给定基线 | 本次实测 | 变化 | 判定 |
| --- | ---: | ---: | ---: | --- |
| `all` | 22/22 | 22/22 | 0 | 稳定 |
| `verify` | 4/4 | 4/4 | 0 | 稳定 |
| 合计唯一门禁 | 26/26 | 26/26 | 0 | 稳定 |
| `e2e:m1` | 105/105 | 105/105 | 0 | **断言数未变** |
| `e2e:m2` | 128/128 | 128/128 | 0 | **断言数未变** |
| `e2e:m3` | 1110/1110 | 1110/1110 | 0 | **断言数未变** |
| Jest tests | 45 | 51/51 | +6 | 达到给定目标 51 |
| Jest suites | 原 5 个既有 spec，另说明新增 2 个 | 7/7 | +2 | 新增 `dish-rating-agg.spec.ts`、`message-reach.spec.ts` 均被收集并通过 |
| 冻结清单 | 338/338 | 未重跑 | — | 本轮被测对象是刻意未提交的 47 文件工作区；`verify-manifest` 不属于 `all/verify`，且对脏工作区执行会按设计报告哈希/登记差异。本轮遵守要求，未改冻结清单，也不伪报 338/338 |

**门禁项新增情况：** 相比给定基线，`all` 仍为 22 项、`verify` 仍为 4 项，**没有新增门禁名**。新增的是两支 Jest spec；Jest 实测断言总数由 45 增至 51。

**e2e 数字实测说明：** 本次不是凭记忆或转述；`verify` 真实执行了 `seed → e2e:m1 → e2e:m2 → e2e:m3`，且 e2e 子进程带上述时钟/队列环境变量。m1、m3 的实测数字均与基线相同；「为什么新增 919 行而计数不动」的核对见 §3.2.1，结论是实测数已包含新增调用点，不是漏跑。

## 五、红项与性质判定

| 红项 | 性质 | 依据 |
| --- | --- | --- |
| 无 | 不适用 | 26 道唯一门禁全部退出码 0；Jest 独立复跑也退出码 0 |

- `(a) 真缺陷`：0
- `(b) 环境故障伪装`：0
- `(c) 基线该更新`：0
- `exit=null` 且无输出：0

`security:scan` 的“2 项 WARN 待人工确认”和构建日志中的 chunk size 建议均没有令门禁转红，不按失败分类。

## 六、机械证据的盲区（不记为门禁红项，但必须点名）

以下三项都通过了当前门禁与 e2e，却**没有**对应的机械证据。它们是「绿灯不代表验过」的样本，交 T2/T3/T4 继续处置。

1. **`30020` / `30021` 缺 `ERROR_MESSAGE` 映射（已代码级确认）**
   - `ErrorCode.RATING_NOT_ALLOWED = 30020`（`error-code.ts:209`）、`RATING_ALREADY_SUBMITTED = 30021`（同文件 `:223`）**都没有**进 `ERROR_MESSAGE`（该表 `:378-458`，末项止于 `SERVICE_UNAVAILABLE`）。
   - 两处抛点都传 `undefined` message（`rating.service.ts:189`、`:201`）。
   - `BizException` 的兜底是 `message ?? ERROR_MESSAGE[code] ?? '业务异常'`（`biz.exception.ts:24`）⇒ 实际返回文案是 **「业务异常」**。
   - `e2e-m1.mjs` 的 U20 只断言 `code === 30020 / 30021`（`:831`、`:873`），**不断言 message**，所以全绿。
   - 性质：与 U19 注销段里 `20015` 的逐条说明文案形成对照 —— 同样是「码对了、文案没了」，但只有后者被断言覆盖。建议补 `message !== '业务异常'` 式断言，否则该类缺陷恒绿。

2. **F5 编排端点的重复投递在一期不可观测**
   - `wechatTemplateId` 全空 ⇒ 启用闸门拦住 ⇒ `delivered` 恒 0；因此「连发两次结果一样」不能证明没有重复投递，只能证明两次都没发出去。需要等云资源到位后补真机证据。

3. **已知项与边界**
   - `security:scan` 的 2 项 WARN 待人工确认；当前门禁判据只看 FAIL 级，不阻断。
   - 冻结清单 338/338 未重跑、未修改（理由见第四节）。

## 七、已知项核对与范围边界

报结论前已阅读 `_ABox一盒已知项与预期行为清单v1.0.md` 的 K01–K56 与 R1–R11：

- 本轮没有把 K01–K56 中的设计行为误记为缺陷。
- K53 已明确账号注销为应跑通功能；m1 实际回归包含账号注销路径且整套 105/105 通过。
- 本轮是机械回归，不覆盖 R1–R11 所列的真机 Docker、生产 MySQL 迁移实跑、Redis 驱动、真实微信支付、HTTPS/域名、压测、运维 cron 等外部条件。
- 本轮未做额外视觉校验；网页/小程序相关部分以编译、静态门禁和 e2e 冒烟为准。

## 八、行动项（按优先级）

1. **P0/P1/P2 缺陷修复：无。**
2. **发布前阻塞项：** 继续按 R1–R11 做真实部署环境验证；当前全绿不能替代生产放行。
3. **人工确认：** 后续专项审查应展开 `security:scan` 的 2 项 WARN；本轮没有证据把它们升级为缺陷。
5. **补机械证据（不属本轮缺陷，属覆盖率缺口）：** U20 增加 `message` 断言（现状只断言 `code`，`30020/30021` 文案缺失因此恒绿）；F5 重复投递待云资源到位后补真机证据。
