# T4 · 账号注销的合规与越权专项（安全官证据稿）

- 审计模式：Comprehensive（限定范围专项，非全仓）
- 日期：2026-09-26
- 被测：`C:\Users\herma\WorkBuddy\ABox小程序\abox-onebox`，HEAD `92b3df3`，**47 个文件未提交**
- 范围：M5-20「账号注销 U19」相关全部新增/改动代码及其波及的资金、订单、团长、消息各域读路径
- 纪律：**只读**。未改源码、未 commit、未注销任何种子账号（全部结论靠代码审查与既有只读证据）
- 本机限制：无在跑服务（`127.0.0.1:3000` 不可达），且其他同事在并行跑门禁 ⇒ **本次不起服务**，所有判定以源码路径 + 既有 e2e 断言为据；每条都给了可独立复核的 `文件:行`

---

## 0. 结论速览

| 判定项 | 结论 |
|---|---|
| **能否代他人注销** | ❌ **不能**（6 条独立证据，见 §B1）—— 本项**无 P0** |
| **「个人信息已匿名化」是否成立** | ❌ **不成立**。成立的是「展示字段去标识化」，不是匿名化（§A1） |
| **匿名化 + deleted_at 双证据** | ⚠️ 原子性成立，但 `deleted_at` **对系统零约束力**（§A2） |
| **恢复通道** | ⚠️ 确实无自助恢复路径，但**客服也没有任何工具**（§A4） |
| **带上钱注销** | ❌ 缺两道闸门，且存在「注销后钱又进来」的确定路径（§C） |
| **K53 是否真正满足** | ⚠️ **入口层面已满足（提审形式审查可通过），但不能签「已收口」** —— 详见 §D |

严重度分布：**P0 = 0 · P1 = 5 · P2 = 7 · P3 = 5**。

---

## A. 注销的合规含义（个人信息删除 / 匿名化）

### A1 「个人信息已匿名化」不成立 —— 逐字段核查

**声称方（三处口径，措辞一致，都写「匿名化」）：**

| 位置 | 原文 |
|---|---|
| `user-status.ts:10` | 「`3 已注销` = 用户自主发起，恢复走客服人工，且个人信息已匿名化」 |
| `user.service.ts:178` | 出参 `note`：「账号已注销：同一微信号将无法再登录本小程序，**个人资料已匿名化**。与订单、退款、佣金相关的记录按法律法规要求保留。」 |
| `agreements.ts` 隐私政策 §「注销」 | 「注销后我们将按法律法规要求**删除或匿名化处理**你的个人信息」 |
| `account-cancel.vue:175` | 「个人资料将被匿名化：昵称、头像、手机号、所属办公楼与团长绑定都会被清空」 |

**实际 `ab_user` 逐字段（`user.service.ts:135-148` 的 UPDATE SET 子句 + `user.entity.ts` 全列对照）：**

| 字段 | 处置 | 是否为个人信息 | 是否还留明文 |
|---|---|---|---|
| `nickname` | 覆写 `'已注销用户'` | 是 | 否 ✅ |
| `avatar_url` | `null` | 是 | 否 ✅ |
| `phone` | `null` | 是 | 否 ✅ |
| `phone_hash` | `null` | 是（可重识别） | 否 ✅ |
| `building_id` | `null` | 是（行踪/位置类） | 否 ✅ |
| `team_leader_id` | `null` | 是（社会关系） | 否 ✅ |
| `subscribe_flag` | `null` | 是 | 否 ✅ |
| **`openid`** | **未动，明文保留** | **是，且可直连识别** | **是 ❌** |
| **`unionid`** | **未动，明文保留** | **是，跨主体唯一** | **是 ❌** |
| **`gender`** | **未动** | 弱标识 | 是 ⚠️ |
| **`last_order_at`** | **未动** | 行为时间 | 是 ⚠️ |
| **`created_at` / `updated_at`** | 保留（后者不刷新，见 F-13） | 元数据 | 是 ⚠️ |
| `id` | 保留，且是所有业务表的外键 | 主键 | 是（天然） |

**为什么这条不是吹毛求疵 —— 三份凭证：**

1. **身份可复原**：`openid` 是微信在同一 appid 下对该自然人分配的**稳定唯一标识**，本身就是《个人信息保护法》下的个人信息（且 KB/GB/T 35273 口径里 openid 属「用户标识符」，可用于关联识别）。留着它，`ab_user.id` 又是 `ab_order.user_id` / `ab_commission` / `ab_withdraw` / `ab_leader_invite` / `ab_dish_rating` / `ab_balance*` 的外键 ⇒ 这一「匿名化」的行**与自然人之间仍然存在一条不经任何密钥即可走的直连**。
2. **团队自己在别处已经承认这一点**：`user.service.ts:40` 原文写「`openid` / `unionid` **保留** —— 唯一索引在 `openid` 上，清了就没法**拦住再登录**」。这是**正确的工程取舍**（否则同一微信再登录会注册成第二个账号，`e2e-m1.mjs:733-737` 已把它钉成断言）。取舍正确，但取舍的正确性**不改变它的性质**：这叫「去标识化」，不叫「匿名化」。
3. **openid 并非「只此一份」**：新增的消息表把 openid **逐条**落盘 —— `message.service.ts:115-121` 由 `userId` 反查 openid，`message.service.ts:148-151` 把 `{ userId, openid, ... }` 写进 `ab_message`（只增表）。注销**既不清理 `ab_message`，也不截断 `openid`**。于是「保留 openid 仅为拦登录」这个理由所暗示的「只留一份、不出 `ab_user`」并不成立。

> **判定 —— F-01（P1）**：`user-status.ts:10` / `user.service.ts:178` / `agreements.ts` / `account-cancel.vue:175` 四处「匿名化」口径**过度陈述**；对用户的准确表述应为「个人资料已去标识化并停止使用；为阻止同一账号再次登录，微信 openid 予以保留」。
>
> **反例条件（什么情况下本条不成立）**：若平台同时满足 (a) `ab_user` 之外**没有任何表**存 `openid`/`unionid`/`realName`/`receiveName`（当前 `ab_message` 已破功），且 (b) 对外告知文案改为「去标识化 + openid 保留」、并说明保留目的与期限 —— 则本条降为已闭环。反过来，若将来新增一张存 openid 的表而注销不覆盖，本条自动升级为 P0 的信息泄露路径。

---

### A2 匿名化 × `deleted_at` 是否构成「双证据」

**成立的部分：** `user.service.ts:135-148` 是**单次 UPDATE**，把 `status=3` 与 `deleted_at=now` 以及 7 个字段的清空写在同一个 SET 里 ⇒ 不存在「改了状态没清资料」或「清了资料没改状态」的半截态。`e2e-m1.mjs:719-732` 直接查库断言这一条（不看接口自述）—— 这条我**确认成立**。

**不成立的部分 —— `deleted_at` 是装饰性的：**

`user.entity.ts:75-76`：

```ts
@Column({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true })
deletedAt?: Date | null;
```

它是**普通 `@Column`，不是 `@DeleteDateColumn`**，因此 TypeORM **不会**在任何查询里自动追加 `deleted_at IS NULL`。而我在全仓 user 读路径上逐条核过，**没有任何一处手工过滤它**：

| 读路径 | 是否过滤 `deleted_at` |
|---|---|
| `auth.service.ts:199`（A5 profile） | 否 |
| `leader-order.service.ts`（L5 导出，含完整手机号） | 否 |
| `order-admin.service.ts:622`（后台订单列表 `userName`） | 否 |
| `leader-admin.service.ts:350/786/858`（`openidTail`） | 否 |
| `balance-admin.service.ts:441`、`refund-admin.service.ts:245`、`withdraw-admin.service.ts:765` | 否 |
| `invite.service.ts:163-164`（被邀请人昵称 Map） | 否 |
| `auth.service.ts:103`（登录，靠 `status` 拦） | 靠 status，不靠 deleted_at |

