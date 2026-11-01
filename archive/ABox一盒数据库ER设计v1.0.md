# ABox 一盒 · 数据库 ER 设计 v1.0

> 与《产品方案 v1.0》对齐 · 数据库：MySQL 8.0 · 字符集：utf8mb4 · 引擎：InnoDB

---

## 〇、设计原则

1. **订单表按月分区**（RANGE PARTITION），便于归档与查询加速
2. **金额统一用 `DECIMAL(10,2)`**，禁止 `FLOAT`/`DOUBLE`
3. **时间统一 `DATETIME(3)`**（毫秒精度），统一 UTC+8 存储
4. **软删除用 `deleted_at`** 字段，禁止物理删除（订单/财务表除外）
5. **每张表必备**：`id`（bigint 自增）、`created_at`、`updated_at`、`version`（乐观锁）
6. **命名规范**：表名 `ab_<module>_<entity>`，字段名 snake_case，索引名 `idx_<table>_<col>`，唯一索引 `uk_<table>_<col>`

---

## 一、ER 总览（21 张表）

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                       │
│   ┌──────────┐ 1   N ┌──────────┐ N   1 ┌──────────┐                │
│   │ ab_building│──────│ ab_company│──────│ ab_user  │                │
│   └──────────┘       └──────────┘       └─────┬────┘                │
│        │ 1                                      │ N                   │
│        │ N                                      │                     │
│   ┌────▼─────┐                          ┌──────▼────────┐            │
│   │ab_team_  │ N                       N│ ab_address    │            │
│   │leader    │                          └───────────────┘            │
│   └────┬─────┘                                                        │
│        │ N                                                            │
│        │ 1                                                            │
│   ┌────▼──────┐  N    1  ┌──────────┐  N    1 ┌──────────┐          │
│   │ab_floor_  │─────────│ab_building│────────│ab_set_meal│          │
│   │leader     │          └──────────┘         └─────┬────┘          │
│   └───────────┘                                      │ N              │
│                                                      │                │
│                                          ┌───────────▼────┐         │
│                                          │ab_set_meal_item │         │
│                                          └───────────┬─────┘         │
│                                                      │ N              │
│   ┌──────────┐  N    1 ┌──────────┐ N     1           │              │
│   │ab_supplier│───────│ab_dish    │───────────────────┘              │
│   └─────┬────┘        └──────────┘                                   │
│         │ 1                                                          │
│         │ N                                                          │
│   ┌─────▼────────────┐                                              │
│   │ab_supplier_account│                                              │
│   └──────────────────┘                                              │
│                                                                       │
│   ┌──────────┐                                                       │
│   │ ab_order │ ◀──── 主业务流核心                                   │
│   └────┬─────┘                                                       │
│        │ 1                                                            │
│        ├──── N ───▶ ab_order_item ───▶ ab_dish (快照冗余)            │
│        │                                                              │
│        ├──── 1 ───▶ ab_payment_log                                   │
│        │                                                              │
│        ├──── 0..1 ▶ ab_refund                                        │
│        │                                                              │
│        └──── N ───▶ ab_delivery_note ───▶ ab_building               │
│                                                                       │
│   ┌──────────────┐        ┌──────────────────┐                       │
│   │ab_commission │        │ab_supplier_share │                       │
│   │(团长佣金流水)│        │(供应商分账流水)  │                       │
│   └──────────────┘        └──────────────────┘                       │
│                                                                       │
│   ┌──────────────┐        ┌──────────────┐                            │
│   │ab_admin_user │        │ab_operation_ │                            │
│   │(后台账号)   │        │log(操作日志) │                            │
│   └──────────────┘        └──────────────┘                            │
│                                                                       │
│   ┌──────────┐        ┌──────────┐                                  │
│   │ab_message│        │ab_config │                                  │
│   └──────────┘        └──────────┘                                  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 二、核心表 DDL

### 2.1 用户与角色域（5 张）

#### `ab_user` 用户表

