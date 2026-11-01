# -*- coding: utf-8 -*-
"""文档体检器（四期「反哺」核心）

确定性 · 纯本地 · 不联网 · 不用 LLM。
输入  out/corpus.json（一期扫描产物）
输出  out/audit.json（给页面的结构化结果） + out/audit.md（人读报告 + 修订工单）

五个检测器
  D1 口径总览    —— 锚点（真源期望值已知）× 全库取值 × 出处，按「是否落在当前真源文档」分级
  D2 术语覆盖    —— 核心环节词 × 命中段数/文档数，找出「核心里环节文档几乎没写」
  D3 引用完整性  —— ① 《...md/html》 断引  ② SC-* 卡号引用了但没定义
  D4 自述统计回验 —— 文档自己写「X …… N 次」，回语料实算，不符即报
  D5 多版本共存  —— 同名不同版本的文档同时在语料里（检索可能召回旧版）

为什么要「锚点 + 期望值」而不是「自动找冲突」：
  裸扫数值在中文技术文档里恒红（「见习→正式 23%」是进度、「金牌 11%」是测试故意改的）。
  恒红与恒绿同罪 —— 都等于没有检查。所以每个锚点必须自带真源期望值，且必须能自证。

自证  python audit.py selftest   （人为构造必报样本 + 原库必不报，双向都要过）
"""
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
CORPUS = os.path.join(OUT, 'corpus.json')
NL = '\n'

# ══════════════════════════════════════════════════════════════════════════
# 当前真源文档清单（人工维护 · 短 · 可见）
#   判据：这份文档里的数字/口径就是「当前值」，与它不符 = 高优先修订项。
#   不在清单里的文档归「其他」，其中不符的归「中优先（多为历史/过程文档）」。
#   ⚠️ 清单里的名字必须真实存在 —— 脚本开局会断言（防拼错导致静默降级）。
# ══════════════════════════════════════════════════════════════════════════
CURATED = [
    'ABox一盒数据库ER设计v2.1.md',
    'ABox一盒接口规范v1.0.md',
    'ABox一盒开发基线冻结清单v1.0.md',
    'ABox一盒开发里程碑计划v1.0.md',
    'ABox一盒项目目录结构v2.0.md',
    'ABox一盒本地开发手册v1.0.md',
    'ABox一盒订单状态机与全链路流转v1.0.md',
    'ABox一盒自营结算口径定义v1.0.md',
    'ABox一盒种子数据清单v1.0.md',
    'ABox一盒部署运维手册v1.0.md',
]

# ══════════════════════════════════════════════════════════════════════════
# D1 锚点表
#   expect 取值 = 项目《业务口径》真源（见 .workbuddy/memory/MEMORY.md 一、）
#   note 里写清「本锚点已知的合法非期望值」，避免把测试故意值当缺陷报出去
#
#   mode='strict'  单值口径：非期望值 = 真异常，按「是否落在当前真源文档」出 P1/P2 工单
#   mode='history' 谱系口径：文档里合法存在历史取值（冻结快照 / 阶段目标 / 「纠正为」叙述）
#                  ⇒ **检测器无法机械区分「合法历史叙述」与「未更新的残留」，所以不假装能判**。
#                  只输出取值谱系 +「只用旧值的文档」清单，出 P3 供人判。
#                  （过度报警会毁掉整份报告的信噪比 —— 这是本器唯一放行 P3 的一个锚点）
# ══════════════════════════════════════════════════════════════════════════
ANCHORS = [
    dict(id='rate_combo', name='四级佣金费率组合', grp=1, mode='strict',
         pat=r'(8)\s*[/、]\s*9\s*[/、]\s*10\s*[/、]\s*12',
         expect=['8'], why='见习/正式/金牌/首席 = 8/9/10/12%',
         note='整串校验，只抓规范写法；「金牌 11%」是测试故意改的验证值，不属本锚点'),
    dict(id='tier_count', name='团长等级档数', grp=1, mode='strict',
         pat=r'(\d)\s*级(?:阶梯|费率|体系)',
         expect=['4'], why='trainee / formal / gold / chief 四档',
         note=''),
    dict(id='order_states', name='订单状态数', grp=1, mode='strict',
         pat=r'订单\s*(\d{1,2})\s*态',
         expect=['11'], why='订单 11 态状态机',
         note='「只走这七个态」说的是缺陷流转、不是订单态 —— 已用紧邻写法排除'),
    dict(id='eta', name='送达时点', grp=1, mode='strict',
         pat=r'(11:30)',
         expect=['11:30'], why='次日 11:30 送达',
         note=''),
    dict(id='cutoff', name='截单时点', grp=1, mode='strict',
         pat=r'(24:00)',
         expect=['24:00'], why='T-1 24:00 截单',
         note=''),
    dict(id='dish_per_meal', name='一饭几菜', grp=1, mode='strict',
         pat=r'(?:一饭|一盒)([一二三四五六七八九])菜',
         expect=['四'], why='一饭四菜（1 主食 + 4 道菜）',
         note=''),
    dict(id='table_count', name='实体表数', grp=1, mode='history',
         pat=r'(\d{2})\s*张(?:数据)?表',
         expect=['27'], why='实体 27 张表（ALL_ENTITIES）',
         note='23/24/25/26 在语料里全是**合法历史叙述**：M1 阶段目标「24 张表建齐」、'
              '冻结清单的文档快照「数据模型 · 26 张表」、里程碑「init 头注释 24 张表纠正为实际 25 张」'
              '⇒ 本锚点转 history 模式（只出谱系，不逐值报警）'),
]

