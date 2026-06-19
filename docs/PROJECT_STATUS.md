# NH Archive Project Status

## Current Version

Phase 4 governance center (作品治理 single-work loop), built on the Phase 3 library and Phase 2 dictionary foundations.

Current real slice:

`NH API Key settings -> remote discover/search/detail -> dictionary mapping -> remote reader or import job -> local CBZ/work_tags -> library summary/search/filter/shelves -> local reader -> progress save -> per-work governance queue/metadata save -> export preview/rename/download CBZ (single or .zip bundle) to the user`

## Completed

- 导出语义改造（导出 = 下载给用户，而非写到服务器目录）:按用户预期重定向了导出功能。后端新增 `ExportService.build_cbz()`（在内存中打包带 `ComicInfo.xml` 的单个 CBZ 字节）与 `build_bundle()`（多选打包为一个 `.zip`），新增下载路由 `GET /api/works/{id}/export/download` 与 `POST /api/exports/download`（均以 `Content-Disposition: attachment` 流式返回）。删除了服务器侧写盘逻辑（`generate`/`generate_many`/`history`/输出目录解析）与 `export_records` 表及其迁移；导出不再保留任何记录。前端 `api.downloadExport` / `downloadExportBundle` 以 blob 拉取并触发浏览器下载；`useExportState` 的 `downloadSelected`（单选下单文件 / 多选下 `.zip`）与 `downloadOne` 取代了旧的批量生成；移除了输出目录卡片/编辑、`导出完成后打开输出目录` 复选框与“最近导出记录”区块（删 `ExportHistory.tsx`）；表头按钮 `移除选中`→`移除当前`。`storage.export_dir` 设置项保留但已不再被导出流程使用。后端 `PYTHONPATH=backend .venv/bin/pytest backend/tests -q` 50 passed；`cd frontend && npm run build` 零错误。原始 CBZ 始终只读、不被修改。
- 导出中心重构（多文件拆分 + 交互修复 + 视觉还原）:将单文件 812 行 `ExportPage.tsx` 拆分为 `ExportPage`（组合容器）+ `useExportState`（状态/数据 hook）+ `ExportSummary`/`ExportQueueTable`/`ExportPresetBar`/`ExportPreviewPanel`/`ExportHistory`（各区块）+ `exportHelpers`（Cover/compactPath/presetSummaryLines）共 8 个文件。选择模型由原来的双选集合简化为单一 `Set` + 独立 `focusId`（预览详情用），修复了旧双选状态不一致的交互问题。`styles/app.css` `.export-*` 样式块全量重写，视觉还原目标为 `design/导出中心.png`；后端未改动，全部 53 个后端测试保持通过，`npm run build` 零错误。注：对照参考图的实际视觉验收仍待用户在有真实导入 CBZ 数据的环境下进行。
- Phase 5 export center real slice: added local-only `ExportService`, `export_records`, APIs `GET /api/exports/queue`, `GET /api/exports`, `GET /api/exports/summary`, `POST /api/exports`, `GET /api/works/{id}/export-preview`, `POST /api/works/{id}/export-preview`, and `POST /api/works/{id}/export`. Preview is computed from real local source CBZ, governance `work_metadata`, `work_tags`, dictionary display names, and file existence. Generation creates new CBZ files under the configured export directory, supports custom output names, supports selected batch export, copies original archive members except old `ComicInfo.xml`, writes generated `ComicInfo.xml`, records real output path/size/hash, and never mutates original source CBZ files. Export summary exposes the real output directory and separates generated record count from currently available output files. The export directory and export presets are persisted through real settings storage. Frontend `#export` / `#export/{workId}` now renders a design-aligned export center with five-metric strip, selectable pending-export table, inline output-name rename fields, selected-work preview, persisted preset selector/save-new behavior, preset/rule panel, batch generate action, output-directory edit, generated-history records, and the reference hero line-art asset from `design/导出中心.png`. Mobile is a separate designed flow rather than a squeezed table: hero watermark/stamp, horizontal metric rail, command strip, card-style queue items with labeled output-name fields, stacked preset cards, and preview/history cards. Library inspector and governance action bar route to the real export center.
- 作品详情页 · 氛围横幅重构(`GalleryDetailPage`):解决了「不同封面比例 + 不同标签数量导致两列高度参差、翻书布局抖动」的根因。hero 改为一整块固定高度横幅(同图模糊奶油色洗白底 + 恒定尺寸封面卡槽,封面按高度约束不裁剪、不留白);标签移出 hero 改为整宽面板、每组独占一行(内容标签横向铺宽不顶高,少标签组无留白);相关作品改为居中固定宽卡片并展示词典中文内容标签。后端 `discover_service.gallery()` 的相关作品改走 feed 富化路径(`_tags_for_items` + `_with_import_state`)以解析 `tag_ids → tags(含 display)`+入库状态;`GallerySummary.tags` 类型补 `display?`。设计见 `docs/superpowers/specs/2026-06-19-gallery-detail-atmosphere-band-design.md`。
- Phase 4 governance center: implemented the first real single-work governance loop. Added `work_metadata` for field-level final metadata decisions, `GovernanceService` for local-only queue/aggregate/apply, and APIs `GET /api/governance/queue`, `GET /api/works/{id}/governance`, `POST /api/works/{id}/governance/apply`. Governance queue reasons are computed from real SQLite/archive state: missing metadata, untagged works, dictionary review/conflict tags, missing ComicInfo, and missing cover. Aggregate reads `works`, `work_files`, `work_tags`, `remote_galleries.payload_json`, `local_tag_dictionary`, and real CBZ `ComicInfo.xml` / JSON members. Frontend now supports `#governance` and `#governance/{workId}`, with queue, work header, metadata diff editor, tag governance board, right quality/actions column, and real navigation from library/reader. No bulk governance, machine translation, export generation, or CBZ write-back in this phase. Design/plan docs: `docs/superpowers/specs/2026-06-18-phase4-governance-center-design.md` and `docs/superpowers/plans/2026-06-18-phase4-governance-center.md`.
- 阶段 4 dictionary/settings:完成动画视觉线剩余范围。词典摘要逐项进场、候选行按筛选/翻页结果集 `key` 重播、编辑器按词条 key 淡入切换、应用预览空态/内容态淡入且关联作品逐项进场、批量导入 modal 接入 `Presence`。设置页三栏错峰进场,设置卡片逐项进场,保存/错误 notice keyed 淡入。仅用 `lib/motion` 原语,不改 API/数据逻辑;新增 `.candidate-row-motion`、`.settings-card-motion` 等极小透传类。设计/计划见 `docs/superpowers/specs|plans/2026-06-18-stage4-dictionary-settings-animation*`。
- 阶段 3 reader:单页翻页新页轻柔淡入(FadeIn keyed by page)、连续滚动模式页面进入窗口时淡入、打开/切换作品时三栏(章节侧栏/阅读区/详情栏)进场(keyed by sourceKey)。统一用 FadeIn 挂载淡入(规避内部滚动容器的 whileInView 与图片尺寸不一的重叠风险);新增 `.reader-page-cell` 撑满列宽居中。保留方向键/章节跳转/滚动自动翻页/隐私遮罩等全部交互。设计/计划见 `docs/superpowers/specs|plans/2026-06-18-stage3-reader-animation*`。
- 阶段 2 library:全面动画——主卡片墙逐项进场(结果集 `key` 重播)、「继续阅读/最近添加」两条书架行逐项进场、`WorkInspector` 选中切换淡入(按 work.id keyed)。新增 `.library-card-cell`(grid 等高保护)、`.shelf-cell`(横向轨道防压缩)透传类;保留全部现有视觉/hover/横向滚动。设计/计划见 `docs/superpowers/specs|plans/2026-06-18-stage2-library-animation*`。
- motion 打包瘦身:全局改用 `LazyMotion`+`m`+`domAnimation`(strict),JS 由 gzip 115→101 kB;Provider 在 `lib/motion/MotionProvider.tsx`,后续若需 layout/drag 改 `domMax`。
- 阶段 1 discover 卡片墙:接入逐项进场动画(淡入+轻微上移),翻页/筛选/切视图(grid↔list)时按结果集 `key` 重播;完整保留卡片现有 hover 与等高行,新增 `.discover-card-cell` 透传类保护等高。仅改 `DiscoverFeed.tsx` + 一条 CSS。设计/计划见 `docs/superpowers/specs|plans/2026-06-18-stage1-discover-cardwall-animation*`。
- 阶段 0 动画基础设施:接入 motion + Tailwind v4(方案 A:关 Preflight、不加前缀、token 映射,现有 `app.css` 零影响),建立 `lib/motion/` 动画原语层与 `components/effects/` 效果接入规范;magicui/react-bits 仅作效果素材,改造进现有设计语言后落地。设计/计划见 `docs/superpowers/specs|plans/2026-06-18-stage0-animation-foundation*`。后续 discover/library/reader/dictionary/settings 各页面动画改造为独立阶段。
- Restored code baseline to `5a85959` and removed the previous incomplete dictionary/settings/library UI stack.
- Kept project/product documentation as the development memory layer.
- Added real settings APIs:
  - `GET /api/settings`
  - `PATCH /api/settings`
  - `POST /api/settings/nhentai/verify`