```sql
CREATE TABLE `ab_user` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `openid`            VARCHAR(64)  NOT NULL COMMENT '微信 openid',
  `unionid`           VARCHAR(64)  DEFAULT NULL COMMENT '微信 unionid',
  `nickname`          VARCHAR(64)  DEFAULT NULL,
  `avatar_url`        VARCHAR(512) DEFAULT NULL,
  `phone`             VARCHAR(20)  DEFAULT NULL COMMENT '脱敏存储,AES 加密',
  `phone_hash`        VARCHAR(64)  DEFAULT NULL COMMENT 'phone 哈希用于查询',
  `gender`            TINYINT      DEFAULT 0 COMMENT '0未知 1男 2女',
  `company_id`        BIGINT UNSIGNED DEFAULT NULL COMMENT '所属公司',
  `building_id`       BIGINT UNSIGNED DEFAULT NULL COMMENT '所属办公楼',
  `floor`             VARCHAR(32)  DEFAULT NULL COMMENT '楼层',
  `team_leader_id`    BIGINT UNSIGNED DEFAULT NULL COMMENT '所属团长',
  `subscribe_flag`    JSON         DEFAULT NULL COMMENT '订阅状态 {meal:1,delivery:1}',
  `status`            TINYINT      NOT NULL DEFAULT 1 COMMENT '1正常 2黑名单',
  `last_order_at`     DATETIME(3)  DEFAULT NULL,
  `version`           INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`        DATETIME(3)  DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_openid` (`openid`),
  KEY `idx_user_phone_hash` (`phone_hash`),
  KEY `idx_user_building` (`building_id`, `company_id`),
  KEY `idx_user_team_leader` (`team_leader_id`),
  KEY `idx_user_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';