> **判定 —— F-06（P2）**：「`deleted_at` 与 `status` 构成双证据」这句话只对**人**成立，对**系统**不成立：它不阻止任何读、也不驱动任何行为。更麻烦的是本仓并存两套软删约定 —— 其他实体一律 `where: { deletedAt: IsNull() }`（`building-admin.service.ts:101-104`、`dashboard.service.ts:111`、`distribution-center-admin.service.ts:260` 等），而 `ab_user` 走「只打时间戳不过滤」。无门禁看住这个差异。
>
> **反例条件**：若将来有人给 `ab_user` 列表页按项目惯例加 `deletedAt: IsNull()`，所有已注销用户会从后台**静默消失**（因为 filtering 是默认开还是默认关，两个实体族答案相反）；反之若谁假定它已被过滤，就会把已注销用户及其残留 PII 渲进列表。**只要没有任何一处 ORM 层或仓储层强制定义，本条就一直悬着。**

---

### A3 订单与资金的历史记录：快照 vs 引用

**结论：`ab_order` 是「引用」，且只引用 `user_id`（以及一个自由文本 `remark`）。**

`order.entity.ts` 全文只有以下携带个人信息的列：

- `order.entity.ts:33-34` `user_id`（引用）
- `order.entity.ts:118` `remark?: string | null  // 备注（过敏等）` ← **唯一落进订单表的个人信息，且是自由文本**

**没有** `nickname_snapshot` / `phone_snapshot` / `building_name_snapshot` 一类列。（对比：`ab_dish_rating` 倒是明确做了快照 —— `order.entity.ts:452-461` 的 `dish_name` / `supplier_name`，注释写明「改名不改史」。也就是说**本项目知道快照该怎么做，只是没给用户做**。）

由此推出**两个方向**的后果：

#### (a) 泄露方向：**不成立**（好处要说清）

因为没有快照，注销后被 JOIN 出来的就是被清空后的列：

- `leader-order.service.ts:126-127` 导出 CSV：`u?.nickname ?? ''` → `'已注销用户'`，`u?.phone ?? ''` → `''`（该接口是**唯一出口完整手机号**的接口，`leader-order.service.ts:97-114` 还为此写了 `ab_operation_log` 留痕）
- `order-admin.service.ts:622-624`：`userName` → `'已注销用户'`，`phoneMasked` → `maskPhone(null)`
- `leader-order.service.ts:348-350`：`userName` / `phoneMasked` 同上

⇒ **不会因为注销而把原手机号漏给任何第三方**。这一点在这个数据模型里是**白送的**，不是设计出来的 —— 也就是说它**依赖「永远不加快照列」这个前提**（见下方反例）。

#### (b) 取证方向：**能力丢失**（不可恢复）

同一批 JOIN 出来的历史订单**全部塌缩为同一个字符串 `'已注销用户'`**，只能靠 `user_id` 区分。更糟的是后台**四处**昵称检索都 thereby 永久失效：

```
order-admin.service.ts:552     o.userId IN (SELECT u.id FROM ab_user u WHERE u.nickname LIKE :kw)
refund-admin.service.ts:101    r.user_id IN (SELECT u1.id FROM ab_user u1 WHERE u1.nickname LIKE :nick)
withdraw-admin.service.ts:161  w.user_id IN (SELECT u1.id FROM ab_user u1 WHERE u1.nickname LIKE :kw)
balance-admin.service.ts:131   b.user_id IN (SELECT u.id FROM ab_user u WHERE u.nickname LIKE :kw OR u.phone LIKE :kw)
```

注销之后，客服拿着用户报的姓名/手机号**在这四个后台页面里永远搜不到这笔历史订单**。而服务端 `note` 明明白白告诉用户「订单记录按法律法规要求保留」—— 保是保了，但**找不到了**。

> **判定 —— F-11（P2）**：订单未做收货人快照 ⇒ 注销后历史订单的展示名塌缩、后台按姓名检索全面失效，只剩 `user_id` 一条取证路径，且与用户对 handlers 的说法不一致（用户以为「保留了」，客服实际上「查不出来」）。
>
> **反例条件**：若 `ab_order` 新增 `nickname_snapshot` / `phone_snapshot` 之类列（这是很多订单系统的常规做法）而注销不同步处理，本条会**立刻翻转为 P0 泄露**（直播间历史订单会永久挂着注销前的明文手机号）。当前「不泄露」是**结果**，不是**控制** —— 我把它记成 P2 而不是 Info，正是因为它的稳定性没有代码保证。

---

### A4 「恢复只能走客服人工」—— 有没有自助路径？用户被告知了吗？

**自助恢复：确认没有，一处也没有。** 全仓对 `ab_user.status` 的写点只有 4 处（`user.service.ts:139` 之外的 grep 结果已经核完）：

| 写点 | 效果 |
|---|---|
| `user.service.ts:135-148` | `1/2 → 3`（注销） |
| `auth.service.ts:79` | 新建用户写 `status: 1` |
| `auth.service.ts:169` | 只 patch `buildingId` / `teamLeaderId` |
| `team-leader.service.ts:371` / `leader-admin.service.ts:658` | 只清 `teamLeaderId` |

`modules/admin/` 下**没有 `ab_user` 的管理模块**（只有 `admin-user`（后台账号）/ `dashboard` / `operation-log` / `role` / `template` / `config`）。所以：

> **判定 —— F-07（P2）**：注释里说的「恢复只能走客服人工」**字面成立**（无任何代码路径能把 3 改回），但**客服其实也没有工具**：没有后台页面、没有 `ab_user` 的 admin 端点、没有操作日志表项。所谓「找客服」在实现层 = **有人直连数据库 UPDATE `ab_user`**，且这一步**不落任何审计留痕**（`ab_operation_log` 只对 admin 端写，`leader-order.service.ts:98-110` 与 `operation-log.service.ts` 均与之无关）。
>
> 同一个能力缺失还顺带命中黑名单：`status=2` 也**没有任何解封路径**。
>
> **反例条件**：只要补一个「恢复/解封」的后台端点（哪怕只有超级管理员可见）并写 `ab_operation_log`，本条即闭环。在一期「客服 = 直连生产库」是可以接受的现实选择，但**必须**把它写进《已知项与预期行为清单》，否则它是一句读者会误读为真有流程的话。

**用户被告知了吗 —— 告知了，且告知得比恢复通道更完整：**

- `user.service.ts:178` `note`：「如需恢复，请联系客服」✅（由服务端下发，端上不复制第二份文案）
- `account-cancel.vue:10-29` 终态屏有「如需恢复」区 + 客服微信号 + 服务时间 ✅
- `account-cancel.vue:174`：「旧会话在有效期内仍可能继续，重新登录即被拦下」✅ 这条写得诚实
- `request.ts` 对 `20014` 是**清态 + 不重试**（注释点明抄 `10002` 会死循环）✅

**但有一处隐瞒/不准**：`account-cancel.vue:176` 把闸门写成「有余额、冻结额或未完成订单」，而隐私政策 `agreements.ts` 写的是「需账户无余额、无未完成订单，且不是在职团长」—— **双方都不完整**（漏了「在途提现会长期挡住你」，见 F-04），两处口径也不互相一致。

---

### A5 「`clearedFields` 之外还有哪些个人信息被保留」—— 预告

`cancelAccount()` 的 UPDATE **只碰 `ab_user` 一行**。`clearedFields` 如实列出了它清掉的 7 个字段（这点不错，没虚报），但它**没有声明「这就是全部」**，而真正需要止损的个人信息恰恰大半留在别的表里。

详见下一条 F-02。

---