- Added runtime NH API Key update:
  - Environment variable key has priority.
  - DB key can be saved/cleared from the UI.
  - API key text is never returned to the frontend.
- Rebuilt settings page against `design/设置.png` as a minimal real settings surface.
- Rebuilt discover page against `design/搜索导入.png`, with a later design decision recorded in `docs/superpowers/specs/2026-06-14-discover-popular-fan-design.md`:
  - structure is now title area + discovery controls/results
  - 今日热门 is a title-side image-first sunset fan driven by scroll progress
  - unified discovery feed instead of separate latest/popular/random pages
  - current-page dynamic loading only; remote `total/num_pages` is pagination metadata
  - real feed/search/tagged routing for latest-like browsing, language/type/sort, keyword, and single/multiple remote tags
  - real popular fan uses `/api/discover/popular`, shows real covers, respects cover blur, and does not poll
  - popular fan visual correction: no bordered/shadowed window container, no large cover-obscuring title/action blocks, no fade-only or scale-only animation; covers follow a rightward semicircle arc and clip out on down-scroll, then reverse on up-scroll
  - mobile popular fan stays visible and supports touch drag as a circular carousel so each real popular work can move into the center position
  - random, Gallery ID, and card detail modal previews with backdrop/Escape close
  - detail modal is information/actions only; `阅读` routes to the full reader page
  - remote read-only reader route `#reader/remote/{gallery_id}` uses real gallery page URLs when available and does not save local progress
  - single keyword/Gallery ID input; removed redundant remote search and Gallery ID tabs
  - grid/list switching
  - icon-only first/previous/page input/next/last pagination
  - unimported-only filtering
  - real import queue action
