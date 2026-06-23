# 长时批量导出接任务中心 设计 spec

日期：2026-06-23
分支：`feat/lightweight-finishing`（或后续新分支）

## 背景

核心闭环已全部为真数据可用，轻量增强两轮已完成（见
`2026-06-23-lightweight-finishing-round2-design.md`）。唯一悬而未决的大特性是
**长时批量导出接任务中心**。

矛盾在于现有两套机制的形态不同：

- **导入任务**（`ImportService` + `JobService`）：daemon `threading.Thread` worker，
  DB 记录进度/暂停/取消；交付物是**已落库的作品**，无须回交文件给用户。
- **导出**（`ExportService`）：`build_cbz` / `build_bundle` 在内存里产出 zip
  bytes，作为浏览器下载同步流式返回，请求内完成、无服务器产物。其 docstring 明确
  不变量：*"export never writes a second copy to the server"*。

把批量导出做成后台任务，意味着任务完成时用户可能已离开页面，产物必须先落到服务器
某处——这会打破「不留第二份副本」。本 spec 用**临时产物·下载即删**把该产物的生命
周期压到最小，既给任务中心可见性/进度，又不引入持久产物管理。

源 CBZ 始终只读；治理 ComicInfo 仅在导出打包内（既有 opt-in）写入产物，绝不回写源。

## 决策（已与用户确认）

1. **形态**：临时产物·下载即删，24h TTL 兜底，任务中心显示进度。
2. **分流**：按选中数量阈值自动分流——少量走现有同步流式下载（瞬时、无产物），
   大批量走后台任务。

---

## 一、分流入口

- 「导出所选」入口（库批量托盘 `LibraryBatchTray` + 导出页队列）统一调用前端
  `exportSelected(workIds, options)` 帮助函数。
- `workIds.length <= EXPORT_SYNC_THRESHOLD`（常量 = 5）→ 走**现有**
  `POST /api/exports/download` 同步流式下载，零后端改动、瞬时、无产物。
- `> EXPORT_SYNC_THRESHOLD` → `POST /api/exports/bulk-jobs` 入队后台任务，前端提示
  「已加入任务中心」并可跳转查看进度。

阈值用常量，不做可配置（YAGNI）。

---

## 二、后端 `ExportJobService`（新）

仿 `ImportService` 的 `threading.Thread` daemon + `_worker_lock`/`_workers` 模式，
复用 `JobService`，**不改 jobs / job_logs 表结构**——导出专属字段全部塞进
`target_json`。

构造依赖：`JobService`、`ExportService`、`Settings`。

### 方法（与 import 对称）
- `enqueue_bulk_export(work_ids, options)` → `jobs.create("bulk_export", target)`
  后 `_start_worker`。`target` 初始：`{work_ids, options, total, packaged:0,
  skipped:[], artifact_path:None, output_name:None, expires_at:None,
  downloaded:False}`。
- `retry_job(job_id)`：仅 `failed` 且 `type == "bulk_export"` 可重试，
  `jobs.retry` 后重新跑全量。
- `resume_job(job_id)`：仅 `paused` 可续；worker 不在则重启。
- `cancel_job(job_id)`：`jobs.cancel`；worker 不在则 `mark_cancelled` 并删半成品。

### worker：`run_bulk_export(job_id)`
1. `jobs.mark_running(job_id, "packaging", 0, total)`。
2. 打开 `settings.tmp_dir/exports/job-{job_id}.zip`（`ZIP_STORED`，逐条写入，
   避免一次性 `BytesIO` 占内存）。
3. 逐部：`jobs.checkpoint(job_id)`（支持暂停/取消）→ `exports.build_cbz(work_id,
   options)`；阻塞作品（如源缺失）记入 `skipped`，不中断整批；写入成员名去重
   （复用 `ExportService._unique_member_name` 思路）；
   `jobs.update_progress(job_id, "running", "packaging", packaged, total)`。
4. 全部完成：若 `packaged == 0` 则 `jobs.fail`（并删空 zip）；否则
   `jobs.complete(job_id, {artifact_path, output_name, expires_at: now+24h,
   packaged, skipped, downloaded: False})`。
5. `JobCancelled`：删半成品 zip，`jobs.mark_cancelled`。
6. 其他异常：删半成品 zip，`jobs.fail(job_id, str(exc))`。

`output_name` = `f"导出合集 ({packaged}).zip"`，对齐现有 `build_bundle`。

