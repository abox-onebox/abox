# -*- coding: utf-8 -*-
"""四期留痕 + §四/§五 索引化：
   - 四期细目进 ref/进度与留痕.md
   - MEMORY.md §四（两端 UI）与 §五（AI 助手）压成「一句话 + 指针」，压回安全线
   纪律：先机械核对「要移出的判据串仍在 ref 分册」→ 再切块 → 断言命中/长度 → 通过才写盘。
   切块用**行范围/索引**（不嵌入带反引号的长旧串，避免手打错）。"""
import io
import os
import sys

ROOT = r'C:\Users\herma\WorkBuddy\ABox小程序'
MEM = os.path.join(ROOT, '.workbuddy', 'memory', 'MEMORY.md')
REF = os.path.join(ROOT, '.workbuddy', 'memory', 'ref', '进度与留痕.md')
REFD = os.path.join(ROOT, '.workbuddy', 'memory', 'ref', '设计替换.md')
NL = '\n'
SAFE = 8200

# ── 将自 MEMORY §四 移出的判据串：必须仍在 ref/设计替换.md（先取数，防静默丢失）──
MOVE4 = ['NARROW_MAX', 'use-narrow.ts', 'ab-nav-menu.vue', 'abi-16', 'icons:lock',
         'Tabler', 'newline="\\n"', 'verify-regen', 'ui-gate', '恒红与恒绿同罪',
         '6.21', '796C57', 'C9A876', '加强档', '--ok-fg', 'S8-6b', 'is-narrow',
         '145 处', '16 / 20 / 24', '14 / 28 / 34 / 40']

REF_ADD = NL + """---

## 附 · 四期「反哺」：文档体检器（2026-09-24）

**产物** `_tmp/kb/audit.py`（确定性 · 纯本地 · 不联网 · 不用模型 · `selftest` 四向自证）→
`out/audit.json`（喂页面）+ `out/audit.md`（人读报告 + 修订工单）→ 页面第四 tab「体检」
（源件 `audit.css`/`audit.js` + 原子补丁 `patch_v4.py`）→ 产物 `_ABox一盒知识助手v4.0.html`

**五个检测器**（全部「锚点 + 真源期望值」，不是裸扫）
- D1 口径总览：7 锚点（6 strict + 1 history）→ 严格 6 项**全部一致**；谱系 1 项（实体表数 23–27）
- D2 术语覆盖：45 个核心环节词 × 命中段数/文档数
- D3 引用完整性：`《文档名》` 可达性 + `SC-*` 卡号是否在《指引》里有定义
- D4 自述统计回验：文档自报「X …… N 次」回语料实算
- D5 多版本共存：同名不同版本同时在语料里（检索可能召回旧版）

**体检结果**：15 条工单（P1 0 / P2 14 / P3 1）
- ⭐ **P1 落空，是因为它已经被修掉了** —— D4 的战果：一期自检报告把「**不在 top3**」写成「**全库 0 次**」，
  而报告 §四 附录的原始日志里白纸黑字写着「语料实测：133 次」⇒ **报告与自己的证据互相矛盾**。
  实测真值：一饭四菜 **133 次 / 32 份**（PRD 内 1 次）· 提现审批 **218 次 / 20 份**（接口规范内 8 次）。
  已更正 **4 处**：`out/selfcheck.md` · `report.py` · `append_log.py` · `memory/2026-09-24.md`
- ⭐ **D2 真缺口**（经营管理域整体空白，实证了《系统地图》的判断）：**【团长激励 0 段】·【楼栋拓展 0 段】** ·
  转化率 1 段 · 用户增长 1 段 · 获客 3 段 · **索证索票 1 段**（餐饮采购法定动作）· **分拣 2 段** · 食安留样 3 段
- D3：断引 2（《手机测试指南.md》《开发基线冻结清单v1.0.md》）· 未定义卡号 1（**`SC-F-0711`** ——
  实录 B7 标题少了空格，实为 `SC-F-07` + 「11 态状态机」）
- D5：3 组多版本（后台页面稿 v1.0/v1.1 · 用户端页面稿 v1.0/v1.1 · 设计系统 v2.0/v2.1）
- D1 谱系：整篇只用旧表数的文档 —— 本地开发手册(24) · 项目目录结构(25) · MVP优化交接包(23/25) 等

**判据教训（四期最该记住的）**
- ⚠️ **过度报警与恒红同罪**：`实体表数` 锚点原本报出 **4 条 P1**，逐条看上下文后全是**合法历史叙述**
  （M1 阶段目标「24 张表建齐」· 冻结清单的文档快照「26 张表」· 里程碑「init 注释 24 张纠正为 25」）⇒
  该锚点改判 **history 模式**：只摊谱系 + 列出「整篇只用旧值的文档」，**由人判**。
  **一条判据宁可少报，也不能把「需要人判」伪装成「已经判了」。**
- ⚠️ **自证要四向**（三项必报 + 一项必不报）缺一不可；`anchorsBad` 若把谱系锚点算进去，基线条数就虚高
- ⚠️ **潜伏缺陷**：`scan.py` 的自指排除只认「知识检索/知识问答」，而产物已改名「知识助手」⇒
  **三期改名后排除就失效了**（只是当时没重跑扫描才没暴露）。已改**前缀族匹配**，重扫后语料 **sha256 未变**
- ⚠️ **页面建议问题会被覆盖**：calc.js 解压 1.25MB 比 audit.js（12KB）慢，会在稍后**覆盖** `#sug` 重绘
  ⇒ 症状 = 「加了建议却不显示，而数组里明明有」。对策 = 等 `DATA` 就绪后补一次重绘

**验收**：本地 **16/16** · 桩模型 **8/8** · **发布域名真实模型 13/13**
（体检问题原样引用体检条目、命中 8 项；回归：文档问题不误出取数卡 · 数值问题卡内 27 == 引擎真值）
"""