- Remote gallery cards now prefer Japanese title and show real cached author/language/tag data when available.
- Discover cards were reworked toward `design/库.png`: cover-first vertical layout, fixed metadata order, and draggable hidden-scrollbar tag rows.
- Discover tag filter uses dictionary-aware autocomplete/display mapping while preserving original remote tag IDs/names for remote queries.
- Discover visual hierarchy was tightened: removed stacked section panels, centered feed cards, custom filter menus, softer import-state chips.
- Task dock no longer stays visible when no running/queued/failed job or job API error exists.
- Added API quota protection after live screenshot QA hit remote rate limits:
  - backend request-key TTL cache for cacheable NH API calls;
  - backend 429 cooldown that stops repeated remote forwarding and can serve stale cached data;
  - frontend discover-session cache and in-flight reuse for feed/popular/detail/tag GET calls.
- Full navigation is visible, but unimplemented modules are explicit boundary screens.
- Implemented and refit Phase 2 dictionary foundation:
  - tables: `local_tag_dictionary`, `tag_aliases`, `work_tags`
  - APIs: `/api/dictionary/summary`, `/api/dictionary/candidates`, `/api/dictionary/evidence`, `/api/dictionary/autocomplete`, `/api/dictionary/preview-apply`, `/api/dictionary/apply`, `/api/dictionary/preview-bulk-import`, `/api/dictionary/bulk-import`, `/api/dictionary/{id}/ignore`, `/api/dictionary/{id}/review`, `DELETE /api/dictionary/{id}`
  - `DictionaryService` supports real summary, local creation/editing, alias lookup, cached remote tag candidates, remote tag search through the existing cached client, evidence lookup, apply preview, apply, status changes, delete, bulk import preview/import, and real `work_tags` linking.
  - Bulk import accepts the minimum row shape `原文, 中文名`; type and aliases are optional. Imported rows automatically map to cached remote tags by normalized original text and type when possible.
  - Import flow links imported works to real gallery tags after CBZ ingestion.
  - Discover cards/tag selector render dictionary `display` names when mapped, without using Chinese names as remote API query tokens.
  - `DictionaryPage` was refit against `design/词典.png`: top summary strip, table-like candidate pool, editor with aliases/scope chips and disabled machine suggestion state, evidence tabs, expandable apply preview, and row-level bulk import preview.
  - Dictionary UI polish pass (post Phase 3): title area uses the standard clean hero (removed the invented decorative quote/art blocks); summary strip is big-number metric cards with semantic tone colors; candidate pool has color-coded localized type badges, red impact emphasis, and per-status color tones.
  - Dictionary UI second pass (per user feedback on the live page): removed the 置信度 (confidence) editor field — the planned integration is machine translation, not AI scoring, so confidence has no UI meaning (the DB column stays, defaulting to 80, no longer user-editable). Flattened all modules to hairline-bordered, transparent panels (no background-color fill, no shadow) so modules no longer "pop" via background color. Made the three workspace columns equal-height and top-aligned by moving the 新建本地词条 action into the editor header (it was floating above the editor and pushing that column down) and stretching panes. Fixed action buttons wrapping mid-character (white-space: nowrap + flex-wrap so they wrap as whole units). Removed dead `dictionary-hero/quote/stats/grid/column/filter-row/editor-stack/new-term-button` CSS. No data/logic change — still real-only.
  - Dictionary UI third pass (user picked a design via an inline visual mockup: minimal base + Chinese tinted type tags + terracotta selected bar): summary strip is boxless light-weight large numbers, with terracotta only on 未配置 as the focal accent; all inputs/selects/filters are underline-style (零填充·细线), textareas are minimal hairline boxes, focus turns the underline terracotta; candidate type tags are Chinese tinted chips; the selected candidate row uses a terracotta left bar + subtle tint.
  - Dictionary UI fourth pass (layout + polish per live feedback): summary strip is full-width even distribution with vertical hairline dividers (A-style) instead of left-packed; candidate status is color-coded text (B-style: 已配置 green / 待复核 amber / others muted), no dot; candidate table got a slim custom scrollbar; buttons restyled to solid `--surface-solid` fill (not muddy translucency), 8px radius, real hover states, primary = solid terracotta, danger = ghost.
  - Dictionary UI fifth pass (user-directed layout, current baseline): top workspace is two columns `候选术语池 | 术语编辑器` (`.dictionary-workspace` grid `minmax(360px,1fr) minmax(420px,1.04fr)`, **`align-items: start`** — do NOT stretch, it made columns 1.5 screens tall). Candidate table is capped (`max-height: 400px`, scrolls) so the pool stays ~one screen and the panel below is visible. 批量导入 is a small button in the candidate-pool header that opens a modal (`.dictionary-modal`, reuses `.preview-backdrop`, Escape/backdrop close). Deleted `DictionaryApplyPreview.tsx`.
  - The merged panel below the workspace is titled **应用预览** (`DictionaryEvidencePanel`, `.preview-pane`). It is NOT tabbed — it is a single split layout: metrics row (将更新标签/将影响作品/潜在冲突/忽略项) + a `.preview-split` section grid (标签更新对比 / 常见搭配 / 冲突项 / 远端信息) + a full-width `.preview-works` 关联作品 cover row. Everything is visible at once (user explicitly rejected tab-switching here; wants a split like the old preview). Keep this layout: two-column top (pool|editor, not stretched), single split 应用预览 panel below, bulk import as a modal.
