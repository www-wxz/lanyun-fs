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
    planer_data = json.load(f)

css_plan = planer_data.get("css_plan")
teaching_content = planer_data.get("teaching_content")
if not css_plan:
    raise ValueError("❌ PRD 文件中未找到 'css_plan' 部分")
if not teaching_content:
    raise ValueError("❌ PRD 文件中未找到 'teaching_content' 部分")

# 保存提取内容（可选）
with open("css_plan.json", "w", encoding="utf-8") as f:
    json.dump({"css_plan": css_plan, "teaching_content": teaching_content}, f, ensure_ascii=False, indent=2)
print("✅ css_plan 和 teaching_content 已保存到 css_plan.json")

# -------------------- 第 4 步：构建 Prompt 给 CSS 智能体 --------------------
course_info_str = json.dumps(course_json, ensure_ascii=False, indent=2) if course_json else "无课程信息"

prompt = f"""
你是前端开发智能体 CSSGeneratorAgent，请根据以下 JSON 数据生成 **CSS 或 TailwindCSS 样式代码**：

### 教学内容
{json.dumps(teaching_content, ensure_ascii=False, indent=2)}

### CSS 设计规划
{json.dumps(css_plan, ensure_ascii=False, indent=2)}

### 输出要求
1. **整体风格**
   - 明亮、卡通、教育友好，符合 {teaching_content.get('年级', '')} 年级学生认知特点
   - 场景动画突出，主画布边框/背景显眼
   - 字体圆润，字号适合学生（16~18px）

2. **动画样式**
   - 拖拽高亮效果
   - 角度/数值渐变显示
   - 当前操作元素高亮或闪烁
   - 控件按钮视觉明显，易操作

3. **代码要求**
   - 保持与 HTML 结构 id/class 一致
   - 尽量使用 TailwindCSS，如果使用纯 CSS，确保可扩展性
   - 只生成样式代码，不生成 HTML 或 JS 逻辑

4. **禁止输出**
   - 不要生成 HTML、JS 逻辑或教学算法
   - 不要生成注释或冗余说明，只输出有效 CSS/Tailwind 样式
"""

# -------------------- 第 5 步：调用智能体生成代码 --------------------
response = client.chat.completions.create(
    model="gpt-5-mini-ca",
    messages=[
        {"role": "system", "content": "你是 CSSGeneratorAgent，一个专业前端教学样式生成智能体"},
        {"role": "user", "content": prompt}
    ]
)

# 获取生成的代码
generated_code = response.choices[0].message.content

# -------------------- 第 6 步：保存生成 CSS --------------------
css_file = os.path.join(base_dir, "css_components.jsx")
with open(css_file, "w", encoding="utf-8") as f:
    f.write(generated_code)

print(f"✅ CSS 样式已生成: {css_file}")
