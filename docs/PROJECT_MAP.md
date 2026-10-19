# NH Archive Project Map

## 本地与远端标签展示去重（2026-10-19）

- `work_tag_display.visible_work_tags` 在同一作品、同一类别内合并显示名重复的来源，归一空白与大小写；CBZ原名通过该作品已知词典译名对应远端标签。优先保留远端记录的链接，合并后仍暴露冲突或待确认状态，不修改原始行。
- `LibraryService._attach_tags`、`GovernanceService` 的标签/当前字段/检查计数及 `LibraryGroupService.tags` 共用该规则。分组标签每部作品只计一次；整理队列复用单部检查计数，原始标签仍完整参与核对指纹。
- 48项聚焦回归通过；私有真实库的详情、标签跳转和整理字段在1440、1365、390、320宽度检查通过。只读备份核对6117条来源记录，642组重复显示已消除。无schema迁移、新依赖或源文件回写。

## 刮削审批并入整理（2026-10-18最新修正）

- `GovernancePage` 提供作品整理与刮削审批两个视图，审批组件移到 `governance/ScrapeReviewQueue.tsx`，只挂载当前视图；统一入口为 `#governance?view=scrape`，旧 `#scrape` 及其筛选参数兼容。库和扫描状态的审批链接同步更新。
- 审批复用 `GovernanceWorkHeader` 展示当前封面、`MetadataCard` 展示来源对照与最终值；作者/社团/标签词典建议和多选语言沿用整理控件。语言键去除远端词条的附加说明，避免同一种语言生成重复选项。
- `GovernanceService.work_governance` 新增可空 `remote`，只返回已绑定作品的本地缓存字段，不请求远端或改变源资料；无schema迁移。审批保存后保留当前作品，重读整理数据与来源版本，再允许继续编辑或处理。
- `scrape-review.spec.ts` 在私有真实归档副本验证四种宽度、旧入口、封面解码、词典/语言、连续保存、远端绑定后资料及导航；写入测试要求显式指定 `/tmp/nh-governance-review-*`。

## 刮削与分组卡片优化（2026-10-18）

- 整理页的 `MetadataEditor` 在同一个元数据区域切换“编辑字段 / 刮削元数据”，保留未保存修改拦截和忙碌状态；不再在作品标题下插入独立折叠模块。`MetadataScrapePanel` 在整理、审批和上传中复用透明嵌入样式，按容器宽度排列候选与字段对比。
- `WorkGroupCard` 首次从实际可用封面中随机选择一张后固定；已按最新要求删除轮播、预载和相关状态。正文显示实际作品总数与封面作品名，底部复用普通作品的 `folio-library-read-action`；标题/按钮规则须覆盖全局按钮字体重置。
- `LibraryGroupService.tags` 批量汇总当前筛选匹配的组成员标签；本地/远端重复记录及同一词典身份别名在每部作品中只计一次。`/api/library/search` 的 `group.tags` 包含 `key/display/count`，前端复用单行 `TagScroller`，数量以12px深色基线文字显示，隐藏滚动条。无数据库迁移或新依赖。
- 词典补译为一次经核对的数据操作，不增加内置题材词库：70条中文译名、26条专名保留原文，其他类别与已有有效译名保持原样；备份与操作记录在正式部署目录的 `backups/20261018-tags-scrape-groups/`。

## 导入、整理与分组（2026-10-18）

