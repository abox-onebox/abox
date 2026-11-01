// 阶段 4 端到端验证（容器内运行）：验证审批流白名单扩 send_message / manual_adjust
// submit(operator1) → approve(super_admin) → execute(send_message, dryRun 安全) + B3 审计；清理测试数据
import crypto from 'crypto';
import mysql from 'mysql2/promise';

const env = process.env;
const DB = {
  host: env.DB_HOST || 'mysql',
  port: Number(env.DB_PORT || 3306),
  user: env.DB_USER || 'root',
  password: env.DB_PASSWORD || '',
  database: env.DB_DATABASE || 'abox_onebox',
};
const JWT_SECRET = env.JWT_SECRET || '';
const PREFIX = `http://localhost:${env.APP_PORT || 3000}/api/v1`;

const b64url = (o) =>
  Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function sign(sub, role, username) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub, typ: 'admin', role, username, supplierId: null, iat: now, exp: now + 3600 };
  const seg = b64url(header) + '.' + b64url(payload);
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(seg).digest('base64url');
  return seg + '.' + sig;
}

const conn = await mysql.createConnection(DB);
const [admins] = await conn.query("SELECT id,username,role FROM ab_admin_user WHERE role='super_admin' LIMIT 1");
const superAdmin = admins[0];
await conn.end();
if (!superAdmin) throw new Error('no super_admin found');

const opToken = sign(4, 'operator', 'operator1');
const adminToken = sign(superAdmin.id, 'super_admin', superAdmin.username);
const j = (r) => r.json().catch(() => null);
const H = (t) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` });

// 列表
let r = await fetch(`${PREFIX}/admin/operation-requests`, { headers: H(adminToken) });
console.log('LIST', r.status);

async function submit(opCode, params, tag) {
  const r = await fetch(`${PREFIX}/admin/operation-requests`, {
    method: 'POST', headers: H(opToken),
    body: JSON.stringify({ opCode, params, submitterKb: tag, submitterNl: `阶段4验证 ${opCode}`, submitterOpBlock: { op: opCode, params } }),
  });
  const c = await j(r);
  console.log('SUBMIT', opCode, r.status, 'id=', c?.data?.id, 'status=', c?.data?.status);
  return c?.data?.id;
}
async function approve(id) {
  const r = await fetch(`${PREFIX}/admin/operation-requests/${id}/approve`, { method: 'POST', headers: H(adminToken) });
  const c = await j(r);
  console.log('APPROVE', id, r.status, 'status=', c?.data?.status);
}
async function execute(id) {
  const r = await fetch(`${PREFIX}/admin/operation-requests/${id}/execute`, { method: 'POST', headers: H(adminToken) });
  const c = await j(r);
  console.log('EXECUTE', id, r.status, 'status=', c?.data?.status, 'snap=', JSON.stringify(c?.data?.snapshot).slice(0, 160));
}

const idSend = await submit('send_message', { scene: 'cutoff_remind', audience: 'cutoff_remind_pending', dryRun: true, mealDate: '2026-10-20' }, 'v4-send');
const idAdj = await submit('manual_adjust', { orderNo: 'AB20261020000099', action: 'change_quantity', reason: '阶段4验证改单', quantity: 2 }, 'v4-adjust');
if (!idSend || !idAdj) throw new Error('submit failed');
await approve(idSend);
await approve(idAdj);
await execute(idSend); // dryRun=true 只解析受众不投递，安全

// 查 B3
const c2 = await mysql.createConnection(DB);
const [logs] = await c2.query('SELECT id,kb_operator,kb_nl_intent,kb_op_block FROM ab_operation_log WHERE kb_operator=? ORDER BY id DESC LIMIT 1', ['v4-send']);
await c2.end();
const log = logs[0];
console.log('OPLOG', log ? `id=${log.id}` : 'NONE');
console.log('  kb_operator =', log?.kb_operator);
console.log('  kb_nl_intent =', log?.kb_nl_intent);
console.log('  kb_op_block =', log?.kb_op_block);

// 清理
const c3 = await mysql.createConnection(DB);
if (log) await c3.query('DELETE FROM ab_operation_log WHERE id=?', [log.id]);
await c3.query('DELETE FROM ab_operation_request WHERE id IN (?,?)', [idSend, idAdj]);
await c3.end();
console.log('CLEANUP done (requests', idSend, idAdj, '+ oplog', log?.id, 'removed)');
