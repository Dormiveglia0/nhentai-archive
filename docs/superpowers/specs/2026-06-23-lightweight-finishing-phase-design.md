# 轻量收尾阶段 · 设计

**日期**: 2026-06-23
**状态**: 已批准设计,待出实施计划
**范围**: 三个独立小组件,共一个 spec/plan/subagent 周期

## 背景与目标

主模块均已是真实页面。剩余三项收尾工作合为一个「轻量收尾阶段」:

1. **文件清单分页 UI** — 后端已支持分页,前端缺翻页器。
2. **阅读历史专属页** — `reading_history` 表已被写入,但无查询/接口/页面。
3. **治理批量预览/应用** — 现治理为单作品循环,补可批量的统一动作。

明确**不在本阶段**:批量导出接任务中心(重活,且与「导出=下载给用户、绝不写服务器目录」决策冲突,需单独 brainstorm 落盘语义后另立阶段);词典 review/冲突的批量解决(逐标签人工判断,不可安全批量)。

## 全局约束(Global Constraints)

- 所有数据来自 SQLite / 本地归档;`LibraryService` 与历史查询**绝不调 NH API**。
- 全站页内 tag 显示走词典 `display`(`zh_name → name → slug`);英文仅后端 NH 请求用。
- 治理批量沿用单作品回写的风险模型:仅 ComicInfo、原子替换、无备份、回写后同步 `work_files.sha256`/`size_bytes`、显式 opt-in 默认关、失败不回滚。
- 批量补全**只填空**:仅当字段终值规范化后为空且存在来源值时写入;**绝不覆盖**已有人工/非空值。
- 失败隔离:批量中单个作品出错不得中断其余作品。
- 封面显示一律遵守全局 `blurCovers` 隐私开关。
- 不引入新依赖;TS/CSS/Python/SQLite 现有栈。

---

## 组件 1 · 文件清单分页(纯前端)

### 现状
- 后端 `FileMaintenanceService.inventory(category, q, status, page=1, per_page=50)` 已分页,`per_page` 上限 500;返回 `{result, total, page, per_page}`(`backend/app/services/file_service.py:176`)。
- API `GET /api/files/inventory` 已透传 `page/per_page`(`backend/app/main.py:442`)。
- `useFilesState` 已有 `page/setPage`,按 `page` 拉数,筛选/搜索/分类变更时 `setPage(1)`(`frontend/src/components/files/useFilesState.ts:23,43,78`)。
- `FilesPage` **未渲染任何翻页器**,`total>50` 时后续条目不可达。

### 改动
- `useFilesState`:暴露 `page`、`setPage`,并基于已拉取的 `inventory.total` 与 `per_page`(固定 50)计算 `totalPages = Math.max(1, Math.ceil(total / per_page))`。
- `FilesPage`:在 `FileList` 之后渲染复用的 `IconPager`(`components/discover/IconPager.tsx`,props `page/totalPages/loading/onPage`,`totalPages<=1` 自动返回 null),`onPage={state.setPage}`。
- 多选「全选当前分类」逻辑(`useFilesState:183` 以 `per_page=500` 循环抓取)不受影响,保持。

### 验证
后端已有测试覆盖分页;本组件以 `npm run build` 通过 + 手动翻页 smoke 验证。无后端改动、无新接口、无新测试要求。

---

## 组件 2 · 阅读历史专属页(`#history`)

### 数据
`reading_history(id, work_id, page_index, opened_at DEFAULT CURRENT_TIMESTAMP)`,每次进度保存插一行(翻页即写,`reader_service.py:54`),为高频事件日志。**不可裸列事件**。

### 后端
新增 `LibraryService.reading_history(page: int = 1, per_page: int = 30) -> dict`:

