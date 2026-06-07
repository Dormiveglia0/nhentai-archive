package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

type App struct {
	cfg    Config
	db     *sql.DB
	crypto *SecretBox
	remote *NHClient
}

func main() {
	cfg := loadConfig()
	if err := cfg.Validate(); err != nil {
		log.Fatal(err)
	}
	for _, dir := range []string{cfg.DataDir, cfg.LibraryDir, filepath.Join(cfg.LibraryDir, "covers"), filepath.Join(cfg.LibraryDir, "exports"), filepath.Dir(cfg.DatabasePath)} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			log.Fatal(err)
		}
	}
	db, err := sql.Open("sqlite", cfg.DatabasePath)
	if err != nil {
		log.Fatal(err)
	}
	app := &App{cfg: cfg, db: db, crypto: NewSecretBox(cfg.SecretKey)}
	app.remote = NewNHClient(cfg, app)
	if err := app.initDB(); err != nil {
		log.Fatal(err)
	}
	log.Printf("NH Archive listening on %s", cfg.Addr)
	log.Fatal(http.ListenAndServe(cfg.Addr, app.routes()))
}
