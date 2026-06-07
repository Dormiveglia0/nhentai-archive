# AI_PROJECT_MAP.md

> 给 AI 接手本项目用的上下文地图。重点不是宣传说明，而是：**改什么、去哪找、函数在哪里、调用链怎么走**。
>
> 当前仓库形态：Go 单体后端 + React/Vite 前端。后端核心逻辑集中在 `server/main.go`，前端核心逻辑集中在 `frontend/src/App.tsx`、`frontend/src/lib/api.ts`、`frontend/src/views/*`。

---

## 0. AI 接手时先读这些文件

按顺序读：

```text
README.md
AI_PROJECT_MAP.md
server/main.go
frontend/src/App.tsx
frontend/src/lib/api.ts
frontend/src/views/ImportPage.tsx
frontend/src/views/LibraryPage.tsx
frontend/src/views/WorkDetailPage.tsx
frontend/src/views/DictionaryPage.tsx
frontend/src/views/TasksPage.tsx
frontend/src/views/SettingsPage.tsx
```

如果只改后端，优先读：

```text
server/main.go
```

如果只改前端，优先读：

```text
frontend/src/App.tsx
frontend/src/lib/api.ts
frontend/src/components/Shell.tsx
frontend/src/components/Auth.tsx
frontend/src/components/Cover.tsx
frontend/src/views/<对应页面>.tsx
```

---

## 1. 项目一句话架构

```text
Browser React SPA
  -> frontend/src/lib/api.ts: ApiClient
  -> Go monolith server/main.go: /api/* handlers
  -> SQLite /app/data/app.db
  -> Files /app/data/library: original cbz, covers, exports, tmp
  -> Remote source API/CDN through NHClient
  -> Background import through Worker
```

运行形态：

```text
Docker container
  /app/nhentai-archive  # Go binary
  /app/public           # frontend/dist
  /app/data/app.db      # SQLite
  /app/data/library     # CBZ library / covers / exports / .tmp
```

---

## 2. 顶层文件角色

```text
README.md
  用户向说明：部署、功能、运行命令。

PROJECT_MAP.md
  人类阅读版项目地图。

AI_PROJECT_MAP.md
  AI 接手版项目地图：函数位置、调用链、改动入口。

Dockerfile
  三阶段构建：Node build frontend -> Go build server -> Alpine runtime。

docker-compose.yml
  单 app 服务，映射 PUBLIC_PORT 到容器 8080，挂载 HOST_DATA_DIR 到 /app/data。

go.mod / go.sum
  Go module；主要 DB 依赖是 modernc.org/sqlite。

server/main.go
  Go 单体后端：配置、HTTP 路由、SQLite schema/migrations、auth、settings、remote client、worker、archive parse、work/tag/dictionary/export handlers、static file serving。

frontend/package.json
  Vite + React + TypeScript。

frontend/src/App.tsx
  前端根状态、hash route、token、页面装配、轮询任务/状态。

frontend/src/lib/api.ts
  前端唯一 API client；类型定义也在这里。
```

---

## 3. 后端总览：`server/main.go`

### 3.1 启动链路

```text
main()
  loadConfig()
  mkdir LibraryDir / LibraryDir/.tmp / DatabasePath dir
  sql.Open("sqlite", DatabasePath)
  App{cfg, db, crypto, started}
  app.initDB()
  app.client = NewNHClient(cfg, app)
  app.worker = NewWorker(app)
  app.worker.Start()
  http.ListenAndServe(cfg.Addr, app.routes())
```

关键类型：

| 类型 | 位置 | 作用 |
|---|---:|---|
| `Config` | `server/main.go:40` | 环境变量解析后的运行配置 |
| `App` | `server/main.go:98` | 聚合 cfg/db/crypto/client/worker/started |
| `Work` | `server/main.go:1108` | 前端作品列表/详情主对象 |
| `WorkTag` | `server/main.go:1134` | 作品标签对象，含词典/机翻/最终值 |
| `ParsedArchive` | `server/main.go:1147` | 解析 CBZ/ZIP 后的中间结果 |
| `DictEntry` | `server/main.go:2992` | 词典条目 |
| `DictionaryTagItem` | `server/main.go:3000` | 词典页“库内 tag 聚合”对象 |
| `TranslationItem` | `server/main.go:3432` | 翻译建议输入项 |
| `Tag` | `server/main.go:3649` | 远端/本地标签中间结构 |
| `GallerySummary` | `server/main.go:3655` | 远端 gallery 统一摘要给前端用 |
| `CDNConfig` | `server/main.go:3672` | image/thumbnail CDN server 列表 |
| `NHClient` | `server/main.go:3677` | 远端 API/CDN client |
| `Worker` | `server/main.go:4244` | 后台导入队列 |
| `ComicInfo` | `server/main.go:4479` | ComicInfo.xml 结构 |
| `SecretBox` | `server/main.go:4597` | secrets 加密保存 |

---

## 4. 后端路由到函数索引

所有业务 API 基本通过 `a.auth(...)` 保护；公开接口只有 health/setup/login/static。

### 4.1 路由注册入口

| 函数 | 位置 | 作用 |
|---|---:|---|
| `routes()` | `server/main.go:140` | 注册所有 `/api/*` 和静态前端 handler |
| `securityHeaders()` | `server/main.go:181` | 给响应加安全 header |
| `auth()` | `server/main.go:556` | Bearer token 认证中间件 |
| `handleStatic()` | `server/main.go:4702` | SPA 静态文件 fallback；`/api/` 不走静态 |

### 4.2 公开 / 初始化 / 登录

| API | handler | 位置 | 说明 |
|---|---|---:|---|
| `GET /api/health` | `handleHealth` | `server/main.go:434` | 返回 status/uptime |
| `GET /api/setup/status` | `handleSetupStatus` | `server/main.go:438` | 是否需要首次管理员设置 |
| `POST /api/setup/admin` | `handleSetupAdmin` | `server/main.go:442` | 创建管理员并返回 token |
| `POST /api/auth/login` | `handleLogin` | `server/main.go:481` | 登录并创建 session |
| `POST /api/account/password` | `handlePasswordChange` | `server/main.go:511` | 修改密码，清理其它 session |

