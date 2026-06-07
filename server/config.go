package main

import (
	"os"
	"path/filepath"
	"strconv"
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
