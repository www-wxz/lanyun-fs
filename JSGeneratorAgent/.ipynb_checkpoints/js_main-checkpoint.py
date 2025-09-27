import os
import sys
import json
from openai import OpenAI

# -------------------- 第 1 步：配置 API Key 和 Host --------------------
OPENAI_API_KEY = "sk-0svybfPYILSBihQDWi8ZpreKEXD2AnKw2CimMy0kouizTKOG"
OPENAI_HOST = "https://api.chatanywhere.tech"

client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_HOST)

# -------------------- 第 2 步：获取课程信息（可选从命令行传入） --------------------
course_json = None
if len(sys.argv) > 1:
    try:
        course_json = json.loads(sys.argv[1])
    except json.JSONDecodeError:
        print("❌ 传入的课程 JSON 不合法，将只使用最新 PRD 文件")

# -------------------- 第 3 步：读取最新 PlanerAgent 输出文件 --------------------
base_dir = os.path.dirname(os.path.abspath(__file__))
folder_path = os.path.join(base_dir, "../PlanerAgent/prd_output")

json_files = [os.path.join(folder_path, f) for f in os.listdir(folder_path) if f.endswith(".json")]
if not json_files:
    raise FileNotFoundError("❌ 未找到任何 PRD 输出文件，请先运行 PlanerAgent")

latest_file = max(json_files, key=os.path.getmtime)
print(f"✅ 检测到最新的 PRD 文件: {latest_file}")

with open(latest_file, "r", encoding="utf-8") as f:
    data = json.load(f)

interaction_logic_data = data.get("js_plan")
teaching_content = data.get("teaching_content")
if not interaction_logic_data:
    raise ValueError("❌ PRD 文件中未找到 'js_plan' 部分")
if not teaching_content:
    raise ValueError("❌ PRD 文件中未找到 'teaching_content' 部分")

# -------------------- 保存提取内容（可选调试） --------------------
with open("js_plan.json", "w", encoding="utf-8") as f:
    json.dump({"js_plan": interaction_logic_data, "teaching_content": teaching_content}, f, ensure_ascii=False, indent=2)
print("✅ js_plan 和 teaching_content 已保存到 js_plan.json")

# -------------------- 第 4 步：构建 Prompt --------------------
course_info_str = json.dumps(course_json, ensure_ascii=False, indent=2) if course_json else "无课程信息"

prompt = f"""
你是前端交互逻辑生成智能体 JSGeneratorAgent，请根据以下 JSON 数据生成 **React 交互逻辑组件代码**：

### 课程信息
{course_info_str}

### 交互逻辑规划
{json.dumps(interaction_logic_data, ensure_ascii=False, indent=2)}

### 输出要求
1. **生成范围**
   - React 交互逻辑（useState, useEffect, 事件绑定）
   - 支持动画与状态更新（缓动、过渡、逐步演示）
   - 拖拽、点击、滑块等交互操作
   - 学生操作反馈（颜色高亮、标签显示、动画步骤更新）

2. **不要输出**
   - 不要生成 HTML 结构（由 HTMLGeneratorAgent 负责）
   - 不要生成 CSS 样式（由 CSSGeneratorAgent 负责）
   - 不要生成教师提示逻辑（由 TeachingFeedbackAgent 负责）

3. **组件化要求**
   - 每个功能独立为函数，便于后续扩展
   - 假设已有 UI 组件：<MainCanvasArea />, <ToolBar />, <HintPanel />
   - 动画与交互逻辑可直接绑定到这些组件上

4. **示例功能**
   - 拖拽顶点更新图形
   - 点击按钮播放/暂停动画
   - 逐步展示计算过程
   - 动态颜色高亮或闪烁当前操作元素
"""

# -------------------- 第 5 步：调用智能体生成代码 --------------------
response = client.chat.completions.create(
    model="gpt-5-mini-ca",
    messages=[
        {"role": "system", "content": "你是 JSGeneratorAgent，一个专业前端交互逻辑生成智能体"},
        {"role": "user", "content": prompt}
    ]
)

generated_code = response.choices[0].message.content

# -------------------- 第 6 步：保存生成的 React 交互逻辑 --------------------
jsx_file = os.path.join(base_dir, "javascript_components.jsx")
with open(jsx_file, "w", encoding="utf-8") as f:
    f.write(generated_code)

print(f"✅ React 交互逻辑组件已生成: {jsx_file}")