SEC4_NEW = """## 四、两端 UI 重塑（2026-09-19 起 · 已锁定 · 勿推翻）
> ⚠️ **全部细则（S1–S8 批次 · 对比度实测表 · 判据陷阱）→ `ref/设计替换.md`**；执行依据 = `_ABox一盒设计替换执行清单v1.0.md`（工作区根）
- **量级 = B 档「重塑」**（用户端 + 运营后台）· **顺序不可反**：设计方向确认 → 更新 Spec 与验收基线 → 落码（先改代码会让 `gate.mjs all verify` / e2e 基线 / 冻结清单全飘红）
- ⭐ **三项已裁定**：① 方向 = **A 守品牌补骨架 + 字体分层**（**砍掉换主色**）② 后台移动端 = **只做关键路径**、不做全站响应式 ③ 楷体**允许分层**（只留标题/品牌/金额大字，正文表单表格用无衬线系统栈）
- ⭐ **主色一律不动**（`#6E5435` on `#F6F0E5` = 6.21 达标）· **三处真缺陷**：次文字 `#9A8B72` 2.93→**`#796C57`**；金棕 `#C9A876` 1.98 ⇒ **退出文字位**；等级四色当文字全不达标 ⇒ **色块 + 文字标签** · 色调底文字另开**加强档**（`--*-fg`），**状态原色只用于图标与描边**
- ⭐ **图标 = 骨架核心**：自建 iconfont（**Tabler MIT**）**base64 内嵌 · 两端共用一套**；**两族档位**（功能三档 16/20/24 = 32/40/48rpx · 装饰四档 14/28/34/40 = 28/56/68/80rpx）**分别登记、混用即破锁** · 常驻门禁 **`icons:lock`**
- ⛔ **端上不能写 `<ab-icon>` 组件**（微信 `<text>` 只支持 text 嵌套 ⇒ 混排位图标被渲染层**静默丢弃**）—— 唯一写法 `<text class="abi abi-16">{{ I.chart }}</text>`
- ⭐ **S8 断点唯一真源** = `apps/admin-web/src/composables/use-narrow.ts` 的 `NARROW_MAX = 768`；**SCSS 一律不写 `@media`** 改挂 `.is-narrow`；菜单抽 `layouts/ab-nav-menu.vue` 共用
- ✅ **S1–S8 全部落码并验收 · 生成源已回填（S8-6b）** → 细目与重冻过程 ref《设计替换》
- ⚠️ **两条常驻教训**：① 生成器 `write_text` 显式 **`newline="\\n"`**（否则与手编 LF 只差行尾、`sha256` 永远对不上）；验收用 **`sha256` 不用 `diff`** ② **判据须按其「作用域」写** —— 跨作用域即**恒红**，而**恒红与恒绿同罪**；本工作区约定「**文档可用标注符号**」；⚠️ **`ui-gate.py`/`verify-regen.py` 不在 `gate.mjs` 内**（手工脚本，转红拦不住）"""