相关 helper：

| 函数 | 位置 | 说明 |
|---|---:|---|
| `adminExists()` | `server/main.go:428` | 判断是否已有管理员 |
| `createSession()` | `server/main.go:575` | 生成随机 token，保存 token hash |
| `sessionUser()` | `server/main.go:586` | 校验 token hash 和过期时间 |
| `hashToken()` | `server/main.go:599` | SHA256 token |
| `hashPassword()` | `server/main.go:4646` | PBKDF2-SHA256 密码哈希 |
| `verifyPassword()` | `server/main.go:4656` | 校验密码 |
| `pbkdf2SHA256()` | `server/main.go:4677` | PBKDF2 实现 |
| `hmacSHA256()` | `server/main.go:4696` | PBKDF2 内部 HMAC |

### 4.3 设置 / secrets / 状态 / 日志

| API | handler/helper | 位置 | 说明 |
|---|---|---:|---|
| `GET/PATCH /api/settings` | `handleSettings` | `server/main.go:621` | 读取/保存普通 settings |
| `PATCH /api/settings/secrets` | `handleSecrets` | 约 `server/main.go:660` | 保存加密 secrets |
| `GET /api/status` | `handleStatus` | `server/main.go:705` | 返回运行状态、CDN、翻译、存储、worker 计数 |
| `POST /api/settings/test-connection` | `handleTestConnection` | `server/main.go:736` | 测试 API root、auth key、CDN |
| `GET /api/settings/export` | `handleSettingsExport` | `server/main.go:794` | 导出 masked config，不含明文 key |
| `GET /api/logs` | `handleLogs` | `server/main.go:826` | 最近 maintenance_events 和 task errors |
| helper | `settingsMap` | `server/main.go:604` | 读取 settings 表为 map |
| helper | `settingValue` | `server/main.go:1588` | 读取 setting，有 fallback |
| helper | `secretStatuses` | `server/main.go:858` | secrets configured/masked 状态 |
| helper | `maskSecret` | `server/main.go:867` | 密钥脱敏 |
| helper | `getSecret` | `server/main.go:877` | 解密 secret |
| helper | `logEvent` | `server/main.go:1422` | 写入 maintenance_events |
| crypto | `NewSecretBox` | `server/main.go:4601` | 由 SECRET_KEY 派生 AES key |
| crypto | `SecretBox.Encrypt` | `server/main.go:4605` | AES-GCM 加密 |
| crypto | `SecretBox.Decrypt` | `server/main.go:4622` | AES-GCM 解密 |

### 4.4 远端搜索 / gallery / CDN image proxy

| API | handler/helper | 位置 | 说明 |
|---|---|---:|---|
| `GET /api/search` | `handleSearch` | `server/main.go:889` | 旧/通用搜索入口，调用 `NHClient.Search` |
| `GET /api/discover/popular` | `handlePopular` | `server/main.go:915` | 热门作品 |
| `GET /api/tags/resolve` | `handleTagResolve` | `server/main.go:925` | 远端 tag resolve |
| `GET /api/tags/galleries` | `handleTagged` | `server/main.go:939` | 按 tag_id 搜索 |
| `GET /api/images/proxy` | `handleImageProxy` | `server/main.go:1426` | 后端代理远端图片，前端封面用 |
| `GET /api/sources/nhentai/search` | `handleSourceSearch` | `server/main.go:953` | 前端搜索页主入口 |
| `GET /api/sources/nhentai/galleries/{id}` | `handleSourceGalleryPath` | `server/main.go:977` | gallery 详情预览 |
| `POST /api/sources/nhentai/galleries/{id}/import` | `handleSourceGalleryPath` | `server/main.go:977` | 单 ID 导入 |
| `GET /api/sources/nhentai/galleries/{id}/related` | `handleSourceGalleryPath` | `server/main.go:977` | 相关作品 |

远端 client：

| 函数 | 位置 | 说明 |
|---|---:|---|
| `NewNHClient()` | `server/main.go:3688` | 创建远端 client |
| `NHClient.request()` | `server/main.go:3698` | GET 包装 |
| `NHClient.post()` | `server/main.go:3702` | POST 包装 |
| `NHClient.requestWithOptions()` | `server/main.go:3706` | 核心 HTTP 请求、UA/API key/rate limit/retry/status 处理 |
| `NHClient.setting()` | `server/main.go:3769` | 从 settings 取远端配置 |
| `NHClient.rateLimit()` | `server/main.go:3777` | 请求间隔控制 |
| `NHClient.Gallery()` | `server/main.go:3787` | `GET /api/v2/galleries/{id}` |
| `NHClient.Search()` | `server/main.go:3791` | `GET /api/v2/search` 并 normalize |
| `NHClient.Popular()` | `server/main.go:3799` | popular |
| `NHClient.Related()` | `server/main.go:3807` | related |
| `NHClient.ResolveTag()` | `server/main.go:3815` | tag resolve |
| `NHClient.Tagged()` | `server/main.go:3819` | tagged galleries |
| `NHClient.DownloadURL()` | `server/main.go:3827` | 官方 download endpoint 获取 CBZ URL |
| `extractDownloadURL()` | `server/main.go:3845` | 从任意响应结构里找 URL |
| `NHClient.CDNConfig()` | `server/main.go:3873` | 获取 CDN config |
| `NHClient.cdnWithOptions()` | `server/main.go:3878` | CDN 请求/缓存/fallback |
| `NHClient.cachedCDNStatus()` | `server/main.go:3923` | status 页使用 |
| `NHClient.fallbackCDN()` | `server/main.go:3933` | fallback 到旧 CDN host |
| `NHClient.normalizeListResponse()` | `server/main.go:3942` | 列表响应统一成 `GallerySummary[]` |
| `normalizeGallery()` | `server/main.go:3982` | 单个 gallery normalize |
| `galleryTitle()` | `server/main.go:4014` | 提取标题 |
| `imageURL()` | `server/main.go:4036` | 根据 CDN + path 生成图片 URL |
| `proxyImageURL()` | `server/main.go:4059` | 生成 `/api/images/proxy?url=` |
| `firstImagePath()` | `server/main.go:4070` | 查找 cover/thumb path |
| `imagePathValue()` | `server/main.go:4086` | 从 string/map 取图片路径 |
| `findNamedImagePath()` | `server/main.go:4103` | 递归找命名图片字段 |
| `cdnConfigFromResponse()` | `server/main.go:4139` | 解析 CDN 响应 |
| `galleryTags()` | `server/main.go:4167` | 提取远端 tags |
| `galleryLanguage()` | `server/main.go:4178` | 从 tag 或已知 tag id 判断语言 |

