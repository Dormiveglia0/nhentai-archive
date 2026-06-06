package main

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"html"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

type Config struct {
	Addr             string
	DataDir          string
	DatabasePath     string
	LibraryDir       string
	StaticDir        string
	SecretKey        string
	RequestTimeout   time.Duration
	RequestInterval  time.Duration
	RequestRetries   int
	Concurrency      int
	SessionTTL       time.Duration
	DefaultUserAgent string
	TargetLanguage   string
	AllowedHostLabel string
}

func loadConfig() Config {
	dataDir := env("DATA_DIR", "/app/data")
	return Config{
		Addr:             env("ADDR", ":8080"),
		DataDir:          dataDir,
		DatabasePath:     env("DATABASE_PATH", filepath.Join(dataDir, "app.db")),
		LibraryDir:       env("LIBRARY_DIR", filepath.Join(dataDir, "library")),
		StaticDir:        env("STATIC_DIR", "./public"),
		SecretKey:        env("SECRET_KEY", "change-me-before-public-deploy"),
		RequestTimeout:   durationEnv("REQUEST_TIMEOUT_SECONDS", 30) * time.Second,
		RequestInterval:  durationEnv("REQUEST_INTERVAL_MS", 900) * time.Millisecond,
		RequestRetries:   intEnv("REQUEST_RETRIES", 3),
		Concurrency:      intEnv("DOWNLOAD_CONCURRENCY", 2),
		SessionTTL:       durationEnv("SESSION_TTL_HOURS", 72) * time.Hour,
		DefaultUserAgent: env("NHENTAI_USER_AGENT", "nhentai-archive/2.0 (+authorized-personal-archive)"),
		TargetLanguage:   env("TARGET_LANGUAGE", "zh-CN"),
		AllowedHostLabel: env("PUBLIC_HOST_LABEL", "IP:5413"),
	}
}

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func intEnv(key string, fallback int) int {
	if v, err := strconv.Atoi(os.Getenv(key)); err == nil && v > 0 {
		return v
	}
	return fallback
}

func durationEnv(key string, fallback int64) time.Duration {
	if v, err := strconv.ParseInt(os.Getenv(key), 10, 64); err == nil && v > 0 {
		return time.Duration(v)
	}
	return time.Duration(fallback)
}

type App struct {
	cfg     Config
	db      *sql.DB
	crypto  *SecretBox
	client  *NHClient
	worker  *Worker
	started time.Time
}

func main() {
	cfg := loadConfig()
	if err := os.MkdirAll(cfg.LibraryDir, 0o755); err != nil {
		log.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(cfg.LibraryDir, ".tmp"), 0o755); err != nil {
		log.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(cfg.DatabasePath), 0o755); err != nil {
		log.Fatal(err)
	}
	db, err := sql.Open("sqlite", cfg.DatabasePath)
	if err != nil {
		log.Fatal(err)
	}
	app := &App{
		cfg:     cfg,
		db:      db,
		crypto:  NewSecretBox(cfg.SecretKey),
		started: time.Now(),
	}
	if err := app.initDB(); err != nil {
		log.Fatal(err)
	}
	app.client = NewNHClient(cfg, app)
	app.worker = NewWorker(app)
	app.worker.Start()
	defer app.worker.Stop()

	log.Printf("nhentai archive listening on %s; public test entry is http://%s", cfg.Addr, cfg.AllowedHostLabel)
	log.Fatal(http.ListenAndServe(cfg.Addr, app.routes()))
}

func (a *App) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", a.handleHealth)
	mux.HandleFunc("/api/setup/status", a.handleSetupStatus)
	mux.HandleFunc("/api/setup/admin", a.handleSetupAdmin)
	mux.HandleFunc("/api/auth/login", a.handleLogin)
	mux.HandleFunc("/api/settings", a.auth(a.handleSettings))
	mux.HandleFunc("/api/settings/secrets", a.auth(a.handleSecrets))
	mux.HandleFunc("/api/search", a.auth(a.handleSearch))
	mux.HandleFunc("/api/discover/popular", a.auth(a.handlePopular))
	mux.HandleFunc("/api/tags/resolve", a.auth(a.handleTagResolve))
	mux.HandleFunc("/api/tags/galleries", a.auth(a.handleTagged))
	mux.HandleFunc("/api/tasks/import", a.auth(a.handleImport))
	mux.HandleFunc("/api/tasks", a.auth(a.handleTasks))
	mux.HandleFunc("/api/tasks/", a.auth(a.handleTaskPath))
	mux.HandleFunc("/api/dictionary", a.auth(a.handleDictionary))
	mux.HandleFunc("/api/dictionary/bulk", a.auth(a.handleDictionaryBulk))
	mux.HandleFunc("/api/dictionary/", a.auth(a.handleDictionaryPath))
	mux.HandleFunc("/api/suggestions/", a.auth(a.handleSuggestionPath))
	mux.HandleFunc("/", a.handleStatic)
	return securityHeaders(mux)
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "same-origin")
		next.ServeHTTP(w, r)
	})
}

func (a *App) initDB() error {
	_, err := a.db.Exec(`
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS secrets (
  name TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gallery_id INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL,
  title TEXT,
  cover_url TEXT,
  language TEXT,
  error TEXT,
  progress_current INTEGER NOT NULL DEFAULT 0,
  progress_total INTEGER NOT NULL DEFAULT 0,
  cbz_path TEXT,
  raw_json TEXT,
  translated_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tag_dictionary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_type, source_text)
);
CREATE TABLE IF NOT EXISTS translation_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER,
  source_type TEXT NOT NULL,
  source_text TEXT NOT NULL,
  suggested_text TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(task_id, source_type, source_text, provider)
);
`)
	if err != nil {
		return err
	}
	defaults := map[string]string{
		"translate_tags":       "true",
		"translate_titles":     "false",
		"translation_provider": "google_free_gtx",
		"nhentai_user_agent":   a.cfg.DefaultUserAgent,
	}
	for k, v := range defaults {
		if _, err := a.db.Exec("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)", k, v); err != nil {
			return err
		}
	}
	return nil
}

func (a *App) adminExists() bool {
	var n int
	_ = a.db.QueryRow("SELECT COUNT(*) FROM admins").Scan(&n)
	return n > 0
}

func (a *App) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]any{"status": "ok", "uptime_seconds": int(time.Since(a.started).Seconds())})
}

func (a *App) handleSetupStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]any{"needs_setup": !a.adminExists()})
}

