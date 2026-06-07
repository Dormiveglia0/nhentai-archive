package main

import (
	"archive/zip"
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestBulkDictionaryParser(t *testing.T) {
	got := parseBulkDictionary("artist=作者\n\n# comment\n tag = 标签 \ninvalid\n")
	if len(got) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(got))
	}
	if got[0][0] != "artist" || got[0][1] != "作者" {
		t.Fatalf("unexpected first entry: %#v", got[0])
	}
}

func TestPasswordHash(t *testing.T) {
	hash, err := hashPassword("correct horse battery staple")
	if err != nil {
		t.Fatal(err)
	}
	if !verifyPassword("correct horse battery staple", hash) {
		t.Fatal("password did not verify")
	}
	if verifyPassword("wrong", hash) {
		t.Fatal("wrong password verified")
	}
}

func TestSecretBox(t *testing.T) {
	box := NewSecretBox("secret")
	nonce, cipherText, err := box.Encrypt("api-key")
	if err != nil {
		t.Fatal(err)
	}
	plain, err := box.Decrypt(nonce, cipherText)
	if err != nil {
		t.Fatal(err)
	}
	if plain != "api-key" {
		t.Fatalf("got %q", plain)
	}
}

func TestRewriteComicInfoSameLibraryTmp(t *testing.T) {
	dir := t.TempDir()
	tmpDir := filepath.Join(dir, ".tmp")
	if err := os.Mkdir(tmpDir, 0o755); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "book.cbz")
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	z := zip.NewWriter(f)
	if err := addZipText(z, "0001.jpg", "image"); err != nil {
		t.Fatal(err)
	}
	if err := addZipText(z, "ComicInfo.xml", "old"); err != nil {
		t.Fatal(err)
	}
	if err := z.Close(); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	if err := rewriteComicInfo(path, "new"); err != nil {
		t.Fatal(err)
	}
	read, err := zip.OpenReader(path)
	if err != nil {
		t.Fatal(err)
	}
	defer read.Close()
	var found bool
	for _, file := range read.File {
		if file.Name == "ComicInfo.xml" {
			found = true
		}
	}
	if !found {
		t.Fatal("ComicInfo.xml missing")
	}
}

