import os
import sys
import json
from openai import OpenAI

# -------------------- 第 1 步：配置 API Key 和 Host --------------------
OPENAI_API_KEY = "sk-0svybfPYILSBihQDWi8ZpreKEXD2AnKw2CimMy0kouizTKOG"  # 替换成你的真实 Key
OPENAI_HOST = "https://api.chatanywhere.tech"

client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_HOST)

# -------------------- 第 2 步：获取课程信息（可选从命令行传入） --------------------
course_json = None
if len(sys.argv) > 1:
    try:
        course_json = json.loads(sys.argv[1])
    except json.JSONDecodeError:
        print("❌ 传入的课程 JSON 不合法，将只使用最新 PRD 文件")

# -------------------- 第 3 步：自动找到最新的 PlanerAgent 输出文件 --------------------
base_dir = os.path.dirname(os.path.abspath(__file__))
folder_path = os.path.join(base_dir, "../PlanerAgent/prd_output")

json_files = [os.path.join(folder_path, f) for f in os.listdir(folder_path) if f.endswith(".json")]
if not json_files:
    raise FileNotFoundError(f"❌ 未找到任何 PRD 输出文件，路径: {folder_path}")

latest_file = max(json_files, key=os.path.getmtime)
print(f"✅ 检测到最新的 PRD 文件: {latest_file}")

with open(latest_file, "r", encoding="utf-8") as f:
    data = json.load(f)

html_structure = data.get("html_structure")
teaching_content = data.get("teaching_content")
if not html_structure:
    raise ValueError("❌ PRD 文件中未找到 'html_structure' 部分")
if not teaching_content:
    raise ValueError("❌ PRD 文件中未找到 'teaching_content' 部分")

# 可选：保存成单独文件，方便调试
with open("html_structure.json", "w", encoding="utf-8") as f:
    json.dump({"html_structure": html_structure, "teaching_content": teaching_content}, f, ensure_ascii=False, indent=2)
print("✅ html_structure 和 teaching_content 已保存到 html_structure.json")

# -------------------- 第 4 步：构建 Prompt 给 HTML 智能体 --------------------
course_info_str = json.dumps(course_json, ensure_ascii=False, indent=2) if course_json else "无课程信息"

prompt = f"""
你是前端开发智能体 HTMLGeneratorAgent，请根据以下 JSON 数据生成 **React 组件代码**：

### 课程信息
{course_info_str}

### HTML 结构规划
{json.dumps(html_structure, ensure_ascii=False, indent=2)}

### 输出要求
1. 使用 React 组件化生成页面布局：
   - 顶部标题栏 <HeaderNav />
   - 中间动画画布 <MainCanvasArea />（用于后续挂载动画交互逻辑）
   - 左/右工具栏 <ToolBar />（控件按钮：播放、暂停、重置、下一步、显示角度）
   - 底部提示区域 <HintPanel />（显示教师提示或任务说明）
2. 保持 id/class 与规划一致，便于 CSS/JS 后续挂载
3. 不要生成 CSS 或 JS 逻辑
4. 代码要可扩展、清晰、便于后续整合
"""

# -------------------- 第 5 步：调用智能体生成代码 --------------------
response = client.chat.completions.create(
    model="gpt-5-mini",
    messages=[
        {"role": "system", "content": "你是 HTMLGeneratorAgent，一个专业的前端 HTML 生成智能体"},
        {"role": "user", "content": prompt}
    ]
)

generated_code = response.choices[0].message.content

# -------------------- 第 6 步：保存生成的 React 组件 --------------------
jsx_file = os.path.join(base_dir, "html_components.jsx")
with open(jsx_file, "w", encoding="utf-8") as f:
    f.write(generated_code)

print(f"✅ HTML React 组件已生成: {jsx_file}")
