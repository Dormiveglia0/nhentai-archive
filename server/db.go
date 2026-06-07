package main

import (
	"database/sql"
	"encoding/json"
	"path/filepath"
	"strings"
)

func (a *App) initDB() error {
	_, err := a.db.Exec(`
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS admins(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, username TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS secrets(name TEXT PRIMARY KEY, nonce TEXT NOT NULL, ciphertext TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS works(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  original_title TEXT,
  circle TEXT,
  author TEXT,
  source TEXT NOT NULL,
  source_id TEXT,
  pages INTEGER NOT NULL DEFAULT 0,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  language TEXT,
  cover_path TEXT,
  archive_path TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  metadata_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'needs_metadata',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS work_files(id INTEGER PRIMARY KEY AUTOINCREMENT, work_id INTEGER NOT NULL, kind TEXT NOT NULL, path TEXT NOT NULL, size_bytes INTEGER NOT NULL DEFAULT 0, file_hash TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(work_id) REFERENCES works(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS work_pages(id INTEGER PRIMARY KEY AUTOINCREMENT, work_id INTEGER NOT NULL, page_index INTEGER NOT NULL, name TEXT NOT NULL, width INTEGER DEFAULT 0, height INTEGER DEFAULT 0, FOREIGN KEY(work_id) REFERENCES works(id) ON DELETE CASCADE, UNIQUE(work_id,page_index));
CREATE TABLE IF NOT EXISTS reading_progress(work_id INTEGER PRIMARY KEY, page_index INTEGER NOT NULL DEFAULT 0, percent INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(work_id) REFERENCES works(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS metadata_records(id INTEGER PRIMARY KEY AUTOINCREMENT, work_id INTEGER NOT NULL, field TEXT NOT NULL, current_value TEXT, source_value TEXT, machine_value TEXT, status TEXT NOT NULL DEFAULT 'same', FOREIGN KEY(work_id) REFERENCES works(id) ON DELETE CASCADE, UNIQUE(work_id,field));
CREATE TABLE IF NOT EXISTS work_tags(id INTEGER PRIMARY KEY AUTOINCREMENT, work_id INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'tag', value TEXT NOT NULL, confirmed INTEGER NOT NULL DEFAULT 0, FOREIGN KEY(work_id) REFERENCES works(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS dictionary_terms(id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, zh TEXT, aliases_json TEXT NOT NULL DEFAULT '[]', type TEXT NOT NULL DEFAULT '标签', works INTEGER NOT NULL DEFAULT 0, hits INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', confidence INTEGER NOT NULL DEFAULT 0, UNIQUE(source,type));
CREATE TABLE IF NOT EXISTS dictionary_aliases(id INTEGER PRIMARY KEY AUTOINCREMENT, term_id INTEGER NOT NULL, alias TEXT NOT NULL, FOREIGN KEY(term_id) REFERENCES dictionary_terms(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT, target TEXT, phase TEXT, progress INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, eta TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS exports(id INTEGER PRIMARY KEY AUTOINCREMENT, work_id INTEGER NOT NULL, filename TEXT NOT NULL, path TEXT, size_bytes INTEGER NOT NULL DEFAULT 0, preset TEXT NOT NULL DEFAULT '默认预设 v2', status TEXT NOT NULL DEFAULT 'ready', warnings_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(work_id) REFERENCES works(id) ON DELETE CASCADE);
`)
	if err != nil {
		return err
	}
	defaults := map[string]string{"cache_limit": "20 GB", "theme": "跟随系统", "privacy": "false", "blur_covers": "true", "export_dir": filepath.Join(a.cfg.LibraryDir, "exports")}
	for key, value := range defaults {
		if _, err := a.db.Exec("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)", key, value); err != nil {
			return err
		}
	}
	return nil
}

func (a *App) appState() AppState {
	return AppState{Works: a.works(), Galleries: a.galleries(), Tasks: a.tasks(), Dictionary: a.dictionaryTerms(), Exports: a.exports(), Settings: a.settingsState()}
}

func (a *App) settingsState() SettingsState {
	settings := a.settings()
	return SettingsState{APIConnected: a.secretConfigured("nhentai_api_key"), Privacy: settings["privacy"] == "true", BlurCovers: settings["blur_covers"] != "false", CacheLimit: valueOr(settings["cache_limit"], "20 GB"), Theme: valueOr(settings["theme"], "跟随系统"), DataDir: a.cfg.LibraryDir, ExportDir: valueOr(settings["export_dir"], filepath.Join(a.cfg.LibraryDir, "exports"))}
}

func (a *App) settings() map[string]string {
	out := map[string]string{}
	rows, err := a.db.Query("SELECT key,value FROM settings")
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var key, value string
		_ = rows.Scan(&key, &value)
		out[key] = value
	}
	return out
}

