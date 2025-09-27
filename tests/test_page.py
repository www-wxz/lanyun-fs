import os
import time
from playwright.sync_api import sync_playwright

# 获取当前项目根目录
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEST_FILE = os.path.join(BASE_DIR, "CodeIntegrationAgent", "integrated_app.html")

def test_page_loads_and_interactions():
    """测试网页文件能打开，动画执行，并检测简单交互"""

    with sync_playwright() as p:
        # 启动 Chromium，无头模式，使用 GPU 加速参数
        browser = p.chromium.launch(headless=True, args=["--use-gl=egl"])
        page = browser.new_page()
        
        # 打开本地网页
        page.goto(f"file://{TEST_FILE}")
        
        # 1️⃣ 检查 HTML 内容存在
        content = page.content().lower()
        assert "<html" in content, "HTML 标签不存在"
        assert "<body" in content, "BODY 标签不存在"

        # 2️⃣ 等待动画加载（假设动画在 JS 里启动后 1 秒内完成一轮）
        time.sleep(1)  # 可以根据实际动画时间调整

        # 3️⃣ 检查动画相关 DOM 元素是否存在和状态改变
        # 假设动画元素 ID 是 "animated-box"
        animated_box = page.query_selector("#animated-box")
        assert animated_box is not None, "动画元素 #animated-box 不存在"

        # 读取元素 style 属性，检查动画是否生效（比如 left/top/x/y 有变化）
        box_style = animated_box.evaluate("el => el.style.transform || el.style.left || el.style.top")
        assert box_style, "动画元素位置/transform 没有变化"

        # 4️⃣ 测试简单交互（按钮点击触发事件）
        # 假设有按钮 ID="btn-action"，点击后 #output 元素文字改变
        btn = page.query_selector("#btn-action")
        output = page.query_selector("#output")
        assert btn is not None, "按钮 #btn-action 不存在"
        assert output is not None, "输出元素 #output 不存在"

        # 触发点击事件
        btn.click()
        time.sleep(0.5)  # 等待 JS 响应
        
        output_text = output.inner_text().strip()
        assert output_text != "", "按钮点击后输出内容为空"

        browser.close()
