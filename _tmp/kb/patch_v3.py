# -*- coding: utf-8 -*-
"""把三期的「问数」接进 build2.py —— 原子补丁，每处带命中数断言。

为什么不直接手改 build2.py：
  它有大段「JS 塞进 Python 字面量」的内容，手改极易在引号/换行上出错，而且**改错不报错**。
  这里每处替换都断言命中次数，任何一处对不上就**整支不写盘**（宁可失败，不可写坏）。

顺序铁律（工程纪律 C7）：内存里改 → 写临时副本 → py_compile 临时副本 → 通过才写回真文件。
"""
import io
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'build2.py')
CAND = os.path.join(HERE, '_cand_build2.py')   # 必须带 .py，否则 py_compile 不认


def repl(s, old, new, n=1, tag=''):
    c = s.count(old)
    if c != n:
        raise SystemExit(f'✗ [{tag}] 期望命中 {n} 次，实得 {c} 次。锚点原文：{old[:80]!r}')
    return s.replace(old, new)


def splice(s, start, end, new, tag=''):
    if s.count(start) != 1:
        raise SystemExit(f'✗ [{tag}] 起点不唯一（{s.count(start)} 次）：{start[:80]!r}')
    i = s.find(start)
    j = s.find(end, i)
    if j < 0:
        raise SystemExit(f'✗ [{tag}] 在起点之后找不到终点：{end[:60]!r}')
    return s[:i] + new + s[j + len(end):]


# ────────────────────────── 新增/替换的片段 ──────────────────────────

NEW_TRY = '''    const base = [
      {role: 'system', content: SYS_PROMPT},
      ...HIST.slice(-HIST_MAX),
      {role: 'user', content: '【资料】\\n' + ctx + '\\n\\n【问题】' + q},
    ];
    full = await streamRound(base, ansEl, meta, ev.length, model);
    /* 三期 · 取数：模型要"算数"就必须先写 <<Q>> 取数块 —— 这里替它算（它一个加减乘除都不许做），
       再把结果原样回灌，让它把结果写成中文。**只续一轮**，防止来回取数停不下来。 */
    const plans = Q ? Q.extract(full) : [];
    if (plans.length){
      const outs = plans.map(p => Q.run(p));
      meta.textContent = '正在取数…（' + plans.length + ' 项）';
      const cardEl = document.createElement('div');
      cardEl.innerHTML = Q.card(outs);
      body.appendChild(cardEl);
      full = await streamRound(
        base.concat([{role: 'assistant', content: full},
                     {role: 'user', content: Q.brief(outs)}]),
        ansEl, meta, ev.length, model);
    }
    done = true;
'''

STREAMROUND = '''/* 流式一问 —— 抽成函数，是因为三期要连问两轮：先取数，再据数作答。
   hideQ 默认恒等；calc.js 载入后会把它换成「藏掉取数块」的版本，
   否则用户会看着一行丑 JSON 在屏幕上滚。 */
async function streamRound(messages, ansEl, meta, ncite, model){
  let out = '';
  const stream = cloud.llm.chat.completions.create({
    model: model.id,
    messages: messages,
    stream: true,
    temperature: 0.3,
    conversationId: CONV,
    signal: ctl.signal,
  });
  for await (const chunk of stream){
    const d = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
    if (d && d.content){ out += d.content; ansEl.innerHTML = md2html(hideQ(out), ncite); scrollChat(); }
    if (chunk.usage) meta.textContent = '本次用量 ' + chunk.usage.total_tokens + ' tokens';
  }
  return out;
}

'''

