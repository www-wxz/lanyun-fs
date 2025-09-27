import tkinter as tk
from tkinter import scrolledtext, filedialog
import subprocess
import webbrowser
import os

def run_pipeline():
    user_query = input_box.get("1.0", tk.END).strip()
    if not user_query:
        log_box.insert(tk.END, "❌ 请输入内容\n")
        return
    
    log_box.insert(tk.END, f"▶️ 正在运行 main.py，输入: {user_query}\n")
    log_box.see(tk.END)
    
    # 调用 main.py
    result = subprocess.run(
        ["python", "main.py"],
        input=user_query,
        text=True,
        capture_output=True
    )
    
    if result.returncode != 0:
        log_box.insert(tk.END, f"❌ 出错:\n{result.stderr}\n")
    else:
        log_box.insert(tk.END, f"✅ 执行完成:\n{result.stdout}\n")
        # 自动打开 integrated_app.html
        html_path = os.path.join(os.getcwd(), "integrated_app.html")
        if os.path.exists(html_path):
            webbrowser.open(f"file://{html_path}")
            log_box.insert(tk.END, f"🌐 已打开 {html_path}\n")
        else:
            log_box.insert(tk.END, "⚠️ 没有找到 integrated_app.html\n")

    log_box.see(tk.END)


# ========== GUI 窗口 ==========
root = tk.Tk()
root.title("交互式教学大模型界面")
root.geometry("800x600")

# 输入栏
input_label = tk.Label(root, text="请输入查询文本：")
input_label.pack(anchor="w", padx=5, pady=2)
input_box = tk.Text(root, height=3)
input_box.pack(fill="x", padx=5, pady=2)

# 运行按钮
run_button = tk.Button(root, text="运行", command=run_pipeline)
run_button.pack(pady=5)

# 日志显示框
log_label = tk.Label(root, text="运行日志：")
log_label.pack(anchor="w", padx=5, pady=2)
log_box = scrolledtext.ScrolledText(root, height=20)
log_box.pack(fill="both", expand=True, padx=5, pady=2)

root.mainloop()
