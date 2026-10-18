# NH Archive

[![Build and publish](https://github.com/Dormiveglia0/nhentai-archive/actions/workflows/ci.yml/badge.svg)](https://github.com/Dormiveglia0/nhentai-archive/actions/workflows/ci.yml)

自托管的漫画收藏与阅读应用。把本地归档和挂载网盘整理成自己的媒体库，在浏览器中搜索、阅读和管理。

- **我的库**：网页上传 ZIP / CBZ，目录扫描、作品分组、按作者合并展示与批量管理。
- **元数据**：在整理页审批刮削结果、搜索匹配、编辑词条、多选语言和重命名源文件。
- **阅读**：单页与连续阅读、进度与历史记录，本地／远端来源切换。
- **发现与下载**：远端搜索、详情预览、下载队列和创作者订阅。
- **文件管理**：源文件、封面、缩略图与阅读缓存的查看和清理。

## 安装

需要 Docker 和 Docker Compose v2。

```bash
mkdir nh-archive && cd nh-archive
curl -fsSL https://raw.githubusercontent.com/Dormiveglia0/nhentai-archive/main/compose.yaml -o compose.yaml
docker compose pull
docker compose up -d --wait
```

访问 **http://localhost:4349**，首次打开设置访问密码。远端搜索与刮削所需的 API 配置在应用设置中填写。

如果拉取镜像提示需要授权，先运行 `docker login ghcr.io`，使用具有包读取权限的 GitHub 账号和 token 登录。

端口和数据目录可在 `compose.yaml` 的 `ports`、`volumes` 中修改。公网访问请通过反向代理提供 HTTPS。

## 添加作品

**网页上传**：在“我的库”点击“上传”，选择 ZIP 或 CBZ 和目标媒体库。ZIP 自动保存为 CBZ。开启自动刮削后会展示匹配候选，由你确认；也可自行搜索作品名、ID，或手动填写元数据。单个文件最大 2 GB。

**已有目录**：将目录挂载到容器，再在“文件 → 媒体库”中添加容器内路径。例如在 Compose 的 `volumes` 中增加：

```yaml
- /path/to/comics:/media/comics
```

随后添加 `/media/comics`。只需读取的目录可以在卷映射末尾加 `:ro`。

**rclone / 网络存储**：选择“挂载目录”。该模式使用定时检查、读取超时和阅读缓存适配远端存储；存入作品、回写 CBZ、删除源文件分别授权，默认保护已有文件。开启删除后，确认删除会移除挂载目录中的原文件。

默认下载位置在媒体库标题旁选择。rclone 请先在宿主机挂载，再启动容器；应用显示存入完成后，网盘上传仍由 rclone 处理。

扫描进度和操作记录在“文件 → 媒体库”查看；需要人工确认的匹配集中到“整理 → 刮削审批”。审批时可查看当前封面，绑定后保留远端资料；手动编辑支持来源对照、词典补全和语言多选。

**作品分组**：在我的库批量选择作品后创建分组，点击“打开分组”查看、添加或移出作品；解散分组后各作品仍保留。切换“作品展示”为“按作者合并”可归拢同作者作品，合作作品按相同作者组合归组。封面首次加载时随机选择一张后固定；卡片显示作品总数，标签后的数字表示包含该标签的作品数。

## 更新与备份

Compose 使用 `latest`，后续更新不需要修改镜像行：

```bash
docker compose pull
docker compose up -d --wait
```

数据保存在 `data/`，更新或重建容器不会清空。备份时先停止服务，完整复制 `data/` 后再启动；外部媒体目录需要另外备份。数据库包含配置和访问凭据，请私下保存备份。

封面与缩略图用于本地快速浏览，阅读缓存可在存储设置中管理；它们都保存在应用数据目录，不会散落到挂载媒体库中。

## 开发

技术栈：React、FastAPI、SQLite。需要 Node.js 22 和 Python 3.11。

```bash
git clone https://github.com/Dormiveglia0/nhentai-archive.git nhentai-dev
cd nhentai-dev
python3 -m venv .venv
.venv/bin/pip install -r apps/api/requirements-dev.txt
npm --prefix apps/web ci
npm run dev
```

开发页面默认在 `http://127.0.0.1:5173`，使用独立 `.local-data/`。请勿连接正式数据。

开发与维护细节见 [项目地图](docs/PROJECT_MAP.md)、[开发规则](docs/DEVELOPMENT_RULES.md) 和 [当前状态](docs/PROJECT_STATUS.md)。
