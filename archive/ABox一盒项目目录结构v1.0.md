# ABox 一盒 · 项目目录结构 v1.0

> Monorepo · pnpm workspaces · 三个子项目：uni-app 小程序、NestJS 后端、Vue3 后台

---

## 一、根目录布局

```
abox-onebox/                            ← 项目根目录
├── .gitignore
├── .gitattributes
├── README.md
├── package.json                        ← 根 package.json，定义 workspaces
├── pnpm-workspace.yaml
├── .npmrc
├── .editorconfig
├── .prettierrc.json
├── .eslintrc.cjs
├── commitlint.config.cjs
├── docker-compose.yml                  ← 本地依赖（MySQL/Redis/RabbitMQ）
├── .env.example
├── docs/                               ← 项目文档
│   ├── ABox一盒小程序产品方案v1.0.md
│   ├── ABox一盒数据库ER设计v1.0.md
│   ├── ABox一盒接口规范v1.0.md
│   ├── ABox一盒部署运维手册v1.0.md
│   └── api/                            ← 自动生成的接口文档 (Swagger 输出)
├── scripts/                            ← 全局脚本
│   ├── setup.sh                        ← 一键初始化项目
│   ├── db-migrate.sh                   ← 数据库迁移
│   ├── db-seed.sh                      ← 种子数据
│   └── deploy.sh                       ← 一键部署
├── apps/
│   ├── miniprogram/                    ← uni-app 小程序（用户端 + 团长端 + 楼长端）
│   ├── admin-web/                      ← Vue3 后台（平台管理 + 商家端）
│   └── api-server/                     ← NestJS 后端 API
└── packages/
    ├── shared-types/                   ← 前后端共享 TS 类型
    ├── shared-utils/                   ← 共享工具（时间处理、加密等）
    ├── eslint-config/                  ← 共享 ESLint 配置
    └── tsconfig/                       ← 共享 TS 配置
```

---

## 二、`apps/miniprogram` 小程序端

```
apps/miniprogram/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts                  ← Tailwind for uni-app
├── src/
│   ├── main.ts                         ← 入口
│   ├── App.vue
│   ├── manifest.json                   ← uni-app 配置（AppID、名称）
│   ├── pages.json                      ← 页面路由
│   ├── uni.scss
│   ├── pages/                          ← 页面（按业务模块分组）
│   │   ├── index/                      ← 首页（明日套餐）
│   │   │   └── index.vue
│   │   ├── meal-detail/                ← 套餐详情
│   │   │   └── meal-detail.vue
│   │   ├── order-create/               ← 下单
│   │   │   ├── order-create.vue
│   │   │   └── components/
│   │   ├── order-list/                 ← 我的订单
│   │   │   ├── order-list.vue
│   │   │   └── components/
│   │   ├── order-detail/               ← 订单详情
│   │   │   └── order-detail.vue
│   │   ├── address-list/               ← 地址管理
│   │   │   └── address-list.vue
│   │   ├── mine/                       ← 个人中心
│   │   │   └── mine.vue
│   │   ├── team-leader/                ← 团长端
│   │   │   ├── workbench.vue           ← 工作台
│   │   │   ├── orders.vue              ← 订单聚合
│   │   │   ├── share.vue               ← 分享中心
│   │   │   └── commission.vue          ← 佣金
│   │   ├── floor-leader/               ← 楼长端
│   │   │   ├── delivery-list.vue
│   │   │   ├── sign.vue                ← 扫码签收
│   │   │   └── distribute.vue          ← 分发
│   │   └── webview/                    ← H5 容器（协议页等）
│   ├── components/                     ← 通用组件
│   │   ├── meal-card/
│   │   ├── dish-card/
│   │   ├── countdown/
│   │   ├── empty-state/
│   │   ├── loading/
│   │   └── bottom-bar/
│   ├── composables/                    ← 组合式 API（hooks）
│   │   ├── use-wechat-pay.ts
│   │   ├── use-subscribe-message.ts
│   │   ├── use-countdown.ts
│   │   ├── use-user.ts
│   │   └── use-request.ts
│   ├── stores/                         ← Pinia 状态
│   │   ├── user.ts
│   │   ├── cart.ts
│   │   └── order.ts
│   ├── api/                            ← API 调用层
│   │   ├── request.ts                  ← axios 实例
│   │   ├── user.ts
│   │   ├── meal.ts
│   │   ├── order.ts
│   │   ├── team-leader.ts
│   │   ├── floor-leader.ts
│   │   └── address.ts
│   ├── utils/
│   │   ├── auth.ts                     ← 登录态管理
│   │   ├── format.ts                   ← 金额、时间格式化
│   │   ├── storage.ts                  ← Storage 封装
│   │   └── router.ts                   ← 路由跳转
│   ├── constants/
│   │   ├── index.ts
│   │   └── env.ts
│   └── styles/
│       ├── tailwind.css
│       └── common.scss
├── static/
│   ├── images/
│   ├── icons/
│   └── tabs/
└── types/
    ├── meal.d.ts
    ├── order.d.ts
    └── user.d.ts
```