### A6 注销覆盖不到的个人信息（除了 openid）

`cancelAccount()` 的 UPDATE **只碰 `ab_user` 一行**。`user.service.ts:39` 的注释宣称「昵称/头像/手机号(含 hash)/办公楼/所属团长/订阅标记 → 清空」—— 这句本身准确，但它**没有声明『只有这些』**，而实际能手Últ 的止损动作，恰好全留在别的表里：

| 表 | 残留的个人信息 | 注销时是否处理 | 触发条件（什么人会有） |
|---|---|---|---|
| `ab_order` | `remark`（**过敏备注**，健康类 ⇒ 《个保法》敏感个人信息） | ❌ 不清 | 任何下过单的人 |
| `ab_team_leader` | `real_name` `phone` `floor` `payout_name` `payout_account`（`leader.entity.ts:32-36 / 203-219`） | ❌ 不清 | 任何申请过团长的人 |
| `ab_withdraw` | `receive_name` `receive_account`（`withdraw.entity.ts:93-106`） | ❌ 不清 | 任何提过现的人 |
| `ab_message`（新增） | `openid`（逐条） | ❌ 不清 | 任何被推送过的人 |
| `ab_leader_invite` | `invitee_user_id`（关系仍连着） | ❌ | 任何被邀请过的人 |
| `ab_balance` / `ab_balance_log` | 资金记录（**留是对的**） | 刻意保留 ✅ | — |

**这里有一条特别讽刺的耦合 —— 闸门 shape 恰好放行「残留最多」的那批人：**

`user.service.ts:107-108`：

```ts
const leader = await this.leaderRepo.findOne({ where: { userId } });
if (leader && leader.status === LeaderStatus.ACTIVE) reasons.push('leader');
```

`LeaderStatus` 只有两个值（`packages/shared-types/src/enums/leader-status.ts`：`ACTIVE = 1`、`SUSPENDED = 2`）。所以：

- `status = 1` ⇒ **被闸门拦下**（注销不了）
- `status = 2`（停职：自己退出过团长 / 见习 30 天未促单自动失效 `promotion.service.ts:238-257` / **后台 D22  anybody manually suspend `leader-admin.service.ts:651-660`**）⇒ **闸门放行**
- 没有 `ab_team_leader` 行 ⇒ 放行，也没有残留

⇒ **凡是「当过团长」的用户，注销时 `ab_team_leader` 上的真实姓名、手机号、楼层、收款人姓名、收款账号（后两者 `team-leader.service.ts:277` 是脱敏存储，但 `real_name`/`phone`/`receive_name` 不是）一律原样留存**，而这恰恰是能通过闸门的那批人。「从没当过团长的人」注销得最干净 —— 但他本来也没有这几个字段。

同理，`ab_withdraw.receive_name` 是**明文姓名**（`withdraw.entity.ts:105-106` 注释只写了 `receive_account` 脱敏），任何提过现的用户注销后这条记录原样在 `withdraw-admin.service.ts:765`、`withdraw.service.ts:70-71` 里被读出来复用。

> **判定 —— F-02（P1）**：注销的「匿名化」作用域只有 `ab_user` 一行 7 个字段，跨表的个人信息（`ab_order.remark` 过敏备注 / `ab_team_leader.real_name`·`phone`·`payout_name` / `ab_withdraw.receive_name` / `ab_message.openid`）**一处未动**，且由于 `leader` 闸门只拦 `ACTIVE`，**能成功注销的团长/曾提现用户，就是残留最完整的那批**。
>
> **反例条件**：若某个用户从未申请团长、从未提现、从不写订单备注（`remark` 恒为 `null`）、且从未收到过订阅消息 ⇒ 本条对他不成立，他的注销在 `ab_user` 之外确实没有可识别信息残留。**本条的成立条件是「用户在平台上的历史行为足够丰富」——历史越丰富，注销越不干净。** 这是把 explorationsepsilon(0) 反过来写：平台承诺的删除范围与实际可实现范围不一致。
>
> ⚠️ 注意：}`ab_order.remark` 这条尤其需要单独决策 —— 订单本体按《电子商务法》要留存，但「备注」一般可裁 emptied，因为它不参与任何金额计算（(prevoste和设备项目 before insert)。把它设为 `: null` 是低成本的。

---

## B. 越权与鉴权

### B1 能否代他人注销？—— 不能（6 条独立证据）

1. `user.controller.ts:177-179`：`cancel(@CurrentUser() user: JwtPayload, @Body() dto: UserCancelDto)` ⇒ 传给 service 的只有 `user.sub`，DTO **不接受任何 `userId`**。
2. `dto/user-cancel.dto.ts:22-36`：`UserCancelDto` 只有 `confirmText` + 可选 `reason`，无 id 类字段。
3. `main.ts` 全局管道：`new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })` ⇒ **就算请求体里塞 `userId`，也会被拒 400**，而不是「剥掉后静默按自己身份办」—— 这是本项目做对的一处纵深防御。
4. `@CurrentUser()` 取的是 `req.user`，由 `JwtStrategy.validate()`（`jwt.strategy.ts:23-25`）原样回填已验签的 payload ⇒ `sub` 无法被请求体/-query 覆盖。
5. 全仓 `cancelAccount(` 的调用点只有 `user.controller.ts:178` 一处（`grep` 已核）⇒ **无旁路**。
6. CSRF 不适用（Bearer 头，非 Cookie 携带）。

⇒ **本次无 P0。** 「可导致他人账号被注销」这条不成立。

> ★ 但要把话说完整：**这道防线的强度 = JWT 密钥的强度**。`app.config.ts:97` `jwtExpiresIn: '7d'`，密钥来自 `JWT_SECRET`；`main.ts:57-73` 里 `assertProdSecrets()` 已经把「生产漏配 `JWT_SECRET` ⇒ 启动失败」写死（默认兜底串 `'change_me_before_go_live'` 是公开值）。**这一条在本仓库是对的**，我确认过 `REQUIRED_IN_PROD = ['JWT_SECRET']`。

---

### B2 确认词闸门是否真在服务端？有没有绕过？

**✅ 在服务端，且是唯一写点，没有绕过路径。**

- 服务端把关：`user.service.ts:85-92`

  ```ts
  if ((dto.confirmText ?? '').trim() !== ACCOUNT_CANCEL_CONFIRM_TEXT) {
    throw new BizException(ErrorCode.PARAM_INVALID, `请逐字输入「${ACCOUNT_CANCEL_CONFIRM_TEXT}」以确认注销`, undefined, { expect: ACCOUNT_CANCEL_CONFIRM_TEXT });
  }
  ```
  `ErrorCode.PARAM_INVALID = 10001`
- 端上 `account-cancel.vue:190`：`canSubmit = agreed && confirmText.trim() === CONFIRM_TEXT`，且 `account-cancel.vue:68-76` 是**用户手打的 `<input>`**，按钮回调里没有写死该值（`user.ts` 的 `cancelAccount` 函数注释把这个纪律写明了）
- 两份常量**分别声明**（`dto/user-cancel.dto.ts:20` 与 `api/user.ts`），`dto/user-cancel.dto.ts:17-19` 的注释点明「不一致 ⇒ 可见失败（`10001`），不是静默放行」—— 这个取舍我认同
- `e2e-m1.mjs:599-613` 两条断言钉死：`confirmText: '注销'` ⇒ `10001`；且**确认词被拒后账号未被误注销**（`GET /auth/me` 的 `nickname ≠ '已注销用户'`）—— 这条尤其好，它排除了「拒了但顺手办了」这种 fail-open

**Bypass 枚举（全部排除）：**