func (a *App) secretConfigured(name string) bool {
	var value string
	return a.db.QueryRow("SELECT name FROM secrets WHERE name=?", name).Scan(&value) == nil
}

func (a *App) works() []Work {
	rows, err := a.db.Query("SELECT id,title,COALESCE(original_title,''),COALESCE(circle,''),COALESCE(author,''),source,COALESCE(source_id,''),pages,size_bytes,COALESCE(language,''),COALESCE(cover_path,''),COALESCE(archive_path,''),progress,metadata_score,status FROM works ORDER BY updated_at DESC LIMIT 300")
	if err != nil {
		return []Work{}
	}
	defer rows.Close()
	out := []Work{}
	for rows.Next() {
		var work Work
		var sizeBytes int64
		_ = rows.Scan(&work.ID, &work.Title, &work.OriginalTitle, &work.Circle, &work.Author, &work.Source, &work.SourceID, &work.Pages, &sizeBytes, &work.Language, &work.CoverPath, &work.ArchivePath, &work.Progress, &work.MetadataScore, &work.Status)
		work.Size = humanSize(sizeBytes)
		work.Cover = "/api/library/works/" + intString(work.ID) + "/cover"
		work.Tags = a.workTags(work.ID)
		out = append(out, work)
	}
	return out
}

func (a *App) work(id int) (Work, bool) {
	var work Work
	var sizeBytes int64
	err := a.db.QueryRow("SELECT id,title,COALESCE(original_title,''),COALESCE(circle,''),COALESCE(author,''),source,COALESCE(source_id,''),pages,size_bytes,COALESCE(language,''),COALESCE(cover_path,''),COALESCE(archive_path,''),progress,metadata_score,status FROM works WHERE id=?", id).Scan(&work.ID, &work.Title, &work.OriginalTitle, &work.Circle, &work.Author, &work.Source, &work.SourceID, &work.Pages, &sizeBytes, &work.Language, &work.CoverPath, &work.ArchivePath, &work.Progress, &work.MetadataScore, &work.Status)
	if err != nil {
		return Work{}, false
	}
	work.Size = humanSize(sizeBytes)
	work.Cover = "/api/library/works/" + intString(work.ID) + "/cover"
	work.Tags = a.workTags(work.ID)
	return work, true
}

func (a *App) workTags(workID int) []string {
	rows, err := a.db.Query("SELECT value FROM work_tags WHERE work_id=? ORDER BY confirmed DESC, id ASC LIMIT 12", workID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var value string
		_ = rows.Scan(&value)
		out = append(out, value)
	}
	return out
}

func (a *App) galleries() []Gallery {
	galleries := []Gallery{}
	for _, work := range a.works() {
		galleries = append(galleries, Gallery{Work: work, Imported: true, Related: []int{1, 2, 3}})
	}
	return galleries
}

func (a *App) tasks() []Task {
	rows, err := a.db.Query("SELECT id,type,COALESCE(title,''),COALESCE(target,''),COALESCE(phase,''),progress,status,COALESCE(eta,'') FROM tasks ORDER BY created_at DESC LIMIT 200")
	if err != nil {
		return []Task{}
	}
	defer rows.Close()
	out := []Task{}
	for rows.Next() {
		var task Task
		_ = rows.Scan(&task.ID, &task.Type, &task.Title, &task.Target, &task.Phase, &task.Progress, &task.Status, &task.ETA)
		out = append(out, task)
	}
	return out
}

func (a *App) dictionaryTerms() []DictionaryTerm {
	rows, err := a.db.Query("SELECT id,source,COALESCE(zh,''),aliases_json,type,works,hits,status,confidence FROM dictionary_terms ORDER BY works DESC, source LIMIT 300")
	if err != nil {
		return []DictionaryTerm{}
	}
	defer rows.Close()
	out := []DictionaryTerm{}
	for rows.Next() {
		var term DictionaryTerm
		var aliases string
		_ = rows.Scan(&term.ID, &term.Source, &term.ZH, &aliases, &term.Type, &term.Works, &term.Hits, &term.Status, &term.Confidence)
		_ = json.Unmarshal([]byte(aliases), &term.Aliases)
		out = append(out, term)
	}
	return out
}

func (a *App) exports() []ExportJob {
	rows, err := a.db.Query("SELECT id,work_id,filename,size_bytes,preset,status,warnings_json FROM exports ORDER BY created_at DESC LIMIT 200")
	if err != nil {
		return []ExportJob{}
	}
	defer rows.Close()
	out := []ExportJob{}
	for rows.Next() {
		var item ExportJob
		var size int64
		var warnings string
		_ = rows.Scan(&item.ID, &item.WorkID, &item.Filename, &size, &item.Preset, &item.Status, &warnings)
		item.Size = humanSize(size)
		_ = json.Unmarshal([]byte(warnings), &item.Warnings)
		out = append(out, item)
	}
	return out
}

