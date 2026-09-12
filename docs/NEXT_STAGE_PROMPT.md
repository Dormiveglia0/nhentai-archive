# Next Stage Prompt: Post-Closure QA And Polish

Use this prompt after the feature-complete local loop remains green (`pytest` + `npm run build`). The latest closure baseline is 234 backend tests plus the route-split frontend build; the 2026-07-31 production-preview baseline covers 14 distinct entries at 1440×1000 and 390×844 (28 page states), 18 real interaction paths, authentication setup/login/logout, reader background isolation and focus restoration, responsive layout, reduced-motion behavior, and TaskDock suspension inside readers.

The 2026-09-07 interaction revision keeps native links in all four library/workbench shelves. Hover uses a clear vermilion ring, a small lift and title color, with no action-label overlay or rotation. Pointer capture begins only after a real mouse drag; touch, keyboard and modifier links remain native. Login is an independent paper surface: do not restore the decorative page silhouette behind the password field. The form exits, a measured field-edge scan aligns with the actual 78/68/64px topbar, then the app mounts and fades in. Keep pending text on one line, setup/error/retry controls, lazy-route focus restoration and reduced-motion support. The auth shell uses overflow:clip and no persistent transform on its app wrapper; discover pagination scrolls only .folio-scroll. Keep number/nav springs, bounded list staggering (50ms maximum interval, 320ms total delay), viewport-sized native horizontal page transitions (no exit wait or whole long-page moving layer) and offscreen scene pause. Sparse result rows must not expand works beyond 1.25× their measured normal column width; dense discover rows size independently rather than sharing 1fr height. Popular cards fill the desktop track at each cover’s real aspect ratio; do not impose an independent media height cap, which creates side bands, or restore a tiny centered shelf. Ordinary discover cards and shared shelves use is-fill-portrait: loaded portrait images fill their frame with object-fit:cover; landscape images remain contained. Paper-light motion is limited to a small radial glow; decorative background motion pauses while scrolling and resumes after 150ms idle. Page background changes do not scale two full-screen layers simultaneously. Library cards and shared shelves request /api/works/{id}/cover?w=512 with asynchronous image decoding; the optional width reuses the existing atomic thumbnail cache and reimport invalidation. Select-menu row backgrounds meet the menu border. Product copy must describe reader actions, never development guarantees or welcome slogans. Verify intermediate animation frames and actual pagination, not only screenshots. Run auth-gate, auth-wake-demo, shelf-navigation and layout-regressions E2E suites with an isolated real archive via E2E_BASE_URL and E2E_STORAGE_STATE.

## Required Reading Order

1. `docs/AGENT_MAP.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/PROJECT_MAP.md`
4. `docs/DEVELOPMENT_RULES.md`
5. The relevant active demo module and formal component listed by the agent map.

## What Already Exists

- Run the complete development stack with root `npm run dev`; do not require users to manage separate API/Web terminals. `npm run dev -- --check` is the non-starting environment check.
- Deployable code lives in `apps/api/` and `apps/web/`; runtime state belongs in root `.local-data/`. Do not restore top-level `backend/` / `frontend/` folders or place user archives inside either app.
- The same SQLite may cross host and Compose runtimes. Keep source/cover paths portable in SQLite (`library/...`, `covers/...`), resolve them against the active data root at read time, and preserve startup conversion of legacy `.local-data/...` / `/data/...` absolute values. Never reintroduce environment-bound managed paths.
- Keep `apps/api/tests/conftest.py` test-data isolation. A plain pytest run must not initialize, migrate or rebase the Compose database under root `.local-data/`.
- Preserve the single-password boundary: `AuthGate` must resolve before application routes mount; only `/api/health`, auth status/setup/login/logout are public, while `/api/auth/change` requires an active session and the current password. Accept any non-empty password without character-combination rules; keep salted `scrypt`, HttpOnly/SameSite cookies, server-side token hashes, other-session revocation on password change, and no usernames or localStorage auth tokens.
- Backend startup is split by responsibility: `main.py` creates the app, `container.py` assembles dependencies, `api/<domain>.py` owns HTTP routes, and `services/` owns behavior. Extend the matching domain router instead of rebuilding a monolithic entrypoint.
- Shared frontend metric entries, pagination, tag scrolling, and work shelves live in `components/folio/ui/`; shared presentation formatting and job rules live in `lib/format.ts` and `lib/jobs.ts`. Feature folders are not cross-feature utility buckets.
- All primary modules are real pages: discover, library, reader, history, governance, dictionary, export, files, tasks, settings, and workbench.
- Governance supports single-work metadata decisions, metadata machine-translation suggestions, ComicInfo write-back, batch fill-missing metadata, batch ComicInfo write-back, source Web backfill, and batch confirmation of existing dictionary `review/conflict` terms.
- Library batch metadata refresh is preview-before-apply. Preserve its exact-ID/ComicInfo-Web/manual-ID priority, fuzzy thresholds (92 confidence, 7-point margin, page match unless confidence is 97), duplicate-link rejection, server-side apply re-ranking, fresh detail fetch, stale remote-tag replacement, local source ownership, and manual metadata decisions. Never trust browser-supplied confidence or auto-apply an ambiguous candidate.
- Governance queue totals mean actionable works, not library size; language completeness honors real language tags unless an explicit metadata decision overrides them. Opening a work must never stage a source-value change by itself.
- Export supports immediate browser downloads for single/small batches and `bulk_export` task-center jobs for selections over `EXPORT_SYNC_THRESHOLD`.
- Bulk-export artifacts are temporary: written as `.zip`, available from the task inspector, deleted after download, and swept after 24h.
- Library scan jobs, import jobs, and bulk-export jobs all route through the real task center.
- No fake works, fake jobs, fake metrics, fake covers, or adult sample assets should be added for QA.