# ══════════════════════════════════════════════════════════════════════════
# D2 术语覆盖 —— 按链路分组，找「核心里环节文档几乎没写」
#   阈值是约定：段数 ≤ 3 = ⚠️ 缺口候选；0 = ❌ 术语不存在
# ══════════════════════════════════════════════════════════════════════════
TERMS = [
    ('履约链', ['截单', '报量', '出餐确认', '分拣', '配送', '分发', '取餐', '送达', '集散中心']),
    ('资金链', ['支付', '佣金', '结算', '提现', '退款', '对账', '发票', '冲销', '应付']),
    ('供给',   ['供应商', '菜品', '套餐', '报价', '成本', '产能', '半成品']),
    ('食安合规', ['食安留样', '留样', '索证索票', '健康证', '食品经营许可证', '备案', '资质']),
    ('经营管理', ['招募', '复购', '裂变', '获客', '转化率', '用户增长', '团长激励', '楼栋拓展']),
    ('系统',   ['迁移', '门禁', '种子数据', '操作日志', '通知模板']),
]

GAP_LOW = 3      # 段数 ≤ 此值 ⇒ 缺口候选
GAP_WATCH = 8    # 段数 ≤ 此值 ⇒ 关注

# ══════════════════════════════════════════════════════════════════════════
# D4 附加回验清单 —— 语料之外、但「自述统计」值得回算的报告类文件
# ══════════════════════════════════════════════════════════════════════════
CLAIM_FILES = [
    os.path.join(OUT, 'selfcheck.md'),
    os.path.join(OUT, 'crosscheck.md'),
    os.path.join(OUT, 'scan-report.md'),
]

CLAIM_PAT = re.compile(
    r'[「『](.{2,26}?)[」』][^。\n|]{0,26}?(?:全库|语料|实测)[^。\n|]{0,14}?(\d+)\s*次')

# D4 的战果留证：本检测器**建成前**就已修掉的同型缺陷（只作说明，不再计入工单）
CLAIM_FIXED = [
    dict(what='一期自检报告 §一「判据演进」表',
         said='「一饭四菜」我期望《PRD》，实测全库 **0 次**；「提现审批」期望《接口规范》，也是 **0 次**',
         actual='一饭四菜 全库 133 次 / 32 份（PRD 内 1 次）· 提现审批 全库 218 次 / 20 份（接口规范内 8 次）',
         why='把「**不在 top3**」这个观察写成了「**全库不存在**」这个结论 —— 而报告的 §四 附录原始日志里',
         why2='就白纸黑字写着「语料实测：133 次」，**报告与自己的证据互相矛盾**。',
         spread='扩散到 4 处：`out/selfcheck.md` · `report.py` · `append_log.py` · `memory/2026-09-24.md`（已逐处更正）'),
]


def read(p):
    return io.open(p, encoding='utf-8', errors='replace').read()


def clip(t, i, j, w=110):
    """取匹配点周围的上下文，压成一行。"""
    return t[max(0, i - w):j + w].replace(NL, ' ').replace('|', '｜').strip()


