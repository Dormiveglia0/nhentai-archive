# 远端来源关联（Remote-Source Linkage）设计 spec

日期：2026-06-24
分支：`feat/lightweight-finishing`（或后续新分支）

## 背景与定位

此前路线图遗留两条「本地导入」边界（发现页 `upload` / `scan` surface）。本设计**取代**
它们，并重塑模型：

> 作品就是库目录里的一个 CBZ；它**可能**带一个远端 gallery 关联，也可能没有。
> 系统负责索引库目录里的文件、并保持远端关联与 tag 的新鲜。**不再区分「远端 vs 本地」。**

现状（已核实）：

- 远端导入时 `ImportService.run_remote_import` → `archive.ingest_cbz` 把**原始下载的
  CBZ 原样**存进库目录；身份（gallery id）只存数据库 `works.remote_gallery_id`，
  **不在文件内**。`comicinfo.COMICINFO_KEYS` 当前没有 Web/URL/Gallery 字段。
- 源 CBZ 唯一受认可的改写是治理 ComicInfo 原子回写（只换 ComicInfo.xml、不动图像
  字节、回写后同步 `work_files.sha256`/`size_bytes`）。
- 远端能力齐备：`client.search(query)`（模糊搜）、`client.gallery(id)`（重拉）、
  `discover.cache_gallery`/`cache_tags`、`dictionary.link_work_tags`。

三件事是一条链：**扫描库**产出本地作品（无 gallery id）→ **刮削**给它们匹配上
gallery id → **刷新 tag** 保持与远端同步。统一为「远端来源关联」主题，分三阶段实现。

## 决策（已与用户确认）

1. **来源身份写进文件**：从现在起把 `Web = https://nhentai.net/g/{id}/` 写进 CBZ 的
   ComicInfo，文件自描述。存量作品做**可选的一次性批量补写**（不强制全量回写）。
2. **刷新 tag 语义**：重拉的 tag 自动应用新增/变动、解除远端已删项；词典里人工配置/
   锁定的显示名绝不被覆盖。
3. **刮削确认**：模糊搜索 → 唯一且高相似度候选自动关联；多候选或低相似度转人工手选。

---

## 〇、来源身份写进文件

- `comicinfo.py`：`Web` 不是治理元数据字段，不进 `COMICINFO_KEYS` 的字段映射循环，
  而在 `build_fields` 末尾**特判注入**——调用方传入 `remote_gallery_id` 时写
  `<Web>https://nhentai.net/g/{id}/</Web>`；`to_xml` 的字段顺序补 `Web`。无 gallery
  id 的本地作品不写该字段。
- 导入路径：`ExportService` / 治理回写 / 扫描入库构建 ComicInfo 时统一带上 `Web`。
  （注意：当前导入存的是原始 CBZ、并不主动写 ComicInfo；`Web` 在「**首次治理回写**」
  或「**可选批量补写**」时落入文件，导入本身不强制改写原始下载档。）
- **存量补写（可选一次性动作）**：治理批量动作新增「补写来源标识」——对带
  `remote_gallery_id` 但 ComicInfo 缺 `Web` 的作品执行 ComicInfo 原子回写注入 `Web`。
  复用既有 `write_back_comicinfo`（原子替换 + sha256/size 同步）。默认不自动跑。

理由：存量身份数据库已有，扫描不依赖文件；文件自描述主要服务「文件被拷走/数据库丢失
后仍能复原」，故补写按需、不强制全量动盘。

---

## 一、扫描库（`library_scan`，取代本地导入边界）

新 `LibraryScanService`（本地文件系统 + SQLite + 复用 `ArchiveService`，**只在确认关联
后才调 NH API**）：

### 扫描（只读预览）
- 遍历 `settings.library_dir` 下所有 `*.cbz`，比对 `work_files`（kind=`source_cbz`）
  的归一化 `.resolve()` 路径集合，得出**未被引用**的文件。
- 对每个未引用文件：
  - 若 sha256 已存在于 `work_files`（同一文件被移动/改名）→ 标 `already_known`
    （可选：把现有 work 的 path 指向新位置，作为「重定位」，默认只报告不自动改）。
  - 读内嵌 ComicInfo：解析 `Web` → gallery id。有 → 候选「远端关联入库」；无 →
    候选「裸本地入库」。
  - 非法/损坏 zip → 标 `unreadable`，跳过。