func (a *App) handleSetupAdmin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if a.adminExists() {
		http.Error(w, `{"detail":"setup already completed"}`, http.StatusConflict)
		return
	}
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := readJSON(r, &body); err != nil {
		badRequest(w, err.Error())
		return
	}
	body.Username = strings.TrimSpace(body.Username)
	if len(body.Username) < 3 || len(body.Password) < 10 {
		badRequest(w, "username must be at least 3 characters and password at least 10 characters")
		return
	}
	hash, err := hashPassword(body.Password)
	if err != nil {
		serverError(w, err)
		return
	}
	if _, err := a.db.Exec("INSERT INTO admins(username,password_hash) VALUES(?,?)", body.Username, hash); err != nil {
		serverError(w, err)
		return
	}
	token, err := a.createSession(body.Username)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, map[string]any{"token": token, "username": body.Username})
}

func (a *App) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := readJSON(r, &body); err != nil {
		badRequest(w, err.Error())
		return
	}
	var hash string
	if err := a.db.QueryRow("SELECT password_hash FROM admins WHERE username=?", body.Username).Scan(&hash); err != nil {
		http.Error(w, `{"detail":"invalid credentials"}`, http.StatusUnauthorized)
		return
	}
	if !verifyPassword(body.Password, hash) {
		http.Error(w, `{"detail":"invalid credentials"}`, http.StatusUnauthorized)
		return
	}
	token, err := a.createSession(body.Username)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, map[string]any{"token": token, "username": body.Username})
}

func (a *App) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !a.adminExists() {
			http.Error(w, `{"detail":"setup required"}`, http.StatusUnauthorized)
			return
		}
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if token == "" {
			http.Error(w, `{"detail":"missing token"}`, http.StatusUnauthorized)
			return
		}
		if _, ok := a.sessionUser(token); !ok {
			http.Error(w, `{"detail":"invalid token"}`, http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

func (a *App) createSession(username string) (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(raw)
	expires := time.Now().Add(a.cfg.SessionTTL).UTC().Format(time.RFC3339)
	_, err := a.db.Exec("INSERT INTO sessions(token_hash,username,expires_at) VALUES(?,?,?)", hashToken(token), username, expires)
	return token, err
}

func (a *App) sessionUser(token string) (string, bool) {
	var username, expiresRaw string
	if err := a.db.QueryRow("SELECT username,expires_at FROM sessions WHERE token_hash=?", hashToken(token)).Scan(&username, &expiresRaw); err != nil {
		return "", false
	}
	expires, err := time.Parse(time.RFC3339, expiresRaw)
	if err != nil || time.Now().After(expires) {
		_, _ = a.db.Exec("DELETE FROM sessions WHERE token_hash=?", hashToken(token))
		return "", false
	}
	return username, true
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (a *App) settingsMap() (map[string]string, error) {
	rows, err := a.db.Query("SELECT key,value FROM settings")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		out[k] = v
	}
	return out, rows.Err()
}

func (a *App) handleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		settings, err := a.settingsMap()
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, map[string]any{
			"translate_tags":       settings["translate_tags"] == "true",
			"translate_titles":     settings["translate_titles"] == "true",
			"translation_provider": settings["translation_provider"],
			"nhentai_user_agent":   settings["nhentai_user_agent"],
			"secrets":              a.secretStatuses(),
			"library_dir":          a.cfg.LibraryDir,
		})
	case http.MethodPatch:
		var body map[string]any
		if err := readJSON(r, &body); err != nil {
			badRequest(w, err.Error())
			return
		}
		allowed := map[string]bool{
			"translate_tags": true, "translate_titles": true, "translation_provider": true, "nhentai_user_agent": true,
		}
		for k, v := range body {
			if !allowed[k] {
				continue
			}
			stored := fmt.Sprint(v)
			if b, ok := v.(bool); ok {
				stored = strconv.FormatBool(b)
			}
			if _, err := a.db.Exec("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", k, stored); err != nil {
				serverError(w, err)
				return
			}
		}
		a.handleSettings(w, &http.Request{Method: http.MethodGet})
	default:
		methodNotAllowed(w)
	}
}

func (a *App) handleSecrets(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		methodNotAllowed(w)
		return
	}
	var body map[string]string
	if err := readJSON(r, &body); err != nil {
		badRequest(w, err.Error())
		return
	}
	allowed := map[string]bool{"deepl_api_key": true, "google_translate_api_key": true, "nhentai_api_key": true}
	for name, value := range body {
		if !allowed[name] || strings.TrimSpace(value) == "" {
			continue
		}
		nonce, cipherText, err := a.crypto.Encrypt(value)
		if err != nil {
			serverError(w, err)
			return
		}
		_, err = a.db.Exec("INSERT INTO secrets(name,nonce,ciphertext) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET nonce=excluded.nonce,ciphertext=excluded.ciphertext,updated_at=CURRENT_TIMESTAMP", name, nonce, cipherText)
		if err != nil {
			serverError(w, err)
			return
		}
	}
	writeJSON(w, map[string]any{"secrets": a.secretStatuses()})
}

func (a *App) secretStatuses() map[string]any {
	names := []string{"deepl_api_key", "google_translate_api_key", "nhentai_api_key"}
	out := map[string]any{}
	for _, n := range names {
		out[n] = map[string]any{"configured": a.getSecret(n) != "", "masked": maskSecret(a.getSecret(n))}
	}
	return out
}

func maskSecret(v string) string {
	if v == "" {
		return ""
	}
	if len(v) <= 6 {
		return "******"
	}
	return v[:3] + strings.Repeat("*", 6) + v[len(v)-3:]
}

func (a *App) getSecret(name string) string {
	var nonce, cipherText string
	if err := a.db.QueryRow("SELECT nonce,ciphertext FROM secrets WHERE name=?", name).Scan(&nonce, &cipherText); err != nil {
		return ""
	}
	plain, err := a.crypto.Decrypt(nonce, cipherText)
	if err != nil {
		return ""
	}
	return plain
}

func (a *App) handleSearch(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		badRequest(w, "q is required")
		return
	}
	page := intQuery(r, "page", 1)
	sortBy := queryDefault(r, "sort", "date")
	resp, err := a.client.Search(r.Context(), q, page, sortBy)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, resp)
}

func (a *App) handlePopular(w http.ResponseWriter, r *http.Request) {
	resp, err := a.client.Popular(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, resp)
}

func (a *App) handleTagResolve(w http.ResponseWriter, r *http.Request) {
	tagType, slug := strings.TrimSpace(r.URL.Query().Get("type")), strings.TrimSpace(r.URL.Query().Get("slug"))
	if tagType == "" || slug == "" {
		badRequest(w, "type and slug are required")
		return
	}
	resp, err := a.client.ResolveTag(r.Context(), tagType, slug)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, resp)
}

func (a *App) handleTagged(w http.ResponseWriter, r *http.Request) {
	tagID := intQuery(r, "tag_id", 0)
	if tagID <= 0 {
		badRequest(w, "tag_id is required")
		return
	}
	resp, err := a.client.Tagged(r.Context(), tagID, intQuery(r, "page", 1), queryDefault(r, "sort", "date"))
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, resp)
}