重要安全边界：`requestWithOptions` 和 `downloadCBZ` 遇到 401/403/429 会直接报错，不实现绕过。

### 4.5 导入任务 / Worker

| API | handler/helper | 位置 | 说明 |
|---|---|---:|---|
| `POST /api/tasks/import` | `handleImport` | `server/main.go:1030` | 接收 ids，调用 `importGalleryIDs` |
| internal | `importGalleryIDs` | `server/main.go:1045` | 去重、已有任务处理、upsert queued tasks |
| `GET /api/tasks` | `handleTasks` | `server/main.go:1384` | 任务列表 |
| `POST /api/tasks/retry-failed` | `handleRetryFailedTasks` | `server/main.go:1392` | failed -> queued |
| `POST /api/tasks/clear-completed` | `handleClearCompletedTasks` | `server/main.go:1407` | 删除 success/completed 任务记录 |
| `/api/tasks/{id}/...` | `handleTaskPath` | `server/main.go:1467` | retry/metadata/download/related/translation/delete |
| helper | `queryTasks` | `server/main.go:1524` | 查任务列表 |
| helper | `taskCounts` | `server/main.go:1545` | status 用任务计数 |
| helper | `getTask` | `server/main.go:1562` | 单任务详情 |
| helper | `insertTask` | `server/main.go:1596` | 本地上传/扫描插入任务记录 |

Worker：

| 函数 | 位置 | 说明 |
|---|---:|---|
| `NewWorker()` | `server/main.go:4251` | 创建 worker |
| `Worker.Start()` | `server/main.go:4255` | goroutine loop |
| `Worker.Stop()` | `server/main.go:4259` | 停止 worker |
| `Worker.loop()` | `server/main.go:4264` | 每秒 ticker 调度 |
| `Worker.schedule()` | `server/main.go:4278` | 从 queued tasks 取任务，按 `DOWNLOAD_CONCURRENCY` 并发 |
| `Worker.runOne()` | `server/main.go:4297` | 单个远程导入完整流程：metadata -> CDN -> download -> parse -> save work |
| `Worker.fail()` | `server/main.go:4387` | 标记 failed |
| `Worker.downloadCBZ()` | `server/main.go:4391` | 获取 download URL，下载到 `.tmp`，rename 到 library |

远程导入调用链：

```text
ImportPage.importIds()
  -> ApiClient.import()
  -> POST /api/tasks/import
  -> handleImport()
  -> importGalleryIDs()
  -> tasks.status='queued'
  -> Worker.schedule()
  -> Worker.runOne()
      -> NHClient.Gallery()
      -> NHClient.CDNConfig()
      -> normalizeGallery()
      -> Worker.downloadCBZ()
          -> NHClient.DownloadURL()
          -> HTTP GET archive URL
      -> App.parseArchive()
      -> App.saveParsedWork()
      -> App.rebuildWorkTags()
      -> tasks.status='success'
```

### 4.6 本地上传 / 扫描 / archive parse

| API | handler/helper | 位置 | 说明 |
|---|---|---:|---|
| `POST /api/local/upload` | `handleLocalUpload` | `server/main.go:1273` | multipart 上传 CBZ/ZIP，保存到 import dir，parse，save work |
| `POST /api/local/scan` | `handleLocalScan` | `server/main.go:1328` | WalkDir 扫描目录内 CBZ/ZIP |
| `GET /api/local/scan/status` | `handleLocalScanStatus` | `server/main.go:1376` | 当前返回 idle |
| helper | `isArchiveName` | `server/main.go:1621` | 判断 `.cbz/.zip` |
| parser | `parseArchive` | `server/main.go:1626` | 打开 zip，算 hash，读 `ComicInfo.xml`/`meta.json`，提取封面和 images |
| helper | `fileSHA256` | `server/main.go:1709` | 文件 hash |
| helper | `readZipText` | `server/main.go:1722` | 限大小读 zip 内文本 |
| helper | `isImageFile` | `server/main.go:1738` | 判断图片扩展名 |
| helper | `extractCover` | `server/main.go:1747` | 提取封面到 cover cache dir |
| helper | `pageExt` | `server/main.go:4469` | 封面扩展名 fallback |

本地上传调用链：

```text
ImportPage.upload()
  -> ApiClient.upload()
  -> POST /api/local/upload
  -> handleLocalUpload()
      -> save file to library_import_dir
      -> parseArchive()
      -> saveParsedWork("local", parsed.Hash, "", parsed, nil)
      -> insertTask("local_upload", "success", ...)
```

本地扫描调用链：

```text
ImportPage.scan()
  -> ApiClient.scan()
  -> POST /api/local/scan
  -> handleLocalScan()
      -> filepath.WalkDir(directory)
      -> parseArchive(path)
      -> workIDByHash(parsed.Hash)
      -> saveParsedWork("local", parsed.Hash, "", parsed, nil)
      -> insertTask("scan", "success", ...)
```

### 4.7 作品库 / metadata / tags

