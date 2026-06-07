package main

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func (a *App) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", a.handleHealth)
	mux.HandleFunc("/api/auth/setup-status", a.handleSetupStatus)
	mux.HandleFunc("/api/auth/setup-admin", a.handleSetupAdmin)
	mux.HandleFunc("/api/auth/login", a.handleLogin)
	mux.HandleFunc("/api/app/state", a.requireAuth(a.handleAppState))
	mux.HandleFunc("/api/settings", a.requireAuth(a.handleSettings))
	mux.HandleFunc("/api/discover/", a.requireAuth(a.handleDiscover))
	mux.HandleFunc("/api/library/works", a.requireAuth(a.handleLibraryWorks))
	mux.HandleFunc("/api/library/upload", a.requireAuth(a.handleLibraryUpload))
	mux.HandleFunc("/api/library/works/", a.requireAuth(a.handleLibraryWork))
	mux.HandleFunc("/api/metadata/works/", a.requireAuth(a.handleMetadataWork))
	mux.HandleFunc("/api/dictionary/terms", a.requireAuth(a.handleDictionaryTerms))
	mux.HandleFunc("/api/tasks", a.requireAuth(a.handleTasks))
	mux.HandleFunc("/api/files/health", a.requireAuth(a.handleFilesHealth))
	mux.HandleFunc("/api/exports", a.requireAuth(a.handleExports))
	mux.HandleFunc("/api/images/proxy", a.requireAuth(a.handleImageProxy))
	mux.HandleFunc("/", a.handleStatic)
	return securityHeaders(mux)
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "same-origin")
		next.ServeHTTP(w, r)
	})
}

func (a *App) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "time": time.Now().UTC().Format(time.RFC3339)})
}

func (a *App) handleSetupStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, SetupStatus{NeedsSetup: !a.adminsExist()})
}

func (a *App) handleSetupAdmin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if a.adminsExist() {
		writeError(w, http.StatusConflict, "administrator already exists")
		return
	}
	var payload struct { Username string `json:"username"`; Password string `json:"password"` }
	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if len(payload.Password) < 8 {
		writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}
	auth, err := a.createAdmin(payload.Username, payload.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, auth)
}

func (a *App) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if !a.adminsExist() {
		writeError(w, http.StatusConflict, "setup required")
		return
	}
	var payload struct { Username string `json:"username"`; Password string `json:"password"` }
	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	auth, ok := a.authenticate(payload.Username, payload.Password)
	if !ok {
		writeError(w, http.StatusUnauthorized, "invalid username or password")
		return
	}
	writeJSON(w, http.StatusOK, auth)
}

func (a *App) handleAppState(w http.ResponseWriter, r *http.Request) { writeJSON(w, http.StatusOK, a.appState()) }

func (a *App) handleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, a.settingsState())
	case http.MethodPatch:
		var payload struct { Settings map[string]string `json:"settings"`; Secrets map[string]string `json:"secrets"` }
		if err := decodeJSON(r, &payload); err != nil { writeError(w, http.StatusBadRequest, "invalid json"); return }
		if err := a.updateSettings(payload.Settings); err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
		for name, value := range payload.Secrets {
			if err := a.saveSecret(name, value); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
		}
		writeJSON(w, http.StatusOK, a.settingsState())
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (a *App) handleDiscover(w http.ResponseWriter, r *http.Request) {
	action := strings.TrimPrefix(r.URL.Path, "/api/discover/")
	switch action {
	case "feed", "latest", "popular":
		writeJSON(w, http.StatusOK, map[string]any{"galleries": a.remote.feedFromLocal()})
	case "random":
		galleries := a.remote.feedFromLocal(); if len(galleries) > 6 { galleries = galleries[:6] }
		writeJSON(w, http.StatusOK, map[string]any{"galleries": galleries})
	case "search":
		galleries, err := a.remote.search(r.Context(), r.URL.Query().Get("q")); if err != nil { writeError(w, http.StatusBadGateway, err.Error()); return }
		writeJSON(w, http.StatusOK, map[string]any{"galleries": galleries})
	case "import":
		if r.Method != http.MethodPost { writeError(w, http.StatusMethodNotAllowed, "method not allowed"); return }
		var payload struct { SourceID string `json:"sourceId"`; Title string `json:"title"` }
		if err := decodeJSON(r, &payload); err != nil { writeError(w, http.StatusBadRequest, "invalid json"); return }
		task := a.createTask("remote_import", valueOr(payload.Title, "远端导入"), payload.SourceID, "queued")
		writeJSON(w, http.StatusAccepted, map[string]Task{"task": task})
	default:
		writeError(w, http.StatusNotFound, "unknown discover endpoint")
	}
}

