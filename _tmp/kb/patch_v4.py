# -*- coding: utf-8 -*-
"""把四期的「体检」接进 build2.py —— 原子补丁，每处带命中数断言。

沿用三期 patch_v3.py 的规矩：
  · 每处替换断言命中次数，任何一处对不上就**整支不写盘**（宁可失败，不可写坏）；
  · 顺序铁律：内存里改 → 写临时副本 → py_compile 临时副本 → 通过才写回真文件。
"""
import io
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'build2.py')
CAND = os.path.join(HERE, '_cand_build2.py')


def repl(s, old, new, n=1, tag=''):
    c = s.count(old)
    if c != n:
        raise SystemExit(f'✗ [{tag}] 期望命中 {n} 次，实得 {c} 次。锚点原文：{old[:90]!r}')
    return s.replace(old, new)


NEW_TABS = '''for (const t of document.querySelectorAll('.tab'))
  t.onclick = () => {
    const v = t.dataset.v;
    for (const x of document.querySelectorAll('.tab')) x.classList.toggle('on', x === t);
    document.getElementById('view-ask').hidden = v !== 'ask';
    document.getElementById('view-calc').hidden = v !== 'calc';
    document.getElementById('view-audit').hidden = v !== 'audit';
    document.getElementById('view-search').hidden = v !== 'search';
    document.getElementById('hask').style.display = v === 'ask' ? '' : 'none';
    document.getElementById('hcalc').style.display = v === 'calc' ? '' : 'none';
    document.getElementById('haudit').style.display = v === 'audit' ? '' : 'none';
    document.getElementById('hsearch').style.display = v === 'search' ? '' : 'none';
    document.querySelector('.composer').style.display = v === 'ask' ? '' : 'none';
    if (v === 'calc') showCalc();
  };
'''

OLD_TABS = '''for (const t of document.querySelectorAll('.tab'))
  t.onclick = () => {
    const v = t.dataset.v;
    for (const x of document.querySelectorAll('.tab')) x.classList.toggle('on', x === t);
    document.getElementById('view-ask').hidden = v !== 'ask';
    document.getElementById('view-calc').hidden = v !== 'calc';
    document.getElementById('view-search').hidden = v !== 'search';
    document.getElementById('hask').style.display = v === 'ask' ? '' : 'none';
    document.getElementById('hcalc').style.display = v === 'calc' ? '' : 'none';
    document.getElementById('hsearch').style.display = v === 'search' ? '' : 'none';
    document.querySelector('.composer').style.display = v === 'ask' ? '' : 'none';
    if (v === 'calc') showCalc();
  };
'''