| API | handler/helper | 位置 | 说明 |
|---|---|---:|---|
| `GET /api/works` | `handleWorks` | `server/main.go:1158` | 返回 works + summary |
| `/api/works/{id}/...` | `handleWorkPath` | `server/main.go:1169` | 作品详情/patch/delete/cover/reparse/metadata/tags/export/exports 分发 |
| `POST /api/works/bulk-action` | `handleWorksBulkAction` | `server/main.go:2533` | 批量 apply_dictionary/export/delete/reparse |
| helper | `queryWorks` | `server/main.go:1926` | 作品列表查询、筛选、排序 |
| helper | `getWork` | `server/main.go:1983` | 单作品主数据 |
| helper | `librarySummary` | `server/main.go:2003` | 总览指标 |
| helper | `workMetadata` | `server/main.go:2024` | 作品 metadata map |
| helper | `workTags` | `server/main.go:2041` | 作品 tags |
| helper | `workTagPreview` | `server/main.go:2058` | 列表页 tag preview |
| helper | `workExports` | `server/main.go:2090` | 单作品导出记录 |
| helper | `allExports` | `server/main.go:2106` | 所有导出记录 |
| helper | `serveWorkCover` | `server/main.go:2140` | 返回本地封面文件 |
| helper | `safeDataPath` | `server/main.go:2200` | 限制文件路径在 data/library 内 |
| metadata | `handleWorkMetadata` | `server/main.go:2207` | GET/PATCH/reset/refill-from-meta/compare/translate |
| tags | `handleWorkTags` | `server/main.go:2331` | GET/apply-dictionary/machine-translate/confirm/bulk-update/PATCH tag |
| tags | `applyDictionaryToWorkTags` | `server/main.go:2427` | 按词典更新 work_tags |
| tags | `machineSuggestWorkTags` | `server/main.go:2443` | 给 tags 写 machine_suggestion，不直接确认 |
| tags | `updateTagByAction` | `server/main.go:2464` | use_dictionary/use_machine/keep_original/delete/change_type/manual/confirmed |
| tags | `handleWorkTranslation` | `server/main.go:2495` | 旧 translation suggest/apply-selected 分发 |

保存作品核心链路：

```text
parseArchive() or Worker.runOne()
  -> saveParsedWork(sourceType, sourceID, mediaID, parsed, gallery)
      -> insert/update works
      -> refresh work_files(kind='original')
      -> upsert work_metadata(original)
      -> upsert work_metadata(working)
      -> rebuildWorkTags(workID, parsed, gallery)
          -> galleryTags(gallery/meta) or ComicInfo.Tags fallback
          -> matchDictionary()
          -> insert work_tags
```

相关函数：

| 函数 | 位置 | 说明 |
|---|---:|---|
| `comicInfoMap` | `server/main.go:1772` | `ComicInfo` -> map |
| `comicInfoFromMap` | `server/main.go:1780` | map -> `ComicInfo` |
| `fillComicInfoFromMeta` | `server/main.go:1790` | 用 meta.json/gallery 补 ComicInfo |
| `saveParsedWork` | `server/main.go:1837` | 作品入库核心函数 |
| `rebuildWorkTags` | `server/main.go:1891` | 重建 work_tags |
| `matchDictionary` | `server/main.go:193?` | 词典匹配：remote id、type+original、tag/other、lower(source_text) |
| `workIDBySource` | `server/main.go:1954` | source_type/source_id 查 work |
| `workIDByHash` | `server/main.go:1960` | hash 查 work |

### 4.8 导出 CBZ

| API | handler/helper | 位置 | 说明 |
|---|---|---:|---|
| `POST /api/works/{id}/export` | `handleWorkPath` | `server/main.go:1169` | 分发到 `exportWork` |
| `GET /api/works/{id}/exports` | `handleWorkPath` | `server/main.go:1169` | 当前作品导出记录 |
| `GET /api/exports` | `handleExports` | `server/main.go:2733` | 所有导出记录 |
| `/api/exports/{id}/...` | `handleExportPath` | `server/main.go:2741` | delete/rerun/download |
| internal | `exportWork` | `server/main.go:2587` | 生成新 CBZ，写入确认后的 ComicInfo.xml，记录 exports |
| internal | `getExport` | `server/main.go:2716` | 单个 export record |
| helper | `finalTagString` | 约 `server/main.go:2640` | work_tags -> ComicInfo Tags string |
| helper | `writeExportCBZ` | 约 `server/main.go:2660` | 复制原 zip 内容并写入新 ComicInfo.xml |
| helper | `addZipText` | `server/main.go:4533` | zip 内新增文本文件 |
| helper | `safeFilename` | `server/main.go:4458` | 导出文件名清洗 |

导出调用链：

```text
WorkDetailPage -> api.exportWork(work.id)
  -> POST /api/works/{id}/export
  -> handleWorkPath(case "export")
  -> exportWork(workID)
      -> getWork()
      -> read work_metadata(metadata_type='working')
      -> comicInfoFromMap()
      -> finalTagString()
      -> comicInfoXMLFromInfo()/XML encode
      -> writeExportCBZ(original, target, ComicInfo.xml)
      -> INSERT exports
      -> UPDATE works.status='exported'
```

约束：导出生成新的 CBZ；不要把导出逻辑改成默认覆盖原始 CBZ。

### 4.9 词典 / tag governance / 翻译建议

