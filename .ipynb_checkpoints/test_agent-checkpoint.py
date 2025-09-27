#!/usr/bin/env python3
"""
test_agent.py
对 integrated_app.html 做静态与运行时检查，并尝试若干自动修复策略（有限）。
增强版：改进错误输出和分类，支持自定义超时
用法：
  python test_agent.py --html integrated_app.html
"""

import os
import sys
import time
import json
import math
import re
import subprocess
import logging
from datetime import datetime
from bs4 import BeautifulSoup

# 配置日志记录
def setup_logging():
    log_dir = "test_logs"
    os.makedirs(log_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = os.path.join(log_dir, f"test_{timestamp}.log")
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler(sys.stdout)
        ]
    )
    return logging.getLogger(__name__)

logger = setup_logging()

# 尝试导入 playwright；如果不可用，我们会回退到静态检查
try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except Exception as e:
    logger.warning(f"Playwright 不可用: {e}. 将仅进行静态检查。")
    PLAYWRIGHT_AVAILABLE = False

# ----------------------
# 配置（可修改）
# ----------------------
DEFAULT_HTML = "integrated_app.html"
HTTP_PORT = 8000            # 本地简单 http.server 端口，用于 Playwright 动态打开页面
RETRY_LIMIT = 2             # 自动修复后最大重试次数
SCREENSHOT_DIR = "test_screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# ----------------------
# 测试规范（可外部加载 JSON）
# ----------------------
# 示例：针对"圆锥体积"场景的简单测试用例（可扩展）
# 语法：
#  - "setup": 可包含一系列操作（action: set / click），用来修改控件值
#  - "check": 检查方式： exists / nonempty / approx
#  - "expected": 期望值（approx 时为数值）
#  - "timeout": 超时时间（毫秒，可选）
EXAMPLE_TESTS = [
    {"name": "AnimationCanvas exists", "selector": "#AnimationCanvas", "check": "exists", "timeout": 3000},
    {"name": "ControlPanel exists", "selector": "#ControlPanel", "check": "exists", "timeout": 3000},
    # 如果页面有 #volumeText 和滑块 #radius, #height，可以运行交互测试（示例）
    {
      "name": "Cone volume numeric check",
      "selector": "#volumeText",
      "check": "approx",
      "timeout": 10000,  # 增加超时时间到10秒
      "expected_func": lambda: round(math.pi * 2 * 2 * 3 / 3, 2),  # expects radius=2 height=3
      "setup": [
        {"action": "set", "selector": "#radius", "value": "2", "timeout": 5000},  # 设置操作也增加超时
        {"action": "set", "selector": "#height", "value": "3", "timeout": 5000}   # 设置操作也增加超时
      ]
    }
]

# ----------------------
# 错误分类和格式化
# ----------------------
class ErrorFormatter:
    @staticmethod
    def format_static_issue(issue):
        issue_type = issue.get("type", "unknown")
        message = issue.get("message", "No message")
        selector = issue.get("selector", "")
        
        if selector:
            return f"[{issue_type.upper()}] {message} (选择器: {selector})"
        return f"[{issue_type.upper()}] {message}"
    
    @staticmethod
    def format_console_message(msg):
        msg_type = msg.get("type", "unknown")
        text = msg.get("text", "")
        return f"[CONSOLE:{msg_type.upper()}] {text}"
    
    @staticmethod
    def format_test_result(result):
        name = result.get("name", "Unnamed test")
        ok = result.get("ok", False)
        message = result.get("message", "")
        status = "PASS" if ok else "FAIL"
        return f"[TEST:{status}] {name}: {message}"
    
    @staticmethod
    def format_error(error):
        return f"[ERROR] {error}"

