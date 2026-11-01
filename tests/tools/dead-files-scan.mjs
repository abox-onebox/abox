/**
 * dead-files-scan.mjs —— 空壳文件（占位骨架）机械扫描
 *
 * 判据（三条同时成立才算，缺一条不算）：
 *   ① 剥掉注释与空白后，有效代码 ≤ 3 行
 *   ② 有效代码只由 `export {}` / `export {};` 这类**空导出**构成
 *   ③ **精确解析**的 import 引用数为 0
 *      （要 resolve 相对路径、补 `.ts`/`.vue`/`/index.ts` 扩展名 ——
 *        只做字符串包含会漏掉「同名不同目录」，只做 basename 会漏掉路径别名）
 *
 * ⚠️ 本扫描**只用于报告**，不自动删。原因：判据 ① 「有效代码 ≤3 行」**不足以区分**
 *    「纯脚手架空文件」与「带有意保留注释的契约载体占位」—— 项目里
 *    `finance/payout.service.ts` 就被基线冻结清单登记（带 SHA-256），是团队刻意保留的。
 *    故本脚本产出的是「候选 + 建议」，删改一律人工决定。
 *
 * 用法：node tests/tools/dead-files-scan.mjs [--json]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const SRC_DIRS = [
  'abox-onebox/apps/api-server/src',
  'abox-onebox/apps/admin-web/src',
  'abox-onebox/apps/miniprogram/src',
  'abox-onebox/packages/shared-types/src',
  'abox-onebox/packages/shared-utils/src',
];
const EXT = ['.ts', '.vue'];
const SKIP_DIR = new Set(['node_modules', 'dist', 'dist-h5', '.git']);

function walk(dir, out = []) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const n of names) {
    if (SKIP_DIR.has(n)) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXT.some((e) => n.endsWith(e))) out.push(p);
  }
  return out;
}

/** 剥掉块注释 / 行注释（行注释避开 `http://` 这种「冒号+双斜杠」） */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(^|[^:])\/\/[^\n]*/gm, '$1');
}

/** 有效代码行（去空行、去纯注释行） */
function effectiveLines(src) {
  return stripComments(src)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

const files = SRC_DIRS.flatMap((d) => walk(join(ROOT, d)));

// ── 建立「被 import 的文件」集合（精确 resolve）──────────────
const imported = new Set();
const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[^\n]*?from\s*['"]([^'"]+)['"]/g;
/** 动态 import('...') 与 require('...') 也算引用 */
const DYN_RE = /(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function candidatesFor(spec, fromFile) {
  const out = [];
  if (spec.startsWith('.')) {
    const base = resolve(dirname(fromFile), spec);
    out.push(base, base + '.ts', base + '.vue', base + '.tsx', join(base, 'index.ts'));
  }
  // 路径别名不在本脚本解析范围内（本项目禁 @abox/* 指源码，故相对路径已足够）
  return out;
}

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const re of [IMPORT_RE, DYN_RE]) {
    for (const m of src.matchAll(re)) {
      for (const c of candidatesFor(m[1], f)) imported.add(resolve(c));
    }
  }
}

// ── 找空壳 ────────────────────────────────────────────────
const EMPTY_EXPORT_ONLY = /^export\s*\{\s*\}\s*;?$/;
const skeletons = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const lines = effectiveLines(src);
  if (lines.length === 0 || lines.length > 3) continue;
  // ② 必须只由空导出构成（允许 `export default {}` 这类空壳写法）
  const onlyEmpty = lines.every(
    (l) => EMPTY_EXPORT_ONLY.test(l) || /^export\s+default\s*\{\s*\}\s*;?$/.test(l),
  );
  if (!onlyEmpty) continue;
  const refs = imported.has(resolve(f)) ? 1 : 0;
  skeletons.push({ file: relative(ROOT, f).replace(/\\/g, '/'), refs });
}

const dead = skeletons.filter((s) => s.refs === 0);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ total: files.length, skeletons, dead }, null, 2));
} else {
  console.log('空壳文件扫描（占位骨架 · export {} 且 0 引用）');
  console.log(`  扫描文件：${files.length}`);
  console.log(`  空壳候选：${skeletons.length} —— 其中 0 引用：${dead.length}\n`);
  for (const d of dead) console.log(`   · ${d.file}`);
  const alive = skeletons.filter((s) => s.refs > 0);
  if (alive.length) {
    console.log(`\n  （空壳但**有**引用，不能删：${alive.length}）`);
    for (const a of alive) console.log(`   · ${a.file}`);
  }
}