func (a *App) handleImport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		IDs []int `json:"ids"`
	}
	if err := readJSON(r, &body); err != nil {
		badRequest(w, err.Error())
		return
	}
	seen := map[int]bool{}
	for _, id := range body.IDs {
		if id <= 0 || seen[id] {
			continue
		}
		seen[id] = true
		_, err := a.db.Exec(`
INSERT INTO tasks(gallery_id,status) VALUES(?, 'queued')
ON CONFLICT(gallery_id) DO UPDATE SET
  status=CASE WHEN tasks.status='failed' THEN 'queued' ELSE tasks.status END,
  error=NULL,
  updated_at=CURRENT_TIMESTAMP`, id)
		if err != nil {
			serverError(w, err)
			return
		}
	}
	writeJSON(w, a.queryTasks())
}

func (a *App) handleTasks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	writeJSON(w, a.queryTasks())
}

func (a *App) handleTaskPath(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/tasks/"), "/")
	if len(parts) == 0 {
		http.NotFound(w, r)
		return
	}
	taskID, err := strconv.Atoi(parts[0])
	if err != nil {
		http.NotFound(w, r)
		return
	}
	action := ""
	if len(parts) > 1 {
		action = parts[1]
	}
	switch action {
	case "retry":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		_, err := a.db.Exec("UPDATE tasks SET status='queued',error=NULL,progress_current=0,updated_at=CURRENT_TIMESTAMP WHERE id=?", taskID)
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, a.getTask(taskID))
	case "metadata":
		row := a.getTask(taskID)
		writeJSON(w, map[string]any{"raw": decodeJSON(row["raw_json"]), "translated": decodeJSON(row["translated_json"])})
	case "download":
		a.downloadTask(w, taskID)
	case "related":
		task := a.getTask(taskID)
		galleryID, _ := task["gallery_id"].(int)
		if f, ok := task["gallery_id"].(float64); ok {
			galleryID = int(f)
		}
		resp, err := a.client.Related(r.Context(), galleryID)
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, resp)
	case "translation":
		a.handleTaskTranslation(w, r, taskID, parts[2:])
	case "":
		if r.Method == http.MethodDelete {
			a.deleteTask(w, taskID)
			return
		}
		writeJSON(w, a.getTask(taskID))
	default:
		http.NotFound(w, r)
	}
}

func (a *App) queryTasks() []map[string]any {
	rows, err := a.db.Query("SELECT id,gallery_id,status,title,cover_url,language,error,progress_current,progress_total,cbz_path,created_at,updated_at FROM tasks ORDER BY created_at DESC")
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []map[string]any
	for rows.Next() {
		var id, gid, cur, total int
		var status string
		var title, cover, language, errText, cbz, created, updated sql.NullString
		_ = rows.Scan(&id, &gid, &status, &title, &cover, &language, &errText, &cur, &total, &cbz, &created, &updated)
		out = append(out, map[string]any{
			"id": id, "gallery_id": gid, "status": status, "title": nullable(title), "cover_url": nullable(cover), "language": nullable(language),
			"error": nullable(errText), "progress_current": cur, "progress_total": total, "cbz_path": nullable(cbz), "created_at": nullable(created), "updated_at": nullable(updated),
		})
	}
	return out
}

func (a *App) getTask(id int) map[string]any {
	var gid, cur, total int
	var status string
	var title, cover, language, errText, cbz, raw, trans, created, updated sql.NullString
	err := a.db.QueryRow("SELECT gallery_id,status,title,cover_url,language,error,progress_current,progress_total,cbz_path,raw_json,translated_json,created_at,updated_at FROM tasks WHERE id=?", id).Scan(&gid, &status, &title, &cover, &language, &errText, &cur, &total, &cbz, &raw, &trans, &created, &updated)
	if err != nil {
		return map[string]any{}
	}
	return map[string]any{"id": id, "gallery_id": gid, "status": status, "title": nullable(title), "cover_url": nullable(cover), "language": nullable(language), "error": nullable(errText), "progress_current": cur, "progress_total": total, "cbz_path": nullable(cbz), "raw_json": nullable(raw), "translated_json": nullable(trans), "created_at": nullable(created), "updated_at": nullable(updated)}
}

func nullable(v sql.NullString) any {
	if !v.Valid {
		return nil
	}
	return v.String
}

func (a *App) downloadTask(w http.ResponseWriter, taskID int) {
	var path string
	if err := a.db.QueryRow("SELECT cbz_path FROM tasks WHERE id=?", taskID).Scan(&path); err != nil || path == "" {
		http.NotFound(w, nil)
		return
	}
	cleanLib, _ := filepath.Abs(a.cfg.LibraryDir)
	cleanPath, _ := filepath.Abs(path)
	if !strings.HasPrefix(cleanPath, cleanLib+string(os.PathSeparator)) || !fileExists(cleanPath) {
		http.NotFound(w, nil)
		return
	}
	w.Header().Set("Content-Type", "application/vnd.comicbook+zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filepath.Base(cleanPath)))
	http.ServeFile(w, nil, cleanPath)
}

func (a *App) deleteTask(w http.ResponseWriter, taskID int) {
	var path sql.NullString
	_ = a.db.QueryRow("SELECT cbz_path FROM tasks WHERE id=?", taskID).Scan(&path)
	if path.Valid && path.String != "" {
		cleanLib, _ := filepath.Abs(a.cfg.LibraryDir)
		cleanPath, _ := filepath.Abs(path.String)
		if strings.HasPrefix(cleanPath, cleanLib+string(os.PathSeparator)) {
			_ = os.Remove(cleanPath)
		}
	}
	_, _ = a.db.Exec("DELETE FROM tasks WHERE id=?", taskID)
	writeJSON(w, map[string]string{"status": "deleted"})
}

func (a *App) handleDictionary(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, a.dictionary())
	case http.MethodPost:
		var body DictEntry
		if err := readJSON(r, &body); err != nil {
			badRequest(w, err.Error())
			return
		}
		entry, err := a.upsertDict(body.SourceType, body.SourceText, body.TranslatedText, true)
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, entry)
	default:
		methodNotAllowed(w)
	}
}

func (a *App) handleDictionaryBulk(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		SourceType string `json:"source_type"`
		Text       string `json:"text"`
		Overwrite  bool   `json:"overwrite"`
		Preview    bool   `json:"preview"`
	}
	if err := readJSON(r, &body); err != nil {
		badRequest(w, err.Error())
		return
	}
	parsed := parseBulkDictionary(body.Text)
	if body.Preview {
		writeJSON(w, map[string]any{"count": len(parsed), "items": parsed})
		return
	}
	imported, skipped := 0, 0
	for _, item := range parsed {
		if body.Overwrite {
			_, err := a.upsertDict(body.SourceType, item[0], item[1], true)
			if err != nil {
				serverError(w, err)
				return
			}
			imported++
		} else {
			res, err := a.db.Exec("INSERT OR IGNORE INTO tag_dictionary(source_type,source_text,translated_text,enabled) VALUES(?,?,?,1)", body.SourceType, item[0], item[1])
			if err != nil {
				serverError(w, err)
				return
			}
			n, _ := res.RowsAffected()
			if n > 0 {
				imported++
			} else {
				skipped++
			}
		}
	}
	writeJSON(w, map[string]any{"imported": imported, "skipped": skipped})
}