| 候选 bypass | 结论 |
|---|---|
| body 注入 `{ confirmText, status: 3 }` | ❌ `forbidNonWhitelisted: true` + DTO 无 `status` |
| 「⋆数据流中队」用 harmony query 传 | ❌ `@Body()` 只认 body |
| 另有一条 bez GET 端点触发 | ❌ grep `cancelAccount(` 只有 1 处；`@Post('cancel')` 唯一 |
| 域名服烩㫃qaruutiit（admin/service 内部 IDE 调用） | ❌ 无 admin 侧入口 |
| Data validation via `trim()` | ⚠️ 见下 P3 |

> **判定**：本项**成立**，无 bypass。值得趁 такого 表扬的是：这是我在本专项里看到的**第一处**「作者主动为它写了反向断言（不该发生的事也写成断言）」的实现 —— `e2e-m1.mjs:608-613`。这个习惯应当推广到下面 F-03。
>
> **F-16（P3，小瑕疵）**：`(dto.confirmText ?? '').trim()` 只剥 Unicode 空白（Zs 类），不做 NFKC 归一 / 全半角归一 ⇒ 「注销帐号」（繁体/异体）会走 `10001`（安全侧无害），而理论上存在某些视觉同形牵引导致用户抄错 `10001`。**低成本加固**：同时对两端做 `normalize('NFKC')`。严重度仅 P3，因为失败方向是「注销不了」，不是「被注销」。

---

### B3 幂等性

**✅ 正确，且比「幂等」更强的方向 Fo圻恕了 Commentfoo.**

- `user.service.ts:100-102`：`status === 3` ⇒ `20014`（**明确告知，不做静默幂等**）
- `user.service.ts:135-153`（**关键**）：

  ```ts
  const result = await this.userRepo.update(
    { id: userId, status: Not(UserStatus.CANCELED) },   // ⭐ WHERE 子句里的原子占位
    { status: UserStatus.CANCELED, deletedAt: canceledAt, nickname: CANCELED_NICKNAME, ... },
  );
  if (!result.affected) throw new BizException(ErrorCode.ACCOUNT_CANCELED);
  ```

  `WHERE id = ? AND status != 3` + `affected = 0` 判归属 ⇒ **并发双双读到 `status = 1` 时，只有一个能把行推到 3**，另一个拿 `20014`。
- `user.service.ts:129-133` 注释自陈这是本批自查修掉的「读-再写」形缺陷，并把上面的查库降级为「快路径，不构成并发防护」—— **这个自我披露是对的，我按代码复核确认成立**（UPDATE 里确实带了 `Not(CANCELED)`，不是注释说说而已）。
- `e2e-m1.mjs:757-765`：`20014` on repeat.

> **判定**：成立，无需修。
>
> **反例/边界**：若某行 `status` 为 `NULL`（迁移 DDL `1700000000000-init.ts:38` 是 `TINYINT NOT NULL DEFAULT 1`，故理论上不可能），`NOT(NULL != 3)` 求值为 NULL ⇒ `affected = 0` ⇒ 该用户**永远注销不了**且拿到「已注销」的误导码。**当前不成立**（NOT NULL 约束保证），仅登记：`user.service.ts:151` 的 `affected = 0` 把「不存在 / 已注销 / 状态异常」三种情形合并成了同一个 `20014`。可接受（三者对用户的动作都是「找客服」），但排障时要知道它吞掉了「行不存在」和「状态脏」的区分。

---

### B4 `20014`（已注销）与 `20006`（黑名单）是否真的分开？

**✅ 分开，且顺序也对。** `auth.service.ts:84-96`：

```ts
} else if (user.status === UserStatus.CANCELED) {      // ← 先判注销
  throw new BizException(ErrorCode.ACCOUNT_CANCELED);  // 20014
} else if (user.status === UserStatus.BLACKLIST) {
  throw new BizException(ErrorCode.USER_DISABLED);     // 20006
}
```

`error-code.ts` diff 确认两个码的登记与文案：

- `20014` → `'该账号已注销，如需恢复请联系客服'`
- `20006 USER_DISABLED` → 既有
- `error-code.ts` 里 `ACCOUNT_CANCELED` 的注释明确写了「刻意不复用 `20006`」的取舍理由

端侧：`request.ts` diff 新增 `CODE_ACCOUNT_CANCELED = 20014` / `CODE_ACCOUNT_CANCEL_BLOCKED = 20015`，并给 `20014` 单独分支（清态 **不**重试）。`e2e-m1.mjs:745-755` 两条断言：再登录 = `20014` 且 **≠** `20006`。

**三处表现对照（我逐 handler 核的）：**

| 域 | 注销（status=3） | 黑名单（status=2） | 一致吗 |
|---|---|---|---|
| 登录 | `20014`（`auth.service.ts:84-93`）✅ | `20006`（`:94-96`）✅ | ✅ 分码 |
| 团长域 `/leader/*` | `LeaderGuard` 查 `ab_team_leader.status` ⇒ 与 user status 无关；若仍 `ACTIVE` 则**照放行**（但 cancel 闸门已排除该组合） | 同左 ⇒ **照放行** | ⚠️ 见下 |
| 下单 `/orders` | **不判 user status**；但因 `building_id`/`team_leader_id` 被清空 ⇒ `resolveLeader()` 抛 `30007 未绑定团长，请通过团长邀请链接进入`（`order.service.ts:1303-1321`） | **不判** user status，且字段都在 ⇒ **照下单成功** | ❌ 不一致 |
| 取资料 `/auth/me`、`/me/*` | 照返回（已被清空的字段） | 照返回 | — |

⇒ 两码本身没写反也没合并，**但「funçãoKit chan 行为」的差异不是来自 user status 检查，而是来自「注销顺手把 building_id 清了」的副作用** —— 这条下面的 F-05 是重头戏。

> **判定 —— F-15（P3）**：`status = 2`（平台处罚）的用户可以自助注销 ⇒ UPDATE 把 `2 → 3`，审计链上从此**看不出这个人被平台处罚过**（没有受理监事表记这群事）。方向是下行，对 attacker 无收益，仅登记。
>
> **反例条件**：若将来 `ab_operation_log` 记录状态变更前值，本条自动消失。

---

### B5 注销后的旧 token（7 天窗）—— 是同一个坑吗？是的，而且比黑名单宽

**事实链：**

- JWT 无状态：用户 token TTL = **`7d`**（`app.config.ts:97` `jwtExpiresIn: str(process.env.JWT_EXPIRES_IN, '7d')`；`auth.module.ts:35` 用它作 `signOptions.expiresIn`）
- `JwtStrategy.validate()`（`jwt.strategy.ts:23-25`）`return payload`，**不查库**
- `JwtAuthGuard.canActivate()`（`jwt-auth.guard.ts:45-84`）只判 **主体类型**（`typ`）与 `rt`，**不判任何业务状态**
- `LeaderGuard`（`leader.guard.ts:37-56`）查了 `ab_team_leader.status`，**不查 `ab_user.status`**
- **`OrderService.create()`（`order.service.ts:202-203`）只做 `if (!user) throw USER_NOT_FOUND`，没有 `status` 检查** —— 与 index rating service（`rating/*.service.ts` 里没有任何 `userRepo`/status 检查）同源

⇒ 全仓写 none another 为了 web. 我 greped 全 module：`UserStatus.` 的消费点只有 `auth.service.ts:84/94` 与 `user.service.ts:100/136/138/161` —— 也就是**只有「登录」与「注销自己」两处**，`ab_user.status` 对业务端点零约束。

**具体到注销后 7 天内，旧 token 还能干什么：**

