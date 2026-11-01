# -*- coding: utf-8 -*-
"""构建单文件知识检索页。

读 out/corpus.json → 产出 _ABox一盒知识检索v1.0.html

设计要点（都是实测倒逼的，不是偏好）：
  · 全离线自包含 —— 语料 gzip 后内嵌为 base64，运行时用 DecompressionStream 解压
  · 不做倒排索引 —— 6100 段 × 每段一次 indexOf，实测远低于 100ms，省掉整个索引层
  · 排序依据必须摊开 —— 每条结果展示「命中了哪些词 / 各值多少分」，可核对
"""
import io
import os
import gzip
import json
import base64
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
ROOT = r'C:\Users\herma\WorkBuddy\ABox小程序'
TARGET = os.path.join(ROOT, '_ABox一盒知识检索v1.0.html')

CSS = r"""
:root{
  --bg:#F6F0E5; --card:#FFFDF8; --brand:#6E5435; --brand-soft:#EDE3D2;
  --ink:#2E2A24; --ink2:#796C57; --line:#E4D9C6; --mark:#F3E2B8; --warn:#A33;
  --serif:"KaiTi","楷体",STKaiti,"Songti SC",serif;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font:15px/1.7 var(--sans)}
header{position:sticky;top:0;z-index:9;background:var(--bg);border-bottom:1px solid var(--line);
  padding:18px 0 12px}
.wrap{max-width:920px;margin:0 auto;padding:0 22px}
.brand{font:400 25px/1.3 var(--serif);color:var(--brand);letter-spacing:.06em}
.meta{font-size:12.5px;color:var(--ink2);margin-top:3px}
.bar{display:flex;gap:12px;align-items:center;margin-top:12px;flex-wrap:wrap}
#q{flex:1;min-width:240px;padding:10px 14px;font:15px var(--sans);color:var(--ink);
  background:var(--card);border:1px solid var(--line);border-radius:9px;outline:none}
#q:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(110,84,53,.10)}
.bar label{font-size:13px;color:var(--ink2);display:flex;align-items:center;gap:5px;
  cursor:pointer;white-space:nowrap}
main{padding:20px 0 90px}
.hint{font-size:13.5px;color:var(--ink2);line-height:1.9}
.hint b{color:var(--brand);font-weight:400}
.tip{margin:14px 0 22px;padding:11px 14px;background:var(--brand-soft);
  border-left:2px solid var(--brand);border-radius:0 7px 7px 0;font-size:13px;color:var(--ink2)}
.r{background:var(--card);border:1px solid var(--line);border-radius:11px;
  padding:13px 16px 14px;margin-bottom:11px}
.r .hd{display:flex;gap:9px;align-items:baseline;flex-wrap:wrap}
.r .doc{font-size:13.5px;color:var(--brand);font-weight:400}
.tag{font-size:11.5px;padding:1px 7px;border-radius:20px;background:var(--brand-soft);
  color:var(--brand);white-space:nowrap}
.tag.b{background:#EDEAE0;color:#6C6858}
.r .sco{margin-left:auto;font:11.5px var(--sans);color:var(--ink2)}
.r .sec{font:400 15.5px/1.5 var(--serif);margin:5px 0 7px}
.r .snip{font-size:14px;color:var(--ink)}
.r .snip mark{background:var(--mark);color:var(--ink);padding:0 1px;border-radius:2px}
.r .why{margin-top:9px;font-size:12px;color:var(--ink2);display:flex;gap:8px;flex-wrap:wrap}
.r .why i{font-style:normal;background:#F1EDE3;border-radius:5px;padding:1px 7px}
.r .full{display:none;margin-top:11px;padding-top:11px;border-top:1px dashed var(--line);
  font-size:13px;color:var(--ink2);white-space:pre-wrap;word-break:break-word;
  max-height:420px;overflow:auto}
.r.open .full{display:block}
.r .more{margin-top:8px;font-size:12.5px;color:var(--brand);cursor:pointer;user-select:none}
.toc{columns:2;column-gap:26px;font-size:13.5px}
.toc a{display:block;color:var(--ink);text-decoration:none;padding:3px 0;
  break-inside:avoid;border-bottom:1px solid #F0EAE0}
.toc a:hover{color:var(--brand)}
.toc .g{color:var(--ink2);font-size:11.5px;margin-left:6px}
.sechead{font:400 17px/1.4 var(--serif);color:var(--brand);margin:22px 0 10px}
.empty{color:var(--ink2);font-size:14px;padding:26px 0}
@media (max-width:640px){.toc{columns:1}.brand{font-size:21px}}
"""

