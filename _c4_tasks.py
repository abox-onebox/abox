import json, urllib.request

API = "http://154.8.164.180:8080/api/v1"
TOK = open("_c1_tok.txt").read().strip()

req = urllib.request.Request(API + "/admin/schedule")
req.add_header("Authorization", "Bearer " + TOK)
with urllib.request.urlopen(req, timeout=25) as r:
    d = json.loads(r.read().decode("utf-8", "replace"))["data"]

tasks = d.get("list", [])
print("=== 已注册任务数 =", len(tasks), "===")
for t in tasks:
    lr = t.get("lastRun")
    ok = lr.get("ok") if isinstance(lr, dict) else None
    print(f"  {t.get('task'):<22} cron={t.get('cron'):<18} 实现={t.get('implemented')} lastRun={'None(未跑)' if lr is None else 'Ran ok=' + str(ok)}")
    print(f"      作用: {t.get('what','')[:60]}")
print()
issues = [t.get("task") for t in tasks if t.get("lastRun") is None]
print("=== lastRun 为空的任务 ===", issues if issues else "无（全部跑过）")
notimpl = [t.get("task") for t in tasks if not t.get("implemented")]
print("=== implemented=false 的任务 ===", notimpl if notimpl else "无")
