// 端点语义提取器 v2：给「代码有、规范未列」的端点回源取
// @ApiOperation.summary（权威说明）+ handler 名 + service 调用 + 入参 DTO。
// 只读，不落产物到仓库；结果打到 stdout。
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const REPO = 'C:/Users/herma/WorkBuddy/ABox小程序/abox-onebox';
const API_SRC = join(REPO, 'apps/api-server/src');
const PREFIX = '/api/v1';

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
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

const VERB_LINE = /@(Get|Post|Put|Patch|Delete)\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)?\s*\)/;
const CONTROLLER_LINE = /@Controller\(\s*(?:'([^']*)'|"([^"]*)"|\{[^}]*?path\s*:\s*['"]([^'"]*)['"])/;

function norm(p) {
  let s = p.replace(/\/{2,}/g, '/').replace(/\/$/, '');
  s = s.replace(/\{[^}]+\}/g, ':p').replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ':p');
  s = s.replace(/^\/api\/v\d+/, ''); // 与 audit-contract 的 norm 保持一致
  return s.toLowerCase();
}

const rows = [];
for (const file of walk(API_SRC)) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  let base = null;
  for (let i = 0; i < lines.length; i++) {
    const cm = lines[i].match(CONTROLLER_LINE);
    if (cm) base = cm[1] ?? cm[2] ?? cm[3] ?? '';
    const vm = lines[i].match(VERB_LINE);
    if (!vm || base === null) continue;
    const sub = vm[2] ?? vm[3] ?? vm[4] ?? '';
    const path = [PREFIX, base, sub].filter((x) => x !== undefined && x !== null).join('/');

    // 向下 40 行内取：summary / 方法签名 / service 调用 / 入参 DTO
    let summary = '';
    let handler = '';
    let svc = '';
    const dtos = new Set();
    const end = Math.min(i + 40, lines.length);
    let seenHandler = false;
    for (let j = i + 1; j < end; j++) {
      const t = lines[j];
      if (!summary) {
        const sm = t.match(/summary:\s*'([^']*)'/);
        if (sm) summary = sm[1].trim();
      }
      if (!seenHandler) {
        const hm = t.match(/^\s*(?:async\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
        if (hm) {
          handler = hm[1];
          seenHandler = true;
        }
      }
      const dm = t.match(/@(?:Body|Query|Param)\(?[^)]*\)?\s*([A-Za-z_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/g);
      if (dm) for (const d of dm) {
        const mm = d.match(/:\s*([A-Za-z_][A-Za-z0-9_]*)\s*$/);
        if (mm && /Dto$|Dto\b/.test(mm[1])) dtos.add(mm[1]);
      }
      for (const m of t.matchAll(/@(?:Body|Query|Param)\(\)\s*\w+:\s*(\w+Dto)/g)) dtos.add(m[1]);
      for (const m of t.matchAll(/@(?:Body|Query|Param)\([^)]*\)\s*\w+:\s*(\w+Dto)/g)) dtos.add(m[1]);
      if (!svc) {
        const rm = t.match(/return\s+this\.(\w+)\.(\w+)\(/);
        if (rm) svc = `${rm[1]}.${rm[2]}`;
      }
      if (seenHandler && svc) break;
    }
    rows.push({
      method: vm[1].toUpperCase(),
      path: norm(path),
      raw: path,
      handler,
      svc,
      summary,
      dtos: [...dtos].join(','),
      file: relative(REPO, file),
      line: i + 1,
    });
  }
}

const extra = new Set(
  JSON.parse(readFileSync('C:/Users/herma/WorkBuddy/ABox小程序/_tmp/kb/extra.json', 'utf8')).extra
);
const hit = rows.filter((r) => extra.has(`${r.method} ${r.path}`));
console.log('extra 命中 =', hit.length, '/ 清单 =', extra.size);
for (const r of hit.sort((a, b) => (a.path < b.path ? -1 : 1))) {
  console.log(
    `${r.method} ${r.raw} | ${r.summary || '（无 summary）'} | ${r.handler}() | ${r.svc} | ${r.dtos} | ${r.file}:${r.line}`
  );
}
const miss = [...extra].filter((k) => !hit.some((r) => `${r.method} ${r.path}` === k));
if (miss.length) console.log('\n⚠️ 未命中：\n  ' + miss.join('\n  '));
const noSummary = hit.filter((r) => !r.summary);
console.log('\n无 summary 的端点数 =', noSummary.length);
for (const r of noSummary) console.log('  ' + r.method + ' ' + r.raw + '  (' + r.file + ':' + r.line + ')');