---

## 三、`apps/admin-web` 后台 Web

```
apps/admin-web/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── api/
│   │   ├── request.ts                  ← axios + 拦截器
│   │   ├── auth.ts
│   │   ├── meal.ts
│   │   ├── order.ts
│   │   ├── delivery.ts
│   │   ├── user.ts
│   │   ├── team-leader.ts
│   │   ├── floor-leader.ts
│   │   ├── supplier.ts
│   │   ├── finance.ts
│   │   └── stats.ts
│   ├── router/
│   │   ├── index.ts
│   │   ├── routes.ts
│   │   └── guards.ts                   ← 鉴权守卫
│   ├── stores/                         ← Pinia
│   │   ├── auth.ts
│   │   ├── app.ts
│   │   └── permission.ts
│   ├── layouts/
│   │   ├── default-layout.vue
│   │   └── login-layout.vue
│   ├── views/
│   │   ├── login/
│   │   ├── dashboard/                  ← 工作台
│   │   ├── meal/                       ← 套餐编排（M41）
│   │   │   ├── calendar.vue            ← 日历视图
│   │   │   ├── edit.vue                ← 创建/编辑
│   │   │   └── detail.vue
│   │   ├── order/                      ← 订单中心（M42）
│   │   │   ├── list.vue
│   │   │   └── detail.vue
│   │   ├── delivery/                   ← 配送管理（M43）
│   │   │   ├── list.vue
│   │   │   └── detail.vue
│   │   ├── user/                       ← 用户管理（M44）
│   │   │   └── list.vue
│   │   ├── team-leader/                ← 团长管理（M45）
│   │   │   ├── list.vue
│   │   │   └── detail.vue
│   │   ├── floor-leader/               ← 楼长管理（M46）
│   │   │   └── list.vue
│   │   ├── supplier/                   ← 供应商管理（M47）
│   │   │   ├── list.vue
│   │   │   ├── edit.vue
│   │   │   └── dishes.vue
│   │   ├── finance/                    ← 财务结算（M48）
│   │   │   ├── overview.vue
│   │   │   ├── commission.vue
│   │   │   ├── supplier-share.vue
│   │   │   ├── refund.vue
│   │   │   └── reconciliation.vue
│   │   ├── stats/                      ← 数据统计（M49）
│   │   │   ├── core-metrics.vue
│   │   │   ├── building-rank.vue
│   │   │   ├── dish-heat.vue
│   │   │   └── retention.vue
│   │   └── system/                     ← 系统管理（M4A）
│   │       ├── admin-user.vue
│   │       ├── role.vue
│   │       ├── operation-log.vue
│   │       ├── config.vue
│   │       └── message-template.vue
│   ├── components/                     ← 通用组件
│   │   ├── table/
│   │   ├── search-form/
│   │   ├── chart/                      ← ECharts 封装
│   │   ├── upload/
│   │   └── editor/
│   ├── composables/
│   ├── utils/
│   ├── constants/
│   └── styles/
└── public/
```

> **供应商端**（商家后台）共用此工程，通过 `role` 字段做菜单过滤，无需独立部署。

---

## 四、`apps/api-server` NestJS 后端