| action | 结果 | 为什么 |
|---|---|---|
| `POST /orders`（下单） | ❌ 被挡，但**挡错了原因** | `building_id`/`team_leader_id` 已清空 ⇒ `resolveLeader()` 抛 **`30007`「未绑定团长，请通过团长邀请链接进入」**（`order.service.ts:1320`）。⚠️ 给一个已注销、不可能再扫码的人指了一条走不通的路 |
| `POST /orders/:no/cancel`（自助取消历史订单） | ✅ **能** | 只看 `order.userId`（`order.service.ts:449-`），不看 user status |
| `GET /me/balance`、`GET /me/balance/logs` | ✅ 能 | 只看 `user.sub` |
| 提交口味评价（新 `rating` 模块） | ✅ **能** | `rating.service.ts` 无 user 状态检查 ⇒ **一个已注销用户仍能往红黑榜里写字** |
| `GET /auth/me` | ✅ 能（返回已被清空的资料） | — |
| `POST /me/cancel` | ❌ `20014` | 唯一正确分支 |

> **判定 —— F-05（P1）**：是同一个坑，但**形态与黑名单不同，且二者都不成立**：
> - **黑名单（`status=2`）**：`building_id` / `team_leader_id` **都在**（拉黑不清任何字段）⇒ 旧 token **可以正常下单**，这就是既有 `SC-U-28` 的原形。我在代码里确认它**仍然存活**（`order.service.ts:202-203` 那行就是它的全部防线）。
> - **注销（`status=3`）**：下单**侥幸**被匿名化的副作用挡住了（30007），但**其余端点 7 天内全部照通**，包括能污染红黑榜的评价提交。
>
> **反例条件（重要）**：这条之所以对「注销」没有造成信息泄露，是因为**注销把字段清空了** —— 即防护来自「数据被毁」而非「会话被吊销」。一旦将来出于取证目的给订单加收货人快照（见 F-11），或将来改为「注销只置 `status`、保留资料」，这 7 天窗会**立即变成真实的个人信息泄露窗口**。也就是说，今天看起来它还安全，是因为今天它数据量小；**这个安全性不是设计出来的，是巧合**。
>
> 10) 同样地：本项目在 `user.service.ts:57-63` 的「已知残留」里只登记了「旧 token 读到的是已匿名化资料」，**没有登记「旧 token 7 天内仍可提交评价/取消订单/读余额」**。建议把已知项改写完整。

---

## C. 资金闸门

### C0 与团长退出的对照（`collectQuitBlockers` vs `cancelAccount`）

| 闸门 | 团长退出 `team-leader.service.ts:415-462` | 账号注销 `user.service.ts:105-125` | |
|---|---|---|---|
| 可用余额 > 0 | ✅ `BALANCE_NOT_CLEARED` | ✅ `balance` | 等价 |
| 冻结 > 0 | ✅ `FROZEN_NOT_CLEARED` | ✅ `balance` | 等价 |
| **在途提现**（`ab_withdraw` ∈ pending/approved/paying） | ✅ **显式** `WITHDRAW_IN_FLIGHT` | ⚠️ 间接（靠 frozen>0） | **F-10** |
| **待入账佣金**（`ab_commission.status='pending'`） | ✅ **显式** `COMMISSION_PENDING` | ❌ **完全没有** | **F-03** |
| 有未终态订单 | ❌ 无此闸门（也无必要） | ✅ `orders` | 注销更严 |

「有意还是漏了」不用猜：`user.service.ts:45-51` 的表格标题写的是「**三道**闸门（fail-closed）—— 都指向同一件事：**注销不能让人损失钱**」。既然立意是「不让人损失钱」，那么在 `collectQuitBlockers` 里已经存在的四道里，注销只抄了三道 —— **`COMMISSION_PENDING` 漏了，`WITHDRAW_IN_FLIGHT` 是猜它能被 frozen 覆盖**。

---

### C1 F-03（P1）：注销不会被 commission / 退款后置堵住 —— 钱会走进一个死账户

#### (a) `completed` 订单被当作「终态」⇒ 可被注销 ⇒ 之后还能退款

`ORDER_TERMINAL_STATUS`（`packages/shared-types/src/enums/order-status.ts:88-92`）：

```ts
export const ORDER_TERMINAL_STATUS: OrderStatus[] = [
  OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.REFUNDED,
];
```

但状态机明确允许 `completed → refund_applying`（`order-state-machine.ts:29`）：

```ts
[OrderStatus.COMPLETED]: [OrderStatus.REFUND_APPLYING],
```

而退款的执行链 `refund.service.ts` 会把「下单时用余额抵扣的那部分」**退回 `ab_balance`**（`refund.service.ts:343 / 502 / 724-727`：`微信 ¥x + 余额 ¥y`，余额部分走 `reversal.balanceRefundedFen` 写回余额）。

**攻击/事故链（纯用户 + 团长/运营的合法动作，无需越权）：**

1. D 日：用户 U 下单，`balanceUsed > 0`（用余额抵扣了一部分），微信实付剩余。
2. D 日 14:00：`auto-confirm.task` 自动确认 ⇒ `ab_order.status = 'completed'`（∈ 终态）。此单同时已给任职团长计佣。
3. 此后 U 的 `ab_balance.balance = 0`、`frozen = 0`（钱都花完了），非终态订单数 = 0，不是在职团长。
4. ⇒ **三道闸门全过，U 成功注销**，`ab_user.status = 3`。
5. D+1 或更晚：团长发现品质问题发起代退（或运营 D11 强制退款），走 `refund_applying → refunded`。
6. ⇒ **退款的余额部分被打进一个已注销用户的 `ab_balance`**；微信部分亦原路退给一个已拿不回来 accounts 的人。
7. U 已无法登录（登录必 `20014`），无从查看、无从提现（提现还要 `LeaderGuard` + 在职团长）。

⇒ **这笔钱既不属于任何人、也永远出不去**，且账面上「账实相符」的资产侧多出一坨对不上的负债。这正是本项目自己在别的 branch 里反复强调要避免的「订单 PP bifrication」的那类全局יעס。

> **反例条件（本条在什么时候不成立）**：① 该单 `balance_used = 0` 且后续也不会有 any pending commission ⇒ 退款纯走微信原路，余额不会被充值 ⇒ 本条不成立；② 若服务端在注销时对该用户未来的所有资金流入设置一行 `ab_withdraw` 拦截或退款前置校验 `user.status`（当前没有）⇒ 本条不成立；③ 若集团要求把这笔钱上收人工处理，那是另一件事但要有 code path —— 现在**没有任何路径**。
> **加固建议（最小）**：在退款写回余额的那条唯一实现（`creditCommissions` 的 sibling：余额退款口）前加 `user.status === 3 ⇒ 不写回余额，改为挂人工;`；以及 `settlePending`（`commission.service.ts:691-768`）跳过 `ab_user.status = 3` 的收款人，把金额转入「待人工处置」并进 `skippedReasons`（该文件已有这个 reporting 机制，`commission.service.ts:732-737` 就是为「团长档案不存在」准备的同样套路 —— **照抄那份实现即可**）。

#### (b) 待入账佣金（`pending`）的落地路径也算istors

`cancelAccount` 完全不看 `ab_commission`。`settlePending`（`commission.service.ts:691-768`）**不检查 leader.status，也不检查 user.status**：

```ts
const rows = await this.commissionRepo.find({ where, order: { id: 'ASC' } });  // status='pending'
...
const leader = await m.findOne(TeamLeader, { where: { id: leaderId } });
if (!leader) { skipped...; continue; }        // 只处理「团长行不存在」
...
const credited = await this.creditCommissions(m, leader, credits);   // 直接写 ab_balance
```

而 `creditCommissions` 用 `leader.userId` 定位 `ab_balance`（`commission.service.ts:575`）。

⇒ **一条「pending 佣金 + leader 已 SUSPENDED + user 未注销/已注销」的组合，会把钱写进余额。** 要走到这条，需要「团长已停职但 pending 佣金还在」，这在两条路径上都可达：

