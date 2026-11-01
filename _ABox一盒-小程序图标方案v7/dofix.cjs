/* 一次性原子替换：修字位偏移、08「一」拉长、09 小字加强 */
const fs = require('fs');
const f = __dirname + '/build.cjs';
let s = fs.readFileSync(f, 'utf8');

const R = [
  // 01 白居易·盒（466）下移
  ['font-size:466px;line-height:1;color:${CREAM};transform:translateY(-12px)',
   'font-size:466px;line-height:1;color:${CREAM};transform:translateY(28px)'],
  // 02 朱文印·盒（416）
  ['font-size:416px;line-height:1;transform:translateY(-10px)',
   'font-size:416px;line-height:1;transform:translateY(25px)'],
  // 03 圆印·盒（376）
  ['font-size:376px;line-height:1;transform:translateY(-8px)',
   'font-size:376px;line-height:1;transform:translateY(23px)'],
  // 04 竖排·一盒（312）
  ['writing-mode:vertical-rl;font-size:312px;line-height:1.08;letter-spacing:.02em',
   'writing-mode:vertical-rl;font-size:312px;line-height:1.08;letter-spacing:.02em;transform:translateY(10px)'],
  // 05 横排·一盒 收紧字距
  ['<div style="font-size:292px;line-height:1;letter-spacing:.05em">一盒</div>',
   '<div style="font-size:292px;line-height:1;letter-spacing:0">一盒</div>'],
  // 06 白文竖排·一盒（300）
  ['writing-mode:vertical-rl;font-size:300px;line-height:1.1;color:${CREAM};letter-spacing:.02em',
   'writing-mode:vertical-rl;font-size:300px;line-height:1.1;color:${CREAM};letter-spacing:.02em;transform:translateY(10px)'],
  // 07 双框·合（366）
  ['font-size:366px;line-height:1;transform:translateY(-8px)',
   'font-size:366px;line-height:1;transform:translateY(18px)'],
  // 08 白文印·一：拉长成贯穿印面的长横（篆刻里的「一」）
  ['<span style="font-size:560px;line-height:1;color:${CREAM};transform:translateY(-6px);text-shadow:0 2px 0 rgba(0,0,0,.10)">一</span>',
   '<span style="font-size:430px;line-height:1;color:${CREAM};transform:translateY(40px) scaleX(1.5);text-shadow:0 2px 0 rgba(0,0,0,.10)">一</span>'],
  // 09 竖排·周一（306）
  ['writing-mode:vertical-rl;font-size:306px;line-height:1.07;letter-spacing:.02em',
   'writing-mode:vertical-rl;font-size:306px;line-height:1.07;letter-spacing:.02em;transform:translateY(10px)'],
  // 09 小字加强
  ['writing-mode:vertical-rl;font-size:31px;letter-spacing:.4em;opacity:.68',
   'writing-mode:vertical-rl;font-size:35px;letter-spacing:.34em;opacity:.85'],
  // 10 大字·盒（566）
  ['font-size:566px;line-height:1;transform:translateY(-16px)',
   'font-size:566px;line-height:1;transform:translateY(34px)']
];

let ok = true;
for (const [a, b] of R) {
  const n = s.split(a).length - 1;
  if (n !== 1) {
    console.error('HIT MISMATCH 命中=' + n + ' 期望=1 :: ' + JSON.stringify(a.slice(0, 68)));
    ok = false;
    continue;
  }
  s = s.replace(a, b);
}
if (!ok) { console.error('ABORT: 有替换未命中，未写盘'); process.exit(1); }
fs.writeFileSync(f, s, 'utf8');
console.log('OK 全部 ' + R.length + ' 处已替换');