func (a *App) handleDictionaryPath(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(strings.TrimPrefix(r.URL.Path, "/api/dictionary/"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodDelete {
		methodNotAllowed(w)
		return
	}
	_, _ = a.db.Exec("DELETE FROM tag_dictionary WHERE id=?", id)
	writeJSON(w, map[string]string{"status": "deleted"})
}

type DictEntry struct {
	ID             int    `json:"id"`
	SourceType     string `json:"source_type"`
	SourceText     string `json:"source_text"`
	TranslatedText string `json:"translated_text"`
	Enabled        bool   `json:"enabled"`
}

func (a *App) dictionary() []DictEntry {
	rows, err := a.db.Query("SELECT id,source_type,source_text,translated_text,enabled FROM tag_dictionary ORDER BY source_type,source_text")
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []DictEntry
	for rows.Next() {
		var e DictEntry
		var enabled int
		_ = rows.Scan(&e.ID, &e.SourceType, &e.SourceText, &e.TranslatedText, &enabled)
		e.Enabled = enabled == 1
		out = append(out, e)
	}
	return out
}

func (a *App) upsertDict(sourceType, source, translated string, enabled bool) (DictEntry, error) {
	sourceType, source, translated = strings.TrimSpace(sourceType), strings.TrimSpace(source), strings.TrimSpace(translated)
	if sourceType == "" || source == "" || translated == "" {
		return DictEntry{}, errors.New("source_type, source_text and translated_text are required")
	}
	en := 0
	if enabled {
		en = 1
	}
	_, err := a.db.Exec(`
INSERT INTO tag_dictionary(source_type,source_text,translated_text,enabled) VALUES(?,?,?,?)
ON CONFLICT(source_type,source_text) DO UPDATE SET translated_text=excluded.translated_text,enabled=excluded.enabled,updated_at=CURRENT_TIMESTAMP`, sourceType, source, translated, en)
	if err != nil {
		return DictEntry{}, err
	}
	var e DictEntry
	var enabledInt int
	err = a.db.QueryRow("SELECT id,source_type,source_text,translated_text,enabled FROM tag_dictionary WHERE source_type=? AND source_text=?", sourceType, source).Scan(&e.ID, &e.SourceType, &e.SourceText, &e.TranslatedText, &enabledInt)
	e.Enabled = enabledInt == 1
	return e, err
}

func parseBulkDictionary(text string) [][2]string {
	var out [][2]string
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		left, right := strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
		if left != "" && right != "" {
			out = append(out, [2]string{left, right})
		}
	}
	return out
}

func (a *App) handleTaskTranslation(w http.ResponseWriter, r *http.Request, taskID int, rest []string) {
	if len(rest) == 0 {
		if r.Method != http.MethodGet {
			methodNotAllowed(w)
			return
		}
		var raw, trans sql.NullString
		if err := a.db.QueryRow("SELECT raw_json,translated_json FROM tasks WHERE id=?", taskID).Scan(&raw, &trans); err != nil {
			http.NotFound(w, r)
			return
		}
		gallery := map[string]any{}
		_ = json.Unmarshal([]byte(raw.String), &gallery)
		writeJSON(w, map[string]any{"raw": gallery, "translated": decodeJSON(trans.String), "items": a.translationItems(gallery)})
		return
	}
	switch rest[0] {
	case "suggest":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		var body struct {
			Provider string            `json:"provider"`
			Items    []TranslationItem `json:"items"`
		}
		if err := readJSON(r, &body); err != nil {
			badRequest(w, err.Error())
			return
		}
		suggestions, err := a.suggestTranslations(r.Context(), taskID, body.Provider, body.Items)
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, suggestions)
	case "dictionary":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		var raw sql.NullString
		if err := a.db.QueryRow("SELECT raw_json FROM tasks WHERE id=?", taskID).Scan(&raw); err != nil {
			http.NotFound(w, r)
			return
		}
		gallery := map[string]any{}
		_ = json.Unmarshal([]byte(raw.String), &gallery)
		writeJSON(w, map[string]any{"translated": a.applyDictionary(gallery)})
	case "apply":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		var body struct {
			Translated map[string]any `json:"translated"`
		}
		if err := readJSON(r, &body); err != nil {
			badRequest(w, err.Error())
			return
		}
		if err := a.applyTranslationToTask(taskID, body.Translated); err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, map[string]string{"status": "applied"})
	default:
		http.NotFound(w, r)
	}
}

type TranslationItem struct {
	SourceType string `json:"source_type"`
	SourceText string `json:"source_text"`
}

func (a *App) translationItems(gallery map[string]any) []TranslationItem {
	var items []TranslationItem
	if title := galleryTitle(gallery); title != "" {
		items = append(items, TranslationItem{SourceType: "title", SourceText: title})
	}
	for _, tag := range galleryTags(gallery) {
		items = append(items, TranslationItem{SourceType: tag.Type, SourceText: tag.Name})
	}
	return items
}

func (a *App) applyDictionary(gallery map[string]any) map[string]any {
	dict := map[string]string{}
	for _, e := range a.dictionary() {
		if e.Enabled {
			dict[e.SourceType+"\x00"+e.SourceText] = e.TranslatedText
		}
	}
	title := galleryTitle(gallery)
	out := map[string]any{"title": title, "translated_title": title, "tags": []map[string]string{}}
	if v, ok := dict["title\x00"+title]; ok {
		out["translated_title"] = v
	}
	var tags []map[string]string
	for _, tag := range galleryTags(gallery) {
		translated := tag.Name
		if v, ok := dict[tag.Type+"\x00"+tag.Name]; ok {
			translated = v
		} else if v, ok := dict["tag\x00"+tag.Name]; ok {
			translated = v
		}
		tags = append(tags, map[string]string{"type": tag.Type, "name": tag.Name, "translated": translated})
	}
	out["tags"] = tags
	return out
}

