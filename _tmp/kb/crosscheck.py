# -*- coding: utf-8 -*-
"""crosscheck.py —— 问数引擎的**独立对拍**。

为什么必须这么做：如果只有一份实现，它算错了没人知道 —— 页面会理直气壮地把错数印出来，
还配一张「等价 SQL」看起来特别可信。所以这里用**另一套独立手写的 SQL**算期望值，
跟页面里 JS 引擎的实测结果逐条比。

⚠️ 期望值**刻意不从 calc.js 的指标字典生成** —— 从字典生成只会得到「自己跟自己一致」。
   这里每个用例的 SQL 都是照着表结构手写的第二套实现。

用法：
    python crosscheck.py dump        # 写出 out/plans.json（给浏览器探针读）
    python crosscheck.py             # 读 out/actual.json，比对并出报告
    python crosscheck.py selftest    # 自证：故意改坏一个期望值，必须被抓出来
"""
import io
import json
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
ROOT = r'C:\Users\herma\WorkBuddy\ABox小程序'
DB = os.path.join(ROOT, 'abox-onebox', 'data', 'abox-dev.sqlite')

VALID = "status not in ('cancelled','refunded')"


def dl(col):
    """日期标签：与引擎的 labelOf 同语义（空 → （未填），否则取前 10 字符）"""
    return f"case when {col} is null or {col}='' then '（未填）' else substr({col},1,10) end"


def rl(col, alias, rc='name'):
    """外键标签：空 → （未填）；查不到 → #id；否则名字（与引擎同语义）"""
    return (f"case when {col} is null or {col}='' then '（未填）' "
            f"when {alias}.{rc} is null then '#'||{col} else {alias}.{rc} end")