NEW_TABS = '''for (const t of document.querySelectorAll('.tab'))
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

NEW_HEAD = """        '<div class="meta" id="meta">正在载入语料…</div>'
        '<div class="meta" id="meta2"></div>'
        '<div class="tabs"><button class="tab on" data-v="ask">问答</button>'
        '<button class="tab" data-v="calc">问数</button>'
        '<button class="tab" data-v="search">检索</button></div>'
        '<div class="bar" id="hask">'
        '<select class="sel" id="model" hidden></select>'
        '<span class="meta">文档答口径 · 数据答数字（数字由本页引擎算）· 两者都挂出处</span>'
        '</div>'
        '<div class="bar" id="hcalc" style="display:none">'
        '<span class="meta">口径 · 时间轴 · 区间 · 分组都由你定；结果连同等价 SQL 与命中行数一并给出</span>'
        '<span class="meta" id="cquick" style="margin-left:auto;color:var(--brand);cursor:pointer">近 7 天</span>'
        '</div>'
        '<div class="bar" id="hsearch" style="display:none">'
"""

NEW_CALC_VIEW = """        '<div id="view-ask"><div id="chat"></div><div class="sug" id="sug"></div></div>'
        '<div id="view-calc" hidden>'
        '<div class="tip">「问数」走的是<b>确定性引擎</b>：口径、时间轴、区间、分组都在下面指定，'
        '结果连同<b>等价 SQL</b> 与命中行数一并给出。问答页提问时，语言模型只负责把你的话翻成'
        '<b>取数块</b> —— 它自己不参与任何计算。</div>'
        '<div class="panel"><div class="frow">'
        '<div class="f"><label>指标</label><select id="cm"></select></div>'
        '<div class="f"><label>口径</label><select id="cs"></select></div>'
        '<div class="f"><label>时间轴</label><select id="ct"></select></div>'
        '<div class="f"><label>起（含）</label><input id="cfrom" type="date"></div>'
        '<div class="f"><label>止（含）</label><input id="cto" type="date"></div>'
        '<div class="f"><label>&nbsp;</label><button class="btn gh" id="cgo">算一下</button></div>'
        '</div><div class="chk" id="cg"></div></div>'
        '<div class="res" id="cout"></div>'
        '<div class="sechead">指标口径卡 —— 口径的唯一真源</div>'
        '<div class="mgrid" id="cmlist"></div>'
        '</div>'
        '<div id="view-search" hidden><div id="out"></div></div>'
"""

NEW_MAINTAIL = """    mraw = io.open(os.path.join(OUT, 'metrics.json'), 'rb').read()
    mgz = gzip.compress(mraw, 9)
    mb64 = base64.b64encode(mgz).decode('ascii')
    mb64_wrapped = '\\n'.join(mb64[i:i + 200] for i in range(0, len(mb64), 200))

"""


def main():
    s = io.open(SRC, encoding='utf-8').read()
    orig_len = len(s)

    # ① 抬头 / 产物名
    s = repl(s, '构建「知识问答 v2.0」单文件页 —— 一期检索层 + 二期挂出处问答。',
             '构建「ABox 内部助手 v3.0」单文件页 —— 一期检索 + 二期问答 + 三期问数。', tag='抬头')
    s = repl(s, "os.path.join(ROOT, '_ABox一盒知识问答v2.0.html'),",
             "os.path.join(ROOT, '_ABox一盒知识助手v3.0.html'),", tag='产物名')
    s = repl(s, "title = 'ABox 一盒 · 知识问答 v2.0'", "title = 'ABox 一盒 · 内部助手 v3.0'", tag='标题')
    s = repl(s, '<span class="brand">ABox 一盒 · 知识问答</span>',
             '<span class="brand">ABox 一盒 · 内部助手</span>', tag='页头品牌')

    # ② 系统提示改成 let（三期要追加「业务数据」段）+ 铁律 3 补上数据通道
    s = repl(s, 'const SYS_PROMPT = [', 'let SYS_PROMPT = [', tag='SYS_PROMPT改let')
    s = repl(
        s,
        "'3. 不许自己算数：金额、比例、数量、时间等数字必须原样引自资料。需要计算而资料给不全时，明确说「资料不足，无法计算」，不要给估算值。',",
        "'3. 不许自己算数：数字要么原样引自资料，要么来自【业务数据】的取数结果。"
        "资料与数据都给不全时，明确说「不足，无法计算」，不要给估算值、也不要顺手估算。',",
        tag='铁律3')

    # ③ ask() 里接入「取数 → 回灌 → 续答」
    s = repl(s, 'async function ask(q){',
             '/* 三期：hideQ 藏取数块（默认恒等，由 calc.js 覆写）；Q 即问数引擎（由 calc.js 注入） */\n'
             'let hideQ = s => s;\nlet Q = null;\n\nasync function ask(q){', tag='注入hideQ/Q')

    s = splice(
        s,
        '    const stream = cloud.llm.chat.completions.create({',
        '    done = true;\n',
        NEW_TRY,
        tag='ask主流程')

    s = repl(s, 'function trimHist(){', STREAMROUND + 'function trimHist(){', tag='插streamRound')

    # ④ 三个 tab 的切换
    s = splice(
        s,
        "for (const t of document.querySelectorAll('.tab'))",
        "  };\n",
        NEW_TABS,
        tag='tab切换')

    # ⑤ 页头与主体骨架（加「问数」入口 / 视图 / 提示条）
    s = repl(
        s,
        "        '<div class=\"meta\" id=\"meta\">正在载入语料…</div>'\n"
        "        '<div class=\"tabs\"><button class=\"tab on\" data-v=\"ask\">问答</button>'\n"
        "        '<button class=\"tab\" data-v=\"search\">检索</button></div>'\n"
        "        '<div class=\"bar\" id=\"hask\">'\n"
        "        '<select class=\"sel\" id=\"model\" hidden></select>'\n"
        "        '<span class=\"meta\">回答只依据本项目文档 · 每句挂出处 · 检索不到就说没写</span>'\n"
        "        '</div>'\n"
        "        '<div class=\"bar\" id=\"hsearch\" style=\"display:none\">'\n",
        NEW_HEAD, tag='页头')

    s = repl(
        s,
        "        '<div id=\"view-ask\"><div id=\"chat\"></div><div class=\"sug\" id=\"sug\"></div></div>'\n"
        "        '<div id=\"view-search\" hidden><div id=\"out\"></div></div>'\n",
        NEW_CALC_VIEW, tag='主体骨架')

    # ⑥ 生成器：读三期源件 + 内嵌快照
    s = repl(
        s,
        'def main():\n    t0 = time.time()',
        "# 三期源件（与 build2.py 分开放，避免在这种「大段 JS 塞进 Python 字面量」的写法里改错；\n"
        "# 它们仍是本生成器的源 —— 不存在第二份产物真源）\n"
        "CALC_CSS = io.open(os.path.join(HERE, 'calc.css'), encoding='utf-8').read()\n"
        "CALC_JS = io.open(os.path.join(HERE, 'calc.js'), encoding='utf-8').read()\n\n\n"
        'def main():\n    t0 = time.time()',
        tag='读三期源件')

    s = repl(s, "    cfg_js = json.dumps(CLOUD_CFG, ensure_ascii=False)",
             "    cfg_js = json.dumps(CLOUD_CFG, ensure_ascii=False)\n\n" + NEW_MAINTAIL.rstrip('\n'),
             tag='内嵌快照')

    s = repl(s, "<style>' + CSS + '</style>", "<style>' + CSS + CALC_CSS + '</style>", tag='拼CSS')
    s = repl(
        s,
        "        '<script id=\"corpus\" type=\"application/gzip+base64\">\\n' + b64_wrapped + '\\n</script>\\n'\n"
        "        '<script>' + JS + '</script>\\n</body>\\n</html>\\n'",
        "        '<script id=\"corpus\" type=\"application/gzip+base64\">\\n' + b64_wrapped + '\\n</script>\\n'\n"
        "        '<script id=\"metrics\" type=\"application/gzip+base64\">\\n' + mb64_wrapped + '\\n</script>\\n'\n"
        "        '<script>' + JS + '</script>\\n'\n"
        "        '<script>' + CALC_JS + '</script>\\n</body>\\n</html>\\n'",
        tag='拼脚本')

    s = repl(
        s,
        "    print(f'  载荷 {len(payload):,} 字节 → gzip {len(gz):,} → base64 {len(b64):,}')",
        "    print(f'  载荷 {len(payload):,} 字节 → gzip {len(gz):,} → base64 {len(b64):,}')\n"
        "    print(f'  快照 {len(mraw):,} 字节 → gzip {len(mgz):,} → base64 {len(mb64):,}')\n"
        "    print(f'  三期源件 calc.css {len(CALC_CSS):,} / calc.js {len(CALC_JS):,} 字符')",
        tag='汇总打印')

    # ── 写候选 → 语法预检 → 通过才写回 ──
    io.open(CAND, 'w', encoding='utf-8', newline='\n').write(s)
    r = subprocess.run([sys.executable, '-m', 'py_compile', CAND], capture_output=True, text=True)
    if r.returncode != 0:
        print('✗ 候选未通过 py_compile，**未写回**：')
        print(r.stderr)
        return 1
    io.open(SRC, 'w', encoding='utf-8', newline='\n').write(s)
    print(f'✔ 补丁已写入 build2.py：{orig_len:,} → {len(s):,} 字节')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
