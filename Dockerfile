# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS web-build
WORKDIR /build/apps/web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web/ ./
RUN npm run build

FROM python:3.11-slim-bookworm
LABEL org.opencontainers.image.source="https://github.com/Dormiveglia0/nhentai-archive"

ENV HOME=/tmp \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/apps/api \
    NH_ARCHIVE_DATA_DIR=/data \
    NH_ARCHIVE_WEB_DIST=/app/apps/web/dist

WORKDIR /app
COPY apps/api/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt \
    && useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin app \
    && mkdir -p /data \
    && chown app:app /data
COPY apps/api/ ./apps/api/
COPY --from=web-build /build/apps/web/dist/ ./apps/web/dist/
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint
RUN chmod -R a+rX /app/apps

USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)"]
ENTRYPOINT ["docker-entrypoint"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