```
apps/api-server/
├── package.json
├── tsconfig.json
├── nest-cli.json
├── .env.example
├── src/
│   ├── main.ts                         ← 启动入口
│   ├── app.module.ts
│   ├── common/                         ← 公共模块
│   │   ├── decorators/
│   │   │   ├── user.decorator.ts
│   │   │   ├── roles.decorator.ts
│   │   │   └── idempotent.decorator.ts
│   │   ├── guards/
│   │   │   ├── auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── wx-signature.guard.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   ├── transform.interceptor.ts
│   │   │   └── timeout.interceptor.ts
│   │   ├── filters/
│   │   │   ├── http-exception.filter.ts
│   │   │   └── validation.filter.ts
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts
│   │   ├── middleware/
│   │   │   ├── request-id.middleware.ts
│   │   │   └── rate-limit.middleware.ts
│   │   └── utils/
│   │       ├── crypto.ts               ← AES 加密手机号
│   │       ├── order-no.ts             ← 订单号生成
│   │       ├── time.ts
│   │       └── response.ts
│   ├── config/
│   │   ├── config.module.ts
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   ├── rabbitmq.config.ts
│   │   ├── wechat.config.ts            ← 微信支付/小程序配置
│   │   └── app.config.ts
│   ├── database/
│   │   ├── database.module.ts
│   │   ├── data-source.ts              ← TypeORM data source
│   │   ├── migrations/                 ← 数据库迁移
│   │   │   └── 1700000000000-init.ts
│   │   └── seeds/                      ← 种子数据
│   │       └── seed.ts
│   ├── modules/                        ← 业务模块
│   │   ├── auth/                       ← 鉴权（小程序登录、后台登录）
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   │   ├── wx-mini.strategy.ts
│   │   │   │   └── jwt.strategy.ts
│   │   │   └── dto/
│   │   ├── user/
│   │   ├── building/                   ← 办公楼/公司
│   │   ├── supplier/                   ← 供应商 + 菜品
│   │   │   ├── supplier.module.ts
│   │   │   ├── supplier.controller.ts
│   │   │   ├── supplier.service.ts
│   │   │   ├── dish/
│   │   │   └── dto/
│   │   ├── meal/                       ← 套餐编排
│   │   │   ├── meal.module.ts
│   │   │   ├── meal.controller.ts
│   │   │   ├── meal.service.ts
│   │   │   └── dto/
│   │   ├── order/                      ← 订单
│   │   │   ├── order.module.ts
│   │   │   ├── order.controller.ts
│   │   │   ├── order.service.ts
│   │   │   ├── order-state-machine.ts  ← 状态机
│   │   │   └── dto/
│   │   ├── delivery/                   ← 配送单
│   │   │   ├── delivery.module.ts
│   │   │   ├── delivery.controller.ts
│   │   │   ├── delivery.service.ts
│   │   │   ├── qrcode.service.ts       ← 签收二维码
│   │   │   └── dto/
│   │   ├── team-leader/                ← 团长端
│   │   │   ├── team-leader.module.ts
│   │   │   ├── team-leader.controller.ts
│   │   │   ├── team-leader.service.ts
│   │   │   ├── share.service.ts        ← 小程序码生成
│   │   │   └── dto/
│   │   ├── floor-leader/               ← 楼长端
│   │   │   ├── floor-leader.module.ts
│   │   │   ├── floor-leader.controller.ts
│   │   │   ├── floor-leader.service.ts
│   │   │   └── dto/
│   │   ├── payment/                    ← 微信支付集成
│   │   │   ├── payment.module.ts
│   │   │   ├── payment.controller.ts   ← 回调
│   │   │   ├── payment.service.ts
│   │   │   ├── wxpay.service.ts        ← 微信支付 SDK 封装
│   │   │   ├── wxpay-config.ts
│   │   │   └── dto/
│   │   ├── finance/                    ← 财务
│   │   │   ├── finance.module.ts
│   │   │   ├── finance.controller.ts
│   │   │   ├── commission.service.ts   ← 团长佣金
│   │   │   ├── supplier-share.service.ts ← 供应商分账
│   │   │   ├── refund.service.ts
│   │   │   ├── reconciliation.service.ts ← 对账
│   │   │   ├── withdraw.service.ts     ← 提现
│   │   │   └── dto/
│   │   ├── message/                    ← 消息推送
│   │   │   ├── message.module.ts
│   │   │   ├── message.service.ts
│   │   │   ├── wechat-template.service.ts
│   │   │   └── templates/
│   │   ├── stats/                      ← 数据统计
│   │   │   ├── stats.module.ts
│   │   │   ├── stats.controller.ts
│   │   │   └── stats.service.ts
│   │   └── admin/                      ← 后台管理
│   │       ├── admin.module.ts
│   │       ├── admin.controller.ts
│   │       ├── admin.service.ts
│   │       ├── admin-user/
│   │       ├── role/
│   │       ├── operation-log/
│   │       ├── config/
│   │       └── dashboard/
│   ├── tasks/                          ← 定时任务
│   │   ├── tasks.module.ts
│   │   ├── schedule.service.ts         ← @nestjs/schedule
│   │   ├── cutoff.task.ts              ← T-1 20:00 截单
│   │   ├── delivery-generate.task.ts   ← T-1 22:00 生成配送单
│   │   ├── commission-settle.task.ts   ← T+1 02:00 佣金结算
│   │   ├── supplier-share.task.ts      ← T+1 02:00 供应商分账
│   │   ├── reconciliation.task.ts      ← 每日 04:00 对账
│   │   └── meal-publish.task.ts        ← 每日 09:00 套餐上架
│   ├── queues/                         ← 消息队列消费者
│   │   ├── queues.module.ts
│   │   ├── order-paid.consumer.ts
│   │   ├── refund-apply.consumer.ts
│   │   └── settle-orders.consumer.ts
│   └── health/
│       └── health.controller.ts        ← /health
├── test/
│   ├── unit/
│   └── e2e/
└── public/
    └── qrcodes/                        ← 小程序码缓存
```

