# 轻量收尾第二轮设计 spec：文件筛选 / 库批量动作 / 治理元数据机翻

日期：2026-06-23
分支：`feat/lightweight-finishing`

## 背景

核心闭环已全部为真数据可用，项目处于「功能完整、只剩长尾增强」阶段。本轮做
三个低风险、复用现有能力的轻量增强；唯一真正悬而未决的大特性（长时批量导出接
任务中心，因「导出=下载给用户」与后台落盘产物生命周期冲突）留作单独设计，不在
本 spec 范围。

三项均为本地数据驱动；除治理 ComicInfo 回写（既有、opt-in）外，源 CBZ 仍只读。

---

## 一、文件清单：体积排序 + 补齐问题状态筛选

### 问题
`#files` 清单已支持 category（all/work/orphan/stale）、关键词、status 筛选与
分页，但排序固定（作品按 `updated_at`，孤立/临时按目录内名称），无法按体积找
出大文件优先清理；且 `size_mismatch` 只是计算出的 flag，对应作品的 `status`
仍为 `ok`/`missing_cover`，导致它无法被单独筛出（真实缺口）。

### 方案
- 后端 `FileMaintenanceService.inventory` 新增 `sort` 参数（`default`/
  `size_desc`/`size_asc`）。排序在过滤之后、分页之前对整个 entry 列表进行，
  保证跨页正确；`default` 保持现有自然序。
- 状态筛选由 `e["status"] == status` 改为 `status == e["status"] or status in
  e["flags"]`，使 `size_mismatch` 等 flag-only 条件可筛；`ok` 经 status 命中，
  其余经 flags 命中，原行为不变。
- API `GET /api/files/inventory` 透传 `sort`。
- 前端 `FileToolbar` 加排序下拉（默认/体积↓/体积↑）与「体积不符」状态项；
  `useFilesState` 加 `sort` state（切换复用 `resetFilterExtras` 回首页+清预览）；
  `api.filesInventory` 入参加 `sort`。

### 不做（YAGNI）
体积阈值输入、来源筛选、名称/时间排序。

---

## 二、我的库：多选 + 批量动作托盘

### 方案
库结果区加多选模式（封面左上勾选 + 卡片描边 + 「选中本页」）。多选时显示批量
托盘 `LibraryBatchTray`，**只复用现有批量端点**，不新增后端：

1. **导出下载合集** → `downloadExportBundle(work_ids)`（非破坏）。
2. **批量补全缺失元数据** → `governanceBulkApply(work_ids, {fill_missing_metadata:true})`
   （只填空、不回写、绝不覆盖已有非空值；`bulk_apply` 对任意 work_id 生效，
   无缺失字段者 `filled: []`）。
3. **删除所选** → 先 `previewFileDelete`（展开级联/可回收字节）再二次确认
   `deleteFiles`（破坏性，复用文件管理的级联删除语义）。

`WorkCard` 新增 `multiSelect`/`checked`/`onToggle`：多选时点击切换选择、双击不
进阅读器。批量动作完成后清空选择并刷新列表与摘要（`reloadKey` bump）。

### 不做
新增库专属批量后端、批量改标签/治理写回（治理批量已在治理页独立存在）。

---

## 三、治理：元数据机翻可复核建议

### 方案
治理页用已接入的 `TranslationService` 把自由文本元数据字段机翻为中文建议，供
人工复核，绝不自动覆盖。

- 可译字段 `TRANSLATABLE_METADATA_FIELDS = (title, title_japanese, summary)`；
  artist/group/language/tags 走词典，pages/published_at 为结构化字段，均不机翻。
- 新增**只读** `GovernanceService.translate_metadata(work_id, fields=None)`：
  经 `dictionary_service.translation` 取机翻服务（未配置→`ValueError`）；对每个
  请求字段取最有意义原文（本地最终值→库内当前值→解析来源值），`source="auto"`
  自动检测语言批量翻译；跳过无来源（`no_source`）与翻译无变化（`no_change`）；
  返回 `{result:[{field,label,original,suggestion}], skipped, provider}`。
  **绝不写库。**
- `TranslationService` DeepL 支持 `source="auto"`：留空 `source_lang` 让 DeepL
  自动检测（不可传 `"AUTO"`）；google_free 的 `sl=auto` 原生支持。
- API `POST /api/works/{id}/governance/translate`（422=未配置/参数错，502=翻译
  服务错，对齐词典机翻路由）。
- 前端 `useGovernanceState.translateMetadata` 把建议**预填进编辑框**
  （`source=manual`，dirty），不自动写库；用户复核后点保存才走现有 apply 持久化。
  元数据编辑器面板头加「机翻填充中文」按钮。

### 关键不变量
机翻输出只作建议、必须人工确认后才持久化；翻译过程零写库；沿用词典机翻「人工
确认前绝不落地」的语义。

---

## 验证

- `PYTHONPATH=backend .venv/bin/pytest backend/tests -q`：134 passed（新增
  file_service 2 项排序/状态、governance_translate 4 项）。
- `cd frontend && npm run build`：通过。
- 静态扫描 touched 文件无假数据；机翻走真实 `TranslationService`，沙箱无出网，
  真实机翻需用户在设置填 key/选 provider 后自测。

## 决策记录

- 文件清单排序在过滤后、分页前对整列表进行（跨页正确）；状态筛选匹配 status
  或 flags，使 `size_mismatch` 等 flag-only 条件可筛。
- 库批量托盘只复用既有端点（导出合集/治理补全/文件级联删除），不新增库专属
  批量后端；删除沿用文件管理的级联+二次确认。
- 治理元数据机翻只产出可复核建议、预填编辑框，绝不写库、绝不自动覆盖；持久化
  仍走人工保存的 apply 路径。可译字段限自由文本（title/title_japanese/summary）。
- 长时批量导出接任务中心仍不在范围，需先单独设计落盘/生命周期语义。