# ----------------------
# 静态检查函数
# ----------------------
def static_checks(html_path):
    issues = []
    with open(html_path, "r", encoding="utf-8") as f:
        text = f.read()

    soup = BeautifulSoup(text, "html.parser")

    # 检查若干常见占位 id（可根据需要自定义）
    required_ids = ["AnimationCanvas", "ControlPanel"]
    for rid in required_ids:
        if not soup.find(id=rid):
            issues.append({"type": "missing_selector", "selector": f"#{rid}",
                           "message": f"缺少容器 #{rid}，许多交互依赖此 DOM 节点。"})

    # 检查 script 引用（是否有 three.js, react 等）
    script_srcs = [s.get("src") for s in soup.find_all("script") if s.get("src")]
    has_three = any(src and "three" in src.lower() for src in script_srcs)
    has_react = any(src and ("react" in src.lower() or "react-dom" in src.lower()) for src in script_srcs)

    # 检测是否使用 ES module import（通常需要 bundler）
    uses_esmodule = False
    if 'type="module"' in text or re.search(r'^\s*import\s+.+\s+from\s+[\'"]', text, re.M):
        uses_esmodule = True
        issues.append({"type": "uses_esmodule", "message": "页面包含 ES Module import 语句或 script type=module，可能需要构建工具 (Vite/Webpack) 才能运行。自动修复可能有限。"})

    # 检查是否出现关键字（判断页面是否应使用 3D 库）
    content_lower = text.lower()
    wants_3d = any(k in content_lower for k in ("cone", "圆锥", "3d", "three.js", "threejs", "radius", "height", "volume"))

    # 如果页面需要 3D 但没有 three 库，记录可修复项
    if wants_3d and not has_three:
        issues.append({"type": "missing_threejs", "message": "页面文本或元素提示需要 3D，但未检测到 three.js 脚本引用。可尝试注入 CDN 脚本（若为单文件 HTML）。"})

    # 常见小语法问题：末尾多余逗号（简单检测，极不严谨）
    if re.search(r',\s*[\]\}]', text):
        # 仅提示，不自动改动
        issues.append({"type": "suspicious_trailing_comma", "message": "检测到可能的尾随逗号（JSON-like），需人工确认（不自动修复）。"})

    # 检查内联脚本语法错误（非常基础）
    inline_scripts = soup.find_all("script", src=False)
    for script in inline_scripts:
        script_text = script.string or ""
        # 检查常见语法错误模式
        if re.search(r'function\s*\([^)]*$', script_text):  # 函数声明不完整
            issues.append({"type": "script_syntax", "message": f"内联脚本可能存在语法错误: 函数声明不完整"})
        if re.search(r'\{[^{}]*$', script_text):  # 大括号不匹配
            issues.append({"type": "script_syntax", "message": f"内联脚本可能存在语法错误: 大括号不匹配"})

    return issues, soup, text

# ----------------------
# 尝试自动修复（有限策略）
# ----------------------
def attempt_repairs(html_path, issues, soup=None, text=None):
    """
    采取一些稳妥的修复策略：
     - 为缺失的 selector 添加占位 DIV
     - 为缺少 three.js 的页面注入 CDN <script>
     - 对于 ES module 脚本，提示无法自动修复
    返回: (repaired:boolean, new_html_text:str, repair_log:list)
    """
    repaired = False
    repair_log = []
    if soup is None or text is None:
        with open(html_path, "r", encoding="utf-8") as f:
            text = f.read()
        soup = BeautifulSoup(text, "html.parser")

    for issue in issues:
        t = issue.get("type")
        if t == "missing_selector":
            sel = issue.get("selector", "")
            mid = sel.lstrip("#")
            # create placeholder div
            if not soup.find(id=mid):
                placeholder = soup.new_tag("div", id=mid)
                placeholder.string = f"{mid} 占位（由 TestAgent 自动插入）"
                # add minimal inline style to visualize
                placeholder['style'] = "min-height:200px;border:2px dashed #ffa;display:flex;align-items:center;justify-content:center;background:#fffbe6;color:#333;margin:8px 0;"
                # append to body or main if exists
                if soup.body:
                    soup.body.append(placeholder)
                else:
                    soup.append(placeholder)
                repair_log.append(f"插入占位元素 {sel}")
                repaired = True
        elif t == "missing_threejs":
            # try to insert CDN script before closing </head> if possible
            # Use a stable three.js CDN version
            three_cdn = "https://unpkg.com/three@0.150.1/build/three.min.js"
            # check if script already present
            if not any((tag.get('src') and 'three' in tag.get('src').lower()) for tag in soup.find_all('script') if tag.get('src')):
                script_tag = soup.new_tag("script", src=three_cdn)
                # insert into head if available
                if soup.head:
                    soup.head.append(script_tag)
                    repair_log.append(f"注入 three.js CDN: {three_cdn}")
                    repaired = True
                else:
                    # fallback: insert at start of document
                    soup.insert(0, script_tag)
                    repair_log.append(f"注入 three.js CDN到文档开头: {three_cdn}")
                    repaired = True
        elif t == "uses_esmodule":
            repair_log.append("检测到 ES Module/import：该问题通常需要构建工具（vite/webpack）来解决，自动修复有限。")
        elif t == "suspicious_trailing_comma":
            repair_log.append("检测到尾随逗号提示：自动修复风险较高，建议人工检查。")
        elif t == "script_syntax":
            repair_log.append("检测到可能的脚本语法错误：需要人工检查修复。")
        else:
            repair_log.append(f"未实现问题类型的自动修复: {t}")

    # write back if changed
    if repaired:
        new_text = str(soup)
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(new_text)
        return True, new_text, repair_log
    else:
        return False, text, repair_log