```

#### `ab_team_leader` 团长表

```sql
CREATE TABLE `ab_team_leader` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`           BIGINT UNSIGNED NOT NULL COMMENT '关联用户ID',
  `building_id`       BIGINT UNSIGNED NOT NULL,
  `real_name`         VARCHAR(32)  NOT NULL,
  `phone`             VARCHAR(20)  NOT NULL COMMENT 'AES加密',
  `commission_rate`   DECIMAL(5,4) NOT NULL DEFAULT 0.1000 COMMENT '佣金比例 0.1000=10%',
  `total_orders`      INT UNSIGNED NOT NULL DEFAULT 0,
  `total_amount`      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_commission`  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `withdrawn_amount`  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `pending_amount`    DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '待提现',
  `status`            TINYINT NOT NULL DEFAULT 1 COMMENT '1在职 2停职',
  `signed_at`         DATETIME(3) DEFAULT NULL COMMENT '签约时间',
  `version`           INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`        DATETIME(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_team_leader_user` (`user_id`),
  KEY `idx_team_leader_building` (`building_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='团长表';
```

#### `ab_floor_leader` 楼长表

```sql
CREATE TABLE `ab_floor_leader` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`           BIGINT UNSIGNED NOT NULL,
  `building_id`       BIGINT UNSIGNED NOT NULL,
  `real_name`         VARCHAR(32)  NOT NULL,
  `phone`             VARCHAR(20)  NOT NULL,
  `subsidy_per_order` DECIMAL(6,2) NOT NULL DEFAULT 5.00 COMMENT '每次取餐补贴',
  `total_received`    INT UNSIGNED NOT NULL DEFAULT 0,
  `status`            TINYINT NOT NULL DEFAULT 1,
  `signed_at`         DATETIME(3) DEFAULT NULL,
  `version`           INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`        DATETIME(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_floor_leader_user` (`user_id`),
  KEY `idx_floor_leader_building` (`building_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='楼长表';
```

#### `ab_building` 办公楼表

```sql
CREATE TABLE `ab_building` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(64)  NOT NULL COMMENT '办公楼名称',
  `address`      VARCHAR(256) NOT NULL,
  `city`         VARCHAR(32)  NOT NULL DEFAULT '北京',
  `district`     VARCHAR(32)  DEFAULT NULL,
  `longitude`    DECIMAL(10,6) DEFAULT NULL,
  `latitude`     DECIMAL(10,6) DEFAULT NULL,
  `floor_count`  INT DEFAULT NULL,
  `status`       TINYINT NOT NULL DEFAULT 1 COMMENT '1合作中 2停用',
  `version`      INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`   DATETIME(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_building_city_district` (`city`, `district`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='办公楼表';
```

#### `ab_company` 公司表

```sql
CREATE TABLE `ab_company` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `building_id`  BIGINT UNSIGNED NOT NULL,
  `name`         VARCHAR(128) NOT NULL COMMENT '公司名',
  `floor_range`  VARCHAR(32)  DEFAULT NULL COMMENT '如 5-8层',
  `status`       TINYINT NOT NULL DEFAULT 1,
  `version`      INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`   DATETIME(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_company_building` (`building_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公司表';
```

#### `ab_address` 用户地址表

```sql
CREATE TABLE `ab_address` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`      BIGINT UNSIGNED NOT NULL,
  `building_id`  BIGINT UNSIGNED NOT NULL,
  `company_id`   BIGINT UNSIGNED DEFAULT NULL,
  `floor`        VARCHAR(32)  DEFAULT NULL,
  `detail`       VARCHAR(256) DEFAULT NULL,
  `is_default`   TINYINT NOT NULL DEFAULT 0,
  `version`      INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`   DATETIME(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_address_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户地址表';
```

---

### 2.2 商家与菜品域（3 张）

#### `ab_supplier` 供应商表

```sql
CREATE TABLE `ab_supplier` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`            VARCHAR(128) NOT NULL COMMENT '餐厅名',
  `contact_name`    VARCHAR(32)  NOT NULL,
  `contact_phone`   VARCHAR(20)  NOT NULL,
  `business_license` VARCHAR(256) DEFAULT NULL COMMENT '营业执照URL',
  `food_license`    VARCHAR(256) DEFAULT NULL COMMENT '食品经营许可证URL',
  `category`        VARCHAR(32)  DEFAULT NULL COMMENT '主营:川菜/粤菜/汤/面点...',
  `share_rate`      DECIMAL(5,4) NOT NULL DEFAULT 0.0000 COMMENT '分账比例 0.0000-1.0000',
  `wx_sub_mch_id`   VARCHAR(64)  DEFAULT NULL COMMENT '微信分账接收方商户号',
  `bank_account`    VARCHAR(64)  DEFAULT NULL,
  `bank_name`       VARCHAR(64)  DEFAULT NULL,
  `status`          TINYINT NOT NULL DEFAULT 1 COMMENT '1合作中 2停用',
  `total_served`    INT UNSIGNED NOT NULL DEFAULT 0,
  `version`         INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`      DATETIME(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_supplier_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商表';
```

#### `ab_dish` 菜品库

```sql
CREATE TABLE `ab_dish` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `supplier_id`   BIGINT UNSIGNED NOT NULL,
  `name`          VARCHAR(64)  NOT NULL,
  `image_url`     VARCHAR(512) DEFAULT NULL,
  `category`      VARCHAR(32)  DEFAULT NULL COMMENT '荤/素/汤/主食',
  `description`   VARCHAR(512) DEFAULT NULL,
  `cost_price`    DECIMAL(8,2) NOT NULL COMMENT '成本',
  `sale_count`    INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '历史被订次数',
  `rating`        DECIMAL(3,2) DEFAULT 0.00 COMMENT '评分',
  `status`        TINYINT NOT NULL DEFAULT 1 COMMENT '1上架 2下架',
  `version`       INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`    DATETIME(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_dish_supplier` (`supplier_id`),
  KEY `idx_dish_category` (`category`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜品库';
```

---

### 2.3 套餐域（2 张）

#### `ab_set_meal` 每日套餐

```sql
CREATE TABLE `ab_set_meal` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `meal_date`     DATE         NOT NULL COMMENT '套餐日期(供哪天吃)',
  `price`         DECIMAL(8,2) NOT NULL COMMENT '售价',
  `cost_price`    DECIMAL(8,2) NOT NULL COMMENT '总成本',
  `total_stock`   INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '总库存',
  `sold_count`    INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已售',
  `cutoff_at`     DATETIME(3)  NOT NULL COMMENT '截单时间',
  `cover_url`     VARCHAR(512) DEFAULT NULL,
  `description`   VARCHAR(512) DEFAULT NULL,
  `status`        TINYINT NOT NULL DEFAULT 1 COMMENT '1待上架 2已上架 3已截单 4已完成 5已取消',
  `created_by`    BIGINT UNSIGNED DEFAULT NULL COMMENT '运营人员',
  `version`       INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_set_meal_date` (`meal_date`),
  KEY `idx_set_meal_status_date` (`status`, `meal_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每日套餐';
```

#### `ab_set_meal_item` 套餐菜品明细

```sql
CREATE TABLE `ab_set_meal_item` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `set_meal_id`   BIGINT UNSIGNED NOT NULL,
  `dish_id`       BIGINT UNSIGNED NOT NULL,
  `supplier_id`   BIGINT UNSIGNED NOT NULL,
  `slot`          TINYINT NOT NULL COMMENT '档位 1主荤 2半荤 3素菜 4汤 5主食',
  `share_amount`  DECIMAL(8,2) DEFAULT NULL COMMENT '本菜供应商分账金额',
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_set_meal_item_meal` (`set_meal_id`),
  KEY `idx_set_meal_item_supplier` (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='套餐菜品明细';
```

---

### 2.4 订单与配送域（5 张）

#### `ab_order` 订单表（**按月分区**）

```sql
CREATE TABLE `ab_order` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_no`         VARCHAR(32) NOT NULL COMMENT '业务订单号',
  `user_id`          BIGINT UNSIGNED NOT NULL,
  `team_leader_id`   BIGINT UNSIGNED DEFAULT NULL,
  `building_id`      BIGINT UNSIGNED NOT NULL,
  `company_id`       BIGINT UNSIGNED DEFAULT NULL,
  `floor`            VARCHAR(32) DEFAULT NULL,
  `set_meal_id`      BIGINT UNSIGNED NOT NULL,
  `meal_date`        DATE NOT NULL,
  `quantity`         INT UNSIGNED NOT NULL DEFAULT 1,
  `unit_price`       DECIMAL(8,2) NOT NULL COMMENT '单价快照',
  `total_amount`     DECIMAL(10,2) NOT NULL,
  `discount_amount`  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `pay_amount`       DECIMAL(10,2) NOT NULL COMMENT '实付',
  `remark`           VARCHAR(256) DEFAULT NULL COMMENT '过敏/备注',
  `status`           VARCHAR(16) NOT NULL DEFAULT 'pending_pay'
                     COMMENT 'pending_pay/paid/cooking/delivering/completed/cancelled/refunded',
  `paid_at`          DATETIME(3) DEFAULT NULL,
  `completed_at`     DATETIME(3) DEFAULT NULL,
  `cancelled_at`     DATETIME(3) DEFAULT NULL,
  `version`          INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`, `created_at`),
  UNIQUE KEY `uk_order_no` (`order_no`, `created_at`),
  KEY `idx_order_user` (`user_id`, `meal_date`),
  KEY `idx_order_set_meal` (`set_meal_id`),
  KEY `idx_order_building_meal` (`building_id`, `meal_date`),
  KEY `idx_order_status` (`status`, `meal_date`),
  KEY `idx_order_team_leader` (`team_leader_id`, `meal_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
PARTITION BY RANGE (TO_DAYS(`created_at`)) (
  PARTITION p202609 VALUES LESS THAN (TO_DAYS('2026-10-01')),
  PARTITION p202610 VALUES LESS THAN (TO_DAYS('2026-11-01')),
  PARTITION p202611 VALUES LESS THAN (TO_DAYS('2026-12-01')),
  PARTITION p202612 VALUES LESS THAN (TO_DAYS('2027-01-01')),
  PARTITION p_max    VALUES LESS THAN MAXVALUE
) COMMENT='订单表';
```

#### `ab_order_item` 订单明细（菜品快照）

```sql
CREATE TABLE `ab_order_item` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id`      BIGINT UNSIGNED NOT NULL,
  `dish_id`       BIGINT UNSIGNED NOT NULL,
  `supplier_id`   BIGINT UNSIGNED NOT NULL,
  `dish_name`     VARCHAR(64) NOT NULL COMMENT '冗余快照',
  `dish_image`    VARCHAR(512) DEFAULT NULL,
  `slot`          TINYINT NOT NULL,
  `unit_price`    DECIMAL(8,2) NOT NULL,
  `quantity`      INT UNSIGNED NOT NULL DEFAULT 1,
  `subtotal`      DECIMAL(10,2) NOT NULL,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_order_item_order` (`order_id`),
  KEY `idx_order_item_supplier` (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单明细';
```

#### `ab_payment_log` 支付流水

```sql
CREATE TABLE `ab_payment_log` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id`      BIGINT UNSIGNED NOT NULL,
  `order_no`      VARCHAR(32) NOT NULL,
  `transaction_id` VARCHAR(64) DEFAULT NULL COMMENT '微信交易号',
  `pay_amount`    DECIMAL(10,2) NOT NULL,
  `pay_method`    VARCHAR(16) NOT NULL DEFAULT 'wxpay_jsapi',
  `status`        VARCHAR(16) NOT NULL DEFAULT 'pending'
                  COMMENT 'pending/success/fail/refunded',
  `paid_at`       DATETIME(3) DEFAULT NULL,
  `raw_response`  JSON DEFAULT NULL,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payment_order` (`order_id`),
  KEY `idx_payment_transaction` (`transaction_id`),
  KEY `idx_payment_status` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付流水';
```

#### `ab_refund` 退款流水

```sql
CREATE TABLE `ab_refund` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `refund_no`     VARCHAR(32) NOT NULL,
  `order_id`      BIGINT UNSIGNED NOT NULL,
  `refund_amount` DECIMAL(10,2) NOT NULL,
  `reason`        VARCHAR(256) DEFAULT NULL,
  `status`        VARCHAR(16) NOT NULL DEFAULT 'pending'
                  COMMENT 'pending/processing/success/fail',
  `wx_refund_id`  VARCHAR(64) DEFAULT NULL COMMENT '微信退款单号',
  `processed_at`  DATETIME(3) DEFAULT NULL,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_refund_no` (`refund_no`),
  KEY `idx_refund_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='退款流水';
```

#### `ab_delivery_note` 配送单

```sql
CREATE TABLE `ab_delivery_note` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `delivery_no`      VARCHAR(32) NOT NULL,
  `meal_date`        DATE NOT NULL,
  `building_id`      BIGINT UNSIGNED NOT NULL,
  `floor_leader_id`  BIGINT UNSIGNED DEFAULT NULL,
  `total_quantity`   INT UNSIGNED NOT NULL DEFAULT 0,
  `dish_breakdown`   JSON DEFAULT NULL COMMENT '{dishId: qty}',
  `qrcode_token`     VARCHAR(64) DEFAULT NULL COMMENT '签收二维码 token',
  `status`           VARCHAR(16) NOT NULL DEFAULT 'pending'
                     COMMENT 'pending/in_transit/signed/distributing/completed',
  `signed_at`        DATETIME(3) DEFAULT NULL,
  `signed_by`        BIGINT UNSIGNED DEFAULT NULL,
  `expected_at`      DATETIME(3) DEFAULT NULL COMMENT '预计送达',
  `version`          INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_delivery_no` (`delivery_no`),
  KEY `idx_delivery_meal_building` (`meal_date`, `building_id`),
  KEY `idx_delivery_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配送单';
```

---

### 2.5 财务域（3 张）

#### `ab_commission` 团长佣金流水

```sql
CREATE TABLE `ab_commission` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `team_leader_id` BIGINT UNSIGNED NOT NULL,
  `order_id`      BIGINT UNSIGNED NOT NULL,
  `order_amount`  DECIMAL(10,2) NOT NULL,
  `commission_rate` DECIMAL(5,4) NOT NULL,
  `commission_amount` DECIMAL(10,2) NOT NULL,
  `settlement_date` DATE NOT NULL COMMENT '结算日期 T+1',
  `status`        VARCHAR(16) NOT NULL DEFAULT 'pending'
                  COMMENT 'pending/settled/withdrawn/failed',
  `wx_payment_no` VARCHAR(64) DEFAULT NULL COMMENT '企业付款单号',
  `settled_at`    DATETIME(3) DEFAULT NULL,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_commission_order` (`order_id`),
  KEY `idx_commission_leader_date` (`team_leader_id`, `settlement_date`),
  KEY `idx_commission_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='团长佣金流水';
```

#### `ab_supplier_share` 供应商分账流水

```sql
CREATE TABLE `ab_supplier_share` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id`      BIGINT UNSIGNED NOT NULL,
  `supplier_id`   BIGINT UNSIGNED NOT NULL,
  `order_item_id` BIGINT UNSIGNED NOT NULL,
  `share_amount`  DECIMAL(10,2) NOT NULL,
  `share_rate`    DECIMAL(5,4) NOT NULL,
  `status`        VARCHAR(16) NOT NULL DEFAULT 'pending'
                  COMMENT 'pending/processing/success/fail/refunded',
  `wx_share_id`   VARCHAR(64) DEFAULT NULL COMMENT '微信分账单号',
  `settled_at`    DATETIME(3) DEFAULT NULL,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_share_order_item` (`order_item_id`),
  KEY `idx_share_supplier_date` (`supplier_id`, `created_at`),
  KEY `idx_share_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商分账流水';
```

---

### 2.6 系统域（3 张）

#### `ab_admin_user` 后台账号

```sql
CREATE TABLE `ab_admin_user` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username`      VARCHAR(64) NOT NULL,
  `password_hash` VARCHAR(128) NOT NULL,
  `real_name`     VARCHAR(32) DEFAULT NULL,
  `role`          VARCHAR(32) NOT NULL DEFAULT 'operator'
                  COMMENT 'super_admin/admin/operator/finance/viewer',
  `phone`         VARCHAR(20) DEFAULT NULL,
  `status`        TINYINT NOT NULL DEFAULT 1,
  `last_login_at` DATETIME(3) DEFAULT NULL,
  `version`       INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_admin_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='后台账号';
```

#### `ab_operation_log` 操作日志

```sql
CREATE TABLE `ab_operation_log` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_user_id` BIGINT UNSIGNED DEFAULT NULL,
  `module`        VARCHAR(32) NOT NULL COMMENT '模块名',
  `action`        VARCHAR(32) NOT NULL COMMENT '操作类型',
  `target_id`     VARCHAR(64) DEFAULT NULL COMMENT '对象ID',
  `request_ip`    VARCHAR(64) DEFAULT NULL,
  `request_data`  JSON DEFAULT NULL,
  `response_data` JSON DEFAULT NULL,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_oplog_user_time` (`admin_user_id`, `created_at`),
  KEY `idx_oplog_module_action` (`module`, `action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志';
```

#### `ab_config` 系统配置字典

```sql
CREATE TABLE `ab_config` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `config_key`    VARCHAR(64) NOT NULL,
  `config_value`  TEXT NOT NULL,
  `description`   VARCHAR(256) DEFAULT NULL,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配置字典';
```

#### `ab_message` 消息推送日志

```sql
CREATE TABLE `ab_message` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`       BIGINT UNSIGNED DEFAULT NULL,
  `openid`        VARCHAR(64) DEFAULT NULL,
  `template_id`   VARCHAR(64) NOT NULL COMMENT '微信订阅消息模板ID',
  `payload`       JSON NOT NULL,
  `status`        VARCHAR(16) NOT NULL DEFAULT 'pending'
                  COMMENT 'pending/success/fail',
  `error_msg`     VARCHAR(256) DEFAULT NULL,
  `sent_at`       DATETIME(3) DEFAULT NULL,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_msg_user_time` (`user_id`, `created_at`),
  KEY `idx_msg_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息推送日志';
```

---

## 三、关键索引说明

| 表 | 索引 | 用途 |
| --- | --- | --- |
| `ab_order` | `idx_order_building_meal` (building_id, meal_date) | 配送单生成（按办公楼聚合） |
| `ab_order` | `idx_order_team_leader` (team_leader_id, meal_date) | 团长佣金跑批 |
| `ab_order` | `idx_order_status` (status, meal_date) | 订单中心筛选 |
| `ab_commission` | `idx_commission_leader_date` (team_leader_id, settlement_date) | 团长结算跑批 |
| `ab_supplier_share` | `idx_share_supplier_date` (supplier_id, created_at) | 供应商对账 |
| `ab_delivery_note` | `idx_delivery_meal_building` (meal_date, building_id) | 楼长看今日配送单 |
| `ab_set_meal` | `uk_set_meal_date` (meal_date) | 一日一套餐约束 |
| `ab_user` | `idx_user_phone_hash` (phone_hash) | 团长查询脱敏后的用户手机 |

---

## 四、状态机一览

### 4.1 订单状态机

```
            ┌──────────────┐
            │ pending_pay  │ (待支付)
            └──────┬───────┘
                   │ 支付成功 / 30min超时取消
        ┌──────────┴──────────┐
        ▼                     ▼
   ┌─────────┐          ┌──────────┐
   │  paid   │          │cancelled │
   └────┬────┘          └──────────┘
        │ 截单+商家确认
        ▼
   ┌─────────┐
   │ cooking │
   └────┬────┘
        │ 配送员取餐
        ▼
   ┌───────────┐
   │ delivering│
   └────┬──────┘
        │ 楼长签收
        ▼
   ┌───────────┐
   │distributed│ (待取餐)
   └────┬──────┘
        │ 用户取餐
        ▼
   ┌─────────┐
   │completed│
   └─────────┘

退订路径：
  pending_pay ──(用户取消/截单)──> cancelled
  paid/cooking ──(客服介入)──> refunding ──> refunded
```

### 4.2 套餐状态机

```
draft → on_sale (T-1 09:00) → cut_off (T-1 20:00) → serving (T-1 22:00 后) → finished (T 日 14:00) → archived
```

---

## 五、数据归档与备份策略

| 表 | 归档策略 |
| --- | --- |
| `ab_order` | 按月 RANGE PARTITION；3 个月前的分区可归档到 OSS / 冷库 |
| `ab_message` | 保留 90 天，超过自动删除 |
| `ab_payment_log` | 永久保留（合规要求） |
| `ab_commission` / `ab_supplier_share` | 永久保留（财务合规） |
| 备份 | 每日 02:00 mysqldump 全量 + 增量 binlog；保留 30 天 |

---

## 六、初始数据 Seed

```sql
-- 办公楼种子
INSERT INTO ab_building (name, address, city, district) VALUES
('国贸大厦', '建国门外大街1号', '北京', '朝阳区'),
('银泰中心', '建国门外大街2号', '北京', '朝阳区');

-- 系统配置种子
INSERT INTO ab_config (config_key, config_value, description) VALUES
('set_meal.price', '28.00', '套餐默认售价'),
('set_meal.cutoff_time', '20:00', '每日截单时间'),
('set_meal.publish_time', '09:00', '每日套餐上架时间'),
('commission.rate', '0.1000', '团长佣金比例'),
('commission.min_withdraw', '10.00', '最低提现金额'),
('commission.auto_settle_hour', '02:00', '佣金自动结算时点'),
('floor_leader.subsidy', '5.00', '楼长每次补贴金额'),
('delivery.expected_hour', '11:00', '预计送达时间');
```

---

## 七、性能预估（单办公楼 100 单 / 天）

| 接口 | QPS 预估 | 响应时间 P99 |
| --- | --- | --- |
| 首页加载套餐 | 50 | < 200ms |
| 下单提交 | 5 | < 500ms |
| 订单列表 | 10 | < 300ms |
| 团长佣金跑批 | 1（每日 1 次） | < 30s |
| 配送单生成 | 1 | < 10s |

> 单机 4C8G MySQL 可承载 10 个办公楼（1000 单/天）。10+ 办公楼需主从分离 + Redis 缓存套餐。

---

*文档结束 · ABox 一盒 · 数据库 ER v1.0 · 21 张表*
