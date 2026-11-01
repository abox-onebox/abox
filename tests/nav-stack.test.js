// 导航栈逻辑沙盒测试 v3（同步 v4.7.8：P11-P20 role 全部为 user，与团长共用同一身份）
const PAGES = [
  {id:'P1',  role:'user'}, {id:'P3',  role:'user'}, {id:'P4',  role:'user'},
  {id:'P5',  role:'user'}, {id:'P6',  role:'user'}, {id:'P7',  role:'user'},
  {id:'P8',  role:'user'}, {id:'P9',  role:'user'}, {id:'P10', role:'user'},
  // ========== 团长端 10 页 · P11-P20 与用户共用同一身份（v4.7.8）==========
  {id:'P11', role:'user'}, {id:'P12', role:'user'}, {id:'P13', role:'user'},
  {id:'P14', role:'user'}, {id:'P15', role:'user'}, {id:'P16', role:'user'},
  {id:'P17', role:'user'}, {id:'P18', role:'user'}, {id:'P19', role:'user'},
  {id:'P20', role:'user'},
  {id:'P21', role:'merchant'}, {id:'P22', role:'merchant'}, {id:'P23', role:'merchant'},
  {id:'P24', role:'merchant'}, {id:'P25', role:'merchant'}, {id:'P26', role:'merchant'},
  {id:'P27', role:'admin'}, {id:'P28', role:'admin'}, {id:'P29', role:'admin'},
  {id:'P30', role:'admin'}, {id:'P31', role:'admin'}, {id:'P32', role:'admin'},
  {id:'P33', role:'admin'}, {id:'P34', role:'admin'}, {id:'P35', role:'admin'},
  {id:'P36', role:'admin'}, {id:'P37', role:'admin'},
  {id:'P38', role:'user'},
];

let currentPageIndex = -1;
let currentRole = 'user';
const navHistory = [];
const MAX_NAV = 30;
let _navBackInProgress = false;
let _suppressPush = false;

function switchPage(index) {
  if (index < 0 || index >= PAGES.length) return;
  if (!_navBackInProgress && !_suppressPush && currentPageIndex !== index && currentPageIndex >= 0) {
    if (PAGES[currentPageIndex].id !== PAGES[index].id) {
      navHistory.push({pageId: PAGES[currentPageIndex].id, scrollY: 0, role: PAGES[currentPageIndex].role});
      while (navHistory.length > MAX_NAV) navHistory.shift();
    }
  }
  let visibleIndex = index;
  if (currentRole !== 'all') {
    if (PAGES[index].role !== currentRole) {
      const first = PAGES.findIndex(p => p.role === currentRole);
      if (first < 0) return;
      visibleIndex = first;
    }
  }
  currentPageIndex = visibleIndex;
  currentRole = PAGES[visibleIndex].role;
}

function switchPageNoPush(index) { _suppressPush = true; switchPage(index); _suppressPush = false; }

function goToPage(id) {
  const idx = PAGES.findIndex(p => p.id === id);
  if (idx < 0) return;
  const stackPos = navHistory.map(h => h.pageId).lastIndexOf(id);
  if (stackPos >= 0) {
    navHistory.length = stackPos;
    _navBackInProgress = true;
    switchPage(idx);
    _navBackInProgress = false;
    return;
  }
  switchPage(idx);
}

function navigateBack() {
  if (navHistory.length === 0) {
    if (currentRole === 'all') switchPageNoPush(0);
    else { const f = PAGES.findIndex(p => p.role === currentRole); if (f >= 0) switchPageNoPush(f); }
    return;
  }
  const prev = navHistory.pop();
  const idx = PAGES.findIndex(p => p.id === prev.pageId);
  if (idx < 0) return;
  if (prev.role && prev.role !== currentRole) currentRole = prev.role;
  _navBackInProgress = true;
  switchPage(idx);
  _navBackInProgress = false;
}

function switchTab(pageId) {
  const idx = PAGES.findIndex(p => p.id === pageId);
  if (idx < 0) return;
  navHistory.length = 0;
  if (PAGES[idx].role !== currentRole) currentRole = PAGES[idx].role;
  switchPageNoPush(idx);
}