def load_corpus():
    docs = json.load(io.open(CORPUS, encoding='utf-8'))['docs']
    segs = [(d['name'], d['grade'], s['line'], s['text'])
            for d in docs for s in d['sections']]
    return docs, segs


# ────────────────────────── D1 ──────────────────────────
def d1_anchors(docs, segs):
    cur = set(CURATED)
    out = []
    for a in ANCHORS:
        rx = re.compile(a['pat'])
        vals, docvals, docgrade = {}, {}, {}
        for name, grade, line, text in segs:
            for m in rx.finditer(text):
                v = m.group(a['grp'])
                e = vals.setdefault(v, {'v': v, 'n': 0, 'samples': []})
                e['n'] += 1
                e['_cur'] = e.get('_cur') or (name in cur)
                docvals.setdefault(name, set()).add(v)
                docgrade[name] = grade
                if len(e['samples']) < 4:
                    e['samples'].append({
                        'doc': name, 'grade': grade, 'cur': name in cur, 'line': line,
                        'ctx': clip(text, m.start(), m.end())})
        vs = sorted(vals.values(), key=lambda x: -x['n'])
        exp = set(a['expect'])
        for e in vs:
            e['expected'] = e['v'] in exp
            e['docs'] = sum(1 for n, s in docvals.items() if e['v'] in s)
        bad = [e for e in vs if not e['expected']]
        # history 模式：只用旧值、从不出现期望值的文档 —— 这些文档的口径「整篇已旧」
        stale_only = []
        if a['mode'] == 'history':
            for n, s in docvals.items():
                old = s - exp
                if old and not (s & exp):
                    stale_only.append({'doc': n, 'grade': docgrade[n], 'cur': n in cur,
                                       'vals': sorted(old)})
            stale_only.sort(key=lambda x: (not x['cur'], x['doc']))
        if not bad:
            verdict = 'ok'
        elif a['mode'] == 'history':
            verdict = 'history'
        else:
            verdict = 'high' if any(e.get('_cur') for e in bad) else 'mid'
        out.append({
            'id': a['id'], 'name': a['name'], 'why': a['why'], 'expect': a['expect'],
            'mode': a['mode'], 'note': a['note'], 'verdict': verdict,
            'nMiss': len(bad), 'values': vs, 'staleOnly': stale_only,
        })
    return out


# ────────────────────────── D2 ──────────────────────────
def d2_terms(docs, segs):
    out = []
    for domain, terms in TERMS:
        for t in terms:
            n = segs_hit = 0
            ds = set()
            for name, grade, line, text in segs:
                k = text.count(t)
                if k:
                    n += k
                    segs_hit += 1
                    ds.add(name)
            out.append({
                'domain': domain, 'term': t, 'hits': n,
                'segs': segs_hit, 'docs': len(ds), 'docNames': sorted(ds)[:5],
                'level': 'zero' if segs_hit == 0 else ('low' if segs_hit <= GAP_LOW
                                                       else ('watch' if segs_hit <= GAP_WATCH else 'ok')),
            })
    return out


# ────────────────────────── D3 ──────────────────────────
def d3_refs(docs, segs):
    names = set(d['name'] for d in docs)
    # ① 文档名断引
    broken = {}
    for name, grade, line, text in segs:
        for m in re.finditer(r'《([^》]{2,64})》', text):
            r = m.group(1).strip()
            if not (r.endswith('.md') or r.endswith('.html')):
                continue
            if r in names:
                continue
            e = broken.setdefault(r, {'ref': r, 'n': 0, 'where': []})
            e['n'] += 1
            if len(e['where']) < 4:
                e['where'].append({'doc': name, 'grade': grade, 'line': line,
                                   'ctx': clip(text, m.start(), m.end())})
    # ② SC-* 卡号：定义真源 = 指引
    guide = [n for n in names if '指引' in n]
    defs = set()
    used = {}
    for name, grade, line, text in segs:
        for m in re.finditer(r'SC-[A-Z]+-\d+', text):
            c = m.group(0)
            if name in guide and re.search(re.escape(c) + r'(?!\d)', text):
                defs.add(c)
            e = used.setdefault(c, {'code': c, 'n': 0, 'where': []})
            e['n'] += 1
            if len(e['where']) < 3:
                e['where'].append({'doc': name, 'grade': grade, 'line': line,
                                   'ctx': clip(text, m.start(), m.end(), 80)})
    undef = sorted(c for c in used if c not in defs)
    return {'brokenDocs': sorted(broken.values(), key=lambda x: -x['n']),
            'undefCodes': [dict(used[c], guide=guide) for c in undef],
            'nDef': len(defs), 'nUsed': len(used)}


