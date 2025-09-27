import pdfplumber
import re
import os
import json
import faiss
import numpy as np
from openai import OpenAI

# ---------------- 配置 ----------------
PDF_PATH = "义务教育数学课程标准2.pdf"
INDEX_PATH = "curriculum_faiss.index"
METADATA_PATH = "curriculum_metadata.json"

OPENAI_API_KEY = "sk-0svybfPYILSBihQDWi8ZpreKEXD2AnKw2CimMy0kouizTKOG"
if not OPENAI_API_KEY:
    raise ValueError("❌ 请先设置环境变量 OPENAI_API_KEY")

client = OpenAI(api_key=OPENAI_API_KEY)

# ---------------- 第1步：解析PDF ----------------
def extract_sections(pdf_path):
    sections = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text()
            if not text:
                continue
            paragraphs = text.split("\n")
            for para in paragraphs:
                para = para.strip()
                if len(para) < 5:
                    continue
                # 尝试匹配年级和主题
                grade_match = re.search(r"[1-6]～[1-6]年级", para)
                topic_match = re.search(r"(图形与几何|数与代数|统计与概率|空间与几何|综合实践|必修|选修|函数)", para)
                sections.append({
                    "page": page_num,
                    "text": para,
                    "grade": grade_match.group() if grade_match else "",
                    "topic": topic_match.group() if topic_match else ""
                })
    return sections

sections = extract_sections(PDF_PATH)
print(f"✅ PDF解析完成，共提取段落数：{len(sections)}")

# ---------------- 第2步：向量化 ----------------
def embed_text(text_list, batch_size=50):
    embeddings = []
    for i in range(0, len(text_list), batch_size):
        batch = text_list[i:i+batch_size]
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=batch
        )
        batch_embeddings = [item.embedding for item in response.data]
        embeddings.extend(batch_embeddings)
    return embeddings

section_texts = [s["text"] for s in sections]
section_vectors = embed_text(section_texts)
section_vectors = np.array(section_vectors, dtype=np.float32)

# ---------------- 第3步：建立FAISS索引 ----------------
dim = section_vectors.shape[1]
index = faiss.IndexFlatL2(dim)
index.add(section_vectors)
faiss.write_index(index, INDEX_PATH)
print(f"✅ FAISS索引保存完成：{INDEX_PATH}")

# ---------------- 第4步：保存文本与元数据 ----------------
with open(METADATA_PATH, "w", encoding="utf-8") as f:
    json.dump(sections, f, ensure_ascii=False, indent=2)
print(f"✅ 文本与元数据保存完成：{METADATA_PATH}")

