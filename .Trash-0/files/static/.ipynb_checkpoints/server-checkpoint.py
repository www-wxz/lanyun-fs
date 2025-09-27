from flask import Flask, render_template, request, jsonify
import subprocess
import json
import os

app = Flask(__name__)

# ------------------ 配置 ------------------
MAIN_PY_PATH = os.path.join(os.getcwd(), "main.py")
INTEGRATED_HTML_PATH = os.path.join(os.getcwd(), "integrated_app.html")

# ------------------ 首页 ------------------
@app.route("/")
def index():
    return render_template("index.html")

# ------------------ 用户查询接口 ------------------
@app.route("/query", methods=["POST"])
def query():
    user_input = request.json.get("query")
    if not user_input:
        return jsonify({"error": "查询文本为空"}), 400

    try:
        # 调用 main.py 并传递查询文本
        result = subprocess.run(
            ["python", MAIN_PY_PATH],
            input=user_input,
            text=True,
            capture_output=True
        )
        output_log = result.stdout + "\n" + result.stderr
    except Exception as e:
        output_log = str(e)

    return jsonify({
        "log": output_log,
        "html_path": "/integrated_app"
    })

# ------------------ 集成 HTML 展示接口 ------------------
@app.route("/integrated_app")
def integrated_app():
    if not os.path.exists(INTEGRATED_HTML_PATH):
        return "集成 HTML 文件未生成", 404
    with open(INTEGRATED_HTML_PATH, "r", encoding="utf-8") as f:
        html_content = f.read()
    return html_content

# ------------------ 启动 ------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