- 返回预览：`{new_linked, new_local, already_known, unreadable}` 计数 + 明细。

### 入库（后台任务 `library_scan`）
- 仿 `ExportJobService` 的 daemon `threading.Thread` + `JobService`，类型 `library_scan`，
  导出专属字段塞 `target_json`（待入库文件列表/进度/skipped）。
- 逐文件 `jobs.checkpoint`（支持暂停/取消）→ `archive.ingest_cbz`：
  - 有 gallery id：`source="remote"`, `remote_gallery_id=<id>`，并 `discover` 重拉
    gallery（走「一、刷新 tag」路径补元数据/tag，可选）。
  - 无 gallery id：`source="local"`, `remote_gallery_id=None`，仅建页/封面/sha 索引，
    作为「待刮削」本地作品。
- 损坏/失败文件记入 `skipped`，不中断整批。
- 完成回 `{ingested, skipped}`。
- `archive.ingest_cbz` 已支持页/封面/sha 提取；需要的新增点是「本地无 gallery id」的
  入库变体（`remote_gallery_id=None` 时 `ON CONFLICT` 走不到，需走普通 INSERT 分支）。

### 范围
- **只新增**：把磁盘上有、DB 没有的 CBZ 索引进来。
- 文件被删 / 体积不符 / 漂移仍由现有**文件管理** `missing_source` 等负责，不在此重复。

---

## 二、刷新远端 tag（`tag_refresh`）

针对带 `remote_gallery_id` 的作品：

- 新 `RemoteLinkService.refresh_tags(work_id)`：`client.gallery(id, include="related")`
  → `discover.cache_gallery` / `cache_tags` → `dictionary.link_work_tags(work_id, tags)`。
- **语义（已定）**：
  - 远端新增 tag → 自动 `link_work_tags` 关联。
  - 远端已删 tag → 从 `work_tags` 解除关联（`link_work_tags` 需支持「以远端为准的
    全量重设」语义：保留人工锁定行、增删非锁定行）。
  - 词典里人工配置/锁定的显示名（`status` human/locked）**绝不**被机器覆盖——沿用
    `link_work_tags` 既有「不覆盖人工/锁定」不变量。
- 范围**只限 tag**；自由文本元数据（title/summary 等）仍走治理人工，不自动覆盖。
- 单作品：治理页「远端来源」面板「刷新远端 tag」按钮（同步，单作品快）。
- 批量：治理队列多选 → 量大走后台任务 `tag_refresh`（仿 import 线程模型，逐作品
  checkpoint，单作品失败记 error 继续）。

> `link_work_tags` 当前是否支持「解除远端已删项」需在实现期确认；若仅支持增量关联，
> 则刷新时改为：拉取远端 tag 全集 → 对该 work 的非锁定 `work_tags` 做差集增删。

---

## 三、元数据刮削（模糊匹配，无 gallery id 作品）

针对 `remote_gallery_id IS NULL` 的本地作品：

- `RemoteLinkService.scrape_match(work_id)`：query 取 `title_japanese`（优先）/`title`
  → `client.search(query)` 取候选 gallery summary（封面/标题/页数/ID）。
- **置信规则（已定）**：归一化标题（去空白/符号/大小写）算相似度
  （`difflib.SequenceMatcher` 比值，stdlib 无新依赖）。
  - **唯一**候选且相似度 ≥ `SCRAPE_AUTO_THRESHOLD`（建议 0.9）→ 自动
    `link_gallery(work_id, gallery_id)`。
  - 否则返回 Top N 候选（带相似度）供人工手选，UI 渲染候选画廊卡，点选触发
    `link_gallery`。
- `RemoteLinkService.link_gallery(work_id, gallery_id)`：写 `works.remote_gallery_id`
  → 走「二、刷新 tag」补 tag + `cache_gallery`（供治理取元数据）→ 按需 ComicInfo 回写
  注入 `Web`（沿用〇的可选回写）。
  - 防冲突：目标 gallery_id 已被别的 work 占用（`remote_gallery_id` UNIQUE）→ 报错、
    不关联。
- 批量：只自动关联「唯一高置信」项，多候选/低置信汇总成复核列表交人工逐个手选。
  量大走后台任务（与扫描共用 job 基础设施）。

---

## 四、服务与路由

- 新 `RemoteLinkService`（持有 `refresh_tags` / `scrape_match` / `link_gallery`），
  依赖 `client` / `discover` / `dictionary` / `archive`；与 `ImportService`（只管下载
  新作）分离、不耦合。
