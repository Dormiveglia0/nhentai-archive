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
	"syscall"
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
	mux.HandleFunc("/api/account/password", a.auth(a.handlePasswordChange))
	mux.HandleFunc("/api/status", a.auth(a.handleStatus))
	mux.HandleFunc("/api/settings", a.auth(a.handleSettings))
	mux.HandleFunc("/api/settings/export", a.auth(a.handleSettingsExport))
	mux.HandleFunc("/api/settings/secrets", a.auth(a.handleSecrets))
	mux.HandleFunc("/api/settings/test-connection", a.auth(a.handleTestConnection))
	mux.HandleFunc("/api/logs", a.auth(a.handleLogs))
	mux.HandleFunc("/api/images/proxy", a.auth(a.handleImageProxy))
	mux.HandleFunc("/api/sources/nhentai/search", a.auth(a.handleSourceSearch))
	mux.HandleFunc("/api/sources/nhentai/test", a.auth(a.handleTestConnection))
	mux.HandleFunc("/api/sources/nhentai/galleries/", a.auth(a.handleSourceGalleryPath))
	mux.HandleFunc("/api/local/upload", a.auth(a.handleLocalUpload))
	mux.HandleFunc("/api/local/scan", a.auth(a.handleLocalScan))
	mux.HandleFunc("/api/local/scan/status", a.auth(a.handleLocalScanStatus))
	mux.HandleFunc("/api/works", a.auth(a.handleWorks))
	mux.HandleFunc("/api/works/", a.auth(a.handleWorkPath))
	mux.HandleFunc("/api/exports", a.auth(a.handleExports))
	mux.HandleFunc("/api/exports/", a.auth(a.handleExportPath))
	mux.HandleFunc("/api/search", a.auth(a.handleSearch))
	mux.HandleFunc("/api/discover/popular", a.auth(a.handlePopular))
	mux.HandleFunc("/api/tags/resolve", a.auth(a.handleTagResolve))
	mux.HandleFunc("/api/tags/galleries", a.auth(a.handleTagged))
	mux.HandleFunc("/api/tasks/import", a.auth(a.handleImport))
	mux.HandleFunc("/api/tasks/retry-failed", a.auth(a.handleRetryFailedTasks))
	mux.HandleFunc("/api/tasks/clear-completed", a.auth(a.handleClearCompletedTasks))
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
  type TEXT NOT NULL DEFAULT 'import',
  status TEXT NOT NULL,
  gallery_id INTEGER UNIQUE,
  work_id INTEGER,
  title TEXT,
  cover_url TEXT,
  language TEXT,
  error TEXT,
  message TEXT,
  current_step TEXT,
  progress_current INTEGER NOT NULL DEFAULT 0,
  progress_total INTEGER NOT NULL DEFAULT 0,
  progress INTEGER NOT NULL DEFAULT 0,
  cbz_path TEXT,
  raw_json TEXT,
  translated_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  finished_at TEXT
);
CREATE TABLE IF NOT EXISTS works (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_id TEXT,
  media_id TEXT,
  display_title TEXT NOT NULL,
  status TEXT NOT NULL,
  local_cbz_path TEXT,
  cover_path TEXT,
  file_hash TEXT,
  page_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_type, source_id),
  UNIQUE(file_hash)
);
CREATE TABLE IF NOT EXISTS work_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  file_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(work_id) REFERENCES works(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS work_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  metadata_type TEXT NOT NULL,
  comic_info_json TEXT,
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(work_id, metadata_type),
  FOREIGN KEY(work_id) REFERENCES works(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS work_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  remote_id INTEGER,
  type TEXT NOT NULL DEFAULT 'other',
  original_name TEXT NOT NULL,
  dictionary_value TEXT,
  machine_suggestion TEXT,
  final_value TEXT,
  final_source TEXT NOT NULL DEFAULT 'original',
  is_confirmed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(work_id) REFERENCES works(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(work_id) REFERENCES works(id) ON DELETE CASCADE
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
CREATE TABLE IF NOT EXISTS dictionary_ignored_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
CREATE TABLE IF NOT EXISTS maintenance_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,
  action TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`)
	if err != nil {
		return err
	}
	if err := a.migrateTasksTable(); err != nil {
		return err
	}
	defaults := map[string]string{
		"translate_tags":       "true",
		"translate_titles":     "false",
		"translation_provider": "google_free_gtx",
		"nhentai_user_agent":   a.cfg.DefaultUserAgent,
		"library_import_dir":   filepath.Join(a.cfg.LibraryDir, "imports"),
		"library_export_dir":   filepath.Join(a.cfg.LibraryDir, "exports"),
		"cover_cache_dir":      filepath.Join(a.cfg.LibraryDir, "covers"),
		"export_pattern":       "{id} - {title}.cbz",
		"tag_separator":        ", ",
		"keep_meta_json":       "true",
		"update_meta_json":     "false",
	}
	for k, v := range defaults {
		if _, err := a.db.Exec("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)", k, v); err != nil {
			return err
		}
	}
	return nil
}

func (a *App) migrateTasksTable() error {
	cols := map[string]bool{}
	var galleryNotNull bool
	rows, err := a.db.Query("PRAGMA table_info(tasks)")
	if err != nil {
		return err
	}
	for rows.Next() {
		var cid int
		var name, typ string
		var notNull int
		var defaultValue any
		var pk int
		if err := rows.Scan(&cid, &name, &typ, &notNull, &defaultValue, &pk); err != nil {
			rows.Close()
			return err
		}
		cols[name] = true
		if name == "gallery_id" && notNull == 1 {
			galleryNotNull = true
		}
	}
	if err := rows.Close(); err != nil {
		return err
	}
	if cols["type"] && cols["work_id"] && !galleryNotNull {
		return nil
	}
	old := "tasks_legacy_" + strconv.FormatInt(time.Now().UnixNano(), 10)
	if _, err := a.db.Exec("ALTER TABLE tasks RENAME TO " + old); err != nil {
		return err
	}
	if _, err := a.db.Exec(`
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'import',
  status TEXT NOT NULL,
  gallery_id INTEGER UNIQUE,
  work_id INTEGER,
  title TEXT,
  cover_url TEXT,
  language TEXT,
  error TEXT,
  message TEXT,
  current_step TEXT,
  progress_current INTEGER NOT NULL DEFAULT 0,
  progress_total INTEGER NOT NULL DEFAULT 0,
  progress INTEGER NOT NULL DEFAULT 0,
  cbz_path TEXT,
  raw_json TEXT,
  translated_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  finished_at TEXT
)`); err != nil {
		return err
	}
	_, err = a.db.Exec(fmt.Sprintf(`
INSERT INTO tasks(id,type,status,gallery_id,title,cover_url,language,error,progress_current,progress_total,progress,cbz_path,raw_json,translated_json,created_at,updated_at,finished_at)
SELECT id,'import',status,gallery_id,title,cover_url,language,error,progress_current,progress_total,
  CASE WHEN progress_total>0 THEN CAST(progress_current * 100 / progress_total AS INTEGER) ELSE 0 END,
  cbz_path,raw_json,translated_json,created_at,updated_at,
  CASE WHEN status IN ('completed','success','failed') THEN updated_at ELSE NULL END
FROM %s`, old))
	return err
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
	if body.Username == "" || body.Password == "" {
		badRequest(w, "username and password are required")
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

func (a *App) handlePasswordChange(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	username, ok := a.sessionUser(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	if !ok {
		http.Error(w, `{"detail":"invalid token"}`, http.StatusUnauthorized)
		return
	}
	var body struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := readJSON(r, &body); err != nil {
		badRequest(w, err.Error())
		return
	}
	if body.NewPassword == "" {
		badRequest(w, "new password is required")
		return
	}
	var hash string
	if err := a.db.QueryRow("SELECT password_hash FROM admins WHERE username=?", username).Scan(&hash); err != nil {
		http.Error(w, `{"detail":"admin not found"}`, http.StatusNotFound)
		return
	}
	if !verifyPassword(body.CurrentPassword, hash) {
		http.Error(w, `{"detail":"current password is incorrect"}`, http.StatusUnauthorized)
		return
	}
	nextHash, err := hashPassword(body.NewPassword)
	if err != nil {
		serverError(w, err)
		return
	}
	if _, err := a.db.Exec("UPDATE admins SET password_hash=? WHERE username=?", nextHash, username); err != nil {
		serverError(w, err)
		return
	}
	current := hashToken(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	_, _ = a.db.Exec("DELETE FROM sessions WHERE username=? AND token_hash<>?", username, current)
	writeJSON(w, map[string]string{"status": "updated"})
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
			"library_import_dir":   settings["library_import_dir"],
			"library_export_dir":   settings["library_export_dir"],
			"cover_cache_dir":      settings["cover_cache_dir"],
			"export_pattern":       settings["export_pattern"],
			"tag_separator":        settings["tag_separator"],
			"keep_meta_json":       settings["keep_meta_json"] == "true",
			"update_meta_json":     settings["update_meta_json"] == "true",
		})
	case http.MethodPatch:
		var body map[string]any
		if err := readJSON(r, &body); err != nil {
			badRequest(w, err.Error())
			return
		}
		allowed := map[string]bool{
			"translate_tags": true, "translate_titles": true, "translation_provider": true, "nhentai_user_agent": true,
			"library_import_dir": true, "library_export_dir": true, "cover_cache_dir": true, "export_pattern": true,
			"tag_separator": true, "keep_meta_json": true, "update_meta_json": true,
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
		a.logEvent("info", "settings_saved", fmt.Sprintf("keys=%d", len(body)))
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
	a.logEvent("info", "secrets_saved", fmt.Sprintf("keys=%d", len(body)))
	writeJSON(w, map[string]any{"secrets": a.secretStatuses()})
}

func (a *App) handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	settings, _ := a.settingsMap()
	queued, downloading, completed, failed := a.taskCounts()
	free, total := diskUsage(a.cfg.LibraryDir)
	writeJSON(w, map[string]any{
		"uptime_seconds": int(time.Since(a.started).Seconds()),
		"api": map[string]any{
			"user_agent":     settings["nhentai_user_agent"],
			"key_configured": a.getSecret("nhentai_api_key") != "",
		},
		"cdn": a.client.cachedCDNStatus(),
		"translation": map[string]any{
			"provider": settings["translation_provider"],
			"deepl":    a.getSecret("deepl_api_key") != "",
			"google":   a.getSecret("google_translate_api_key") != "",
		},
		"storage": map[string]any{
			"library_dir": a.cfg.LibraryDir,
			"free_bytes":  free,
			"total_bytes": total,
		},
		"worker": map[string]any{
			"queued": queued, "downloading": downloading, "completed": completed, "failed": failed,
		},
	})
}

func (a *App) handleTestConnection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		NHentaiUserAgent string `json:"nhentai_user_agent"`
		NHentaiAPIKey    string `json:"nhentai_api_key"`
	}
	if r.Body != nil {
		if err := readJSON(r, &body); err != nil && !errors.Is(err, io.EOF) {
			badRequest(w, err.Error())
			return
		}
	}
	ctx, cancel := context.WithTimeout(r.Context(), a.cfg.RequestTimeout)
	defer cancel()
	opts := remoteRequestOptions{
		UserAgent: strings.TrimSpace(body.NHentaiUserAgent),
		APIKey:    strings.TrimSpace(body.NHentaiAPIKey),
	}
	effectiveKey := opts.APIKey
	if effectiveKey == "" {
		effectiveKey = a.getSecret("nhentai_api_key")
	}
	apiRoot := connectionCheck{OK: true, Detail: "API v2 reachable"}
	if _, err := a.client.requestWithOptions(ctx, http.MethodGet, "/api/v2", nil, nil, opts); err != nil {
		apiRoot = connectionCheck{OK: false, Detail: err.Error()}
	}
	authKey := connectionCheck{OK: false, Detail: "API key is not configured"}
	if effectiveKey != "" {
		authKey = connectionCheck{OK: true, Detail: "API key accepted"}
		if _, err := a.client.requestWithOptions(ctx, http.MethodGet, "/api/v2/user", nil, nil, opts); err != nil {
			authKey = connectionCheck{OK: false, Detail: err.Error()}
		}
	}
	cdnCfg, cdnErr := a.client.cdnWithOptions(ctx, opts, false)
	cdnOK := len(cdnCfg.ImageServers) > 0 || len(cdnCfg.ThumbServers) > 0
	cdnDetail := "CDN available"
	if !cdnOK {
		cdnDetail = "no CDN servers returned"
	}
	if cdnErr != nil {
		cdnDetail = cdnErr.Error()
	}
	a.logEvent("info", "connection_test", fmt.Sprintf("api_root=%t auth_key=%t cdn=%t", apiRoot.OK, authKey.OK, cdnOK))
	writeJSON(w, map[string]any{
		"api_root": apiRoot,
		"auth_key": authKey,
		"cdn":      map[string]any{"ok": cdnOK, "detail": cdnDetail, "servers": cdnCfg.ImageServers, "image_servers": cdnCfg.ImageServers, "thumb_servers": cdnCfg.ThumbServers},
	})
}

type connectionCheck struct {
	OK     bool   `json:"ok"`
	Detail string `json:"detail"`
}

func (a *App) handleSettingsExport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	settings, err := a.settingsMap()
	if err != nil {
		serverError(w, err)
		return
	}
	w.Header().Set("Content-Disposition", `attachment; filename="nh-archive-config.json"`)
	writeJSON(w, map[string]any{
		"version":     "go-single-service",
		"exported_at": time.Now().UTC().Format(time.RFC3339),
		"settings": map[string]any{
			"translate_tags":       settings["translate_tags"] == "true",
			"translate_titles":     settings["translate_titles"] == "true",
			"translation_provider": settings["translation_provider"],
			"nhentai_user_agent":   settings["nhentai_user_agent"],
			"library_dir":          a.cfg.LibraryDir,
			"library_import_dir":   settings["library_import_dir"],
			"library_export_dir":   settings["library_export_dir"],
			"cover_cache_dir":      settings["cover_cache_dir"],
			"export_pattern":       settings["export_pattern"],
			"tag_separator":        settings["tag_separator"],
			"keep_meta_json":       settings["keep_meta_json"] == "true",
			"update_meta_json":     settings["update_meta_json"] == "true",
		},
		"secrets": a.secretStatuses(),
	})
}

func (a *App) handleLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	events := []map[string]any{}
	rows, err := a.db.Query("SELECT id,level,action,message,created_at FROM maintenance_events ORDER BY id DESC LIMIT 100")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id int
			var level, action, message, created string
			if err := rows.Scan(&id, &level, &action, &message, &created); err == nil {
				events = append(events, map[string]any{"id": id, "level": level, "action": action, "message": message, "created_at": created})
			}
		}
	}
	taskErrors := []map[string]any{}
	errorRows, err := a.db.Query("SELECT id,gallery_id,error,updated_at FROM tasks WHERE error IS NOT NULL AND error<>'' ORDER BY updated_at DESC LIMIT 50")
	if err == nil {
		defer errorRows.Close()
		for errorRows.Next() {
			var id, galleryID int
			var message, updated string
			if err := errorRows.Scan(&id, &galleryID, &message, &updated); err == nil {
				taskErrors = append(taskErrors, map[string]any{"task_id": id, "gallery_id": galleryID, "message": message, "updated_at": updated})
			}
		}
	}
	writeJSON(w, map[string]any{"events": events, "task_errors": taskErrors})
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
		a.logEvent("error", "search_failed", fmt.Sprintf("query=%q page=%d sort=%s error=%s", q, page, sortBy, err.Error()))
		serverError(w, err)
		return
	}
	if result, ok := resp["result"].([]GallerySummary); ok {
		missing := 0
		for _, gallery := range result {
			if gallery.CoverURL == "" && gallery.ThumbURL == "" {
				missing++
			}
		}
		a.logEvent("info", "search", fmt.Sprintf("query=%q page=%d sort=%s results=%d missing_images=%d", q, page, sortBy, len(result), missing))
	}
	writeJSON(w, resp)
}

func (a *App) handlePopular(w http.ResponseWriter, r *http.Request) {
	resp, err := a.client.Popular(r.Context())
	if err != nil {
		a.logEvent("error", "popular_failed", err.Error())
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

func (a *App) handleSourceSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		q = strings.TrimSpace(r.URL.Query().Get("query"))
	}
	if q == "" {
		badRequest(w, "q is required")
		return
	}
	page := intQuery(r, "page", 1)
	sortBy := queryDefault(r, "sort", "date")
	resp, err := a.client.Search(r.Context(), q, page, sortBy)
	if err != nil {
		a.logEvent("error", "source_search_failed", fmt.Sprintf("query=%q page=%d error=%s", q, page, err.Error()))
		serverError(w, err)
		return
	}
	writeJSON(w, resp)
}

func (a *App) handleSourceGalleryPath(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/sources/nhentai/galleries/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	id, err := strconv.Atoi(parts[0])
	if err != nil || id <= 0 {
		http.NotFound(w, r)
		return
	}
	action := ""
	if len(parts) > 1 {
		action = parts[1]
	}
	switch action {
	case "":
		if r.Method != http.MethodGet {
			methodNotAllowed(w)
			return
		}
		gallery, err := a.client.Gallery(r.Context(), id)
		if err != nil {
			a.logEvent("error", "source_gallery_failed", fmt.Sprintf("gallery_id=%d error=%s", id, err.Error()))
			serverError(w, err)
			return
		}
		cdnCfg := a.client.CDNConfig(r.Context())
		summary := normalizeGallery(gallery, firstOf(cdnCfg.ImageServers), firstOf(cdnCfg.ThumbServers))
		writeJSON(w, map[string]any{"gallery": summary, "raw": gallery, "already_imported": a.workIDBySource("nhentai", strconv.Itoa(id)) > 0})
	case "import":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		a.importGalleryIDs(w, []int{id})
	case "related":
		if r.Method != http.MethodGet {
			methodNotAllowed(w)
			return
		}
		resp, err := a.client.Related(r.Context(), id)
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, resp)
	default:
		http.NotFound(w, r)
	}
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
	a.importGalleryIDs(w, body.IDs)
}

func (a *App) importGalleryIDs(w http.ResponseWriter, ids []int) {
	seen := map[int]bool{}
	added, existing, retried, ignored := 0, 0, 0, 0
	importErrors := []map[string]any{}
	for _, id := range ids {
		if id <= 0 || seen[id] {
			ignored++
			importErrors = append(importErrors, map[string]any{"id": id, "error": "invalid or duplicate gallery ID"})
			a.logEvent("warn", "import_ignored", fmt.Sprintf("gallery_id=%d reason=invalid_or_duplicate", id))
			continue
		}
		seen[id] = true
		var status string
		err := a.db.QueryRow("SELECT status FROM tasks WHERE gallery_id=?", id).Scan(&status)
		action := ""
		switch {
		case errors.Is(err, sql.ErrNoRows):
			action = "added"
		case err != nil:
			a.logEvent("error", "import_failed", fmt.Sprintf("gallery_id=%d error=%s", id, err.Error()))
			serverError(w, err)
			return
		case status == "failed":
			action = "retried"
		default:
			action = "existing"
		}
		_, err = a.db.Exec(`
INSERT INTO tasks(gallery_id,status) VALUES(?, 'queued')
ON CONFLICT(gallery_id) DO UPDATE SET
  type='import',
  status=CASE WHEN tasks.status='failed' THEN 'queued' ELSE tasks.status END,
  error=NULL,
  message=NULL,
  current_step=CASE WHEN tasks.status='failed' THEN '等待重试' ELSE tasks.current_step END,
  updated_at=CURRENT_TIMESTAMP`, id)
		if err != nil {
			a.logEvent("error", "import_failed", fmt.Sprintf("gallery_id=%d error=%s", id, err.Error()))
			serverError(w, err)
			return
		}
		switch action {
		case "added":
			added++
		case "retried":
			retried++
		default:
			existing++
		}
		a.logEvent("info", "import_"+action, fmt.Sprintf("gallery_id=%d", id))
	}
	writeJSON(w, map[string]any{
		"tasks":    a.queryTasks(),
		"added":    added,
		"existing": existing,
		"retried":  retried,
		"ignored":  ignored,
		"errors":   importErrors,
	})
}

type Work struct {
	ID                  int              `json:"id"`
	SourceType          string           `json:"source_type"`
	SourceID            string           `json:"source_id"`
	MediaID             string           `json:"media_id"`
	DisplayTitle        string           `json:"display_title"`
	Status              string           `json:"status"`
	LocalCBZPath        string           `json:"local_cbz_path"`
	CoverPath           string           `json:"cover_path"`
	CoverURL            string           `json:"cover_url"`
	FileHash            string           `json:"file_hash"`
	PageCount           int              `json:"page_count"`
	TagCount            int              `json:"tag_count"`
	UnconfirmedTagCount int              `json:"unconfirmed_tag_count"`
	ExportCount         int              `json:"export_count"`
	TagPreview          []WorkTagPreview `json:"tag_preview"`
	CreatedAt           string           `json:"created_at"`
	UpdatedAt           string           `json:"updated_at"`
}

type WorkTagPreview struct {
	Type      string `json:"type"`
	Value     string `json:"value"`
	Confirmed bool   `json:"confirmed"`
}

type WorkTag struct {
	ID                int    `json:"id"`
	WorkID            int    `json:"work_id"`
	RemoteID          int    `json:"remote_id"`
	Type              string `json:"type"`
	OriginalName      string `json:"original_name"`
	DictionaryValue   string `json:"dictionary_value"`
	MachineSuggestion string `json:"machine_suggestion"`
	FinalValue        string `json:"final_value"`
	FinalSource       string `json:"final_source"`
	IsConfirmed       bool   `json:"is_confirmed"`
}

type ParsedArchive struct {
	Path          string
	Hash          string
	Size          int64
	PageCount     int
	CoverPath     string
	ComicInfo     ComicInfo
	ComicInfoJSON map[string]any
	MetaJSONRaw   string
	MetaJSON      map[string]any
	Images        []string
}

func (a *App) handleWorks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, map[string]any{"works": a.queryWorks(r), "summary": a.librarySummary()})
	case http.MethodPost:
		badRequest(w, "create works through import, upload or scan")
	default:
		methodNotAllowed(w)
	}
}

func (a *App) handleWorkPath(w http.ResponseWriter, r *http.Request) {
	rest := strings.TrimPrefix(r.URL.Path, "/api/works/")
	if rest == "bulk-action" {
		a.handleWorksBulkAction(w, r)
		return
	}
	parts := strings.Split(strings.Trim(rest, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	workID, err := strconv.Atoi(parts[0])
	if err != nil || workID <= 0 {
		http.NotFound(w, r)
		return
	}
	action := ""
	if len(parts) > 1 {
		action = parts[1]
	}
	switch action {
	case "":
		switch r.Method {
		case http.MethodGet:
			work := a.getWork(workID)
			if work.ID == 0 {
				http.NotFound(w, r)
				return
			}
			writeJSON(w, map[string]any{"work": work, "metadata": a.workMetadata(workID), "tags": a.workTags(workID), "exports": a.workExports(workID)})
		case http.MethodPatch:
			var body map[string]any
			if err := readJSON(r, &body); err != nil {
				badRequest(w, err.Error())
				return
			}
			title := strings.TrimSpace(stringValue(body["display_title"]))
			status := strings.TrimSpace(stringValue(body["status"]))
			if title != "" {
				_, _ = a.db.Exec("UPDATE works SET display_title=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", title, workID)
			}
			if status != "" {
				_, _ = a.db.Exec("UPDATE works SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", status, workID)
			}
			writeJSON(w, a.getWork(workID))
		case http.MethodDelete:
			_, _ = a.db.Exec("DELETE FROM works WHERE id=?", workID)
			a.logEvent("info", "work_deleted", fmt.Sprintf("work_id=%d", workID))
			writeJSON(w, map[string]string{"status": "deleted"})
		default:
			methodNotAllowed(w)
		}
	case "cover":
		a.serveWorkCover(w, r, workID)
	case "refresh-cover", "reparse":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		work := a.getWork(workID)
		if work.ID == 0 || work.LocalCBZPath == "" {
			http.NotFound(w, r)
			return
		}
		parsed, err := a.parseArchive(work.LocalCBZPath)
		if err != nil {
			serverError(w, err)
			return
		}
		_, err = a.saveParsedWork(work.SourceType, work.SourceID, work.MediaID, parsed, nil)
		if err != nil {
			serverError(w, err)
			return
		}
		a.logEvent("info", action, fmt.Sprintf("work_id=%d", workID))
		writeJSON(w, a.getWork(workID))
	case "metadata":
		a.handleWorkMetadata(w, r, workID, parts[2:])
	case "tags":
		a.handleWorkTags(w, r, workID, parts[2:])
	case "translation":
		a.handleWorkTranslation(w, r, workID, parts[2:])
	case "export":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		exportID, err := a.exportWork(workID)
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, map[string]any{"export": a.getExport(exportID)})
	case "exports":
		if r.Method != http.MethodGet {
			methodNotAllowed(w)
			return
		}
		writeJSON(w, map[string]any{"exports": a.workExports(workID)})
	default:
		http.NotFound(w, r)
	}
}

func (a *App) handleLocalUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if err := r.ParseMultipartForm(128 << 20); err != nil {
		badRequest(w, "upload must be multipart/form-data")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		badRequest(w, "file is required")
		return
	}
	defer file.Close()
	if !isArchiveName(header.Filename) {
		badRequest(w, "only cbz and zip files are supported")
		return
	}
	importDir := a.settingValue("library_import_dir", filepath.Join(a.cfg.LibraryDir, "imports"))
	if err := os.MkdirAll(importDir, 0o755); err != nil {
		serverError(w, err)
		return
	}
	target := filepath.Join(importDir, safeFilename(header.Filename))
	out, err := os.Create(target)
	if err != nil {
		serverError(w, err)
		return
	}
	if _, err := io.Copy(out, file); err != nil {
		out.Close()
		serverError(w, err)
		return
	}
	if err := out.Close(); err != nil {
		serverError(w, err)
		return
	}
	parsed, err := a.parseArchive(target)
	if err != nil {
		a.logEvent("error", "local_upload_failed", err.Error())
		serverError(w, fmt.Errorf("CBZ parse failed: file may be corrupted or unsupported: %w", err))
		return
	}
	workID, err := a.saveParsedWork("local", parsed.Hash, "", parsed, nil)
	if err != nil {
		serverError(w, err)
		return
	}
	a.insertTask("local_upload", "success", workID, 0, parsed.ComicInfo.Title, "Ready for editing", "")
	a.logEvent("info", "local_upload", fmt.Sprintf("work_id=%d file=%s", workID, header.Filename))
	writeJSON(w, map[string]any{"work": a.getWork(workID), "task": "success"})
}

func (a *App) handleLocalScan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		Directory string `json:"directory"`
	}
	_ = readJSON(r, &body)
	dir := strings.TrimSpace(body.Directory)
	if dir == "" {
		dir = a.settingValue("library_import_dir", filepath.Join(a.cfg.LibraryDir, "imports"))
	}
	counts := map[string]int{"created": 0, "updated": 0, "failed": 0}
	var errorsOut []map[string]string
	err := filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !isArchiveName(path) {
			return nil
		}
		parsed, err := a.parseArchive(path)
		if err != nil {
			counts["failed"]++
			errorsOut = append(errorsOut, map[string]string{"path": path, "error": err.Error()})
			return nil
		}
		existing := a.workIDByHash(parsed.Hash)
		workID, err := a.saveParsedWork("local", parsed.Hash, "", parsed, nil)
		if err != nil {
			counts["failed"]++
			errorsOut = append(errorsOut, map[string]string{"path": path, "error": err.Error()})
			return nil
		}
		if existing > 0 {
			counts["updated"]++
		} else {
			counts["created"]++
		}
		a.insertTask("scan", "success", workID, 0, parsed.ComicInfo.Title, "Ready for editing", "")
		return nil
	})
	if err != nil {
		serverError(w, err)
		return
	}
	a.logEvent("info", "local_scan", fmt.Sprintf("dir=%s created=%d updated=%d failed=%d", dir, counts["created"], counts["updated"], counts["failed"]))
	writeJSON(w, map[string]any{"status": "complete", "directory": dir, "counts": counts, "errors": errorsOut})
}

func (a *App) handleLocalScanStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	writeJSON(w, map[string]any{"status": "idle", "directory": a.settingValue("library_import_dir", filepath.Join(a.cfg.LibraryDir, "imports"))})
}

func (a *App) handleTasks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	writeJSON(w, a.queryTasks())
}

func (a *App) handleRetryFailedTasks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	res, err := a.db.Exec("UPDATE tasks SET status='queued',error=NULL,message=NULL,progress_current=0,progress=0,finished_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE status='failed'")
	if err != nil {
		serverError(w, err)
		return
	}
	count, _ := res.RowsAffected()
	a.logEvent("info", "retry_failed", fmt.Sprintf("requeued %d failed tasks", count))
	writeJSON(w, map[string]any{"status": "queued", "count": count, "tasks": a.queryTasks()})
}

func (a *App) handleClearCompletedTasks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	res, err := a.db.Exec("DELETE FROM tasks WHERE status IN ('completed','success')")
	if err != nil {
		serverError(w, err)
		return
	}
	count, _ := res.RowsAffected()
	a.logEvent("info", "clear_completed", fmt.Sprintf("cleared %d completed task records", count))
	writeJSON(w, map[string]any{"status": "cleared", "count": count, "tasks": a.queryTasks()})
}

func (a *App) logEvent(level, action, message string) {
	_, _ = a.db.Exec("INSERT INTO maintenance_events(level,action,message) VALUES(?,?,?)", level, action, message)
}

func (a *App) handleImageProxy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	raw := strings.TrimSpace(r.URL.Query().Get("url"))
	if raw == "" {
		badRequest(w, "url is required")
		return
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		badRequest(w, "only http and https image URLs are supported")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), a.cfg.RequestTimeout)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	req.Header.Set("User-Agent", a.client.setting("nhentai_user_agent", a.cfg.DefaultUserAgent))
	req.Header.Set("Referer", "https://nhentai.net/")
	resp, err := a.client.client.Do(req)
	if err != nil {
		a.logEvent("error", "image_proxy_failed", fmt.Sprintf("host=%s error=%s", parsed.Host, err.Error()))
		serverError(w, fmt.Errorf("image proxy failed: %w", err))
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		a.logEvent("error", "image_proxy_failed", fmt.Sprintf("host=%s status=%s", parsed.Host, resp.Status))
		http.Error(w, fmt.Sprintf(`{"detail":"image proxy failed: %s"}`, resp.Status), http.StatusBadGateway)
		return
	}
	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "private, max-age=3600")
	_, _ = io.Copy(w, resp.Body)
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
		_, err := a.db.Exec("UPDATE tasks SET status='queued',error=NULL,message=NULL,progress_current=0,progress=0,finished_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?", taskID)
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
	out := []map[string]any{}
	rows, err := a.db.Query("SELECT id,type,status,gallery_id,work_id,title,cover_url,language,error,message,current_step,progress_current,progress_total,progress,cbz_path,created_at,updated_at,started_at,finished_at FROM tasks ORDER BY created_at DESC")
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var id, cur, total, progress int
		var status, taskType string
		var gid, workID sql.NullInt64
		var title, cover, language, errText, message, step, cbz, created, updated, started, finished sql.NullString
		_ = rows.Scan(&id, &taskType, &status, &gid, &workID, &title, &cover, &language, &errText, &message, &step, &cur, &total, &progress, &cbz, &created, &updated, &started, &finished)
		out = append(out, map[string]any{
			"id": id, "type": taskType, "gallery_id": nullableInt(gid), "work_id": nullableInt(workID), "status": status, "title": nullable(title), "cover_url": nullable(cover), "language": nullable(language),
			"error": nullable(errText), "message": nullable(message), "current_step": nullable(step), "progress_current": cur, "progress_total": total, "progress": progress, "cbz_path": nullable(cbz), "created_at": nullable(created), "updated_at": nullable(updated), "started_at": nullable(started), "finished_at": nullable(finished),
		})
	}
	return out
}

func (a *App) taskCounts() (int, int, int, int) {
	counts := map[string]int{}
	rows, err := a.db.Query("SELECT status, COUNT(*) FROM tasks GROUP BY status")
	if err != nil {
		return 0, 0, 0, 0
	}
	defer rows.Close()
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err == nil {
			counts[status] = count
		}
	}
	return counts["queued"], counts["downloading"] + counts["running"], counts["completed"] + counts["success"], counts["failed"]
}

func (a *App) getTask(id int) map[string]any {
	var cur, total, progress int
	var status, taskType string
	var gid, workID sql.NullInt64
	var title, cover, language, errText, message, step, cbz, raw, trans, created, updated, started, finished sql.NullString
	err := a.db.QueryRow("SELECT type,status,gallery_id,work_id,title,cover_url,language,error,message,current_step,progress_current,progress_total,progress,cbz_path,raw_json,translated_json,created_at,updated_at,started_at,finished_at FROM tasks WHERE id=?", id).Scan(&taskType, &status, &gid, &workID, &title, &cover, &language, &errText, &message, &step, &cur, &total, &progress, &cbz, &raw, &trans, &created, &updated, &started, &finished)
	if err != nil {
		return map[string]any{}
	}
	return map[string]any{"id": id, "type": taskType, "gallery_id": nullableInt(gid), "work_id": nullableInt(workID), "status": status, "title": nullable(title), "cover_url": nullable(cover), "language": nullable(language), "error": nullable(errText), "message": nullable(message), "current_step": nullable(step), "progress_current": cur, "progress_total": total, "progress": progress, "cbz_path": nullable(cbz), "raw_json": nullable(raw), "translated_json": nullable(trans), "created_at": nullable(created), "updated_at": nullable(updated), "started_at": nullable(started), "finished_at": nullable(finished)}
}

func nullable(v sql.NullString) any {
	if !v.Valid {
		return nil
	}
	return v.String
}

func nullableInt(v sql.NullInt64) any {
	if !v.Valid {
		return nil
	}
	return v.Int64
}

func (a *App) settingValue(key, fallback string) string {
	settings, _ := a.settingsMap()
	if v := strings.TrimSpace(settings[key]); v != "" {
		return v
	}
	return fallback
}

func (a *App) insertTask(taskType, status string, workID, galleryID int, title, message, errText string) int {
	var work, gallery any
	if workID > 0 {
		work = workID
	}
	if galleryID > 0 {
		gallery = galleryID
	}
	res, err := a.db.Exec(`
INSERT INTO tasks(type,status,work_id,gallery_id,title,message,error,current_step,progress,progress_current,progress_total,started_at,finished_at)
VALUES(?,?,?,?,?,?,?,?,100,1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, taskType, status, work, gallery, nullIfEmpty(title), nullIfEmpty(message), nullIfEmpty(errText), nullIfEmpty(message))
	if err != nil {
		return 0
	}
	id, _ := res.LastInsertId()
	return int(id)
}

func nullIfEmpty(v string) any {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	return v
}

func isArchiveName(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	return ext == ".cbz" || ext == ".zip"
}

func (a *App) parseArchive(path string) (ParsedArchive, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return ParsedArchive{}, err
	}
	stat, err := os.Stat(abs)
	if err != nil {
		return ParsedArchive{}, err
	}
	sum, err := fileSHA256(abs)
	if err != nil {
		return ParsedArchive{}, err
	}
	reader, err := zip.OpenReader(abs)
	if err != nil {
		return ParsedArchive{}, err
	}
	defer reader.Close()
	parsed := ParsedArchive{Path: abs, Hash: sum, Size: stat.Size(), ComicInfoJSON: map[string]any{}, MetaJSON: map[string]any{}}
	var coverCandidate *zip.File
	var firstImage *zip.File
	for _, f := range reader.File {
		if f.FileInfo().IsDir() {
			continue
		}
		name := strings.TrimLeft(f.Name, "/")
		lower := strings.ToLower(filepath.Base(name))
		switch {
		case strings.EqualFold(name, "ComicInfo.xml") || lower == "comicinfo.xml":
			content, err := readZipText(f, 2<<20)
			if err != nil {
				return ParsedArchive{}, err
			}
			var info ComicInfo
			if err := xml.Unmarshal([]byte(content), &info); err == nil {
				parsed.ComicInfo = info
				parsed.ComicInfoJSON = comicInfoMap(info)
			}
		case lower == "meta.json":
			content, err := readZipText(f, 4<<20)
			if err != nil {
				return ParsedArchive{}, err
			}
			parsed.MetaJSONRaw = content
			_ = json.Unmarshal([]byte(content), &parsed.MetaJSON)
		case isImageFile(name):
			parsed.Images = append(parsed.Images, name)
			if firstImage == nil {
				firstImage = f
			}
			if lower == "cover.jpg" || lower == "cover.jpeg" || lower == "cover.png" || lower == "cover.webp" {
				coverCandidate = f
			}
		}
	}
	sort.Strings(parsed.Images)
	parsed.PageCount = len(parsed.Images)
	if parsed.ComicInfo.PageCount == 0 {
		parsed.ComicInfo.PageCount = parsed.PageCount
	}
	if parsed.ComicInfo.Title == "" {
		parsed.ComicInfo = fillComicInfoFromMeta(parsed.ComicInfo, parsed.MetaJSON)
	}
	if parsed.ComicInfo.Title == "" {
		parsed.ComicInfo.Title = strings.TrimSuffix(filepath.Base(abs), filepath.Ext(abs))
	}
	if len(parsed.ComicInfoJSON) == 0 || stringValue(parsed.ComicInfoJSON["Title"]) == "" {
		parsed.ComicInfoJSON = comicInfoMap(parsed.ComicInfo)
	}
	if coverCandidate == nil {
		coverCandidate = firstImage
	}
	if coverCandidate != nil {
		coverPath, err := a.extractCover(coverCandidate, parsed.Hash)
		if err != nil {
			a.logEvent("warn", "cover_extract_failed", fmt.Sprintf("path=%s error=%s", abs, err.Error()))
		} else {
			parsed.CoverPath = coverPath
		}
	}
	return parsed, nil
}