| API | handler/helper | 位置 | 说明 |
|---|---|---:|---|
| `GET/POST /api/dictionary` | `handleDictionary` | `server/main.go:2841` | 列表/新增词典项 |
| `POST /api/dictionary/bulk` | `handleDictionaryBulk` | `server/main.go:2862` | 旧 bulk import/preview |
| `/api/dictionary/...` | `handleDictionaryPath` | `server/main.go:2908` | tags/bulk-import/export/match/{id} 分发 |
| `/api/dictionary/tags...` | `handleDictionaryTags` | `server/main.go:3028` | tag 聚合列表、suggest、upsert、ignore、关联作品 |
| helper | `queryDictionaryTags` | `server/main.go:3162` | 聚合库内所有 work_tags，按 configured/unconfigured/ignored 筛选 |
| helper | `dictionaryTagWorks` | `server/main.go:3244` | 某 tag 关联作品 |
| helper | `dictionary` | `server/main.go:3265` | 词典列表 |
| helper | `upsertDict` | `server/main.go:3282` | upsert `tag_dictionary` |
| helper | `parseBulkDictionary` | `server/main.go:3304` | `a=b` 行格式解析 |
| helper | `dictionaryPreviewRows` | `server/main.go:3323` | bulk preview 行状态 |
| helper | `dictionaryPreviewSummary` | `server/main.go:3351` | preview summary |
| task translation | `handleTaskTranslation` | `server/main.go:3359` | task raw/translated/suggest/dictionary/apply |
| helper | `translationItems` | `server/main.go:3435` | gallery -> TranslationItem[] |
| helper | `applyDictionary` | `server/main.go:3446` | 对 gallery 应用词典，生成 translated map |
| suggestions | `handleSuggestionPath` | 约 `server/main.go:3580` | 接受 translation_suggestions -> 写词典 |
| helper | `applyTranslationToTask` | `server/main.go:3619` | 把 translated_json 写回 task；谨慎，含 rewriteComicInfo 调用 |
| helper | `decodeJSON` | `server/main.go:3638` | JSON string -> any |

机器翻译策略：建议先写 `machine_suggestion` 或返回 suggestions，用户显式采用/确认后才影响最终导出。

### 4.10 通用 helper

| 函数 | 位置 | 说明 |
|---|---:|---|
| `nullable` | `server/main.go:1574` | sql.NullString -> nil/string |
| `nullableInt` | `server/main.go:1581` | sql.NullInt64 -> nil/int64 |
| `nullIfEmpty` | `server/main.go:1614` | 空字符串转 nil |
| `nullInt` | `server/main.go:1929` | 0 转 nil |
| `coalesce` | `server/main.go:4447` | 第一个非空字符串 |
| `firstString` | `server/main.go:4193` | map 多 key 取第一个 string |
| `asArray` | `server/main.go:4202` | any -> []any |
| `intArray` | `server/main.go:4209` | []any -> []int |
| `intValue` | `server/main.go:4219` | any -> int |
| `stringValue` | `server/main.go:4235` | any -> string |
| `firstNonZero` | `server/main.go:4149` | 多 key 取第一个正整数 |
| `firstOf` | `server/main.go:4158` | []string 第一个非空 |
| `valueAtPath` | `server/main.go:4128` | map path 取值 |
| `fileExists` | 约 `server/main.go:4700` | 文件存在判断 |
| `readJSON` / `writeJSON` / `badRequest` / `serverError` / `methodNotAllowed` | 文件尾部附近 | HTTP JSON/error helpers |

---

## 5. SQLite 数据模型与读写入口

Schema 在 `App.initDB()` 里集中创建。

| 表 | 主要写入函数 | 主要读取函数 | 作用 |
|---|---|---|---|
| `admins` | `handleSetupAdmin`, `handlePasswordChange` | `adminExists`, `handleLogin` | 单管理员 |
| `sessions` | `createSession`, `handlePasswordChange` | `sessionUser` | 登录会话 |
| `settings` | `initDB`, `handleSettings` | `settingsMap`, `settingValue` | 普通配置 |
| `secrets` | `handleSecrets` | `getSecret`, `secretStatuses` | 加密密钥 |
| `tasks` | `importGalleryIDs`, `Worker.runOne`, `insertTask`, retry/clear/delete handlers | `queryTasks`, `getTask`, `taskCounts` | 队列与任务状态 |
| `works` | `saveParsedWork`, `handleWorkPath`, `handleWorksBulkAction`, `exportWork` | `queryWorks`, `getWork`, `librarySummary` | 作品主记录 |
| `work_files` | `saveParsedWork` | work detail/files panel | 文件历史 |
| `work_metadata` | `saveParsedWork`, `handleWorkMetadata`, `applyTranslationToTask` | `workMetadata`, `exportWork` | original/working ComicInfo/meta |
| `work_tags` | `rebuildWorkTags`, `handleWorkTags`, `applyDictionaryToWorkTags`, `machineSuggestWorkTags`, `updateTagByAction` | `workTags`, `workTagPreview`, `queryDictionaryTags` | 标签治理核心 |
| `exports` | `exportWork`, `handleExportPath` | `workExports`, `allExports`, `getExport` | 导出记录 |
| `tag_dictionary` | `upsertDict`, `handleDictionary*`, suggestions accept | `dictionary`, `matchDictionary`, `queryDictionaryTags` | 词典 |
| `dictionary_ignored_tags` | `handleDictionaryTags(ignore)` | `queryDictionaryTags` | 忽略未配置 tag |
| `translation_suggestions` | `suggestTranslations` 系列 | suggestion accept | 机翻建议 |
| `maintenance_events` | `logEvent` | `handleLogs` | 维护日志 |

---

## 6. 前端总览

### 6.1 根应用与路由

| 文件/函数 | 位置 | 作用 |
|---|---:|---|
| `frontend/src/App.tsx` | `1-140` | 根组件；token/setup/active view/selected work/tasks/status/works |
| `App.refreshTasks` | `App.tsx:29` | 拉 `/api/tasks` |
| `App.refreshStatus` | `App.tsx:34` | 拉 `/api/status` |
| `App.refreshWorks` | `App.tsx:39` | 拉 `/api/works` |
| `App.navigate` | `App.tsx:46` | hash route 跳转 |
| `App.openWork` | `App.tsx:56` | 打开 `#/library/work/{id}` |
| `App.syncRoute` | `App.tsx:64` | hash -> active/selectedWork |
| setup check effect | `App.tsx:80` | 请求 `/api/setup/status` |
| polling effect | `App.tsx:98` | 每 3.5 秒刷新 tasks/status |
| `onAuth` | `App.tsx:110` | 保存 token 到 localStorage |
| `logout` | `App.tsx:116` | 清 token + reset route |

Hash routes：

```text
#/                  -> DashboardPage
#/import            -> ImportPage
#/library           -> LibraryPage
#/library/work/{id} -> WorkDetailPage
#/tasks             -> TasksPage
#/dictionary        -> DictionaryPage
#/settings          -> SettingsPage
```