- Implemented Phase 3 “我的库” enhancement against `design/库.png`, all data from SQLite only:
  - Added `LibraryService` (`backend/app/services/library_service.py`): `summary`, `search`, `recent_added`, `recent_read`, `continue_reading`, `tag_filters`. It only queries `works`, `reader_progress`, `work_files`, `work_tags`, `local_tag_dictionary`; it never calls the NH API.
  - Added APIs: `/api/library/summary`, `/api/library/search`, `/api/library/recent-added`, `/api/library/recent-read`, `/api/library/continue-reading`, `/api/library/tag-filters`. Kept `/api/works` for compatibility.
  - `search` supports SQL-backed pagination (per_page capped at 100), keyword (title/japanese/pretty/gallery-id/joined tag text), read-state filter (unread/reading/completed), source filter (remote/local), language filter (via `work_tags` language type), multi-tag AND filter (work must carry every selected remote tag), and whitelisted sorts (recent_updated/added/read, title, pages_desc/asc).
  - Rebuilt `LibraryPage` as orchestration plus thin components: `LibrarySummaryStrip`, `LibraryToolbar`, `LibraryTagFilter`, `WorkCard`, `WorkInspector`, `ContinueReadingRow`, `libraryHelpers`. Reuses discover `FilterMenu`, `IconPager`, and `TagScroller`.
  - Summary strip shows only real metrics (总收藏/已读/阅读中/未读/待补标签/占用容量); “待补标签” = works with zero `work_tags`. Phase 4 later adds a dedicated governance page, while the library summary still avoids fabricating aggregate 待治理 counts.
  - Continue-reading and recent-added shelves render only when real rows exist and only when no filter/search is active.
  - Tag filter selector is backed by `/api/library/tag-filters` and shows dictionary Chinese display names; selecting a tag on a card or in the inspector adds it to the filter (AND).
  - Inspector exposes real file size/pages/source/ID/language/progress, routes 继续阅读 to the local reader, and keeps 进入治理/导出 CBZ disabled with 未接入 labels.
  - Empty library and empty filtered result are distinct real empty states; pagination uses the icon pager so large libraries never render every work at once.
  - Removed the orphaned legacy library CSS (`.filter-ribbon`, `.stats`, old `.work-card*`) replaced by the new `.library-*` system; retargeted the shared progress rule to `.library-card`.

