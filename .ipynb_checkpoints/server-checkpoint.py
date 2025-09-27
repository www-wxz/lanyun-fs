from flask import Flask, render_template, request, jsonify, send_from_directory
import subprocess
import os

app = Flask(__name__)

OUTPUT_HTML = "integrated_app.html"

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/run", methods=["POST"])
def run_pipeline():
    query = request.json.get("query", "").strip()
    if not query:
        return jsonify({"error": "请输入查询文本"}), 400

    try:
        # 调用 main.py，并把 query 作为输入
        process = subprocess.Popen(
            ["python", "main.py"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = process.communicate(input=query)

        if process.returncode != 0:
            return jsonify({"error": "Pipeline 执行失败", "stderr": stderr}), 500

        return jsonify({
            "stdout": stdout,
            "html_path": f"/view/{OUTPUT_HTML}"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/view/<path:filename>")
def serve_html(filename):
    return send_from_directory(os.getcwd(), filename)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)

