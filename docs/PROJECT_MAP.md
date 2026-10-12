# NH Archive Project Map

当前模块定位先读 [AGENT_MAP.md](AGENT_MAP.md)。当前状态见 [PROJECT_STATUS.md](PROJECT_STATUS.md)，本次页面布局记录见 [SITE_LAYOUT_REFINEMENT.md](SITE_LAYOUT_REFINEMENT.md)。媒体库架构和上一版发布证据分别见 [MEDIA_LIBRARY_UPDATE.md](MEDIA_LIBRARY_UPDATE.md)、[READER_MEDIA_EXPERIENCE_UPDATE.md](READER_MEDIA_EXPERIENCE_UPDATE.md)。

## 运行与部署

- React/TypeScript/Vite 前端：`apps/web/`；FastAPI/SQLite 后端：`apps/api/`。
- 根目录 `npm run dev` 调用 `scripts/dev.py`，同时启动8001 API和5173 Web；端口可由 `NH_ARCHIVE_API_PORT` / `NH_ARCHIVE_WEB_PORT` 覆盖。
- 开发源码目录为 `nhentai-dev`，测试数据在独立 `.local-data/`；正式部署 `/opt/nhentai` 仅保存 Compose、`data/` 和 `backups/`，不得提交源 CBZ、封面、缓存、密钥或数据库。
- `.github/workflows/ci.yml` 每次推送/PR运行API测试、Web构建和 `scripts/smoke_image.py` 的隔离Compose检查；推送通过后发布GHCR分支/SHA标签，main同时发布latest，版本标签发布对应版本。
- `Dockerfile` 构建前端并封装API运行模块；测试依赖独立在 `requirements-dev.txt`。`compose.yaml` 拉取已发布镜像，无本地build，固定列出容器名、`4349:8000` 和 `./data:/data`，自定义时直接编辑这几行。正式服务4349，健康检查 `/api/health`。
- 正式部署使用注册表镜像并固定摘要。保存上一镜像与一致性 SQLite 备份，验证源文件、作品、进度、会话与认证保留；正式数据库不作为功能测试库。

## 后端所有者

| 层 | 所有者与职责 |
| --- | --- |
| 入口与组装 | `app/main.py`、`container.py`、`config.py`；统一服务注册、启动/关闭、环境配置 |
| HTTP | `app/api/` 的 auth、discover、library、works、files、governance、dictionary、exports、jobs、settings、subscriptions 与 system；校验输入，调用对应服务 |
| 数据库 | `database.py`；WAL、外键、5秒 busy timeout、索引、旧schema升级与便携受管路径 |
| 远端 | `nhentai_client.py`、`discover_service.py`；真实分页、标签、详情、CDN代理、请求缓存/429退避，批量查询导入状态 |
| 库与导入 | `library_service.py`、`import_service.py`、`archive_service.py`；真实作品、标签、归档解析与去重 |
| 媒体库 | `media_library_service.py`、`library_index_service.py`、`library_scan_service.py`、`library_monitor_service.py`；目录、只读属性、增量索引、监控与补偿 |
| 迁移 | `library_migration_service.py`；只迁移独立本地导入，预览、复制/移动、冲突、哈希验证、事务切换来源，保留作品ID与进度 |
| 阅读 | `reader_service.py`、`archive_cache_service.py`、`reader_bridge_service.py`；进度、可见时长、版本缓存/直接读取、逐页核验与双来源 |
| 治理 | `governance_service.py`、元数据/翻译服务；字段、标签、人工核对、语言与置信度刮削，显式选择的 ComicInfo 原子回写 |
| 词典 | `dictionary_service.py` 与翻译服务；候选、预览、映射及证据 |
| 文件与导出 | `file_service.py`、`export_service.py`；所有权检查、删除预览、下载流；导出不改源文件 |
| 任务 | `job_service.py` 与匹配的 job 服务；持久状态、检查点、暂停/恢复、取消、重试和日志 |
| 订阅与邮件 | `subscription_service.py`、`notification_service.py`；完整初始基线、增量更新、租约/CAS、近期预览、持久发件箱、私密SMTP配置 |
| 认证 | `auth_service.py`；单密码、scrypt、90天 HttpOnly/SameSite 会话、变更撤销其他会话、限流 |

