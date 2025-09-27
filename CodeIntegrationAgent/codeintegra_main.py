import os
import sys
import json
from openai import OpenAI

# -------------------- 第 1 步：配置 API Key 和 Host --------------------
OPENAI_API_KEY = "sk-0svybfPYILSBihQDWi8ZpreKEXD2AnKw2CimMy0kouizTKOG"
OPENAI_HOST = "https://api.chatanywhere.tech"

# 初始化客户端
client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_HOST)

# -------------------- 获取课程信息（可选从命令行传入） --------------------
course_json = None
if len(sys.argv) > 1:
    try:
        course_json = json.loads(sys.argv[1])
    except json.JSONDecodeError:
        print("❌ 传入的课程 JSON 不合法，将只使用模块文件")

course_info_str = json.dumps(course_json, ensure_ascii=False, indent=2) if course_json else "无课程信息"

# -------------------- 第 2 步：读取三个模块文件 --------------------
base_dir = os.path.dirname(os.path.abspath(__file__))

# 读取 html组件
ui_file = os.path.join(base_dir, "../HTMLGeneratorAgent/html_components.jsx")
with open(ui_file, "r", encoding="utf-8") as f:
    html_code = f.read()

# 读取css组件
inter_file = os.path.join(base_dir, "../CSSGeneratorAgent/styles.css")
with open(inter_file, "r", encoding="utf-8") as f:
    css_code = f.read()

# 读取教学反馈组件
feedback_file = os.path.join(base_dir, "../JSGeneratorAgent/js_main.py")
with open(feedback_file, "r", encoding="utf-8") as f:
    js_code = f.read()

# -------------------- 第 3 步：构建整合 Prompt --------------------
prompt = f"""
你是“专业代码整合Agent”，任务是将以下三个模块整合为一个完整、可直接打开的 HTML 教学网页，
要求生成健壮、可直接运行的代码。

### 课程信息
{course_info_str}

### html内容
1. UI 设计组件：
{html_code}

2. css组件：
{css_code}

3. javascript组件：
{js_code}

### 生成要求
- 不要使用英文，除一些特定的数学字母符号外，请使用全中文，
- 输出完整 HTML 文件，包括 <html>, <head>, <body>
- JavaScript 必须可直接运行，支持模块间交互逻辑（可使用原生 JS 或 React + CDN）
- 如果使用 React，自动引入 React 和 ReactDOM CDN，并创建唯一挂载节点
- 所有 CSS 样式内嵌 <style> 中，保证页面布局与视觉效果正确
- 确保模块逻辑正确关联，事件触发、交互和反馈功能均可正常运行
- 变量、函数、ID 命名应避免冲突，保证模块独立性
- 输出内容严格仅包含最终 HTML 文件代码，不输出 JSX、JSON、解释或其他说明
"""

# -------------------- 第 4 步：调用智能体生成整合 HTML --------------------
response = client.chat.completions.create(
    model="gpt-5-ca",
    messages=[
        {"role": "system", "content": "你是代码整合Agent，一个专业 HTML 教学网页生成智能体"},
        {"role": "user", "content": prompt}
    ]
)

# -------------------- 第 5 步：获取生成的 HTML --------------------
integrated_html = response.choices[0].message.content

# -------------------- 第 6 步：保存整合后的 HTML --------------------
OUTPUT_FILE = os.path.join(base_dir, "integrated_app.html")
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    f.write(integrated_html)

print(f"✅ 完整教学网页 HTML 已生成并保存到 {OUTPUT_FILE}")
