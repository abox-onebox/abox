# 括号平衡 + 反引号配对校验（v4.8 admin shell）
import re, sys
src = open('prototype/index.html', encoding='utf-8').read()

# 提取所有 <script>...</script> 内容
scripts = re.findall(r'<script[^>]*>([\s\S]*?)</script>', src)
js = '\n'.join(scripts)

# 1) 大括号 / 圆括号 / 方括号平衡（忽略字符串和模板字面量干扰）
def brace_balance(s):
    b = p = sq = bt = 0
    in_str = None
    in_tpl = False
    in_line_comment = False
    in_block_comment = False
    in_regex = False
    i = 0
    while i < len(s):
        c = s[i]
        nxt = s[i+1] if i+1 < len(s) else ''
        prev = s[i-1] if i > 0 else ''
        # 注释处理
        if in_line_comment:
            if c == '\n': in_line_comment = False
            i += 1; continue
        if in_block_comment:
            if c == '*' and nxt == '/': in_block_comment = False; i += 2; continue
            i += 1; continue
        # 字符串处理
        if in_str:
            if c == '\\':
                i += 2; continue
            if c == in_str:
                in_str = None
            i += 1; continue
        if in_tpl:
            # 反引号内允许 ${ ... }，要先跳过结束的反引号
            if c == '\\':
                i += 2; continue
            if c == '`':
                in_tpl = False
                bt += 1
                i += 1; continue
            i += 1; continue
        # 注释开始
        if c == '/' and nxt == '/':
            in_line_comment = True; i += 2; continue
        if c == '/' and nxt == '*':
            in_block_comment = True; i += 2; continue
        # 字符串开始
        if c in ('"', "'"):
            in_str = c; i += 1; continue
        if c == '`':
            in_tpl = True; bt += 1; i += 1; continue
        # 括号
        if c == '{': b += 1
        elif c == '}': b -= 1
        elif c == '(': p += 1
        elif c == ')': p -= 1
        elif c == '[': sq += 1
        elif c == ']': sq -= 1
        i += 1
    return b, p, sq, bt

b, p, sq, bt = brace_balance(js)
print(f'大括号 {{{{}}: {b}')
print(f'圆括号 (): {p}')
print(f'方括号 []: {sq}')
print(f'反引号 `: {bt}')

if b != 0 or p != 0 or sq != 0 or bt % 2 != 0:
    print('❌ 校验失败')
    sys.exit(1)
else:
    print('✅ 校验通过')
