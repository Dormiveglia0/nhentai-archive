# NH Archive

[![Build and publish](https://github.com/Dormiveglia0/nhentai-archive/actions/workflows/ci.yml/badge.svg)](https://github.com/Dormiveglia0/nhentai-archive/actions/workflows/ci.yml)

个人漫画归档与阅读应用。React 前端、FastAPI 后端和 SQLite 数据库打包在同一个 Docker 镜像里；配置、下载文件与阅读记录保存在本地。

- 发现与导入：远端搜索、标签筛选、详情预览、下载队列与创作者订阅。
- 我的库：本地 CBZ 导入、目录扫描、收藏、标签、元数据整理与导出。
- 阅读：单页与连续阅读、阅读进度、历史记录、缓存和本地／远端来源切换。
- 管理：媒体库、文件迁移、任务、词典、通知与访问密码。外部只读目录不会被自动改写。

## Docker Compose 部署

需要 Docker Engine 和 Compose v2。正式部署无需克隆源码或安装 Node/Python。

```bash
sudo mkdir -p /opt/nhentai
sudo chown "$(id -u):$(id -g)" /opt/nhentai
cd /opt/nhentai
curl -fsSL https://raw.githubusercontent.com/Dormiveglia0/nhentai-archive/main/compose.yaml -o compose.yaml
mkdir -p data
chmod 700 data
```

镜像发布在 [GitHub Container Registry](https://github.com/Dormiveglia0/nhentai-archive/pkgs/container/nhentai-archive)。包目前为私有；拉取前使用具有 `read:packages` 权限的 GitHub token 登录一次，token 从标准输入传入：

```bash
docker login ghcr.io -u YOUR_GITHUB_USERNAME
docker compose pull
docker compose up -d --wait
```

访问 **http://localhost:4349**。首次进入创建访问密码；没有默认密码或用户名。配置、密码验证值和设备会话持久保存在数据库中，重启不会清空。只应在可信网络直接开放 HTTP；公网访问请由反向代理提供 HTTPS。

| 配置 | 默认值 | 用途 |
| --- | --- | --- |
| `NH_ARCHIVE_IMAGE` | `ghcr.io/dormiveglia0/nhentai-archive:latest` | 镜像标签或 `@sha256:…` 摘要 |
| `NH_ARCHIVE_STORAGE` | `./data` | 宿主机数据目录，容器内固定为 `/data` |
| `NH_ARCHIVE_BIND` | `0.0.0.0` | 监听地址；仅本机使用可设为 `127.0.0.1` |
| `NH_ARCHIVE_PORT` | `4349` | 宿主机端口 |

这些值可以写在 Compose 目录的 `.env` 中。固定摘要可保证部署可复现；GitHub Actions 每次发布会在运行摘要中给出完整镜像摘要。本机正式部署使用固定摘要，更新时先修改 `.env` 的 `NH_ARCHIVE_IMAGE`。

```bash
docker compose pull
docker compose up -d --wait
docker compose logs --tail 100 app
docker compose down
```

`down` 停止服务，宿主机 `data/` 保留。容器根文件系统只读，临时文件在 `/tmp`；应用按宿主机数据目录的 UID/GID 运行。端口或存储目录已有自定义值时，更新需保留 `.env`。

## 数据与迁移

```text
/opt/nhentai/                 正式部署
├── compose.yaml
├── .env                     固定镜像摘要与部署配置
├── data/                    唯一正式数据根
│   ├── archive.db           配置、作品、标签、进度、会话与任务
│   ├── library/             下载和本地导入的 CBZ
│   ├── covers/              封面
│   ├── thumbs/              缩略图
│   ├── cache/archives/      阅读缓存
│   ├── tmp/                 下载与导出临时文件
│   └── exports/             导出文件
└── backups/                 私有迁移备份与核对记录
```

把本地 CBZ 放入 `data/library/`，再在应用中扫描媒体库。额外媒体目录需要通过 Compose 挂载到容器，并在设置中使用容器内路径；只读来源使用 `:ro` 挂载。API key、SMTP 与阅读偏好在设置中配置，不必写入源码或镜像。

从旧开发环境迁移时，先停止开发 API 和旧容器，生成一致性 SQLite 备份，然后**移动整个数据目录**到正式 `data/`。例如旧 Compose 使用 `.local-data/` 时，在已停服且 `data/` 不存在的目录执行 `mv .local-data data`。不要只移动数据库、遗漏下载文件，也不要将两套已有数据库直接合并。受管路径在数据库中使用相对路径；已有 `/data/...` 媒体库路径保持有效，外部目录需要单独核对挂载。

开发环境使用独立 `.local-data/`，不挂载正式数据。备份应在停服后包含数据库和原归档；本机迁移备份仅是回滚副本，不替代定期离机备份。数据库包含私密配置，不能上传 GitHub。

## 开发

需要 Python 3.11 和 Node.js 22。开发目录命名为 `nhentai-dev`，与 `/opt/nhentai` 正式部署分开。

```bash
git clone https://github.com/Dormiveglia0/nhentai-archive.git nhentai-dev
cd nhentai-dev
python3 -m venv .venv
.venv/bin/pip install -r apps/api/requirements-dev.txt
npm --prefix apps/web ci
npm run dev
```

默认 API 为 http://127.0.0.1:8001，Web 为 http://127.0.0.1:5173，按一次 `Ctrl+C` 关闭两者。`NH_ARCHIVE_API_PORT`、`NH_ARCHIVE_WEB_PORT` 可调整开发端口，代理会跟随 API 端口。开发数据默认保存在当前源码根的 `.local-data/`；不要设置为正式数据目录。开发页同样需要创建自己的访问密码。

```bash
npm run test                  # 临时数据目录里的 API 测试
npm run build                 # TypeScript 检查与 Web 构建
python3 scripts/dev.py --check
docker build -t nh-archive:dev .
python3 scripts/smoke_image.py nh-archive:dev
```

镜像检查使用自动创建并清理的临时数据，验证 Compose 启动、前端、认证、重启与 SQLite 持久化，不读取正式库。浏览器回归使用私有真实资料副本，具体约束见 [开发规则](docs/DEVELOPMENT_RULES.md)；CI 不注入漫画样本。

## CI/CD

[GitHub Actions](https://github.com/Dormiveglia0/nhentai-archive/actions/workflows/ci.yml) 在每次分支推送、Pull Request、`v*` 标签和手动运行时执行：

1. 安装锁定依赖，运行 API 测试，检查 TypeScript 并编译前端。
2. 保存 Web 构建产物，保留 7 天。
3. 构建 Linux amd64 Docker 镜像，用正式 Compose 和空白临时库检查认证、持久化与重启。
4. 检查成功后，通过仓库的 `GITHUB_TOKEN` 自动发布到 GHCR，无需另存个人 token。

每次推送发布 `sha-完整提交号` 和分支标签；`main` 同时更新 `latest`，`v1.2.3` 标签发布 `1.2.3`。Pull Request 只检查，不发布镜像。构建失败不会进入镜像发布阶段。本机正式服务通过 `compose pull` 和 `up` 更新；工作流不保存服务器 SSH 凭据或自动重启本机服务。

## 项目结构

| 路径 | 内容 |
| --- | --- |
| `apps/web/` | React 页面、Folio 视觉系统与浏览器回归 |
| `apps/api/app/` | FastAPI 路由、领域服务和 SQLite |
| `apps/api/tests/` | API 与服务测试 |
| `scripts/` | 开发启动和镜像检查 |
| `.github/workflows/ci.yml` | 检查、打包与镜像发布 |
| `docs/` | 模块地图、当前状态与维护约定 |

维护前先读 [AGENT_MAP.md](docs/AGENT_MAP.md)，再查阅 [PROJECT_MAP.md](docs/PROJECT_MAP.md) 与 [PROJECT_STATUS.md](docs/PROJECT_STATUS.md)。演示页是保留的视觉参考；正式功能使用真实 API，不提供样本作品。
