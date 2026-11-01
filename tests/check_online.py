# -*- coding: utf-8 -*-
"""ABox 原型 · 部署后线上核验
用法: python tests/check_online.py [url]
"""
import sys, io, re, urllib.request

URL = sys.argv[1] if len(sys.argv) > 1 else "https://abox-prototype.app.workbuddy.host/"

EXPECT = ["v4.9.2", "今日这盒", "139.32", "45 份待取", "陈强（见习）", "王芳（金牌）",
          "平台代发", "应付结算明细", "个税已代扣"]
ABSENT = ["v4.9.0", "106.81", ">¥142.42<", "巡礼之年", "¥3.50", "label:'同意退款'",
          "分账明细", "分账状态"]
# 注：原型 P38 注释里仍有一处 "v4.9.1 改版"（历史说明），故 v4.9.1 不作 absent 断言。

try:
    req = urllib.request.Request(URL, headers={"User-Agent": "abox-check"})
    with urllib.request.urlopen(req, timeout=45) as r:
        html = r.read().decode("utf-8", "replace")
        status = r.status
except Exception as e:
    print("FETCH ERROR:", e)
    sys.exit(1)

print("URL    :", URL)
print("HTTP   :", status, " chars:", len(html))
ok = True
print("-- expect present --")
for k in EXPECT:
    n = html.count(k)
    flag = "OK " if n > 0 else "FAIL"
    if n == 0:
        ok = False
    print("  [%s] %-14s x%d" % (flag, k, n))
print("-- expect absent --")
for k in ABSENT:
    n = html.count(k)
    flag = "OK " if n == 0 else "FAIL"
    if n > 0:
        ok = False
    print("  [%s] %-14s x%d" % (flag, k, n))

print("RESULT :", "ALL PASS" if ok else "HAS FAILURES")
sys.exit(0 if ok else 2)