def main():
    s = io.open(SRC, encoding='utf-8').read()
    orig = len(s)

    # ① 抬头 / 产物名 / 标题
    s = repl(s, '构建「ABox 内部助手 v3.0」单文件页 —— 一期检索 + 二期问答 + 三期问数。',
             '构建「ABox 内部助手 v4.0」单文件页 —— 一期检索 + 二期问答 + 三期问数 + 四期体检。',
             tag='抬头')
    s = repl(s, "os.path.join(ROOT, '_ABox一盒知识助手v3.0.html'),",
             "os.path.join(ROOT, '_ABox一盒知识助手v4.0.html'),", tag='产物名')
    s = repl(s, "title = 'ABox 一盒 · 内部助手 v3.0'",
             "title = 'ABox 一盒 · 内部助手 v4.0'", tag='标题')

    # ② tab 栏 + 提示条
    s = repl(s, """        '<button class="tab" data-v="search">检索</button></div>'""",
             """        '<button class="tab" data-v="audit">体检</button>'
        '<button class="tab" data-v="search">检索</button></div>'""", tag='tab栏')

    s = repl(s, """        '<div class="bar" id="hsearch" style="display:none">'""",
             """        '<div class="bar" id="haudit" style="display:none">'
        '<span class="meta">语料自检 · 口径 / 覆盖 / 引用 / 时效 —— 全部确定性计算，不耗模型额度</span>'
        '</div>'
        '<div class="bar" id="hsearch" style="display:none">'""", tag='体检提示条')

    # ③ 主体骨架
    s = repl(s, """        '<div id="view-search" hidden><div id="out"></div></div>'""",
             """        '<div id="view-audit" hidden></div>'
        '<div id="view-search" hidden><div id="out"></div></div>'""", tag='体检视图')

    # ④ tab 切换加一路
    s = repl(s, OLD_TABS, NEW_TABS, tag='tab切换')

    # ⑤ 注入 AUDIT 占位（与 Q 并列，供 build2.py 那边的规则段引用）
    s = repl(s, 'let Q = null;', 'let Q = null;\nlet AUDIT = null;', tag='AUDIT占位')

    # ⑥ 读四期源件
    s = repl(s, "CALC_JS = io.open(os.path.join(HERE, 'calc.js'), encoding='utf-8').read()",
             "CALC_JS = io.open(os.path.join(HERE, 'calc.js'), encoding='utf-8').read()\n"
             "AUDIT_CSS = io.open(os.path.join(HERE, 'audit.css'), encoding='utf-8').read()\n"
             "AUDIT_JS = io.open(os.path.join(HERE, 'audit.js'), encoding='utf-8').read()",
             tag='读四期源件')

    # ⑦ 内嵌体检结果（gzip+base64）
    s = repl(s,
             "    mb64_wrapped = '\\n'.join(mb64[i:i + 200] for i in range(0, len(mb64), 200))\n",
             "    mb64_wrapped = '\\n'.join(mb64[i:i + 200] for i in range(0, len(mb64), 200))\n\n"
             "    araw = io.open(os.path.join(OUT, 'audit.json'), 'rb').read()\n"
             "    agz = gzip.compress(araw, 9)\n"
             "    ab64 = base64.b64encode(agz).decode('ascii')\n"
             "    ab64_wrapped = '\\n'.join(ab64[i:i + 200] for i in range(0, len(ab64), 200))\n",
             tag='内嵌体检')

    # ⑧ 拼 CSS / 脚本
    s = repl(s, "<style>' + CSS + CALC_CSS + '</style>",
             "<style>' + CSS + CALC_CSS + AUDIT_CSS + '</style>", tag='拼CSS')

    s = repl(s,
             "        '<script>' + CALC_JS + '</script>\\n</body>\\n</html>\\n'",
             "        '<script id=\"audit\" type=\"application/gzip+base64\">\\n' + ab64_wrapped + '\\n</script>\\n'\n"
             "        '<script>' + CALC_JS + '</script>\\n'\n"
             "        '<script>' + AUDIT_JS + '</script>\\n</body>\\n</html>\\n'",
             tag='拼脚本')

    # ⑨ 汇总打印
    s = repl(s,
             "    print(f'  三期源件 calc.css {len(CALC_CSS):,} / calc.js {len(CALC_JS):,} 字符')",
             "    print(f'  三期源件 calc.css {len(CALC_CSS):,} / calc.js {len(CALC_JS):,} 字符')\n"
             "    print(f'  体检 {len(araw):,} 字节 → gzip {len(agz):,} → base64 {len(ab64):,}')\n"
             "    print(f'  四期源件 audit.css {len(AUDIT_CSS):,} / audit.js {len(AUDIT_JS):,} 字符')",
             tag='汇总打印')

    io.open(CAND, 'w', encoding='utf-8', newline='\n').write(s)
    r = subprocess.run([sys.executable, '-m', 'py_compile', CAND], capture_output=True, text=True)
    if r.returncode != 0:
        print('✗ 候选未通过 py_compile，**未写回**：')
        print(r.stderr)
        return 1
    io.open(SRC, 'w', encoding='utf-8', newline='\n').write(s)
    print(f'✔ 补丁已写入 build2.py：{orig:,} → {len(s):,} 字节')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
