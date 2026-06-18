# 阶段 4 · Dictionary / Settings 页动画 — 设计文档

日期:2026-06-18
分支:codex-nh-archive-local-web
依赖:阶段 0(`lib/motion/` 原语层)、阶段 1-3 的列表/面板进场模式

## 目标

完成动画视觉线剩余页面:词典治理与设置。动效采用克制进场风格:淡入、轻微位移、列表逐项浮现、弹窗进出场。保留全部真实数据读写、筛选、预览、批量导入、设置保存/验证/清除 Key 行为。

## 现状(已勘查)

- 词典页是两栏工作区(`候选术语池 | 术语编辑器`)加下方单一 `应用预览` 面板。候选表 `.candidate-table` 是内部 `overflow-y:auto` 容器,不可用 `Reveal`。
- 词典候选行是 grid row,活动态靠 `.candidate-row.active` 与左侧 terracotta bar。包裹 motion 层时必须保持行宽和 grid 行结构。
- 批量导入使用 `.preview-backdrop` + `.dictionary-modal`,当前 CSS 有 keyframe modal 动画。接入 `Presence` 后需要避免双重动画。
- 设置页是三栏 grid:`settings-rail | settings-main | settings-summary`;中间设置卡片为普通块级 section,适合逐项进场。

## 方案

### 1. 词典摘要与候选池

`DictionarySummaryStrip` 用 `Stagger` + `StaggerItem` 包裹 5 个指标和同步按钮,挂载时逐项进场。

`DictionaryCandidatePool` 的 `.candidate-table` 保持为滚动容器,表头不动画;候选行用 `StaggerItem className="candidate-row-motion"` 包裹。`Stagger` key 由 `query/typeFilter/status/offset/limit/candidates` 组成,筛选、翻页、刷新结果时重播。

新增 CSS `.candidate-row-motion { display:block; width:100%; }`,确保内部 button 仍占满表格宽度。

### 2. 词典编辑器、预览与弹窗

`DictionaryEditor` 用 `FadeIn key={dictionaryId ?? remoteTagId ?? originalText || "new"}` 包住表单与动作区,选中候选或新建本地词条时轻柔刷新。编辑器外壳和 header 不重挂,避免按钮位置跳动。

`DictionaryEvidencePanel` 对空态、指标区、split 区、关联作品行使用 `FadeIn/Stagger`。关联作品网格用 `Stagger`,key 跟随 work ids;空态与有内容态切换用 keyed `FadeIn`。

批量导入 modal 用 `Presence` 包住条件渲染。backdrop 和 modal 各自用 `FadeIn`,保留 Escape/backdrop 关闭逻辑。`.dictionary-modal` 去掉 CSS keyframe animation,避免与 motion 双重叠加。

### 3. 设置页

`SettingsPage` 的三栏用错峰 `FadeIn`:rail 从左、main 轻微上浮、summary 从右。中间 `.settings-main` 改为 `Stagger`,每个 `.settings-card` 放入 `StaggerItem className="settings-card-motion"`。notice 用 keyed `FadeIn`,避免保存/错误消息突兀出现。

新增 CSS `.settings-card-motion { display:block; min-width:0; }`,保持 settings-main grid 间距和卡片宽度。

### 无障碍

全部使用阶段 0 原语,reduced-motion 自动去位移、保留淡入。不新增 hover-only 信息,不改变键盘/点击路径。

## 不在范围

- 不改后端、API、`lib/api.ts` 类型。
- 不引入 magicui/react-bits 模板或新组件库。
- 不清理旧词典 CSS,只补必要透传类。
- 不新增强反馈动画、layout 动画、drag 动画,`MotionProvider` 继续使用 `domAnimation`。

## 验证

- `cd frontend && npm run build` 通过。
- 静态检查:dictionary/settings 只从 `../../lib/motion` 引入原语,不直接使用 `motion.*`;不新增 mock/fake/random/hardcoded tag 数据。
- 用户 `npm run dev` 验收:词典筛选/翻页/选择候选/预览影响/批量导入弹窗可用;设置读取/保存/验证连接/清除 Key 可用;桌面和移动端不重叠、不压缩、不溢出。