## Not Implemented Yet

- File maintenance.
- Job pause/resume/cancel controls.
- Workbench aggregate dashboard.
- Library bulk actions (multi-select batch tray) and a dedicated reading-history page.
- Long-running bulk export jobs through the task center and failure retry through the full task center.
- Governance bulk preview/apply, machine translation suggestions, and source-CBZ ComicInfo write-back.

## Next Plan

Next work should continue Phase 5 polish or move into Phase 6 file maintenance. The remaining export work is task-center orchestration for long-running batch export/retry and deeper visual refinement against `design/导出中心.png`; the core preview/rename/output-directory/persisted-preset/synchronous batch-generate loop is now real.

## Risks And Decisions

- Decision: API Key settings and discover correctness are higher priority than expanding modules.
- Decision: language/type/sort controls must either call real APIs or be disabled; no inert clickable filters.
- Decision: Latest-like browsing uses `/api/discover/feed`; it switches to search/tagged only when filters require remote search semantics.
- Decision: Popular is a progressive title-side image-first sunset fan, not a permanent section, not a horizontal mini-list, not a framed panel, and not a manual-only hidden popover.
- Decision: Gallery ID is handled by the main keyword input when the query is pure numeric; no separate Gallery ID tab.
- Decision: Type filtering is limited to confirmed UI options `doujinshi` and `manga` until broader remote type semantics are verified.
- Decision: Card details use a modal, not a right-side drawer; no discovery layout space is reserved for details.
- Decision: Multiple selected tags use search query `tag:"..."` terms; single tag without other filters may use `/api/discover/tagged`.
- Decision: all future remote-backed modules must use cached service/client boundaries and must not call NH API directly from page-level loops or screenshot scripts.
- Decision: dictionary autocomplete only calls remote tag search when local dictionary/cache has no hit, reducing API quota pressure.
- Decision: local-only dictionary terms can be created, but discover remote filtering only selects terms mapped to real remote tag IDs.
- Decision: machine suggestions remain disabled until a real suggestion source exists; the UI must not invent suggestions.
- Decision: dictionary candidate/evidence/preview metrics are computed from SQLite tables only.
- Decision: unimplemented modules stay boundary screens.
- Decision: library is local-only; `LibraryService` must never call the NH API and library pages must not re-query remote tags. Tag filters reuse `work_tags` + dictionary mappings only.
- Decision: library multi-tag filtering uses AND semantics (a work must carry every selected remote tag).
- Decision: library summary shows only real metrics and still does not fabricate a broad 待治理 count. 待补标签 (works with zero `work_tags`) remains the honest library-level proxy; richer governance detail lives in `GovernanceService`.
- Decision: library shelves (继续阅读/最近添加) only render with real rows and only in the unfiltered default view; filtering switches to the paginated result wall.
- Decision: library language filter and language facets derive from `work_tags` rows of type `language` (with dictionary display), not the unused `works.language` column.
- Decision: governance metadata decisions live in `work_metadata`, not additional `works` columns and not a JSON blob. Original CBZ files stay read-only; Phase 5 export creates new CBZ files under the export directory instead of writing back to source archives.
- Decision: governance queue and completeness use real local state only. Missing values are shown as missing/unknown; no fake diffs, fake conflicts, or fake recommended actions.
- Decision: 全站页面内显示的 tag 一律走词典转换名(`display`,即 `zh_name → name → slug`),英文 `name`/`slug` 仅作无词典项时兜底;英文原文只用于后端 NH API 请求等操作,不直接显示给用户。
- Decision: 作品详情 hero 的封面按**固定高度**约束(放进恒定尺寸卡槽),绝不按长宽比框死,也不裁剪;空余由同图模糊底填充。标签等数量不定的内容**不得**与封面同列并排,须移到独立整宽区域,避免两列高度互相参差、翻书布局抖动。
- Risk: tag enrichment calls `/api/v2/tags/ids`; if remote rate limits, cards may show cached/empty tags rather than invented labels.
- Risk: search query syntax follows the compact API doc and should be manually checked against live API behavior.