function switchRoleFn(role) {
  navHistory.length = 0;
  currentRole = role;
  if (role === 'all') switchPageNoPush(0);
  else { const f = PAGES.findIndex(p => p.role === role); if (f >= 0) switchPageNoPush(f); }
}

function cur() { return PAGES[currentPageIndex]?.id; }
function stack() { return navHistory.map(h => h.pageId).join(' > ') || '(空)'; }

let pass = 0, fail = 0;
function assert(desc, actual, expected) {
  const ok = actual === expected;
  console.log(`  ${ok ? '✅' : '❌'} ${desc}  实际=${actual}  期望=${expected}`);
  ok ? pass++ : fail++;
}

console.log('\n【测试1】用户端 A→B→C 链式返回');
switchRoleFn('user');
assert('起点 P1', cur(), 'P1');
goToPage('P3'); assert('P1→P3', cur(), 'P3');
goToPage('P5'); assert('P3→P5', cur(), 'P5');
goToPage('P6'); assert('P5→P6', cur(), 'P6');
assert('栈 = P1>P3>P5', stack(), 'P1 > P3 > P5');
navigateBack(); assert('返回一次 → P5', cur(), 'P5');
navigateBack(); assert('返回两次 → P3', cur(), 'P3');
navigateBack(); assert('返回三次 → P1', cur(), 'P1');
navigateBack(); assert('栈空再返回 → 停 P1', cur(), 'P1');

console.log('\n【测试2】P38 供应商（跳号插入末尾）');
switchRoleFn('user');
switchTab('P38'); assert('tabBar 点供应商 → P38', cur(), 'P38');
assert('tabBar 清栈', stack(), '(空)');
switchTab('P1'); assert('tabBar 回首页 → P1', cur(), 'P1');
switchTab('P38'); assert('再点供应商 → P38', cur(), 'P38');
switchTab('P5'); assert('tabBar 点订单 → P5', cur(), 'P5');

console.log('\n【测试3】团长端（v4.7.8 同 user 角色）链式返回');
switchRoleFn('user'); assert('起点 P1', cur(), 'P1');
goToPage('P11'); assert('P1→P11 团长工作台', cur(), 'P11');
goToPage('P13'); assert('P11→P13', cur(), 'P13');
goToPage('P14'); assert('P13→P14', cur(), 'P14');
navigateBack(); assert('返回 → P13', cur(), 'P13');
navigateBack(); assert('返回 → P11', cur(), 'P11');
navigateBack(); assert('返回 → P1', cur(), 'P1');

console.log('\n【测试4】角色切换清栈（用户/商家/后台）');
switchRoleFn('merchant'); assert('切商家端 → P21', cur(), 'P21');
goToPage('P23'); goToPage('P24');
assert('栈有内容', navHistory.length > 0, true);
switchRoleFn('admin'); assert('切后台 → 清栈', stack(), '(空)');
assert('后台首页 P27', cur(), 'P27');
switchRoleFn('user'); assert('切回用户端 → P1', cur(), 'P1');
switchRoleFn('all'); assert('全部模式 → P1', cur(), 'P1');

console.log('\n【测试5】重复跳转不入栈');
switchRoleFn('user');
goToPage('P5'); goToPage('P5'); goToPage('P5');
assert('重复跳 P5 只入栈一次', navHistory.length, 1);

console.log('\n【测试6】栈上限 30（直接灌栈验证 shift）');
switchRoleFn('user');
for (let i = 0; i < 50; i++) navHistory.push({pageId:'PX'+i, scrollY:0, role:'user'});
assert('灌入 50 条', navHistory.length, 50);
goToPage('P5');   // 触发一次入栈 → 超限 shift
assert('栈被截到 ≤ 30', navHistory.length <= 30, true);
assert('栈长 = 30', navHistory.length, 30);

