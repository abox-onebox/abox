# -*- coding: utf-8 -*-
"""snap.py —— 「问数」用的**只读数仓快照**抽取器。

它做什么：把开发库（abox-dev.sqlite）里**问数需要的事实表与维度表**抽成一份 JSON，
给页面内嵌。页面上的查询引擎就吃这份快照，**不连库、不发请求**。

为什么是快照而不是连库：
  · 单文件页无服务端，发布后够不到本机 SQLite；且发布页若真能写库，那是另一类风险。
  · 快照带**库指纹（sha256）+ 抽取时间 + 行数**，任何一份数字都能回指到「哪一版库」。
    （这正是「可核对」的地基：数字不是页面自己说的，是这份快照算出来的。）

⚠️ 三条纪律：
  ① **只读**：只 select，不写库（与 dbq.py 同款红线）。
  ② **不在这里做口径**：快照只搬原样行；口径（有效订单怎么算、佣金算不算冲销）全部在
     页面侧的指标字典里声明 —— 一处定义。这里若也过滤一遍，就出现「两份口径」。
  ③ 时间列一律**原样搬字符串**（库里是 UTC 文本；页面按日期前缀切片，不做时区换算）。

用法：python snap.py          → out/metrics.json
"""
import io
import os
import json
import time
import hashlib
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
ROOT = r'C:\Users\herma\WorkBuddy\ABox小程序'
DB = os.path.join(ROOT, 'abox-onebox', 'data', 'abox-dev.sqlite')

# 别名 -> (真表名, 要搬的列)
SPEC = [
    ('order', 'ab_order', [
        'id', 'order_no', 'user_id', 'team_leader_id', 'building_id', 'building_group_id',
        'set_meal_id', 'assignment_id', 'meal_date', 'quantity', 'unit_price',
        'total_amount', 'balance_used', 'discount_amount', 'pay_amount', 'status',
        'paid_at', 'completed_at', 'cancelled_at', 'created_at']),
    ('commission', 'ab_commission', [
        'id', 'order_id', 'order_no', 'team_leader_id', 'leader_level', 'rate',
        'base_amount', 'quantity', 'amount', 'type', 'status', 'settled_at',
        'meal_date', 'payout_channel', 'created_at']),
    ('share', 'ab_supplier_share', [
        'id', 'share_no', 'share_date', 'meal_date', 'payee_type', 'payee_id', 'dish_id',
        'quantity', 'unit_price', 'amount', 'type', 'status', 'settled_at', 'paid_at',
        'created_at']),
    ('balance', 'ab_balance', [
        'id', 'user_id', 'balance', 'frozen', 'total_in', 'total_out', 'updated_at']),
    ('withdraw', 'ab_withdraw', [
        'id', 'withdraw_no', 'leader_id', 'user_id', 'amount', 'tax_withheld_amount',
        'actual_amount', 'status', 'audit_at', 'paid_at', 'created_at']),
    ('refund', 'ab_refund', [
        'id', 'refund_no', 'order_id', 'order_no', 'user_id', 'team_leader_id', 'amount',
        'reason_type', 'status', 'reversed', 'refunded_at', 'created_at']),
    ('delivery', 'ab_delivery_record', [
        'id', 'meal_date', 'building_group_id', 'expected_at', 'actual_at', 'driver_name',
        'total_quantity', 'status']),
    ('dish_daily', 'ab_supplier_dish_daily', [
        'id', 'supplier_id', 'dish_id', 'produce_date', 'plan_quantity', 'actual_quantity',
        'unit_price', 'status']),
    ('assignment', 'ab_meal_assignment', [
        'id', 'meal_date', 'building_group_id', 'set_meal_id', 'distribution_center_id',
        'status', 'sold_count']),
    # ---- 维度 ----
    ('building', 'ab_building', ['id', 'name', 'building_group_id', 'status']),
    ('group', 'ab_building_group', ['id', 'name', 'status']),
    ('leader', 'ab_team_leader', [
        'id', 'user_id', 'real_name', 'level', 'status', 'commission_rate', 'building_id',
        'total_orders', 'total_amount', 'total_commission', 'withdrawn_amount',
        'pending_amount']),
    ('supplier', 'ab_supplier', ['id', 'name', 'type', 'status', 'payee_type']),
    ('dish', 'ab_dish', ['id', 'supplier_id', 'name', 'category', 'cost_price']),
    ('user', 'ab_user', ['id', 'nickname', 'building_id', 'team_leader_id', 'status']),
    ('set_meal', 'ab_set_meal', ['id', 'name', 'price', 'cost_price', 'status']),
    ('config', 'ab_config', ['config_key', 'config_value', 'description', 'updated_at']),
]

NOTE = ('这是**开发库**快照（含演示种子与人工测试产生的数据），不是生产数据；'
        '金额单位为元、权重为原样行，口径由页面侧指标字典声明。')


def sha256_file(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    t0 = time.time()
    if not os.path.exists(DB):
        print(f'✗ 找不到开发库：{DB}')
        return 2
    if not os.path.exists(OUT):
        os.makedirs(OUT, exist_ok=True)
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    tables, rows_cnt, missing = {}, {}, []
    for alias, tbl, cols in SPEC:
        have = {r[1] for r in conn.execute(f'pragma table_info("{tbl}")')}
        bad = [c for c in cols if c not in have]
        if bad:                       # 表/列对不上要**看得见**，不许静默少搬
            missing.append(f'{tbl}: {", ".join(bad)}')
            continue
        sql = 'select %s from "%s"' % (', '.join('"%s"' % c for c in cols), tbl)
        data = []
        for r in conn.execute(sql):
            d = {}
            for k in r.keys():
                v = r[k]
                if v is None:
                    d[k] = None
                elif isinstance(v, bytes):
                    d[k] = v.decode('utf-8', 'replace')
                elif isinstance(v, (int, float)):
                    d[k] = v
                else:
                    d[k] = str(v)
            data.append(d)
        tables[alias] = data
        rows_cnt[alias] = len(data)
    conn.close()

    meta = {
        'snapshotAt': time.strftime('%Y-%m-%d %H:%M:%S'),
        'dbFile': os.path.relpath(DB, ROOT).replace('\\', '/'),
        'dbSha256': sha256_file(DB)[:16],
        'dbMtime': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(os.path.getmtime(DB))),
        'rows': rows_cnt,
        'note': NOTE,
    }
    payload = {'meta': meta, 't': tables}
    txt = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    with io.open(os.path.join(OUT, 'metrics.json'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(txt)

    print(f'✔ 快照已写入 out/metrics.json  {len(txt):,} 字节')
    print(f'  库 {meta["dbFile"]} · sha256:{meta["dbSha256"]} · mtime {meta["dbMtime"]}')
    for alias, _, _ in SPEC:
        print(f'    {alias:<12} {rows_cnt.get(alias, 0):>5} 行')
    if missing:
        print('  ⚠ 列名对不上的表（已跳过，需核对）：')
        for m in missing:
            print('    -', m)
    print(f'  耗时 {time.time() - t0:.2f}s')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