func (a *App) suggestTranslations(ctx context.Context, taskID int, provider string, items []TranslationItem) ([]map[string]any, error) {
	if provider == "" {
		settings, _ := a.settingsMap()
		provider = settings["translation_provider"]
	}
	var suggestions []map[string]any
	for _, item := range items {
		text := strings.TrimSpace(item.SourceText)
		if text == "" {
			continue
		}
		translated, err := a.machineTranslate(ctx, provider, text)
		if err != nil {
			return nil, err
		}
		_, err = a.db.Exec(`
INSERT INTO translation_suggestions(task_id,source_type,source_text,suggested_text,provider)
VALUES(?,?,?,?,?)
ON CONFLICT(task_id,source_type,source_text,provider) DO UPDATE SET suggested_text=excluded.suggested_text,status='pending',created_at=CURRENT_TIMESTAMP`, taskID, item.SourceType, text, translated, provider)
		if err != nil {
			return nil, err
		}
		suggestions = append(suggestions, map[string]any{"task_id": taskID, "source_type": item.SourceType, "source_text": text, "suggested_text": translated, "provider": provider, "status": "pending"})
	}
	return suggestions, nil
}

func (a *App) machineTranslate(ctx context.Context, provider, text string) (string, error) {
	switch provider {
	case "", "none":
		return "", errors.New("translation provider is not configured")
	case "google_free_gtx":
		u := "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" + url.QueryEscape(a.cfg.TargetLanguage) + "&dt=t&q=" + url.QueryEscape(text)
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return "", err
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 300 {
			return "", fmt.Errorf("google free translate failed: %s", resp.Status)
		}
		var data any
		if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
			return "", err
		}
		return parseGTX(data), nil
	case "deepl":
		key := a.getSecret("deepl_api_key")
		if key == "" {
			return "", errors.New("DeepL API key is not configured")
		}
		form := url.Values{"auth_key": {key}, "target_lang": {"ZH"}, "text": {text}}
		req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "https://api-free.deepl.com/v2/translate", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return "", err
		}
		defer resp.Body.Close()
		var body struct {
			Translations []struct {
				Text string `json:"text"`
			} `json:"translations"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
			return "", err
		}
		if len(body.Translations) == 0 {
			return "", errors.New("DeepL returned no translations")
		}
		return body.Translations[0].Text, nil
	case "google_paid":
		key := a.getSecret("google_translate_api_key")
		if key == "" {
			return "", errors.New("Google Translate API key is not configured")
		}
		payload := map[string]any{"q": []string{text}, "target": "zh-CN", "format": "text"}
		buf, _ := json.Marshal(payload)
		req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "https://translation.googleapis.com/language/translate/v2?key="+url.QueryEscape(key), bytes.NewReader(buf))
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return "", err
		}
		defer resp.Body.Close()
		var body struct {
			Data struct {
				Translations []struct {
					TranslatedText string `json:"translatedText"`
				} `json:"translations"`
			} `json:"data"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
			return "", err
		}
		if len(body.Data.Translations) == 0 {
			return "", errors.New("Google returned no translations")
		}
		return html.UnescapeString(body.Data.Translations[0].TranslatedText), nil
	default:
		return "", fmt.Errorf("unsupported provider: %s", provider)
	}
}

func parseGTX(data any) string {
	arr, ok := data.([]any)
	if !ok || len(arr) == 0 {
		return ""
	}
	segments, ok := arr[0].([]any)
	if !ok {
		return ""
	}
	var out strings.Builder
	for _, seg := range segments {
		values, ok := seg.([]any)
		if ok && len(values) > 0 {
			if s, ok := values[0].(string); ok {
				out.WriteString(s)
			}
		}
	}
	return out.String()
}

func (a *App) handleSuggestionPath(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/suggestions/"), "/")
	if len(parts) != 2 || parts[1] != "accept" || r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}
	id, _ := strconv.Atoi(parts[0])
	var sourceType, sourceText, suggested string
	if err := a.db.QueryRow("SELECT source_type,source_text,suggested_text FROM translation_suggestions WHERE id=?", id).Scan(&sourceType, &sourceText, &suggested); err != nil {
		http.NotFound(w, r)
		return
	}
	entry, err := a.upsertDict(sourceType, sourceText, suggested, true)
	if err != nil {
		serverError(w, err)
		return
	}
	_, _ = a.db.Exec("UPDATE translation_suggestions SET status='accepted' WHERE id=?", id)
	writeJSON(w, entry)
}

func (a *App) applyTranslationToTask(taskID int, translated map[string]any) error {
	var raw, cbzPath string
	if err := a.db.QueryRow("SELECT raw_json,cbz_path FROM tasks WHERE id=?", taskID).Scan(&raw, &cbzPath); err != nil {
		return err
	}
	var gallery map[string]any
	if err := json.Unmarshal([]byte(raw), &gallery); err != nil {
		return err
	}
	buf, _ := json.Marshal(translated)
	if _, err := a.db.Exec("UPDATE tasks SET translated_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", string(buf), taskID); err != nil {
		return err
	}
	if cbzPath == "" {
		return nil
	}
	return rewriteComicInfo(cbzPath, comicInfoXML(gallery, translated))
}

func decodeJSON(v any) any {
	s, ok := v.(string)
	if !ok || s == "" {
		return nil
	}
	var out any
	if err := json.Unmarshal([]byte(s), &out); err != nil {
		return nil
	}
	return out
}

type Tag struct {
	ID   int
	Type string
	Name string
}

type GallerySummary struct {
	ID        int      `json:"id"`
	MediaID   string   `json:"media_id"`
	Title     string   `json:"title"`
	CoverURL  string   `json:"cover_url"`
	ThumbURL  string   `json:"thumb_url"`
	NumPages  int      `json:"num_pages"`
	Language  string   `json:"language"`
	Tags      []Tag    `json:"tags"`
	TagIDs    []int    `json:"tag_ids"`
	TagSample []string `json:"tag_sample"`
}

type NHClient struct {
	cfg     Config
	app     *App
	client  *http.Client
	lastReq time.Time
	mu      sync.Mutex
}

func NewNHClient(cfg Config, app *App) *NHClient {
	return &NHClient{cfg: cfg, app: app, client: &http.Client{Timeout: cfg.RequestTimeout}}
}

func (c *NHClient) request(ctx context.Context, path string, params url.Values) (map[string]any, error) {
	if params == nil {
		params = url.Values{}
	}
	u := "https://nhentai.net" + path
	if len(params) > 0 {
		u += "?" + params.Encode()
	}
	var last error
	for attempt := 0; attempt < c.cfg.RequestRetries; attempt++ {
		c.rateLimit()
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
		req.Header.Set("Accept", "application/json")
		ua := c.setting("nhentai_user_agent", c.cfg.DefaultUserAgent)
		req.Header.Set("User-Agent", ua)
		if key := c.app.getSecret("nhentai_api_key"); key != "" {
			req.Header.Set("Authorization", "Bearer "+key)
			req.Header.Set("X-API-Key", key)
		}
		resp, err := c.client.Do(req)
		if err != nil {
			last = err
		} else {
			defer resp.Body.Close()
			if resp.StatusCode == 401 || resp.StatusCode == 403 || resp.StatusCode == 429 {
				return nil, fmt.Errorf("remote service rejected request with %d; access controls will not be bypassed", resp.StatusCode)
			}
			if resp.StatusCode >= 300 {
				last = fmt.Errorf("nhentai API %s", resp.Status)
			} else {
				var body map[string]any
				if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
					return nil, err
				}
				return body, nil
			}
		}
		time.Sleep(time.Duration(math.Pow(2, float64(attempt))) * time.Second)
	}
	return nil, last
}