- 聚合键 **(work_id, date(opened_at))**(UTC 日期,与全站时间一致)。
- 每条聚合返回:
  - 作品摘要:`id, title, title_japanese, pretty_title, source, page_count, cover_path`(复用现有 work 摘要风格)。
  - `date`:`YYYY-MM-DD`(`date(opened_at)`)。
  - `last_opened_at`:`MAX(opened_at)`(当天)。
  - `read_events`:`COUNT(*)`(当天)。
  - `furthest_page`:`MAX(page_index)`(当天)。
  - `progress_percent` / `completed`:LEFT JOIN `reader_progress`(作品当前总进度,非当天)。
- 排序:`last_opened_at DESC`。
- 分页:`per_page` 上限 100,`page>=1`;`total` = 不同 (work_id, date) 组合数。
- 返回 `{result: [...], total, page, per_page}`。
- 仅查询 `reading_history` / `works` / `reader_progress`;不调 NH API。

### API
`GET /api/library/reading-history?page=&per_page=` → `library.reading_history(page, per_page)`。

### 前端
- `api.ts`:`libraryReadingHistory(page = 1, per_page = 30)` + `ReadingHistoryEntry` / 响应类型。
- 新目录 `components/history/`:
  - `HistoryPage.tsx`(`{ blurCovers }`):hero + 历史列表 + 底部 `IconPager`。空态(从未阅读)单独真实展示。
  - `useHistoryState.ts`:加载分页、`page/setPage`、loading/error。
  - `historyHelpers.ts`:把条目的 `date` 相对今天归入桶 —「今天 / 昨天 / 本周 / 更早(YYYY-MM-DD)」;时间/页码/进度格式化。
  - 列表按日期桶分组渲染,每桶下作品行:封面缩略(遵守 `blurCovers`)、标题、当天 `last_opened_at` 时间、`阅读 N 次`、`最远第 M 页`、进度徽标(在读/已读完)。点击行 → `navigate({name:"reader", workId})`。
- 导航/路由:
  - `lib/navigation.ts`:`Page` 加 `{ name: "history" }`;`pageFromLocation` 加 `if (route === "history") return { name: "history" }`;`navigate` 走默认 `page.name`(`"history"`)。
  - `components/layout/ArchiveShell.tsx`:`NAV` 加 `{ id: "history", label: "历史", icon: Clock }`(lucide `Clock`),并补 `navigate` 联合类型里的 `"history"`。
  - `App.tsx`:`{page.name === "history" ? <HistoryPage blurCovers={blurCovers} /> : null}`。

### 验证
后端 `pytest`:新增 `test_library_reading_history`(聚合按 (work,日) 分组、当天计数/最远页、跨日同作品分两条、排序、分页、join 进度)。前端 `npm run build` 通过 + 手动 smoke。

---

## 组件 3 · 治理批量(预览 + 应用)

### 原则
跨作品**逐字段套值无意义**(标题/语言各异)。批量 = 对每个选中作品执行**同一个动作、取值各自解析**。本阶段两动作:

- `fill_missing_metadata`:补全缺失元数据(只填空)。
- `write_back`:回写 ComicInfo 到源 CBZ。

### 后端 `GovernanceService`
复用既有 `work_governance(work_id)` 聚合(已给出每字段 `working_value` / `source_value` / `source`)与 `write_back_comicinfo(work_id)`。

`bulk_preview(work_ids: list[int], actions: dict) -> dict`(只读,不动盘):
- 校验 `actions` 至少含一个真值,键 ⊆ `{fill_missing_metadata, write_back}`。
- 逐作品计算 `work_governance`,得出:
  - `fill_fields`:对每个 `METADATA_FIELDS` 字段,当 `_normalize_value(working_value) == ""` 且 `source_value` 非空时,列入 `{field, label, source_value, source}`。
  - `write_back_ready`:源 CBZ 存在、是有效 ZIP、且在 `settings.library_dir` 内(复用回写的同一防护判定);否则给出原因。
- 返回 `{result: [{work: 摘要, fill_fields, write_back_ready, blockers}], summary: {works, fields_to_fill, write_back_ready}}`。