func (a *App) handleLibraryWorks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { writeError(w, http.StatusMethodNotAllowed, "method not allowed"); return }
	writeJSON(w, http.StatusOK, map[string][]Work{"works": a.works()})
}

func (a *App) handleLibraryUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { writeError(w, http.StatusMethodNotAllowed, "method not allowed"); return }
	r.Body = http.MaxBytesReader(w, r.Body, maxArchiveBytes+(10<<20))
	if err := r.ParseMultipartForm(128 << 20); err != nil { writeError(w, http.StatusBadRequest, "invalid multipart upload"); return }
	file, header, err := r.FormFile("file"); if err != nil { writeError(w, http.StatusBadRequest, "missing file"); return }
	defer file.Close()
	work, err := a.importUploadedArchive(file, header.Filename); if err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	task := a.createTask("local_upload", work.Title, sanitizeFilename(header.Filename), "done"); task.Progress = 100
	writeJSON(w, http.StatusCreated, map[string]any{"work": work, "task": task})
}

func (a *App) handleLibraryWork(w http.ResponseWriter, r *http.Request) {
	id, rest, err := parseIDPath(r.URL.Path, "/api/library/works/"); if err != nil { writeError(w, http.StatusNotFound, "work not found"); return }
	switch {
	case rest == "":
		work, ok := a.work(id); if !ok { writeError(w, http.StatusNotFound, "work not found"); return }
		writeJSON(w, http.StatusOK, map[string]Work{"work": work})
	case rest == "cover":
		a.handleCover(w, id)
	case rest == "reader":
		manifest, ok := a.readerManifest(id); if !ok { writeError(w, http.StatusNotFound, "reader manifest not found"); return }
		writeJSON(w, http.StatusOK, manifest)
	case strings.HasPrefix(rest, "reader/pages/"):
		page, err := parsePositiveInt(strings.TrimPrefix(rest, "reader/pages/")); if err != nil { writeError(w, http.StatusNotFound, "page not found"); return }
		a.handleReaderPage(w, id, page)
	case rest == "progress":
		if r.Method != http.MethodPost { writeError(w, http.StatusMethodNotAllowed, "method not allowed"); return }
		var payload ProgressState; if err := decodeJSON(r, &payload); err != nil { writeError(w, http.StatusBadRequest, "invalid json"); return }
		if err := a.saveProgress(id, payload.PageIndex, payload.Percent); err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
		writeJSON(w, http.StatusOK, a.progress(id))
	default:
		writeError(w, http.StatusNotFound, "unknown library endpoint")
	}
}

func (a *App) handleCover(w http.ResponseWriter, workID int) {
	work, ok := a.work(workID); if !ok { writeError(w, http.StatusNotFound, "work not found"); return }
	if work.CoverPath != "" { if _, err := os.Stat(work.CoverPath); err == nil { http.ServeFile(w, nilRequest(), work.CoverPath); return } }
	placeholderCover(w, work.Title)
}

func (a *App) handleReaderPage(w http.ResponseWriter, workID, page int) {
	name, err := a.pageName(workID, page); if err != nil { writeError(w, http.StatusNotFound, "page not found"); return }
	w.Header().Set("Content-Type", contentTypeForName(name)); w.Header().Set("Cache-Control", "private, max-age=86400")
	_, _ = a.streamArchivePage(w, workID, page)
}

func (a *App) pageName(workID, page int) (string, error) {
	var name string
	err := a.db.QueryRow("SELECT name FROM work_pages WHERE work_id=? AND page_index=?", workID, page).Scan(&name)
	return name, err
}