func fileSHA256(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func readZipText(f *zip.File, max int64) (string, error) {
	rc, err := f.Open()
	if err != nil {
		return "", err
	}
	defer rc.Close()
	var buf bytes.Buffer
	if _, err := io.CopyN(&buf, rc, max+1); err != nil && !errors.Is(err, io.EOF) {
		return "", err
	}
	if int64(buf.Len()) > max {
		return "", errors.New("metadata file is too large")
	}
	return buf.String(), nil
}

func isImageFile(path string) bool {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif":
		return true
	default:
		return false
	}
}

func (a *App) extractCover(f *zip.File, hash string) (string, error) {
	dir := a.settingValue("cover_cache_dir", filepath.Join(a.cfg.LibraryDir, "covers"))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	target := filepath.Join(dir, hash+pageExt(f.Name))
	rc, err := f.Open()
	if err != nil {
		return "", err
	}
	defer rc.Close()
	out, err := os.Create(target)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(out, rc); err != nil {
		out.Close()
		return "", err
	}
	if err := out.Close(); err != nil {
		return "", err
	}
	return target, nil
}

func comicInfoMap(info ComicInfo) map[string]any {
	return map[string]any{
		"Title": info.Title, "Series": info.Series, "AlternateSeries": info.AlternateSeries, "Writer": info.Writer, "Translator": info.Translator,
		"Format": info.Format, "Tags": info.Tags, "LanguageISO": info.LanguageISO, "Web": info.Web, "PageCount": info.PageCount,
		"Year": info.Year, "Month": info.Month, "Day": info.Day, "Manga": info.Manga, "AgeRating": info.AgeRating,
	}
}

