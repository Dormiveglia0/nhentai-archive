export const METADATA_FIELDS = [["title", "标题"], ["title_japanese", "原文标题"], ["artist", "作者"], ["group", "社团"], ["language", "语言"], ["tags", "标签"], ["summary", "简介"]] as const;

export function ManualMetadataFields({ values, onChange, disabled }: {
  values: Record<string, string>; onChange: (values: Record<string, string>) => void; disabled: boolean;
}) {
  return <fieldset disabled={disabled} className="folio-field-matrix">{METADATA_FIELDS.map(([field, label]) =>
    <label key={field} className={`folio-field${field === "summary" ? " folio-field-wide" : ""}`}>
      <span>{label}</span>{field === "summary"
        ? <textarea value={values[field] ?? ""} onChange={event => onChange({ ...values, [field]: event.target.value })} maxLength={10000} />
        : <><input value={values[field] ?? ""} required={field === "title"} maxLength={2000} onChange={event => onChange({ ...values, [field]: event.target.value })} /><i /></>}
    </label>)}
  </fieldset>;
}