`Settings.ensure_directories` 增加 `tmp_dir/exports` 目录。

---

## 三、产物生命周期：下载即删 + TTL + 清扫

### 下载（即删）
`GET /api/jobs/{job_id}/export/download`：
- 校验 job 存在、`type == "bulk_export"`、`status == "completed"`、
  `artifact_path` 文件存在且未过期；不满足 → 404（无此产物）/410（已过期或已下载）。
- 返回 `FileResponse(artifact_path, filename=output_name)` 并挂
  `BackgroundTask`：响应发送完成后删除 zip 文件、`target.downloaded = True`
  （通过 `jobs` 持久化）。任务行保留为历史，下载按钮消失。

### TTL 兜底
`target.expires_at`（完成时刻 + 24h）。过期产物由清扫删除并标记不可下载。

### 清扫 `sweep_exports()`
在 **app 启动**（lifespan/startup）+ **每次 `GET /api/jobs`** 列表时调用。删除
`tmp_dir/exports` 下满足任一条件的 zip：
- 对应 job 不存在（孤立文件）；
- `target.downloaded == True`；
- 已过 `expires_at`。
无需后台调度器；清扫是幂等的尽力而为操作，异常吞掉不影响列表返回。

---

## 四、路由按 job 类型分流

现有 `/api/jobs/{id}/{resume,cancel,retry}` 路由直接调 `imports.*`。改为先
`jobs.get(id)["type"]` 分流：`remote_import` → `imports.*`，`bulk_export` →
`export_jobs.*`。新增：
- `POST /api/exports/bulk-jobs`（body `{work_ids, options}`）→
  `export_jobs.enqueue_bulk_export`。
- `GET /api/jobs/{id}/export/download`（见上）。

`pause` 仍走通用 `jobs.pause`（与类型无关）。

---

## 五、前端

- `api.ts`：新增 `enqueueBulkExport(workIds, options)`、
  `bulkExportDownloadUrl(jobId)`（拼 URL 供浏览器直下）；`Job["target"]` 类型补
  export 字段（`packaged`/`total`/`output_name`/`downloaded`/`expires_at`/`skipped`）。
- 任务中心 `TaskList` / `TaskInspector`：`bulk_export` 行显示打包进度 `x/total` 与
  阶段；`completed && !downloaded && !expired` → 「下载 .zip」按钮（指向 download
  URL）；显示 `skipped` 摘要。
- 库批量托盘 / 导出页：`exportSelected` 按阈值分流；`>` 阈值时 toast/notice
  「已加入任务中心」。

---

## 关键不变量

- 源 CBZ 只读；导出绝不修改原档。
- 产物一次性：下载即删 / 24h 自动清扫；服务器不长期保留第二份副本。
- 治理 ComicInfo 仅在导出打包内（既有 opt-in，默认开）写入产物，不回写源。
- 机翻/词典等其余既有不变量不受影响。

## 不做（YAGNI）

- 持久产物管理页（列表/重复下载/手动删除/磁盘占用看板）。
- 可配置 TTL / 阈值（用常量）。
- 磁盘配额上限与并发产物上限（靠下载即删 + TTL 控制）。
- 单部级别断点续传（取消即整批重来）。

## 验证计划

- 后端单测：`ExportJobService` 入队、worker 打包产物、跳过阻塞作品、取消/失败删
  半成品、`packaged==0` 失败、下载即删（`BackgroundTask` 触发后文件消失且
  `downloaded` 置真）、过期/已下载不可再下、`sweep_exports` 删孤立/过期/已下载。
  路由按类型分流（bulk_export 的 resume/cancel/retry 不误入 import 分支）。
- 前端 `npm run build` 通过；任务中心 `bulk_export` 行渲染与下载按钮显隐。
- `PYTHONPATH=backend .venv/bin/pytest backend/tests -q` 全绿。

## 决策记录

- 形态选「临时产物·下载即删」（24h TTL 兜底）而非纯流式或持久产物，兼顾任务中心
  可见性与「服务器不留副本」不变量。
- 分流选「按阈值自动分流」（常量 5）而非全面任务制或用户显式选择，少量导出保持
  瞬时无产物体验。
- 复用 `JobService` 不改表结构，导出字段塞 `target_json`；worker 复用 import 的
  线程模型。
- 产物边写边落盘（`ZIP_STORED` 逐条写入）避免大批量一次性占内存。