# ────────────────────────── D4 ──────────────────────────
def term_stat(segs, term):
    n = segs_hit = 0
    for _, _, _, text in segs:
        k = text.count(term)
        if k:
            n += k
            segs_hit += 1
    return n, segs_hit


def d4_claims(segs, texts=None):
    """texts 形如 [(label, 全文)]；不给则取 CLAIM_FILES。selftest 靠它注入必报样本。"""
    src = texts if texts is not None else \
        [(os.path.basename(p), read(p)) for p in CLAIM_FILES if os.path.exists(p)]
    out = []
    for label, s in src:
        for m in CLAIM_PAT.finditer(s):
            term = m.group(1).strip('*` 　')
            said = int(m.group(2))
            if len(term) < 2 or ('.' in term and ' ' in term):
                continue
            actual, sgs = term_stat(segs, term)
            if said == 0 and actual == 0:
                continue   # 「自称 0 / 实测 0」没有信息量 ⇒ 不报
                # ⚠️ 若放行，它会变成一条**恒绿**条目（永远 ✅）—— 恒绿等于没有检查
            out.append({
                'file': label, 'term': term, 'said': said,
                'actual': actual, 'segs': sgs, 'ok': actual == said,
                'ctx': clip(s, m.start(), m.end(), 70),
            })
    return out


# ────────────────────────── D5 ──────────────────────────
def d5_versions(docs):
    fam = {}
    for d in docs:
        base = re.sub(r'v\d+\.\d+', 'v*', d['name'])
        fam.setdefault(base, []).append(d['name'])
    return [{'base': k, 'docs': sorted(v), 'n': len(v)}
            for k, v in sorted(fam.items()) if len(v) > 1]


