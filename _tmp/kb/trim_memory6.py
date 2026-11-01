# -*- coding: utf-8 -*-
"""补写：trim_memory4 只写了 ref、**漏写 MEMORY.md**（所以它报的 8,682 是内存值，磁盘没变）。
   这里只把索引换成指针（ref 已在上一轮写好，**不再追加**，否则 ref 里会重复两遍）。
   双向断言：① 迁走内容已不在 MEMORY.md；② 迁走内容确实在对应 ref 里。"""
import io

MEM = r'C:\Users\herma\WorkBuddy\ABox小程序\.workbuddy\memory\MEMORY.md'
REF = {r'C:\Users\herma\WorkBuddy\ABox小程序\.workbuddy\memory\ref\进度与留痕.md': None,
       r'C:\Users\herma\WorkBuddy\ABox小程序\.workbuddy\memory\ref\设计替换.md': None}

MOVES = [
    ('- ✅ **已收口**：#49 #61', '\n**随时要用的口径**',
     '- ✅ **已收口一批**（#49 #61 #76 #79 #84 #86 #87/#88 #89 #90/#91 #92 #93 #94 U13/U14 · #63 族 · M5-20 U19）→ 名单与日期 ref《进度与留痕》\n',
     r'C:\Users\herma\WorkBuddy\ABox小程序\.workbuddy\memory\ref\进度与留痕.md'),
    ('- ⭐ **《_ABox一盒创业系统地图与开发路线v1.0.html》**', '\n**AI 内部助手（P0·E1）**',
     '- ⭐ **《_ABox一盒创业系统地图与开发路线v1.0.html》**（工作区根 · 30 系统 / 7 域 / P0–P3）—— 核心判断与 P0 七项 → ref《进度与留痕》\n',
     r'C:\Users\herma\WorkBuddy\ABox小程序\.workbuddy\memory\ref\进度与留痕.md'),
    ('- ✅ **S 系列（S1–S8）全部落码并验收**', '\n- ✅ **生成源已回填',
     '- ✅ **S 系列（S1–S8）全部落码并验收** · 基线清单重冻 → 数值与复核过程 ref《设计替换》\n',
     r'C:\Users\herma\WorkBuddy\ABox小程序\.workbuddy\memory\ref\设计替换.md'),
    ('- ✅ **生成源已回填（S8-6b · 2026-09-21）**', '\n- ⭐ **生成器两条纪律**',
     '- ✅ **生成源已回填（S8-6b）**：`_tmp/dsg/build-spec.py` 已补齐 S7.5/S8 全节，干跑与磁盘 sha256 一致；回填脚本 **幂等** → 细则 ref《设计替换》\n',
     r'C:\Users\herma\WorkBuddy\ABox小程序\.workbuddy\memory\ref\设计替换.md'),
]


def main():
    mem = io.open(MEM, encoding='utf-8').read()
    refs = {k: io.open(k, encoding='utf-8').read() for k in REF}
    before = len(mem)
    todo = []
    for start, end, ptr, tgt in MOVES:
        i = mem.find(start)
        j = mem.find(end, i)
        if i < 0 or j < 0 or j <= i:
            raise SystemExit(f'✗ 锚点问题：{start[:34]!r} -> {end[:20]!r}')
        todo.append((i, j, ptr, tgt, mem[i:j]))

    # ① ref 覆盖（上一轮已写入）
    bad = [(t, ln) for _, _, _, t, blk in todo for ln in blk.split('\n')
           if ln.strip() and ln not in refs[t]]
    if bad:
        raise SystemExit('✗ ref 未覆盖 %d 行，不写盘：%s' % (len(bad), bad[0][1][:70]))

    for i, j, ptr, tgt, blk in sorted(todo, key=lambda t: -t[0]):
        mem = mem[:i] + ptr + mem[j:]

    # ② 迁走内容确实已不在 MEMORY.md
    # ⚠️ 探针不能用「块首 34 字」—— 指针**刻意**与原文同前缀（`- ⭐ **《…》**`），会自己撞自己。
    #    改成整块比对（指针比整块短得多）。
    left = [blk.strip().split('\n')[0][:30] for _, _, _, _, blk in todo if blk.strip() in mem]
    if left:
        raise SystemExit('✗ 仍有原块残留：%s' % left)

    io.open(MEM, 'w', encoding='utf-8', newline='\n').write(mem)
    print(f'✔ MEMORY.md 写盘：{before:,} → {len(mem):,} 字符（省 {before - len(mem):,}）')
    print(f'✔ 双向核对通过：ref 已覆盖 · MEMORY.md 无残留')
    return 0 if len(mem) <= 8200 else 3


if __name__ == '__main__':
    raise SystemExit(main())