func comicInfoFromMap(m map[string]any) ComicInfo {
	return ComicInfo{
		Title: stringValue(m["Title"]), Series: stringValue(m["Series"]), AlternateSeries: stringValue(m["AlternateSeries"]),
		Writer: stringValue(m["Writer"]), Translator: stringValue(m["Translator"]), Format: stringValue(m["Format"]),
		Tags: stringValue(m["Tags"]), LanguageISO: stringValue(m["LanguageISO"]), Web: stringValue(m["Web"]),
		PageCount: intValue(m["PageCount"]), Year: intValue(m["Year"]), Month: intValue(m["Month"]), Day: intValue(m["Day"]),
		Manga: stringValue(m["Manga"]), AgeRating: stringValue(m["AgeRating"]),
	}
}

func fillComicInfoFromMeta(info ComicInfo, meta map[string]any) ComicInfo {
	if len(meta) == 0 {
		return info
	}
	if title, ok := meta["title"].(map[string]any); ok {
		if info.Title == "" {
			info.Title = stringValue(title["english"])
		}
		if info.AlternateSeries == "" {
			info.AlternateSeries = stringValue(title["japanese"])
		}
	}
	if info.Title == "" {
		info.Title = galleryTitle(meta)
	}
	if info.Translator == "" {
		info.Translator = stringValue(meta["scanlator"])
	}
	if info.PageCount == 0 {
		info.PageCount = intValue(meta["num_pages"])
	}
	if info.Web == "" {
		if id := intValue(meta["id"]); id > 0 {
			info.Web = fmt.Sprintf("https://nhentai.net/g/%d/", id)
		}
	}
	if info.Tags == "" {
		var tags []string
		for _, tag := range galleryTags(meta) {
			tags = append(tags, tag.Name)
		}
		sort.Strings(tags)
		info.Tags = strings.Join(tags, ", ")
	}
	if info.LanguageISO == "" {
		info.LanguageISO = galleryLanguage(galleryTags(meta), intArray(meta["tag_ids"]))
	}
	if raw := meta["upload_date"]; raw != nil {
		ts := int64(intValue(raw))
		if ts > 0 {
			t := time.Unix(ts, 0).UTC()
			info.Year, info.Month, info.Day = t.Year(), int(t.Month()), t.Day()
		}
	}
	return info
}

