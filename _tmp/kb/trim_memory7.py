# -*- coding: utf-8 -*-
"""最后一刀：§二 里「超长单行」这条实操细节迁 ref/工程纪律.md，索引留指针。
   合并了两支脚本的教训：**ref 与索引都要写**，且**双向核对**（ref 已覆盖 + 索引无残留）。"""
import io

MEM = r'C:\Users\herma\WorkBuddy\ABox小程序\.workbuddy\memory\MEMORY.md'
REF = r'C:\Users\herma\WorkBuddy\ABox小程序\.workbuddy\memory\ref\工程纪律.md'

START = '- ⚠️ **本工作区多份契约 md 存在「超长单行」**'
END = '\n'
PTR = ('- ⚠️ **契约 md 的「超长单行」会让编辑器卡顿（与体积无关）** ⇒ 对策 `.vscode/settings.json` 的 '
       '`editor.maxTokenizationLineLength`；**Markdown 预览面板仍会卡**（用源码视图）→ 细则 ref《工程纪律》\n')


def main():
    mem = io.open(MEM, encoding='utf-8').read()
    ref = io.open(REF, encoding='utf-8').read()
    i = mem.find(START)
    if i < 0:
        raise SystemExit('✗ 找不到起点')
    j = mem.find(END, i)
    if j < 0:
        raise SystemExit('✗ 找不到终点')
    blk = mem[i:j]
    print('迁走 %d 字符' % len(blk))

    new_ref = ref.rstrip('\n') + '\n\n---\n\n## 附 · 自 MEMORY.md 迁入（2026-09-24 · 编辑器超长单行）\n\n' + blk + '\n'
    if any(ln.strip() and ln not in new_ref for ln in blk.split('\n')):
        raise SystemExit('✗ ref 未覆盖，不写盘')

    new_mem = mem[:i] + PTR + mem[j:]
    if blk.strip() in new_mem:
        raise SystemExit('✗ 索引仍有残留，不写盘')

    io.open(REF, 'w', encoding='utf-8', newline='\n').write(new_ref)
    io.open(MEM, 'w', encoding='utf-8', newline='\n').write(new_mem)
    print(f'✔ ref/工程纪律.md {len(ref):,} → {len(new_ref):,}')
    print(f'✔ MEMORY.md {len(mem):,} → {len(new_mem):,} 字符')
    return 0 if len(new_mem) <= 8200 else 3


if __name__ == '__main__':
    raise SystemExit(main())
