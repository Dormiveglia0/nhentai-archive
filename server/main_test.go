package main

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestEmptySchemaSetupLoginAndAppState(t *testing.T) {
	app := newTestApp(t)

	rec := request(app, http.MethodGet, "/api/auth/setup-status", "", nil, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("setup status = %d", rec.Code)
	}
	var setup SetupStatus
	readJSON(t, rec, &setup)
	if !setup.NeedsSetup {
		t.Fatal("empty database should require setup")
	}

	rec = request(app, http.MethodGet, "/api/app/state", "", nil, "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized app state = %d", rec.Code)
	}

	auth := setupAdmin(t, app)
	if auth.Token == "" || auth.Username != "NH_Collector" {
		t.Fatalf("unexpected auth response: %+v", auth)
	}

	rec = request(app, http.MethodPost, "/api/auth/login", "", strings.NewReader(`{"username":"NH_Collector","password":"wrong password"}`), "application/json")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("bad login = %d", rec.Code)
	}

	rec = request(app, http.MethodPost, "/api/auth/login", "", strings.NewReader(`{"username":"NH_Collector","password":"correct horse battery staple"}`), "application/json")
	if rec.Code != http.StatusOK {
		t.Fatalf("login = %d: %s", rec.Code, rec.Body.String())
	}

	rec = request(app, http.MethodGet, "/api/app/state", auth.Token, nil, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("app state = %d: %s", rec.Code, rec.Body.String())
	}
	var state AppState
	readJSON(t, rec, &state)
	if state.Works == nil || state.Tasks == nil || state.Dictionary == nil || state.Exports == nil {
		t.Fatalf("state arrays should be initialized: %+v", state)
	}
	if state.Settings.DataDir == "" || state.Settings.ExportDir == "" {
		t.Fatalf("settings paths should be populated: %+v", state.Settings)
	}
}

func TestPasswordHashAndSecretBox(t *testing.T) {
	hash, err := hashPassword("correct horse battery staple")
	if err != nil {
		t.Fatal(err)
	}
	if !verifyPassword("correct horse battery staple", hash) {
		t.Fatal("expected password to verify")
	}
	if verifyPassword("wrong password", hash) {
		t.Fatal("wrong password verified")
	}

	box := NewSecretBox("unit-test-key")
	nonce, cipherText, err := box.Encrypt("api-secret")
	if err != nil {
		t.Fatal(err)
	}
	plain, err := box.Decrypt(nonce, cipherText)
	if err != nil {
		t.Fatal(err)
	}
	if plain != "api-secret" {
		t.Fatalf("secret roundtrip = %q", plain)
	}
}

func TestCBZUploadReaderMetadataAndSettings(t *testing.T) {
	app := newTestApp(t)
	auth := setupAdmin(t, app)
	cbz := createTestCBZ(t)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "sample.cbz")
	if err != nil {
		t.Fatal(err)
	}
	file, err := os.Open(cbz)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := io.Copy(part, file); err != nil {
		t.Fatal(err)
	}
	_ = file.Close()
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	rec := request(app, http.MethodPost, "/api/library/upload", auth.Token, body, writer.FormDataContentType())
	if rec.Code != http.StatusCreated {
		t.Fatalf("upload = %d: %s", rec.Code, rec.Body.String())
	}
	var upload struct {
		Work Work `json:"work"`
		Task Task `json:"task"`
	}
	readJSON(t, rec, &upload)
	if upload.Work.Title != "雨后的教室" || upload.Work.Pages != 2 {
		t.Fatalf("unexpected imported work: %+v", upload.Work)
	}

	rec = request(app, http.MethodGet, "/api/library/works", auth.Token, nil, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("works = %d", rec.Code)
	}
	var worksPayload struct {
		Works []Work `json:"works"`
	}
	readJSON(t, rec, &worksPayload)
	if len(worksPayload.Works) != 1 || len(worksPayload.Works[0].Tags) < 2 {
		t.Fatalf("work list did not include parsed tags: %+v", worksPayload.Works)
	}

	rec = request(app, http.MethodGet, "/api/library/works/1/reader", auth.Token, nil, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("reader = %d: %s", rec.Code, rec.Body.String())
	}
	var manifest ReaderManifest
	readJSON(t, rec, &manifest)
	if len(manifest.Pages) != 2 || manifest.Pages[0].Index != 1 {
		t.Fatalf("unexpected manifest: %+v", manifest)
	}

	rec = request(app, http.MethodGet, "/api/library/works/1/reader/pages/2", auth.Token, nil, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("page = %d", rec.Code)
	}
	if got := rec.Body.String(); got != "page-two" {
		t.Fatalf("page body = %q", got)
	}
	if contentType := rec.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "image/jpeg") {
		t.Fatalf("page content type = %q", contentType)
	}

	rec = request(app, http.MethodPost, "/api/library/works/1/progress", auth.Token, strings.NewReader(`{"pageIndex":2,"percent":100}`), "application/json")
	if rec.Code != http.StatusOK {
		t.Fatalf("progress = %d", rec.Code)
	}
	var progress ProgressState
	readJSON(t, rec, &progress)
	if progress.PageIndex != 2 || progress.Percent != 100 {
		t.Fatalf("progress not saved: %+v", progress)
	}

	rec = request(app, http.MethodGet, "/api/metadata/works/1", auth.Token, nil, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("metadata = %d", rec.Code)
	}
	var metadata MetadataPayload
	readJSON(t, rec, &metadata)
	if metadata.Work.Title != "雨后的教室" || len(metadata.Records) == 0 || len(metadata.Tags["tag"]) == 0 {
		t.Fatalf("metadata payload incomplete: %+v", metadata)
	}

	rec = request(app, http.MethodPatch, "/api/settings", auth.Token, strings.NewReader(`{"settings":{"cache_limit":"5 GB"},"secrets":{"nhentai_api_key":"unit-key"}}`), "application/json")
	if rec.Code != http.StatusOK {
		t.Fatalf("settings patch = %d: %s", rec.Code, rec.Body.String())
	}
	var settings SettingsState
	readJSON(t, rec, &settings)
	if !settings.APIConnected || settings.CacheLimit != "5 GB" {
		t.Fatalf("settings not updated: %+v", settings)
	}
	req, err := app.remote.request(httptest.NewRequest(http.MethodGet, "/", nil).Context(), http.MethodGet, "https://example.com/api")
	if err != nil {
		t.Fatal(err)
	}
	if got := req.Header.Get("Authorization"); got != "Key unit-key" {
		t.Fatalf("remote auth header = %q", got)
	}

	rec = request(app, http.MethodPost, "/api/dictionary/terms", auth.Token, strings.NewReader(`{"source":"Snowmelt","zh":"雪融","type":"作品名","works":2,"hits":4,"status":"pending","confidence":91}`), "application/json")
	if rec.Code != http.StatusCreated {
		t.Fatalf("dictionary post = %d: %s", rec.Code, rec.Body.String())
	}
	rec = request(app, http.MethodGet, "/api/files/health", auth.Token, nil, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("files health = %d", rec.Code)
	}
	var health FileHealth
	readJSON(t, rec, &health)
	if health.Archives != 1 || health.Pages != 2 || health.Bytes == 0 {
		t.Fatalf("unexpected file health: %+v", health)
	}

	rec = request(app, http.MethodPost, "/api/exports", auth.Token, strings.NewReader(`{"workId":1,"preset":"默认预设 v2"}`), "application/json")
	if rec.Code != http.StatusCreated {
		t.Fatalf("export post = %d: %s", rec.Code, rec.Body.String())
	}
	var exportPayload struct {
		Export ExportJob `json:"export"`
	}
	readJSON(t, rec, &exportPayload)
	if exportPayload.Export.WorkID != 1 || exportPayload.Export.Filename == "" {
		t.Fatalf("unexpected export payload: %+v", exportPayload.Export)
	}
	if len(app.exports()) != 1 {
		t.Fatalf("export was not persisted: %+v", app.exports())
	}
}