## Next Work

- Use `components/folio/` as the production-neutral visual system and `/demo` as its visual regression surface. Never import `components/demo/` from a formal route.
- All formal routes, including gallery detail, history, and both readers, are directly migrated and browser-verified. Keep feature-local structure/CSS; do not restore legacy-shell adapters or import demo state.
- The globally orphaned legacy shell/page selectors are removed, `app.css` is base-only, and formal routes already load through route-level lazy boundaries with honest Folio/reader fallbacks. Preserve that split and do not raise warning thresholds.
- Browser QA against real or user-provided data after each route migration; compare the formal route with `/demo` at desktop and mobile sizes.
- Operational-page migration must preserve task state-machine controls, export download semantics, file-deletion previews/confirmations, and current real-data empty states.
- File operations have one owner: keep delete/cleanup/scan async state in `files/useFilesState.ts`; deletion must remain preview → viewport-level confirmation, work metadata may be removed only after its managed files are successfully deleted, and scan enqueue must submit the exact paths from the visible preview rather than recomputing targets.
- Preserve the simplified flows now verified in production: discover is grid-only, its five popular works remain one five-poster shelf on desktop and all five stay simultaneously visible without horizontal scrolling on mobile, every primary popular/detail/reader cover keeps the full artwork over a decorative same-image ambient layer, its tag picker defaults to content tags with author/work metadata in a separate scope, selected tags stay first with one clear-all action, library card Tag rows contain only `type=tag` content terms and never treat `translated` as a language, continuous reader progress is derived from the actual reader scroller, reader info retains grouped local metadata tags and the gallery link, saved cover blur updates `ArchiveApp` immediately, and file rows are directly selectable with desktop-side/mobile-drawer actions.
- Preserve native link semantics for every formal tag surface: discovery/remote-reader contexts use `tagSearchHref()`, while library/statistics contexts use `libraryTagHref()` and must stay inside the local index. Ordinary left click may filter in place; middle/modifier click must open the same data scope in a new tab. Keep shared library/workbench shelves press-draggable, the reader page index horizontally clipped, the gallery lightbox ratio-constrained, and the fixed five related works free of orphan rows.
- Preserve local favorites as `works.favorite`, separate from the remote gallery popularity field also named `favorites`; every library/reader favorite control must converge on `api.setWorkFavorite()` and favorite-only search must remain server-backed.
- Preserve reader accounting boundaries: progress writes never create visits; one idempotent local `reading_sessions` row creates one `reading_history` open, while one idempotent `remote_reading_sessions` row records a cached remote gallery without local progress/history. Both accumulate only visible foreground time monotonically; hidden/background time is excluded and no historical time is fabricated. If a remotely read gallery is later imported, shared statistics resolve both sources to one work. Session-key generation must work outside secure contexts. Statistics use the browser timezone for local calendar days, compare equal-length periods, keep local collection author/Tag distributions independent from favorites, and may attribute a session to its start day until a demonstrated need justifies midnight splitting.
- Visible return controls must use `lib/navigation.ts::goBack()` so they behave like the browser Back button instead of adding a replacement destination. Discover Tag conditions support both include and exclude; keep signed namespace clauses intact. Remote import progress must retain byte-level download updates and may not fall back to a fixed 60% stage marker.
- Keep result page sizes tied to actual computed grid tracks through `lib/useGridColumns.ts`; never restore viewport/card-width guesses or a fixed count that leaves an incomplete row. Library rounds its 24-item target upward (five columns means 25), while discover keeps four complete measured rows.
- Mobile layout polish only where screenshots show concrete overlap, wrapping, density, or touch-reachability problems.
- Use `FolioMetricGrid` for cross-route KPI/status summaries. Keep genuine record tables and compact inspector facts in their owning feature; do not recreate joined spreadsheet cells for read-only top-level summaries.
- Long-list performance checks for library/export/governance queues; route splitting is complete, so optimize measured render/fetch bottlenecks rather than reorganizing chunks speculatively.
- Dictionary candidate matching must keep separate indexed joins for direct remote ID, normalized name and normalized slug. The audited real baseline is p50 11.3ms / p95 12.4ms at 5313 remote tags; the 55313-tag isolation baseline is p95 112ms for the ordinary first page, 34ms for configured filtering and 69ms for a local keyword scan.
- Preserve the 2026-07-15 measured backend baseline: workbench overview about 31ms, export summary about 7ms, full export queue about 13ms, file inventory about 10ms and job list about 5ms on the current 23-work/967-page local library. Re-profile before adding caching or query abstractions.
- Preserve startup recovery semantics: queued/running work is failed as retryable after process restart, cancelling becomes cancelled, and paused remains resumable. Remote-import enqueue must stay idempotent per gallery.
- Preserve the accessible control model: segmented filters are button groups with `aria-pressed`, custom Folio selects return focus to their trigger, and animated feedback wrappers must keep alert/status/ARIA attributes. The global TaskDock must continue showing paused and cancelling work; its initial poll must remain StrictMode-safe, non-overlapping, hidden while paused, and covered by `apps/web/e2e/taskdock.spec.ts`.
- Small user-feedback fixes. Keep them scoped and covered by the smallest relevant test.

