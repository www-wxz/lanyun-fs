# main.py
import subprocess
import json
import sys
from search_vector import search_full_record

def run_agent(script_path, arg=None):
    """调用指定 Python 脚本，如果有参数，则传递给脚本"""
    cmd = [sys.executable, script_path]
    if arg:
        cmd.append(arg)
    print(f"▶️ 正在运行 {script_path} ...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"❌ {script_path} 执行失败！")
        print(result.stderr)
        raise RuntimeError(f"{script_path} 执行出错")
    print(f"✅ {script_path} 执行完成")
    print(result.stdout)  # 可选：打印输出

if __name__ == "__main__":
    # ---------------- 1. 获取用户输入 ----------------
    user_query = input("请输入查询文本: ")
    search_results = search_full_record(user_query, top_k=5)
    if not search_results:
        raise ValueError("未找到匹配记录！")
    
    # 取最匹配的一条记录作为 PlanerAgent 输入
    course_input = search_results[0]
    course_json = json.dumps(course_input, ensure_ascii=False)

    print("✅ 已获取最匹配记录，将作为 PlanerAgent 输入：")
    print(json.dumps(course_input, indent=2, ensure_ascii=False))

    # ---------------- 2. 调用 PlanerAgent ----------------
    run_agent("PlanerAgent/planer_main.py", course_json)

    # ---------------- 3. 调用 HTMLGeneratorAgent ----------------
    run_agent("HTMLGeneratorAgent/html_main.py",course_json)

    # ---------------- 4. 调用 CSSGeneratorAgent ----------------
    run_agent("CSSGeneratorAgent/css_main.py",course_json)

    # ---------------- 5. 调用 JSGeneratorAgent ----------------
    run_agent("JSGeneratorAgent/js_main.py",course_json)

    # ---------------- 6. 调用 CodeIntegrationAgent ----------------
    run_agent("CodeIntegrationAgent/codeintegra_main.py",course_json)
    

    print("🎉 所有 Agent 执行完成，端到端流程结束！")
