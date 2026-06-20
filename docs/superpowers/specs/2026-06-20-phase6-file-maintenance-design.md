# Phase 6 文件管理设计 (File Maintenance)

状态:设计已批准,待写实现计划。
设计基线图:`design/文件管理.png`。

## 目标

为 NH Archive 增加文件管理模块:展示数据目录内**全部文件**的真实清单(已入库作品的源 CBZ + 封面、孤立文件、临时/导出残留),允许用户对任意文件**选中 → 预览 → 删除**,删除前强制预览删除影响面。文件管理 = 管理库内所有文件,不只是清理异常。

数据全部来自真实文件系统 + SQLite,绝不调用 NH API,绝不杜撰容量/重复/损坏/孤立计数。删除是唯一会动盘的操作;源 CBZ 字节从不被"修改",只能被整体删除。

## 范围

本切片实现:

- 真实文件健康检测:缺失源文件、缺失封面、孤立文件、过期临时文件。
- 完整文件清单(含健康作品),统一可选中。
- 删除预览(展开级联影响)+ 删除执行(级联整体移除作品 / 直接 unlink 散件)。

不在本切片:文件去重检测、CBZ 内部完整性校验/修复、批量重命名、自动重新提取封面、回收站/撤销。

## 数据模型(方案 A:统一文件清单)

清单条目三种 `kind`:

1. `work` — 每个 `works` 行一条,聚合该作品的源 CBZ(`work_files.path`,kind=`source_cbz`)与封面(`works.cover_path`)。作为一个"作品文件单元"呈现。删除该条 = 级联整体移除作品。
2. `orphan` — `library/`、`covers/` 目录下存在、但没有任何 DB 行引用的文件(例:散落的 `[Memeya...].cbz`)。删除 = 直接 unlink。
3. `stale` — `tmp/` 下全部残留文件 + `exports/` 下残留文件。删除 = 直接 unlink。

被否决的备选:B(纯异常发现清单,不满足"管理全部文件");C(逐物理文件成行,把健康作品拆成 cbz+封面两行,级联 UX 混乱)。

## 后端:`backend/app/services/file_service.py`(`FileMaintenanceService`)

本地文件系统 + SQLite,绝不调用 NH API。数据目录路径从 `Settings` 解析:`library/` `covers/` `pages/` `tmp/` `exports/`。

### 路径归一化(关键)

`work_files.path` 在真实库中**绝对/相对混用**(已确认 work 1 为绝对路径,work 2/3/4 为相对路径)。解析规则:绝对路径直接用;相对路径相对仓库根(`/opt/nhentai`,即 backend 的上一级)解析为绝对路径,再 `os.path.exists` 判断,避免把相对路径误报为缺失。所有删除/穿越校验也基于归一化后的绝对路径。

### 条目状态

- `work`:`ok` / `missing_source`(归一化后 CBZ 不在盘上)/ `missing_cover`(`cover_path` 为空或文件不存在)。可同时带多个 flag。
- 警告 flag `size_mismatch`:盘上实测 CBZ 字节与 `work_files.size_bytes` 不符(不阻断,UI 高亮)。
- `orphan`:固定 `orphan`。
- `stale`:固定 `stale`。

`size_bytes` 一律用 `os.path.getsize` 实测,DB 的 `size_bytes` 仅作对照产生 `size_mismatch`。

### 方法

- `overview()` → 全部实测指标:作品数、源文件总占用、封面覆盖数/缺失数、缺失源数、孤立文件数 + 占用、临时/导出残留数 + 占用、可回收总字节(孤立 + 临时)。
- `inventory(category, q, status, page, per_page)` → 清单条目分页。`category ∈ all|work|orphan|stale`;`q` 搜标题/路径;`status` 按状态过滤;分页沿用现有 IconPager 语义。
- `preview_delete(targets)` → 只读,不动盘(见下)。
- `delete(targets)` → 执行(见下)。

### Target 标识(不靠数组下标)

- `work` 行:`{kind:"work", work_id}`
- `orphan` / `stale` 行:`{kind:"orphan"|"stale", path}`,path 必须落在受管数据目录内(后端再次校验,防目录穿越)。

### `preview_delete(targets)`(只读)

每个 target 计算"将删除什么":

- `work` → 级联展开:源 CBZ 文件、封面文件,加上引用该 `work_id` 的全部 DB 行 `works` / `work_files` / `work_pages` / `work_tags` / `work_metadata` / `reader_progress` / `reading_history`,逐项列出真实计数(将删 N 个 work_tags、是否有阅读进度、是否有治理元数据)。
- `orphan` / `stale` → 仅该文件。

汇总:`files_to_delete`、`works_to_remove`、`reclaim_bytes`(实测求和)。

警告:删除带阅读进度的作品标 `has_progress`;带 `work_metadata` 治理决策的标 `has_governance`(均不阻断,UI 高亮);target 已不存在(竞态)标 `already_gone`。

### `delete(targets)`(执行)

- 服务端**重新校验**每个 target:路径归一化 + 必须在受管目录内 + 重新判定存在性;不信任前端预览结果。
- 顺序:事务内先删 DB 行(级联),再 unlink 文件;文件 unlink 失败只记入该 target 的 `errors`,不回滚已删 DB,并如实报告。
- 返回:`deleted_files`、`removed_works`、`reclaimed_bytes`、`errors[]`(逐 target 成败)。
- 铁律:删除是唯一会动盘的操作;绝不修改任何 CBZ 字节(只整体删除);受管目录之外的任何路径一律拒绝。

