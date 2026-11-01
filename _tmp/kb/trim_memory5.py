# -*- coding: utf-8 -*-
"""把 §五 整节压紧（保留全部「随时要用」的规则与指针，去掉复述）。
   整体替换而非逐行改，避免锚点漂移；写盘前断言「确实变短了」。"""
import io

MEM = r'C:\Users\herma\WorkBuddy\ABox小程序\.workbuddy\memory\MEMORY.md'
HEAD = '## 五、AI 内部助手（检索 + 问答 + 问数）'

NEW = '''## 五、AI 内部助手（检索 + 问答 + 问数）
- ⭐ 单文件自包含三版（工作区根）：一期《`_ABox一盒知识检索v1.0.html`》· 二期《`_ABox一盒知识问答v2.0.html`》·
  **三期《`_ABox一盒知识助手v3.0.html`》（1.68 MB · 问答/问数/检索 三 tab）**；源码 `_app/abox-kb/index.html`
- **已上线应用** `ABox内部助手`（`wbapp_dFBh87mqVSTg0akdyqVy4d` · `https://abox-kb.app.workbuddy.host/`）·
  与根目录那份**同一内容写两处（sha256 必一致）** · 管理走「设置—数据管理—应用」
- ⚠️ **问答必须从发布域名打开**（云服务 chat 按 **exact Origin** 放行；`models.list` 不校验）⇒ 本地只有**检索与问数**可用 ——
  页面已做来源自检并明说，**别当故障去修**
- ⚠️ **改动后重新发布 = 须用户当轮明确要求**（`sites_deploy` 的 `userAskedToPublish`；早先同意**不跨轮继承**）
- ⚠️ **改产物 = 改源件再重生成**。工程 `_tmp/kb/`：`scan.py` 扫描 → **`build2.py` 唯一生成器**；
  三期源件 **`calc.css`/`calc.js`**（生成器读入再拼，**别再往 Python 字面量里塞大段 JS**）；
  `patch_v3.py` 带命中数断言的原子补丁 · `snap.py` 只读快照 · `crosscheck.py` 独立 SQL 对拍（含 `selftest`）
- ⭐ **三期 = 问数**：指标字典（17 指标 · **口径唯一真源**）+ **确定性查询引擎** ——
  **数字只能由引擎算，模型一个加减乘除都不许做**（只把话翻成 `<<Q>>` 取数块，引擎算完回灌，它再写成中文）
- 细则见技能 `single-file-knowledge-search`（八节=二期 · **九节=三期**）· 留痕见 `2026-09-24.md`
'''

s = io.open(MEM, encoding='utf-8').read()
i = s.find(HEAD)
if i < 0:
    raise SystemExit('✗ 找不到 §五 标题')
old = s[i:]
if len(NEW) >= len(old):
    raise SystemExit(f'✗ 新版没变短（{len(old)} → {len(NEW)}），不写盘')
io.open(MEM, 'w', encoding='utf-8', newline='\n').write(s[:i] + NEW)
print(f'✔ §五 压缩：{len(old)} → {len(NEW)} 字符（省 {len(old) - len(NEW)}）')
print(f'✔ MEMORY.md 总字符：{len(s):,} → {len(s) - len(old) + len(NEW):,}')
