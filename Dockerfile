FROM node:22-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.23-alpine AS backend
WORKDIR /src
RUN apk add --no-cache ca-certificates
COPY go.mod go.sum ./
RUN go mod download
COPY server ./server
RUN CGO_ENABLED=0 go build -o /out/nhentai-archive ./server

FROM alpine:3.21
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata
COPY --from=backend /out/nhentai-archive /app/nhentai-archive
COPY --from=frontend /src/frontend/dist /app/public
ENV ADDR=:8080 \
    DATA_DIR=/app/data \
    DATABASE_PATH=/app/data/app.db \
    LIBRARY_DIR=/app/data/library \
    STATIC_DIR=/app/public
EXPOSE 8080
CMD ["/app/nhentai-archive"]