### 6.2 前端 API Client：`frontend/src/lib/api.ts`

关键：所有页面应通过 `ApiClient` 发请求，不要在页面里重复写 fetch，除非是下载 blob 等特殊逻辑。

| 类型/函数/方法 | 位置 | 后端 API |
|---|---:|---|
| `galleryCoverSrc` | `api.ts:193` | 前端封面 URL fallback |
| `parseGalleryIds` | `api.ts:197` | 从文本/链接提取 ID |
| `ApiClient.request` | `api.ts:213` | 统一 JSON/FormData/Bearer/error/blob 处理 |
| `status` | `api.ts:225` | `GET /api/status` |
| `settings` | `api.ts:229` | `GET /api/settings` |
| `saveSettings` | `api.ts:233` | `PATCH /api/settings` |
| `saveSecrets` | `api.ts:237` | `PATCH /api/settings/secrets` |
| `testConnection` | `api.ts:241` | `POST /api/settings/test-connection` |
| `searchGalleries` | `api.ts:245` | `GET /api/sources/nhentai/search` |
| `gallery` | `api.ts:251` | `GET /api/sources/nhentai/galleries/{id}` |
| `related` | `api.ts:255` | `GET /api/sources/nhentai/galleries/{id}/related` |
| `import` | `api.ts:259` | `POST /api/tasks/import` |
| `upload` | `api.ts:263` | `POST /api/local/upload` |
| `scan` | `api.ts:269` | `POST /api/local/scan` |
| `works` | `api.ts:276` | `GET /api/works` |
| `work` | `api.ts:281` | `GET /api/works/{id}` |
| `saveMetadata` | `api.ts:285` | `PATCH /api/works/{id}/metadata` |
| `metadataAction` | `api.ts:289` | `POST /api/works/{id}/metadata/{action}` |
| `translateMetadata` | `api.ts:293` | `POST /api/works/{id}/metadata/translate` |
| `patchTag` | `api.ts:297` | `PATCH /api/works/{id}/tags/{tagId}` |
| `tagBulk` | `api.ts:301` | `POST /api/works/{id}/tags/bulk-update` |
| `applyDictionary` | `api.ts:305` | `POST /api/works/{id}/tags/apply-dictionary` |
| `machineSuggest` | `api.ts:309` | `POST /api/works/{id}/tags/machine-translate` |
| `confirmTags` | `api.ts:313` | `POST /api/works/{id}/tags/confirm` |
| `exportWork` | `api.ts:317` | `POST /api/works/{id}/export` |
| `bulkWorks` | `api.ts:321` | `POST /api/works/bulk-action` |
| `tasks` | `api.ts:325` | `GET /api/tasks` |
| `retryTask` | `api.ts:329` | `POST /api/tasks/{id}/retry` |
| `deleteTask` | `api.ts:333` | `DELETE /api/tasks/{id}` |
| `retryFailed` | `api.ts:337` | `POST /api/tasks/retry-failed` |
| `clearCompleted` | `api.ts:341` | `POST /api/tasks/clear-completed` |
| `dictionary` | `api.ts:345` | `GET /api/dictionary` |
| `dictionaryTags` | `api.ts:349` | `GET /api/dictionary/tags` |
| `suggestDictionaryTags` | `api.ts:354` | `POST /api/dictionary/tags/suggest` |
| `upsertDictionaryTags` | `api.ts:362` | `POST /api/dictionary/tags/upsert` |
| `ignoreDictionaryTags` | `api.ts:366` | `POST /api/dictionary/tags/ignore` |
| `dictionaryTagWorks` | `api.ts:370` | `GET /api/dictionary/tags/{type}/{original}` |
| `previewDictionary` | `api.ts:382` | `POST /api/dictionary/bulk-import/preview` |
| `importDictionary` | `api.ts:389` | `POST /api/dictionary/bulk-import` |
| `logs` | `api.ts:396` | `GET /api/logs` |
| `exports` | `api.ts:400` | `GET /api/exports` |
| `rerunExport` | `api.ts:404` | `POST /api/exports/{id}/rerun` |
| `deleteExport` | `api.ts:408` | `DELETE /api/exports/{id}` |
| `download` | `api.ts:412` | blob 下载 helper |
| `exportConfig` | `api.ts:424` | `GET /api/settings/export` |
| `parseError` | `api.ts:429` | 解析后端错误 |

### 6.3 通用组件

| 文件/函数 | 位置 | 作用 |
|---|---:|---|
| `components/Auth.tsx:Splash` | `line 9` | 初始 loading |
| `components/Auth.tsx:SetupView` | `line 17` | 首次管理员设置 |
| `components/Auth.tsx:LoginView` | `line 21` | 登录页 |
| `components/Auth.tsx:AuthForm` | `line 25` | setup/login 复用表单 |
| `components/Shell.tsx:ViewId` | `line 17` | 页面枚举 |
| `components/Shell.tsx:Shell` | `line 28` | 左侧导航 + 顶部状态条 + children |
| `components/Shell.tsx:PageHeader` | `line 134` | 页面标题组件 |
| `components/Cover.tsx:Cover` | `line 5` | 封面；`/api/*` 图用 token fetch blob |

---

## 7. 前端页面到功能索引

### 7.1 `DashboardPage.tsx`

| 函数 | 位置 | 作用 |
|---|---:|---|
| `DashboardPage` | `line 9` | 总览页：指标、最近作品、任务队列、健康状态 |
| `Metric` | `line 104` | 指标卡 |
| `Health` | `line 108` | 健康状态条 |
| `sourceName` | `line 112` | 来源名展示 |
| `statusName` | `line 117` | 状态名展示 |

### 7.2 `ImportPage.tsx`