CASES = [
    # ① 订单量：三种口径 + 时间轴
    dict(name='订单量·有效·全期', kind='one',
         plan=dict(metric='order_count', scope='有效'),
         sql=f"select count(*) from ab_order where {VALID}"),
    dict(name='订单量·全部', kind='one',
         plan=dict(metric='order_count', scope='全部'),
         sql="select count(*) from ab_order"),
    dict(name='订单量·有效·出餐日 09-18~09-24', kind='one',
         plan=dict(metric='order_count', scope='有效', timeField='d_meal',
                   **{'from': '2026-09-18', 'to': '2026-09-24'}),
         sql=f"select count(*) from ab_order where {VALID} "
             f"and substr(meal_date,1,10) between '2026-09-18' and '2026-09-24'"),
    dict(name='订单量·有效·按楼栋', kind='map',
         plan=dict(metric='order_count', scope='有效', groupBy=['o_building']),
         sql=f"select {rl('o.building_id','b')} k, count(*) v from ab_order o "
             f"left join ab_building b on b.id=o.building_id where o.{VALID} group by o.building_id"),
    dict(name='订单量·已完成', kind='one',
         plan=dict(metric='order_count', scope='已完成'),
         sql="select count(*) from ab_order where status='completed'"),
    dict(name='订单量·有效·按下单日(UTC)', kind='one',
         plan=dict(metric='order_count', scope='有效', timeField='d_create',
                   **{'from': '2026-09-20', 'to': '2026-09-20'}),
         sql=f"select count(*) from ab_order where {VALID} and substr(created_at,1,10)='2026-09-20'"),
    # ② 份数 / 金额 / 客单价
    dict(name='份数·有效·按楼群', kind='map',
         plan=dict(metric='order_qty', scope='有效', groupBy=['o_group']),
         sql=f"select {rl('o.building_group_id','g')} k, sum(o.quantity) v from ab_order o "
             f"left join ab_building_group g on g.id=o.building_group_id where o.{VALID} "
             f"group by o.building_group_id"),
    dict(name='实收金额·有效·按出餐日', kind='map',
         plan=dict(metric='revenue', scope='有效', groupBy=['d_meal']),
         sql=f"select {dl('meal_date')} k, sum(pay_amount) v from ab_order where {VALID} "
             f"group by substr(meal_date,1,10)"),
    dict(name='订单金额·履约中', kind='one',
         plan=dict(metric='gmv', scope='履约中'),
         sql="select sum(total_amount) from ab_order "
             "where status in ('cut_off','cooked','delivering','delivered')"),
    dict(name='客单价·有效', kind='one',
         plan=dict(metric='aov', scope='有效'),
         sql=f"select sum(pay_amount)*1.0/count(*) from ab_order where {VALID}"),
    dict(name='客单价·有效·按楼栋', kind='map',
         plan=dict(metric='aov', scope='有效', groupBy=['o_building']),
         sql=f"select {rl('o.building_id','b')} k, sum(o.pay_amount)*1.0/count(*) v from ab_order o "
             f"left join ab_building b on b.id=o.building_id where o.{VALID} group by o.building_id"),
    # ③ 佣金
    dict(name='佣金·已结算(含冲销)', kind='one',
         plan=dict(metric='commission', scope='已结算'),
         sql="select sum(amount) from ab_commission where status='settled'"),
    dict(name='佣金·已结算·按等级', kind='map',
         plan=dict(metric='commission', scope='已结算', groupBy=['c_level']),
         sql="select leader_level k, sum(amount) v from ab_commission where status='settled' "
             "group by leader_level"),
    dict(name='佣金·待结算', kind='one',
         plan=dict(metric='commission', scope='待结算'),
         sql="select sum(amount) from ab_commission where status='pending'"),
    # ④ 应付采购款
    dict(name='应付采购款·待付', kind='one',
         plan=dict(metric='payable', scope='待付'),
         sql="select sum(amount) from ab_supplier_share where status='pending'"),
    dict(name='应付采购款·全部·按供应商', kind='map',
         plan=dict(metric='payable', scope='全部', groupBy=['s_supplier']),
         sql=f"select {rl('s.payee_id','sp')} k, sum(s.amount) v from ab_supplier_share s "
             f"left join ab_supplier sp on sp.id=s.payee_id group by s.payee_id"),
    dict(name='应付采购款·全部·按分账日', kind='map',
         plan=dict(metric='payable', scope='全部', groupBy=['d_share']),
         sql=f"select {dl('share_date')} k, sum(amount) v from ab_supplier_share "
             f"group by substr(share_date,1,10)"),
    # ⑤ 余额 / 提现 / 退款
    dict(name='用户余额合计', kind='one', plan=dict(metric='balance', scope='全部'),
         sql="select sum(balance) from ab_balance"),
    dict(name='冻结余额合计', kind='one', plan=dict(metric='frozen', scope='全部'),
         sql="select sum(frozen) from ab_balance"),
    dict(name='提现·已到账', kind='one', plan=dict(metric='withdraw', scope='已到账'),
         sql="select sum(amount) from ab_withdraw where status='success'"),
    dict(name='提现·全部·按状态', kind='map',
         plan=dict(metric='withdraw', scope='全部', groupBy=['w_status']),
         sql="select status k, sum(amount) v from ab_withdraw group by status"),
    dict(name='退款金额·已退款', kind='one',
         plan=dict(metric='refund_amount', scope='已退款'),
         sql="select sum(amount) from ab_refund where status='refunded'"),
    # ⑥ 备餐 / 配送 / 开团
    dict(name='实际出餐份数·按供应商', kind='map',
         plan=dict(metric='dish_actual', scope='全部', groupBy=['h_supplier']),
         sql=f"select {rl('d.supplier_id','sp0')} k, sum(actual_quantity) v from ab_supplier_dish_daily d "
             f"left join ab_supplier sp0 on sp0.id=d.supplier_id group by d.supplier_id"),
    dict(name='计划备餐份数·按生产日', kind='map',
         plan=dict(metric='dish_plan', scope='全部', groupBy=['d_produce']),
         sql=f"select {dl('produce_date')} k, sum(plan_quantity) v from ab_supplier_dish_daily "
             f"group by substr(produce_date,1,10)"),
    dict(name='配送趟次', kind='one', plan=dict(metric='trip_count', scope='全部'),
         sql="select count(*) from ab_delivery_record"),
    dict(name='配送份数·按状态', kind='map',
         plan=dict(metric='trip_qty', scope='全部', groupBy=['v_status']),
         sql="select status k, sum(total_quantity) v from ab_delivery_record group by status"),
    dict(name='成团售出份数·按楼群', kind='map',
         plan=dict(metric='sold_seats', scope='全部', groupBy=['m_group']),
         sql=f"select {rl('a.building_group_id','g2')} k, sum(a.sold_count) v from ab_meal_assignment a "
             f"left join ab_building_group g2 on g2.id=a.building_group_id group by a.building_group_id"),
    # ⑦ 毛利（跨表，按出餐日对齐）
    dict(name='平台毛利·全期·按出餐日', kind='map',
         plan=dict(metric='gross_profit', groupBy=['d_meal']),
         sql="""
with r as (select substr(meal_date,1,10) d, sum(pay_amount) v from ab_order
            where status not in ('cancelled','refunded') group by 1),
     c as (select substr(meal_date,1,10) d, sum(amount) v from ab_supplier_share group by 1),
     m as (select substr(meal_date,1,10) d, sum(amount) v from ab_commission
            where status='settled' group by 1)
select k, rev-coalesce(cost,0)-coalesce(cm,0) from (
  select coalesce(r.d,c.d,m.d) k,
         coalesce(r.v,0) rev, c.v cost, m.v cm
    from r left join c on c.d=r.d left join m on m.d=r.d
  union
  select coalesce(c.d,m.d), coalesce(r.v,0), c.v, m.v
    from c left join m on m.d=c.d left join r on r.d=c.d where r.d is null
  union
  select m.d, coalesce(r.v,0), c.v, m.v
    from m left join c on c.d=m.d left join r on r.d=m.d where r.d is null and c.d is null
) order by k"""),
    # ⑧ 负控：区间极窄 → 必须 0 命中
    dict(name='负控·订单量·1999 年（必为 0）', kind='one',
         plan=dict(metric='order_count', scope='有效', timeField='d_meal',
                   **{'from': '1999-01-01', 'to': '1999-01-02'}),
         sql=f"select count(*) from ab_order where {VALID} "
             f"and substr(meal_date,1,10) between '1999-01-01' and '1999-01-02'"),
    # ⑨ 负控：不该算成的
    dict(name='负控·余额按日期筛（应拒绝）', kind='fail',
         plan=dict(metric='balance', **{'from': '2026-09-01', 'to': '2026-09-30'}), sql=None),
    dict(name='负控·不存在的指标（应拒绝）', kind='fail',
         plan=dict(metric='user_repurchase_rate'), sql=None),
    dict(name='负控·取数块非 JSON（应拒绝）', kind='fail',
         plan={'__parse_error': '不是 json'}, sql=None),
]