## Verification Record

- `PYTHONPATH=backend pytest backend/tests -q`: passed, 28 tests (5 new in `test_library_service.py` covering summary, search filters/pagination, read-status, recent/continue shelves, and dictionary-aware tag filters).
- `npm run build`: passed (`tsc -b && vite build`).
- `git diff --check`: passed.
- In-process API smoke (route functions called directly before `httpx` was added): empty library → real zero states; after ingesting one real CBZ and linking real tags → correct summary/sources/language facet, keyword + `tag_ids="7,8"` + language search returns the work with real tags and size, malformed `tag_ids` tokens are ignored, `tag-filters` excludes language type, recent-added returns the real row.
- Static fake-data scan over `library_service.py` and `components/library/` + `lib/api.ts`: no mock/fake/placeholder/random data; only SQL parameter placeholders and the pre-existing dictionary `samples` field matched.
- Browser screenshot QA NOT run: no browser/Playwright/chromium is installed in this environment. The library page is local-data only (no NH API), so visual QA is safe to rerun by the user: start backend (`PYTHONPATH=backend uvicorn app.main:app --port 8001`) + `npm run dev`, import a CBZ, then open `#library`.
- 详情页氛围横幅重构后复测:`PYTHONPATH=backend python3 -m pytest backend/tests -q` 35 passed;`cd frontend && npm run build` 通过;`git diff --check` 干净。后端 related 富化为数据路径改动,需用户重启后端 + 硬刷新后在 `#gallery/{id}` 验收(封面/标签/相关卡)。
- Phase 5 export slice: `PYTHONPATH=backend .venv/bin/pytest backend/tests -q` 53 passed; `cd frontend && npm run build` passed. New tests cover preview without writes, generated CBZ containing generated `ComicInfo.xml`, real `meta.json` preservation, custom output-name export, configurable export directory, persisted export presets, synchronous multi-work batch export, export record persistence, existing-DB `export_records` column migration, missing-source blockers, export-history source/output existence reporting, summary separation of generated records vs available output files plus output directory, next unique output-name preview after an existing export, failed-generate cleanup without partial output/record, post-write failure cleanup without orphan output/record, queue ready/blocked/warning summary counts, export-time current source hash recording, source CBZ byte preservation, and FastAPI export route success/error mapping through `TestClient`. Playwright Chromium QA on `http://127.0.0.1:5179/#export` verified rename preview, mobile command-strip export button availability, output-directory edit/restore, preset save/switch/restore, hero sketch asset load, no console warnings/errors, and no mobile/desktop horizontal overflow at 390px/1448px.
