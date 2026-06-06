# NHentai Archive

单管理员个人归档平台。当前版本是 Go 单体服务：一个容器、一个进程，无 Nginx；Go 同时提供 `/api` 和 React 静态前端。

## 功能

- 首次运行创建管理员账户，不再提供默认 `admin/admin`。
- 支持作品 ID、批量 ID、关键词搜索导入。
- 支持 v2 API 适配：详情、搜索、热门、相关作品、tag 解析、tagged 搜索。
- 下载图片并生成 CBZ，写入 `ComicInfo.xml`。
- 支持词典单条维护、`原文=译文` 批量导入。
- 支持作品下载完成后的元数据翻译、机器翻译建议、重新写入 `ComicInfo.xml`。
- DeepL、Google、nhentai API key 可在网页设置中填写，加密保存，不回显明文。

不实现验证码、Cloudflare、登录绕过、反爬绕过、cookie 抓取或权限绕过逻辑。

## 部署

默认通过服务器 IP 加端口测试：

```bash
docker compose up -d --build
```

访问：

```text
http://服务器IP:5413
```

宿主机数据默认挂载到 `./data`，容器内路径：

```text
/app/data/app.db
/app/data/library
/app/data/library/.tmp
```

生产反代时建议只监听本机：

```bash
BIND_ADDR=127.0.0.1 PUBLIC_PORT=5413 HOST_DATA_DIR=/opt/nhentai-data docker compose up -d --build
```

然后在宿主机 Nginx/Caddy/其他反代中转发到 `127.0.0.1:5413`。

## 环境变量

- `PUBLIC_PORT`：公网或本机监听端口，默认 `5413`。
- `BIND_ADDR`：绑定地址，默认 `0.0.0.0`；反代时可设为 `127.0.0.1`。
- `HOST_DATA_DIR`：宿主机持久化目录，默认 `./data`。
- `SECRET_KEY`：服务端加密密钥；修改后需要重新填写网页保存的 API key。
- `DOWNLOAD_CONCURRENCY`：下载并发，默认 `2`。
- `REQUEST_INTERVAL_MS`：远端 API 请求间隔，默认 `900`。

## 本地开发

前端：

```bash
cd frontend
npm install
npm run build
```

后端：

```bash
go test ./server
STATIC_DIR=frontend/dist DATA_DIR=./data DATABASE_PATH=./data/app.db LIBRARY_DIR=./data/library go run ./server
```
