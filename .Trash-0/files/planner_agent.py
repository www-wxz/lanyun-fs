import pdfplumber
import re
import os
from openai import OpenAI
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

# ---------------- 配置 ----------------
PDF_PATH = "义务教育数学课程标准2.pdf"
OPENAI_API_KEY = "sk-0svybfPYILSBihQDWi8ZpreKEXD2AnKw2CimMy0kouizTKOG"
client = OpenAI(api_key=OPENAI_API_KEY)

# ---------------- 第1步：解析PDF ----------------
def extract_structured_sections(pdf_path):
    sections = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text()
            if not text:
                continue
            paragraphs = text.split("\n")
            for para in paragraphs:
                # 简单规则匹配年级或主题
                grade_match = re.search(r"[1-6]～[1-6]年级", para)
                topic_match = re.search(r"(图形与几何|数与代数|统计与概率|空间与几何|综合实践)", para)
                sections.append({
                    "page": page_num,
                    "text": para.strip(),
                    "grade": grade_match.group() if grade_match else "",
                    "topic": topic_match.group() if topic_match else ""
                })
    return sections

sections = extract_structured_sections(PDF_PATH)
print(f"✅ PDF解析完成，共提取段落数：{len(sections)}")

# ---------------- 第2步：向量化 ----------------
# 用OpenAI Embedding API生成向量
def embed_text(text_list):
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text_list
    )
    return [item.embedding for item in response.data]

section_texts = [s['text'] for s in sections]
section_vectors = embed_text(section_texts)
section_vectors = np.array(section_vectors)

# ---------------- 第3步：匹配相关段落 ----------------
lesson_input = {
    "一级主题": "图形与几何",
    "二级主题": "图形 的认识与测量",
    "年级": "5～6年级",
    "课标要求": "探索并掌握平行四边形、三角形和梯形的面积计算公式。",
    "基本实验活动": "探索三角形的面积计算公式"
}

# 构建用户查询文本
query_text = f"{lesson_input['一级主题']} {lesson_input['二级主题']} {lesson_input['年级']} {lesson_input['课标要求']}"
query_vector = np.array(embed_text([query_text]))

# 计算余弦相似度
similarities = cosine_similarity(query_vector, section_vectors)[0]
top_indices = similarities.argsort()[-5:][::-1]  # 取相似度最高5条
related_texts = [section_texts[i] for i in top_indices]

reference_text = "\n".join(related_texts)
print("✅ 已提取与课程最相关的课标内容")

# ---------------- 第4步：生成Markdown ----------------
prompt = f"""
你是一个教学规划智能体，任务是生成Markdown教学规划文件。
请参考课标文本（以下内容与当前课程相关）：
{reference_text}

用户输入：
一级主题: {lesson_input['一级主题']}
二级主题: {lesson_input['二级主题']}
年级: {lesson_input['年级']}
课标要求: {lesson_input['课标要求']}
基本实验活动: {lesson_input['基本实验活动']}

请生成一个Markdown文件，包含以下内容：
1. 一级主题和二级主题
2. 年级信息
3. 教学目标（参考课标）
4. 实验活动
5. 教学模块规划（引入、概念讲解、实验探索、练习、拓展）
6. 交互和动画建议
7. 后续UI/交互Agent可用的结构化提示
"""

response = client.chat.completions.create(
    model="gpt-5-mini",
    messages=[
        {"role": "system", "content": "你是一个教学规划智能体，专门生成Markdown教学规划文件。"},
        {"role": "user", "content": prompt}
    ],
    temperature=0.3
)

markdown_content = response.choices[0].message.content

with open("lesson_plan.md", "w", encoding="utf-8") as f:
    f.write(markdown_content)

print("✅ Markdown教学规划文件生成完成：lesson_plan.md")