- 新 `LibraryScanService`（扫描预览）+ 后台 job worker（`library_scan` /
  `tag_refresh`，仿 `ExportJobService`）。
- 路由：
  - `POST /api/library/scan/preview`（只读扫描预览）。
  - `POST /api/library/scan`（入队 `library_scan` 任务）。
  - `POST /api/works/{id}/remote/refresh-tags`（单作品同步刷新）。
  - `POST /api/works/{id}/remote/scrape`（返回候选或自动关联结果）。
  - `POST /api/works/{id}/remote/link`（body `{gallery_id}` 人工手选关联）。
  - 批量刷新/刮削入队 → 复用 `/api/jobs` 的 resume/cancel/retry（`_job_dispatch` 增
    新 job 类型分流，与 bulk_export 同模式）。
  - 治理批量「补写来源标识」复用现有 `POST /api/governance/bulk/apply` 动作扩展。

## 五、前端

- 文件管理页：新增「扫描库」入口 → 预览（新增/已知/不可读计数）→ 确认入队任务。
- 治理页新增「远端来源」面板：
  - 已关联（有 gallery id）：显示 gallery id + 链接 + 「刷新远端 tag」按钮。
  - 未关联：「刮削匹配」按钮 → 自动关联结果提示，或候选画廊选择器（封面/标题/页数/
    相似度，点选关联）。
- 治理队列多选：批量刷新 tag / 批量刮削（高置信自动 + 低置信复核列表）/ 批量补写来源
  标识。
- 任务中心：`library_scan` / `tag_refresh` 行渲染进度与 skipped 摘要（复用 bulk_export
  的行渲染范式）。
- `api.ts` 补上述端点与 `Job["target"]` 新类型字段。

## 关键不变量

- 源 CBZ 只读；唯一改写仍是治理 ComicInfo 原子回写（现在多注入一个 `Web` 字段），
  回写后同步 sha256/size。
- 词典人工配置/锁定的显示名永不被机器刷新覆盖。
- 模糊匹配低于高阈值绝不自动关联；自动关联只在「唯一 + 高相似度」时发生。
- 扫描只新增、不删；删除/漂移仍归文件管理。
- `remote_gallery_id` UNIQUE：关联前防一个 gallery 被两部本地作品占用。
- 全站显示的 tag 仍走词典 `display`；英文原文只用于 NH API 请求。

## 不做（YAGNI）

- 自动定时扫描/刷新（仅手动触发；无后台调度器）。
- 多来源刮削（仅 nhentai）。
- 刷新时自动覆盖自由文本元数据（仍走治理人工）。
- 强制全量存量补写（补写是可选动作）。
- 单文件级别断点续传（任务取消即整批重来，沿用现有 job 语义）。
- 模糊匹配的可配置阈值（用常量）。

## 验证计划

- 后端单测：
  - comicinfo：`Web` 字段注入/顺序；无 gallery id 不写 `Web`。
  - LibraryScanService：预览分类（新增 linked/local、already_known、unreadable）；
    入库任务 ingest/skip；本地无 gallery id 入库变体。
  - RemoteLinkService：refresh_tags 增量关联 + 解除已删 + 不覆盖锁定；scrape_match
    高置信自动 / 多候选返回；link_gallery 防 UNIQUE 冲突。
  - 路由：单作品 refresh/scrape/link 成功与错误映射；批量 job 按类型分流。
- 前端 `npm run build` 通过；任务中心新 job 行渲染。
- `PYTHONPATH=backend .venv/bin/pytest backend/tests -q` 全绿。

## 决策记录

- 取消「远端/本地」二分；库目录是唯一真相源，作品按「是否带 gallery 关联」区分而非
  按来源。旧「本地目录导入」边界由「扫描库」取代。
- 来源身份写进 ComicInfo `Web` 字段，文件自描述；存量补写可选、不强制全量动盘。
- 刷新 tag 自动应用远端变动（增删），但保护人工锁定显示名；范围只限 tag。
- 刮削用 stdlib `difflib` 算标题相似度，唯一高置信自动关联、否则人工手选；关联即复用
  刷新路径补 tag/元数据。
- 后台任务（library_scan / tag_refresh）复用 `JobService` + 线程模型，不改表结构，
  专属字段塞 `target_json`，与 bulk_export 同范式。
