# -*- coding: utf-8 -*-
"""把五期的「操作草稿」接进 build2.py —— 原子补丁，每处带命中数断言。

沿用 patch_v4.py 的规矩：
  · 每处替换断言命中次数，任何一处对不上就**整支不写盘**（宁可失败，不可写坏）；
  · 顺序铁律：内存里改 → 写临时副本 → py_compile 临时副本 → 通过才写回真文件；
  · 锚点一律按「当前（v4 已打过 patch_v4）」的 build2.py 真值写，缩进与原位一致。
"""
import io
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'build2.py')
CAND = os.path.join(HERE, '_cand_build2_v5.py')


def repl(s, old, new, n=1, tag=''):
    c = s.count(old)
    if c != n:
        raise SystemExit(f'✗ [{tag}] 期望命中 {n} 次，实得 {c} 次。锚点原文：{old[:90]!r}')
    return s.replace(old, new)


def main():
    s = io.open(SRC, encoding='utf-8').read()
    orig = len(s)

    # ① 抬头说明：补「五期操作草稿」
    s = repl(s,
             '构建「ABox 内部助手 v4.0」单文件页 —— 一期检索 + 二期问答 + 三期问数 + 四期体检。',
             '构建「ABox 内部助手 v4.0」单文件页 —— 一期检索 + 二期问答 + 三期问数 + 四期体检 + 五期操作草稿。',
             tag='抬头')

    # ② tab 栏：在「体检」与「检索」之间插「操作」
    s = repl(s,
             "        '<button class=\"tab\" data-v=\"audit\">体检</button>'\n"
             "        '<button class=\"tab\" data-v=\"search\">检索</button></div>'",
             "        '<button class=\"tab\" data-v=\"audit\">体检</button>'\n"
             "        '<button class=\"tab\" data-v=\"ops\">操作</button>'\n"
             "        '<button class=\"tab\" data-v=\"search\">检索</button></div>'",
             tag='tab栏')

    # ③ 提示条：在 haudit 与 hsearch 之间插 hops
    s = repl(s,
             "        '<div class=\"bar\" id=\"haudit\" style=\"display:none\">'\n"
             "        '<span class=\"meta\">语料自检 · 口径 / 覆盖 / 引用 / 时效 —— 全部确定性计算，不耗模型额度</span>'\n"
             "        '</div>'\n"
             "        '<div class=\"bar\" id=\"hsearch\" style=\"display:none\">'",
             "        '<div class=\"bar\" id=\"haudit\" style=\"display:none\">'\n"
             "        '<span class=\"meta\">语料自检 · 口径 / 覆盖 / 引用 / 时效 —— 全部确定性计算，不耗模型额度</span>'\n"
             "        '</div>'\n"
             "        '<div class=\"bar\" id=\"hops\" style=\"display:none\">'\n"
             "        '<span class=\"meta\">自然语言说你想做的后台操作 —— AI 翻成操作草稿（调哪个接口、参数、影响），阶段 1 仅预览不执行</span>'\n"
             "        '</div>'\n"
             "        '<div class=\"bar\" id=\"hsearch\" style=\"display:none\">'",
             tag='操作提示条')

    # ④ 主体骨架：在 view-audit 与 view-search 之间插 view-ops
    s = repl(s,
             "        '<div id=\"view-audit\" hidden></div>'\n"
             "        '<div id=\"view-search\" hidden><div id=\"out\"></div></div>'",
             "        '<div id=\"view-audit\" hidden></div>'\n"
             "        '<div id=\"view-ops\" hidden><div class=\"tip\" id=\"otip\"></div><div id=\"oview\"></div></div>'\n"
             "        '<div id=\"view-search\" hidden><div id=\"out\"></div></div>'",
             tag='操作视图')

    # ⑤ tab 切换：加 view-ops / hops 两路 + showOps()
    OLD_SWITCH = (
        "for (const t of document.querySelectorAll('.tab'))\n"
        "  t.onclick = () => {\n"
        "    const v = t.dataset.v;\n"
        "    for (const x of document.querySelectorAll('.tab')) x.classList.toggle('on', x === t);\n"
        "    document.getElementById('view-ask').hidden = v !== 'ask';\n"
        "    document.getElementById('view-calc').hidden = v !== 'calc';\n"
        "    document.getElementById('view-audit').hidden = v !== 'audit';\n"
        "    document.getElementById('view-search').hidden = v !== 'search';\n"
        "    document.getElementById('hask').style.display = v === 'ask' ? '' : 'none';\n"
        "    document.getElementById('hcalc').style.display = v === 'calc' ? '' : 'none';\n"
        "    document.getElementById('haudit').style.display = v === 'audit' ? '' : 'none';\n"
        "    document.getElementById('hsearch').style.display = v === 'search' ? '' : 'none';\n"
        "    document.querySelector('.composer').style.display = v === 'ask' ? '' : 'none';\n"
        "    if (v === 'calc') showCalc();\n"
        "  };\n"
    )
    NEW_SWITCH = (
        "for (const t of document.querySelectorAll('.tab'))\n"
        "  t.onclick = () => {\n"
        "    const v = t.dataset.v;\n"
        "    for (const x of document.querySelectorAll('.tab')) x.classList.toggle('on', x === t);\n"
        "    document.getElementById('view-ask').hidden = v !== 'ask';\n"
        "    document.getElementById('view-calc').hidden = v !== 'calc';\n"
        "    document.getElementById('view-audit').hidden = v !== 'audit';\n"
        "    document.getElementById('view-ops').hidden = v !== 'ops';\n"
        "    document.getElementById('view-search').hidden = v !== 'search';\n"
        "    document.getElementById('hask').style.display = v === 'ask' ? '' : 'none';\n"
        "    document.getElementById('hcalc').style.display = v === 'calc' ? '' : 'none';\n"
        "    document.getElementById('haudit').style.display = v === 'audit' ? '' : 'none';\n"
        "    document.getElementById('hops').style.display = v === 'ops' ? '' : 'none';\n"
        "    document.getElementById('hsearch').style.display = v === 'search' ? '' : 'none';\n"
        "    document.querySelector('.composer').style.display = v === 'ask' ? '' : 'none';\n"
        "    if (v === 'calc') showCalc();\n"
        "    if (v === 'ops') showOps();\n"
        "  };\n"
    )
    s = repl(s, OLD_SWITCH, NEW_SWITCH, tag='tab切换')

    # ⑥ 读五期源件
    s = repl(s,
             "AUDIT_JS = io.open(os.path.join(HERE, 'audit.js'), encoding='utf-8').read()",
             "AUDIT_JS = io.open(os.path.join(HERE, 'audit.js'), encoding='utf-8').read()\n"
             "OPS_CSS = io.open(os.path.join(HERE, 'ops.css'), encoding='utf-8').read()\n"
             "OPS_JS = io.open(os.path.join(HERE, 'ops.js'), encoding='utf-8').read()",
             tag='读五期源件')

    # ⑦ 拼 CSS
    s = repl(s,
             "<style>' + CSS + CALC_CSS + AUDIT_CSS + '</style>",
             "<style>' + CSS + CALC_CSS + AUDIT_CSS + OPS_CSS + '</style>",
             tag='拼CSS')

    # ⑧ 拼脚本：在 AUDIT_JS 之后插 OPS_JS
    s = repl(s,
             "        '<script>' + AUDIT_JS + '</script>\\n</body>\\n</html>\\n'",
             "        '<script>' + AUDIT_JS + '</script>\\n'"
             "        '<script>' + OPS_JS + '</script>\\n</body>\\n</html>\\n'",
             tag='拼脚本')

    # ⑨ 汇总打印
    s = repl(s,
             "    print(f'  四期源件 audit.css {len(AUDIT_CSS):,} / audit.js {len(AUDIT_JS):,} 字符')",
             "    print(f'  四期源件 audit.css {len(AUDIT_CSS):,} / audit.js {len(AUDIT_JS):,} 字符')\n"
             "    print(f'  五期源件 ops.css {len(OPS_CSS):,} / ops.js {len(OPS_JS):,} 字符')",
             tag='汇总打印')

    io.open(CAND, 'w', encoding='utf-8', newline='\n').write(s)
    r = subprocess.run([sys.executable, '-m', 'py_compile', CAND], capture_output=True, text=True)
    if r.returncode != 0:
        print('✗ 候选未通过 py_compile，**未写回**：')
        print(r.stderr)
        return 1
    io.open(SRC, 'w', encoding='utf-8', newline='\n').write(s)
    print(f'✔ 补丁已写入 build2.py：{orig:,} → {len(s):,} 字节（九处替换全部命中）')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
