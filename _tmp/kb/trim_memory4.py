# -*- coding: utf-8 -*-
"""第二轮剪枝：把 §三「已收口名单 / 经营规划」与 §四「生成源已回填」的留痕原文迁进 ref，索引只留指针。
   第二份 ref 各归其位：设计类 → ref/设计替换.md；其余 → ref/进度与留痕.md。同样带覆盖率断言。"""
import io
import os

MEM = r'C:\Users\herma\WorkBuddy\ABox小程序\.workbuddy\memory\MEMORY.md'
REF_L = r'C:\Users\herma\WorkBuddy\ABox小程序\.workbuddy\memory\ref\进度与留痕.md'
REF_D = r'C:\Users\herma\WorkBuddy\ABox小程序\.workbuddy\memory\ref\设计替换.md'

# (起点锚, 终点锚(不含), 指针, 目标 ref, 目标册名)
MOVES = [
    ('- ✅ **已收口**：#49 #61',
     '\n**随时要用的口径**',
     '- ✅ **已收口一批**（#49 #61 #76 #79 #84 #86 #87/#88 #89 #90/#91 #92 #93 #94 U13/U14 · #63 族 · M5-20 U19）→ 名单与日期 ref《进度与留痕》\n',
     REF_L, '进度与留痕'),

    ('- ⭐ **《_ABox一盒创业系统地图与开发路线v1.0.html》**',
     '\n**AI 内部助手（P0·E1）**',
     '- ⭐ **《_ABox一盒创业系统地图与开发路线v1.0.html》**（工作区根 · 30 系统 / 7 域 / P0–P3）—— 核心判断与 P0 七项 → ref《进度与留痕》\n',
     REF_L, '进度与留痕'),

    ('- ✅ **S 系列（S1–S8）全部落码并验收**',
     '\n- ✅ **生成源已回填',
     '- ✅ **S 系列（S1–S8）全部落码并验收** · 基线清单重冻 → 数值与复核过程 ref《设计替换》\n',
     REF_D, '设计替换'),

    ('- ✅ **生成源已回填（S8-6b · 2026-09-21）**',
     '\n- ⭐ **生成器两条纪律**',
     '- ✅ **生成源已回填（S8-6b）**：`_tmp/dsg/build-spec.py` 已补齐 S7.5/S8 全节，干跑与磁盘 sha256 一致；回填脚本 **幂等** → 细则 ref《设计替换》\n',
     REF_D, '设计替换'),
]


def main():
    mem = io.open(MEM, encoding='utf-8').read()
    refs = {REF_L: io.open(REF_L, encoding='utf-8').read(),
            REF_D: io.open(REF_D, encoding='utf-8').read()}
    before = len(mem)
    todo = []
    for start, end, ptr, tgt, name in MOVES:
        i = mem.find(start)
        j = mem.find(end, i)
        if i < 0 or j < 0 or j <= i:
            print(f'✗ 锚点问题：{start[:34]!r} -> {end[:20]!r}')
            return 1
        todo.append((i, j, ptr, tgt, name, mem[i:j]))

    # 覆盖率复核：分册追加后再逐行核对
    add = {}
    for _, _, _, tgt, name, blk in todo:
        add.setdefault(tgt, []).append(blk)
    for tgt, blocks in add.items():
        refs[tgt] = refs[tgt].rstrip('\n') + '\n\n---\n\n## 附 · 自 MEMORY.md 迁入（2026-09-24 · 二轮）\n\n' + '\n'.join(blocks)
    bad = []
    for _, _, _, tgt, name, blk in todo:
        for ln in blk.split('\n'):
            if ln.strip() and ln not in refs[tgt]:
                bad.append((name, ln))
    if bad:
        print('✗ 有 %d 行在目标分册找不到，**不写盘**：' % len(bad))
        for n, ln in bad[:6]:
            print('   [%s] %s' % (n, ln[:80]))
        return 1
    print('✔ 覆盖率复核通过')

    for i, j, ptr, tgt, name, blk in sorted(todo, key=lambda t: -t[0]):
        mem = mem[:i] + ptr + mem[j:]
    for tgt, txt in refs.items():
        io.open(tgt, 'w', encoding='utf-8', newline='\n').write(txt)
    print(f'✔ MEMORY.md {before:,} → {len(mem):,} 字符（目标 ≤ 8,172）')
    print('✔ ref 更新：' + ' · '.join(f'{os.path.basename(k)} {len(v):,}' for k, v in refs.items()))
    return 0 if len(mem) <= 8200 else 3


if __name__ == '__main__':
    raise SystemExit(main())
