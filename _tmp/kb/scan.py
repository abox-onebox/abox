# -*- coding: utf-8 -*-
"""语料扫描与分级 —— 把工作区文档变成「可检索的章节数组」。

产出（_tmp/kb/out/）：
  corpus.json   结构化语料：文档 → 章节 → 段落
  scan-report.md  扫描报告（分级依据、体量、被剔理由）

分级：
  A 正文级 —— md 全文 / 有信息的 html；进主检索
  B 附录级 —— 真人操作实录（截图为主，文本是抄屏）；进副检索
  C 剔除   —— 备份文件、抽文本后过短的空壳
"""
import io
import os
import re
import json
import html
import sys

ROOT = r'C:\Users\herma\WorkBuddy\ABox小程序'
OUTDIR = os.path.join(ROOT, '_tmp', 'kb', 'out')
NL = '\n'

# 段落硬上限：超过就二次切（《接口规范》有 16656 字符的单行）
SEG_MAX = 1600


def read(p):
    return io.open(p, encoding='utf-8', errors='replace').read().replace('\r\n', '\n')


def html2text(s):
    """HTML → 纯文本。目标不是完美还原，而是「检索时能命中、阅读时不刺眼」。"""
    s = re.sub(r'<script\b.*?</script>', ' ', s, flags=re.S | re.I)
    s = re.sub(r'<style\b.*?</style>', ' ', s, flags=re.S | re.I)
    s = re.sub(r'<!--.*?-->', ' ', s, flags=re.S)
    # 内嵌图（base64 data URI）——体量黑洞，直接扔
    s = re.sub(r'data:image/[a-z+]+;base64,[A-Za-z0-9+/=\s]{64,}', ' ', s, flags=re.I)
    s = re.sub(r'\bsrc\s*=\s*"[^"]{200,}"', ' ', s, flags=re.I)
    # ⭐ h1-h4 → Markdown 标题：否则 HTML 文档切不出章节，溯源只能到「某份文档」
    s = re.sub(r'<h([1-4])\b[^>]*>(.*?)</h\1\s*>',
               lambda m: NL + '#' * int(m.group(1)) + ' ' +
                         re.sub(r'<[^>]+>', '', m.group(2)).strip() + NL,
               s, flags=re.S | re.I)
    # 表格单元格 → 竖线分隔，保住「表」的可读性
    s = re.sub(r'</t[dh]\s*>', ' | ', s, flags=re.I)
    s = re.sub(r'<t[dh]\b[^>]*>', ' ', s, flags=re.I)
    # 块级元素 → 换行
    s = re.sub(r'<(br|hr)\s*/?>', NL, s, flags=re.I)
    s = re.sub(r'</?(p|div|tr|li|h[1-6]|table|thead|tbody|tfoot|section|article|'
               r'header|footer|main|nav|ul|ol|dl|dt|dd|pre|blockquote|figure|'
               r'figcaption|caption|details|summary)\b[^>]*>', NL, s, flags=re.I)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s)
    s = s.replace('\u00a0', ' ').replace('\u3000', '　')
    s = re.sub(r'[ \t]+', ' ', s)
    # 收拾竖线残留
    s = re.sub(r'(?:\s*\|\s*){2,}', ' | ', s)
    s = re.sub(r'^[ \t]*\|[ \t]*$', '', s, flags=re.M)
    s = re.sub(r'\n[ \t]+', NL, s)
    s = re.sub(r'\n{3,}', NL + NL, s)
    return s.strip()


CONTENT_BLOCK = re.compile(r'<(body|main|article)\b[^>]*>(.*?)</\1>', re.S | re.I)


def strip_html(p):
    """HTML 文档：优先只取正文块，避掉导航/侧栏的重复噪音。"""
    s = read(p)
    m = CONTENT_BLOCK.search(s)
    if m and len(m.group(2)) > 600:
        s = m.group(2)
    return html2text(s)


