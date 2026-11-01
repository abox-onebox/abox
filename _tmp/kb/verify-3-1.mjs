// 阶段 3-1 端到端验证（容器内运行）
// 1) 取 super_admin id + 任一 leader id
// 2) 用 HS256 mint 令牌（operator1 提交，super_admin 审批/执行）
// 3) submit → approve → execute（leader_audit/note，低风险），验证状态机 + 执行内部调用 + B3 审计
// 4) 清理测试数据（request + 对应 oplog），保持生产库干净
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
const [admins] = await conn.query(
  "SELECT id,username,role FROM ab_admin_user WHERE role='super_admin' LIMIT 1",
);
const superAdmin = admins[0];
const [leaders] = await conn.query('SELECT id FROM ab_team_leader LIMIT 1');
const leaderId = leaders[0]?.id;
await conn.end();

if (!superAdmin) throw new Error('no super_admin found');
if (!leaderId) throw new Error('no leader found');

const opToken = sign(4, 'operator', 'operator1'); // operator1 提交
const adminToken = sign(superAdmin.id, 'super_admin', superAdmin.username);

const j = (r) => r.json().catch(() => null);
const headers = (t) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` });

// 1) 列表（验证模块已加载）
let r = await fetch(`${PREFIX}/admin/operation-requests`, { headers: headers(adminToken) });
console.log('LIST', r.status, JSON.stringify(await j(r)).slice(0, 120));

// 2) 提交
const params = { id: leaderId, action: 'note', reason: '阶段3验证' };
r = await fetch(`${PREFIX}/admin/operation-requests`, {
  method: 'POST',
  headers: headers(opToken),
  body: JSON.stringify({
    opCode: 'leader_audit',
    params,
    submitterKb: '验证脚本',
    submitterNl: '测试自然语言意图：给团长留个备注',
    submitterOpBlock: { op: 'leader_audit', params },
  }),
});
const created = await j(r);
console.log('SUBMIT', r.status, 'id=', created?.data?.id, 'status=', created?.data?.status);
const reqId = created?.data?.id;
if (!reqId) throw new Error('submit failed');

// 3) 审批（两步-approve）
r = await fetch(`${PREFIX}/admin/operation-requests/${reqId}/approve`, {
  method: 'POST',
  headers: headers(adminToken),
});
const approved = await j(r);
console.log('APPROVE', r.status, 'status=', approved?.data?.status);

// 4) 执行（两步-execute，内部调原目标接口）
r = await fetch(`${PREFIX}/admin/operation-requests/${reqId}/execute`, {
  method: 'POST',
  headers: headers(adminToken),
});
const executed = await j(r);
console.log('EXECUTE', r.status, 'status=', executed?.data?.status, 'snapshot=', JSON.stringify(executed?.data?.snapshot).slice(0, 200));

// 5) 查 oplog 的 B3 字段（应由执行内部调用带回）
const c2 = await mysql.createConnection(DB);
const [logs] = await c2.query(
  'SELECT id,kb_operator,kb_nl_intent,kb_op_block FROM ab_operation_log WHERE kb_operator=? ORDER BY id DESC LIMIT 1',
  ['验证脚本'],
);
await c2.end();
const log = logs[0];
console.log('OPLOG', log ? `id=${log.id}` : 'NONE');
console.log('  kb_operator =', log?.kb_operator);
console.log('  kb_nl_intent =', log?.kb_nl_intent);
console.log('  kb_op_block =', log?.kb_op_block);

// 6) 清理测试数据
const c3 = await mysql.createConnection(DB);
if (log) await c3.query('DELETE FROM ab_operation_log WHERE id=?', [log.id]);
await c3.query('DELETE FROM ab_operation_request WHERE id=?', [reqId]);
await c3.end();
console.log('CLEANUP done (request', reqId, '+ oplog', log?.id, 'removed)');
