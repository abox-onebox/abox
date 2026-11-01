// 把三处补登内容按锚点插入规范真源。带命中数断言：任一锚点找不到即非零退出。
import { readFileSync, writeFileSync } from 'fs';

const SPEC = 'C:/Users/herma/WorkBuddy/ABox小程序/ABox一盒接口规范v1.0.md';
const read = (n) => readFileSync(`C:/Users/herma/WorkBuddy/ABox小程序/_tmp/kb/_ins_${n}.txt`, 'utf8').replace(/\r?\n$/, '').split(/\n/);

const a = readFileSync(SPEC, 'utf8').split(/\r?\n/);
const W = read('w');
const D = read('d');
const U = read('u');

const find = (pred) => a.findIndex(pred);
const iW = find((l) => /^\| W5 \| GET \| `.health\/ready`/.test(l));
const iSeven = find((l) => l.startsWith('## 七、回调与探针'));
const iFour = find((l) => l.startsWith('## 四、团长端接口'));

const miss = [];
if (iW < 0) miss.push('W5 行');
if (iSeven < 0) miss.push('## 七 标题');
if (iFour < 0) miss.push('## 四 标题');
if (miss.length) {
  console.error('锚点未命中：' + miss.join(' / '));
  process.exit(1);
}
if (!W.some((l) => l.includes('| W6 |'))) { console.error('W 内容自检失败'); process.exit(1); }
if (!D.some((l) => l.includes('| D86 |')) || !D.some((l) => l.includes('| D128 |'))) { console.error('D 内容自检失败'); process.exit(1); }
if (!U.some((l) => l.includes('| U23 |')) || !U.some((l) => l.includes('| U28 |'))) { console.error('U 内容自检失败'); process.exit(1); }

// ⚠️ 索引从大到小插入，避免前一次插入把后一个锚点顶偏
a.splice(iW + 1, 0, ...W);
a.splice(iSeven, 0, ...D);
a.splice(iFour, 0, ...U);
writeFileSync(SPEC, a.join('\n'));

const s = a.join('\n');
const cnt = (k) => s.split(k).length - 1;
console.log('插入完成：W6/W7/W8 =', cnt('| W6 |'), cnt('| W7 |'), cnt('| W8 |'));
console.log('D86 =', cnt('| D86 |'), ' D128 =', cnt('| D128 |'), ' U23 =', cnt('| U23 |'), ' U28 =', cnt('| U28 |'));
console.log('新行数 =', a.length);