# ----------------------
# 运行时动态检测（使用 Playwright）
# ----------------------
def run_dynamic_tests_via_playwright(base_url, test_cases, screenshot_prefix="run"):
    results = {"console": [], "errors": [], "checks": []}
    if not PLAYWRIGHT_AVAILABLE:
        results["errors"].append("Playwright not available in environment.")
        return results

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # collect console messages
        console_msgs = []
        page.on("console", lambda msg: console_msgs.append({"type": msg.type, "text": msg.text}))
        page.on("pageerror", lambda err: console_msgs.append({"type": "pageerror", "text": str(err)}))

        # navigate
        try:
            page.goto(base_url, timeout=120000, wait_until="load")  # 增加页面加载超时到120秒
        except Exception as e:
            results["errors"].append(f"页面加载错误: {e}")
            browser.close()
            return results

        # slight wait for animations/scripts to initialize
        time.sleep(1.0)

        # run each test case
        for idx, tc in enumerate(test_cases):
            name = tc.get("name", f"test_{idx}")
            sel = tc.get("selector")
            check = tc.get("check")
            setup = tc.get("setup", [])
            # 获取测试用例的超时设置，如果没有则使用默认值3000
            timeout = tc.get("timeout", 3000)
            tc_result = {"name": name, "ok": False, "message": ""}

            # run setup actions (set inputs / click)
            try:
                for action in setup:
                    a = action.get("action")
                    a_sel = action.get("selector")
                    a_val = action.get("value")
                    # 获取设置操作的超时时间，如果没有则使用默认值3000
                    action_timeout = action.get("timeout", 3000)
                    if a == "set":
                        # prefer eval to set value and dispatch event
                        script = "(el, v) => { el.value = v; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); }"
                        try:
                            # 使用操作特定的超时时间
                            page.wait_for_selector(a_sel, timeout=action_timeout)
                            page.eval_on_selector(a_sel, script, a_val)
                            time.sleep(0.3)
                        except Exception as e:
                            # fallback try filling
                            try:
                                page.fill(a_sel, str(a_val))
                                time.sleep(0.2)
                            except Exception as e2:
                                pass
                    elif a == "click":
                        try:
                            # 使用操作特定的超时时间
                            page.click(a_sel, timeout=action_timeout)
                            time.sleep(0.2)
                        except Exception:
                            pass
            except Exception as e:
                tc_result["message"] = f"setup 执行失败: {e}"

            # perform check
            try:
                if check == "exists":
                    try:
                        # 使用测试用例的超时时间
                        page.wait_for_selector(sel, timeout=timeout)
                        tc_result["ok"] = True
                        tc_result["message"] = "selector exists"
                    except Exception as e:
                        tc_result["message"] = f"未找到 selector: {sel} (超时: {timeout}ms)"
                elif check == "nonempty":
                    # 使用测试用例的超时时间
                    page.wait_for_selector(sel, timeout=timeout)
                    text = page.locator(sel).inner_text().strip()
                    if text:
                        tc_result["ok"] = True
                        tc_result["message"] = f"nonempty: '{text[:80]}'"
                    else:
                        tc_result["message"] = "文本为空"
                elif check == "approx":
                    # expected numeric value given by expected_func or expected numeric
                    expected = tc.get("expected")
                    if expected is None and tc.get("expected_func"):
                        expected = tc["expected_func"]()
                    # 使用测试用例的超时时间
                    page.wait_for_selector(sel, timeout=timeout)
                    text = page.locator(sel).inner_text().strip()
                    # extract numeric from text
                    m = re.search(r"(-?\d+(\.\d+)?)", text)
                    if m:
                        val = float(m.group(1))
                        if expected is None:
                            tc_result["message"] = f"找到了数值 {val}，但没有期望值可比对"
                        else:
                            diff = abs(val - float(expected))
                            if diff < 0.05 * max(1.0, abs(expected)):  # 5% 容差
                                tc_result["ok"] = True
                                tc_result["message"] = f"数值匹配 (got {val}, expect {expected})"
                            else:
                                tc_result["message"] = f"数值差异过大 (got {val}, expect {expected})"
                    else:
                        tc_result["message"] = f"无法从元素文本中解析数值: '{text[:80]}'"
                else:
                    tc_result["message"] = f"未知的 check 类型: {check}"
            except Exception as e:
                tc_result["message"] = f"检查执行异常: {e}"

            # save per-test screenshot
            try:
                shot_path = os.path.join(SCREENSHOT_DIR, f"{screenshot_prefix}_{idx}.png")
                page.screenshot(path=shot_path, full_page=False)
                tc_result["screenshot"] = shot_path
            except Exception:
                pass

            results["checks"].append(tc_result)

        results["console"] = console_msgs
        browser.close()
    return results