func (c *NHClient) setting(key, fallback string) string {
	m, _ := c.app.settingsMap()
	if v := strings.TrimSpace(m[key]); v != "" {
		return v
	}
	return fallback
}

func (c *NHClient) rateLimit() {
	c.mu.Lock()
	defer c.mu.Unlock()
	delay := c.cfg.RequestInterval - time.Since(c.lastReq)
	if delay > 0 {
		time.Sleep(delay)
	}
	c.lastReq = time.Now()
}

func (c *NHClient) Gallery(ctx context.Context, id int) (map[string]any, error) {
	return c.request(ctx, "/api/v2/galleries/"+strconv.Itoa(id), nil)
}

func (c *NHClient) Search(ctx context.Context, q string, page int, sortBy string) (map[string]any, error) {
	body, err := c.request(ctx, "/api/v2/search", url.Values{"query": {q}, "page": {strconv.Itoa(page)}, "sort": {sortBy}})
	if err != nil {
		return nil, err
	}
	return normalizeListResponse(body), nil
}

func (c *NHClient) Popular(ctx context.Context) (map[string]any, error) {
	body, err := c.request(ctx, "/api/v2/galleries/popular", nil)
	if err != nil {
		return nil, err
	}
	return normalizeListResponse(body), nil
}

func (c *NHClient) Related(ctx context.Context, id int) (map[string]any, error) {
	body, err := c.request(ctx, "/api/v2/galleries/"+strconv.Itoa(id)+"/related", nil)
	if err != nil {
		return nil, err
	}
	return normalizeListResponse(body), nil
}

func (c *NHClient) ResolveTag(ctx context.Context, tagType, slug string) (map[string]any, error) {
	return c.request(ctx, "/api/v2/tags/"+url.PathEscape(tagType)+"/"+url.PathEscape(slug), nil)
}

func (c *NHClient) Tagged(ctx context.Context, tagID, page int, sortBy string) (map[string]any, error) {
	body, err := c.request(ctx, "/api/v2/galleries/tagged", url.Values{"tag_id": {strconv.Itoa(tagID)}, "page": {strconv.Itoa(page)}, "sort": {sortBy}})
	if err != nil {
		return nil, err
	}
	return normalizeListResponse(body), nil
}

func (c *NHClient) CDN(ctx context.Context) []string {
	body, err := c.request(ctx, "/api/v2/cdn", nil)
	if err != nil {
		return []string{"https://i.nhentai.net"}
	}
	raw, ok := body["image_servers"].([]any)
	if !ok || len(raw) == 0 {
		return []string{"https://i.nhentai.net"}
	}
	var out []string
	for _, item := range raw {
		s := fmt.Sprint(item)
		if s == "" {
			continue
		}
		if !strings.HasPrefix(s, "http") {
			s = "https://" + s
		}
		out = append(out, s)
	}
	if len(out) == 0 {
		out = []string{"https://i.nhentai.net"}
	}
	return out
}

func normalizeListResponse(body map[string]any) map[string]any {
	raw := body["result"]
	if raw == nil {
		raw = body
	}
	itemsRaw, ok := raw.([]any)
	if !ok {
		itemsRaw = asArray(body["galleries"])
	}
	var items []GallerySummary
	for _, item := range itemsRaw {
		if m, ok := item.(map[string]any); ok {
			items = append(items, normalizeGallery(m))
		}
	}
	return map[string]any{"result": items, "count": len(items)}
}

func normalizeGallery(data map[string]any) GallerySummary {
	mediaID := stringValue(data["media_id"])
	title := galleryTitle(data)
	cover := imageThumbURL(data, "cover")
	thumb := imageThumbURL(data, "thumbnail")
	tags := galleryTags(data)
	tagIDs := intArray(data["tag_ids"])
	lang := galleryLanguage(tags, tagIDs)
	var sample []string
	for _, t := range tags {
		if t.Name != "" && len(sample) < 8 {
			sample = append(sample, t.Type+":"+t.Name)
		}
	}
	return GallerySummary{ID: intValue(data["id"]), MediaID: mediaID, Title: title, CoverURL: cover, ThumbURL: thumb, NumPages: intValue(data["num_pages"]), Language: lang, Tags: tags, TagIDs: tagIDs, TagSample: sample}
}

func galleryTitle(data map[string]any) string {
	if s := stringValue(data["title"]); s != "" {
		return s
	}
	if title, ok := data["title"].(map[string]any); ok {
		for _, k := range []string{"pretty", "display", "english", "japanese"} {
			if s := stringValue(title[k]); s != "" {
				return s
			}
		}
	}
	for _, k := range []string{"pretty_title", "english_title", "japanese_title"} {
		if s := stringValue(data[k]); s != "" {
			return s
		}
	}
	if id := intValue(data["id"]); id > 0 {
		return strconv.Itoa(id)
	}
	return "untitled"
}

func imageThumbURL(data map[string]any, key string) string {
	if s := stringValue(data[key+"_url"]); s != "" {
		return s
	}
	mediaID := stringValue(data["media_id"])
	if mediaID == "" {
		return ""
	}
	obj, ok := data[key].(map[string]any)
	if !ok {
		return ""
	}
	path := stringValue(obj["path"])
	if path == "" {
		return ""
	}
	if strings.Contains(path, "/") {
		parts := strings.Split(path, "/")
		path = parts[len(parts)-1]
	}
	return "https://t.nhentai.net/galleries/" + mediaID + "/" + strings.TrimLeft(path, "/")
}

func galleryTags(data map[string]any) []Tag {
	raw := asArray(data["tags"])
	var tags []Tag
	for _, item := range raw {
		if m, ok := item.(map[string]any); ok {
			tags = append(tags, Tag{ID: intValue(m["id"]), Type: stringValue(m["type"]), Name: firstString(m, "name", "slug")})
		}
	}
	return tags
}

func galleryLanguage(tags []Tag, ids []int) string {
	for _, t := range tags {
		if t.Type == "language" && t.Name != "" {
			return t.Name
		}
	}
	known := map[int]string{12227: "english", 6346: "japanese", 29963: "chinese"}
	for _, id := range ids {
		if s := known[id]; s != "" {
			return s
		}
	}
	return ""
}

func firstString(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if s := stringValue(m[k]); s != "" {
			return s
		}
	}
	return ""
}

func asArray(v any) []any {
	if a, ok := v.([]any); ok {
		return a
	}
	return nil
}

func intArray(v any) []int {
	var out []int
	for _, item := range asArray(v) {
		if n := intValue(item); n > 0 {
			out = append(out, n)
		}
	}
	return out
}