# ────────────────────────── 汇总 ──────────────────────────
def build():
    docs, segs = load_corpus()
    names = set(d['name'] for d in docs)
    miss = [c for c in CURATED if c not in names]
    if miss:
        raise SystemExit('✗ 当前真源清单里的文档在语料里找不到（会静默降级，必须先修）：%s' % miss)

    anchors = d1_anchors(docs, segs)
    terms = d2_terms(docs, segs)
    refs = d3_refs(docs, segs)
    claims = d4_claims(segs)
    versions = d5_versions(docs)

    # ── 修订工单
    t = []
    for a in anchors:
        if a['mode'] == 'strict':
            for e in a['values']:
                if e['expected']:
                    continue
                s0 = e['samples'][0]
                t.append(dict(sev='P1' if a['verdict'] == 'high' else 'P2',
                              area='口径', title='%s：出现「%s」，真源为 %s'
                              % (a['name'], e['v'], '/'.join(a['expect'])),
                              where='%s:%d' % (s0['doc'], s0['line']),
                              detail='%d 处，例如 %s' % (e['n'], s0['ctx'][:150])))
        elif a['staleOnly']:
            stale_docs = [x['doc'] for x in a['staleOnly']]
            t.append(dict(sev='P3', area='口径',
                          title='%s：口径谱系 %s（当前值 %s）—— 有 %d 份文档整篇只用旧值'
                                % (a['name'], '/'.join(v['v'] for v in a['values']),
                                   '/'.join(a['expect']), len(stale_docs)),
                          where='、'.join(d[:34] for d in stale_docs[:3]) + ('…' if len(stale_docs) > 3 else ''),
                          detail='⚠️ 检测器不判对错（历史叙述与未更新残留无法机械区分）—— 请人工确认这些文档是否需标注「已过期」：'
                                 + ' | '.join('%s(%s)' % (x['doc'], ','.join(x['vals'])) for x in a['staleOnly'][:6])))
    for b in refs['brokenDocs']:
        w0 = b['where'][0]
        t.append(dict(sev='P2', area='引用', title='断引：《%s》这份文档不在语料里' % b['ref'],
                      where='%s:%d' % (w0['doc'], w0['line']),
                      detail='%d 处引用，例如 %s' % (b['n'], w0['ctx'][:150])))
    for c in refs['undefCodes']:
        w0 = c['where'][0]
        t.append(dict(sev='P2', area='引用', title='卡号 %s 被引用但《指引》里没有定义' % c['code'],
                      where='%s:%d' % (w0['doc'], w0['line']),
                      detail='%d 处引用，例如 %s' % (c['n'], w0['ctx'][:150])))
    for c in claims:
        if c['ok']:
            continue
        t.append(dict(sev='P1', area='自述', title='%s：「%s」自述 %d 次，实测 %d 次'
                      % (c['file'], c['term'], c['said'], c['actual']),
                      where=c['file'], detail=c['ctx'][:150]))
    for v in versions:
        t.append(dict(sev='P2', area='时效', title='同一文档族 %d 个版本同时在语料里（检索可能召回旧版）' % v['n'],
                      where=v['base'], detail=' | '.join(v['docs'])))
    for x in terms:
        if x['level'] == 'zero':
            t.append(dict(sev='P2', area='覆盖', title='「%s」在 81 份文档里 0 次命中' % x['term'],
                          where='（全库）', detail='域：%s —— 要么术语不存在（文档用了别的说法），要么这件事没写' % x['domain']))
        elif x['level'] == 'low':
            t.append(dict(sev='P2', area='覆盖', title='「%s」仅 %d 段命中' % (x['term'], x['segs']),
                          where='、'.join(x['docNames'][:2]), detail='域：%s' % x['domain']))

    order = {'P1': 0, 'P2': 1, 'P3': 2}
    t.sort(key=lambda x: (order[x['sev']], x['area']))

    meta = {
        'builtAt': None,   # 由 build 时填（见 main）
        'docs': len(docs),
        'chars': sum(d['chars'] for d in docs),
        'segs': len(segs),
        'curated': len(CURATED),
        'counts': {
            'anchors': len(anchors),
            # ⚠️ 只数 strict —— 谱系锚点天然「有多值」，算进来会让基线条数虚高（自证会立刻发现）
            'anchorsBad': sum(1 for a in anchors
                              if a['mode'] == 'strict' and a['verdict'] != 'ok'),
            'anchorsStrict': sum(1 for a in anchors if a['mode'] == 'strict'),
            'anchorsHistory': sum(1 for a in anchors if a['mode'] == 'history'),
            'historyStale': sum(1 for a in anchors if a['mode'] == 'history' and a['staleOnly']),
            'termsZero': sum(1 for x in terms if x['level'] == 'zero'),
            'termsLow': sum(1 for x in terms if x['level'] == 'low'),
            'brokenDocs': len(refs['brokenDocs']),
            'undefCodes': len(refs['undefCodes']),
            'claimsBad': sum(1 for c in claims if not c['ok']),
            'versionFams': len(versions),
            'tickets': len(t),
            'p1': sum(1 for x in t if x['sev'] == 'P1'),
            'p2': sum(1 for x in t if x['sev'] == 'P2'),
            'p3': sum(1 for x in t if x['sev'] == 'P3'),
        },
    }
    return dict(meta=meta, anchors=anchors, terms=terms, refs=refs,
                claims=claims, claimFixed=CLAIM_FIXED,
                versions=versions, tickets=t)


def main():
    import datetime
    r = build()
    r['meta']['builtAt'] = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    os.makedirs(OUT, exist_ok=True)
    io.open(os.path.join(OUT, 'audit.json'), 'w', encoding='utf-8', newline='\n').write(
        json.dumps(r, ensure_ascii=False, separators=(',', ':')))
    io.open(os.path.join(OUT, 'audit.md'), 'w', encoding='utf-8', newline='\n').write(md_report(r))
    c = r['meta']['counts']
    print('体检完成 · 语料 %d 份 / %s 段' % (r['meta']['docs'], format(r['meta']['segs'], ',')))
    print('  D1 口径锚点 %d 个：严格 %d（不符 %d）· 谱系 %d（%d 个含历史取值）'
          % (c['anchors'], c['anchorsStrict'], c['anchorsBad'],
             c['anchorsHistory'], c['historyStale']))
    print('  D2 术语 %d 个，0 命中 %d · 稀薄 %d' % (len(r['terms']), c['termsZero'], c['termsLow']))
    print('  D3 断引 %d 处 · 未定义卡号 %d 个' % (c['brokenDocs'], c['undefCodes']))
    print('  D4 自述统计待验 %d 条，不符 %d 条' % (len(r['claims']), c['claimsBad']))
    print('  D5 多版本族 %d 组' % c['versionFams'])
    print('  修订工单 %d 条（P1 %d / P2 %d / P3 %d）' % (c['tickets'], c['p1'], c['p2'], c['p3']))
    print('  → out/audit.json %.1f KB · out/audit.md %.1f KB'
          % (os.path.getsize(os.path.join(OUT, 'audit.json')) / 1024,
             os.path.getsize(os.path.join(OUT, 'audit.md')) / 1024))
    return 0


