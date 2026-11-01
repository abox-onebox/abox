# -*- coding: utf-8 -*-
"""把 MEMORY.md 里的**留痕型段落原文迁入** ref/进度与留痕.md，索引里只留指针。

纪律（工程纪律 C8 / 用户级记忆）：
  ⚠️ 删之前必须**机械核对目标文件是否真的覆盖了要删的内容** —— 不核对就删会**真的丢信息**，
     而且没有任何工具会报错（与「两份表述」同族：不被校验的那份必然是错的）。
  ⇒ 顺序：原文迁入 ref → 逐行 grep 复核命中 → MEMORY.md 里只留指针。

触发原因：MEMORY.md 已达 10,391 字符，而此前 **11,731 字符时就因超注入上限被截断过**。
"""
import io
import os
import sys

ROOT = r'C:\Users\herma\WorkBuddy\ABox小程序'
MEM = os.path.join(ROOT, '.workbuddy', 'memory', 'MEMORY.md')
REF = os.path.join(ROOT, '.workbuddy', 'memory', 'ref', '进度与留痕.md')

# (起点锚、终点锚(不含)、迁走后留下的指针)
MOVES = [
    ('**人工测试执行层（一句话 + 指针）**',
     '**2026-09-24 登记册新增',
     '**人工测试执行层**：执行顺序真源《_ABox一盒人工测试执行手册v1.0.md》· 判据真源《_ABox一盒人工测试指引v1.0.md》\n'
     '- 产物两份**勿混称**：实跑结果报告（**接口断言**口径 619 全绿）vs《真人操作实录》18 份（截图+抄屏+落点）\n'
     '- ⭐ 测试工程 `_tmp/qa-env/uisim/`（一卡一规格 · 支持单卡重跑 · 四条证据通道）→ 细则 ref《进度与留痕》\n'),

    ('**2026-09-24 登记册新增（三条 · 均 P2 · 不改代码）**',
     '**经营规划（2026-09-24 新增）**',
     '- **2026-09-24 登记册新增㉑㉒㉓**（均 P2 · 不改代码；㉑㉒ 的**判据文本修订**须改 `_tmp/guide-build/` 源件再重生成，**单列一批**）→ 细则 ref《进度与留痕》\n'),

    ('**AI 内部助手（P0·E1）一期已交付（2026-09-24）**',
     '## 四、两端 UI 重塑',
     '**AI 内部助手（P0·E1）**：三版单文件 + 已上线应用 → 见本节 §五；一期/二期/三期的验收明细与判据坑 → ref《进度与留痕》\n'),
]


def main():
    mem = io.open(MEM, encoding='utf-8').read()
    ref = io.open(REF, encoding='utf-8').read()
    moved_all, pointers = [], []
    for start, end, ptr in MOVES:
        i = mem.find(start)
        j = mem.find(end)
        if i < 0 or j < 0 or j <= i:
            print(f'✗ 锚点找不到或顺序不对：{start[:30]!r} / {end[:30]!r}')
            return 1
        moved_all.append(mem[i:j])
        pointers.append((i, j, ptr))

    blob = '\n'.join(moved_all)

    # ① 覆盖率复核：迁走内容里每个非空行，都必须在**新的 ref** 里能找到
    new_ref = ref.rstrip('\n') + '\n\n---\n\n## 附 · 自 MEMORY.md 迁入（2026-09-24 · 三期）\n\n' + blob
    miss = [ln for ln in blob.split('\n') if ln.strip() and ln not in new_ref]
    if miss:
        print('✗ 有 %d 行在 ref 里找不到，**不写盘**：' % len(miss))
        for m in miss[:8]:
            print('   ', m[:90])
        return 1
    print(f'✔ 覆盖率复核通过：迁走的 {len([l for l in blob.split(chr(10)) if l.strip()])} 行全部命中 ref')

    # ② 倒序替换（避免位移）
    for i, j, ptr in sorted(pointers, reverse=True):
        mem = mem[:i] + ptr + mem[j:]

    io.open(REF, 'w', encoding='utf-8', newline='\n').write(new_ref)
    io.open(MEM, 'w', encoding='utf-8', newline='\n').write(mem)
    print(f'✔ 迁入 ref/进度与留痕.md：{len(ref):,} → {len(new_ref):,} 字符（+{len(new_ref) - len(ref):,}）')
    print(f'✔ MEMORY.md 剪枝：10,391 → {len(mem):,} 字符')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
