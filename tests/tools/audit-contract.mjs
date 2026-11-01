/**
 * 契约端点对账（可复用 · 自证）
 *
 * 左（代码侧）：直接静态解析 apps/api-server 的 @Controller / @Get|@Post|@Put|@Patch|@Delete
 *              装饰器，**不依赖任何临时产物**。
 * 右（规范侧）：《ABox一盒接口规范v1.0.md》中形如 `| 编号 | METHOD | /path |` 的契约端点行。
 *
 * 目的：找出「规范定义了、代码里没有」的缺口 —— 这类缺口
 *   ① 不会让任何门禁变红（eslint / tsc / e2e 全绿）；
 *   ② 却会让端上出现「有入口、点进去 404」的死功能；
 *   ③ 更会把外部测试人整批带进假 bug（照规范逐条验 → 全部失败 → 全部记为 bug）。
 *
 * ⚠️ 前车之鉴：旧版脚本读 `%TEMP%\abox-routes.txt`，该中间产物一失效整个工具就废，
 *    且工具本身不在工作区（换任务即丢）。本版把「取数」与「对账」合成一处，落在 tests/tools/。
 *
 * 用法：
 *   node tests/tools/audit-contract.mjs                   # 打印报告（未声明缺口 > 0 即非零退出）
 *   node tests/tools/audit-contract.mjs --report-only     # 只报告，不因缺口失败
 *   node tests/tools/audit-contract.mjs --json out.json   # 另存机器可读缺口清单
 *   ABOX_SPEC=<path> node ...                             # 换规范文件（供负向自证用）
 *
 * 退出码：0 = 自证通过且无未声明缺口（或 --report-only）；
 *         1 = 自证失败，或存在**未声明缺口**（规范有行、代码无路由、且行内没写明为什么）。
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const REPO = 'C:/Users/herma/WorkBuddy/ABox小程序/abox-onebox';
const API_SRC = join(REPO, 'apps/api-server/src');
const SPEC_FILE =
  process.env.ABOX_SPEC ?? 'C:/Users/herma/WorkBuddy/ABox小程序/ABox一盒接口规范v1.0.md';
const PREFIX = '/api/v1';

// ---------------------------------------------------------------- 代码侧

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    // ⚠️ pnpm 的 symlink 在 withFileTypes 下 isDirectory/isFile 均为 false → 必须显式兜底
    let isDir = e.isDirectory();
    let isFile = e.isFile();
    if (!isDir && !isFile && e.isSymbolicLink()) {
      try {
        const st = statSync(p);
        isDir = st.isDirectory();
        isFile = st.isFile();
      } catch {
        continue;
      }
    }
    if (isDir) walk(p, out);
    else if (isFile && e.name.endsWith('.controller.ts')) out.push(p);
  }
  return out;
}

function normalPath(base, sub) {
  const raw = [PREFIX, base, sub].filter((x) => x !== undefined && x !== null).join('/');
  const p = raw.replace(/\/{2,}/g, '/');
  return p.length > 1 ? p.replace(/\/$/, '') : p;
}

const ALL_VERBS = /@(Get|Post|Put|Patch|Delete|Options|Head)\s*\(/g;
const VERB_LINE = /@(Get|Post|Put|Patch|Delete)\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)?\s*\)/;
const CONTROLLER_LINE = /@Controller\(\s*(?:'([^']*)'|"([^"]*)"|\{[^}]*?path\s*:\s*['"]([^'"]*)['"])/;

const routes = [];
const parseMisses = [];

for (const file of walk(API_SRC)) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  let base = null;
  const hits = [];
  for (const line of lines) {
    const cm = line.match(CONTROLLER_LINE);
    if (cm) base = cm[1] ?? cm[2] ?? cm[3] ?? '';
    const vm = line.match(VERB_LINE);
    if (vm) {
      if (base === null) continue;
      const sub = vm[2] ?? vm[3] ?? vm[4] ?? '';
      const path = normalPath(base, sub);
      hits.push({ method: vm[1].toUpperCase(), path, file, raw: sub });
    }
  }
  // 自证：文件内动词装饰器出现次数必须与解析命中等数（多行写法会在此暴露）
  const declared = (src.match(ALL_VERBS) ?? []).length;
  if (declared !== hits.length) {
    parseMisses.push({ file, declared, parsed: hits.length });
  }
  routes.push(...hits);
}

// ---------------------------------------------------------------- 规范侧

function norm(p) {
  let s = p.trim().replace(/`/g, '').replace(/\*\*/g, '');
  // P2-10：路径也可能写成 **`\/x`**，必须与编号一处剥掉 `**`（否则恒绿或假红）
  s = s.split('?')[0];
  s = s.replace(/\/+$/, '');
  s = s.replace(/\{[^}]+\}/g, ':p').replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ':p');
  s = s.replace(/^\/api\/v\d+/, '');
  return s.toLowerCase();
}