func (a *App) saveParsedWork(sourceType, sourceID, mediaID string, parsed ParsedArchive, gallery map[string]any) (int, error) {
	title := strings.TrimSpace(parsed.ComicInfo.Title)
	if title == "" && gallery != nil {
		title = galleryTitle(gallery)
	}
	if title == "" {
		title = strings.TrimSuffix(filepath.Base(parsed.Path), filepath.Ext(parsed.Path))
	}
	status := "ready"
	existing := 0
	if sourceType != "" && sourceID != "" {
		existing = a.workIDBySource(sourceType, sourceID)
	}
	if existing == 0 && parsed.Hash != "" {
		existing = a.workIDByHash(parsed.Hash)
	}
	if existing == 0 {
		res, err := a.db.Exec(`INSERT INTO works(source_type,source_id,media_id,display_title,status,local_cbz_path,cover_path,file_hash,page_count) VALUES(?,?,?,?,?,?,?,?,?)`,
			sourceType, sourceID, mediaID, title, status, parsed.Path, parsed.CoverPath, parsed.Hash, parsed.PageCount)
		if err != nil {
			return 0, err
		}
		id, _ := res.LastInsertId()
		existing = int(id)
	} else {
		_, err := a.db.Exec(`UPDATE works SET source_type=?,source_id=?,media_id=?,display_title=?,status=?,local_cbz_path=?,cover_path=?,file_hash=?,page_count=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
			sourceType, sourceID, mediaID, title, status, parsed.Path, parsed.CoverPath, parsed.Hash, parsed.PageCount, existing)
		if err != nil {
			return 0, err
		}
	}
	_, _ = a.db.Exec("DELETE FROM work_files WHERE work_id=? AND kind='original'", existing)
	_, _ = a.db.Exec("INSERT INTO work_files(work_id,kind,path,size_bytes,file_hash) VALUES(?,?,?,?,?)", existing, "original", parsed.Path, parsed.Size, parsed.Hash)
	originalComic, _ := json.Marshal(parsed.ComicInfoJSON)
	working := parsed.ComicInfoJSON
	if len(working) == 0 {
		working = comicInfoMap(parsed.ComicInfo)
	}
	workingComic, _ := json.Marshal(working)
	metaRaw := parsed.MetaJSONRaw
	if metaRaw == "" && gallery != nil {
		buf, _ := json.Marshal(gallery)
		metaRaw = string(buf)
	}
	_, _ = a.db.Exec(`INSERT INTO work_metadata(work_id,metadata_type,comic_info_json,meta_json) VALUES(?,?,?,?)
ON CONFLICT(work_id,metadata_type) DO UPDATE SET comic_info_json=excluded.comic_info_json,meta_json=excluded.meta_json,updated_at=CURRENT_TIMESTAMP`, existing, "original", string(originalComic), metaRaw)
	_, _ = a.db.Exec(`INSERT INTO work_metadata(work_id,metadata_type,comic_info_json,meta_json) VALUES(?,?,?,?)
ON CONFLICT(work_id,metadata_type) DO UPDATE SET comic_info_json=excluded.comic_info_json,updated_at=CURRENT_TIMESTAMP`, existing, "working", string(workingComic), metaRaw)
	if err := a.rebuildWorkTags(existing, parsed, gallery); err != nil {
		return 0, err
	}
	return existing, nil
}

func (a *App) rebuildWorkTags(workID int, parsed ParsedArchive, gallery map[string]any) error {
	var tags []Tag
	if gallery != nil {
		tags = galleryTags(gallery)
	}
	if len(tags) == 0 && len(parsed.MetaJSON) > 0 {
		tags = galleryTags(parsed.MetaJSON)
	}
	if len(tags) == 0 && parsed.ComicInfo.Tags != "" {
		for _, part := range strings.Split(parsed.ComicInfo.Tags, ",") {
			name := strings.TrimSpace(part)
			if name != "" {
				tags = append(tags, Tag{Type: "other", Name: name})
			}
		}
	}
	_, _ = a.db.Exec("DELETE FROM work_tags WHERE work_id=?", workID)
	for _, tag := range tags {
		if strings.TrimSpace(tag.Name) == "" {
			continue
		}
		dictValue := a.matchDictionary(tag.Type, tag.ID, tag.Name)
		finalValue := tag.Name
		finalSource := "original"
		confirmed := 0
		if dictValue != "" {
			finalValue = dictValue
			finalSource = "dictionary"
		}
		_, err := a.db.Exec(`INSERT INTO work_tags(work_id,remote_id,type,original_name,dictionary_value,final_value,final_source,is_confirmed) VALUES(?,?,?,?,?,?,?,?)`,
			workID, nullInt(tag.ID), coalesce(tag.Type, "other"), tag.Name, nullIfEmpty(dictValue), finalValue, finalSource, confirmed)
		if err != nil {
			return err
		}
	}
	return nil
}

func nullInt(v int) any {
	if v == 0 {
		return nil
	}
	return v
}

func (a *App) matchDictionary(tagType string, remoteID int, original string) string {
	var out string
	if remoteID > 0 {
		_ = a.db.QueryRow("SELECT translated_text FROM tag_dictionary WHERE enabled=1 AND source_type=? AND source_text=? LIMIT 1", tagType, strconv.Itoa(remoteID)).Scan(&out)
		if out != "" {
			return out
		}
	}
	for _, q := range [][2]string{{tagType, original}, {"tag", original}, {"other", original}} {
		_ = a.db.QueryRow("SELECT translated_text FROM tag_dictionary WHERE enabled=1 AND source_type=? AND source_text=? LIMIT 1", q[0], q[1]).Scan(&out)
		if out != "" {
			return out
		}
	}
	_ = a.db.QueryRow("SELECT translated_text FROM tag_dictionary WHERE enabled=1 AND lower(source_text)=lower(?) LIMIT 1", original).Scan(&out)
	return out
}

func (a *App) workIDBySource(sourceType, sourceID string) int {
	var id int
	_ = a.db.QueryRow("SELECT id FROM works WHERE source_type=? AND source_id=?", sourceType, sourceID).Scan(&id)
	return id
}

func (a *App) workIDByHash(hash string) int {
	var id int
	if hash != "" {
		_ = a.db.QueryRow("SELECT id FROM works WHERE file_hash=?", hash).Scan(&id)
	}
	return id
}

func (a *App) queryWorks(r *http.Request) []Work {
	var args []any
	where := "1=1"
	orderBy := "w.updated_at DESC"
	if r != nil {
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		if q != "" {
			where += " AND (display_title LIKE ? OR source_id LIKE ? OR file_hash LIKE ?)"
			like := "%" + q + "%"
			args = append(args, like, like, like)
		}
		if source := strings.TrimSpace(r.URL.Query().Get("source")); source != "" && source != "all" {
			where += " AND source_type=?"
			args = append(args, source)
		}
		if status := strings.TrimSpace(r.URL.Query().Get("status")); status != "" && status != "all" {
			where += " AND status=?"
			args = append(args, status)
		}
		switch strings.TrimSpace(r.URL.Query().Get("tag_state")) {
		case "open":
			where += " AND EXISTS (SELECT 1 FROM work_tags t WHERE t.work_id=w.id AND t.is_confirmed=0)"
		case "confirmed":
			where += " AND NOT EXISTS (SELECT 1 FROM work_tags t WHERE t.work_id=w.id AND t.is_confirmed=0)"
		}
		switch strings.TrimSpace(r.URL.Query().Get("sort")) {
		case "title":
			orderBy = "w.display_title COLLATE NOCASE ASC"
		case "created":
			orderBy = "w.created_at DESC"
		case "pages_desc":
			orderBy = "w.page_count DESC"
		default:
			orderBy = "w.updated_at DESC"
		}
	}
	rows, err := a.db.Query(`
SELECT w.id,w.source_type,COALESCE(w.source_id,''),COALESCE(w.media_id,''),w.display_title,w.status,COALESCE(w.local_cbz_path,''),COALESCE(w.cover_path,''),COALESCE(w.file_hash,''),w.page_count,w.created_at,w.updated_at,
  (SELECT COUNT(*) FROM work_tags t WHERE t.work_id=w.id),
  (SELECT COUNT(*) FROM work_tags t WHERE t.work_id=w.id AND t.is_confirmed=0),
  (SELECT COUNT(*) FROM exports e WHERE e.work_id=w.id)
FROM works w WHERE `+where+` ORDER BY `+orderBy+` LIMIT 200`, args...)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var works []Work
	for rows.Next() {
		var item Work
		_ = rows.Scan(&item.ID, &item.SourceType, &item.SourceID, &item.MediaID, &item.DisplayTitle, &item.Status, &item.LocalCBZPath, &item.CoverPath, &item.FileHash, &item.PageCount, &item.CreatedAt, &item.UpdatedAt, &item.TagCount, &item.UnconfirmedTagCount, &item.ExportCount)
		item.CoverURL = fmt.Sprintf("/api/works/%d/cover", item.ID)
		item.TagPreview = a.workTagPreview(item.ID, 16)
		works = append(works, item)
	}
	return works
}

func (a *App) getWork(id int) Work {
	rows, err := a.db.Query(`
SELECT w.id,w.source_type,COALESCE(w.source_id,''),COALESCE(w.media_id,''),w.display_title,w.status,COALESCE(w.local_cbz_path,''),COALESCE(w.cover_path,''),COALESCE(w.file_hash,''),w.page_count,w.created_at,w.updated_at,
  (SELECT COUNT(*) FROM work_tags t WHERE t.work_id=w.id),
  (SELECT COUNT(*) FROM work_tags t WHERE t.work_id=w.id AND t.is_confirmed=0),
  (SELECT COUNT(*) FROM exports e WHERE e.work_id=w.id)
FROM works w WHERE w.id=?`, id)
	if err != nil {
		return Work{}
	}
	defer rows.Close()
	var item Work
	if rows.Next() {
		_ = rows.Scan(&item.ID, &item.SourceType, &item.SourceID, &item.MediaID, &item.DisplayTitle, &item.Status, &item.LocalCBZPath, &item.CoverPath, &item.FileHash, &item.PageCount, &item.CreatedAt, &item.UpdatedAt, &item.TagCount, &item.UnconfirmedTagCount, &item.ExportCount)
		item.CoverURL = fmt.Sprintf("/api/works/%d/cover", item.ID)
		item.TagPreview = a.workTagPreview(item.ID, 40)
	}
	return item
}

func (a *App) librarySummary() map[string]any {
	out := map[string]any{}
	for _, q := range []struct {
		Key string
		SQL string
	}{
		{"total_works", "SELECT COUNT(*) FROM works"},
		{"local_works", "SELECT COUNT(*) FROM works WHERE source_type='local'"},
		{"remote_works", "SELECT COUNT(*) FROM works WHERE source_type='nhentai'"},
		{"unconfirmed_tags", "SELECT COUNT(*) FROM work_tags WHERE is_confirmed=0"},
		{"exported_works", "SELECT COUNT(DISTINCT work_id) FROM exports"},
		{"dictionary_entries", "SELECT COUNT(*) FROM tag_dictionary"},
		{"failed_tasks", "SELECT COUNT(*) FROM tasks WHERE status='failed'"},
	} {
		var n int
		_ = a.db.QueryRow(q.SQL).Scan(&n)
		out[q.Key] = n
	}
	return out
}

func (a *App) workMetadata(workID int) map[string]any {
	out := map[string]any{}
	rows, err := a.db.Query("SELECT metadata_type,comic_info_json,meta_json,updated_at FROM work_metadata WHERE work_id=?", workID)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var typ string
		var comic, meta, updated sql.NullString
		if err := rows.Scan(&typ, &comic, &meta, &updated); err == nil {
			out[typ] = map[string]any{"comic_info": decodeJSON(comic.String), "meta_json": decodeJSON(meta.String), "updated_at": nullable(updated)}
		}
	}
	return out
}

func (a *App) workTags(workID int) []WorkTag {
	rows, err := a.db.Query("SELECT id,work_id,COALESCE(remote_id,0),type,original_name,COALESCE(dictionary_value,''),COALESCE(machine_suggestion,''),COALESCE(final_value,''),final_source,is_confirmed FROM work_tags WHERE work_id=? ORDER BY type,original_name", workID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []WorkTag
	for rows.Next() {
		var tag WorkTag
		var confirmed int
		_ = rows.Scan(&tag.ID, &tag.WorkID, &tag.RemoteID, &tag.Type, &tag.OriginalName, &tag.DictionaryValue, &tag.MachineSuggestion, &tag.FinalValue, &tag.FinalSource, &confirmed)
		tag.IsConfirmed = confirmed == 1
		out = append(out, tag)
	}
	return out
}

func (a *App) workTagPreview(workID, limit int) []WorkTagPreview {
	if limit <= 0 {
		limit = 12
	}
	rows, err := a.db.Query(`SELECT type,COALESCE(NULLIF(final_value,''), original_name),is_confirmed FROM work_tags WHERE work_id=?
ORDER BY CASE type
  WHEN 'artist' THEN 0
  WHEN 'group' THEN 1
  WHEN 'category' THEN 2
  WHEN 'language' THEN 3
  WHEN 'parody' THEN 4
  WHEN 'character' THEN 5
  WHEN 'tag' THEN 6
  ELSE 7
END, original_name LIMIT ?`, workID, limit)
	if err != nil {
		return []WorkTagPreview{}
	}
	defer rows.Close()
	out := []WorkTagPreview{}
	for rows.Next() {
		var item WorkTagPreview
		var confirmed int
		_ = rows.Scan(&item.Type, &item.Value, &confirmed)
		item.Confirmed = confirmed == 1
		if strings.TrimSpace(item.Value) != "" {
			out = append(out, item)
		}
	}
	return out
}

func (a *App) workExports(workID int) []map[string]any {
	rows, err := a.db.Query("SELECT id,work_id,path,created_at FROM exports WHERE work_id=? ORDER BY created_at DESC", workID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []map[string]any
	for rows.Next() {
		var id, wid int
		var path, created string
		_ = rows.Scan(&id, &wid, &path, &created)
		out = append(out, map[string]any{"id": id, "work_id": wid, "path": path, "filename": filepath.Base(path), "created_at": created, "download_url": fmt.Sprintf("/api/exports/%d/download", id)})
	}
	return out
}

func (a *App) allExports() []map[string]any {
	rows, err := a.db.Query("SELECT id,work_id,path,created_at FROM exports ORDER BY created_at DESC LIMIT 300")
	if err != nil {
		return []map[string]any{}
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, workID int
		var path, created string
		_ = rows.Scan(&id, &workID, &path, &created)
		record := map[string]any{
			"id":           id,
			"work_id":      workID,
			"path":         path,
			"filename":     filepath.Base(path),
			"created_at":   created,
			"download_url": fmt.Sprintf("/api/exports/%d/download", id),
			"exists":       fileExists(path),
		}
		if stat, err := os.Stat(path); err == nil {
			record["size_bytes"] = stat.Size()
		} else {
			record["size_bytes"] = 0
		}
		if work := a.getWork(workID); work.ID != 0 {
			record["work"] = work
			record["work_title"] = work.DisplayTitle
		}
		out = append(out, record)
	}
	return out
}

func (a *App) serveWorkCover(w http.ResponseWriter, r *http.Request, workID int) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	var path string
	if err := a.db.QueryRow("SELECT cover_path FROM works WHERE id=?", workID).Scan(&path); err != nil || path == "" {
		http.NotFound(w, r)
		return
	}
	if !a.safeDataPath(path) || !fileExists(path) {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "private, max-age=3600")
	http.ServeFile(w, r, path)
}

func (a *App) safeDataPath(path string) bool {
	cleanData, _ := filepath.Abs(a.cfg.DataDir)
	cleanLib, _ := filepath.Abs(a.cfg.LibraryDir)
	cleanPath, _ := filepath.Abs(path)
	return strings.HasPrefix(cleanPath, cleanLib+string(os.PathSeparator)) || cleanPath == cleanLib || strings.HasPrefix(cleanPath, cleanData+string(os.PathSeparator))
}

func (a *App) handleWorkMetadata(w http.ResponseWriter, r *http.Request, workID int, rest []string) {
	action := ""
	if len(rest) > 0 {
		action = rest[0]
	}
	switch action {
	case "":
		switch r.Method {
		case http.MethodGet:
			writeJSON(w, a.workMetadata(workID))
		case http.MethodPatch:
			var body struct {
				ComicInfo map[string]any `json:"comic_info"`
			}
			if err := readJSON(r, &body); err != nil {
				badRequest(w, err.Error())
				return
			}
			if body.ComicInfo == nil {
				body.ComicInfo = map[string]any{}
			}
			buf, _ := json.Marshal(body.ComicInfo)
			_, err := a.db.Exec(`INSERT INTO work_metadata(work_id,metadata_type,comic_info_json) VALUES(?,?,?)
ON CONFLICT(work_id,metadata_type) DO UPDATE SET comic_info_json=excluded.comic_info_json,updated_at=CURRENT_TIMESTAMP`, workID, "working", string(buf))
			if err != nil {
				serverError(w, err)
				return
			}
			if title := stringValue(body.ComicInfo["Title"]); title != "" {
				_, _ = a.db.Exec("UPDATE works SET display_title=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", title, workID)
			}
			a.logEvent("info", "metadata_saved", fmt.Sprintf("work_id=%d", workID))
			writeJSON(w, a.workMetadata(workID))
		default:
			methodNotAllowed(w)
		}
	case "reset":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		var comic, meta sql.NullString
		if err := a.db.QueryRow("SELECT comic_info_json,meta_json FROM work_metadata WHERE work_id=? AND metadata_type='original'", workID).Scan(&comic, &meta); err != nil {
			http.NotFound(w, r)
			return
		}
		_, _ = a.db.Exec(`INSERT INTO work_metadata(work_id,metadata_type,comic_info_json,meta_json) VALUES(?,?,?,?)
ON CONFLICT(work_id,metadata_type) DO UPDATE SET comic_info_json=excluded.comic_info_json,meta_json=excluded.meta_json,updated_at=CURRENT_TIMESTAMP`, workID, "working", comic.String, meta.String)
		a.logEvent("info", "metadata_reset", fmt.Sprintf("work_id=%d", workID))
		writeJSON(w, a.workMetadata(workID))
	case "refill-from-meta":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		var metaRaw sql.NullString
		if err := a.db.QueryRow("SELECT meta_json FROM work_metadata WHERE work_id=? AND metadata_type='original'", workID).Scan(&metaRaw); err != nil {
			http.NotFound(w, r)
			return
		}
		meta := map[string]any{}
		_ = json.Unmarshal([]byte(metaRaw.String), &meta)
		info := fillComicInfoFromMeta(ComicInfo{}, meta)
		buf, _ := json.Marshal(comicInfoMap(info))
		_, _ = a.db.Exec(`INSERT INTO work_metadata(work_id,metadata_type,comic_info_json,meta_json) VALUES(?,?,?,?)
ON CONFLICT(work_id,metadata_type) DO UPDATE SET comic_info_json=excluded.comic_info_json,updated_at=CURRENT_TIMESTAMP`, workID, "working", string(buf), metaRaw.String)
		a.logEvent("info", "metadata_refill", fmt.Sprintf("work_id=%d", workID))
		writeJSON(w, a.workMetadata(workID))
	case "compare":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		meta := a.workMetadata(workID)
		writeJSON(w, map[string]any{"original": meta["original"], "working": meta["working"]})
	case "translate":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		meta := a.workMetadata(workID)
		source := map[string]any{}
		if working, ok := meta["working"].(map[string]any); ok {
			if comic, ok := working["comic_info"].(map[string]any); ok {
				source = comic
			}
		}
		if len(source) == 0 {
			if original, ok := meta["original"].(map[string]any); ok {
				if comic, ok := original["comic_info"].(map[string]any); ok {
					source = comic
				}
			}
		}
		if len(source) == 0 {
			badRequest(w, "no ComicInfo metadata is available")
			return
		}
		settings, _ := a.settingsMap()
		provider := settings["translation_provider"]
		fields := []string{"Title", "Series", "AlternateSeries", "Writer", "Translator", "Tags", "Summary"}
		suggestions := map[string]string{}
		for _, field := range fields {
			text := strings.TrimSpace(stringValue(source[field]))
			if text == "" {
				continue
			}
			translated, err := a.machineTranslate(r.Context(), provider, text)
			if err != nil {
				a.logEvent("error", "metadata_translate_failed", fmt.Sprintf("work_id=%d field=%s error=%s", workID, field, err.Error()))
				serverError(w, err)
				return
			}
			if translated != "" && translated != text {
				suggestions[field] = translated
			}
		}
		a.logEvent("info", "metadata_translate_suggest", fmt.Sprintf("work_id=%d fields=%d", workID, len(suggestions)))
		writeJSON(w, map[string]any{"suggestions": suggestions, "metadata": a.workMetadata(workID)})
	default:
		http.NotFound(w, r)
	}
}

func (a *App) handleWorkTags(w http.ResponseWriter, r *http.Request, workID int, rest []string) {
	if len(rest) == 0 {
		if r.Method != http.MethodGet {
			methodNotAllowed(w)
			return
		}
		writeJSON(w, map[string]any{"tags": a.workTags(workID)})
		return
	}
	switch rest[0] {
	case "apply-dictionary":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		updated := a.applyDictionaryToWorkTags(workID)
		a.logEvent("info", "tags_apply_dictionary", fmt.Sprintf("work_id=%d updated=%d", workID, updated))
		writeJSON(w, map[string]any{"updated": updated, "tags": a.workTags(workID)})
	case "machine-translate":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		updated, err := a.machineSuggestWorkTags(r.Context(), workID)
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, map[string]any{"updated": updated, "tags": a.workTags(workID)})
	case "confirm":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		_, _ = a.db.Exec("UPDATE work_tags SET is_confirmed=1,updated_at=CURRENT_TIMESTAMP WHERE work_id=?", workID)
		writeJSON(w, map[string]any{"tags": a.workTags(workID)})
	case "bulk-update":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		var body struct {
			IDs         []int  `json:"ids"`
			Action      string `json:"action"`
			Type        string `json:"type"`
			FinalValue  string `json:"final_value"`
			FinalSource string `json:"final_source"`
			IsConfirmed *bool  `json:"is_confirmed"`
		}
		if err := readJSON(r, &body); err != nil {
			badRequest(w, err.Error())
			return
		}
		for _, id := range body.IDs {
			a.updateTagByAction(workID, id, body.Action, body.Type, body.FinalValue, body.FinalSource, body.IsConfirmed)
		}
		writeJSON(w, map[string]any{"tags": a.workTags(workID)})
	default:
		tagID, err := strconv.Atoi(rest[0])
		if err != nil {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodPatch {
			methodNotAllowed(w)
			return
		}
		var body map[string]any
		if err := readJSON(r, &body); err != nil {
			badRequest(w, err.Error())
			return
		}
		sets := []string{}
		args := []any{}
		for _, key := range []string{"type", "dictionary_value", "machine_suggestion", "final_value", "final_source"} {
			if v, ok := body[key]; ok {
				sets = append(sets, key+"=?")
				args = append(args, fmt.Sprint(v))
			}
		}
		if v, ok := body["is_confirmed"].(bool); ok {
			sets = append(sets, "is_confirmed=?")
			if v {
				args = append(args, 1)
			} else {
				args = append(args, 0)
			}
		}
		if len(sets) > 0 {
			args = append(args, workID, tagID)
			_, _ = a.db.Exec("UPDATE work_tags SET "+strings.Join(sets, ",")+",updated_at=CURRENT_TIMESTAMP WHERE work_id=? AND id=?", args...)
		}
		writeJSON(w, map[string]any{"tags": a.workTags(workID)})
	}
}

func (a *App) applyDictionaryToWorkTags(workID int) int {
	updated := 0
	for _, tag := range a.workTags(workID) {
		value := a.matchDictionary(tag.Type, tag.RemoteID, tag.OriginalName)
		if value == "" {
			continue
		}
		_, err := a.db.Exec(`UPDATE work_tags SET dictionary_value=?,final_value=CASE WHEN final_source='manual' THEN final_value ELSE ? END,final_source=CASE WHEN final_source='manual' THEN final_source ELSE 'dictionary' END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND work_id=?`,
			value, value, tag.ID, workID)
		if err == nil {
			updated++
		}
	}
	return updated
}

func (a *App) machineSuggestWorkTags(ctx context.Context, workID int) (int, error) {
	settings, _ := a.settingsMap()
	provider := settings["translation_provider"]
	updated := 0
	for _, tag := range a.workTags(workID) {
		if tag.MachineSuggestion != "" || tag.FinalSource == "manual" {
			continue
		}
		text, err := a.machineTranslate(ctx, provider, tag.OriginalName)
		if err != nil {
			return updated, err
		}
		_, err = a.db.Exec("UPDATE work_tags SET machine_suggestion=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND work_id=?", text, tag.ID, workID)
		if err == nil {
			updated++
		}
	}
	a.logEvent("info", "tags_machine_suggest", fmt.Sprintf("work_id=%d updated=%d", workID, updated))
	return updated, nil
}

func (a *App) updateTagByAction(workID, tagID int, action, tagType, finalValue, finalSource string, confirmed *bool) {
	switch action {
	case "use_dictionary":
		_, _ = a.db.Exec("UPDATE work_tags SET final_value=dictionary_value,final_source='dictionary',updated_at=CURRENT_TIMESTAMP WHERE work_id=? AND id=? AND dictionary_value IS NOT NULL AND dictionary_value<>''", workID, tagID)
	case "use_machine":
		_, _ = a.db.Exec("UPDATE work_tags SET final_value=machine_suggestion,final_source='machine',updated_at=CURRENT_TIMESTAMP WHERE work_id=? AND id=? AND machine_suggestion IS NOT NULL AND machine_suggestion<>''", workID, tagID)
	case "keep_original":
		_, _ = a.db.Exec("UPDATE work_tags SET final_value=original_name,final_source='original',updated_at=CURRENT_TIMESTAMP WHERE work_id=? AND id=?", workID, tagID)
	case "delete":
		_, _ = a.db.Exec("DELETE FROM work_tags WHERE work_id=? AND id=?", workID, tagID)
	case "change_type":
		if tagType != "" {
			_, _ = a.db.Exec("UPDATE work_tags SET type=?,updated_at=CURRENT_TIMESTAMP WHERE work_id=? AND id=?", tagType, workID, tagID)
		}
	case "manual":
		if finalValue != "" {
			if finalSource == "" {
				finalSource = "manual"
			}
			_, _ = a.db.Exec("UPDATE work_tags SET final_value=?,final_source=?,updated_at=CURRENT_TIMESTAMP WHERE work_id=? AND id=?", finalValue, finalSource, workID, tagID)
		}
	}
	if confirmed != nil {
		v := 0
		if *confirmed {
			v = 1
		}
		_, _ = a.db.Exec("UPDATE work_tags SET is_confirmed=?,updated_at=CURRENT_TIMESTAMP WHERE work_id=? AND id=?", v, workID, tagID)
	}
}

func (a *App) handleWorkTranslation(w http.ResponseWriter, r *http.Request, workID int, rest []string) {
	if len(rest) == 0 {
		http.NotFound(w, r)
		return
	}
	switch rest[0] {
	case "suggest":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		updated, err := a.machineSuggestWorkTags(r.Context(), workID)
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, map[string]any{"updated": updated, "tags": a.workTags(workID)})
	case "apply-selected":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		var body struct {
			TagIDs []int `json:"tag_ids"`
		}
		if err := readJSON(r, &body); err != nil {
			badRequest(w, err.Error())
			return
		}
		for _, id := range body.TagIDs {
			a.updateTagByAction(workID, id, "use_machine", "", "", "", nil)
		}
		writeJSON(w, map[string]any{"tags": a.workTags(workID)})
	default:
		http.NotFound(w, r)
	}
}

func (a *App) handleWorksBulkAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		IDs    []int  `json:"ids"`
		Action string `json:"action"`
	}
	if err := readJSON(r, &body); err != nil {
		badRequest(w, err.Error())
		return
	}
	result := map[string]int{"updated": 0, "failed": 0}
	for _, id := range body.IDs {
		switch body.Action {
		case "apply_dictionary":
			result["updated"] += a.applyDictionaryToWorkTags(id)
		case "export":
			if _, err := a.exportWork(id); err != nil {
				result["failed"]++
			} else {
				result["updated"]++
			}
		case "delete":
			if _, err := a.db.Exec("DELETE FROM works WHERE id=?", id); err != nil {
				result["failed"]++
			} else {
				result["updated"]++
			}
		case "refresh_cover", "reparse":
			work := a.getWork(id)
			if work.ID == 0 || work.LocalCBZPath == "" {
				result["failed"]++
				continue
			}
			parsed, err := a.parseArchive(work.LocalCBZPath)
			if err != nil {
				result["failed"]++
				continue
			}
			if _, err := a.saveParsedWork(work.SourceType, work.SourceID, work.MediaID, parsed, nil); err != nil {
				result["failed"]++
			} else {
				result["updated"]++
			}
		default:
			result["failed"]++
		}
	}
	a.logEvent("info", "works_bulk_action", fmt.Sprintf("action=%s updated=%d failed=%d", body.Action, result["updated"], result["failed"]))
	writeJSON(w, map[string]any{"result": result, "works": a.queryWorks(r)})
}

func (a *App) exportWork(workID int) (int, error) {
	work := a.getWork(workID)
	if work.ID == 0 {
		return 0, sql.ErrNoRows
	}
	if work.LocalCBZPath == "" || !fileExists(work.LocalCBZPath) {
		return 0, errors.New("original CBZ is missing")
	}
	var workingRaw sql.NullString
	if err := a.db.QueryRow("SELECT comic_info_json FROM work_metadata WHERE work_id=? AND metadata_type='working'", workID).Scan(&workingRaw); err != nil {
		return 0, err
	}
	working := map[string]any{}
	_ = json.Unmarshal([]byte(workingRaw.String), &working)
	info := comicInfoFromMap(working)
	info.Tags = a.finalTagString(workID)
	if info.Title == "" {
		info.Title = work.DisplayTitle
	}
	if info.PageCount == 0 {
		info.PageCount = work.PageCount
	}
	content := comicInfoXMLFromInfo(info)
	exportDir := a.settingValue("library_export_dir", filepath.Join(a.cfg.LibraryDir, "exports"))
	if err := os.MkdirAll(exportDir, 0o755); err != nil {
		return 0, err
	}
	filename := safeFilename(strings.ReplaceAll(strings.ReplaceAll(a.settingValue("export_pattern", "{id} - {title}.cbz"), "{id}", strconv.Itoa(work.ID)), "{title}", work.DisplayTitle))
	if !strings.HasSuffix(strings.ToLower(filename), ".cbz") {
		filename += ".cbz"
	}
	target := filepath.Join(exportDir, filename)
	if err := copyCBZWithComicInfo(work.LocalCBZPath, target, content, a.settingValue("keep_meta_json", "true") == "true"); err != nil {
		return 0, err
	}
	metaJSON, _ := json.Marshal(comicInfoMap(info))
	res, err := a.db.Exec("INSERT INTO exports(work_id,path,metadata_json) VALUES(?,?,?)", workID, target, string(metaJSON))
	if err != nil {
		return 0, err
	}
	id64, _ := res.LastInsertId()
	_, _ = a.db.Exec(`INSERT INTO work_metadata(work_id,metadata_type,comic_info_json) VALUES(?,?,?)
ON CONFLICT(work_id,metadata_type) DO UPDATE SET comic_info_json=excluded.comic_info_json,updated_at=CURRENT_TIMESTAMP`, workID, "exported", string(metaJSON))
	_, _ = a.db.Exec("UPDATE works SET status='exported',updated_at=CURRENT_TIMESTAMP WHERE id=?", workID)
	a.insertTask("export", "success", workID, 0, work.DisplayTitle, "Exported CBZ", "")
	a.logEvent("info", "work_exported", fmt.Sprintf("work_id=%d export_id=%d", workID, id64))
	return int(id64), nil
}

func (a *App) finalTagString(workID int) string {
	sep := a.settingValue("tag_separator", ", ")
	var values []string
	for _, tag := range a.workTags(workID) {
		v := strings.TrimSpace(tag.FinalValue)
		if v == "" {
			v = tag.OriginalName
		}
		if v != "" {
			values = append(values, v)
		}
	}
	sort.Strings(values)
	return strings.Join(values, sep)
}

func comicInfoXMLFromInfo(info ComicInfo) string {
	var buf bytes.Buffer
	buf.WriteString(`<?xml version="1.0" encoding="utf-8"?>` + "\n")
	enc := xml.NewEncoder(&buf)
	enc.Indent("", "  ")
	_ = enc.Encode(info)
	return buf.String()
}

func copyCBZWithComicInfo(src, dst, content string, keepMeta bool) error {
	reader, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer reader.Close()
	tmp := dst + ".tmp"
	outFile, err := os.Create(tmp)
	if err != nil {
		return err
	}
	archive := zip.NewWriter(outFile)
	for _, f := range reader.File {
		if strings.EqualFold(f.Name, "ComicInfo.xml") {
			continue
		}
		if !keepMeta && strings.EqualFold(filepath.Base(f.Name), "meta.json") {
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
	return os.Rename(tmp, dst)
}

func (a *App) getExport(exportID int) map[string]any {
	var id, workID int
	var path, created string
	if err := a.db.QueryRow("SELECT id,work_id,path,created_at FROM exports WHERE id=?", exportID).Scan(&id, &workID, &path, &created); err != nil {
		return map[string]any{}
	}
	record := map[string]any{"id": id, "work_id": workID, "path": path, "filename": filepath.Base(path), "created_at": created, "download_url": fmt.Sprintf("/api/exports/%d/download", id), "exists": fileExists(path)}
	if stat, err := os.Stat(path); err == nil {
		record["size_bytes"] = stat.Size()
	}
	if work := a.getWork(workID); work.ID != 0 {
		record["work"] = work
		record["work_title"] = work.DisplayTitle
	}
	return record
}

func (a *App) handleExports(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	writeJSON(w, map[string]any{"exports": a.allExports()})
}

func (a *App) handleExportPath(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/exports/"), "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	id, err := strconv.Atoi(parts[0])
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if len(parts) == 1 && r.Method == http.MethodDelete {
		var body struct {
			DeleteFile bool `json:"delete_file"`
		}
		if r.Body != nil {
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil && !errors.Is(err, io.EOF) {
				badRequest(w, err.Error())
				return
			}
		}
		var path string
		_ = a.db.QueryRow("SELECT path FROM exports WHERE id=?", id).Scan(&path)
		if body.DeleteFile && path != "" && a.safeDataPath(path) && fileExists(path) {
			_ = os.Remove(path)
		}
		_, _ = a.db.Exec("DELETE FROM exports WHERE id=?", id)
		a.logEvent("info", "export_deleted", fmt.Sprintf("export_id=%d delete_file=%t", id, body.DeleteFile))
		writeJSON(w, map[string]any{"status": "deleted", "exports": a.allExports()})
		return
	}
	if len(parts) == 2 && parts[1] == "rerun" {
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		var workID int
		if err := a.db.QueryRow("SELECT work_id FROM exports WHERE id=?", id).Scan(&workID); err != nil || workID == 0 {
			http.NotFound(w, r)
			return
		}
		newID, err := a.exportWork(workID)
		if err != nil {
			a.logEvent("error", "export_rerun_failed", fmt.Sprintf("export_id=%d work_id=%d error=%s", id, workID, err.Error()))
			serverError(w, err)
			return
		}
		a.logEvent("info", "export_rerun", fmt.Sprintf("export_id=%d new_export_id=%d work_id=%d", id, newID, workID))
		writeJSON(w, map[string]any{"export": a.getExport(newID), "exports": a.allExports()})
		return
	}
	if len(parts) != 2 || parts[1] != "download" || r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	var path string
	if err := a.db.QueryRow("SELECT path FROM exports WHERE id=?", id).Scan(&path); err != nil || path == "" {
		http.NotFound(w, r)
		return
	}
	if !a.safeDataPath(path) || !fileExists(path) {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "application/vnd.comicbook+zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filepath.Base(path)))
	http.ServeFile(w, r, path)
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
	rest := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/dictionary/"), "/")
	if rest == "tags" || strings.HasPrefix(rest, "tags/") {
		parts := []string{}
		if rest != "tags" {
			parts = strings.Split(strings.TrimPrefix(rest, "tags/"), "/")
		}
		a.handleDictionaryTags(w, r, parts)
		return
	}
	switch rest {
	case "bulk-import/preview":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		var body struct {
			Text       string `json:"text"`
			SourceType string `json:"source_type"`
		}
		if err := readJSON(r, &body); err != nil {
			badRequest(w, err.Error())
			return
		}
		items := dictionaryPreviewRows(body.Text, body.SourceType, a)
		writeJSON(w, map[string]any{"items": items, "summary": dictionaryPreviewSummary(items)})
		return
	case "bulk-import":
		a.handleDictionaryBulk(w, r)
		return
	case "export":
		if r.Method != http.MethodGet {
			methodNotAllowed(w)
			return
		}
		w.Header().Set("Content-Disposition", `attachment; filename="dictionary.json"`)
		writeJSON(w, map[string]any{"entries": a.dictionary(), "exported_at": time.Now().UTC().Format(time.RFC3339)})
		return
	case "match":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		var body struct {
			Type     string `json:"type"`
			RemoteID int    `json:"remote_id"`
			Original string `json:"original"`
		}
		if err := readJSON(r, &body); err != nil {
			badRequest(w, err.Error())
			return
		}
		writeJSON(w, map[string]any{"translation": a.matchDictionary(body.Type, body.RemoteID, body.Original)})
		return
	}
	id, err := strconv.Atoi(rest)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	switch r.Method {
	case http.MethodPatch:
		var body DictEntry
		if err := readJSON(r, &body); err != nil {
			badRequest(w, err.Error())
			return
		}
		en := 0
		if body.Enabled {
			en = 1
		}
		_, _ = a.db.Exec("UPDATE tag_dictionary SET source_type=?,source_text=?,translated_text=?,enabled=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", body.SourceType, body.SourceText, body.TranslatedText, en, id)
		writeJSON(w, map[string]any{"entry": body})
	case http.MethodDelete:
		_, _ = a.db.Exec("DELETE FROM tag_dictionary WHERE id=?", id)
		writeJSON(w, map[string]string{"status": "deleted"})
	default:
		methodNotAllowed(w)
	}
}

type DictEntry struct {
	ID             int    `json:"id"`
	SourceType     string `json:"source_type"`
	SourceText     string `json:"source_text"`
	TranslatedText string `json:"translated_text"`
	Enabled        bool   `json:"enabled"`
}

type DictionaryTagItem struct {
	Type               string `json:"type"`
	SourceType         string `json:"source_type"`
	Original           string `json:"original"`
	SourceText         string `json:"source_text"`
	Count              int    `json:"count"`
	WorkCount          int    `json:"work_count"`
	DictionaryID       int    `json:"dictionary_id"`
	CurrentTranslation string `json:"current_translation"`
	MachineSuggestion  string `json:"machine_suggestion"`
	FinalValue         string `json:"final_value"`
	State              string `json:"state"`
	ExampleWorks       []Work `json:"example_works"`
}

type dictionaryTagRef struct {
	Type           string `json:"type"`
	SourceType     string `json:"source_type"`
	Original       string `json:"original"`
	SourceText     string `json:"source_text"`
	Translation    string `json:"translation"`
	TranslatedText string `json:"translated_text"`
}

func (r dictionaryTagRef) normalized() (string, string, string) {
	sourceType := strings.TrimSpace(coalesce(r.Type, r.SourceType))
	original := strings.TrimSpace(coalesce(r.Original, r.SourceText))
	translation := strings.TrimSpace(coalesce(r.Translation, r.TranslatedText))
	return sourceType, original, translation
}

func (a *App) handleDictionaryTags(w http.ResponseWriter, r *http.Request, parts []string) {
	if len(parts) == 0 {
		if r.Method != http.MethodGet {
			methodNotAllowed(w)
			return
		}
		items, total, err := a.queryDictionaryTags(r)
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, map[string]any{"items": items, "total": total})
		return
	}
	switch parts[0] {
	case "suggest":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		var body struct {
			Provider string             `json:"provider"`
			Items    []dictionaryTagRef `json:"items"`
		}
		if err := readJSON(r, &body); err != nil {
			badRequest(w, err.Error())
			return
		}
		if body.Provider == "" {
			body.Provider = a.settingValue("translation_provider", "none")
		}
		suggestions := []map[string]any{}
		errorsOut := []map[string]string{}
		for _, ref := range body.Items {
			sourceType, original, _ := ref.normalized()
			if sourceType == "" || original == "" {
				continue
			}
			translated, err := a.machineTranslate(r.Context(), body.Provider, original)
			if err != nil {
				errorsOut = append(errorsOut, map[string]string{"type": sourceType, "original": original, "error": err.Error()})
				continue
			}
			_, _ = a.db.Exec("UPDATE work_tags SET machine_suggestion=?,updated_at=CURRENT_TIMESTAMP WHERE type=? AND lower(original_name)=lower(?)", translated, sourceType, original)
			suggestions = append(suggestions, map[string]any{"type": sourceType, "source_type": sourceType, "original": original, "source_text": original, "suggestion": translated})
		}
		level := "info"
		if len(errorsOut) > 0 {
			level = "warn"
		}
		a.logEvent(level, "dictionary_tag_suggest", fmt.Sprintf("requested=%d suggested=%d errors=%d", len(body.Items), len(suggestions), len(errorsOut)))
		writeJSON(w, map[string]any{"suggestions": suggestions, "errors": errorsOut})
	case "upsert":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		var body struct {
			Items []dictionaryTagRef `json:"items"`
		}
		if err := readJSON(r, &body); err != nil {
			badRequest(w, err.Error())
			return
		}
		entries := []DictEntry{}
		for _, ref := range body.Items {
			sourceType, original, translation := ref.normalized()
			if sourceType == "" || original == "" || translation == "" {
				badRequest(w, "type, original and translation are required")
				return
			}
			entry, err := a.upsertDict(sourceType, original, translation, true)
			if err != nil {
				serverError(w, err)
				return
			}
			_, _ = a.db.Exec("DELETE FROM dictionary_ignored_tags WHERE source_type=? AND lower(source_text)=lower(?)", sourceType, original)
			_, _ = a.db.Exec(`UPDATE work_tags SET dictionary_value=?,
final_value=CASE WHEN final_source='manual' THEN final_value ELSE ? END,
final_source=CASE WHEN final_source='manual' THEN final_source ELSE 'dictionary' END,
updated_at=CURRENT_TIMESTAMP
WHERE type=? AND lower(original_name)=lower(?)`, translation, translation, sourceType, original)
			entries = append(entries, entry)
		}
		a.logEvent("info", "dictionary_tag_upsert", fmt.Sprintf("items=%d", len(entries)))
		writeJSON(w, map[string]any{"updated": len(entries), "entries": entries})
	case "ignore":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		var body struct {
			Items []dictionaryTagRef `json:"items"`
		}
		if err := readJSON(r, &body); err != nil {
			badRequest(w, err.Error())
			return
		}
		ignored := 0
		for _, ref := range body.Items {
			sourceType, original, _ := ref.normalized()
			if sourceType == "" || original == "" {
				continue
			}
			res, err := a.db.Exec("INSERT OR IGNORE INTO dictionary_ignored_tags(source_type,source_text) VALUES(?,?)", sourceType, original)
			if err != nil {
				serverError(w, err)
				return
			}
			n, _ := res.RowsAffected()
			ignored += int(n)
		}
		a.logEvent("info", "dictionary_tag_ignore", fmt.Sprintf("items=%d ignored=%d", len(body.Items), ignored))
		writeJSON(w, map[string]any{"ignored": ignored})
	default:
		if r.Method != http.MethodGet || len(parts) < 2 {
			http.NotFound(w, r)
			return
		}
		sourceType, err := url.PathUnescape(parts[0])
		if err != nil {
			badRequest(w, err.Error())
			return
		}
		encodedTag := strings.Join(parts[1:], "/")
		original, err := url.PathUnescape(encodedTag)
		if err != nil {
			badRequest(w, err.Error())
			return
		}
		writeJSON(w, map[string]any{"works": a.dictionaryTagWorks(sourceType, original, 50)})
	}
}

func (a *App) queryDictionaryTags(r *http.Request) ([]DictionaryTagItem, int, error) {
	query := r.URL.Query()
	args := []any{}
	where := "WHERE 1=1"
	if sourceType := strings.TrimSpace(query.Get("type")); sourceType != "" && sourceType != "all" {
		where += " AND agg.type=?"
		args = append(args, sourceType)
	}
	if q := strings.TrimSpace(query.Get("q")); q != "" {
		like := "%" + q + "%"
		where += ` AND (agg.original_name LIKE ? OR agg.machine_suggestion LIKE ? OR EXISTS (
SELECT 1 FROM tag_dictionary d WHERE d.enabled=1 AND d.source_type=agg.type AND lower(d.source_text)=lower(agg.original_name) AND d.translated_text LIKE ?))`
		args = append(args, like, like, like)
	}
	switch strings.TrimSpace(query.Get("state")) {
	case "configured":
		where += ` AND EXISTS (SELECT 1 FROM tag_dictionary d WHERE d.enabled=1 AND d.source_type=agg.type AND lower(d.source_text)=lower(agg.original_name))`
	case "unconfigured":
		where += ` AND NOT EXISTS (SELECT 1 FROM tag_dictionary d WHERE d.enabled=1 AND d.source_type=agg.type AND lower(d.source_text)=lower(agg.original_name))
AND NOT EXISTS (SELECT 1 FROM dictionary_ignored_tags i WHERE i.source_type=agg.type AND lower(i.source_text)=lower(agg.original_name))`
	case "ignored":
		where += ` AND EXISTS (SELECT 1 FROM dictionary_ignored_tags i WHERE i.source_type=agg.type AND lower(i.source_text)=lower(agg.original_name))`
	}
	orderBy := "agg.occurrences DESC, agg.work_count DESC, agg.original_name COLLATE NOCASE ASC"
	switch strings.TrimSpace(query.Get("sort")) {
	case "name":
		orderBy = "agg.original_name COLLATE NOCASE ASC"
	case "works":
		orderBy = "agg.work_count DESC, agg.occurrences DESC"
	case "configured":
		orderBy = "state ASC, agg.occurrences DESC"
	}
	page := intValue(query.Get("page"))
	if page <= 0 {
		page = 1
	}
	pageSize := intValue(query.Get("page_size"))
	if pageSize <= 0 {
		pageSize = 60
	}
	if pageSize > 200 {
		pageSize = 200
	}
	offset := (page - 1) * pageSize
	base := `FROM (
SELECT type, original_name, COUNT(*) AS occurrences, COUNT(DISTINCT work_id) AS work_count, COALESCE(MAX(NULLIF(machine_suggestion,'')), '') AS machine_suggestion
FROM work_tags
GROUP BY type, original_name
) agg `
	var total int
	if err := a.db.QueryRow("SELECT COUNT(*) "+base+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := a.db.Query(`
SELECT agg.type, agg.original_name, agg.occurrences, agg.work_count, agg.machine_suggestion,
COALESCE((SELECT d.id FROM tag_dictionary d WHERE d.enabled=1 AND d.source_type=agg.type AND lower(d.source_text)=lower(agg.original_name) ORDER BY d.updated_at DESC LIMIT 1), 0) AS dictionary_id,
COALESCE((SELECT d.translated_text FROM tag_dictionary d WHERE d.enabled=1 AND d.source_type=agg.type AND lower(d.source_text)=lower(agg.original_name) ORDER BY d.updated_at DESC LIMIT 1), '') AS current_translation,
CASE
  WHEN EXISTS (SELECT 1 FROM dictionary_ignored_tags i WHERE i.source_type=agg.type AND lower(i.source_text)=lower(agg.original_name)) THEN 'ignored'
  WHEN EXISTS (SELECT 1 FROM tag_dictionary d WHERE d.enabled=1 AND d.source_type=agg.type AND lower(d.source_text)=lower(agg.original_name)) THEN 'configured'
  ELSE 'unconfigured'
END AS state
`+base+where+` ORDER BY `+orderBy+` LIMIT ? OFFSET ?`, append(args, pageSize, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := []DictionaryTagItem{}
	for rows.Next() {
		var item DictionaryTagItem
		if err := rows.Scan(&item.Type, &item.Original, &item.Count, &item.WorkCount, &item.MachineSuggestion, &item.DictionaryID, &item.CurrentTranslation, &item.State); err != nil {
			return nil, 0, err
		}
		item.SourceType = item.Type
		item.SourceText = item.Original
		item.FinalValue = coalesce(item.CurrentTranslation, item.MachineSuggestion, item.Original)
		item.ExampleWorks = a.dictionaryTagWorks(item.Type, item.Original, 3)
		items = append(items, item)
	}
	return items, total, rows.Err()
}

func (a *App) dictionaryTagWorks(sourceType, original string, limit int) []Work {
	if limit <= 0 {
		limit = 20
	}
	rows, err := a.db.Query("SELECT DISTINCT work_id FROM work_tags WHERE type=? AND lower(original_name)=lower(?) ORDER BY work_id DESC LIMIT ?", sourceType, original, limit)
	if err != nil {
		return []Work{}
	}
	defer rows.Close()
	works := []Work{}
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err == nil {
			if work := a.getWork(id); work.ID != 0 {
				works = append(works, work)
			}
		}
	}
	return works
}

func (a *App) dictionary() []DictEntry {
	out := []DictEntry{}
	rows, err := a.db.Query("SELECT id,source_type,source_text,translated_text,enabled FROM tag_dictionary ORDER BY source_type,source_text")
	if err != nil {
		return out
	}
	defer rows.Close()
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

func dictionaryPreviewRows(text, sourceType string, app *App) []map[string]any {
	var rows []map[string]any
	seen := map[string]bool{}
	for idx, line := range strings.Split(text, "\n") {
		raw := strings.TrimSpace(line)
		if raw == "" {
			rows = append(rows, map[string]any{"line": idx + 1, "raw": line, "status": "empty"})
			continue
		}
		parts := strings.SplitN(raw, "=", 2)
		if len(parts) != 2 || strings.TrimSpace(parts[0]) == "" || strings.TrimSpace(parts[1]) == "" {
			rows = append(rows, map[string]any{"line": idx + 1, "raw": line, "status": "invalid"})
			continue
		}
		original, translation := strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])
		key := sourceType + "\x00" + original
		status := "valid"
		if seen[key] {
			status = "duplicate"
		} else if app != nil && app.matchDictionary(sourceType, 0, original) != "" {
			status = "conflict"
		}
		seen[key] = true
		rows = append(rows, map[string]any{"line": idx + 1, "original": original, "translation": translation, "status": status})
	}
	return rows
}

func dictionaryPreviewSummary(rows []map[string]any) map[string]int {
	out := map[string]int{"valid": 0, "invalid": 0, "duplicate": 0, "conflict": 0, "empty": 0}
	for _, row := range rows {
		out[stringValue(row["status"])]++
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
	items := []TranslationItem{}
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
	ID              int      `json:"id"`
	MediaID         string   `json:"media_id"`
	Title           string   `json:"title"`
	CoverURL        string   `json:"cover_url"`
	ThumbURL        string   `json:"thumb_url"`
	ProxiedCoverURL string   `json:"proxied_cover_url"`
	ProxiedThumbURL string   `json:"proxied_thumb_url"`
	CoverError      string   `json:"cover_error"`
	ThumbError      string   `json:"thumb_error"`
	NumPages        int      `json:"num_pages"`
	Language        string   `json:"language"`
	Tags            []Tag    `json:"tags"`
	TagIDs          []int    `json:"tag_ids"`
	TagSample       []string `json:"tag_sample"`
}

type CDNConfig struct {
	ImageServers []string
	ThumbServers []string
}

type NHClient struct {
	cfg             Config
	app             *App
	client          *http.Client
	lastReq         time.Time
	cdnImageServers []string
	cdnThumbServers []string
	cdnFetched      time.Time
	mu              sync.Mutex
}

func NewNHClient(cfg Config, app *App) *NHClient {
	return &NHClient{cfg: cfg, app: app, client: &http.Client{Timeout: cfg.RequestTimeout}}
}

type remoteRequestOptions struct {
	UserAgent string
	APIKey    string
}

func (c *NHClient) request(ctx context.Context, path string, params url.Values) (map[string]any, error) {
	return c.requestWithOptions(ctx, http.MethodGet, path, params, nil, remoteRequestOptions{})
}

func (c *NHClient) post(ctx context.Context, path string, params url.Values, payload any) (map[string]any, error) {
	return c.requestWithOptions(ctx, http.MethodPost, path, params, payload, remoteRequestOptions{})
}

func (c *NHClient) requestWithOptions(ctx context.Context, method, path string, params url.Values, payload any, opts remoteRequestOptions) (map[string]any, error) {
	if params == nil {
		params = url.Values{}
	}
	u := "https://nhentai.net" + path
	if len(params) > 0 {
		u += "?" + params.Encode()
	}
	var body []byte
	if payload != nil {
		var err error
		body, err = json.Marshal(payload)
		if err != nil {
			return nil, err
		}
	}
	var last error
	for attempt := 0; attempt < c.cfg.RequestRetries; attempt++ {
		c.rateLimit()
		var reader io.Reader
		if body != nil {
			reader = bytes.NewReader(body)
		}
		req, _ := http.NewRequestWithContext(ctx, method, u, reader)
		req.Header.Set("Accept", "application/json")
		ua := strings.TrimSpace(opts.UserAgent)
		if ua == "" {
			ua = c.setting("nhentai_user_agent", c.cfg.DefaultUserAgent)
		}
		req.Header.Set("User-Agent", ua)
		if body != nil {
			req.Header.Set("Content-Type", "application/json")
		}
		key := strings.TrimSpace(opts.APIKey)
		if key == "" {
			key = c.app.getSecret("nhentai_api_key")
		}
		if key != "" {
			req.Header.Set("Authorization", "Key "+key)
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
	return c.normalizeListResponse(ctx, body), nil
}

func (c *NHClient) Popular(ctx context.Context) (map[string]any, error) {
	body, err := c.request(ctx, "/api/v2/galleries/popular", nil)
	if err != nil {
		return nil, err
	}
	return c.normalizeListResponse(ctx, body), nil
}

func (c *NHClient) Related(ctx context.Context, id int) (map[string]any, error) {
	body, err := c.request(ctx, "/api/v2/galleries/"+strconv.Itoa(id)+"/related", nil)
	if err != nil {
		return nil, err
	}
	return c.normalizeListResponse(ctx, body), nil
}

func (c *NHClient) ResolveTag(ctx context.Context, tagType, slug string) (map[string]any, error) {
	return c.request(ctx, "/api/v2/tags/"+url.PathEscape(tagType)+"/"+url.PathEscape(slug), nil)
}

func (c *NHClient) Tagged(ctx context.Context, tagID, page int, sortBy string) (map[string]any, error) {
	body, err := c.request(ctx, "/api/v2/galleries/tagged", url.Values{"tag_id": {strconv.Itoa(tagID)}, "page": {strconv.Itoa(page)}, "sort": {sortBy}})
	if err != nil {
		return nil, err
	}
	return c.normalizeListResponse(ctx, body), nil
}

func (c *NHClient) DownloadURL(ctx context.Context, id int) (string, error) {
	body, err := c.post(ctx, "/api/v2/galleries/"+strconv.Itoa(id)+"/download", nil, nil)
	if err != nil {
		return "", err
	}
	downloadURL := extractDownloadURL(body)
	if downloadURL == "" {
		return "", errors.New("download response did not include an archive URL")
	}
	if strings.HasPrefix(downloadURL, "http://") || strings.HasPrefix(downloadURL, "https://") {
		return downloadURL, nil
	}
	if strings.HasPrefix(downloadURL, "/") {
		return "https://nhentai.net" + downloadURL, nil
	}
	return "", errors.New("download response included an invalid archive URL")
}

func extractDownloadURL(v any) string {
	switch t := v.(type) {
	case map[string]any:
		for _, key := range []string{"download_url", "url", "archive_url", "href", "path"} {
			if s := stringValue(t[key]); s != "" {
				return s
			}
		}
		for _, item := range t {
			if s := extractDownloadURL(item); s != "" {
				return s
			}
		}
	case []any:
		for _, item := range t {
			if s := extractDownloadURL(item); s != "" {
				return s
			}
		}
	}
	return ""
}

func (c *NHClient) CDN(ctx context.Context) []string {
	cfg := c.CDNConfig(ctx)
	return cfg.ImageServers
}

func (c *NHClient) CDNConfig(ctx context.Context) CDNConfig {
	cfg, _ := c.cdnWithOptions(ctx, remoteRequestOptions{}, true)
	return cfg
}

func (c *NHClient) cdnWithOptions(ctx context.Context, opts remoteRequestOptions, allowFallback bool) (CDNConfig, error) {
	c.mu.Lock()
	useCache := opts.UserAgent == "" && opts.APIKey == ""
	if useCache && (len(c.cdnImageServers) > 0 || len(c.cdnThumbServers) > 0) && time.Since(c.cdnFetched) < 10*time.Minute {
		out := CDNConfig{ImageServers: append([]string(nil), c.cdnImageServers...), ThumbServers: append([]string(nil), c.cdnThumbServers...)}
		c.mu.Unlock()
		return out, nil
	}
	c.mu.Unlock()
	body, err := c.requestWithOptions(ctx, http.MethodGet, "/api/v2/cdn", nil, nil, opts)
	if err != nil {
		if allowFallback {
			return c.fallbackCDN(), err
		}
		return CDNConfig{}, err
	}
	out := cdnConfigFromResponse(body)
	if len(out.ImageServers) == 0 && len(out.ThumbServers) == 0 {
		if allowFallback {
			return c.fallbackCDN(), errors.New("no CDN servers returned")
		}
		return CDNConfig{}, errors.New("no CDN servers returned")
	}
	if len(out.ThumbServers) == 0 {
		out.ThumbServers = append([]string(nil), out.ImageServers...)
	}
	if len(out.ImageServers) == 0 {
		out.ImageServers = append([]string(nil), out.ThumbServers...)
	}
	if useCache {
		c.mu.Lock()
		c.cdnImageServers = append([]string(nil), out.ImageServers...)
		c.cdnThumbServers = append([]string(nil), out.ThumbServers...)
		c.cdnFetched = time.Now()
		c.mu.Unlock()
	}
	return out, nil
}

func (c *NHClient) cachedCDNServers() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return append([]string(nil), c.cdnImageServers...)
}

func (c *NHClient) cachedCDNStatus() map[string]any {
	c.mu.Lock()
	defer c.mu.Unlock()
	last := ""
	if !c.cdnFetched.IsZero() {
		last = c.cdnFetched.Format(time.RFC3339)
	}
	return map[string]any{"servers": append([]string(nil), c.cdnImageServers...), "image_servers": append([]string(nil), c.cdnImageServers...), "thumb_servers": append([]string(nil), c.cdnThumbServers...), "last_update": last}
}

func (c *NHClient) fallbackCDN() CDNConfig {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.cdnImageServers) > 0 || len(c.cdnThumbServers) > 0 {
		return CDNConfig{ImageServers: append([]string(nil), c.cdnImageServers...), ThumbServers: append([]string(nil), c.cdnThumbServers...)}
	}
	return CDNConfig{ImageServers: []string{"https://i.nhentai.net"}, ThumbServers: []string{"https://t.nhentai.net"}}
}

func (c *NHClient) normalizeListResponse(ctx context.Context, body map[string]any) map[string]any {
	raw := body["result"]
	if raw == nil {
		raw = body
	}
	itemsRaw, ok := raw.([]any)
	if !ok {
		itemsRaw = asArray(body["galleries"])
	}
	if len(itemsRaw) == 0 {
		itemsRaw = asArray(body["items"])
	}
	cdnCfg, cdnErr := c.cdnWithOptions(ctx, remoteRequestOptions{}, true)
	if cdnErr != nil {
		c.app.logEvent("warn", "cdn_fallback", cdnErr.Error())
	}
	imageCDN := firstOf(cdnCfg.ImageServers)
	thumbCDN := firstOf(cdnCfg.ThumbServers)
	items := []GallerySummary{}
	for _, item := range itemsRaw {
		if m, ok := item.(map[string]any); ok {
			summary := normalizeGallery(m, imageCDN, thumbCDN)
			if summary.ThumbURL == "" && summary.CoverURL == "" {
				c.app.logEvent("warn", "source_cover_missing", fmt.Sprintf("gallery_id=%d reason=%s", summary.ID, coalesce(summary.ThumbError, summary.CoverError, "missing image path")))
			}
			items = append(items, summary)
		}
	}
	out := map[string]any{"result": items, "count": firstNonZero(body, "count", "total", "num_results")}
	if out["count"] == 0 {
		out["count"] = len(items)
	}
	for _, key := range []string{"page", "per_page", "total_pages", "num_pages"} {
		if v, ok := body[key]; ok {
			out[key] = v
		}
	}
	return out
}

func normalizeGallery(data map[string]any, imageCDN, thumbCDN string) GallerySummary {
	mediaID := stringValue(data["media_id"])
	title := galleryTitle(data)
	cover, coverErr := imageURL(data, "cover", imageCDN)
	thumb, thumbErr := imageURL(data, "thumbnail", thumbCDN)
	tags := galleryTags(data)
	tagIDs := intArray(data["tag_ids"])
	lang := galleryLanguage(tags, tagIDs)
	var sample []string
	for _, t := range tags {
		if t.Name != "" && len(sample) < 8 {
			sample = append(sample, t.Type+":"+t.Name)
		}
	}
	return GallerySummary{
		ID:              intValue(data["id"]),
		MediaID:         mediaID,
		Title:           title,
		CoverURL:        cover,
		ThumbURL:        thumb,
		ProxiedCoverURL: proxyImageURL(cover),
		ProxiedThumbURL: proxyImageURL(thumb),
		CoverError:      coverErr,
		ThumbError:      thumbErr,
		NumPages:        intValue(data["num_pages"]),
		Language:        lang,
		Tags:            tags,
		TagIDs:          tagIDs,
		TagSample:       sample,
	}
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

func imageURL(data map[string]any, key string, cdn string) (string, string) {
	if s := stringValue(data[key+"_url"]); s != "" {
		return s, ""
	}
	path := firstImagePath(data, key)
	if path == "" && key == "cover" {
		path = firstImagePath(data, "image")
	}
	if path == "" && key == "thumbnail" {
		path = firstImagePath(data, "thumb")
	}
	if path == "" {
		return "", "missing image path"
	}
	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		return path, ""
	}
	if cdn == "" {
		return "", "CDN server is missing"
	}
	return strings.TrimRight(cdn, "/") + "/" + strings.TrimLeft(path, "/"), ""
}

func proxyImageURL(raw string) string {
	if raw == "" {
		return ""
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return ""
	}
	return "/api/images/proxy?url=" + url.QueryEscape(u.String())
}

func firstImagePath(data map[string]any, key string) string {
	candidates := [][]string{
		{key},
		{"images", key},
		{"media", key},
	}
	for _, candidate := range candidates {
		if value := valueAtPath(data, candidate...); value != nil {
			if s := imagePathValue(value); s != "" {
				return s
			}
		}
	}
	return findNamedImagePath(data, key)
}

func imagePathValue(v any) string {
	if s := stringValue(v); s != "" {
		return s
	}
	if m, ok := v.(map[string]any); ok {
		if s := firstString(m, "path", "url", "href", "src"); s != "" {
			return s
		}
		for _, nested := range m {
			if s := imagePathValue(nested); s != "" {
				return s
			}
		}
	}
	return ""
}

func findNamedImagePath(v any, key string) string {
	switch t := v.(type) {
	case map[string]any:
		for name, value := range t {
			if strings.EqualFold(name, key) {
				if s := imagePathValue(value); s != "" {
					return s
				}
			}
		}
		for _, value := range t {
			if s := findNamedImagePath(value, key); s != "" {
				return s
			}
		}
	case []any:
		for _, value := range t {
			if s := findNamedImagePath(value, key); s != "" {
				return s
			}
		}
	}
	return ""
}

func valueAtPath(data map[string]any, keys ...string) any {
	var current any = data
	for _, key := range keys {
		m, ok := current.(map[string]any)
		if !ok {
			return nil
		}
		current = m[key]
	}
	return current
}

func cdnConfigFromResponse(body map[string]any) CDNConfig {
	return CDNConfig{
		ImageServers: cdnServersFromAny(firstArray(body, "image_servers", "servers", "cdn_servers")),
		ThumbServers: cdnServersFromAny(firstArray(body, "thumb_servers", "thumbnail_servers")),
	}
}

func firstArray(body map[string]any, keys ...string) []any {
	for _, key := range keys {
		raw := asArray(body[key])
		if len(raw) > 0 {
			return raw
		}
	}
	return nil
}

func cdnServersFromAny(raw []any) []string {
	var out []string
	for _, item := range raw {
		if s := cdnServerString(item); s != "" {
			out = append(out, s)
		}
	}
	return out
}

func cdnServerString(v any) string {
	s := stringValue(v)
	if s == "" {
		if m, ok := v.(map[string]any); ok {
			s = firstString(m, "url", "server", "host", "base_url", "origin")
		}
	}
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	if !strings.HasPrefix(s, "http://") && !strings.HasPrefix(s, "https://") {
		s = "https://" + s
	}
	return strings.TrimRight(s, "/")
}

func firstNonZero(data map[string]any, keys ...string) int {
	for _, key := range keys {
		if n := intValue(data[key]); n > 0 {
			return n
		}
	}
	return 0
}

func firstOf(values []string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
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
	var galleryID sql.NullInt64
	if err := app.db.QueryRow("SELECT gallery_id FROM tasks WHERE id=?", taskID).Scan(&galleryID); err != nil || !galleryID.Valid {
		return
	}
	gid := int(galleryID.Int64)
	app.logEvent("info", "worker_start", fmt.Sprintf("task_id=%d gallery_id=%d", taskID, gid))
	_, _ = app.db.Exec("UPDATE tasks SET status='running',current_step='Fetch metadata',message='Fetching remote gallery metadata',error=NULL,started_at=COALESCE(started_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE id=?", taskID)
	ctx, cancel := context.WithTimeout(context.Background(), time.Hour)
	defer cancel()
	gallery, err := app.client.Gallery(ctx, gid)
	if err != nil {
		app.logEvent("error", "worker_gallery_failed", fmt.Sprintf("task_id=%d gallery_id=%d error=%s", taskID, gid, err.Error()))
		w.fail(taskID, err)
		return
	}
	app.logEvent("info", "worker_gallery_loaded", fmt.Sprintf("task_id=%d gallery_id=%d", taskID, gid))
	cdnCfg := app.client.CDNConfig(ctx)
	summary := normalizeGallery(gallery, firstOf(cdnCfg.ImageServers), firstOf(cdnCfg.ThumbServers))
	raw, _ := json.Marshal(gallery)
	pages := asArray(gallery["pages"])
	total := len(pages)
	if total == 0 {
		total = 1
	}
	_, _ = app.db.Exec("UPDATE tasks SET title=?,cover_url=?,language=?,progress_total=?,raw_json=?,current_step='Get download URL',message='Metadata loaded',progress=15,updated_at=CURRENT_TIMESTAMP WHERE id=?", summary.Title, coalesce(summary.CoverURL, summary.ThumbURL), summary.Language, total, string(raw), taskID)
	if summary.CoverURL == "" && summary.ThumbURL == "" {
		app.logEvent("warn", "worker_cover_missing", fmt.Sprintf("task_id=%d gallery_id=%d", taskID, gid))
	} else {
		app.logEvent("info", "worker_cover_resolved", fmt.Sprintf("task_id=%d gallery_id=%d cover=%t thumb=%t", taskID, gid, summary.CoverURL != "", summary.ThumbURL != ""))
	}
	cbz, err := w.downloadCBZ(ctx, taskID, gallery, firstOf(cdnCfg.ImageServers), firstOf(cdnCfg.ThumbServers))
	if err != nil {
		app.logEvent("error", "worker_archive_failed", fmt.Sprintf("task_id=%d gallery_id=%d error=%s", taskID, gid, err.Error()))
		w.fail(taskID, err)
		return
	}
	parsed, err := app.parseArchive(cbz)
	if err != nil {
		app.logEvent("error", "worker_parse_failed", fmt.Sprintf("task_id=%d gallery_id=%d error=%s", taskID, gid, err.Error()))
		w.fail(taskID, err)
		return
	}
	workID, err := app.saveParsedWork("nhentai", strconv.Itoa(summary.ID), summary.MediaID, parsed, gallery)
	if err != nil {
		app.logEvent("error", "worker_save_work_failed", fmt.Sprintf("task_id=%d gallery_id=%d error=%s", taskID, gid, err.Error()))
		w.fail(taskID, err)
		return
	}
	_, _ = app.db.Exec("UPDATE tasks SET status='success',work_id=?,cbz_path=?,progress_current=progress_total,progress=100,current_step='Ready for editing',message='Imported and parsed',finished_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?", workID, cbz, taskID)
	app.logEvent("info", "worker_archive_completed", fmt.Sprintf("task_id=%d gallery_id=%d work_id=%d path=%s", taskID, gid, workID, cbz))
}

func (w *Worker) fail(taskID int, err error) {
	_, _ = w.app.db.Exec("UPDATE tasks SET status='failed',error=?,message=?,finished_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?", err.Error(), err.Error(), taskID)
}

func (w *Worker) downloadCBZ(ctx context.Context, taskID int, gallery map[string]any, imageServer string, thumbServer string) (string, error) {
	app := w.app
	summary := normalizeGallery(gallery, imageServer, thumbServer)
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

	downloadURL, err := app.client.DownloadURL(ctx, summary.ID)
	if err != nil {
		app.logEvent("error", "worker_download_url_failed", fmt.Sprintf("task_id=%d gallery_id=%d error=%s", taskID, summary.ID, err.Error()))
		return "", err
	}
	app.logEvent("info", "worker_download_url", fmt.Sprintf("task_id=%d gallery_id=%d", taskID, summary.ID))
	_, _ = app.db.Exec("UPDATE tasks SET current_step='Download CBZ',message='Downloading remote archive',progress=35,updated_at=CURRENT_TIMESTAMP WHERE id=?", taskID)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, downloadURL, nil)
	req.Header.Set("User-Agent", app.client.setting("nhentai_user_agent", app.cfg.DefaultUserAgent))
	req.Header.Set("Referer", fmt.Sprintf("https://nhentai.net/g/%d/", summary.ID))
	resp, err := app.client.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 401 || resp.StatusCode == 403 || resp.StatusCode == 429 {
		return "", errors.New("remote service rejected archive download; access controls will not be bypassed")
	}
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("archive download failed: %s", resp.Status)
	}
	out, err := os.Create(tmpPath)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(out, resp.Body); err != nil {
		out.Close()
		return "", err
	}
	if err := out.Close(); err != nil {
		return "", err
	}
	if err := os.Rename(tmpPath, finalPath); err != nil {
		return "", err
	}
	_, _ = app.db.Exec("UPDATE tasks SET progress_current=progress_total,current_step='Parse archive',message='Archive downloaded',progress=70,updated_at=CURRENT_TIMESTAMP WHERE id=?", taskID)
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
	XMLName         xml.Name `xml:"ComicInfo"`
	Title           string   `xml:"Title,omitempty"`
	Series          string   `xml:"Series,omitempty"`
	AlternateSeries string   `xml:"AlternateSeries,omitempty"`
	Writer          string   `xml:"Writer,omitempty"`
	Translator      string   `xml:"Translator,omitempty"`
	Publisher       string   `xml:"Publisher,omitempty"`
	Format          string   `xml:"Format,omitempty"`
	Genre           string   `xml:"Genre,omitempty"`
	LanguageISO     string   `xml:"LanguageISO,omitempty"`
	Tags            string   `xml:"Tags,omitempty"`
	PageCount       int      `xml:"PageCount,omitempty"`
	Web             string   `xml:"Web,omitempty"`
	Year            int      `xml:"Year,omitempty"`
	Month           int      `xml:"Month,omitempty"`
	Day             int      `xml:"Day,omitempty"`
	Manga           string   `xml:"Manga,omitempty"`
	AgeRating       string   `xml:"AgeRating,omitempty"`
	Summary         string   `xml:"Summary,omitempty"`
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

func diskUsage(path string) (uint64, uint64) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return 0, 0
	}
	free := stat.Bavail * uint64(stat.Bsize)
	total := stat.Blocks * uint64(stat.Bsize)
	return free, total
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
