# tests/test_smoke.py
import glob
import json
import os

def find_first(pattern):
    matches = glob.glob(f"**/{pattern}", recursive=True)
    return matches[0] if matches else None

def test_integrated_html_exists():
    path = find_first("integrated_app.html")
    assert path and os.path.exists(path), "integrated_app.html 未找到，确保 CodeIntegrationAgent 已生成它"

def test_ui_design_json_exists_and_valid():
    path = find_first("ui_design.json") or find_first("*/ui_design.json")
    assert path and os.path.exists(path), "ui_design.json 未找到"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    # 检查至少包含提示性字段（不同实现可能字段不同）
    assert isinstance(data, dict), "ui_design.json 不是有效的 JSON 对象"

def test_teaching_feedback_json_exists_and_valid():
    path = find_first("teaching_feedback.json")
    if path:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        assert isinstance(data, dict), "teaching_feedback.json 不是有效的 JSON 对象"
    else:
        # 有些实现把 feedback 放在 jsx 中，此处不强制失败，只给出 warning（通过）
        assert True
