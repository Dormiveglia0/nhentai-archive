# 下一阶段工作入口

先读 [AGENT_MAP.md](AGENT_MAP.md)，然后按需读 [PROJECT_STATUS.md](PROJECT_STATUS.md)、[PROJECT_MAP.md](PROJECT_MAP.md)、[DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md)。当前阶段证据集中在 [SITE_LAYOUT_REFINEMENT.md](SITE_LAYOUT_REFINEMENT.md)，不要从历史草案恢复旧设计。

## 保留约定

- NH 原标志与独立黑红favicon，直角、纸墨朱红。页头不重复顶部标签；SVG装饰不占首屏空间，使用有限动画。
- 全部跨项指示条连续移动，只挂载最终页。主模块沿用方向过渡，详情用轻淡入；读者减少动态效果时立即到目标。
- 首页左侧轮播真实继续阅读/近期作品，下方最新远端作品。焦点、后台、离屏或阅读器打开时暂停轮播/无用轮询。
- 库详情原生悬浮弹窗，封面不加背景垫。详情跳转先准备目标数据，不能先关闭弹窗再截图；阅读器入口同步关闭并隔离旧页面。
- 发现常驻更新，全站未读提示；订阅近期作品来自真实上游。只按明确原文标题折叠语言预览，同卷/章节界限保留。
- 刮削弹窗初始即带双来源状态，加载/错误保留尺寸；不要恢复晚到控件导致的跳动。
- 迁移必须预览来源、目标、容量和冲突；验证后才切换来源，移动才删除独立导入原文件。保持作品身份与阅读记录。
- 源文件只读、外部目录、离线挂载、版本变化与缓存租约遵循已有服务边界，不能在UI里绕过。
- 旧schema升级幂等，受管路径便携；SMTP/认证秘密不返回、不打印。测试必须在私有副本。
- 正式 feature 不导入 demo；继续使用现有 Motion、原生平台功能与Folio控件，避免重复实现/新依赖。

## 验证入口

`npm run dev` 启动整套本地环境。API测试用 `PYTHONPATH=apps/api .venv/bin/pytest apps/api/tests -q`；构建用 `npm --prefix apps/web run build`。前端需要 `E2E_BASE_URL`、`E2E_STORAGE_STATE` 和实际自有数据，各写入用例另有明确的 `/tmp` 环境约束。

本阶段核心用例：`site-layout-refinement`、`site-audit`、`scene-motion`、`home-gallery`；原功能用 `reader`、`reader-direct`、`reader-bridge`、`file-ownership`、`source-operations`、`discover-fixes`、`shelf-navigation`、`media-experience` 等复验。保留错误/空态、手机/横屏、焦点、滚动和修饰键行为。设计验收检查实际渲染及动画中间帧，不能只检查构建。

部署从当前源码构建，保存旧镜像与一致性SQLite备份；核对静态资源、健康、认证和原有数据/源文件后再报告完成。
