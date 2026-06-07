package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

const passwordIterations = 120000

type SecretBox struct {
	key []byte
}

func NewSecretBox(secret string) *SecretBox {
	sum := sha256.Sum256([]byte(secret))
	return &SecretBox{key: sum[:]}
}

func (s *SecretBox) Encrypt(plain string) (string, string, error) {
	block, err := aes.NewCipher(s.key)
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
	ciphertext := gcm.Seal(nil, nonce, []byte(plain), nil)
	return base64.RawStdEncoding.EncodeToString(nonce), base64.RawStdEncoding.EncodeToString(ciphertext), nil
}

func (s *SecretBox) Decrypt(nonceText, cipherText string) (string, error) {
	nonce, err := base64.RawStdEncoding.DecodeString(nonceText)
	if err != nil {
		return "", err
	}
	cipherBytes, err := base64.RawStdEncoding.DecodeString(cipherText)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(s.key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	plain, err := gcm.Open(nil, nonce, cipherBytes, nil)
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
	digest := stretchPassword([]byte(password), salt, passwordIterations)
	return fmt.Sprintf("v1$%d$%s$%s", passwordIterations, base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(digest)), nil
}

func verifyPassword(password, encoded string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 4 || parts[0] != "v1" {
		return false
	}
	iterations, err := strconv.Atoi(parts[1])
	if err != nil || iterations <= 0 {
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
	actual := stretchPassword([]byte(password), salt, iterations)
	return subtle.ConstantTimeCompare(actual, expected) == 1
}

func stretchPassword(password, salt []byte, iterations int) []byte {
	mac := hmac.New(sha256.New, password)
	_, _ = mac.Write(salt)
	digest := mac.Sum(nil)
	for i := 1; i < iterations; i++ {
		mac = hmac.New(sha256.New, password)
		_, _ = mac.Write(digest)
		digest = mac.Sum(nil)
	}
	return digest
}

func (a *App) saveSecret(name, plain string) error {
	if strings.TrimSpace(plain) == "" {
		return errors.New("secret cannot be empty")
	}
	nonce, ciphertext, err := a.crypto.Encrypt(plain)
	if err != nil {
		return err
	}
	_, err = a.db.Exec("INSERT INTO secrets(name,nonce,ciphertext,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(name) DO UPDATE SET nonce=excluded.nonce,ciphertext=excluded.ciphertext,updated_at=CURRENT_TIMESTAMP", name, nonce, ciphertext)
	return err
}

func (a *App) loadSecret(name string) (string, bool) {
	var nonce, ciphertext string
	if err := a.db.QueryRow("SELECT nonce,ciphertext FROM secrets WHERE name=?", name).Scan(&nonce, &ciphertext); err != nil {
		return "", false
	}
	value, err := a.crypto.Decrypt(nonce, ciphertext)
	return value, err == nil
}