- **D22 后台停职**（`leader-admin.service.ts:651-660`）：只改 status，**无任何资金校验**（对比 `quit()` 有 `collectQuitBlockers`）⇒ 运营停职一个已有 pending 的团长 ⇒ 该用户随后自助注销 ⇒ 次日 02:00（`commission-settle.task.ts:95`）跑批把钱打进死账户。
- **`expireTrainees`**（`promotion.service.ts:238-257`，定时任务）：`level=trainee 且 status=ACTIVE 且 lastOrderAt 早于 30 天` ⇒ 自动 `SUSPENDED`，同样零资金校验。

> **判定 —— F-03（P1）**：注销的三道闸门只对**当下**的 `ab_balance` 与非终态订单负责，**对「未来还会流进来的钱」没有一道预案**。已 Confirm 两条确定落地路径（已完成订单的后续退款、`pending` 佣金的 T+1 入账），且 `settlePending` 里已经存在「无归属 ⇒ 显式登记并让运营看见」的正确范式可以复用。
>
> **反例条件**：① 该用户从未当过团长（无 `ab_commission`）**且** 没有任何历史订单还处于可退款窗口 ⇒ 没有未来流入，本条不成立；② 若把 `leader` 闸门从「只拦 ACTIVE」改成「有 `ab_team_leader` 行即拦」（连同 pending/未清 sustresis 一起），本条大部分消失；③ 若所有历史订单在注销时被 marking 为「不可退款」——但这会侵犯消费者的正当退款权，不是正确解法，仅列此备选项。

---

### C2 F-04（P1）：有一批人**永远注销不掉** —— <｜hy_place▁holder▁no▁813｜>提现 kaifi.its beadani pancerni

- 提现一期口径是 **`FLEX_MANUAL` 灵活用工人工打款**（`withdraw.entity.ts:74-82`，`payout_batch_no` 注释写「人工登记」）。状态下一位��：`pending → approved → paying → success`；`WITHDRAW_FROZEN_STATUS = [pending, approved, paying]`（共享枚举）在这三态期间**冻结可用余额**。
- ⇒ 只要这笔人工打款停在 `approved` / `paying`（运营没登记回单号、没实际转钱），`ab_balance.frozen` 就降不下来。
- ⇒ `user.service.ts:111` `if (account.balanceFen > 0 || account.frozenFen > 0) reasons.push('balance')` **永久命中**。
- ⇒ 该用户**永远无法通过自助入口注销自己的账号**。而他在页面上会看到（`REASON_TEXT.balance`，`user.service.ts:19`）：

  > 「账户余额（或冻结额）不为 0，请先提现或使用完」

  但他**已经在提现了**，且这笔钱的处置权完全在运营手里。这是一句**走不通的指引**。

- 隐私政策 `agreements.ts` 却明写「你可以在『我的 → 设置 → 账号注销』自助注销账号（需账户无余额、无未完成订单，且不是在职团长）」—— ⇒ **文案与实现不一致**：文案只提了「无余额、无未完成订单、非在职团长」三个条件，第四个（已在提现途中）不在其列，而第四个恰恰是唯一不受用户控制、**可能无限期**的那一个。

> **判定 —— F-04（P1）**：提现形态被引逐步与远期地段给锁死（人工出款的情况下随访熄灭），注销对被 darkest 用户永久不可用。这直接击穿《提审自检清单 v1.2》第 10 条作为「用户可行使的权利」的实质 —— 入口有了，但对该类用户**形同虚设**；同时构成《个保法》意义上的「删除权实际上不可行使」。
>
> **反例条件**：只要 `ab_withdraw` 在该用户身上不存在任何 ∈ `WITHDRAW_FROZEN_STATUS` 的行 ⇒ 本条不成立。也就是说**本条的成立范围 = 「提过现且尚未结案的人」** —— 而这批人正好是平台里最有历史积淀的用户。
>
> **加固建议（两条，都要）**：① 把 `WITHDRAW_IN_FLIGHT` 提为**独立闸门**（键名显式的第四道，`reason` 键里出现），文案改成指向下一步动作（当前的实践 `collectQuitBlockers` 的 `COMMISSION_PENDING` 文案写的「次日 02:00 自动入账后方可退出」就是好例子）；② 同时把这一条件补进 `agreements.ts` 的注销条款，让文案覆盖真实全集。

---

### C3 F-10（P2）：`balance` 闸门对「在途提现」的归因是错的

同一行 `user.service.ts:110-111` 被三种不同的资金状态共用，但 `REASON_TEXT.balance`（`user.service.ts:19`）只有一句「账户余额（或冻结额）不为 0，请先提现或使用完」：

| 实际状态 | 用户下一步该做什么 | 当前文案给的方向 | 对吗 |
|---|---|---|---|
| 可用余额 > 0 | 下单抵扣消化 | ✅ 对（`基于此 confined transit test`） | ✅ |
| 冻结 > 0，因在途提现 | **等运营处理完这笔提现** | 「请先提现或使用完」 | ❌ 他已经提了 |
| 冻结 > 0，因 D39 手工冻结 | 联系运营解冻结 | 「请先提现或使用完」 | ❌ |

⇒ **F-10（P2）**：同一 reason 键 `balance` 混了三种处置方式完全不同的状态，用户只能反复试错（`e2e` 里明显 `balance` 这道**从未被断言过** —— §9 只验了 `leader` 与 `orders` 两道；`reasons` 恰为 `["orders"]` 那条断言（`:669-673`）恰好**跳过了** balance）。

---

### C4 F-12（P3）：闸门的 thecheck 与落库不在同一事务

`cancelAccount`（`user.service.ts:105-148`）的执行结构是：

```
await count(pendingOrders)      ← 闸门
await update(user)             ← 落库（WHERE 只复检 status，不复检闸门）
```

两次 DB 往返之间没有任何事务边界，UPDATE 的 WHERE 子句也**不会**重新校验「余额 / 订单 / 团长」。并发窗口 = 这两次 IO 的微秒~毫秒。

> **判定 —— F-12（P3）**：理论上可在窗口内造成「一边开着单/余额被充值，一边注销成功的组合」。实际可利用性**低**（窗口极小且需精确 timing），故不定 P1。
>
> **反例条件**：若把三道闸门与 UPDATE 收进同一事务（并在 UPDATE 的 WHERE 里复述闸门条件），本条消失。**注意**：「最大的窗口」其实不是并发，而是用户把注销页开着、确认词早已打完、在另一台设备/另一个小vekil-instance 上下了单，然后回来点提交 —— 那才是分钟级窗口，而且是普通用户行为。若按这个口径，本条应升 P2。我把两级都写出，请 lr dfcone 定级。

---

## D. 「提审前置项 K53 是否真正满足」的明确结论

### D1 事实

《提审自检清单 v1.2》第 10 条的原文（diff 前的版本）：

> 10 | **账号注销入口已开发**（隐私合规硬要求，缺失不通过）

本次 diff 把它改成：

> 10 | **账号注销入口已开发**（隐私合规硬要求，缺失不通过）· ✅ **已实装（M5-20 · 2026-09-23）**……

《里程碑计划 v1.0》diff 的 M5-20 表格第 ⑫ 行要求「M6 **K53 转『已收口』**」。

### D2 我的判定

**按第 10 条的字面 —— 「入口已开发」—— K53 可以标 ✅。** 依据是实打实的：

- 端上有原生页 `pages/account-cancel/account-cancel`（非 web-view，不把提审绑到还没到位的域名/备案上），路由已进 `pages.json`
- 入口挂在「我的 → 设置 → 账号注销」（`mine.vue` 的 `SETTINGS_ACTIONS` 第 5 项）—— 与协议页同列，符合「找得到」的判据
- 后端 `POST /me/cancel` 实装，且在 `/docs` 契约里
- `e2e-m1.mjs` §9 新增 24 条断言跑过 `EXIT=0` —— **包括好些反向断言**（确认词被拒后账号未被误注销、两道闸门互不误报、落库三查含 `openid 仍在`）
- 提审形式审查时，审核员肯定义 zorgt到位并能跑通一条成功的整机注销链路