- 需求及验收顺序见 [CURRENT_REQUIREMENTS.md](CURRENT_REQUIREMENTS.md)。
- `nhentai_client.py` 统一缓存外请求节流，后台刮削使用低优先级上下文，遵守冷却与取消；`file_identity.py` 将文件系统无符号64位标识无损映射为SQLite有符号整数。归档可读但无法生成安全封面时保留作品和提示。
- `library_scan_runs.progress_json` 保存阶段、当前路径、真实计数及最近20条操作；`MediaLibraryActivity` 展示进度、控制与历史。`metadata_refresh_service.py` 提供保存候选的审批清单、指定来源、版本校验与决定；手动审批在同一事务中保存元数据和完成状态。
- `libraryLocation.ts` / `useLibraryState.ts` 负责库内筛选、分页、视图和滚动历史；翻页使用 pushState，滚动保存节流。
- `GovernancePage` 集中刮削、双来源控制、词典建议和语言多选。人工作者/社团/标签/语言同时写入元数据和标签关联，后台同步及重扫保留人工值。
- `source_rename_service.py` / `source_renames`：同目录、保留扩展名、Linux原子无覆盖重命名，复用来源锁、缓存锁和在用检查；执行前持有数据库写锁复查。持久化准备记录先于文件变更，失败回滚，启动恢复后才启动扫描。更新原有索引与文件关联，保留身份和阅读状态；不支持安全重命名的文件系统拒绝操作。
- `library_group_service.py` / `work_groups` / `work_group_members`：一个作品最多属于一个手动组，成员外键随作品删除清理；分组变更参与库版本通知，并校验组版本。聚合匹配作品的轻量索引后分页，批量选择仅包括当前筛选匹配的成员。作者身份结合远端ID、词典和别名，按完整作者集合归组，手动组优先。
- 新增 `/api/library/groups` 创建与组详情/修改/解散接口；`/api/library/search` 可选 `group_by` / `group_key`，默认保持旧的逐部返回。`WorkGroupCard` 提供首次随机固定封面，`WorkGroupDialog` 管理组内作品。
- `/api/works/{id}/source-rename`、`/api/library/scrape-queue` 及决定接口均沿用应用认证。审批现归属整理页，旧 `#scrape` 仅为兼容入口。

## 网页上传与文件权限（2026-10-17）

- `library/UploadDialog.tsx` 与 `UploadDialog.css`：我的库上传入口，ZIP / CBZ 目标库选择、自动匹配与手动填写；复用 `MetadataScrapePanel` 的搜索、候选比较和确认。
- `POST /api/library/upload` → `upload_service.py`：流式接收、2 GB 上限、归档校验与临时目录回收，通过 `ArchiveService.ingest_cbz(index_source=True)` 保存 CBZ 并建立来源索引。上传后的匹配始终需确认；上传索引不进入后台自动刮削队列。无数据库迁移。
- 媒体库配置新增 `allow_writeback` / `allow_delete`，仅挂载模式使用，默认关闭；删除预览、执行和治理回写分别检查对应权限。原有来源版本、在用保护与路径校验保留。
- 文件标题左侧显示数量状态，右侧固定短文案操作；派生文件用“批量”进入整行选择，受保护记录仅显示原因。


当前模块定位先读 [AGENT_MAP.md](AGENT_MAP.md)。当前状态见 [PROJECT_STATUS.md](PROJECT_STATUS.md)，本次页面布局记录见 [SITE_LAYOUT_REFINEMENT.md](SITE_LAYOUT_REFINEMENT.md)。媒体库架构和上一版发布证据分别见 [MEDIA_LIBRARY_UPDATE.md](MEDIA_LIBRARY_UPDATE.md)、[READER_MEDIA_EXPERIENCE_UPDATE.md](READER_MEDIA_EXPERIENCE_UPDATE.md)。

## 运行与部署

- React/TypeScript/Vite 前端：`apps/web/`；FastAPI/SQLite 后端：`apps/api/`。
- 根目录 `npm run dev` 调用 `scripts/dev.py`，同时启动8001 API和5173 Web；端口可由 `NH_ARCHIVE_API_PORT` / `NH_ARCHIVE_WEB_PORT` 覆盖。
- 开发源码目录为 `nhentai-dev`，测试数据在独立 `.local-data/`；正式部署 `/opt/nhentai` 仅保存 Compose、`data/` 和 `backups/`，不得提交源 CBZ、封面、缓存、密钥或数据库。
- `.github/workflows/ci.yml` 每次推送/PR运行API测试、Web构建和 `scripts/smoke_image.py` 的隔离Compose检查；推送通过后发布GHCR分支/SHA标签，main同时发布latest，版本标签发布对应版本。
- `Dockerfile` 构建前端并封装API运行模块；测试依赖独立在 `requirements-dev.txt`。`compose.yaml` 拉取已发布镜像，无本地build，固定列出容器名、`4349:8000` 和 `./data:/data`，自定义时直接编辑这几行。正式服务4349，健康检查 `/api/health`。
- 正式部署使用注册表 `:latest` 镜像，发布记录保存实际摘要用于核对与回滚。保存上一镜像与一致性 SQLite 备份，验证源文件、作品、进度、会话与认证保留；正式数据库不作为功能测试库。

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
| 文件与导出 | `file_service.py`、`local_metadata_service.py`、`export_service.py`；文件及派生数据清单、受限派生文件查看/下载、本地元数据与索引查看、所有权检查、批量清理预览、下载流；导出不改源文件 |
| 任务 | `job_service.py` 与匹配的 job 服务；持久状态、检查点、暂停/恢复、取消、重试和日志 |
| 订阅与邮件 | `subscription_service.py`、`notification_service.py`；完整初始基线、增量更新、租约/CAS、近期预览、持久发件箱、私密SMTP配置 |
| 认证 | `auth_service.py`；单密码、scrypt、90天 HttpOnly/SameSite 会话、变更撤销其他会话、限流 |