func valueOr(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func nullableString(v sql.NullString) string {
	if !v.Valid {
		return ""
	}
	return v.String
}

func (a *App) updateSettings(values map[string]string) error {
	for key, value := range values {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		if _, err := a.db.Exec("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", key, value); err != nil {
			return err
		}
	}
	return nil
}

func (a *App) readerManifest(workID int) (ReaderManifest, bool) {
	work, ok := a.work(workID)
	if !ok {
		return ReaderManifest{}, false
	}
	rows, err := a.db.Query("SELECT page_index,name FROM work_pages WHERE work_id=? ORDER BY page_index", workID)
	if err != nil {
		return ReaderManifest{}, false
	}
	defer rows.Close()
	pages := []ReaderPage{}
	for rows.Next() {
		var page ReaderPage
		_ = rows.Scan(&page.Index, &page.Name)
		page.URL = "/api/library/works/" + intString(workID) + "/reader/pages/" + intString(page.Index)
		pages = append(pages, page)
	}
	return ReaderManifest{Work: work, Pages: pages, Progress: a.progress(workID)}, true
}

func (a *App) progress(workID int) ProgressState {
	var state ProgressState
	if err := a.db.QueryRow("SELECT page_index,percent FROM reading_progress WHERE work_id=?", workID).Scan(&state.PageIndex, &state.Percent); err != nil {
		return ProgressState{}
	}
	return state
}

func (a *App) saveProgress(workID, pageIndex, percent int) error {
	if percent < 0 {
		percent = 0
	}
	if percent > 100 {
		percent = 100
	}
	_, err := a.db.Exec("INSERT INTO reading_progress(work_id,page_index,percent,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(work_id) DO UPDATE SET page_index=excluded.page_index,percent=excluded.percent,updated_at=CURRENT_TIMESTAMP", workID, pageIndex, percent)
	if err != nil {
		return err
	}
	_, err = a.db.Exec("UPDATE works SET progress=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", percent, workID)
	return err
}

func (a *App) metadataPayload(workID int) (MetadataPayload, bool) {
	work, ok := a.work(workID)
	if !ok {
		return MetadataPayload{}, false
	}
	rows, err := a.db.Query("SELECT field,COALESCE(current_value,''),COALESCE(source_value,''),COALESCE(machine_value,''),status FROM metadata_records WHERE work_id=? ORDER BY id", workID)
	if err != nil {
		return MetadataPayload{}, false
	}
	defer rows.Close()
	records := []MetadataRecord{}
	for rows.Next() {
		var record MetadataRecord
		_ = rows.Scan(&record.Field, &record.CurrentValue, &record.SourceValue, &record.MachineValue, &record.Status)
		records = append(records, record)
	}
	if len(records) == 0 {
		records = defaultMetadataRecords(work)
	}
	return MetadataPayload{Work: work, Records: records, Tags: a.tagsByKind(workID)}, true
}

func (a *App) tagsByKind(workID int) map[string][]string {
	rows, err := a.db.Query("SELECT kind,value FROM work_tags WHERE work_id=? ORDER BY kind,confirmed DESC,value", workID)
	if err != nil {
		return map[string][]string{}
	}
	defer rows.Close()
	out := map[string][]string{}
	for rows.Next() {
		var kind, value string
		_ = rows.Scan(&kind, &value)
		out[kind] = append(out[kind], value)
	}
	return out
}

func defaultMetadataRecords(work Work) []MetadataRecord {
	return []MetadataRecord{
		{Field: "Title", CurrentValue: work.Title, SourceValue: work.OriginalTitle, MachineValue: work.Title, Status: "same"},
		{Field: "Writer", CurrentValue: work.Author, SourceValue: work.Author, MachineValue: work.Author, Status: "same"},
		{Field: "Publisher", CurrentValue: work.Circle, SourceValue: work.Circle, MachineValue: work.Circle, Status: "same"},
		{Field: "LanguageISO", CurrentValue: work.Language, SourceValue: work.Language, MachineValue: work.Language, Status: "same"},
		{Field: "PageCount", CurrentValue: intString(work.Pages), SourceValue: intString(work.Pages), MachineValue: intString(work.Pages), Status: "same"},
		{Field: "Tags", CurrentValue: strings.Join(work.Tags, ", "), SourceValue: strings.Join(work.Tags, ", "), MachineValue: strings.Join(work.Tags, ", "), Status: "review"},
	}
}

func (a *App) fileHealth() FileHealth {
	var health FileHealth
	_ = a.db.QueryRow("SELECT COUNT(*),COALESCE(SUM(size_bytes),0),COALESCE(SUM(CASE WHEN COALESCE(cover_path,'')='' THEN 1 ELSE 0 END),0) FROM works").Scan(&health.Archives, &health.Bytes, &health.MissingCovers)
	_ = a.db.QueryRow("SELECT COUNT(*) FROM work_pages").Scan(&health.Pages)
	return health
}
