#!/usr/bin/env node
/**
 * ABox 原型 · JS 语法校验器
 * 用法: node tests/js-syntax-check.js prototype/index.html
 * 作用: 抽取全部 <script> 块，用 vm.Script 编译，提前暴露语法错误（比看控制台更早）。
 */
const fs = require('fs');
const vm = require('vm');

const file = process.argv[2] || 'prototype/index.html';
const src = fs.readFileSync(file, 'utf8');
const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let m, blocks = 0, chars = 0;
try {
  while ((m = re.exec(src))) {
    blocks++;
    chars += m[1].length;
    new vm.Script(m[1], { filename: 'block#' + blocks });
  }
} catch (e) {
  console.error('JS 语法错误:', e.message);
  process.exit(1);
}
console.log('script blocks: ' + blocks + '  chars: ' + chars + '  => JS syntax OK');
