// 创建后台 operator（运营操作员）账号 —— 在 api 容器内运行
// 用法：node /app/create-operator.mjs <初始口令> <用户名> [真实姓名]
// 哈希方式与 common/utils/password.ts 的 hashPassword 完全一致（scrypt N=16384/r=8/p=1/keyLen=32）
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';

const plain = process.argv[2];
const username = process.argv[3] || 'operator1';
const realName = process.argv[4] || '运营操作员';

if (!plain || plain.length < 8) {
  console.error('✗ 口令至少 8 位：node /app/create-operator.mjs <口令> <用户名> [姓名]');
  process.exit(2);
}

const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(plain, salt, 32).toString('hex');
const passwordHash = `scrypt:${salt}:${hash}`;

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'mysql',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || 'abox_onebox',
});

try {
  const [existing] = await conn.query(
    'SELECT id, username, role, status FROM ab_admin_user WHERE username = ?',
    [username],
  );
  if (existing.length) {
    console.log('EXISTS', JSON.stringify(existing[0]));
    process.exit(0);
  }

  const [res] = await conn.query(
    `INSERT INTO ab_admin_user
       (username, password_hash, real_name, role, supplier_id, phone, status, version, created_at, updated_at)
     VALUES (?, ?, ?, 'operator', NULL, NULL, 1, 0, NOW(), NOW())`,
    [username, passwordHash, realName],
  );
  console.log('CREATED id=' + res.insertId + ' username=' + username + ' role=operator status=1');
  console.log('INITIAL_PASSWORD=' + plain);
} finally {
  await conn.end();
}
