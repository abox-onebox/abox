import os
path = r'C:/Users/herma/WorkBuddy/ABox小程序/prototype/index.html'
size = os.path.getsize(path)
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

print(f'File size: {size:,} bytes ({size/1024:.1f} KB)')
print(f'Lines: {content.count(chr(10))}')

# JS 平衡
js_start = content.find('<script>')
js_end = content.rfind('</script>')
js = content[js_start+8:js_end]
braces = js.count('{') - js.count('}')
parens = js.count('(') - js.count(')')
brackets = js.count('[') - js.count(']')
backticks = js.count('`') % 2
print(f'JS Balance: Brace={braces}, Paren={parens}, Bracket={brackets}, Backtick={backticks}')
print('OK' if all(x == 0 for x in [braces, parens, brackets, backticks]) else 'FAIL')

# 关键修改检查
checks = [
    ('四方好味汇一盒', True, 'P1 文案润色'),
    ('每道菜都来自不同的供应商', False, '应删除旧文案'),
    ('主食', False, 'P1 主食应合并（不应有独立标签）'),
    ('来自：三味屋', True, 'P3 套餐明细新格式'),
    ('来自：集散中心', True, 'P5 套餐明细新格式'),
    ('选错团长', True, 'P7 取消原因'),
    ('介绍 1 名转正团长', True, 'P16 升级条件'),
    ('转正团长要求', True, 'P16 转正说明'),
    ('👑 我也想成为团长', True, 'P8 菜单可见'),
    ('客服微信号', True, 'P8 客服可见'),
    ('showContactWx', True, '客服微信号函数'),
    ('下单多份', True, 'P12 新文案'),
    ('一键提醒未下单同事', False, '应删除'),
    ('分发提醒', False, '应删除'),
    ('已系统处理', True, 'P14 第一段'),
    ('团长处理', True, 'P14 第二段'),
    ('已全额退', True, 'P14 团长处理段示例'),
    ('生成二维码海报', True, 'P19 海报名'),
    ('为什么用链接而不是微信号', False, '应删除推荐弹窗说明'),
    ('推荐流程', False, '应删除推荐流程说明'),
    ('备餐-集散-打包-送达由运营统一调度', False, '应删除运营说明'),
    ('goToOrderDetail', True, 'P13 订单详情弹窗'),
    ('¥28', False, '应全部替换'),
]
print('\n=== 关键修改检查 ===')
for t, should_exist, desc in checks:
    n = content.count(t)
    if should_exist:
        flag = '✓' if n > 0 else '✗ FAIL'
        print(f'  {flag} [{desc}] {t}: {n} 处')
    else:
        if n > 0:
            print(f'  ⚠️ [{desc}] {t}: 仍有 {n} 处')
        else:
            print(f'  ✓ [{desc}] {t}: 已删除')

print(f'\n价格残留: ¥28 = {content.count("¥28")} 处（应为 0）')
print(f'¥25.8 = {content.count("¥25.8")} 处')
print(f'¥25.80 = {content.count("¥25.80")} 处')
