import sys
import re

msg = sys.stdin.read()

# Translations for specific English messages (first line)
translations = {
    "style: apply industrial utilitarian design to inventory manager": "样式: 为库存管理应用工业实用设计",
    "style: apply editorial soft ui to meal viewer": "样式: 为订餐查看器应用柔和杂志风设计",
    "style: apply swiss design to other finance calculators": "样式: 为其他金融计算器应用瑞士设计",
    "chore: remove obsolete server PID file from state directory": "杂项: 从状态目录移除废弃的服务器 PID 文件",
    "docs: add design spec and implementation plan": "文档: 添加设计规范和实现计划",
    "style: apply editorial soft ui to travel checklist": "样式: 为出行清单应用柔和杂志风设计",
    "style: apply dark neon design to rehab trainer": "样式: 为康复训练器应用暗黑霓虹设计",
    "style: apply swiss design to finance calculators": "样式: 为金融计算器应用瑞士设计",
    "style: apply monochrome glassmorphism to home page": "样式: 为主页应用单色拟态玻璃设计",
    "feat: add base css variables and reset styles": "功能: 添加基础 CSS 变量和重置样式",
    "Initial commit": "初始提交"
}

lines = msg.split('\n')
if lines:
    first_line = lines[0].strip()
    if first_line in translations:
        lines[0] = translations[first_line]
    elif first_line == "1":
        lines[0] = "更新代码"

msg = '\n'.join(lines)

# Replace prefixes for any remaining conventional commits
prefixes = {
    r'^feat:\s*': '功能: ',
    r'^fix:\s*': '修复: ',
    r'^chore:\s*': '杂项: ',
    r'^style:\s*': '样式: ',
    r'^docs:\s*': '文档: ',
    r'^refactor:\s*': '重构: ',
    r'^test:\s*': '测试: ',
    r'^perf:\s*': '性能: '
}

for pattern, replacement in prefixes.items():
    msg = re.sub(pattern, replacement, msg, flags=re.MULTILINE)

print(msg, end="")
