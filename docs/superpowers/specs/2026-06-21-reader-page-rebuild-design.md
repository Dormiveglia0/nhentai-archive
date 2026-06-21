# 阅读器页面完全重构 — 设计文档

- 日期：2026-06-21
- 状态：已批准设计，待写实现计划
- 范围：`frontend/src/components/reader/` 及 `frontend/src/styles/app.css` 中的 `reader-*` 规则

## 1. 背景与目标

当前 `ReaderPage.tsx`（285 行单文件）采用三栏布局（左侧封面+文字页码列表 / 中间阅读区 / 右侧检查器），把阅读区挤得很小，且存在以下问题：

- 右侧"阅读设置" tab 是空的死按钮。
- 连续滚动模式进度同步、远端/本地差异处理粗糙。
- `app.css` 中 `reader-*` 规则散落在 4 处以上，含重复/冲突的 `.reader-page` 定义。

本次为**完全重构**，把它做成一个**成熟的漫画阅读器**，目标覆盖五个方面：

1. 沉浸式阅读体验（图片为主、chrome 自动隐藏）。
2. 功能增强（缩放/适配、点击区翻页、缩略图跳页、键盘+全屏、阅读方向）。
3. 视觉与代码质量（拆分组件、清理 CSS）。
4. 修复现存问题（死按钮、进度同步、远端/本地差异）。
5. 整体作为专业漫画阅读器的交互范式。

## 2. 布局范式：沉浸全屏 + 可呼出面板

- 根容器改名 `.reader-shell`（消除 app.css 中重复/冲突的 `.reader-page` 定义），全屏铺满、深色背景。
- 默认只显示图片。顶部浮层工具栏与侧/底抽屉面板默认隐藏。
- 鼠标移动 / 触摸唤出 chrome；约 **2.5s 空闲后自动淡出**。
- 面板打开或鼠标悬停其上时**钉住**不隐藏。
- 缩略图目录、作品信息+阅读设置作为呼出的抽屉面板（☰ 触发），不再常驻栏。

## 3. 阅读模式

支持的模式（确认范围，**不做双页**）：

- **单页**：按 `fit`（宽/高/原始）适配；滚轮或 `+/-` 缩放，缩放后可拖拽平移；左右**点击区**按 `direction` 翻页，中间点击区切换 chrome 显隐。
- **Webtoon 连续长条**：垂直无缝连续滚动，懒加载（`loading="lazy"` + 视口附近预渲染窗口），IntersectionObserver 判定当前页 → 防抖写回进度。
- **阅读方向 `ltr` / `rtl`**：影响单页点击区与方向键映射；webtoon 为纵向滚动，方向键走上下、忽略左右语义。

## 4. 组件与文件结构（`frontend/src/components/reader/`）

遵循设置页重构约定：编排组件 + `useXxxState` hook + 拆分子组件 + helpers。

| 文件 | 职责 | 依赖 |
|---|---|---|
| `ReaderPage.tsx` | 编排：加载数据、组装布局、调度 chrome 自动隐藏 | 下列全部 |
| `useReaderData.ts` | 加载 work/gallery/pages/state，归一化为 `ReaderPageItem[]`；暴露 `pageCount / pageIndex / setPage`（本地服务端持久化+防抖，远端仅内存） | `lib/api` |
| `useReaderPrefs.ts` | `mode` / `direction` / `fit` / `zoom`；除 `zoom` 外持久化到 localStorage（全局偏好） | localStorage |
| `useReaderChrome.ts` | 空闲自动隐藏、鼠标/触摸唤出、面板打开或 hover 时钉住 | — |
| `ReaderToolbar.tsx` | 浮层顶栏：返回、标题、`页 x/y`、模式/方向/适配/缩放、全屏、隐私遮罩、面板开关 | prefs、data |
| `ReaderViewport.tsx` | 舞台容器：按模式渲染 `SinglePageView` / `WebtoonView`，处理点击区与缩放 | 两个视图组件 |
| `SinglePageView.tsx` | 单页 + 适配/缩放 + 方向感知点击区翻页 | — |
| `WebtoonView.tsx` | 垂直连续滚动 + 懒加载 + IntersectionObserver 同步当前页（防抖持久化） | — |
| `ThumbnailPanel.tsx` | 缩略图网格抽屉，点击跳页（取代文字页码列表） | data |
| `ReaderInfoPanel.tsx` | 作品信息（封面/标题/标签/进度）+ 动作（标记已读 / 进入治理 / 加入导入队列）+ 阅读设置控件 | data、prefs |
| `readerHelpers.ts` | 类型（`ReaderPageItem`、`Mode`、`Direction`、`Fit`）、常量、keymap | — |

