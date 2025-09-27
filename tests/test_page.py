import os
from playwright.sync_api import sync_playwright

# 获取当前项目根目录
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEST_FILE = os.path.join(BASE_DIR, "CodeIntegrationAgent", "integrated_app.html")

def test_page_loads():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--use-gl=egl"])
        page = browser.new_page()
        page.goto(f"file://{TEST_FILE}")   # 注意这里 file:// 后不要多加 /
        assert "html" in page.content().lower()
