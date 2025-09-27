FROM mcr.microsoft.com/playwright/python:v1.47.0-focal

WORKDIR /app
COPY . /app

RUN pip install --no-cache-dir -r requirements.txt || true
RUN pip install pytest pytest-playwright

# 安装浏览器
RUN playwright install --with-deps chromium

CMD ["pytest", "-q", "--disable-warnings", "tests/"]