| 函数 | 位置 | 作用 |
|---|---:|---|
| `ImportPage` | `line 12` | 搜索、ID 查询、批量导入、本地上传、目录扫描 |
| `search` | `line 47` | 调 `api.searchGalleries` |
| `lookup` | `line 68` | 调 `api.gallery` 预览单 ID |
| `importIds` | `line 90` | 调 `api.import` 加入后端队列 |
| `importBulk` | `line 114` | 批量 ID 导入 |
| `upload` | `line 119` | 上传 CBZ/ZIP |
| `scan` | `line 136` | 扫描目录 |
| `toggle` | `line 152` | 选择 gallery |
| `selectVisible` | `line 156` | 选择当前搜索结果 |
| `GalleryPreview` | `line 260` | 右侧预览 |
| `ImportPanelDrawer` | 文件后半段 | 高级/批量/本地抽屉 |

### 7.3 `LibraryPage.tsx`

| 函数 | 位置 | 作用 |
|---|---:|---|
| `LibraryPage` | `line 11` | 我的库：筛选、封面墙/表格、批量操作 |
| `search` | `line 40` | 调 `api.works` 筛选作品 |
| `resetFilters` | `line 61` | 重置筛选 |
| `bulk` | `line 70` | 调 `api.bulkWorks`：apply_dictionary/export/reparse/delete |
| `toggle` | `line 91` | 选择作品 |
| `selectAllVisible` | `line 95` | 选择当前显示作品 |
| `MangaWorkCard` | `line 205` | 封面墙卡片 |
| `LibraryInspector` | `line 232` | 右侧作品摘要 |
| `ContentTagRail` | `line 270` | 内容 tag 展示 |

### 7.4 `WorkDetailPage.tsx`

| 函数 | 位置 | 作用 |
|---|---:|---|
| `WorkDetailPage` | `line 25` | 作品详情：metadata、tags、export |
| `load` | `line 37` | 调 `api.work` 载入详情 |
| `run` | `line 53` | busy/message/error 包装 |
| `tagBulk` | `line 77` | 对选中 tags 批量 use_dictionary/use_machine/confirm |
| `MetaJsonPanel` | `line 202` | 只读 meta.json |
| `ComicInfoPanel` | `line 214` | working ComicInfo 编辑/机翻建议/保存/reset/refill |
| `TagTable` | `line 271` | tag 表格操作 |
| `FilesPanel` | 文件后半段 | 原始文件/导出文件信息 |

### 7.5 `TasksPage.tsx`

用途：任务队列与历史记录。主要通过 `ApiClient.tasks/retryTask/deleteTask/retryFailed/clearCompleted` 操作。

常见改动：

```text
任务状态显示文案 -> TasksPage.tsx 或 TaskQueueDrawer.tsx 的 statusText
任务进度显示 -> progress helper
任务操作按钮 -> TasksPage.tsx
```

### 7.6 `TaskQueueDrawer.tsx`

用途：搜索/导入页右侧队列抽屉。`DashboardPage` 也复用 `progress` 和 `statusText`。

常见改动：

```text
队列抽屉 UI -> TaskQueueDrawer.tsx
任务状态翻译 -> statusText
进度条计算 -> progress
```

### 7.7 `DictionaryPage.tsx`

用途：库内 tag 聚合、未配置筛选、机翻建议、写入词典、忽略 tag、手动词条维护/导入/导出。

主要 API：

```text
api.dictionaryTags()
api.suggestDictionaryTags()
api.upsertDictionaryTags()
api.ignoreDictionaryTags()
api.dictionaryTagWorks()
api.dictionary()
api.saveDictionary()
api.deleteDictionary()
api.previewDictionary()
api.importDictionary()
```

后端对应：

```text
handleDictionary
handleDictionaryBulk
handleDictionaryPath
handleDictionaryTags
queryDictionaryTags
upsertDict
```

### 7.8 `SettingsPage.tsx`

| 函数 | 位置 | 作用 |
|---|---:|---|
| `SettingsPage` | `line 19` | 数据源/翻译/资料库/导出/安全/维护 |
| `load` | `line 30` | 并发读取 settings/status |
| `run` | `line 40` | busy/message/error 包装 |
| `save` | `line 54` | 保存普通设置 |
| `saveSecrets` | `line 62` | 保存 secrets |
| `saveSource` | `line 74` | 保存 UA + nhentai API key |
| `testConnection` | `line 88` | 调 `/api/settings/test-connection` |
| `openLogs` | `line 99` | 拉 `/api/logs` |
| `PreferenceSection` | `line 224` | 设置分区组件 |
| `AccountPanel` | `line 233` | 修改管理员密码 |

---

## 8. 按任务找代码

### 新增/修改后端 API

1. 在 `server/main.go:140 routes()` 注册路径。
2. 增加 handler，通常放在同领域附近。
3. 需要认证则包 `a.auth(handler)`。
4. 前端在 `frontend/src/lib/api.ts` 增加 `ApiClient` 方法。
5. 页面调用 ApiClient，不要直接散落 fetch。

### 改远程搜索/详情/下载

```text
前端：ImportPage.tsx
API client：frontend/src/lib/api.ts searchGalleries/gallery/related/import
后端 handler：handleSourceSearch / handleSourceGalleryPath / handleImport
远端 client：NHClient.Search/Gallery/Related/DownloadURL/requestWithOptions/CDNConfig
Worker：Worker.runOne / Worker.downloadCBZ
```

### 改本地 CBZ 解析

```text
handleLocalUpload / handleLocalScan
parseArchive
readZipText
isImageFile
extractCover
fillComicInfoFromMeta
saveParsedWork
rebuildWorkTags
```

### 改作品列表筛选/排序

```text
frontend/src/views/LibraryPage.tsx search/filter UI
frontend/src/lib/api.ts works()
server/main.go queryWorks()
```

### 改作品详情 metadata 编辑

```text
frontend/src/views/WorkDetailPage.tsx ComicInfoPanel
frontend/src/lib/api.ts saveMetadata/metadataAction/translateMetadata
server/main.go handleWorkMetadata
server/main.go workMetadata/comicInfoMap/comicInfoFromMap/fillComicInfoFromMeta
```

### 改 tag 治理

