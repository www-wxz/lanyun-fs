import os
import json
import time
from datetime import datetime
from openai import OpenAI

# -------------------- 第 1 步：配置 API Key 和 Host --------------------
OPENAI_API_KEY = "sk-0svybfPYILSBihQDWi8ZpreKEXD2AnKw2CimMy0kouizTKOG"  # 替换成你的真实 Key
OPENAI_HOST = "https://api.chatanywhere.tech"

# 使用自定义 Host 初始化客户端
client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_HOST)

# -------------------- 第 2 步：构建 Prompt --------------------
def build_prompt(course):
    return f"""
你是一名**专业的前端动画教学网页设计工程师**，任务是为以下教学内容生成**面向 HTML/CSS/JS 的 PRD（JSON）**，以便生成符合教学目标的高质量互动网页。

### 教学内容：
一级主题: {course['一级主题']}
二级主题: {course['二级主题']}
年级: {course['年级']}
课标要求: {course['课标要求']}
基本实验活动: {course['基本实验活动']}

---

### 任务要求：
1. **动画与交互设计**
   - 根据 {course['年级']} 年级学生认知特点，设计**易理解、可操作性强、引导性明确**的动画效果和交互操作。
   - 动画类型示例：拖拽、逐步演示、动态高亮、角度/数值实时显示。
   - 交互操作示例：拖动图形顶点、点击按钮逐步展示实验步骤、滑块调整参数。
   - 动画反馈应有教育引导作用：提示观察现象、鼓励思考、显示公式/规律。

2. **技术实现**
   - 动画画布：HTML5 Canvas 或 SVG。
   - 动画控制：JS + requestAnimationFrame 或动画库（GSAP、D3.js 等）。
   - 交互事件：JS 拖拽、点击、鼠标/触控事件绑定。
   - 数值/图形显示：DOM 渲染或 Canvas/SVG 绘制文本/标签。

3. **代码层面规划**
   - html_structure：DOM 元素及 id/class、布局、控件按钮。
   - css_plan：整体风格、动画样式、字体颜色、按钮样式。
   - js_plan：事件绑定、动画逻辑、交互反馈、数值实时更新。

4. **生成 JSON 示例**
输出必须是严格 JSON，例如：
{{
  "html_structure": {{
    "布局": "单页面，顶部标题，中间动画画布，底部控制按钮",
    "主要元素": ["<canvas id='animationCanvas'></canvas>", "<div id='controls'></div>"],
    "控件": ["开始", "暂停", "重置", "下一步", "显示角度"]
  }},
  "css_plan": {{
    "整体风格": "明亮、卡通、教育友好，适合 {course['年级']} 年级学生",
    "字体与颜色": "圆润字体，16~18px，蓝绿黄主色调",
    "动画样式": ["拖拽顶点时高亮边", "角度显示渐变", "画布边框突出"]
  }},
  "js_plan": {{
    "事件绑定": ["拖拽顶点更新图形", "点击按钮显示角度", "下一步播放动画", "重置图形"],
    "动画逻辑": ["逐步展示实验步骤动画", "数值/角度实时计算与显示", "高亮当前操作元素"],
    "交互反馈": ["动态提示学生观察", "颜色高亮关键角度", "动画暂停/播放控制"]
  }},
  "teaching_content": {{
    "一级主题": "{course['一级主题']}",
    "二级主题": "{course['二级主题']}",
    "年级": "{course['年级']}",
    "课标要求": "{course['课标要求']}",
    "基本实验活动": "{course['基本实验活动']}"
  }}
}}
---
### 输出要求：
- 输出必须是严格 JSON
- 不要有 Markdown、说明文字、三引号或代码块标记
- 所有键和值必须使用双引号
- JSON 必须能被 python json.loads() 直接解析

确保 HTML/CSS/JS 规划紧密对应，动画和交互设计符合 {course['年级']} 年级学生认知特点，具有**引导性和教育性**，覆盖教学活动的每个步骤。
"""



# -------------------- 第 3 步：调用 GPT（带重试机制） --------------------
def generate_prd(course, retries=3, delay=5):
    prompt = build_prompt(course)
    for i in range(retries):
        try:
            response = client.chat.completions.create(
                model="gpt-5-mini-ca",
                messages=[{"role": "user", "content": prompt}],
                temperature=0
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"第{i+1}次尝试失败: {e}")
            print(f"{delay} 秒后重试...")
            time.sleep(delay)
    raise ConnectionError("无法连接自定义 OpenAI Host，请检查网络或代理设置。")

# -------------------- 第 4 步：保存 PRD --------------------
def save_prd(prd_str, folder=None):
    if folder is None:
        # 默认保存到当前脚本目录的 PlanerAgent/prd_output
        folder = os.path.join(os.path.dirname(__file__), "../PlanerAgent/prd_output")
    os.makedirs(folder, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = os.path.join(folder, f"prd_{timestamp}.json")
    try:
        prd_json = json.loads(prd_str)
    except json.JSONDecodeError:
        raise ValueError("GPT 输出不是有效 JSON")
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(prd_json, f, ensure_ascii=False, indent=2)
    return filename

# -------------------- 第 5 步：主程序 --------------------
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        raise ValueError("❌ 请传入课程输入 JSON，例如: python planer_main.py '{...}'")

    # 从命令行参数读取 JSON
    course_json = sys.argv[1]
    try:
        course_input = json.loads(course_json)
    except json.JSONDecodeError:
        raise ValueError("❌ 传入的参数不是合法的 JSON")

    prd_str = generate_prd(course_input)
    file_path = save_prd(prd_str)
    print(f"✅ PRD 已保存: {file_path}")