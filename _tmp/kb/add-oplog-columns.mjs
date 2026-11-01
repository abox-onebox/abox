// 生产库加列：ab_operation_log 增 kb_operator / kb_nl_intent / kb_op_block（B3 · 2026-10-18）
// 在 api 容器内运行：node /app/add-oplog-columns.mjs
// 幂等：列已存在则跳过；默认 dry-run，须带 --apply 才真改表。
import mysql from 'mysql2/promise';

const APPLY = process.argv.includes('--apply');

const cols = [
  { name: 'kb_operator', ddl: "VARCHAR(64) NULL DEFAULT NULL COMMENT '知识助手自报操作人（X-KB-Operator）'" },
  { name: 'kb_nl_intent', ddl: "TEXT NULL COMMENT '知识助手自然语言指令（X-KB-NL）'" },
  { name: 'kb_op_block', ddl: "TEXT NULL COMMENT '知识助手生成的操作块JSON（X-KB-OpBlock）'" },
];

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'mysql',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || 'abox_onebox',
});

try {
  for (const c of cols) {
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ab_operation_log' AND COLUMN_NAME = ?`,
      [c.name],
    );
    if (Array.isArray(rows) && rows.length > 0) {
      console.log(`SKIP  ${c.name} (exists)`);
      continue;
    }
    if (!APPLY) {
      console.log(`WOULD ADD ${c.name} (dry-run)`);
      continue;
    }
    await conn.query(`ALTER TABLE \`ab_operation_log\` ADD COLUMN \`${c.name}\` ${c.ddl}`);
    console.log(`ADDED ${c.name}`);
  }
  if (!APPLY) console.log('\n(dry-run) 加 --apply 才真改表');
} finally {
  await conn.end();
}
