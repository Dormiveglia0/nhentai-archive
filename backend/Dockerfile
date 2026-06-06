FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app

ENV DATA_DIR=/data
ENV DATABASE_PATH=/data/app.db
ENV LIBRARY_DIR=/data/library

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