func TestParseArchiveSaveWorkAndExportNonDestructive(t *testing.T) {
	app := newTestApp(t)
	cbz := filepath.Join(t.TempDir(), "local.cbz")
	originalComic := `<ComicInfo><Title>Original Title</Title><Tags>tag one, tag two</Tags><PageCount>1</PageCount></ComicInfo>`
	if err := writeTestCBZ(cbz, map[string]string{
		"0001.jpg":      "image-data",
		"ComicInfo.xml": originalComic,
		"meta.json":     `{"id":654778,"title":{"english":"Meta Title","japanese":"JP"},"num_pages":1,"tags":[{"id":1,"type":"artist","name":"alice"}]}`,
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := app.upsertDict("artist", "alice", "艾丽丝", true); err != nil {
		t.Fatal(err)
	}
	parsed, err := app.parseArchive(cbz)
	if err != nil {
		t.Fatal(err)
	}
	if parsed.PageCount != 1 || parsed.CoverPath == "" {
		t.Fatalf("unexpected parsed archive: %#v", parsed)
	}
	workID, err := app.saveParsedWork("local", parsed.Hash, "", parsed, nil)
	if err != nil {
		t.Fatal(err)
	}
	tags := app.workTags(workID)
	if len(tags) != 1 || tags[0].DictionaryValue != "艾丽丝" || tags[0].FinalValue != "艾丽丝" {
		t.Fatalf("dictionary was not applied to work tags: %#v", tags)
	}
	exportID, err := app.exportWork(workID)
	if err != nil {
		t.Fatal(err)
	}
	if exportID == 0 || len(app.workExports(workID)) != 1 {
		t.Fatalf("export record missing")
	}
	after, err := zipText(cbz, "ComicInfo.xml")
	if err != nil {
		t.Fatal(err)
	}
	if after != originalComic {
		t.Fatalf("original CBZ was modified: %q", after)
	}
}

func writeTestCBZ(path string, files map[string]string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	z := zip.NewWriter(f)
	for name, content := range files {
		if err := addZipText(z, name, content); err != nil {
			z.Close()
			f.Close()
			return err
		}
	}
	if err := z.Close(); err != nil {
		f.Close()
		return err
	}
	return f.Close()
}

func zipText(path, name string) (string, error) {
	reader, err := zip.OpenReader(path)
	if err != nil {
		return "", err
	}
	defer reader.Close()
	for _, f := range reader.File {
		if f.Name == name {
			return readZipText(f, 2<<20)
		}
	}
	return "", fmt.Errorf("%s not found", name)
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func newTestApp(t *testing.T) *App {
	t.Helper()
	dir := t.TempDir()
	db, err := sql.Open("sqlite", filepath.Join(dir, "app.db"))
	if err != nil {
		t.Fatal(err)
	}
	app := &App{
		cfg: Config{
			DataDir:          dir,
			DatabasePath:     filepath.Join(dir, "app.db"),
			LibraryDir:       dir,
			StaticDir:        dir,
			SecretKey:        "test-secret",
			RequestTimeout:   time.Second,
			RequestInterval:  0,
			RequestRetries:   1,
			Concurrency:      1,
			SessionTTL:       time.Hour,
			DefaultUserAgent: "test-agent",
			TargetLanguage:   "zh-CN",
		},
		db:      db,
		crypto:  NewSecretBox("test-secret"),
		started: time.Now(),
	}
	if err := app.initDB(); err != nil {
		t.Fatal(err)
	}
	app.client = NewNHClient(app.cfg, app)
	return app
}

func createTestAdmin(t *testing.T, app *App) string {
	t.Helper()
	hash, err := hashPassword("old-password")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := app.db.Exec("INSERT INTO admins(username,password_hash) VALUES(?,?)", "admin", hash); err != nil {
		t.Fatal(err)
	}
	token, err := app.createSession("admin")
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func TestNHClientUsesAPIKeyAuthorizationHeader(t *testing.T) {
	app := newTestApp(t)
	nonce, cipherText, err := app.crypto.Encrypt("api-key")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := app.db.Exec("INSERT INTO secrets(name,nonce,ciphertext) VALUES(?,?,?)", "nhentai_api_key", nonce, cipherText); err != nil {
		t.Fatal(err)
	}
	var got string
	app.client.client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		got = r.Header.Get("Authorization")
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(bytes.NewBufferString(`{"ok":true}`)),
		}, nil
	})}
	if _, err := app.client.request(context.Background(), "/api/v2", nil); err != nil {
		t.Fatal(err)
	}
	if got != "Key api-key" {
		t.Fatalf("expected Authorization %q, got %q", "Key api-key", got)
	}
}

func TestNormalizeGalleryUsesCDNPath(t *testing.T) {
	got := normalizeGallery(map[string]any{
		"id":       float64(654778),
		"media_id": "123",
		"title":    map[string]any{"display": "title"},
		"images": map[string]any{
			"cover":     map[string]any{"path": "/galleries/123/cover.webp"},
			"thumbnail": map[string]any{"path": "/galleries/123/thumb.webp"},
		},
	}, "https://img.example", "https://thumb.example")
	if got.CoverURL != "https://img.example/galleries/123/cover.webp" {
		t.Fatalf("unexpected cover URL: %s", got.CoverURL)
	}
	if got.ThumbURL != "https://thumb.example/galleries/123/thumb.webp" {
		t.Fatalf("unexpected thumbnail URL: %s", got.ThumbURL)
	}
	listThumb := normalizeGallery(map[string]any{"thumbnail": "/galleries/123/list.webp"}, "https://img.example", "https://thumb.example")
	if listThumb.ThumbURL != "https://thumb.example/galleries/123/list.webp" {
		t.Fatalf("search thumbnail should use thumb server, got %s", listThumb.ThumbURL)
	}
	full := normalizeGallery(map[string]any{"cover": map[string]any{"path": "https://img.example/cover.webp"}}, "https://cdn.example", "https://thumb.example")
	if full.CoverURL != "https://img.example/cover.webp" {
		t.Fatalf("unexpected full cover URL: %s", full.CoverURL)
	}
	image := normalizeGallery(map[string]any{"image": map[string]any{"path": "/galleries/123/image.webp"}}, "https://cdn.example", "https://thumb.example")
	if image.CoverURL != "https://cdn.example/galleries/123/image.webp" {
		t.Fatalf("unexpected image fallback URL: %s", image.CoverURL)
	}
	if image.ProxiedCoverURL != "/api/images/proxy?url=https%3A%2F%2Fcdn.example%2Fgalleries%2F123%2Fimage.webp" {
		t.Fatalf("unexpected proxied URL: %s", image.ProxiedCoverURL)
	}
	relativeNoCDN := normalizeGallery(map[string]any{"cover": map[string]any{"path": "/galleries/123/cover.webp"}}, "", "")
	if relativeNoCDN.CoverURL != "" {
		t.Fatalf("relative image without CDN should not be exposed, got %s", relativeNoCDN.CoverURL)
	}
}

