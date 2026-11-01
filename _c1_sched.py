import json, urllib.request, urllib.error

API = "http://154.8.164.180:8080/api/v1"

def call(method, path, token=None, body=None, timeout=20):
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

print("=== 登录 ===")
for u, p in [("admin", "n7f4catBhjjbB6iXuQ6a")]:
    st, r = call("POST", "/auth/admin-login", body={"username": u, "password": p})
    print("  ", u, "->", st, r.get("code"), r.get("message", "")[:60])
    if r.get("code") == 0 and isinstance(r.get("data"), dict):
        tok = r["data"].get("accessToken") or r["data"].get("token")
        if tok:
            print("   role =", r["data"].get("user", {}).get("role"), "| menus =", r["data"].get("user", {}).get("menus"))
            open("_c1_tok.txt", "w").write(tok)
            print("   TOKEN 已存")
        else:
            print("   !! 无 token 字段，data keys =", list(r.get("data", {}).keys()))
    else:
        print("   !! 登录失败，停止（避免触发锁定）")