媒体库文件状态API返回归档标题和已保留的ComicInfo/JSON。`GET /api/files/metadata` 与 `metadata/{work|item}/{id}` 展示作品及未关联扫描资料；`metadata/preview-delete`、`metadata/delete` 分别预览并重新校验清理作品资料、扫描索引或失效旧文件关联。源文件和扫描日志不删除，离线/待检查/仍有可用来源拒绝整部清理；复用文件服务的阅读、租约、任务与共享路径保护。`GET /api/files/derived` 分页列出应用数据目录下的封面、缩略图、页面/归档缓存；缓存清理保留作品数据，当前封面与在用文件受保护。旧 `DELETE /api/library/directories/{library_id}/items/{item_id}` 保留兼容，但前端统一进入元数据页处理。

`PATCH /api/settings` 的 `downloads.default_library_id` 只接受已启用且可接收下载的库；目标失效时下载明确失败。`MediaLibraryService._source_lock` 复用为扫描和归档发布的互斥锁，避免扫描抢先建立另一作品。

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
- 文件页五个子页为媒体库、文件、元数据、派生文件、迁移。媒体库缺失及保留资料计数直接进入 `#files?view=metadata&library_id=…&status=…`；扫描历史与文件异常仍在媒体库状态列表。元数据详情提供保存字段/标签/ComicInfo/归档JSON/页面目录/阅读状态与派生路径、JSON导出、编辑/恢复入口和清理预览；不是日志删除。`#files?view=derived&work_id=…` 展示该作品的实际派生文件；来源只读、离线和在用限制不绕过。`useFilesState.ts` 继续接受 `#files?view=files&status=…`。存储摘要统一数值字号与Folio链接样式。
- 首页最多6部真实本地作品4秒轮播，后台/离屏/焦点/减少动态效果暂停；右下方显示4部最新远端作品，桌面一屏展示。阅读保存后刷新数据并保持当前作品ID。
- 发现常驻作品、更新、订阅三个选项卡，更新项显示真实未读数；作品区域全宽，筛选不能覆盖其他视图的链接。订阅行附实际近期作品。
- 本地原生详情弹窗保留自然比例封面。打开远端详情时先准备数据，再先出后入交接，避免两套标题重叠；只有目标页挂载。
- 整页加载占位与2px详情等待条使用独立类名。详情只捕获整幅画面；页面截图过渡时跳过组件入场，防止重影、空白和几何缩放。
- 连续阅读由 `reader/WebtoonView.tsx` 在布局阶段恢复页码；原图未加载时预留已知页面尺寸，解码后恢复自然大小；恢复期间不接受占位几何回写，目标解码后校正列表底部受限的定位；用户开始滚动或键盘操作后正常保存进度。远端页面尺寸由 `useReaderData.ts` 保留，不能在DTO转换时丢弃。实际进度恢复回归见 `reader-scroll.spec.ts`。

## 验证

后端：`PYTHONPATH=apps/api .venv/bin/pytest apps/api/tests -q`。`tests/conftest.py` 在加载应用前分配临时数据根，禁止用正式数据跑测试。
前端：`npm --prefix apps/web run build`、`git diff --check`，以及隔离真实副本的 Playwright；真实写入/迁移/SMTP检查必须满足各用例的 `/tmp` 目录约束。