func intValue(v any) int {
	switch t := v.(type) {
	case int:
		return t
	case int64:
		return int(t)
	case float64:
		return int(t)
	case string:
		n, _ := strconv.Atoi(t)
		return n
	default:
		return 0
	}
}

func stringValue(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

type Worker struct {
	app    *App
	stop   chan struct{}
	done   chan struct{}
	active sync.Map
}

func NewWorker(app *App) *Worker {
	return &Worker{app: app, stop: make(chan struct{}), done: make(chan struct{})}
}

func (w *Worker) Start() {
	go w.loop()
}

func (w *Worker) Stop() {
	close(w.stop)
	<-w.done
}

func (w *Worker) loop() {
	defer close(w.done)
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-w.stop:
			return
		case <-ticker.C:
			w.schedule()
		}
	}
}

func (w *Worker) schedule() {
	rows, err := w.app.db.Query("SELECT id FROM tasks WHERE status='queued' ORDER BY created_at LIMIT ?", w.app.cfg.Concurrency)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err == nil {
			if _, exists := w.active.LoadOrStore(id, true); !exists {
				go func(taskID int) {
					defer w.active.Delete(taskID)
					w.runOne(taskID)
				}(id)
			}
		}
	}
}

func (w *Worker) runOne(taskID int) {
	app := w.app
	var galleryID int
	if err := app.db.QueryRow("SELECT gallery_id FROM tasks WHERE id=?", taskID).Scan(&galleryID); err != nil {
		return
	}
	_, _ = app.db.Exec("UPDATE tasks SET status='downloading',error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?", taskID)
	ctx, cancel := context.WithTimeout(context.Background(), time.Hour)
	defer cancel()
	gallery, err := app.client.Gallery(ctx, galleryID)
	if err != nil {
		w.fail(taskID, err)
		return
	}
	summary := normalizeGallery(gallery)
	raw, _ := json.Marshal(gallery)
	pages := asArray(gallery["pages"])
	_, _ = app.db.Exec("UPDATE tasks SET title=?,cover_url=?,language=?,progress_total=?,raw_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", summary.Title, coalesce(summary.CoverURL, summary.ThumbURL), summary.Language, len(pages), string(raw), taskID)
	servers := app.client.CDN(ctx)
	cbz, err := w.downloadCBZ(ctx, taskID, gallery, servers[0])
	if err != nil {
		w.fail(taskID, err)
		return
	}
	_, _ = app.db.Exec("UPDATE tasks SET status='completed',cbz_path=?,progress_current=progress_total,updated_at=CURRENT_TIMESTAMP WHERE id=?", cbz, taskID)
}

func (w *Worker) fail(taskID int, err error) {
	_, _ = w.app.db.Exec("UPDATE tasks SET status='failed',error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", err.Error(), taskID)
}

func (w *Worker) downloadCBZ(ctx context.Context, taskID int, gallery map[string]any, server string) (string, error) {
	app := w.app
	summary := normalizeGallery(gallery)
	filename := safeFilename(fmt.Sprintf("%d - %s", summary.ID, summary.Title)) + ".cbz"
	finalPath := filepath.Join(app.cfg.LibraryDir, filename)
	tmpDir := filepath.Join(app.cfg.LibraryDir, ".tmp")
	if err := os.MkdirAll(tmpDir, 0o755); err != nil {
		return "", err
	}
	tmp, err := os.CreateTemp(tmpDir, "*.cbz")
	if err != nil {
		return "", err
	}
	tmpPath := tmp.Name()
	tmp.Close()
	defer func() { _ = os.Remove(tmpPath) }()

	out, err := os.Create(tmpPath)
	if err != nil {
		return "", err
	}
	archive := zip.NewWriter(out)
	pages := asArray(gallery["pages"])
	for i, p := range pages {
		page, ok := p.(map[string]any)
		if !ok {
			continue
		}
		path := strings.TrimLeft(stringValue(page["path"]), "/")
		if path == "" {
			return "", errors.New("page is missing path")
		}
		u := strings.TrimRight(server, "/") + "/" + path
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
		req.Header.Set("User-Agent", app.cfg.DefaultUserAgent)
		req.Header.Set("Referer", fmt.Sprintf("https://nhentai.net/g/%d/", summary.ID))
		resp, err := app.client.client.Do(req)
		if err != nil {
			archive.Close()
			out.Close()
			return "", err
		}
		if resp.StatusCode == 401 || resp.StatusCode == 403 || resp.StatusCode == 429 {
			resp.Body.Close()
			archive.Close()
			out.Close()
			return "", errors.New("remote service rejected image download; access controls will not be bypassed")
		}
		if resp.StatusCode >= 300 {
			resp.Body.Close()
			archive.Close()
			out.Close()
			return "", fmt.Errorf("image download failed: %s", resp.Status)
		}
		ext := pageExt(path)
		writer, err := archive.Create(fmt.Sprintf("%04d%s", i+1, ext))
		if err != nil {
			resp.Body.Close()
			archive.Close()
			out.Close()
			return "", err
		}
		if _, err := io.Copy(writer, resp.Body); err != nil {
			resp.Body.Close()
			archive.Close()
			out.Close()
			return "", err
		}
		resp.Body.Close()
		_, _ = app.db.Exec("UPDATE tasks SET progress_current=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", i+1, taskID)
	}
	if err := addZipText(archive, "ComicInfo.xml", comicInfoXML(gallery, nil)); err != nil {
		archive.Close()
		out.Close()
		return "", err
	}
	if err := archive.Close(); err != nil {
		out.Close()
		return "", err
	}
	if err := out.Close(); err != nil {
		return "", err
	}
	if err := os.Rename(tmpPath, finalPath); err != nil {
		return "", err
	}
	return finalPath, nil
}

func coalesce(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

var unsafeFilename = regexp.MustCompile(`[<>:"/\\|?*\x00-\x1f]`)

func safeFilename(s string) string {
	s = unsafeFilename.ReplaceAllString(strings.TrimSpace(s), "_")
	if len(s) > 180 {
		s = s[:180]
	}
	if s == "" {
		return "untitled"
	}
	return s
}

func pageExt(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp":
		return ext
	default:
		return ".jpg"
	}
}

type ComicInfo struct {
	XMLName     xml.Name `xml:"ComicInfo"`
	Title       string   `xml:"Title,omitempty"`
	Series      string   `xml:"Series,omitempty"`
	Writer      string   `xml:"Writer,omitempty"`
	Publisher   string   `xml:"Publisher,omitempty"`
	Genre       string   `xml:"Genre,omitempty"`
	LanguageISO string   `xml:"LanguageISO,omitempty"`
	Tags        string   `xml:"Tags,omitempty"`
	PageCount   int      `xml:"PageCount,omitempty"`
	Web         string   `xml:"Web,omitempty"`
	Summary     string   `xml:"Summary,omitempty"`
}

