import { ClipboardCheck, Upload } from "lucide-react";
import { useState } from "react";

import { api, BulkImportPreview, BulkImportRow } from "../../lib/api";

type Props = {
  onImported: () => void;
};

export function BulkImportPanel({ onImported }: Props) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<BulkImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function previewRows() {
    setLoading(true);
    setMessage(null);
    try {
      setPreview(await api.dictionaryPreviewBulkImport(parseRows(text)));
    } catch (exc) {
      setMessage(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setLoading(false);
    }
  }

  async function importRows() {
    setLoading(true);
    setMessage(null);
    try {
      const result = await api.dictionaryBulkImport(parseRows(text));
      setPreview(result);
      setMessage(`已写入 ${result.summary.imported ?? 0} 条真实词典记录。`);
      onImported();
    } catch (exc) {
      setMessage(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bulk-panel">
      <header className="dictionary-pane-head">
        <div>
          <h2>批量导入</h2>
          <span>支持 CSV / TSV / 逗号文本。每行至少填写：原文、中文名；类型和别名可选。</span>
        </div>
      </header>
      <div className="bulk-body">
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={7} placeholder={"snowmelt, 雪融\nxxx，yyy\nblue reverie, 蓝色遐想, tag, 蓝想|蓝色"} />
        <div className="bulk-side">
          <button type="button" onClick={previewRows} disabled={loading || !text.trim()}>
            <ClipboardCheck size={16} />
            解析预览
          </button>
          <button type="button" className="primary" onClick={importRows} disabled={loading || !preview?.summary.valid}>
            <Upload size={16} />
            写入有效行
          </button>
          {message ? <p>{message}</p> : null}
          {preview ? (
            <dl>
              <div>
                <dt>有效</dt>
                <dd>{preview.summary.valid ?? 0}</dd>
              </div>
              <div>
                <dt>重复</dt>
                <dd>{preview.summary.duplicate ?? 0}</dd>
              </div>
              <div>
                <dt>冲突</dt>
                <dd>{preview.summary.conflict ?? 0}</dd>
              </div>
              <div>
                <dt>无效</dt>
                <dd>{preview.summary.invalid ?? 0}</dd>
              </div>
            </dl>
          ) : null}
        </div>
      </div>
      {preview ? (
        <div className="bulk-table">
          <div>
            <span>行</span>
            <span>原文</span>
            <span>中文名</span>
            <span>状态</span>
            <span>说明</span>
          </div>
          {preview.rows.slice(0, 12).map((row) => (
            <div key={row.index}>
              <span>{row.index}</span>
              <span>{row.payload.original_text || "-"}</span>
              <span>{row.payload.zh_name || "-"}</span>
              <span>{statusLabel(row.status)}</span>
              <span>{row.message || "-"}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function parseRows(text: string): BulkImportRow[] {
  const validTypes = new Set(["tag", "artist", "group", "character", "parody", "language", "category"]);
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = (line.includes("\t") ? line.split("\t") : line.split(/[,，]/)).map((item) => item.trim());
      const [original_text = "", zh_name = "", third = "", ...rest] = parts;
      const tag_type = validTypes.has(third) ? third : "tag";
      const aliasText = validTypes.has(third) ? rest.join("|") : [third, ...rest].filter(Boolean).join("|");
      return {
        original_text,
        zh_name,
        tag_type,
        aliases: aliasText
          .split(/[|，、]/)
          .map((item) => item.trim())
          .filter(Boolean),
      };
    });
}

function statusLabel(status: string) {
  if (status === "duplicate") return "重复";
  if (status === "conflict") return "冲突";
  if (status === "invalid") return "无效";
  return "有效";
}
