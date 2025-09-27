import pdfplumber
import json
import re

def clean_text(text, is_experiment=False):
    if not text:
        return ""

    # 1. 删除所有不可见字符（零宽空格、全角空格、非断行空格、控制字符）
    text = re.sub(r'[\u200b\u200c\u200d\u3000\xa0]', '', text)
    text = re.sub(r'[\x00-\x1f\x7f]', '', text)

    # 2. 删除换行和回车
    text = text.replace("\n", "").replace("\r", "")

    # 3. 删除中文字符之间所有空格（无论多少）
    text = re.sub(r'([\u4e00-\u9fff])\s+([\u4e00-\u9fff])', r'\1\2', text)

    # 4. 删除中文与标点之间空格
    punctuation = "，。！？；：（）【】“”‘’—…"
    text = re.sub(r'([\u4e00-\u9fff])\s*([' + punctuation + '])', r'\1\2', text)
    text = re.sub(r'([' + punctuation + '])\s*([\u4e00-\u9fff])', r'\1\2', text)

    # 5. 删除多余空格（保留英文、数字之间的单空格）
    text = re.sub(r'[ ]{2,}', ' ', text)

    # 6. 去掉首尾空格
    text = text.strip()

    # 7. 基本实验活动去掉开头编号
    if is_experiment:
        text = re.sub(r'^\d+\.\s*', '', text)

    return text

def extract_from_pdf(pdf_path, output_json):
    results = []

    last_一级 = ""
    last_二级 = ""
    last_年级 = ""
    last_课标要求 = ""

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if not row or all(cell is None or cell.strip() == "" for cell in row):
                        continue

                    一级主题 = clean_text(row[0]) if len(row) > 0 else ""
                    二级主题 = clean_text(row[1]) if len(row) > 1 else ""
                    年级 = clean_text(row[2]) if len(row) > 2 else ""
                    课标要求 = clean_text(row[3]) if len(row) > 3 else ""
                    基本实验活动 = clean_text(row[4], is_experiment=True) if len(row) > 4 else ""

                    if 一级主题 == "":
                        一级主题 = last_一级
                    else:
                        last_一级 = 一级主题

                    if 二级主题 == "":
                        二级主题 = last_二级
                    else:
                        last_二级 = 二级主题

                    if 年级 == "":
                        年级 = last_年级
                    else:
                        last_年级 = 年级

                    if 课标要求 == "":
                        课标要求 = last_课标要求
                    else:
                        last_课标要求 = 课标要求

                    results.append({
                        "一级主题": 一级主题,
                        "二级主题": 二级主题,
                        "年级": 年级,
                        "课标要求": 课标要求,
                        "基本实验活动": 基本实验活动
                    })

    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"✅ 抽取完成，共 {len(results)} 条数据，已保存到 {output_json}")


if __name__ == "__main__":
    pdf_path = "《中小学实验教学基本目录》.pdf"
    output_json = "output.json"
    extract_from_pdf(pdf_path, output_json)
