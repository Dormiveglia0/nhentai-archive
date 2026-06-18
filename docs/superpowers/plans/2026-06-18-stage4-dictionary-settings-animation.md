# 阶段 4 · Dictionary / Settings 页动画 Implementation Plan

> 用 superpowers:executing-plans 逐任务执行。

**Goal:** 为词典治理与设置页接入克制进场动画,完成 Claude 动画视觉线剩余范围。

**Architecture:** 只改 dictionary/settings React 组件、少量 `app.css` 透传类、项目状态文档。全部基于阶段 0 `FadeIn`/`Stagger`/`StaggerItem`/`Presence`,不改 API 与数据逻辑。

**Tech Stack:** React 18, motion 12(`lib/motion`), Vite。

## Global Constraints

- 不改任何后端接口、`lib/api.ts` 类型、词典/设置读写逻辑。
- 不直接 import 或使用 `motion.*`;只从 `../../lib/motion` 取原语。
- 候选表是内部滚动容器,禁止使用 `Reveal`。
- 验证 = `cd /opt/nhentai/frontend && npm run build` 通过;视觉由用户 `npm run dev` 验收。

---

### Task 1: 词典摘要与候选池进场

**Files:** Modify `frontend/src/components/dictionary/DictionarySummaryStrip.tsx`, `frontend/src/components/dictionary/DictionaryCandidatePool.tsx`, `frontend/src/styles/app.css`

- [ ] `DictionarySummaryStrip` import `Stagger`/`StaggerItem`,将指标与动作按钮包成逐项进场。
- [ ] `DictionaryCandidatePool` import `Stagger`/`StaggerItem`,表头保持静态,候选行包 `StaggerItem className="candidate-row-motion"`。
- [ ] 候选列表 `Stagger` key 使用 `query`, `typeFilter`, `status`, `offset`, `limit`, 首尾候选 key 和数量。
- [ ] CSS 新增 `.candidate-row-motion { display:block; width:100%; }`。

### Task 2: 词典编辑器、预览与批量导入 modal

**Files:** Modify `DictionaryPage.tsx`, `DictionaryEditor.tsx`, `DictionaryEvidencePanel.tsx`, `app.css`

- [ ] `DictionaryPage` 用 `Presence` 包住 bulk modal 条件渲染,backdrop/modal 使用 `FadeIn`,保留 Escape/backdrop close。
- [ ] `DictionaryEditor` 用 keyed `FadeIn` 包住表单与 action footer,header 不重挂。
- [ ] `DictionaryEvidencePanel` 空态、有内容态、metrics/split/works 使用 `FadeIn/Stagger`,按 preview/evidence/form 变化重播。
- [ ] CSS 移除 `.dictionary-modal` 的 keyframe animation,避免双重动画。

### Task 3: 设置页进场

**Files:** Modify `frontend/src/components/settings/SettingsPage.tsx`, `app.css`

- [ ] import `FadeIn`/`Stagger`/`StaggerItem`。
- [ ] 三栏用 `FadeIn` 错峰进场:rail 左入、main 上浮、summary 右入。
- [ ] 中间 `.settings-main` 用 `Stagger`,`.settings-card` 包 `StaggerItem className="settings-card-motion"`。
- [ ] message/error notice 用 keyed `FadeIn`。
- [ ] CSS 新增 `.settings-card-motion { display:block; min-width:0; }`。

### Task 4: 文档同步与验证

**Files:** Modify `docs/PROJECT_STATUS.md`, `docs/superpowers/ANIMATION_HANDOFF.md`

- [ ] 在 `PROJECT_STATUS.md` Completed 顶部追加阶段 4 记录。
- [ ] 更新 `ANIMATION_HANDOFF.md`,标明 dictionary/settings 已完成,动画线剩余进入后续可选 polish。
- [ ] Run `cd /opt/nhentai/frontend && npm run build`。
- [ ] Run static checks for direct `motion.*` import/use and fake data additions.
