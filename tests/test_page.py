import os
import time
from playwright.sync_api import sync_playwright

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEST_FILE = os.path.join(BASE_DIR, "CodeIntegrationAgent", "integrated_app.html")

def test_page_loads_and_interactions():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--use-gl=egl"])
        page = browser.new_page()
        page.goto(f"file://{TEST_FILE}")

        # 1️⃣ 检查 HTML 内容
        content = page.content().lower()
        assert "<html" in content
        assert "<body" in content

        # 2️⃣ 等待动画完成
        time.sleep(1)

        # 3️⃣ 检查动画元素是否存在，位置/transform 有变化
        animated_box = page.query_selector("#animated-box")
        assert animated_box is not None
        box_style = animated_box.evaluate("el => el.style.transform || el.style.left || el.style.top")
        assert box_style

        # 4️⃣ 测试交互按钮点击
        btn = page.query_selector("#btn-action")
        output = page.query_selector("#output")
        assert btn is not None
        assert output is not None
        btn.click()
        time.sleep(0.5)
        assert output.inner_text().strip() != ""

        browser.close()