func (a *App) handleMetadataWork(w http.ResponseWriter, r *http.Request) {
	id, rest, err := parseIDPath(r.URL.Path, "/api/metadata/works/"); if err != nil || rest != "" { writeError(w, http.StatusNotFound, "metadata not found"); return }
	switch r.Method {
	case http.MethodGet:
		payload, ok := a.metadataPayload(id); if !ok { writeError(w, http.StatusNotFound, "work not found"); return }
		writeJSON(w, http.StatusOK, payload)
	case http.MethodPatch:
		var payload struct { Title string `json:"title"`; Tags []string `json:"tags"` }
		if err := decodeJSON(r, &payload); err != nil { writeError(w, http.StatusBadRequest, "invalid json"); return }
		if strings.TrimSpace(payload.Title) != "" { if _, err := a.db.Exec("UPDATE works SET title=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", strings.TrimSpace(payload.Title), id); err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return } }
		if payload.Tags != nil {
			if _, err := a.db.Exec("DELETE FROM work_tags WHERE work_id=? AND kind='tag'", id); err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
			for _, tag := range uniqueStrings(payload.Tags) { if _, err := a.db.Exec("INSERT INTO work_tags(work_id,kind,value,confirmed) VALUES(?,?,?,1)", id, "tag", tag); err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return } }
		}
		next, _ := a.metadataPayload(id); writeJSON(w, http.StatusOK, next)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (a *App) handleDictionaryTerms(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, map[string][]DictionaryTerm{"terms": a.dictionaryTerms()})
	case http.MethodPost:
		var payload DictionaryTerm; if err := decodeJSON(r, &payload); err != nil { writeError(w, http.StatusBadRequest, "invalid json"); return }
		aliases := "[]"
		_, err := a.db.Exec("INSERT INTO dictionary_terms(source,zh,aliases_json,type,works,hits,status,confidence) VALUES(?,?,?,?,?,?,?,?)", payload.Source, payload.ZH, aliases, valueOr(payload.Type, "标签"), payload.Works, payload.Hits, valueOr(payload.Status, "pending"), payload.Confidence)
		if err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
		writeJSON(w, http.StatusCreated, map[string][]DictionaryTerm{"terms": a.dictionaryTerms()})
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (a *App) handleTasks(w http.ResponseWriter, r *http.Request) { writeJSON(w, http.StatusOK, map[string][]Task{"tasks": a.tasks()}) }
func (a *App) handleFilesHealth(w http.ResponseWriter, r *http.Request) { writeJSON(w, http.StatusOK, a.fileHealth()) }

func (a *App) handleExports(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, map[string][]ExportJob{"exports": a.exports()})
	case http.MethodPost:
		var payload struct { WorkID int `json:"workId"`; Preset string `json:"preset"` }
		if err := decodeJSON(r, &payload); err != nil { writeError(w, http.StatusBadRequest, "invalid json"); return }
		item, err := a.createExport(payload.WorkID, payload.Preset); if err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
		writeJSON(w, http.StatusCreated, map[string]ExportJob{"export": item})
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (a *App) handleImageProxy(w http.ResponseWriter, r *http.Request) {
	rawURL := r.URL.Query().Get("url"); if rawURL == "" { placeholderCover(w, "missing remote cover"); return }
	if err := validateProxyURL(rawURL); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	cacheDir := filepath.Join(a.cfg.LibraryDir, "remote-covers"); if err := os.MkdirAll(cacheDir, 0o755); err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	key := sha256.Sum256([]byte(rawURL)); cachePath := filepath.Join(cacheDir, hex.EncodeToString(key[:])+".img")
	if _, err := os.Stat(cachePath); err == nil { http.ServeFile(w, nilRequest(), cachePath); return }
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, rawURL, nil); if err != nil { writeError(w, http.StatusBadRequest, "invalid remote url"); return }
	req.Header.Set("User-Agent", a.cfg.DefaultUserAgent)
	resp, err := http.DefaultClient.Do(req); if err != nil || resp.StatusCode >= 400 { placeholderCover(w, "cover unavailable"); if resp != nil { _ = resp.Body.Close() }; return }
	defer resp.Body.Close()
	contentType := resp.Header.Get("Content-Type"); if !strings.HasPrefix(contentType, "image/") { writeError(w, http.StatusBadRequest, "remote resource is not an image"); return }
	tmp := cachePath + ".tmp"; out, err := os.Create(tmp); if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	if _, err := io.Copy(out, io.LimitReader(resp.Body, 20<<20)); err != nil { _ = out.Close(); _ = os.Remove(tmp); writeError(w, http.StatusBadGateway, err.Error()); return }
	if err := out.Close(); err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	if err := os.Rename(tmp, cachePath); err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	w.Header().Set("Content-Type", contentType); http.ServeFile(w, nilRequest(), cachePath)
}

