package main

import (
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Addr             string
	DataDir          string
	DatabasePath     string
	LibraryDir       string
	StaticDir        string
	SecretKey        string
	SessionTTL       time.Duration
	DefaultUserAgent string
}

func loadConfig() Config {
	dataDir := env("DATA_DIR", "./data")
	return Config{
		Addr:             env("ADDR", ":8080"),
		DataDir:          dataDir,
		DatabasePath:     env("DATABASE_PATH", filepath.Join(dataDir, "app.db")),
		LibraryDir:       env("LIBRARY_DIR", filepath.Join(dataDir, "library")),
		StaticDir:        env("STATIC_DIR", "frontend/dist"),
		SecretKey:        env("SECRET_KEY", "change-me"),
		SessionTTL:       time.Duration(intEnv("SESSION_TTL_HOURS", 720)) * time.Hour,
		DefaultUserAgent: env("NHENTAI_USER_AGENT", "NH Archive/3.0 (+local-first-private-archive)"),
	}
}

func (c Config) Validate() error {
	if allowWeakSecret() {
		return nil
	}
	secret := strings.TrimSpace(c.SecretKey)
	if secret == "" || secret == "change-me" || strings.Contains(strings.ToLower(secret), "change-me") || len(secret) < 32 {
		return errors.New("SECRET_KEY must be set to a strong random value of at least 32 characters; set ALLOW_WEAK_SECRET=true only for local development")
	}
	return nil
}

func allowWeakSecret() bool {
	value := strings.ToLower(strings.TrimSpace(os.Getenv("ALLOW_WEAK_SECRET")))
	return value == "1" || value == "true" || value == "yes"
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func intEnv(key string, fallback int) int {
	value, err := strconv.Atoi(os.Getenv(key))
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}
