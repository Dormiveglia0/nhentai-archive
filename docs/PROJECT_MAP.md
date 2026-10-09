# NH Archive Project Map

当前模块定位先读 [AGENT_MAP.md](AGENT_MAP.md)。当前状态见 [PROJECT_STATUS.md](PROJECT_STATUS.md)，本次页面布局记录见 [SITE_LAYOUT_REFINEMENT.md](SITE_LAYOUT_REFINEMENT.md)。媒体库架构和上一版发布证据分别见 [MEDIA_LIBRARY_UPDATE.md](MEDIA_LIBRARY_UPDATE.md)、[READER_MEDIA_EXPERIENCE_UPDATE.md](READER_MEDIA_EXPERIENCE_UPDATE.md)。

## 运行与部署

- React/TypeScript/Vite 前端：`apps/web/`；FastAPI/SQLite 后端：`apps/api/`。
- 根目录 `npm run dev` 调用 `scripts/dev.py`，同时启动8001 API和5173 Web；端口可由 `NH_ARCHIVE_API_PORT` / `NH_ARCHIVE_WEB_PORT` 覆盖。
- 运行数据位于根 `.local-data/`；不得提交源 CBZ、封面、缓存、密钥或数据库。
- `Dockerfile` 构建前端并封装API；`compose.yaml` 保持 `.local-data:/data`。正式服务4349，健康检查 `/api/health`。
- 部署必须从当前工作树构建。保存旧镜像与一致性 SQLite 备份，验证源文件、作品、进度、会话与认证保留；正式数据库不作为功能测试库。

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

文件名以 `rg --files apps/api/app/services` 为准；不要另造平行服务或在路由里写业务逻辑。

## 数据边界与兼容

- `works` 为作品身份，`work_files` 指向来源；旧独立导入继续可读。媒体库增加 `media_libraries`、`library_items`、扫描/事件等表，并通过可空 `library_item_id` 关联旧来源。
- 受管源和封面在库内持久保存 `library/...` / `covers/...`；读取时按当前数据根解析。启动转换可识别的旧 `.local-data/...` 与 `/data/...` 绝对路径。外部媒体库的用户目录不随环境静默改写。
- 缺失旧来源不能遮蔽仍有效的已索引来源。只读/离线来源不能被误删或回写；删除必须显示拒绝原因。
- `reader_progress`、`reading_history`、本地/远端 `reading_sessions` 保留独立语义；远端普通阅读不写本地进度。来源版本变化后拒绝过期页、缩略图、会话与进度请求。
- 缓存受配额、空闲期限、保留空间和租约保护；关闭缓存的挂载读取有并发上限。逐页内容相同的核验才允许远端画面过渡到本地，不凭页数或标题判断一致。
- 订阅的 `recent_json` 保存最近页的实际作品，升级只重新排队启用订阅，不清空 seen/已读/通知/配置，重复启动不再重排。未知原文标题不合并，不合并不同卷/章节。
- 同一 gallery 的作者/社团更新在全局列表合并，已读操作覆盖其各订阅记录。SMTP 密码只返回是否配置；后台异常日志不泄露密码。
- 清理源文件与治理回写均走已有预览和权限流程。旧 `#export`、`#discover?view=updates`、来源筛选API保留兼容；退役的是展示原型和未引用场景。

## 前端所有者

- `App.tsx`：认证后的hash路由、懒加载、详情数据准备与阅读器隔离。
- `components/layout/ArchiveShell.tsx`：正式 shell 与更新提示；`components/folio/`：导航、SVG边角、控件和共用CSS。
- 正式 feature、数据 hooks 与CSS精确定位见 AGENT_MAP 表；`lib/api.ts`统一DTO与缓存失效，`lib/navigation.ts`统一链接。
- 首页6部真实本地作品轮播，后台/离屏/焦点/减少动态效果暂停；下面显示最新远端作品。历史设计原型不再作为入口。
- 发现旁常驻实际更新，全站显示未读；订阅行附实际近期作品。阅读器全幅图片与覆盖控件保留。
- 本地原生详情弹窗保留自然比例封面。打开远端详情时先准备数据，再通过轻淡入交接；只有目标页挂载。

## 验证

后端：`PYTHONPATH=apps/api .venv/bin/pytest apps/api/tests -q`。`tests/conftest.py` 在加载应用前分配临时数据根，禁止用正式数据跑测试。
前端：`npm --prefix apps/web run build`、`git diff --check`，以及隔离真实副本的 Playwright；真实写入/迁移/SMTP检查必须满足各用例的 `/tmp` 目录约束。