func TestCDNServerObjectParsing(t *testing.T) {
	got := cdnConfigFromResponse(map[string]any{"servers": []any{
		map[string]any{"url": "https://img.example"},
		map[string]any{"host": "cdn.example"},
	}, "thumb_servers": []any{"thumb.example"}})
	if len(got.ImageServers) != 2 || got.ImageServers[0] != "https://img.example" || got.ImageServers[1] != "https://cdn.example" || got.ThumbServers[0] != "https://thumb.example" {
		t.Fatalf("unexpected CDN servers: %#v", got)
	}
}

func TestPasswordChange(t *testing.T) {
	app := newTestApp(t)
	token := createTestAdmin(t, app)
	body := bytes.NewBufferString(`{"current_password":"old-password","new_password":"x"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/account/password", body)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var hash string
	if err := app.db.QueryRow("SELECT password_hash FROM admins WHERE username='admin'").Scan(&hash); err != nil {
		t.Fatal(err)
	}
	if !verifyPassword("x", hash) {
		t.Fatal("short new password did not verify")
	}
}

func TestPasswordChangeRejectsEmptyPassword(t *testing.T) {
	app := newTestApp(t)
	token := createTestAdmin(t, app)
	req := httptest.NewRequest(http.MethodPost, "/api/account/password", bytes.NewBufferString(`{"current_password":"old-password","new_password":""}`))
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestPasswordChangeRejectsWrongCurrentPassword(t *testing.T) {
	app := newTestApp(t)
	token := createTestAdmin(t, app)
	req := httptest.NewRequest(http.MethodPost, "/api/account/password", bytes.NewBufferString(`{"current_password":"wrong","new_password":"x"}`))
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestImportCounts(t *testing.T) {
	app := newTestApp(t)
	token := createTestAdmin(t, app)
	if _, err := app.db.Exec("INSERT INTO tasks(gallery_id,status) VALUES(5,'failed'),(6,'completed')"); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/tasks/import", bytes.NewBufferString(`{"ids":[5,6,7,7,0]}`))
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if out["added"] != float64(1) || out["existing"] != float64(1) || out["retried"] != float64(1) || out["ignored"] != float64(2) {
		t.Fatalf("unexpected counts: %#v", out)
	}
	var eventCount int
	_ = app.db.QueryRow("SELECT COUNT(*) FROM maintenance_events WHERE action LIKE 'import_%'").Scan(&eventCount)
	if eventCount < 5 {
		t.Fatalf("expected import log events, got %d", eventCount)
	}
}

func TestStatusShape(t *testing.T) {
	app := newTestApp(t)
	token := createTestAdmin(t, app)
	req := httptest.NewRequest(http.MethodGet, "/api/status", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"api", "cdn", "translation", "storage", "worker"} {
		if out[key] == nil {
			t.Fatalf("missing %s in %#v", key, out)
		}
	}
}

func TestConnectionTestUsesDraftAPIKey(t *testing.T) {
	app := newTestApp(t)
	token := createTestAdmin(t, app)
	app.client.client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		switch r.URL.Path {
		case "/api/v2":
			return jsonResponse(http.StatusOK, `{"ok":true}`), nil
		case "/api/v2/user":
			if r.Header.Get("Authorization") == "Key valid-key" && r.Header.Get("User-Agent") == "draft-agent" {
				return jsonResponse(http.StatusOK, `{"id":1}`), nil
			}
			return jsonResponse(http.StatusUnauthorized, `{"detail":"invalid key"}`), nil
		case "/api/v2/cdn":
			return jsonResponse(http.StatusOK, `{"image_servers":["cdn.example"]}`), nil
		default:
			return jsonResponse(http.StatusNotFound, `{}`), nil
		}
	})}

	req := httptest.NewRequest(http.MethodPost, "/api/settings/test-connection", bytes.NewBufferString(`{"nhentai_user_agent":"draft-agent","nhentai_api_key":"random"}`))
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var failed map[string]map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &failed); err != nil {
		t.Fatal(err)
	}
	if failed["auth_key"]["ok"] == true {
		t.Fatalf("random key should not pass: %#v", failed)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/settings/test-connection", bytes.NewBufferString(`{"nhentai_user_agent":"draft-agent","nhentai_api_key":"valid-key"}`))
	req.Header.Set("Authorization", "Bearer "+token)
	rec = httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var passed map[string]map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &passed); err != nil {
		t.Fatal(err)
	}
	if passed["auth_key"]["ok"] != true || passed["cdn"]["ok"] != true {
		t.Fatalf("valid draft key should pass: %#v", passed)
	}
}

func TestMaintenanceEndpoints(t *testing.T) {
	app := newTestApp(t)
	token := createTestAdmin(t, app)
	cbzPath := filepath.Join(app.cfg.LibraryDir, "done.cbz")
	if err := os.WriteFile(cbzPath, []byte("archive"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := app.db.Exec("INSERT INTO tasks(gallery_id,status,cbz_path,error) VALUES(1,'completed',?,NULL),(2,'failed',NULL,'boom')", cbzPath); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/tasks/clear-completed", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("clear expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(cbzPath); err != nil {
		t.Fatalf("clear completed should not delete cbz: %v", err)
	}
	var completed int
	_ = app.db.QueryRow("SELECT COUNT(*) FROM tasks WHERE status='completed'").Scan(&completed)
	if completed != 0 {
		t.Fatalf("expected completed rows cleared, got %d", completed)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/tasks/retry-failed", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec = httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("retry expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var queued int
	_ = app.db.QueryRow("SELECT COUNT(*) FROM tasks WHERE status='queued' AND error IS NULL").Scan(&queued)
	if queued != 1 {
		t.Fatalf("expected failed task requeued, got %d", queued)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/logs", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec = httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("logs expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var logs map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &logs); err != nil {
		t.Fatal(err)
	}
	if logs["events"] == nil || logs["task_errors"] == nil {
		t.Fatalf("missing logs fields: %#v", logs)
	}
}

func TestSettingsExportMasksSecrets(t *testing.T) {
	app := newTestApp(t)
	token := createTestAdmin(t, app)
	nonce, cipherText, err := app.crypto.Encrypt("very-secret-api-key")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := app.db.Exec("INSERT INTO secrets(name,nonce,ciphertext) VALUES(?,?,?)", "nhentai_api_key", nonce, cipherText); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/settings/export", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("export expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), "very-secret-api-key") {
		t.Fatal("export leaked secret")
	}
	if !strings.Contains(rec.Body.String(), "masked") {
		t.Fatal("export should include masked secret status")
	}
}

func TestImageProxy(t *testing.T) {
	app := newTestApp(t)
	token := createTestAdmin(t, app)
	nonce, cipherText, err := app.crypto.Encrypt("api-key")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := app.db.Exec("INSERT INTO secrets(name,nonce,ciphertext) VALUES(?,?,?)", "nhentai_api_key", nonce, cipherText); err != nil {
		t.Fatal(err)
	}
	var gotAuth string
	app.client.client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		gotAuth = r.Header.Get("Authorization")
		return &http.Response{
			StatusCode: http.StatusOK,
			Status:     "200 OK",
			Header:     http.Header{"Content-Type": {"image/webp"}},
			Body:       io.NopCloser(bytes.NewBufferString("image")),
		}, nil
	})}
	req := httptest.NewRequest(http.MethodGet, "/api/images/proxy?url="+url.QueryEscape("https://img.example/cover.webp"), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("proxy expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if rec.Body.String() != "image" || rec.Header().Get("Content-Type") != "image/webp" {
		t.Fatalf("unexpected proxy response: content-type=%s body=%q", rec.Header().Get("Content-Type"), rec.Body.String())
	}
	if gotAuth != "" {
		t.Fatalf("image proxy leaked Authorization header: %q", gotAuth)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/images/proxy?url="+url.QueryEscape("file:///etc/passwd"), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec = httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("invalid URL expected 400, got %d", rec.Code)
	}
}

func TestSearchWritesLogs(t *testing.T) {
	app := newTestApp(t)
	token := createTestAdmin(t, app)
	app.client.client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		switch r.URL.Path {
		case "/api/v2/search":
			return jsonResponse(http.StatusOK, `{"result":[{"id":123,"title":{"display":"Book"},"images":{"cover":{"path":"/galleries/1/c.webp"}}}],"count":1}`), nil
		case "/api/v2/cdn":
			return jsonResponse(http.StatusOK, `{"servers":[{"url":"https://cdn.example"}]}`), nil
		default:
			return jsonResponse(http.StatusNotFound, `{}`), nil
		}
	})}
	req := httptest.NewRequest(http.MethodGet, "/api/search?q=book&page=1", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("search expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "proxied_cover_url") {
		t.Fatalf("search response should include proxied image URLs: %s", rec.Body.String())
	}
	var events int
	_ = app.db.QueryRow("SELECT COUNT(*) FROM maintenance_events WHERE action='search'").Scan(&events)
	if events != 1 {
		t.Fatalf("expected search log event, got %d", events)
	}
}

func TestDownloadURLUsesOfficialPostEndpoint(t *testing.T) {
	app := newTestApp(t)
	var gotMethod, gotPath string
	app.client.client = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		return jsonResponse(http.StatusOK, `{"download_url":"https://files.example/book.cbz"}`), nil
	})}
	got, err := app.client.DownloadURL(context.Background(), 654778)
	if err != nil {
		t.Fatal(err)
	}
	if gotMethod != http.MethodPost || gotPath != "/api/v2/galleries/654778/download" {
		t.Fatalf("unexpected remote call %s %s", gotMethod, gotPath)
	}
	if got != "https://files.example/book.cbz" {
		t.Fatalf("unexpected download URL: %s", got)
	}
}

func TestDictionaryTagAggregationAndActions(t *testing.T) {
	app := newTestApp(t)
	token := createTestAdmin(t, app)
	res, err := app.db.Exec("INSERT INTO works(source_type,source_id,display_title,status,page_count) VALUES('local','one','Book One','ready',12)")
	if err != nil {
		t.Fatal(err)
	}
	firstID, _ := res.LastInsertId()
	res, err = app.db.Exec("INSERT INTO works(source_type,source_id,display_title,status,page_count) VALUES('local','two','Book Two','ready',18)")
	if err != nil {
		t.Fatal(err)
	}
	secondID, _ := res.LastInsertId()
	if _, err := app.upsertDict("tag", "school uniform", "校服", true); err != nil {
		t.Fatal(err)
	}
	if _, err := app.db.Exec(`INSERT INTO work_tags(work_id,type,original_name,dictionary_value,final_value,final_source) VALUES
(?,'tag','school uniform','校服','校服','dictionary'),
(?,'tag','school uniform','校服','校服','dictionary'),
(?,'artist','alice',NULL,'alice','original'),
(?,'group','circle',NULL,'circle','original')`, firstID, secondID, firstID, firstID); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/dictionary/tags?state=configured&type=tag", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("dictionary tags expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var listed struct {
		Items []DictionaryTagItem `json:"items"`
		Total int                 `json:"total"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	if listed.Total != 1 || len(listed.Items) != 1 || listed.Items[0].Count != 2 || listed.Items[0].CurrentTranslation != "校服" {
		t.Fatalf("unexpected aggregated tags: %#v", listed)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/dictionary/tags/upsert", bytes.NewBufferString(`{"items":[{"type":"artist","original":"alice","translation":"爱丽丝"}]}`))
	req.Header.Set("Authorization", "Bearer "+token)
	rec = httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("tag upsert expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var finalValue string
	_ = app.db.QueryRow("SELECT final_value FROM work_tags WHERE type='artist' AND original_name='alice'").Scan(&finalValue)
	if finalValue != "爱丽丝" {
		t.Fatalf("dictionary upsert did not apply to work tag, got %q", finalValue)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/dictionary/tags/ignore", bytes.NewBufferString(`{"items":[{"type":"group","original":"circle"}]}`))
	req.Header.Set("Authorization", "Bearer "+token)
	rec = httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("tag ignore expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	req = httptest.NewRequest(http.MethodGet, "/api/dictionary/tags?state=ignored&type=group", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec = httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"state":"ignored"`) {
		t.Fatalf("ignored tag should be listed, got %d: %s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/api/dictionary/tags/artist/alice", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec = httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "Book One") {
		t.Fatalf("tag works expected related work, got %d: %s", rec.Code, rec.Body.String())
	}

	var eventCount int
	_ = app.db.QueryRow("SELECT COUNT(*) FROM maintenance_events WHERE action IN ('dictionary_tag_upsert','dictionary_tag_ignore')").Scan(&eventCount)
	if eventCount != 2 {
		t.Fatalf("expected dictionary action logs, got %d", eventCount)
	}
}

func TestExportRecordsEndpoints(t *testing.T) {
	app := newTestApp(t)
	token := createTestAdmin(t, app)
	originalCBZ := filepath.Join(app.cfg.LibraryDir, "original.cbz")
	originalComic := `<ComicInfo><Title>Export Source</Title><Tags>tag one</Tags><PageCount>1</PageCount></ComicInfo>`
	if err := writeTestCBZ(originalCBZ, map[string]string{
		"0001.jpg":      "image-data",
		"ComicInfo.xml": originalComic,
	}); err != nil {
		t.Fatal(err)
	}
	parsed, err := app.parseArchive(originalCBZ)
	if err != nil {
		t.Fatal(err)
	}
	workID, err := app.saveParsedWork("local", parsed.Hash, "", parsed, nil)
	if err != nil {
		t.Fatal(err)
	}
	exportID, err := app.exportWork(workID)
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/exports", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "Export Source") {
		t.Fatalf("exports list expected record, got %d: %s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/exports/%d/rerun", exportID), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec = httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("rerun expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var exportCount int
	_ = app.db.QueryRow("SELECT COUNT(*) FROM exports WHERE work_id=?", workID).Scan(&exportCount)
	if exportCount != 2 {
		t.Fatalf("expected rerun to create second export record, got %d", exportCount)
	}

	record := app.getExport(exportID)
	exportPath := stringValue(record["path"])
	req = httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/exports/%d", exportID), bytes.NewBufferString(`{"delete_file":false}`))
	req.Header.Set("Authorization", "Bearer "+token)
	rec = httptest.NewRecorder()
	app.routes().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("delete export expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(originalCBZ); err != nil {
		t.Fatalf("delete export record should not delete original CBZ: %v", err)
	}
	if exportPath != "" {
		if _, err := os.Stat(exportPath); err != nil {
			t.Fatalf("delete export record without delete_file should keep exported CBZ: %v", err)
		}
	}
}

func jsonResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Status:     fmt.Sprintf("%d %s", status, http.StatusText(status)),
		Header:     http.Header{"Content-Type": {"application/json"}},
		Body:       io.NopCloser(bytes.NewBufferString(body)),
	}
}
