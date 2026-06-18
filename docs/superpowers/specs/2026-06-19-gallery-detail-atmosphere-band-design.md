# 作品详情页 · 氛围横幅重构 — 设计文档

日期:2026-06-19
分支:codex-nh-archive-local-web
依赖:codex 的作品详情页重构(`GalleryDetailPage.tsx`)、词典显示规则(全站 tag 显示走 `display`)

## 问题

详情页 hero 原为两列硬网格(左:固定 `7/10` 竖向封面框;右:信息面板,内含标题/标签/事实/按钮)。两个**高度互相独立变化**的块被强行并排:

- 封面被**长宽比**约束 → 不同封面渲染尺寸不同,横向封面在竖框里留白(模糊填充只是补丁);
- 右列高度随**标签数量**变化 → 标签几十个时极高、作者/语言寥寥几个时极矮。

结果:左右两列底边几乎永远参差,且每翻一本书布局都在抖动(逼死强迫症)。这是本次要解决的根因。

## 方案(用户在两套方案中选定「氛围横幅」)

核心两步,缺一不可:**封面按高度约束(非长宽比)** + **标签移出列、改为整宽区域**。

### 1. hero = 一整块固定高度横幅
- `.gallery-hero-band` 固定高度 `clamp(300px, 35vw, 432px)`,不再是两列网格 → 横幅外框恒定,翻书不抖。
- `.gallery-hero-backdrop`:同图模糊(`blur(34px)`、`scale(1.25)`、低透明度)铺满整条横幅作氛围底。
- `.gallery-hero-scrim`:奶油色(`--paper`)横向渐隐洗白,右侧近实纸色,保证深色标题/事实在暖纸主题下可读(不用黑色 scrim)。
- 封面放进**恒定尺寸卡槽** `.gallery-hero-cover`(宽 `clamp(158px,22vw,264px)` × 横幅满高):竖封面填满高度、横封面填满宽度,均居中,占位对每本书都相同;卡槽空余由模糊底填充,既不裁剪也无死留白。
- 右列 `.gallery-hero-info` 垂直居中:eyebrow + 标题(`-webkit-line-clamp:3` 防撑破)+ 英文副标题 + 紧凑统计条(ID/页数/收藏/上传,细竖线分隔)+ 操作按钮(阅读/导入或治理)置于信息列底部。

### 2. 标签整宽化
`GalleryTags` 移出 hero,作为横幅下方独立整宽面板。`.gallery-tag-groups` 由「auto-fit 多列网格」改为**每组各占一整行**(`84px` 标签名 + 标签横向铺满整宽换行),组间细横线分隔:

- 几十个内容标签 → 横向铺宽,仅占少数几行,不再顶高;
- 作者/语言/原作等少标签组 → 单行,右侧无空白。

### 3. 相关作品
- 展示内容标签(仅 `tag`/`character` 类,与 discover 卡片一致),单行平铺、右端 mask 淡出裁切 → 卡片高度与标签数量无关、始终齐平。
- 列表由「左对齐 auto-fill 网格」改为**居中固定宽卡片**(`190px`,flex wrap + `justify-content:center`):固定约 5 项时整体居中,右侧不再留大块空白。
- 标签显示走 `defaultDisplayTag`(`display || name || slug`),遵守全站规则:**页面内 tag 一律显示词典转换后的名**,英文 `name` 仅作无词典项时的兜底;英文原文只用于后端 API 请求。

## 后端配合
`discover_service.gallery()` 的相关作品原仅 `map_gallery_summary`(只带 `tag_ids`)。改为复用 feed 的富化路径 `_tags_for_items` + `_with_import_state`,把 `tag_ids` 解析为完整 tag(优先本地 `remote_tags` 缓存的 `zh_name → name → slug` 作 `display`,缺失回源 `tags_by_ids`),并带上入库状态。前端 `GallerySummary.tags` 类型补 `display?`。

## 移动端
`@media (max-width:760px)`:横幅高度自适应、`.gallery-hero-stage` 改竖向堆叠(封面在上居中、信息在下居中)、按钮居中、统计条居中。

## 不在范围
- 不改阅读器、治理、导入队列本身的逻辑;
- 相关卡标签为纯展示(未做点击跳转,避免按钮嵌套)。

## 验证
- `cd frontend && npm run build` 通过;`PYTHONPATH=backend python3 -m pytest backend/tests -q` 35 passed。
- 用户 `npm run dev` 验收(后端改动需重启 + 硬刷新):连翻封面比例/标签数量差异大的作品,横幅骨架与相关卡片高度恒定;横向封面居中无留白无裁剪;标签整宽铺开;相关作品居中且每张带词典中文内容标签。