## Verification

- `PYTHONPATH=apps/api .venv/bin/pytest apps/api/tests -q`
- `cd apps/web && npm run build`
- `git diff --check`
- Static scan touched files for mock/sample/random hardcoded records.
- For visual work, run browser screenshot QA with real local data and include screenshots in the status update.

设置标题动画使用无外框的开放式滑轨与齿轮，依次调节后复位；不要恢复面板外框、图标轮播或整组浮动。保留局部 transform、离屏暂停及 reduced-motion。队列箭头固定于列间中央，用透明度表达阶段；完成标记必须晚于卡片淡出。文字条及匹配框的缩放原点必须相对自身，词典文字跟随书页。运行 scene-motion.spec.ts 检查完整周期定位，并对九页采样检查。

最新首页阶段覆盖旧工作台构图：#workbench 导航名为“首页”，复用 folio/ui/HomeHero，真实最近入藏最多3张封面及馆藏数；不恢复顶部管理账本、标题说明或欢迎词。演示首页使用无馆藏空态，不能伪造作品。标准标题说明统一不渲染。队列/治理场景已完整替换，前缀 queue/edit；删除的 task/governance 旧动画不可复活。站点 SVG icon 在 public/icon.svg；首页使用原生阅读链接和既有缩略图。验证首页0/1/2/3封面、手机/大屏、减少动态效果、登录、四个书架和 scene-motion 回归。

后续首页修订优先级最高：禁止恢复大字品牌首屏、封面扇形、首页重复导航按钮和空旷展示区。保留小标题/作品数，最近导入与继续阅读直接展示作品；两行共用 ContinueReadingRow，宽度165–280px。网页不得出现“馆藏/入藏”及 local collection；不要用宣传、欢迎词填空白。图标仅保留 favicon。

2026-09-08 用户最新方向优先：主页只负责视觉与独特玩法，组合可漫游封面墙和立体翻阅台。不要恢复统计、书架列表、大标题、欢迎词或页面跳转按钮。HomeHero 用同一组最多36张真实封面连续变形，控件仅服务漫游/翻阅；保留拖动防误点、触屏换页、键盘、减少动态效果及空作品状态。运行 home-gallery.spec.ts 与 shelf-navigation.spec.ts；后者现在只覆盖我的库（首页已无书架）。

2026-09-08 最新用户要求覆盖上述封面墙/翻阅台：用户拒绝两种方案，要求大量交互与动效、允许抽象装饰和数据展示，但必须匹配纸色墨线朱红。当前 HomeHero 已更换为三态页片装置与真实统计排版；不能恢复封面墙。数据来自 librarySummary / libraryStatistics(30)，失败显示破折号和重试，不伪造统计。home-gallery.spec.ts 已迁移为装置交互/数据失败用例。

2026-09-08 首页语义修订（优先于上述装置描述）：删除叠页/回环/流线模式面板、展开滑杆与印章动作。HomeHero 的页片一一对应最多36部真实最近作品；墨色加粗与放大表示当前作品，朱红线段仅表示已读进度，不能把未读轮廓全部涂红。拖动/方向键/前后按钮同步右侧真实标题（原生阅读链接）、页数和进度。阅读日期联动时长/作品/会话，点击阅读节律恢复30天汇总。沿用纸墨动效但不再提供纯形态测试控件。数据仍支持局部失败重试；无作品时不伪造页片。