JS = r"""
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// 片段渲染前先洗掉 Markdown 标记 —— 原始段落是文档正文，直接显示会满屏 ### 和 **。
// keep=true 保留换行（整段回看用），false 压成一行（列表片段用）。
const tidy = (s, keep) => {
  let t = String(s)
    .replace(/^\s{0,3}#{1,6}[ \t]+/gm, '')
    .replace(/^\s*[-*=_]{3,}\s*$/gm, '')
    .replace(/^\s*\|?[\s:|-]{5,}\|?\s*$/gm, '')
    .replace(/\*\*|`|\*/g, '')
    .replace(/^\s*\|\s*/gm, '')
    .replace(/\s*\|\s*$/gm, '')
    .replace(/[ \t]+/g, ' ');
  return keep ? t.replace(/\n{3,}/g, '\n\n').trim()
              : t.replace(/\s*\n\s*/g, ' ').trim();
};

let DOCS = [], SEGS = [], ready = false;
const G = {A:true, B:true};

async function boot(){
  const b64 = document.getElementById('corpus').textContent.replace(/\s+/g, '');
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const txt = await new Response(
    new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))
  ).text();
  const data = JSON.parse(txt);
  DOCS = data.docs;
  for (const d of DOCS){
    d._n = d.name.toLowerCase();
    d.auth = authority(d.name);
    for (const s of d.sections){
      SEGS.push({d, t:s.text, _t:s.text.toLowerCase(),
                 ti:s.title||d.name, _ti:(s.title||d.name).toLowerCase(),
                 line:s.line, len:s.text.length});
    }
  }
  ready = true;
  document.getElementById('meta').textContent =
    DOCS.length + ' 份文档 · ' + SEGS.length.toLocaleString() + ' 段 · 全离线自包含 · 无需联网';
  showToc();
}

// 文档权威度：契约/口径类是一手真源，页面稿/实录/报告是二手材料。
// 实测依据：问「楼群」时《ER 设计》3.1（楼群表 DDL）被《后台全量页面稿》的
// 「楼群管理」页顶掉 —— 后者只说明「有这么一个页面」，前者才是「这张表长什么样」。
const AUTH_HI = /接口规范|ER\s?设计|数据库ER|状态机|结算口径|PRD|业务运作理解|表结构评审|基线冻结|数据结构/;
const AUTH_LO = /页面稿|实录|实跑结果|全量页面|体检报告|看板|提案/;
function authority(name){
  if (AUTH_HI.test(name)) return 1.28;
  if (AUTH_LO.test(name)) return 0.90;
  return 1.0;
}

function tokenize(q){
  const out = [], seen = new Set();
  const push = (t, w) => { if(!seen.has(t)){ seen.add(t); out.push({t, w}); } };
  for (const w of (q.toLowerCase().match(/[a-z0-9_.]{2,}/g) || [])) push(w, w.length >= 4 ? 3 : 2);
  for (const run of (q.match(/[\u4e00-\u9fa5]+/g) || [])){
    if (run.length === 1){ push(run, 1); continue; }
    for (let n = 3; n >= 2; n--)
      for (let i = 0; i + n <= run.length; i++) push(run.slice(i, i + n), n === 2 ? 2 : 3);
  }
  return out;
}

function countIn(hay, needle, cap){
  let i = 0, c = 0;
  while ((i = hay.indexOf(needle, i)) >= 0){ c++; i += needle.length; if (c >= cap) break; }
  return c;
}

function score(seg, toks, full){
  let sc = 0, hitN = 0; const why = [];
  for (const tk of toks){
    const c = countIn(seg._t, tk.t, 14);
    if (c > 0){ hitN++; const v = tk.w * (1 + Math.log(c)); sc += v; why.push([tk.t, v]); }
    if (seg._ti.includes(tk.t)) sc += tk.w * 4;
    if (seg.d._n.includes(tk.t)) sc += tk.w * 2;
  }
  if (sc === 0) return null;
  if (full.length >= 2 && seg._t.includes(full)){ sc += 26; why.push([full + '（整串）', 26]); }
  sc *= seg.d.auth;
  if (seg.d.grade === 'A') sc *= 1.12;
  const nrm = 1 + Math.log10(Math.max(1, seg.len / 400));
  const final = sc / nrm;
  // 两道降噪闸门（先取数再定的阈值，不是拍的）：
  //   ① 得分门槛 —— 负控「紫水晶蝴蝶面包机」13 个词元只蹭到「面包」，得分 2.2；
  //      而正例 top 普遍 13~224。门槛取 4.0 一刀两断。
  //   ② 长查询只靠一个短词元 —— 同一条负控的另一种情形（语料里若没有该长串，
  //      单靠一个 2 字词元不该出结果）。
  //   ⚠️ 曾用「段落命中词元占比 ≥34%」当闸门，实测把「菜品中心日报表」整批误杀
  //      （1202 段全挡）—— 语料里没有这个完整说法，每段只能命中「中心」「菜品」
  //      一两个词元，占比天然高不了。占比不是判据，得分数值才是。
  const weak = final < 4.0 || (toks.length >= 7 && hitN <= 1);
  return {score: final, why: why.sort((a, b) => b[1] - a[1]), cover: hitN / toks.length, weak: weak};
}

function snippet(seg, toks){
  let t = tidy(seg.t);
  // 段落开头常就是它的章节标题（切分时标题被并入正文）—— 上面已经单独显示了，这里去掉重复
  const ti = tidy(seg.ti);
  if (ti.length > 6 && t.startsWith(ti)) t = t.slice(ti.length).trim();
  if (t.length <= 300) return t;
  const full = toks.map(x => x.t);
  let best = 0, bestS = -1;
  for (let i = 0; i < t.length - 60; i += 30){
    const w = t.slice(i, i + 300);
    let s = 0;
    for (const tk of full) if (w.includes(tk)) s += tk.length;
    if (s > bestS){ bestS = s; best = i; }
  }
  return (best > 0 ? '…' : '') + t.slice(best, best + 300) +
         (best + 300 < t.length ? '…' : '');
}

function highlight(s, toks){
  const pat = toks.map(x => x.t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                  .sort((a, b) => b.length - a.length);
  if (!pat.length) return esc(s);
  const re = new RegExp('(' + pat.join('|') + ')', 'g');
  return esc(s).replace(re, '<mark>$1</mark>');
}

function search(raw){
  const out = document.getElementById('out');
  const q = raw.trim();
  if (!ready) return;
  if (!q){ showToc(); return; }
  const t0 = performance.now();
  const toks = tokenize(q);
  const full = q.toLowerCase();
  const hits = []; let weak = 0;
  for (const seg of SEGS){
    if (!G[seg.d.grade]) continue;
    const r = score(seg, toks, full);
    if (!r) continue;
    if (r.weak){ weak++; continue; }          // 匹配度过低：不计入结果，但要报出数量
    hits.push({seg: seg, score: r.score, why: r.why});
  }
  hits.sort((a, b) => b.score - a.score);
  const ms = Math.round(performance.now() - t0);
  const top = hits.slice(0, 40);

  if (!top.length){
    out.innerHTML = '<div class="empty">没找到。'
      + (weak ? '有 ' + weak.toLocaleString() + ' 段只蹭到查询里的零碎字词（匹配度太低，已隐藏）。' : '')
      + '<br>检索按关键词与连续片段匹配，不做同义词扩展 —— 换成文档里更可能出现的说法再试，'
      + '或关掉上面某个分级开关。'
      + '<br>本次词元：' + toks.slice(0, 8).map(x => esc(x.t)).join(' · ')
      + (toks.length > 8 ? ' …共 ' + toks.length + ' 个' : '') + '</div>';
    return;
  }
  const h = ['<div class="hint">命中 <b>' + hits.length.toLocaleString() + '</b> 段，'
    + '显示前 ' + top.length + ' 条 · 用时 ' + ms + ' 毫秒'
    + '（词元：' + toks.map(x => esc(x.t)).join(' · ') + '）</div>'];
  for (const it of top){
    const d = it.seg.d;
    const why = it.why.slice(0, 7)
      .map(([w, v]) => '<i>' + esc(w) + ' ' + v.toFixed(1) + '</i>').join('');
    h.push('<div class="r">'
      + '<div class="hd"><span class="doc">' + esc(d.name) + '</span>'
      + '<span class="tag' + (d.grade === 'B' ? ' b' : '') + '">' + d.grade + '</span>'
      + '<span class="sco">得分 ' + it.score.toFixed(1) + '</span></div>'
      + '<div class="sec">' + esc(tidy(it.seg.ti)) + '</div>'
      + '<div class="snip">' + highlight(snippet(it.seg, toks), toks) + '</div>'
      + '<div class="why">命中：' + why + '</div>'
      + '<div class="more" onclick="this.parentNode.classList.toggle(\'open\')">展开整段 ▾</div>'
      + '<div class="full">' + esc(tidy(it.seg.t, true)) + '</div>'
      + '</div>');
  }
  out.innerHTML = h.join('');
}

function showToc(){
  const out = document.getElementById('out');
  const byG = {A: [], B: []};
  for (const d of DOCS) byG[d.grade] && byG[d.grade].push(d);
  for (const k in byG) byG[k].sort((a, b) => b.chars - a.chars);
  const blocks = [];
  const mk = (title, arr) => {
    blocks.push('<div class="sechead">' + title + '（' + arr.length + '）</div>'
      + '<div class="toc">' + arr.map(d =>
        '<a href="#" onclick="document.getElementById(\'q\').value=' + JSON.stringify(d.name)
        + ';search(' + JSON.stringify(d.name) + ');return false">'
        + esc(d.name) + '<span class="g">' + d.sections.length + ' 段</span></a>').join('')
      + '</div>');
  };
  blocks.unshift('<div class="tip">还没输入。下面是全部语料目录 —— 点任意一份可直接搜它。'
    + '<br>输入框支持整句话：「佣金费率有几档」「状态机怎么流转」「留样要求」——'
    + '检索会按关键词与连续片段命中，并把命中依据摊在每条结果下面。</div>');
  mk('正文级 · 契约与判据', byG.A);
  if (byG.B.length) mk('实录 · 抄屏与落点', byG.B);
  out.innerHTML = blocks.join('');
}

document.getElementById('q').addEventListener('input', (() => {
  let h = 0;
  return e => {
    clearTimeout(h);
    const v = e.target.value;
    h = setTimeout(() => search(v), 190);
  };
})());
for (const g of ['A', 'B'])
  document.getElementById('g' + g).addEventListener('change', e => {
    G[g] = e.target.checked;
    search(document.getElementById('q').value);
  });
boot();
"""


