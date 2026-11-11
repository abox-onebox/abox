"""提审前：端上隐私接口 → 微信后台《用户隐私保护指引》必声明项 对照扫描器。

判据来源：微信官方文档《小程序用户隐私保护指引内容介绍》
https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/miniprogram-intro.md

自证（必报 / 必不报两种样本）：证明扫描器既不恒绿也不恒红，
且"0 命中"不会把探针自身的缺陷当成"没有隐私接口"。
"""
import os
import re
import sys

ROOT = r"C:/Users/herma/WorkBuddy/ABox小程序/abox-onebox/apps/miniprogram/src"

# 官方清单：正则 -> (指引中「处理的信息」标准项, 影响)
RULES = [
    (r"(setClipboardData|getClipboardData)", "读取你的剪切板", "未声明则 10 处复制全部失效"),
    (r"(chooseImage|chooseMedia|chooseVideo)", "收集你选中的照片或视频信息", "拍照/选图"),
    (r"chooseMessageFile", "收集你选中的文件", "选择聊天文件"),
    (r"(getLocation|getFuzzyLocation|startLocationUpdate)", "收集你的位置信息", "定位"),
    (r"(chooseLocation|choosePoi)", "收集你选择的位置信息", "选点"),
    (r"chooseAddress", "收集你的地址", "收货地址"),
    (r"(chooseInvoiceTitle|chooseInvoice)", "收集你的发票信息", "发票"),
    (r"getWeRunData", "收集你的微信运动步数", "运动"),
    (r"chooseLicensePlate", "收集你的车牌号", "车牌"),
    (r"(startRecord|joinVoIPChat)", "访问你的麦克风", "录音"),
    (r"(createVKSession|openCamera)", "访问你的摄像头", "摄像头"),
    (r"openBluetoothAdapter", "访问你的蓝牙", "蓝牙"),
    (r"(saveImageToPhotosAlbum|saveVideoToPhotosAlbum)", "使用你的相册（仅写入）权限", "写相册"),
    (r"addPhoneContact", "使用你的通讯录（仅写入）权限", "写通讯录"),
    (r"(addPhoneRepeatCalendar|addPhoneCalendar)", "使用你的日历（仅写入）权限", "写日历"),
    (r"startAccelerometer", "调用你的加速传感器", "传感器"),
    (r"startCompass", "调用你的磁场传感器", "传感器"),
    (r"startDeviceMotionListening", "调用你的方向传感器", "传感器"),
    (r"startGyroscope", "调用你的陀螺仪传感器", "传感器"),
]

# 组件形态（WXML / vue 模板）：chooseAvatar / nickname / getPhoneNumber 不是 API 调用
COMPONENT_RULES = [
    (r"open-type=[\"']chooseAvatar[\"']|chooseAvatar", "收集你的昵称、头像", "头像组件"),
    (r"type=[\"']nickname[\"']", "收集你的昵称、头像", "昵称输入框"),
    (r"open-type=[\"']getPhoneNumber[\"']|open-type=[\"']getRealtimePhoneNumber[\"']", "收集你的手机号", "手机号按钮"),
]

CALL = re.compile(r"\b(?:uni|wx)\.([A-Za-z][A-Za-z0-9_]*)")


def strip_comments(text):
    """去掉行注释与块注释，避免把文档里的 `uni.login` 当成真实调用。"""
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    lines = []
    for ln in text.splitlines():
        idx = ln.find("//")
        if idx >= 0:
            ln = ln[:idx]
        lines.append(ln)
    return "\n".join(lines)


def scan_text(text, source_label):
    """返回 {声明项: [(文件, 行号, 方法名)]}"""
    found = {}
    clean = strip_comments(text)
    for lineno, line in enumerate(clean.splitlines(), 1):
        for m in CALL.finditer(line):
            api = m.group(1)
            for pat, info_type, effect in RULES:
                if re.search(pat, api):
                    found.setdefault(info_type, {"effect": effect, "hits": []})
                    found[info_type]["hits"].append((source_label, lineno, api))
        for pat, info_type, effect in COMPONENT_RULES:
            if re.search(pat, line):
                found.setdefault(info_type, {"effect": effect, "hits": []})
                found[info_type]["hits"].append((source_label, lineno, "component"))
    return found


def selftest():
    """必报样本 + 必不报样本；任一不符即判检查器失效。"""
    fails = []
    must = """<script>\nuni.setClipboardData({ data: orderNo });\nwx.chooseMedia({ count: 1 });\n</script>\n<button open-type="getPhoneNumber">手机号</button>\n"""
    got = scan_text(must, "SELFEVENT")
    for expect in ["读取你的剪切板", "收集你选中的照片或视频信息", "收集你的手机号"]:
        if expect not in got:
            fails.append("必报样本漏报: " + expect)

    none = """<script>\nuni.showToast({ title: 'ok' });\nuni.login({});\nuni.requestPayment({});\nuni.makePhoneCall({ phoneNumber: '400' });\n</script>\n"""
    got2 = scan_text(none, "SELFEVENT_NONE")
    if got2:
        fails.append("必不报样本误报: " + repr(list(got2.keys())))

    comment = """// 文档示例：uni.setClipboardData({ data: 'x' }) 仅注释\n/* wx.chooseMedia() 注释块 */\n"""
    got3 = scan_text(comment, "SELFEVENT_COMMENT")
    if got3:
        fails.append("注释未剥离导致误报: " + repr(list(got3.keys())))

    print("=== 自证（检查器自身） ===")
    print("  必报样本检出:", sorted(got.keys()))
    print("  必不报样本:", sorted(got2.keys()) or "空（正确）")
    print("  纯注释样本:", sorted(got3.keys()) or "空（正确）")
    print("  自证结论:", "PASS" if not fails else "FAIL " + "; ".join(fails))
    return fails


def main():
    fails = selftest()
    print()
    files = []
    for dp, dn, fn in os.walk(ROOT):
        if "node_modules" in dp:
            continue
        for f in fn:
            if f.endswith((".ts", ".vue", ".js")):
                files.append(os.path.join(dp, f))
    print("=== 实扫 ===")
    print("  扫描文件数:", len(files))
    total = {}
    for p in files:
        try:
            s = open(p, encoding="utf-8", errors="ignore").read()
        except Exception:
            continue
        rel = os.path.relpath(p, ROOT).replace("\\", "/")
        for k, v in scan_text(s, rel).items():
            total.setdefault(k, {"effect": v["effect"], "hits": []})
            total[k]["hits"].extend(v["hits"])

    if not total:
        print("  !! 0 命中 —— 但自证已通过，说明确实没有隐私接口（不是探针坏）")
    for k in sorted(total):
        v = total[k]
        print("  [%s] %s 命中 %d 处" % (v["effect"], k, len(v["hits"])))
        for f, ln, api in v["hits"][:12]:
            print("      %s:%d  %s" % (f, ln, api))
        if len(v["hits"]) > 12:
            print("      ... 另 %d 处" % (len(v["hits"]) - 12))

    # 反向断言：真实源码里剪切板必须被检出，否则是探针对不上真实承载（恒绿）
    if total and "读取你的剪切板" not in total:
        print("  !! 警告：源码里有隐私接口却没检出剪切板，请复核承载形式")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