def grade_of(name, chars):
    if '.bak' in name or '.cand' in name:
        return 'C', '备份/候选文件'
    # 助手自身：内嵌语料是同一批文档的副本 + 一个 1.7MB 的 base64 内嵌块，
    # 入册即自指（而且会带进一大堆 base64 噪声段落）—— 它不含任何独立知识，必须剔除。
    # ⚠️ 名字换一次就要跟着改一次：产物从「知识检索 v1.0」→「知识问答 v2.0」→「知识助手 v3/v4.0」，
    #    而这条判据只认前两个 ⇒ 三期改名后**排除就失效了**（只是当时没重跑扫描，才没暴露）。
    #    现在改成**前缀族匹配**，并配一条自证（见 audit.py selftest 之外的 scan 自检约定）。
    if name.startswith('_ABox一盒知识') or name.startswith('_ABox一盒内部助手') \
            or '知识检索' in name or '知识问答' in name or '知识助手' in name:
        return 'C', '助手自身产物（自指，剔除）'
    if '真人操作实录' in name:
        return 'B', '实录：截图为主，文本为抄屏'
    # 「操作卡」是一页纸的步骤清单，抽文本天然短，但内容是真判据 —— 不能按长度剔
    if '操作卡' in name or '出餐卡' in name:
        return 'A', '单页操作卡：短但内容是判据'
    if chars < 800:
        return 'C', '抽文本后不足 800 字符（空壳/导航页）'
    if name.endswith('.html'):
        return 'A', 'HTML 方案稿，抽文本后正文完整'
    return 'A', 'Markdown 正文'


def coalesce(segs, min_len=60, target=160):
    """把过短的段落（标题行、表格行）吸收进相邻正文。

    动机：实测 49.5% 的段落不足 20 字符，却只占 4.1% 的字符 —— 纯噪音。
    吸收后标题关键词仍能被命中（它在合并段的开头），但不再单独出结果。
    """
    out, buf = [], []

    def flush():
        if not buf:
            return
        head = buf[0]
        out.append({**head,
                    'line': head['line'],
                    'text': NL.join(x['text'] for x in buf)})
        buf.clear()

    for s in segs:
        buf.append(s)
        if len(s['text']) >= min_len or sum(len(x['text']) for x in buf) >= target:
            flush()
    flush()
    return out


HEAD = re.compile(r'^(#{1,6})[ \t]*(.+?)[ \t]*#*[ \t]*$')


