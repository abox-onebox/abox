// 轻量浏览器模拟：执行 prototype/index.html 里的关键 render 函数，看有没报错
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'prototype', 'index.html'), 'utf8');

// 1) 提取 <script>...</script>
const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
let code = '';
let m;
while ((m = scriptRe.exec(html)) !== null) {
  if (m[1].trim()) code += m[1] + '\n';
}

// 2) 找 PAGES 数组定义，提取每个 admin 页面的 render 调用
const pagesIdx = code.indexOf('// ========== 后台（11 页）==========');
// 3) 准备 mock document / window / localStorage / showModal 等
function makeMockEl() {
  return {
    classList: { add: ()=>{}, remove: ()=>{}, toggle: ()=>{}, contains: ()=>false },
    appendChild: ()=>{},
    removeChild: ()=>{},
    addEventListener: ()=>{},
    removeEventListener: ()=>{},
    setAttribute: ()=>{},
    removeAttribute: ()=>{},
    querySelector: () => makeMockEl(),
    querySelectorAll: ()=>[],
    style: {},
    innerHTML: '',
    textContent: '',
    value: '',
    title: '',
    children: [],
    dataset: {},
    id: '',
    parentNode: null,
  };
}
const sandbox = {
  console,
  setTimeout: () => 0,
  clearTimeout: () => 0,
  setInterval: () => 0,
  clearInterval: () => 0,
  Date,
  JSON,
  Math,
  Array,
  String,
  Number,
  Object,
  Promise,
  location: { reload: () => {} },
  localStorage: { getItem: () => null, setItem: () => null, removeItem: () => null },
  window: {},
  document: {
    getElementById: () => makeMockEl(),
    querySelector: () => makeMockEl(),
    querySelectorAll: () => [],
    getElementsByClassName: () => [],
    getElementsByTagName: () => [],
    createElement: () => makeMockEl(),
    createDocumentFragment: () => makeMockEl(),
    body: makeMockEl(),
    head: makeMockEl(),
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  // 全局函数占位
  toast: () => {},
  showModal: () => {},
  closeModal: () => {},
  switchRoleFn: () => {},
  switchPageNoPush: () => {},
  goToPage: () => {},
  setIsLeader: () => {},
  refreshCurrentPage: () => {},
  navigateBack: () => {},
  requestAnimationFrame: () => {},
  isLeader: false,
  currentRole: 'admin',
  // navigator 等
};
sandbox.window = sandbox;
sandbox.window.scrollTo = () => {};
sandbox.window.addEventListener = () => {};
sandbox.window.removeEventListener = () => {};
sandbox.navigator = { userAgent: 'node-test', language: 'zh-CN' };
vm.createContext(sandbox);

// 捕获错误
const errors = [];
const oldErr = console.error;
console.error = (...args) => { errors.push(['console.error', ...args].join(' ')); };

try {
  // 把测试循环注入到 code 末尾，让它在 vm 内部跑完后将结果写到 sandbox
  code += `
;(() => {
  globalThis.__renderResults = [];
  if (typeof PAGES !== 'undefined' && PAGES.length) {
    for (const p of PAGES.filter(x => x.role === 'admin')) {
      try {
        const h = p.render ? p.render() : '';
        globalThis.__renderResults.push({
          id: p.id, title: p.title, ok: true, len: (typeof h==='string')?h.length:0,
          shell: /admin-shell/.test(h), topbar: /admin-topbar/.test(h), sidebar: /admin-sidebar/.test(h),
        });
      } catch (e) {
        globalThis.__renderResults.push({ id: p.id, title: p.title, ok: false, err: e.message, stack: (e.stack||'').split('\\n').slice(0,3).join('\\n') });
      }
    }
  } else {
    globalThis.__renderResults = [{ id: '?', ok: false, err: 'PAGES array not found after eval' }];
  }
})();
`;
  vm.runInContext(code, sandbox, { timeout: 15000, displayErrors: true });
  console.error = oldErr;
  console.log('script eval OK');
  const results = sandbox.__renderResults || [];
  console.log('admin pages tested:', results.length);
  for (const r of results) {
    if (r.ok) {
      console.log(`  ${r.id} ${r.title}: ${r.len} bytes  shell=${r.shell} topbar=${r.topbar} sidebar=${r.sidebar}`);
    } else {
      console.log(`  ${r.id} ${r.title}: ❌ ${r.err}\n      ${(r.stack||'').split('\n')[0]}`);
    }
  }

  // ---------- 移动端横向导航条 专项测试 ----------
  console.log('\n=== 移动端后台导航（模拟 390px 视窗）===');
  const mob = vm.runInContext('adminShell(["P27"], "<p>BODY</p>", "套餐矩阵 · 日期")', sandbox);
  const checks = [
    ['横向导航条存在', /class="admin-mobile-nav"/.test(mob)],
    ['导航条含 11 个条目', (mob.match(/admin-mobile-nav-item/g) || []).length === 11],
    ['有 3 个分组分隔线', (mob.match(/admin-mobile-nav-sep/g) || []).length === 3],
    ['当前页高亮（P27 套餐矩阵）', /class="admin-mobile-nav-item active" data-nav="P27"/.test(mob)],
    ['含"订单中心"', mob.includes('订单中心')],
    ['含"办公楼管理"（业务组）', mob.includes('办公楼管理')],
    ['桌面侧栏保留（供大屏）', /class="admin-sidebar"/.test(mob)],
    ['不再有浮层抽屉', !/admin-drawer|admin-hamburger/.test(mob)],
    ['TopBar 仍在', /class="admin-topbar"/.test(mob)],
  ];
  let pass = 0;
  for (const [n, ok] of checks) { console.log(`  ${ok ? '✅' : '❌'} ${n}`); if (ok) pass++; }
  console.log(`  移动端后台导航: ${pass}/${checks.length}`);

  // 全量：每个 admin 页都要有横向导航条且高亮自己
  let navOk = 0, navBad = [];
  for (const r of results) {
    const h = vm.runInContext(`PAGES.find(p => p.id === '${r.id}').render()`, sandbox);
    const activeRe = new RegExp(`class="admin-mobile-nav-item active" data-nav="${r.id}"`);
    const sideRe = new RegExp(`class="admin-sidebar-item active" data-nav="${r.id}"`);
    if (/class="admin-mobile-nav"/.test(h) && activeRe.test(h) && sideRe.test(h)) navOk++;
    else navBad.push(r.id);
  }
  console.log(`  ${navOk === 11 ? '✅' : '❌'} 11 个后台页均含导航条并高亮自身：${navOk}/11 ${navBad.length ? '(缺:' + navBad.join(',') + ')' : ''}`);
} catch (e) {
  console.error = oldErr;
  console.log('script eval FAILED:', e.message);
  console.log(e.stack.split('\n').slice(0, 5).join('\n'));
}

console.error = oldErr;
if (errors.length) {
  console.log('\n--- captured console.error calls ---');
  errors.forEach(e => console.log(e));
}
