import json
import faiss
import numpy as np
from openai import OpenAI

# ---------------- 配置 ----------------
OPENAI_API_KEY = "sk-0svybfPYILSBihQDWi8ZpreKEXD2AnKw2CimMy0kouizTKOG"
EMBEDDING_MODEL = "text-embedding-3-small"
OPENAI_HOST = "https://api.chatanywhere.tech"

client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_HOST)

# ---------------- 读取 JSON ----------------
with open("output.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# ---------------- 文本合并（可选） ----------------
# 将每条记录转换成一段文本进行向量化
texts = []
meta = []  # 保存原始信息以便检索返回
for item in data:
    text = (
        f"一级主题: {item['一级主题']}; "
        f"二级主题: {item['二级主题']}; "
        f"年级: {item['年级']}; "
        f"课标要求: {item['课标要求']}; "
        f"基本实验活动: {item['基本实验活动']}"
    )
    texts.append(text)
    meta.append(item)

# ---------------- 生成向量 ----------------
def get_embeddings(texts):
    embeddings = []
    batch_size = 50  # 可调节
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i+batch_size]
        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=batch
        )
        batch_embeddings = [e.embedding for e in response.data]
        embeddings.extend(batch_embeddings)
    return np.array(embeddings).astype("float32")

vectors = get_embeddings(texts)
dim = vectors.shape[1]

# ---------------- 建立 FAISS 索引 ----------------
index = faiss.IndexFlatL2(dim)  # 基于 L2 距离
index.add(vectors)
print(f"✅ 已将 {len(vectors)} 条数据存入向量索引，向量维度 {dim}")

# ---------------- 保存索引 ----------------
faiss.write_index(index, "vector.index")
# 可选：保存 meta 对应信息
with open("vector_meta.json", "w", encoding="utf-8") as f:
    json.dump(meta, f, ensure_ascii=False, indent=2)

print("✅ vector.index 和 vector_meta.json 已保存完毕")