# ----------------------
# 输出测试结果
# ----------------------
def print_test_results(issues, test_results, repair_log=None):
    """以结构化的方式输出测试结果"""
    
    # 输出静态检查结果
    if issues:
        logger.info("📋 静态检查发现以下问题:")
        for issue in issues:
            logger.error(ErrorFormatter.format_static_issue(issue))
    else:
        logger.info("✅ 静态检查未发现问题")
    
    # 输出修复日志
    if repair_log:
        logger.info("🔧 自动修复执行:")
        for log in repair_log:
            logger.info(f"   {log}")
    
    # 输出动态测试结果
    if test_results:
        # 输出页面错误
        if test_results.get("errors"):
            logger.info("❌ 页面加载错误:")
            for error in test_results["errors"]:
                logger.error(ErrorFormatter.format_error(error))
        
        # 输出控制台消息（按类型分类）
        console_msgs = test_results.get("console", [])
        if console_msgs:
            # 分类控制台消息
            errors = [m for m in console_msgs if m.get("type") in ["error", "pageerror"]]
            warnings = [m for m in console_msgs if m.get("type") == "warning"]
            logs = [m for m in console_msgs if m.get("type") == "log"]
            debugs = [m for m in console_msgs if m.get("type") not in ["error", "pageerror", "warning", "log"]]
            
            if errors:
                logger.info("❌ JavaScript 错误:")
                for msg in errors:
                    logger.error(ErrorFormatter.format_console_message(msg))
            
            if warnings:
                logger.info("⚠️  浏览器警告:")
                for msg in warnings:
                    logger.warning(ErrorFormatter.format_console_message(msg))
            
            if logs:
                logger.info("📝 控制台输出 (最近5条):")
                for msg in logs[-5:]:
                    logger.info(ErrorFormatter.format_console_message(msg))
            
            if debugs:
                logger.info("🔍 其他调试信息:")
                for msg in debugs[-3:]:
                    logger.debug(ErrorFormatter.format_console_message(msg))
        
        # 输出测试用例结果
        checks = test_results.get("checks", [])
        if checks:
            logger.info("🧪 测试用例结果:")
            passed = sum(1 for c in checks if c.get("ok"))
            total = len(checks)
            
            for check in checks:
                if check.get("ok"):
                    logger.info(ErrorFormatter.format_test_result(check))
                else:
                    logger.error(ErrorFormatter.format_test_result(check))
            
            logger.info(f"测试通过率: {passed}/{total} ({passed/total*100:.1f}%)")
            
            # 输出失败测试的截图路径
            failed_with_screenshots = [c for c in checks if not c.get("ok") and c.get("screenshot")]
            if failed_with_screenshots:
                logger.info("📸 失败测试的截图:")
                for test in failed_with_screenshots:
                    logger.info(f"   {test['name']}: {test.get('screenshot')}")