`bulk_apply(work_ids: list[int], actions: dict) -> dict`:
- 逐作品按顺序执行:
  1. 若 `fill_missing_metadata`:取 `bulk_preview` 同口径的 `fill_fields`,复用单作品 `apply` 的 `work_metadata` UPSERT 写入(`source` = 解析到的来源,需落在 `ALLOWED_METADATA_SOURCES`;`source` 非法时归 `remote`/`current` 兜底——以解析来源映射为准,见下),`source_value` 存来源原值。
  2. 若 `write_back`:调 `write_back_comicinfo(work_id)`。
- **失败隔离**:任一步抛错 → 记 `{error: str}` 并继续下一作品(沿用单作品回写不回滚语义);已写入的 metadata 不回滚。
- 返回 `{result: [{work_id, filled: [field...], write_back: {...written}|{error}|None}], summary: {works, filled_fields, written, errors}}`。

**来源映射细节**:`work_governance` 的 `source` 取值为 `comicinfo`/`json`/`remote`/`unknown`;`ALLOWED_METADATA_SOURCES = {manual, remote, comicinfo, current}`。映射规则:`comicinfo→comicinfo`、`remote→remote`、`json→remote`(json 视作远端派生),`unknown` 不应出现(无 source_value 不会进入 fill)。该映射在实现中显式列出。

### API(`main.py`)
- `POST /api/governance/bulk/preview` ← `GovernanceBulkRequest{ work_ids: list[int], actions: GovernanceBulkActions }`。
- `POST /api/governance/bulk/apply` ← 同模型。
- `GovernanceBulkActions{ fill_missing_metadata: bool = False, write_back: bool = False }`。
- 沿用现有 `GovernanceService(db, dictionary, settings)` 构造。

### 前端(治理页)
- `useGovernanceState`:加多选状态 `selectedIds: Set<number>`、`bulkActions`、`bulkPreview`、`bulkResult`;`runBulkPreview` / `runBulkApply`;`write_back` 选中时 `window.confirm` 二次确认(复用现有单作品确认文案)。
- `GovernanceQueueRail`:多选模式下每队列项加复选框;头部「批量」开关进入多选。
- 新 `GovernanceBulkBar.tsx`:已选数量、动作勾选(补全缺失元数据 / 回写源文件[默认关 + 风险提示])、`预览`、`应用`、结果回显(逐作品 filled / written / error)。
- 单作品 `apply` 流程、`MetadataEditor`、`GovernanceActionBar` **保持不变**。
- `api.ts`:`governanceBulkPreview(work_ids, actions)`、`governanceBulkApply(...)` + 类型。

### 验证
后端 `pytest`:`test_governance_bulk` 覆盖——只填空不覆盖已有值、来源优先级与 source 映射、write_back 批量更新 sha/size、单作品 write_back 失败隔离不阻断其余、`actions` 全空报错、preview 不动盘;`test_governance_bulk_api` 经 `TestClient`。前端 `npm run build` 通过。

---

## 决策记录(写入 PROJECT_STATUS.md)

- 治理批量只做「逐作品执行统一动作、取值各自解析」:补全缺失元数据(只填空、绝不覆盖人工/已有值)+ 回写 ComicInfo(沿用单作品 opt-in / 原子 / 无备份 / 哈希同步 / 失败隔离)。词典 review/冲突不批量,留单作品页人工解决。
- 阅读历史按 (作品, 日期) 聚合,前端按日期桶分组时间线;高频裸事件不展示。历史与「继续阅读」(仅在读)、「最近阅读」(Top 12 书架)区分:历史是完整可分页轨迹。
- 文件清单分页为纯前端补翻页器;后端 `inventory` 早已支持分页,无需改动。
- 批量导出接任务中心**不在本阶段**:与「导出=下载给用户、绝不写服务器目录」冲突,需先单独设计落盘/生命周期/清理语义。

## 不做(YAGNI)

- 文件清单 `per_page` 用户可调(固定 50)。
- 阅读历史的会话切分/阅读时长统计/图表。
- 治理批量的词典批量、跨作品统一字段值编辑、批量导出。
- 历史记录的删除/清空(本阶段只读展示)。
