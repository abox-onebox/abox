import json, urllib.request

API = "http://154.8.164.180:8080/api/v1"
TOK = open("_c1_tok.txt").read().strip()

req = urllib.request.Request(API + "/admin/schedule")
req.add_header("Authorization", "Bearer " + TOK)
with urllib.request.urlopen(req, timeout=25) as r:
    raw = r.read().decode("utf-8", "replace")

print("=== 原始响应（前 1500 字符） ===")
print(raw[:1500])
print()
print("=== 长度 ===", len(raw))
