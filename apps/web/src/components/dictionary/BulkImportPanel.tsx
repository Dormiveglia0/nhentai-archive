import { ClipboardCheck, Upload } from "lucide-react";
import { useState } from "react";

import { api, type BulkImportPreview, type BulkImportRow } from "../../lib/api";

export function BulkImportPanel({ onImported }: { onImported: () => void }) {
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
      setMessage(errorMessage(exc));
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
      setMessage(errorMessage(exc));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="folio-dictionary-bulk">
      <p>支持 CSV、TSV 与中文逗号文本。每行依次填写原文、中文名；类型和别名可选。</p>
      <div className="folio-dictionary-bulk-compose">
        <label>
          <span>术语映射</span>
          <textarea value={text} onChange={(event) => { setText(event.target.value); setPreview(null); }} rows={8} placeholder="每行：原文, 中文名, 类型, 别名" />
        </label>
        <aside>
          <button className="folio-line-button" type="button" onClick={previewRows} disabled={loading || !text.trim()}>
            <ClipboardCheck size={16} />解析预览
          </button>
          <button className="folio-ink-button" type="button" onClick={importRows} disabled={loading || !preview?.summary.valid}>
            <Upload size={16} />写入有效行
          </button>
          {message ? <p role="status">{message}</p> : null}
          {preview ? (
            <dl>
              <div><dt>有效</dt><dd>{preview.summary.valid ?? 0}</dd></div>
              <div><dt>重复</dt><dd>{preview.summary.duplicate ?? 0}</dd></div>
              <div><dt>冲突</dt><dd>{preview.summary.conflict ?? 0}</dd></div>
              <div><dt>无效</dt><dd>{preview.summary.invalid ?? 0}</dd></div>
            </dl>
          ) : null}
        </aside>
      </div>
      {preview ? (
        <div className="folio-dictionary-bulk-table">
          <div><span>行</span><span>原文</span><span>中文名</span><span>状态</span><span>说明</span></div>
          {preview.rows.slice(0, 12).map((row) => (
            <div key={row.index}>
              <span>{row.index}</span><span>{row.payload.original_text || "—"}</span><span>{row.payload.zh_name || "—"}</span><span>{statusLabel(row.status)}</span><span>{row.message || "—"}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
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
        aliases: aliasText.split(/[|，、]/).map((item) => item.trim()).filter(Boolean),
      };
    });
}

function statusLabel(status: string) {
  if (status === "duplicate") return "重复";
  if (status === "conflict") return "冲突";
  if (status === "invalid") return "无效";
  return "有效";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