func newTestApp(t *testing.T) *App {
	t.Helper()
	dir := t.TempDir()
	cfg := Config{
		Addr:             ":0",
		DataDir:          dir,
		DatabasePath:     filepath.Join(dir, "app.db"),
		LibraryDir:       filepath.Join(dir, "library"),
		StaticDir:        filepath.Join(dir, "public"),
		SecretKey:        "unit-test-secret",
		SessionTTL:       time.Hour,
		DefaultUserAgent: "NH Archive Test",
	}
	for _, path := range []string{cfg.DataDir, cfg.LibraryDir, filepath.Join(cfg.LibraryDir, "covers"), filepath.Join(cfg.LibraryDir, "exports"), cfg.StaticDir} {
		if err := os.MkdirAll(path, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	db, err := sql.Open("sqlite", cfg.DatabasePath)
	if err != nil {
		t.Fatal(err)
	}
	app := &App{cfg: cfg, db: db, crypto: NewSecretBox(cfg.SecretKey)}
	app.remote = NewNHClient(cfg, app)
	if err := app.initDB(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})
	return app
}

func setupAdmin(t *testing.T, app *App) AuthResponse {
	t.Helper()
	rec := request(app, http.MethodPost, "/api/auth/setup-admin", "", strings.NewReader(`{"username":"NH_Collector","password":"correct horse battery staple"}`), "application/json")
	if rec.Code != http.StatusCreated {
		t.Fatalf("setup admin = %d: %s", rec.Code, rec.Body.String())
	}
	var auth AuthResponse
	readJSON(t, rec, &auth)
	return auth
}

func request(app *App, method, path, token string, body io.Reader, contentType string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, body)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	return rec
}

func readJSON(t *testing.T, rec *httptest.ResponseRecorder, out any) {
	t.Helper()
	if err := json.Unmarshal(rec.Body.Bytes(), out); err != nil {
		t.Fatalf("decode json: %v\nbody=%s", err, rec.Body.String())
	}
}

func createTestCBZ(t *testing.T) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "sample.cbz")
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	writer := zip.NewWriter(file)
	addZipFile(t, writer, "ComicInfo.xml", `<ComicInfo><Title>雨后的教室</Title><Series>となりのねこ</Series><Writer>COMITIA 147</Writer><Publisher>となりのティーズ</Publisher><Tags>校园,雨天,青春</Tags><LanguageISO>zh</LanguageISO><PageCount>2</PageCount></ComicInfo>`)
	addZipFile(t, writer, "pages/001.jpg", "page-one")
	addZipFile(t, writer, "pages/002.jpg", "page-two")
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
	return path
}

func addZipFile(t *testing.T, writer *zip.Writer, name, content string) {
	t.Helper()
	part, err := writer.Create(name)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write([]byte(content)); err != nil {
		t.Fatal(err)
	}
}