媒体库文件状态API返回归档标题和已保留的ComicInfo/JSON；`DELETE /api/library/directories/{library_id}/items/{item_id}` 只移除缺失索引，不删除源文件或关联作品。`PATCH /api/settings` 的 `downloads.default_library_id` 只接受已启用且可接收下载的库；目标失效时下载明确失败。`MediaLibraryService._source_lock` 复用为扫描和归档发布的互斥锁，避免扫描抢先建立另一作品。

文件名以 `rg --files apps/api/app/services` 为准；不要另造平行服务或在路由里写业务逻辑。

## 数据边界与兼容

- `works` 为作品身份，`work_files` 指向来源；旧独立导入继续可读。媒体库增加 `media_libraries`、`library_items`、扫描/事件等表，并通过可空 `library_item_id` 关联旧来源。默认下载目标保存为设置；下载只把最终CBZ写入所选可写媒体库，派生数据仍在`/data`。
- 受管源和封面在库内持久保存 `library/...` / `covers/...`；读取时按当前数据根解析。启动转换可识别的旧 `.local-data/...` 与 `/data/...` 绝对路径。外部媒体库的用户目录不随环境静默改写。
- 缺失旧来源不能遮蔽仍有效的已索引来源。只读/离线来源不能被误删或回写；删除必须显示拒绝原因。
- `reader_progress`、`reading_history`、本地/远端 `reading_sessions` 保留独立语义；远端普通阅读不写本地进度。来源版本变化后拒绝过期页、缩略图、会话与进度请求。
- 缓存受配额、空闲期限、保留空间和租约保护；关闭缓存的挂载读取有并发上限。逐页内容相同的核验才允许远端画面过渡到本地，不凭页数或标题判断一致。
- 订阅的 `recent_json` 保存最近页的实际作品，升级只重新排队启用订阅，不清空 seen/已读/通知/配置，重复启动不再重排。未知原文标题不合并，不合并不同卷/章节。
- 同一 gallery 的作者/社团更新在全局列表合并，已读操作覆盖其各订阅记录。SMTP 密码只返回是否配置；后台异常日志不泄露密码。
- 清理源文件与治理回写均走已有预览和权限流程。旧 `#export`、`#discover?view=updates`、来源筛选API保留兼容；退役的是展示原型和未引用场景。

## 前端所有者

- `App.tsx`：认证后的hash路由、懒加载、详情数据准备与阅读器隔离。
- `components/layout/ArchiveShell.tsx`：正式 shell；`components/folio/`：8项导航、原标志、控件和共用CSS。额外顶部更新入口和边角装饰已退役。
- 正式 feature、数据 hooks 与CSS精确定位见 AGENT_MAP 表；`lib/api.ts`统一DTO与缓存失效，`lib/navigation.ts`统一链接。
- 媒体库缺失计数直接打开 `MediaLibrariesSection` 的状态列表；扫描历史在列表下方折叠。`useFilesState.ts` 接受 `#files?view=files&status=…`，设置中的问题指标直接跳入对应文件筛选，文件健康计数复用现有筛选状态。
- 首页最多6部真实本地作品4秒轮播，后台/离屏/焦点/减少动态效果暂停；右下方显示4部最新远端作品，桌面一屏展示。阅读保存后刷新数据并保持当前作品ID。
- 发现常驻作品、更新、订阅三个选项卡，更新项显示真实未读数；作品区域全宽，筛选不能覆盖其他视图的链接。订阅行附实际近期作品。
- 本地原生详情弹窗保留自然比例封面。打开远端详情时先准备数据，再先出后入交接，避免两套标题重叠；只有目标页挂载。
- 整页加载占位与2px详情等待条使用独立类名。详情只捕获整幅画面；页面截图过渡时跳过组件入场，防止重影、空白和几何缩放。
- 连续阅读由 `reader/WebtoonView.tsx` 在布局阶段恢复页码；原图未加载时预留已知页面尺寸，解码后恢复自然大小；恢复期间不接受占位几何回写，目标解码后校正列表底部受限的定位；用户开始滚动或键盘操作后正常保存进度。远端页面尺寸由 `useReaderData.ts` 保留，不能在DTO转换时丢弃。实际进度恢复回归见 `reader-scroll.spec.ts`。

## 验证

后端：`PYTHONPATH=apps/api .venv/bin/pytest apps/api/tests -q`。`tests/conftest.py` 在加载应用前分配临时数据根，禁止用正式数据跑测试。
前端：`npm --prefix apps/web run build`、`git diff --check`，以及隔离真实副本的 Playwright；真实写入/迁移/SMTP检查必须满足各用例的 `/tmp` 目录约束。