---

## 五、`packages/shared-types` 共享类型（关键）

```
packages/shared-types/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── api/
│   │   ├── common.ts                   ← 统一响应结构
│   │   ├── user.ts
│   │   ├── meal.ts
│   │   ├── order.ts
│   │   ├── delivery.ts
│   │   ├── team-leader.ts
│   │   ├── floor-leader.ts
│   │   ├── supplier.ts
│   │   └── finance.ts
│   ├── enums/
│   │   ├── order-status.ts
│   │   ├── meal-status.ts
│   │   ├── role.ts
│   │   └── dish-slot.ts
│   └── dto/                            ← 共享 DTO（前后端共用）
│       ├── create-order.dto.ts
│       └── ...
```

---

## 六、Docker Compose（本地依赖）

```yaml
# docker-compose.yml
version: '3.8'
services:
  mysql:
    image: mysql:8.0
    container_name: abox-mysql
    restart: always
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: ******
      MYSQL_DATABASE: abox_onebox
      TZ: Asia/Shanghai
    volumes:
      - ./data/mysql:/var/lib/mysql
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    command:
      --character-set-server=utf8mb4
      --collation-server=utf8mb4_unicode_ci
      --default-time-zone=+08:00

  redis:
    image: redis:7-alpine
    container_name: abox-redis
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - ./data/redis:/data

  rabbitmq:
    image: rabbitmq:3-management-alpine
    container_name: abox-rabbitmq
    restart: always
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: admin123
```

---

## 七、关键技术依赖版本（建议锁定）

### 7.1 后端 `apps/api-server/package.json`