```text
frontend/src/views/WorkDetailPage.tsx TagTable/tagBulk
frontend/src/lib/api.ts tagBulk/patchTag/applyDictionary/machineSuggest/confirmTags
server/main.go handleWorkTags
server/main.go updateTagByAction
server/main.go applyDictionaryToWorkTags
server/main.go machineSuggestWorkTags
server/main.go matchDictionary
```

### 改词典页

```text
frontend/src/views/DictionaryPage.tsx
frontend/src/lib/api.ts dictionaryTags/suggestDictionaryTags/upsertDictionaryTags/ignoreDictionaryTags
server/main.go handleDictionaryPath
server/main.go handleDictionaryTags
server/main.go queryDictionaryTags
server/main.go upsertDict
server/main.go dictionaryTagWorks
```

### 改导出 CBZ

```text
frontend/src/views/WorkDetailPage.tsx 导出按钮
frontend/src/views/LibraryPage.tsx bulk('export')
frontend/src/lib/api.ts exportWork/bulkWorks/exports/rerunExport/deleteExport
server/main.go handleWorkPath case "export"
server/main.go handleWorksBulkAction case "export"
server/main.go exportWork
server/main.go writeExportCBZ/finalTagString/comicInfoXMLFromInfo/addZipText
server/main.go handleExportPath
```

### 改设置页 / secrets

```text
frontend/src/views/SettingsPage.tsx
frontend/src/lib/api.ts settings/saveSettings/saveSecrets/testConnection/logs/exportConfig
server/main.go handleSettings
server/main.go handleSecrets
server/main.go handleTestConnection
server/main.go handleSettingsExport
server/main.go SecretBox/getSecret/secretStatuses
```

### 改登录 / 首次初始化 / 密码

```text
frontend/src/components/Auth.tsx
frontend/src/App.tsx setup status/token/localStorage
frontend/src/views/SettingsPage.tsx AccountPanel
server/main.go handleSetupStatus/handleSetupAdmin/handleLogin/handlePasswordChange/auth/sessionUser/createSession/hashPassword/verifyPassword
```

### 改任务队列 UI

```text
frontend/src/views/TaskQueueDrawer.tsx
frontend/src/views/TasksPage.tsx
frontend/src/App.tsx refreshTasks polling
frontend/src/lib/api.ts tasks/retryTask/deleteTask/retryFailed/clearCompleted
server/main.go handleTasks/handleTaskPath/handleRetryFailedTasks/handleClearCompletedTasks/queryTasks/getTask/taskCounts
```

---

## 9. 数据流速查

### 9.1 前端启动

```text
App mount
  -> fetch /api/setup/status
  -> if needs_setup: SetupView
  -> else if no token: LoginView
  -> else: Shell + active page
  -> refreshTasks / refreshStatus / refreshWorks
  -> every 3.5s refresh tasks/status
```

### 9.2 搜索远端并导入

```text
ImportPage.search
  -> ApiClient.searchGalleries
  -> handleSourceSearch
  -> NHClient.Search
  -> normalizeListResponse
  -> normalizeGallery
  -> frontend results

ImportPage.importIds
  -> ApiClient.import
  -> handleImport
  -> importGalleryIDs
  -> tasks queued
  -> Worker.schedule
  -> Worker.runOne
  -> saveParsedWork
  -> works/work_metadata/work_tags/work_files
```

### 9.3 本地文件入库

```text
ImportPage.upload or scan
  -> ApiClient.upload/scan
  -> handleLocalUpload/handleLocalScan
  -> parseArchive
  -> saveParsedWork
  -> rebuildWorkTags
  -> getWork/queryWorks
```

### 9.4 标签到导出

```text
work_tags.original_name
  -> matchDictionary -> dictionary_value
  -> machineSuggestWorkTags -> machine_suggestion
  -> updateTagByAction -> final_value/final_source/is_confirmed
  -> exportWork -> finalTagString -> ComicInfo.xml Tags
  -> writeExportCBZ -> exports record
```

---

## 10. 重要约束与坑位

1. **后端是单文件单体**：`server/main.go` 很大，改动前先用函数名搜索，不要随意复制相似逻辑。
2. **不要绕过远端访问控制**：已有逻辑遇到 401/403/429 直接报错；不要新增验证码、Cloudflare、cookie、反爬绕过。
3. **secrets 不回显明文**：只能通过 `secretStatuses()` 返回 configured/masked。
4. **`SECRET_KEY` 影响 secrets 解密**：改密钥后网页保存的 API key 需要重填。
5. **原始 CBZ 安全边界**：正常导出是生成新 CBZ，不应默认覆盖原始文件。
6. **路径安全**：下载、封面、导出、删除文件前使用 `safeDataPath` 或等价限制，避免任意路径访问。
7. **前端请求统一走 ApiClient**：新增接口时优先更新 `frontend/src/lib/api.ts`。
8. **任务状态名不完全统一**：前端类型允许 `queued/running/success/failed/canceled/completed/downloading/string`；改状态时同步 TaskQueue/Tasks 页面显示。
9. **词典不会自动确认标签**：词典值、机翻建议、最终值、确认状态分开；导出使用最终值。
10. **`work_metadata` 有 original/working 双副本**：编辑 working；reset/refill 从 original/meta 生成。

---

## 11. 验证命令

```bash
# 后端测试
go test ./server

# 前端构建
cd frontend
npm install
npm run build

# 容器验证
docker compose up -d --build
```

---

## 12. 推荐给 AI 的修改策略

当用户提出需求时，按这个流程执行：

```text
1. 判断需求属于：remote import / local archive / works / metadata / tags / dictionary / export / settings / auth / UI。
2. 先查本文件“按任务找代码”。
3. 打开对应 frontend view + lib/api.ts + server/main.go handler/helper。
4. 只改一条调用链，避免跨领域重构。
5. 若新增 API：后端 routes -> handler -> ApiClient -> 页面。
6. 若新增 DB 字段：initDB schema -> migration -> query/write -> frontend type。
7. 改完跑 go test ./server 和 npm run build。
```