SEC5_NEW = """## 五、AI 内部助手（检索 + 问答 + 问数 + 体检）
> 细则 → 技能 `single-file-knowledge-search`（八=二期 · 九=三期 · **十=四期**）· 留痕 `2026-09-24.md` · 细目 ref《进度与留痕》四期附
- ⭐ 单文件自包含（工作区根）：一期检索 v1.0 · 二期问答 v2.0 · 三期助手 v3.0 · **四期《`_ABox一盒知识助手v4.0.html`》（1.71 MB · 问答/问数/体检/检索 四 tab）**；源码 `_app/abox-kb/index.html`
- **已上线应用** `ABox内部助手`（`wbapp_dFBh87mqVSTg0akdyqVy4d` · `https://abox-kb.app.workbuddy.host/`）· 两处产物 **sha256 必一致** · 管理走「设置—数据管理—应用」
- ⚠️ **问答必须从发布域名打开**（云服务 chat 按 **exact Origin** 放行；`models.list` 不校验）⇒ 本地只有**检索/问数/体检**可用，页面已自检明说，**别当故障去修**
- ⚠️ **改动后重新发布 = 须用户当轮明确要求**（`sites_deploy` 的 `userAskedToPublish`，**不跨轮继承**）
- ⚠️ **改产物 = 改源件再重生成**：`_tmp/kb/` → `scan.py` → **`build2.py` 唯一生成器** + 源件 `calc.*`/`audit.*` + 原子补丁 `patch_v3.py`/`patch_v4.py`
- ⭐ **三期=问数**：指标字典（口径真源）+ **确定性引擎** —— 数字**只由引擎算**，模型只把话翻成 `<<Q>>` 取数块（引擎算完回灌，它再写成中文）
- ⭐ **四期=反哺**：`audit.py` **文档体检器**（口径/覆盖/引用/自述/时效 五检测器 · 确定性 · 四向自证）⇒ 第四 tab「体检」+ 修订工单**进系统提示**（问「文档有哪些缺口」时**原样引用、不许推断**）
- ⚠️ **两条判据铁律**：① **提示词规则会互压** —— 加规则**必须同时排优先级**（铁律 2 曾压死「必须取数」）② **过度报警与恒红同罪**（见 §四）—— 宁可少报，也不把「需人判」伪装成「已判」
- ⚠️ **模型网关 504 ≠ 产品缺陷**（182s 中断、单卡重跑 11s 即全绿）⇒ 探针要能区分「回答为空」与「网关超时」"""


def main():
    mem = io.open(MEM, encoding='utf-8').read()
    ref = io.open(REF, encoding='utf-8').read()
    refd = io.open(REFD, encoding='utf-8').read()
    before = len(mem)

    # 幂等：已迁过就跳过
    if '四期=反哺' in mem and '知识助手v4.0' in mem:
        print('⚠ 已迁移过（幂等），跳过')
        return 0

    # ① 覆盖度前置核对：将移出 MEMORY §四 的判据串必须仍在 ref/设计替换.md
    miss = [k for k in MOVE4 if k not in refd]
    if miss:
        raise SystemExit('✗ ref/设计替换.md 未覆盖以下判据串，禁止剪枝：%r' % miss)
    print('✔ 覆盖度前置核对：%d 项判据串均在 ref/设计替换.md' % len(MOVE4))

    # ② 切块（用索引，不嵌入长旧串）
    i4 = mem.index('## 四、两端 UI 重塑')
    i5 = mem.index('## 五、AI 内部助手')
    old4, old5 = mem[i4:i5], mem[i5:]
    for tag, blk, head, must in [
            ('§四', old4, '## 四、两端 UI 重塑', ['ui-gate.py', 'S8 后台移动端', 'icons:lock']),
            ('§五', old5, '## 五、AI 内部助手', ['三期《`_ABox一盒知识助手v3.0.html`', '线上 = 三期', '三 tab'])]:
        if not blk.startswith(head):
            raise SystemExit('✗ %s 切块起点不符：%r' % (tag, blk[:30]))
        for m in must:
            if m not in blk:
                raise SystemExit('✗ %s 切块内缺标志串 %r（锚点漂移）' % (tag, m))
    if '## 四、' in old5 or '## 五、' in old4:
        raise SystemExit('✗ §四/§五 切块互相污染')

    mem2 = mem[:i4] + SEC4_NEW + NL + NL + SEC5_NEW + NL
    ref2 = ref.rstrip(NL) + NL + REF_ADD

    # ③ 复核：新节在、旧节消失
    for k, want in [('知识助手v4.0', 1), ('四期=反哺', 1), ('NARROW_MAX', 1), ('icons:lock', 1),
                    ('单文件自包含三版', 0), ('线上 = 三期', 0), ('三 tab', 0)]:
        c = mem2.count(k)
        if (c >= 1) != (want == 1):
            raise SystemExit('✗ MEMORY 复核失败：%r 命中 %d（期望 %d）' % (k, c, want))
    if '四期「反哺」：文档体检器' in ref:
        raise SystemExit('✗ ref 里已有四期附节（幂等保护）')
    if len(mem2) > SAFE:
        raise SystemExit('✗ MEMORY.md 剪枝后仍 %d 字符 > 安全线 %d' % (len(mem2), SAFE))

    # ④ 通过才写盘
    io.open(REF, 'w', encoding='utf-8', newline=NL).write(ref2)
    io.open(MEM, 'w', encoding='utf-8', newline=NL).write(mem2)

    # ⑤ 读盘双向复核
    rm = io.open(MEM, encoding='utf-8').read()
    rr = io.open(REF, encoding='utf-8').read()
    assert '知识助手v4.0' in rm and '四期=反哺' in rm
    assert '单文件自包含三版' not in rm and '线上 = 三期' not in rm
    assert '四期「反哺」：文档体检器' in rr and 'SC-F-0711' in rr and '索证索票 1 段' in rr
    print('✔ MEMORY.md %d → %d 字符（安全线 %d · 余量 %d）' % (before, len(rm), SAFE, SAFE - len(rm)))
    print('✔ ref/进度与留痕.md → %d 字符（含四期附节）' % len(rr))
    return 0


if __name__ == '__main__':
    sys.exit(main())