func (a *App) handleStatic(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") { writeError(w, http.StatusNotFound, "api endpoint not found"); return }
	path := strings.TrimPrefix(filepath.Clean("/"+r.URL.Path), "/"); if path == "." || path == "" { path = "index.html" }
	target := filepath.Join(a.cfg.StaticDir, path); if stat, err := os.Stat(target); err == nil && !stat.IsDir() { http.ServeFile(w, r, target); return }
	index := filepath.Join(a.cfg.StaticDir, "index.html"); if _, err := os.Stat(index); err == nil { http.ServeFile(w, r, index); return }
	writeError(w, http.StatusNotFound, "frontend not built")
}

func (a *App) createTask(kind, title, target, status string) Task {
	id := "task-" + time.Now().UTC().Format("20060102150405") + "-" + sha256Hex(kind+title+target)[:8]
	task := Task{ID: id, Type: kind, Title: title, Target: target, Phase: status, Progress: 0, Status: status, ETA: ""}
	if status == "done" { task.Progress = 100; task.ETA = "完成" }
	_, _ = a.db.Exec("INSERT INTO tasks(id,type,title,target,phase,progress,status,eta) VALUES(?,?,?,?,?,?,?,?)", task.ID, task.Type, task.Title, task.Target, task.Phase, task.Progress, task.Status, task.ETA)
	return task
}

func (a *App) createExport(workID int, preset string) (ExportJob, error) {
	work, ok := a.work(workID); if !ok { return ExportJob{}, errors.New("work not found") }
	if work.ArchivePath == "" { return ExportJob{}, errors.New("work has no archive file") }
	settings := a.settings(); exportDir := valueOr(settings["export_dir"], filepath.Join(a.cfg.LibraryDir, "exports"))
	if err := os.MkdirAll(exportDir, 0o755); err != nil { return ExportJob{}, err }
	target := a.availablePath(filepath.Join(exportDir, sanitizeFilename(work.Title+".cbz")))
	size, err := a.writeExportArchive(target, work); if err != nil { return ExportJob{}, err }
	warnings := []string{}; status := "done"
	if work.MetadataScore < 80 { status = "warning"; warnings = append(warnings, "元数据完整度低于 80%") }
	if preset == "" { preset = "默认预设 v2" }
	warningsJSON, _ := json.Marshal(warnings)
	result, err := a.db.Exec("INSERT INTO exports(work_id,filename,path,size_bytes,preset,status,warnings_json) VALUES(?,?,?,?,?,?,?)", workID, filepath.Base(target), target, size, preset, status, string(warningsJSON))
	if err != nil { return ExportJob{}, err }
	id, _ := result.LastInsertId()
	return ExportJob{ID: int(id), WorkID: workID, Filename: filepath.Base(target), Size: humanSize(size), Preset: preset, Status: status, Warnings: warnings}, nil
}

func parseIDPath(path, prefix string) (int, string, error) {
	rest := strings.Trim(strings.TrimPrefix(path, prefix), "/"); if rest == "" { return 0, "", errors.New("missing id") }
	parts := strings.SplitN(rest, "/", 2); id, err := parsePositiveInt(parts[0]); if err != nil { return 0, "", err }
	if len(parts) == 1 { return id, "", nil }
	return id, parts[1], nil
}

func validateProxyURL(rawURL string) error {
	parsed, err := url.Parse(rawURL); if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") { return errors.New("proxy url must be http or https") }
	host := parsed.Hostname(); if host == "" { return errors.New("proxy url is missing host") }
	ips, err := net.LookupIP(host); if err != nil { return err }
	for _, ip := range ips { if ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() || ip.IsLinkLocalUnicast() { return errors.New("proxy url points to a private address") } }
	return nil
}

func placeholderCover(w http.ResponseWriter, title string) {
	w.Header().Set("Content-Type", "image/svg+xml; charset=utf-8")
	w.Header().Set("Cache-Control", "private, max-age=86400")
	title = strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;").Replace(title)
	_, _ = fmt.Fprintf(w, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 520"><rect width="360" height="520" fill="#f5efe5"/><text x="180" y="260" text-anchor="middle" font-size="22">%s</text></svg>`, title)
}

func nilRequest() *http.Request { return &http.Request{Method: http.MethodGet, URL: &url.URL{Path: "/"}} }

func zipEntryContent(path, name string) ([]byte, error) {
	reader, err := zip.OpenReader(path); if err != nil { return nil, err }
	defer reader.Close()
	for _, entry := range reader.File {
		if cleanSlash(entry.Name) != cleanSlash(name) { continue }
		rc, err := entry.Open(); if err != nil { return nil, err }
		defer rc.Close(); return io.ReadAll(rc)
	}
	return nil, errors.New("entry not found")
}