def expected_of(case):
    if case['kind'] == 'fail':
        return None
    conn = sqlite3.connect(DB)
    rows = list(conn.execute(case['sql']))
    conn.close()
    if case['kind'] == 'one':
        v = rows[0][0] if rows else None
        return float(v or 0)
    out = {}
    for k, v in rows:
        out[str(k)] = float(v or 0)
    return out


def cmp_val(a, b, tol=1e-6):
    if a is None or b is None:
        return False
    return abs(a - b) <= tol * max(1.0, abs(a), abs(b))


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'cmp'
    if mode == 'dump':
        io.open(os.path.join(OUT, 'plans.json'), 'w', encoding='utf-8', newline='\n').write(
            json.dumps([{'name': c['name'], 'plan': c['plan']} for c in CASES],
                       ensure_ascii=False, indent=1))
        print(f'✔ 已写出 {len(CASES)} 条用例 → out/plans.json')
        return 0

    ap = os.path.join(OUT, 'actual.json')
    if not os.path.exists(ap):
        print('✗ 还没有 out/actual.json —— 先跑浏览器探针')
        return 2
    actual = {a['name']: a for a in json.load(io.open(ap, encoding='utf-8'))}

    exp = {c['name']: expected_of(c) for c in CASES}
    if mode == 'selftest':
        # 自证：故意把一条期望值改坏，比对器**必须**报出来
        k = '订单量·有效·全期'
        exp[k] = exp[k] + 7
        print(f'（自证）已把「{k}」的期望值人为改成 {exp[k]} —— 若比对器没报错，说明它是个摆设')

    lines = ['# 问数引擎 · 独立对拍报告', '']
    lines.append(f'- 用例 {len(CASES)} 条；期望值由**另一套手写 SQL**算出（不是从指标字典生成）')
    lines.append(f'- 实测来自 `out/actual.json`（真浏览器里跑 `runQuery`）')
    lines.append('')
    lines.append('| # | 用例 | 判定 | 期望 | 实得 | 说明 |')
    lines.append('|---|---|---|---|---|---|')

    bad = miss = 0
    for i, c in enumerate(CASES, 1):
        nm = c['name']
        a = actual.get(nm)
        if a is None:
            miss += 1
            lines.append(f'| {i} | {nm} | ⚠ 缺 | — | — | 探针没返回这条 |')
            continue
        if c['kind'] == 'fail':
            ok = (a.get('ok') is False)
            detail = a.get('err', '')
            lines.append(f'| {i} | {nm} | {"✅ 按预期拒绝" if ok else "❌ 竟然算成了"} | 拒绝 | '
                         f'{"ok" if a.get("ok") is False else "!!"} | {detail} |')
            if not ok:
                bad += 1
            continue
        if not a.get('ok'):
            bad += 1
            lines.append(f'| {i} | {nm} | ❌ 引擎报错 | — | — | {a.get("err","")} |')
            continue
        e = exp[nm]
        if c['kind'] == 'one':
            got = a.get('total')
            ok = cmp_val(got, e)
            lines.append(f'| {i} | {nm} | {"✅" if ok else "❌"} | {e:.6g} | '
                         f'{(got if got is not None else float("nan")):.6g} | 命中 {a.get("matched")} 行 |')
            if not ok:
                bad += 1
        else:
            got = {r['label']: r['value'] for r in a.get('rows', [])}
            keys = set(e) | set(got)
            diffs = [k for k in keys if not cmp_val(got.get(k), e.get(k))]
            ok = not diffs
            lines.append(f'| {i} | {nm} | {"✅" if ok else "❌"} | {len(e)} 组 | {len(got)} 组 | '
                         + ('全部一致' if ok else '不一致：'
                            + '；'.join(f'{k} 期望 {e.get(k)} 实得 {got.get(k)}' for k in sorted(diffs)[:3])) + ' |')
            if not ok:
                bad += 1

    lines.append('')
    lines.append(f'**结论：{len(CASES) - bad - miss} / {len(CASES)} 通过**'
                 + (f'（{bad} 条不符，{miss} 条缺失）' if (bad or miss) else '（含负控）'))
    rep = os.path.join(OUT, 'crosscheck-selftest.md' if mode == 'selftest' else 'crosscheck.md')
    io.open(rep, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines) + '\n')
    print('\n'.join(lines))
    print(f'\n报告 → {rep}')
    return 1 if (bad or miss) else 0


if __name__ == '__main__':
    raise SystemExit(main())