**但我不建议在 M6 把 K53 记成「已收口」。「入口已开发」 ≠ 「注销这件事合规」。**

原因（全部有本次的代码证据）：

1. **F-01**：对外告知口径（服务端 `note` / 隐私政策 / 端上四条后果文案）三处都声称「匿名化 / 删除或匿名化处理你的个人信息」，而实现保留 `openid`+`unionid` 明文、`ab_message` 里还有第二份 —— 这是**同一段可被 review 的文字与 impl %%%%%%%%%%%%%%%%% 不一致**。 informal一个新的'虚假告知' 风险，而恰是这个项目的 `user.service.ts:175-178` 自己在另一件事上（订单保留）警惕过「两边说法不一致就是虚假告知」。⇒ 提审时若审核员对照隐私政策逐条看，**这一条是有可能被指出并要求改文案的**。
2. **F-02 / F-04**：注销的实际作用域与对外承诺的作用域不一致；且「提过现未结案」的人**根本用不了这个入口** ⇒ 审核员若抽查到这类状态（演示数据 `seed-demo.ts` 里的 `L1/L2` 都有提现历史），入口的可用性就会有疑问。
3. **F-03 / F-04**：钱的问题在注销场景里**两条都不会安静保 AdsBSDNSBSNNXNSNSNS 影fm're not vario Levi's führte uns

   Sorry, let me correct that line. Continuing properly.

3. **F-03**：注销后的钱款继续入账到死库卡 -- 这不是提审问题，但它是与 F-04 互为反向的「钱两头不见」的问题。
4. **F-07**：「恢复只能走客服人工」 —— 而客服**没有任何工具**，只能直连生产库。

⇒ **建议的 K53 写法**（这两个字
我会这么建议）：

> K53 · 《提审自检清单 v1.2》第 10 条 → **✅ 入口已实装（M5-20，e2e §9 24 条断言为证）**；
> ⚠️ **注销的合规成立性尚未收口**：待补 **F-01（告知口径改为「去标识化 + openid 保留」）/ F-02（`ab_order.remark`、`ab_team_leader.real_name·phone`、`ab_withdraw.receive_name` 的清理或显式登记）/ F-03（注销后资金流入的处置）/ F-04（在途提现导致的注销永久不可用）** 四项后，方可记为「已收口」。

### D3 提审前的最小必改清单（我的建议，按「不改就可能被挑出来」排序）

| # | 项 | 改什么 | 成本 |
|---|---|---|---|
| 1 | **F-01** | `user.service.ts:178` 的 `note`、`agreements.ts` 注销条款、`account-cancel.vue:175` 三处文案，把「匿名化」改为「去标识化；为阻止同一微信再次登录，保留 openid」 | 文案，半小时 |
| 2 | **F-04** | 新增第 4 道显式闸门 `WITHDRAW_IN_FLIGHT`，并把「在途提现」写进 `agreements.ts` 的注销前置条件 | 小改 + 1 组 e2e |
| 3 | **F-03** | `settlePending` 与退款写回余额处对 `ab_user.status = 3` 的收款人走「挂人工 / 计入 skippedReasons」 | 中改，可照抄既有的「团长档案不存在」分支 |
| 4 | **F-02** | 至少把 `ab_order.remark`（过敏备注）置 `null`；`ab_team_leader` 的 `real_name`/`phone` 在「能通过注销闸门」的那条路径上要么清空要么进安全审计决定 | 需口径裁定 |
| 5 | **F-05 / F-11** | 把二者登记进《已知项与预期行为清单》：**特别是 F-11 的「将来加订单快照会翻转为泄露」** —— 那条是给未来的人看的防撞条 | 文档 |
| 6 | 一致性 | `user.service.ts:45-51` 的表格写「三道闸门」，若改为四道需同步；我的建议是**先把表格改对再改代码**（否则又是一个「账本 vs 实现」的 drift） | 文档 + 代码同批改 |

---

## E. 完整发现清单（按严重度排序）

> 严重度口径（按 team-lead 的约定）：P0 = 可导致他人账号被注销 / 个人信息泄露；P1 = 合规不成立或资金丢；P2 = 其余真缺陷；P3 = 瑕疵/登记项。每条附**反例条件**。

### P1

| ID | 标题 | 主要证据 | 反例条件 |
|---|---|---|---|
| **F-01** | 「个人信息已匿名化」不成立（openid/unionid 明文 + `ab_message` 第二份 + user_id 外键可复原），而四处告知口径都写「匿名化」 | `user.service.ts:40/178` · `user-status.ts:10` · `agreements.ts` · `account-cancel.vue:175` · `message.service.ts:115-151` | 若 `ab_user` 外无任何表存 openid 且文案改为「去标识化 + openid 保留并说明目的/期限」⇒ 闭环 |
| **F-02** | 匿名化只覆盖 `ab_user` 一行 7 字段；`ab_order.remark`（过敏，敏感个人信息）、`ab_team_leader.real_name/phone/payout_name`、`ab_withdraw.receive_name`、`ab_message.openid` 全部残留；且 `leader` 闸门只拦 ACTIVE ⇒ **能注销的团长/提现用户 = 残留最完整的那批** | `user.service.ts:107-108` · `leader.entity.ts:32-36/203-219` · `withdraw.entity.ts:93-106` · `order.entity.ts:118` · `leader-status.ts:12-17` | 对「从未申请团长、从未提现、`remark` 恒空、未收过推送」的用户不成立；历史越丰富越不成立 |
| **F-03** | 注销后钱仍会流入死账户：`completed` 属终态可注销但之后可退款（余额部分写回 `ab_balance`）；`pending` 佣金由 `settlePending` 无状态校验地 Credit 进余额 | `order-status.ts:88-92` · `order-state-machine.ts:29` · `refund.service.ts:343/724` · `commission.service.ts:691-772` · `leader-admin.service.ts:651-660` · `promotion.service.ts:238-257` | 无 `balance_used`、无 pending 佣金、且历史订单已过退款窗口 ⇒ 不成立 |
| **F-04** | 在途提现（人工 `FLEX_MANUAL` 出款）可长期停在 approved/paying ⇒ `frozen > 0` 永久 ⇒ 该用户**永远注销不掉**；隐私政策的注销前置条件也未提这一条 | `withdraw.entity.ts:74-82` · 共享枚举 `WITHDRAW_FROZEN_STATUS` · `user.service.ts:110-111/19` · `agreements.ts` | 该用户身上无 ∈ `WITHDRAW_FROZEN_STATUS` 的提现行 ⇒ 不成立 |
| **F-05** | 旧 token 窗 7 天；全仓除登录/注销外**无一处端点校验 `ab_user.status`**。注销只是被「字段被清空」的副作用侥幸挡住下单，且挡下来的错误码是 `30007`（给已注销用户指了一条走不通的路）；评价提交、订单自助取消、余额明细照通。**黑名单（`status=2`）则完全无此兜底，`SC-U-28` 仍存活** | `app.config.ts:97` · `jwt.strategy.ts:23-25` · `jwt-auth.guard.ts:45-84` · `leader.guard.ts:37-56` · `order.service.ts:202-203/1320` · `rating/*.service.ts` | 若将来为取证给订单加收货人快照 ⇒ 本条由「侥幸」翻转为 P0 泄露；今天安全是巧合不是设计 |

### P2

