// 只替换 index.html 里的 corpus / audit 两个内嵌数据块，**骨架一字不动**。
// 原因：build2.py 里没有 10-19 那批改动（待审队列 / op-appr / submitRequest / lockHtml），
// 直接重生成会整批冲掉 ⇒ 必须精准注入。
import { readFileSync, writeFileSync } from 'fs';
import { gzipSync, gunzipSync } from 'zlib';

const P = 'C:/Users/herma/WorkBuddy/ABox小程序/_app/abox-kb/index.html';
const OUT = 'C:/Users/herma/WorkBuddy/ABox小程序/_ABox一盒知识助手v4.0.html';
let s = readFileSync(P, 'utf8');

const corpus = JSON.parse(readFileSync('C:/Users/herma/WorkBuddy/ABox小程序/_tmp/kb/out/corpus.json', 'utf8'));
const docs = corpus.docs.map((d) => ({
  name: d.name,
  grade: d.grade,
  chars: d.chars,
  sections: d.sections.map((x) => ({ title: x.title, line: x.line, text: x.text })),
}));
const wrap = (buf) => buf.toString('base64').match(/.{1,200}/g).join('\n');

const inject = (html, id, payload) => {
  const re = new RegExp(`(<script id="${id}" type="application/gzip\\+base64">)([\\s\\S]*?)(</script>)`);
  const m = html.match(re);
  if (!m) throw new Error(`块未找到：${id}`);
  return { html: html.replace(re, (a, b, c, d) => b + '\n' + payload + '\n' + d), oldLen: m[2].length };
};

const c = inject(s, 'corpus', wrap(gzipSync(Buffer.from(JSON.stringify({ docs }), 'utf8'), { level: 9 })));
const a = inject(c.html, 'audit', wrap(gzipSync(readFileSync('C:/Users/herma/WorkBuddy/ABox小程序/_tmp/kb/out/audit.json'), { level: 9 })));
s = a.html;
writeFileSync(P, s);
writeFileSync(OUT, s);

// 回解校验
const back = (id) => {
  const m = s.match(new RegExp(`<script id="${id}" type="application/gzip\\+base64">([\\s\\S]*?)</script>`));
  return JSON.parse(gunzipSync(Buffer.from(m[1].replace(/\s+/g, ''), 'base64')).toString('utf8'));
};
const d = back('corpus');
const au = back('audit');
console.log('corpus 块：', c.oldLen, '->', '已换');
console.log('audit  块：', a.oldLen, '->', '已换');
console.log('回解 docs =', d.docs.length, '· chars =', d.docs.reduce((x, y) => x + y.chars, 0));
console.log('体检时点 =', au.meta && au.meta.builtAt);
console.log('两处产物一致 =', readFileSync(P).equals(readFileSync(OUT)), '· 字节 =', Buffer.byteLength(s));

// 关键词命中复核（新补登端点 + 10-19 改动未丢失）
for (const k of ['D86', 'D128', 'U23', 'U28', 'W6', '/admin/uploads', 'filter-options', 'scope-preview', '待审队列', 'op-appr', 'submitRequest', 'lockHtml']) {
  let n = 0;
  for (const doc of d.docs) for (const sec of doc.sections) n += sec.text.split(k).length - 1;
  const inHtml = s.split(k).length - 1;
  console.log((k + '                ').slice(0, 18), '语料', n, '· 骨架', inHtml);
}