def split_sections(text, doc_name):
    """切成 [{title, level, line, text}]：标题为锚，段落为最小检索单元。

    不区分 md / html —— html 抽取时已把 h1-h4 还原成 Markdown 标题（见 html2text）。
    """
    lines = text.split(NL)
    secs = []
    cur = {'title': doc_name, 'level': 0, 'line': 1, 'buf': []}
    for i, ln in enumerate(lines, 1):
        m = HEAD.match(ln)
        if m and len(m.group(1)) <= 4:
            if cur['buf'] and any(x.strip() for x in cur['buf']):
                secs.append(cur)
            cur = {'title': re.sub(r'[`*_]', '', m.group(2)).strip(),
                   'level': len(m.group(1)), 'line': i, 'buf': [ln]}
        else:
            cur['buf'].append(ln)
    if cur['buf'] and any(x.strip() for x in cur['buf']):
        secs.append(cur)

    out = []
    for s in secs:
        body = NL.join(s['buf']).strip()
        if not body:
            continue
        # 章节内再按空行/超长切段
        chunks, buf, bufstart = [], [], s['line']
        for j, ln in enumerate(body.split(NL)):
            if not ln.strip() and buf:
                t = NL.join(buf).strip()
                if t:
                    chunks.append((bufstart, t))
                buf = []
                bufstart = s['line'] + j + 1
                continue
            if not buf:
                bufstart = s['line'] + j
            # 单行本身超长 → 按标点/窗口硬切
            while len(ln) > SEG_MAX:
                cut = ln[:SEG_MAX]
                k = max(cut.rfind('。'), cut.rfind('；'), cut.rfind('，'), cut.rfind(' '))
                k = k if k > SEG_MAX * 0.5 else SEG_MAX
                buf.append(ln[:k])
                chunks.append((bufstart, NL.join(buf).strip()))
                buf, bufstart = [], bufstart
                ln = ln[k:]
            buf.append(ln)
        if buf:
            t = NL.join(buf).strip()
            if t:
                chunks.append((bufstart, t))

        for ln0, t in chunks:
            t = re.sub(r'\s*\n\s*', NL, t).strip()
            if not t:
                continue
            # 长段再兜一层：纯按窗口切（保段落上下文，不丢字符）
            if len(t) <= SEG_MAX * 2:
                out.append({**{k: v for k, v in s.items() if k != 'buf'},
                            'line': ln0, 'text': t})
            else:
                for k in range(0, len(t), SEG_MAX):
                    out.append({**{k2: v for k2, v in s.items() if k2 != 'buf'},
                                'line': ln0 + k // 80, 'text': t[k:k + SEG_MAX]})
    return out


def enumerate_files():
    files = []
    for name in sorted(os.listdir(ROOT)):
        if name.startswith('_ABox') and (name.endswith('.md') or name.endswith('.html')):
            files.append(os.path.join(ROOT, name))
    d = os.path.join(ROOT, 'abox-onebox', 'docs')
    for name in sorted(os.listdir(d)):
        if name.endswith('.md') or name.endswith('.html'):
            files.append(os.path.join(d, name))
    return files


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    docs, report = [], []
    for p in enumerate_files():
        name = os.path.basename(p)
        is_md = name.endswith('.md')
        try:
            text = read(p) if is_md else strip_html(p)
        except Exception as e:
            report.append((name, 'C', f'读取失败：{e}', 0, 0))
            continue
        chars = len(text)
        g, why = grade_of(name, chars)
        if g == 'C':
            report.append((name, g, why, chars, 0))
            continue
        secs = split_sections(text, name)
        if not secs:
            report.append((name, 'C', '切分后无内容', chars, 0))
            continue
        raw = len(secs)
        secs = coalesce(secs)
        docs.append({
            'id': 'D%02d' % (len(docs) + 1),
            'name': name,
            'grade': g,
            'path': os.path.relpath(p, ROOT).replace('\\', '/'),
            'chars': chars,
            'raw_sections': raw,
            'sections': secs,
        })
        report.append((name, g, why, chars, len(secs)))

    total = sum(d['chars'] for d in docs)
    nseg = sum(len(d['sections']) for d in docs)
    io.open(os.path.join(OUTDIR, 'corpus.json'), 'w', encoding='utf-8', newline='\n').write(
        json.dumps({'docs': docs}, ensure_ascii=False))

    L = ['# 语料扫描报告', '',
         f'- 入册文档 **{len(docs)}** 份（A {sum(1 for d in docs if d["grade"]=="A")} / '
         f'B {sum(1 for d in docs if d["grade"]=="B")}）· 剔除 **{sum(1 for r in report if r[1]=="C")}** 份',
         f'- 纯文本合计 **{total:,}** 字符 · 切出段落 **{nseg:,}** 个',
         f'- corpus.json 体积 **{os.path.getsize(os.path.join(OUTDIR,"corpus.json")):,}** 字节', '',
         '| 文档 | 级 | 字符 | 段 | 依据 |', '|---|---|---:|---:|---|']
    for name, g, why, chars, n in sorted(report, key=lambda r: (-r[3])):
        L.append(f'| {name} | {g} | {chars:,} | {n} | {why} |')
    io.open(os.path.join(OUTDIR, 'scan-report.md'), 'w', encoding='utf-8', newline='\n').write(NL.join(L))

    cj = os.path.join(OUTDIR, 'corpus.json')
    import gzip
    raw_tot = sum(d['raw_sections'] for d in docs)
    gz = len(gzip.compress(io.open(cj, 'rb').read(), 9))
    print(f'入册 {len(docs)} 份 · 剔除 {sum(1 for r in report if r[1]=="C")} 份')
    print(f'纯文本 {total:,} 字符 · 段落 {raw_tot:,} → 合并后 {nseg:,}')
    print(f'corpus.json {os.path.getsize(cj):,} 字节 · gzip 后 {gz:,} 字节 '
          f'（压到 {gz / os.path.getsize(cj) * 100:.0f}%）')
    return 0


if __name__ == '__main__':
    sys.exit(main())
