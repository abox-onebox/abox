// B3 验证（零污染）：operator1 带 base64 编码的 X-KB-* 头调 operator 类写接口，body 故意为空 → 400 但审计仍落库
import mysql from 'mysql2/promise';

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

const creds = { username: 'operator1', password: '4b2787f89ff2a083' };
const loginRes = await fetch('http://localhost:3000/api/v1/auth/admin-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(creds),
});
const loginJson = await loginRes.json();
const token = loginJson?.data?.token || loginJson?.token;
if (!token) {
  console.log('LOGIN_FAIL', JSON.stringify(loginJson));
  process.exit(1);
}
console.log('LOGIN_OK');

const opRes = await fetch('http://localhost:3000/api/v1/admin/meal/templates', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token,
    'X-KB-Operator': b64('测试员-张三'),
    'X-KB-NL': b64('给国贸三期组分配明天的红烧肉套餐'),
    'X-KB-OpBlock': b64(JSON.stringify({ op: 'assign_meal', buildingGroupId: 3, setMealId: 1 })),
  },
  body: JSON.stringify({}), // 故意无效 → 期望 400，但不建实体，仅落审计
});
const opJson = await opRes.json().catch(() => null);
console.log('OP_STATUS', opRes.status, 'CODE', opJson?.code, 'MSG', opJson?.message);

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'mysql',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || 'abox_onebox',
});
const [rows] = await conn.query(
  'SELECT id, module, action, admin_user_id, kb_operator, kb_nl_intent, kb_op_block FROM ab_operation_log WHERE admin_user_id=4 ORDER BY id DESC LIMIT 1',
);
console.log('LATEST_AUDIT', JSON.stringify(rows[0]));
await conn.end();