### API(`main.py` 路由)

- `GET /api/files/overview`
- `GET /api/files/inventory?category=&q=&status=&page=&per_page=`
- `POST /api/files/preview-delete`
- `POST /api/files/delete`

## 前端:`components/files/`

`App.tsx` 现有 `#files` 边界页替换为真实页面;`lib/navigation.ts` 加 `#files`(单页,无子路由)。沿用 export/governance 的"编排容器 + 薄组件 + state hook"模式。

- `FilesPage.tsx` — 薄编排容器。挂载拉 `overview` + `inventory`,组合子组件。
- `useFilesState.ts` — 全部状态与取数:`overview`、清单(category/q/status/page)、选中 `Set`(稳定 target key)、`focusId`、删除预览结果、`previewDelete()` / `confirmDelete()` 编排;筛选/翻页带请求 token 丢弃过期响应(同 LibraryPage)。
- `FileOverviewStrip.tsx` — 顶部真实指标条,复用 library summary strip 大数字视觉。
- `FileToolbar.tsx` — 标题、搜索、category 筛选、status 筛选,复用 discover `FilterMenu` + `IconPager`。
- `FileList.tsx` — 多选清单行。作品行:封面缩略 + 标题 + 占用 + 状态徽标(正常/缺失源/缺失封面/体积不符);孤立/临时行:文件名 + 路径 + 大小 + 类别徽标。单击聚焦/选中。
- `FileInspector.tsx` — 右侧检查器:聚焦项详情 + "删除所选"。删除流:`previewDelete` → 展开删除影响面板(将删文件数、连带移除作品、可回收字节、进度/治理警告)→ 二次确认(健康作品删除必须确认;孤立/临时可直接确认)→ `confirmDelete` → 刷新 overview + 清单。
- `fileHelpers.tsx` — 共享渲染:`Cover` 缩略、状态分类与中文标签、`formatBytes`(复用 library helper 口径)。

`lib/api.ts` 增类型与方法:`FileOverview`、`FileEntry`、`FileDeleteTarget`、`FileDeletePreview`、`FileDeleteResult`,及 `filesOverview/filesInventory/previewFileDelete/deleteFiles`。files 调用本地直连,不走 discover session 缓存。

视觉对齐 `design/文件管理.png`(顶部指标 + 主清单表 + 右侧维护操作),沿用暖纸背景/黑体标题/赤陶主操作/右检查器系统;删除按钮用 danger ghost 语义。tags 走词典 `display`。无假数据,空目录显示真实空态。

## 测试与验证

### 后端单测 `backend/tests/test_file_service.py`(临时数据目录 + 临时 SQLite,造真实文件)

- 路径归一化:绝对与相对混用都正确判定存在/缺失。
- 检测口径:健康作品 `ok`;删盘上 CBZ → `missing_source`;清空/指错 cover_path → `missing_cover`;`library/` 放无引用文件 → `orphan`;`tmp/`、`exports/` 放文件 → `stale`;DB `size_bytes` 与实测不符 → `size_mismatch`。
- `overview()` 各计数与可回收字节等于真实造出量。
- `preview_delete`:作品 target 展开全部连带 DB 行计数 + 封面/CBZ 文件,且不动盘(预览后文件仍在、DB 行仍在)。
- `delete`:作品 target 级联删 works/work_files/work_pages/work_tags/work_metadata/reader_progress/reading_history + 两文件,返回真实 `reclaimed_bytes`;孤立/临时只删该文件;受管目录外路径被拒(目录穿越防护);unlink 失败如实进 `errors` 且不谎报成功。
- 隔离性:删除目标作品后,其它作品文件字节不变。

### 路由层(`TestClient`)

4 个 `/api/files/*` 路由的成功与错误映射(无效 target、空选择、目录外路径)。

### 收尾验证(完成时跑)

- `PYTHONPATH=backend .venv/bin/pytest backend/tests -q` 全绿。
- `cd frontend && npm run build` 零错误。
- 对 `file_service.py` + `components/files/` + `lib/api.ts` 静态扫 mock/sample/random,确认无假数据。
- 真实手验:临时数据目录造缺失/孤立/过期文件,API 只报告这些真实发现;预览删除一个健康作品 → 确认连带项 → 执行 → 验证文件与所有 DB 行移除、其它作品未受影响、源 CBZ 从不被改写。
- 文档:更新 `PROJECT_STATUS.md`(Phase 6 阶段记录 + 决策)与 `PROJECT_MAP.md`(新 service/APIs/组件/数据路径)。

## 决策记录

- 文件管理是管理库内全部文件,不只异常清理;清单含健康作品,所有行可删。
- 删除健康作品的源 CBZ = 级联整体移除该作品(works 及全部引用表 + 封面)。
- 删除是唯一动盘操作;CBZ 永不被修改,只整体删除;受管目录外路径一律拒绝。
- 检测与计数全部来自真实文件系统 + SQLite;缺失值显示为缺失/未知,绝不杜撰。
- `work_files.path` 绝对/相对混用,统一归一化为相对仓库根的绝对路径后再判定与删除。