2026-09-08 独立首页静态预览：`/?home-preview=1#workbench` 使用 `workbench/HomeLayoutPreview.tsx` / `.css`，由 WorkbenchPage 按查询参数懒加载；正常首页不替换。复用真实作品/统计，并额外读取 libraryContinueReading(3)。完整封面按原比例显示，原生阅读链接，尊重隐私开关；未使用生图素材或添加展示动效。已验证1440/390/2560尺寸、横竖封面比例、标题占位和阅读链接。此入口用于用户审阅构图，不代表最终设计。

2026-09-09 互动扉页原型：`/?home-preview=play#workbench` 懒加载 `workbench/HomePlayPreview.tsx` / `.css`，独立于正常首页与 `home-preview=1` 静态作品预览。不请求作品或统计，不添加假数据。书签支持拖动实时编排、松手吸附、点击/键盘切换；六个分镜提供形态反馈。复用 Motion 和原生 SVG，轻量 DOM 属性订阅避免每帧 React 重渲染；桌面/窄屏分别排版，减少动态效果取消过渡。验证三种视口、所有分镜、快速往返拖动、触屏、取消手势、键盘及最终布局不重叠。这是供用户评估核心玩法的原型，不代表最终首页设计。


2026-09-10 三种独立首页体验预览：`/?home-preview=encounter#workbench`（方案1）、`/?home-preview=echo#workbench`（方案2）、`/?home-preview=imprint#workbench`（方案3）。实现位于 `apps/web/src/components/workbench/concepts/`，WorkbenchPage 按查询参数懒加载，原首页与 `1` / `play` 入口保留。
- 方案1：从整个未读结果分页抽取，点击/滑动书签揭晓，收藏、阅读和本次回看均使用真实作品。
- 方案2：从最近阅读开始（没有记录时取最近添加），查询真实作者/标签与最近阅读，支持沿作品追溯和返回探索路径；异步关系仅对当前作品生效。
- 方案3：近30天阅读数据生成曲线，三个书签可用鼠标、触屏或方向键编排，保存当前构图为1800×1200 PNG。空记录不伪造数据。
- 沿用 Folio 纸/墨/朱红及导航；封面隐私、加载失败重试、减少动态效果和响应式布局保留。无新增依赖，无生成图片素材，无 API/schema 变更。这三个入口供用户体验对比，尚未选定最终首页。
- 验证入口：`apps/web/e2e/home-concepts.spec.ts` 覆盖抽取去重/收藏恢复、关系往返和拖动/键盘/PNG导出；浏览器检查1440×1000、390×844、2560×1440三种尺寸。


2026-09-13 三方案视觉修订：页面取消自创名称和标题，预览入口仍使用 encounter / echo / imprint。方案1恢复贯穿抽取页片的朱红轨迹、边线层次和本次查看记录；方案2改为真实阅读记录、当前作品及作者/标签分支组成的开放关系图，封面缩为小型注记；方案3重做为三组短线簇、局部页形、四点拖动和日期联动，保留完整1800×1200 PNG导出，手机单独裁定视域，导出仍含完整构图。读数由现有API提供，未添加样例数据、生成图片素材或依赖。

共享交互修复：原 `.folio button:active` 直接覆盖 transform，导致依赖 translate 定位的关系节点和拖动点在按下时跳开。按压反馈改用独立 translate / scale 属性，保留原定位与动效。`.folio-scroll` 作为路由焦点落点不显示整圈浏览器默认黑框，按钮/链接保留焦点提示。验证应覆盖三方案、原书签原型与书架导航，不能仅以构建通过代替视觉检查。


2026-09-13 方案2交互修订：`?home-preview=echo#workbench` 保持独立预览。EchoPreview 固定左侧真实阅读记录顺序，显示月日/时分、作品标题与进度；中间封面及右侧关联封面随视口放大。关系按同作者/同系列/同角色及较低频的共享标签查询，排除原创作为系列，最多显示三个非空分组并跨组去重。标签频次取现有 tag-filters（最多200项），未覆盖的低频标签由搜索验证，不等同语义推荐；每个类型最多取一个标签、主题最多两个。底部重复时间轴移除，探索路径自然换行。切换使用 Motion 选中指示/封面过渡，最多缓存20部本次关系结果；细线与节点待机动效离屏/后台暂停，尊重减少动态效果。无新依赖/API/schema变更。回归覆盖关系往返、记录顺序、空分类隐藏和失败重试，配合1440/390/2560浏览器检查。