console.log('\n【测试7】同角色过滤（v4.7.8 后所有团长页都是 user 角色）');
switchRoleFn('user');
goToPage('P11');  // 同 user 角色，能正常跳转（不再是切角色）
assert('P1→P11 团长工作台成功', cur(), 'P11');
navigateBack(); assert('返回 → P1', cur(), 'P1');
goToPage('P22');  // merchant 角色，应被过滤回 user 首页
assert('从 user 跳商家页 → 留 P1', cur(), 'P1');

console.log('\n【测试8】商家端 + 后台端链式返回');
switchRoleFn('merchant'); assert('商家端 P21', cur(), 'P21');
goToPage('P24'); goToPage('P25'); goToPage('P26');
assert('栈 = P21>P24>P25', stack(), 'P21 > P24 > P25');
navigateBack(); assert('返回 → P25', cur(), 'P25');
navigateBack(); assert('返回 → P24', cur(), 'P24');
navigateBack(); assert('返回 → P21', cur(), 'P21');
switchRoleFn('admin');
goToPage('P29'); goToPage('P31'); goToPage('P37');
assert('后台栈 = P27>P29>P31', stack(), 'P27 > P29 > P31');
navigateBack(); assert('返回 → P31', cur(), 'P31');
navigateBack(); assert('返回 → P29', cur(), 'P29');

console.log('\n【测试9】tabBar 切换后返回不回错页');
switchRoleFn('user');
goToPage('P5'); goToPage('P6');
switchTab('P8');   // tabBar 跳"我的" → 清栈
assert('tabBar → P8', cur(), 'P8');
navigateBack();    // 栈已清，应停角色首页 P1
assert('栈空返回 → P1（不回 P6）', cur(), 'P1');

console.log('\n【测试10】智能回退（目标页在栈中 → 截断）');
switchRoleFn('user');
goToPage('P3'); goToPage('P5'); goToPage('P6');
assert('栈 = P1>P3>P5', stack(), 'P1 > P3 > P5');
goToPage('P3');   // 目标 P3 在栈中位置 1 → 截断到 [P1]
assert('回退到 P3', cur(), 'P3');
assert('栈截断为 P1', stack(), 'P1');
navigateBack(); assert('再返回 → P1', cur(), 'P1');

console.log('\n【测试11】"返回首页"后不再弹回详情页');
switchRoleFn('user');
goToPage('P3'); goToPage('P4'); goToPage('P5');
assert('栈 = P1>P3>P4', stack(), 'P1 > P3 > P4');
goToPage('P1');   // 返回首页 → 栈截断到 0
assert('回首页 P1', cur(), 'P1');
assert('栈清空', stack(), '(空)');
navigateBack(); assert('返回停 P1（不回 P5）', cur(), 'P1');

console.log('\n【测试12】订单流程链路 · v4.7.9 修复 hardcode backTo');
// 场景 A：从 P4 支付成功 → P5 详情 → 返回应该回 P4（不是 P6）
switchRoleFn('user');
goToPage('P3'); goToPage('P4'); goToPage('P5');
assert('从 P4 进 P5', cur(), 'P5');
assert('栈 = P1>P3>P4', stack(), 'P1 > P3 > P4');
navigateBack(); assert('按 ‹ 回 P4（不是 P6）', cur(), 'P4');
navigateBack(); assert('再按 ‹ 回 P3', cur(), 'P3');
// 场景 B：从 P6 订单列表 → 点订单 → P5 → 返回应该回 P6
goToPage('P6'); goToPage('P5');
assert('从 P6 进 P5', cur(), 'P5');
navigateBack(); assert('按 ‹ 回 P6（不是 P4）', cur(), 'P6');
// 场景 C：进 P5 后立即按取消 → P7 → 返回应该回 P5（不是 P6）
switchRoleFn('user'); goToPage('P3'); goToPage('P4'); goToPage('P5'); goToPage('P7');
assert('从 P5 进 P7', cur(), 'P7');
assert('栈含 P5', stack().includes('P5'), true);
navigateBack(); assert('按 ‹ 回 P5（不是 P6）', cur(), 'P5');

console.log(`\n===== 结果：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
