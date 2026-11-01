import json, urllib.request, urllib.error, uuid

MP = "http://154.8.164.180:8081/api/v1"

def call(method, path, token=None, body=None, idem=None, timeout=20):
    req = urllib.request.Request(MP + path, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    if idem:
        req.add_header("Idempotency-Key", idem)
    data = json.dumps(body).encode() if body else None
    try:
        with urllib.request.urlopen(req, data, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8", "replace") or "{}")
    except Exception as e:
        return -1, {"err": repr(e)[:160]}

print("=== 1. 健康检查 ===")
st, r = call("GET", "/health")
print("   HTTP", st, "code", r.get("code"), r.get("message", "")[:50])

print("=== 2. 团长登录 (devCode) ===")
st, lr = call("POST", "/auth/login", body={"code": "dev:1001"})
UTOK = None
if lr.get("code") == 0:
    UTOK = lr["data"].get("accessToken") or lr["data"].get("token")
    print("   登录 OK, userId =", (lr.get("data", {}).get("user") or {}).get("id"))
else:
    print("   登录失败:", lr.get("code"), lr.get("message"))

print("=== 3. 明日套餐 home/daily ===")
st, dr = call("GET", "/home/daily", token=UTOK)
if dr.get("code") == 0:
    d = dr["data"]
    print("   可下单日期 =", d.get("mealDate"), "| canOrder =", d.get("canOrder"))
    items = d.get("items") or d.get("setMeals") or []
    print("   商品数 =", len(items))
    img = None
    for it in items:
        for k, v in it.items():
            if isinstance(v, str) and v.startswith("http") and ("png" in v or "jpg" in v):
                img = v
                break
        if img:
            break
    print("   样例图片 =", str(img)[:90])
else:
    print("   失败:", dr.get("code"), dr.get("message"))

print("=== 4. 团长/用户余额与佣金（是否被新任务逻辑改坏） ===")
for p in ["/leader/balance", "/leader/commission"]:
    st, rr = call("GET", p, token=UTOK)
    print(f"   {p}: HTTP {st} code={rr.get('code')} msg={rr.get('message','')[:40]}")
    if rr.get("code") == 0 and isinstance(rr.get("data"), dict):
        dd = rr["data"]
        print("      ", {k: dd.get(k) for k in list(dd.keys())[:6]})

print("=== 5. 订单列表 ===")
st, orr = call("GET", "/orders", token=UTOK)
print("   HTTP", st, "code", orr.get("code"), "| msg", orr.get("message", "")[:40])
if orr.get("code") == 0:
    lst = orr["data"]
    lst = lst.get("list", lst) if isinstance(lst, dict) else lst
    print("   订单数 =", len(lst) if isinstance(lst, list) else "非列表")
