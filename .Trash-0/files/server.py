from flask import Flask, request, jsonify, send_file
import subprocess
import os
import time

app = Flask(__name__)

OUTPUT_HTML = "integrated_app.html"

@app.route("/run", methods=["POST"])
def run_pipeline():
    user_input = request.json.get("query", "")
    if not user_input:
        return jsonify({"error": "请输入查询文本"}), 400

    try:
        # 调用 main.py，传入用户输入
        process = subprocess.Popen(
            ["python", "main.py"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
        stdout, _ = process.communicate(input=user_input, timeout=600)

        # 确认 HTML 是否生成
        html_ready = os.path.exists(OUTPUT_HTML)

        return jsonify({
            "logs": stdout,
            "html_ready": html_ready,
            "html_path": OUTPUT_HTML if html_ready else None
        })
    except subprocess.TimeoutExpired:
        return jsonify({"error": "执行超时"}), 500


@app.route("/preview", methods=["GET"])
def preview_html():
    if os.path.exists(OUTPUT_HTML):
        return send_file(OUTPUT_HTML)
    return "<h3>没有检测到 integrated_app.html，请先运行一次任务</h3>"


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