# ----------------------
# 主流程：检测 -> 尝试修复 -> 复测（最多 RETRY_LIMIT 次）
# ----------------------
def main(html_path=DEFAULT_HTML, tests=None):
    html_path = os.path.abspath(html_path)
    if not os.path.exists(html_path):
        logger.error(f"错误：找不到文件 {html_path}")
        return 2

    logger.info(f"开始对 {html_path} 进行测试...")

    attempts = 0
    while attempts <= RETRY_LIMIT:
        attempts += 1
        logger.info(f"\n=== 尝试 {attempts} ===")
        issues, soup, text = static_checks(html_path)
        
        # 如果存在问题，尝试自动修复
        repair_log = []
        if issues:
            repaired, new_text, repair_log = attempt_repairs(html_path, issues, soup, text)
            if repaired:
                logger.info("尝试自动修复：")
                for r in repair_log:
                    logger.info(f"  * {r}")
                # small delay to ensure file written
                time.sleep(0.5)
            else:
                logger.info("未能自动修复任何问题（或问题不适合自动修复）。")
        else:
            # 无静态问题，直接去运行时检测
            pass

        # 如果 Playwright 可用，启动本地 http.server 并运行动态检测
        test_results = {}
        if PLAYWRIGHT_AVAILABLE:
            # run simple http server in html's directory
            workdir = os.path.dirname(html_path) or "."
            server_proc = subprocess.Popen([sys.executable, "-m", "http.server", str(HTTP_PORT)], cwd=workdir,
                                           stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            time.sleep(0.6)  # wait server up
            url = f"http://127.0.0.1:{HTTP_PORT}/{os.path.basename(html_path)}"
            logger.info(f"通过 Playwright 运行动态测试: {url}")

            # choose test cases
            test_cases = tests if tests is not None else EXAMPLE_TESTS
            # make sure lambda expected_func replaced by numeric if present
            for tc in test_cases:
                if "expected_func" in tc and callable(tc["expected_func"]):
                    # convert to numeric
                    try:
                        tc["expected"] = tc["expected_func"]()
                    except Exception:
                        tc["expected"] = None

            try:
                test_results = run_dynamic_tests_via_playwright(url, test_cases, screenshot_prefix=f"attempt{attempts}")
                # 打印测试结果
                print_test_results(issues, test_results, repair_log)
            except Exception as e:
                logger.error(f"动态测试执行异常: {e}")
                test_results = {"errors": [f"动态测试异常: {e}"]}
            finally:
                # kill server
                server_proc.terminate()
                try:
                    server_proc.wait(timeout=2)
                except Exception:
                    server_proc.kill()
        else:
            logger.warning("Playwright 不可用，跳过动态检测（你可以通过 pip install playwright 并执行 `python -m playwright install chromium` 来启用）。")
            # 只进行静态检查时也输出结果
            print_test_results(issues, {}, repair_log)

        # 判断是否通过：如果所有 check 都 OK 则退出成功
        all_ok = True
        for c in test_results.get("checks", []):
            if not c.get("ok"):
                all_ok = False
                
        # if no dynamic checks ran (Playwright not available), treat static-only as success
        if PLAYWRIGHT_AVAILABLE:
            if all_ok:
                logger.info("\n🎉 所有动态检查通过！")
                return 0
            else:
                logger.info("\n部分动态检查未通过。")
                if attempts <= RETRY_LIMIT:
                    logger.info("将尝试再次修复并重测...")
                    time.sleep(0.8)
                    continue
                else:
                    logger.info("达到最大重试次数，停止尝试。")
                    return 3
        else:
            # Only static available -> if no static issues, success
            if not issues:
                logger.info("\n静态检查通过（未运行动态检查）。")
                return 0
            else:
                logger.info("\n静态检查未通过，且无法运行动态检查。请手动修复。")
                return 4

    return 99

# ----------------------
# CLI 支持
# ----------------------
if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--html", default=DEFAULT_HTML, help="要测试的 HTML 文件路径（默认 integrated_app.html）")
    p.add_argument("--tests", default=None, help="可选的测试用例 JSON 文件")
    args = p.parse_args()
    tests = None
    if args.tests:
        with open(args.tests, "r", encoding="utf-8") as f:
            tests = json.load(f)
    exit_code = main(args.html, tests)
    sys.exit(exit_code)