// 阶段 3 · 生产库建表（幂等，不跑 migration:run，与迁移 1700000000009 对齐）
// 容器内运行：docker exec -u root abox-api-prod node /app/create-operation-request-table.mjs
import mysql from 'mysql2/promise';

const env = process.env;
const cfg = {
  host: env.DB_HOST || 'mysql',
  port: Number(env.DB_PORT || 3306),
  user: env.DB_USER || 'root',
  password: env.DB_PASSWORD || '',
  database: env.DB_DATABASE || 'abox_onebox',
};

const sql = `
CREATE TABLE IF NOT EXISTS \`ab_operation_request\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`op_code\` VARCHAR(48) NOT NULL,
  \`op_label\` VARCHAR(96) NOT NULL,
  \`risk\` VARCHAR(16) NOT NULL DEFAULT 'admin',
  \`params\` JSON NOT NULL,
  \`status\` VARCHAR(16) NOT NULL DEFAULT 'pending',
  \`submitter_kb\` VARCHAR(64) NULL DEFAULT NULL,
  \`submitter_admin_id\` BIGINT NULL DEFAULT NULL,
  \`submitter_nl\` TEXT NULL,
  \`submitter_op_block\` JSON NULL,
  \`approver_id\` BIGINT NULL DEFAULT NULL,
  \`approved_at\` DATETIME(3) NULL DEFAULT NULL,
  \`reject_reason\` VARCHAR(255) NULL DEFAULT NULL,
  \`snapshot\` JSON NULL,
  \`executed_at\` DATETIME(3) NULL DEFAULT NULL,
  \`version\` INT NOT NULL DEFAULT 0,
  \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  KEY \`idx_opreq_status\` (\`status\`),
  KEY \`idx_opreq_submitter\` (\`submitter_admin_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='替操作高危审批申请单（阶段3）'
`;

const conn = await mysql.createConnection(cfg);
await conn.query(sql);
const [rows] = await conn.query(`SHOW TABLES LIKE 'ab_operation_request'`);
console.log(rows.length ? 'TABLE_OK ab_operation_request' : 'TABLE_MISSING');
await conn.end();
