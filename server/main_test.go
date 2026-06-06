package main

import (
	"archive/zip"
	"os"
	"path/filepath"
	"testing"
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
