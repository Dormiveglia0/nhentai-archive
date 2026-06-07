# NH Archive

单管理员本地 CBZ 元数据管理工作台。当前版本是 Go 单体服务：一个容器、一个进程，无 Nginx；Go 同时提供 `/api` 和 React 静态前端。旧 Python/FastAPI 后端已从维护面移除。

## 功能

- 首次运行创建管理员账户，不再提供默认 `admin/admin`。
- 支持 nhentai API v2 fuzzy search、画廊 ID 查询、批量 ID 导入、详情预览和相关作品。
- 按 v2 API 文档使用 `Authorization: Key <API_KEY>`，并通过 `/api/v2/cdn` 返回的 CDN server 拼接图片 `path`，不硬编码缩略图域名。
- 远程导入使用官方 `POST /api/v2/galleries/{id}/download` 获取归档 URL，由后端下载、解析和入库。
- 支持上传本地 CBZ/ZIP、扫描配置目录、hash 去重、读取 `ComicInfo.xml` / `meta.json`、抽取本地封面。
- 使用 `works`、`work_metadata`、`work_tags`、`exports` 管理原始元数据、可编辑工作元数据、最终标签和导出记录。
- 词典管理以本地库内所有 tag 为入口，支持未配置筛选、关联作品查看、按需机翻建议、批量写入词典、忽略不需配置的 tag，以及手动词条维护/导出。
- 支持机器翻译建议；建议只写入 `machine_suggestion`，用户显式采用后才影响最终导出。
- 导出新 CBZ 时写入确认后的 `ComicInfo.xml`，默认保留原 `meta.json`，不会修改原始 CBZ。
- DeepL、Google、nhentai API key 可在网页设置中填写，加密保存，不回显明文。
- 管理员可在独立设置页修改密码，并保留当前会话、清理其它旧会话。

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

Go 单体服务：

```bash
go test ./server
STATIC_DIR=frontend/dist DATA_DIR=./data DATABASE_PATH=./data/app.db LIBRARY_DIR=./data/library go run ./server
```

网页主要界面：

- `总览`：最近入库、待处理事项、服务健康、任务状态。
- `搜索`：远程搜索、画廊 ID 查询、批量 ID、本地上传、目录扫描、队列抽屉。
- `我的库`：封面墙/表格、紧凑筛选、多选批量操作；作者/社团/分类/语言与内容 tag 分离展示。
- `作品详情 / 标签治理`：按作者、社团、分类、原作、角色、内容标签、语言分组治理；左侧只读 `meta.json` / 可编辑 `ComicInfo.xml` / 文件历史。
- `队列`：导入、扫描、解析、导出任务与历史导出产物集中管理，支持详情抽屉、重试、下载、重新导出、删除记录。
- `词典`：全部库内标签、未配置词典、已配置词典、手动词条；未配置 tag 可按需生成机翻建议并写入词典。
- `设置`：Preferences 分区式设置，包含数据源、翻译、资料库、导出、安全、维护与浮层日志。

服务器验证不依赖图形环境：

```bash
docker run --rm -v "$PWD":/src -w /src golang:1.23-alpine go test ./server
cd frontend && npm run build
```
