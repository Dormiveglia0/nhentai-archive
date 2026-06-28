# 治理 ComicInfo 回写源 CBZ Design

## 背景与目标

治理中心目前把单作品的最终元数据决策写进 `work_metadata`(可逆的 DB 操作),ComicInfo 只在**导出阶段**写进一个**新** CBZ 下载给用户;源 CBZ 始终只读。本设计新增能力:把治理后的 `ComicInfo.xml` **就地回写进源 CBZ 文件**,使库内文件自带完整元数据,外部阅读器(如 Komga)无需导出即可直接读取。

这是一次**有意识地推翻**「源 CBZ 永不修改」这条贯穿全库的旧铁律。回写是显式、opt-in、原子、且只动 ComicInfo 的受控操作。

## 已确认的关键决策

1. **语义**:就地原子改写源 CBZ(覆盖旧的「源不可变」铁律)。
2. **范围**:只注入/替换 `ComicInfo.xml`;所有页面图像成员的解压字节保持恒等,仅重封 zip 容器。
3. **安全**:写同目录临时文件 → `flush + fsync` → `os.replace` 原子覆盖;**不留备份**。
4. **触发**:治理「应用」面板加「同时回写源文件(ComicInfo)」复选框,**默认关**;勾选并应用时弹一次轻确认。

## 架构

### 新增共享模块 `backend/app/services/comicinfo.py`

ComicInfo 的 XML 生成与 zip 重封逻辑目前长在 `ExportService` 里。由于 `ExportService` 已 `import` 并依赖 `GovernanceService`(`export_service.py` 在 `__init__` 构造 `GovernanceService`,并在 `preview()` 调 `work_governance()` 取聚合),若让 `GovernanceService` 反向 import `ExportService` 会造成**循环依赖**。

因此把以下三个纯函数抽到无状态的共享模块,`ExportService` 与 `GovernanceService` 回写都消费它,保证两边产出**逐字节一致**并避开循环依赖:

- `build_fields(aggregate: dict) -> dict[str, str]` —— 原 `ExportService._comic_info` + `_tag_output` + `_field_value`。从治理聚合(`work_governance` 返回结构)推导 ComicInfo 字段。
- `to_xml(fields: dict[str, str]) -> str` —— 原 `ExportService._comicinfo_xml`。
- `reseal_cbz(source_path: Path, xml: str | None, keep_json: bool = True, compress: bool = True) -> bytes` —— 原 `ExportService._package_bytes`。逐个拷贝源 zip 成员的解压字节,跳过/替换 `ComicInfo.xml`,可选保留 JSON 成员。

`COMICINFO_KEYS` 常量一并移入共享模块。`ExportService` 改为委托给该模块,**行为不变**(纯重构,由现有导出测试保护),仍保留自己的 `preview`/`build_cbz`/`build_bundle`/blockers/warnings/命名逻辑。

### 单一 ComicInfo 真相源

导出下载的 ComicInfo 与回写进源的 ComicInfo 都来自同一个 `build_fields(work_governance(work_id))` 路径,字段必然一致。

## 回写流程

`GovernanceService` 新增 `write_back_comicinfo(work_id: int) -> dict`:

```
1. aggregate = self.work_governance(work_id)
2. 取 source_cbz 路径(work_files WHERE kind='source_cbz')
   - 缺失 / 非 zipfile / 路径 .resolve() 不在受管 library 目录内 → 抛错(穿越防护)
3. xml  = comicinfo.to_xml(comicinfo.build_fields(aggregate))
4. data = comicinfo.reseal_cbz(source, xml, keep_json=True, compress=True)
   - 保留所有原成员(页面解压字节恒等),仅替换/新增 ComicInfo.xml
5. 原子写:同目录写 <source>.tmp → flush + os.fsync → os.replace(tmp, source)
   - 任何异常 → 清理 tmp,源文件保持原内容
6. 一致性:重算 sha256 + size_bytes,
   UPDATE work_files SET sha256=?, size_bytes=? WHERE work_id=? AND kind='source_cbz'
   并刷新 works.updated_at
7. 返回 {written: true, fields, new_sha256, new_size_bytes}
```

### 一致性维护(第 6 步为何必须)

文件管理用 `work_files.sha256` 做去重检测、用 `size_bytes` 判 `size_mismatch`。回写改变文件字节,若不同步更新这两列,会导致去重组误失/体积不符误报。因此回写后必须重算并写回。

## API

扩展现有 `POST /api/works/{id}/governance/apply`:

- payload 新增 `write_back: bool`(默认 `false`)。
- `apply()` 先写 `work_metadata`(可逆),若 `write_back` 为真**再**执行 `write_back_comicinfo`,结果并入响应的 `write_back` 字段。
- **失败隔离**:DB 写成功但回写失败时,响应 `write_back.error` 标明原因,但**不回滚** `work_metadata`(元数据决策已合法落库);整体请求不报 500。

## 前端

治理应用面板:

- 新增复选框「同时回写源文件(ComicInfo)」,默认**关**。
- 复选框下一行风险提示:「将就地改写源 CBZ,不可撤销」。
- 勾选并点击应用时弹一次轻确认对话框。
- 响应回显写入的 ComicInfo 字段、新体积与写入状态;回写失败时显示错误但保留元数据已保存的提示。

## 安全与错误处理

- **穿越防护**:源路径 `.resolve()` 后必须落在 `settings` 的 library 目录内,否则拒绝(复用 `file_service` 既有模式)。
- **原子性**:tmp 与源**同目录同文件系统**,保证 `os.replace` 原子;崩溃只会留下完好旧文件 + 可清理的 tmp,绝不出现半块损坏。
- **页面不变性**:reseal 逐个拷贝原 zip 成员的解压字节,只换 ComicInfo;图像内容字节恒等。注意:zip 容器的压缩参数可能与原文件不同(整体重新 deflate),因此文件字节(及 sha256)会变,但页面图像数据本身不变。
- **空/损坏源**:阻断并返回明确错误,不写盘。

## 测试(TDD)

1. `reseal_cbz` 产出含 `ComicInfo.xml`;所有页面成员名 + 解压字节与源逐一相等。
2. `write_back_comicinfo` 后:文件含正确 ComicInfo;`work_files.sha256`/`size_bytes` 更新为新值。
3. export 下载字节中的 ComicInfo 字段 与 回写后源中 ComicInfo 字段**一致**(共享 builder 回归)。
4. 源缺失 / 受管目录外路径 → 抛错且**不动盘**。
5. 原子性:模拟 reseal/写盘抛错时,源文件保持原内容、无残留 tmp。
6. API:`apply(write_back=True)` 走通并返回 `write_back` 结果;`write_back=False` 时绝不碰盘;回写失败时 `work_metadata` 仍落库且响应标 `write_back.error`。

## 文档决策更新(实现时同步 PROJECT_STATUS)

- 「源 CBZ 永不被修改」收窄为:**治理 ComicInfo 回写是唯一受认可的源改写**(仅 ComicInfo、原子、显式 opt-in、不留备份)。
- 导出仍**永不**写源(导出 = 下载给用户)。
- 文件管理删除仍是另一条独立的动盘操作。
- 回写后 `work_files.sha256`/`size_bytes` 必须同步,以维持去重/体积检测的真实性。

## 不在本次范围(YAGNI)

- 批量回写(多作品一次性写盘)。
- 回写备份 / 撤销恢复(已明确选择无备份的原子替换)。
- 封面归一、页面重命名、meta.json 清理等更大改动面。
- 导出阶段写盘到服务器目录(已废弃的旧语义,不恢复)。
