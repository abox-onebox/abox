#!/usr/bin/env node
/**
 * ABox 一盒 · 基线冻结清单哈希复核器
 *
 * 用途：核对《ABox一盒开发基线冻结清单v1.0.md》里每一行的「字节数 + SHA-256 前 12 位」
 * 是否与磁盘上的真实文件一致，并检查覆盖性（根目录 / archive/ 有没有漏登记的文档）。
 *
 * ⚠️ 纪律：**任何**改动 root 文档、原型或关键源码之后，必须
 *   1) 重跑生成器： <python> tests/baseline_manifest.py
 *   2) 跑本脚本复核：<managed-node> tests/tools/verify-manifest.mjs
 *   否则清单哈希立刻失真，等于文档自己违背了自己的校验规则。
 *
 * 退出码 0 = 全表一致且无漏登记。
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { join, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..'); // …\ABox小程序
const MANIFEST = join(ROOT, 'ABox一盒开发基线冻结清单v1.0.md');

if (!fs.existsSync(MANIFEST)) {
  console.error('✘ 找不到清单：' + MANIFEST);
  process.exit(2);
}

const lines = fs.readFileSync(MANIFEST, 'utf8').replace(/\r\n/g, '\n').split('\n');
// | 序号 | `文件名` | 说明 | 字节 | `sha前12` |
const RE = /^\|\s*\d+\s*\|\s*`([^`]+)`\s*\|([^|]*)\|\s*([\d,]+)\s*\|\s*`([0-9a-f]{12})`\s*\|\s*$/;

let section = '';
const stats = {};
const bad = [];
const seen = new Set();

for (const l of lines) {
  const h = l.match(/^##\s+(一|二|三|四|五|六|七|八|九|十)、(.+)$/);
  if (h) {
    section = h[2].trim();
    continue;
  }
  const m = l.match(RE);
  if (!m) continue;
  const [, name, , bytesStr, sha] = m;
  // 工程骨架段的行是相对 abox-onebox/ 的路径；archive/ 前缀需还原为工作区根
  let p;
  if (name.startsWith('archive/')) p = join(ROOT, 'archive', name.slice(8));
  else if (/工程骨架/.test(section)) p = join(ROOT, 'abox-onebox', name);
  else p = join(ROOT, name);

  const k = section.split('（')[0];
  stats[k] = stats[k] || { n: 0, b: 0, ok: 0 };
  stats[k].n++;
  stats[k].b += Number(bytesStr.replace(/,/g, ''));
  seen.add(name);

  if (!fs.existsSync(p)) {
    bad.push('[' + k + '] 缺失 ' + name);
    continue;
  }
  const buf = fs.readFileSync(p);
  const real = crypto.createHash('sha256').update(buf).digest('hex');
  if (String(buf.length) !== bytesStr.replace(/,/g, '')) bad.push('[' + k + '] ' + name + ' 字节 ' + bytesStr + ' vs ' + buf.length);
  else if (!real.startsWith(sha)) bad.push('[' + k + '] ' + name + ' SHA ' + sha + ' vs ' + real.slice(0, 12));
  else stats[k].ok++;
}

console.log('=== 分章节校验 ===');
let T = 0, OK = 0;
for (const k of Object.keys(stats)) {
  T += stats[k].n;
  OK += stats[k].ok;
  console.log('  ' + k.padEnd(26) + stats[k].n + ' 行 / ' + (stats[k].b / 1024).toFixed(1) + ' KB  → 通过 ' + stats[k].ok);
}
console.log('');
console.log(bad.length ? '✘ 失败 ' + bad.length + ' 项:\n  ' + bad.join('\n  ') : '✔ 全表 ' + OK + '/' + T + ' 行字节 + SHA-256 一致');

console.log('');
console.log('=== 覆盖性 ===');
// 清单自身是自指文件，生成器刻意跳过（baseline_manifest.py: `name == basename(OUT)`），此处同口径
const SELF = MANIFEST.slice(MANIFEST.lastIndexOf(sep) + 1);
const rootDocs = fs.readdirSync(ROOT).filter((n) => /\.(md|html)$/.test(n) && !n.startsWith('_') && n !== SELF);
const arch = join(ROOT, 'archive');
const archDocs = fs.existsSync(arch) ? fs.readdirSync(arch).map((n) => 'archive/' + n) : [];
const missRoot = rootDocs.filter((n) => !seen.has(n));
const missArch = archDocs.filter((n) => !seen.has(n));
console.log('  根目录 ' + rootDocs.length + ' 份 → 未登记 ' + missRoot.length + '（' + (missRoot.join(', ') || '—') + '）');
console.log('  archive/ ' + archDocs.length + ' 份 → 未登记 ' + missArch.length + (missArch.length ? '：' + missArch.join(', ') : ' ✔'));

process.exit(bad.length || missRoot.length || missArch.length ? 1 : 0);