func comicInfoXML(gallery map[string]any, translated map[string]any) string {
	title := galleryTitle(gallery)
	if translated != nil {
		if s := stringValue(translated["translated_title"]); s != "" {
			title = s
		}
	}
	tags := galleryTags(gallery)
	var names []string
	for _, t := range tags {
		names = append(names, t.Name)
	}
	if translated != nil {
		if raw := asArray(translated["tags"]); len(raw) > 0 {
			names = nil
			for _, item := range raw {
				if m, ok := item.(map[string]any); ok {
					names = append(names, coalesce(stringValue(m["translated"]), stringValue(m["name"])))
				}
			}
		}
	}
	sort.Strings(names)
	info := ComicInfo{Title: title, Series: title, Genre: strings.Join(names, ", "), Tags: strings.Join(names, ", "), PageCount: len(asArray(gallery["pages"])), Web: fmt.Sprintf("https://nhentai.net/g/%d/", intValue(gallery["id"])), LanguageISO: galleryLanguage(tags, intArray(gallery["tag_ids"])), Summary: fmt.Sprintf("Original nhentai ID: %d", intValue(gallery["id"]))}
	var buf bytes.Buffer
	buf.WriteString(`<?xml version="1.0" encoding="utf-8"?>` + "\n")
	enc := xml.NewEncoder(&buf)
	enc.Indent("", "  ")
	_ = enc.Encode(info)
	return buf.String()
}

func addZipText(z *zip.Writer, name, content string) error {
	w, err := z.Create(name)
	if err != nil {
		return err
	}
	_, err = w.Write([]byte(content))
	return err
}

func rewriteComicInfo(path, content string) error {
	tmp := filepath.Join(filepath.Dir(path), ".tmp", filepath.Base(path)+".rewrite")
	if err := os.MkdirAll(filepath.Dir(tmp), 0o755); err != nil {
		return err
	}
	reader, err := zip.OpenReader(path)
	if err != nil {
		return err
	}
	defer reader.Close()
	outFile, err := os.Create(tmp)
	if err != nil {
		return err
	}
	archive := zip.NewWriter(outFile)
	for _, f := range reader.File {
		if strings.EqualFold(f.Name, "ComicInfo.xml") {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			archive.Close()
			outFile.Close()
			return err
		}
		w, err := archive.Create(f.Name)
		if err != nil {
			rc.Close()
			archive.Close()
			outFile.Close()
			return err
		}
		if _, err := io.Copy(w, rc); err != nil {
			rc.Close()
			archive.Close()
			outFile.Close()
			return err
		}
		rc.Close()
	}
	if err := addZipText(archive, "ComicInfo.xml", content); err != nil {
		archive.Close()
		outFile.Close()
		return err
	}
	if err := archive.Close(); err != nil {
		outFile.Close()
		return err
	}
	if err := outFile.Close(); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

type SecretBox struct {
	key [32]byte
}

func NewSecretBox(secret string) *SecretBox {
	return &SecretBox{key: sha256.Sum256([]byte(secret))}
}

func (s *SecretBox) Encrypt(plain string) (string, string, error) {
	block, err := aes.NewCipher(s.key[:])
	if err != nil {
		return "", "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", "", err
	}
	cipherText := gcm.Seal(nil, nonce, []byte(plain), nil)
	return base64.RawStdEncoding.EncodeToString(nonce), base64.RawStdEncoding.EncodeToString(cipherText), nil
}

func (s *SecretBox) Decrypt(nonceRaw, cipherRaw string) (string, error) {
	nonce, err := base64.RawStdEncoding.DecodeString(nonceRaw)
	if err != nil {
		return "", err
	}
	cipherText, err := base64.RawStdEncoding.DecodeString(cipherRaw)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(s.key[:])
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	plain, err := gcm.Open(nil, nonce, cipherText, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func hashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	iterations := 210000
	key := pbkdf2SHA256([]byte(password), salt, iterations, 32)
	return fmt.Sprintf("pbkdf2_sha256$%d$%s$%s", iterations, base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(key)), nil
}

func verifyPassword(password, encoded string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 4 || parts[0] != "pbkdf2_sha256" {
		return false
	}
	iterations, err := strconv.Atoi(parts[1])
	if err != nil {
		return false
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[2])
	if err != nil {
		return false
	}
	expected, err := base64.RawStdEncoding.DecodeString(parts[3])
	if err != nil {
		return false
	}
	actual := pbkdf2SHA256([]byte(password), salt, iterations, len(expected))
	return hmac.Equal(actual, expected)
}

func pbkdf2SHA256(password, salt []byte, iterations, keyLen int) []byte {
	hLen := 32
	numBlocks := (keyLen + hLen - 1) / hLen
	var out []byte
	for block := 1; block <= numBlocks; block++ {
		u := hmacSHA256(password, append(salt, byte(block>>24), byte(block>>16), byte(block>>8), byte(block)))
		t := make([]byte, len(u))
		copy(t, u)
		for i := 1; i < iterations; i++ {
			u = hmacSHA256(password, u)
			for j := range t {
				t[j] ^= u[j]
			}
		}
		out = append(out, t...)
	}
	return out[:keyLen]
}

func hmacSHA256(key, data []byte) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write(data)
	return mac.Sum(nil)
}

func (a *App) handleStatic(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") {
		http.NotFound(w, r)
		return
	}
	path := filepath.Join(a.cfg.StaticDir, filepath.Clean(r.URL.Path))
	if r.URL.Path == "/" || !fileExists(path) {
		path = filepath.Join(a.cfg.StaticDir, "index.html")
	}
	http.ServeFile(w, r, path)
}

func fileExists(path string) bool {
	st, err := os.Stat(path)
	return err == nil && !st.IsDir()
}

func writeJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(value)
}

func readJSON(r *http.Request, value any) error {
	defer r.Body.Close()
	return json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(value)
}

func badRequest(w http.ResponseWriter, detail string) {
	http.Error(w, fmt.Sprintf(`{"detail":%q}`, detail), http.StatusBadRequest)
}

func serverError(w http.ResponseWriter, err error) {
	log.Printf("error: %v", err)
	http.Error(w, fmt.Sprintf(`{"detail":%q}`, err.Error()), http.StatusInternalServerError)
}

func methodNotAllowed(w http.ResponseWriter) {
	http.Error(w, `{"detail":"method not allowed"}`, http.StatusMethodNotAllowed)
}

func intQuery(r *http.Request, key string, fallback int) int {
	if v, err := strconv.Atoi(r.URL.Query().Get(key)); err == nil {
		return v
	}
	return fallback
}

func queryDefault(r *http.Request, key, fallback string) string {
	if v := strings.TrimSpace(r.URL.Query().Get(key)); v != "" {
		return v
	}
	return fallback
}
