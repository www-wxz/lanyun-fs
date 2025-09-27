import json
import faiss
import numpy as np
from openai import OpenAI

# ---------------- 配置 ----------------
OPENAI_API_KEY = "sk-0svybfPYILSBihQDWi8ZpreKEXD2AnKw2CimMy0kouizTKOG"  
EMBEDDING_MODEL = "text-embedding-3-small"
OPENAI_HOST = "https://api.chatanywhere.tech"

client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_HOST)

# ---------------- 载入向量索引和元信息 ----------------
index = faiss.read_index("vector.index")
with open("output.json", "r", encoding="utf-8") as f:
    meta = json.load(f)

# ---------------- 生成向量函数 ----------------
def get_embeddings(texts):
    embeddings = []
    batch_size = 50
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i+batch_size]
        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=batch
        )
        batch_embeddings = [e.embedding for e in response.data]
        embeddings.extend(batch_embeddings)
    return np.array(embeddings).astype("float32")

# ---------------- 检索函数 ----------------
def search_full_record(query, top_k=3):
    # 将输入文本向量化
    query_vec = get_embeddings([query])
    # 在向量索引中搜索最相似向量
    D, I = index.search(query_vec, top_k)
    # 返回完整记录
    results = [meta[i] for i in I[0]]
    return results

# ---------------- 主流程 ----------------
if __name__ == "__main__":
    user_input = input("请输入查询文本：")

    results = search_full_record(user_input, top_k=5)  # 返回最相似的前5条记录

    print("\n=== 匹配到的完整信息 ===")
    for i, r in enumerate(results, start=1):
        print(f"=== 第{i}条记录 ===")
        
        一级主题 = r['一级主题'].strip()
        二级主题 = r['二级主题'].strip()
        年级 = r['年级'].strip()
        课标要求 = r['课标要求'].strip()
        基本实验活动 = r['基本实验活动'].strip()
        
        print(f"一级主题: {一级主题}")
        print(f"二级主题: {二级主题}")
        print(f"年级: {年级}")
        print(f"课标要求: {课标要求}")
        print(f"基本实验活动: {基本实验活动}\n")