def md_report(r):
    m = r['meta']
    c = m['counts']
    L = ['# 文档体检报告（四期「反哺」）', '',
         '**体检时点** %s · **语料** %d 份文档 · %s 字符 · %s 段' % (
             m['builtAt'], m['docs'], format(m['chars'], ','), format(m['segs'], ',')),
         '**性质** 确定性计算（纯本地 · 不联网 · 不用模型）· 每条都可点回原文核对',
         '',
         '## 〇、一句话结论', '',
         '体检 **%d 项**，其中 **P1 %d** · P2 %d · P3 %d。' % (c['tickets'], c['p1'], c['p2'], c['p3']),
         '',
         '| 检测器 | 查什么 | 结果 |', '|---|---|---|',
         '| D1 口径 | 锚点取值 vs 真源 | 严格 %d 个，**不符 %d** · 谱系 %d 个（%d 个含历史取值） |'
         % (c['anchorsStrict'], c['anchorsBad'], c['anchorsHistory'], c['historyStale']),
         '| D2 覆盖 | 核心环节词覆盖率 | 0 命中 **%d** · 稀薄 %d |' % (c['termsZero'], c['termsLow']),
         '| D3 引用 | 文档名断引 / 卡号未定义 | 断引 %d · 未定义卡号 %d |' % (c['brokenDocs'], c['undefCodes']),
         '| D4 自述 | 文档自报的统计回算 | 不符 **%d** |' % c['claimsBad'],
         '| D5 时效 | 多版本共存 | %d 组 |' % c['versionFams'],
         '',
         '---', '',
         '## 一、D1 口径总览', '',
         '> 每个锚点带**真源期望值**。分两种模式：',
         '> · **strict**（单值口径）：不符的取值按「是否出现在**当前真源文档**里」分级 ——',
         '>   落在真源文档里 = **P1**，只落在其他文档 = P2。',
         '> · **history**（谱系口径）：文档里合法存在历史取值（冻结快照 / 阶段目标 / 「纠正为」叙述），',
         '>   **检测器无法机械区分「合法历史叙述」与「未更新的残留」，所以不假装能判** ——',
         '>   只把谱系与「整篇只用旧值的文档」摊开，出 P3 供人判。', '']
    for a in r['anchors']:
        flag = {'ok': '✅ 一致', 'mid': '🟡 有不符（仅在非真源文档）',
                'high': '🔴 有不符（真源文档内）',
                'history': '📜 口径谱系（检测器不判对错，供人工确认）'}[a['verdict']]
        L += ['### %s · %s — %s' % (a['id'], a['name'], flag),
              '- 真源：**%s**（%s）' % ('/'.join(a['expect']), a['why'])]
        if a['note']:
            L.append('- 已知合法非期望值：%s' % a['note'])
        L += ['', '| 取值 | 次数 | 文档数 | 是否真源 | 出处（前 4 处） |', '|---|---:|---:|---|---|']
        for v in a['values']:
            w = '；'.join('%s:%d' % (s['doc'][:26], s['line']) for s in v['samples'])
            L.append('| `%s` %s | %d | %d | %s | %s |' % (
                v['v'], '✅' if v['expected'] else '⚠️', v['n'], v.get('docs', 0),
                '是' if v.get('_cur') else '否', w))
        if a['staleOnly']:
            L += ['', '**整篇只用旧值的文档**（这些文档的口径已整体落后）：', '']
            for x in a['staleOnly']:
                L.append('- %s %s —— 取值 %s' % (
                    '🔴真源' if x['cur'] else '　　', x['doc'], '/'.join(x['vals'])))
        L.append('')
    L += ['---', '', '## 二、D2 术语覆盖', '',
          '> 阈值是约定：段数 ≤ %d = ⚠️ 缺口候选 · 0 = ❌ 术语不存在。' % GAP_LOW,
          '> 「0 命中」有两种可能：**术语不存在**（文档用了别的说法）或**这件事真的没写**。', '',
          '| 域 | 术语 | 命中次数 | 段数 | 文档数 | 判 |', '|---|---|---:|---:|---:|---|']
    for x in sorted(r['terms'], key=lambda x: (x['segs'], x['domain'])):
        mark = {'zero': '❌ 0 命中', 'low': '⚠️ 稀薄', 'watch': '关注', 'ok': '✓'}[x['level']]
        L.append('| %s | %s | %d | %d | %d | %s |' % (
            x['domain'], x['term'], x['hits'], x['segs'], x['docs'], mark))
    L += ['', '---', '', '## 三、D3 引用完整性', '']
    if r['refs']['brokenDocs']:
        L += ['**断引**（引用的文档名在语料里找不到）', '',
              '| 引用 | 次数 | 出处 |', '|---|---:|---|']
        for b in r['refs']['brokenDocs']:
            L.append('| 《%s》 | %d | %s |' % (
                b['ref'], b['n'], '；'.join('%s:%d' % (w['doc'][:30], w['line']) for w in b['where'][:2])))
        L.append('')
    else:
        L += ['**断引** 无 ✅', '']
    if r['refs']['undefCodes']:
        L += ['**被引用但《%s》里没有定义**' % '指引', '',
              '| 卡号 | 次数 | 出处 |', '|---|---:|---|']
        for x in r['refs']['undefCodes']:
            L.append('| `%s` | %d | %s |' % (
                x['code'], x['n'], '；'.join('%s:%d' % (w['doc'][:30], w['line']) for w in x['where'][:2])))
        L.append('')
    L += ['---', '', '## 四、D4 自述统计回验', '',
          '> 语料里没有「自报统计」的写法（0 条）；本节价值在**报告类文件**上 ——',
          '> 一期自检报告曾把「不在 top3」写成「全库 0 次」，正是本检测器能直接抓到的形态。', '',
          '| 文件 | 词 | 自述 | 实测 | 判 |', '|---|---|---:|---:|---|']
    for cl in r['claims']:
        L.append('| %s | %s | %d | %d | %s |' % (
            cl['file'], cl['term'], cl['said'], cl['actual'], '✅' if cl['ok'] else '⚠️ 不符'))
    L += ['', '### 战果留证（本器建成前已修掉的一条 P1）', '']
    for f in r.get('claimFixed', []):
        L += ['- **%s**' % f['what'],
              '  - 原文：%s' % f['said'],
              '  - 实测：%s' % f['actual'],
              '  - 病因：%s%s' % (f['why'], f['why2']),
              '  - %s' % f['spread']]
    L += ['', '---', '', '## 五、D5 多版本共存', '',
          '> 同名不同版本同时在语料里 ⇒ 检索/问答**可能召回旧版**（一期已实测过一次：问「楼群」被页面稿顶掉）。', '',
          '| 文档族 | 版本 |', '|---|---|']
    for v in r['versions']:
        L.append('| `%s` | %s |' % (v['base'], '<br>'.join(v['docs'])))
    L += ['', '---', '', '## 六、修订工单（按优先级）', '',
          '| 级 | 域 | 事项 | 出处 |', '|---|---|---|---|']
    for x in r['tickets']:
        L.append('| **%s** | %s | %s | %s |' % (x['sev'], x['area'], x['title'], x['where']))
    L += ['', '---', '',
          '## 七、这个检测器怎么自证', '',
          '`python audit.py selftest` —— 三项必报 + 一项必不报，缺一不可：', '',
          '1. **必不报**：原库不带任何注入跑 → 严格口径锚点**必须全部一致**（证明检测器不是恒红）；',
          '2. **必报**：把某锚点的期望值改错 → 该锚点必须转 `high/mid`；',
          '3. **必报**：注入一条假断引 + 一个假卡号 → D3 必须双双抓到；',
          '4. **必报**：把一期报告里被修掉的那句错断言（「实测全库 0 次」）喂回 D4 → 必须抓到。', '',
          '> ⚠️ 这正是四期最该记住的一条：**恒红与恒绿同罪**。',
          '> 裸扫数值的检测器在中文技术文档里必然恒红（「见习→正式 23%」是进度、「金牌 11%」是测试故意值），',
          '> 那种检测器等于没有检查 —— 所以本器一律「锚点 + 真源期望值」，并配**双向**自证。',
          '>',
          '> 同理，**过度报警**会毁掉信噪比：`实体表数` 锚点原本报出 4 条 P1，逐条看上下文后',
          '> 全是合法历史叙述（M1 阶段目标「24 张表建齐」、冻结清单的文档快照「26 张表」）',
          '> ⇒ 该锚点已改判为 **history 模式**：只摊谱系、由人判，不逐值报警。',
          '> **一条判据宁可少报，也不能把「需要人判」伪装成「已经判了」。**', '']
    return NL.join(L)


