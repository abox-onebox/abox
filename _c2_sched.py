import json, urllib.request, urllib.error

API = "http://154.8.164.180:8080/api/v1"
TOK = open("_c1_tok.txt").read().strip()

def call(method, path, token=None, body=None, timeout=25):
    req = urllib.request.Request(API + path, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    data = json.dumps(body).encode() if body else None
    try:
        with urllib.request.urlopen(req, data, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8", "replace") or "{}")
    except Exception as e:
        return -1, {"err": repr(e)[:200]}

print("=== 任务清单 GET /admin/schedule ===")
st, r = call("GET", "/admin/schedule", token=TOK)
print("HTTP", st, "code", r.get("code"), r.get("message", "")[:80])
d = r.get("data")
if d is None:
    print("  无 data，响应体：", json.dumps(r, ensure_ascii=False)[:400])
else:
    tasks = d if isinstance(d, list) else (d.get("items") or d.get("tasks") or [])
    print("  任务数 =", len(tasks))
    for t in tasks:
        if isinstance(t, dict):
            name = t.get("task") or t.get("name") or t.get("key")
            enable = t.get("enabled", t.get("enable"))
            cron = t.get("cron")
            last = t.get("lastRun") or t.get("lastResult") or {}
            desc = t.get("desc") or t.get("description") or ""
            print("   -", name, "| enabled=", enable, "| cron=", cron)
            if isinstance(last, dict):
                print("      最后:", {k: last.get(k) for k in ("startedAt", "finishedAt", "durationMs", "ok", "success", "error", "message") if k in last})
            elif last:
                print("      最后:", str(last)[:120])
            if desc:
                print("      desc:", str(desc)[:60])