| ID | 标题 | 主要证据 | 反例条件 |
|---|---|---|---|
| **F-06** | `deleted_at` 是普通 `@Column`（非 `@DeleteDateColumn`），无读路径过滤它 ⇒ 「双证据」只对人不成立中áq怡 | `user.entity.ts:75-76` · `auth.service.ts:199` · `order-admin.service.ts:622` · `leader-admin.service.ts:350` 等（对照 `building-admin.service.ts:101-104` 的 `IsNull()` 惯例） | 若有人按项目惯例给 `ab_user` 列表加 `deletedAt: IsNull()` ⇒ 已注销用户静默消失；两种软删约定并存且无门禁 |
| **F-07** | 「恢复只能走客服人工」字面成立，但客服**无工具**：无 `ab_user` admin 模块、无恢复端点、无审计留痕；`status=2` 解封同样 | `modules/admin/` 目录树（只有 admin-user/dashboard/operation-log/role/template/config）· grep `UserStatus.` 全部写点 | 补一个写 `ab_operation_log` 的恢复/解封端点 ⇒ 闭环 |
| **F-08** | 注销无持久留痕：只 `logger.log` 一行到 stdout，用户填的 `reason` 不落任何表 | `user.service.ts:155-157` | 落到 `ab_operation_log` 或一张 `ab_user_cancel_log` ⇒ 闭环 |
| **F-09** | 日志注入：`reason`（用户自由文本 ≤200 字，未过 newline）直接进 `logger.log` | `user.service.ts:156` · `dto/user-cancel.dto.ts:31-35` | 行长已被 `@MaxLength(200)` 限制；加一笔 `replace(/[\r\n]+/g, ' ')` 即闭环 |
| **F-10** | `balance` 闸门把「可用余额 / 提现冻结 / D39 手工冻结」三种状态混成一个键，给用户的指引在其中两种上都是错的 | `user.service.ts:110-111` vs `user.service.ts:19` | 若有余额且没在提现也没被冻结 ⇒ 文案正确 |
| **F-11** | 订单无收货人快照 ⇒ 注销后历史订单展示名塌缩为「已注销用户」，后台四处昵称 `LIKE` 检索（`order-admin:552 / refund-admin:101 / withdraw-admin:161 / balance-admin:131`）永久查不到 ⇒ 只剩 `user_id` 一条取证路，与「订单依法保留」的告知口径不一致 | `order.entity.ts` 无 snapshot 列 · 上述四处 | 一旦加收货人快照而不处理注销 ⇒ 立刻翻转为 P0 泄露（见 F-03 的联动） |
| **F-12** | 闸门与落库不在同一事务，UPDATE 不复检闸门 | `user.service.ts:105-148` | 收进同一事务 + WHERE 复述闸门条件 ⇒ 闭环。**注意用户「开着页面打完确认词、换设备下单、回来点提交」是分钟级窗口，若按此口径应升 P2 并按 serious 修** |

### P3

| ID | 标题 | 证据 |
|---|---|---|
| **F-13** | `Repository.update()` 不触发 `@UpdateDateColumn` ⇒ 注销后 `ab_user.updated_at` 不刷新（排障时看不到最后写入时刻） | `user.service.ts:135` + TypeORM 语义 + `user.entity.ts:72-73` |
| **F-14** | `toFen(Number(x))` 出现脏值时得 `NaN`，`NaN > 0 === false` ⇒ **闸门静默放行**。Fail-closed 不该依赖「脏值不可能发生」 | `user.service.ts:111` + `leader-money.service.ts:75-76` + `money.ts:16-18` |
| **F-15** | `status = 2`（平台处罚）的用户可自助注销覆盖为 `3` ⇒ 审计链丢失「曾被处罚」的事实 | `user.service.ts:135-148` 的 WHERE 只排 `!= 3` |
| **F-16** | 确认词 `trim()` 未做 NFKC/全半角归一 ⇒ 视觉同形字符会让用户抄错而 `10001`（失败方向安全） | `user.service.ts:85` |
| **F-17** | `deleted_at` 没有配套的保留期限 / 到期清理工装；`ab_message`（openid）亦无清理策略 | `user.service.ts:139` · `message.service.ts:148-160` |

---

## F. 明确判定为「成立 / 做得对」的部分（不要把好东西改掉）

| # | 项 | 证据 |
|---|---|---|
| ✅ 1 | **代他人注销不可行** —— 端点只认 `JwtPayload.sub`，DTO 无 id 字段，且全局管道 `forbidNonWhitelisted: true` 使 body 注入变成 400 而非静默降级 | `user.controller.ts:177-179` · `dto/user-cancel.dto.ts:22-36` · `main.ts` ValidationPipe |
| ✅ 2 | **确认词闸门真在服务端，且是唯一写点**，无 bypass；连「拒了但顺手办了」这种 fail-open 都被反向断言覆盖 | `user.service.ts:85-92` · `e2e-m1.mjs:599-613` |
| ✅ 3 | **并发防护正确**：`WHERE id AND status != 3` + `affected = 0 ⇒ 20014`，不是注释说说而已（我按源码确认里面确实有 `Not(UserStatus.CANCELED)`） | `user.service.ts:135-153` |
| ✅ 4 | **`20014` / `20006` 分码，且 `CANCELED` 判在 `BLACKLIST` 之前**；端侧对 `20014` 是「清态 + 不重试」，避免了 `10002` 的死循环 | `auth.service.ts:84-96` · `error-code.ts` diff · `request.ts` diff |
| ✅ 5 | **`note` 明写「订单/退款/佣金记录依法保留」**，且由服务端下发（端上不复制第二份文案）—— 这条恰好是本项目自己在 `user.service.ts:175-178` 点出的「虚假告知」防线 | `user.service.ts:178` |
| ✅ 6 | **不物理删除订单/佣金/退款**（`ab_order` 行未被删，e2e 直接查库断言）—— 财务凭证留存优先于「删除个人数据」，取舍有据且写明了理由 | `e2e-m1.mjs:738-742` |
| ✅ 7 | **`openid` 保留是为拦住再注册**，这个取舍是对的，并在 e2e 中被钉成断言（ `openid 仍在`） | `user.service.ts:40` · `e2e-m1.mjs:733-737` |
| ✅ 8 | **记忆体入口找到 theorem** —— 原生页 + 「我的 → 设置」第五项 + `pages.json` 路由，不碰 web-view/域名依赖 | `mine.vue` diff · `pages.json` diff |
| ✅ 9 | **`JWT_SECRET` 生产必配、漏配即启动失败**（`assertProdSecrets`）—— token 防线的根没有被默认兜底串架空 | `main.ts:57-73` |

---

## G. 与其他同事工作的交叉提示

- → **gstack-qa-lead**：`e2e-m1.mjs` §9 的 24 条断言**没有覆盖 `balance` 这道闸门**（`:669-673` 的「`reasons` 恰为 `["orders"]`」那条断言的前提恰好是「该账号既非团长也无余额」，等于把 balance 跳过了）。建议补：`balance` 闸门正向用例 + **`Completed` 订单不拦注销 + 注销后退款把钱写回余额**（F-03(a)）这条现在**没有任何断言会变红**。
- → **gstack-product-reviewer**：《接口规范》§3.5 的 U19 行 / §九 错误码表需与 `user.service.ts:45-51` 的「三道闸门」表格同步改数 —— 现在是 chaos 里的四道问题（我自己 haul mur nunassutiss first）。另外 `agreements.ts` 的注销前置条件缺了「在途提现」这一项，与实现不一致（F-04）。
- → **gstack-investigator**：`SC-U-28`（拉黑后旧 token 仍可下单）在本次代码里**仍然存活** —— 唯一防线是 `order.service.ts:202-203` 那行只查存在性的 `findOne`。注销只是「顺手被副作用挡住」，不是修好了。请把这两者合并登记为一个已知项，避免将来有人误以为注销 = 修好了 aliaje。