# ══════════════════════════════════════════════════════════════════════════
# 自证：必报 / 必不报
# ══════════════════════════════════════════════════════════════════════════
def selftest():
    ok = True

    print('=== 自证 1/4：原库基线（必不报）===')
    base = build()
    c0 = base['meta']['counts']
    print('  基线：锚点不符 %d · 断引 %d · 未定义卡号 %d · 工单 %d'
          % (c0['anchorsBad'], c0['brokenDocs'], c0['undefCodes'], c0['tickets']))
    if c0['anchorsBad'] != 0:
        ok = False
        print('  ✗ 意外：基线里就有严格口径不符（要么真有问题，要么锚点写错了 —— 先查清再继续）')

    print('=== 自证 2/4：把「订单 11 态」的期望值改成 99（必报）===')
    global ANCHORS
    keep = ANCHORS
    ANCHORS = [dict(a, expect=['99']) if a['id'] == 'order_states' else a for a in ANCHORS]
    b2 = build()
    a = next(x for x in b2['anchors'] if x['id'] == 'order_states')
    ok2 = a['verdict'] != 'ok' and a['nMiss'] == 1
    ok = ok and ok2
    print('  order_states 判定 = %s（期望 ≠ ok）· 不符取值 %d 个（期望 1）· %s'
          % (a['verdict'], a['nMiss'], '✔' if ok2 else '✗'))
    ANCHORS = keep

    print('=== 自证 3/4：拼一条假断引 + 一条假卡号（必报）===')
    docs, segs = load_corpus()
    segs2 = list(segs) + [('（自证注入）', 'A', 1,
                           '参见《不存在的文档v9.9.md》第 3 节；另见 SC-Z-99。')]
    r3 = d3_refs(docs, segs2)
    hit_doc = any(b['ref'] == '不存在的文档v9.9.md' for b in r3['brokenDocs'])
    hit_code = any(x['code'] == 'SC-Z-99' for x in r3['undefCodes'])
    ok3 = hit_doc and hit_code
    ok = ok and ok3
    print('  D3 抓到注入断引 = %s · 抓到注入未定义卡号 = %s（均期望 True）· %s'
          % (hit_doc, hit_code, '✔' if ok3 else '✗'))

    print('=== 自证 4/4：喂回被修掉的那句错断言（必报）===')
    docs, segs = load_corpus()
    hist = [('（自证注入 · 一期原文）',
             '「一饭四菜」我期望《PRD》，实测全库 **0 次**；「提现审批」期望《接口规范》，也是 **0 次**。')]
    c4 = d4_claims(segs, texts=hist)
    got = [(x['term'], x['said'], x['actual']) for x in c4]
    ok4 = any(x['said'] == 0 and x['actual'] > 0 for x in c4)
    ok = ok and ok4
    print('  D4 抓到 = %s（期望含 said=0/actual>0 的条目）' % (got or '（无）'))
    print('  %s' % ('✔' if ok4 else '✗ 检测器抓不到自己当年写错的那种形态'))

    print()
    print('自证结论：%s' % ('✔ 四向通过（既能报、又不恒红）' if ok else '✗ 未通过 —— 检测器本身有问题'))
    return 0 if ok else 1


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'selftest':
        sys.exit(selftest())
    sys.exit(main())