const specLines = readFileSync(SPEC_FILE, 'utf8').split(/\r?\n/);
const spec = [];
let section = '';
for (let i = 0; i < specLines.length; i++) {
  const line = specLines[i];
  const h = line.match(/^#{2,4}\s+(.*)$/);
  if (h) section = h[1].trim();
  // 2026-09-25 P2-10：原正则不认加粗（`**U19**` / `**PUT**` / **`\/x`**）⇒
  //    加粗行被**静默跳过**，工具反而恒绿（当时 20 行在盲区却报「未声明缺口 0」）。
  // ⚠️ 编号 / 方法 / 路径**三处必须同时**兼容 `**`：只改编号不改路径，norm() 算出的
  //    路径仍带星号 ⇒ 与代码侧对不上 ⇒ 产出**假红**（实测凭空多报缺口）。
  //    路径里的 `**` 统一交给 norm() 剥离。
  // ⚠️ 编号前缀必须覆盖**规范里真实出现过**的全部前缀 —— 2026-11-01 取数：
  //    U 22 / A 7 / L 22 / S 15 / D 89 / W 5 / Q 1。旧正则只认 `[UADQSP]` ⇒
  //    L（团长端 22 行）与 W（回调与探针 5 行）**整段被当成"规范未列"**，
  //    凭空多报 27 条缺口（假红）。这是**补真源前缀**，不是放宽判据：
  //    判据随真源走，真源新增前缀时此处必须同步，否则缺口数会静默虚高。
  const m = line.match(/^\|\s*\**([UADQLSPW][0-9]+[a-z]?)\**\s*\|\s*\**(GET|POST|PUT|PATCH|DELETE)\**\s*\|\s*([^|]+)\|/);
  if (m) {
    spec.push({
      id: m[1],
      method: m[2],
      path: norm(m[3]),
      raw: m[3].trim(),
      section,
      lineNo: i + 1,
      text: line.trim(),
    });
  }
}

// ---------------------------------------------------------------- 对账

const codeKeys = new Set(routes.map((r) => `${r.method} ${norm(r.path)}`));
const specKeys = new Set(spec.map((s) => `${s.method} ${s.path}`));

/**
 * 豁免判据：规范行内**显式声明**了「本端点一期未实装 / 不另设端点 / 已迁出」。
 * 这类行不算缺口 —— 否则每次跑都看到同一批，人就会开始**忽略告警**（比漏报更坏）。
 * ⚠️ 是「显式声明」而非静默忽略：声明行**单独列出**，把声明删掉就立刻重新变红（豁免会自收紧）。
 */
const DECLARED = /一期未实装|本端点不设|本端点不实装|不另设端点|不设端点|已迁出|路由已删除/;
const allGap = spec.filter((s) => !codeKeys.has(`${s.method} ${s.path}`));
const missing = allGap.filter((s) => !DECLARED.test(s.text));
const declared = allGap.filter((s) => DECLARED.test(s.text));
const extra = [...codeKeys].filter((k) => !specKeys.has(k));

// 自证：豁免判据必须**能报也能不报** —— 恒真或恒假的判据等于没有判据
// （本项目实测教训：判据写松会假绿、写死会假红，两者都会把人训练成忽略告警）
const probe = [
  DECLARED.test('| U9 | GET | `/x` | 一期未实装（人为样本） |'),
  DECLARED.test('| U9 | GET | `/x` | 正常端点（人为样本） |'),
];
const probeOk = probe[0] === true && probe[1] === false;

// ---------------------------------------------------------------- 自证

const problems = [];
if (codeKeys.size === 0) problems.push('代码侧端点数为 0 —— 抽取器失效（PATH / 目录名变了？）');
if (spec.length === 0) problems.push('规范侧端点数为 0 —— 表格格式变了（判据正则失配）');
if (parseMisses.length > 0) {
  problems.push(`装饰器解析有遗漏 ${parseMisses.length} 个文件（多为多行写法，见下）`);
}
if (!probeOk) {
  problems.push(`豁免判据自证失败：样本应 true/false，实得 ${probe.join('/')}`);
}

console.log('=== 契约端点对账 ===');
console.log(`代码侧（静态抽取自 controller 装饰器）：${codeKeys.size} 个`);
console.log(`规范侧（接口规范端点表格）：${spec.length} 个`);
console.log(`匹配：${spec.length - allGap.length}`);
console.log(`\n【规范有、代码无】${allGap.length} 个 —— 其中已声明 ${declared.length} / 未声明缺口 ${missing.length}`);
if (declared.length > 0) {
  console.log(`\n  ── 已声明（不计入缺口 · 规范行内写明原因）${declared.length} 个 ──`);
  for (const d of declared) {
    console.log(`  · ${d.id}  ${d.method} ${d.raw}   （第 ${d.lineNo} 行 · ${d.section}）`);
  }
}
console.log(`\n  ── 未声明缺口（需定性：一期刻意延后 → 去规范里补声明 / 真漏做 → 排批次）${missing.length} 个 ──`);
for (const m of missing) {
  console.log(`  ✗ ${m.id}  ${m.method} ${m.raw}`);
  console.log(`      章节：${m.section}  （规范第 ${m.lineNo} 行）`);
}
console.log(`\n【代码有、规范未列】${extra.length} 个 —— 不一定是缺陷（规范可能以其他格式记载）`);
for (const k of extra.slice(0, 50)) console.log(`  + ${k}`);
if (extra.length > 50) console.log(`  …另有 ${extra.length - 50} 个`);

if (parseMisses.length > 0) {
  console.log('\n⚠️ 装饰器解析遗漏（需人工确认是否为多行写法）：');
  for (const p of parseMisses) console.log(`  ${p.file}  声明 ${p.declared} / 解析 ${p.parsed}`);
}

const jsonFlag = process.argv.indexOf('--json');
if (jsonFlag > -1 && process.argv[jsonFlag + 1]) {
  writeFileSync(
    process.argv[jsonFlag + 1],
    JSON.stringify(
      {
        codeCount: codeKeys.size,
        specCount: spec.length,
        missing,
        declared,
        extra,
        routes: [...codeKeys].sort(),
      },
      null,
      2
    ),
    'utf8'
  );
  console.log(`\n缺口清单已写出：${process.argv[jsonFlag + 1]}`);
}

if (problems.length > 0) {
  console.error('\n❌ 自证失败：');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('\n✅ 自证通过（两侧均非空 · 装饰器解析无遗漏 · 豁免判据能报也能不报）');

// 未声明缺口 = 真问题：规范里承诺了一个不存在的端点，且没有一行字解释为什么不。
// 这类缺口不会让任何门禁变红，正是「约束不落成代码 = 约束不存在」的形状 ⇒ 默认非零退出。
if (missing.length > 0 && !process.argv.includes('--report-only')) {
  console.error(`\n❌ 存在 ${missing.length} 个未声明缺口：`);
  for (const m of missing) console.error(`  ✗ ${m.id} ${m.method} ${m.raw}（规范第 ${m.lineNo} 行）`);
  console.error('  ⇒ 二选一：① 补实装；② 在该行写明「一期未实装 + 原因 + 何时补」（声明行才被认作已声明）');
  process.exit(1);
}