def main():
    t0 = time.time()
    corpus = json.load(io.open(os.path.join(OUT, 'corpus.json'), encoding='utf-8'))
    docs = []
    for d in corpus['docs']:
        docs.append({'name': d['name'], 'grade': d['grade'], 'chars': d['chars'],
                     'sections': [{'title': s['title'], 'line': s['line'], 'text': s['text']}
                                  for s in d['sections']]})
    payload = json.dumps({'docs': docs}, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    gz = gzip.compress(payload, 9)
    b64 = base64.b64encode(gz).decode('ascii')
    b64_wrapped = '\n'.join(b64[i:i + 200] for i in range(0, len(b64), 200))

    nseg = sum(len(d['sections']) for d in docs)
    nchar = sum(d['chars'] for d in docs)
    title = 'ABox 一盒 · 知识检索 v1.0'
    html = (
        '<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
        '<title>' + title + '</title>\n<style>' + CSS + '</style>\n</head>\n<body>\n'
        '<header><div class="wrap">'
        '<div class="brand">ABox 一盒 · 知识检索</div>'
        '<div class="meta" id="meta">正在载入语料…</div>'
        '<div class="bar">'
        '<input id="q" type="search" autocomplete="off" '
        'placeholder="搜关键词，或直接问一句话 —— 比如「佣金费率有几档」「状态机怎么流转」">'
        '<label><input type="checkbox" id="gA" checked> 正文级</label>'
        '<label><input type="checkbox" id="gB" checked> 实录</label>'
        '</div></div></header>\n<main><div class="wrap"><div id="out"></div></div></main>\n'
        '<script id="corpus" type="application/gzip+base64">\n' + b64_wrapped + '\n</script>\n'
        '<script>' + JS + '</script>\n</body>\n</html>\n'
    )
    io.open(TARGET, 'w', encoding='utf-8', newline='\n').write(html)
    size = os.path.getsize(TARGET)
    print(f'✔ {os.path.basename(TARGET)}')
    print(f'  文档 {len(docs)} 份 · 段落 {nseg:,} · 语料 {nchar:,} 字符')
    print(f'  载荷 {len(payload):,} 字节 → gzip {len(gz):,} → base64 {len(b64):,}')
    print(f'  产物 {size:,} 字节（{size / 1048576:.2f} MB）· 耗时 {time.time() - t0:.1f}s')
    return 0


if __name__ == '__main__':
    sys.exit(main())
