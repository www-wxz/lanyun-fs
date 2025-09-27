import os
from openai import OpenAI

# -------------------- 第 1 步：配置 API Key 和 Host --------------------
OPENAI_API_KEY = "sk-0svybfPYILSBihQDWi8ZpreKEXD2AnKw2CimMy0kouizTKOG"   # 替换成你的真实 Key
OPENAI_HOST = "https://api.chatanywhere.tech"

client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_HOST)

# -------------------- 第 2 步：找到最新的 integrated_app.html --------------------
base_dir = os.path.dirname(os.path.abspath(__file__))
folder_path = os.path.join(base_dir, "../CodeIntegrationAgent")

html_files = [
    os.path.join(folder_path, f)
    for f in os.listdir(folder_path)
    if f.endswith(".html")
]

if not html_files:
    raise FileNotFoundError(f"❌ 未找到任何 HTML 文件，路径: {folder_path}")

latest_file = max(html_files, key=os.path.getmtime)
print(f"✅ 检测到最新的 HTML 文件: {latest_file}")

with open(latest_file, "r", encoding="utf-8") as f:
    html_content = f.read()

# -------------------- 第 3 步：构建 Prompt 给 TestAgent --------------------
prompt = f"""
你是一个专业的网页UI与布局美化的专家
请对以下 HTML 文件进行最小化的美化和优化
{html_content}
专注于：
1. 修复明显的语法错误（如缺失分号、标签未闭合）
2. 改善代码格式和缩进，增强可读性
3. 确保交互功能正常工作
4. 保持原有结构和功能不变

请不要做大规模重构或改变核心逻辑，只进行必要的美化和修复。


"""

#-------------------- 第 4 步：调用大模型生成修正代码 --------------------
response = client.chat.completions.create(
model="gpt-5", # 可以换成 gpt-5 或 gpt-4.1 提高准确度
messages=[
{"role": "system", "content": "你是一个专业的网页UI与布局美化的专家"},
{"role": "user", "content": prompt}
]
)

corrected_html = response.choices[0].message.content

#-------------------- 第 5 步：保存修正后的 HTML 文件 --------------------
output_file = os.path.join(base_dir, "corrected_app.html")
with open(output_file, "w", encoding="utf-8") as f:
    f.write(corrected_html)

print(f"✅ 已生成修正后的 HTML 文件: {output_file}")