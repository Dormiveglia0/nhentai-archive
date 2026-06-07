package main

import (
	"context"
	"net/http"
	"strings"
	"time"
)

type contextKey string

const usernameKey contextKey = "username"

func (a *App) adminsExist() bool {
	var count int
	_ = a.db.QueryRow("SELECT COUNT(*) FROM admins").Scan(&count)
	return count > 0
}

func (a *App) createAdmin(username, password string) (AuthResponse, error) {
	username = strings.TrimSpace(username)
	if username == "" {
		username = "NH_Collector"
	}
	hash, err := hashPassword(password)
	if err != nil {
		return AuthResponse{}, err
	}
	if _, err := a.db.Exec("INSERT INTO admins(username,password_hash) VALUES(?,?)", username, hash); err != nil {
		return AuthResponse{}, err
	}
	token, err := a.newSession(username)
	if err != nil {
		return AuthResponse{}, err
	}
	return AuthResponse{Token: token, Username: username}, nil
}

func (a *App) authenticate(username, password string) (AuthResponse, bool) {
	var hash string
	if err := a.db.QueryRow("SELECT password_hash FROM admins WHERE username=?", username).Scan(&hash); err != nil {
		return AuthResponse{}, false
	}
	if !verifyPassword(password, hash) {
		return AuthResponse{}, false
	}
	token, err := a.newSession(username)
	if err != nil {
		return AuthResponse{}, false
	}
	return AuthResponse{Token: token, Username: username}, true
}

func (a *App) newSession(username string) (string, error) {
	token, err := randomToken(32)
	if err != nil {
		return "", err
	}
	expires := time.Now().UTC().Add(a.cfg.SessionTTL).Format(time.RFC3339)
	_, err = a.db.Exec("INSERT INTO sessions(token_hash,username,expires_at) VALUES(?,?,?)", sha256Hex(token), username, expires)
	return token, err
}

func (a *App) sessionUsername(token string) (string, bool) {
	var username, expiresText string
	if err := a.db.QueryRow("SELECT username,expires_at FROM sessions WHERE token_hash=?", sha256Hex(token)).Scan(&username, &expiresText); err != nil {
		return "", false
	}
	expires, err := time.Parse(time.RFC3339, expiresText)
	if err != nil || time.Now().UTC().After(expires) {
		return "", false
	}
	return username, true
}

func (a *App) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		token, ok := strings.CutPrefix(header, "Bearer ")
		if !ok || strings.TrimSpace(token) == "" {
			writeError(w, http.StatusUnauthorized, "missing bearer token")
			return
		}
		username, ok := a.sessionUsername(strings.TrimSpace(token))
		if !ok {
			writeError(w, http.StatusUnauthorized, "invalid session")
			return
		}
		ctx := context.WithValue(r.Context(), usernameKey, username)
		next(w, r.WithContext(ctx))
	}
}

func requestUsername(r *http.Request) string {
	username, _ := r.Context().Value(usernameKey).(string)
	return username
}