### 单元契约（隔离与清晰）

- `useReaderData`：输入 `source`，输出归一化页面列表 + 当前页/总页 + `setPage`。消费者无需关心本地/远端差异。
- `useReaderPrefs`：纯偏好状态 + 持久化，与数据无耦合。
- 视图组件（Single/Webtoon）：纯展示 + 翻页/滚动回调，不直接触碰 api。

## 5. 数据流

- **本地**：`api.work` + `api.pages` + `api.readerState`。`setPage` 经 `api.updateReaderState` 持久化；webtoon 滚动用**防抖（约 600ms）**避免高频请求。
- **远端**：`api.gallery` → 带 url 的 pages；进度仅内存、不持久化；保留"加入导入队列"动作。
- **标签显示**：遵循字典 `display` 规则。远端用 `GalleryDetail.tags.display`；本地 `api.work` 返回的 `Work` 不含 tags，故本地信息面板**暂不显示标签**，仅显示 标题/进度/动作。（本次不引入额外接口；若日后需本地标签，可复用 `api.workGovernance`。）

## 6. 键盘 / 全屏

| 按键 | 行为 |
|---|---|
| `←` / `→` | 翻页（方向感知；webtoon 下忽略左右语义） |
| `Space` / `Shift+Space` | 下一页 / 上一页 |
| `↑` / `↓` | webtoon 下滚动 |
| `f` | 全屏（浏览器原生 Fullscreen API） |
| `+` / `-` / `0` | 缩放放大 / 缩小 / 复位 |
| `h` | 隐私遮罩切换 |
| `t` | 缩略图面板 |
| `i` | 信息面板 |
| `g` | 数字跳页 |
| `Esc` | 关闭面板 / 退出全屏 |

## 7. 偏好持久化

- localStorage key（示例）`nh.reader.prefs`，存 `mode` / `direction` / `fit`。
- `zoom` 不持久化，按作品重置。
- 页码进度对本地作品仍由服务端 `reader-state` 持久化，不进 localStorage。

## 8. 错误与空态

- 错误态（加载失败）。
- 空页提示（本地无可读页面 / 远端未返回 url）。
- 单张图片加载失败：占位 + 重试。
- 隐私遮罩对整个舞台生效（沿用现有 `masked` 行为，`h` 切换）。

## 9. CSS 清理

- 将 app.css 中散落在 4 处的 `reader-*` 规则收敛为**一个连贯区块**。
- 删除冲突/重复的 `.reader-page` 定义。
- 新类名前缀：`reader-shell` / `reader-viewport` / `reader-chrome` / `reader-panel` 等。
- 保持单一 `app.css` 约定，不新建 css 文件。

## 10. 测试

- 复用现有 Playwright e2e，为阅读器新增用例：
  - 单页翻页（点击区 + 键盘，含 rtl/ltr）。
  - 模式切换（单页 ↔ webtoon）。
  - 缩略图跳页。
  - 全屏 / 缩放。
  - 远端只读（无进度持久化、加入队列）。
  - chrome 自动隐藏/唤出。

## 11. 明确不做（YAGNI）

- 双页（跨页展开）模式。
- 本地作品标签展示（待后续，需额外接口）。
- 阅读器内的跨作品"上一话/下一话"章节跳转。