```json
{
  "dependencies": {
    "@nestjs/core": "^10.3.0",
    "@nestjs/common": "^10.3.0",
    "@nestjs/platform-express": "^10.3.0",
    "@nestjs/config": "^3.1.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.0",
    "@nestjs/schedule": "^4.0.0",
    "@nestjs/swagger": "^7.3.0",
    "@nestjs/typeorm": "^10.0.0",
    "typeorm": "^0.3.17",
    "mysql2": "^3.6.5",
    "ioredis": "^5.3.2",
    "amqplib": "^0.10.3",
    "passport-jwt": "^4.0.1",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "axios": "^1.6.0",
    "wechatpay-node-v3": "^2.1.0",
    "tencentcloud-sdk-nodejs": "^4.0.0",
    "qrcode": "^1.5.3",
    "dayjs": "^1.11.10",
    "winston": "^3.10.0",
    "nest-winston": "^1.9.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@nestjs/testing": "^10.3.0",
    "@types/node": "^20.10.0",
    "@types/express": "^4.17.21",
    "typescript": "^5.3.0",
    "ts-node": "^10.9.0",
    "jest": "^29.7.0",
    "supertest": "^6.3.0"
  }
}
```

### 7.2 小程序 `apps/miniprogram/package.json`

```json
{
  "dependencies": {
    "@dcloudio/uni-app": "3.0.0-4000020250101001",
    "@dcloudio/uni-app-plus": "3.0.0-4000020250101001",
    "@dcloudio/uni-components": "3.0.0-4000020250101001",
    "@dcloudio/uni-h5": "3.0.0-4000020250101001",
    "@dcloudio/uni-mp-weixin": "3.0.0-4000020250101001",
    "vue": "^3.4.0",
    "pinia": "^2.1.0",
    "vue-i18n": "^9.8.0",
    "dayjs": "^1.11.10",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@dcloudio/types": "^3.4.0",
    "@dcloudio/uni-automator": "3.0.0-4000020250101001",
    "@dcloudio/vite-plugin-uni": "3.0.0-4000020250101001",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@vue/tsconfig": "^0.5.1"
  }
}
```

### 7.3 后台 `apps/admin-web/package.json`

```json
{
  "dependencies": {
    "vue": "^3.4.0",
    "vue-router": "^4.2.0",
    "pinia": "^2.1.0",
    "element-plus": "^2.4.0",
    "@element-plus/icons-vue": "^2.3.0",
    "axios": "^1.6.0",
    "echarts": "^5.4.0",
    "vue-echarts": "^6.6.0",
    "dayjs": "^1.11.10",
    "nprogress": "^0.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.0.0",
    "typescript": "^5.3.0",
    "vue-tsc": "^1.8.0",
    "unplugin-auto-import": "^0.17.0",
    "unplugin-vue-components": "^0.26.0"
  }
}
```

---

## 八、一键初始化脚本 `scripts/setup.sh`

```bash
#!/bin/bash
set -e

echo "🚀 初始化 ABox 一盒项目..."

# 1. 安装依赖
pnpm install

# 2. 启动本地依赖
docker compose up -d

# 3. 等待 MySQL 就绪
echo "⏳ 等待 MySQL 启动..."
sleep 10

# 4. 复制环境变量
cp .env.example .env
cp apps/api-server/.env.example apps/api-server/.env

# 5. 运行数据库迁移
pnpm --filter api-server db:migrate

# 6. 导入种子数据
pnpm --filter api-server db:seed

# 7. 启动开发服务器
echo "✅ 初始化完成！"
echo ""
echo "📌 启动命令："
echo "  pnpm dev              # 同时启动前后端"
echo "  pnpm dev:api          # 仅启动 API"
echo "  pnpm dev:mp           # 仅启动小程序"
echo "  pnpm dev:admin        # 仅启动后台"
```

---

## 九、目录命名规范

| 类型 | 规范 | 示例 |
| --- | --- | --- |
| 文件名 | kebab-case | `meal-card.vue`、`order.service.ts` |
| 组件名 | PascalCase | `MealCard.vue` |
| 类名 | PascalCase | `OrderService` |
| 变量/函数 | camelCase | `getOrderById` |
| 常量 | UPPER_SNAKE | `MAX_QUANTITY_PER_ORDER` |
| 数据库表名 | snake_case | `ab_order_item` |
| 数据库字段 | snake_case | `team_leader_id` |
| 接口路径 | kebab-case | `/api/v1/set-meals` |
| 环境变量 | UPPER_SNAKE | `WECHAT_PAY_MCH_ID` |

---

*文档结束 · ABox 一盒 · 项目目录结构 v1.0*
